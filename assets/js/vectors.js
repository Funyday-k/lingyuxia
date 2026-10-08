import {
  rad, clamp, dot, scale, apply, basis, vectorComponents, covectorComponents,
  tensorComponents, pairing, curve, tangent, secant, direction, temperature,
  temperatureDifferential, euclideanMetric, freePath, relabel,
  coordinateAcceleration, connectionTerm
} from './vectors-math.mjs';
const { t, getLanguage } = await import(`./gr-language.mjs${new URL(import.meta.url).search}`);
const $ = id => document.getElementById(id);
const colors = { ink: '#274354', blue: '#547bab', teal: '#4d9092', muted: '#657989', grid: '#e2edf3', rust: '#ac6248' };
const anchors = ['tangent-vectors', 'coordinates', 'covectors', 'tensors', 'covariance'];
const names = () => [t('Tangent vectors', '切矢量'), t('Coordinates', '坐标变换'), t('Covectors', '协向量'), t('Tensors', '张量'), t('Covariance', '协变性')];
const insights = () => [
  t('A tangent vector captures the first-order change at a point.', '切矢量刻画一点处的一阶变化。'),
  t('The basis and the components change inversely. Their combination is the same vector.', '基底与分量反向变化，组合起来仍是同一个矢量。'),
  t('A covector measures a vector. Opposite component changes preserve the scalar reading.', '协向量测量矢量。分量的反向补偿，保留同一个标量读数。'),
  t('The tensor is the multilinear rule. A matrix records that rule in a chosen basis.', '张量是多重线性的规则；矩阵记录它在选定基底下的分量。'),
  t('Covariance belongs to the complete equation, including the terms that account for a changing basis.', '协变性属于完整方程，也包括反映基底变化的那些项。')
];
const state = { scene: 0 };
const inputs = [...document.querySelectorAll('input[type="range"]')];
inputs.forEach(input => { state[input.id] = Number(input.value); });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let raf = null, lastTime = null, limit = null, playing = false;
const clean = value => Math.abs(value) < .0005 ? 0 : value;
const number = (value, digits = 2) => clean(value).toFixed(digits);
const pair = vector => `(${vector.map(v => number(v)).join(', ')})`;

