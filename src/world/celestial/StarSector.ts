import {
  type SectorIndex, SECTOR_SIZE_M, sectorKey, sectorSeed,
} from '../spatial/UniverseAddress';
import { LIGHT_YEAR_M, type Vec3 } from '../spatial/units';
import { LOCAL_GROUP_CATALOG, GALACTIC_CENTRE_FROM_SOL_M, type GalaxyDefinition } from './GalaxyDefinition';

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
  
  const radius = Math.hypot(positionM[0], positionM[1]);
  const height = Math.abs(positionM[2]);

  // Thin disc (where most stars are, including the Sun)
  const thinDisc = Math.exp(-radius / (2.6 * kpc)) * Math.exp(-height / (0.3 * kpc));
  
  // Thick disc (older stars, more puffed up)
  const thickDisc = 0.05 * Math.exp(-radius / (3.6 * kpc)) * Math.exp(-height / (0.9 * kpc));

  // Bulge (spherical/ellipsoidal dense core)
  const bulgeRadius = Math.hypot(radius, height * 1.6);
  const bulge = 1.5 * Math.exp(-((bulgeRadius / (1.2 * kpc)) ** 2));
  
  // Central Bar (elongated structure in the center)
  // Approximate the bar as being aligned along the X axis for simplicity
  const barRadius = Math.hypot(positionM[0] / 2.0, positionM[1], positionM[2] * 2.0);
  const bar = 0.8 * Math.exp(-((barRadius / (1.5 * kpc)) ** 2));

  // Stellar Halo (very sparse, very large spherical component)
  const haloRadius = Math.hypot(radius, height);
  const halo = 0.001 * Math.pow(1 + haloRadius / (3.0 * kpc), -3.5);

  // Spiral Arm Modulation
  const theta = Math.atan2(positionM[1], positionM[0]);
  // A two-arm logarithmic spiral approximation
  const pitchAngle = 12.0 * Math.PI / 180.0;
  const k = 1.0 / Math.tan(pitchAngle);
  // Logarithmic spiral phase
  const spiralPhase = k * Math.log(Math.max(radius / kpc, 0.1));
  const spiralModulation = 1.0 + 0.4 * Math.cos(2 * (theta - spiralPhase));

  const totalDensity = (thinDisc + thickDisc) * spiralModulation + bulge + bar + halo;

  // Normalised so the Sun's neighbourhood, 8.2 kpc out and in the plane, is exactly one.
  const sunRadius = 8.2 * kpc;
  const sunThinDisc = Math.exp(-sunRadius / (2.6 * kpc));
  const sunThickDisc = 0.05 * Math.exp(-sunRadius / (3.6 * kpc));
  const sunHalo = 0.001 * Math.pow(1 + sunRadius / (3.0 * kpc), -3.5);
  // Solar system is near the Orion spur, not exactly in a main arm, so modulation might be ~1.0
  const sunTotalDensity = (sunThinDisc + sunThickDisc) * 1.0 + sunHalo;

  return totalDensity / sunTotalDensity;
}

