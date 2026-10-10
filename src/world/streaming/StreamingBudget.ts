import { finite } from '../spatial/units';

/**
 * What the streaming layer is allowed to spend in one frame.
 *
 * Every number here exists because something once blew through it. A time budget alone is not
 * enough — the project already learned that, and capped activations per frame separately, because
 * a burst of cheap activations still stalls. Bytes are capped twice: a soft ceiling that starts
 * eviction and a hard one that refuses new work outright.
 */
export interface StreamingBudget {
  readonly mainThreadMs: number;
  readonly maxConcurrentFetches: number;
  readonly maxWorkerJobs: number;
  readonly maxActivationsPerFrame: number;
  /**
   * Activations at or below this many GPU bytes are cheap enough to have their own allowance.
   *
   * A city block and an ellipsoid patch are not the same piece of work: the block is hundreds of
   * kilobytes of merged geometry with colliders behind it, the patch is a 17x17 grid of about
   * thirteen kilobytes and nothing else. Holding both to two per frame is what left the planet
   * arriving a couple of tiles at a time while the budget sat unspent.
   */
  readonly lightActivationBytes: number;
  readonly maxLightActivationsPerFrame: number;
  readonly gpuUploadBytesPerFrame: number;
  readonly gpuMemorySoftBytes: number;
  readonly gpuMemoryHardBytes: number;
}

/** Defaults sized against the budgets the game already runs to for the local city. */
export const DEFAULT_STREAMING_BUDGET: StreamingBudget = {
  mainThreadMs: 4,
  maxConcurrentFetches: 6,
  maxWorkerJobs: 4,
  maxActivationsPerFrame: 2,
  lightActivationBytes: 64 * 1024,
  maxLightActivationsPerFrame: 12,
  gpuUploadBytesPerFrame: 8 * 1024 * 1024,
  gpuMemorySoftBytes: 512 * 1024 * 1024,
  gpuMemoryHardBytes: 768 * 1024 * 1024,
};

/**
 * Scales a budget for travel speed.
 *
 * At high speed fine detail is wasted work — it arrives after the player has passed it — so the
 * per-frame allowances shrink while concurrency grows, because what matters then is getting the
 * coarse tiles ahead rather than the fine ones underneath.
 */
export function budgetForSpeed(base: StreamingBudget, speedMps: number): StreamingBudget {
  const speed = Math.max(0, finite(speedMps));
  if (speed < 400) return base;
  const haste = Math.min(3, speed / 400);
  return {
    ...base,
    mainThreadMs: base.mainThreadMs,
    maxConcurrentFetches: Math.min(16, Math.round(base.maxConcurrentFetches * haste)),
    maxActivationsPerFrame: Math.max(1, Math.round(base.maxActivationsPerFrame * (1 / haste))),
    // Light activations are not scaled down. They are the coarse tiles ahead of the player, which
    // is precisely what speed needs more of; it is the heavy city work that has to give way.
    gpuUploadBytesPerFrame: Math.round(base.gpuUploadBytesPerFrame * (1 / haste)),
  };
}

/**
 * Tracks one frame's spending.
 *
 * Deliberately a separate object from the budget itself: the budget is configuration and is read
 * by everyone, while the tally is per-frame mutable state owned by the scheduler alone.
 */
export class StreamingLedger {
  private frameStartMs = 0;
  private activations = 0;
  private lightActivations = 0;
  private uploadedBytes = 0;
  private fetches = 0;
  private residentCpuBytes = 0;
  private residentGpuBytes = 0;

  constructor(private budget: StreamingBudget = DEFAULT_STREAMING_BUDGET) {}

  get current(): StreamingBudget { return this.budget; }
  get activationsThisFrame(): number { return this.activations + this.lightActivations; }
  get uploadedBytesThisFrame(): number { return this.uploadedBytes; }
  get inFlightFetches(): number { return this.fetches; }
  get gpuBytes(): number { return this.residentGpuBytes; }
  get cpuBytes(): number { return this.residentCpuBytes; }

  setBudget(budget: StreamingBudget): void { this.budget = budget; }

  /**
   * Called once per frame. It reads its own clock rather than taking one, because measuring the
   * elapsed time against a different clock than the one that started it makes every frame look
   * either instantaneous or already over budget.
   */
  beginFrame(): void {
    this.frameStartMs = this.nowMs();
    this.activations = 0;
    this.lightActivations = 0;
    this.uploadedBytes = 0;
  }

  get elapsedMs(): number { return Math.max(0, this.nowMs() - this.frameStartMs); }

  /** Overridable so tests can drive time deterministically instead of racing a real clock. */
  protected nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  get hasFrameTime(): boolean { return this.elapsedMs < this.budget.mainThreadMs; }
  get canFetch(): boolean { return this.fetches < this.budget.maxConcurrentFetches; }

  /**
   * The limits that hold whatever else happens: the per-frame activation cap, the upload cap and
   * the memory ceiling. Separate from `canActivate` because frame time is a softer constraint than
   * running out of memory, and the caller is entitled to treat them differently.
   */
  canActivateWithinLimits(gpuBytes: number): boolean {
    if (this.isLight(gpuBytes)) {
      if (this.lightActivations >= this.budget.maxLightActivationsPerFrame) return false;
    } else if (this.activations >= this.budget.maxActivationsPerFrame) return false;
    if (this.uploadedBytes + gpuBytes > this.budget.gpuUploadBytesPerFrame) return false;
    if (this.residentGpuBytes + gpuBytes > this.budget.gpuMemoryHardBytes) return false;
    return true;
  }

  private isLight(gpuBytes: number): boolean {
    return Math.max(0, finite(gpuBytes)) <= this.budget.lightActivationBytes;
  }

  canActivate(gpuBytes: number): boolean {
    return this.canActivateWithinLimits(gpuBytes) && this.hasFrameTime;
  }

  /** True once memory is high enough that the cache should start letting things go. */
  get shouldEvict(): boolean { return this.residentGpuBytes > this.budget.gpuMemorySoftBytes; }

  fetchStarted(): void { this.fetches++; }
  fetchFinished(): void { this.fetches = Math.max(0, this.fetches - 1); }

  activated(cpuBytes: number, gpuBytes: number): void {
    if (this.isLight(gpuBytes)) this.lightActivations++; else this.activations++;
    this.uploadedBytes += Math.max(0, finite(gpuBytes));
    this.residentCpuBytes += Math.max(0, finite(cpuBytes));
    this.residentGpuBytes += Math.max(0, finite(gpuBytes));
  }

  deactivated(cpuBytes: number, gpuBytes: number): void {
    this.residentCpuBytes = Math.max(0, this.residentCpuBytes - Math.max(0, finite(cpuBytes)));
    this.residentGpuBytes = Math.max(0, this.residentGpuBytes - Math.max(0, finite(gpuBytes)));
  }

  reset(): void {
    this.activations = 0;
    this.lightActivations = 0;
    this.uploadedBytes = 0;
    this.fetches = 0;
    this.residentCpuBytes = 0;
    this.residentGpuBytes = 0;
  }
}
