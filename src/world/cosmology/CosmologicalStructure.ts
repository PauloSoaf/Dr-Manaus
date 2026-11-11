/**
 * Cosmological Structure, Relativistic Observable Horizon, and Large-Scale Cosmic Web.
 *
 * Implements physical cosmology based on the Lambda-CDM model (Planck Collaboration consensus):
 * - Flat spatial geometry: Omega_k = 0.0.
 * - Hubble constant: H_0 = 67.4 km/s/Mpc.
 * - Matter density parameter: Omega_m = 0.315 (dark + baryonic matter).
 * - Dark energy density parameter: Omega_Lambda = 0.685 (cosmological constant).
 *
 * Fundamental Invariant:
 * The Observable Horizon is observer-relative (comoving radius ~14,200 Mpc / 46.5 billion ly).
 * It is NOT an impenetrable physical wall, nor does it establish an absolute center of the universe.
 * Every observer at any cosmological address perceives themselves at the center of their own
 * observable horizon, with the Cosmic Microwave Background (CMB) at z ~ 1090.
 */

import type { BigInt3, CosmologicalAddress } from '../spatial/UniverseAddress';
import type { Vec3 } from '../spatial/units';
import { COSMOLOGICAL_CELL_SIZE_MPC, MPC_LY, MPC_M } from '../galaxy/ProceduralGalaxyGenerator';
import { KNOWN_COSMIC_ANCHORS, OBSERVABLE_HORIZON_MPC, type CosmicAnchor } from '../celestial/CosmicAnchorCatalog';

export { KNOWN_COSMIC_ANCHORS, OBSERVABLE_HORIZON_MPC, type CosmicAnchor };

/** Speed of light in metres per second (exact SI definition). */
export const SPEED_OF_LIGHT = 299792458;

/** Hubble constant in km / (s * Mpc). */
export const HUBBLE_CONSTANT_KM_S_MPC = 67.4;

/** Matter density parameter (baryonic + cold dark matter). */
export const OMEGA_MATTER = 0.315;

/** Dark energy density parameter (cosmological constant Lambda). */
export const OMEGA_LAMBDA = 0.685;

/** Spatial curvature density parameter (flat universe). */
export const OMEGA_K = 0.0;

/** Redshift of the surface of last scattering (CMB radiation epoch). */
export const CMB_RECOMBINATION_REDSHIFT = 1089.9;

/** Temperature of the Cosmic Microwave Background at z = 0 (Kelvin). */
export const CMB_TEMPERATURE_K = 2.7255;

/** Age of the universe in Gigayears (13.787 Gyr). */
export const UNIVERSE_AGE_GYR = 13.787;

/**
 * Descriptive state of the observer-relative observable universe horizon.
 */
export interface ObservableHorizonDescriptor {
  readonly observerCell: BigInt3;
  readonly observerLocalMpc: Vec3;
  /** Comoving radius of the observable universe in megaparsecs (~14,200 Mpc). */
  readonly radiusMpc: number;
  /** Comoving radius in billions of light-years (~46.3 Bly). */
  readonly radiusBly: number;
  /** Comoving radius in absolute metres (~4.38e26 m). */
  readonly radiusM: number;
  /** CMB surface of last scattering redshift (z ~ 1090). */
  readonly cmbRedshift: number;
  /** Observed CMB blackbody temperature at redshift z (K). */
  readonly cmbTemperatureK: number;
  /** Invariant: the horizon is an optical observer-relative sphere, NOT a physical container wall. */
  readonly isPhysicalWall: false;
  /** Invariant: the universe possesses no absolute geometric center (Cosmological Principle). */
  readonly hasUniversalCenter: false;
  /** Horizon center in comoving local megaparsecs coincides exactly with the observer. */
  readonly horizonCenterLocalMpc: Vec3;
}

/**
 * Calculates the Hubble parameter H(z) at redshift z in km/s/Mpc according to the Friedmann equation.
 * H(z) = H_0 * sqrt(Omega_m * (1+z)^3 + Omega_Lambda + Omega_k * (1+z)^2).
 */
export function hubbleParameterH(z: number): number {
  if (z < 0) return HUBBLE_CONSTANT_KM_S_MPC;
  const onePlusZ = 1 + z;
  const term = OMEGA_MATTER * Math.pow(onePlusZ, 3) + OMEGA_LAMBDA;
  return HUBBLE_CONSTANT_KM_S_MPC * Math.sqrt(Math.max(0.001, term));
}

/**
 * Computes the lookback time in Gigayears (Gyr) for a given cosmological redshift z.
 * t_L = 1/H_0 * \int_0^z dz' / ((1+z') * E(z')).
 * Evaluated via logarithmic substitution u = ln(1+z') -> du = dz' / (1+z')
 * to smoothly integrate across cosmological epochs from z=0 to z ~ 1100.
 */
export function lookbackTimeGyr(z: number): number {
  if (z <= 0) return 0;
  const maxU = Math.log(1 + z);
  const steps = 256;
  let integral = 0;
  const du = maxU / steps;

  for (let i = 0; i < steps; i++) {
    const uMid = (i + 0.5) * du;
    const onePlusZ = Math.exp(uMid);
    const ez = Math.sqrt(OMEGA_MATTER * Math.pow(onePlusZ, 3) + OMEGA_LAMBDA);
    integral += (1 / ez) * du;
  }

  // 1 / H_0 in seconds
  const h0Sec = MPC_M / (HUBBLE_CONSTANT_KM_S_MPC * 1000);
  const gyrSeconds = 365.25 * 86400 * 1e9;
  return (integral * h0Sec) / gyrSeconds;
}

