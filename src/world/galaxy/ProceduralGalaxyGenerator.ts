/**
 * ProceduralGalaxyGenerator.ts
 *
 * Deterministic mathematical procedural galaxy generator for U4.1.
 *
 * Models galactic morphology (Hubble sequence: E0-E7, S0, Sa-Sc, SBa-SBc, Irr)
 * using astrophysically grounded 3D stellar density functions:
 *   - Soft-core spheroidal bulge *inspired by* Hernquist (1990): same r^-4 outer asymptote,
 *     but a finite core instead of the exact Hernquist r^-1 cusp (no r=0 singularity)
 *   - Triaxial Gaussian central bar for barred spirals (SBa-SBc) — procedural approximation
 *   - Double exponential thin and thick stellar disk
 *   - Logarithmic spiral arms with envelope maximum (strictly M_arms >= 0.25 > 0)
 *   - Diffuse oblate/spherical stellar halo
 *
 * Determinism Contract:
 *   - Zero Math.random, zero Date.now, zero mutable global state.
 *   - Canonical full-magnitude BigInt key encoding, 64-bit FNV-1a + SplitMix64 finaliser,
 *     and 64-bit xorshift pseudo-random generator (see GALAXY_GENERATOR_VERSION).
 *
 * Coordinate Contract (U4.1.1):
 *   - A galaxy's cosmological position is (cell: BigInt3, localMpc: Vec3). Cell (0,0,0) is centred
 *     on the Milky Way centre; cell c is centred at c * COSMOLOGICAL_CELL_SIZE_M.
 *   - Conversion to absolute Float64 metres is only offered inside an explicit bounded domain
 *     (|cell| <= COSMOLOGICAL_FLOAT_DOMAIN_MAX_CELLS). Outside it the API refuses explicitly.
 *   - Relative vectors subtract cells in BigInt first, so distant-but-close pairs stay exact.
 *   - Output is strictly invariant to camera position, floating origin shifts, and query order.
 *   - Preserves canonical astronomical catalog entities (Milky Way, Andromeda, M33, LMC, SMC).
 *
 * References:
 *   - Hernquist, L. (1990). An Analytical Model for Spherical Galaxies and Bulges. ApJ 356, 359.
 *   - Freeman, K. C. (1970). On the Disks of Spiral and S0 Galaxies. ApJ 160, 811.
 *   - Van der Kruit, P. C., & Searle, L. (1981). A model for 3D light distribution in galactic disks. A&A 95, 105.
 *   - Binney, J., & Tremaine, S. (2008). Galactic Dynamics (2nd ed.). Princeton Univ. Press.
 *   - Magorrian, J., et al. (1998). The Demography of Massive Dark Objects in Galaxy Centers. AJ 115, 2285.
 *   - Marsaglia, G. (2003). Xorshift RNGs. Journal of Statistical Software 8(14), 1-6.
 */

import {
  type BigInt3,
  type SectorIndex,
  type CosmologicalAddress,
  SECTOR_SIZE_M,
} from '../spatial/UniverseAddress';
import {
  LIGHT_YEAR_M,
  PARSEC_M,
  type Vec3,
  degToRad,
  isFiniteVec3,
  wrapPi,
  finite,
} from '../spatial/units';
import {
  type GalaxyDefinition,
  type GalaxyDensityProfile,
  LOCAL_GROUP_CATALOG,
  GALACTIC_CENTRE_FROM_SOL_M,
} from '../celestial/GalaxyDefinition';
import type { BlackHoleDefinition } from '../providers/BlackHoleProvider';

/* ========================================================================== */
/* Physical and Astronomical Constants                                        */
/* ========================================================================== */

/** One Megaparsec in metres (~3.085677581e22 m). */
export const MPC_M = 1_000_000 * PARSEC_M;

/** One Megaparsec in light-years (~3.26156e6 ly). */
export const MPC_LY = MPC_M / LIGHT_YEAR_M;

/** Edge size of a cosmological address cell: 2.0 Mpc (~6.523 Mly). */
export const COSMOLOGICAL_CELL_SIZE_MPC = 2.0;

/** Edge size of a cosmological cell in metres. */
export const COSMOLOGICAL_CELL_SIZE_M = COSMOLOGICAL_CELL_SIZE_MPC * MPC_M;

/** Solar mass in kilograms (IAU nominal). */
export const SOLAR_MASS_KG = 1.98847e30;

/** Gravitational constant G (CODATA 2018). */
export const G_GRAVITATIONAL = 6.67430e-11;

/** Speed of light in vacuum c (exact). */
export const SPEED_OF_LIGHT_MPS = 299_792_458;

/** Schwarzschild radius per solar mass in metres: R_s/M_sun = 2 G M_sun / c^2 ~= 2953.25 m. */
export const SCHWARZSCHILD_RADIUS_PER_SOLAR_MASS_M =
  (2 * G_GRAVITATIONAL * SOLAR_MASS_KG) / (SPEED_OF_LIGHT_MPS * SPEED_OF_LIGHT_MPS);

/* ========================================================================== */
/* Cosmological Coordinate Contract (U4.1.1)                                  */
/* ========================================================================== */

/**
 * Largest |cell index| (per axis) for which an absolute Float64 position in metres is offered.
 * 1024 cells ≈ 2 Gpc ≈ 6.3e25 m, where the Float64 spacing is ~1.4e10 m (~0.1 AU): negligible
 * against a galaxy (~1e21 m) and far from any loss of identity between neighbouring cells.
 * Beyond it, `cosmologicalPositionM` returns `undefined` rather than an imprecise number.
 */
export const COSMOLOGICAL_FLOAT_DOMAIN_MAX_CELLS = 1024n;

const absBig = (v: bigint): bigint => (v < 0n ? -v : v);

export function isCellInFloatDomain(cell: BigInt3): boolean {
  const max = COSMOLOGICAL_FLOAT_DOMAIN_MAX_CELLS;
  return absBig(cell.x) <= max && absBig(cell.y) <= max && absBig(cell.z) <= max;
}

/**
 * Absolute position (metres) relative to the Milky Way centre — the same frame as
 * `GalaxyDefinition.positionM` — or `undefined` if the cell lies outside the bounded Float64
 * domain or the local offset is not finite. Never returns a silently wrong position.
 */
export function cosmologicalPositionM(address: CosmologicalAddress): Vec3 | undefined {
  if (!isCellInFloatDomain(address.cell) || !isFiniteVec3(address.localMpc)) return undefined;
  return [
    Number(address.cell.x) * COSMOLOGICAL_CELL_SIZE_M + address.localMpc[0] * MPC_M,
    Number(address.cell.y) * COSMOLOGICAL_CELL_SIZE_M + address.localMpc[1] * MPC_M,
    Number(address.cell.z) * COSMOLOGICAL_CELL_SIZE_M + address.localMpc[2] * MPC_M,
  ];
}

/**
 * Vector from `from` to `to`, in metres. The cell difference is taken exactly in BigInt and only
 * the (small) difference is converted, mirroring `UniverseAddress.separationM`. Works for any
 * absolute magnitude (including cells beyond 2^53 or 2^64) as long as the *difference* is within
 * the bounded domain; otherwise returns `undefined`.
 */
