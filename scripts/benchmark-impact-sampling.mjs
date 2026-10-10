import {performance} from 'node:perf_hooks';
import {impactFixture} from '../tests/helpers/rocky-impact.ts';
import {PlanetVolumeField} from '../src/world/planet/volume/PlanetVolumeField.ts';
import {volumeChunkKey,chunkContainingPoint} from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import {generateVolumeChunk,PlanetVolumeChunkGenerationJob} from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import {chunkByteLength} from '../src/world/planet/volume/PlanetVolumeChunk.ts';
import {meshVolumeChunk,PlanetVolumeMeshingJob} from '../src/world/planet/volume/PlanetVolumeMesher.ts';
import {volumeMeshByteLength} from '../src/world/planet/volume/PlanetVolumeMesh.ts';
import {PlanetVolumeCollisionBuildJob} from '../src/world/planet/volume/PlanetVolumeCollisionBuilder.ts';
import {PlanetVolumeCollisionCache} from '../src/world/planet/volume/PlanetVolumeCollisionCache.ts';
import {PlanetVolumeCollisionProvider} from '../src/world/planet/volume/PlanetVolumeCollisionProvider.ts';
const measure=fn=>{for(let i=0;i<3;i++)fn();const times=[];let result;
  for(let i=0;i<21;i++){const start=performance.now();result=fn();times.push(performance.now()-start);}times.sort((a,b)=>a-b);
  return {medianMs:times[10],p95Ms:times[19],result};};
export function benchmarkImpactSampling() {
  const f=impactFixture('moon',260),rows=[];
  try{f.consume();const field=new PlanetVolumeField(f.surface,f.runtime.edits),base=chunkContainingPoint('moon',f.point);
    for(const profile of ['standard','impact-high']){
      const key=volumeChunkKey(base.bodyId,0,base.x,base.y,base.z,profile),generation=measure(()=>generateVolumeChunk(field,key)),chunk=generation.result;
      let meshPeakBytes=0,bvhPeakBytes=0;
      const meshing=measure(()=>{const j=new PlanetVolumeMeshingJob(chunk);while(!j.advance(64))meshPeakBytes=Math.max(meshPeakBytes,j.pendingBytes);
        meshPeakBytes=Math.max(meshPeakBytes,j.pendingBytes+volumeMeshByteLength(j.mesh));return j.mesh;});
      const mesh=meshing.result,building=measure(()=>{const j=new PlanetVolumeCollisionBuildJob(mesh,chunk);
        while(!j.advance(128))bvhPeakBytes=Math.max(bvhPeakBytes,j.pendingBytes);return j.collider;});
      const cache=new PlanetVolumeCollisionCache();if(!cache.insert(building.result))throw new Error('benchmark collider admission failed');
      const provider=new PlanetVolumeCollisionProvider(cache,f.universe.frames,'moon','moon/fixed',f.local);
      const ray=measure(()=>provider.raycast([10,10,-10],[0,-1,0],200)),sweep=measure(()=>provider.sweepCapsule([10,10,-10],[0,-200,0],.32,2.1));
      if(!ray.result||!sweep.result)throw new Error('benchmark production HIGH/standard contact missing');
      rows.push({body:'moon',profile,physicalChunk:[base.x,base.y,base.z],samplesPerAxis:chunk.samplesPerAxis,samples:chunk.distances.length,
        boundarySamples:chunk.boundaryDistances?.length??0,spacingM:chunk.spacingM,scalarBytes:chunkByteLength(chunk),
        generationScratchBytes:new PlanetVolumeChunkGenerationJob(field,key).pendingBytes,
        generation:{medianMs:generation.medianMs,p95Ms:generation.p95Ms},vertices:mesh.vertexCount,triangles:mesh.triangleCount,
        meshBytes:volumeMeshByteLength(mesh),meshPeakBytes,meshing:{medianMs:meshing.medianMs,p95Ms:meshing.p95Ms},
        colliderBytes:building.result.memory.bytes,bvhBytes:building.result.memory.nodeBytes+building.result.memory.referenceBytes,bvhPeakBytes,
        building:{medianMs:building.medianMs,p95Ms:building.p95Ms},raycast:{medianMs:ray.medianMs,p95Ms:ray.p95Ms},
        capsuleSweep:{medianMs:sweep.medianMs,p95Ms:sweep.p95Ms}});cache.clearAll();
    }
    return {warmups:3,repetitions:21,coreSampleRatio:33**3/17**3,rows};
  }finally{f.dispose();}
}
