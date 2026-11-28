import payload from '../geodata/earth-elevation.json';
import { RAD_TO_DEG } from '../spatial/units';
import { meridionalRadius, metresPerRadianLongitude } from '../spatial/WGS84';
import { classifyEarthSurface, earthLandFraction, EarthSurfaceClass } from './EarthLandMask';

/**
 * How high the ground is, globally.
 *
 * A 512x256 equirectangular grid of signed metres, downsampled offline from NOAA's ETOPO5 global
 * relief — public domain — by `scripts/geodata/build-earth-elevation.mjs`. A sample is about
 * 78 km, which is the same order as the finest tile the quadtree selects from the altitudes the
 * globe is drawn at; finer data would be averaged away by the geometry that reads it.
 *
 * This replaces a per-tile `SimplexNoise` that seeded itself from `Math.random`, so neighbouring
 * tiles used different permutation tables and disagreed along their shared edge. Real data has
 * the opposite property for free: two tiles sampling the same coordinate get the same answer, so
 * edges match without any seam handling at all.
 *
 * Bundled rather than fetched, for the same reason the land mask is: tile meshes are built
 * synchronously, and an await in that path colours the planet a frame late.
 */

interface ElevationPayload {
  readonly width: number;
  readonly height: number;
  readonly samples: string;
  readonly source: string;
  readonly licence: string;
  readonly retrievedAt: string;
  readonly minM: number;
  readonly maxM: number;
}

const grid = payload as unknown as ElevationPayload;
export const EARTH_MAX_ELEVATION_M = grid.maxM;

/** Base64 without `atob` or `Buffer`: this module is imported by the game and by the tests. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decode(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const bytes = new Uint8Array((clean.length * 3) >> 2);
  let buffer = 0, bits = 0, cursor = 0;
  for (let i = 0; i < clean.length; i++) {
    const value = ALPHABET.indexOf(clean[i]);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[cursor++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

const RAW = decode(grid.samples);
const SAMPLES = new Int16Array(RAW.buffer, RAW.byteOffset, RAW.byteLength >> 1);

export const EARTH_ELEVATION = {
  width: grid.width,
  height: grid.height,
  source: grid.source,
  licence: grid.licence,
  retrievedAt: grid.retrievedAt,
  minM: grid.minM,
  maxM: grid.maxM,
} as const;

/**
 * Vertical exaggeration of the surface: none.
 *
 * The planet is the real one. Earth's whole relief is 0.2% of its radius, so a truthful globe has
 * mountains you cannot see in silhouette — which is exactly what photographs of the Earth look
 * like. Raising this would also put peaks tens of kilometres up, where the player flies.
 */
export const RELIEF_EXAGGERATION = 1;

/**
 * Exaggeration of the *slope*, for shading only. This one is a deliberate lie, stated plainly.
 *
 * At 78 km per sample the Himalayas are a genuine 1.8-degree ramp. That is the correct answer and
 * it is invisible: a lambert term changes by six hundredths of a percent across it, so the relief
 * would be present in the data and absent on the screen. Real photographs of the Earth show
 * terrain mostly through albedo — snow, rock, vegetation — which this globe does not have.
 *
 * So the gradient that feeds the normal is multiplied, and the vertex positions are not. The
 * surface stays where the ellipsoid and the grid say it is, and only the shading is stretched.
 * Twelve puts the Himalayas at about thirteen degrees, which reads as mountains.
 */
export const SLOPE_EXAGGERATION = 12;

/** One grid sample, wrapping in longitude and clamping in latitude. */
function sampleAt(x: number, y: number): number {
  const column = ((x % grid.width) + grid.width) % grid.width;
  const row = Math.min(grid.height - 1, Math.max(0, y));
  return SAMPLES[row * grid.width + column];
}

/**
 * The raw grid value at a point, in metres, bilinearly interpolated.
 *
 * Negative over water: this is relief, not the surface. Bathymetry is real data and worth keeping
 * for whoever colours the sea floor; what gets drawn is `surfaceHeightAt`.
 */
