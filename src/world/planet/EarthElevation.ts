import payload from '../geodata/earth-elevation.json';
import { RAD_TO_DEG } from '../spatial/units';
import { meridionalRadius, metresPerRadianLongitude } from '../spatial/WGS84';

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

/**
 * The height the surface is drawn at: the land where there is land, sea level where there is sea.
 *
 * The ocean floor is not the surface of the planet. Drawing the raw grid would sink the Atlantic
 * four kilometres and leave the coastline as a cliff.
 */
export function surfaceHeightAt(latRad: number, lonRad: number): number {
  return Math.max(0, elevationAt(latRad, lonRad)) * RELIEF_EXAGGERATION;
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
