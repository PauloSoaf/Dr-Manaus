import payload from '../geodata/earth-landmask.json';
import { RAD_TO_DEG } from '../spatial/units';

/**
 * Where the land is, globally.
 *
 * A 1024x512 equirectangular bitmask built offline from Natural Earth's 1:110m land polygons —
 * public domain — by `scripts/geodata/build-earth-vectors.mjs`. One bit per pixel, about 39 km at
 * the equator, which is finer than the coastline detail that dataset carries.
 *
 * It is a raster rather than the polygons because the globe asks "is this land?" once per vertex
 * per tile, thousands of times a frame while streaming. A point-in-polygon test against four
 * thousand edges would be far too slow; a bitmask is one lookup.
 *
 * Bundled rather than fetched: tile meshes are built synchronously, sometimes off the main
 * thread, and an await in that path would mean colouring the planet a frame late.
 */

interface LandMaskPayload {
  readonly width: number;
  readonly height: number;
  readonly bits: string;
  readonly source: string;
  readonly licence: string;
  readonly retrievedAt: string;
  readonly landFraction: number;
}

const mask = payload as unknown as LandMaskPayload;

/**
 * Base64 without depending on either runtime's helper.
 *
 * `atob` is a browser global and `Buffer` is a Node one; this module is imported by both the game
 * and the tests, so it decodes the six-bit groups itself rather than reaching for whichever
 * happens to exist.
 */
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

const BITS = decode(mask.bits);

export const EARTH_LAND_MASK = {
  width: mask.width,
  height: mask.height,
  source: mask.source,
  licence: mask.licence,
  retrievedAt: mask.retrievedAt,
  landFraction: mask.landFraction,
} as const;

/** True where the given geodetic point, in radians, is land. */
export function isLandAt(latRad: number, lonRad: number): boolean {
  if (!Number.isFinite(latRad) || !Number.isFinite(lonRad)) return false;
  const latDeg = latRad * RAD_TO_DEG;
  const lonDeg = lonRad * RAD_TO_DEG;
  // Longitude wraps; latitude clamps, because there is no pixel past a pole.
  const x = Math.min(mask.width - 1, Math.max(0,
    Math.floor((((lonDeg + 180) % 360 + 360) % 360) / 360 * mask.width)));
  const y = Math.min(mask.height - 1, Math.max(0,
    Math.floor((90 - latDeg) / 180 * mask.height)));
  const index = y * mask.width + x;
  return ((BITS[index >> 3] >> (index & 7)) & 1) === 1;
}

/**
 * Authoritative Earth surface classification according to the cosmic specification
 * (specs/dr-manaus-cosmic-night-specs/03-EARTH-SURFACE-BIOMES-OCEAN-ICE.md).
 */
export enum EarthSurfaceClass {
  Ocean = 0,
  Land = 1,
  Ice = 2,
  Urban = 3,
  ShallowWater = 4,
}

/**
 * Classifies any geodetic coordinate (latRad, lonRad) into an EarthSurfaceClass.
 * Deterministic and pure function.
 */
export function classifyEarthSurface(latRad: number, lonRad: number): EarthSurfaceClass {
  if (!Number.isFinite(latRad) || !Number.isFinite(lonRad)) return EarthSurfaceClass.Ocean;
  const latDeg = latRad * RAD_TO_DEG;
  const lonDeg = (((lonRad * RAD_TO_DEG + 180) % 360 + 360) % 360) - 180;

  // 1. Manaus urban coverage zone (-3.40 to -2.86 lat, -60.30 to -59.76 lon)
  if (latDeg >= -3.40 && latDeg <= -2.86 && lonDeg >= -60.30 && lonDeg <= -59.76) {
    return EarthSurfaceClass.Urban;
  }

  const land = isLandAt(latRad, lonRad);

  if (land) {
    // Antarctica continent: south of 60°S
    if (latDeg < -60) {
      return EarthSurfaceClass.Ice;
    }
    // Greenland ice sheet: 60°N to 84°N and -60°W to -20°W
    if (latDeg >= 60 && latDeg <= 84 && lonDeg >= -60 && lonDeg <= -20) {
      return EarthSurfaceClass.Ice;
    }
    // High Arctic permanent ice caps / glaciers (e.g. Ellesmere, Svalbard)
    if (latDeg > 78) {
      return EarthSurfaceClass.Ice;
    }
    return EarthSurfaceClass.Land;
  }

  // Water: Polar permanent sea ice / ice shelves
  if (latDeg < -75 || latDeg > 84) {
    return EarthSurfaceClass.Ice;
  }

  return EarthSurfaceClass.Ocean;
}

/** Ocean blue, land green, urban gray/olive, and the ice that genuinely sits at the poles. */
export const SURFACE_COLOURS = {
  ocean: [0.047, 0.157, 0.314] as const,
  shallow: [0.102, 0.290, 0.451] as const,
  land: [0.196, 0.345, 0.169] as const,
  arid: [0.451, 0.404, 0.255] as const,
  ice: [0.878, 0.898, 0.910] as const,
  urban: [0.320, 0.340, 0.300] as const,
} as const;

/**
 * The colour of the surface at a point.
 *
 * Land, ocean, ice, and urban features come from the authoritative classification.
 */
export function surfaceColour(latRad: number, lonRad: number, out: [number, number, number]): [number, number, number] {
  const surfaceClass = classifyEarthSurface(latRad, lonRad);
  const palette = SURFACE_COLOURS;

  if (surfaceClass === EarthSurfaceClass.Urban) {
    for (let i = 0; i < 3; i++) out[i] = palette.urban[i];
    return out;
  }

  if (surfaceClass === EarthSurfaceClass.Ice) {
    for (let i = 0; i < 3; i++) out[i] = palette.ice[i];
    return out;
  }

  if (surfaceClass === EarthSurfaceClass.Ocean) {
    const latDeg = Math.abs(latRad * RAD_TO_DEG);
    // A hint of shelf near the poles where sea ice forms, otherwise deep ocean.
    const tint = latDeg > 70 ? Math.min(1, (latDeg - 70) / 15) : 0;
    for (let i = 0; i < 3; i++) out[i] = palette.ocean[i] + (palette.ice[i] - palette.ocean[i]) * tint * 0.7;
    return out;
  }

  // Land (with arid variation in horse latitudes)
  const latDeg = Math.abs(latRad * RAD_TO_DEG);
  const arid = latDeg > 15 && latDeg < 35 ? 1 - Math.abs(latDeg - 25) / 10 : 0;
  for (let i = 0; i < 3; i++) {
    out[i] = palette.land[i] + (palette.arid[i] - palette.land[i]) * Math.max(0, arid) * 0.8;
  }
  return out;
}