export function cosmologicalSeparationVectorM(
  from: CosmologicalAddress,
  to: CosmologicalAddress,
): Vec3 | undefined {
  const delta: BigInt3 = { x: to.cell.x - from.cell.x, y: to.cell.y - from.cell.y, z: to.cell.z - from.cell.z };
  if (!isCellInFloatDomain(delta) || !isFiniteVec3(from.localMpc) || !isFiniteVec3(to.localMpc)) {
    return undefined;
  }
  return [
    Number(delta.x) * COSMOLOGICAL_CELL_SIZE_M + (to.localMpc[0] - from.localMpc[0]) * MPC_M,
    Number(delta.y) * COSMOLOGICAL_CELL_SIZE_M + (to.localMpc[1] - from.localMpc[1]) * MPC_M,
    Number(delta.z) * COSMOLOGICAL_CELL_SIZE_M + (to.localMpc[2] - from.localMpc[2]) * MPC_M,
  ];
}

/* ========================================================================== */
/* Morphological Types & Parameter Interfaces                                 */
/* ========================================================================== */

/** Hubble morphological classification. */
export type HubbleMorphology =
  | 'E0' | 'E3' | 'E7'       // Elliptical sequence
  | 'S0'                     // Lenticular
  | 'Sa' | 'Sb' | 'Sc'       // Unbarred spiral sequence
  | 'SBa' | 'SBb' | 'SBc'    // Barred spiral sequence
  | 'Irr';                   // Irregular

/** Broad morphological family for high-level classification and HUD presentation. */
export type GalaxyFamily = 'elliptical' | 'lenticular' | 'spiral' | 'barred-spiral' | 'irregular';

/** Parameters for spheroidal central bulge. */
export interface BulgeParameters {
  /** Effective/scale radius r_b in light-years. */
  readonly effectiveRadiusLy: number;
  /** Central/peak normalized density rho_b0. */
  readonly peakDensity: number;
  /** Triaxial semi-axis ratios [a/a, b/a, c/a]. */
  readonly axisRatio: Vec3;
  /** Soft-core radius r_core in light-years to eliminate singularity at r=0. */
  readonly coreRadiusLy: number;
}

/** Parameters for central stellar bar (for SBa-SBc galaxies). */
export interface BarParameters {
  /** True if galaxy possesses an active central bar. */
  readonly active: boolean;
  /** Semi-major axis length in light-years. */
  readonly lengthLy: number;
  /** Semi-minor axis width in light-years. */
  readonly widthLy: number;
  /** Vertical scale height in light-years. */
  readonly heightLy: number;
  /** Orientation angle phi_bar in radians relative to galaxy major axis. */
  readonly angleRad: number;
  /** Peak normalized density rho_bar0. */
  readonly peakDensity: number;
}

/** Parameters for double exponential stellar disk (thin + thick). */
export interface DiskParameters {
  /** True if galaxy possesses a stellar disk (spirals, barred spirals, lenticulars). */
  readonly hasDisk: boolean;
  /** Radial scale length h_r in light-years (e.g. ~8,500 ly for Milky Way). */
  readonly radialScaleLy: number;
  /** Thin disk vertical scale height h_z1 in light-years (~300 - 1,000 ly). */
  readonly thinScaleHeightLy: number;
  /** Thick disk vertical scale height h_z2 in light-years (~1,000 - 3,500 ly). */
  readonly thickScaleHeightLy: number;
  /** Fraction of thick disk relative to thin disk (typically 0.05 - 0.15). */
  readonly thickDiskFraction: number;
  /** Central disk normalized density rho_0. */
  readonly centralDensity: number;
}

/** Parameters for logarithmic spiral arm modulation. */
export interface SpiralArmParameters {
  /** True if galaxy possesses organized spiral arm density waves. */
  readonly active: boolean;
  /** Number of spiral arms N_arms (typically 2 or 4). */
  readonly numArms: number;
  /** Pitch angle psi in radians (typically 8° to 25°). */
  readonly pitchAngleRad: number;
  /** Arm density contrast amplitude A_arm in [0.0, 0.75]. */
  readonly amplitude: number;
  /** Gaussian angular half-width sigma_arm in radians (~0.15 - 0.25 rad). */
  readonly angularWidthRad: number;
  /** Reference radial scale r_0 in light-years. */
  readonly referenceRadiusLy: number;
  /** Initial angular phases theta_k for each arm ridge in radians. */
  readonly initialPhasesRad: readonly number[];
}

/** Parameters for diffuse stellar halo. */
export interface HaloParameters {
  /** Core scale radius r_h in light-years (~10,000 - 30,000 ly). */
  readonly coreRadiusLy: number;
  /** Vertical flattening ratio q (typically 0.7 - 1.0). */
  readonly flattening: number;
  /** Peak normalized density rho_h0 (sparse, ~0.001 relative to solar disk). */
  readonly peakDensity: number;
  /** Radial power-law slope (typically -3.5). */
  readonly powerSlope: number;
}

/** Complete descriptor of a procedural or cataloged galaxy. */
export interface ProceduralGalaxyDescriptor {
  /** Unique stable identifier (e.g. 'milky_way' or 'galaxy_c0_0_0_1'). */
  readonly id: string;
  /** Human-readable catalog name (e.g. 'Milky Way', 'NGC 1300', 'SDSS J0832+04'). */
  readonly name: string;
  /** 64-bit deterministic seed derived from universe seed, cell, and index. */
  readonly seed: bigint;
  /** Cosmological cell grid coordinate. */
  readonly cell: BigInt3;
  /** Index within cell (0-based). */
  readonly indexInCell: number;
  /** True if this is an authentic cataloged astronomical entity. */
  readonly isKnownAstronomicalEntity: boolean;
  /** Exact Hubble morphological type. */
  readonly morphology: HubbleMorphology;
  /** Broad morphological family. */
  readonly family: GalaxyFamily;
  /** Total galactic optical diameter in light-years. */
  readonly diameterLy: number;
  /** Total galactic vertical thickness in light-years. */
  readonly thicknessLy: number;
  /** Spatial 3D orientation Euler angles [x, y, z] in radians. */
  readonly orientationEulerRad: Vec3;
  /** Position offset within cosmological cell in Mpc [-1.0, 1.0]. */
  readonly localCellMpc: Vec3;
  /** Cosmological address structure. */
  readonly cosmologicalAddress: CosmologicalAddress;
  /** Estimated total stellar count. */
  readonly estimatedStarCount: number;
  /** Estimated total stellar mass in solar masses. */
  readonly totalMassSolar: number;
  /** Dominant stellar spectral class. */
  readonly dominantSpectralClass: 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';
  /** Bulge density parameters. */
  readonly bulge: BulgeParameters;
  /** Bar density parameters. */
  readonly bar: BarParameters;
  /** Disk density parameters. */
  readonly disk: DiskParameters;
  /** Spiral arms density parameters. */
  readonly spiralArms: SpiralArmParameters;
  /** Halo density parameters. */
  readonly halo: HaloParameters;
  /** Overall density scaling factor relative to solar neighborhood. */
  readonly densityScale: number;
  /**
   * Architectural slot for central Supermassive Black Hole (BH0-BH2).
   * Note: strictly metadata in U4.1; no physical lensing or horizons are active.
   */
  readonly centralBlackHole?: {
    readonly id: string;
    readonly massSolar: number;
    readonly schwarzschildRadiusM: number;
  };
}

/* ========================================================================== */
/* Deterministic PRNG & Hashing Implementation                                */
/* ========================================================================== */

/**
 * Generator version. Part of every hashed key, so a future change to the generation algorithm can
 * bump it and produce a disjoint seed space instead of silently mutating existing galaxies.
 *   v1 (U4.1, d1def8c): 8-byte truncating mix, 32-bit index — superseded (aliasing at 2^64).
 *   v2 (U4.1.1): canonical full-magnitude encoding + SplitMix64 finaliser.
 */
