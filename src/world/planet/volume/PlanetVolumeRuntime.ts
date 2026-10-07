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
import { PlanetVolumeCollisionCache } from './PlanetVolumeCollisionCache';
import { PlanetVolumeCollisionBuildJob } from './PlanetVolumeCollisionBuilder';
import type { PlanetVolumeCollider } from './PlanetVolumeCollider';
import type { PlanetVolumeChunk } from './PlanetVolumeChunk';
import type { PlanetVolumeMesh } from './PlanetVolumeMesh';
import type { PlanetVolumeCollisionProvider } from './PlanetVolumeCollisionProvider';
import { selectImpactVolumeDemand } from './PlanetVolumeImpactDemand';
import { PlanetVolumeReplacementCoverage, type PlanetVolumePublication, type PlanetVolumeReplacement } from './PlanetVolumeReplacementCoverage';
import { volumeMeshByteLength } from './PlanetVolumeMesh';
import type { RockyImpactEditPlan } from '../../destruction/RockyImpactDestructionPolicy';

export interface PlanetVolumeRuntimeOptions {
  readonly resolve: (context: StreamingContext) => { surface: PlanetSurfaceGenerator; observerBodyFixedM: BodyFixedPoint } | undefined;
  readonly edits?: PlanetVolumeEditStore;
  readonly lod?: PlanetVolumeLodConfig;
  readonly demand?: PlanetVolumeDemandConfig;
  readonly cacheLimits?: { maxChunks: number; maxBytes: number };
  readonly meshLimits?: { maxMeshes: number; maxBytes: number };
  readonly collisionLimits?: { maxColliders: number; maxBytes: number };
  readonly clock?: () => number;
}

