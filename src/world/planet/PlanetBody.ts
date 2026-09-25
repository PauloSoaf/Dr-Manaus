import { geodeticToEcef, type EcefPosition } from '../spatial/ECEF';
import { geodetic, type GeodeticPosition } from '../spatial/Geodetic';
import { WGS84 } from '../spatial/WGS84';
import { finite, type Vec3 } from '../spatial/units';
import { directionToGeodetic } from './CubeSphere';

/**
 * A body with a surface, described physically rather than at whatever scale happens to render
 * conveniently. The specification is explicit that a sphere of radius 100 may exist as a distant
 * visual proxy and never as the model.
 */
export interface PlanetBody {
  readonly id: string;
  readonly semiMajorAxisM: number;
  readonly flattening: number;
  /** Sidereal rotation period, seconds. Negative for a retrograde spin. */
  readonly rotationPeriodS: number;
  /** The frame this body's fixed frame hangs from. */
  readonly parentFrame: string;
  /** Standard gravitational parameter, m³/s². Used by orbits and by surface gravity. */
  readonly gravitationalParameter?: number;
}

export const EARTH: PlanetBody = {
  id: 'earth',
  semiMajorAxisM: WGS84.semiMajorAxisM,
  flattening: 1 / WGS84.inverseFlattening,
  // One sidereal day: 23 h 56 m 4.0905 s.
  rotationPeriodS: 86_164.0905,
  parentFrame: 'solar-system/earth-inertial',
  gravitationalParameter: 3.986_004_418e14,
};

/**
 * The Moon, as a body rather than as a sprite. Very nearly spherical — its flattening is about
 * 1/1130 and its shape is dominated by real topography rather than by rotation.
 */
export const MOON: PlanetBody = {
  id: 'moon',
  semiMajorAxisM: 1_738_100,
  flattening: 1 / 1130,
  // Tidally locked: its rotation period is its orbital period.
  rotationPeriodS: 2_360_591.5,
  parentFrame: 'solar-system/earth-inertial',
  gravitationalParameter: 4.902_800e12,
};

export const polarRadiusM = (body: PlanetBody): number =>
  body.semiMajorAxisM * (1 - finite(body.flattening));

/** Mean radius, for the places where one number has to stand in for the shape. */
export const meanRadiusM = (body: PlanetBody): number =>
  (2 * body.semiMajorAxisM + polarRadiusM(body)) / 3;

/** Surface gravity at the equator, m/s². Zero when the body has no stated mass. */
export function surfaceGravityMps2(body: PlanetBody): number {
  if (!body.gravitationalParameter) return 0;
  return body.gravitationalParameter / body.semiMajorAxisM ** 2;
}

/** The body's own eccentricity squared, rather than assuming Earth's. */
export function eccentricitySquared(body: PlanetBody): number {
  const f = finite(body.flattening);
  return f * (2 - f);
}

/** Surface position for a direction from the centre, in the body's fixed frame. */
export function surfacePosition(body: PlanetBody, direction: Vec3, heightM = 0): EcefPosition {
  const position = directionToGeodetic(direction, heightM);
  return bodyGeodeticToFixed(body, position);
}

/**
 * Geodetic to body-fixed Cartesian. Identical in form to the WGS84 conversion, but parameterised
 * by the body, so the Moon does not silently inherit Earth's ellipsoid.
 */
export function bodyGeodeticToFixed(body: PlanetBody, position: GeodeticPosition): EcefPosition {
  if (body.id === 'earth') return geodeticToEcef(position);
  const e2 = eccentricitySquared(body);
  const sinLat = Math.sin(position.latRad), cosLat = Math.cos(position.latRad);
  const n = body.semiMajorAxisM / Math.sqrt(1 - e2 * sinLat * sinLat);
  const radial = (n + position.heightM) * cosLat;
  return {
    xM: radial * Math.cos(position.lonRad),
    yM: radial * Math.sin(position.lonRad),
    zM: ((1 - e2) * n + position.heightM) * sinLat,
  };
}

/**
 * The angular radius a body subtends from a distance, radians.
 *
 * This is what keeps a distant body honest: the Sun at one astronomical unit must not be a quad at
 * an arbitrary fixed distance, it must be whatever angle it genuinely occupies. Handing the
 * renderer this instead of a position is what lets the celestial domain stay small while the
 * logical distance stays real.
 */
export function angularRadiusRad(body: PlanetBody, distanceM: number): number {
  const distance = Math.max(1e-3, finite(distanceM));
  const radius = meanRadiusM(body);
  return distance <= radius ? Math.PI / 2 : Math.asin(radius / distance);
}

/**
 * Altitude above the body's ellipsoid for a point in its fixed frame.
 *
 * Radial rather than exactly normal to the surface, which differs by at most a few metres on
 * Earth and is what the altitude bands and the render-domain handoff actually need. Exact
 * geodetic height comes from `ecefToGeodetic`, at more cost.
 */
export function altitudeAboveSurfaceM(body: PlanetBody, fixed: EcefPosition): number {
  const distance = Math.hypot(fixed.xM, fixed.yM, fixed.zM);
  if (!(distance > 0)) return -meanRadiusM(body);
  // Geocentric radius of the ellipsoid in this direction: R = ab / sqrt(a² sin² + b² cos²).
  const a = body.semiMajorAxisM, b = polarRadiusM(body);
  const sinLat = fixed.zM / distance;
  const cosLat = Math.hypot(fixed.xM, fixed.yM) / distance;
  const surface = (a * b) / Math.sqrt((a * sinLat) ** 2 + (b * cosLat) ** 2);
  return distance - surface;
}

/** Where the body's surface is beneath a geodetic point, as a position in its fixed frame. */
export function groundBelow(body: PlanetBody, position: GeodeticPosition): EcefPosition {
  return bodyGeodeticToFixed(body, geodetic(position.latRad, position.lonRad, 0));
}
