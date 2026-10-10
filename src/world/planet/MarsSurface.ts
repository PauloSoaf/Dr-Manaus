import type { Vec3 } from '../spatial/units';
import { MARS } from './PlanetBody';

/**
 * Mars surface: red, cratered, and generated rather than measured.
 */

export const MARS_RADIUS_M = MARS.semiMajorAxisM;
export const MARS_RELIEF_M = 21_000; // Olympus Mons scale
const SLOPE_EXAGGERATION = 6;

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 0x27d4_eb2d) ^ Math.imul(y | 0, 0x85eb_ca6b) ^ Math.imul(z | 0, 0xc2b2_ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2545_f491);
  h ^= h >>> 13;
  return ((h >>> 0) % 0xffff) / 0xffff;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

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

function fractalNoise(direction: Vec3, octaves = 6): number {
  let total = 0, amplitude = 1, frequency = 2.4, normalisation = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise(direction[0] * frequency, direction[1] * frequency, direction[2] * frequency) * amplitude;
    normalisation += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return total / normalisation;
}

export function marsHeightAt(direction: Vec3): number {
  const base = fractalNoise(direction);
  const shaped = base * base * 1.4;
  return (shaped - 0.5) * MARS_RELIEF_M;
}

const LOWLAND = [0.55, 0.25, 0.15] as const;
const HIGHLAND = [0.75, 0.40, 0.20] as const;
const POLAR_ICE = [0.90, 0.90, 0.95] as const;

export function marsColourAt(direction: Vec3, out: [number, number, number]): [number, number, number] {
  const height = marsHeightAt(direction) / MARS_RELIEF_M + 0.5;
  const t = Math.min(1, Math.max(0, height));
  for (let i = 0; i < 3; i++) out[i] = LOWLAND[i] + (HIGHLAND[i] - LOWLAND[i]) * t;
  
  // Polar ice caps
  const latitude = Math.abs(direction[2]);
  if (latitude > 0.85) {
    const ice = (latitude - 0.85) / 0.15;
    const mix = Math.min(1, ice + valueNoise(direction[0] * 50, direction[1] * 50, direction[2] * 50) * 0.5);
    for (let i = 0; i < 3; i++) out[i] += (POLAR_ICE[i] - out[i]) * mix;
  }
  return out;
}

export function marsNormalEnu(direction: Vec3, out: [number, number, number]): [number, number, number] {
  const step = 1e-3;
  const arc = step * MARS_RADIUS_M;
  const [x, y, z] = direction;
  const p = Math.hypot(x, y);
  const east: Vec3 = p > 1e-9 ? [-y / p, x / p, 0] : [1, 0, 0];
  const north: Vec3 = [-z * east[1], z * east[0], p];
  const nl = Math.hypot(north[0], north[1], north[2]) || 1;
  north[0] /= nl; north[1] /= nl; north[2] /= nl;

  const sample = (a: Vec3, sign: number): number => {
    const d: Vec3 = [x + a[0] * step * sign, y + a[1] * step * sign, z + a[2] * step * sign];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return marsHeightAt([d[0] / l, d[1] / l, d[2] / l]);
  };

  const dE = SLOPE_EXAGGERATION * (sample(east, 1) - sample(east, -1)) / (2 * arc);
  const dN = SLOPE_EXAGGERATION * (sample(north, 1) - sample(north, -1)) / (2 * arc);
  const length = Math.hypot(dE, dN, 1);
  out[0] = -dE / length;
  out[1] = -dN / length;
  out[2] = 1 / length;
  return out;
}

import type { PlanetSurfaceGenerator } from './PlanetSurface';

export const MarsSurfaceGenerator: PlanetSurfaceGenerator = {
  body: MARS,
  radiusM: MARS_RADIUS_M,
  heightAt: marsHeightAt,
  normalEnu: marsNormalEnu,
  colourAt: marsColourAt,
};
