import { impactFixture } from './rocky-impact.ts';
import { planetVolumeEditSignedDistance } from '../../src/world/planet/volume/PlanetVolumeEdit.ts';
import { Raycaster,Vector3 } from 'three/webgpu';
import type { Vec3 } from '../../src/world/spatial/units.ts';
import { createRenderOrigin } from '../../src/world/spatial/RenderOrigin.ts';

// Declared before extraction: at most half a 16 m voxel at the rim, and <=15%/4 m
// depth error. The 0.25 m contour threshold excludes numerical terrain/ray noise.
export const CRATER_FIDELITY_TOLERANCE = Object.freeze({radiusM:8,depthFraction:.15,depthM:4,contourDepthM:.25});
export function measureCraterFidelity(body='moon',speed=260) {
  const f=impactFixture(body,speed);
  try {
    f.consume();f.ready();
    const {craterRadiusM:radius,craterDepthM:depth}=f.service.last!.plan!;
    const deficit=(x:number,z:number)=>{const hit=f.ray(x,z);if(!hit)throw new Error('missing extracted crater ray');
      return f.intact.heightAt(x,z)-hit.point[1];};
    const measuredDepthM=deficit(.125,.125),radii:number[]=[],analyticRadii:number[]=[],visualErrors:number[]=[];
    const edit=f.runtime.edits.allEdits()[0];
    f.universe.renderSpace.setOrigin(createRenderOrigin(f.local,[0,0,0]));
    f.renderer.update();f.renderer.root.updateMatrixWorld(true);
    const ray=new Raycaster();ray.layers.enableAll();
    for(let i=0;i<8;i++) {
      const angle=(i+.13)*Math.PI/4,dx=Math.cos(angle),dz=Math.sin(angle);
      let lo=0,hi=radius+32;
      for(let j=0;j<24;j++){const mid=(lo+hi)/2;
        if(deficit(mid*dx,mid*dz)>CRATER_FIDELITY_TOLERANCE.contourDepthM)lo=mid;else hi=mid;}
      radii.push((lo+hi)/2);
      // Independent analytic CSG contour against the actual intact relief, not a flat-plane
      // assumption. The same 25 cm threshold isolates sampling error from terrain curvature.
      lo=0;hi=radius+32;
      for(let j=0;j<24;j++) {
        const mid=(lo+hi)/2,x=mid*dx,z=mid*dz;
        const p=f.universe.frames.convertPosition(f.local,`${body}/fixed`,
          [x,f.intact.heightAt(x,z)-CRATER_FIDELITY_TOLERANCE.contourDepthM,z]);
        if(planetVolumeEditSignedDistance(edit,p)<0)lo=mid;else hi=mid;
      }
      analyticRadii.push((lo+hi)/2);
      const x=radii[i]*dx,z=radii[i]*dz;
      ray.set(new Vector3(...f.universe.renderSpace.logicalToRender(f.local,[x,10,z])),
        new Vector3(...f.universe.frames.convertDirection(f.local,f.universe.renderSpace.currentOrigin.frame,[0,-1,0])));
      const visual=ray.intersectObjects(f.renderer.root.children,false)[0];
      if(!visual)throw new Error('missing visual MC ray at extracted rim');
      const p=f.universe.renderSpace.renderToLogical(visual.point.toArray() as Vec3,f.local);
      visualErrors.push(Math.abs(p[1]-f.ray(x,z)!.point[1]));
    }
    const spacing=f.runtime.lod.baseChunkSizeM/(f.runtime.lod.samplesPerAxis-1);
    const tangentCorners=f.runtime.replacement.entries.flatMap(({source})=>{
      const b=source.boundsBodyFixedM;
      return [0,1,2,3,4,5,6,7].map(mask=>{
        const corner=b.minBodyFixedM.map((v,a)=>mask&(1<<a)?b.maxBodyFixedM[a]:v) as Vec3;
        const local=f.universe.frames.convertPosition(`${body}/fixed`,f.local,corner);
        return [local[0],local[2]] as const;
      });
    });
    const replacementFootprintRadiusBoundM=Math.max(...tangentCorners.map(([x,z])=>Math.hypot(x,z)));
    return {body,speedMps:speed,requestedRadiusM:radius,requestedDepthM:depth,spacingM:spacing,
      cellsAcrossDiameter:2*radius/spacing,cellsAcrossDepth:depth/spacing,measuredDepthM,
      nominalSamplesAcrossDiameter:1+2*radius/spacing,nominalSamplesAcrossDepth:1+depth/spacing,
      replacementFootprintRadiusBoundM,replacementOvershootBoundM:replacementFootprintRadiusBoundM-radius,
      replacementExtentLocalM:{minX:Math.min(...tangentCorners.map(p=>p[0])),maxX:Math.max(...tangentCorners.map(p=>p[0])),
        minZ:Math.min(...tangentCorners.map(p=>p[1])),maxZ:Math.max(...tangentCorners.map(p=>p[1]))},
      depthErrorM:Math.abs(measuredDepthM-depth),measuredOpeningRadiiM:radii,analyticContourRadiiM:analyticRadii,
      maxAnalyticContourErrorM:Math.max(...radii.map((r,i)=>Math.abs(r-analyticRadii[i]))),
      maxVisualColliderDisagreementM:Math.max(...visualErrors),
      maxOpeningRadiusErrorM:Math.max(...radii.map(r=>Math.abs(r-radius))),
      depthToleranceM:Math.min(CRATER_FIDELITY_TOLERANCE.depthM,depth*CRATER_FIDELITY_TOLERANCE.depthFraction)};
  } finally {f.dispose();}
}
export function craterFidelityAccepted(row:ReturnType<typeof measureCraterFidelity>):boolean {
  return row.depthErrorM<=row.depthToleranceM&&row.maxOpeningRadiusErrorM<=CRATER_FIDELITY_TOLERANCE.radiusM;
}
