import {
  CHARTS, radians, clamp, circlePoint, coordinate, inChart,
  isCovered, uncoveredWitness, arcLengthFromChart
} from './manifold-math.mjs';

const $ = id => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const TAU = Math.PI * 2;
const STEP = 5;
const COLORS = { ink: '#274354', blue: '#547bab', teal: '#4d9092', muted: '#657989', grid: '#e7f0f5', rust: '#ac6248' };
const chapters = ['局部观察者', '坐标与距离', '拼接局部', '不变的物理'];
const anchors = ['local-observer', 'coordinates', 'atlas', 'invariance'];
const insights = [
  '局部的平面坐标并不保持距离。缩小观察范围，也没有让球面的曲率消失。',
  '坐标差取决于你怎么编号；用度规换算后的路程，才是尺子测量的量。',
  '失去一张地图，不等于空间消失了一块。坐标图的边界不一定是物理边界。',
  '坐标与度规分量一起变，测得的同一段路程保持不变。'
];
const state = {
  scene: 0, alpha: 45, yaw: .44, pitch: -.27, unfold: 0, unfoldTarget: 0,
  rotating: false, angle: 45, chart: 'top', atlas: Object.keys(CHARTS),
  transitionAngle: 35, activeCoordinate: 'top', moving: false, direction: 1,
  walk: null, swap: 0
};
const canvases = ['sphere-canvas', 'chart-canvas', 'atlas-canvas', 'transition-canvas'].map($);
const contexts = canvases.map(canvas => canvas.getContext('2d'));
const geometry = {};
let frame = null;
let lastTime = null;

function text(ctx, value, x, y, options = {}) {
  ctx.save();
  ctx.fillStyle = options.color || COLORS.ink;
  ctx.font = `${options.italic ? 'italic ' : ''}${options.size || 16}px ${options.math ? 'Georgia, serif' : '"Songti SC", "Noto Serif CJK SC", serif'}`;
  ctx.textAlign = options.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
  ctx.restore();
}
function path(ctx, points, color = COLORS.blue, width = 1, dash = []) {
  if (!points.length) return;
  ctx.save(); ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash);
  points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.stroke(); ctx.restore();
}
function dot(ctx, x, y, color = COLORS.blue, radius = 5, hollow = false) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU);
  ctx.fillStyle = hollow ? '#f7fbfd' : color; ctx.strokeStyle = color; ctx.lineWidth = 1.6;
  ctx.fill(); ctx.stroke(); ctx.restore();
}
function arrow(ctx, from, to, color = COLORS.blue, bend = 0, label = '') {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.2;
  const control = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + bend];
  ctx.beginPath(); ctx.moveTo(...from); ctx.quadraticCurveTo(...control, ...to); ctx.stroke();
  const a = Math.atan2(to[1] - control[1], to[0] - control[0]);
  ctx.beginPath(); ctx.moveTo(...to);
  ctx.lineTo(to[0] - 7 * Math.cos(a - .4), to[1] - 7 * Math.sin(a - .4));
  ctx.lineTo(to[0] - 7 * Math.cos(a + .4), to[1] - 7 * Math.sin(a + .4));
  ctx.closePath(); ctx.fill(); ctx.restore();
  if (label) text(ctx, label, control[0], control[1] - 13, { math: true, italic: true, size: 19, color });
}
function circleArc(ctx, center, radius, start, end, color, width = 3, dash = []) {
  const points = [];
  const count = Math.max(8, Math.ceil(Math.abs(end - start) * 35));
  for (let i = 0; i <= count; i++) {
    const a = start + (end - start) * i / count;
    points.push([center.x + radius * Math.cos(a), center.y - radius * Math.sin(a)]);
  }
  path(ctx, points, color, width, dash);
}
function atCircle(center, radius, angle) {
  return [center.x + radius * Math.cos(angle), center.y - radius * Math.sin(angle)];
}
function canvasSetup(index) {
  const canvas = canvases[index];
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth; canvas.height = pixelHeight;
  }
  const ctx = contexts[index];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f7fbfd'; ctx.fillRect(0, 0, width, height);
  ctx.beginPath(); ctx.strokeStyle = COLORS.grid; ctx.lineWidth = .6;
  for (let x = 0; x < width; x += 28) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = 0; y < height; y += 28) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
  return { ctx, w: width, h: height, narrow: width < 540 };
}
function drawAxes(ctx, center, radius) {
  arrow(ctx, [center.x - radius, center.y], [center.x + radius, center.y], '#91aabc');
  arrow(ctx, [center.x, center.y + radius], [center.x, center.y - radius], '#91aabc');
  text(ctx, 'x', center.x + radius + 10, center.y + 10, { size: 15, math: true, italic: true });
  text(ctx, 'y', center.x + 12, center.y - radius, { size: 15, math: true, italic: true });
}
function interval(ctx, x1, x2, y, values, color, label, active = true) {
  const { first, last } = values;
  path(ctx, [[x1, y], [x2, y]], active ? color : '#a0b4c3', 1.5);
  dot(ctx, x1, y, color, 3.5, true); dot(ctx, x2, y, color, 3.5, true);
  path(ctx, [[(x1 + x2) / 2, y - 3], [(x1 + x2) / 2, y + 3]], '#a9becb');
  text(ctx, '−1', x1, y + 22, { size: 13, math: true });
  text(ctx, '1', x2, y + 22, { size: 13, math: true });
  text(ctx, label, (x1 + x2) / 2, y - 31, { size: 16, color, math: true });
  const px = value => x1 + (value + 1) * (x2 - x1) / 2;
  if (first !== null) {
    path(ctx, [[px(first), y - 8], [px(first), y]], color);
    dot(ctx, px(first), y - 8, color, 4);
  }
  if (last !== null) {
    path(ctx, [[px(last), y + 8], [px(last), y]], color);
    dot(ctx, px(last), y + 8, color, 4, true);
  }
  return { first: first === null ? null : px(first), last: last === null ? null : px(last) };
}

