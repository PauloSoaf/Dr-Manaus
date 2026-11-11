import type { SectorIndex } from '../spatial/UniverseAddress';

/**
 * Universal Physical Constants (SI Units)
 */
export const GRAVITATIONAL_CONSTANT = 6.67430e-11; // m^3 kg^-1 s^-2 (CODATA 2018)
export const SPEED_OF_LIGHT = 299792458; // m s^-1 (Exact SI definition)
export const SOLAR_MASS_KG = 1.98847e30; // kg (IAU nominal)
export const ASTRONOMICAL_UNIT_M = 149597870700; // m (IAU definition)

/**
 * Accretion disk physical and thermal parameters.
 */
export interface BlackHoleAccretionProfile {
  readonly innerRadiusM: number;
  readonly outerRadiusM: number;
  readonly peakTemperatureK: number;
  readonly luminosityW: number;
}

/**
 * Relativistic and astrophysical specification of a black hole.
 */
export interface BlackHoleDescriptor {
  readonly id: string;
  readonly name: string;
  readonly massKg: number;
  readonly massSolar: number;
  readonly spin01: number; // Dimensionless Kerr parameter a* = Jc / (GM^2) in [0, 0.998]
  readonly schwarzschildRadiusM: number; // r_s = 2GM / c^2
  readonly eventHorizonRadiusM: number; // r_+ = (GM/c^2) * (1 + sqrt(1 - a*^2))
  readonly photonSphereRadiusM: number; // Equatorial prograde photon orbit
  readonly iscoRadiusM: number; // Innermost Stable Circular Orbit
  readonly shadowRadiusM: number; // Apparent lensed optical shadow radius
  readonly positionM: [number, number, number];
  readonly galaxyId: string;
  readonly isCanonical: boolean;
  readonly accretion?: BlackHoleAccretionProfile;
}

/**
 * Schwarzschild radius for non-rotating black hole: r_s = 2GM / c^2.
 */
export function schwarzschildRadiusM(massKg: number): number {
  if (massKg <= 0 || !Number.isFinite(massKg)) return 0;
  return (2 * GRAVITATIONAL_CONSTANT * massKg) / (SPEED_OF_LIGHT * SPEED_OF_LIGHT);
}

/**
 * Kerr outer event horizon radius: r_+ = (GM / c^2) * (1 + sqrt(1 - a_*^2)).
 * Clamped to Thorne limit a_* <= 0.998.
 */
export function kerrHorizonRadiusM(massKg: number, spin01: number = 0): number {
  if (massKg <= 0 || !Number.isFinite(massKg)) return 0;
  const aStar = Math.min(Math.max(spin01, 0), 0.998);
  const gm_c2 = (GRAVITATIONAL_CONSTANT * massKg) / (SPEED_OF_LIGHT * SPEED_OF_LIGHT);
  return gm_c2 * (1 + Math.sqrt(Math.max(0, 1 - aStar * aStar)));
}

/**
 * Equatorial circular prograde photon orbit radius:
 * r_ph = 2 * (GM / c^2) * (1 + cos((2/3) * arccos(-a*)))
 * For Schwarzschild (a* = 0), r_ph = 1.5 * r_s = 3 * GM / c^2.
 */
export function photonSphereRadiusM(massKg: number, spin01: number = 0): number {
  if (massKg <= 0 || !Number.isFinite(massKg)) return 0;
  const aStar = Math.min(Math.max(spin01, 0), 0.998);
  const gm_c2 = (GRAVITATIONAL_CONSTANT * massKg) / (SPEED_OF_LIGHT * SPEED_OF_LIGHT);
  const angle = (2 / 3) * Math.acos(-aStar);
  return 2 * gm_c2 * (1 + Math.cos(angle));
}

/**
 * Innermost Stable Circular Orbit (ISCO) for prograde equatorial accretion:
 * Bardeen, Press & Teukolsky (1972).
 * For Schwarzschild (a* = 0), r_isco = 3 * r_s = 6 * GM / c^2.
 */
