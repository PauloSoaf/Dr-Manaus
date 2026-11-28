/**
 * Streaming measurements, cheap enough to stay in release builds; the F3 panel reads them.
 *
 * Timings are main-thread milliseconds:
 * - `queueWait`: from a chunk becoming needed until a worker receives it;
 * - `generation`: from that dispatch until the payload arrives (transfer included);
 * - `build`: CPU construction of the chunk meshes (the GPU upload happens later, inside the
 *   renderer, and is not observable here);
 * - `latency`: from a chunk becoming needed until it is drawn.
 */
export type StreamingSample = 'queueWait' | 'generation' | 'build' | 'latency';
export type StreamingCount = 'requested' | 'generated' | 'activated' | 'reused' | 'cancelled' | 'discarded' | 'failed';
export interface SampleSummary { count: number; p50: number; p95: number; p99: number }

/** A fixed window of the most recent non-negative samples, with nearest-rank percentiles. */
export class SampleWindow {
  private readonly values: Float64Array;
  private length = 0;
  private cursor = 0;

  constructor(capacity = 256) { this.values = new Float64Array(Math.max(1, Math.floor(capacity))); }

  add(value: number): void {
    if (!(value >= 0 && Number.isFinite(value))) return;
    this.values[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.values.length;
    this.length = Math.min(this.length + 1, this.values.length);
  }

  summary(): SampleSummary {
    const sorted = this.values.slice(0, this.length).sort();
    const at = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1))] : 0;
    return { count: sorted.length, p50: at(50), p95: at(95), p99: at(99) };
  }
}

export class StreamingDiagnostics {
  readonly counts: Record<StreamingCount, number> = {
    requested: 0, generated: 0, activated: 0, reused: 0, cancelled: 0, discarded: 0, failed: 0,
  };
  private readonly windows: Record<StreamingSample, SampleWindow> = {
    queueWait: new SampleWindow(), generation: new SampleWindow(), build: new SampleWindow(), latency: new SampleWindow(),
  };
  private regionStartedAt: number | null = null;
  /** Since the latest region change: until the 3×3 neighbourhood was drawn; null while pending. */
  physicalCoverageMs: number | null = null;
  /** Since the latest region change: until every tile the plan wants drawn was; null while pending. */
  detailCoverageMs: number | null = null;

  count(name: StreamingCount, amount = 1): void { this.counts[name] += amount; }
  sample(name: StreamingSample, ms: number): void { this.windows[name].add(ms); }
  summary(name: StreamingSample): SampleSummary { return this.windows[name].summary(); }

  /** Share of activations whose data already existed when the chunk became needed. */
  get cacheHitRate(): number { return this.counts.activated ? this.counts.reused / this.counts.activated : 0; }

  startRegion(now: number): void {
    this.regionStartedAt = now;
    this.physicalCoverageMs = null;
    this.detailCoverageMs = null;
  }

  get awaitingCoverage(): boolean {
    return this.regionStartedAt !== null && (this.physicalCoverageMs === null || this.detailCoverageMs === null);
  }

  /** Records the first moment each coverage level holds after a region change. */
  recordCoverage(now: number, physical: boolean, detail: boolean): void {
    if (this.regionStartedAt === null) return;
    if (physical) this.physicalCoverageMs ??= now - this.regionStartedAt;
    if (detail) this.detailCoverageMs ??= now - this.regionStartedAt;
  }
}