function renderSphere() {
  const { ctx, w, h, narrow } = canvasSetup(0);
  const c = { x: w * .31, y: h * .46 };
  const radius = Math.min(h * .38, w * .275);
  const plane = { x: w * .80, y: h * .47 };
  const planeScale = Math.min(h * .22, w * .135);
  const alpha = radians(state.alpha), beta = alpha * .65, direction = .62;
  const rotate = ([x, y, z]) => {
    const a = x * Math.cos(state.yaw) + z * Math.sin(state.yaw);
    const b = -x * Math.sin(state.yaw) + z * Math.cos(state.yaw);
    return [a, y * Math.cos(state.pitch) - b * Math.sin(state.pitch), y * Math.sin(state.pitch) + b * Math.cos(state.pitch)];
  };
  const project = point => {
    const [x, y, z] = rotate(point);
    return [c.x + radius * x, c.y - radius * y, z];
  };
  const chart = point => [plane.x + planeScale * point[0], plane.y - planeScale * point[1]];
  const capPoint = (rho, t) => [Math.sin(rho) * Math.cos(t), Math.sin(rho) * Math.sin(t), Math.cos(rho)];
  const blend = point => {
    const a = project(point), b = chart(point);
    return [a[0] * (1 - state.unfold) + b[0] * state.unfold, a[1] * (1 - state.unfold) + b[1] * state.unfold];
  };
  const shade = ctx.createRadialGradient(c.x - radius * .4, c.y - radius * .5, 0, c.x, c.y, radius);
  shade.addColorStop(0, '#f8fcfe'); shade.addColorStop(.65, '#e6f1f8'); shade.addColorStop(1, '#cfe2ef');
  ctx.beginPath(); ctx.arc(c.x, c.y, radius, 0, TAU); ctx.fillStyle = shade; ctx.fill();
  const grid = [];
  for (let lat = -75; lat <= 75; lat += 15) {
    const row = [];
    for (let i = 0; i <= 96; i++) {
      const t = TAU * i / 96, l = radians(lat);
      row.push(project([Math.cos(l) * Math.cos(t), Math.sin(l), Math.cos(l) * Math.sin(t)]));
    }
    grid.push(row);
  }
  for (let lon = 0; lon < 180; lon += 15) {
    const row = [], a = radians(lon);
    for (let i = 0; i <= 96; i++) {
      const t = TAU * i / 96;
      row.push(project([Math.cos(t) * Math.cos(a), Math.sin(t), Math.cos(t) * Math.sin(a)]));
    }
    grid.push(row);
  }
  for (const front of [false, true]) {
    ctx.save(); ctx.globalAlpha = front ? .66 : .23;
    ctx.strokeStyle = '#719cba'; ctx.lineWidth = .75;
    ctx.setLineDash(front ? [] : [3, 4]); ctx.beginPath();
    for (const row of grid) for (let i = 1; i < row.length; i++) {
      if ((row[i][2] >= 0) === front) { ctx.moveTo(row[i - 1][0], row[i - 1][1]); ctx.lineTo(row[i][0], row[i][1]); }
    }
    ctx.stroke(); ctx.restore();
  }
  circleArc(ctx, c, radius, 0, TAU, '#7d9eb6', .8);
  const cap = Array.from({ length: 81 }, (_, i) => capPoint(alpha, TAU * i / 80));
  const fillCap = (map, opacity) => {
    ctx.save(); ctx.globalAlpha = opacity; ctx.beginPath();
    cap.map(map).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fillStyle = '#8eb8d8'; ctx.fill(); ctx.restore();
  };
  fillCap(project, .22);
  path(ctx, cap.map(project), '#547bab', 1.2, [5, 4]);
  const diskRadius = planeScale * Math.sin(alpha);
  ctx.beginPath(); ctx.arc(plane.x, plane.y, diskRadius, 0, TAU); ctx.fillStyle = '#dfedf780'; ctx.fill();
  circleArc(ctx, plane, diskRadius, 0, TAU, '#547bab', 1, [4, 4]);
  drawAxes(ctx, plane, planeScale * 1.06);
  if (state.unfold > .002) {
    fillCap(blend, .25);
    path(ctx, cap.map(blend), '#547bab', 1.3, [4, 3]);
    for (let j = 1; j < 4; j++) path(ctx, Array.from({ length: 81 }, (_, i) => blend(capPoint(alpha * j / 4, TAU * i / 80))), '#82abc7', .6);
    for (let j = 0; j < 8; j++) path(ctx, Array.from({ length: 31 }, (_, i) => blend(capPoint(alpha * i / 30, TAU * j / 8))), '#82abc7', .6);
  }
  const walk = Array.from({ length: 31 }, (_, i) => capPoint(beta * i / 30, direction));
  path(ctx, walk.map(project), COLORS.blue, 3);
  path(ctx, walk.map(chart), COLORS.teal, 2.5);
  const p = project([0, 0, 1]), q = project(capPoint(beta, direction));
  dot(ctx, p[0], p[1], COLORS.ink, 4.5); dot(ctx, q[0], q[1], COLORS.blue, 4, true);
  text(ctx, 'p', p[0] - 12, p[1] + 14, { math: true, italic: true });
  text(ctx, 'q', q[0] + 10, q[1] - 10, { math: true, italic: true });
  dot(ctx, plane.x, plane.y, COLORS.ink, 3.5);
  const q2 = chart(capPoint(beta, direction)); dot(ctx, q2[0], q2[1], COLORS.teal, 3.5, true);
  arrow(ctx, [c.x + radius + 14, h * .43], [plane.x - planeScale - 9, h * .46], COLORS.blue, -18, 'φ');
  text(ctx, '球面 S²', c.x, h * .89, { size: narrow ? 15 : 20 });
  text(ctx, '坐标平面 ℝ²', plane.x, h * .77, { size: narrow ? 13 : 17 });
  text(ctx, '观察者只能沿表面测量', c.x, h * .96, { size: narrow ? 11 : 13, color: COLORS.muted });
}

