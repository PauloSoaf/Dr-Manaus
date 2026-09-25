import { ecefToGeodetic, geodeticToEcef, type EcefPosition } from './ECEF';
import { ecefToEnu, enuBasis, type EnuBasis, enuToEcef } from './ENU';
import { geodetic, geodeticFromDegrees, type GeodeticPosition } from './Geodetic';
import { meridionalRadius, metresPerRadianLongitude } from './WGS84';
import { clampHalfPi, DEG_TO_RAD, degToRad, finite, radToDeg, type Vec3, wrapPi } from './units';

/**
 * Ties the existing Manaus world to the planet without moving a single building.
 *
 * The city's 645 compiled tiles, its road network, its landmask and its landmarks were all
 * projected with one flat approximation:
 *
 *   x = (lon - originLon) * 111320 * cos(originLat)
 *   z = (originLat - lat) * 111320
 *
 * That is an equirectangular projection on a sphere of fixed scale, and it is *not* the true
 * tangent plane on the WGS84 ellipsoid. Keeping it is a deliberate decision, not an oversight:
 * every compiled asset in the game is expressed in it, and the specification is explicit that
 * `GEO_ORIGIN` must keep producing exactly the same local positions during compatibility.
 *
 * So this adapter holds both truths at once and is honest about the gap between them:
 *
 *   - `legacy*` methods reproduce the historical projection bit for bit. They are what the city
 *     is built in, and what `latLonToWorld` keeps answering.
 *   - `true*` methods use WGS84 geodetic/ECEF/ENU properly. They are what the planet is built in.
 *   - {@link LEGACY_NORTH_SCALE} states, as a number, how far apart the two drift.
 *
 * The anchor is the same in both, so the two agree exactly at the Largo and diverge slowly with
 * distance. Everything outside the compiled city should use the true path.
 */

/** The Monumento à Abertura dos Portos, at the centre of the Largo de São Sebastião. */
export const MANAUS_ANCHOR = {
  latDeg: -3.130333,
  lonDeg: -60.022528,
  heightM: 0,
} as const;

/** Metres per degree the legacy projection assumes, on both axes, before the cosine. */
export const LEGACY_METRES_PER_DEGREE = 111_320;

export const MANAUS_FRAME_ID = 'earth/manaus/legacy-enu';
export const EARTH_FIXED_FRAME_ID = 'earth/fixed';

const ANCHOR_GEODETIC: GeodeticPosition = geodeticFromDegrees(
  MANAUS_ANCHOR.latDeg, MANAUS_ANCHOR.lonDeg, MANAUS_ANCHOR.heightM,
);
const ANCHOR_BASIS: EnuBasis = enuBasis(ANCHOR_GEODETIC);
const LEGACY_LONGITUDE_SCALE = LEGACY_METRES_PER_DEGREE * Math.cos(degToRad(MANAUS_ANCHOR.latDeg));

/**
 * How much the legacy north axis is stretched relative to the ellipsoid, at the anchor.
 *
 * The meridional radius of curvature at Manaus gives about 110 574 m per degree of latitude; the
 * legacy projection uses 111 320. The ratio is roughly 1.0067, so a point 20 km north in legacy
 * metres is about 135 m short of 20 km of real ground. That error is why the compiled data cannot
 * simply be reinterpreted as true ENU, and why this adapter keeps the two paths separate.
 */
export const LEGACY_NORTH_SCALE =
  LEGACY_METRES_PER_DEGREE / (meridionalRadius(ANCHOR_GEODETIC.latRad) * DEG_TO_RAD);

/** The same ratio on the east axis, which is far closer to one. */
export const LEGACY_EAST_SCALE =
  LEGACY_LONGITUDE_SCALE / (metresPerRadianLongitude(ANCHOR_GEODETIC.latRad) * DEG_TO_RAD);

export const MANAUS_ANCHOR_GEODETIC: GeodeticPosition = ANCHOR_GEODETIC;
export const MANAUS_ANCHOR_ECEF: EcefPosition = ANCHOR_BASIS.anchorEcef;

