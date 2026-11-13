import { finite, type Vec3 } from './units';
import { WGS84, WGS84_B } from './WGS84';
import { ecefToGeodetic } from './ECEF';
import type { GeodeticPosition } from './Geodetic';

export interface EllipsoidIntersectionResult {
  readonly hit: boolean;
  readonly distanceM: number;
  readonly point: Vec3;
}

export interface SphereIntersectionResult {
  readonly hit: boolean;
  readonly distanceM: number;
  readonly point: Vec3;
}

export interface EarthWGS84IntersectionResult {
  readonly hit: boolean;
  readonly distanceM: number;
  readonly pointEcef: Vec3;
  readonly geodetic: GeodeticPosition;
}

/**
 * Analytically intersects a ray with a triaxial ellipsoid centered at the origin:
 *   (x/a)^2 + (y/b)^2 + (z/c)^2 = 1
 * 
 * Returns the closest forward intersection point (distanceM > 0), or null if no hit.
 */
export function intersectEllipsoidRay(
  origin: Vec3,
  direction: Vec3,
  semiAxes: Vec3,
  minDistanceM = 0.01,
): EllipsoidIntersectionResult | null {
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = direction;
  const [a, b, c] = semiAxes;

  if (a <= 0 || b <= 0 || c <= 0) return null;

  const dirLen = Math.hypot(dx, dy, dz);
  if (dirLen <= 1e-12 || !Number.isFinite(dirLen)) return null;

  // Normalized direction
  const ndx = dx / dirLen;
  const ndy = dy / dirLen;
  const ndz = dz / dirLen;

  // Transform ray to unit sphere space
  const sox = ox / a;
  const soy = oy / b;
  const soz = oz / c;

  const sdx = ndx / a;
  const sdy = ndy / b;
  const sdz = ndz / c;

  const A = sdx * sdx + sdy * sdy + sdz * sdz;
  const B = 2 * (sox * sdx + soy * sdy + soz * sdz);
  const C = sox * sox + soy * soy + soz * soz - 1;

  const discriminant = B * B - 4 * A * C;
  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-B - sqrtDisc) / (2 * A);
  const t2 = (-B + sqrtDisc) / (2 * A);

  let tHit = -1;
  // If outside or on surface (C >= 0), closest forward intersection is t1 if t1 > min, else t2 if t2 > min
  if (C >= 0) {
    if (t1 > minDistanceM) {
      tHit = t1;
    } else if (t2 > minDistanceM) {
      tHit = t2;
    }
  } else {
    // Inside the ellipsoid: forward exit point is t2
    if (t2 > minDistanceM) {
      tHit = t2;
    }
  }

  if (tHit <= 0 || !Number.isFinite(tHit)) return null;

  const px = ox + ndx * tHit;
  const py = oy + ndy * tHit;
  const pz = oz + ndz * tHit;

  return {
    hit: true,
    distanceM: tHit,
    point: [px, py, pz],
  };
}

/**
 * Analytically intersects a ray with a sphere.
 */
export function intersectSphereRay(
  origin: Vec3,
  direction: Vec3,
  center: Vec3,
  radiusM: number,
  minDistanceM = 0.01,
): SphereIntersectionResult | null {
  if (radiusM <= 0 || !Number.isFinite(radiusM)) return null;

  const dirLen = Math.hypot(direction[0], direction[1], direction[2]);
  if (dirLen <= 1e-12 || !Number.isFinite(dirLen)) return null;

  const ndx = direction[0] / dirLen;
  const ndy = direction[1] / dirLen;
  const ndz = direction[2] / dirLen;

  const vx = origin[0] - center[0];
  const vy = origin[1] - center[1];
  const vz = origin[2] - center[2];

  const bPrime = vx * ndx + vy * ndy + vz * ndz;
  const cPrime = (vx * vx + vy * vy + vz * vz) - radiusM * radiusM;

  const discriminant = bPrime * bPrime - cPrime;
  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = -bPrime - sqrtDisc;
  const t2 = -bPrime + sqrtDisc;

  let tHit = -1;
  if (cPrime >= 0) {
    if (t1 > minDistanceM) {
      tHit = t1;
    } else if (t2 > minDistanceM) {
      tHit = t2;
    }
  } else {
    if (t2 > minDistanceM) {
      tHit = t2;
    }
  }

  if (tHit <= 0 || !Number.isFinite(tHit)) return null;

  const px = origin[0] + ndx * tHit;
  const py = origin[1] + ndy * tHit;
  const pz = origin[2] + ndz * tHit;

  return {
    hit: true,
    distanceM: tHit,
    point: [px, py, pz],
  };
}

/**
 * Intersects a ray in Earth-Centered, Earth-Fixed (ECEF) coordinates with the WGS84 ellipsoid.
 * Returns the ECEF intersection point and its exact geodetic latitude, longitude, and ellipsoidal height.
 */
export function intersectEarthWGS84(
  ecefOrigin: Vec3,
  ecefDirection: Vec3,
  minDistanceM = 0.01,
): EarthWGS84IntersectionResult | null {
  const semiAxes: Vec3 = [WGS84.semiMajorAxisM, WGS84.semiMajorAxisM, WGS84_B];
  const result = intersectEllipsoidRay(ecefOrigin, ecefDirection, semiAxes, minDistanceM);
  if (!result) return null;

  const geodetic = ecefToGeodetic({
    xM: result.point[0],
    yM: result.point[1],
    zM: result.point[2],
  });

  return {
    hit: true,
    distanceM: result.distanceM,
    pointEcef: result.point,
    geodetic,
  };
}

/**
 * Intersects a ray with the Moon's spherical surface (mean radius 1,737,400 m).
 */
export const MOON_RADIUS_M = 1_737_400;

export function intersectMoonSurface(
  moonFixedOrigin: Vec3,
  moonFixedDirection: Vec3,
  minDistanceM = 0.01,
): SphereIntersectionResult | null {
  return intersectSphereRay(moonFixedOrigin, moonFixedDirection, [0, 0, 0], MOON_RADIUS_M, minDistanceM);
}

/**
 * Intersects a ray with Mars's spherical/ellipsoid surface (equatorial radius 3,396,200 m, polar 3,376,200 m).
 */
export const MARS_RADIUS_EQUATORIAL_M = 3_396_200;
export const MARS_RADIUS_POLAR_M = 3_376_200;

export function intersectMarsSurface(
  marsFixedOrigin: Vec3,
  marsFixedDirection: Vec3,
  minDistanceM = 0.01,
): EllipsoidIntersectionResult | null {
  const semiAxes: Vec3 = [MARS_RADIUS_EQUATORIAL_M, MARS_RADIUS_EQUATORIAL_M, MARS_RADIUS_POLAR_M];
  return intersectEllipsoidRay(marsFixedOrigin, marsFixedDirection, semiAxes, minDistanceM);
}

