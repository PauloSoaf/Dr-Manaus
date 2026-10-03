import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector2, Vector3 } from 'three/webgpu';
import { Game } from '../src/game/Game.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import { CameraController } from '../src/player/CameraController.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { PlanetTerrainProvider } from '../src/world/planet/PlanetTerrainProvider.ts';
import { surfaceGravityMps2, MOON } from '../src/world/planet/PlanetBody.ts';
import { TravelDomain } from '../src/world/travel/TravelDomain.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';
import type { InputController } from '../src/player/InputController.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

async function fixture(direction?:Vec3,clearanceM=4000) {
  const universe = new UniverseRuntime({epochS:0});
  const root = new Group(), providers=createPlanetProviders(root,universe), moon=providers.get('moon')!;
  const held=new Set<string>(),edges=new Set<string>();
  const input={enabled:true,mouseDelta:new Vector2(),held:(key:string)=>held.has(key),consume:(key:string)=>{
    const present=edges.has(key);edges.delete(key);return present;
  }} as unknown as InputController;
  const player=new PlayerController(root,input),camera=new PerspectiveCamera(57,1,.1,100_000);
  const controller=new CameraController(camera,input);controller.skipIntro();controller.inSpace=true;
  const travelDomain=new TravelDomain();
  const centre=universe.activeSystem.positionOf('moon')!,orbital=universe.activeSystem.stateOf('moon')!.velocityMps;
  const before:Vec3=direction?universe.frames.convertPosition('moon/fixed','solar-system/barycentric',
    direction.map(v=>v*(planetSurfaceRadius(MoonSurfaceGenerator,direction)+clearanceM)) as Vec3)
    :universe.frames.convertPosition('moon/fixed','solar-system/barycentric', [MOON.semiMajorAxisM+5000,0,0]);
  universe.updateSystemPose(before,orbital,0);
  travelDomain.update({altitudeM:10_000,speedMps:0,requested:true,nearestColliderM:Infinity,
    bodyId:'moon',bodyRadiusM:MOON.semiMajorAxisM,entryPositionM:before,entryVelocityMps:orbital},0);
  moon.setStreamingMode('surface');
  const spatialPose=pose('solar-system/barycentric',before);
  const ctx:StreamingContext={spatial:{timeS:0,player:spatialPose,
    frame:activeFrame(referenceFrame({id:'solar-system/barycentric',kind:'system'}),spatialPose),
    localVelocityMps:[0,0,0],altitudeM:5000,bodyId:'moon'},
    camera:{fovRad:1,viewportHeightPx:1080,forward:[-1,0,0]},quality:{sseTargetPx:8,detailFactor:1},budget:DEFAULT_STREAMING_BUDGET};
  const demands=moon.plan(ctx);
  const critical=demands.filter(d=>d.gameplayCritical);
  assert.ok(critical.length>0,'actual plan must prioritise the tile at the landing site');
  const game=Object.create(Game.prototype) as any;
  Object.assign(game,{universe,planetProviders:providers,player,input,camera:controller,travelDomain,
    rendering:{camera},viewForward:new Vector3(),physicsDomain:'space',surfaceTerrains:new Map(),
    colliders:[],curvedColliders:[],attackBoxes:[],blastBoxes:[],renderOriginVec:new Vector3(),
    localRoot:new Group(),actorRoot:new Group(),hud:{notify(){}},warpStep:0});
  const loadSite=async()=>{for(const demand of critical)moon.activate(await moon.load(demand));};
  const returnToMoon=()=>{ game.updateTravelDomain(0);assert.equal(travelDomain.transition.kind,'returned');game.finishSurfaceReturn('moon'); };
  const dispose=()=>{PhysicsWorld.setTerrain(null);player.character.dispose();universe.dispose();for(const p of providers.values())p.globe.dispose();};
  return {game,universe,player,camera,controller,travelDomain,moon,before,held,edges,critical,loadSite,returnToMoon,dispose};
}

