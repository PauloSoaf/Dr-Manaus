import { clampHalfPi, degToRad, finite, radToDeg, wrapPi } from './units';

/**
 * A position on or above the reference ellipsoid.
 *
 * Latitude and longitude are radians here rather than degrees. Degrees belong at the edges — in
 * datasets, in the landmark table, on the debug overlay — and radians belong in the arithmetic,
 * because every trigonometric call in the spatial core would otherwise convert on the way in.
 */
export interface GeodeticPosition {
  latRad: number;
  lonRad: number;
  heightM: number;
}

export function geodetic(latRad: number, lonRad: number, heightM = 0): GeodeticPosition {
  return { latRad, lonRad, heightM };
}

/** Builds a geodetic position from the degrees that datasets and landmark tables carry. */
export function geodeticFromDegrees(latDeg: number, lonDeg: number, heightM = 0): GeodeticPosition {
  return {
    latRad: clampHalfPi(degToRad(finite(latDeg))),
    lonRad: wrapPi(degToRad(finite(lonDeg))),
    heightM: finite(heightM),
  };
}

export function geodeticToDegrees(position: GeodeticPosition): { latDeg: number; lonDeg: number; heightM: number } {
  return {
    latDeg: radToDeg(position.latRad),
    lonDeg: radToDeg(position.lonRad),
    heightM: position.heightM,
  };
}

/** Puts a position back inside the canonical ranges without moving it on the ellipsoid. */
export function normalizeGeodetic(position: GeodeticPosition): GeodeticPosition {
  return {
    latRad: clampHalfPi(position.latRad),
    lonRad: wrapPi(position.lonRad),
    heightM: finite(position.heightM),
  };
}

export function isFiniteGeodetic(position: GeodeticPosition): boolean {
  return Number.isFinite(position.latRad)
    && Number.isFinite(position.lonRad)
    && Number.isFinite(position.heightM);
}

/**
 * Great-circle distance on a sphere of the given radius. An approximation on an ellipsoid, and
 * named so: it is for "how far is that landmark", not for navigation.
 */
export function haversineDistance(a: GeodeticPosition, b: GeodeticPosition, radiusM: number): number {
  const dLat = b.latRad - a.latRad;
  const dLon = wrapPi(b.lonRad - a.lonRad);
  const sinLat = Math.sin(dLat / 2), sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(a.latRad) * Math.cos(b.latRad) * sinLon * sinLon;
  return 2 * radiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}