export function andromedaDensity(positionM: Vec3): number {
  const kpc = 3.085_677_581e19;
  
  const radius = Math.hypot(positionM[0], positionM[1]);
  const height = Math.abs(positionM[2]);

  // Andromeda is larger and denser than the Milky Way
  const thinDisc = 1.2 * Math.exp(-radius / (3.0 * kpc)) * Math.exp(-height / (0.4 * kpc));
  const thickDisc = 0.08 * Math.exp(-radius / (4.0 * kpc)) * Math.exp(-height / (1.0 * kpc));
  
  // Bulge is much larger
  const bulgeRadius = Math.hypot(radius, height * 1.4);
  const bulge = 2.5 * Math.exp(-((bulgeRadius / (1.5 * kpc)) ** 2));
  
  // No significant bar
  
  // Halo is larger
  const haloRadius = Math.hypot(radius, height);
  const halo = 0.002 * Math.pow(1 + haloRadius / (4.0 * kpc), -3.5);

  const theta = Math.atan2(positionM[1], positionM[0]);
  const pitchAngle = 10.0 * Math.PI / 180.0;
  const k = 1.0 / Math.tan(pitchAngle);
  const spiralPhase = k * Math.log(Math.max(radius / kpc, 0.1));
  const spiralModulation = 1.0 + 0.3 * Math.cos(2 * (theta - spiralPhase));

  const totalDensity = (thinDisc + thickDisc) * spiralModulation + bulge + halo;

  // We still normalize against the Sun's expected density so STARS_PER_SECTOR_BASE makes sense
  // If we want Andromeda to be generally denser, we just scale it.
  const sunRadius = 8.2 * kpc;
  const sunThinDisc = Math.exp(-sunRadius / (2.6 * kpc));
  const sunThickDisc = 0.05 * Math.exp(-sunRadius / (3.6 * kpc));
  const sunHalo = 0.001 * Math.pow(1 + sunRadius / (3.0 * kpc), -3.5);
  const sunTotalDensity = (sunThinDisc + sunThickDisc) * 1.0 + sunHalo;

  return totalDensity / sunTotalDensity;
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

  // Find the galaxy definition
  const galDef = LOCAL_GROUP_CATALOG.find(g => g.id === galaxyId);
  const densityScale = (galDef?.densityScale ?? 1) * (options.densityScale ?? 1);

  // Where this sector sits in the galaxy, relative to the Solar System (Sector 0, 0, 0)
  const bounded = [sector.x,sector.y,sector.z].every(v=>v>=-1_000_000n && v<=1_000_000n);
  const localCentre: Vec3 = bounded ? [
    Number(sector.x) * SECTOR_SIZE_M,
    Number(sector.y) * SECTOR_SIZE_M,
    Number(sector.z) * SECTOR_SIZE_M,
  ] : [0,0,0];
  
  // The galactic center position relative to the local centre
  const LY_TO_M = 9.4607304725808e15;
  let galacticCentrePosM: Vec3 = [0, 0, 0];
  
  if (galaxyId === 'milky_way' || galaxyId === 'milky-way') {
    // The galactic center is ~26,000 ly away from the Solar System. We place it at +X for now.
    galacticCentrePosM = [
      localCentre[0] - GALACTIC_CENTRE_FROM_SOL_M[0],
      localCentre[1],
      localCentre[2],
    ];
  } else if (galDef) {
    // Other galaxies are relative to the Milky Way (0,0,0) in our global intergalactic coordinates
    // localCentre is relative to Solar System. Solar System is at [-26000ly, 0, 0] relative to MW.
    // MW Center is at [+26000ly, 0, 0] relative to Solar System.
    // If galDef.positionM is relative to MW Center, then:
    // Pos relative to SS = MW_center_relative_to_SS + galDef.positionM
    const mwCenterRelToSS = GALACTIC_CENTRE_FROM_SOL_M;
    const galCenterRelToSS = [
      mwCenterRelToSS[0] + galDef.positionM[0],
      mwCenterRelToSS[1] + galDef.positionM[1],
      mwCenterRelToSS[2] + galDef.positionM[2],
    ];
    // Position of this sector relative to the galaxy center
    galacticCentrePosM = [
      localCentre[0] - galCenterRelToSS[0],
      localCentre[1] - galCenterRelToSS[1],
      localCentre[2] - galCenterRelToSS[2],
    ];
  } else {
    // Fallback for tests or unknown galaxies: center is at 0,0,0 in local space
    galacticCentrePosM = localCentre;
  }

  let density = 0;
  if (galDef?.densityProfile === 'andromeda') {
    density = andromedaDensity(galacticCentrePosM) * densityScale;
  } else {
    density = milkyWayDensity(galacticCentrePosM) * densityScale;
  }
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
