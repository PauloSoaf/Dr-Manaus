/**
 * Biome and colour of the ground near the player.
 *
 * Chunk terrain, the distant terrain rings and distant vegetation all read this, so the ground keeps
 * one appearance across representations and the borders between them stay quiet. Colour variation is
 * keyed by geodetic coordinate, so it never slides with the camera or reshuffles on a new anchor.
 * Worker safe.
 */
import { RAD_TO_DEG } from '../spatial/units';
import { classifyEarthBiome, classifyEarthLandBiome, type EarthBiome } from './EarthLandMask';
import { EARTH_WET_TOLERANCE_M, valueNoise2D } from './EarthElevation';

export type EarthTerrainBiome = Extract<EarthBiome, 'rainforest' | 'desert' | 'ice' | 'woodland' | 'urban'>;

/** Tropical forest does not climb past this; tree lines and snow follow the same simple bands. */
const FOREST_LINE_M = 2_000;
const ROCK_FROM_M = 3_200, ROCK_FULL_M = 4_200, SNOW_FROM_M = 4_800, SNOW_FULL_M = 5_400;

export function earthTerrainBiome(latRad: number, lonRad: number, aboveSeaM: number): EarthTerrainBiome {
  if (aboveSeaM > SNOW_FULL_M) return 'ice';
  let biome = classifyEarthBiome(latRad, lonRad);
  if (biome === 'ocean' || biome === 'coastal-water') biome = classifyEarthLandBiome(latRad, lonRad);
  return biome === 'rainforest' && aboveSeaM > FOREST_LINE_M ? 'woodland' : biome;
}

type Rgb = readonly [number, number, number];
const linear = (channel: number): number => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
/** Hex sRGB to the linear values vertex colours are read as. */
const rgb = (hex: number): Rgb => [linear((hex >> 16 & 255) / 255), linear((hex >> 8 & 255) / 255), linear((hex & 255) / 255)];

const BIOME: Record<EarthTerrainBiome, Rgb> = {
  rainforest: rgb(0x1d4718), woodland: rgb(0x48523b), desert: rgb(0xd4a373), ice: rgb(0xf1f5f9), urban: rgb(0x2e3035),
};
const BEACH = rgb(0xbfa77a), SHALLOWS = rgb(0x9c8a62), DEEP_BED = rgb(0x1d2f33), ROCK = rgb(0x7a6e5e), SNOW = rgb(0xeef2f5);

const ramp = (from: number, to: number, value: number): number => Math.max(0, Math.min(1, (value - from) / (to - from)));

function blend(out: Float32Array, offset: number, a: Rgb, b: Rgb, t: number): void {
  for (let i = 0; i < 3; i++) out[offset + i] = a[i] + (b[i] - a[i]) * t;
}

/**
 * Writes the linear colour of the ground at a coordinate into `out[offset..offset+2]`.
 * `aboveSeaM` is the solid ground relative to sea level, negative under water.
 */
export function earthGroundColor(latRad: number, lonRad: number, aboveSeaM: number, out: Float32Array, offset: number,
  biome = earthTerrainBiome(latRad, lonRad, aboveSeaM)): void {
  if (aboveSeaM < -EARTH_WET_TOLERANCE_M) {
    blend(out, offset, SHALLOWS, DEEP_BED, ramp(2, 60, -aboveSeaM));
    return;
  }
  const base = BIOME[biome];
  blend(out, offset, BEACH, base, biome === 'ice' ? 1 : ramp(1.2, 4, aboveSeaM));
  const current: Rgb = [out[offset], out[offset + 1], out[offset + 2]];
  if (biome !== 'ice' && aboveSeaM > ROCK_FROM_M) blend(out, offset, current, ROCK, ramp(ROCK_FROM_M, ROCK_FULL_M, aboveSeaM));
  if (aboveSeaM > SNOW_FROM_M) blend(out, offset, [out[offset], out[offset + 1], out[offset + 2]], SNOW, ramp(SNOW_FROM_M, SNOW_FULL_M, aboveSeaM));
  // Two octaves of mottling (about 250 m and 50 m) read as canopy, dunes or drifts from the air.
  const lat = latRad * RAD_TO_DEG, lon = lonRad * RAD_TO_DEG;
  const noise = valueNoise2D(lon * 450, lat * 450) * 0.6 + valueNoise2D(lon * 2_100, lat * 2_100) * 0.4;
  const strength = biome === 'rainforest' || biome === 'woodland' ? 0.28 : 0.1;
  for (let i = 0; i < 3; i++) out[offset + i] = Math.max(0, out[offset + i] * (1 + strength * noise));
}
