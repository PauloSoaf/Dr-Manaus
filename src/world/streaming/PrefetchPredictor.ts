import { addVec3, cloneVec3, finite, lengthVec3, normalizeVec3, scaleVec3, type Vec3 } from '../spatial/units';

export interface PrefetchOptions {
  /** How far ahead, in seconds, to aim the lead point. */
  leadSecondsBase?: number;
  /** Lead grows with speed up to this, so a fast player still gets warning. */
  leadSecondsMax?: number;
  /** Hard cap on the lead distance, so a teleport does not request a continent. */
  maxLeadM?: number;
  /** Velocity smoothing. A jittery heading would thrash the queue every frame. */
  smoothing?: number;
}

/**
 * Where the player is about to be.
 *
 * Streaming to where someone already is arrives too late — by the time a tile is fetched, decoded
 * and activated they have moved on. The existing city layer already leads its ring; this does the
 * same thing in three dimensions, and adds the part that matters when leaving a planet: at high
 * speed the lead is long and the useful detail is coarse, so what is worth prefetching changes
 * kind as well as distance.
 */
export class PrefetchPredictor {
  private readonly options: Required<PrefetchOptions>;
  private readonly smoothedVelocity: Vec3 = [0, 0, 0];
  private readonly leadPoint: Vec3 = [0, 0, 0];
  private readonly heading: Vec3 = [0, 0, -1];
  private speed = 0;

  constructor(options: PrefetchOptions = {}) {
    this.options = {
      leadSecondsBase: Math.max(0, finite(options.leadSecondsBase, 1.6)),
      leadSecondsMax: Math.max(0, finite(options.leadSecondsMax, 6)),
      maxLeadM: Math.max(0, finite(options.maxLeadM, 250_000)),
      smoothing: Math.min(1, Math.max(0, finite(options.smoothing, 0.15))),
    };
  }

  get currentSpeedMps(): number { return this.speed; }
  get currentHeading(): Vec3 { return cloneVec3(this.heading); }
  get lead(): Vec3 { return cloneVec3(this.leadPoint); }

  /** Seconds of lead at the current speed: longer when moving faster, capped. */
  get leadSecondsNow(): number {
    const { leadSecondsBase, leadSecondsMax } = this.options;
    const growth = Math.min(1, this.speed / 2000);
    return leadSecondsBase + (leadSecondsMax - leadSecondsBase) * growth;
  }

  /**
   * Folds in this frame's motion and returns the point to stream around.
   *
   * Smoothing is exponential in `dt` rather than a fixed fraction, so the prediction behaves the
   * same at 30 fps as at 144 and does not become twitchier just because the frame rate rose.
   */
  update(position: Vec3, velocityMps: Vec3, dtS: number): Vec3 {
    const dt = Math.max(0, Math.min(0.25, finite(dtS)));
    const alpha = 1 - Math.exp(-dt / Math.max(1e-3, this.options.smoothing));
    for (let i = 0; i < 3; i++) {
      const target = finite(velocityMps[i]);
      this.smoothedVelocity[i] += (target - this.smoothedVelocity[i]) * alpha;
    }

    this.speed = lengthVec3(this.smoothedVelocity);
    if (this.speed > 1e-3) normalizeVec3(this.smoothedVelocity, this.heading);

    const leadM = Math.min(this.options.maxLeadM, this.speed * this.leadSecondsNow);
    scaleVec3(this.heading, leadM, this.leadPoint);
    return addVec3(this.leadPoint, position, this.leadPoint);
  }

  /**
   * How relevant a direction is to where the player is going, from 0 behind to 1 straight ahead.
   * Used to rank demands: a tile behind the player is worth far less than one in the view cone.
   */
  relevance(fromPlayer: Vec3): number {
    if (this.speed < 1) return 1;                 // standing still: everything around is equal
    const direction = normalizeVec3(cloneVec3(fromPlayer), [0, 0, 0]);
    const alignment = direction[0] * this.heading[0] + direction[1] * this.heading[1] + direction[2] * this.heading[2];
    return (alignment + 1) / 2;
  }

  /** Resets to a standstill. Called on teleport, so the old heading does not lead somewhere stale. */
  reset(): void {
    this.smoothedVelocity[0] = this.smoothedVelocity[1] = this.smoothedVelocity[2] = 0;
    this.leadPoint[0] = this.leadPoint[1] = this.leadPoint[2] = 0;
    this.speed = 0;
  }
}
