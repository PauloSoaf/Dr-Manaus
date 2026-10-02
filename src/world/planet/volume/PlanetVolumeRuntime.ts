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
import { PlanetVolumeMeshingJob, MAX_VOLUME_MESH_JOB_BYTES } from './PlanetVolumeMesher';
import { PlanetVolumeMeshCache } from './PlanetVolumeMeshCache';
import { maximumVolumeMeshBytes } from './PlanetVolumeMesh';

export interface PlanetVolumeRuntimeOptions {
  readonly resolve: (context: StreamingContext) => { surface: PlanetSurfaceGenerator; observerBodyFixedM: BodyFixedPoint } | undefined;
  readonly edits?: PlanetVolumeEditStore;
  readonly lod?: PlanetVolumeLodConfig;
  readonly demand?: PlanetVolumeDemandConfig;
  readonly cacheLimits?: { maxChunks: number; maxBytes: number };
  readonly meshLimits?: { maxMeshes: number; maxBytes: number };
  readonly clock?: () => number;
}

/** Optional resident grids/meshes, owned by the existing scheduler. No scene, physics or power hooks. */
export class PlanetVolumeRuntime implements ManagedSubsystem {
  readonly id = 'planet/volume';
  readonly edits: PlanetVolumeEditStore;
  readonly cache: PlanetVolumeChunkCache;
  readonly lod: PlanetVolumeLodConfig;
  readonly demand: PlanetVolumeDemandConfig;
  readonly meshCache: PlanetVolumeMeshCache;
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
  private meshingEnabled = false;
  private meshWanted: readonly PlanetVolumeChunkKey[] = [];
  private meshPending: PlanetVolumeChunkKey[] = [];
  private meshJob?: PlanetVolumeMeshingJob;
  private meshedThisFrame = 0;
  private meshingMs = 0;
  private samplingUnitMs = .002;
  private meshingUnitMs = .004;

