// Two-dimensional teaching models. Matrices use row-major order.
export const rad = degrees => degrees * Math.PI / 180;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const scale = (a, k) => a.map(value => value * k);
export const add = (a, b) => a.map((value, i) => value + b[i]);
export const apply = (m, v) => [dot(m[0], v), dot(m[1], v)];
export const transpose = m => [[m[0][0], m[1][0]], [m[0][1], m[1][1]]];
export const multiply = (a, b) => a.map(row => transpose(b).map(column => dot(row, column)));
export function inverse(m) {
  const d = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  if (Math.abs(d) < 1e-12) throw new RangeError('The coordinate map must be invertible.');
  return [[m[1][1] / d, -m[0][1] / d], [-m[1][0] / d, m[0][0] / d]];
}
// Columns of E are the primed coordinate basis, expressed in the old basis.
export function basis(angle, stretch) {
  const a = rad(angle), c = Math.cos(a), s = Math.sin(a);
  return [[stretch * c, -s], [stretch * s, c]];
}
export const vectorComponents = (E, v) => apply(inverse(E), v);
export const covectorComponents = (E, alpha) => apply(transpose(E), alpha);
export const tensorComponents = (E, tensor) => multiply(multiply(transpose(E), tensor), E);
export const pairing = (g, v, w) => dot(v, apply(g, w));
export const curve = (t, bending) => [t, .55 * t + .5 * bending * t * t];
export const tangent = () => [1, .55];
export const secant = (step, bending) => [1, .55 + .5 * bending * step];
export const direction = angle => [Math.cos(rad(angle)), Math.sin(rad(angle))];
export const temperature = p => 20 + 2 * p[0] + p[1];
export const temperatureDifferential = [2, 1];
export const euclideanMetric = [[1, 0], [0, 1]];
export const freePath = t => [t, .35 * t];
export const relabel = (p, k) => [p[0], p[1] + k * p[0] ** 2];
export const relabelJacobian = (p, k) => [[1, 0], [2 * k * p[0], 1]];
export const coordinateAcceleration = k => [0, 2 * k];
// For X=x, Y=y+k*x², the only nonzero Levi-Civita coefficient is Γ^Y_XX.
export const connectionTerm = (k, velocityX = 1) => [0, -2 * k * velocityX ** 2];