function renderChart() {
  const { ctx, w, h, narrow } = canvasSetup(1);
  const center = { x: w * (narrow ? .5 : .29), y: h * (narrow ? .31 : .46) };
  const radius = Math.min(h * (narrow ? .235 : .32), w * .235);
  geometry.chart = { center, radius };
  const item = CHARTS[state.chart], angle = radians(state.angle);
  drawAxes(ctx, center, radius * 1.18);
  circleArc(ctx, center, radius, 0, TAU, '#b3c4ce', 1.2, [3, 4]);
  circleArc(ctx, center, radius, item.start, item.end, item.color, 3.8);
  for (const end of [item.start, item.end]) dot(ctx, ...atCircle(center, radius, end), item.color, 4.5, true);
  circleArc(ctx, center, radius, angle, angle + radians(STEP), COLORS.ink, 6);
  const p = circlePoint(state.angle), q = circlePoint(state.angle + STEP);
  const pxy = atCircle(center, radius, angle), qxy = atCircle(center, radius, angle + radians(STEP));
  dot(ctx, ...pxy, COLORS.ink, 5); dot(ctx, ...qxy, COLORS.ink, 4.5, true);
  text(ctx, 'p', pxy[0] + 11, pxy[1] + 17, { math: true, italic: true });
  text(ctx, 'q', qxy[0] + 11, qxy[1] - 15, { math: true, italic: true });
  text(ctx, 'S¹', center.x - radius * .35, center.y - radius * .3, { math: true, italic: true, size: 22 });
  const first = coordinate(state.chart, p), last = coordinate(state.chart, q);
  const x1 = w * (narrow ? .19 : .60), x2 = w * (narrow ? .81 : .91), y = h * (narrow ? .79 : .48);
  interval(ctx, x1, x2, y, { first, last }, item.color, `φ${item.label}(p) = ${item.axis}`);
  if (!narrow) arrow(ctx, [center.x + radius + 16, center.y - 22], [x1 - 18, y - 10], item.color, -22, `φ${item.label}`);
  text(ctx, '实际路程 ℓ = 0.087 m', narrow ? w * .5 : w * .75, h * (narrow ? .94 : .76), { size: narrow ? 14 : 18 });
  if (first === null || last === null) text(ctx, '这一步需要换张图', (x1 + x2) / 2, y + 51, { color: COLORS.rust, size: 13 });
}

