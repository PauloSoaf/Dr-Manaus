import type { Vec3 } from '../spatial/units';

/**
 * The Moon's surface: grey, cratered, and generated rather than measured.
 *
 * Stated plainly because the Earth's is not. The Earth here has real coastlines from Natural Earth
 * and real relief from ETOPO5; nothing equivalent has been ingested for the Moon, so what follows
 * is a texture, not selenography. It puts maria where the noise is low and highlands where it is
 * high, which is the right *kind* of surface and none of the right places.
 *
 * What it does guarantee is determinism. The value is a pure function of the direction, so two
 * tiles that share an edge agree on it exactly, the same crater is in the same place on every
 * machine forever, and `Math.random` appears nowhere — which is a project rule and also the only
 * way a saved crater means anything a week later.
 */

/** Metres of relief between the floor of a mare and the top of the highlands. */
export const MOON_RELIEF_M = 4_200;

/** The Moon is a sphere here. See `MoonProvider` for why that is not a shortcut. */
export const MOON_RADIUS_M = 1_738_100;

/** Slope exaggeration for shading, for the reason the Earth's has one: relief is invisible. */
const SLOPE_EXAGGERATION = 9;

/**
 * A hash from three integers to the unit interval.
 *
 * Integer arithmetic throughout, with `Math.imul` so the multiplications stay 32-bit rather than
 * drifting into doubles and losing the low bits that carry all the variation.
 */
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 0x27d4_eb2d) ^ Math.imul(y | 0, 0x85eb_ca6b) ^ Math.imul(z | 0, 0xc2b2_ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2545_f491);
  h ^= h >>> 13;
  return ((h >>> 0) % 0xffff) / 0xffff;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Trilinear value noise on the direction vector, which keeps it seamless across cube faces. */
function valueNoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  let result = 0;
  for (let dz = 0; dz <= 1; dz++) {
    const wz = dz ? zf : 1 - zf;
    for (let dy = 0; dy <= 1; dy++) {
      const wy = dy ? yf : 1 - yf;
      for (let dx = 0; dx <= 1; dx++) {
        const wx = dx ? xf : 1 - xf;
        result += hash3(xi + dx, yi + dy, zi + dz) * wx * wy * wz;
      }
    }
  }
  return result;
}

/** Several octaves, so the surface is rough at every scale a tile can resolve. */
function fractalNoise(direction: Vec3, octaves = 5): number {
  let total = 0, amplitude = 1, frequency = 3.4, normalisation = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise(direction[0] * frequency, direction[1] * frequency, direction[2] * frequency) * amplitude;
    normalisation += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return total / normalisation;
}

/**
 * Height above the mean radius, metres.
 *
 * Biased low: the real Moon is mostly highlands with a few large basins, and an unbiased noise
 * gives an even mix that reads as gravel rather than as a world.
 */
export function moonHeightAt(direction: Vec3): number {
  const base = fractalNoise(direction);
  // Cubed, which deepens the basins and leaves the highlands broad.
  const shaped = base * base * base * 1.6 + base * 0.4;
  return (shaped - 0.5) * MOON_RELIEF_M;
}

const MARE = [0.121, 0.121, 0.133] as const;
const HIGHLAND = [0.451, 0.443, 0.427] as const;
const RAY = [0.596, 0.588, 0.569] as const;

/** Grey, and two greys at that: the maria really are darker than the highlands. */
export function moonColourAt(direction: Vec3, out: [number, number, number]): [number, number, number] {
  const height = moonHeightAt(direction) / MOON_RELIEF_M + 0.5;
  const t = Math.min(1, Math.max(0, height));
  for (let i = 0; i < 3; i++) out[i] = MARE[i] + (HIGHLAND[i] - MARE[i]) * t;
  // A fine, brighter speckle: ejecta rays, which is most of what breaks up a grey ball.
  const speckle = valueNoise(direction[0] * 140, direction[1] * 140, direction[2] * 140);
  if (speckle > 0.82) {
    const strength = (speckle - 0.82) / 0.18 * 0.5;
    for (let i = 0; i < 3; i++) out[i] += (RAY[i] - out[i]) * strength;
  }
  return out;
}

/**
 * The surface normal, in the local east-north-up frame of a sphere.
 *
 * Same reasoning as the Earth's: height alone is invisible at planetary scale and slope is not, so
 * the gradient is measured and then exaggerated for shading while the vertices stay where the
 * height puts them.
 */
export function moonNormalEnu(direction: Vec3, out: [number, number, number]): [number, number, number] {
  // A small step along the surface, in radians, and the arc length it covers.
  const step = 1e-3;
  const arc = step * MOON_RADIUS_M;
  const [x, y, z] = direction;
  // East and north on the sphere at this direction.
  const p = Math.hypot(x, y);
  const east: Vec3 = p > 1e-9 ? [-y / p, x / p, 0] : [1, 0, 0];
  const north: Vec3 = [-z * east[1], z * east[0], p];
  const nl = Math.hypot(north[0], north[1], north[2]) || 1;
  north[0] /= nl; north[1] /= nl; north[2] /= nl;

  const sample = (a: Vec3, sign: number): number => {
    const d: Vec3 = [x + a[0] * step * sign, y + a[1] * step * sign, z + a[2] * step * sign];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return moonHeightAt([d[0] / l, d[1] / l, d[2] / l]);
  };

  const dE = SLOPE_EXAGGERATION * (sample(east, 1) - sample(east, -1)) / (2 * arc);
  const dN = SLOPE_EXAGGERATION * (sample(north, 1) - sample(north, -1)) / (2 * arc);
  const length = Math.hypot(dE, dN, 1);
  out[0] = -dE / length;
  out[1] = -dN / length;
  out[2] = 1 / length;
  return out;
}
