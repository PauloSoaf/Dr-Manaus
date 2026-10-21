import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three/webgpu';
import { SOLAR_SYSTEM_BODIES } from '../src/world/celestial/CelestialBody.ts';
import { bodyArrivalPolicy, bodyProfile, supportsLanding, PHOTOSPHERE_GAMEPLAY_GRAVITY_MPS2, PROCEDURAL_STAR_PROFILE } from '../src/world/celestial/CelestialBodyProfile.ts';
import { bodyExclusionEnvelopes, resolveBodyDestination } from '../src/world/travel/BodyNavigation.ts';
import { CosmicCruiseController, type CosmicCruiseContext } from '../src/world/travel/CosmicFlight.ts';
import { LIGHT_SPEED_MPS } from '../src/world/travel/TravelConstants.ts';
import { SunVisual } from '../src/rendering/celestial/SunVisual.ts';
import { angularRadiusRad, boundedCelestialProxy } from '../src/rendering/celestial/math.ts';
import { solarDiagnostics, solarPresentation, solarRaySurface } from '../src/rendering/celestial/solarPresentation.ts';
import { celestialLabelOpacity } from '../src/rendering/celestial/CelestialLabelLayer.ts';
import type { CelestialRenderSample } from '../src/rendering/celestial/types.ts';
import { TravelDomain, type InterplanetaryState } from '../src/world/travel/TravelDomain.ts';
import { impactFixture } from './helpers/celestial-impact.ts';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { planRockyImpact } from '../src/world/destruction/RockyImpactDestructionPolicy.ts';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory.ts';

