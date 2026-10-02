import { planetVolumeBoundsIntersect, type BodyFixedPoint, type PlanetVolumeBounds } from './PlanetVolumeEdit';
import { chunkByteLength, type PlanetVolumeChunk } from './PlanetVolumeChunk';
import { chunkKeyToString, type PlanetVolumeChunkKey } from './PlanetVolumeChunkKey';
import type { PlanetVolumeEditStore } from './PlanetVolumeEditStore';

export const DEFAULT_VOLUME_CACHE_LIMITS = Object.freeze({ maxChunks: 64, maxBytes: 2 * 1024 * 1024 });
export function distanceToVolumeBoundsSquared(point: BodyFixedPoint, bounds: PlanetVolumeBounds): number {
  let sum = 0;
  for (let axis = 0; axis < 3; axis++) {
    const d = Math.max(bounds.minBodyFixedM[axis] - point[axis], 0, point[axis] - bounds.maxBodyFixedM[axis]);
    sum += d*d;
  }
  return sum;
}

/** Derived samples only. Map insertion order is LRU; stale entries still count against both limits. */
export class PlanetVolumeChunkCache {
  private readonly entries = new Map<string, PlanetVolumeChunk>();
  private bytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private readonly unsubscribe?: () => void;
  readonly limits: Readonly<{ maxChunks: number; maxBytes: number }>;
  constructor(limits: { maxChunks: number; maxBytes: number } = DEFAULT_VOLUME_CACHE_LIMITS, edits?: PlanetVolumeEditStore) {
    if (!Number.isSafeInteger(limits.maxChunks) || limits.maxChunks < 1
      || !Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 1) throw new RangeError('invalid volume cache limits');
    this.limits = Object.freeze({ ...limits });
    this.unsubscribe = edits?.subscribe(change => this.invalidate(change.bodyId, change.bounds));
  }
  peek(key: PlanetVolumeChunkKey): PlanetVolumeChunk | undefined { return this.entries.get(chunkKeyToString(key)); }
  has(key: PlanetVolumeChunkKey): boolean { return this.peek(key)?.state === 'ready'; }
  get(key: PlanetVolumeChunkKey): PlanetVolumeChunk | undefined {
    const id = chunkKeyToString(key), chunk = this.entries.get(id);
    if (!chunk || chunk.state === 'stale') { this.misses++; return undefined; }
    this.hits++; this.entries.delete(id); this.entries.set(id, chunk); return chunk;
  }
  insert(chunk: PlanetVolumeChunk): boolean {
    const bytes = chunkByteLength(chunk);
    if (bytes > this.limits.maxBytes) return false;
    this.remove(chunk.key);
    while (this.entries.size >= this.limits.maxChunks || this.bytes + bytes > this.limits.maxBytes) {
      const oldest = this.entries.values().next().value!;
      this.remove(oldest.key); this.evictions++;
    }
    this.entries.set(chunkKeyToString(chunk.key), chunk); this.bytes += bytes; return true;
  }
  remove(key: PlanetVolumeChunkKey): boolean {
    const id = chunkKeyToString(key), chunk = this.entries.get(id);
    if (!chunk) return false;
    this.bytes -= chunkByteLength(chunk); this.entries.delete(id); return true;
  }
  invalidate(bodyId: string, bounds: PlanetVolumeBounds): number {
    let count = 0;
    for (const chunk of this.entries.values()) {
      // The numerical CSG distance can change outside the cut AABB, up to the sampled intact depth.
      if (chunk.key.bodyId === bodyId && planetVolumeBoundsIntersect(chunk.editQueryBoundsBodyFixedM, bounds)) {
        if (chunk.state !== 'stale') count++;
        chunk.state = 'stale';
      }
    }
    return count;
  }
  clearBody(bodyId: string): void {
    for (const chunk of this.entries.values()) if (chunk.key.bodyId === bodyId) this.remove(chunk.key);
  }
  clearAll(): void { this.entries.clear(); this.bytes = 0; }
  retainNear(bodyId: string, point: BodyFixedPoint, radiusM: number, demanded: ReadonlySet<string>): void {
    for (const [id, chunk] of this.entries) {
      if (chunk.key.bodyId === bodyId && !demanded.has(id)
        && distanceToVolumeBoundsSquared(point, chunk.boundsBodyFixedM) > radiusM*radiusM) {
        this.remove(chunk.key); this.evictions++;
      }
    }
  }
  stats(bodyId?: string) {
    let resident = 0, stale = 0, distanceBytes = 0, materialBytes = 0;
    const lodCounts: Record<number, number> = {};
    for (const chunk of this.entries.values()) {
      if (bodyId !== undefined && chunk.key.bodyId !== bodyId) continue;
      resident++; stale += Number(chunk.state === 'stale'); distanceBytes += chunk.distances.byteLength;
      materialBytes += chunk.materials?.byteLength ?? 0;
      lodCounts[chunk.key.lod] = (lodCounts[chunk.key.lod] ?? 0) + 1;
    }
    return { resident, stale, bytes: distanceBytes + materialBytes, distanceBytes, materialBytes,
      hits: this.hits, misses: this.misses, evictions: this.evictions, lodCounts };
  }
  dispose(): void { this.unsubscribe?.(); this.clearAll(); }
}