function renderAtlas() {
  const { ctx, w, h, narrow } = canvasSetup(2);
  const center = { x: w * (narrow ? .50 : .35), y: h * (narrow ? .37 : .49) };
  const radius = Math.min(h * (narrow ? .23 : .31), w * .235);
  circleArc(ctx, center, radius, 0, TAU, '#6f8797', 1.5);
  Object.entries(CHARTS).forEach(([name, chart], i) => {
    if (!state.atlas.includes(name)) return;
    const r = radius + 9 + i * 5;
    circleArc(ctx, center, r, chart.start + .015, chart.end - .015, chart.color, 4);
    for (const angle of [chart.start, chart.end]) dot(ctx, ...atCircle(center, r, angle), chart.color, 3.5, true);
  });
  // Missing arcs and isolated cardinal points are different and both matter.
  for (let a = 0; a < 360; a++) {
    if (!isCovered(a + .5, state.atlas)) circleArc(ctx, center, radius, radians(a), radians(a + 1), COLORS.rust, 4);
  }
  for (const a of [0, 90, 180, 270]) if (!isCovered(a, state.atlas)) {
    const p = atCircle(center, radius, radians(a));
    dot(ctx, ...p, COLORS.rust, 7, true); dot(ctx, ...p, COLORS.rust, 2.5);
  }
  text(ctx, 'S¹', center.x, center.y - 8, { size: 30, math: true, italic: true });
  text(ctx, '空间始终完整', center.x, center.y + 25, { size: 14, color: COLORS.muted });
  Object.entries(CHARTS).forEach(([name, chart], i) => {
    const x = narrow ? w * (.15 + (i % 2) * .48) : w * .71;
    const y = narrow ? h * .78 + Math.floor(i / 2) * 37 : h * .24 + i * 61;
    const on = state.atlas.includes(name);
    path(ctx, [[x - 15, y], [x + 10, y]], on ? chart.color : '#c6d2d9', 3, on ? [] : [3, 3]);
    text(ctx, `U${chart.label}  ${chart.domain}`, x + 22, y, { align: 'left', size: narrow ? 13 : 17, color: on ? COLORS.ink : '#8a9dab' });
  });
  if (!narrow) text(ctx, uncoveredWitness(state.atlas) ? '橙色 = 暂无坐标描述' : '每一点都有坐标描述', center.x, h * .92, { size: 15, color: uncoveredWitness(state.atlas) ? COLORS.rust : COLORS.blue });
}

