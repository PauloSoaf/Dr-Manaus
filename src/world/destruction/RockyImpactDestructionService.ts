import type { CelestialBody } from '../celestial/CelestialBody';
import { bodyProfile } from '../celestial/CelestialBodyProfile';
import type { CelestialImpactEvent } from '../travel/CelestialImpactEvent';
import { surfaceForBody } from '../planet/BodySurfaceFactory';
import type { PlanetVolumeEditStore } from '../planet/volume/PlanetVolumeEditStore';
import { planRockyImpact, type RockyImpactEditPlan } from './RockyImpactDestructionPolicy';
import { logicalImpactChunkCount } from '../planet/volume/PlanetVolumeImpactDemand';
import { DEFAULT_VOLUME_LOD } from '../planet/volume/PlanetVolumeChunkKey';

export interface RockyImpactDestructionOptions {
  readonly edits: PlanetVolumeEditStore;
  readonly body: (id: string) => CelestialBody | undefined;
  readonly requestRegion: (editId: string, plan: RockyImpactEditPlan) => void;
  /** Frame/coverage policy supplied by the host, not body-ID cases in the crater policy. */
  readonly defer?: (plan: RockyImpactEditPlan) => string | undefined;
}
export class RockyImpactDestructionService {
  last?: {event:CelestialImpactEvent;consumed:boolean;reason:string;editId?:string;plan?:RockyImpactEditPlan};
  constructor(private readonly options:RockyImpactDestructionOptions) {}
  consume(event:CelestialImpactEvent):string|undefined {
    const body=this.options.body(event.bodyId),surface=body&&surfaceForBody(body);
    const plan=body&&surface&&planRockyImpact(event,body,bodyProfile(body),surface);
    if(!plan){this.last={event,consumed:false,reason:'classification-or-capability'};return;}
    const deferred=this.options.defer?.(plan);
    if(deferred){this.last={event,consumed:false,reason:deferred,plan};return;}
    const editId=`${body!.id}:impact:${event.eventId}`;
    if(!this.options.edits.get(editId))this.options.edits.subtractSphere({id:editId,bodyId:plan.bodyId,
      centerBodyFixedM:plan.sphereCenterBodyFixedM,radiusM:plan.sphereRadiusM,impact:plan});
    this.options.requestRegion(editId,plan);
    this.last={event,consumed:true,reason:'accepted',editId,plan};return editId;
  }
  debugMetrics():Record<string,string|number> {
    const last=this.last,p=last?.plan,edit=last?.editId&&this.options.edits.get(last.editId);
    const point=(v:readonly number[]|undefined)=>v?.map(x=>x.toFixed(2)).join(' / ')??'—';
    return {'PLANET DESTRUCTION':last?.event.eventId??'—','Planet Destruction · Body':last?.event.bodyId??'—',
      'Planet Destruction · Classification':last?.event.classification??'—',
      'Planet Destruction · Consumed':last?`${last.consumed?'yes':'no'} · ${last.reason}`:'—',
      'Planet Destruction · Edit':last?.editId??'—',
      'Planet Destruction · C4 contact':point(last?.event.contactBodyFixedM),
      'Planet Destruction · Actual surface':point(p?.surfaceContactBodyFixedM),
      'Planet Destruction · R / D':p?`${p.craterRadiusM.toFixed(2)} / ${p.craterDepthM.toFixed(2)} m`:'—',
      'Planet Destruction · Sphere R / depth offset':p?`${p.sphereRadiusM.toFixed(2)} / ${p.sphereDepthOffsetM.toFixed(2)} m`:'—',
      'Planet Destruction · Sphere centre':point(p?.sphereCenterBodyFixedM),
      'Planet Destruction · Revision / logical edits':`${this.options.edits.revision(last?.event.bodyId??'')} / ${this.options.edits.editCount}`,
      'Planet Destruction · Affected logical chunks':edit&&edit.type==='subtract-sphere'?logicalImpactChunkCount(edit,DEFAULT_VOLUME_LOD):0};
  }
}
