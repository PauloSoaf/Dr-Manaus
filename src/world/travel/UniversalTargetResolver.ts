import { addressSeparationM, globalTargetDeltaM, galaxyDefinition, galaxyLocalPositionM, orientGalaxyVector } from '../galaxy/GalaxyCoordinates';
import type { CelestialSystemRuntime } from '../celestial/CelestialSystemRuntime';
import { ProceduralSystemRuntime } from '../celestial/ProceduralSystemRuntime';
import { LOCAL_GROUP_CATALOG } from '../celestial/GalaxyDefinition';
import { sectorsEqual, sectorIndex, type UniverseAddress } from '../spatial/UniverseAddress';
import { PARSEC_M, type Vec3 } from '../spatial/units';
import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from './UniversalTargetCatalog';
import { isUniverseAddress, type UniversalNavigationTarget } from './UniversalNavigationTarget';
import { selectBodyDestination } from './BodyNavigation';

export type TravelCapability = 'solar'|'intra-system'|'interstellar'|'intergalactic'|'black-hole-future'|'cosmological-future';
export interface ResolvedUniversalTarget {
  readonly target:UniversalNavigationTarget;
  readonly valid:boolean;
  readonly materialized:boolean;
  readonly domain:'system'|'interstellar'|'intergalactic'|'cosmological';
  readonly distanceM?:number;
  readonly logicalPosition?: { readonly address?:UniversalNavigationTarget['address']; readonly positionM:Vec3;
    readonly frame:'solar-system'|'sector-offset'|'local-group-global'|'local-group'|'cosmological-relative' };
  readonly travelCapability:TravelCapability;
}
export interface TargetResolutionContext {
  readonly activeSystem:CelestialSystemRuntime;
  readonly solarSystem?:CelestialSystemRuntime;
  readonly address?:UniverseAddress;
  playerSystemPositionM():Vec3;
  readonly location?: { readonly sectorOffsetM?:Vec3; readonly cosmological?:import('../spatial/UniverseAddress').CosmologicalAddress };
}
/** Adapter deliberately rejects future domains and coincident body IDs in another address. */
export function solarTargetBodyId(t:UniversalNavigationTarget|undefined,context:TargetResolutionContext):string|undefined {
  const a=t?.address, current=context.address??SOLAR_TARGET_ADDRESS;
  if(t?.kind!=='body' || !a || !isUniverseAddress(a) || a.galaxyId!=='milky_way' || a.systemId!=='sol'
    || !sectorsEqual(a.sector,SOLAR_TARGET_ADDRESS.sector) || current.galaxyId!==a.galaxyId
    || current.systemId!==a.systemId || !sectorsEqual(current.sector,a.sector)
    || (context.solarSystem && context.activeSystem!==context.solarSystem))return;
  return t.bodyId && selectBodyDestination(context.activeSystem,t.bodyId) ? t.bodyId : undefined;
}
export const solarNavigationTarget=(t:UniversalNavigationTarget|undefined,context:TargetResolutionContext)=>{
  const id=solarTargetBodyId(t,context);return id?selectBodyDestination(context.activeSystem,id):undefined;
};
/** Only a body in the current logical address can use the one-system flight controller. */
export function activeSystemTargetBodyId(t:UniversalNavigationTarget|undefined,context:TargetResolutionContext):string|undefined {
  const a=t?.address,current=context.address??SOLAR_TARGET_ADDRESS;
  if(!t || !['body','star'].includes(t.kind) || !a || !isUniverseAddress(a)
    || a.galaxyId!==current.galaxyId || a.systemId!==current.systemId || !sectorsEqual(a.sector,current.sector))return;
  return t.bodyId && selectBodyDestination(context.activeSystem,t.bodyId) ? t.bodyId : undefined;
}
export const intraSystemNavigationTarget=(t:UniversalNavigationTarget|undefined,context:TargetResolutionContext)=>{
  const id=activeSystemTargetBodyId(t,context);return id?selectBodyDestination(context.activeSystem,id):undefined;
};

