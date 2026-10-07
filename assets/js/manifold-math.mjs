// Analytic unit-circle charts. Boundaries are excluded from the open domains.
export const CHARTS = {
  top: { label: '上', domain: 'y > 0', axis: 'x', start: 0, end: Math.PI, color: '#547bab' },
  right: { label: '右', domain: 'x > 0', axis: 'y', start: -Math.PI / 2, end: Math.PI / 2, color: '#4d9092' },
  bottom: { label: '下', domain: 'y < 0', axis: 'x', start: Math.PI, end: 2 * Math.PI, color: '#9684a1' },
  left: { label: '左', domain: 'x < 0', axis: 'y', start: Math.PI / 2, end: 3 * Math.PI / 2, color: '#7c97b4' }
};
const EPS = 1e-10;
export const radians = degrees => degrees * Math.PI / 180;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function circlePoint(degrees) {
  const angle = radians(degrees);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
export function inChart(name, point) {
  return ({ top: point.y > EPS, right: point.x > EPS, bottom: point.y < -EPS, left: point.x < -EPS })[name] || false;
}
export function coordinate(name, point) {
  return inChart(name, point) ? point[CHARTS[name].axis] : null;
}
export function inverseChart(name, value) {
  if (!Number.isFinite(value) || Math.abs(value) >= 1) return null;
  const other = Math.sqrt(1 - value * value);
  if (name === 'top') return { x: value, y: other };
  if (name === 'bottom') return { x: value, y: -other };
  if (name === 'right') return { x: other, y: value };
  if (name === 'left') return { x: -other, y: value };
  return null;
}
export function transition(from, to, value) {
  const point = inverseChart(from, value);
  return point ? coordinate(to, point) : null;
}
export function isCovered(degrees, enabled) {
  const point = circlePoint(degrees);
  return enabled.some(name => inChart(name, point));
}
// Each cardinal point belongs to exactly one of these four open semicircles.
export function uncoveredWitness(enabled) {
  for (const degrees of [0, 90, 180, 270]) {
    if (!isCovered(degrees, enabled)) return circlePoint(degrees);
  }
  return null;
}
export function sphereInverse(u, v) {
  const squaredRadius = u * u + v * v;
  return squaredRadius < 1 ? [u, v, Math.sqrt(1 - squaredRadius)] : null;
}
// The induced metric is R^2 dq^2 / (1-q^2). Integrate it, rather than
// substituting a finite coordinate difference into the differential formula.
export function arcLengthFromChart(name, startDegrees, endDegrees, radius = 1) {
  const first = coordinate(name, circlePoint(startDegrees));
  const last = coordinate(name, circlePoint(endDegrees));
  if (first === null || last === null || Math.abs(endDegrees - startDegrees) >= 180 || radius <= 0) return null;
  return radius * Math.abs(Math.asin(clamp(last, -1, 1)) - Math.asin(clamp(first, -1, 1)));
}
