import { performance } from 'node:perf_hooks';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import { generateVolumeChunk } from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import { PlanetVolumeChunkCache,DEFAULT_VOLUME_CACHE_LIMITS } from '../src/world/planet/volume/PlanetVolumeChunkCache.ts';
import { selectVolumeChunkDemand } from '../src/world/planet/volume/PlanetVolumeChunkDemand.ts';
import { chunkContainingPoint,DEFAULT_VOLUME_LOD } from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { MarsSurfaceGenerator } from '../src/world/planet/MarsSurface.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import { PlanetVolumeMeshingJob,meshVolumeChunk } from '../src/world/planet/volume/PlanetVolumeMesher.ts';
import { PlanetVolumeMeshCache } from '../src/world/planet/volume/PlanetVolumeMeshCache.ts';
import { volumeMeshByteLength,maximumVolumeMeshBytes } from '../src/world/planet/volume/PlanetVolumeMesh.ts';
import { PlanetVolumeCollisionBuildJob } from '../src/world/planet/volume/PlanetVolumeCollisionBuilder.ts';
import { PlanetVolumeCollisionCache } from '../src/world/planet/volume/PlanetVolumeCollisionCache.ts';
import { PlanetVolumeCollisionProvider } from '../src/world/planet/volume/PlanetVolumeCollisionProvider.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import {benchmarkImpactSampling} from './benchmark-impact-sampling.mjs';
import {mkdir,writeFile} from 'node:fs/promises';

// Deterministic coordinates/edits; timings are observations, never CI thresholds. No generated files.
const timing = (field,offsetM=0) => {
  const radius=planetSurfaceRadius(field.surface,[1,0,0]),key=chunkContainingPoint(field.bodyId,[radius+offsetM,13,37]);
  for(let i=0;i<5;i++) generateVolumeChunk(field,key);
  const samples=[];let chunk;
  for(let i=0;i<21;i++) {const start=performance.now();chunk=generateVolumeChunk(field,key);samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);
  return {medianMs:+samples[10].toFixed(3),p95Ms:+samples[19].toFixed(3),overlappingEdits:chunk.overlappingEditCount,
    classification:chunk.classification};
};
const cases=[];
const meshCases=[];
const collisionCases=[];
const measure=fn=>{for(let i=0;i<5;i++)fn();const times=[];let result;
  for(let i=0;i<21;i++){const start=performance.now();result=fn();times.push(performance.now()-start);}times.sort((a,b)=>a-b);
  return {medianMs:+times[10].toFixed(4),p95Ms:+times[19].toFixed(4),result};};
