import type { PlanetBody } from '../planet/PlanetBody';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from '../planet/PlanetSurface';
import type { BodyFixedPoint, SubtractCapsuleEdit } from '../planet/volume/PlanetVolumeEdit';
import { PlanetVolumeEditStore } from '../planet/volume/PlanetVolumeEditStore';
import { serializePlanetVolumeEdits, deserializePlanetVolumeEdits } from '../planet/volume/PlanetVolumePersistence';

export interface TunnelExcavationPlan {
  readonly tunnelId: string;
  readonly bodyId: string;
  readonly entryBodyFixedM: BodyFixedPoint;
  readonly exitBodyFixedM: BodyFixedPoint;
  readonly radiusM: number;
  readonly lengthM: number;
  readonly isThroughBody: boolean;
}

export interface TunnelCarveRequest {
  readonly bodyId: string;
  readonly rayOriginBodyFixedM: BodyFixedPoint;
  readonly rayDirectionBodyFixed: BodyFixedPoint;
  readonly radiusM: number;
  readonly maxDepthM?: number;
  readonly tunnelId?: string;
}

export interface PlanetExcavationServiceOptions {
  readonly edits: PlanetVolumeEditStore;
  readonly surfaceForBody: (bodyId: string) => PlanetSurfaceGenerator | undefined;
  readonly onTunnelCreated?: (plan: TunnelExcavationPlan) => void;
}

/**
 * Solves ray-ellipsoid analytical intersection for planetary bodies.
 * Ray: P + t * d. Returns [t_entry, t_exit] or undefined if no intersection.
 */
export function intersectRayPlanetEllipsoid(
  origin: BodyFixedPoint,
  direction: BodyFixedPoint,
  semiAxes: readonly [number, number, number]
): [number, number] | undefined {
  const [a, b, c] = semiAxes;
  if (a <= 0 || b <= 0 || c <= 0) return undefined;

  const invA = 1 / a;
  const invB = 1 / b;
  const invC = 1 / c;

  // Transform ray into normalized unit sphere space
  const ox = origin[0] * invA;
  const oy = origin[1] * invB;
  const oz = origin[2] * invC;

  const dx = direction[0] * invA;
  const dy = direction[1] * invB;
  const dz = direction[2] * invC;

  const A = dx * dx + dy * dy + dz * dz;
  if (A <= 1e-32) return undefined;

  const B = 2 * (ox * dx + oy * dy + oz * dz);
  const C = ox * ox + oy * oy + oz * oz - 1.0;

  const discriminant = B * B - 4 * A * C;
  if (discriminant < 0) return undefined;

  const sqrtDisc = Math.sqrt(discriminant);
  const t0 = (-B - sqrtDisc) / (2 * A);
  const t1 = (-B + sqrtDisc) / (2 * A);

  return [Math.min(t0, t1), Math.max(t0, t1)];
}

/**
 * Service managing authoritative planetary excavations, subterranean boreholes,
 * and through-body tunnel carving for D2.
 */
export class PlanetExcavationService {
  readonly options: PlanetExcavationServiceOptions;
  private lastPlan?: TunnelExcavationPlan;
  private tunnelCounter = 0;

  constructor(options: PlanetExcavationServiceOptions) {
    this.options = options;
  }

  get lastExcavation(): TunnelExcavationPlan | undefined {
    return this.lastPlan;
  }