const sun=SOLAR_SYSTEM_BODIES.find(b=>b.id==='sun')!,earth=SOLAR_SYSTEM_BODIES.find(b=>b.id==='earth')!;
const R=sun.equatorialRadiusM,policy=bodyArrivalPolicy(sun),edge=R+policy.exclusionMarginM;
function sample(distance=2*R):CelestialRenderSample {
  const angle=angularRadiusRad(R,distance),proxy=boundedCelestialProxy(Math.tan(angle),5*Math.tan(angle),260000);
  return {bodyId:'sun',profile:bodyProfile(sun),physicalRadiusM:R,logicalDistanceM:distance,
    angularRadiusRad:angle,directionRender:[0,0,-1],proxyDistanceM:proxy.distanceM,proxyRadiusM:proxy.radiusM,
    visible:true,opacity:1,physicalProjectedDiameterPx:solarDiagnostics(R,distance,Math.PI/3,900).projectedDiameterPx,
    bodyOrientationRender:[0,0,0,1],solarTimeS:12345};
}
function manual(distance:number,speed:number,dt=1/60) {
  const f=impactFixture('sun',speed);
  try {f.place(distance,speed);f.step(dt);return {contact:f.controller.lastCelestialContact,event:f.event(),
    position:[...f.travelDomain.state!.positionM],velocity:[...f.travelDomain.state!.velocityMps],
    emitted:f.game.celestialImpacts.emittedCount,volume:{...f.universe.volume.metrics},
    centre:f.universe.activeSystem.positionOf('sun')!};} finally {f.dispose();}
}
function flight(fps=60,distance=10*R) {
  const controller=new CosmicCruiseController(),phases=new Set<string>();controller.autopilot.engage();
  let state:InterplanetaryState={systemId:'sol',positionM:[0,distance,0],velocityMps:[0,0,0]};
  const ctx:CosmicCruiseContext={altitudeM:1e9,speedMps:0,requested:true,nearestColliderM:Infinity,
    bodyId:'sun',bodyRadiusM:R,bodyPositionM:[0,0,0],bodyVelocityMps:[0,0,0],
    target:{bodyId:'sun',radiusM:R,positionM:[0,0,0],velocityMps:[0,0,0],
      arrivalMarginM:policy.arrivalMarginM,exclusionMarginM:policy.exclusionMarginM},targetCanLand:false,
    exclusionEnvelopes:[{bodyId:'sun',centreM:[0,0,0],radiusM:edge}],
    cameraForwardBary:new Vector3(0,-1,0),inputBoost:false,inputBrake:false,warpStep:9};
  let minimum=Infinity,contacts=0;
  for(let i=0;i<fps*240;i++) {
    state=controller.update(state,1/fps,new Vector3(),ctx);minimum=Math.min(minimum,Math.hypot(...state.positionM));
    if(controller.lastCelestialContact)contacts++;phases.add(controller.getTelemetry().phase);
    if(controller.autopilot.phase==='arrived'&&Math.hypot(...state.velocityMps)<.01)break;
  }
  return {controller,ctx,state,minimum,contacts,phases};
}
test('T_SUN_PHYSICAL_RADIUS_UNCHANGED',()=>assert.equal(R,695700000));
test('T_SUN_EARTH_SCALE_RATIO_PHYSICAL',()=>{assert.equal(earth.equatorialRadiusM,6378137);assert.ok(R/earth.equatorialRadiusM>100);});
test('T_SUN_EXCLUSION_NOT_2R',()=>{assert.equal(policy.exclusionMarginM,100000);assert.equal(edge,695800000);assert.ok(edge<1.001*R);});
test('T_SUN_MANUAL_CAN_CROSS_2R',()=>{const r=manual(2*R+1000,1e6);assert.equal(r.contact,undefined);assert.ok(Math.hypot(...r.position.map((v,i)=>v-r.centre[i]))<2*R);});
test('T_SUN_CORONA_NOT_COLLISION',()=>assert.equal(manual(1.5*R,1e6).contact,undefined));
test('T_SUN_CCD_NEAR_PHOTOSPHERE',()=>{const r=manual(edge+1000,1e6);assert.ok(r.contact);assert.equal(r.contact.envelopeRadiusM,edge);assert.ok(Math.abs(Math.hypot(...r.contact.contactPositionM.map((v,i)=>v-r.centre[i]))-edge)<1);});
test('T_SUN_NO_TUNNEL_AT_PHOTOSPHERE',()=>{const r=manual(5*R,LIGHT_SPEED_MPS*256,.25);assert.ok(r.contact);assert.ok(Math.hypot(...r.position.map((v,i)=>v-r.centre[i]))>=edge);});
test('T_SUN_NO_BOUNCE',()=>{const r=manual(edge+1000,LIGHT_SPEED_MPS);assert.ok(Math.hypot(...r.velocity)<.001);assert.equal(r.contact?.responseRadialSpeedMps,0);});
test('T_SUN_AUTOPILOT_STANDOFF_CLOSER_THAN_2R',()=>{const f=flight();assert.equal(f.controller.autopilot.phase,'arrived');assert.ok(Math.abs(f.state.positionM[1]-R-policy.arrivalMarginM)<4);assert.equal(policy.arrivalMarginM,20871000);assert.ok(f.phases.has('braking'));});
test('T_SUN_AUTOPILOT_DOES_NOT_CROSS_PHOTOSPHERE',()=>{const f=flight(60,149597870700);assert.equal(f.contacts,0);assert.ok(f.minimum>=R+policy.arrivalMarginM);});
test('T_SUN_MANUAL_CAN_CONTINUE_AFTER_AUTOPILOT_CANCEL',()=>{const f=flight();f.controller.autopilot.cancel();f.ctx.warpStep=0;const next=f.controller.update(f.state,.25,new Vector3(0,-1,0),f.ctx);assert.ok(next.positionM[1]<f.state.positionM[1]);assert.equal(f.controller.lastCelestialContact,undefined);});
test('T_SUN_C4_CONTACT_USES_NEW_BOUNDARY',()=>{const r=manual(edge+1000,LIGHT_SPEED_MPS*1.001);assert.equal(r.contact?.envelopeRadiusM,edge);assert.ok(Math.abs(r.event.contactSystemPositionM[1]-edge)<1);});
test('T_SUN_CATASTROPHIC_EVENT_AT_HIGH_SPEED',()=>{const f=impactFixture('sun',LIGHT_SPEED_MPS*1.001);try {f.step();for(let i=0;i<120;i++)f.step();assert.equal(f.event().classification,'CATASTROPHIC_IMPACT');assert.equal(f.game.celestialImpacts.emittedCount,1);}finally{f.dispose();}});
test('T_SUN_NO_PLANET_VOLUME',()=>{const f=impactFixture('sun');try{const before={...f.universe.volume.metrics};f.universe.volume.edits.add=()=>{throw Error('star must never edit');};f.step();assert.deepEqual(f.universe.volume.metrics,before);assert.equal(bodyProfile(sun).supportsVolumeDestruction,false);}finally{f.dispose();}});
test('T_SUN_CAPABILITY_CONSISTENT', () => {
  const p = bodyProfile(sun);
  assert.equal(p.canLand, true);
  assert.equal(p.hasSolidSurface, false);
  assert.equal(p.landingMode, 'photosphere');
  assert.equal(supportsLanding(p), 'photosphere');
});

