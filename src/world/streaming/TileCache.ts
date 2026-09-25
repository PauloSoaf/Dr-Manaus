import { finite } from '../spatial/units';
import { type TilePayload, tileKeyToString, type WorldTileKey } from './TileDemand';

interface CacheEntry {
  readonly key: string;
  readonly payload: TilePayload;
  lastUsedS: number;
  pinned: boolean;
}

export interface TileCacheOptions {
  /** Bytes of decoded CPU payload to keep. Eviction starts once this is exceeded. */
  maxCpuBytes?: number;
  /** Hard cap on entries, so many tiny tiles cannot slip past a byte budget. */
  maxEntries?: number;
}

export interface TileCacheStats {
  readonly entries: number;
  readonly cpuBytes: number;
  readonly pinned: number;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
}

/**
 * Decoded tiles held between activations.
 *
 * The point of the cache is turning around: fly past a block, come back, and the geometry should
 * not have to be fetched and decoded again. It evicts least-recently-used, except that pinned
 * tiles are never evicted — the tile the player is standing on and a teleport destination that is
 * still assembling must survive whatever else is happening.
 */
export class TileCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly options: Required<TileCacheOptions>;
  private cpuBytes = 0;
  private clockS = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: TileCacheOptions = {}) {
    this.options = {
      maxCpuBytes: Math.max(1, finite(options.maxCpuBytes, 192 * 1024 * 1024)),
      maxEntries: Math.max(1, finite(options.maxEntries, 512)),
    };
  }

  get stats(): TileCacheStats {
    let pinned = 0;
    for (const entry of this.entries.values()) if (entry.pinned) pinned++;
    return {
      entries: this.entries.size, cpuBytes: this.cpuBytes, pinned,
      hits: this.hits, misses: this.misses, evictions: this.evictions,
    };
  }

  /** Advances the cache's notion of now. Used for recency without reading a wall clock. */
  tick(dtS: number): void {
    this.clockS += Math.max(0, finite(dtS));
  }

  has(key: WorldTileKey): boolean { return this.entries.has(tileKeyToString(key)); }

  get(key: WorldTileKey): TilePayload | undefined {
    const entry = this.entries.get(tileKeyToString(key));
    if (!entry) { this.misses++; return undefined; }
    entry.lastUsedS = this.clockS;
    this.hits++;
    return entry.payload;
  }

  /** Stores a payload, evicting as needed. A payload larger than the whole budget is refused. */
  set(payload: TilePayload): boolean {
    const key = tileKeyToString(payload.key);
    const bytes = Math.max(0, finite(payload.cpuBytes));
    if (bytes > this.options.maxCpuBytes) return false;

    const existing = this.entries.get(key);
    if (existing) {
      this.cpuBytes -= Math.max(0, finite(existing.payload.cpuBytes));
      this.entries.delete(key);
    }
    this.entries.set(key, { key, payload, lastUsedS: this.clockS, pinned: existing?.pinned ?? false });
    this.cpuBytes += bytes;
    this.evictIfNeeded();
    return true;
  }

  /**
   * Keeps a tile no matter how long it has been idle. The caller owns the matching unpin: a pin
   * that is never released is a memory leak with a polite name.
   */
  pin(key: WorldTileKey): void {
    const entry = this.entries.get(tileKeyToString(key));
    if (entry) entry.pinned = true;
  }

  unpin(key: WorldTileKey): void {
    const entry = this.entries.get(tileKeyToString(key));
    if (entry) entry.pinned = false;
  }

  isPinned(key: WorldTileKey): boolean {
    return this.entries.get(tileKeyToString(key))?.pinned ?? false;
  }

  delete(key: WorldTileKey): boolean {
    const id = tileKeyToString(key);
    const entry = this.entries.get(id);
    if (!entry) return false;
    this.cpuBytes -= Math.max(0, finite(entry.payload.cpuBytes));
    return this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
    this.cpuBytes = 0;
  }

  /**
   * Drops least-recently-used entries until the cache is inside both budgets.
   *
   * If every remaining entry is pinned it stops rather than spinning — being over budget with
   * nothing evictable is a real state, and the scheduler learns about it through the stats rather
   * than through a hang.
   */
  private evictIfNeeded(): void {
    while (this.cpuBytes > this.options.maxCpuBytes || this.entries.size > this.options.maxEntries) {
      let oldest: CacheEntry | undefined;
      for (const entry of this.entries.values()) {
        if (entry.pinned) continue;
        if (!oldest || entry.lastUsedS < oldest.lastUsedS) oldest = entry;
      }
      if (!oldest) return;
      this.cpuBytes -= Math.max(0, finite(oldest.payload.cpuBytes));
      this.entries.delete(oldest.key);
      this.evictions++;
    }
  }
}
