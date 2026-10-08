import type { StreamingContext } from '../../providers/WorldProvider';
import type { ManagedDemand, ManagedStats, ManagedSubsystem } from '../../streaming/ManagedSubsystem';
import type { PlanetSurfaceGenerator } from '../PlanetSurface';
import type { BodyFixedPoint } from './PlanetVolumeEdit';
import { PlanetVolumeEditStore } from './PlanetVolumeEditStore';
import { PlanetVolumeField } from './PlanetVolumeField';
import { PlanetVolumeChunkCache, DEFAULT_VOLUME_CACHE_LIMITS } from './PlanetVolumeChunkCache';
import { PlanetVolumeChunkGenerationJob } from './PlanetVolumeChunkGenerator';
import { selectVolumeChunkDemand, DEFAULT_VOLUME_DEMAND, type PlanetVolumeDemandConfig } from './PlanetVolumeChunkDemand';
import { chunkKeyToString, DEFAULT_VOLUME_LOD,samplingConfigForKey,samplingProfileOf, type PlanetVolumeLodConfig, type PlanetVolumeChunkKey } from './PlanetVolumeChunkKey';
import { PlanetVolumeMeshingJob, volumeMeshJobByteLimit } from './PlanetVolumeMesher';
import { PlanetVolumeMeshCache } from './PlanetVolumeMeshCache';
import { maximumVolumeMeshBytes } from './PlanetVolumeMesh';
import { PlanetVolumeCollisionCache } from './PlanetVolumeCollisionCache';
import { PlanetVolumeCollisionBuildJob } from './PlanetVolumeCollisionBuilder';
import type { PlanetVolumeCollider } from './PlanetVolumeCollider';
import type { PlanetVolumeChunk } from './PlanetVolumeChunk';
import { chunkByteLength } from './PlanetVolumeChunk';
import type { PlanetVolumeMesh } from './PlanetVolumeMesh';
import type { PlanetVolumeCollisionProvider } from './PlanetVolumeCollisionProvider';
import { nearestImpactEdit,selectImpactSamplingProfile } from './PlanetVolumeImpactDemand';
import { MAX_COLLISION_BUILD_BYTES,requiredVolumeCollisionBuildBytes } from './PlanetVolumeCollisionBvh';
import { PlanetVolumeReplacementCoverage, type PlanetVolumePublication, type PlanetVolumeReplacement } from './PlanetVolumeReplacementCoverage';
import { volumeMeshByteLength } from './PlanetVolumeMesh';
import type { RockyImpactEditPlan } from '../../destruction/RockyImpactDestructionPolicy';
import {selectImpactResidency,type ImpactResidentRegion} from './PlanetImpactResidency';

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
  private admissionBlocked='';
  private impactProfile='standard';
  private impactRadiusM=0;
  private impactDepthM=0;
  private impactCapacity=0;
  private readonly blockedHighSources=new WeakSet<PlanetVolumeChunk>();
  private selectedRegions:readonly ImpactResidentRegion[]=[];
  private publishedRegions:readonly ImpactResidentRegion[]=[];
  private readonly blockedRegions=new Set<string>();
  private blockedRevision=-1;
  private blockedPriority='';
  private preparationMs=0;
  private footprint:readonly {editId:string;requestedRadiusM:number;replacementRadiusM:number;overshootM:number}[]=[];
  private prepared?:{entries:readonly PlanetVolumeReplacement[];regions:readonly ImpactResidentRegion[];collision:()=>void;coverage:()=>void;
    footprint:PlanetVolumeRuntime['footprint'];revision:number};
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
    this.selectedRegions=[];this.publishedRegions=[];this.blockedRegions.clear();this.blockedRevision=-1;this.blockedPriority='';this.prepared=undefined;this.footprint=[];
    this.replacement.clear();this.publication?.clear();this.productionActive=false;
    this.publicationBlocked='';this.impactProfile='standard';this.impactRadiusM=0;this.impactDepthM=0;this.impactCapacity=0;
    this.admissionBlocked='';
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
    this.preparationMs=0;
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
    const edit=nearestImpactEdit(this.edits,field.bodyId,this.observer),profile=edit?selectImpactSamplingProfile(edit):'standard';
    this.impactProfile=profile;this.impactRadiusM=edit?.impact?.craterRadiusM??0;this.impactDepthM=edit?.impact?.craterDepthM??0;
    const config=profile==='impact-high'?{...this.lod,samplesPerAxis:33}:this.lod;
    const chunkBytes = (config.samplesPerAxis**3+(profile==='impact-high'?6*config.samplesPerAxis**2:0))*Float32Array.BYTES_PER_ELEMENT;
    const capacity = Math.min(this.cache.limits.maxChunks,Math.floor(this.cache.limits.maxBytes/chunkBytes));
    // An admitted BVH build (shared mesh + scratch + nodes) is <=4 MiB. Thus its retained
    // mesh and collider are each <=4 MiB too. Use that conservative per-chunk bound for HIGH.
    this.impactCapacity=Math.min(capacity,this.meshCache.limits.maxMeshes,this.collisionCache.limits.maxColliders,
      ...(profile==='impact-high'?[Math.floor(this.meshCache.limits.maxBytes/MAX_COLLISION_BUILD_BYTES),
        Math.floor(this.collisionCache.limits.maxBytes/MAX_COLLISION_BUILD_BYTES)]:[]));
    const revision=this.edits.revision(field.bodyId);if(revision!==this.blockedRevision){this.blockedRevision=revision;this.blockedRegions.clear();this.blockedPriority='';}
    const residencyBudget={maxChunks:Math.min(this.cache.limits.maxChunks,this.meshCache.limits.maxMeshes,this.collisionCache.limits.maxColliders),
        maxScalarBytes:this.cache.limits.maxBytes,standardCapacity:Math.min(Math.floor(this.cache.limits.maxBytes/(this.lod.samplesPerAxis**3*4)),
          this.cache.limits.maxChunks,this.meshCache.limits.maxMeshes,this.collisionCache.limits.maxColliders),
        highCapacity:Math.min(this.impactCapacity,Math.floor(this.meshCache.limits.maxBytes/MAX_COLLISION_BUILD_BYTES),
          Math.floor(this.collisionCache.limits.maxBytes/MAX_COLLISION_BUILD_BYTES))};
    let regionPlan=selectImpactResidency(this.edits,field.bodyId,this.observer,this.lod,residencyBudget,this.publishedRegions);
    if(this.blockedRegions.size) {
      // Stable demand keeps byte-pressure decisions. A changed priority/window retries
      // complete regions so returning to an evicted site never requires another edit.
      if(this.regionPrioritySignature(regionPlan.regions)!==this.blockedPriority){this.blockedRegions.clear();this.blockedPriority='';}
      else regionPlan=selectImpactResidency(this.edits,field.bodyId,this.observer,this.lod,residencyBudget,this.publishedRegions,this.blockedRegions);
    }
    const impact=regionPlan.keys;this.selectedRegions=regionPlan.regions;this.admissionBlocked=regionPlan.blocked;
    this.productionActive=!!edit;
    if(this.productionActive&&!impact.length){this.publicationBlocked=regionPlan.blocked||(profile==='impact-high'?'high-res-budget':'impact-window-budget');
      this.prepared=undefined;
      this.wanted=[];this.pending=[];this.meshWanted=[];this.meshPending=[];this.collisionWanted=[];this.collisionPending=[];
      this.job=undefined;this.meshJob=undefined;this.collisionJob=undefined;this.collisionStaged=[];
      this.publication?.retainStaged?.(new Set());return false;}
    if(!this.productionActive && (!this.enabled || (!this.allowInterior&&Math.abs(field.baseSignedDistance(this.observer))>2048))){this.deactivate();return false;}
    this.wanted=this.productionActive?impact:selectVolumeChunkDemand(field.bodyId,this.observer,this.lod,this.demand,!this.allowInterior).slice(0,capacity).map(d=>d.key);
    if(this.prepared&&(this.prepared.entries.length!==this.wanted.length
      ||this.wanted.some(k=>!this.prepared!.entries.some(e=>chunkKeyToString(e.source.key)===chunkKeyToString(k)))))this.prepared=undefined;
    if(this.wanted.some(key=>{const source=this.cache.peek(key);return source?.state==='ready'&&this.blockedHighSources.has(source);})){this.publicationBlocked='high-res-budget';
      this.pending=[];this.meshPending=[];this.collisionPending=[];this.collisionStaged=[];
      this.job=undefined;this.meshJob=undefined;this.collisionJob=undefined;return false;}
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
    const config=this.wanted[0]?samplingConfigForKey(this.wanted[0],this.lod):this.lod;
    const maximum=maximumVolumeMeshBytes(config.samplesPerAxis);
    const supported=config.samplesPerAxis**3*28+96+maximum*2<=volumeMeshJobByteLimit({key:this.wanted[0]??{bodyId:'',lod:0,x:0,y:0,z:0}});
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
          if(this.productionActive&&samplingProfileOf(this.meshJob.chunk.key)==='impact-high'
            &&requiredVolumeCollisionBuildBytes(this.meshJob.mesh!)>MAX_COLLISION_BUILD_BYTES){
            this.blockedHighSources.add(this.meshJob.chunk);this.publicationBlocked='high-res-budget';this.meshJob=undefined;return;}
          if(this.productionActive){const otherMeshes=this.meshWanted.filter(k=>chunkKeyToString(k)!==chunkKeyToString(this.meshJob!.chunk.key))
            .map(k=>this.cache.peek(k)).flatMap(c=>c?[this.meshCache.get(c)].filter((m):m is PlanetVolumeMesh=>!!m):[]);
            if(otherMeshes.reduce((s,m)=>s+volumeMeshByteLength(m),volumeMeshByteLength(this.meshJob.mesh!))>this.meshCache.limits.maxBytes){
              this.blockLowestRegion();this.meshJob=undefined;return;}}
          this.meshCache.insert(this.meshJob.chunk,this.meshJob.mesh!);
          this.meshJob=undefined;this.meshedThisFrame++;this.planMeshes();
          this.planCollisions();
        }
      } else if(this.collisionJob) {
        const batch=Math.max(1,Math.min(128,Math.floor(target/this.collisionUnitMs))),done=this.collisionJob.advance(batch),elapsed=Math.max(0,this.clock()-before);
        this.collisionBuildMs+=elapsed;this.collisionUnitMs=Math.max(.00001,this.collisionUnitMs*.8+elapsed/batch*.2);
        if(done) {if(this.productionActive){const bytes=this.collisionWanted.filter(k=>chunkKeyToString(k)!==chunkKeyToString(this.collisionJob!.mesh.key)).reduce((sum,k)=>{const staged=this.collisionStaged.find(e=>chunkKeyToString(e.source.key)===chunkKeyToString(k));
            return sum+(staged?.collider?.memory.bytes??this.collisionCache.peek(k)?.memory.bytes??0);},this.collisionJob.collider?.memory.bytes??0);
            if(bytes>this.collisionCache.limits.maxBytes){this.blockLowestRegion();this.collisionJob=undefined;return;}}
          this.collisionStaged.push({source:this.collisionJob.source!,collider:this.collisionJob.collider});
          if(this.productionActive){const renderStart=this.clock();
            this.publication?.prepareOne?.({source:this.collisionJob.source!,mesh:this.collisionJob.mesh,collider:this.collisionJob.collider});
            this.renderPreparationMs+=Math.max(0,this.clock()-renderStart);}
          const mesh=this.collisionJob.mesh;this.collisionPending=this.collisionPending.filter(candidate=>candidate!==mesh);
          this.collisionJob=undefined;this.collisionBuiltThisFrame++;}
      }
    }
    if(this.productionActive&&!this.job&&!this.meshJob&&!this.collisionJob&&!this.pending.length&&!this.meshPending.length&&!this.collisionPending.length
      &&this.clock()<deadline)this.prepareImpactReplacement();
  }
  private regionPrioritySignature(regions:readonly ImpactResidentRegion[]):string {
    // Chunk traversal order changes with sub-cell movement; only identity matters.
    return JSON.stringify(regions.map(r=>[r.editId,r.keys.map(chunkKeyToString).sort()]));
  }
  private blockLowestRegion():void {const last=this.selectedRegions.at(-1);if(last){
      if(!this.blockedRegions.size)this.blockedPriority=this.regionPrioritySignature(this.selectedRegions);
      this.blockedRegions.add(last.editId);}
    this.prepared=undefined;this.publicationBlocked='replacement-byte-budget';}
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
  private prepareImpactReplacement():void {
    if(!this.publication||!this.wanted.length)return;
    if(this.prepared)return;
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
    if(old.length===entries.length&&entries.every(entry=>old.some(prior=>prior.source===entry.source))
      &&this.selectedRegions.length===this.publishedRegions.length&&this.selectedRegions.every(r=>this.publishedRegions.some(p=>p.editId===r.editId)))return;
    if(entries.reduce((sum,e)=>sum+(e.collider?.memory.bytes??0),0)>this.collisionCache.limits.maxBytes
      ||entries.reduce((sum,e)=>sum+(e.mesh?volumeMeshByteLength(e.mesh):0),0)>this.meshCache.limits.maxBytes){this.blockLowestRegion();return;}
    const before=this.clock();
    if(!this.publication.prepare(entries)){this.publicationBlocked='render-not-ready';return;}
    const collision=this.collisionCache.prepareReplacement(entries.flatMap(entry=>entry.collider?[entry.collider]:[]));if(!collision)return;
    const entriesByKey=new Map(entries.map(e=>[chunkKeyToString(e.source.key),e]));
    const footprint=this.selectedRegions.map(region=>{const edit=this.edits.get(region.editId);if(edit?.type!=='subtract-sphere'||!edit.impact)return undefined;
      const {surfaceContactBodyFixedM:p,surfaceNormalBodyFixed:n,craterRadiusM:r}=edit.impact;let extent=0;
      for(const key of region.keys){const bounds=entriesByKey.get(chunkKeyToString(key))!.source.boundsBodyFixedM;
        for(let mask=0;mask<8;mask++){const dx=(mask&1?bounds.maxBodyFixedM[0]:bounds.minBodyFixedM[0])-p[0],
          dy=(mask&2?bounds.maxBodyFixedM[1]:bounds.minBodyFixedM[1])-p[1],dz=(mask&4?bounds.maxBodyFixedM[2]:bounds.minBodyFixedM[2])-p[2],
          dot=dx*n[0]+dy*n[1]+dz*n[2];extent=Math.max(extent,Math.sqrt(Math.max(0,dx*dx+dy*dy+dz*dz-dot*dot)));}}
      return {editId:edit.id,requestedRadiusM:r,replacementRadiusM:extent,overshootM:Math.max(0,extent-r)};
    }).filter((value):value is NonNullable<typeof value>=>!!value);
    this.prepared={entries,regions:this.selectedRegions,collision,coverage:this.replacement.prepare(entries),footprint,revision:this.edits.revision(this.field!.bodyId)};
    this.preparationMs=Math.max(0,this.clock()-before);
  }
  private commitImpactReplacement():void {
    const plan=this.prepared;if(!plan)return;
    if(this.publication?.isPrepared?.(plan.entries)===false||plan.revision!==this.edits.revision(this.field!.bodyId)||plan.entries.some(e=>e.source.state!=='ready'||this.cache.peek(e.source.key)!==e.source
      ||e.mesh&&e.mesh!==this.meshCache.get(e.source))){this.prepared=undefined;return;}
    const before=this.clock();
    // All sources, MC geometry, BVHs and render representations are ready. No async callback
    // or physics/render query runs inside this synchronous frame-boundary transaction.
    plan.collision();plan.coverage();this.publication!.commit(plan.entries);
    this.publishedRegions=plan.regions;this.footprint=plan.footprint;this.prepared=undefined;
    this.collisionStaged=[];this.publicationBlocked='';this.publicationMs=Math.max(0,this.clock()-before);
  }
  stats(): ManagedStats { return { id: this.id, pending: this.pending.length+this.meshPending.length+this.collisionPending.length+this.collisionStaged.length, grantedMs: this.grantedMs }; }
  get metrics() {
    this.meshCache.prune(this.cache);
    const meshes=this.meshCache.stats();
    const nearest = this.wanted[0] && this.cache.peek(this.wanted[0]);
    const config=this.impactProfile==='impact-high'?{...this.lod,samplesPerAxis:33}:this.lod,
      spacingM=config.baseChunkSizeM/(config.samplesPerAxis-1),scalarStats=this.cache.stats(),highMeshes=this.meshCache.values().filter(m=>samplingProfileOf(m.key)==='impact-high'),
      highColliders=this.collisionCache.values().filter(c=>samplingProfileOf(c.key)==='impact-high');
    return { bodyId: this.field?.bodyId, revision: this.field ? this.edits.revision(this.field.bodyId) : 0,
      ...this.cache.stats(), pending: this.pending.length, pendingBytes: this.job?.pendingBytes ?? 0,
      generatedThisFrame: this.generatedThisFrame, generationMs: this.generationMs, grantedMs: this.grantedMs,
      rejectedChunks: this.rejectedChunks, nearestChunk: this.wanted[0] && chunkKeyToString(this.wanted[0]),
      meshingEnabled:this.meshingEnabled||this.productionActive,residentMeshes:meshes.resident,meshBytes:meshes.bytes,
      meshVertices:meshes.vertices,meshTriangles:meshes.triangles,
      ambiguousMeshFaces:meshes.ambiguousFaces,pendingMeshes:this.meshPending.length,
      productionActive:this.productionActive,publishedReplacements:this.replacement.entries.length,
      publishedSamplingProfile:new Set(this.replacement.entries.map(e=>samplingProfileOf(e.source.key))).size>1?'separated-profiles':
        this.replacement.entries.length?samplingProfileOf(this.replacement.entries[0].source.key):'intact',
      replacementGeneration:this.replacement.generation,publicationMs:this.publicationMs,publicationBlocked:this.publicationBlocked,
      renderPreparationMs:this.renderPreparationMs,
      retainedPublishedSampleBytes:this.replacement.entries.reduce((sum,e)=>sum+(this.cache.peek(e.source.key)===e.source?0:chunkByteLength(e.source)),0),
      requestedImpact:this.requestedImpact,
      selectedRegions:this.selectedRegions.length,publishedRegions:this.publishedRegions.length,publishedRegionIds:this.publishedRegions.map(r=>r.editId),
      preparationMs:this.preparationMs,replacementFootprints:this.footprint,
      regionAdmissionBlocked:this.admissionBlocked,
      samplingProfile:this.impactProfile,samplesPerAxis:config.samplesPerAxis,spacingM,impactCapacity:this.impactCapacity,
      impactRadiusM:this.impactRadiusM,impactDepthM:this.impactDepthM,diameterCells:2*this.impactRadiusM/spacingM,depthCells:this.impactDepthM/spacingM,
      highChunks:scalarStats.profileCounts['impact-high']??0,highScalarBytes:scalarStats.profileBytes['impact-high']??0,
      highMeshBytes:highMeshes.reduce((s,m)=>s+volumeMeshByteLength(m),0),highColliderBytes:highColliders.reduce((s,c)=>s+c.memory.bytes,0),
      meshJobBytes:this.meshJob?.pendingBytes??0,meshedThisFrame:this.meshedThisFrame,meshingMs:this.meshingMs,
      nearestOverlappingEdits: nearest?.overlappingEditCount ?? 0 };
  }
  get collisionMetrics(){return {bodyId:this.field?.bodyId,enabled:this.collisionEnabled||this.productionActive,...this.collisionCache.stats(),
    stagedBytes:this.collisionStaged.reduce((sum,e)=>sum+(e.collider?.memory.bytes??0),0),
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
      'Planet Destruction · Regions selected published / prepare ms':`${m.selectedRegions} ${m.publishedRegions} / ${m.preparationMs.toFixed(3)}`,
      'Planet Destruction · Region admission blocked':m.regionAdmissionBlocked||'—',
      'Planet Destruction · Replacement radius overshoot m':m.replacementFootprints.map(f=>`${f.replacementRadiusM.toFixed(2)} / ${f.overshootM.toFixed(2)}`).join(' · ')||'—',
      'Planet Destruction · Sampling desired published / axis / spacing':`${m.samplingProfile} ${m.publishedSamplingProfile} / ${m.samplesPerAxis} / ${m.spacingM} m`,
      'Planet Destruction · High chunks / scalar mesh collider MiB':`${m.highChunks} / ${(m.highScalarBytes/1048576).toFixed(3)} / ${(m.highMeshBytes/1048576).toFixed(3)} / ${(m.highColliderBytes/1048576).toFixed(3)}`,
      'Planet Destruction · Requested R D / diameter depth cells':`${m.impactRadiusM.toFixed(2)} ${m.impactDepthM.toFixed(2)} m / ${m.diameterCells.toFixed(2)} ${m.depthCells.toFixed(2)}`,
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