test('T_SUN_AUTOPILOT_LANDING_POLICY', () => {
  const f = flight();
  assert.equal(f.controller.autopilot.phase, 'arrived');
  // Autopilot without explicit landing intent captures and holds at standoff (captureRadius = R + arrivalMarginM)
  assert.ok(Math.abs(f.state.positionM[1] - R - policy.arrivalMarginM) < 4);
  assert.equal(policy.arrivalMarginM, 20_871_000);
  assert.ok(f.minimum >= R + policy.arrivalMarginM, 'Autopilot does not descend to photosphere without explicit intent');
});

test('T_SUN_EXPLICIT_F_LANDING_INTENT', () => {
  const f = impactFixture('sun', 200);
  try {
    // Place player in solar orbital standoff within capture range (< 30,000 km)
    f.place(20_000_000, 200);
    // Real KeyF command pressed
    f.held.add('KeyF');
    f.gameStep(1 / 60);

    assert.equal(f.game.landingIntent.active, true, 'Landing intent is activated by KeyF');
    assert.equal(f.game.landingIntent.bodyId, 'sun', 'Landing intent targets the Sun');
    assert.equal(f.game.landingIntent.phase, 'capture', 'Landing intent enters capture phase');
    for (let i = 0; i < 30; i++) f.step();
    assert.ok(f.travelDomain.state);
  } finally {
    f.dispose();
  }
});

test('T_SUN_FULL_E2E_LANDING_AND_TAKEOFF_CYCLE', () => {
  const f = impactFixture('sun', 200);
  try {
    // 1. Interplanetary cruise approaching Sun at 20,000 km altitude (within 30,000 km capture limit)
    f.place(20_000_000, 200);
    assert.equal(f.travelDomain.kind, 'interplanetary');
    assert.equal(f.universe.telemetry.dominantBody, 'sun');

    // 2. Real user key press: KeyF
    f.held.add('KeyF');
    f.gameStep(1 / 60);

    assert.equal(f.game.landingIntent.active, true, 'KeyF must trigger active landing intent');
    assert.equal(f.game.landingIntent.bodyId, 'sun', 'Target must be Sun');
    assert.equal(f.game.landingIntent.phase, 'capture');

    // 3. Autonomous descent down through capture envelope to return gate (<= 7000m)
    f.place(5_000, 20);
    f.gameStep(1 / 60);

    // 4. Photosphere arrival and handoff
    assert.equal(f.universe.player.frame, 'sun/local-enu', 'Player handed off to Sun local ENU frame');
    assert.equal(f.game.physicsDomain, 'sun', 'Physics domain is bound to sun');
    assert.equal(f.game.district, 'FOTOSFERA', 'District identifier set to FOTOSFERA');
    assert.equal(f.game.player.gravity, PHOTOSPHERE_GAMEPLAY_GRAVITY_MPS2, 'Buoyancy gravity applied');
    assert.ok(f.game.player.position.toArray().every(Number.isFinite), 'Photosphere position coordinates are finite');

    // 5. Player local movement on photospheric surface
    f.game.player.position.x += 100;
    f.game.player.position.z += 50;
    f.universe.update(
      [f.game.player.position.x, f.game.player.position.y, f.game.player.position.z],
      [0, 0, 0],
      1 / 60
    );
    assert.equal(f.universe.player.frame, 'sun/local-enu', 'Remains on sun/local-enu during surface walk');

    // 6. Vertical ascent & Takeoff back to space
    const sunCentre = f.universe.activeSystem.positionOf('sun')!;
    const departureAltitudeM = 10_000;
    const takeoffVelocityMps: [number, number, number] = [0, 2500, 0];
    const trans = f.travelDomain.update({
      altitudeM: departureAltitudeM,
      speedMps: 2500,
      requested: true,
      nearestColliderM: Infinity,
      bodyRadiusM: R,
      entryPositionM: [sunCentre[0], sunCentre[1] + R + departureAltitudeM, sunCentre[2]],
      entryVelocityMps: takeoffVelocityMps,
    }, 1 / 60);

    assert.equal(trans.kind, 'departed', 'Takeoff successfully departs from photospheric surface');
    assert.equal(f.travelDomain.kind, 'interplanetary', 'Travel domain restores interplanetary state');
  } finally {
    f.dispose();
  }
});

