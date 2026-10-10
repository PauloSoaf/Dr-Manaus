import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { TravelDomain } from '../src/world/travel/TravelDomain.ts';
import { sweepTerrain, removeInwardTerrainVelocity } from '../src/physics/TerrainSweep.ts';
import { CosmicCruiseController, sweepSegmentSphere, warpSpeedMps, type CosmicCruiseContext } from '../src/world/travel/CosmicFlight.ts';
import { SolarSystem } from '../src/world/celestial/SolarSystem.ts';
import { bodyExclusionEnvelopes } from '../src/world/travel/BodyNavigation.ts';
import { bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { LANDING_SPEED_LIMITS, relativeSurfaceMotion } from '../src/world/travel/LandingCapture.ts';
import { MOON, MARS, bodyGeodeticToFixed, type PlanetBody } from '../src/world/planet/PlanetBody.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { MarsSurfaceGenerator } from '../src/world/planet/MarsSurface.ts';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface.ts';
import { PlanetTerrainProvider } from '../src/world/planet/PlanetTerrainProvider.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { geodetic } from '../src/world/spatial/Geodetic.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import type { InputController } from '../src/player/InputController.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

function terrainFor(body: PlanetBody, surface: PlanetSurfaceGenerator) {
  const frames = new ReferenceFrameGraph(), lat = .4, lon = -1.1;
  const point = bodyGeodeticToFixed(body, geodetic(lat, lon));
  const east = new Vector3(-Math.sin(lon), Math.cos(lon), 0);
  const up = new Vector3(Math.cos(lat)*Math.cos(lon), Math.cos(lat)*Math.sin(lon), Math.sin(lat));
  const south = east.clone().cross(up);
  frames.register(referenceFrame({ id: `${body.id}/fixed`, kind: 'body-fixed' }));
  frames.register(referenceFrame({ id: `${body.id}/local-enu`, kind: 'surface-enu', parentId: `${body.id}/fixed`,
    originInParent: [point.xM,point.yM,point.zM],
    rotationToParent: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(east,up,south)).toArray() }));
  return new PlanetTerrainProvider(frames,body,surface);
}

const cosmicContext = (envelopes: ReturnType<typeof bodyExclusionEnvelopes>): CosmicCruiseContext => ({
  altitudeM: 1e12, speedMps: 0, requested: false, nearestColliderM: Infinity, bodyRadiusM: 0,
  bodyId: 'none', cameraForwardBary: new Vector3(), inputBoost: false, inputBrake: false,
  maxRelativeSpeedMps: warpSpeedMps(9), exclusionEnvelopes: envelopes,
});

test('T_PLANET_TERRAIN_SWEEP_DIAGONAL_RELIEF: both endpoints above a ridge', () => {
  PhysicsWorld.setTerrain({ heightAt: x => Math.max(0, 3 - Math.abs(x - 5)) });
  try {
    const position = new Vector3(0, 1, 0), velocity = new Vector3(2400, 0, 240);
    assert.equal(new PhysicsWorld().move(position, velocity, 1 / 30, .32, 2.1, []), true);
    assert.ok(position.x < 6, 'first contact must stop a step whose final endpoint is above ground');
  } finally { PhysicsWorld.setTerrain(null); }
});

test('T_LOCAL_HANDOFF_REJECTS_UNSAFE_INWARD_SPEED', () => {
  const domain = new TravelDomain();
  const context = { altitudeM: 10_000, speedMps: 0, requested: true,
    nearestColliderM: Infinity, bodyRadiusM: 1_738_100, bodyId: 'moon', surfaceReady: true };
  domain.update(context, 0);
  domain.update({ ...context, altitudeM: 400, speedMps: 10_000, requested: false }, 1 / 30);
  assert.equal(domain.kind, 'interplanetary', '10 km/s descent must keep cosmic CCD active');
});

test('T_CELESTIAL_ENVELOPES_INCLUDE_ALL_CURRENT_SOLAR_BODIES', () => {
  const system = new SolarSystem(), envelopes = bodyExclusionEnvelopes(system);
  assert.equal(envelopes.length,19);
  for (const envelope of envelopes) {
    assert.ok(Number.isFinite(envelope.radiusM) && envelope.radiusM > 0);
    assert.ok(envelope.centreM.every(Number.isFinite));
    assert.deepEqual(envelope.centreM,system.positionOf(envelope.bodyId));
  }
  system.update(86400);
  assert.notDeepEqual(bodyExclusionEnvelopes(system).find(e=>e.bodyId==='moon')!.centreM,
    envelopes.find(e=>e.bodyId==='moon')!.centreM);
});

