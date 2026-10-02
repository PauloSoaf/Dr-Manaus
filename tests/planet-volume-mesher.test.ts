import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlanetVolumeMeshingJob, meshVolumeChunk, MAX_VOLUME_MESH_JOB_BYTES } from '../src/world/planet/volume/PlanetVolumeMesher.ts';
import { MARCHING_CUBES_TRIANGLES } from '../src/world/planet/volume/MarchingCubesTable.ts';
import { volumeMeshByteLength,maximumVolumeMeshBytes,type PlanetVolumeMesh } from '../src/world/planet/volume/PlanetVolumeMesh.ts';
import { generateVolumeChunk } from '../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import { volumeChunkKey,chunkContainingPoint,chunkBoundsBodyFixedM } from '../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import type { PlanetVolumeChunk } from '../src/world/planet/volume/PlanetVolumeChunk.ts';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { MarsSurfaceGenerator } from '../src/world/planet/MarsSurface.ts';
import { planetSurfaceRadius,type PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface.ts';

function grid(fn:(x:number,y:number,z:number)=>number,n=17,offset:[number,number,number]=[0,0,0]): PlanetVolumeChunk {
  const key=volumeChunkKey('fixture',0,...offset),bounds=chunkBoundsBodyFixedM(key),spacing=256/(n-1);
  const distances=new Float32Array(n**3);let positive=false,negative=false,zero=false;
  for(let z=0;z<n;z++) for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    const d=fn(bounds.minBodyFixedM[0]+x*spacing,bounds.minBodyFixedM[1]+y*spacing,bounds.minBodyFixedM[2]+z*spacing);
    distances[x+n*(y+n*z)]=d;positive ||= d>0;negative ||= d<0;zero ||= d===0;
  }
  return {key,boundsBodyFixedM:bounds,editQueryBoundsBodyFixedM:bounds,originBodyFixedM:bounds.minBodyFixedM,
    spacingM:spacing,samplesPerAxis:n,cellsPerAxis:n-1,distances,intactMaterial:'rock',sourceRevision:7,
    overlappingEditCount:0,state:'ready',classification:zero||positive&&negative?'MIXED':positive?'EMPTY':'SOLID'};
}
function verify(mesh:PlanetVolumeMesh,edge=256): void {
  assert.equal(mesh.positions.length,mesh.vertexCount*3);assert.equal(mesh.normals.length,mesh.positions.length);
  assert.equal(mesh.indices.length,mesh.triangleCount*3);assert.ok(mesh.triangleCount>0);
  assert.ok([...mesh.positions].every(p=>Number.isFinite(p)&&p>=0&&p<=edge));
  for(const index of mesh.indices) {
    assert.ok(index<mesh.vertexCount);const o=index*3;
    assert.ok(Math.abs(Math.hypot(mesh.normals[o],mesh.normals[o+1],mesh.normals[o+2])-1)<1e-5);
  }
  for(let i=0;i<mesh.indices.length;i+=3) {
    const [a,b,c]=[mesh.indices[i]*3,mesh.indices[i+1]*3,mesh.indices[i+2]*3],p=mesh.positions;
    const u=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],v=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];
    assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-8);
  }
}
test('T_VOLUME_MC_TABLE_256_CASES',()=>{
  assert.equal(MARCHING_CUBES_TRIANGLES.length,4096);
  for(let code=0;code<256;code++) {
    const row=Array.from(MARCHING_CUBES_TRIANGLES.slice(code*16,(code+1)*16));
    const end=row.indexOf(-1);assert.ok(end>=0&&end<=15&&end%3===0);
    assert.ok(row.slice(0,end).every(edge=>edge>=0&&edge<12));assert.ok(row.slice(end).every(edge=>edge===-1));
    const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    const chunk=grid((x,y,z)=>{const i=corners.findIndex(c=>c[0]===x/256&&c[1]===y/256&&c[2]===z/256);return code&(1<<i)?-1:1;},2);
    const mesh=meshVolumeChunk(chunk);assert.equal(mesh.triangleCount,end/3);
    if(end) verify(mesh);
  }
});
test('T_VOLUME_MC_EMPTY_SOLID_SKIP',()=>{
  for(const value of [-1,1]) {
    const mesh=meshVolumeChunk(grid(()=>value));assert.equal(mesh.triangleCount,0);assert.equal(mesh.vertexCount,0);
    assert.equal(volumeMeshByteLength(mesh),0);
  }
});
test('T_VOLUME_MC_PLANE_INTERPOLATION_WINDING_NORMALS',()=>{
  const mesh=meshVolumeChunk(grid(x=>x-123.25));verify(mesh);
  assert.equal(mesh.vertexCount,289);assert.equal(mesh.triangleCount,512);
  for(let i=0;i<mesh.positions.length;i+=3) {assert.equal(mesh.positions[i],123.25);assert.equal(mesh.normals[i],1);}
  for(let i=0;i<mesh.indices.length;i+=3) {
    const a=mesh.indices[i]*3,b=mesh.indices[i+1]*3,c=mesh.indices[i+2]*3,p=mesh.positions;
    assert.ok((p[b+1]-p[a+1])*(p[c+2]-p[a+2])-(p[b+2]-p[a+2])*(p[c+1]-p[a+1])>0);
  }
});
test('T_VOLUME_MC_EXACT_ZERO_WELDS_AND_DROPS_DEGENERATES',()=>{
  const mesh=meshVolumeChunk(grid((x,y,z)=>x+y+z-256));verify(mesh);
  const points=new Set(Array.from({length:mesh.vertexCount},(_,i)=>Array.from(mesh.positions.slice(i*3,i*3+3)).join(',')));
  assert.equal(points.size,mesh.vertexCount);assert.ok(mesh.droppedDegenerateTriangles>0);
  const allZero=meshVolumeChunk(grid(()=>0));assert.equal(allZero.triangleCount,0);assert.equal(allZero.vertexCount,0);
});
test('T_VOLUME_MC_CLOSED_SPHERE_TOPOLOGY_AND_OUTWARD_NORMALS',()=>{
  const mesh=meshVolumeChunk(grid((x,y,z)=>Math.hypot(x-128,y-128,z-128)-83));verify(mesh);
  const edges=new Map<string,number>();
  for(let i=0;i<mesh.indices.length;i+=3) for(let j=0;j<3;j++) {
    const a=mesh.indices[i+j],b=mesh.indices[i+(j+1)%3],id=[Math.min(a,b),Math.max(a,b)].join(':');
    edges.set(id,(edges.get(id)??0)+1);
  }
  assert.ok([...edges.values()].every(count=>count===2));assert.equal(mesh.vertexCount-edges.size+mesh.triangleCount,2);
  for(let i=0;i<mesh.vertexCount;i++) {
    const o=i*3,x=mesh.positions[o]-128,y=mesh.positions[o+1]-128,z=mesh.positions[o+2]-128;
    assert.ok(Math.abs(Math.hypot(x,y,z)-83)<1.5);
    assert.ok(x*mesh.normals[o]+y*mesh.normals[o+1]+z*mesh.normals[o+2]>0);
  }
});
const sphere:PlanetSurfaceGenerator={body:{id:'fixture',semiMajorAxisM:1024,flattening:0,rotationPeriodS:1,parentFrame:'test'},
  radiusM:1024,heightAt:()=>0,normalEnu:()=>{},colourAt:()=>{}};