export function iscoRadiusM(massKg: number, spin01: number = 0): number {
  if (massKg <= 0 || !Number.isFinite(massKg)) return 0;
  const aStar = Math.min(Math.max(spin01, 0), 0.998);
  const gm_c2 = (GRAVITATIONAL_CONSTANT * massKg) / (SPEED_OF_LIGHT * SPEED_OF_LIGHT);
  
  if (aStar < 1e-4) {
    return 6 * gm_c2;
  }
  
  const z1 = 1 + Math.cbrt(1 - aStar * aStar) * (Math.cbrt(1 + aStar) + Math.cbrt(1 - aStar));
  const z2 = Math.sqrt(3 * aStar * aStar + z1 * z1);
  const term = Math.sqrt(Math.max(0, (3 - z1) * (3 + z1 + 2 * z2)));
  return gm_c2 * (3 + z2 - term);
}

/**
 * Apparent optical shadow radius under gravitational lensing magnification:
 * For Schwarzschild, R_shadow = (sqrt(27) / 2) * r_s ~= 2.598076 * r_s.
 */
export function blackHoleShadowRadiusM(massKg: number, spin01: number = 0): number {
  const rs = schwarzschildRadiusM(massKg);
  const aStar = Math.min(Math.max(spin01, 0), 0.998);
  // Relativistic gravitational lens shadow magnification factor
  const baseFactor = Math.sqrt(27) / 2; // ~2.598
  const spinCorrection = 1 - 0.12 * aStar * aStar;
  return rs * baseFactor * spinCorrection;
}

/**
 * Eddington luminosity: L_edd ~= 1.26e31 * (M / M_sun) Watts.
 */
export function eddingtonLuminosityW(massKg: number): number {
  if (massKg <= 0) return 0;
  const solarMasses = massKg / SOLAR_MASS_KG;
  return 1.26e31 * solarMasses;
}

/**
 * Constructor helper for a complete BlackHoleDescriptor.
 */
export function createBlackHoleDescriptor(options: {
  id: string;
  name: string;
  massKg: number;
  spin01?: number;
  positionM?: [number, number, number];
  galaxyId?: string;
  isCanonical?: boolean;
  accretion?: {
    innerRadiusRs?: number;
    outerRadiusRs?: number;
    temperatureK?: number;
    luminosityW?: number;
  };
}): BlackHoleDescriptor {
  const spin01 = Math.min(Math.max(options.spin01 ?? 0, 0), 0.998);
  const rs = schwarzschildRadiusM(options.massKg);
  const rHorizon = kerrHorizonRadiusM(options.massKg, spin01);
  const rPhoton = photonSphereRadiusM(options.massKg, spin01);
  const rIsco = iscoRadiusM(options.massKg, spin01);
  const rShadow = blackHoleShadowRadiusM(options.massKg, spin01);

  let accretion: BlackHoleAccretionProfile | undefined;
  if (options.accretion) {
    const inner = (options.accretion.innerRadiusRs ?? (rIsco / rs)) * rs;
    const outer = (options.accretion.outerRadiusRs ?? 15) * rs;
    accretion = {
      innerRadiusM: Math.max(inner, rHorizon),
      outerRadiusM: Math.max(outer, inner * 1.5),
      peakTemperatureK: options.accretion.temperatureK ?? 1e6,
      luminosityW: options.accretion.luminosityW ?? eddingtonLuminosityW(options.massKg) * 0.1,
    };
  }

  return {
    id: options.id,
    name: options.name,
    massKg: options.massKg,
    massSolar: options.massKg / SOLAR_MASS_KG,
    spin01,
    schwarzschildRadiusM: rs,
    eventHorizonRadiusM: rHorizon,
    photonSphereRadiusM: rPhoton,
    iscoRadiusM: rIsco,
    shadowRadiusM: rShadow,
    positionM: options.positionM ?? [0, 0, 0],
    galaxyId: options.galaxyId ?? 'milky_way',
    isCanonical: options.isCanonical ?? false,
    accretion,
  };
}

/**
 * Canonical Sagittarius A* Supermassive Black Hole at the Galactic Centre.
 * Mass: 4.297 million solar masses (GRAVITY Collaboration 2022).
 * Spin: ~0.90 (Event Horizon Telescope 2024 / Kerr model).
 */
export const SAGITTARIUS_A_STAR: BlackHoleDescriptor = createBlackHoleDescriptor({
  id: 'sgra',
  name: 'Sagittarius A*',
  massKg: 4.297e6 * SOLAR_MASS_KG, // ~8.544e36 kg
  spin01: 0.90,
  positionM: [0, 0, 0],
  galaxyId: 'milky_way',
  isCanonical: true,
  accretion: {
    innerRadiusRs: 2.2, // Inside prograde ISCO
    outerRadiusRs: 12.0,
    temperatureK: 1.2e6,
    luminosityW: 1.0e36,
  },
});

