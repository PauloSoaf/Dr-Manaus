import {
  type SectorIndex, SECTOR_SIZE_M, sectorKey, sectorSeed,
} from '../spatial/UniverseAddress';
import { LIGHT_YEAR_M, type Vec3 } from '../spatial/units';

/**
 * Stars, generated rather than stored.
 *
 * Gaia DR3 catalogues over 1.8 billion sources. Shipping that is not an option, and it is not the
 * point either: what a player needs is that the sky is dense, that it is the same sky every time,
 * and that flying to a star finds a system there. So everything outside a small curated catalogue
 * is generated on demand from the sector's own seed, and nothing is ever written down.
 *
 * The contract is determinism. The same address must produce the same stars on every machine and
 * every run, forever, which is why `Math.random` appears nowhere in this project.
 */

export interface GeneratedStar {
  /** Stable across runs: derived from the sector and the index within it. */
  readonly id: string;
  /** Metres from the sector's own origin. Small numbers, exactly representable. */
  readonly offsetM: Vec3;
  /** Solar masses. */
  readonly massSolar: number;
  /** Kelvin. Drives the colour the renderer gives it. */
  readonly temperatureK: number;
  /** Solar luminosities. */
  readonly luminositySolar: number;
  /** Morgan–Keenan class, for the HUD and for deciding what orbits it. */
  readonly spectralClass: 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';
  readonly planetCount: number;
}

export interface StarSectorContent {
  readonly galaxyId: string;
  readonly sector: SectorIndex;
  readonly seed: bigint;
  readonly stars: readonly GeneratedStar[];
}

/** A 64-bit xorshift, so the whole pipeline stays in exact integer arithmetic. */
class SeededRandom {
  private state: bigint;
  private static readonly MASK = 0xffff_ffff_ffff_ffffn;

  constructor(seed: bigint) {
    // Zero is a fixed point of xorshift, so it is never allowed to be the state.
    this.state = (seed & SeededRandom.MASK) || 0x9e37_79b9_7f4a_7c15n;
  }

  private next(): bigint {
    let x = this.state;
    x ^= (x << 13n) & SeededRandom.MASK;
    x ^= x >> 7n;
    x ^= (x << 17n) & SeededRandom.MASK;
    this.state = x & SeededRandom.MASK;
    return this.state;
  }

  /** A double in [0, 1). Built from the top 53 bits, which is exactly a double's mantissa. */
  unit(): number { return Number(this.next() >> 11n) / 2 ** 53; }

  range(min: number, max: number): number { return min + (max - min) * this.unit(); }

  /** An integer in [min, max]. */
  integer(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1 - 1e-12));
  }
}

/**
 * The Milky Way's stellar density at a point, relative to the solar neighbourhood.
 *
 * A double exponential disc — falling off with radius and with height — plus a central bulge.
 * This is the standard shape used for the Galaxy, and it is what makes flying toward the centre
 * feel different from flying out of the plane instead of uniformly sprinkled everywhere.
 */
export function milkyWayDensity(positionM: Vec3): number {
  const kpc = 3.085_677_581e19;
  const radialScale = 2.6 * kpc;
  const heightScale = 0.3 * kpc;
  const radius = Math.hypot(positionM[0], positionM[1]);
  const height = Math.abs(positionM[2]);

  const disc = Math.exp(-radius / radialScale) * Math.exp(-height / heightScale);
  // A bulge inside about 2 kpc, which is where the density genuinely climbs.
  const bulgeRadius = Math.hypot(radius, height * 1.6);
  const bulge = 6 * Math.exp(-((bulgeRadius / (1.2 * kpc)) ** 2));
  // Normalised so the Sun's neighbourhood, 8.2 kpc out and in the plane, is about one.
  return (disc + bulge) / Math.exp(-8.2 / 2.6);
}

/** Stars per sector in the solar neighbourhood. A hundred light years holds a few hundred. */
export const STARS_PER_SECTOR_BASE = 320;

/**
 * Spectral class by mass, following the main sequence. The initial mass function is heavily
 * weighted toward small stars, which is why an M dwarf is the overwhelmingly likely draw — as it
 * is in the real sky.
 */
function classify(massSolar: number): GeneratedStar['spectralClass'] {
  if (massSolar >= 16) return 'O';
  if (massSolar >= 2.1) return 'B';
  if (massSolar >= 1.4) return 'A';
  if (massSolar >= 1.04) return 'F';
  if (massSolar >= 0.8) return 'G';
  if (massSolar >= 0.45) return 'K';
  return 'M';
}

/**
 * Generates a sector's stars.
 *
 * Pure: the same galaxy and sector always give the same result, with no state carried between
 * calls and nothing cached that could go stale. The caller decides whether to keep the result.
 */
export function generateStarSector(
  galaxyId: string,
  sector: SectorIndex,
  options: { densityScale?: number; maxStars?: number } = {},
): StarSectorContent {
  const seed = sectorSeed(galaxyId, sector);
  const random = new SeededRandom(seed);

  // Where this sector sits in the galaxy, for the density model.
  const centre: Vec3 = [
    Number(sector.x) * SECTOR_SIZE_M,
    Number(sector.y) * SECTOR_SIZE_M,
    Number(sector.z) * SECTOR_SIZE_M,
  ];
  const density = milkyWayDensity(centre) * (options.densityScale ?? 1);
  const target = Math.min(options.maxStars ?? 2000, Math.round(STARS_PER_SECTOR_BASE * density));
  const count = Math.max(0, target);

  const stars: GeneratedStar[] = [];
  for (let index = 0; index < count; index++) {
    // Salpeter-like: many small stars, very few large ones.
    const massSolar = 0.08 * (1 - random.unit()) ** -0.7;
    const clamped = Math.min(60, massSolar);
    const spectralClass = classify(clamped);
    // Main-sequence relations: L ~ M^3.5, and temperature from luminosity and radius.
    const luminositySolar = clamped ** 3.5;
    const temperatureK = 5772 * clamped ** 0.505;
    stars.push({
      id: `${sectorKey(galaxyId, sector)}/${index}`,
      offsetM: [
        random.range(0, SECTOR_SIZE_M),
        random.range(0, SECTOR_SIZE_M),
        random.range(0, SECTOR_SIZE_M),
      ],
      massSolar: clamped,
      temperatureK,
      luminositySolar,
      spectralClass,
      // Small, cool stars keep their planets; the most massive ones do not live long enough.
      planetCount: clamped > 16 ? 0 : random.integer(0, 9),
    });
  }
  return { galaxyId, sector, seed, stars };
}

/** Light years between two points given in metres, for anything user-facing. */
export const metresToLightYears = (metres: number): number => metres / LIGHT_YEAR_M;
