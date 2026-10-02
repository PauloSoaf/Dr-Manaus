import type { StreamingContext } from '../../providers/WorldProvider';
import type { ManagedDemand, ManagedStats, ManagedSubsystem } from '../../streaming/ManagedSubsystem';
import type { PlanetSurfaceGenerator } from '../PlanetSurface';
import type { BodyFixedPoint } from './PlanetVolumeEdit';
import { PlanetVolumeEditStore } from './PlanetVolumeEditStore';
import { PlanetVolumeField } from './PlanetVolumeField';
import { PlanetVolumeChunkCache, DEFAULT_VOLUME_CACHE_LIMITS } from './PlanetVolumeChunkCache';
import { PlanetVolumeChunkGenerationJob } from './PlanetVolumeChunkGenerator';
import { selectVolumeChunkDemand, DEFAULT_VOLUME_DEMAND, type PlanetVolumeDemandConfig } from './PlanetVolumeChunkDemand';
import { chunkKeyToString, DEFAULT_VOLUME_LOD, type PlanetVolumeLodConfig, type PlanetVolumeChunkKey } from './PlanetVolumeChunkKey';

export interface PlanetVolumeRuntimeOptions {
  readonly resolve: (context: StreamingContext) => { surface: PlanetSurfaceGenerator; observerBodyFixedM: BodyFixedPoint } | undefined;
  readonly edits?: PlanetVolumeEditStore;
  readonly lod?: PlanetVolumeLodConfig;
  readonly demand?: PlanetVolumeDemandConfig;
  readonly cacheLimits?: { maxChunks: number; maxBytes: number };
  readonly clock?: () => number;
}

/** Optional resident data, owned by the existing global scheduler. No scene, physics or power hooks. */
export class PlanetVolumeRuntime implements ManagedSubsystem {
  readonly id = 'planet/volume';
  readonly edits: PlanetVolumeEditStore;
  readonly cache: PlanetVolumeChunkCache;
  readonly lod: PlanetVolumeLodConfig;
  readonly demand: PlanetVolumeDemandConfig;
  private readonly clock: () => number;
  private enabled = false;
  private allowInterior = false;
  private field?: PlanetVolumeField;
  private observer?: BodyFixedPoint;
  private wanted: readonly PlanetVolumeChunkKey[] = [];
  private pending: PlanetVolumeChunkKey[] = [];
  private job?: PlanetVolumeChunkGenerationJob;
  private generatedThisFrame = 0;
  private generationMs = 0;
  private grantedMs = 0;
  private rejectedChunks = 0;

