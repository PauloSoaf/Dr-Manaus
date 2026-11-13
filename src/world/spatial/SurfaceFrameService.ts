import { Vector3, Matrix4 } from 'three/webgpu';
import type { Collider } from '../../core/types';
import { type SurfaceTileFrame, createSurfaceTileFrame } from './SurfaceTileFrame';
import { ecefToTrueLocal, legacyLocalToEcef, trueLocalToEcef, ecefToLegacyLocal, legacyLocalToGeodetic } from './ManausFrameAdapter';

export class SurfaceFrameService {
  private readonly bodyId: string;
  private readonly cache = new Map<string, SurfaceTileFrame>();
  private readonly cacheLimit: number;

  constructor(bodyId: string = 'earth', cacheLimit = 512) {
    this.bodyId = bodyId;
    this.cacheLimit = Math.max(1, Math.floor(cacheLimit));
  }

  frameForTile(tileKey: string, legacyCentreX: number, legacyCentreZ: number): SurfaceTileFrame;
  frameForTile(bodyId: string, tileKey: string, legacyCentreX: number, legacyCentreZ: number): SurfaceTileFrame;
  frameForTile(
    bodyOrTile: string,
    tileOrCentreX: string | number,
    centreXOrCentreZ: number,
    maybeCentreZ?: number,
  ): SurfaceTileFrame {
    const bodyId = maybeCentreZ === undefined ? this.bodyId : bodyOrTile;
    const tileKey = maybeCentreZ === undefined ? bodyOrTile : String(tileOrCentreX);
    const legacyCentreX = maybeCentreZ === undefined ? Number(tileOrCentreX) : centreXOrCentreZ;
    const legacyCentreZ = maybeCentreZ === undefined ? centreXOrCentreZ : maybeCentreZ;
    const cacheKey = `${bodyId}:${tileKey}:${legacyCentreX}:${legacyCentreZ}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached;
    }
    const frame = createSurfaceTileFrame(bodyId, tileKey, legacyCentreX, legacyCentreZ);
    this.cache.set(cacheKey, frame);
    while (this.cache.size > this.cacheLimit) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    return frame;
  }

  get cachedFrameCount(): number {
    return this.cache.size;
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
   * Converts a point from the true rendering local frame back to legacy flat Manaus coordinates.
   */
  renderLocalToLegacyPoint(x: number, y: number, z: number): Vector3 {
    const ecef = trueLocalToEcef([x, y, z]);
    const legacy = ecefToLegacyLocal(ecef);
    return new Vector3(legacy[0], legacy[1], legacy[2]);
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

  /**
   * Curves a legacy flat collider into the true rendering local frame.
   * Modifies the provided output collider.
   */
  legacyColliderToRenderLocal(collider: Collider, out: Collider): Collider {
    const local = this.legacyPointToRenderLocal(collider.x, collider.y ?? 0, collider.z);
    out.id = collider.id;
    out.x = local.x;
    out.y = local.y;
    out.z = local.z;
    out.width = collider.width;
    out.height = collider.height;
    out.depth = collider.depth;
    return out;
  }
}
