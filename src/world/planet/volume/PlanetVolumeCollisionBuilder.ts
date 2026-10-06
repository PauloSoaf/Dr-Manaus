import { PlanetVolumeCollisionBvhJob } from './PlanetVolumeCollisionBvh';
import { volumeCollider, type PlanetVolumeCollider } from './PlanetVolumeCollider';
import type { PlanetVolumeChunk } from './PlanetVolumeChunk';
import type { PlanetVolumeMesh } from './PlanetVolumeMesh';
import type { PlanetVolumeBounds } from './PlanetVolumeEdit';
export class PlanetVolumeCollisionBuildJob {
  private readonly job: PlanetVolumeCollisionBvhJob;
  collider?: PlanetVolumeCollider;
  constructor(readonly mesh: PlanetVolumeMesh,readonly source?: PlanetVolumeChunk,private readonly bounds?: PlanetVolumeBounds) {
    this.job=new PlanetVolumeCollisionBvhJob(mesh);
  }
  get obsolete(){return this.source!==undefined&&(this.source.state!=='ready'||this.source.sourceRevision!==this.mesh.sourceRevision);}
  get pendingBytes(){return this.job.pendingBytes;}
  advance(units=64){if(this.obsolete)throw new Error('stale collider source');const done=this.job.advance(units);
    if(done)this.collider??=volumeCollider(this.mesh,this.job.result!,this.bounds??this.source?.boundsBodyFixedM);return done;}
}
/** Synchronous facade only for tests/workers/benchmarks. Runtime uses advance under scheduler. */
export function buildVolumeCollider(mesh: PlanetVolumeMesh): PlanetVolumeCollider {
  const job=new PlanetVolumeCollisionBuildJob(mesh);while(!job.advance(256)){}return job.collider!;
}
