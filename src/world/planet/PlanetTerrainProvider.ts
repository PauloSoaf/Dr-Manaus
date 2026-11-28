import type { Vector3 } from 'three/webgpu';
import type { TerrainProvider } from '../../physics/PhysicsWorld';
import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import type { Vec3 } from '../spatial/units';
import type { PlanetBody } from './PlanetBody';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from './PlanetSurfaceField';
import { verticalSurfaceHeight } from './LocalSurface';

/**
 * Local +Y terrain collision over the same ellipsoid and relief used by PlanetGlobe.
 * Queries stay in the active body's ENU frame, including its curvature away from the anchor.
 * The graph is consulted on each query so re-registering an ENU anchor cannot leave stale ground.
 */
export class PlanetTerrainProvider implements TerrainProvider {
  readonly heightfieldOnly = true;
  private readonly fixedFrameId: string;
  private readonly point: Vec3 = [0, 0, 0];
  private readonly direction: Vec3 = [0, 0, 0];

  constructor(
    private readonly frames: ReferenceFrameGraph,
    readonly body: PlanetBody,
    readonly surface: PlanetSurfaceGenerator,
    readonly frameId = `${body.id}/local-enu`,
  ) {
    if (surface.body.id !== body.id || surface.body.semiMajorAxisM !== body.semiMajorAxisM || surface.body.flattening !== body.flattening) {
      throw new Error(`Terrain and visual surface must use the same ${body.id} ellipsoid`);
    }
    this.fixedFrameId = `${body.id}/fixed`;
  }

  heightAt(x: number, z: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return Number.NEGATIVE_INFINITY;
    const origin = this.frames.convertPosition(this.frameId, this.fixedFrameId, [x, 0, z]);
    const up = this.frames.convertDirection(this.frameId, this.fixedFrameId, [0, 1, 0]);
    // The shared solver: chunk meshes and water sampling evaluate exactly this surface.
    return verticalSurfaceHeight(this.body, this.surface, origin, up, true);
  }

  /** Camera, teleport and horizontal collision rays use the same continuous ground surface. */
  raycast(origin: Vector3, direction: Vector3, maxDistance: number): number | null {
    if (!(maxDistance > 0) || !Number.isFinite(maxDistance) || direction.lengthSq() < 1e-12) return null;
    const fixedOrigin = this.frames.convertPosition(this.frameId, this.fixedFrameId, [origin.x, origin.y, origin.z]);
    const fixedDirection = this.frames.convertDirection(this.frameId, this.fixedFrameId, [direction.x, direction.y, direction.z]);
    const speed = Math.hypot(...fixedDirection);
    let distance = 0, previous = 0;
    for (let step = 0; step < 256; step++) {
      this.at(fixedOrigin, fixedDirection, distance);
      const clearance = this.clearance(this.point);
      if (clearance <= 0.0001) {
        if (clearance >= 0 || distance === 0) return distance;
        let low = previous, high = distance;
        for (let i = 0; i < 30 && high - low > 0.0001; i++) {
          const middle = (low + high) / 2;
          this.at(fixedOrigin, fixedDirection, middle);
          if (this.clearance(this.point) > 0) low = middle;
          else high = middle;
        }
        return high;
      }
      if (distance >= maxDistance) return null;
      previous = distance;
      // Relief is smooth, so half the radial clearance is a conservative step even on slopes.
      distance = Math.min(maxDistance, distance + Math.max(0.01, clearance * 0.5) / speed);
    }
    return null;
  }

  private at(origin: Vec3, direction: Vec3, distance: number): void {
    for (let i = 0; i < 3; i++) this.point[i] = origin[i] + direction[i] * distance;
  }

  private clearance(point: Vec3): number {
    const radius = Math.hypot(...point);
    if (radius < 1) return -this.body.semiMajorAxisM;
    for (let i = 0; i < 3; i++) this.direction[i] = point[i] / radius;
    return radius - planetSurfaceRadius(this.surface, this.direction, false, true);
  }
}