test('T_VOLUME_MC_SUBTRACT_SPHERE_INTERIOR_WALLS',()=>{
  const field=new PlanetVolumeField(sphere);field.edits.subtractSphere({bodyId:'fixture',centerBodyFixedM:[128,128,128],radiusM:83});
  const mesh=meshVolumeChunk(generateVolumeChunk(field,volumeChunkKey('fixture',0,0,0,0)));verify(mesh);
  for(let i=0;i<mesh.vertexCount;i++) {
    const o=i*3,x=mesh.positions[o]-128,y=mesh.positions[o+1]-128,z=mesh.positions[o+2]-128;
    assert.ok(Math.abs(Math.hypot(x,y,z)-83)<1.5);assert.ok(x*mesh.normals[o]+y*mesh.normals[o+1]+z*mesh.normals[o+2]<0);
  }
});
test('T_VOLUME_MC_CAPSULE_TUNNEL_IS_OPEN_AT_CHUNK_FACES',()=>{
  const field=new PlanetVolumeField(sphere);field.edits.subtractCapsule({bodyId:'fixture',aBodyFixedM:[-2048,128,128],bBodyFixedM:[2048,128,128],radiusM:55});
  const mesh=meshVolumeChunk(generateVolumeChunk(field,volumeChunkKey('fixture',0,0,0,0)));verify(mesh);
  for(let i=0;i<mesh.vertexCount;i++) {
    const o=i*3,y=mesh.positions[o+1]-128,z=mesh.positions[o+2]-128;
    assert.ok(Math.abs(Math.hypot(y,z)-55)<1.5);assert.ok(Math.abs(mesh.normals[o])<1e-5);
    assert.ok(y*mesh.normals[o+1]+z*mesh.normals[o+2]<0);
  }
  assert.ok([...mesh.positions].includes(0)&&[...mesh.positions].includes(256));
});
test('T_VOLUME_MC_ADJACENT_SAME_LOD_BOUNDARY_VERTICES',()=>{
  const fn=(x:number,y:number,z:number)=>Math.hypot(x-256,y-128,z-128)-90;
  const a=meshVolumeChunk(grid(fn)),b=meshVolumeChunk(grid(fn,17,[1,0,0]));
  const boundary=(mesh:PlanetVolumeMesh,face:number)=>{
    const positions=[];for(let i=0;i<mesh.vertexCount;i++) if(mesh.positions[i*3]===face) {
      positions.push([mesh.originBodyFixedM[0]+mesh.positions[i*3],mesh.positions[i*3+1],mesh.positions[i*3+2]].join(','));
    }
    return positions.sort();
  };
  assert.ok(boundary(a,256).length>0);assert.deepEqual(boundary(a,256),boundary(b,0));
});
test('T_VOLUME_MC_DETERMINISM_RESUMPTION_SOURCE_REVISION',()=>{
  const chunk=grid((x,y,z)=>Math.hypot(x-128,y-128,z-128)-83),before=chunk.distances.slice();
  const job=new PlanetVolumeMeshingJob(chunk);assert.equal(job.advance(1),false);assert.equal(job.mesh,undefined);
  let maximumBytes=0;while(!job.advance(23)) maximumBytes=Math.max(maximumBytes,job.pendingBytes);
  assert.ok(maximumBytes<MAX_VOLUME_MESH_JOB_BYTES);assert.deepEqual(job.mesh,meshVolumeChunk(chunk));
  assert.deepEqual(chunk.distances,before);assert.equal(job.mesh!.sourceRevision,7);
  assert.ok(volumeMeshByteLength(job.mesh!)<=maximumVolumeMeshBytes(17));
});
test('T_VOLUME_MC_STALE_AND_MALFORMED_INPUT_REJECTED',()=>{
  const chunk=grid(x=>x-128),job=new PlanetVolumeMeshingJob(chunk);chunk.state='stale';assert.throws(()=>job.advance());
  assert.throws(()=>new PlanetVolumeMeshingJob(chunk));
  const bad=grid(x=>x-128);bad.distances[100]=NaN;assert.throws(()=>meshVolumeChunk(bad));
  assert.throws(()=>new PlanetVolumeMeshingJob({...bad,distances:new Float32Array(3)}));
  assert.throws(()=>new PlanetVolumeMeshingJob(grid(x=>x-128,33)),/budget/);
});
test('T_VOLUME_MC_EARTH_MOON_MARS_BASE_AND_CUT',()=>{
  for(const surface of [EarthSurfaceGenerator,MoonSurfaceGenerator,MarsSurfaceGenerator]) {
    const field=new PlanetVolumeField(surface),radius=planetSurfaceRadius(surface,[1,0,0]);
    const key=chunkContainingPoint(field.bodyId,[radius,128,128]);
    const intact=meshVolumeChunk(generateVolumeChunk(field,key));verify(intact);
    field.edits.subtractSphere({bodyId:field.bodyId,centerBodyFixedM:[radius-48,128,128],radiusM:72});
    const cut=meshVolumeChunk(generateVolumeChunk(field,key));verify(cut);
    assert.equal(cut.key.bodyId,surface.body.id);assert.equal(cut.sourceRevision,1);assert.notDeepEqual(cut.positions,intact.positions);
  }
});
test('T_VOLUME_MC_AMBIGUITY_IS_OBSERVABLE',()=>{
  const mesh=meshVolumeChunk(grid((x,y,z)=>(x<128?1:-1)*(y<128?1:-1)*(z<128?1:-1)));
  verify(mesh);assert.ok(mesh.ambiguousFaceCount>0);
});
test('T_VOLUME_MC_NO_RENDERER_OR_FIELD_QUERY',()=>{
  const source=readFileSync(new URL('../src/world/planet/volume/PlanetVolumeMesher.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from\s+['"]three|window\.|document\.|queryBounds|sampleBodyFixed|setInterval/);
});
