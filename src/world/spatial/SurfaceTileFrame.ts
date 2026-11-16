import { Matrix4, Vector3 } from 'three/webgpu';
import { type EcefPosition, geodeticToEcef } from './ECEF';
import { type GeodeticPosition } from './Geodetic';
import { type Vec3 } from './units';
import { ecefToTrueLocal, legacyLocalToEcef, legacyLocalToGeodetic } from './ManausFrameAdapter';

export interface SurfaceTileFrame {
  bodyId: string;
  tileId: string;
  centreGeodetic: GeodeticPosition;
  centreEcef: EcefPosition;
  localFrameId: string;

  /**
   * Converts a position from the legacy flat Manaus projection (in which the tile geometry
   * was compiled) into the local Cartesian frame of this tile (which sits on the true ellipsoid).
   */
  legacyToLocal(x: number, y: number, z: number): Vec3;

  /**
   * Converts a position from the tile's local Cartesian frame into global ECEF coordinates.
   */
  localToEcef(local: Vec3): EcefPosition;

  /**
   * Returns the Matrix4 that transforms the tile's local geometry into the global scene root
   * (the True Local tangent plane at the Manaus anchor).
   */
  getSceneMatrix(): Matrix4;
}

export function createSurfaceTileFrame(bodyId: string, tileId: string, legacyCentreX: number, legacyCentreZ: number): SurfaceTileFrame {
  const centreGeodetic = legacyLocalToGeodetic(legacyCentreX, 0, legacyCentreZ);
  const centreEcef = geodeticToEcef(centreGeodetic);
  const localFrameId = `${bodyId}/tile/${tileId}`;

  return {
    bodyId,
    tileId,
    centreGeodetic,
    centreEcef,
    localFrameId,

    legacyToLocal(x: number, y: number, z: number): Vec3 {
      // The tile geometry is locally flat in the legacy frame.
      // We keep the building geometry small (relative to the tile origin) to avoid float32 precision loss
      // and let the frame matrix map legacy metres onto the WGS84 ellipsoid.
      return [
        x - legacyCentreX,
        y,
        z - legacyCentreZ,
      ];
    },

    localToEcef(local: Vec3): EcefPosition {
      return legacyLocalToEcef(legacyCentreX + local[0], local[1], legacyCentreZ + local[2]);
    },

    getSceneMatrix(): Matrix4 {
      const originEcef = legacyLocalToEcef(legacyCentreX, 0, legacyCentreZ);
      // Basis steps in legacy metres so a 1024 m tile's internal vertices match
      // legacyPointToRenderLocal(originX + dx, y, originZ + dz) without a 6.9 m north-scale drift.
      const eastEcef = legacyLocalToEcef(legacyCentreX + 1, 0, legacyCentreZ);
      const upEcef = legacyLocalToEcef(legacyCentreX, 1, legacyCentreZ);
      const southEcef = legacyLocalToEcef(legacyCentreX, 0, legacyCentreZ + 1);

      const o = ecefToTrueLocal(originEcef);
      const ex = ecefToTrueLocal(eastEcef);
      const ey = ecefToTrueLocal(upEcef);
      const ez = ecefToTrueLocal(southEcef);

      const mat = new Matrix4();
      mat.makeBasis(
        new Vector3(ex[0] - o[0], ex[1] - o[1], ex[2] - o[2]),
        new Vector3(ey[0] - o[0], ey[1] - o[1], ey[2] - o[2]),
        new Vector3(ez[0] - o[0], ez[1] - o[1], ez[2] - o[2]),
      );
      mat.setPosition(o[0], o[1], o[2]);
      return mat;
    },
  };
}
