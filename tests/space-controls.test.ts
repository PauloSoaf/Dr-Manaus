import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector2, Vector3 } from 'three/webgpu';
import { Game } from '../src/game/Game.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { CosmicCruiseController, BASE_THRUST_ACCEL } from '../src/world/travel/CosmicFlight.ts';
import { TravelDomain } from '../src/world/travel/TravelDomain.ts';
import { PlanetaryLandingIntent } from '../src/world/travel/PlanetaryLanding.ts';
import { NavigationTargetState } from '../src/world/travel/NavigationLock.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import type { InputController } from '../src/player/InputController.ts';
import { FLIGHT } from '../src/player/flightConfig.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

function controls() {
  const held = new Set<string>(), edges = new Set<string>();
  const input = { enabled:true, mouseDelta:new Vector2(), held:(key:string)=>held.has(key),
    consume:(key:string)=>{const yes=edges.has(key);edges.delete(key);return yes;} } as unknown as InputController;
  return {held,edges,input};
}

/** Real Game input step, real reference frames, real cruise controller; no renderer required. */
function fixture() {
  const universe = new UniverseRuntime({epochS:0}), c=controls();
  const moon = universe.activeSystem.positionOf('moon')!;
  const position:Vec3 = [moon[0],moon[1]+100_000_000,moon[2]];
  universe.updateSystemPose(position,[0,0,0],0);
  const orbital = universe.activeSystem.stateOf(universe.telemetry.dominantBody)!.velocityMps;
  universe.updateSystemPose(position,orbital,0);
  const travelDomain = new TravelDomain();
  travelDomain.update({altitudeM:100_000_000,speedMps:0,requested:true,nearestColliderM:Infinity,
    bodyId:universe.telemetry.dominantBody,bodyRadiusM:1_738_100,entryPositionM:position,entryVelocityMps:orbital},0);
  const camera = new PerspectiveCamera(60,1,.1,1e6);
  const view=universe.frames.convertDirection('solar-system/barycentric',universe.renderSpace.currentOrigin.frame,[0,-1,0]);
  camera.lookAt(new Vector3(...view));camera.updateMatrixWorld();
  const g=Object.create(Game.prototype) as any;
  const controller=new CosmicCruiseController();
  const contexts:any[]=[];
  const update=controller.update.bind(controller);
  controller.update=(state,dt,thrust,ctx)=>{contexts.push({...ctx,thrust:thrust.clone()});return update(state,dt,thrust,ctx);};
  Object.assign(g,{universe,travelDomain,input:c.input,interplanetary:controller,
    navigation:new NavigationTargetState(),landingIntent:new PlanetaryLandingIntent(),warpStep:0,
    player:{state:'Flight',velocity:new Vector3(),position:new Vector3(),interplanetaryMode:false},
    rendering:{camera},viewForward:new Vector3(...view),colliders:[],curvedColliders:[],
    planetProviders:new Map(),hud:{notify(){}},
    celestialController:{renderSamples:universe.activeSystem.bodies.map(b=>({bodyId:b.id,proxyDistanceM:100}))}});
  const step=(dt=1/60)=>{g.updateTravelDomain(dt);g.updateInterplanetaryFlight(dt);};
  const speed=()=>new Vector3(...travelDomain.state!.velocityMps).sub(new Vector3(...orbital)).length();
  return {...c,g,universe,travelDomain,contexts,controller,step,speed,dispose:()=>universe.dispose()};
}

