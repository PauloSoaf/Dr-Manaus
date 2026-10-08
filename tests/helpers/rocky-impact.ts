import { Group, Vector3 } from 'three/webgpu';
import { UniverseRuntime } from '../../src/world/runtime/UniverseRuntime.ts';
import { IMPACT_VOLUME_LIMITS } from '../../src/world/planet/volume/PlanetVolumeImpactDemand.ts';
import { surfaceForBody } from '../../src/world/planet/BodySurfaceFactory.ts';
import { planetSurfaceRadius } from '../../src/world/planet/PlanetSurface.ts';
import { bodyProfile } from '../../src/world/celestial/CelestialBodyProfile.ts';
import { referenceFrame,activeFrame } from '../../src/world/spatial/ReferenceFrame.ts';
import { quatFromBasis } from '../../src/world/spatial/units.ts';
import { pose } from '../../src/world/spatial/SpatialPose.ts';
import { DEFAULT_STREAMING_BUDGET } from '../../src/world/streaming/StreamingBudget.ts';
import { PlanetVolumeTerrainProvider } from '../../src/world/planet/volume/PlanetVolumeTerrainProvider.ts';
import { PlanetVolumeCollisionProvider } from '../../src/world/planet/volume/PlanetVolumeCollisionProvider.ts';
import { PlanetTerrainProvider } from '../../src/world/planet/PlanetTerrainProvider.ts';
import { PlanetVolumeSurfaceRenderer } from '../../src/rendering/PlanetVolumeSurfaceRenderer.ts';
import { RockyImpactDestructionService } from '../../src/world/destruction/RockyImpactDestructionService.ts';
import { PhysicsWorld } from '../../src/physics/PhysicsWorld.ts';
import { classifyCelestialImpact } from '../../src/world/travel/CelestialImpactPolicy.ts';
import type { CelestialImpactEvent } from '../../src/world/travel/CelestialImpactEvent.ts';
import type { CelestialBody } from '../../src/world/celestial/CelestialBody.ts';
import type { StreamingContext } from '../../src/world/providers/WorldProvider.ts';
import { PlayerController } from '../../src/player/PlayerController.ts';
import { surfaceGravityMps2 } from '../../src/world/planet/PlanetBody.ts';
import type { InputController } from '../../src/player/InputController.ts';

export function rockyEvent(body:CelestialBody,speed=8000,id='unit-impact',kind?:CelestialImpactEvent['classification']):CelestialImpactEvent {
  const surface=surfaceForBody(body),radius=surface?planetSurfaceRadius(surface,[1,0,0]):body.equatorialRadiusM;
  const contact={bodyId:body.id,fraction:1,envelopeRadiusM:radius+1000,contactPositionM:[radius+1000,0,0] as [number,number,number],
    impactNormalSystem:[1,0,0] as [number,number,number],playerVelocityMps:[-speed,0,0] as [number,number,number],
    bodyVelocityMps:[0,0,0] as [number,number,number]};
  return {...classifyCelestialImpact(contact,bodyProfile(body),{autopilotActive:false,warpStep:0,simulationTimeS:0}),
    eventId:id,bodyId:body.id,contactBodyFixedM:contact.contactPositionM,contactSystemPositionM:contact.contactPositionM,simulationTimeS:0,
    ...(kind?{classification:kind}:{})};
}
export function impactFixture(id='moon',speed=8000,phaseM=0) {
  const universe=new UniverseRuntime({streaming:true,volume:IMPACT_VOLUME_LIMITS}),runtime=universe.volume,
    body=universe.activeSystem.bodies.find(b=>b.id===id)!,surface=surfaceForBody(body)!,baseEvent=rockyEvent(body,speed),
    radius=planetSurfaceRadius(surface,[1,0,0]),length=Math.hypot(radius,phaseM,phaseM),
    direction:[number,number,number]=[radius/length,phaseM/length,phaseM/length],
    point=direction.map(v=>v*planetSurfaceRadius(surface,direction)) as [number,number,number],local=`${id}/local-enu`,
    event={...baseEvent,contactBodyFixedM:direction.map(v=>v*(Math.hypot(...point)+1000)) as [number,number,number]};
  if(!universe.frames.has(`${id}/fixed`))universe.frames.register(referenceFrame({id:`${id}/fixed`,parentId:body.frameId,kind:'body-fixed'}));
  universe.frames.register(referenceFrame({id:local,parentId:`${id}/fixed`,kind:'surface-enu',originInParent:point,
    rotationToParent:quatFromBasis([0,1,0],[1,0,0],[0,0,-1])}));
  const scene=new Group(),renderer=new PlanetVolumeSurfaceRenderer(scene,universe.frames,universe.renderSpace,
    bodyId=>bodyProfile(universe.activeSystem.bodies.find(b=>b.id===bodyId)!),()=>{});
  runtime.setImpactPublication(renderer);let observer:[number,number,number]=[...point];
  const context=():StreamingContext=>{const player=pose(`${id}/fixed`,observer);return {spatial:{timeS:0,bodyId:id,player,
    frame:activeFrame(referenceFrame({id:`${id}/fixed`,kind:'body-fixed'}),player),localVelocityMps:[0,0,0],
    address:{galaxyId:'milky_way',sector:{x:0n,y:0n,z:0n},systemId:'sol'}},camera:{fovRad:1,viewportHeightPx:900,forward:[1,0,0]},
    quality:{sseTargetPx:8,detailFactor:1},budget:DEFAULT_STREAMING_BUDGET};};
  const service=new RockyImpactDestructionService({edits:runtime.edits,body:bodyId=>universe.activeSystem.bodies.find(b=>b.id===bodyId),
    requestRegion:(editId,plan)=>runtime.requestImpactRegion(editId,plan)});
  const intact=new PlanetTerrainProvider(universe.frames,surface.body,surface,local),
    terrain=new PlanetVolumeTerrainProvider(intact,runtime.replacement,universe.frames,id,`${id}/fixed`,local),
    volume=new PlanetVolumeCollisionProvider(runtime.collisionCache,universe.frames,id,`${id}/fixed`,local);
  const held=new Set<string>(),edges=new Set<string>(),input={held:(key:string)=>held.has(key),consume:(key:string)=>{
    const yes=edges.has(key);edges.delete(key);return yes;}} as unknown as InputController,
    player=new PlayerController(new Group(),input);
  player.setSurfaceGravity(surfaceGravityMps2(surface.body));
  const frame=(budget=1000)=>{runtime.covers(context());runtime.advance(budget);};
  const ready=()=>{for(let i=0;i<1600&&!runtime.replacement.entries.length;i++)frame();
    if(!runtime.replacement.entries.length)throw new Error(`impact fixture did not publish: ${JSON.stringify(runtime.metrics)}`);};
  const bind=()=>{PhysicsWorld.setTerrain(terrain);PhysicsWorld.setVolumeCollision(volume);};
  return {universe,runtime,body,surface,event,point,local,renderer,scene,service,intact,terrain,volume,player,held,edges,context,frame,ready,bind,
    consume:()=>service.consume(event),observer(value:[number,number,number]){observer=value;},
    step(dt=1/60){bind();player.update(dt,[],0);},
    ray(x=0,z=0){return volume.raycast([x,10,z],[0,-1,0],1200);},
    dispose(){PhysicsWorld.setTerrain(null);PhysicsWorld.setVolumeCollision(null);player.character.dispose();renderer.dispose();universe.dispose();}};
}
