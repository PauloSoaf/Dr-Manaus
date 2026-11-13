import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MinorBodyDisruptionService,
  gravitationalBindingEnergyJoules,
  calculateCatastrophicDisruptionThresholdJoules,
  MINOR_BODY_MAX_RADIUS_M,
} from '../src/world/destruction/MinorBodyDisruptionService';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';

const mockPhobosBody: CelestialBody = {
  id: 'phobos',
  name: 'Phobos',
  frameId: 'phobos-frame',
  parentId: 'mars',
  equatorialRadiusM: 11_260,
  massKg: 1.06e16,
};

const mockDeimosBody: CelestialBody = {
  id: 'deimos',
  name: 'Deimos',
  frameId: 'deimos-frame',
  parentId: 'mars',
  equatorialRadiusM: 6_200,
  massKg: 1.48e15,
};

const mockEarthBody: CelestialBody = {
  id: 'earth',
  name: 'Earth',
  frameId: 'earth-frame',
  equatorialRadiusM: 6_378_137,
  polarRadiusM: 6_356_752,
  massKg: 5.972e24,
};

const mockMoonBody: CelestialBody = {
  id: 'moon',
  name: 'Moon',
  frameId: 'moon-frame',
  parentId: 'earth',
  equatorialRadiusM: 1_737_400,
  massKg: 7.342e22,
};

test('T_D5_01_GRAVITATIONAL_BINDING_AND_DISRUPTION_CALCULATION', () => {
  const mPhobos = 1.06e16;
  const rPhobos = 11_260;

  const uPhobos = gravitationalBindingEnergyJoules(mPhobos, rPhobos);
  assert.ok(uPhobos > 1e17, `Binding energy (${uPhobos}) must be > 1e17 J`);
  assert.ok(uPhobos < 1e18, `Binding energy (${uPhobos}) must be < 1e18 J`);

  const eDisrupt = calculateCatastrophicDisruptionThresholdJoules(mPhobos, rPhobos);
  assert.ok(eDisrupt > uPhobos, 'Disruption threshold must exceed pure gravitational binding');
  assert.ok(eDisrupt >= 1e21, 'Disruption threshold must incorporate material strength');
});

test('T_D5_02_MAJOR_BODY_IMMUNITY', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new MinorBodyDisruptionService({
    edits,
    bodyById: id => {
      if (id === 'earth') return mockEarthBody;
      if (id === 'moon') return mockMoonBody;
      return undefined;
    },
  });

  // Major bodies must be immune to total minor body disruption
  assert.equal(service.canDisruptBody(mockEarthBody), false, 'Earth is a major body');
  assert.equal(service.canDisruptBody(mockMoonBody), false, 'Moon is a major body (>500 km radius)');

  // Attempting to disrupt Earth with 1e35 J must be safely rejected
  const result = service.disruptMinorBody('earth', 1e35);
  assert.equal(result, undefined, 'Major planet disruption must be refused');
  assert.equal(service.isBodyDisrupted('earth'), false);
});

test('T_D5_03_ENERGY_THRESHOLD_GATING', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new MinorBodyDisruptionService({
    edits,
    bodyById: id => (id === 'phobos' ? mockPhobosBody : undefined),
  });

  assert.equal(service.canDisruptBody(mockPhobosBody), true, 'Phobos qualifies as a minor body');

  // Sub-threshold energy (1e18 J < 1.06e21 J threshold)
  const lowEnergyPlan = service.disruptMinorBody('phobos', 1e18);
  assert.equal(lowEnergyPlan, undefined, 'Sub-threshold energy must not disrupt Phobos');
  assert.equal(service.isBodyDisrupted('phobos'), false);

  // Supra-threshold energy (2e21 J > 1.06e21 J threshold)
  const highEnergyPlan = service.disruptMinorBody('phobos', 2e21);
  assert.ok(highEnergyPlan, 'Supra-threshold energy must catastrophically disrupt Phobos');
  assert.equal(highEnergyPlan.bodyId, 'phobos');
  assert.equal(highEnergyPlan.state, 'DISRUPTED');
  assert.equal(service.isBodyDisrupted('phobos'), true);
});

test('T_D5_04_ASTEROID_SWARM_CLUSTER_GENERATION', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new MinorBodyDisruptionService({
    edits,
    bodyById: id => (id === 'deimos' ? mockDeimosBody : undefined),
  });

  const plan = service.disruptMinorBody('deimos', 5e20, [1, 0, 0]);
  assert.ok(plan, 'Deimos must be disrupted');
  assert.equal(plan.asteroidField.fragments.length, 32, 'Must spawn 32 swarm fragments');
  assert.equal(plan.asteroidField.originalBodyId, 'deimos');

  // Verification 1: Fragments have positive mass, radius, and orbital elements
  for (const frag of plan.asteroidField.fragments) {
    assert.ok(frag.massKg > 0, 'Fragment mass must be positive');
    assert.ok(frag.radiusM > 0, 'Fragment radius must be positive');
    assert.ok(Number.isFinite(frag.orbitalElements.semiMajorAxisM));
  }

  // Verification 2: Total mass conservation
  assert.equal(plan.asteroidField.totalMassKg, mockDeimosBody.massKg);
});

test('T_D5_05_MULTI_BODY_ISOLATION', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new MinorBodyDisruptionService({
    edits,
    bodyById: id => {
      if (id === 'phobos') return mockPhobosBody;
      if (id === 'deimos') return mockDeimosBody;
      return undefined;
    },
  });

  service.disruptMinorBody('phobos', 2e21);

  assert.equal(service.isBodyDisrupted('phobos'), true, 'Phobos must be disrupted');
  assert.equal(service.isBodyDisrupted('deimos'), false, 'Deimos must remain intact');
});