export function elevationAt(latRad: number, lonRad: number): number {
  if (!Number.isFinite(latRad) || !Number.isFinite(lonRad)) return 0;
  const latDeg = latRad * RAD_TO_DEG;
  const lonDeg = lonRad * RAD_TO_DEG;
  // Continuous grid coordinates, offset by half a cell because a sample is a cell centre.
  const x = ((((lonDeg + 180) % 360) + 360) % 360) / 360 * grid.width - 0.5;
  const y = (90 - latDeg) / 180 * grid.height - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const top = sampleAt(x0, y0) * (1 - fx) + sampleAt(x0 + 1, y0) * fx;
  const bottom = sampleAt(x0, y0 + 1) * (1 - fx) + sampleAt(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

/** Calibration of the solid ground used for local collision, water depth and nearby terrain. */
export const EARTH_GROUND = {
  /** Lowest dry ground, so coastal plains never share a plane with the sea. */
  beachHeightM: 0.6,
  /** Seabed of the open ocean: the depth the shared water bathymetry already declares. */
  oceanFloorM: -250,
  /** Land fraction at which inland relief is fully reached, and at which the shelf bottoms out. */
  inlandFraction: 0.85,
  offshoreFraction: 0.2,
  /** Wading shelf just off the shore, about a 2% slope, before the sea floor falls away. */
  nearShoreDepthM: 12,
  nearShoreShare: 0.05,
} as const;

/** Sea-level tolerance: ground below this is under water. */
export const EARTH_WET_TOLERANCE_M = 0.05;

function smoothRamp(from: number, to: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * Solid ground relative to mean sea level.
 *
 * The drawn globe keeps `surfaceHeightAt`, where the ocean is its surface. Collision needs the
 * ground under the water: dry land rises from a beach into the real relief, and water falls from
 * the shore down a continuous shelf to the seabed. Continuous in latitude and longitude, so a
 * coast is a walkable slope instead of a cliff or an invisible floor at sea level.
 */
export function earthSolidGroundAt(latRad: number, lonRad: number): number {
  const fraction = earthLandFraction(latRad, lonRad);
  const beach = EARTH_GROUND.beachHeightM;
  if (fraction >= 0.5) {
    const relief = Math.max(beach, elevationAt(latRad, lonRad) * RELIEF_EXAGGERATION);
    return beach + (relief - beach) * smoothRamp(0.5, EARTH_GROUND.inlandFraction, fraction);
  }
  // How far down the underwater side of the coast: 0 at the shoreline contour, 1 offshore.
  const offshore = (0.5 - fraction) / (0.5 - EARTH_GROUND.offshoreFraction);
  const { nearShoreDepthM: shelf, nearShoreShare: share } = EARTH_GROUND;
  const wading = beach - (beach + shelf) * Math.min(1, offshore / share);
  return wading + (EARTH_GROUND.oceanFloorM + shelf) * smoothRamp(share, 1, offshore);
}

/**
 * The height the surface is drawn at: the land where there is land, sea level where there is sea.
 *
 * The ocean floor is not the surface of the planet. Drawing the raw grid would sink the Atlantic
 * four kilometres and leave the coastline as a cliff.
 */
export function surfaceHeightAt(latRad: number, lonRad: number): number {
  return Math.max(0, elevationAt(latRad, lonRad)) * RELIEF_EXAGGERATION;
}

function hash2D(ix: number, iy: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Deterministic value noise in [-1, 1]. */
export function valueNoise2D(x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2D(x0, y0) * (1 - u) + hash2D(x0 + 1, y0) * u;
  const b = hash2D(x0, y0 + 1) * (1 - u) + hash2D(x0 + 1, y0 + 1) * u;
  return (a * (1 - v) + b * v) * 2 - 1;
}

/**
 * Multi-scale elevation hierarchy (P1-04 in 02-REMAINING-BUGS.md):
 * - LOD <= 5 (orbital): returns the canonical ETOPO5 512x256 elevation.
 * - LOD >= 6 (15 km, 5 km, 1 km, landing): adds deterministic multi-octave sub-grid relief
 *   over continental Land/Ice while preserving 0 m over Ocean/ShallowWater and Manaus Urban.
 */
export function hierarchicalElevationAt(latRad: number, lonRad: number, lodLevel = 0): number {
  const base = surfaceHeightAt(latRad, lonRad);
  if (lodLevel <= 5 || base <= 0) return base;
  const cls = classifyEarthSurface(latRad, lonRad);
  if (cls !== EarthSurfaceClass.Land && cls !== EarthSurfaceClass.Ice) return 0;

  const latDeg = latRad * RAD_TO_DEG;
  const lonDeg = lonRad * RAD_TO_DEG;
  const octaves = Math.min(4, Math.floor(lodLevel) - 5);
  let detail = 0;
  let freq = 8;
  let amp = Math.min(180, base * 0.08);
  for (let o = 0; o < octaves; o++) {
    detail += valueNoise2D(lonDeg * freq, latDeg * freq) * amp;
    freq *= 2.15;
    amp *= 0.48;
  }
  return Math.max(0, Math.min(EARTH_MAX_ELEVATION_M, base + detail));
}

/**
 * The outward normal of the *terrain* at a point, in the local east-north-up frame.
 *
 * Height alone is invisible from orbit; slope is not. A surface whose normals all point straight
 * up is shaded as a smooth ball however much its vertices move, which is why the elevation has to
 * reach the normals as well as the positions.
 *
 * Central differences over one grid cell, converted from radians to metres on the ellipsoid, so
 * the gradient is a real slope rather than a number per degree — which would make the same
 * mountain steeper near the poles. The result is then stretched by `SLOPE_EXAGGERATION`; see
 * there for why, and for what it costs.
 */
export function surfaceNormalEnu(latRad: number, lonRad: number, out: [number, number, number]): [number, number, number] {
  const dLat = Math.PI / grid.height;
  const dLon = (2 * Math.PI) / grid.width;
  const east = SLOPE_EXAGGERATION
    * (surfaceHeightAt(latRad, lonRad + dLon) - surfaceHeightAt(latRad, lonRad - dLon))
    / (2 * dLon * Math.max(1, metresPerRadianLongitude(latRad)));
  const north = SLOPE_EXAGGERATION
    * (surfaceHeightAt(latRad + dLat, lonRad) - surfaceHeightAt(latRad - dLat, lonRad))
    / (2 * dLat * Math.max(1, meridionalRadius(latRad)));
  // n = normalize(-dh/dE, -dh/dN, 1) in ENU.
  const length = Math.hypot(east, north, 1);
  out[0] = -east / length;
  out[1] = -north / length;
  out[2] = 1 / length;
  return out;
}