test('T_MOON_RETURN_REQUIRES_SURFACE_READY',async()=>{
  const f=await fixture();try {
    f.game.updateTravelDomain(0);assert.equal(f.travelDomain.transition.kind,'none');
    assert.equal(f.travelDomain.landingGate.blockedReason,'surface-stream');
    assert.equal(f.travelDomain.kind,'interplanetary');
    assert.ok(f.critical.length>=2,'landing footprint at a tile boundary needs the neighbours');
    f.moon.activate(await f.moon.load(f.critical[0]));
    assert.equal(f.moon.readiness().surfaceCoverageReady,false,'a single loaded tile cannot cover the whole footprint');
    await f.loadSite();assert.ok(f.moon.readiness().surfaceCoverageReady);
    assert.ok(f.moon.readiness().activeTiles<96,'pouso must not wait for every tile of the visible hemisphere');
  }finally{f.dispose();}
});
for(const name of ['T_MOON_SAFE_APPROACH_RETURNS_LOCAL','T_MOON_HANDOFF_FRAME_IS_LOCAL_ENU','T_MOON_HANDOFF_PRESERVES_POSITION',
  'T_MOON_PHYSICS_BINDS_PLANET_TERRAIN','T_MOON_GRAVITY_USES_BODY_GRAVITY','T_MOON_PLAYER_NOT_BELOW_SURFACE_AFTER_HANDOFF']) {
  test(name,async()=>{
    const f=await fixture();try {
      await f.loadSite();f.returnToMoon();
      assert.equal(f.travelDomain.kind,'local');assert.equal(f.universe.player.frame,'moon/local-enu');
      assert.equal(f.game.surfacePhysicsState.domain,'moon');
      assert.ok(f.game.surfaceTerrains.get('moon') instanceof PlanetTerrainProvider);
      assert.ok(Math.abs(f.player.surfaceGravityMps2-surfaceGravityMps2(MOON))<1e-12);
      assert.ok(Math.abs(f.player.surfaceGravityMps2-1.623)<.01);
      assert.ok(new Vector3(...f.universe.playerSystemPositionM()).distanceTo(new Vector3(...f.before))<.001);
      assert.ok(f.player.position.y>=PhysicsWorld.terrainHeight(f.player.position.x,f.player.position.z,.32));
      assert.equal(f.player.state,'Falling');
    }finally{f.dispose();}
  });
}
test('T_MOON_HANDOFF_PRESERVES_VIEW_DIRECTION',async()=>{
  const f=await fixture();try {
    await f.loadSite();
    const previousFrame=f.universe.renderSpace.currentOrigin.frame;
    // Pick a heading with a small local pitch so local limits need no correction.
    const local=f.universe.frames.convertDirection('moon/fixed',previousFrame,[0,1,0]);
    f.camera.quaternion.setFromUnitVectors(new Vector3(0,0,-1),new Vector3(...local));f.camera.updateMatrixWorld();
    const viewBefore=f.universe.frames.convertDirection(previousFrame,'solar-system/barycentric',f.camera.getWorldDirection(new Vector3()).toArray());
    f.returnToMoon();f.camera.updateMatrixWorld();
    const after=f.universe.frames.convertDirection(f.universe.player.frame,'solar-system/barycentric',f.camera.getWorldDirection(new Vector3()).toArray());
    assert.ok(new Vector3(...viewBefore).distanceTo(new Vector3(...after))<1e-6);
  }finally{f.dispose();}
});
test('T_MOON_GROUNDED_ON_LOCAL_TERRAIN',async()=>{
  const f=await fixture();try {
    await f.loadSite();f.returnToMoon();
    // Let normal gravity and swept terrain resolve the full 5 km descent.
    for(let i=0;i<10_000 && f.player.state!=='Grounded';i++) f.player.update(.06,[],0,0);
    assert.equal(f.player.state,'Grounded');
    const floor=PhysicsWorld.terrainHeight(f.player.position.x,f.player.position.z,.32);
    assert.ok(Math.abs(f.player.position.y-floor)<.02);
    const start=f.player.position.clone();f.held.add('KeyW');for(let i=0;i<30;i++)f.player.update(.016,[],0,0);f.held.clear();
    assert.ok(f.player.position.distanceTo(start)>.5,'normal input walks after landing');
    f.edges.add('Space');f.player.update(.016,[],0,0);assert.ok(f.player.velocity.y>0,'normal jump applies lunar gravity');
    f.edges.add('KeyF');f.player.update(.016,[],0,0);assert.ok(f.player.state==='Hover'||f.player.state==='Flight');
  }finally{f.dispose();}
});

