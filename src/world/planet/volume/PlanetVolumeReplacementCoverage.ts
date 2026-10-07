import { planetVolumeBoundsContainPoint, type BodyFixedPoint } from './PlanetVolumeEdit';
import type { PlanetVolumeChunk } from './PlanetVolumeChunk';
import type { PlanetVolumeCollider } from './PlanetVolumeCollider';
import type { PlanetVolumeMesh } from './PlanetVolumeMesh';

export interface PlanetVolumeReplacement {
  readonly source:PlanetVolumeChunk; readonly mesh?:PlanetVolumeMesh; readonly collider?:PlanetVolumeCollider;
}
/** Renderer-independent publication boundary. prepare may fail; commit must be synchronous. */
export interface PlanetVolumePublication {
  prepareOne?(replacement:PlanetVolumeReplacement):boolean;
  retainStaged?(keys:ReadonlySet<string>):void;
  prepare(replacements:readonly PlanetVolumeReplacement[]):boolean;
  commit(replacements:readonly PlanetVolumeReplacement[]):void;
  clear():void;
}
/** Only published complete windows suppress intact ground; edits alone never open a hole. */
export class PlanetVolumeReplacementCoverage {
  private active:readonly PlanetVolumeReplacement[]=[];
  generation=0;
  get entries(){return this.active;}
  publish(entries:readonly PlanetVolumeReplacement[]):void {this.active=[...entries];this.generation++;}
  clear():void {if(this.active.length){this.active=[];this.generation++;}}
  contains(bodyId:string,point:BodyFixedPoint):boolean {
    return this.active.some(entry=>entry.source.key.bodyId===bodyId&&planetVolumeBoundsContainPoint(entry.source.boundsBodyFixedM,point));
  }
  get bodyId(){return this.active[0]?.source.key.bodyId;}
}
