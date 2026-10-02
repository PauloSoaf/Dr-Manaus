import type { Vec3 } from '../spatial/units';
import { MOON, polarRadiusM } from './PlanetBody';
import type { PlanetSurfaceGenerator } from './PlanetSurface';
import { lunarAlbedo01, lunarElevationM, lunarMinimumElevationM, MOON_SURFACE_DATA } from './MoonSurfaceData';

/** Offline NASA LRO/LOLA relief and LROC appearance; no runtime downloads or invented maria. */
export const MOON_RADIUS_M = MOON.semiMajorAxisM;
export const MOON_RELIEF_M = Math.ceil(Math.max(Math.abs(MOON_SURFACE_DATA.minElevationM),
  Math.abs(MOON_SURFACE_DATA.maxElevationM)) + Math.abs(MOON_RADIUS_M - MOON_SURFACE_DATA.referenceRadiusM)
  + MOON_RADIUS_M - polarRadiusM(MOON));

/** Convert LOLA's spherical datum to relief over the unchanged catalog ellipsoid. */
export function moonHeightAt(direction: Vec3): number {
  const a = MOON.semiMajorAxisM, b = polarRadiusM(MOON);
  const radius = 1 / Math.sqrt((direction[0] ** 2 + direction[1] ** 2) / (a * a) + direction[2] ** 2 / (b * b));
  return MOON_SURFACE_DATA.referenceRadiusM + lunarElevationM(direction) - radius;
}

export function moonColourAt(direction: Vec3, out: [number, number, number]): [number, number, number] {
  const srgb = lunarAlbedo01(direction);
  const linear = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  // A modest gameplay readability floor; mapped maria/rays remain in their actual locations.
  const grey = 0.04 + linear * 0.85;
  out[0] = grey; out[1] = grey; out[2] = grey;
  return out;
}

/** Slope enhancement is shading-only; vertices and collision keep measured radii. */
export function moonNormalEnu(direction: Vec3, out: Vec3): Vec3 {
  const step = Math.PI / MOON_SURFACE_DATA.elevationHeight / 2;
  const arc = step * MOON_SURFACE_DATA.referenceRadiusM;
  const [x, y, z] = direction;
  const p = Math.hypot(x, y);
  const east: Vec3 = p > 1e-9 ? [-y / p, x / p, 0] : [1, 0, 0];
  const north: Vec3 = [-z * east[1], z * east[0], p];
  const length = Math.hypot(...north) || 1;
  for (let i = 0; i < 3; i++) north[i] /= length;
  const sample = (axis: Vec3, sign: number) => {
    const d: Vec3 = [x + axis[0] * step * sign, y + axis[1] * step * sign, z + axis[2] * step * sign];
    const r = Math.hypot(...d);
    return lunarElevationM([d[0] / r, d[1] / r, d[2] / r]);
  };
  const dE = 2 * (sample(east, 1) - sample(east, -1)) / (2 * arc);
  const dN = 2 * (sample(north, 1) - sample(north, -1)) / (2 * arc);
  const normalLength = Math.hypot(dE, dN, 1);
  out[0] = -dE / normalLength; out[1] = -dN / normalLength; out[2] = 1 / normalLength;
  return out;
}

export const MoonSurfaceGenerator: PlanetSurfaceGenerator = {
  body: MOON, radiusM: MOON_RADIUS_M, heightAt: moonHeightAt, normalEnu: moonNormalEnu, colourAt: moonColourAt,
  coarseResolution: 65,
  fallbackRadiusAt: (direction, radiusRad) => MOON_SURFACE_DATA.referenceRadiusM + lunarMinimumElevationM(direction, radiusRad),
};