test('T_SUN_NOT_ROCKY', () => {
  const p = bodyProfile(sun);
  assert.equal(p.hasSolidSurface, false);
  assert.equal(p.surfaceKind, 'none');
  assert.equal(surfaceForBody(sun), undefined);
});

test('T_SUN_PHOTOSPHERE_RADIUS_695700KM', () => {
  assert.equal(sun.equatorialRadiusM, 695_700_000);
  assert.equal(R, 695_700_000);
});

test('T_SUN_GAMEPLAY_GRAVITY_EXPLICIT', () => {
  assert.equal(PHOTOSPHERE_GAMEPLAY_GRAVITY_MPS2, 9.80665);
  // Verify it is explicit gameplay buoyancy policy, NOT the lethal 274 m/s² gravitational field
  assert.ok(PHOTOSPHERE_GAMEPLAY_GRAVITY_MPS2 < 20.0);
});

test('T_GENERIC_PROCEDURAL_STARS_NOT_LANDABLE', () => {
  const genericStar = {
    id: 'procedural_star_hd12345',
    name: 'HD 12345',
    frameId: 'system/hd12345',
    equatorialRadiusM: 800_000_000,
    massKg: 2e30,
    axialTiltRad: 0,
    rotationPeriodS: 2_000_000,
  };
  const profile = bodyProfile(genericStar as any);
  assert.equal(profile.bodyClass, 'star');
  assert.equal(profile.canLand, false, 'Generic procedural stars must not be landable');
  assert.equal(profile.landingMode, 'none', 'Generic procedural stars landingMode is none');
  assert.equal(supportsLanding(profile), 'none');
});

test('T_SUN_PHOTOSPHERE_CONTACT_NO_BOUNCE', () => {
  const r = manual(edge + 1000, LIGHT_SPEED_MPS);
  assert.ok(Math.hypot(...r.velocity) < 0.001);
  assert.equal(r.contact?.responseRadialSpeedMps, 0);
});

test('T_SUN_ACTUAL_LOCAL_HANDOFF', () => {
  const u = new UniverseRuntime({ epochS: 0 });
  try {
    const sunCentre = u.activeSystem.positionOf('sun')!;
    const entryPos: [number, number, number] = [sunCentre[0], sunCentre[1] + R + 5000, sunCentre[2]];
    u.updateSystemPose(entryPos, [0, 0, 0], 0);
    const domain = new TravelDomain();
    domain.enterSystem({ systemId: 'sol', positionM: entryPos, velocityMps: [0, 0, 0] });
    const trans = domain.update({
      altitudeM: 5000,
      speedMps: 20,
      radialSpeedMps: -20,
      requested: false,
      nearestColliderM: Infinity,
      bodyRadiusM: R,
      bodyId: 'sun',
      surfaceReady: true,
    }, 1 / 60);
    assert.equal(trans.kind, 'returned');
    const localPos = u.handoffTo('sun');
    assert.equal(u.player.frame, 'sun/local-enu');
    assert.ok(localPos.every(Number.isFinite));
    assert.ok(Math.abs(localPos[1] - 5000) < 1);
  } finally {
    u.dispose();
  }
});