test('T_SPACE_SHIFT_IS_COSMIC_BOOST',()=>{
  const f=fixture();try {
    for(const shift of ['ShiftLeft','ShiftRight']) {
      f.held.clear();f.held.add(shift);f.held.add('KeyW');f.step();
      assert.equal(f.g.cosmicBoostHeld,true);assert.equal(f.contexts.at(-1).inputBoost,true);
    }
    f.held.clear();f.step();assert.equal(f.g.cosmicBoostHeld,false);
  } finally {f.dispose();}
});
test('T_SPACE_SHIFT_ALONE_NO_THRUST',()=>{
  const f=fixture();try {
    f.g.selectNavigationTarget('moon','reticle');f.held.add('ShiftLeft');
    for(let i=0;i<60;i++)f.step();
    assert.ok(f.speed()<1e-8);assert.equal(f.contexts.at(-1).inputBoost,false);
    assert.equal(f.contexts.at(-1).thrust.lengthSq(),0);
  } finally {f.dispose();}
});
test('T_SPACE_W_SHIFT_COSMIC_CRUISE',()=>{
  const f=fixture();try {
    f.g.selectNavigationTarget('moon','reticle');f.held.add('KeyW');f.step();
    const ordinary=f.speed();assert.ok(Math.abs(ordinary-BASE_THRUST_ACCEL/60)<1e-7);
    f.held.add('ShiftLeft');f.step();
    assert.ok(f.speed()-ordinary>ordinary*2,'real target cruise accelerates faster than ordinary W');
    assert.equal(f.contexts.at(-1).inputBoost,true);
  } finally {f.dispose();}
});
test('T_SPACE_B_ONLY_CHANGES_WARP',()=>{
  const f=fixture();try {
    f.held.add('KeyB');f.edges.add('KeyB');f.step();assert.equal(f.g.warpStep,1);
    f.step();assert.equal(f.g.warpStep,1,'holding does not synthesize another edge');
    assert.equal(f.contexts.at(-1).inputBoost,false);assert.ok(f.speed()<1e-8);
    f.edges.add('KeyB');f.step();assert.equal(f.g.warpStep,2);
  } finally {f.dispose();}
});
test('T_SPACE_B_DOES_NOT_REPLACE_SHIFT',()=>{
  const f=fixture();try {
    f.g.selectNavigationTarget('moon','reticle');f.held.add('KeyB');f.held.add('KeyW');f.step();
    assert.equal(f.g.cosmicBoostHeld,false);assert.equal(f.contexts.at(-1).inputBoost,false);
    assert.ok(Math.abs(f.speed()-BASE_THRUST_ACCEL/60)<1e-7,'B held at warp zero is ordinary W');
    const ordinary=f.speed();f.edges.add('KeyB');f.step();
    assert.equal(f.contexts.at(-1).inputBoost,false);assert.equal(f.g.warpStep,1);
    assert.ok(f.speed()-ordinary>ordinary*10,'selected Warp still accelerates W');
  } finally {f.dispose();}
});
test('T_SPACE_B_HELD_DOES_NOT_SYNTHESIZE_FORWARD',()=>{
  const f=fixture();try {
    f.g.selectNavigationTarget('moon','reticle');f.held.add('KeyB');f.edges.add('KeyB');
    for(let i=0;i<120;i++)f.step();
    assert.ok(f.speed()<1e-8);assert.equal(f.contexts.at(-1).thrust.lengthSq(),0);
    assert.equal(f.contexts.at(-1).inputBoost,false);
  } finally {f.dispose();}
});
test('T_SPACE_X_CANCELS_WARP',()=>{
  const f=fixture();try {
    f.held.add('KeyW');f.edges.add('KeyB');f.step();const before=f.speed();
    f.held.clear();f.held.add('KeyX');f.step();
    assert.equal(f.g.warpStep,0);assert.ok(f.speed()<before);assert.equal(f.contexts.at(-1).inputBrake,true);
  } finally {f.dispose();}
});

/** Three non-occluded real body identities in the reticle, for deterministic input cycling. */
function cycleFixture() {
  const f=fixture(), system=f.universe.activeSystem;
  const observer=f.universe.playerSystemPositionM(), original=system.positionOf.bind(system);
  const ids=['moon','mars','venus'];
  const positions=new Map(ids.map((id,i)=>[id,[observer[0]+Math.sin(i*.04)*1e10,
    observer[1]-Math.cos(i*.04)*1e10,observer[2]] as Vec3]));
  system.positionOf=id=>positions.get(id)??original(id);
  f.g.celestialController.renderSamples=ids.map(bodyId=>({bodyId,proxyDistanceM:100}));
  return f;
}
test('T_SPACE_TAB_LOCK',()=>{
  const f=cycleFixture();try {
    f.edges.add('Tab');f.step();assert.equal(f.g.navigationLock.bodyId,'moon');
    assert.equal(f.controller.autopilot.active,false);
    f.edges.add('Tab');f.step();assert.equal(f.g.navigationLock.bodyId,'mars');
  } finally {f.dispose();}
});
test('T_SPACE_SHIFT_TAB_PREVIOUS_TARGET',()=>{
  const f=cycleFixture();try {
    f.g.selectNavigationTarget('mars','reticle');f.held.add('ShiftRight');f.edges.add('Tab');f.step();
    assert.equal(f.g.navigationLock.bodyId,'moon');assert.equal(f.contexts.at(-1).inputBoost,false);
  } finally {f.dispose();}
});
test('T_SPACE_B_TAB_IS_NOT_PREVIOUS_TARGET',()=>{
  const f=cycleFixture();try {
    f.g.selectNavigationTarget('mars','reticle');f.held.add('KeyB');f.edges.add('KeyB');f.edges.add('Tab');f.step();
    assert.equal(f.g.navigationLock.bodyId,'venus');assert.equal(f.g.warpStep,1);
  } finally {f.dispose();}
});

for(const [name,taps,tier] of [
  ['T_LOCAL_B_STILL_SUPER',0,'super'],['T_LOCAL_V_B_STILL_MEGA',1,'mega'],
  ['T_LOCAL_DOUBLE_V_B_STILL_INTERPLANETARY',2,'interplanetary'],
] as const) test(name,()=>{
  const c=controls(), player=new PlayerController(new Group(),c.input);
  try {
    player.teleport(new Vector3(0,FLIGHT.interplanetaryFloorM+1000,0));player.state='Falling';
    c.edges.add('KeyF');player.update(1/60,[],0);c.held.add('KeyW');c.held.add('KeyB');
    player.update(1/60,[],0);assert.equal(player.speedMode,'super');
    for(let i=0;i<taps;i++){c.edges.add('KeyV');player.update(1/60,[],0);}
    assert.equal(player.speedMode,'super','arming while B held waits for release');
    c.held.delete('KeyB');player.update(1/60,[],0);c.held.add('KeyB');player.update(1/60,[],0);
    assert.equal(player.speedMode,tier);assert.ok(player.velocity.length()>0);
  } finally {player.character.dispose();}
});
