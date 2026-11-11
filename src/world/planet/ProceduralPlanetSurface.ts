import type { Vec3 } from '../spatial/units';
import type { PlanetBody } from './PlanetBody';
import type { PlanetSurfaceGenerator } from './PlanetSurface';
import type { CelestialBody } from '../celestial/CelestialBody';
import type { CelestialBodyProfile, WorldClassification } from '../celestial/CelestialBodyProfile';

/**
 * Deterministic procedural surface generator for procedural rocky and icy bodies.
 *
 * Implements physically consistent relief, analytic ENU normals, and multi-biome
 * coloring across all solid planetary classifications.
 *
 * All operations are strictly deterministic and pure (no Math.random).
 */

export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hash3(xi: number, yi: number, zi: number, seed: number): number {
  let h = Math.imul(xi | 0, 0x27d4_eb2d) ^ Math.imul(yi | 0, 0x85eb_ca6b) ^ Math.imul(zi | 0, 0xc2b2_ae35) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 15), 0x2545_f491);
  h ^= h >>> 13;
  return ((h >>> 0) % 0xffff) / 0xffff;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

export function valueNoise3D(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  let result = 0;
  for (let dz = 0; dz <= 1; dz++) {
    const wz = dz ? zf : 1 - zf;
    for (let dy = 0; dy <= 1; dy++) {
      const wy = dy ? yf : 1 - yf;
      for (let dx = 0; dx <= 1; dx++) {
        const wx = dx ? xf : 1 - xf;
        result += hash3(xi + dx, yi + dy, zi + dz, seed) * wx * wy * wz;
      }
    }
  }
  return result;
}

export function fbm3D(d: Vec3, octaves: number, baseFreq: number, seed: number): number {
  let total = 0, amplitude = 1, frequency = baseFreq, normalisation = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise3D(d[0] * frequency, d[1] * frequency, d[2] * frequency, seed + i * 37) * amplitude;
    normalisation += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return total / normalisation;
}

