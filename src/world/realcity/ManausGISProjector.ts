import { Vector3 } from 'three/webgpu';

/**
 * High-precision GIS Cartographic Projector for Manaus.
 * Converts WGS84 Geodetic GPS Coordinates (latitude, longitude) to local metric cartesian coordinates.
 * Anchored at Teatro Amazonas / Centro Histórico (Lat: -3.130282, Lon: -60.023439).
 * Conforms to references/city-tour and Section 8 of docs/research/17-geospatial-data-streaming-overture-and-gis.md.
 */
export class ManausGISProjector {
  // Exact geographic anchor at Teatro Amazonas (Origin: 0, 0, 0)
  public static readonly ORIGIN_LAT = -3.130282;
  public static readonly ORIGIN_LON = -60.023439;

  // WGS84 ellipsoid parameters at equatorial latitude (-3.13 deg)
  // Meridional distance per degree of latitude: ~111,132.954 meters
  public static readonly METERS_PER_DEGREE_LAT = 111132.954;

  // Longitudinal distance per degree scaled by cos(originLat)
  private static readonly LAT_RAD = (ManausGISProjector.ORIGIN_LAT * Math.PI) / 180.0;
  public static readonly METERS_PER_DEGREE_LON = 111412.84 * Math.cos(ManausGISProjector.LAT_RAD);

  /**
   * Projects GPS (latitude, longitude) to Three.js metric cartesian coordinates.
   * Coordinate Frame: East = +X, Up = +Y, North = -Z (Standard OpenGL / Three.js convention).
   */
  public static gpsToLocalMeters(lat: number, lon: number, outPos = new Vector3()): Vector3 {
    const dLat = lat - this.ORIGIN_LAT;
    const dLon = lon - this.ORIGIN_LON;

    const x = (dLon * this.METERS_PER_DEGREE_LON) || 0;
    const z = (-dLat * this.METERS_PER_DEGREE_LAT) || 0;

    outPos.set(x, 0, z);
    return outPos;
  }

  /**
   * Unprojects local Three.js coordinates (x, z in meters) back to WGS84 GPS (lat, lon).
   */
  public static localMetersToGPS(x: number, z: number): { lat: number; lon: number } {
    const lat = this.ORIGIN_LAT - z / this.METERS_PER_DEGREE_LAT;
    const lon = this.ORIGIN_LON + x / this.METERS_PER_DEGREE_LON;
    return { lat, lon };
  }

  /**
   * High performance batch projection for vector geometries.
   * Converts a flat array of [lat0, lon0, lat1, lon1, ...] to [x0, z0, x1, z1, ...].
   * Zero heap allocation per vertex.
   */
  public static projectBatch(
    coords: readonly number[] | Float64Array,
    out: Float32Array,
  ): void {
    const count = Math.floor(coords.length / 2);
    for (let i = 0; i < count; i++) {
      const lat = coords[i * 2];
      const lon = coords[i * 2 + 1];
      const dLat = lat - this.ORIGIN_LAT;
      const dLon = lon - this.ORIGIN_LON;
      out[i * 2] = dLon * this.METERS_PER_DEGREE_LON;
      out[i * 2 + 1] = -dLat * this.METERS_PER_DEGREE_LAT;
    }
  }

  /**
   * Computes the great-circle geodesic distance in meters between two GPS coordinates
   * using the Haversine formula with WGS84 mean Earth radius.
   */
  public static geodesicDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000.0; // Earth mean radius in meters
    const phi1 = (lat1 * Math.PI) / 180.0;
    const phi2 = (lat2 * Math.PI) / 180.0;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180.0;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180.0;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