/** The legacy local position of a geographic point. Identical to the historic `latLonToWorld`. */
export function geoToLegacyLocal(latDeg: number, lonDeg: number): { x: number; z: number } {
  return {
    x: (finite(lonDeg) - MANAUS_ANCHOR.lonDeg) * LEGACY_LONGITUDE_SCALE,
    z: (MANAUS_ANCHOR.latDeg - finite(latDeg)) * LEGACY_METRES_PER_DEGREE,
  };
}

/** The inverse. Identical to the historic `worldToLatLon`. */
export function legacyLocalToGeo(x: number, z: number): { lat: number; lon: number } {
  return {
    lat: MANAUS_ANCHOR.latDeg - finite(z) / LEGACY_METRES_PER_DEGREE,
    lon: MANAUS_ANCHOR.lonDeg + finite(x) / LEGACY_LONGITUDE_SCALE,
  };
}

/**
 * Legacy local metres to a geodetic position, carrying height through.
 *
 * The game's local axes are `+X east, +Y up, +Z south`, so north is `-Z`. That convention is kept
 * rather than corrected: flipping it would invert every compiled tile, every road vertex and
 * every landmark in the project at once.
 */
export function legacyLocalToGeodetic(x: number, y: number, z: number): GeodeticPosition {
  const { lat, lon } = legacyLocalToGeo(x, z);
  return geodetic(clampHalfPi(degToRad(lat)), wrapPi(degToRad(lon)), finite(y));
}

export function geodeticToLegacyLocal(position: GeodeticPosition): Vec3 {
  const { x, z } = geoToLegacyLocal(radToDeg(position.latRad), radToDeg(position.lonRad));
  return [x, position.heightM, z];
}

/** Legacy local metres to ECEF, by way of the geodetic position the legacy projection implies. */
export function legacyLocalToEcef(x: number, y: number, z: number): EcefPosition {
  return geodeticToEcef(legacyLocalToGeodetic(x, y, z));
}

export function ecefToLegacyLocal(position: EcefPosition): Vec3 {
  return geodeticToLegacyLocal(ecefToGeodetic(position));
}

/**
 * The true tangent-plane position at Manaus, in the game's axis convention.
 * This is what the planetary layers use; it agrees with the legacy path at the anchor and drifts
 * from it by {@link LEGACY_NORTH_SCALE} with distance north or south.
 */
export function geodeticToTrueLocal(position: GeodeticPosition, out: Vec3 = [0, 0, 0]): Vec3 {
  const enu = ecefToEnu(ANCHOR_BASIS, geodeticToEcef(position), [0, 0, 0]);
  out[0] = enu[0];        // east  -> +X
  out[1] = enu[2];        // up    -> +Y
  out[2] = -enu[1];       // north -> -Z
  return out;
}

export function trueLocalToGeodetic(local: Vec3): GeodeticPosition {
  return ecefToGeodetic(enuToEcef(ANCHOR_BASIS, [local[0], -local[2], local[1]]));
}

export function trueLocalToEcef(local: Vec3): EcefPosition {
  return enuToEcef(ANCHOR_BASIS, [local[0], -local[2], local[1]]);
}

export function ecefToTrueLocal(position: EcefPosition, out: Vec3 = [0, 0, 0]): Vec3 {
  const enu = ecefToEnu(ANCHOR_BASIS, position, [0, 0, 0]);
  out[0] = enu[0]; out[1] = enu[2]; out[2] = -enu[1];
  return out;
}

/** The ENU basis the city hangs from. Exposed so planet tiles can share it. */
export const MANAUS_BASIS: EnuBasis = ANCHOR_BASIS;

/**
 * The difference, in metres, between where the legacy projection puts a point and where the
 * ellipsoid does. Small near the Largo, tens of metres at the edge of the compiled city. Used by
 * the tests that pin the gap, and available to the debug overlay.
 */
export function legacyDivergenceM(x: number, z: number): number {
  const trueLocal = geodeticToTrueLocal(legacyLocalToGeodetic(x, 0, z));
  return Math.hypot(trueLocal[0] - x, trueLocal[2] - z);
}
