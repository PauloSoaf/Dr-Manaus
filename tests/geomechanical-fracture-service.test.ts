import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GeomechanicalFractureService,
  calculateDynamicStressPa,
  ROCK_YIELD_STRESS_PA,
} from '../src/world/destruction/GeomechanicalFractureService';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface';
import type { BodyFixedPoint } from '../src/world/planet/volume/PlanetVolumeEdit';

test('T_D3_01_DYNAMIC_STRESS_ATTENUATION_AND_YIELD_THRESHOLD', () => {
  const energyJoules = 5e16; // 50 Petajoules (approx. high-energy asteroid or megaton beam)

  // Near-field (500m): stress must vastly exceed rock yield strength (120 MPa)
  const stressNear = calculateDynamicStressPa(energyJoules, 500);
  assert.ok(stressNear > ROCK_YIELD_STRESS_PA * 5.0, `Near stress (${stressNear}) must exceed yield`);

  // Intermediate distance (5 km): still exceeds yield strength
  const stressMid = calculateDynamicStressPa(energyJoules, 5_000);
  assert.ok(stressMid > ROCK_YIELD_STRESS_PA);

  // Far-field (500 km): stress must attenuate below rock yield strength
  const stressFar = calculateDynamicStressPa(energyJoules, 500_000);
  assert.ok(stressFar < ROCK_YIELD_STRESS_PA);
});

test('T_D3_02_SEISMIC_FAULT_LINE_GENERATION', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new GeomechanicalFractureService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
  });
  const field = new PlanetVolumeField(EarthSurfaceGenerator, edits);

  const rSurface = planetSurfaceRadius(EarthSurfaceGenerator, [0, 1, 0]);
  const epicenter: BodyFixedPoint = [0, rSurface, 0];
  const energyJoules = 1e16; // 10 Petajoules

  const plan = service.propagateStressAndFracture('earth', epicenter, energyJoules);
  assert.ok(plan, 'Geomechanical fracture must be generated');
  assert.equal(plan.bodyId, 'earth');
  assert.ok(plan.faultSegments.length >= 10, 'Must create extensive branching fault segments');
  assert.ok(plan.maxRadiusM > 1000, 'Fracture radius must extend kilometers from epicenter');

  // Verification 1: Segments carved into PlanetVolumeEditStore
  assert.equal(edits.editCount, plan.faultSegments.length);

  // Verification 2: Fault segment interior is excavated hollow
  const segTest = plan.faultSegments[5] ?? plan.faultSegments[0];
  const midX = (segTest.startBodyFixedM[0] + segTest.endBodyFixedM[0]) * 0.5;
  const midY = (segTest.startBodyFixedM[1] + segTest.endBodyFixedM[1]) * 0.5;
  const midZ = (segTest.startBodyFixedM[2] + segTest.endBodyFixedM[2]) * 0.5;
  assert.ok(field.signedDistanceBodyFixed([midX, midY, midZ]) > 0, 'Fault fissure interior must be hollow');

  // Verification 3: Rock outside the fault width along the lateral normal remains solid
  const dx = segTest.endBodyFixedM[0] - segTest.startBodyFixedM[0];
  const dz = segTest.endBodyFixedM[2] - segTest.startBodyFixedM[2];
  const segLen = Math.hypot(dx, dz) || 1;
  const normX = -dz / segLen;
  const normZ = dx / segLen;
  const lateralOffset = segTest.widthM * 2.5;
  assert.ok(
    field.signedDistanceBodyFixed([midX + normX * lateralOffset, midY - 50, midZ + normZ * lateralOffset]) < 0,
    'Rock outside fissure must remain solid'
  );
});

test('T_D3_03_CRUST_INTEGRITY_DEGRADATION', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new GeomechanicalFractureService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
  });

  assert.equal(service.getCrustIntegrity('earth'), 1.0, 'Crust starts 100% intact');

  const rSurface = planetSurfaceRadius(EarthSurfaceGenerator, [1, 0, 0]);
  const epicenter: BodyFixedPoint = [rSurface, 0, 0];

  // High-energy tectonic shock (5e17 J)
  service.propagateStressAndFracture('earth', epicenter, 5e17);
  const integrity1 = service.getCrustIntegrity('earth');
  assert.ok(integrity1 < 1.0, 'Integrity must degrade after seismic shock');
  assert.ok(integrity1 > 0.5, 'Integrity must remain bounded');

  // Second shock degrades further
  service.propagateStressAndFracture('earth', epicenter, 5e17);
  const integrity2 = service.getCrustIntegrity('earth');
  assert.ok(integrity2 < integrity1, 'Subsequent shocks must degrade integrity cumulatively');
});

test('T_D3_04_ENERGY_THRESHOLD_GATING', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new GeomechanicalFractureService({
    edits,
    surfaceForBody: id => (id === 'moon' ? MoonSurfaceGenerator : undefined),
  });

  const rMoon = MoonSurfaceGenerator.body.semiMajorAxisM;
  const epicenter: BodyFixedPoint = [rMoon, 0, 0];

  // Sub-threshold energy (1 Megajoule = 1e6 J, well below tectonic threshold of 1 Terajoule = 1e12 J)
  const lowEnergy = service.propagateStressAndFracture('moon', epicenter, 1e6);
  assert.equal(lowEnergy, undefined, 'Sub-terajoule energies must not create tectonic faults');
  assert.equal(edits.editCount, 0);

  // Sufficient energy (1e14 J = 100 Terajoules)
  const highEnergy = service.propagateStressAndFracture('moon', epicenter, 1e14);
  assert.ok(highEnergy, 'Supra-threshold energy must create tectonic faults');
  assert.ok(edits.editCount > 0);
});

test('T_D3_05_MULTI_BODY_ISOLATION', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new GeomechanicalFractureService({
    edits,
    surfaceForBody: id => {
      if (id === 'earth') return EarthSurfaceGenerator;
      if (id === 'moon') return MoonSurfaceGenerator;
      return undefined;
    },
  });

  const rMoon = MoonSurfaceGenerator.body.semiMajorAxisM;
  service.propagateStressAndFracture('moon', [rMoon, 0, 0], 2e15);

  assert.equal(service.getCrustIntegrity('earth'), 1.0, 'Earth crust integrity must remain untouched');
  assert.ok(service.getCrustIntegrity('moon') < 1.0, 'Moon crust integrity must be reduced');
  assert.equal(edits.editsForBody('earth').length, 0);
  assert.ok(edits.editsForBody('moon').length > 0);
});