for (const body of new SolarSystem().bodies) {
  test(`T_CELESTIAL_SWEEP_${body.id.toUpperCase()}_FAST`, () => {
    const system = new SolarSystem(), envelopes = bodyExclusionEnvelopes(system);
    const envelope = envelopes.find(e=>e.bodyId===body.id)!, dt = .25;
    const speed = envelope.radiusM * 6 / dt, orbital = envelope.velocityMps!;
    const from: Vec3 = [envelope.centreM[0],envelope.centreM[1]-envelope.radiusM*3,envelope.centreM[2]];
    const controller = new CosmicCruiseController();
    const result = controller.update({systemId:'sol',positionM:from,
      velocityMps:[orbital[0],orbital[1]+speed,orbital[2]]},dt,new Vector3(),cosmicContext(envelopes));
    const contact = controller.lastCelestialContact;
    assert.ok(contact); assert.equal(contact.bodyId,body.id);
    assert.ok(contact.fraction>0 && contact.fraction<1);
    const endCentre = envelope.centreM.map((v,i)=>v+orbital[i]*dt);
    assert.ok(result.positionM[1] < endCentre[1]-envelope.radiusM+.01);
    assert.ok(Math.hypot(...result.positionM.map((v,i)=>v-endCentre[i])) >= envelope.radiusM);
    assert.ok(Math.hypot(...result.velocityMps.map((v,i)=>v-orbital[i])) < .01,
      'response matches the contacted body, independently of the dominant body');
    assert.ok(Math.abs(contact.relativeSpeedMps-speed)<.01);
    // At 120 FPS even 256c cannot traverse the Sun's full diameter. A grazing chord
    // still gives two outside endpoints with a real intervening entry at supported speed.
    for (const fps of [120,60,30]) {
      const dt=1/fps, speed=warpSpeedMps(9)*.99, x=envelope.radiusM*.99;
      const y=-Math.sqrt(envelope.radiusM**2-x**2)-1000;
      const from: Vec3=[envelope.centreM[0]+x,envelope.centreM[1]+y,envelope.centreM[2]];
      const endOffsetY=y+speed*dt;
      assert.ok(Math.hypot(x,endOffsetY)>envelope.radiusM,'endpoint alone would miss the body');
      const sweep=new CosmicCruiseController();
      const result=sweep.update({systemId:'sol',positionM:from,
        velocityMps:[orbital[0],orbital[1]+speed,orbital[2]]},dt,new Vector3(),cosmicContext(envelopes));
      const endCentre=envelope.centreM.map((v,i)=>v+orbital[i]*dt);
      assert.equal(sweep.lastCelestialContact?.bodyId,body.id,`${fps} FPS contact identity`);
      assert.ok(result.positionM[1]<endCentre[1],`${fps} FPS stays on the entry side`);
      assert.ok(Math.hypot(...result.positionM.map((v,i)=>v-endCentre[i]))>=envelope.radiusM-.01);
    }
  });
}

test('cosmic sweep retains tiny spheres at 256c and rejects tangency / motion away', () => {
  assert.ok(sweepSegmentSphere([-1e12,0,0],[2e12,0,0],[0,0,0],1000)! > 0);
  assert.equal(sweepSegmentSphere([-10,1,0],[20,0,0],[0,0,0],1),undefined);
  assert.equal(sweepSegmentSphere([10,0,0],[20,0,0],[0,0,0],1),undefined);
});

test('earliest unselected body wins before a farther selected body', () => {
  const controller = new CosmicCruiseController();
  const envelopes = [{bodyId:'near',centreM:[0,0,0] as Vec3,radiusM:10},
    {bodyId:'far',centreM:[100,0,0] as Vec3,radiusM:10}];
  controller.update({systemId:'sol',positionM:[-100,0,0],velocityMps:[10000,0,0]},.03,new Vector3(),
    {...cosmicContext(envelopes),target:{bodyId:'far',positionM:[100,0,0],radiusM:10,arrivalMarginM:0}});
  assert.equal(controller.lastCelestialContact?.bodyId,'near');
});

