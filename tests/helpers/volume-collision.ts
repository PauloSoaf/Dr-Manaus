import { Vector3, Group } from 'three/webgpu';
import { UniverseRuntime } from '../../src/world/runtime/UniverseRuntime.ts';
import { surfaceForBody } from '../../src/world/planet/BodySurfaceFactory.ts';
import { planetSurfaceRadius } from '../../src/world/planet/PlanetSurface.ts';
import { PlanetVolumeField } from '../../src/world/planet/volume/PlanetVolumeField.ts';
import { generateVolumeChunk } from '../../src/world/planet/volume/PlanetVolumeChunkGenerator.ts';
import { chunkContainingPoint,chunkBoundsBodyFixedM,volumeChunkKey } from '../../src/world/planet/volume/PlanetVolumeChunkKey.ts';
import { meshVolumeChunk } from '../../src/world/planet/volume/PlanetVolumeMesher.ts';
import { PlanetVolumeCollisionBuildJob,buildVolumeCollider } from '../../src/world/planet/volume/PlanetVolumeCollisionBuilder.ts';
import { PlanetVolumeCollisionCache } from '../../src/world/planet/volume/PlanetVolumeCollisionCache.ts';
import { PlanetVolumeCollisionProvider } from '../../src/world/planet/volume/PlanetVolumeCollisionProvider.ts';
import { referenceFrame } from '../../src/world/spatial/ReferenceFrame.ts';
import { quatFromBasis } from '../../src/world/spatial/units.ts';
import { PhysicsWorld } from '../../src/physics/PhysicsWorld.ts';
import { PlayerController } from '../../src/player/PlayerController.ts';
import type { PlanetVolumeMesh } from '../../src/world/planet/volume/PlanetVolumeMesh.ts';
import type { InputController } from '../../src/player/InputController.ts';

/** Main integration fixture: actual planetary field → sampled chunk → MC → collider. */
export function cavity(id='earth',radius=1.9) {
  const universe=new UniverseRuntime(),body=universe.activeSystem.bodies.find(b=>b.id===id)!,surface=surfaceForBody(body)!;
  const lod={baseChunkSizeM:16,samplesPerAxis:17,maxLod:0},r=planetSurfaceRadius(surface,[1,0,0]),
    key=chunkContainingPoint(id,[r-256,8,8],0,lod),bounds=chunkBoundsBodyFixedM(key,lod),
    centre=bounds.minBodyFixedM.map(v=>v+8) as [number,number,number];
  const field=new PlanetVolumeField(surface);
  field.edits.subtractSphere({bodyId:id,centerBodyFixedM:centre,radiusM:radius});
  const chunk=generateVolumeChunk(field,key,lod),mesh=meshVolumeChunk(chunk),job=new PlanetVolumeCollisionBuildJob(mesh,chunk);
  while(!job.advance(128)){}const collider=job.collider!,cache=new PlanetVolumeCollisionCache();cache.insert(collider);
  const local=`${id}/d0-local-enu`;
  universe.frames.register(referenceFrame({id:local,kind:'surface-enu',parentId:body.frameId,originInParent:centre,
    rotationToParent:quatFromBasis([0,1,0],[1,0,0],[0,0,-1])}));
  const provider=new PlanetVolumeCollisionProvider(cache,universe.frames,id,body.frameId,local);
  const held=new Set<string>(),edges=new Set<string>(),input={held:(k:string)=>held.has(k),consume:(k:string)=>{
    const yes=edges.has(k);edges.delete(k);return yes;}} as unknown as InputController;
  const player=new PlayerController(new Group(),input);player.position.set(0,-.5,0);player.state='Falling';
  PhysicsWorld.setTerrain(null);PhysicsWorld.setVolumeCollision(provider);
  return {universe,field,key,chunk,mesh,collider,cache,provider,centre,local,player,held,edges,
    step:(dt=1/60)=>player.update(dt,[],0),
    dispose(){PhysicsWorld.setVolumeCollision(null);PhysicsWorld.setTerrain(null);player.character.dispose();universe.dispose();}};
}
export function planeMesh(kind:'floor'|'wall'|'ceiling'='floor',revision=1):PlanetVolumeMesh {
  const positions=new Float32Array(kind==='wall'?[0,-10,-10,0,10,-10,0,10,10,0,-10,10]:[-10,0,-10,10,0,-10,10,0,10,-10,0,10]);
  const normal=kind==='wall'?[1,0,0]:kind==='floor'?[0,1,0]:[0,-1,0];
  return {key:volumeChunkKey('earth',0,0,0,0),originBodyFixedM:[0,0,0],sourceRevision:revision,
    positions,normals:new Float32Array([...normal,...normal,...normal,...normal]),indices:new Uint32Array([0,1,2,0,2,3]),
    vertexCount:4,triangleCount:2,droppedDegenerateTriangles:0,ambiguousFaceCount:0};
}
export function planeProvider(kind:'floor'|'wall'|'ceiling'='floor') {
  const universe=new UniverseRuntime();const frames=universe.frames;
  frames.register(referenceFrame({id:'unit-fixed',kind:'body-fixed'}));
  const mesh=planeMesh(kind),collider=buildVolumeCollider(mesh),cache=new PlanetVolumeCollisionCache();
  // Explicit narrow-phase triangles straddle the origin; bound that authored unit mesh correctly.
  cache.insert({...collider,boundsBodyFixedM:{minBodyFixedM:[-10,-10,-10],maxBodyFixedM:[10,10,10]}});
  const provider=new PlanetVolumeCollisionProvider(cache,frames,'earth','unit-fixed','unit-fixed');
  return {provider,cache,mesh,collider,dispose:()=>universe.dispose()};
}