/** Optional samples/meshes/colliders under the existing scheduler. No scene or power hooks. */
export class PlanetVolumeRuntime implements ManagedSubsystem {
  readonly id = 'planet/volume';
  readonly edits: PlanetVolumeEditStore;
  readonly cache: PlanetVolumeChunkCache;
  readonly lod: PlanetVolumeLodConfig;
  readonly demand: PlanetVolumeDemandConfig;
  readonly meshCache: PlanetVolumeMeshCache;
  readonly collisionCache: PlanetVolumeCollisionCache;
  readonly replacement = new PlanetVolumeReplacementCoverage();
  private publication?: PlanetVolumePublication;
  private productionActive=false;
  private requestedImpact?: string;
  private publicationMs=0;
  private renderPreparationMs=0;
  private publicationBlocked='';
  requestImpactRegion(editId:string,_plan:RockyImpactEditPlan):void {this.requestedImpact=editId;}
  setImpactPublication(publication:PlanetVolumePublication):void {this.publication=publication;}
  private collisionEnabled=false;
  private collisionWanted:readonly PlanetVolumeChunkKey[]=[];
  private collisionPending:PlanetVolumeMesh[]=[];
  private collisionJob?:PlanetVolumeCollisionBuildJob;
  private collisionStaged:{source:PlanetVolumeChunk;collider?:PlanetVolumeCollider}[]=[];
  private collisionBuiltThisFrame=0;
  private collisionBuildMs=0;
  private collisionUnitMs=.003;
  private collisionQueries?:PlanetVolumeCollisionProvider['metrics'];
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
    this.collisionCache = new PlanetVolumeCollisionCache(options.collisionLimits);
    this.lod = Object.freeze({ ...(options.lod ?? DEFAULT_VOLUME_LOD) });
    this.demand = Object.freeze({ ...(options.demand ?? DEFAULT_VOLUME_DEMAND) });
    this.clock = options.clock ?? (()=>performance.now());
  }
  /** Explicit diagnostic demand. Interior sampling is separately opt-in for through-body tests. */
  setDebugDemand(enabled: boolean, allowInterior = false): void {
    this.enabled = enabled; this.allowInterior = enabled && allowInterior;
    if (!enabled && !this.productionActive) this.deactivate();
  }
  /** CPU extraction only; a debug renderer may consume the ready payloads separately. */
  setDebugMeshing(enabled: boolean): void {
    this.meshingEnabled=enabled;
    if(!enabled && !this.productionActive) {this.setDebugCollision(false);this.meshCache.clearAll();this.meshJob=undefined;this.meshPending=[];this.meshWanted=[];}
  }
  /** Explicit D0 activation only. Does not bind PhysicsWorld or change ordinary terrain. */
  setDebugCollision(enabled:boolean):void {
    this.collisionEnabled=enabled;if(enabled)this.meshingEnabled=true;
    else if(!this.productionActive) {this.collisionCache.clearAll();this.collisionJob=undefined;this.collisionStaged=[];this.collisionWanted=[];this.collisionPending=[];}
  }
  setCollisionDiagnostics(metrics:PlanetVolumeCollisionProvider['metrics']|undefined):void {this.collisionQueries=metrics;}
  get meshes() {this.meshCache.prune(this.cache);return this.meshCache.values();}
  private deactivate(): void {
    this.replacement.clear();this.publication?.clear();this.productionActive=false;
    this.collisionCache.clearAll();this.collisionJob=undefined;this.collisionStaged=[];this.collisionWanted=[];this.collisionPending=[];
    this.cache.clearAll(); this.field = undefined; this.observer = undefined;
    this.wanted = []; this.pending = []; this.job = undefined;
    this.meshCache.clearAll();this.meshJob=undefined;this.meshWanted=[];this.meshPending=[];
  }
  covers(context: StreamingContext): boolean {
    this.commitCollisions();this.collisionBuiltThisFrame=0;this.collisionBuildMs=0;
    this.generatedThisFrame = 0; this.generationMs = 0; this.grantedMs = 0;
    this.meshedThisFrame=0;this.meshingMs=0;
    this.renderPreparationMs=0;
    if(!this.enabled&&!this.edits.editsForBody(context.spatial.bodyId??'').some(edit=>edit.type==='subtract-sphere'&&edit.impact)) {
      this.deactivate();return false;
    }
    const resolved = this.options.resolve(context);
    if (!resolved || !resolved.observerBodyFixedM.every(Number.isFinite)) { this.deactivate(); return false; }
    if (this.field?.surface !== resolved.surface) {
      // Factories may return equivalent wrappers. Body identity selects ownership, not wrapper identity.
      if (this.field?.bodyId !== resolved.surface.body.id) this.deactivate();
      this.field ??= new PlanetVolumeField(resolved.surface,this.edits);
    }
    const field = this.field!;
    this.observer = [...resolved.observerBodyFixedM] as [number,number,number];
    // A demand larger than the cache would constantly evict and regenerate itself. Bound it by both caps.
    const chunkBytes = this.lod.samplesPerAxis**3*Float32Array.BYTES_PER_ELEMENT;
    const capacity = Math.min(this.cache.limits.maxChunks,Math.floor(this.cache.limits.maxBytes/chunkBytes));
    const impact=selectImpactVolumeDemand(this.edits,field.bodyId,this.observer,this.lod,
      Math.min(capacity,this.meshCache.limits.maxMeshes,this.collisionCache.limits.maxColliders));
    this.productionActive=impact.length>0;
    if(!this.productionActive && (!this.enabled || (!this.allowInterior&&Math.abs(field.baseSignedDistance(this.observer))>2048))){this.deactivate();return false;}
    this.wanted=this.productionActive?impact:selectVolumeChunkDemand(field.bodyId,this.observer,this.lod,this.demand,!this.allowInterior).slice(0,capacity).map(d=>d.key);
    const ids = new Set(this.wanted.map(chunkKeyToString));
    this.publication?.retainStaged?.(ids);
    if(this.productionActive)this.collisionStaged=this.collisionStaged.filter(entry=>ids.has(chunkKeyToString(entry.source.key)));
    this.cache.retainNear(field.bodyId,this.observer,this.demand.radiusM*1.5,ids);
    // Touch far entries first so nearest entries survive LRU pressure.
    for (const key of [...this.wanted].reverse()) this.cache.get(key);
    this.pending = this.wanted.filter(key=>!this.cache.has(key));
    if (this.job && (this.job.obsolete || !ids.has(chunkKeyToString(this.job.key)))) this.job = undefined;
    this.planMeshes();
    this.planCollisions();
    return this.wanted.length > 0;
  }
  private planMeshes():void {
    const maximum=maximumVolumeMeshBytes(this.lod.samplesPerAxis);
    const supported=this.lod.samplesPerAxis**3*28+96+maximum*2<=MAX_VOLUME_MESH_JOB_BYTES;
    const capacity=(this.meshingEnabled||this.productionActive)&&supported?(this.productionActive?this.meshCache.limits.maxMeshes:
      Math.min(this.meshCache.limits.maxMeshes,Math.floor(this.meshCache.limits.maxBytes/maximum))):0;
    this.meshWanted=this.wanted.filter(key=>{const c=this.cache.peek(key);return c?.state==='ready'&&c.classification==='MIXED';}).slice(0,capacity);
    const wanted=new Set(this.meshWanted.map(chunkKeyToString));this.meshCache.prune(this.cache,wanted);
    this.meshPending=this.meshWanted.filter(key=>!this.meshCache.get(this.cache.peek(key)!));
    if(this.meshJob&&(this.meshJob.obsolete||this.cache.peek(this.meshJob.chunk.key)!==this.meshJob.chunk
      ||!wanted.has(chunkKeyToString(this.meshJob.chunk.key)))) this.meshJob=undefined;
  }
  plan(_context: StreamingContext): readonly ManagedDemand[] {
    const pending=this.pending.length+this.meshPending.length+this.collisionPending.length+this.collisionStaged.length;
    return pending ? [{ id: this.id, pending, estimatedMs: pending*4, critical: false }] : [];
  }
  advance(budgetMs: number): void {
    if (!this.field || !Number.isFinite(budgetMs) || budgetMs <= 0) return;
    this.grantedMs += budgetMs;
    const start = this.clock(), deadline = start + budgetMs;
    if (this.job?.obsolete) this.job = undefined;
    if (this.meshJob?.obsolete) this.meshJob=undefined;
    if (this.collisionJob?.obsolete) this.collisionJob=undefined;
    while(this.clock()<deadline) {
      const sampleKey=this.generatedThisFrame<1?this.pending[0]:undefined;
      const meshKey=this.meshedThisFrame<1?this.meshPending[0]:undefined;
      if(!this.job&&!this.meshJob&&!this.collisionJob) {
        const mesh=this.collisionBuiltThisFrame<1?this.collisionPending[0]:undefined;
        if(mesh) this.collisionJob=new PlanetVolumeCollisionBuildJob(mesh,this.cache.peek(mesh.key));
        else {
        if(meshKey&&(!sampleKey||this.wanted.indexOf(meshKey)<=this.wanted.indexOf(sampleKey))) {
          this.meshJob=new PlanetVolumeMeshingJob(this.cache.peek(meshKey)!);
        } else if(sampleKey) this.job=new PlanetVolumeChunkGenerationJob(this.field,sampleKey,this.lod);
        else break;
        }
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
          this.planCollisions();
        }
      } else if(this.meshJob) {
        const batch=Math.max(1,Math.min(64,Math.floor(target/this.meshingUnitMs)));
        const done=this.meshJob.advance(batch),elapsed=Math.max(0,this.clock()-before);
        this.meshingMs+=elapsed;this.meshingUnitMs=Math.max(.00001,this.meshingUnitMs*.8+elapsed/batch*.2);
        if(done) {
          this.meshCache.insert(this.meshJob.chunk,this.meshJob.mesh!);
          this.meshJob=undefined;this.meshedThisFrame++;this.planMeshes();
          this.planCollisions();
        }
      } else if(this.collisionJob) {
        const batch=Math.max(1,Math.min(128,Math.floor(target/this.collisionUnitMs))),done=this.collisionJob.advance(batch),elapsed=Math.max(0,this.clock()-before);
        this.collisionBuildMs+=elapsed;this.collisionUnitMs=Math.max(.00001,this.collisionUnitMs*.8+elapsed/batch*.2);
        if(done) {this.collisionStaged.push({source:this.collisionJob.source!,collider:this.collisionJob.collider});
          if(this.productionActive){const renderStart=this.clock();
            this.publication?.prepareOne?.({source:this.collisionJob.source!,mesh:this.collisionJob.mesh,collider:this.collisionJob.collider});
            this.renderPreparationMs+=Math.max(0,this.clock()-renderStart);}
          const mesh=this.collisionJob.mesh;this.collisionPending=this.collisionPending.filter(candidate=>candidate!==mesh);
          this.collisionJob=undefined;this.collisionBuiltThisFrame++;}
      }
    }
  }
  private commitCollisions():void {
    if(this.productionActive){this.commitImpactReplacement();return;}
    // covers() is the frame boundary. Reject obsolete staged results before publication.
    for(const {source,collider} of this.collisionStaged) {
      if(source.state!=='ready'||this.cache.peek(source.key)!==source)continue;
      if(collider)this.collisionCache.insert(collider);else this.collisionCache.remove(source.key);
    }
    this.collisionStaged=[];
  }
  private planCollisions():void {
    if(!this.collisionEnabled&&!this.productionActive)return;
    // One finest LOD only, selected independently of far visual LOD. Existing demand is near-first.
    this.collisionWanted=this.wanted.filter(key=>key.lod===0).slice(0,this.collisionCache.limits.maxColliders);
    const wanted=new Set(this.collisionWanted.map(chunkKeyToString));if(!this.productionActive)this.collisionCache.prune(wanted);
    const pending:PlanetVolumeMesh[]=[];
    for(const key of this.collisionWanted) {
      const chunk=this.cache.peek(key);if(!chunk||chunk.state!=='ready')continue;
      if(chunk.classification!=='MIXED') {
        if((this.productionActive||this.collisionCache.peek(key))&&!this.collisionStaged.some(item=>item.source===chunk))this.collisionStaged.push({source:chunk});
        continue;
      }
      const mesh=this.meshCache.get(chunk);if(!mesh||this.collisionCache.peek(key)?.sourceMesh===mesh)continue;
      if(!this.collisionStaged.some(item=>item.collider?.sourceMesh===mesh))pending.push(mesh);
    }
    this.collisionPending=pending;
    if(this.collisionJob&&(this.collisionJob.obsolete||this.cache.peek(this.collisionJob.mesh.key)!==this.collisionJob.source
      ||!wanted.has(chunkKeyToString(this.collisionJob.mesh.key))))this.collisionJob=undefined;
  }
  private commitImpactReplacement():void {
    if(!this.publication||!this.wanted.length)return;
    const entries:PlanetVolumeReplacement[]=[];
    for(const key of this.wanted) {
      const source=this.cache.peek(key);if(!source||source.state!=='ready')return;
      if(source.classification!=='MIXED'){entries.push({source});continue;}
      const mesh=this.meshCache.get(source);if(!mesh)return;
      const installed=this.collisionCache.peek(key),collider=installed?.sourceMesh===mesh?installed:
        this.collisionStaged.find(entry=>entry.source===source&&entry.collider?.sourceMesh===mesh)?.collider;
      if(!collider)return;
      entries.push({source,mesh,collider});
    }
    const old=this.replacement.entries;
    if(old.length===entries.length&&entries.every(entry=>old.some(prior=>prior.source===entry.source)))return;
    if(entries.reduce((sum,e)=>sum+(e.collider?.memory.bytes??0),0)>this.collisionCache.limits.maxBytes
      ||entries.reduce((sum,e)=>sum+(e.mesh?volumeMeshByteLength(e.mesh):0),0)>this.meshCache.limits.maxBytes){this.publicationBlocked='replacement-byte-budget';return;}
    const before=this.clock();
    if(!this.publication.prepare(entries)){this.publicationBlocked='render-not-ready';return;}
    // All sources, MC geometry, BVHs and render representations are ready. No async callback
    // or physics/render query runs inside this synchronous frame-boundary transaction.
    if(!this.collisionCache.replaceAll(entries.flatMap(entry=>entry.collider?[entry.collider]:[])))return;
    this.replacement.publish(entries);this.publication.commit(entries);
    this.collisionStaged=[];this.publicationBlocked='';this.publicationMs=Math.max(0,this.clock()-before);
  }
  stats(): ManagedStats { return { id: this.id, pending: this.pending.length+this.meshPending.length+this.collisionPending.length+this.collisionStaged.length, grantedMs: this.grantedMs }; }
  get metrics() {
    this.meshCache.prune(this.cache);
    const meshes=this.meshCache.stats();
    const nearest = this.wanted[0] && this.cache.peek(this.wanted[0]);
    return { bodyId: this.field?.bodyId, revision: this.field ? this.edits.revision(this.field.bodyId) : 0,
      ...this.cache.stats(), pending: this.pending.length, pendingBytes: this.job?.pendingBytes ?? 0,
      generatedThisFrame: this.generatedThisFrame, generationMs: this.generationMs, grantedMs: this.grantedMs,
      rejectedChunks: this.rejectedChunks, nearestChunk: this.wanted[0] && chunkKeyToString(this.wanted[0]),
      meshingEnabled:this.meshingEnabled||this.productionActive,residentMeshes:meshes.resident,meshBytes:meshes.bytes,
      meshVertices:meshes.vertices,meshTriangles:meshes.triangles,
      ambiguousMeshFaces:meshes.ambiguousFaces,pendingMeshes:this.meshPending.length,
      productionActive:this.productionActive,publishedReplacements:this.replacement.entries.length,
      replacementGeneration:this.replacement.generation,publicationMs:this.publicationMs,publicationBlocked:this.publicationBlocked,
      renderPreparationMs:this.renderPreparationMs,
      retainedPublishedSampleBytes:this.replacement.entries.reduce((sum,e)=>sum+(this.cache.peek(e.source.key)===e.source?0:e.source.distances.byteLength+(e.source.materials?.byteLength??0)),0),
      requestedImpact:this.requestedImpact,
      meshJobBytes:this.meshJob?.pendingBytes??0,meshedThisFrame:this.meshedThisFrame,meshingMs:this.meshingMs,
      nearestOverlappingEdits: nearest?.overlappingEditCount ?? 0 };
  }
  get collisionMetrics(){return {bodyId:this.field?.bodyId,enabled:this.collisionEnabled||this.productionActive,...this.collisionCache.stats(),
    pending:this.collisionPending.length,staged:this.collisionStaged.length,pendingBytes:this.collisionJob?.pendingBytes??0,
    buildsThisFrame:this.collisionBuiltThisFrame,buildMs:this.collisionBuildMs,...(this.collisionQueries??{queries:0,candidateChunks:0,candidateTriangles:0,contacts:0,lastKind:'—',lastNormal:[0,0,0]})};}
  debugMetrics(): Record<string,string|number> {
    const m = this.metrics,c=this.collisionMetrics;
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
      'Volume · Faces ambíguas':m.ambiguousMeshFaces,
      'Planet Destruction · Published / mask':`${m.publishedReplacements} / ${m.publishedReplacements?'active':'inactive'}`,
      'Planet Destruction · Production / blocked':`${m.productionActive} / ${m.publicationBlocked||'—'}`,
      'Planet Destruction · Publication ms':m.publicationMs.toFixed(3),
      'Planet Destruction · Render prepare ms / retained sample MiB':`${m.renderPreparationMs.toFixed(3)} / ${(m.retainedPublishedSampleBytes/1048576).toFixed(3)}`,
      'Volume Collision · Body':c.bodyId??'—','Volume Collision · Resident':c.resident,
      'Volume Collision · Pending':`${c.pending} / ${c.staged}`,'Volume Collision · MB':(c.bytes/1048576).toFixed(3),
      'Volume Collision · Triangles':c.triangles,'Volume Collision · BVH nodes':c.nodes,
      'Volume Collision · Builds/frame':c.buildsThisFrame,'Volume Collision · Build ms':c.buildMs.toFixed(3),
      'Volume Collision · Queries/frame':c.queries,'Volume Collision · Candidate chunks':c.candidateChunks,
      'Volume Collision · Candidate triangles':c.candidateTriangles,'Volume Collision · Contacts':c.contacts,
      'Volume Collision · Last contact kind':c.lastKind,'Volume Collision · Last normal':c.lastNormal.join(',') };
  }
  dispose(): void { this.deactivate(); this.cache.dispose(); }
}
