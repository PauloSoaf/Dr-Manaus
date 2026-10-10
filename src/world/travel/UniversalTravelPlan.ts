import type { UniverseRuntime } from '../runtime/UniverseRuntime';
import { addressSeparationM, observerGlobalPositionM } from '../galaxy/GalaxyCoordinates';
import { sectorsEqual, type UniverseAddress } from '../spatial/UniverseAddress';
import { LIGHT_YEAR_M, type Vec3 } from '../spatial/units';
import { createUniversalTarget, isUniverseAddress, type UniversalNavigationTarget } from './UniversalNavigationTarget';
import { UniversalTargetCatalog } from './UniversalTargetCatalog';
import { GalaxyEntryResolver } from './GalaxyEntryResolver';

export type UniversalTravelDomain='interstellar'|'intergalactic';
export interface TravelAnchor {
  readonly address:UniverseAddress;
  readonly offsetM:Vec3;
  /** Metadata only. Never copied into a render transform or physics pose. */
  readonly globalPositionM?:Vec3;
}
export interface UniversalTravelPlan {
  readonly id:string;
  readonly origin:TravelAnchor;
  readonly destination:TravelAnchor;
  readonly requestedTarget:UniversalNavigationTarget;
  readonly resolvedDestination:UniversalNavigationTarget;
  readonly domain:UniversalTravelDomain;
  readonly logicalDistanceM:number;
  readonly durationS:number;
  readonly departureEpochS:number;
  readonly arrivalPolicy:'safe-system-corridor';
  readonly finalBodyTarget?:UniversalNavigationTarget;
}
export const sameSystem=(a:UniverseAddress,b:UniverseAddress)=>a.galaxyId===b.galaxyId
  && a.systemId===b.systemId && sectorsEqual(a.sector,b.sector);
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export function hypercruiseDuration(distanceM:number,domain:UniversalTravelDomain):number {
  const ly=distanceM/LIGHT_YEAR_M;
  return domain==='interstellar'?clamp(5+4*Math.log10(1+ly/4),5,25)
    :clamp(17+5*Math.log10(1+ly/1e6),15,30);
}
export function travelAnchor(address:UniverseAddress,offsetM:Vec3):TravelAnchor {
  const a=Object.freeze({...address,sector:Object.freeze({...address.sector})});
  const global=observerGlobalPositionM(a,offsetM);
  return Object.freeze({address:a,offsetM:Object.freeze([...offsetM]) as unknown as Vec3,
    globalPositionM:global?Object.freeze(global) as Vec3:undefined});
}
export function createTravelPlan(u:UniverseRuntime,catalog:UniversalTargetCatalog,
  requested:UniversalNavigationTarget,id:string,origin=travelAnchor(u.address,u.location.sectorOffsetM??u.playerSystemPositionM())):UniversalTravelPlan {
  if(!catalog.resolve(requested)) throw Error('Invalid destination');
  if(!['star','system','body','galaxy'].includes(requested.kind)) throw Error('Travel unavailable for this target');
  const resolved=new GalaxyEntryResolver(catalog).resolve(requested),a=resolved.address;
  if(!a||!isUniverseAddress(a)||!a.systemId) throw Error('Destination needs a canonical system address');
  const offset:Vec3=a.systemId==='sol'?[0,0,0]:catalog.proceduralDescriptor(a.galaxyId,a.sector,a.systemId)!.star.offsetM;
  const destination=travelAnchor(a,offset),domain=origin.address.galaxyId===a.galaxyId?'interstellar':'intergalactic';
  const distance=addressSeparationM(origin.address,origin.offsetM,a,offset);
  if(!Number.isFinite(distance)||distance===undefined||distance<=0) throw Error('Destination distance unavailable');
  return Object.freeze({id,origin,destination,requestedTarget:createUniversalTarget(requested,requested.source,requested.selectedAtS,requested.mode),
    resolvedDestination:createUniversalTarget(resolved,resolved.source,resolved.selectedAtS,resolved.mode),domain,logicalDistanceM:distance,
    durationS:hypercruiseDuration(distance,domain),departureEpochS:u.time,arrivalPolicy:'safe-system-corridor',
    finalBodyTarget:requested.kind==='body'?createUniversalTarget(requested,requested.source,requested.selectedAtS,requested.mode):undefined});
}

/** C2 velocity ramps: integral of smoothstep over 20% acceleration/deceleration. */
export function travelProfile(q:number):{progress:number;derivative:number;phase:'acceleration'|'cruise'|'deceleration'} {
  q=clamp(q,0,1);const ramp=.2,normal=1-ramp;
  const integral=(t:number)=>t*t*t-.5*t*t*t*t;
  if(q<ramp){const t=q/ramp;return {progress:ramp*integral(t)/normal,derivative:(3*t*t-2*t*t*t)/normal,phase:'acceleration'};}
  if(q<=1-ramp)return {progress:(q-ramp/2)/normal,derivative:1/normal,phase:'cruise'};
  const t=(1-q)/ramp;return {progress:1-ramp*integral(t)/normal,derivative:(3*t*t-2*t*t*t)/normal,phase:'deceleration'};
}
