import { geodetic, type GeodeticPosition } from './Geodetic';
import { primeVerticalRadius, WGS84, WGS84_B, WGS84_E2, WGS84_EP2 } from './WGS84';
import { finite, type Vec3, wrapPi } from './units';

/**
 * Earth-Centred, Earth-Fixed coordinates: metres from the centre of mass, with +Z through the
 * pole, +X through the intersection of the equator and the prime meridian, and +Y completing the
 * right-handed set. This is the frame everything on the planet ultimately hangs from.
 */
export interface EcefPosition {
  xM: number;
  yM: number;
  zM: number;
}

export const ecef = (xM: number, yM: number, zM: number): EcefPosition => ({ xM, yM, zM });
export const ecefToVec3 = (p: EcefPosition): Vec3 => [p.xM, p.yM, p.zM];
export const vec3ToEcef = (v: Vec3): EcefPosition => ({ xM: v[0], yM: v[1], zM: v[2] });

/**
 * Geodetic to ECEF. Exact, closed form:
 *
 *   N = a / sqrt(1 - e² sin²(phi))
 *   X = (N + h) cos(phi) cos(lambda)
 *   Y = (N + h) cos(phi) sin(lambda)
 *   Z = ((1 - e²) N + h) sin(phi)
 */
export function geodeticToEcef(position: GeodeticPosition): EcefPosition {
  const lat = finite(position.latRad), lon = finite(position.lonRad), h = finite(position.heightM);
  const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
  const n = primeVerticalRadius(lat);
  const radial = (n + h) * cosLat;
  return {
    xM: radial * Math.cos(lon),
    yM: radial * Math.sin(lon),
    zM: ((1 - WGS84_E2) * n + h) * sinLat,
  };
}

/** Iterations of the latitude fixpoint. Two already converge below a micrometre at any altitude. */
const INVERSE_ITERATIONS = 4;

/**
 * ECEF to geodetic.
 *
 * There is no elementary closed form for the inverse, so this uses Bowring's parametric-latitude
 * estimate as a seed and then iterates the exact relation
 *
 *   tan(phi) = z / (p (1 - e² N / (N + h)))
 *
 * to convergence. Bowring alone is sub-millimetre for terrestrial heights but degrades far from
 * the surface, and this game flies to orbit and beyond, so the iteration earns its keep.
 */
export function ecefToGeodetic(position: EcefPosition): GeodeticPosition {
  const x = finite(position.xM), y = finite(position.yM), z = finite(position.zM);
  const p = Math.hypot(x, y);
  const lon = p > 0 || x !== 0 || y !== 0 ? Math.atan2(y, x) : 0;

  // On the spin axis the longitude is undefined and the latitude is a pole; solving for it with
  // the general formula divides by a vanishing `p`.
  if (p < 1e-9) {
    const sign = z >= 0 ? 1 : -1;
    return geodetic(sign * (Math.PI / 2), wrapPi(lon), Math.abs(z) - WGS84_B);
  }

  const a = WGS84.semiMajorAxisM;
  // Bowring's seed, via the parametric latitude.
  const theta = Math.atan2(z * a, p * WGS84_B);
  const sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
  let lat = Math.atan2(
    z + WGS84_EP2 * WGS84_B * sinTheta * sinTheta * sinTheta,
    p - WGS84_E2 * a * cosTheta * cosTheta * cosTheta,
  );

  let height = 0;
  for (let i = 0; i < INVERSE_ITERATIONS; i++) {
    const sinLat = Math.sin(lat);
    const n = primeVerticalRadius(lat);
    // Near the poles `cos(lat)` collapses, so height comes off the Z component there instead.
    height = Math.abs(sinLat) > 0.5
      ? z / sinLat - (1 - WGS84_E2) * n
      : p / Math.cos(lat) - n;
    lat = Math.atan2(z, p * (1 - (WGS84_E2 * n) / (n + height)));
  }

  return geodetic(lat, wrapPi(lon), height);
}

/** Straight-line distance through the body between two ECEF points, metres. */
export function ecefDistance(a: EcefPosition, b: EcefPosition): number {
  return Math.hypot(a.xM - b.xM, a.yM - b.yM, a.zM - b.zM);
}

export function isFiniteEcef(position: EcefPosition): boolean {
  return Number.isFinite(position.xM) && Number.isFinite(position.yM) && Number.isFinite(position.zM);
}
