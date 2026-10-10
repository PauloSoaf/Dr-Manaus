import type { ReferenceFrameGraph } from '../../spatial/ReferenceFrameGraph';
import type { Vec3 } from '../../spatial/units';
import type { VolumeCollisionProvider, VolumeContact, VolumeRayHit } from '../../../physics/VolumeCollisionProvider';
import { volumeContactKind } from '../../../physics/VolumeCollisionProvider';
import { PlanetVolumeCollisionCache } from './PlanetVolumeCollisionCache';
import { bvhCandidates } from './PlanetVolumeCollisionBvh';
import type { PlanetVolumeCollider } from './PlanetVolumeCollider';
import { rayTriangle, sweepCapsuleTriangle } from './PlanetVolumeCollisionGeometry';

/** Query transforms only: source geometry/BVHs remain chunk-local in body-fixed authority. */
export class PlanetVolumeCollisionProvider implements VolumeCollisionProvider {
  readonly metrics={queries:0,candidateChunks:0,candidateTriangles:0,contacts:0,lastKind:'—',lastNormal:[0,0,0] as Vec3};
  constructor(readonly cache:PlanetVolumeCollisionCache,readonly frames:ReferenceFrameGraph,
    readonly bodyId:string,readonly fixedFrameId:string,readonly localFrameId:string,readonly collisionLod=0) {}
  resetMetrics(){this.metrics.queries=0;this.metrics.candidateChunks=0;this.metrics.candidateTriangles=0;this.metrics.contacts=0;}
  private triangles(c:PlanetVolumeCollider,min:Vec3,max:Vec3,visit:(a:Vec3,b:Vec3,d:Vec3,n:Vec3)=>void){
    this.metrics.candidateTriangles+=bvhCandidates(c.bvh,min,max,triangle=>{
      const v=(corner:number,values:Float32Array):Vec3=>{const i=c.indices[triangle*3+corner]*3;return [values[i],values[i+1],values[i+2]];};
      const ns=[v(0,c.normals),v(1,c.normals),v(2,c.normals)],n:Vec3=[0,0,0];
      for(let axis=0;axis<3;axis++)n[axis]=ns[0][axis]+ns[1][axis]+ns[2][axis];
      const length=Math.hypot(...n)||1;for(let axis=0;axis<3;axis++)n[axis]/=length;
      visit(v(0,c.positions),v(1,c.positions),v(2,c.positions),n);
    });
  }
  sweepCapsule(feet:Vec3,displacement:Vec3,radius:number,height:number):VolumeContact|null {
    if(![...feet,...displacement,radius,height].every(Number.isFinite)||radius<=0||height<=0)throw new RangeError('invalid volume capsule');
    // Same feet/radius/height as PhysicsWorld. Short characters use one sphere centered at h/2.
    const bottom=height>=2*radius?radius:height/2,top=height>=2*radius?height-radius:bottom;
    const p=this.frames.convertPosition(this.localFrameId,this.fixedFrameId,[feet[0],feet[1]+bottom,feet[2]]),
      q=this.frames.convertPosition(this.localFrameId,this.fixedFrameId,[feet[0],feet[1]+top,feet[2]]),
      delta=this.frames.convertDirection(this.localFrameId,this.fixedFrameId,displacement);
    const min:Vec3=[0,0,0],max:Vec3=[0,0,0];
    for(let axis=0;axis<3;axis++){min[axis]=Math.min(p[axis],q[axis],p[axis]+delta[axis],q[axis]+delta[axis])-radius;
      max[axis]=Math.max(p[axis],q[axis],p[axis]+delta[axis],q[axis]+delta[axis])+radius;}
    this.metrics.queries++;let best:VolumeContact|null=null;
    this.metrics.candidateChunks+=this.cache.query({minBodyFixedM:min,maxBodyFixedM:max},this.collisionLod,c=>{
      if(c.bodyId!==this.bodyId)return;
      const local=(v:Vec3):Vec3=>v.map((value,i)=>value-c.originBodyFixedM[i]) as Vec3;
      const lp=local(p),lq=local(q);
      this.triangles(c,local(min),local(max),(a,b,d,n)=>{
        const hit=sweepCapsuleTriangle(lp,lq,delta,radius,a,b,d,n);
        if(!hit||(best&&hit.fraction>=best.fraction))return;
        const normal=this.frames.convertDirection(this.fixedFrameId,this.localFrameId,hit.normal);
        const point=this.frames.convertPosition(this.fixedFrameId,this.localFrameId,hit.point.map((v,i)=>v+c.originBodyFixedM[i]) as Vec3);
        best={fraction:hit.fraction,normal,point,key:c.key,bodyId:c.bodyId,kind:volumeContactKind(normal)};
      });
    });
    if(best)this.record(best);return best;
  }
  raycast(origin:Vec3,direction:Vec3,maxDistance:number):VolumeRayHit|null {
    if(![...origin,...direction,maxDistance].every(Number.isFinite)||maxDistance<=0)return null;
    const length=Math.hypot(...direction);if(length<=1e-12)return null;
    const p=this.frames.convertPosition(this.localFrameId,this.fixedFrameId,origin),
      dir=this.frames.convertDirection(this.localFrameId,this.fixedFrameId,direction.map(v=>v/length) as Vec3);
    const min:Vec3=p.map((v,i)=>Math.min(v,v+dir[i]*maxDistance)) as Vec3,
      max:Vec3=p.map((v,i)=>Math.max(v,v+dir[i]*maxDistance)) as Vec3;
    let best:VolumeRayHit|null=null;this.metrics.queries++;
    this.metrics.candidateChunks+=this.cache.query({minBodyFixedM:min,maxBodyFixedM:max},this.collisionLod,c=>{
      if(c.bodyId!==this.bodyId)return;
      const local=(v:Vec3):Vec3=>v.map((value,i)=>value-c.originBodyFixedM[i]) as Vec3,lp=local(p);
      this.triangles(c,local(min),local(max),(a,b,d,n)=>{
        const distance=rayTriangle(lp,dir,a,b,d,best?.distance??maxDistance);if(distance===null||(best&&distance>=best.distance))return;
        const normal=this.frames.convertDirection(this.fixedFrameId,this.localFrameId,n),
          point:Vec3=origin.map((v,i)=>v+direction[i]/length*distance) as Vec3;
        best={distance,normal,point,key:c.key,bodyId:c.bodyId,kind:volumeContactKind(normal)};
      });
    });
    if(best)this.record(best);return best;
  }
  private record(hit:VolumeContact|VolumeRayHit){this.metrics.contacts++;this.metrics.lastKind=hit.kind;this.metrics.lastNormal=[...hit.normal];}
}
