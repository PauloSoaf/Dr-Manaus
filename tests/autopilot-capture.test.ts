import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { CosmicCruiseController, type CosmicCruiseContext } from '../src/world/travel/CosmicFlight.ts';
import { stoppingDistanceM } from '../src/world/travel/AutopilotCapture.ts';
import { SOLAR_SYSTEM_BODIES } from '../src/world/celestial/CelestialBody.ts';
import { bodyArrivalPolicy, bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { maximumSurfaceReliefM, surfaceForBody } from '../src/world/planet/BodySurfaceFactory.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import { TravelDomain, type InterplanetaryState } from '../src/world/travel/TravelDomain.ts';

function fixture(id='moon', gap=150000, fps=60) {
  const body=SOLAR_SYSTEM_BODIES.find(b=>b.id===id)!, policy=bodyArrivalPolicy(body), canLand=bodyProfile(body).canLand;
  const surface=surfaceForBody(body), radius=surface ? planetSurfaceRadius(surface,[0,1,0]) : body.equatorialRadiusM;
  const orbital:[number,number,number]=[1000,2000,-300];
  let centre:[number,number,number]=[0,0,0];
  let state:InterplanetaryState={systemId:'sol',positionM:[0,body.equatorialRadiusM+policy.arrivalMarginM+gap,0],velocityMps:[...orbital]};
  const controller=new CosmicCruiseController();controller.autopilot.engage();const phases=new Set<string>();
  let minimum=Infinity;
  const ctx=():CosmicCruiseContext=>({altitudeM:1e9,speedMps:0,requested:false,nearestColliderM:Infinity,
    bodyRadiusM:0,bodyId:'none',cameraForwardBary:new Vector3(0,-1,0),inputBoost:false,inputBrake:false,
    warpStep:9,target:{bodyId:id,positionM:centre,velocityMps:orbital,radiusM:body.equatorialRadiusM,arrivalMarginM:policy.arrivalMarginM},
    targetCanLand:canLand,targetSurfaceReady:true,targetSurfaceClearanceM:Math.hypot(...state.positionM.map((v,i)=>v-centre[i]))-radius,
    exclusionEnvelopes:[{bodyId:id,centreM:centre,velocityMps:orbital,
      radiusM:body.equatorialRadiusM+maximumSurfaceReliefM(body)+policy.exclusionMarginM,
      captureRadiusM:canLand?radius+policy.exclusionMarginM:undefined}]});
  function step(dt=1/fps, overrides:Partial<CosmicCruiseContext>={}) {
    state=controller.update(state,dt,new Vector3(),{...ctx(),...overrides});
    centre=centre.map((v,i)=>v+orbital[i]*dt) as [number,number,number];
    const distance=Math.hypot(...state.positionM.map((v,i)=>v-centre[i]));minimum=Math.min(minimum,distance);
    phases.add(controller.getTelemetry().phase);return distance-radius;
  }
  function run(seconds=800) {
    for(let i=0;i<seconds*fps;i++) {
      const clearance=step();
      if(canLand && clearance<=7000 && relativeSpeed()<=120 || !canLand && controller.autopilot.phase==='arrived') break;
    }
  }
  const relativeSpeed=()=>Math.hypot(...state.velocityMps.map((v,i)=>v-orbital[i]));
  return {body,policy,controller,phases,step,run,ctx,relativeSpeed,get state(){return state;},set state(v){state=v;},
    get centre(){return centre;},get minimum(){return minimum;},radius,orbital};
}
test('T_AUTOPILOT_ALIGN',()=>{
  const f=fixture();f.state={...f.state,velocityMps:[1e6+f.orbital[0],f.orbital[1],f.orbital[2]]};
  f.step();assert.equal(f.controller.getTelemetry().phase,'align');
  assert.ok(f.state.velocityMps[0]<1e6+f.orbital[0]);assert.equal(f.state.velocityMps[1],f.orbital[1]);
});
test('T_AUTOPILOT_ACCELERATES_WHEN_FAR',()=>{
  const f=fixture('moon',1e10);f.step();assert.equal(f.controller.getTelemetry().phase,'acceleration');
  assert.ok(f.relativeSpeed()>1e6);
});
test('T_AUTOPILOT_BRAKING_DISTANCE_INCREASES_WITH_SPEED',()=>{
  assert.equal(stoppingDistanceM(200,100),4*stoppingDistanceM(100,100));
});
test('T_AUTOPILOT_BRAKES_BEFORE_MOON',()=>{
  const f=fixture();f.run();assert.ok(f.phases.has('braking'));assert.ok(f.minimum>f.radius+1000);
  assert.ok(f.controller.getTelemetry().effectiveSpeedCapMps!<=120);
});
test('T_AUTOPILOT_MATCHES_TARGET_VELOCITY',()=>{
  const f=fixture('europa');f.run();assert.equal(f.controller.autopilot.phase,'arrived');
  for(let i=0;i<60;i++)f.step();assert.ok(f.relativeSpeed()<1e-6);
  assert.ok(Math.hypot(...f.state.velocityMps)>1000,'matching moving target is not barycentric zero');
});
test('T_AUTOPILOT_ARRIVES_WITHOUT_OVERSHOOT',()=>{
  const f=fixture('jupiter');f.run();assert.ok(f.minimum>=f.body.equatorialRadiusM+f.policy.arrivalMarginM);
  assert.equal(f.controller.autopilot.phase,'arrived');
});
test('T_AUTOPILOT_CCD_STILL_ACTIVE',()=>{
  const f=fixture('moon',1e5);f.state={...f.state,velocityMps:[1000,-1e12,0]};f.step(.25);
  assert.equal(f.controller.lastCelestialContact?.bodyId,'moon');
  assert.ok(f.minimum>=f.body.equatorialRadiusM+maximumSurfaceReliefM(f.body)+1000);
  assert.equal(f.controller.lastCelestialContact?.assisted,true);
});
test('T_AUTOPILOT_NONLANDABLE_STOPS_AT_STANDOFF',()=>{
  const f=fixture('titan');f.run();assert.equal(f.controller.autopilot.phase,'arrived');
  assert.ok(f.minimum>=f.body.equatorialRadiusM+f.policy.arrivalMarginM);
});
for(const [name,id] of [['MOON_SAFE_CAPTURE','moon'],['MARS_SAFE_CAPTURE','mars'],['JUPITER_STANDOFF','jupiter'],
  ['SUN_STANDOFF','sun'],['EUROPA_STANDOFF','europa'],['TITAN_STANDOFF','titan']] as const) {
  test(`T_AUTOPILOT_${name}`,()=>{
    const f=fixture(id);f.run();assert.ok(f.minimum>f.radius+1000);
    if(bodyProfile(f.body).canLand) {
      const clearance=Math.hypot(...f.state.positionM.map((v,i)=>v-f.centre[i]))-f.radius;
      assert.ok(clearance<=7000 && clearance>1000);assert.ok(f.relativeSpeed()<=120);
      const domain=new TravelDomain();domain.update({...f.ctx(),altitudeM:20000,requested:true},0);
      domain.setState(f.state);domain.update({...f.ctx(),altitudeM:clearance,speedMps:f.relativeSpeed(),radialSpeedMps:-f.relativeSpeed(),surfaceReady:true},0);
      assert.equal(domain.transition.kind,'returned');assert.ok(f.phases.has('approach'));
    } else {assert.equal(f.controller.autopilot.phase,'arrived');assert.ok(f.minimum>=f.body.equatorialRadiusM+f.policy.arrivalMarginM);}
  });
}
test('T_AUTOPILOT_CANCEL_PRESERVES_MOMENTUM',()=>{
  const f=fixture();f.step();const before=[...f.state.velocityMps];f.controller.autopilot.cancel();f.step();
  assert.deepEqual(f.state.velocityMps,before);assert.equal(f.controller.getTelemetry().autopilotActive,false);
});
test('T_AUTOPILOT_TARGET_LOST_SAFE',()=>{
  const f=fixture();f.step();const before=[...f.state.velocityMps];
  f.state=f.controller.update(f.state,1/60,new Vector3(),{...f.ctx(),target:undefined});
  assert.equal(f.controller.autopilot.active,false);assert.deepEqual(f.state.velocityMps,before);
});
test('T_AUTOPILOT_NO_NAN',()=>{
  const f=fixture();f.state={...f.state,positionM:[NaN,Infinity,-Infinity],velocityMps:[NaN,Infinity,0]};f.step();
  assert.ok([...f.state.positionM,...f.state.velocityMps].every(Number.isFinite));
  assert.equal(stoppingDistanceM(NaN,0),0);
  f.controller.autopilot.engage();
  f.state=f.controller.update(f.state,1/60,new Vector3(),{...f.ctx(),
    target:{...f.ctx().target!,velocityMps:[NaN,Infinity,0]}});
  assert.equal(f.controller.autopilot.active,false);
  assert.ok([...f.state.positionM,...f.state.velocityMps].every(Number.isFinite));
});
for(const fps of [30,60,120]) test(`T_AUTOPILOT_${fps}FPS`,()=>{
  const f=fixture('moon',2e7,fps);f.run();assert.ok(f.minimum>f.radius+1000);assert.ok(f.relativeSpeed()<=120);
  assert.ok(f.phases.has('braking')&&f.phases.has('approach'));
});
test('Landable capture waits above return gate until terrain coverage is ready',()=>{
  const f=fixture();for(let i=0;i<30000;i++) {
    const clearance=f.step(1/60,{targetSurfaceReady:false});
    if(f.controller.autopilot.phase==='approach' && f.relativeSpeed()<1) {
      assert.ok(clearance>=7998 && clearance<=8010);break;
    }
  }
  assert.ok(f.phases.has('approach'));assert.ok(f.minimum>=f.radius+7000);
  f.run();assert.ok(f.relativeSpeed()<=120);
});
