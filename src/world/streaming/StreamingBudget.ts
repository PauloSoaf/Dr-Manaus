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
  private uploadedBytes = 0;
  private fetches = 0;
  private residentCpuBytes = 0;
  private residentGpuBytes = 0;

  constructor(private budget: StreamingBudget = DEFAULT_STREAMING_BUDGET) {}

  get current(): StreamingBudget { return this.budget; }
  get activationsThisFrame(): number { return this.activations; }
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
    this.uploadedBytes = 0;
  }

  get elapsedMs(): number { return Math.max(0, this.nowMs() - this.frameStartMs); }

  /** Overridable so tests can drive time deterministically instead of racing a real clock. */
  protected nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  get hasFrameTime(): boolean { return this.elapsedMs < this.budget.mainThreadMs; }
  get canFetch(): boolean { return this.fetches < this.budget.maxConcurrentFetches; }

  canActivate(gpuBytes: number): boolean {
    if (this.activations >= this.budget.maxActivationsPerFrame) return false;
    if (this.uploadedBytes + gpuBytes > this.budget.gpuUploadBytesPerFrame) return false;
    if (this.residentGpuBytes + gpuBytes > this.budget.gpuMemoryHardBytes) return false;
    return this.hasFrameTime;
  }

  /** True once memory is high enough that the cache should start letting things go. */
  get shouldEvict(): boolean { return this.residentGpuBytes > this.budget.gpuMemorySoftBytes; }

  fetchStarted(): void { this.fetches++; }
  fetchFinished(): void { this.fetches = Math.max(0, this.fetches - 1); }

  activated(cpuBytes: number, gpuBytes: number): void {
    this.activations++;
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
    this.uploadedBytes = 0;
    this.fetches = 0;
    this.residentCpuBytes = 0;
    this.residentGpuBytes = 0;
  }
}