  constructor(private readonly options: PlanetVolumeRuntimeOptions) {
    this.edits = options.edits ?? new PlanetVolumeEditStore();
    this.cache = new PlanetVolumeChunkCache(options.cacheLimits ?? DEFAULT_VOLUME_CACHE_LIMITS,this.edits);
    this.lod = Object.freeze({ ...(options.lod ?? DEFAULT_VOLUME_LOD) });
    this.demand = Object.freeze({ ...(options.demand ?? DEFAULT_VOLUME_DEMAND) });
    this.clock = options.clock ?? (()=>performance.now());
  }
  /** Explicit diagnostic demand. Interior sampling is separately opt-in for through-body tests. */
  setDebugDemand(enabled: boolean, allowInterior = false): void {
    this.enabled = enabled; this.allowInterior = enabled && allowInterior;
    if (!enabled) this.deactivate();
  }
  private deactivate(): void {
    this.cache.clearAll(); this.field = undefined; this.observer = undefined;
    this.wanted = []; this.pending = []; this.job = undefined;
  }
  covers(context: StreamingContext): boolean {
    this.generatedThisFrame = 0; this.generationMs = 0; this.grantedMs = 0;
    if (!this.enabled) { this.deactivate(); return false; }
    const resolved = this.options.resolve(context);
    if (!resolved || !resolved.observerBodyFixedM.every(Number.isFinite)) { this.deactivate(); return false; }
    if (this.field?.surface !== resolved.surface) {
      // Factories may return equivalent wrappers. Body identity selects ownership, not wrapper identity.
      if (this.field?.bodyId !== resolved.surface.body.id) this.deactivate();
      this.field ??= new PlanetVolumeField(resolved.surface,this.edits);
    }
    const field = this.field!;
    this.observer = [...resolved.observerBodyFixedM] as [number,number,number];
    if (!this.allowInterior && Math.abs(field.baseSignedDistance(this.observer)) > 2048) {
      this.deactivate(); return false;
    }
    const selected = selectVolumeChunkDemand(field.bodyId,this.observer,this.lod,this.demand,!this.allowInterior);
    // A demand larger than the cache would constantly evict and regenerate itself. Bound it by both caps.
    const chunkBytes = this.lod.samplesPerAxis**3*Float32Array.BYTES_PER_ELEMENT;
    const capacity = Math.min(this.cache.limits.maxChunks,Math.floor(this.cache.limits.maxBytes/chunkBytes));
    this.wanted = selected.slice(0,capacity).map(d=>d.key);
    const ids = new Set(this.wanted.map(chunkKeyToString));
    this.cache.retainNear(field.bodyId,this.observer,this.demand.radiusM*1.5,ids);
    // Touch far entries first so nearest entries survive LRU pressure.
    for (const key of [...this.wanted].reverse()) this.cache.get(key);
    this.pending = this.wanted.filter(key=>!this.cache.has(key));
    if (this.job && (this.job.obsolete || !ids.has(chunkKeyToString(this.job.key)))) this.job = undefined;
    return this.wanted.length > 0;
  }
  plan(_context: StreamingContext): readonly ManagedDemand[] {
    return this.pending.length ? [{ id: this.id, pending: this.pending.length, estimatedMs: this.pending.length*4, critical: false }] : [];
  }
  advance(budgetMs: number): void {
    if (!this.field || !this.pending.length || !Number.isFinite(budgetMs) || budgetMs <= 0 || this.generatedThisFrame >= 1) return;
    this.grantedMs += budgetMs;
    const start = this.clock(), deadline = start + budgetMs;
    if (this.job?.obsolete) this.job = undefined;
    while (this.generatedThisFrame < 1 && this.pending.length && this.clock() < deadline) {
      this.job ??= new PlanetVolumeChunkGenerationJob(this.field,this.pending[0],this.lod);
      if (this.job.advance(128)) {
        const chunk = this.job.chunk!;
        if (!this.cache.insert(chunk)) this.rejectedChunks++;
        this.pending = this.pending.filter(key=>chunkKeyToString(key)!==chunkKeyToString(chunk.key));
        this.job = undefined; this.generatedThisFrame++;
      }
    }
    this.generationMs += Math.max(0,this.clock()-start);
  }
  stats(): ManagedStats { return { id: this.id, pending: this.pending.length, grantedMs: this.grantedMs }; }
  get metrics() {
    const nearest = this.wanted[0] && this.cache.peek(this.wanted[0]);
    return { bodyId: this.field?.bodyId, revision: this.field ? this.edits.revision(this.field.bodyId) : 0,
      ...this.cache.stats(), pending: this.pending.length, pendingBytes: this.job?.pendingBytes ?? 0,
      generatedThisFrame: this.generatedThisFrame, generationMs: this.generationMs, grantedMs: this.grantedMs,
      rejectedChunks: this.rejectedChunks, nearestChunk: this.wanted[0] && chunkKeyToString(this.wanted[0]),
      nearestOverlappingEdits: nearest?.overlappingEditCount ?? 0 };
  }
  debugMetrics(): Record<string,string|number> {
    const m = this.metrics;
    return { 'Volume · Corpo': m.bodyId ?? 'inativo', 'Volume · Residentes / fila / stale': `${m.resident} / ${m.pending} / ${m.stale}`,
      'Volume · MB amostras / job': `${(m.bytes/1048576).toFixed(3)} / ${(m.pendingBytes/1048576).toFixed(3)}`,
      'Volume · Geração / ms': `${m.generatedThisFrame} / ${m.generationMs.toFixed(2)}`,
      'Volume · Cache hit / miss': `${m.hits} / ${m.misses}`,
      'Volume · LOD': Object.entries(m.lodCounts).map(([lod,count])=>`L${lod} ${count}`).join(' · ') || '—',
      'Volume · Revisão / edits chunk': `${m.revision} / ${m.nearestOverlappingEdits}`,
      'Volume · Chunk próximo': m.nearestChunk ?? '—' };
  }
  dispose(): void { this.deactivate(); this.cache.dispose(); }
}