  /**
   * Plans and carves a straight tunnel through or into a planet using a directed ray.
   * If the ray penetrates completely, carves a planet-spanning through-body capsule.
   * If maxDepthM is specified, carves a subterranean borehole stopping at that depth.
   */
  carveDirectionalTunnel(request: TunnelCarveRequest): TunnelExcavationPlan | undefined {
    const surface = this.options.surfaceForBody(request.bodyId);
    if (!surface) return undefined;

    const body = surface.body;
    const semiAxes: [number, number, number] = [
      body.semiMajorAxisM,
      body.semiMajorAxisM * (1.0 - body.flattening),
      body.semiMajorAxisM,
    ];

    const dirLen = Math.hypot(...request.rayDirectionBodyFixed);
    if (dirLen < 1e-6) return undefined;

    const normDir: BodyFixedPoint = [
      request.rayDirectionBodyFixed[0] / dirLen,
      request.rayDirectionBodyFixed[1] / dirLen,
      request.rayDirectionBodyFixed[2] / dirLen,
    ];

    const hit = intersectRayPlanetEllipsoid(request.rayOriginBodyFixedM, normDir, semiAxes);
    if (!hit) return undefined;

    let [tEntry, tExit] = hit;

    // If starting inside the planet (tEntry < 0), start directly at the origin
    if (tEntry < 0) {
      tEntry = 0;
    }

    const availableLength = tExit - tEntry;
    if (availableLength <= 0) return undefined;

    let actualLength = availableLength;
    let isThroughBody = true;

    if (request.maxDepthM !== undefined && Number.isFinite(request.maxDepthM) && request.maxDepthM < availableLength) {
      actualLength = Math.max(1.0, request.maxDepthM);
      tExit = tEntry + actualLength;
      isThroughBody = false;
    }

    const entryPoint: BodyFixedPoint = [
      request.rayOriginBodyFixedM[0] + normDir[0] * tEntry,
      request.rayOriginBodyFixedM[1] + normDir[1] * tEntry,
      request.rayOriginBodyFixedM[2] + normDir[2] * tEntry,
    ];

    const exitPoint: BodyFixedPoint = [
      request.rayOriginBodyFixedM[0] + normDir[0] * tExit,
      request.rayOriginBodyFixedM[1] + normDir[1] * tExit,
      request.rayOriginBodyFixedM[2] + normDir[2] * tExit,
    ];

    const radiusM = Math.max(1.0, Math.min(500.0, request.radiusM));
    const tunnelId = request.tunnelId ?? `${request.bodyId}:tunnel:${++this.tunnelCounter}`;

    const edit: SubtractCapsuleEdit = {
      id: tunnelId,
      bodyId: request.bodyId,
      type: 'subtract-capsule',
      aBodyFixedM: entryPoint,
      bBodyFixedM: exitPoint,
      radiusM,
    };

    this.options.edits.subtractCapsule(edit);

    const plan: TunnelExcavationPlan = {
      tunnelId,
      bodyId: request.bodyId,
      entryBodyFixedM: entryPoint,
      exitBodyFixedM: exitPoint,
      radiusM,
      lengthM: actualLength,
      isThroughBody,
    };

    this.lastPlan = plan;
    this.options.onTunnelCreated?.(plan);
    return plan;
  }

  /**
   * Carves a connected subterranean tunnel network along a list of 3D waypoints.
   * Each consecutive pair (W_i, W_{i+1}) forms a subtractive capsule segment.
   */
  carveTunnelPath(
    bodyId: string,
    waypoints: readonly BodyFixedPoint[],
    radiusM: number,
    pathId?: string
  ): readonly TunnelExcavationPlan[] {
    if (waypoints.length < 2) return [];

    const prefix = pathId ?? `${bodyId}:cave:${++this.tunnelCounter}`;
    const radius = Math.max(1.0, Math.min(500.0, radiusM));
    const plans: TunnelExcavationPlan[] = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      const length = Math.hypot(dx, dy, dz);
      if (length < 0.1) continue;

      const segId = `${prefix}:seg_${i}`;
      const edit: SubtractCapsuleEdit = {
        id: segId,
        bodyId,
        type: 'subtract-capsule',
        aBodyFixedM: a,
        bBodyFixedM: b,
        radiusM: radius,
      };

      this.options.edits.subtractCapsule(edit);

      const plan: TunnelExcavationPlan = {
        tunnelId: segId,
        bodyId,
        entryBodyFixedM: a,
        exitBodyFixedM: b,
        radiusM: radius,
        lengthM: length,
        isThroughBody: false,
      };

      plans.push(plan);
      this.options.onTunnelCreated?.(plan);
    }

    if (plans.length > 0) {
      this.lastPlan = plans[plans.length - 1];
    }
    return plans;
  }

  /**
   * Serializes all edits for a body for persistent storage.
   */
  serializeBodyEdits(bodyId: string): string {
    return serializePlanetVolumeEdits(this.options.edits, bodyId);
  }

  /**
   * Restores previously persisted edits from JSON into the active edit store.
   */
  restoreBodyEdits(json: string): void {
    const loaded = deserializePlanetVolumeEdits(json);
    for (const edit of loaded.allEdits()) {
      if (!this.options.edits.get(edit.id)) {
        if (edit.type === 'subtract-capsule') {
          this.options.edits.subtractCapsule(edit);
        } else if (edit.type === 'subtract-sphere') {
          this.options.edits.subtractSphere(edit);
        }
      }
    }
  }

  debugMetrics(): Record<string, string | number> {
    const last = this.lastPlan;
    return {
      'EXCAVATION · Active tunnel': last?.tunnelId ?? '—',
      'EXCAVATION · Body': last?.bodyId ?? '—',
      'EXCAVATION · Through-body': last ? (last.isThroughBody ? 'yes' : 'no') : '—',
      'EXCAVATION · Radius / Length': last ? `${last.radiusM.toFixed(1)} m / ${(last.lengthM / 1000).toFixed(2)} km` : '—',
      'EXCAVATION · Total planet edits': this.options.edits.editCount,
    };
  }
}