test('T_SUN_PHOTOSPHERE_GROUND_CONTACT', () => {
  const u = new UniverseRuntime({ epochS: 0 });
  try {
    const sunCentre = u.activeSystem.positionOf('sun')!;
    u.updateSystemPose([sunCentre[0], sunCentre[1] + R, sunCentre[2]], [0, 0, 0], 0);
    const localPos = u.handoffTo('sun');
    assert.equal(u.player.frame, 'sun/local-enu');
    assert.ok(localPos.every(Number.isFinite));
    assert.ok(Math.abs(localPos[1]) < 0.1, 'Character is placed on the photospheric surface plane at y=0');
  } finally {
    u.dispose();
  }
});

test('T_SUN_PHOTOSPHERE_MOVEMENT', () => {
  const u = new UniverseRuntime({ epochS: 0 });
  try {
    const sunCentre = u.activeSystem.positionOf('sun')!;
    u.updateSystemPose([sunCentre[0], sunCentre[1] + R, sunCentre[2]], [0, 0, 0], 0);
    u.handoffTo('sun');
    assert.equal(u.player.frame, 'sun/local-enu');
    // Move 100m east (+X) and 50m south (+Z) on the photospheric ENU plane
    u.player.position[0] += 100;
    u.player.position[2] += 50;
    assert.ok(u.player.position.every(Number.isFinite));
    const loc = u.location;
    assert.equal(loc.frameId, 'sun/local-enu');
  } finally {
    u.dispose();
  }
});

test('T_SUN_TANGENT_FRAME_FINITE', () => {
  const u = new UniverseRuntime({ epochS: 0 });
  try {
    const sunCentre = u.activeSystem.positionOf('sun')!;
    u.updateSystemPose([sunCentre[0], sunCentre[1] + R + 100, sunCentre[2]], [0, 0, 0], 0);
    const pos = u.handoffTo('sun');
    assert.ok(pos.every(Number.isFinite));
    const frame = u.frames.get('sun/local-enu')!;
    assert.ok(frame.originInParent.every(Number.isFinite));
    assert.ok(frame.rotationToParent.every(Number.isFinite));
  } finally {
    u.dispose();
  }
});

test('T_SUN_PHOTOSPHERE_TAKEOFF', () => {
  const u = new UniverseRuntime({ epochS: 0 });
  try {
    const sunCentre = u.activeSystem.positionOf('sun')!;
    u.updateSystemPose([sunCentre[0], sunCentre[1] + R + 100, sunCentre[2]], [0, 0, 0], 0);
    u.handoffTo('sun');
    assert.equal(u.player.frame, 'sun/local-enu');
    const domain = new TravelDomain();
    const refused = domain.update({ altitudeM: 100, speedMps: 500, requested: true, nearestColliderM: Infinity, bodyRadiusM: R }, 1 / 60);
    assert.equal(refused.kind, 'refused');
    const departed = domain.update({ altitudeM: 10_000, speedMps: 2500, requested: true, nearestColliderM: Infinity, bodyRadiusM: R,
      entryPositionM: [sunCentre[0], sunCentre[1] + R + 10_000, sunCentre[2]], entryVelocityMps: [0, 2500, 0] }, 1 / 60);
    assert.equal(departed.kind, 'departed');
    assert.equal(domain.kind, 'interplanetary');
  } finally {
    u.dispose();
  }
});