export const GALAXY_GENERATOR_VERSION = 2;

/** Hash purposes. Distinct purposes never share a key, so a population roll is not galaxy 0's seed. */
export const HASH_PURPOSE_GALAXY = 0;
export const HASH_PURPOSE_CELL_POPULATION = 1;
export type HashPurpose = typeof HASH_PURPOSE_GALAXY | typeof HASH_PURPOSE_CELL_POPULATION;

/**
 * Valid domain of `galaxyIndex`: integers in [0, GALAXY_INDEX_MAX].
 * Field cells hold 1–4 galaxies and the Local Group cell 5; 65 535 leaves room for future cluster
 * cells. Out-of-domain indices throw `RangeError` — they are never truncated or wrapped.
 * Whether an index is *populated* is decided separately by `getGalaxyCountInCell`.
 */
export const GALAXY_INDEX_MAX = 0xffff;

const FNV64_OFFSET = 0xcbf2_9ce4_8422_2325n;
const FNV64_PRIME = 0x0000_0100_0000_01b3n;
const MASK64 = 0xffff_ffff_ffff_ffffn;
/** ASCII 'DMGX' — domain tag so these keys can never coincide with `sectorSeed` string keys. */
const KEY_MAGIC = [0x44, 0x4d, 0x47, 0x58] as const;

export function assertValidGalaxyIndex(galaxyIndex: number): void {
  if (!Number.isSafeInteger(galaxyIndex) || galaxyIndex < 0 || galaxyIndex > GALAXY_INDEX_MAX) {
    throw new RangeError(
      `galaxyIndex must be an integer in [0, ${GALAXY_INDEX_MAX}]; received ${String(galaxyIndex)}`,
    );
  }
}

/** Plain 64-bit FNV-1a over bytes (Fowler–Noll–Vo). Exposed so tests can pin published vectors. */
export function fnv1a64Bytes(bytes: ArrayLike<number>): bigint {
  let hash = FNV64_OFFSET;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= BigInt(bytes[i] & 0xff);
    hash = (hash * FNV64_PRIME) & MASK64;
  }
  return hash;
}

/**
 * SplitMix64 output finaliser (Steele, Lea & Flood 2014). FNV-1a's multiply only carries upward,
 * so its low bits depend only on the low bits of the input; the finaliser gives full avalanche
 * before the value seeds xorshift, decorrelating neighbouring cells.
 */
export function splitMix64Finalize(value: bigint): bigint {
  let z = value & MASK64;
  z = ((z ^ (z >> 30n)) * 0xbf58_476d_1ce4_e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d0_49bb_1331_11ebn) & MASK64;
  return (z ^ (z >> 31n)) & MASK64;
}

/**
 * Canonical, injective byte encoding of an arbitrary-size BigInt:
 *   [sign byte: 0 = non-negative, 1 = negative] [LEB128 byte length] [magnitude, little-endian]
 * Zero is [0, 0]. Because the length is explicit, the encoding is prefix-free: no two distinct
 * values (e.g. 0n and 2^64) and no two field sequences share a byte string.
 */
export function encodeBigIntCanonical(value: bigint, out: number[]): void {
  const negative = value < 0n;
  let magnitude = negative ? -value : value;
  const magnitudeBytes: number[] = [];
  while (magnitude > 0n) {
    magnitudeBytes.push(Number(magnitude & 0xffn));
    magnitude >>= 8n;
  }
  out.push(negative ? 1 : 0);
  let length = magnitudeBytes.length;
  do {
    let byte = length & 0x7f;
    length >>>= 7;
    if (length !== 0) byte |= 0x80;
    out.push(byte);
  } while (length !== 0);
  for (const byte of magnitudeBytes) out.push(byte);
}

/** Full key: magic, version, purpose, then seed, x, y, z, index — each canonically encoded. */
export function encodeCosmologicalKey(
  universeSeed: bigint,
  cell: BigInt3,
  galaxyIndex: number,
  purpose: HashPurpose = HASH_PURPOSE_GALAXY,
): number[] {
  assertValidGalaxyIndex(galaxyIndex);
  const out: number[] = [...KEY_MAGIC, GALAXY_GENERATOR_VERSION, purpose];
  encodeBigIntCanonical(universeSeed, out);
  encodeBigIntCanonical(cell.x, out);
  encodeBigIntCanonical(cell.y, out);
  encodeBigIntCanonical(cell.z, out);
  encodeBigIntCanonical(BigInt(galaxyIndex), out);
  return out;
}

/**
 * 64-bit seed for (universe seed, cosmological cell, galaxy index).
 *
 * Contract: exact identities are never aliased by truncation — every bit of every coordinate
 * reaches the hash. Like any 64-bit hash over an unbounded domain, accidental collisions remain
 * mathematically possible (birthday bound ~2^32 keys for 50%); the identity of a galaxy is its
 * (cell, index) address and `id`, never the seed alone.
 */
export function hashCosmologicalCell(
  universeSeed: bigint,
  cell: BigInt3,
  galaxyIndex: number,
  purpose: HashPurpose = HASH_PURPOSE_GALAXY,
): bigint {
  return splitMix64Finalize(fnv1a64Bytes(encodeCosmologicalKey(universeSeed, cell, galaxyIndex, purpose)));
}


/**
 * Deterministic 64-bit xorshift pseudo-random number generator.
 * Strictly adheres to integer arithmetic without Math.random.
 */
export class DeterministicRNG {
  private state: bigint;
  private static readonly MASK = 0xffff_ffff_ffff_ffffn;

  constructor(seed: bigint) {
    this.state = (seed & DeterministicRNG.MASK) || 0x9e37_79b9_7f4a_7c15n;
  }

  private next(): bigint {
    let x = this.state;
    x ^= (x << 13n) & DeterministicRNG.MASK;
    x ^= x >> 7n;
    x ^= (x << 17n) & DeterministicRNG.MASK;
    this.state = x & DeterministicRNG.MASK;
    return this.state;
  }

  /** Double in [0, 1) using the 53 bits of mantissa. */
  unit(): number {
    return Number(this.next() >> 11n) / (2 ** 53);
  }

  /** Double in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.unit();
  }

  /** Integer in [min, max] inclusive. */
  integer(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1 - 1e-12));
  }

  /** Deterministic selection from array. */
  pick<T>(items: readonly T[]): T {
    const idx = Math.min(items.length - 1, Math.floor(this.unit() * items.length));
    return items[idx];
  }
}

/* ========================================================================== */
/* Mathematical Density Evaluators                                            */
/* ========================================================================== */

/**
 * Calculates logarithmic spiral arm modulation density factor M_arms(r, theta).
 *
 * Guaranteed properties:
 *   1. M_arms(r, theta) >= (1 - A_arm) >= 0.25 > 0 (strictly non-negative and finite).
 *   2. Periodic: M_arms(r, theta + 2*pi*k) == M_arms(r, theta).
 *   3. Crest value M_arms = 1.0 when theta aligns with the logarithmic ridge.
 *   4. Zero destructive phase interference due to envelope maximum max_k.
 */