function renderTransition() {
  const { ctx, w, h, narrow } = canvasSetup(3);
  const center = { x: w * .5, y: h * .35 }, radius = h * (narrow ? .225 : .26);
  geometry.transition = { center, radius };
  const a = radians(state.transitionAngle), b = radians(state.transitionAngle + STEP);
  const p = circlePoint(state.transitionAngle), q = circlePoint(state.transitionAngle + STEP);
  ctx.beginPath(); ctx.moveTo(center.x, center.y);
  for (let i = 0; i <= 40; i++) ctx.lineTo(...atCircle(center, radius, Math.PI * i / 80));
  ctx.closePath(); ctx.fillStyle = '#d6e9ee80'; ctx.fill();
  drawAxes(ctx, center, radius * 1.17);
  circleArc(ctx, center, radius, 0, TAU, '#a3b7c6', 1, [4, 4]);
  circleArc(ctx, center, radius, 0, Math.PI, COLORS.blue, state.activeCoordinate === 'top' ? 3.2 : 1.7);
  circleArc(ctx, center, radius + 3, -Math.PI / 2, Math.PI / 2, COLORS.teal, state.activeCoordinate === 'right' ? 3.2 : 1.7);
  circleArc(ctx, center, radius, a, b, COLORS.ink, 7);
  const pxy = atCircle(center, radius, a), qxy = atCircle(center, radius, b);
  path(ctx, [[center.x, center.y], pxy], '#94aaba', 1);
  dot(ctx, ...pxy, COLORS.ink, 5); dot(ctx, ...qxy, COLORS.ink, 4.5, true);
  text(ctx, 'p', pxy[0] + 13, pxy[1] + 14, { math: true, italic: true });
  text(ctx, 'q', qxy[0] + 13, qxy[1] - 14, { math: true, italic: true });
  text(ctx, 'S¹', center.x - radius * .78, center.y - radius * .80, { math: true, italic: true, size: 23 });
  text(ctx, 'R = 1 m', center.x, center.y + radius * .48, { math: true, size: 13, color: COLORS.muted });
  const u = coordinate('top', p), u2 = coordinate('top', q), v = coordinate('right', p), v2 = coordinate('right', q);
  const y = h * .76;
  interval(ctx, w * .07, w * .38, y, { first: u, last: u2 }, COLORS.blue, '上图：u = x', state.activeCoordinate === 'top');
  interval(ctx, w * .62, w * .93, y, { first: v, last: v2 }, COLORS.teal, '右图：v = y', state.activeCoordinate === 'right');
  arrow(ctx, [w * .41, y], [w * .59, y], state.activeCoordinate === 'top' ? COLORS.blue : COLORS.teal, -21, narrow ? '换图' : 'φ右 ∘ φ上⁻¹');
  if (state.swap > 0) {
    const progress = 1 - state.swap;
    const t = state.activeCoordinate === 'right' ? progress : 1 - progress;
    dot(ctx, w * (.41 + t * .18), y - 42 * t * (1 - t), COLORS.ink, 4);
  }
  const firstLength = arcLengthFromChart('top', state.transitionAngle, state.transitionAngle + STEP);
  const secondLength = arcLengthFromChart('right', state.transitionAngle, state.transitionAngle + STEP);
  const result = firstLength !== null && secondLength !== null ? `ℓ上 = ${firstLength.toFixed(3)} m   =   ℓ右 = ${secondLength.toFixed(3)} m` : '图域边界：换一张图，物理运动仍然连续';
  text(ctx, result, w * .5, h * .95, { size: narrow ? 12 : 17, color: firstLength !== null && secondLength !== null ? COLORS.ink : COLORS.rust });
}

