import type { Vector3 } from 'three/webgpu';
import type { TerrainProvider } from '../../physics/PhysicsWorld';
import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import type { Vec3 } from '../spatial/units';
import { polarRadiusM, type PlanetBody } from './PlanetBody';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from './PlanetSurface';

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
    const a2 = this.body.semiMajorAxisM ** 2, b2 = polarRadiusM(this.body) ** 2;
    const dot = (a: Vec3, b: Vec3) => (a[0] * b[0] + a[1] * b[1]) / a2 + a[2] * b[2] / b2;
    const aa = dot(up, up), bb = 2 * dot(origin, up), cc = dot(origin, origin) - 1;
    const discriminant = bb * bb - 4 * aa * cc;
    // The tangent chart has no floor beyond the horizon. Never invent a plane there.
    if (discriminant < 0) return Number.NEGATIVE_INFINITY;
    let height = (-bb + Math.sqrt(discriminant)) / (2 * aa);

    // Start at the exact ellipsoid intersection, then solve the shared relief surface along
    // the local vertical. Sampling only the anchor's direction would miss both slopes and sag.
    for (let i = 0; i < 12; i++) {
      this.at(origin, up, height);
      const error = this.clearance(this.point);
      if (Math.abs(error) < 0.0001) return height;
      this.at(origin, up, height + 0.5);
      const above = this.clearance(this.point);
      this.at(origin, up, height - 0.5);
      const derivative = above - this.clearance(this.point);
      if (derivative < 0.01) return Number.NEGATIVE_INFINITY;
      height -= error / derivative;
    }
    this.at(origin, up, height);
    return Math.abs(this.clearance(this.point)) < 0.01 ? height : Number.NEGATIVE_INFINITY;
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
    return radius - planetSurfaceRadius(this.surface, this.direction);
  }
}