/**
 * Numerical integration of comoving distance in megaparsecs:
 * D_C(z) = (c / H_0) * \int_0^z dz' / E(z').
 */
export function comovingDistanceMpc(z: number): number {
  if (z <= 0) return 0;
  const cKmS = SPEED_OF_LIGHT / 1000;
  const maxU = Math.log(1 + z);
  const steps = 256;
  let integral = 0;
  const du = maxU / steps;

  for (let i = 0; i < steps; i++) {
    const uMid = (i + 0.5) * du;
    const onePlusZ = Math.exp(uMid);
    const ez = Math.sqrt(OMEGA_MATTER * Math.pow(onePlusZ, 3) + OMEGA_LAMBDA);
    integral += (onePlusZ / ez) * du;
  }

  return (cKmS / HUBBLE_CONSTANT_KM_S_MPC) * integral;
}

/**
 * Inverts the monotonic comoving distance relation D_C(z) to obtain cosmological redshift z.
 */
export function redshiftFromComovingDistanceMpc(distMpc: number): number {
  if (distMpc <= 0) return 0;
  if (distMpc >= OBSERVABLE_HORIZON_MPC) return CMB_RECOMBINATION_REDSHIFT;

  let lowZ = 0;
  let highZ = CMB_RECOMBINATION_REDSHIFT;

  // Binary search convergence
  for (let i = 0; i < 24; i++) {
    const midZ = (lowZ + highZ) * 0.5;
    const dMid = comovingDistanceMpc(midZ);
    if (dMid < distMpc) {
      lowZ = midZ;
    } else {
      highZ = midZ;
    }
  }

  return (lowZ + highZ) * 0.5;
}

/**
 * Evaluates the observer-relative observable universe horizon.
 * Guarantees that the horizon is always relative to the observer's comoving address.
 */
export function evaluateObservableHorizon(observer: CosmologicalAddress): ObservableHorizonDescriptor {
  const radiusMpc = OBSERVABLE_HORIZON_MPC;
  const radiusBly = (radiusMpc * MPC_LY) / 1e9;
  const radiusM = radiusMpc * MPC_M;

  return {
    observerCell: observer.cell,
    observerLocalMpc: observer.localMpc,
    radiusMpc,
    radiusBly,
    radiusM,
    cmbRedshift: CMB_RECOMBINATION_REDSHIFT,
    cmbTemperatureK: CMB_TEMPERATURE_K,
    isPhysicalWall: false,
    hasUniversalCenter: false,
    horizonCenterLocalMpc: [...observer.localMpc] as Vec3,
  };
}

/**
 * Calculates comoving separation distance in megaparsecs between two cosmological addresses,
 * using exact BigInt cell coordinates to avoid numerical overflow or mantissa loss.
 */
export function cosmologicalDistanceMpc(a: CosmologicalAddress, b: CosmologicalAddress): number {
  const dxCells = Number(b.cell.x - a.cell.x);
  const dyCells = Number(b.cell.y - a.cell.y);
  const dzCells = Number(b.cell.z - a.cell.z);

  const dxMpc = dxCells * COSMOLOGICAL_CELL_SIZE_MPC + (b.localMpc[0] - a.localMpc[0]);
  const dyMpc = dyCells * COSMOLOGICAL_CELL_SIZE_MPC + (b.localMpc[1] - a.localMpc[1]);
  const dzMpc = dzCells * COSMOLOGICAL_CELL_SIZE_MPC + (b.localMpc[2] - a.localMpc[2]);

  return Math.hypot(dxMpc, dyMpc, dzMpc);
}

/**
 * Evaluates the continuous cosmic filament density field connecting two major cosmic clusters.
 * Large-scale structure filaments follow cylindrical Gaussian profiles with a core radius ~ 1.5 Mpc.
 */
export function evaluateCosmicFilament(
  sampleMpc: Vec3,
  anchorA: CosmicAnchor,
  anchorB: CosmicAnchor,
  coreRadiusMpc: number = 1.5
): { distanceToSpineMpc: number; density01: number } {
  const ax = anchorA.positionMpc[0], ay = anchorA.positionMpc[1], az = anchorA.positionMpc[2];
  const bx = anchorB.positionMpc[0], by = anchorB.positionMpc[1], bz = anchorB.positionMpc[2];
  const px = sampleMpc[0], py = sampleMpc[1], pz = sampleMpc[2];

  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq < 1e-6) {
    const dist = Math.hypot(px - ax, py - ay, pz - az);
    return { distanceToSpineMpc: dist, density01: Math.exp(-0.5 * Math.pow(dist / coreRadiusMpc, 2)) };
  }

  // Projection scalar onto segment AB
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq));

  const projX = ax + t * abx;
  const projY = ay + t * aby;
  const projZ = az + t * abz;

  const distanceToSpineMpc = Math.hypot(px - projX, py - projY, pz - projZ);
  const density01 = Math.exp(-0.5 * Math.pow(distanceToSpineMpc / coreRadiusMpc, 2));

  return { distanceToSpineMpc, density01 };
}
