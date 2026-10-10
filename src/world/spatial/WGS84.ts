/**
 * The WGS84 reference ellipsoid.
 *
 * These are the defining constants, not fitted ones: the semi-major axis and the inverse
 * flattening are exact by definition, and everything else here is derived from them. The spec
 * calls for `a = 6378137 m` and `1/f = 298.257223563`, which is what the standard defines.
 */

export const WGS84 = {
  /** Semi-major (equatorial) axis, metres. Defining constant. */
  semiMajorAxisM: 6_378_137.0,
  /** Inverse flattening. Defining constant. */
  inverseFlattening: 298.257_223_563,
} as const;

/** Flattening. */
export const WGS84_F = 1 / WGS84.inverseFlattening;
/** Semi-minor (polar) axis, metres. */
export const WGS84_B = WGS84.semiMajorAxisM * (1 - WGS84_F);
/** First eccentricity squared, `e² = f(2 - f)`. */
export const WGS84_E2 = WGS84_F * (2 - WGS84_F);
/** Second eccentricity squared, `e'² = e² / (1 - e²)`. Needed by the closed-form ECEF inverse. */
export const WGS84_EP2 = WGS84_E2 / (1 - WGS84_E2);

/**
 * Radius of curvature in the prime vertical at a latitude — the ellipsoid's east-west radius.
 *
 *   N(phi) = a / sqrt(1 - e² sin²(phi))
 */
export function primeVerticalRadius(latRad: number): number {
  const sinLat = Math.sin(latRad);
  return WGS84.semiMajorAxisM / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
}

/**
 * Radius of curvature in the meridian at a latitude — the ellipsoid's north-south radius.
 *
 *   M(phi) = a (1 - e²) / (1 - e² sin²(phi))^{3/2}
 *
 * This is the one that makes a flat "metres per degree of latitude" constant wrong: at the
 * equator M is about 110 574 m per degree, not the 111 320 a spherical approximation assumes.
 */
export function meridionalRadius(latRad: number): number {
  const sinLat = Math.sin(latRad);
  const w = 1 - WGS84_E2 * sinLat * sinLat;
  return (WGS84.semiMajorAxisM * (1 - WGS84_E2)) / (w * Math.sqrt(w));
}

/** Metres per radian of latitude at a latitude. */
export const metresPerRadianLatitude = (latRad: number): number => meridionalRadius(latRad);

/** Metres per radian of longitude at a latitude. */
export function metresPerRadianLongitude(latRad: number): number {
  return primeVerticalRadius(latRad) * Math.cos(latRad);
}

/**
 * Geocentric radius of the ellipsoid surface at a geodetic latitude. Used by the planet layers to
 * size a body without pretending it is a sphere.
 */
export function geocentricRadius(latRad: number): number {
  const cosLat = Math.cos(latRad), sinLat = Math.sin(latRad);
  const a = WGS84.semiMajorAxisM, b = WGS84_B;
  const numerator = (a * a * cosLat) ** 2 + (b * b * sinLat) ** 2;
  const denominator = (a * cosLat) ** 2 + (b * sinLat) ** 2;
  return Math.sqrt(numerator / denominator);
}
