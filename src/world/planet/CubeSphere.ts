import { normalizeVec3, type Vec3, wrapPi } from '../spatial/units';
import { geodetic, type GeodeticPosition } from '../spatial/Geodetic';

/**
 * The cube-sphere mapping the planet quadtree is built on.
 *
 * Six square faces, each subdivided as its own quadtree. Compared with a latitude/longitude grid
 * this covers the poles without a singularity there, spreads tiles far more evenly over the
 * surface, and owes nothing to Web Mercator — which matters, because the game must not inherit a
 * projection that cannot represent the poles at all.
 *
 * Faces are indexed by the axis they face:
 *
 *   0: +X   1: -X   2: +Y   3: -Y   4: +Z   5: -Z
 *
 * with +Z through the north pole and +X through the intersection of the equator and the prime
 * meridian, matching ECEF.
 */

export type CubeFace = 0 | 1 | 2 | 3 | 4 | 5;
export const CUBE_FACES: readonly CubeFace[] = [0, 1, 2, 3, 4, 5];

/** Human-readable names, for debug overlays and tile keys in a log. */
export const CUBE_FACE_NAMES: Readonly<Record<CubeFace, string>> = {
  0: '+X', 1: '-X', 2: '+Y', 3: '-Y', 4: '+Z', 5: '-Z',
};

/**
 * A point on a face, in face coordinates `u, v` each in [-1, 1], to a direction from the centre.
 *
 * The raw cube-to-sphere normalisation bunches tiles up at the face centres and stretches them at
 * the corners — nearly a factor of two in area. The tangent adjustment below evens that out, so a
 * tile at a given level covers roughly the same ground wherever it is. That is what makes a
 * single screen-space error threshold behave the same across the whole planet.
 */
export function faceUvToDirection(face: CubeFace, u: number, v: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const warp = Math.tan(Math.PI / 4);
  const a = Math.tan(u * (Math.PI / 4)) / warp;
  const b = Math.tan(v * (Math.PI / 4)) / warp;
  switch (face) {
    case 0: out[0] = 1; out[1] = a; out[2] = b; break;
    case 1: out[0] = -1; out[1] = -a; out[2] = b; break;
    case 2: out[0] = -a; out[1] = 1; out[2] = b; break;
    case 3: out[0] = a; out[1] = -1; out[2] = b; break;
    case 4: out[0] = -b; out[1] = a; out[2] = 1; break;
    case 5: out[0] = b; out[1] = a; out[2] = -1; break;
  }
  return normalizeVec3(out, out);
}

/** The inverse: which face a direction belongs to, and where on it. */
export function directionToFaceUv(direction: Vec3): { face: CubeFace; u: number; v: number } {
  const [x, y, z] = direction;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  const unwarp = (t: number): number => Math.atan(t * Math.tan(Math.PI / 4)) / (Math.PI / 4);

  let face: CubeFace, a: number, b: number;
  if (ax >= ay && ax >= az) {
    face = x >= 0 ? 0 : 1;
    a = (x >= 0 ? y : -y) / ax;
    b = z / ax;
  } else if (ay >= az) {
    face = y >= 0 ? 2 : 3;
    a = (y >= 0 ? -x : x) / ay;
    b = z / ay;
  } else {
    face = z >= 0 ? 4 : 5;
    a = y / az;
    b = (z >= 0 ? -x : x) / az;
  }
  return { face, u: unwarp(a), v: unwarp(b) };
}

/** A face direction as a geodetic position on the ellipsoid surface, at a given height. */
export function directionToGeodetic(direction: Vec3, heightM = 0): GeodeticPosition {
  const [x, y, z] = direction;
  const lon = Math.atan2(y, x);
  // Geocentric latitude from the direction, converted to geodetic on the ellipsoid. The two
  // differ by up to about 0.19 degrees, which is 21 km of ground — far too much to ignore.
  const p = Math.hypot(x, y);
  const geocentricLat = Math.atan2(z, p);
  return geodetic(geocentricToGeodeticLatitude(geocentricLat), wrapPi(lon), heightM);
}

/** Geocentric to geodetic latitude on the WGS84 ellipsoid: `tan(phi) = tan(psi) / (1 - e²)`. */
export function geocentricToGeodeticLatitude(geocentricLatRad: number): number {
  const e2 = 0.006_694_379_990_141_316;
  return Math.atan2(Math.tan(geocentricLatRad), 1 - e2);
}

/** And back, for placing a geodetic point onto the cube. */
export function geodeticToGeocentricLatitude(geodeticLatRad: number): number {
  const e2 = 0.006_694_379_990_141_316;
  return Math.atan2(Math.tan(geodeticLatRad) * (1 - e2), 1);
}

/** Where a geodetic position falls on the cube sphere. */
export function geodeticToFaceUv(position: GeodeticPosition): { face: CubeFace; u: number; v: number } {
  const lat = geodeticToGeocentricLatitude(position.latRad);
  const cosLat = Math.cos(lat);
  return directionToFaceUv([
    cosLat * Math.cos(position.lonRad),
    cosLat * Math.sin(position.lonRad),
    Math.sin(lat),
  ]);
}
