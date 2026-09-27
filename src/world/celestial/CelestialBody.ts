import { finite } from '../spatial/units';

/**
 * A body in the solar system, described by its physics rather than by how it will be drawn.
 *
 * Radii and distances are real. Nothing here is scaled for rendering convenience: the renderer is
 * handed an angular size and a domain, and the logical position stays honest the whole way out.
 */
export interface CelestialBody {
  readonly id: string;
  readonly name: string;
  /** The body this one orbits. Absent for the root, which is the Sun. */
  readonly parentId?: string;

  readonly equatorialRadiusM: number;
  readonly polarRadiusM?: number;
  readonly massKg?: number;

  readonly rotationPeriodS?: number;
  /** Obliquity of the rotation axis to the orbital plane, radians. */
  readonly axialTiltRad?: number;

  /** The reference frame this body's fixed frame is registered under. */
  readonly frameId: string;

  /**
   * Where this body is in its orbit, for bodies that were generated rather than measured.
   *
   * The real solar system does not use this: its positions come from published Keplerian elements
   * with secular rates, in `OfflineEphemeris`. A procedural system has no published anything, so
   * its generator writes the elements here at the moment it invents the body -- which is the only
   * moment they are known.
   *
   * Leaving them off and re-deriving them later is what this replaces, and it could not work: the
   * generator and the runtime were both replaying the same seeded stream but consuming different
   * numbers of values from it, so the orbit a planet was given and the orbit it was drawn in had
   * nothing to do with each other.
   */
  readonly orbit?: OrbitElements;
}

/**
 * A circular orbit, which is what a generated system needs and all it needs.
 *
 * Deliberately not the full Keplerian set. Eccentricity, inclination and precession are what make
 * the real planets interesting and are exactly what `OfflineEphemeris` exists to carry; inventing
 * them for a star nobody has visited would be detail without information. What matters here is
 * that the same seed puts the same planet in the same place forever.
 */
export interface OrbitElements {
  /** Orbital radius from the parent, metres. */
  readonly semiMajorAxisM: number;
  /** Angle at epoch zero, radians. */
  readonly phaseRad: number;
  /** Radians per second. Positive is counter-clockwise seen from the north of the orbital plane. */
  readonly angularRateRadS: number;
  /** Tilt of the orbital plane, radians. Small, so a system reads as a disc rather than a shell. */
  readonly inclinationRad: number;
}

/** Newton's constant, for turning a parent mass and a radius into an orbital rate. */
export const GRAVITATIONAL_CONSTANT_SI = 6.674_30e-11;

/**
 * The angular rate of a circular orbit of `radiusM` about `parentMassKg`.
 *
 * v = sqrt(GM/r), and the angular rate is v/r. Returns zero rather than infinity for a degenerate
 * radius, because a body at the centre of its parent should sit still, not divide by zero.
 */
export function circularOrbitRateRadS(radiusM: number, parentMassKg: number): number {
  const radius = finite(radiusM);
  const mass = finite(parentMassKg);
  if (!(radius > 0) || !(mass > 0)) return 0;
  return Math.sqrt((GRAVITATIONAL_CONSTANT_SI * mass) / radius) / radius;
}

const DEG = Math.PI / 180;

/**
 * The bodies the specification asks for, with published values.
 *
 * Radii are the IAU equatorial and polar values; masses are from the standard gravitational
 * parameters. Rotation periods are sidereal, and negative where the spin is retrograde — Venus
 * and Uranus genuinely turn the other way, and a sign is how that is recorded rather than a bug.
 */