const ephemerides=new WeakMap<UniversalTargetCatalog,Map<string,ProceduralSystemRuntime>>();
function generatedEphemeris(catalog:UniversalTargetCatalog,p:NonNullable<ReturnType<UniversalTargetCatalog['proceduralDescriptor']>>,time:number):ProceduralSystemRuntime {
  let cache=ephemerides.get(catalog);if(!cache){cache=new Map();ephemerides.set(catalog,cache);}
  let runtime=cache.get(p.star.id);
  if(!runtime){runtime=new ProceduralSystemRuntime(p.system,time);cache.set(p.star.id,runtime);if(cache.size>64)cache.delete(cache.keys().next().value!);}
  if(runtime.time!==time)runtime.update(time);return runtime;
}
export class UniversalTargetResolver {
  constructor(readonly catalog:UniversalTargetCatalog,readonly context:TargetResolutionContext){}
  resolve(t:UniversalNavigationTarget):ResolvedUniversalTarget {
    const entry=this.catalog.resolve(t), current=this.context.address??SOLAR_TARGET_ADDRESS;
    const galaxy=t.galaxyId, intergalactic=!!galaxy && galaxy!==current.galaxyId;
    let domain:ResolvedUniversalTarget['domain']=intergalactic?'intergalactic':t.kind==='body'?'system':'interstellar';
    let capability:TravelCapability=intergalactic?'intergalactic':'interstellar';
    if(t.kind==='black-hole')capability='black-hole-future';
    if(['cluster','cosmic-anchor','observable-horizon'].includes(t.kind)){domain='cosmological';capability='cosmological-future';}
    if(!entry)return {target:t,valid:false,materialized:false,domain,travelCapability:capability};
    let materialized=false, distanceM:number|undefined, positionM:Vec3|undefined;
    let frame:NonNullable<ResolvedUniversalTarget['logicalPosition']>['frame']='sector-offset';
    const observer=this.context.playerSystemPositionM(),a=t.address;
    const solarId=solarTargetBodyId(t,this.context);
    if(solarId){frame='solar-system';positionM=this.context.activeSystem.positionOf(solarId);materialized=!!positionM?.every(Number.isFinite);
      domain='system';capability='solar';if(materialized)distanceM=Math.hypot(...positionM!.map((v,i)=>v-observer[i]));}
    else if(a && isUniverseAddress(a) && t.kind!=='black-hole') {
      domain=intergalactic?'intergalactic':'interstellar';
      const sameSystem=a.galaxyId===current.galaxyId && a.systemId===current.systemId && sectorsEqual(a.sector,current.sector);
      if(a.systemId==='sol'){
        positionM=t.kind==='system'?[0,0,0]:this.context.solarSystem?.positionOf(t.bodyId!);
        materialized=sameSystem;
      }else {
        const p=this.catalog.proceduralDescriptor(a.galaxyId,a.sector,a.systemId!);
        if(p){
          const live=sameSystem && this.context.activeSystem instanceof ProceduralSystemRuntime
            && this.context.activeSystem.system.starId===a.systemId ? this.context.activeSystem : undefined;
          materialized=!!live;
          const relative=t.kind==='system'?[0,0,0]: (live??generatedEphemeris(this.catalog,p,this.context.activeSystem.time)).positionOf(t.bodyId!)??[0,0,0];
          positionM=p.star.offsetM.map((v,i)=>v+relative[i]) as Vec3;
        }
      }
      if(materialized && sameSystem){
        domain='system';
        if(t.kind==='system'||activeSystemTargetBodyId(t,this.context))capability='intra-system';
        const live=t.kind==='system'?[0,0,0] as Vec3:this.context.activeSystem.positionOf(t.bodyId!);
        if(live)distanceM=Math.hypot(...live.map((v,i)=>v-observer[i]));
      }else if(positionM)distanceM=addressSeparationM(current,this.context.location?.sectorOffsetM??observer,a,positionM);
    } else if(entry.globalPositionM){
      frame='local-group-global';positionM=entry.globalPositionM;
      const delta=globalTargetDeltaM(current,this.context.location?.sectorOffsetM??observer,positionM);
      if(delta)distanceM=Math.hypot(...delta);
      const localGalaxy=galaxyDefinition(current.galaxyId);
      if(localGalaxy && t.galaxyId===current.galaxyId){
        const localTarget=orientGalaxyVector(localGalaxy,positionM.map((v,i)=>v-localGalaxy.positionM[i]) as Vec3,true);
        const localObserver=galaxyLocalPositionM(localGalaxy,current.sector,this.context.location?.sectorOffsetM??observer);
        distanceM=Math.hypot(...localTarget.map((v,i)=>v-localObserver[i]));
      }
      materialized=t.kind==='black-hole' && t.galaxyId===current.galaxyId;

    } else if(a && !isUniverseAddress(a)){
      frame='cosmological-relative';
      const player=this.context.location?.cosmological;
      // Current curated anchors are Local Group relative; cosmic cells retain their existing Mpc semantics.
      if(t.kind==='observable-horizon')distanceM=a.comovingDistanceM;
      else if(!player || (player.cell.x===a.cell.x&&player.cell.y===a.cell.y&&player.cell.z===a.cell.z)) {
        // Curated Mpc offsets are relative to the Local Group reference, independent of camera/proxies.
        const origin=LOCAL_GROUP_CATALOG.find(g=>g.id===current.galaxyId);
        const observerOffset=this.context.location?.sectorOffsetM??observer;
        if(!player && (!origin || !sectorsEqual(a.cell,sectorIndex(0n,0n,0n))))
          return {target:t,valid:true,materialized:false,domain,travelCapability:capability};
        positionM=a.localMpc.map((v,i)=>(v-(player?.localMpc[i]??0))*1e6*PARSEC_M) as Vec3;
        if(!player){
          frame='local-group';
          const delta=globalTargetDeltaM(current,observerOffset,positionM);
          if(delta)distanceM=Math.hypot(...delta);
        }else distanceM=Math.hypot(...positionM);
      }
    }
    return {target:t,valid:true,materialized,domain,travelCapability:capability,
      distanceM:Number.isFinite(distanceM)?distanceM:undefined,logicalPosition:positionM?{address:a,positionM,frame}:undefined};
  }
}

export function travelCapabilityLabel(capability:TravelCapability):string {
  return {solar:'Piloto automático Solar disponível','intra-system':'Piloto automático no sistema disponível','interstellar':'Hypercruise interestelar disponível em espaço seguro',
    'intergalactic':'Hypercruise intergaláctico disponível em espaço seguro','black-hole-future':'Viagem a buracos negros ainda indisponível',
    'cosmological-future':'Viagem cosmológica ainda indisponível'}[capability];
}