function updateText() {
  const beta = radians(state.alpha) * .65;
  $('patch-value').value = `${state.alpha}°`;
  $('sphere-readout').textContent = `p → q：弧长 ${beta.toFixed(3)} m；投影长度 ${Math.sin(beta).toFixed(3)} m。`;
  const chart = CHARTS[state.chart];
  $('circle-value').value = `${Math.round(state.angle)}°`;
  $('circle-angle').value = state.angle;
  $('chart-formula').textContent = `U${chart.label} = {${chart.domain}}，φ${chart.label}(x, y) = ${chart.axis}`;
  const u = coordinate(state.chart, circlePoint(state.angle));
  const u2 = coordinate(state.chart, circlePoint(state.angle + STEP));
  const valid = u !== null && u2 !== null;
  $('chart-readout').classList.toggle('warning', !valid);
  $('chart-readout').textContent = valid
    ? `Δ坐标 = ${(u2 - u).toFixed(3)}；实际路程 ℓ = ${arcLengthFromChart(state.chart, state.angle, state.angle + STEP).toFixed(3)} m。`
    : '这一步超出当前坐标图，需换图描述。实际路程仍为 0.087 m。';
  const witness = uncoveredWitness(state.atlas);
  $('coverage-status').classList.toggle('warning', Boolean(witness));
  const clean = value => Math.abs(value) < 1e-9 ? 0 : Math.round(value);
  $('coverage-status').textContent = witness
    ? `${state.atlas.length} 张图：尚未覆盖整个圆周，例如 (${clean(witness.x)}, ${clean(witness.y)}) 没有坐标描述。`
    : '4 张图覆盖整个圆周：每个点都至少有一种坐标描述。';
  $('transition-value').value = `${Math.round(state.transitionAngle)}°`;
  $('transition-angle').value = state.transitionAngle;
  const a = state.transitionAngle, end = a + STEP;
  const lu = arcLengthFromChart('top', a, end), lv = arcLengthFromChart('right', a, end);
  const inOverlap = lu !== null && lv !== null;
  $('transition-readout').classList.toggle('warning', !inOverlap);
  $('switch-chart').disabled = (state.activeCoordinate === 'top' ? lv : lu) === null;
  if (inOverlap) {
    const start = coordinate(state.activeCoordinate, circlePoint(a));
    const finish = coordinate(state.activeCoordinate, circlePoint(end));
    const name = state.activeCoordinate === 'top' ? 'u' : 'v';
    $('transition-readout').textContent = `当前用 ${name}：${start.toFixed(3)} → ${finish.toFixed(3)}；两张图算得 ℓ = ${lu.toFixed(3)} m。`;
  } else {
    const currentValid = (state.activeCoordinate === 'top' ? lu : lv) !== null;
    const otherName = state.activeCoordinate === 'top' ? '右' : '上';
    $('transition-readout').textContent = currentValid
      ? `当前图仍可描述这一步，ℓ = 0.087 m；${otherName}图在边界失效，轨道并无物理奇点。`
      : `这一步超出当前图的图域，可切到${otherName}图。实际路程仍为 0.087 m。`;
  }
}
function render() {
  [renderSphere, renderChart, renderAtlas, renderTransition][state.scene]();
}
function tick(time) {
  const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, .05);
  const walking = Boolean(state.walk);
  lastTime = time;
  if (state.rotating) state.yaw += dt * .25;
  if (state.moving) {
    state.transitionAngle += dt * 10 * state.direction;
    if (state.transitionAngle > 78 || state.transitionAngle < 5) {
      state.transitionAngle = clamp(state.transitionAngle, 5, 78); state.direction *= -1;
    }
  }
  if (state.walk) {
    state.walk.elapsed += dt;
    state.angle = (state.walk.from + STEP * Math.min(state.walk.elapsed / .8, 1)) % 360;
    if (state.walk.elapsed >= .8) { state.walk = null; $('walk-step').disabled = false; }
  }
  const speed = reducedMotion.matches ? 1 : Math.min(1, dt * 7);
  state.unfold += (state.unfoldTarget - state.unfold) * speed;
  if (Math.abs(state.unfoldTarget - state.unfold) < .002) state.unfold = state.unfoldTarget;
  state.swap = Math.max(0, state.swap - dt * 1.8);
  if (state.moving || walking) updateText();
  render();
  if (state.rotating || state.moving || state.walk || state.unfold !== state.unfoldTarget || state.swap > 0) {
    frame = requestAnimationFrame(tick);
  } else { frame = null; lastTime = null; }
}
function requestRender() {
  if (frame === null && !document.hidden) frame = requestAnimationFrame(tick);
}
function motionButton(id, on, idle, running) {
  $(id).setAttribute('aria-pressed', String(on));
  $(id).querySelector('span').textContent = on ? running : idle;
  $(id).querySelector('path').setAttribute('d', on ? 'M3 2h3v12H3ZM10 2h3v12h-3Z' : 'M4 2 13 8 4 14Z');
}
function stopMotion() {
  state.rotating = false; state.moving = false; state.walk = null;
  $('walk-step').disabled = false;
  $('transition-readout').setAttribute('aria-live', 'polite');
  motionButton('rotate', false, '自动旋转', '暂停旋转');
  motionButton('move-point', false, '播放点的运动', '暂停运动');
}
function setScene(index, focus = false) {
  stopMotion(); state.scene = index;
  for (let i = 0; i < chapters.length; i++) {
    $(`lesson-${i}`).hidden = i !== index;
    $(`tab-${i}`).setAttribute('aria-selected', String(i === index));
    $(`tab-${i}`).tabIndex = i === index ? 0 : -1;
  }
  $('previous').disabled = index === 0;
  $('previous').querySelector('span').textContent = index ? `上一步：${chapters[index - 1]}` : '上一步';
  $('next').querySelector('span').textContent = index === 3 ? '从头再看' : `下一步：${chapters[index + 1]}`;
  $('step-count').textContent = `${index + 1} / 4`;
  $('insight').textContent = insights[index];
  history.replaceState(null, '', `#${anchors[index]}`);
  if (focus) $(`tab-${index}`).focus({ preventScroll: true });
  updateText(); requestRender();
}

