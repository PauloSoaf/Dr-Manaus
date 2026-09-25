import type { ActiveReferenceFrame } from '../spatial/ReferenceFrame';
import type { SpatialPose } from '../spatial/SpatialPose';
import type { Vec3 } from '../spatial/units';
import type { StreamingBudget } from '../streaming/StreamingBudget';
import type { ActiveTile, TileDemand, TilePayload } from '../streaming/TileDemand';

/** Where the player is and what they are doing, in logical terms. */
export interface SpatialContext {
  readonly timeS: number;
  readonly player: SpatialPose;
  readonly frame: ActiveReferenceFrame;
  readonly localVelocityMps: Vec3;
  readonly altitudeM?: number;
  readonly bodyId?: string;
}

export interface StreamingContext {
  readonly spatial: SpatialContext;
  readonly camera: {
    readonly fovRad: number;
    readonly viewportHeightPx: number;
    readonly forward: Vec3;
  };
  readonly quality: {
    /** Screen-space error, in pixels, a tile is allowed before it must refine. */
    readonly sseTargetPx: number;
    /** Global multiplier from the quality preset. Below one means coarser everywhere. */
    readonly detailFactor: number;
  };
  readonly budget: StreamingBudget;
}

/** What a provider claims to supply, and how authoritative it is about it. */
export type CoverageChannel =
  | 'terrain' | 'water' | 'roads' | 'buildings' | 'vegetation' | 'landmarks' | 'physics';

export interface SpatialRegion {
  /** Body the region belongs to, so a claim on Earth never shadows one on the Moon. */
  readonly bodyId: string;
  /** Bounding box in the body's geodetic degrees. Longitude may wrap past 180. */
  readonly minLatDeg: number;
  readonly maxLatDeg: number;
  readonly minLonDeg: number;
  readonly maxLonDeg: number;
}

export interface CoverageClaim {
  readonly providerId: string;
  readonly priority: number;
  readonly region: SpatialRegion;
  readonly channels: readonly CoverageChannel[];
}

/**
 * One source of world.
 *
 * Every provider answers the same four questions — do you cover this, what do you want loaded,
 * load it, put it in — and none of them is allowed to answer "load everything". `plan` returns a
 * bounded list, `load` takes an `AbortSignal` because the player will turn around mid-fetch, and
 * `deactivate` must actually free what `activate` took.
 */
export interface WorldProvider {
  readonly id: string;
  /**
   * Higher wins where two providers overlap. The authored Largo outranks the compiled city, which
   * outranks the procedural filler, which outranks generic planet terrain.
   */
  readonly priority: number;

  /** What this provider is authoritative for. Used to stop two sources drawing the same street. */
  coverage?(): readonly CoverageClaim[];

  /** Cheap test: is this provider relevant at all right now? */
  covers(context: SpatialContext): boolean;

  /** What should be resident, given where the player is. Bounded, and sorted is not required. */
  plan(context: StreamingContext): readonly TileDemand[];

  /** Fetch and decode. Must honour the signal, and must not touch the scene. */
  load(demand: TileDemand, signal: AbortSignal): Promise<TilePayload>;

  /** Put it in the world. This is the only step allowed to touch the renderer. */
  activate(payload: TilePayload, frame: ActiveReferenceFrame): ActiveTile;

  /** Take it back out and release everything it held. */
  deactivate(tile: ActiveTile): void;
}

/** Thrown by a provider that was asked for something outside what it claims to cover. */
export class ProviderCoverageError extends Error {
  constructor(providerId: string, detail: string) {
    super(`Provider "${providerId}" was asked for something it does not cover: ${detail}`);
    this.name = 'ProviderCoverageError';
  }
}

const wrapLon = (deg: number): number => ((deg + 180) % 360 + 360) % 360 - 180;

/** Whether a geodetic point in degrees falls inside a region, handling the antimeridian. */
export function regionContains(region: SpatialRegion, latDeg: number, lonDeg: number): boolean {
  if (!(latDeg >= region.minLatDeg && latDeg <= region.maxLatDeg)) return false;
  const min = wrapLon(region.minLonDeg), max = wrapLon(region.maxLonDeg), lon = wrapLon(lonDeg);
  // A region that crosses the antimeridian has min > max once both are wrapped.
  return min <= max ? lon >= min && lon <= max : lon >= min || lon <= max;
}
