import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three/webgpu';
import { SOLAR_SYSTEM_BODIES, bodyById } from '../src/world/celestial/CelestialBody.ts';
import { SolarSystem } from '../src/world/celestial/SolarSystem.ts';
import { OfflineEphemeris } from '../src/world/celestial/OfflineEphemeris.ts';
import { bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { bodyExclusionEnvelopes, resolveBodyDestination, selectBodyDestination } from '../src/world/travel/BodyNavigation.ts';
import { CosmicCruiseController } from '../src/world/travel/CosmicFlight.ts';
import { TravelDomain } from '../src/world/travel/TravelDomain.ts';
import { crossVec3, distanceVec3, dotVec3, normalizeVec3, rotateVec3, rotateVec3Inverse, subVec3 } from '../src/world/spatial/units.ts';

const parents = { moon: 'earth', io: 'jupiter', europa: 'jupiter', ganymede: 'jupiter', callisto: 'jupiter',
  titan: 'saturn', enceladus: 'saturn', titania: 'uranus', oberon: 'uranus', triton: 'neptune' };
const moons = Object.keys(parents).filter(id => id !== 'moon');

test('T_MAJOR_MOON_CATALOG_COMPLETE / T_MOON_PARENT_RELATIONSHIPS / T_MOON_PHYSICAL_VALUES_FINITE', () => {
  assert.equal(SOLAR_SYSTEM_BODIES.length, 19);
  assert.equal(new Set(SOLAR_SYSTEM_BODIES.map(b => b.id)).size, 19);
  for (const [id, parent] of Object.entries(parents)) {
    const b = bodyById(id)!;
    assert.equal(b.parentId, parent);
    for (const n of [b.massKg, b.equatorialRadiusM, b.polarRadiusM, b.rotationPeriodS,
      b.satelliteOrbit!.periodS, b.satelliteOrbit!.elements.semiMajorAxisM]) assert.ok(Number.isFinite(n) && n! > 0);
  }
});

test('T_HIERARCHICAL_POSITION / T_PARENT_MOVEMENT_CARRIES_MOON / T_MOON_RELATIVE_ORBIT_CHANGES', () => {
  const s = new SolarSystem(), e = new OfflineEphemeris();
  for (const [id, parentId] of Object.entries(parents)) {
    const before = e.sample(id, 0)!.positionM;
    for (const epoch of [0, 86400, 86400 * 200, 86400 * 9000]) {
      s.update(epoch);
      const parent = s.stateOf(parentId)!, moon = s.stateOf(id)!, local = e.sample(id, epoch)!;
      assert.ok(distanceVec3(subVec3(moon.positionM, parent.positionM), local.positionM) < .002);
      assert.ok(distanceVec3(subVec3(moon.velocityMps, parent.velocityMps), local.velocityMps) < 1e-8);
      const a = bodyById(id)!.satelliteOrbit!.elements.semiMajorAxisM;
      assert.ok(s.distanceBetween(id, parentId) > a * .9 && s.distanceBetween(id, parentId) < a * 1.1);
    }
    assert.ok(distanceVec3(before, e.sample(id, 86400)!.positionM) > 1e6);
  }
});

test('T_TRITON_RETROGRADE: angular momentum points against its reference pole', () => {
  const b = bodyById('triton')!, e = new OfflineEphemeris();
  assert.ok(b.satelliteOrbit!.elements.inclinationRad > Math.PI / 2);
  for (const t of [0, 86400, 1e8]) {
    const state = e.sample(b.id, t)!;
    const h = rotateVec3Inverse(b.satelliteOrbit!.referenceToEcliptic, crossVec3(state.positionM, state.velocityMps));
    assert.ok(h[2] < 0);
  }
});

test('T_SYNCHRONOUS_ROTATION_CONFIG: parent-facing orientation evolves with orbit, independent of observer', () => {
  const s = new SolarSystem();
  for (const [id, parent] of Object.entries(parents)) {
    const b = bodyById(id)!;
    assert.equal(b.rotationPeriodS, b.satelliteOrbit!.periodS);
    const rotations = [];
    for (const t of [0, b.rotationPeriodS! / 4]) {
      s.update(t);
      const q = s.fixedOrientationOf(id); rotations.push(q);
      const facing = normalizeVec3(subVec3(s.positionOf(parent)!, s.positionOf(id)!));
      assert.ok(dotVec3(rotateVec3(q, [1, 0, 0]), facing) > 1 - 1e-12);
    }
    assert.notDeepEqual(rotations[0], rotations[1]);
  }
});

test('T_NEW_MOONS_NOT_LANDABLE_YET / T_NEW_MOONS_NO_TERRAIN_PROVIDERS / T_MOON_VISUAL_PROFILE_COMPLETE', () => {
  const u = new UniverseRuntime(), providers = createPlanetProviders(new Group(), u);
  try {
    assert.deepEqual([...providers.keys()], ['mercury', 'venus', 'moon', 'mars']);
    for (const id of moons) {
      const p = bodyProfile(bodyById(id)!);
      assert.equal(p.hasSolidSurface, true); assert.equal(p.canLand, false);
      assert.equal(p.surfaceKind, 'none'); assert.equal(providers.has(id), false);
      const position = u.activeSystem.positionOf(id)!;
      u.updateSystemPose([...position], [0, 0, 0], 0);
      u.handoffTo(id);
      assert.equal(u.location.frameId, 'solar-system/barycentric');
      assert.ok(p.visual.albedo.every(Number.isFinite));
      const domain = new TravelDomain();
      domain.update({ requested: true, altitudeM: 20000, speedMps: 0, nearestColliderM: Infinity, bodyId: id, bodyRadiusM: 1 }, 0);
      domain.update({ requested: false, altitudeM: 0, speedMps: 0, nearestColliderM: Infinity, surfaceReady: p.canLand, bodyId: id, bodyRadiusM: 1 }, 0);
      assert.equal(domain.kind, 'interplanetary');
    }
    assert.equal(bodyProfile(bodyById('moon')!).canLand, true);
  } finally { for (const p of providers.values()) p.globe.dispose(); u.dispose(); }
});

test('T_MOON_NAVIGATION_TARGETS / T_MOON_TARGET_POSITION_LIVE', () => {
  const s = new SolarSystem();
  for (const id of moons) {
    s.update(0);
    const target = selectBodyDestination(s, id)!;
    assert.equal(target.bodyId, id); assert.ok(!('positionM' in target));
    const before = [...resolveBodyDestination(s, target)!.positionM];
    s.update(86400);
    assert.notDeepEqual(resolveBodyDestination(s, target)!.positionM, before);
    assert.deepEqual(resolveBodyDestination(s, target)!.positionM, s.positionOf(id));
  }
});

for (const id of ['europa', 'titan', 'triton']) test(`T_COSMIC_CRUISE_TO_MOON_GENERIC: ${id}`, () => {
  const s = new SolarSystem(), target = resolveBodyDestination(s, selectBodyDestination(s, id))!;
  const controller = new CosmicCruiseController();
  const start: [number, number, number] = [target.positionM[0], target.positionM[1] - target.radiusM * 100, target.positionM[2]];
  const result = controller.update({ systemId: 'sol', positionM: start, velocityMps: [0, 0, 0] }, 1/60,
    new Vector3(), { altitudeM: 1e10, speedMps: 0, requested: true, nearestColliderM: Infinity,
      bodyRadiusM: 0, bodyId: 'none', target, cameraForwardBary: new Vector3(0, 1, 0), inputBoost: true,
      inputBrake: false, exclusionEnvelopes: bodyExclusionEnvelopes(s) });
  assert.ok(result.positionM[1] > start[1]);
  assert.equal(controller.getTelemetry().targetBodyId, id);
});

for (const id of moons) test(`T_WARP_SWEEP_MOON: ${id} live envelope`, () => {
  const s = new SolarSystem(); s.update(86400 * 200);
  const envelopes = bodyExclusionEnvelopes(s); assert.equal(envelopes.length, 19);
  const moon = envelopes.find(e => e.bodyId === id)!, [x,y,z] = moon.centreM;
  const result = new CosmicCruiseController().update({ systemId: 'sol', positionM: [x,y-moon.radiusM*3,z],
    velocityMps: [0,moon.radiusM*30,0] }, .25, new Vector3(), { altitudeM: 1e11, speedMps: 1e12,
      requested: false, nearestColliderM: Infinity, bodyRadiusM: 0, bodyId: 'none',
      cameraForwardBary: new Vector3(0,1,0), inputBoost: false, inputBrake: false,
      maxRelativeSpeedMps: 1e12, exclusionEnvelopes: envelopes });
  assert.ok(result.positionM[1] < y - moon.radiusM);
});

for (const id of ['ganymede', 'titan']) test(`T_DOMINANT_BODY_NEAR_${id.toUpperCase()}: stable neighbourhood over time`, () => {
  const s = new SolarSystem(), b = bodyById(id)!;
  for (let t = 0; t < 100; t++) {
    s.update(t * 60);
    const p = s.positionOf(id)!;
    for (const jitter of [-100, 0, 100]) assert.equal(s.dominantBody([p[0] + b.equatorialRadiusM * 1.5 + jitter, p[1], p[2]]).id, id);
  }
});
