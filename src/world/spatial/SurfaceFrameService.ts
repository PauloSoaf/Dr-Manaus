import { Vector3, Matrix4 } from 'three/webgpu';
import { type SurfaceTileFrame, createSurfaceTileFrame } from './SurfaceTileFrame';
import { ecefToTrueLocal, legacyLocalToEcef } from './ManausFrameAdapter';
import { legacyLocalToGeodetic } from './ManausFrameAdapter';

export class SurfaceFrameService {
  private readonly bodyId: string;
  private readonly cache = new Map<string, SurfaceTileFrame>();

  constructor(bodyId: string = 'earth') {
    this.bodyId = bodyId;
  }

  frameForTile(tileKey: string, legacyCentreX: number, legacyCentreZ: number): SurfaceTileFrame {
    if (this.cache.has(tileKey)) {
      return this.cache.get(tileKey)!;
    }
    const frame = createSurfaceTileFrame(this.bodyId, tileKey, legacyCentreX, legacyCentreZ);
    this.cache.set(tileKey, frame);
    return frame;
  }

  /**
   * Converts a point from the legacy flat Manaus projection directly into the true rendering local frame.
   */
  legacyPointToRenderLocal(x: number, y: number, z: number): Vector3 {
    const ecef = legacyLocalToEcef(x, y, z);
    const local = ecefToTrueLocal(ecef);
    return new Vector3(local[0], local[1], local[2]);
  }

  /**
   * Converts a direction from the legacy flat Manaus projection directly into the true rendering local frame.
   * Useful for velocities, raycasts, or vehicle orientation.
   */
  legacyDirectionToRenderLocal(x: number, y: number, z: number, originX: number, originY: number, originZ: number): Vector3 {
    // A direction is the difference between two points.
    const startEcef = legacyLocalToEcef(originX, originY, originZ);
    const startLocal = ecefToTrueLocal(startEcef);

    const endEcef = legacyLocalToEcef(originX + x, originY + y, originZ + z);
    const endLocal = ecefToTrueLocal(endEcef);

    return new Vector3(endLocal[0] - startLocal[0], endLocal[1] - startLocal[1], endLocal[2] - startLocal[2]);
  }
}
