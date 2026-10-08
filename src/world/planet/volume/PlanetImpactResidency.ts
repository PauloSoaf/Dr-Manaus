import type {BodyFixedPoint,SubtractSphereEdit} from './PlanetVolumeEdit';
import type {PlanetVolumeEditStore} from './PlanetVolumeEditStore';
import {impactVolumeWindow,selectImpactSamplingProfile} from './PlanetVolumeImpactDemand';
import {chunkBoundsBodyFixedM,chunkKeyToString,physicalChunkKeyToString,samplingProfileOf,type PlanetVolumeChunkKey,type PlanetVolumeLodConfig} from './PlanetVolumeChunkKey';
import {distanceToVolumeBoundsSquared} from './PlanetVolumeChunkCache';

export const IMPACT_RESIDENCY_POLICY=Object.freeze({maxRegions:8,retentionPreferenceM:128,queryRadiusM:16384});
export interface ImpactResidentRegion {readonly editId:string;readonly keys:readonly PlanetVolumeChunkKey[];}
export interface ImpactResidencyPlan {readonly regions:readonly ImpactResidentRegion[];readonly keys:readonly PlanetVolumeChunkKey[];readonly blocked:string;}
export interface ImpactResidencyBudget {
  readonly maxChunks:number;readonly maxScalarBytes:number;readonly standardCapacity:number;readonly highCapacity:number;
}
/** Region admission is deterministic and indivisible. Actual mesh/BVH bytes are also checked
 * during preparation, before any cache insertion/publication. Logical edits are never evicted. */
export function selectImpactResidency(edits:PlanetVolumeEditStore,bodyId:string,observer:BodyFixedPoint,lod:PlanetVolumeLodConfig,
  budget:ImpactResidencyBudget,retained:readonly ImpactResidentRegion[]=[],blockedIds:ReadonlySet<string>=new Set()):ImpactResidencyPlan {
  const radius=IMPACT_RESIDENCY_POLICY.queryRadiusM;
  const candidates=edits.queryBounds(bodyId,{minBodyFixedM:observer.map(v=>v-radius) as [number,number,number],
    maxBodyFixedM:observer.map(v=>v+radius) as [number,number,number]})
    .filter((e):e is SubtractSphereEdit=>e.type==='subtract-sphere'&&!!e.impact);
  const retainedById=new Map(retained.map(r=>[r.editId,r])),order=new Map(edits.editsForBody(bodyId).map((e,i)=>[e.id,i]));
  const newest=candidates.reduce<SubtractSphereEdit|undefined>((prior,e)=>!prior||order.get(e.id)!>order.get(prior.id)!?e:prior,undefined);
  const score=(e:SubtractSphereEdit)=>{
    const p=e.impact!,delta=p.surfaceContactBodyFixedM.map((v,i)=>observer[i]-v),d=Math.hypot(...delta),
      radial=delta.reduce((s,v,i)=>s+v*p.surfaceNormalBodyFixed[i],0),tangent=Math.sqrt(Math.max(0,d*d-radial*radial));
    const contains=tangent<=p.craterRadiusM&&radial>=-p.craterDepthM-32&&radial<=32;
    // A newly requested nearby impact follows player containment, before historical regions.
    const newNearby=e===newest&&!retainedById.has(e.id)&&d<=1024;
    return {rank:contains?0:newNearby?1:2,distance:d-(retainedById.has(e.id)?IMPACT_RESIDENCY_POLICY.retentionPreferenceM:0)};
  };
  candidates.sort((a,b)=>score(a).rank-score(b).rank||score(a).distance-score(b).distance
    ||(order.get(b.id)!-order.get(a.id)!)||a.id.localeCompare(b.id));
  const regions:ImpactResidentRegion[]=[],selected=new Map<string,PlanetVolumeChunkKey>(),conflicted:PlanetVolumeChunkKey[]=[];let blocked='';
  const touches=(a:PlanetVolumeChunkKey,b:PlanetVolumeChunkKey)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.z-b.z)<=1;
  for(const edit of candidates) {
    if(regions.length>=IMPACT_RESIDENCY_POLICY.maxRegions)break;
    if(blockedIds.has(edit.id)){blocked||='replacement-byte-budget';continue;}
    const high=selectImpactSamplingProfile(edit)==='impact-high',prior=retainedById.get(edit.id);
    // Retain a STANDARD window while it still supports the player. HIGH always stays impact-anchored.
    const keys=!high&&prior?.keys.some(k=>distanceToVolumeBoundsSquared(observer,chunkBoundsBodyFixedM(k,lod))===0)
      ?prior.keys:impactVolumeWindow(edit,observer,lod,high?budget.highCapacity:budget.standardCapacity);
    if(!keys.length){blocked||=high?'high-res-budget':'impact-window-budget';continue;}
    // Different profiles may coexist only in separated regions. No mixed-resolution shared faces.
    if(keys.some(a=>conflicted.some(b=>touches(a,b)))){blocked||='profile-boundary-conflict';conflicted.push(...keys);continue;}
    const conflicting=regions.filter(r=>keys.some(a=>r.keys.some(b=>samplingProfileOf(a)!==samplingProfileOf(b)&&touches(a,b))));
    if(conflicting.length){blocked||='profile-boundary-conflict';conflicted.push(...keys,...conflicting.flatMap(r=>r.keys));
      for(const region of conflicting)regions.splice(regions.indexOf(region),1);
      selected.clear();for(const region of regions)for(const key of region.keys)selected.set(physicalChunkKeyToString(key),key);
      continue;}
    const union=new Map(selected);for(const key of keys)union.set(physicalChunkKeyToString(key),key);
    const bytes=[...union.values()].reduce((s,k)=>s+(samplingProfileOf(k)==='impact-high'?33**3+6*33**2:lod.samplesPerAxis**3)*4,0);
    if(union.size>budget.maxChunks||bytes>budget.maxScalarBytes){blocked||='region-capacity';continue;}
    regions.push({editId:edit.id,keys});for(const [id,key] of union)selected.set(id,key);
  }
  const keys=[...selected.values()].sort((a,b)=>distanceToVolumeBoundsSquared(observer,chunkBoundsBodyFixedM(a,lod))
    -distanceToVolumeBoundsSquared(observer,chunkBoundsBodyFixedM(b,lod))||chunkKeyToString(a).localeCompare(chunkKeyToString(b)));
  return {regions,keys,blocked};
}
