/**
 * Units and guards for the spatial core.
 *
 * Everything below this layer is arithmetic on real physical quantities, so the one rule that
 * matters is that a number always carries a known unit. The suffix conventions used across the
 * spatial modules are the same ones the rest of the project already uses:
 *
 *   `...M`    metres
 *   `...Rad`  radians
 *   `...Deg`  degrees
 *   `...Mps`  metres per second
 *   `...S`    seconds
 *
 * Nothing here depends on Three.js. The spatial core must be usable from a worker, from a test and
 * from the render thread alike, and must never be tempted to reach for a renderer for the truth.
 */

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/** One astronomical unit, the IAU 2012 definition, in metres. */
export const AU_M = 149_597_870_700;
/** One light year, in metres: the IAU julian year times the defined speed of light. */
export const LIGHT_YEAR_M = 9_460_730_472_580_800;
/** One parsec, in metres, from the exact IAU 2015 definition. */
export const PARSEC_M = (648_000 / Math.PI) * AU_M;

export const degToRad = (deg: number): number => deg * DEG_TO_RAD;
export const radToDeg = (rad: number): number => rad * RAD_TO_DEG;

/** A mutable three-component vector of plain numbers. Deliberately not a `Vector3`. */
export type Vec3 = [number, number, number];
/** A quaternion as `[x, y, z, w]`, matching the order the render layer already uses. */
export type Quat = [number, number, number, number];

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const cloneVec3 = (v: Vec3): Vec3 => [v[0], v[1], v[2]];

export function isFiniteVec3(v: Vec3): boolean {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

/**
 * Replaces a non-finite value with a fallback. Used at every boundary where an outside number
 * enters the spatial core: one NaN reaching a reference frame silently poisons every frame
 * downstream of it, and the symptom surfaces somewhere else entirely.
 */
export function finite(value: number | undefined | null, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function finiteVec3(v: Vec3, fallback: Vec3 = [0, 0, 0]): Vec3 {
  return isFiniteVec3(v) ? v : cloneVec3(fallback);
}

export const lengthVec3 = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

export function distanceVec3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function addVec3(a: Vec3, b: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2];
  return out;
}

export function subVec3(a: Vec3, b: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2];
  return out;
}

export function scaleVec3(v: Vec3, scalar: number, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = v[0] * scalar; out[1] = v[1] * scalar; out[2] = v[2] * scalar;
  return out;
}

export const dotVec3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function crossVec3(a: Vec3, b: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x; out[1] = y; out[2] = z;
  return out;
}

export function normalizeVec3(v: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  const length = lengthVec3(v);
  if (!(length > 0)) { out[0] = 0; out[1] = 0; out[2] = 0; return out; }
  return scaleVec3(v, 1 / length, out);
}

/** Wraps a longitude-like angle into (-pi, pi]. */
export function wrapPi(rad: number): number {
  if (!Number.isFinite(rad)) return 0;
  const wrapped = ((rad + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  // `%` leaves -pi where +pi is wanted at the seam; pick the half-open convention deliberately.
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** Clamps a latitude-like angle to [-pi/2, pi/2] without wrapping it over a pole. */
export function clampHalfPi(rad: number): number {
  const half = Math.PI / 2;
  return Math.min(half, Math.max(-half, finite(rad)));
}

// --- Quaternions -------------------------------------------------------------------------------
// Frame transforms need rotation, and the spatial core cannot depend on Three.js, so the handful
// of operations it needs live here. Order is [x, y, z, w], matching what the render layer uses.

export const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

export const quat = (x = 0, y = 0, z = 0, w = 1): Quat => [x, y, z, w];
export const cloneQuat = (q: Quat): Quat => [q[0], q[1], q[2], q[3]];

export function isFiniteQuat(q: Quat): boolean {
  return Number.isFinite(q[0]) && Number.isFinite(q[1]) && Number.isFinite(q[2]) && Number.isFinite(q[3]);
}

/** Hamilton product: the rotation `a` applied after `b`. */
export function multiplyQuat(a: Quat, b: Quat, out: Quat = [0, 0, 0, 1]): Quat {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  const x = aw * bx + ax * bw + ay * bz - az * by;
  const y = aw * by - ax * bz + ay * bw + az * bx;
  const z = aw * bz + ax * by - ay * bx + az * bw;
  const w = aw * bw - ax * bx - ay * by - az * bz;
  out[0] = x; out[1] = y; out[2] = z; out[3] = w;
  return out;
}

/** Conjugate, which inverts a unit quaternion. */
export function conjugateQuat(q: Quat, out: Quat = [0, 0, 0, 1]): Quat {
  out[0] = -q[0]; out[1] = -q[1]; out[2] = -q[2]; out[3] = q[3];
  return out;
}

export function normalizeQuat(q: Quat, out: Quat = [0, 0, 0, 1]): Quat {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!(length > 0)) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1; return out; }
  out[0] = q[0] / length; out[1] = q[1] / length; out[2] = q[2] / length; out[3] = q[3] / length;
  return out;
}

/** Rotates a vector by a unit quaternion. */
export function rotateVec3(q: Quat, v: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  const [qx, qy, qz, qw] = q, [vx, vy, vz] = v;
  // t = 2 * (q_vec x v); v' = v + qw * t + q_vec x t
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  out[0] = vx + qw * tx + qy * tz - qz * ty;
  out[1] = vy + qw * ty + qz * tx - qx * tz;
  out[2] = vz + qw * tz + qx * ty - qy * tx;
  return out;
}

/** Rotates a vector by the inverse of a unit quaternion. */
export function rotateVec3Inverse(q: Quat, v: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  return rotateVec3(conjugateQuat(q, [0, 0, 0, 1]), v, out);
}

/** Builds a rotation from an axis (need not be normalised) and an angle in radians. */
export function quatFromAxisAngle(axis: Vec3, angleRad: number, out: Quat = [0, 0, 0, 1]): Quat {
  const unit = normalizeVec3(axis, [0, 0, 0]);
  const half = finite(angleRad) / 2;
  const s = Math.sin(half);
  out[0] = unit[0] * s; out[1] = unit[1] * s; out[2] = unit[2] * s; out[3] = Math.cos(half);
  return out;
}

/** The angle, in radians, between two orientations. */
export function quatAngleBetween(a: Quat, b: Quat): number {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, dot));
}
