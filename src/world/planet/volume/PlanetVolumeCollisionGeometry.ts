import type { Vec3 } from '../../spatial/units';
import { VOLUME_CONTACT_POLICY } from '../../../physics/VolumeCollisionProvider';

const dot = (a: Vec3, b: Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const at = (a: Vec3, d: Vec3, t: number): Vec3 => [a[0]+d[0]*t,a[1]+d[1]*t,a[2]+d[2]*t];
const cross = (a: Vec3,b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp = (t: number) => Math.max(0,Math.min(1,t));

/** Ericson closest-feature regions, with an edge fallback for degenerate triangles. */
export function closestTrianglePoint(p: Vec3,a: Vec3,b: Vec3,c: Vec3): Vec3 {
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return a;
  const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return at(a,ab,d1/(d1-d3));
  const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return at(a,ac,d2/(d2-d6));
  const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0)return at(b,sub(c,b),(d4-d3)/(d4-d3+d5-d6));
  const denominator=va+vb+vc;
  if(Math.abs(denominator)<1e-20) {
    let best=a,bestD=Infinity;
    for(const [u,v] of [[a,b],[b,c],[c,a]]) {const d=sub(v,u),q=at(u,d,clamp(dot(sub(p,u),d)/(dot(d,d)||1))),s=dot(sub(p,q),sub(p,q));if(s<bestD){bestD=s;best=q;}}
    return best;
  }
  return [a[0]+ab[0]*vb/denominator+ac[0]*vc/denominator,a[1]+ab[1]*vb/denominator+ac[1]*vc/denominator,
    a[2]+ab[2]*vb/denominator+ac[2]*vc/denominator];
}
function closestSegments(p: Vec3,q: Vec3,a: Vec3,b: Vec3): [Vec3,Vec3] {
  const d=sub(q,p),e=sub(b,a),r=sub(p,a),dd=dot(d,d),ee=dot(e,e),de=dot(d,e),dr=dot(d,r),er=dot(e,r);
  let s=0,t=0;
  if(dd<=1e-20)t=clamp(er/(ee||1));
  else if(ee<=1e-20)s=clamp(-dr/dd);
  else {const den=dd*ee-de*de;s=den>1e-20?clamp((de*er-dr*ee)/den):0;t=(de*s+er)/ee;
    if(t<0){t=0;s=clamp(-dr/dd);}else if(t>1){t=1;s=clamp((de-dr)/dd);}}
  return [at(p,d,s),at(a,e,t)];
}
/** Closest face, edge or vertex to an arbitrary oriented capsule centre segment. */
export function segmentTriangleDistance(p: Vec3,q: Vec3,a: Vec3,b: Vec3,c: Vec3) {
  const n=cross(sub(b,a),sub(c,a)),d=sub(q,p),den=dot(n,d);
  if(Math.abs(den)>1e-20) {
    const t=dot(n,sub(a,p))/den;
    if(t>=0&&t<=1) {const hit=at(p,d,t),face=closestTrianglePoint(hit,a,b,c);
      if(Math.hypot(...sub(hit,face))<1e-8)return {distance:0,capsulePoint:hit,trianglePoint:hit};}
  }
  let capsulePoint=p,trianglePoint=closestTrianglePoint(p,a,b,c),squared=dot(sub(p,trianglePoint),sub(p,trianglePoint));
  const consider=(u: Vec3,v: Vec3)=>{const delta=sub(u,v),s=dot(delta,delta);if(s<squared){squared=s;capsulePoint=u;trianglePoint=v;}};
  consider(q,closestTrianglePoint(q,a,b,c));
  for(const [u,v] of [[a,b],[b,c],[c,a]]) {const pair=closestSegments(p,q,u,v);consider(pair[0],pair[1]);}
  return {distance:Math.sqrt(Math.max(0,squared)),capsulePoint,trianglePoint};
}
/** Conservative support-plane advancement for the convex segment-minus-triangle distance.
 * The separating closest-feature plane bounds time of impact, even for face/edge/vertex hits.
 * This avoids arbitrary substeps and the tiny Lipschitz steps of near-parallel long sweeps. */
export function sweepCapsuleTriangle(p: Vec3,q: Vec3,delta: Vec3,radius: number,a: Vec3,b: Vec3,c: Vec3,emptyNormal: Vec3) {
  let t=0,previous=0;
  for(let iteration=0;iteration<VOLUME_CONTACT_POLICY.sweepIterations;iteration++) {
    const closest=segmentTriangleDistance(at(p,delta,t),at(q,delta,t),a,b,c);
    const separation=closest.distance-radius,difference=sub(closest.capsulePoint,closest.trianglePoint);
    const normal: Vec3=closest.distance>1e-12?difference.map(v=>v/closest.distance) as Vec3:[...emptyNormal];
    const closing=-dot(delta,normal);
    if(separation<=VOLUME_CONTACT_POLICY.toleranceM) {
      if(dot(normal,emptyNormal)<0) for(let i=0;i<3;i++)normal[i]*=-1;
      if(dot(delta,normal)>=-1e-10)return null; // touching while separating/tangent is not entry
      let low=previous,high=t;
      for(let i=0;i<VOLUME_CONTACT_POLICY.refinements;i++) {
        const mid=(low+high)/2,dist=segmentTriangleDistance(at(p,delta,mid),at(q,delta,mid),a,b,c).distance;
        if(dist-radius>VOLUME_CONTACT_POLICY.toleranceM)low=mid;else high=mid;
      }
      return {fraction:high,point:closest.trianglePoint,normal};
    }
    if(closing<=1e-12)return null;
    previous=t;t+=Math.max(0,separation-VOLUME_CONTACT_POLICY.toleranceM*.5)/closing;
    if(t>1)return null;
  }
  // Never permit an unresolved near-grazing extreme sweep to tunnel after the bounded work cap.
  const closest=segmentTriangleDistance(at(p,delta,t),at(q,delta,t),a,b,c);
  return {fraction:t,point:closest.trianglePoint,normal:[...emptyNormal] as Vec3};
}
export function rayTriangle(origin: Vec3,direction: Vec3,a: Vec3,b: Vec3,c: Vec3,max: number): number | null {
  const ab=sub(b,a),ac=sub(c,a),p=cross(direction,ac),det=dot(ab,p);
  if(Math.abs(det)<1e-12)return null;
  const s=sub(origin,a),u=dot(s,p)/det;if(u< -1e-9||u>1+1e-9)return null;
  const q=cross(s,ab),v=dot(direction,q)/det;if(v< -1e-9||u+v>1+1e-9)return null;
  const distance=dot(ac,q)/det;return distance>=0&&distance<=max?distance:null;
}