test('terminal capture refines relief only after speed becomes local-safe', () => {
  const envelopes=[{bodyId:'moon',centreM:[0,0,0] as Vec3,radiusM:1000,captureRadiusM:10}];
  const controller=new CosmicCruiseController();
  const fast=controller.update({systemId:'sol',positionM:[-3000,0,0],velocityMps:[100000,0,0]},.06,
    new Vector3(),cosmicContext(envelopes));
  assert.ok(fast.positionM[0]<=-1000);
  const slow=controller.update({systemId:'sol',positionM:[-15,0,0],velocityMps:[100,0,0]},.1,
    new Vector3(),cosmicContext(envelopes));
  assert.ok(slow.positionM[0]<=-10 && slow.positionM[0]>-15);
});

test('T_LOCAL_HANDOFF_ACCEPTS_SAFE_INWARD_SPEED', () => {
  const domain = new TravelDomain();
  const context = {altitudeM:10000,speedMps:0,requested:true,nearestColliderM:Infinity,bodyRadiusM:MOON.semiMajorAxisM};
  domain.update(context,0);
  domain.update({...context,altitudeM:400,speedMps:120,radialSpeedMps:-120},0);
  assert.equal(domain.kind,'interplanetary','absence of surface coverage approval is not readiness');
  domain.update({...context,altitudeM:400,speedMps:120,radialSpeedMps:-120,surfaceReady:true},0);
  assert.equal(domain.kind,'local');
});

test('handoff distinguishes tangent from dive and rejects total solver overflow', () => {
  const orbital: Vec3=[12000,30000,4000];
  const orbit=relativeSurfaceMotion([12000,35000,4000],orbital,[1,0,0]);
  assert.equal(orbit.radialSpeedMps,0);assert.equal(orbit.tangentialSpeedMps,5000);
  for (const [speed, radial, expected] of [[5000,0,'local'],[5000,-121,'interplanetary'],[8001,0,'interplanetary']] as const) {
    const domain=new TravelDomain();const context={altitudeM:10000,speedMps:0,requested:true,nearestColliderM:Infinity,bodyRadiusM:MOON.semiMajorAxisM};
    domain.update(context,0);domain.update({...context,altitudeM:400,speedMps:speed,radialSpeedMps:radial,surfaceReady:true},0);
    assert.equal(domain.kind,expected);
  }
});

test('T_PLANET_TERRAIN_SWEEP_CROSSES_SURFACE', () => {
  const hit=sweepTerrain({heightAt:()=>-800},new Vector3(0,-760,0),new Vector3(0,-900,0),.32);
  assert.ok(hit);assert.ok(Math.abs(hit.fraction-40/140)<1e-12);assert.equal(hit.position.y,-800);
});
test('T_PLANET_TERRAIN_SWEEP_NO_FALSE_CONTACT', () => {
  assert.equal(sweepTerrain({heightAt:()=>0},new Vector3(0,2,0),new Vector3(80,1,30),.32),null);
  assert.equal(sweepTerrain({heightAt:()=>-Infinity},new Vector3(0,2,0),new Vector3(80,-100,30),.32),null);
  assert.equal(sweepTerrain({heightAt:()=>0},new Vector3(0,0,0),new Vector3(80,0,30),.32),null,
    'a purely tangential segment on flat support is not an inward collision');
});

for (const fps of [120,60,30]) test(`T_MOON_FAST_DESCENT_NO_TUNNEL_${fps}FPS`, () => {
  const terrain=terrainFor(MOON,MoonSurfaceGenerator);PhysicsWorld.setTerrain(terrain);
  try {
    for (const speed of [LANDING_SPEED_LIMITS.localHandoffSpeedMps,LANDING_SPEED_LIMITS.maxLocalTerrainSweepMps,10000,260000]) {
      const position=new Vector3(120000,PhysicsWorld.terrainHeight(120000,-80000,.32)+.5,-80000);
      const velocity=new Vector3(speed*.02,-speed,speed*.01),physics=new PhysicsWorld();
      const oldEndpoint=position.clone().addScaledVector(velocity,1/fps);
      assert.ok(oldEndpoint.y < terrain.heightAt(oldEndpoint.x,oldEndpoint.z));
      assert.equal(physics.move(position,velocity,1/fps,.32,2.1,[]),true);
      assert.ok(physics.lastTerrainContact);assert.ok(physics.lastTerrainContact.fraction>=0&&physics.lastTerrainContact.fraction<=1);
      assert.ok(position.y>=PhysicsWorld.terrainHeight(position.x,position.z,.32)-1e-8);
      assert.ok(Math.abs(velocity.dot(physics.lastTerrainContact.normal))<1e-7);
    }
  } finally {PhysicsWorld.setTerrain(null);}
});