  constructor(private readonly options: PlanetVolumeRuntimeOptions) {
    this.edits = options.edits ?? new PlanetVolumeEditStore();
    this.cache = new PlanetVolumeChunkCache(options.cacheLimits ?? DEFAULT_VOLUME_CACHE_LIMITS,this.edits);
    this.meshCache = new PlanetVolumeMeshCache(options.meshLimits);
    this.lod = Object.freeze({ ...(options.lod ?? DEFAULT_VOLUME_LOD) });
    this.demand = Object.freeze({ ...(options.demand ?? DEFAULT_VOLUME_DEMAND) });
    this.clock = options.clock ?? (()=>performance.now());
  }
  /** Explicit diagnostic demand. Interior sampling is separately opt-in for through-body tests. */
  setDebugDemand(enabled: boolean, allowInterior = false): void {
    this.enabled = enabled; this.allowInterior = enabled && allowInterior;
    if (!enabled) this.deactivate();
  }
  /** CPU extraction only; a debug renderer may consume the ready payloads separately. */
  setDebugMeshing(enabled: boolean): void {
    this.meshingEnabled=enabled;
    if(!enabled) {this.meshCache.clearAll();this.meshJob=undefined;this.meshPending=[];this.meshWanted=[];}
  }
  get meshes() {this.meshCache.prune(this.cache);return this.meshCache.values();}
  private deactivate(): void {
    this.cache.clearAll(); this.field = undefined; this.observer = undefined;
    this.wanted = []; this.pending = []; this.job = undefined;
    this.meshCache.clearAll();this.meshJob=undefined;this.meshWanted=[];this.meshPending=[];
  }
  covers(context: StreamingContext): boolean {
    this.generatedThisFrame = 0; this.generationMs = 0; this.grantedMs = 0;
    this.meshedThisFrame=0;this.meshingMs=0;
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
    this.planMeshes();
    return this.wanted.length > 0;
  }
  private planMeshes():void {
    const maximum=maximumVolumeMeshBytes(this.lod.samplesPerAxis);
    const supported=this.lod.samplesPerAxis**3*28+96+maximum*2<=MAX_VOLUME_MESH_JOB_BYTES;
    const capacity=this.meshingEnabled&&supported?Math.min(this.meshCache.limits.maxMeshes,Math.floor(this.meshCache.limits.maxBytes/maximum)):0;
    this.meshWanted=this.wanted.filter(key=>{const c=this.cache.peek(key);return c?.state==='ready'&&c.classification==='MIXED';}).slice(0,capacity);
    const wanted=new Set(this.meshWanted.map(chunkKeyToString));this.meshCache.prune(this.cache,wanted);
    this.meshPending=this.meshWanted.filter(key=>!this.meshCache.get(this.cache.peek(key)!));
    if(this.meshJob&&(this.meshJob.obsolete||this.cache.peek(this.meshJob.chunk.key)!==this.meshJob.chunk
      ||!wanted.has(chunkKeyToString(this.meshJob.chunk.key)))) this.meshJob=undefined;
  }
  plan(_context: StreamingContext): readonly ManagedDemand[] {
    const pending=this.pending.length+this.meshPending.length;
    return pending ? [{ id: this.id, pending, estimatedMs: pending*4, critical: false }] : [];
  }
  advance(budgetMs: number): void {
    if (!this.field || !Number.isFinite(budgetMs) || budgetMs <= 0) return;
    this.grantedMs += budgetMs;
    const start = this.clock(), deadline = start + budgetMs;
    if (this.job?.obsolete) this.job = undefined;
    while(this.clock()<deadline) {
      const sampleKey=this.generatedThisFrame<1?this.pending[0]:undefined;
      const meshKey=this.meshedThisFrame<1?this.meshPending[0]:undefined;
      if(!this.job&&!this.meshJob) {
        if(meshKey&&(!sampleKey||this.wanted.indexOf(meshKey)<=this.wanted.indexOf(sampleKey))) {
          this.meshJob=new PlanetVolumeMeshingJob(this.cache.peek(meshKey)!);
        } else if(sampleKey) this.job=new PlanetVolumeChunkGenerationJob(this.field,sampleKey,this.lod);
        else break;
      }
      const before=this.clock(),remaining=Math.max(0,deadline-before);
      if(!remaining) break;
      const target=Math.min(.35,remaining*.5);
      if(this.job) {
        const batch=Math.max(1,Math.min(128,Math.floor(target/this.samplingUnitMs)));
        const done=this.job.advance(batch),elapsed=Math.max(0,this.clock()-before);
        this.generationMs+=elapsed;this.samplingUnitMs=Math.max(.00001,this.samplingUnitMs*.8+elapsed/batch*.2);
        if(done) {
          const chunk=this.job.chunk!;
          if(!this.cache.insert(chunk)) this.rejectedChunks++;
          this.pending=this.pending.filter(key=>chunkKeyToString(key)!==chunkKeyToString(chunk.key));
          this.job=undefined;this.generatedThisFrame++;this.planMeshes();
        }
      } else if(this.meshJob) {
        const batch=Math.max(1,Math.min(64,Math.floor(target/this.meshingUnitMs)));
        const done=this.meshJob.advance(batch),elapsed=Math.max(0,this.clock()-before);
        this.meshingMs+=elapsed;this.meshingUnitMs=Math.max(.00001,this.meshingUnitMs*.8+elapsed/batch*.2);
        if(done) {
          this.meshCache.insert(this.meshJob.chunk,this.meshJob.mesh!);
          this.meshJob=undefined;this.meshedThisFrame++;this.planMeshes();
        }
      }
    }
  }
  stats(): ManagedStats { return { id: this.id, pending: this.pending.length+this.meshPending.length, grantedMs: this.grantedMs }; }
  get metrics() {
    this.meshCache.prune(this.cache);
    const meshes=this.meshCache.stats();
    const nearest = this.wanted[0] && this.cache.peek(this.wanted[0]);
    return { bodyId: this.field?.bodyId, revision: this.field ? this.edits.revision(this.field.bodyId) : 0,
      ...this.cache.stats(), pending: this.pending.length, pendingBytes: this.job?.pendingBytes ?? 0,
      generatedThisFrame: this.generatedThisFrame, generationMs: this.generationMs, grantedMs: this.grantedMs,
      rejectedChunks: this.rejectedChunks, nearestChunk: this.wanted[0] && chunkKeyToString(this.wanted[0]),
      meshingEnabled:this.meshingEnabled,residentMeshes:meshes.resident,meshBytes:meshes.bytes,
      meshVertices:meshes.vertices,meshTriangles:meshes.triangles,
      ambiguousMeshFaces:meshes.ambiguousFaces,pendingMeshes:this.meshPending.length,
      meshJobBytes:this.meshJob?.pendingBytes??0,meshedThisFrame:this.meshedThisFrame,meshingMs:this.meshingMs,
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
      'Volume · Chunk próximo': m.nearestChunk ?? '—',
      'Volume · Malhas / fila':`${m.residentMeshes} / ${m.pendingMeshes}`,
      'Volume · Malhas MiB / job':`${(m.meshBytes/1048576).toFixed(3)} / ${(m.meshJobBytes/1048576).toFixed(3)}`,
      'Volume · Triângulos / vértices':`${m.meshTriangles} / ${m.meshVertices}`,
      'Volume · Mesh geração / ms':`${m.meshedThisFrame} / ${m.meshingMs.toFixed(2)}`,
      'Volume · Faces ambíguas':m.ambiguousMeshFaces };
  }
  dispose(): void { this.deactivate(); this.cache.dispose(); }
}