export function calculateSpiralArmModulation(
  rLy: number,
  thetaRad: number,
  params: SpiralArmParameters,
): number {
  if (!params.active || params.numArms <= 0 || params.amplitude <= 0) {
    return 1.0;
  }

  const b = Math.tan(params.pitchAngleRad);
  if (Math.abs(b) < 1e-6) return 1.0;

  const rSafe = Math.max(1.0, rLy);
  const r0 = Math.max(1.0, params.referenceRadiusLy);
  const lnRRatio = Math.log(rSafe / r0);

  let maxGaussian = 0;
  const twoSigmaSq = 2 * params.angularWidthRad * params.angularWidthRad;

  for (let k = 0; k < params.numArms; k++) {
    const basePhase = params.initialPhasesRad[k] ?? ((2 * Math.PI * k) / params.numArms);
    const ridgeAngle = basePhase + lnRRatio / b;
    const deltaTheta = wrapPi(thetaRad - ridgeAngle);
    const gaussian = Math.exp(-(deltaTheta * deltaTheta) / twoSigmaSq);
    if (gaussian > maxGaussian) {
      maxGaussian = gaussian;
    }
  }

  const amp = Math.min(0.75, Math.max(0.0, params.amplitude));
  return (1 - amp) + amp * maxGaussian;
}

/**
 * Evaluates the 3D spheroidal bulge density with a soft core.
 *   rho_bulge(m) = rho_b0 / (1 + m_eff / r_b)^4,   m_eff = sqrt(m^2 + r_core^2)
 *
 * This is NOT the exact Hernquist (1990) density, which is rho ∝ 1 / [(m/a)(1 + m/a)^3] and
 * diverges as 1/m at the centre. It is a Hernquist-inspired procedural profile: it shares the
 * r^-4 outer fall-off but replaces the cusp with a finite, smooth core so rho(0) is bounded.
 * It is also not a de Vaucouleurs R^{1/4} law (that is a projected surface-brightness profile).
 * Units: coordinates and radii in light-years; density in dimensionless model units.
 */
export function calculateBulgeDensity(
  xLy: number,
  yLy: number,
  zLy: number,
  params: BulgeParameters,
): number {
  const [aRatio, bRatio, cRatio] = params.axisRatio;
  const a = Math.max(0.1, aRatio);
  const b = Math.max(0.1, bRatio);
  const c = Math.max(0.1, cRatio);

  const mSq = (xLy / a) ** 2 + (yLy / b) ** 2 + (zLy / c) ** 2;
  const coreSq = Math.max(1.0, params.coreRadiusLy) ** 2;
  const mEff = Math.sqrt(mSq + coreSq);

  const rb = Math.max(10.0, params.effectiveRadiusLy);
  const profile = (1 + mEff / rb) ** 4;

  return params.peakDensity / profile;
}

/**
 * Evaluates the triaxial central bar density.
 *   rho_bar = rho_bar0 * exp(-m_bar^2)
 * Rotated by angle phi_bar in the galactic plane.
 */
export function calculateBarDensity(
  xLy: number,
  yLy: number,
  zLy: number,
  params: BarParameters,
): number {
  if (!params.active || params.peakDensity <= 0) return 0;

  const cosA = Math.cos(-params.angleRad);
  const sinA = Math.sin(-params.angleRad);

  const xBar = xLy * cosA - yLy * sinA;
  const yBar = xLy * sinA + yLy * cosA;
  const zBar = zLy;

  const a = Math.max(10.0, params.lengthLy);
  const b = Math.max(10.0, params.widthLy);
  const c = Math.max(10.0, params.heightLy);

  const mBarSq = (xBar / a) ** 2 + (yBar / b) ** 2 + (zBar / c) ** 2;
  // U4.1.1: no hard cut-off. The former `mBarSq > 25 → 0` introduced a jump of ~1.4e-11·rho_bar0;
  // Math.exp underflows smoothly to +0 for large arguments, so continuity costs nothing.
  return params.peakDensity * Math.exp(-mBarSq);
}

/**
 * Evaluates the double exponential disk density (thin + thick disk).
 *   rho_disk = rho_0 * [ exp(-r/hr) * sech^2(z/hz1) + f_thick * exp(-r/(1.4*hr)) * sech^2(z/hz2) ]
 */
export function calculateDiskDensity(
  rLy: number,
  zLy: number,
  params: DiskParameters,
): number {
  if (!params.hasDisk || params.centralDensity <= 0) return 0;

  const hr = Math.max(100.0, params.radialScaleLy);
  const hz1 = Math.max(10.0, params.thinScaleHeightLy);
  const hz2 = Math.max(20.0, params.thickScaleHeightLy);

  // sech^2(u) = 4 e^{-2|u|} / (1 + e^{-2|u|})^2 — exact identity, never overflows, continuous
  // everywhere (U4.1.1 replaces the former |u| > 15 → 0 cut-off, which was a small jump).
  const sechSq = (u: number): number => {
    const e = Math.exp(-2 * Math.abs(u));
    return (4 * e) / ((1 + e) * (1 + e));
  };

  const thinRadial = Math.exp(-rLy / hr);
  const thinVertical = sechSq(zLy / hz1);
  const thin = thinRadial * thinVertical;

  const thickRadial = Math.exp(-rLy / (1.4 * hr));
  const thickVertical = sechSq(zLy / hz2);
  const thick = params.thickDiskFraction * thickRadial * thickVertical;

  return params.centralDensity * (thin + thick);
}

/**
 * Evaluates diffuse stellar halo density.
 *   rho_halo = rho_h0 * (1 + R_halo^2 / r_h^2)^(-1.75)
 */
export function calculateHaloDensity(
  rLy: number,
  zLy: number,
  params: HaloParameters,
): number {
  if (params.peakDensity <= 0) return 0;

  const q = Math.max(0.1, params.flattening);
  const rh = Math.max(100.0, params.coreRadiusLy);

  const rHaloSq = rLy * rLy + (zLy / q) * (zLy / q);
  const scaled = 1 + rHaloSq / (rh * rh);

  return params.peakDensity * Math.pow(scaled, params.powerSlope / 2);
}

/* ========================================================================== */
/* Composite Density (single source of truth for procedural morphology)       */
/* ========================================================================== */

/**
 * Stellar density at a point relative to the galaxy centre, in galaxy-local metres.
 *
 * This is the one evaluator for procedural morphology; `ProceduralGalaxyGenerator.calculateDensity`
 * and `GalaxyRuntime.densityAtLocal` (for definitions carrying `proceduralMorphology`) both call it,
 * so a consumer can never silently fall back to the Milky Way profile.
 *
 * Invariants: result >= 0; finite; continuous in position (including r = 0 and negative axes);
 * non-finite inputs are treated as 0 (the same guard as `units.finite`).
 * Units: dimensionless model density, already multiplied by `descriptor.densityScale`. It is NOT
 * normalised to the solar neighbourhood (unlike legacy `milkyWayDensity`); calibrating it to
 * StarSector's STARS_PER_SECTOR_BASE is an explicit U4.3 task.
 */
