import { ecefToGeodetic, geodeticToEcef, type EcefPosition } from './ECEF';
import type { GeodeticPosition } from './Geodetic';
import { finite, type Vec3 } from './units';

/**
 * A local tangent plane at a point on the ellipsoid: East, North, Up in metres.
 *
 * This is the frame gameplay actually happens in. It is flat, it is in metres, and it is only
 * honest close to its anchor — which is exactly the trade every ground-level game engine makes.
 * The anchor is what ties it back to the planet.
 */
export interface EnuBasis {
  readonly anchor: GeodeticPosition;
  readonly anchorEcef: EcefPosition;
  /** Unit ECEF vectors of the local axes. */
  readonly east: Vec3;
  readonly north: Vec3;
  readonly up: Vec3;
}

/**
 * Builds the tangent basis at a geodetic anchor.
 *
 * At longitude `lambda` and latitude `phi` the axes are, in ECEF:
 *
 *   East  = (-sin lambda,             cos lambda,            0       )
 *   North = (-sin phi cos lambda,    -sin phi sin lambda,    cos phi )
 *   Up    = ( cos phi cos lambda,     cos phi sin lambda,    sin phi )
 *
 * Up is the ellipsoid normal, not the direction to the centre of the Earth; on an ellipsoid those
 * differ, and using the geocentric direction instead would tilt every horizon slightly.
 */
export function enuBasis(anchor: GeodeticPosition): EnuBasis {
  const lat = finite(anchor.latRad), lon = finite(anchor.lonRad);
  const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon), cosLon = Math.cos(lon);
  return {
    anchor,
    anchorEcef: geodeticToEcef(anchor),
    east: [-sinLon, cosLon, 0],
    north: [-sinLat * cosLon, -sinLat * sinLon, cosLat],
    up: [cosLat * cosLon, cosLat * sinLon, sinLat],
  };
}

/** ECEF to local East/North/Up metres, relative to the basis anchor. */
export function ecefToEnu(basis: EnuBasis, position: EcefPosition, out: Vec3 = [0, 0, 0]): Vec3 {
  const dx = position.xM - basis.anchorEcef.xM;
  const dy = position.yM - basis.anchorEcef.yM;
  const dz = position.zM - basis.anchorEcef.zM;
  out[0] = basis.east[0] * dx + basis.east[1] * dy + basis.east[2] * dz;
  out[1] = basis.north[0] * dx + basis.north[1] * dy + basis.north[2] * dz;
  out[2] = basis.up[0] * dx + basis.up[1] * dy + basis.up[2] * dz;
  return out;
}

/** Local East/North/Up metres back to ECEF. The basis is orthonormal, so this is its transpose. */
export function enuToEcef(basis: EnuBasis, enu: Vec3): EcefPosition {
  const [e, n, u] = enu;
  return {
    xM: basis.anchorEcef.xM + basis.east[0] * e + basis.north[0] * n + basis.up[0] * u,
    yM: basis.anchorEcef.yM + basis.east[1] * e + basis.north[1] * n + basis.up[1] * u,
    zM: basis.anchorEcef.zM + basis.east[2] * e + basis.north[2] * n + basis.up[2] * u,
  };
}

export function geodeticToEnu(basis: EnuBasis, position: GeodeticPosition, out: Vec3 = [0, 0, 0]): Vec3 {
  return ecefToEnu(basis, geodeticToEcef(position), out);
}

export function enuToGeodetic(basis: EnuBasis, enu: Vec3): GeodeticPosition {
  return ecefToGeodetic(enuToEcef(basis, enu));
}
