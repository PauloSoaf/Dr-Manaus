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
  throughEarth:{beforeDemand,stages}};
cache.dispose();meshes.clearAll();console.log(JSON.stringify(output,null,2));