export function evaluateProceduralDensity(descriptor: ProceduralGalaxyDescriptor, localPosM: Vec3): number {
  const xLy = finite(localPosM[0]) / LIGHT_YEAR_M;
  const yLy = finite(localPosM[1]) / LIGHT_YEAR_M;
  const zLy = finite(localPosM[2]) / LIGHT_YEAR_M;

  const rLy = Math.hypot(xLy, yLy);
  const thetaRad = Math.atan2(yLy, xLy);

  const rhoBulge = calculateBulgeDensity(xLy, yLy, zLy, descriptor.bulge);
  const rhoBar = calculateBarDensity(xLy, yLy, zLy, descriptor.bar);
  const rhoDisk = calculateDiskDensity(rLy, zLy, descriptor.disk)
    * calculateSpiralArmModulation(rLy, thetaRad, descriptor.spiralArms);
  const rhoHalo = calculateHaloDensity(rLy, zLy, descriptor.halo);

  const total = (rhoBulge + rhoBar + rhoDisk + rhoHalo) * descriptor.densityScale;
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

/* ========================================================================== */
/* Legacy Adapter Contract                                                    */
/* ========================================================================== */

export type LegacyGalaxyDefinitionResult =
  | {
    readonly ok: true;
    readonly definition: GalaxyDefinition;
    /** 'canonical-catalog': the LOCAL_GROUP_CATALOG object itself (legacy density authority).
     *  'procedural': new definition carrying `proceduralMorphology` (procedural density authority). */
    readonly source: 'canonical-catalog' | 'procedural';
  }
  | {
    readonly ok: false;
    readonly reason: 'cell-outside-float-domain' | 'non-finite-local-offset';
    readonly message: string;
  };

/* ========================================================================== */
/* Procedural Galaxy Generator Core Engine                                    */
/* ========================================================================== */

export class ProceduralGalaxyGenerator {
  /**
   * Deterministically returns the number of galaxies in a cosmological cell.
   * Field cells hold 1 to 4 galaxies; the Local Group cell holds exactly 5 catalogued entities.
   * Uses its own hash purpose, so the roll is independent of galaxy 0's seed.
   */
  getGalaxyCountInCell(universeSeed: bigint, cell: BigInt3): number {
    // Cell (0, 0, 0) is the Local Group cell: MW, Andromeda, Triangulum, LMC, SMC.
    if (cell.x === 0n && cell.y === 0n && cell.z === 0n) {
      return 5;
    }
    const seed = hashCosmologicalCell(universeSeed, cell, 0, HASH_PURPOSE_CELL_POPULATION);
    const rng = new DeterministicRNG(seed);
    return rng.integer(1, 4);
  }

  /** True when `galaxyIndex` is within the deterministic population of the cell. */
  isGalaxyIndexPopulated(universeSeed: bigint, cell: BigInt3, galaxyIndex: number): boolean {
    assertValidGalaxyIndex(galaxyIndex);
    return galaxyIndex < this.getGalaxyCountInCell(universeSeed, cell);
  }

  /**
   * Generates or retrieves a complete galaxy descriptor deterministically.
   *
   * Pure function of (universeSeed, cell, galaxyIndex). `galaxyIndex` must be an integer in
   * [0, GALAXY_INDEX_MAX] (RangeError otherwise). The descriptor is defined for any valid index;
   * use `isGalaxyIndexPopulated` to know whether the cell actually contains it.
   */
  generateGalaxy(
    universeSeed: bigint,
    cell: BigInt3,
    galaxyIndex: number,
  ): ProceduralGalaxyDescriptor {
    assertValidGalaxyIndex(galaxyIndex);
    // 1. Check for canonical astronomical entities in the Local Group cell (0, 0, 0)
    if (cell.x === 0n && cell.y === 0n && cell.z === 0n) {
      const canonical = this.getCanonicalLocalGroupGalaxy(galaxyIndex);
      if (canonical) return canonical;
    }

    // 2. Derive stable 64-bit seed
    const seed = hashCosmologicalCell(universeSeed, cell, galaxyIndex);
    const rng = new DeterministicRNG(seed);

    // 3. Roll morphological family (Hubble sequence)
    const morphRoll = rng.unit();
    let morphology: HubbleMorphology;
    let family: GalaxyFamily;

    if (morphRoll < 0.20) {
      // 20% Elliptical
      family = 'elliptical';
      const eRoll = rng.unit();
      morphology = eRoll < 0.33 ? 'E0' : eRoll < 0.66 ? 'E3' : 'E7';
    } else if (morphRoll < 0.35) {
      // 15% Lenticular
      family = 'lenticular';
      morphology = 'S0';
    } else if (morphRoll < 0.70) {
      // 35% Spiral
      family = 'spiral';
      const sRoll = rng.unit();
      morphology = sRoll < 0.33 ? 'Sa' : sRoll < 0.66 ? 'Sb' : 'Sc';
    } else if (morphRoll < 0.90) {
      // 20% Barred Spiral
      family = 'barred-spiral';
      const sbRoll = rng.unit();
      morphology = sbRoll < 0.33 ? 'SBa' : sbRoll < 0.66 ? 'SBb' : 'SBc';
    } else {
      // 10% Irregular
      family = 'irregular';
      morphology = 'Irr';
    }

    // 4. Physical dimensions
    const diameterLy = rng.range(25_000, 220_000);
    const thicknessLy = diameterLy * rng.range(0.01, 0.05); // 1% to 5% aspect ratio

    // 5. 3D Spatial orientation in cosmological frame
    const orientationEulerRad: Vec3 = [
      rng.range(0, 2 * Math.PI),
      rng.range(0, 2 * Math.PI),
      rng.range(0, 2 * Math.PI),
    ];

    // 6. Cell-local position in Mpc [-0.9, 0.9]
    const localCellMpc: Vec3 = [
      rng.range(-0.9, 0.9),
      rng.range(-0.9, 0.9),
      rng.range(-0.9, 0.9),
    ];

    // 7. Morphological parameter assembly
    const bulge = this.generateBulge(rng, morphology, diameterLy);
    const bar = this.generateBar(rng, morphology, diameterLy);
    const disk = this.generateDisk(rng, morphology, diameterLy, thicknessLy);
    const spiralArms = this.generateSpiralArms(rng, morphology, diameterLy, bar);
    const halo = this.generateHalo(rng, diameterLy);

    // 8. Stellar population, spectral classification, and mass estimation
    const totalMassSolar = (diameterLy / 100_000) ** 2.2 * rng.range(5e10, 8e11);
    const estimatedStarCount = Math.round(totalMassSolar * rng.range(0.6, 1.4));

    let dominantSpectralClass: 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';
    if (family === 'elliptical') {
      dominantSpectralClass = rng.unit() < 0.7 ? 'K' : 'M';
    } else if (family === 'lenticular') {
      dominantSpectralClass = rng.unit() < 0.6 ? 'G' : 'K';
    } else if (family === 'spiral' || family === 'barred-spiral') {
      dominantSpectralClass = rng.unit() < 0.5 ? 'G' : 'F';
    } else {
      dominantSpectralClass = rng.unit() < 0.6 ? 'A' : 'B'; // Active starburst
    }

    // 9. Central Supermassive Black Hole metadata (BH0-BH2 slot via Magorrian relation)
    const bulgeMassFraction = family === 'elliptical' ? 0.9 : family === 'lenticular' ? 0.5 : 0.2;
    const bulgeMassSolar = totalMassSolar * bulgeMassFraction;
    const bhMassSolar = Math.max(1e5, bulgeMassSolar * 0.0014); // Magorrian relation
    const schwarzschildRadiusM = bhMassSolar * SCHWARZSCHILD_RADIUS_PER_SOLAR_MASS_M;

    // 10. Procedural designation. Deliberately NOT an NGC/IC/UGC/PGC/SDSS-style name: synthetic
    // galaxies must never look like officially catalogued objects. 'DM-PG' = Dr-Manaus Procedural
    // Galaxy, followed by the first 8 hex digits of the seed.
    const seedHex = seed.toString(16).padStart(16, '0').toUpperCase();
    const name = `DM-PG ${seedHex.slice(0, 4)}-${seedHex.slice(4, 8)}`;
    const id = `galaxy_c${cell.x}_${cell.y}_${cell.z}_${galaxyIndex}`;

    const cosmologicalAddress: CosmologicalAddress = {
      cell,
      localMpc: localCellMpc,
    };

    return {
      id,
      name,
      seed,
      cell,
      indexInCell: galaxyIndex,
      isKnownAstronomicalEntity: false,
      morphology,
      family,
      diameterLy,
      thicknessLy,
      orientationEulerRad,
      localCellMpc,
      cosmologicalAddress,
      estimatedStarCount,
      totalMassSolar,
      dominantSpectralClass,
      bulge,
      bar,
      disk,
      spiralArms,
      halo,
      densityScale: rng.range(0.8, 1.6),
      centralBlackHole: {
        id: `${id}_smbh`,
        massSolar: bhMassSolar,
        schwarzschildRadiusM,
      },
    };
  }

  /**
   * Stellar density at a point relative to the galaxy centre, in galaxy-local metres.
   * Delegates to `evaluateProceduralDensity` (see its contract: >= 0, finite, continuous,
   * dimensionless model units including `densityScale`; not solar-neighbourhood normalised).
   */
  calculateDensity(descriptor: ProceduralGalaxyDescriptor, localPosM: Vec3): number {
    return evaluateProceduralDensity(descriptor, localPosM);
  }

  /**
   * Converts a descriptor into the legacy `GalaxyDefinition` shape, explicitly.
   *
   * - Canonical entities present in LOCAL_GROUP_CATALOG (`milky_way`, `andromeda`) return the
   *   catalogue object itself: positions, orientation, black holes and the legacy density profile
   *   are preserved bit-for-bit, never reconstructed from rounded Mpc offsets.
   * - Every other descriptor gets `positionM` from (cell, localMpc) via `cosmologicalPositionM`,
   *   so two galaxies with the same local offset in different cells never coincide. Cells outside
   *   the bounded Float64 domain yield `{ ok: false }` — never a silently wrong position.
   * - Procedural definitions carry `densityProfile: 'procedural'` and `proceduralMorphology`, so
   *   `GalaxyRuntime.densityAtLocal` evaluates the descriptor's own morphology.
   * - `centralBlackHole` is intentionally NOT emitted for procedural definitions: the descriptor
   *   keeps it as metadata only, and emitting a BlackHoleDefinition would let presentation code
   *   instantiate a functional black hole (BH0–BH2 remain blocked).
   */
  tryToGalaxyDefinition(descriptor: ProceduralGalaxyDescriptor): LegacyGalaxyDefinitionResult {
    if (descriptor.isKnownAstronomicalEntity) {
      const legacy = LOCAL_GROUP_CATALOG.find((g) => g.id === descriptor.id);
      if (legacy) return { ok: true, definition: legacy, source: 'canonical-catalog' };
    }

    const address = descriptor.cosmologicalAddress;
    if (!isFiniteVec3(address.localMpc)) {
      return {
        ok: false,
        reason: 'non-finite-local-offset',
        message: `Galaxy ${descriptor.id} has a non-finite local cell offset.`,
      };
    }
    const position = cosmologicalPositionM(address);
    if (!position) {
      return {
        ok: false,
        reason: 'cell-outside-float-domain',
        message: `Galaxy ${descriptor.id} lies in cell (${address.cell.x}, ${address.cell.y}, ${address.cell.z}), `
          + `outside the legacy Float64 domain (|cell| <= ${COSMOLOGICAL_FLOAT_DOMAIN_MAX_CELLS}). `
          + 'Use cosmologicalSeparationVectorM for relative placement.',
      };
    }

    // Coarse legacy label only; the full Hubble type lives in `proceduralMorphology`.
    let type: GalaxyDefinition['type'];
    if (descriptor.family === 'barred-spiral') {
      type = 'barred-spiral';
    } else if (descriptor.family === 'spiral' || descriptor.family === 'lenticular') {
      type = 'spiral';
    } else if (descriptor.family === 'elliptical') {
      type = 'elliptical';
    } else {
      type = 'irregular';
    }

    const densityProfile: GalaxyDensityProfile = 'procedural';
    return {
      ok: true,
      source: 'procedural',
      definition: {
        id: descriptor.id,
        name: descriptor.name,
        addressOriginM: [0, 0, 0],
        type,
        diameterLy: descriptor.diameterLy,
        thicknessLy: descriptor.thicknessLy,
        positionM: [position[0], position[1], position[2]],
        orientationEuler: [
          descriptor.orientationEulerRad[0],
          descriptor.orientationEulerRad[1],
          descriptor.orientationEulerRad[2],
        ],
        densityProfile,
        // Informational; the procedural evaluator already applies it (not multiplied twice).
        densityScale: descriptor.densityScale,
        proceduralMorphology: descriptor,
      },
    };
  }

  /** Throwing form of `tryToGalaxyDefinition`: RangeError instead of an incorrect position. */
  toGalaxyDefinition(descriptor: ProceduralGalaxyDescriptor): GalaxyDefinition {
    const result = this.tryToGalaxyDefinition(descriptor);
    if (!result.ok) throw new RangeError(result.message);
    return result.definition;
  }

  /* ======================================================================== */
  /* Internal Helper Generators                                               */
  /* ======================================================================== */

  private generateBulge(
    rng: DeterministicRNG,
    morph: HubbleMorphology,
    diameterLy: number,
  ): BulgeParameters {
    const isElliptical = morph.startsWith('E');
    const isLenticular = morph === 'S0';

    let radiusFraction: number;
    let peakDensity: number;
    let axisRatio: Vec3;

    if (isElliptical) {
      radiusFraction = rng.range(0.25, 0.45);
      peakDensity = rng.range(2.0, 5.0);
      if (morph === 'E0') axisRatio = [1, 1, 0.95];
      else if (morph === 'E3') axisRatio = [1, 1, 0.70];
      else axisRatio = [1, 1, 0.35]; // E7
    } else if (isLenticular) {
      radiusFraction = rng.range(0.15, 0.25);
      peakDensity = rng.range(1.8, 3.5);
      axisRatio = [1, 1, 0.6];
    } else if (morph.startsWith('Sa') || morph.startsWith('SBa')) {
      radiusFraction = rng.range(0.12, 0.20);
      peakDensity = rng.range(1.5, 3.0);
      axisRatio = [1, 1, 0.65];
    } else if (morph.startsWith('Sb') || morph.startsWith('SBb')) {
      radiusFraction = rng.range(0.08, 0.14);
      peakDensity = rng.range(1.2, 2.2);
      axisRatio = [1, 1, 0.7];
    } else if (morph.startsWith('Sc') || morph.startsWith('SBc')) {
      radiusFraction = rng.range(0.04, 0.08);
      peakDensity = rng.range(0.6, 1.4);
      axisRatio = [1, 1, 0.8];
    } else {
      // Irregular
      radiusFraction = rng.range(0.03, 0.08);
      peakDensity = rng.range(0.3, 0.9);
      axisRatio = [1, 1, 0.85];
    }

    return {
      effectiveRadiusLy: diameterLy * radiusFraction * 0.5,
      peakDensity,
      axisRatio,
      coreRadiusLy: Math.max(10.0, diameterLy * 0.002), // Soft-core preventing r=0 singularity
    };
  }

  private generateBar(
    rng: DeterministicRNG,
    morph: HubbleMorphology,
    diameterLy: number,
  ): BarParameters {
    const isBarred = morph.startsWith('SB');
    if (!isBarred) {
      return {
        active: false,
        lengthLy: 0,
        widthLy: 0,
        heightLy: 0,
        angleRad: 0,
        peakDensity: 0,
      };
    }

    const lengthLy = diameterLy * rng.range(0.10, 0.22);
    const widthLy = lengthLy * rng.range(0.25, 0.40);
    const heightLy = widthLy * rng.range(0.30, 0.50);

    return {
      active: true,
      lengthLy,
      widthLy,
      heightLy,
      angleRad: rng.range(0, Math.PI),
      peakDensity: rng.range(0.6, 1.2),
    };
  }

  private generateDisk(
    rng: DeterministicRNG,
    morph: HubbleMorphology,
    diameterLy: number,
    thicknessLy: number,
  ): DiskParameters {
    const isElliptical = morph.startsWith('E');
    if (isElliptical) {
      return {
        hasDisk: false,
        radialScaleLy: 0,
        thinScaleHeightLy: 0,
        thickScaleHeightLy: 0,
        thickDiskFraction: 0,
        centralDensity: 0,
      };
    }

    const radialScaleLy = (diameterLy * 0.5) / rng.range(3.0, 4.5);
    const thinScaleHeightLy = thicknessLy * rng.range(0.20, 0.35);
    const thickScaleHeightLy = thinScaleHeightLy * rng.range(2.5, 3.8);

    return {
      hasDisk: true,
      radialScaleLy,
      thinScaleHeightLy,
      thickScaleHeightLy,
      thickDiskFraction: rng.range(0.05, 0.12),
      centralDensity: rng.range(0.8, 1.8),
    };
  }

  private generateSpiralArms(
    rng: DeterministicRNG,
    morph: HubbleMorphology,
    diameterLy: number,
    bar: BarParameters,
  ): SpiralArmParameters {
    const isSpiral = morph.startsWith('S') && morph !== 'S0';
    if (!isSpiral) {
      return {
        active: false,
        numArms: 0,
        pitchAngleRad: 0,
        amplitude: 0,
        angularWidthRad: 0,
        referenceRadiusLy: 0,
        initialPhasesRad: [],
      };
    }

    let numArms: number;
    let pitchDeg: number;

    if (morph === 'Sa' || morph === 'SBa') {
      numArms = rng.pick([2, 4]);
      pitchDeg = rng.range(8.0, 12.0); // Tightly wound
    } else if (morph === 'Sb' || morph === 'SBb') {
      numArms = rng.pick([2, 4]);
      pitchDeg = rng.range(12.0, 16.0); // Intermediate
    } else {
      numArms = rng.pick([2, 3, 4]);
      pitchDeg = rng.range(16.0, 24.0); // Open arms
    }

    const pitchAngleRad = degToRad(pitchDeg);
    const initialPhasesRad: number[] = [];

    if (bar.active) {
      // Arms emanate from opposite ends of the central bar
      initialPhasesRad.push(bar.angleRad);
      initialPhasesRad.push(wrapPi(bar.angleRad + Math.PI));
      if (numArms === 4) {
        initialPhasesRad.push(wrapPi(bar.angleRad + Math.PI / 2));
        initialPhasesRad.push(wrapPi(bar.angleRad - Math.PI / 2));
      }
    } else {
      const baseTheta = rng.range(0, 2 * Math.PI);
      for (let k = 0; k < numArms; k++) {
        initialPhasesRad.push(wrapPi(baseTheta + (2 * Math.PI * k) / numArms));
      }
    }

    return {
      active: true,
      numArms,
      pitchAngleRad,
      amplitude: rng.range(0.35, 0.70), // <= 0.75 guarantees minimum floor >= 0.25
      angularWidthRad: degToRad(rng.range(9.0, 14.0)),
      referenceRadiusLy: diameterLy * rng.range(0.08, 0.15),
      initialPhasesRad,
    };
  }

  private generateHalo(rng: DeterministicRNG, diameterLy: number): HaloParameters {
    return {
      coreRadiusLy: diameterLy * rng.range(0.15, 0.30),
      flattening: rng.range(0.70, 0.95),
      peakDensity: rng.range(0.0008, 0.0025),
      powerSlope: -3.5,
    };
  }

  private getCanonicalLocalGroupGalaxy(index: number): ProceduralGalaxyDescriptor | undefined {
    const cell: BigInt3 = { x: 0n, y: 0n, z: 0n };

    if (index === 0) {
      // Milky Way
      const def = LOCAL_GROUP_CATALOG.find((g) => g.id === 'milky_way')!;
      const seed = 0x4d49_4c4b_5957_4159n; // 'MILKYWAY'
      const diameterLy = def.diameterLy;
      const thicknessLy = def.thicknessLy;

      return {
        id: 'milky_way',
        name: 'Milky Way',
        seed,
        cell,
        indexInCell: 0,
        isKnownAstronomicalEntity: true,
        morphology: 'SBc',
        family: 'barred-spiral',
        diameterLy,
        thicknessLy,
        orientationEulerRad: [0, 0, 0],
        localCellMpc: [0, 0, 0],
        cosmologicalAddress: { cell, localMpc: [0, 0, 0] },
        estimatedStarCount: 250_000_000_000,
        totalMassSolar: 1.15e12,
        dominantSpectralClass: 'G',
        bulge: {
          effectiveRadiusLy: 3_914, // ~1.2 kpc
          peakDensity: 1.5,
          axisRatio: [1, 1, 0.625],
          coreRadiusLy: 100,
        },
        bar: {
          active: true,
          lengthLy: 9_784, // ~3.0 kpc
          widthLy: 4_892,  // ~1.5 kpc
          heightLy: 2_446,
          angleRad: degToRad(27), // ~27 degrees to Sol-Galactic Centre axis
          peakDensity: 0.8,
        },
        disk: {
          hasDisk: true,
          radialScaleLy: 8_480, // ~2.6 kpc
          thinScaleHeightLy: 978, // ~0.3 kpc
          thickScaleHeightLy: 2_935, // ~0.9 kpc
          thickDiskFraction: 0.05,
          centralDensity: 1.0,
        },
        spiralArms: {
          active: true,
          numArms: 4,
          pitchAngleRad: degToRad(12.5),
          amplitude: 0.40,
          angularWidthRad: degToRad(10.3),
          referenceRadiusLy: 8_500,
          initialPhasesRad: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
        },
        halo: {
          coreRadiusLy: 9_784, // ~3.0 kpc
          flattening: 0.85,
          peakDensity: 0.001,
          powerSlope: -3.5,
        },
        densityScale: 1.0,
        centralBlackHole: {
          id: 'sgra',
          massSolar: 4.15e6,
          schwarzschildRadiusM: 4.15e6 * SCHWARZSCHILD_RADIUS_PER_SOLAR_MASS_M,
        },
      };
    }

    if (index === 1) {
      // Andromeda (M31)
      const def = LOCAL_GROUP_CATALOG.find((g) => g.id === 'andromeda')!;
      const seed = 0x414e_4452_4f4d_4544n; // 'ANDROMED'
      const diameterLy = def.diameterLy;
      const thicknessLy = def.thicknessLy;

      return {
        id: 'andromeda',
        name: 'Andromeda',
        seed,
        cell,
        indexInCell: 1,
        isKnownAstronomicalEntity: true,
        morphology: 'Sb',
        family: 'spiral',
        diameterLy,
        thicknessLy,
        orientationEulerRad: (def.orientationEuler ?? [Math.PI / 4, Math.PI / 6, 0]) as Vec3,
        localCellMpc: [0, 0.767, 0], // ~2.5 Mly on Y axis (~0.767 Mpc)
        cosmologicalAddress: { cell, localMpc: [0, 0.767, 0] },
        estimatedStarCount: 1_000_000_000_000,
        totalMassSolar: 1.5e12,
        dominantSpectralClass: 'G',
        bulge: {
          effectiveRadiusLy: 4_892, // ~1.5 kpc
          peakDensity: 2.5,
          axisRatio: [1, 1, 0.71],
          coreRadiusLy: 150,
        },
        bar: {
          active: false,
          lengthLy: 0,
          widthLy: 0,
          heightLy: 0,
          angleRad: 0,
          peakDensity: 0,
        },
        disk: {
          hasDisk: true,
          radialScaleLy: 9_784, // ~3.0 kpc
          thinScaleHeightLy: 1_304, // ~0.4 kpc
          thickScaleHeightLy: 3_261, // ~1.0 kpc
          thickDiskFraction: 0.08,
          centralDensity: 1.2,
        },
        spiralArms: {
          active: true,
          numArms: 2,
          pitchAngleRad: degToRad(10.0),
          amplitude: 0.30,
          angularWidthRad: degToRad(11.5),
          referenceRadiusLy: 9_784,
          initialPhasesRad: [0, Math.PI],
        },
        halo: {
          coreRadiusLy: 13_045, // ~4.0 kpc
          flattening: 0.85,
          peakDensity: 0.002,
          powerSlope: -3.5,
        },
        densityScale: 1.5,
        centralBlackHole: {
          id: 'm31_smbh',
          massSolar: 1.0e8,
          schwarzschildRadiusM: 1.0e8 * SCHWARZSCHILD_RADIUS_PER_SOLAR_MASS_M,
        },
      };
    }

    if (index === 2) {
      // Triangulum Galaxy (M33)
      const seed = 0x5452_4941_4e47_554cn; // 'TRIANGUL'
      return {
        id: 'triangulum',
        name: 'Triangulum Galaxy',
        seed,
        cell,
        indexInCell: 2,
        isKnownAstronomicalEntity: true,
        morphology: 'Sc',
        family: 'spiral',
        diameterLy: 60_000,
        thicknessLy: 1_500,
        orientationEulerRad: [degToRad(54), degToRad(22), 0],
        localCellMpc: [-0.25, 0.80, 0.12], // ~2.73 Mly
        cosmologicalAddress: { cell, localMpc: [-0.25, 0.80, 0.12] },
        estimatedStarCount: 40_000_000_000,
        totalMassSolar: 5.0e10,
        dominantSpectralClass: 'F',
        bulge: {
          effectiveRadiusLy: 1_200,
          peakDensity: 0.8,
          axisRatio: [1, 1, 0.75],
          coreRadiusLy: 50,
        },
        bar: { active: false, lengthLy: 0, widthLy: 0, heightLy: 0, angleRad: 0, peakDensity: 0 },
        disk: {
          hasDisk: true,
          radialScaleLy: 5_500,
          thinScaleHeightLy: 600,
          thickScaleHeightLy: 1_800,
          thickDiskFraction: 0.06,
          centralDensity: 0.9,
        },
        spiralArms: {
          active: true,
          numArms: 2,
          pitchAngleRad: degToRad(18.0),
          amplitude: 0.45,
          angularWidthRad: degToRad(12.0),
          referenceRadiusLy: 5_500,
          initialPhasesRad: [degToRad(30), degToRad(210)],
        },
        halo: {
          coreRadiusLy: 6_000,
          flattening: 0.9,
          peakDensity: 0.0005,
          powerSlope: -3.5,
        },
        densityScale: 0.85,
        centralBlackHole: {
          id: 'm33_smbh',
          massSolar: 1.5e3, // Intermediate/low upper limit
          schwarzschildRadiusM: 1.5e3 * SCHWARZSCHILD_RADIUS_PER_SOLAR_MASS_M,
        },
      };
    }

    if (index === 3) {
      // Large Magellanic Cloud (LMC)
      const seed = 0x4c4d_435f_4741_4c41n;
      return {
        id: 'lmc',
        name: 'Large Magellanic Cloud',
        seed,
        cell,
        indexInCell: 3,
        isKnownAstronomicalEntity: true,
        morphology: 'Irr',
        family: 'irregular',
        diameterLy: 14_000,
        thicknessLy: 1_000,
        orientationEulerRad: [degToRad(35), 0, degToRad(12)],
        localCellMpc: [0.015, -0.045, -0.018], // ~163 kly (~0.05 Mpc)
        cosmologicalAddress: { cell, localMpc: [0.015, -0.045, -0.018] },
        estimatedStarCount: 30_000_000_000,
        totalMassSolar: 1.0e10,
        dominantSpectralClass: 'B', // Active starburst (Tarantula Nebula)
        bulge: {
          effectiveRadiusLy: 800,
          peakDensity: 0.4,
          axisRatio: [1, 1, 0.8],
          coreRadiusLy: 50,
        },
        bar: {
          active: true,
          lengthLy: 4_000,
          widthLy: 1_500,
          heightLy: 800,
          angleRad: degToRad(40),
          peakDensity: 0.5,
        },
        disk: {
          hasDisk: true,
          radialScaleLy: 3_000,
          thinScaleHeightLy: 500,
          thickScaleHeightLy: 1_200,
          thickDiskFraction: 0.05,
          centralDensity: 0.7,
        },
        spiralArms: {
          active: true,
          numArms: 1, // Single off-center spiral arm
          pitchAngleRad: degToRad(20.0),
          amplitude: 0.35,
          angularWidthRad: degToRad(15.0),
          referenceRadiusLy: 3_000,
          initialPhasesRad: [degToRad(40)],
        },
        halo: {
          coreRadiusLy: 4_000,
          flattening: 0.9,
          peakDensity: 0.0003,
          powerSlope: -3.5,
        },
        densityScale: 0.7,
      };
    }

    if (index === 4) {
      // Small Magellanic Cloud (SMC)
      const seed = 0x534d_435f_4741_4c41n;
      return {
        id: 'smc',
        name: 'Small Magellanic Cloud',
        seed,
        cell,
        indexInCell: 4,
        isKnownAstronomicalEntity: true,
        morphology: 'Irr',
        family: 'irregular',
        diameterLy: 7_000,
        thicknessLy: 800,
        orientationEulerRad: [degToRad(60), degToRad(15), 0],
        localCellMpc: [0.025, -0.055, -0.022], // ~204 kly
        cosmologicalAddress: { cell, localMpc: [0.025, -0.055, -0.022] },
        estimatedStarCount: 3_000_000_000,
        totalMassSolar: 6.5e9,
        dominantSpectralClass: 'A',
        bulge: {
          effectiveRadiusLy: 500,
          peakDensity: 0.3,
          axisRatio: [1, 1, 0.85],
          coreRadiusLy: 30,
        },
        bar: { active: false, lengthLy: 0, widthLy: 0, heightLy: 0, angleRad: 0, peakDensity: 0 },
        disk: {
          hasDisk: true,
          radialScaleLy: 1_800,
          thinScaleHeightLy: 400,
          thickScaleHeightLy: 900,
          thickDiskFraction: 0.05,
          centralDensity: 0.5,
        },
        spiralArms: {
          active: false,
          numArms: 0,
          pitchAngleRad: 0,
          amplitude: 0,
          angularWidthRad: 0,
          referenceRadiusLy: 0,
          initialPhasesRad: [],
        },
        halo: {
          coreRadiusLy: 2_500,
          flattening: 0.9,
          peakDensity: 0.0002,
          powerSlope: -3.5,
        },
        densityScale: 0.5,
      };
    }

    return undefined;
  }
}
