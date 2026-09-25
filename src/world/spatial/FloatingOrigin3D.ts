import { clonePose, type ReferenceFrameId, type SpatialPose } from './SpatialPose';
import { cloneVec3, finite, type Vec3 } from './units';

/**
 * What every local system is told when the origin moves.
 *
 * `localDeltaM` is how much a render-local coordinate must shift to keep describing the same
 * logical place: `newLocal = oldLocal + localDeltaM`. Listeners that store render-local positions
 * add it; listeners that store logical positions ignore it entirely and simply recompute.
 */
export interface RebaseEvent {
  readonly frameId: ReferenceFrameId;
  readonly previousOrigin: SpatialPose;
  readonly nextOrigin: SpatialPose;
  readonly localDeltaM: Vec3;
}

export interface RebaseListener {
  onRebase(event: RebaseEvent): void;
}

export interface FloatingOriginOptions {
  /** Distance from the origin, in metres, past which a rebase is due. */
  thresholdM?: number;
  /**
   * The origin snaps to multiples of this. Quantising keeps the offset exactly representable and
   * keeps repeated rebases from accumulating a drift of their own.
   */
  gridM?: number;
}

const DEFAULTS = { thresholdM: 2048, gridM: 1024 } as const;

/**
 * The 3D generalisation of the game's existing floating origin.
 *
 * Today the world rebases X and Z every 2 048 m, which is enough while the sky is a ceiling.
 * Flying off the planet makes Y just as large as the other two, and reaching another body makes
 * the frame itself change. This tracks all three axes and carries the frame with the origin.
 *
 * The one rule: **a rebase never changes where anything logically is.** It changes only the
 * numbers the renderer and the local physics see. The logical pose is the truth, and it is the
 * input to this class, never its output.
 */
export class FloatingOrigin3D {
  private readonly listeners = new Set<RebaseListener>();
  private readonly options: Required<FloatingOriginOptions>;
  private origin: SpatialPose;
  private rebases = 0;

  constructor(initialOrigin: SpatialPose, options: FloatingOriginOptions = {}) {
    this.origin = clonePose(initialOrigin);
    this.options = {
      thresholdM: Math.max(1, finite(options.thresholdM, DEFAULTS.thresholdM)),
      gridM: Math.max(1, finite(options.gridM, DEFAULTS.gridM)),
    };
  }

  get frame(): ReferenceFrameId { return this.origin.frame; }
  get logicalOrigin(): SpatialPose { return clonePose(this.origin); }
  get rebaseCount(): number { return this.rebases; }
  get thresholdM(): number { return this.options.thresholdM; }
  get gridM(): number { return this.options.gridM; }

  subscribe(listener: RebaseListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Logical position in the origin's frame, expressed relative to the current origin. */
  toRenderLocal(logical: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
    out[0] = logical[0] - this.origin.position[0];
    out[1] = logical[1] - this.origin.position[1];
    out[2] = logical[2] - this.origin.position[2];
    return out;
  }

  /** The inverse: a render-local position back to a logical one. */
  toLogical(renderLocal: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
    out[0] = renderLocal[0] + this.origin.position[0];
    out[1] = renderLocal[1] + this.origin.position[1];
    out[2] = renderLocal[2] + this.origin.position[2];
    return out;
  }

  /** How far the subject currently sits from the origin, in metres. */
  localDistance(logical: Vec3): number {
    return Math.hypot(
      logical[0] - this.origin.position[0],
      logical[1] - this.origin.position[1],
      logical[2] - this.origin.position[2],
    );
  }

  /**
   * True when the subject has wandered far enough that render-local coordinates are getting big.
   * A different frame always forces one: the old origin no longer means anything.
   */
  shouldRebase(subject: SpatialPose): boolean {
    if (subject.frame !== this.origin.frame) return true;
    if (!Number.isFinite(subject.position[0] + subject.position[1] + subject.position[2])) return false;
    return this.localDistance(subject.position) > this.options.thresholdM;
  }

  /**
   * Moves the origin to the quantised position nearest the subject and returns what changed.
   * Callers should route the event to listeners via {@link commit}, or use {@link update}.
   */
  rebase(subject: SpatialPose): RebaseEvent {
    const previous = clonePose(this.origin);
    const grid = this.options.gridM;
    const snapped: Vec3 = [
      Math.round(finite(subject.position[0]) / grid) * grid,
      Math.round(finite(subject.position[1]) / grid) * grid,
      Math.round(finite(subject.position[2]) / grid) * grid,
    ];
    const next: SpatialPose = {
      frame: subject.frame,
      position: snapped,
      // The origin carries no rotation of its own: a rebase is a translation, and rotating it
      // would tilt every local system that trusted the previous axes.
      orientation: [0, 0, 0, 1],
    };

    // Across a frame change the delta is meaningless — the axes themselves moved — so it is
    // reported as zero and listeners are expected to rebuild from logical positions.
    const sameFrame = previous.frame === next.frame;
    const event: RebaseEvent = {
      frameId: next.frame,
      previousOrigin: previous,
      nextOrigin: clonePose(next),
      localDeltaM: sameFrame
        ? [
          previous.position[0] - next.position[0],
          previous.position[1] - next.position[1],
          previous.position[2] - next.position[2],
        ]
        : [0, 0, 0],
    };

    this.origin = next;
    this.rebases++;
    return event;
  }

  /** Publishes an event to every listener. Faults in one listener never stop the others. */
  commit(event: RebaseEvent): void {
    for (const listener of this.listeners) {
      try {
        listener.onRebase(event);
      } catch (error) {
        console.error('Rebase listener failed', error);
      }
    }
  }

  /** The whole cycle: test, move if needed, notify. Returns the event when one happened. */
  update(subject: SpatialPose): RebaseEvent | null {
    if (!this.shouldRebase(subject)) return null;
    const event = this.rebase(subject);
    this.commit(event);
    return event;
  }

  /** Forces the origin somewhere specific. Used by teleports and by tests. */
  reset(origin: SpatialPose): void {
    this.origin = clonePose(origin);
  }
}