test('T_MOON_FAST_GAME_HANDOFF_TRACE: unsafe arrival retains cosmic CCD, safe return binds before movement',async()=>{
  const f=await fixture();try {
    await f.loadSite();
    const orbital=f.universe.activeSystem.stateOf('moon')!.velocityMps;
    const fixed=f.universe.frames.convertPosition('solar-system/barycentric','moon/fixed',f.before);
    const length=Math.hypot(...fixed);
    const inward=f.universe.frames.convertDirection('moon/fixed','solar-system/barycentric',fixed.map(v=>v/length*-10000) as Vec3);
    const velocity=orbital.map((v,i)=>v+inward[i]) as Vec3;
    f.travelDomain.setState({systemId:'sol',positionM:f.before,velocityMps:velocity,referenceBodyId:'moon'});
    f.universe.updateSystemPose(f.before,velocity,0);f.game.updateTravelDomain(1/30);
    assert.equal(f.travelDomain.kind,'interplanetary');
    assert.ok(['speed','inward-speed'].includes(f.travelDomain.landingGate.blockedReason));
    const safe=orbital.map((v,i)=>v+inward[i]/100) as Vec3;
    f.travelDomain.setState({systemId:'sol',positionM:f.before,velocityMps:safe,referenceBodyId:'moon'});
    f.universe.updateSystemPose(f.before,safe,0);f.returnToMoon();
    f.player.update(1/30,[],0);f.game.recordSurfaceReturnStep();
    const trace=f.game.surfaceReturnTrace;
    assert.equal(trace.frameBefore,'solar-system/barycentric');assert.equal(trace.frameAfter,'moon/local-enu');
    assert.equal(trace.physicsDomain,'moon');assert.ok(trace.surfaceReady);
    assert.ok(trace.radialSpeedMps>=-120);
    assert.ok(trace.firstLocalStep.position[1]>=trace.firstLocalStep.terrainHeightM);
  }finally{f.dispose();}
});
test('Moon highland approach measures terrain clearance before the reference ellipsoid gate',async()=>{
  let direction:Vec3=[1,0,0],height=-Infinity;
  for(let lat=-75;lat<=75;lat+=15)for(let lon=-180;lon<=180;lon+=15) {
    const a=lat*Math.PI/180,b=lon*Math.PI/180,d:Vec3=[Math.cos(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.sin(a)];
    if(MoonSurfaceGenerator.heightAt(d)>height){direction=d;height=MoonSurfaceGenerator.heightAt(d);}
  }
  assert.ok(height>4000);
  const f=await fixture(direction,4000);try {
    assert.ok(f.universe.telemetry.altitudeM>7000,'fixture is above the old ellipsoid threshold');
    await f.loadSite();f.returnToMoon();assert.equal(f.universe.player.frame,'moon/local-enu');
    assert.ok(f.player.position.y>PhysicsWorld.terrainHeight(0,0));
  }finally{f.dispose();}
});
test('T_MOON_HANDOFF_REGRESSION: controlled descent lands without a second F toggle',async()=>{
  const f=await fixture();try {
    await f.loadSite();f.returnToMoon();f.edges.add('KeyF');f.held.add('ControlLeft');f.held.add('ShiftLeft');
    for(let i=0;i<3000 && f.player.state!=='Grounded';i++)f.player.update(.06,[],0,0);
    assert.equal(f.player.state,'Grounded');f.held.clear();
    f.player.update(.016,[],0,0);assert.equal(f.player.state,'Grounded');
    assert.ok(Math.abs(f.player.position.y-PhysicsWorld.terrainHeight(f.player.position.x,f.player.position.z,.32))<.02);
  } finally {f.dispose();}
});
for(const name of ['T_MOON_DEPARTURE_RETURNS_INTERPLANETARY','T_MOON_DEPARTURE_BARYCENTRIC_POSITION_CONTINUOUS']) {
  test(name,async()=>{
    const f=await fixture();try {
      await f.loadSite();f.returnToMoon();
      f.edges.add('KeyF');f.held.add('Space');f.held.add('ShiftLeft');
      for(let i=0;i<2000 && (f.player.position.y<9500 || !f.player.interplanetaryMode);i++)f.player.update(.06,[],0,0);
      assert.ok(f.player.position.y>=9500);assert.ok(f.player.interplanetaryMode);
      f.universe.update(f.player.position.toArray(),f.player.velocity.toArray(),0);
      const before=f.universe.playerSystemPositionM();f.game.updateTravelDomain(0);
      assert.equal(f.travelDomain.kind,'interplanetary');assert.equal(f.travelDomain.transition.kind,'departed');
      assert.ok(new Vector3(...f.travelDomain.state!.positionM).distanceTo(new Vector3(...before))<.001);
    }finally{f.dispose();}
  });
}
