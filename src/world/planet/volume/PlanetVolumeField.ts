import { planetSurfaceRadius, type PlanetSurfaceGenerator } from '../PlanetSurface';
import type { PlanetBody } from '../PlanetBody';
import {
  planetVolumeEditSignedDistance,
  type BodyFixedPoint,
  type PlanetVolumeEdit,
} from './PlanetVolumeEdit';
import { PlanetVolumeEditStore } from './PlanetVolumeEditStore';

/** Stable identifier consumed by later interior-material profiles. */
export type PlanetMaterialId = string;

/** One body-fixed field sample. The caller may reuse an object through `out`. */
export interface PlanetVolumeSample {
  distanceM: number;
  material: PlanetMaterialId;
}

/**
 * Analytic solid field for one rocky body.
 *
 * Sign convention: negative is solid, zero is the boundary and positive is empty. The intact base
 * is the radial distance to the existing `PlanetSurfaceGenerator`; subtractive edits use standard
 * CSG difference, `max(dBase, -dCut)`. Because relief is direction-dependent this is a signed
 * distance-like field rather than a globally exact Euclidean SDF, which future sphere tracing must
 * account for with conservative steps.
 */
export class PlanetVolumeField {
  constructor(
    readonly surface: PlanetSurfaceGenerator,
    readonly edits: PlanetVolumeEditStore = new PlanetVolumeEditStore(),
    readonly intactMaterial: PlanetMaterialId = `${surface.body.id}:interior`,
  ) {}

  get body(): PlanetBody { return this.surface.body; }
  get bodyId(): string { return this.body.id; }

  /** Signed radial distance to the intact ellipsoid plus relief, in metres. */
  baseSignedDistance(pointBodyFixedM: BodyFixedPoint, direction: [number, number, number] = [0,0,0]): number {
    if (pointBodyFixedM.some(component => !Number.isFinite(component))) return Number.POSITIVE_INFINITY;
    const radiusM = Math.hypot(...pointBodyFixedM);
    direction[0] = radiusM > 0 ? pointBodyFixedM[0]/radiusM : 1;
    direction[1] = radiusM > 0 ? pointBodyFixedM[1]/radiusM : 0;
    direction[2] = radiusM > 0 ? pointBodyFixedM[2]/radiusM : 0;
    const surfaceRadiusM = planetSurfaceRadius(this.surface, direction);
    return radiusM > 0 ? radiusM - surfaceRadiusM : -surfaceRadiusM;
  }

  /** Base field combined with every subtractive edit that can influence this sample. */
  signedDistanceBodyFixed(pointBodyFixedM: BodyFixedPoint): number {
    let distanceM = this.baseSignedDistance(pointBodyFixedM);
    if (!Number.isFinite(distanceM)) return distanceM;
    // A cut can affect the numerical distance before the point enters the cut itself. For example,
    // rock 100 m below a surface crater is closer to the crater wall than to the intact surface.
    // An edit can beat a negative base distance only when its shape is within `-dBase`, so this
    // finite query cube is an exact broad phase for CSG difference rather than an AABB-only sign
    // shortcut. In existing empty space only a cut that contains the point can beat the base.
    const candidates = distanceM < 0
      ? this.edits.queryBounds(this.bodyId, {
        minBodyFixedM: [
          pointBodyFixedM[0] + distanceM,
          pointBodyFixedM[1] + distanceM,
          pointBodyFixedM[2] + distanceM,
        ],
        maxBodyFixedM: [
          pointBodyFixedM[0] - distanceM,
          pointBodyFixedM[1] - distanceM,
          pointBodyFixedM[2] - distanceM,
        ],
      })
      : this.edits.queryPoint(this.bodyId, pointBodyFixedM);
    return this.combineCandidates(pointBodyFixedM, distanceM, candidates);
  }

  private combineCandidates(point: BodyFixedPoint, baseDistanceM: number, candidates: readonly PlanetVolumeEdit[]): number {
    let distanceM = baseDistanceM;
    for (const edit of candidates) {
      const cutDistanceM = planetVolumeEditSignedDistance(edit, point);
      distanceM = Math.max(distanceM, -cutDistanceM);
    }
    return distanceM;
  }

  /** Short alias for callers whose body-fixed context is already explicit. */
  signedDistance(pointBodyFixedM: BodyFixedPoint): number {
    return this.signedDistanceBodyFixed(pointBodyFixedM);
  }

  /** Samples distance and the intact material identity without allocating when `out` is supplied. */
  sampleBodyFixed(
    positionM: BodyFixedPoint,
    out: PlanetVolumeSample = { distanceM: 0, material: this.intactMaterial },
    /** Generator-owned precomputed base and conservative BVH candidates; no per-point query. */
    batch?: { readonly baseDistanceM: number; readonly candidates: readonly PlanetVolumeEdit[] },
  ): PlanetVolumeSample {
    out.distanceM = batch ? this.combineCandidates(positionM, batch.baseDistanceM, batch.candidates)
      : this.signedDistanceBodyFixed(positionM);
    out.material = this.intactMaterial;
    return out;
  }
}