document.querySelectorAll('[role="tab"]').forEach((button, index) => {
  button.addEventListener('click', () => setScene(index));
  button.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % 4;
    if (event.key === 'ArrowLeft') next = (index + 3) % 4;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 3;
    if (next !== undefined) { event.preventDefault(); setScene(next, true); }
  });
});
$('previous').addEventListener('click', () => setScene(Math.max(0, state.scene - 1), true));
$('next').addEventListener('click', () => setScene((state.scene + 1) % 4, true));
$('patch-size').addEventListener('input', event => { state.alpha = Number(event.target.value); updateText(); requestRender(); });
$('unfold').addEventListener('click', () => {
  state.unfoldTarget = state.unfoldTarget ? 0 : 1;
  $('unfold').setAttribute('aria-pressed', String(Boolean(state.unfoldTarget)));
  $('unfold').textContent = state.unfoldTarget ? '收回坐标图' : '展开坐标图'; requestRender();
});
$('rotate').addEventListener('click', () => {
  state.rotating = !state.rotating; motionButton('rotate', state.rotating, '自动旋转', '暂停旋转'); requestRender();
});
document.querySelectorAll('input[name="chart"]').forEach(input => input.addEventListener('change', () => {
  state.chart = input.value; updateText(); requestRender();
}));
$('circle-angle').addEventListener('input', event => { state.walk = null; $('walk-step').disabled = false; state.angle = Number(event.target.value); updateText(); requestRender(); });
$('walk-step').addEventListener('click', () => {
  if (reducedMotion.matches) { state.angle = (state.angle + STEP) % 360; updateText(); }
  else { state.walk = { from: state.angle, elapsed: 0 }; $('walk-step').disabled = true; }
  requestRender();
});
document.querySelectorAll('input[name="atlas"]').forEach(input => input.addEventListener('change', () => {
  state.atlas = [...document.querySelectorAll('input[name="atlas"]:checked')].map(item => item.value);
  updateText(); requestRender();
}));
$('restore-atlas').addEventListener('click', () => {
  document.querySelectorAll('input[name="atlas"]').forEach(input => { input.checked = true; });
  state.atlas = Object.keys(CHARTS); updateText(); requestRender();
});
$('transition-angle').addEventListener('input', event => {
  stopMotion(); state.transitionAngle = Number(event.target.value); updateText(); requestRender();
});
$('switch-chart').addEventListener('click', () => {
  state.activeCoordinate = state.activeCoordinate === 'top' ? 'right' : 'top';
  const right = state.activeCoordinate === 'right';
  $('switch-chart').setAttribute('aria-pressed', String(right));
  $('switch-chart').textContent = right ? '换到上图' : '换到右图';
  state.swap = reducedMotion.matches ? 0 : 1; updateText(); requestRender();
});
$('move-point').addEventListener('click', () => {
  state.moving = !state.moving;
  if (state.moving) state.transitionAngle = clamp(state.transitionAngle, 5, 78);
  $('transition-readout').setAttribute('aria-live', state.moving ? 'off' : 'polite');
  motionButton('move-point', state.moving, '播放点的运动', '暂停运动'); updateText(); requestRender();
});