export const SOLAR_SYSTEM_BODIES: readonly CelestialBody[] = [
  {
    id: 'sun', name: 'Sol', equatorialRadiusM: 695_700_000, polarRadiusM: 695_700_000,
    massKg: 1.988_5e30, rotationPeriodS: 2_192_832, axialTiltRad: 7.25 * DEG,
    frameId: 'solar-system/sun-fixed',
  },
  {
    id: 'mercury', name: 'Mercúrio', parentId: 'sun',
    equatorialRadiusM: 2_440_500, polarRadiusM: 2_438_300, massKg: 3.301e23,
    rotationPeriodS: 5_067_032, axialTiltRad: 0.034 * DEG, frameId: 'solar-system/mercury-fixed',
  },
  {
    id: 'venus', name: 'Vênus', parentId: 'sun',
    equatorialRadiusM: 6_051_800, polarRadiusM: 6_051_800, massKg: 4.867_5e24,
    rotationPeriodS: -20_996_798, axialTiltRad: 177.36 * DEG, frameId: 'solar-system/venus-fixed',
  },
  {
    id: 'earth', name: 'Terra', parentId: 'sun',
    equatorialRadiusM: 6_378_137, polarRadiusM: 6_356_752.314_245, massKg: 5.972_2e24,
    rotationPeriodS: 86_164.090_5, axialTiltRad: 23.439_3 * DEG, frameId: 'solar-system/earth-fixed',
  },
  {
    id: 'moon', name: 'Lua', parentId: 'earth',
    equatorialRadiusM: 1_738_100, polarRadiusM: 1_736_000, massKg: 7.346e22,
    rotationPeriodS: 2_360_591.5, axialTiltRad: 6.68 * DEG, frameId: 'solar-system/moon-fixed',
  },
  {
    id: 'mars', name: 'Marte', parentId: 'sun',
    equatorialRadiusM: 3_396_200, polarRadiusM: 3_376_200, massKg: 6.417_1e23,
    rotationPeriodS: 88_642.663, axialTiltRad: 25.19 * DEG, frameId: 'solar-system/mars-fixed',
  },
  {
    id: 'jupiter', name: 'Júpiter', parentId: 'sun',
    equatorialRadiusM: 71_492_000, polarRadiusM: 66_854_000, massKg: 1.898_2e27,
    rotationPeriodS: 35_730, axialTiltRad: 3.13 * DEG, frameId: 'solar-system/jupiter-fixed',
  },
  {
    id: 'saturn', name: 'Saturno', parentId: 'sun',
    equatorialRadiusM: 60_268_000, polarRadiusM: 54_364_000, massKg: 5.683_4e26,
    rotationPeriodS: 38_362, axialTiltRad: 26.73 * DEG, frameId: 'solar-system/saturn-fixed',
  },
  {
    id: 'uranus', name: 'Urano', parentId: 'sun',
    equatorialRadiusM: 25_559_000, polarRadiusM: 24_973_000, massKg: 8.681_0e25,
    rotationPeriodS: -62_064, axialTiltRad: 97.77 * DEG, frameId: 'solar-system/uranus-fixed',
  },
  {
    id: 'neptune', name: 'Netuno', parentId: 'sun',
    equatorialRadiusM: 24_764_000, polarRadiusM: 24_341_000, massKg: 4.813_4e25,
    rotationPeriodS: 57_996, axialTiltRad: 28.32 * DEG, frameId: 'solar-system/neptune-fixed',
  },
];

export const GRAVITATIONAL_CONSTANT = 6.674_30e-11;

export function bodyById(id: string): CelestialBody | undefined {
  return SOLAR_SYSTEM_BODIES.find(body => body.id === id);
}

export const meanRadiusM = (body: CelestialBody): number =>
  (2 * body.equatorialRadiusM + finite(body.polarRadiusM, body.equatorialRadiusM)) / 3;

export const flattening = (body: CelestialBody): number => {
  const polar = finite(body.polarRadiusM, body.equatorialRadiusM);
  return (body.equatorialRadiusM - polar) / body.equatorialRadiusM;
};

/** Standard gravitational parameter, m³/s². */
export const gravitationalParameter = (body: CelestialBody): number =>
  GRAVITATIONAL_CONSTANT * finite(body.massKg);

/** Surface gravity at the equator, m/s². */
export const surfaceGravityMps2 = (body: CelestialBody): number =>
  gravitationalParameter(body) / body.equatorialRadiusM ** 2;

/** Escape velocity from the surface, m/s. What "leaving" a body actually costs. */
export const escapeVelocityMps = (body: CelestialBody): number =>
  Math.sqrt(2 * gravitationalParameter(body) / body.equatorialRadiusM);

/**
 * The sphere of influence: how far out this body, rather than its parent, dominates gravity.
 * This is the radius at which the game hands control of the active frame from one body to the
 * next, so a ship near the Moon is in the Moon's frame and not in Earth's.
 */
export function sphereOfInfluenceM(body: CelestialBody, semiMajorAxisM: number, parentMassKg: number): number {
  const mass = finite(body.massKg);
  if (!(mass > 0) || !(parentMassKg > 0) || !(semiMajorAxisM > 0)) return 0;
  return semiMajorAxisM * (mass / parentMassKg) ** (2 / 5);
}
