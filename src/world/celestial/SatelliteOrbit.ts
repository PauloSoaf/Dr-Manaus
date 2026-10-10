import type { OrbitalElements } from './EphemerisProvider';
import { degToRad, multiplyQuat, quatFromAxisAngle, type Quat } from '../spatial/units';

/** Offline mean ellipse; epoch is J2000 TDB. Not a navigation-grade ephemeris. */
export interface SatelliteOrbit {
  readonly elements: OrbitalElements;
  readonly periodS: number;
  readonly referenceToEcliptic: Quat;
  readonly synchronousRotation: boolean;
}

/** JPL mean elements in their published plane, SI internally. See docs/world/10-solar-system.md. */
export function satelliteOrbit(aKm: number, e: number, iDeg: number, nodeDeg: number,
  argumentDeg: number, meanAnomalyDeg: number, periodDays: number,
  pole?: readonly [raDeg: number, decDeg: number]): SatelliteOrbit {
  const periodS = periodDays * 86_400;
  const perihelion = degToRad(nodeDeg + argumentDeg);
  // +X is the ascending intersection with the J2000 equator. Convert equatorial to ecliptic.
  const plane = pole ? multiplyQuat(quatFromAxisAngle([1, 0, 0], degToRad(-23.4392911)),
    multiplyQuat(quatFromAxisAngle([0, 0, 1], degToRad(pole[0] + 90)),
      quatFromAxisAngle([1, 0, 0], degToRad(90 - pole[1])))) : [0, 0, 0, 1] as Quat;
  return { periodS, referenceToEcliptic: plane, synchronousRotation: true, elements: {
    semiMajorAxisM: aKm * 1000, eccentricity: e, inclinationRad: degToRad(iDeg),
    longitudeOfAscendingNodeRad: degToRad(nodeDeg), longitudeOfPerihelionRad: perihelion,
    meanLongitudeRad: perihelion + degToRad(meanAnomalyDeg),
    meanLongitudeRateRadPerCentury: 2 * Math.PI * 36_525 * 86_400 / periodS,
    semiMajorAxisRateMPerCentury: 0, eccentricityRatePerCentury: 0, inclinationRateRadPerCentury: 0,
    longitudeOfPerihelionRateRadPerCentury: 0, longitudeOfAscendingNodeRateRadPerCentury: 0,
  } };
}
