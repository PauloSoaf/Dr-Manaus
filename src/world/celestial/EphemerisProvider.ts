import { AU_M, finite, type Vec3 } from '../spatial/units';

/** Where a body is and how fast it is going, in its parent's frame, at an instant. */
export interface EphemerisSample {
  /** Seconds since J2000 TDB. The game's clock, not a wall clock. */
  readonly epochS: number;
  readonly positionM: Vec3;
  readonly velocityMps: Vec3;
}

export interface EphemerisProvider {
  /** Must be deterministic and must never touch the network. */
  sample(bodyId: string, epochS: number): EphemerisSample | undefined;
}

/** Julian seconds in a Julian century, the unit the orbital element rates are quoted in. */
export const SECONDS_PER_JULIAN_CENTURY = 36_525 * 86_400;

/**
 * Classical Keplerian elements with linear rates, as JPL publishes them for approximate positions
 * of the major planets. Angles in radians, `a` in metres, rates per Julian century.
 */
export interface OrbitalElements {
  readonly semiMajorAxisM: number;
  readonly eccentricity: number;
  readonly inclinationRad: number;
  readonly meanLongitudeRad: number;
  readonly longitudeOfPerihelionRad: number;
  readonly longitudeOfAscendingNodeRad: number;

  readonly semiMajorAxisRateMPerCentury: number;
  readonly eccentricityRatePerCentury: number;
  readonly inclinationRateRadPerCentury: number;
  readonly meanLongitudeRateRadPerCentury: number;
  readonly longitudeOfPerihelionRateRadPerCentury: number;
  readonly longitudeOfAscendingNodeRateRadPerCentury: number;
}

const TWO_PI = Math.PI * 2;

/** Wraps an angle into [0, 2pi). */
function wrapTwoPi(rad: number): number {
  const wrapped = rad % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

/**
 * Solves Kepler's equation `M = E - e sin E` for the eccentric anomaly.
 *
 * Newton's method, seeded with the mean anomaly, which converges in a handful of iterations for
 * every eccentricity in the solar system. The iteration cap matters: a near-parabolic orbit would
 * otherwise spin here forever inside a frame.
 */
export function solveKepler(meanAnomalyRad: number, eccentricity: number, tolerance = 1e-12): number {
  const m = wrapTwoPi(finite(meanAnomalyRad));
  const e = Math.min(0.99, Math.max(0, finite(eccentricity)));
  let eccentric = e < 0.8 ? m : Math.PI;
  for (let i = 0; i < 64; i++) {
    const delta = (eccentric - e * Math.sin(eccentric) - m) / (1 - e * Math.cos(eccentric));
    eccentric -= delta;
    if (Math.abs(delta) < tolerance) break;
  }
  return eccentric;
}

/** The elements at an epoch, after the secular rates have been applied. */
export function elementsAt(elements: OrbitalElements, epochS: number): OrbitalElements {
  const centuries = finite(epochS) / SECONDS_PER_JULIAN_CENTURY;
  return {
    ...elements,
    semiMajorAxisM: elements.semiMajorAxisM + elements.semiMajorAxisRateMPerCentury * centuries,
    eccentricity: elements.eccentricity + elements.eccentricityRatePerCentury * centuries,
    inclinationRad: elements.inclinationRad + elements.inclinationRateRadPerCentury * centuries,
    meanLongitudeRad: elements.meanLongitudeRad + elements.meanLongitudeRateRadPerCentury * centuries,
    longitudeOfPerihelionRad:
      elements.longitudeOfPerihelionRad + elements.longitudeOfPerihelionRateRadPerCentury * centuries,
    longitudeOfAscendingNodeRad:
      elements.longitudeOfAscendingNodeRad + elements.longitudeOfAscendingNodeRateRadPerCentury * centuries,
  };
}

/**
 * Position from elements, in the parent's ecliptic frame, metres.
 *
 * The orbit is solved in its own plane and then rotated by the argument of perihelion, the
 * inclination and the longitude of the ascending node, in that order.
 */
export function positionFromElements(elements: OrbitalElements, epochS: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const now = elementsAt(elements, epochS);
  const argumentOfPerihelion = now.longitudeOfPerihelionRad - now.longitudeOfAscendingNodeRad;
  const meanAnomaly = now.meanLongitudeRad - now.longitudeOfPerihelionRad;
  const eccentric = solveKepler(meanAnomaly, now.eccentricity);

  // In the orbital plane, with the perihelion on +x.
  const cosE = Math.cos(eccentric), sinE = Math.sin(eccentric);
  const xOrbital = now.semiMajorAxisM * (cosE - now.eccentricity);
  const yOrbital = now.semiMajorAxisM * Math.sqrt(Math.max(0, 1 - now.eccentricity ** 2)) * sinE;

  const cosArg = Math.cos(argumentOfPerihelion), sinArg = Math.sin(argumentOfPerihelion);
  const cosNode = Math.cos(now.longitudeOfAscendingNodeRad), sinNode = Math.sin(now.longitudeOfAscendingNodeRad);
  const cosInc = Math.cos(now.inclinationRad), sinInc = Math.sin(now.inclinationRad);

  out[0] = (cosArg * cosNode - sinArg * sinNode * cosInc) * xOrbital
    + (-sinArg * cosNode - cosArg * sinNode * cosInc) * yOrbital;
  out[1] = (cosArg * sinNode + sinArg * cosNode * cosInc) * xOrbital
    + (-sinArg * sinNode + cosArg * cosNode * cosInc) * yOrbital;
  out[2] = sinArg * sinInc * xOrbital + cosArg * sinInc * yOrbital;
  return out;
}

/**
 * Velocity by central difference.
 *
 * The analytic derivative exists, but the elements themselves drift with time and differencing
 * the same function that produces position guarantees the two agree. The step is a minute, which
 * is small against every orbital period here and large enough not to lose precision.
 */
export function velocityFromElements(elements: OrbitalElements, epochS: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const step = 60;
  const before = positionFromElements(elements, epochS - step, [0, 0, 0]);
  const after = positionFromElements(elements, epochS + step, [0, 0, 0]);
  out[0] = (after[0] - before[0]) / (2 * step);
  out[1] = (after[1] - before[1]) / (2 * step);
  out[2] = (after[2] - before[2]) / (2 * step);
  return out;
}

/** Orbital period from the semi-major axis and the parent's gravitational parameter, seconds. */
export function orbitalPeriodS(semiMajorAxisM: number, parentMuM3S2: number): number {
  if (!(semiMajorAxisM > 0) || !(parentMuM3S2 > 0)) return 0;
  return TWO_PI * Math.sqrt(semiMajorAxisM ** 3 / parentMuM3S2);
}

/** Convenience for reading the element tables, which are published in astronomical units. */
export const auToM = (au: number): number => finite(au) * AU_M;