export function ridgedNoise3D(d: Vec3, octaves: number, baseFreq: number, seed: number): number {
  let total = 0, amplitude = 1, frequency = baseFreq, normalisation = 0;
  for (let i = 0; i < octaves; i++) {
    let n = valueNoise3D(d[0] * frequency, d[1] * frequency, d[2] * frequency, seed + i * 43);
    n = 1 - Math.abs(n * 2 - 1);
    n = n * n;
    total += n * amplitude;
    normalisation += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return total / normalisation;
}

function orientVector(v: Vec3, seed: number): Vec3 {
  const a1 = ((seed & 0xff) / 255) * Math.PI * 2;
  const a2 = (((seed >> 8) & 0xff) / 255) * Math.PI * 2;
  const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
  const cos2 = Math.cos(a2), sin2 = Math.sin(a2);
  const x1 = v[0] * cos1 + v[2] * sin1;
  const y1 = v[1];
  const z1 = -v[0] * sin1 + v[2] * cos1;
  const x2 = x1;
  const y2 = y1 * cos2 - z1 * sin2;
  const z2 = y1 * sin2 + z1 * cos2;
  return [x2, y2, z2];
}

export function proceduralNormalEnu(
  heightFn: (d: Vec3) => number,
  radiusM: number,
  direction: Vec3,
  out: [number, number, number],
): [number, number, number] {
  const step = 1e-4;
  const arc = step * radiusM;
  const [x, y, z] = direction;
  const p = Math.hypot(x, y);
  const east: Vec3 = p > 1e-9 ? [-y / p, x / p, 0] : [1, 0, 0];
  const north: Vec3 = [-z * east[1], z * east[0], p];
  const nl = Math.hypot(north[0], north[1], north[2]) || 1;
  north[0] /= nl; north[1] /= nl; north[2] /= nl;

  const sample = (a: Vec3, sign: number): number => {
    const d: Vec3 = [x + a[0] * step * sign, y + a[1] * step * sign, z + a[2] * step * sign];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return heightFn([d[0] / l, d[1] / l, d[2] / l]);
  };

  const dE = (sample(east, 1) - sample(east, -1)) / (2 * arc);
  const dN = (sample(north, 1) - sample(north, -1)) / (2 * arc);
  const length = Math.hypot(dE, dN, 1);
  out[0] = -dE / length;
  out[1] = -dN / length;
  out[2] = 1 / length;
  return out;
}

export function proceduralMaxReliefM(body: CelestialBody): number {
  const profile = body.profile;
  if (!profile || !profile.hasSolidSurface || !profile.canLand) return 0;
  const classification = profile.environment?.classification ?? (profile.bodyClass === 'rocky' ? 'arid-rocky' : 'rocky-moon');
  switch (classification) {
    case 'volcanic-rocky':
    case 'volcanic-moon':
      return 10_000;
    case 'oceanic-rocky':
      return 7_000;
    case 'arid-rocky':
      return 6_500;
    case 'frozen-rocky':
    case 'icy-moon':
      return 5_500;
    case 'dense-atmosphere-rocky':
    case 'atmospheric-moon':
      return 5_000;
    case 'rocky-moon':
      return 4_000;
    default:
      return 6_000;
  }
}

export function createProceduralPlanetSurface(
  body: CelestialBody,
  model: PlanetBody,
  profile: CelestialBodyProfile,
): PlanetSurfaceGenerator {
  const classification: WorldClassification = profile.environment?.classification
    ?? (profile.bodyClass === 'rocky' ? 'arid-rocky' : 'rocky-moon');
  const baseSeed = hashString(body.id);
  const maxRelief = proceduralMaxReliefM(body);
  const radiusM = model.semiMajorAxisM;

  const heightAt = (direction: Vec3): number => {
    const d = orientVector(direction, baseSeed);
    switch (classification) {
      case 'arid-rocky': {
        const base = fbm3D(d, 5, 2.2, baseSeed);
        const ridges = ridgedNoise3D(d, 4, 4.5, baseSeed + 101);
        let h = (base * 0.65 + ridges * 0.35 - 0.45) * 5_500;
        const canyonMask = Math.abs(fbm3D(d, 3, 1.8, baseSeed + 203) - 0.5);
        if (canyonMask < 0.08) {
          const depthRatio = (0.08 - canyonMask) / 0.08;
          h -= depthRatio * 1_200;
        }
        return Math.max(-maxRelief, Math.min(maxRelief, h));
      }
      case 'frozen-rocky': {
        const base = fbm3D(d, 5, 2.0, baseSeed);
        const fissures = Math.abs(valueNoise3D(d[0] * 8, d[1] * 8, d[2] * 8, baseSeed + 50) - 0.5) < 0.06 ? -600 : 0;
        const h = (base - 0.42) * 4_200 + fissures;
        return Math.max(-maxRelief, Math.min(maxRelief, h));
      }
      case 'volcanic-rocky': {
        const mountains = ridgedNoise3D(d, 5, 2.8, baseSeed);
        const caldera = valueNoise3D(d[0] * 6, d[1] * 6, d[2] * 6, baseSeed + 77);
        let h = (mountains * 1.35 - 0.35) * 8_000;
        if (caldera > 0.72) {
          h -= (caldera - 0.72) * 2_500;
        }
        return Math.max(-maxRelief, Math.min(maxRelief, h));
      }
      case 'oceanic-rocky': {
        const continents = fbm3D(d, 6, 1.8, baseSeed);
        const seaLevelThreshold = 0.46;
        if (continents < seaLevelThreshold) {
          // Liquid ocean surface: exact flat contact at sea level (0m)
          return 0;
        }
        const elevRatio = (continents - seaLevelThreshold) / (1 - seaLevelThreshold);
        const ridges = ridgedNoise3D(d, 4, 5.0, baseSeed + 120) * elevRatio;
        const h = (elevRatio * 0.65 + ridges * 0.35) * 6_200;
        return Math.max(0, Math.min(maxRelief, h));
      }
      case 'dense-atmosphere-rocky': {
        const base = fbm3D(d, 5, 2.1, baseSeed);
        const h = (base - 0.45) * 4_500;
        return Math.max(-maxRelief, Math.min(maxRelief, h));
      }
      case 'icy-moon': {
        const base = fbm3D(d, 4, 3.2, baseSeed);
        const cracks = Math.abs(valueNoise3D(d[0] * 12, d[1] * 12, d[2] * 12, baseSeed + 60) - 0.5) < 0.05 ? -400 : 0;
        const h = (base - 0.45) * 2_200 + cracks;
        return Math.max(-maxRelief, Math.min(maxRelief, h));
      }
      case 'volcanic-moon': {
        const mountains = ridgedNoise3D(d, 4, 3.5, baseSeed);
        const h = (mountains * 1.2 - 0.4) * 4_000;
        return Math.max(-maxRelief, Math.min(maxRelief, h));
      }
      case 'atmospheric-moon': {
        const dunes = fbm3D(d, 4, 2.5, baseSeed);
        const h = (dunes - 0.45) * 2_600;
        return Math.max(-maxRelief, Math.min(maxRelief, h));
      }
      case 'rocky-moon':
      default: {
        const craters = ridgedNoise3D(d, 5, 3.0, baseSeed);
        const base = fbm3D(d, 4, 2.0, baseSeed + 88);
        const h = (base * 0.5 + craters * 0.5 - 0.45) * 3_500;
        return Math.max(-maxRelief, Math.min(maxRelief, h));
      }
    }
  };

  const colourAt = (direction: Vec3, out: [number, number, number]): void => {
    const d = orientVector(direction, baseSeed);
    const h = heightAt(direction);
    const lat = Math.abs(direction[2]);

    switch (classification) {
      case 'arid-rocky': {
        const t = Math.max(0, Math.min(1, (h + 2_500) / 7_000));
        const LOW = [0.46, 0.24, 0.14];
        const MID = [0.65, 0.38, 0.22];
        const HIGH = [0.78, 0.52, 0.32];
        const PEAK = [0.86, 0.62, 0.42];

        if (t < 0.4) {
          const s = t / 0.4;
          for (let i = 0; i < 3; i++) out[i] = LOW[i] + (MID[i] - LOW[i]) * s;
        } else if (t < 0.75) {
          const s = (t - 0.4) / 0.35;
          for (let i = 0; i < 3; i++) out[i] = MID[i] + (HIGH[i] - MID[i]) * s;
        } else {
          const s = (t - 0.75) / 0.25;
          for (let i = 0; i < 3; i++) out[i] = HIGH[i] + (PEAK[i] - HIGH[i]) * s;
        }

        // Polar frost
        if (lat > 0.86) {
          const frost = (lat - 0.86) / 0.14;
          const FROST = [0.88, 0.90, 0.94];
          for (let i = 0; i < 3; i++) out[i] = out[i] * (1 - frost) + FROST[i] * frost;
        }
        break;
      }

      case 'frozen-rocky': {
        const t = Math.max(0, Math.min(1, (h + 2_000) / 6_000));
        const FISSURE = [0.42, 0.58, 0.76];
        const GLACIAL = [0.76, 0.84, 0.92];
        const HIGHLAND = [0.92, 0.95, 0.98];

        if (t < 0.4) {
          const s = t / 0.4;
          for (let i = 0; i < 3; i++) out[i] = FISSURE[i] + (GLACIAL[i] - FISSURE[i]) * s;
        } else {
          const s = (t - 0.4) / 0.6;
          for (let i = 0; i < 3; i++) out[i] = GLACIAL[i] + (HIGHLAND[i] - GLACIAL[i]) * s;
        }

        if (lat > 0.80) {
          const cap = (lat - 0.80) / 0.20;
          const ICE = [0.96, 0.98, 1.0];
          for (let i = 0; i < 3; i++) out[i] = out[i] * (1 - cap) + ICE[i] * cap;
        }
        break;
      }

      case 'volcanic-rocky': {
        const t = Math.max(0, Math.min(1, (h + 2_000) / 10_000));
        const BASALT = [0.18, 0.15, 0.13];
        const ASH = [0.28, 0.22, 0.18];
        const PEAK = [0.42, 0.32, 0.26];
        const LAVA = [0.95, 0.42, 0.08];

        if (t < 0.5) {
          const s = t / 0.5;
          for (let i = 0; i < 3; i++) out[i] = BASALT[i] + (ASH[i] - BASALT[i]) * s;
        } else {
          const s = (t - 0.5) / 0.5;
          for (let i = 0; i < 3; i++) out[i] = ASH[i] + (PEAK[i] - ASH[i]) * s;
        }

        // Active geothermal / lava fissures in lowlands
        const ventNoise = valueNoise3D(d[0] * 8, d[1] * 8, d[2] * 8, baseSeed + 99);
        if (h < 500 && ventNoise > 0.70) {
          const vent = (ventNoise - 0.70) / 0.30;
          for (let i = 0; i < 3; i++) out[i] = out[i] * (1 - vent) + LAVA[i] * vent;
        }
        break;
      }

      case 'oceanic-rocky': {
        if (h === 0) {
          // Liquid ocean
          const depthNoise = valueNoise3D(d[0] * 4, d[1] * 4, d[2] * 4, baseSeed + 45);
          const DEEP = [0.10, 0.28, 0.62];
          const SHALLOW = [0.18, 0.45, 0.76];
          for (let i = 0; i < 3; i++) out[i] = DEEP[i] + (SHALLOW[i] - DEEP[i]) * depthNoise;
        } else {
          // Continental landmass
          const t = Math.max(0, Math.min(1, h / 6_000));
          const BEACH = [0.74, 0.70, 0.48];
          const PLAINS = [0.24, 0.46, 0.22];
          const HILLS = [0.48, 0.44, 0.40];
          const SNOW = [0.92, 0.94, 0.96];

          if (t < 0.06) {
            const s = t / 0.06;
            for (let i = 0; i < 3; i++) out[i] = BEACH[i] + (PLAINS[i] - BEACH[i]) * s;
          } else if (t < 0.45) {
            const s = (t - 0.06) / 0.39;
            for (let i = 0; i < 3; i++) out[i] = PLAINS[i] + (HILLS[i] - PLAINS[i]) * s;
          } else {
            const s = (t - 0.45) / 0.55;
            for (let i = 0; i < 3; i++) out[i] = HILLS[i] + (SNOW[i] - HILLS[i]) * s;
          }
        }

        // Polar ice caps over land and ocean
        if (lat > 0.82) {
          const ice = (lat - 0.82) / 0.18;
          const ICE = [0.92, 0.96, 1.0];
          for (let i = 0; i < 3; i++) out[i] = out[i] * (1 - ice) + ICE[i] * ice;
        }
        break;
      }

      case 'dense-atmosphere-rocky': {
        const t = Math.max(0, Math.min(1, (h + 2_000) / 6_000));
        const LOW = [0.68, 0.55, 0.32];
        const MID = [0.82, 0.72, 0.48];
        const HIGH = [0.88, 0.80, 0.58];

        if (t < 0.5) {
          const s = t / 0.5;
          for (let i = 0; i < 3; i++) out[i] = LOW[i] + (MID[i] - LOW[i]) * s;
        } else {
          const s = (t - 0.5) / 0.5;
          for (let i = 0; i < 3; i++) out[i] = MID[i] + (HIGH[i] - MID[i]) * s;
        }
        break;
      }

      case 'icy-moon': {
        const t = Math.max(0, Math.min(1, (h + 1_500) / 4_000));
        const DARK_ICE = [0.55, 0.65, 0.78];
        const BRIGHT_ICE = [0.88, 0.92, 0.96];
        for (let i = 0; i < 3; i++) out[i] = DARK_ICE[i] + (BRIGHT_ICE[i] - DARK_ICE[i]) * t;
        break;
      }

      case 'volcanic-moon': {
        const t = Math.max(0, Math.min(1, (h + 2_000) / 5_000));
        const BASALT = [0.25, 0.20, 0.16];
        const SULFUR = [0.85, 0.75, 0.20];
        for (let i = 0; i < 3; i++) out[i] = BASALT[i] + (SULFUR[i] - BASALT[i]) * t;
        break;
      }

      case 'atmospheric-moon': {
        const t = Math.max(0, Math.min(1, (h + 1_500) / 4_000));
        const DUNES = [0.72, 0.52, 0.28];
        const METHANE = [0.35, 0.45, 0.50];
        for (let i = 0; i < 3; i++) out[i] = METHANE[i] + (DUNES[i] - METHANE[i]) * t;
        break;
      }

      case 'rocky-moon':
      default: {
        const t = Math.max(0, Math.min(1, (h + 2_000) / 5_000));
        const LOW = [0.35, 0.34, 0.32];
        const HIGH = [0.58, 0.56, 0.54];
        for (let i = 0; i < 3; i++) out[i] = LOW[i] + (HIGH[i] - LOW[i]) * t;
        break;
      }
    }
  };

  const normalEnu = (direction: Vec3, out: [number, number, number]): [number, number, number] => {
    return proceduralNormalEnu(heightAt, radiusM, direction, out);
  };

  return {
    body: model,
    radiusM,
    coarseResolution: 65,
    fallbackRadiusAt: (_direction: Vec3, _radiusRad: number) => radiusM - maxRelief,
    heightAt,
    normalEnu,
    colourAt,
  };
}