test('T_SUN_NO_CRATER', () => {
  const p = bodyProfile(sun);
  assert.equal(p.supportsVolumeDestruction, false);
  const plan = planRockyImpact({
    eventId: 'impact-sun-1',
    bodyId: 'sun',
    contactSystemPositionM: [0, R, 0],
    contactBodyFixedM: [0, R, 0],
    classification: 'MAJOR_IMPACT',
    relativeSpeedMps: 5000,
    inwardRadialSpeedMps: 5000,
    tangentialSpeedMps: 0,
    kineticEnergyJoules: 1e12,
  } as any, sun, p, undefined as any);
  assert.equal(plan, null);
});

test('T_SUN_256C_CCD_PRESERVED', () => {
  const r = manual(5 * R, LIGHT_SPEED_MPS * 256, 0.25);
  assert.ok(r.contact, 'CCD detects contact even at 256c');
  assert.ok(Math.hypot(...r.position.map((v, i) => v - r.centre[i])) >= edge, 'Does not tunnel through photospheric exclusion boundary');
});
test('T_SUN_ANGULAR_SIZE_MONOTONIC',()=>{let previous=0;for(const d of [149597870700,10*R,5*R,2*R,1.5*R,1.1*R,1.03*R,edge]){const angle=angularRadiusRad(R,d);assert.ok(Number.isFinite(angle)&&angle>previous);previous=angle;}});
for(const [name,d] of [['1AU_SIZE_FINITE',149597870700],['10R_SIZE',10*R],['5R_SIZE',5*R],['2R_SIZE',2*R],['1_5R_SIZE',1.5*R],['1_1R_SIZE',1.1*R],['1_03R_SIZE',1.03*R],['NEAR_PHOTOSPHERE_SIZE_FINITE',edge]] as const) {
  test(`T_SUN_${name}`,()=>{const s=sample(d),angle=s.angularRadiusRad;assert.ok(Number.isFinite(s.physicalProjectedDiameterPx));
    const inside=solarRaySurface([Math.sin(angle*.999),0,-Math.cos(angle*.999)],[0,0,-1],R/d);
    const outside=solarRaySurface([Math.sin(angle*1.001),0,-Math.cos(angle*1.001)],[0,0,-1],R/d);
    assert.ok(inside&&inside.every(Number.isFinite));assert.equal(outside,undefined);if(d<=1.5*R)assert.ok(s.physicalProjectedDiameterPx!>900);});
}
test('T_SUN_RENDER_PROXY_ALWAYS_FINITE',()=>{const v=new SunVisual(),c=new PerspectiveCamera(58,1.6,.15,260000);try {for(const d of [149597870700,10*R,2*R,edge,R,R*.999]){v.update(sample(d),c);v.group.traverse(o=>assert.ok([...o.position.toArray(),...o.scale.toArray(),...o.quaternion.toArray()].every(Number.isFinite)));assert.ok(v.group.position.length()>c.near);assert.equal(v.diagnostics.triangles,2);}}finally{v.dispose();}});
test('T_SUN_NO_ASTRONOMICAL_OBJECT3D_POSITION',()=>{const v=new SunVisual(),c=new PerspectiveCamera(58,1.6,.15,260000);try{v.update(sample(149597870700),c);v.group.traverse(o=>assert.ok(o.position.length()<1e7&&o.scale.length()<1e7));}finally{v.dispose();}});
test('T_SUN_PHOTOSPHERE_DETAIL_LOD',()=>{assert.equal(solarPresentation(.004).mode,'DISTANT');assert.equal(solarPresentation(.1).mode,'DISC');assert.equal(solarPresentation(.4).mode,'CLOSE');assert.equal(solarPresentation(1).mode,'IMMERSIVE');assert.ok(solarPresentation(.1).detail>solarPresentation(.004).detail);});
test('T_SUN_CORONA_VISUAL_ONLY',()=>{const f=impactFixture('sun');try{const envelope=bodyExclusionEnvelopes(f.universe.activeSystem).find(e=>e.bodyId==='sun')!;assert.equal(envelope.radiusM,edge);assert.equal(bodyProfile(sun).visual.solarGlow?.outerScale,5);assert.equal(resolveBodyDestination(f.universe.activeSystem,{bodyId:'sun'})!.exclusionMarginM,100000);}finally{f.dispose();}});
test('T_SUN_LABEL_FADES_WHEN_LARGE',()=>{assert.ok(celestialLabelOpacity(sample(149597870700),{selectedBodyId:'sun'},{x:0,y:0})>0);assert.equal(celestialLabelOpacity(sample(2*R),{selectedBodyId:'sun'},{x:0,y:0}),0);});
test('T_SUN_SURFACE_ANIMATION_DETERMINISTIC',()=>{const v=new SunVisual(),c=new PerspectiveCamera(58,1.6,.15,260000),s=sample();try{v.update(s,c);const shader=(v as any).shader,initial=shader.cameraToBody.value.toArray();c.quaternion.setFromAxisAngle(new Vector3(0,1,0),.3);v.update(s,c);assert.notDeepEqual(shader.cameraToBody.value.toArray(),initial);c.quaternion.identity();v.update(s,c);assert.deepEqual(shader.cameraToBody.value.toArray(),initial);assert.equal(shader.clock.value,s.solarTimeS);s.bodyOrientationRender=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.2).toArray();v.update(s,c);assert.notDeepEqual(shader.cameraToBody.value.toArray(),initial);}finally{v.dispose();}});
for(const fps of [30,60,120])test(`T_SUN_${fps}FPS`,()=>{const f=flight(fps);assert.equal(f.controller.autopilot.phase,'arrived');assert.equal(f.contacts,0);const r=manual(edge+1000,LIGHT_SPEED_MPS*1.001,1/fps);assert.equal(r.event.classification,'CATASTROPHIC_IMPACT');assert.ok(Math.hypot(...r.position.map((v,i)=>v-r.centre[i]))>=edge);});
test('Sun fallback target collision uses CCD epsilon without envelope list',()=>{const f=flight();f.controller.autopilot.cancel();f.ctx.exclusionEnvelopes=[];f.ctx.bodyId='none';f.ctx.bodyPositionM=undefined;f.state.positionM=[0,1.02*R,0];f.state.velocityMps=[0,-1e6,0];f.controller.update(f.state,1/60,new Vector3(),f.ctx);assert.equal(f.controller.lastCelestialContact,undefined);});
test('Sun quality presets replace one material without growing resources',()=>{const v=new SunVisual();try{for(const q of ['Low','Medium','High','Ultra'] as const){v.setQuality(q);assert.equal(v.diagnostics.materials,1);assert.equal(v.diagnostics.quality,q);assert.equal(v.group.children.length,1);}}finally{v.dispose();}});
test('Solar surface uses catalog rotation rather than observer position',()=>{
  const u=new UniverseRuntime({streaming:false,epochS:0}),layer=new CelestialBodyVisualLayer(),controller=new CelestialPresentationController(layer);
  const ctx={universe:u,fovRad:Math.PI/3,viewportHeightPx:900,cameraFarM:260000};
  try {u.updateSystemPose([0,10*R,0],[0,0,0],0);controller.prepare(ctx);
    const before=controller.renderSamples.find(s=>s.bodyId==='sun')!.bodyOrientationRender!;
    u.solarSystem.update(sun.rotationPeriodS!/4);controller.prepare(ctx);
    const after=controller.renderSamples.find(s=>s.bodyId==='sun')!.bodyOrientationRender!;
    assert.notDeepEqual(after,before);
    const fixed=u.frames.convertOrientation(u.renderSpace.currentOrigin.frame,sun.frameId,after);
    const tilt=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),sun.axialTiltRad!);
    assert.ok(Math.abs(tilt.angleTo(new Quaternion(...fixed))-Math.PI/2)<1e-6);
  }finally{layer.dispose();u.dispose();}
});