for (const name of ['T_MOON_CONTACT_PRESERVES_TANGENTIAL_VELOCITY','T_MOON_CONTACT_REMOVES_INWARD_VELOCITY']) test(name, () => {
  const hit=sweepTerrain(terrainFor(MOON,MoonSurfaceGenerator),new Vector3(0,5000,0),new Vector3(0,-20000,0),.32);
  assert.ok(hit);const normal=hit.normal,velocity=new Vector3(100,-10000,40);
  const tangent=velocity.clone().addScaledVector(normal,-velocity.dot(normal));
  removeInwardTerrainVelocity(velocity,normal);
  assert.ok(velocity.distanceTo(tangent)<1e-8);assert.ok(Math.abs(velocity.dot(normal))<1e-8);
});

test('T_MARS_FAST_DESCENT_NO_TUNNEL', () => {
  const terrain=terrainFor(MARS,MarsSurfaceGenerator);PhysicsWorld.setTerrain(terrain);
  try {
    for (const fps of [120,60,30]) {
      const p=new Vector3(2000,PhysicsWorld.terrainHeight(2000,3000,.32)+2,3000),v=new Vector3(800,-10000,500);
      const physics=new PhysicsWorld();assert.equal(physics.move(p,v,1/fps,.32,2.1,[]),true);
      assert.ok(physics.lastTerrainContact);assert.ok(p.y>=PhysicsWorld.terrainHeight(p.x,p.z,.32)-1e-8);
    }
  } finally {PhysicsWorld.setTerrain(null);}
});

for (const [name,fast] of [['T_MOON_CONTACT_GROUNDED',true],['T_MOON_SLOW_LANDING_REGRESSION',false]] as const) test(name, () => {
  PhysicsWorld.setTerrain(terrainFor(MOON,MoonSurfaceGenerator));
  const held=new Set<string>(),input={held:(key:string)=>held.has(key),consume:()=>false} as unknown as InputController;
  const player=new PlayerController(new Group(),input);
  try {
    player.setSurfaceGravity(1.623);player.teleport(new Vector3(0,PhysicsWorld.terrainHeight(0,0,.32)+2,0));
    player.beginSurfaceApproach();player.velocity.y=fast?-10000:-20;
    for(let i=0;i<120&&player.state!=='Grounded';i++)player.update(1/30,[],0);
    assert.equal(player.state,'Grounded');assert.ok(player.isGrounded);
    const before=player.position.clone();held.add('KeyW');for(let i=0;i<60;i++)player.update(1/60,[],0);
    assert.ok(player.position.distanceTo(before)>.5);
  } finally {player.character.dispose();PhysicsWorld.setTerrain(null);}
});

for (const [name,ids] of [['T_GAS_GIANT_HAS_BROAD_COLLISION_BUT_NO_GROUND_HANDOFF',['jupiter','saturn','uranus','neptune']],
  ['T_STAR_HAS_BROAD_COLLISION_BUT_NO_GROUND_HANDOFF',['sun']]] as const) test(name, () => {
  const system=new SolarSystem();for(const id of ids) {
    const body=system.bodies.find(b=>b.id===id)!;assert.equal(bodyProfile(body).canLand,false);
    assert.ok(bodyExclusionEnvelopes(system).find(e=>e.bodyId===id));
    const domain=new TravelDomain(),context={altitudeM:10000,speedMps:0,requested:true,nearestColliderM:Infinity,bodyRadiusM:body.equatorialRadiusM};
    domain.update(context,0);domain.update({...context,altitudeM:0,surfaceReady:bodyProfile(body).canLand},0);
    assert.equal(domain.kind,'interplanetary');
  }
});