const collisionTiming=(chunk,mesh,scenario,radius)=>{
  let jobPeakBytes=0;
  const build=measure(()=>{const job=new PlanetVolumeCollisionBuildJob(mesh,chunk);while(!job.advance(128))jobPeakBytes=Math.max(jobPeakBytes,job.pendingBytes);return job.collider;});
  const collider=build.result,cache=new PlanetVolumeCollisionCache();cache.insert(collider);
  const frames=new ReferenceFrameGraph();frames.register(referenceFrame({id:'benchmark-fixed',kind:'body-fixed'}));
  const provider=new PlanetVolumeCollisionProvider(cache,frames,mesh.key.bodyId,'benchmark-fixed','benchmark-fixed');
  // Record the radial corridor too: a capsule tunnel may legitimately be empty along it.
  const radialProbe={rayHit:!!provider.raycast([radius+300,128,128],[-1,0,0],1000),
    sweepHit:!!provider.sweepCapsule([radius+300,128,128],[-1000,0,0],.32,2.1)};
  // Time actual mesh contact in every scenario, using a real triangle centroid/empty normal.
  const point=[...mesh.originBodyFixedM],normal=[0,0,0],triangle=Math.floor(mesh.triangleCount/2);
  for(let corner=0;corner<3;corner++){const index=mesh.indices[triangle*3+corner]*3;
    for(let axis=0;axis<3;axis++){point[axis]+=mesh.positions[index+axis]/3;normal[axis]+=mesh.normals[index+axis];}}
  const length=Math.hypot(...normal);for(let axis=0;axis<3;axis++)normal[axis]/=length;
  const rayStart=point.map((v,i)=>v+normal[i]*10),direction=normal.map(v=>-v),
    sweepStart=point.map((v,i)=>v+normal[i]*300-(i===1?1.05:0)),delta=normal.map(v=>-v*1000);
  const query=measure(()=>{provider.resetMetrics();return provider.raycast(rayStart,direction,20);});
  const rayCandidates={...provider.metrics};
  const fastSweep=measure(()=>{provider.resetMetrics();return provider.sweepCapsule(sweepStart,delta,.32,2.1);});
  if(!query.result||!fastSweep.result)throw new Error(`representative collision query missed ${mesh.key.bodyId}/${scenario}`);
  collisionCases.push({body:mesh.key.bodyId,scenario,samplesPerAxis:17,triangles:mesh.triangleCount,nodes:collider.bvh.nodeCount,
    memory:collider.memory,jobPeakBytes,radialProbe,build:{medianMs:build.medianMs,p95Ms:build.p95Ms},
    raycast:{medianMs:query.medianMs,p95Ms:query.p95Ms,hit:!!query.result,candidateChunks:rayCandidates.candidateChunks,candidateTriangles:rayCandidates.candidateTriangles},
    fastSweep:{medianMs:fastSweep.medianMs,p95Ms:fastSweep.p95Ms,hit:!!fastSweep.result,fraction:fastSweep.result?.fraction,
      candidateChunks:provider.metrics.candidateChunks,candidateTriangles:provider.metrics.candidateTriangles}});cache.clearAll();
};
const meshTiming=(field,scenario)=>{
  const radius=planetSurfaceRadius(field.surface,[1,0,0]),key=chunkContainingPoint(field.bodyId,[radius,128,128]);
  const chunk=generateVolumeChunk(field,key);
  for(let i=0;i<5;i++) meshVolumeChunk(chunk);
  const times=[];let mesh,jobPeakBytes=0;
  for(let i=0;i<21;i++) {
    const start=performance.now(),job=new PlanetVolumeMeshingJob(chunk);
    while(!job.advance(64)) jobPeakBytes=Math.max(jobPeakBytes,job.pendingBytes);
    mesh=job.mesh;times.push(performance.now()-start);
  }
  times.sort((a,b)=>a-b);meshCases.push({body:field.bodyId,scenario,medianMs:+times[10].toFixed(3),p95Ms:+times[19].toFixed(3),
    vertices:mesh.vertexCount,triangles:mesh.triangleCount,bytes:volumeMeshByteLength(mesh),jobPeakBytes,ambiguousFaces:mesh.ambiguousFaceCount});
  collisionTiming(chunk,mesh,scenario,radius);
};
for(const surface of [EarthSurfaceGenerator,MoonSurfaceGenerator,MarsSurfaceGenerator]) {
  const field=new PlanetVolumeField(surface),radius=planetSurfaceRadius(surface,[1,0,0]);
  cases.push({body:field.bodyId,scenario:'intact',...timing(field)});
  cases.push({body:field.bodyId,scenario:'intact-solid',...timing(field,-2048)});
  cases.push({body:field.bodyId,scenario:'empty',...timing(field,2048)});
  field.edits.subtractSphere({bodyId:field.bodyId,centerBodyFixedM:[radius,64,64],radiusM:80});
  cases.push({body:field.bodyId,scenario:'one-sphere',...timing(field)});
  for(let i=1;i<16;i++) field.edits.subtractSphere({bodyId:field.bodyId,
    centerBodyFixedM:[radius-16*(i%4),32*(i%5),32*Math.floor(i/4)],radiusM:40});
  cases.push({body:field.bodyId,scenario:'16-spheres',...timing(field)});
  const preview=new PlanetVolumeField(surface);meshTiming(preview,'intact');
  const id=preview.edits.subtractSphere({bodyId:field.bodyId,centerBodyFixedM:[radius-48,128,128],radiusM:72});
  meshTiming(preview,'sphere');preview.edits.remove(id);
  preview.edits.subtractCapsule({bodyId:field.bodyId,aBodyFixedM:[radius+128,128,128],bBodyFixedM:[radius-512,128,128],radiusM:56});
  meshTiming(preview,'capsule');
}
const earth=new PlanetVolumeField(EarthSurfaceGenerator),radius=planetSurfaceRadius(EarthSurfaceGenerator,[1,0,0]);
earth.edits.subtractCapsule({bodyId:'earth',aBodyFixedM:[-radius-100,0,0],bBodyFixedM:[radius+100,0,0],radiusM:100});
const cache=new PlanetVolumeChunkCache(DEFAULT_VOLUME_CACHE_LIMITS,earth.edits);
const meshes=new PlanetVolumeMeshCache();
const beforeDemand={...earth.edits.indexStats('earth'),resident:cache.stats().resident,bytes:cache.stats().bytes};
const stages=[];
for(const observer of [[radius,0,0],[0,0,0],[-radius,0,0]]) {
  const demands=selectVolumeChunkDemand('earth',observer,undefined,undefined,false);
  cache.retainNear('earth',observer,1536,new Set(demands.map(d=>`volume/earth/${d.key.lod}/${d.key.x}/${d.key.y}/${d.key.z}`)));
  for(const d of demands) cache.insert(generateVolumeChunk(earth,d.key));
  meshes.prune(cache);let selected=0;
  for(const d of demands) {
    const chunk=cache.peek(d.key);if(chunk.classification!=='MIXED'||selected>=8) continue;
    meshes.insert(chunk,meshVolumeChunk(chunk));selected++;
  }
  const stats=cache.stats();stages.push({observer,demands:demands.length,resident:stats.resident,bytes:stats.bytes,
    mib:+(stats.bytes/1048576).toFixed(4),lodCounts:stats.lodCounts,meshes:meshes.stats()});
}
const output={lod:DEFAULT_VOLUME_LOD,samplesPerChunk:17**3,bytesPerChunk:17**3*4,
  maxCacheChunks:cache.limits.maxChunks,maxCacheBytes:cache.limits.maxBytes,
  maxResidentBytesAtChunkCap:cache.limits.maxChunks*17**3*4,pendingJobBytes:17**3*12,
  generation:{warmups:5,repetitions:21,cases},meshing:{warmups:5,repetitions:21,cases:meshCases,
    maximumOutputBytes:maximumVolumeMeshBytes(17),maxResidentMeshes:meshes.limits.maxMeshes,maxResidentMeshBytes:meshes.limits.maxBytes},
  collision:{warmups:5,repetitions:21,maxColliders:8,maxResidentBytes:8*1048576,maxBuildBytes:4*1048576,cases:collisionCases},
  throughEarth:{beforeDemand,stages}};
cache.dispose();meshes.clearAll();output.impactSampling=benchmarkImpactSampling();
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/benchmark-volume.json',JSON.stringify(output,null,2));
console.log(JSON.stringify(output,null,2));