// Pointer and keyboard affordances share the same analytic state as the sliders.
canvases.forEach((canvas, index) => {
  if (index === 2) return;
  let dragging = false, last = null;
  const move = event => {
    const box = canvas.getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top;
    if (index === 0 && last) {
      state.yaw += (x - last.x) * .009; state.pitch = clamp(state.pitch + (y - last.y) * .009, -1.45, 1.45);
    } else if (index !== 0) {
      const { center } = geometry[index === 1 ? 'chart' : 'transition'];
      let angle = (Math.atan2(center.y - y, x - center.x) * 180 / Math.PI + 360) % 360;
      if (index === 1) state.angle = angle;
      else { if (angle > 270) angle = 0; state.transitionAngle = clamp(angle, 0, 85); }
      updateText();
    }
    last = { x, y }; requestRender();
  };
  canvas.addEventListener('pointerdown', event => {
    if (index !== 0) {
      const box = canvas.getBoundingClientRect(), g = geometry[index === 1 ? 'chart' : 'transition'];
      const distance = Math.hypot(event.clientX - box.left - g.center.x, event.clientY - box.top - g.center.y);
      if (Math.abs(distance - g.radius) > 45) return;
    }
    stopMotion(); dragging = true; canvas.setPointerCapture(event.pointerId); move(event);
  });
  canvas.addEventListener('pointermove', event => { if (dragging) move(event); });
  canvas.addEventListener('pointerup', () => { dragging = false; last = null; });
  canvas.addEventListener('pointercancel', () => { dragging = false; last = null; });
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); stopMotion();
    const amount = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1;
    if (index === 0) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') state.pitch = clamp(state.pitch + amount * .08, -1.45, 1.45);
      else state.yaw += amount * .08;
    } else if (index === 1) state.angle = (state.angle + amount * 2 + 360) % 360;
    else state.transitionAngle = clamp(state.transitionAngle + amount, 0, 85);
    updateText(); requestRender();
  });
});
new ResizeObserver(requestRender).observe(document.querySelector('main'));
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMotion(); else requestRender(); });
window.addEventListener('hashchange', () => { const index = anchors.indexOf(location.hash.slice(1)); if (index >= 0) setScene(index); });
setScene(Math.max(0, anchors.indexOf(location.hash.slice(1))));
