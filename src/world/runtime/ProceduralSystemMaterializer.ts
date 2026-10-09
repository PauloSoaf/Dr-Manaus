import { knownGalaxyRuntime } from '../galaxy/GalaxyRuntime';
import type { GalaxyMaterializer } from '../galaxy/GalaxyMaterializer';
import type { UniverseRuntime } from './UniverseRuntime';
import { TRAVEL_VIEW_FRAME } from './UniverseRuntime';
import { ProceduralSystemRuntime } from '../celestial/ProceduralSystemRuntime';
import { bodyProfile } from '../celestial/CelestialBodyProfile';
import type { CelestialSystemRuntime } from '../celestial/CelestialSystemRuntime';
import type { UniversalNavigationTarget } from '../travel/UniversalNavigationTarget';
import { isUniverseAddress } from '../travel/UniversalNavigationTarget';
import { UniversalTargetCatalog, type ProceduralTargetDescriptor } from '../travel/UniversalTargetCatalog';
import { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import { referenceFrame } from '../spatial/ReferenceFrame';
import { clonePose, type SpatialPose } from '../spatial/SpatialPose';
import type { UniverseAddress } from '../spatial/UniverseAddress';
import type { Vec3 } from '../spatial/units';

export interface SystemResources {
  /** Allocate beforehand; installing must roll back its own partial registration on failure. */
  install(): void;
  activate(): void;
  dispose(): void;
  complete?():void;
}
export interface PreparedSystemSession {
  readonly descriptor: ProceduralTargetDescriptor;
  readonly runtime: ProceduralSystemRuntime;
  readonly frames: ReferenceFrameGraph;
  readonly resources: SystemResources;
  readonly arrivalM: Vec3;
  readonly ready: boolean;
  dispose(): void;
}
interface SolarSnapshot { address: UniverseAddress; pose: SpatialPose; velocity: Vec3; }
/** One live generated system. Descriptor cache belongs to U0; no visited-world serialization. */
export class ProceduralSystemMaterializer {
  current?: PreparedSystemSession;
  generation = 0;
  qaArrivalMode = false;
  readonly timings: Record<string,number> = {};
  private solarSnapshot?: SolarSnapshot;
  private readonly installed = new WeakSet<PreparedSystemSession>();
  constructor(readonly universe: UniverseRuntime, readonly catalog: UniversalTargetCatalog,
    private readonly solarResources: SystemResources,
    private readonly prepareResources: (runtime: CelestialSystemRuntime) => SystemResources,
    private readonly checkpoint: (stage:'profiles'|'frames'|'providers')=>void = ()=>{},
    private readonly galaxies?:GalaxyMaterializer) {}

  prepare(target: UniversalNavigationTarget): PreparedSystemSession {
    const start=performance.now(),a=target.address;
    if(!a || !isUniverseAddress(a) || !knownGalaxyRuntime(a.galaxyId) || !a.systemId
      || !['star','system','body'].includes(target.kind) || !this.catalog.resolve(target))
      throw new Error('TEST: endereço procedural de galáxia conhecida requerido');
    const galaxyResources=this.galaxies?.prepare(a.galaxyId);
    try {
    const systemStart=performance.now();
    const descriptor=this.catalog.proceduralDescriptor(a.galaxyId,a.sector,a.systemId);
    if(!descriptor)throw new Error('Sistema procedural desconhecido');
    this.timings.descriptor=performance.now()-systemStart;
    const t=performance.now(),runtime=new ProceduralSystemRuntime(descriptor.system,this.universe.time);
    this.timings.runtime=performance.now()-t;
    const profileStart=performance.now();
    this.checkpoint('profiles');
    for(const body of runtime.bodies) {
      const p=bodyProfile(body);
      if(!body.profile || !Number.isFinite(body.equatorialRadiusM) || body.equatorialRadiusM<=0
        || p.canLand!==p.hasSolidSurface || p.supportsVolumeDestruction)
        throw new Error('Perfil procedural incoerente');
    }
    this.timings.profiles=performance.now()-profileStart;
    const frameStart=performance.now(),frames=new ReferenceFrameGraph();
    this.checkpoint('frames');runtime.registerFrames(frames);
    for(const body of runtime.bodies) {
      frames.register(referenceFrame({id:body.id+'/fixed',parentId:body.frameId,kind:'body-fixed'}));
      frames.convertPosition(body.frameId,runtime.systemFrameId,[0,0,0]);
    }
    this.timings.frames=performance.now()-frameStart;
    const resourceStart=performance.now();this.checkpoint('providers');
    const systemResources=this.prepareResources(runtime);
    const resources:SystemResources=galaxyResources?{
      install:()=>{galaxyResources.install();systemResources.install();},
      activate:()=>{galaxyResources.activate();systemResources.activate();},
      dispose:()=>{systemResources.dispose();galaxyResources.dispose();},
      complete:()=>{galaxyResources.complete?.();systemResources.complete?.();},
    }:systemResources;
    this.timings.resources=performance.now()-resourceStart;
    const extent=systemDomainLimitM(runtime)/4;
    const arrivalM:Vec3=[0,extent*.3,extent];
    this.timings.systemPrepare=performance.now()-systemStart;
    this.timings.prepare=performance.now()-start;
    let disposed=false;
    return {descriptor,runtime,frames,resources,arrivalM,get ready(){return !disposed;},dispose:()=>{
      if(!disposed){disposed=true;resources.dispose();}
    }};
    }catch(error){galaxyResources?.dispose();throw error;}
  }

  install(session: PreparedSystemSession): void {
    if(!session.ready || this.installed.has(session))throw new Error('Sistema não preparado ou já instalado');
    const start=performance.now(),u=this.universe,old=this.current;
    const snapshot={runtime:u.activeSystem,address:u.address,pose:clonePose(u.player),velocity:u.localVelocityMps};
    const renderOrigin=u.renderSpace.currentOrigin;
    const travelFrame=u.frames.has(TRAVEL_VIEW_FRAME)?u.frames.get(TRAVEL_VIEW_FRAME):undefined;
    const previous=new Map(session.frames.ids.map(id=>[id,u.frames.has(id)?u.frames.get(id):undefined]));
    let committed=false;
    try {
      session.runtime.update(u.time);
      // Registry and scene allocations become coherent before the runtime/pose commit.
      for(const id of session.frames.ids)u.frames.register(session.frames.get(id));
      session.resources.install();
      session.runtime.registerFrames(u.frames);
      committed=true;
      u.installSystem(session.runtime,session.descriptor.address,session.arrivalM);
      session.resources.activate();
    } catch(error) {
      session.dispose();
      for(const [id,frame] of previous) {if(frame)u.frames.register(frame);else u.frames.remove(id);}
      if(committed){
        u.restoreSystem(snapshot.runtime,snapshot.address,snapshot.pose,snapshot.velocity);
        if(travelFrame)u.frames.register(travelFrame);
        u.renderSpace.setOrigin(renderOrigin);
        (old?.resources??this.solarResources).activate();
      }
      throw error;
    }
    session.resources.complete?.();
    if(!this.solarSnapshot && snapshot.runtime===u.solarSystem)this.solarSnapshot=snapshot;
    this.current=session;this.generation++;this.qaArrivalMode=true;
    this.installed.add(session);
    const unload=performance.now();
    if(old){ old.dispose();this.removeFrames(old,session); }
    this.timings.unload=performance.now()-unload;
    this.timings.install=performance.now()-start;
  }

  testArrival(target: UniversalNavigationTarget): PreparedSystemSession {
    const a=target.address;
    if(this.current && a && isUniverseAddress(a) && this.catalog.resolve(target)
      && a.galaxyId===this.current.descriptor.address.galaxyId && a.systemId===this.current.descriptor.address.systemId
      && ['x','y','z'].every(axis=>a.sector[axis as keyof typeof a.sector]===this.current!.descriptor.address.sector[axis as keyof typeof a.sector]))
      return this.current;
    const session=this.prepare(target);this.install(session);return session;
  }
  returnToSolar(): void {
    const saved=this.solarSnapshot;
    if(!saved)return;
    const start=performance.now(),old=this.current;
    const u=this.universe,previous={runtime:u.activeSystem,address:u.address,pose:clonePose(u.player),velocity:u.localVelocityMps};
    const renderOrigin=u.renderSpace.currentOrigin,view=u.frames.has(TRAVEL_VIEW_FRAME)?u.frames.get(TRAVEL_VIEW_FRAME):undefined;
    const galaxyResources=this.galaxies?.prepareSolarReturn();
    try {
      galaxyResources?.install();u.solarSystem.update(u.time);
      u.restoreSystem(u.solarSystem,saved.address,saved.pose,saved.velocity);
      galaxyResources?.activate();this.solarResources.activate();
    }catch(error){
      galaxyResources?.dispose();u.restoreSystem(previous.runtime,previous.address,previous.pose,previous.velocity);
      if(view)u.frames.register(view);u.renderSpace.setOrigin(renderOrigin);
      old?.resources.activate();throw error;
    }
    galaxyResources?.complete?.();
    if(old){old.dispose();this.removeFrames(old);}
    this.current=undefined;this.solarSnapshot=undefined;this.qaArrivalMode=false;this.generation++;
    this.timings.unload=performance.now()-start;
  }
  private removeFrames(old:PreparedSystemSession,next?:PreparedSystemSession):void {
    const keep=new Set(next?.frames.ids);
    for(const id of this.universe.frames.ids) {
      if(keep.has(id))continue;
      if(id===old.runtime.systemFrameId || old.runtime.bodies.some(b=>id===b.frameId || id.startsWith(b.id+'/')))
        this.universe.frames.remove(id);
    }
  }
}
/** U1 remains bounded to its system; crossing this extent requires future U3 hypercruise. */
export function systemDomainLimitM(runtime:CelestialSystemRuntime):number {
  const extent=Math.max(1.496e11,...runtime.bodies.map(b=>(b.orbit?.semiMajorAxisM??b.equatorialRadiusM)*2));
  return extent*4;
}