function text(ctx, value, x, y, { size = 16, color = colors.ink, align = 'center', italic = false } = {}) {
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}${size}px ${getLanguage() === 'en' ? 'Georgia, serif' : '"Songti SC", "Noto Serif CJK SC", serif'}`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  const width = ctx.measureText(value).width, canvasWidth = ctx.canvas.width / ctx.getTransform().a;
  const left = align === 'center' ? width / 2 : align === 'right' ? width : 0;
  const right = align === 'center' ? width / 2 : align === 'left' ? width : 0;
  ctx.fillText(value, clamp(x, 12 + left, canvasWidth - 12 - right), y);
  ctx.restore();
}
function line(ctx, points, color = colors.blue, width = 1.3, dash = []) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); ctx.restore();
}
function point(ctx, p, color = colors.ink, radius = 4, hollow = false) {
  ctx.save(); ctx.beginPath(); ctx.arc(...p, radius, 0, 2 * Math.PI); ctx.fillStyle = hollow ? '#f7fbfd' : color;
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); ctx.restore();
}
function arrow(ctx, start, end, color = colors.blue, width = 2.1) {
  const dx = end[0] - start[0], dy = end[1] - start[1], length = Math.hypot(dx, dy);
  if (length < .1) return;
  line(ctx, [start, end], color, width);
  const a = Math.atan2(dy, dx), head = Math.min(9, length * .25);
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(...end);
  ctx.lineTo(end[0] - head * Math.cos(a - .4), end[1] - head * Math.sin(a - .4));
  ctx.lineTo(end[0] - head * Math.cos(a + .4), end[1] - head * Math.sin(a + .4)); ctx.closePath(); ctx.fill(); ctx.restore();
}
function setup(index) {
  const canvas = $(`canvas-${index}`), rect = canvas.getBoundingClientRect();
  const w = rect.width - 2, h = rect.height - 2, dpr = Math.min(devicePixelRatio || 1, 2);
  if (w <= 0 || h <= 0) return null;
  const width = Math.round(w * dpr), height = Math.round(h * dpr);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  return { ctx, w, h, narrow: w < 520 };
}
function graph(ctx, box, bounds) {
  const [xmin, xmax, ymin, ymax] = bounds;
  const unit = Math.min(box.w / (xmax - xmin), box.h / (ymax - ymin));
  const ox = box.x + (box.w - (xmax - xmin) * unit) / 2 - xmin * unit;
  const oy = box.y + (box.h - (ymax - ymin) * unit) / 2 + ymax * unit;
  return { ctx, box, unit, map: p => [ox + p[0] * unit, oy - p[1] * unit], bounds };
}
function clipped(g, draw) {
  g.ctx.save(); g.ctx.beginPath(); g.ctx.rect(g.box.x, g.box.y, g.box.w, g.box.h); g.ctx.clip(); draw(); g.ctx.restore();
}
function grid(g, E = euclideanMetric) {
  clipped(g, () => {
    for (let i = -10; i <= 10; i++) {
      line(g.ctx, [g.map(apply(E, [i / 2, -10])), g.map(apply(E, [i / 2, 10]))], colors.grid, .7);
      line(g.ctx, [g.map(apply(E, [-10, i / 2])), g.map(apply(E, [10, i / 2]))], colors.grid, .7);
    }
  });
}
function axes(g, labels = ['x', 'y']) {
  const [xmin, xmax, ymin, ymax] = g.bounds;
  arrow(g.ctx, g.map([xmin, 0]), g.map([xmax, 0]), '#9badb8', 1);
  arrow(g.ctx, g.map([0, ymin]), g.map([0, ymax]), '#9badb8', 1);
  const x = g.map([xmax, 0]), y = g.map([0, ymax]);
  text(g.ctx, labels[0], x[0] - 7, x[1] - 14, { italic: true, size: 16 });
  text(g.ctx, labels[1], y[0] + 16, y[1] + 10, { italic: true, size: 16 });
}
function sampled(fn, from, to, count = 140) { return Array.from({ length: count + 1 }, (_, i) => fn(from + (to - from) * i / count)); }
function legend(ctx, items, width, y, narrow) {
  const gap = width / items.length;
  items.forEach(([label, color], i) => {
    text(ctx, label, gap * (i + .5), y, { size: narrow ? 12 : 16, color });
  });
}
function tangentScene() {
  const { ctx, w, h, narrow } = setup(0);
  const g = graph(ctx, { x: 25, y: 43, w: w - 50, h: h - 95 }, [-1.2, 2.05, -.85, 1.65]);
  grid(g); axes(g);
  const a = state.bending, dt = state['time-step'];
  clipped(g, () => {
    [-.9, -.45, 0, .45, .9].forEach(b => line(ctx, sampled(t => g.map(curve(t, b)), -1.3, 2.2), '#b8cddd', 1, [3, 5]));
    line(ctx, sampled(t => g.map(curve(t, a)), -1.3, 2.2), colors.blue, 2);
    line(ctx, [g.map([-1.2, -.66]), g.map([2.05, 1.1275])], '#4d90925c', 1, [4, 4]);
  });
  const p = g.map([0, 0]), average = g.map(secant(dt, a)), exact = g.map(tangent());
  if (dt > 0) {
    const q = g.map(curve(dt, a)); line(ctx, [p, q], colors.blue, 1, [3, 3]); point(ctx, q, colors.blue, 4, true);
    text(ctx, 'q', q[0] - 12, q[1] - 16, { italic: true });
  }
  arrow(ctx, p, average, colors.blue, 2.5); arrow(ctx, p, exact, colors.teal, 2.5); point(ctx, p);
  text(ctx, 'p', p[0] - 11, p[1] + 17, { italic: true });
  text(ctx, 'v̄', average[0] + 11, average[1] - 16, { size: 20, color: colors.blue, italic: true });
  text(ctx, 'v', exact[0] + 12, exact[1] + 15, { size: 20, color: colors.teal, italic: true });
  legend(ctx, [[t('tangent v', '切矢量 v'), colors.teal], [t('average velocity v̄', '平均速度 v̄'), colors.blue]], w, 22, narrow);
  text(ctx, `γₐ(t) = (t, 0.55t + ½at²)`, w / 2, h - 20, { size: narrow ? 13 : 18 });
}
function coordinatesScene() {
  const { ctx, w, h, narrow } = setup(1);
  const E = basis(state['basis-angle'], state['basis-scale']), v = [1.4, .8], vp = vectorComponents(E, v);
  const g = graph(ctx, { x: 24, y: 45, w: w - 48, h: h - 106 }, [-1.3, 2.65, -1.1, 2.2]);
  grid(g, E); axes(g);
  const p = g.map([0, 0]), e1 = apply(E, [1, 0]), e2 = apply(E, [0, 1]), part1 = scale(e1, vp[0]);
  arrow(ctx, p, g.map(e1), colors.blue, 1.8); arrow(ctx, p, g.map(e2), colors.blue, 1.8);
  [[e1, '∂′₁'], [e2, '∂′₂']].forEach(([e, label]) => { const q = g.map(e); text(ctx, label, q[0] - 14, q[1] - 17, { color: colors.blue }); });
  line(ctx, [p, g.map(part1), g.map(v)], colors.blue, 2, [5, 5]);
  arrow(ctx, p, g.map(v), colors.teal, 3); point(ctx, p);
  const end = g.map(v); text(ctx, 'v', end[0] + 13, end[1] - 12, { color: colors.teal, size: 23, italic: true });
  text(ctx, t('One physical velocity', '同一个实际速度'), w / 2, 23, { size: narrow ? 16 : 20 });
  legend(ctx, [['v = (1.40, 0.80)', colors.teal], [`v′ = ${pair(vp)}`, colors.blue]], w, h - 23, narrow);
}
function covectorsScene() {
  const { ctx, w, h, narrow } = setup(2);
  const v = direction(state['probe-angle']), E = basis(0, state['dual-scale']);
  const g = graph(ctx, { x: 22, y: 43, w: w - 44, h: h - 95 }, [-1.6, 1.9, -1.4, 1.7]);
  grid(g, E);
  clipped(g, () => {
    for (let level = -7; level <= 7; level++) {
      line(ctx, [g.map([-6, level + 12]), g.map([6, level - 12])], level % 2 ? '#92bac777' : '#79a5b7bb', level === 0 ? 1.8 : 1.1);
    }
  });
  for (const level of [-2, 0, 2, 4]) {
    const label = g.map([.9, level - 1.8]);
    if (label[1] > g.box.y + 12 && label[1] < g.box.y + g.box.h - 12) text(ctx, `${20 + level} K`, label[0] + 24, label[1] - 5, { size: 13, color: colors.muted });
  }
  const p = g.map([0, 0]), end = g.map(v);
  arrow(ctx, p, end, colors.teal, 3); point(ctx, p); point(ctx, end, colors.teal, 5, true);
  text(ctx, 'p: 20 K', p[0] - 35, p[1] + 22, { size: 13 });
  text(ctx, 'v', end[0] + 15, end[1] - 14, { color: colors.teal, italic: true, size: 21 });
  text(ctx, `${number(temperature(v))} K`, end[0], end[1] + 23, { color: colors.teal, size: 14 });
  text(ctx, t('A thermometer after 1 second', '温度计移动 1 秒后'), w / 2, 22, { size: narrow ? 15 : 19 });
  const rate = dot(temperatureDifferential, v);
  text(ctx, `dT(v) = ${number(rate)} K/s`, w / 2, h - 20, { color: colors.teal, size: narrow ? 18 : 23 });
}
function tensorsScene() {
  const { ctx, w, h, narrow } = setup(3);
  const angle = state['tensor-angle'], c = state['vector-scale'], b = state['tensor-scale'];
  const v = [c, 0], u = direction(angle), E = basis(0, b);
  const g = graph(ctx, { x: 25, y: 53, w: w - 50, h: h - 105 }, [-1.4, 2.5, -.9, 1.7]);
  grid(g, E); axes(g, ['x′', 'y′']);
  const origin = g.map([0, 0]);
  ctx.save(); ctx.fillStyle = '#547bab18'; ctx.beginPath(); ctx.moveTo(...origin); ctx.arc(...origin, 28, 0, -rad(angle), true); ctx.closePath(); ctx.fill(); ctx.restore();
  line(ctx, [g.map(u), g.map([u[0], 0])], colors.muted, 1.2, [4, 4]);
  arrow(ctx, origin, g.map(v), colors.blue, 3); arrow(ctx, origin, g.map(u), colors.teal, 2.5); point(ctx, origin);
  const vEnd = g.map(v), wEnd = g.map(u);
  text(ctx, c === 0 ? 'v = 0' : 'v', vEnd[0] + 9, vEnd[1] + 21, { color: colors.blue, size: 19, italic: true });
  text(ctx, 'w', wEnd[0] + 9, wEnd[1] - 17, { color: colors.teal, size: 19, italic: true });
  text(ctx, `g′ = diag(${number(b * b)}, 1.00)`, w / 2, 25, { color: colors.blue, size: narrow ? 16 : 21 });
  text(ctx, `g(v, w) = ${number(c * Math.cos(rad(angle)))}`, w / 2, h - 20, { size: narrow ? 19 : 24 });
}
function covarianceScene() {
  const { ctx, w, h, narrow } = setup(4);
  const k = state.warp, time = state['travel-time'];
  const panelHeight = (h - 176) / 2;
  const boxes = narrow
    ? [{ x: 22, y: 40, w: w - 44, h: panelHeight }, { x: 22, y: 108 + panelHeight, w: w - 44, h: panelHeight }]
    : [{ x: 25, y: 45, w: (w - 78) / 2, h: h - 116 }, { x: (w + 28) / 2, y: 45, w: (w - 78) / 2, h: h - 116 }];
  boxes.forEach((box, i) => {
    const g = graph(ctx, box, [-1.8, 1.8, -2, 2.15]); grid(g); axes(g, i ? ['X', 'Y'] : ['x', 'y']);
    const fn = i ? t => relabel(freePath(t), k) : freePath;
    line(ctx, sampled(t => g.map(fn(t)), -1.5, 1.5), i ? colors.blue : colors.teal, 2.5);
    const position = g.map(fn(time)); point(ctx, position, colors.ink, 5);
    text(ctx, 'p', position[0] + 14, position[1] - 12, { italic: true, size: 16 });
    text(ctx, i ? t('Coordinate trace', '坐标轨迹') : t('Physical track', '实际轨迹'), box.x + box.w / 2, box.y - 19, { size: narrow ? 16 : 20, color: i ? colors.blue : colors.teal });
    text(ctx, i ? 'Y = 0.35t + κt²' : 'y = 0.35t', box.x + box.w / 2, box.y + box.h + 17, { size: narrow ? 13 : 15 });
  });
  text(ctx, `${number(2 * k)} + (${number(-2 * k)}) = 0`, w / 2, h - 20, { size: narrow ? 19 : 23 });
}
const scenes = [tangentScene, coordinatesScene, covectorsScene, tensorsScene, covarianceScene];
function readout(index, rows) { $(`readout-${index}`).innerHTML = rows.map(row => `<span>${row}</span>`).join(''); }
function updateText() {
  inputs.forEach(input => {
    input.value = state[input.id];
    const angle = ['basis-angle', 'probe-angle', 'tensor-angle'].includes(input.id);
    $(`${input.id}-value`).value = number(state[input.id], angle ? (input.id === 'probe-angle' ? 1 : 0) : 2) + (angle ? '°' : '');
  });
  const avg = secant(state['time-step'], state.bending);
  readout(0, [`v = (1.00, 0.55) m/s`, `${t('Average', '平均速度')} v̄ = ${pair(avg)} m/s`, `${t('Difference', '差值')} = ${number(Math.abs(avg[1] - .55), 3)} m/s`]);
  const E = basis(state['basis-angle'], state['basis-scale']), vp = vectorComponents(E, [1.4, .8]);
  readout(1, [`v = (1.40, 0.80)`, `v′ = ${pair(vp)}`, t('Recombine the dashed components: the arrow is unchanged.', '把虚线分量重新合成，箭头保持不变。')]);
  const v = direction(state['probe-angle']), dE = basis(0, state['dual-scale']);
  const alpha = covectorComponents(dE, temperatureDifferential), dv = vectorComponents(dE, v);
  readout(2, [`v′ = ${pair(dv)}`, `α′ = ${pair(alpha)}`, `α′ₐv′ᵃ = ${number(dot(alpha, dv))} K/s`]);
  const tv = [state['vector-scale'], 0], tw = direction(state['tensor-angle']), te = basis(0, state['tensor-scale']);
  const gp = tensorComponents(te, euclideanMetric);
  readout(3, [`v′ = ${pair(vectorComponents(te, tv))} · w′ = ${pair(vectorComponents(te, tw))}`, `g′ = diag(${number(gp[0][0])}, 1.00)`, `g′ₐᵦv′ᵃw′ᵇ = ${number(pairing(gp, vectorComponents(te, tv), vectorComponents(te, tw)))}`]);
  readout(4, [`${t('Coordinate acceleration', '坐标加速度')} d²Y/dt² = ${number(coordinateAcceleration(state.warp)[1])}`, `${t('Connection term', '联络项')} Γ<sup>Y</sup><sub>XX</sub> (dX/dt)² = ${number(connectionTerm(state.warp)[1])}`, t('Covariant acceleration: 0. The space is still flat.', '协变加速度为 0，空间仍然平直。')]);
  $('insight').textContent = insights()[state.scene];
  $('previous').disabled = state.scene === 0;
  $('next').querySelector('span').textContent = state.scene === 4 ? t('Start again', '从头再看') : t(`Next: ${names()[state.scene + 1]}`, `下一步：${names()[state.scene + 1]}`);
  $('step-count').textContent = `${state.scene + 1} / 5`;
  $('take-limit').disabled = state['time-step'] === 0;
  $('play-path').textContent = reducedMotion.matches ? t('Advance point', '向前走一步') : playing ? t('Pause motion', '暂停运动') : t('Play motion', '播放运动');
  $('play-path').setAttribute('aria-pressed', String(playing));
}
function frame(timestamp) {
  raf = null;
  const dt = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, .05); lastTime = timestamp;
  if (limit) {
    limit.elapsed += dt;
    const progress = clamp(limit.elapsed / 1.1, 0, 1);
    state['time-step'] = limit.start * (1 - progress) ** 2;
    if (progress === 1) { limit = null; state['time-step'] = 0; $('readout-0').setAttribute('aria-live', 'polite'); }
  }
  if (playing) {
    state['travel-time'] += dt * .55;
    if (state['travel-time'] > 1.5) state['travel-time'] = -1.5;
  }
  updateText(); scenes[state.scene]();
  if (limit || playing) requestRender(); else lastTime = null;
}
function requestRender() { if (raf === null) raf = requestAnimationFrame(frame); }
function stopMotion() {
  playing = false; limit = null; lastTime = null;
  $('readout-0').setAttribute('aria-live', 'polite'); $('readout-4').setAttribute('aria-live', 'polite');
}
function setScene(index, focus = false) {
  stopMotion(); state.scene = index;
  anchors.forEach((_, i) => {
    $(`lesson-${i}`).hidden = i !== index;
    $(`tab-${i}`).setAttribute('aria-selected', String(i === index)); $(`tab-${i}`).tabIndex = i === index ? 0 : -1;
  });
  history.replaceState(null, '', `#${anchors[index]}`);
  if (focus) { $(`tab-${index}`).focus({ preventScroll: true }); $('explore').scrollIntoView({ block: 'start', behavior: 'instant' }); }
  updateText(); requestRender();
}
document.querySelectorAll('[role="tab"]').forEach((tab, index) => {
  tab.addEventListener('click', () => setScene(index));
  tab.addEventListener('keydown', event => {
    const choices = { ArrowRight: (index + 1) % 5, ArrowLeft: (index + 4) % 5, Home: 0, End: 4 };
    if (event.key in choices) { event.preventDefault(); setScene(choices[event.key], true); }
  });
});
inputs.forEach(input => input.addEventListener('input', () => { stopMotion(); state[input.id] = Number(input.value); updateText(); requestRender(); }));
$('take-limit').addEventListener('click', () => {
  if (reducedMotion.matches) state['time-step'] = 0;
  else { limit = { start: state['time-step'], elapsed: 0 }; $('readout-0').setAttribute('aria-live', 'off'); }
  requestRender();
});
function change(values) { stopMotion(); Object.assign(state, values); updateText(); requestRender(); }
$('reset-tangent').addEventListener('click', () => change({ bending: .7, 'time-step': .8 }));
$('reset-basis').addEventListener('click', () => change({ 'basis-angle': 0, 'basis-scale': 1 }));
$('along-contour').addEventListener('click', () => change({ 'probe-angle': Math.atan2(-2, 1) * 180 / Math.PI }));
$('across-contours').addEventListener('click', () => change({ 'probe-angle': Math.atan2(1, 2) * 180 / Math.PI }));
$('align-vectors').addEventListener('click', () => change({ 'tensor-angle': 0 }));
$('reset-warp').addEventListener('click', () => change({ warp: 0 }));
$('play-path').addEventListener('click', () => {
  if (reducedMotion.matches) state['travel-time'] = state['travel-time'] >= 1.25 ? -1.5 : state['travel-time'] + .25;
  else playing = !playing;
  $('readout-4').setAttribute('aria-live', playing ? 'off' : 'polite'); updateText(); requestRender();
});
$('previous').addEventListener('click', () => setScene(Math.max(0, state.scene - 1), true));
$('next').addEventListener('click', () => setScene((state.scene + 1) % 5, true));
document.addEventListener('gr:languagechange', () => { updateText(); requestRender(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMotion(); updateText(); if (!document.hidden) requestRender(); });
reducedMotion.addEventListener('change', () => { stopMotion(); updateText(); requestRender(); });
window.addEventListener('hashchange', () => { const index = anchors.indexOf(location.hash.slice(1)); if (index >= 0) setScene(index); });
new ResizeObserver(requestRender).observe(document.querySelector('main'));
setScene(Math.max(0, anchors.indexOf(location.hash.slice(1))));
