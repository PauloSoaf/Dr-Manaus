import { Matrix4, Vector3 } from 'three/webgpu';
import { type EcefPosition, geodeticToEcef } from './ECEF';
import { type EnuBasis, enuBasis, enuToEcef } from './ENU';
import { type GeodeticPosition } from './Geodetic';
import { type Vec3 } from './units';
import { ecefToTrueLocal, legacyLocalToGeodetic } from './ManausFrameAdapter';

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
  const basis: EnuBasis = enuBasis(centreGeodetic);
  const localFrameId = `${bodyId}/tile/${tileId}`;

  return {
    bodyId,
    tileId,
    centreGeodetic,
    centreEcef,
    localFrameId,

    legacyToLocal(x: number, y: number, z: number): Vec3 {
      // The tile geometry is locally flat in the legacy frame.
      // We keep the building geometry small (relative to the tile centre) to avoid float32 precision loss
      // and let the frame graph handle the heavy lifting (rotation to the surface of the ellipsoid).
      return [
        x - legacyCentreX,
        y,
        z - legacyCentreZ
      ];
    },

    localToEcef(local: Vec3): EcefPosition {
      // The local frame is ENU (East-North-Up) but the game's axes are +X East, +Y Up, +Z South.
      // Therefore, North is -Z.
      return enuToEcef(basis, [local[0], -local[2], local[1]]);
    },

    getSceneMatrix(): Matrix4 {
      const originEcef = enuToEcef(basis, [0, 0, 0]);
      // local axes in ENU -> +X is East, +Y is Up, +Z is South
      const eastEcef = enuToEcef(basis, [1, 0, 0]);
      const upEcef = enuToEcef(basis, [0, 0, 1]);
      const southEcef = enuToEcef(basis, [0, -1, 0]);

      const o = ecefToTrueLocal(originEcef);
      const ex = ecefToTrueLocal(eastEcef);
      const ey = ecefToTrueLocal(upEcef);
      const ez = ecefToTrueLocal(southEcef);

      const mat = new Matrix4();
      mat.makeBasis(
        new Vector3(ex[0] - o[0], ex[1] - o[1], ex[2] - o[2]),
        new Vector3(ey[0] - o[0], ey[1] - o[1], ey[2] - o[2]),
        new Vector3(ez[0] - o[0], ez[1] - o[1], ez[2] - o[2])
      );
      mat.setPosition(o[0], o[1], o[2]);
      return mat;
    }
  };
}