/**
 * Canonical Andromeda Galaxy (M31*) Central Supermassive Black Hole.
 * Mass: ~1.4e8 solar masses (Bender et al. 2005).
 * Spin: ~0.80.
 */
export const M31_CENTRAL_BLACK_HOLE: BlackHoleDescriptor = createBlackHoleDescriptor({
  id: 'm31_smbh',
  name: 'Andromeda Central SMBH (M31*)',
  massKg: 1.4e8 * SOLAR_MASS_KG, // ~2.78e38 kg
  spin01: 0.80,
  positionM: [0, 2.365e22, 0],
  galaxyId: 'andromeda',
  isCanonical: true,
  accretion: {
    innerRadiusRs: 2.5,
    outerRadiusRs: 20.0,
    temperatureK: 2.5e6,
    luminosityW: 1.0e38,
  },
});

/**
 * Canonical black hole registry.
 */
export const CANONICAL_BLACK_HOLES: readonly BlackHoleDescriptor[] = [
  SAGITTARIUS_A_STAR,
  M31_CENTRAL_BLACK_HOLE,
];

/**
 * Fast lookup for canonical black holes by ID or alternative name.
 */
export function getCanonicalBlackHole(id: string): BlackHoleDescriptor | undefined {
  if (id === 'sgra' || id === 'sagittarius-a-star' || id === 'sagittarius_a_star') {
    return SAGITTARIUS_A_STAR;
  }
  if (id === 'm31_smbh' || id === 'm31' || id === 'andromeda_smbh') {
    return M31_CENTRAL_BLACK_HOLE;
  }
  return undefined;
}

/**
 * Deterministic integer hash for procedural stellar-mass black hole placement.
 */
function hashSectorInt(galaxyId: string, sector: SectorIndex, offset: number): number {
  let h = 0x811c9dc5;
  const s = `${galaxyId}:${sector.x},${sector.y},${sector.z}:${offset}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic generator for rare stellar-mass black holes in galactic sectors.
 * Approximately 1 in 80 sectors hosts a detected stellar remnant (mass between 5 and 35 solar masses).
 */
export function generateStellarBlackHole(galaxyId: string, sector: SectorIndex): BlackHoleDescriptor | undefined {
  const presenceHash = hashSectorInt(galaxyId, sector, 77);
  // ~1.25% probability per sector
  if ((presenceHash % 80) !== 0) {
    return undefined;
  }

  const massHash = hashSectorInt(galaxyId, sector, 101);
  const spinHash = hashSectorInt(galaxyId, sector, 203);
  const posHashX = hashSectorInt(galaxyId, sector, 307);
  const posHashY = hashSectorInt(galaxyId, sector, 409);
  const posHashZ = hashSectorInt(galaxyId, sector, 521);

  // Stellar mass: 5.0 to 35.0 Solar Masses
  const massSolar = 5.0 + (massHash % 3000) / 100.0;
  const massKg = massSolar * SOLAR_MASS_KG;
  const spin01 = (spinHash % 950) / 1000.0; // 0.0 to 0.95

  // Local offset within sector (+- 40 light years)
  const LY_M = 9.46073e15;
  const posX = ((posHashX % 800) - 400) * 0.1 * LY_M;
  const posY = ((posHashY % 800) - 400) * 0.1 * LY_M;
  const posZ = ((posHashZ % 800) - 400) * 0.1 * LY_M;

  const id = `sbh_${galaxyId}_${sector.x}_${sector.y}_${sector.z}`;
  const name = `Stellar Black Hole ${sector.x},${sector.y},${sector.z}`;

  return createBlackHoleDescriptor({
    id,
    name,
    massKg,
    spin01,
    positionM: [posX, posY, posZ],
    galaxyId,
    isCanonical: false,
    accretion: {
      innerRadiusRs: 3.0,
      outerRadiusRs: 25.0,
      temperatureK: 8.0e6, // Stellar mass BH accretion disks are much hotter (X-ray bright)
      luminosityW: eddingtonLuminosityW(massKg) * 0.05,
    },
  });
}

