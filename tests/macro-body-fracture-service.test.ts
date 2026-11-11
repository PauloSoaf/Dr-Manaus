import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MacroBodyFractureService,
  calculateKeplerianElements,
  CRITICAL_CRUST_INTEGRITY_THRESHOLD,
} from '../src/world/destruction/MacroBodyFractureService';
import { GeomechanicalFractureService } from '../src/world/destruction/GeomechanicalFractureService';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { BodyFixedPoint } from '../src/world/planet/volume/PlanetVolumeEdit';

const mockEarthBody: CelestialBody = {
  id: 'earth',
  name: 'Earth',
  frameId: 'earth-frame',
  equatorialRadiusM: 6378137,
  polarRadiusM: 6356752,
  massKg: 5.972e24,
};

const mockMoonBody: CelestialBody = {
  id: 'moon',
  name: 'Moon',
  frameId: 'moon-frame',
  equatorialRadiusM: 1737400,
  massKg: 7.342e22,
};

test('T_D4_01_KEPLERIAN_DEBRIS_ORBIT_CLASSIFICATION', () => {
  const rEarth = 6378137;
  const massEarth = 5.972e24;

  // 1. Sub-orbital velocity (radial upward with insufficient tangential speed)
  const pos1: [number, number, number] = [rEarth + 100_000, 0, 0];
  const velSub: [number, number, number] = [2000, 3000, 0];
  const subOrb = calculateKeplerianElements(pos1, velSub, massEarth, rEarth);
  assert.equal(subOrb.trajectoryType, 'SUB_ORBITAL_REENTRY', 'Sub-orbital ejection must classify as reentry');
  assert.ok(subOrb.elements.isBound, 'Sub-orbital trajectory is bound to Earth');
  assert.ok(subOrb.elements.periapsisM < rEarth, 'Periapsis must intersect Earth radius');

  // 2. Bound orbital ring (tangential injection at 8,200 m/s at 300 km altitude)
  const pos2: [number, number, number] = [rEarth + 300_000, 0, 0];
  const velOrb: [number, number, number] = [0, 8200, 500];
  const boundOrb = calculateKeplerianElements(pos2, velOrb, massEarth, rEarth);
  assert.equal(boundOrb.trajectoryType, 'BOUND_ORBITAL_RING', 'Tangential ejection must form orbital ring');
  assert.ok(boundOrb.elements.isBound, 'Must be bound');
  assert.ok(boundOrb.elements.eccentricity < 1.0, 'Eccentricity must be elliptic');
  assert.ok(boundOrb.elements.periapsisM >= rEarth, 'Periapsis must clear Earth surface');

  // 3. Hyperbolic escape (ejection at 13,000 m/s > escape velocity ~11.18 km/s)
  const velEscape: [number, number, number] = [0, 13_000, 0];
  const escOrb = calculateKeplerianElements(pos2, velEscape, massEarth, rEarth);
  assert.equal(escOrb.trajectoryType, 'HYPERBOLIC_ESCAPE', 'Velocity above escape threshold must escape');
  assert.equal(escOrb.elements.isBound, false, 'Escape orbit is not bound');
  assert.ok(escOrb.elements.eccentricity >= 1.0, 'Hyperbolic eccentricity must be >= 1.0');
});

test('T_D4_02_PLATE_DETACHMENT_AND_VOLUME_CSG_CAVITY', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new MacroBodyFractureService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
    bodyById: id => (id === 'earth' ? mockEarthBody : undefined),
  });
  const field = new PlanetVolumeField(EarthSurfaceGenerator, edits);

  const rSurface = planetSurfaceRadius(EarthSurfaceGenerator, [0, 1, 0]);
  const epicenter: BodyFixedPoint = [0, rSurface, 0];
  const capRadiusM = 500_000; // 500 km radius continental plate
  const capDepthM = 40_000;   // 40 km crustal depth
  const ejectionSpeedMps = 6000; // 6 km/s ejection kick

  const plan = service.detachPlate('earth', epicenter, capRadiusM, capDepthM, ejectionSpeedMps);
  assert.ok(plan, 'Macro fracture plan must be created');
  assert.equal(plan.bodyId, 'earth');
  assert.equal(plan.state, 'PARTIALLY_FRACTURED');
  assert.ok(plan.detachedMassKg > 0, 'Detached mass must be positive');
  assert.ok(plan.remainingMassKg < mockEarthBody.massKg!, 'Remaining mass must decrease');

  // Verification 1: CSG edit exists in edit store
  assert.equal(edits.editCount, 1);
  const edit = edits.allEdits()[0];
  assert.equal(edit.type, 'subtract-sphere');

  // Verification 2: Cavity interior (20 km below original surface at epicenter) is excavated hollow
  const insideCavity: BodyFixedPoint = [0, rSurface - 20_000, 0];
  assert.ok(
    field.signedDistanceBodyFixed(insideCavity) > 0,
    'Sub-surface cavity interior must be hollow (air/space)'
  );

  // Verification 3: Rock outside plate boundary (8 deg away, ~890 km, 20 km subsurface) remains solid
  const angleRad = (8.0 * Math.PI) / 180.0;
  const dirOut = [Math.sin(angleRad), Math.cos(angleRad), 0];
  const rOut = planetSurfaceRadius(EarthSurfaceGenerator, [dirOut[0], dirOut[1], dirOut[2]]);
  const outsideCavity: BodyFixedPoint = [
    dirOut[0] * (rOut - 20_000),
    dirOut[1] * (rOut - 20_000),
    dirOut[2] * (rOut - 20_000),
  ];
  assert.ok(
    field.signedDistanceBodyFixed(outsideCavity) < 0,
    'Crust outside detachment boundary must remain solid rock'
  );

  // Verification 4: Debris ring generated with fragments
  assert.ok(plan.debrisRing.fragments.length > 0, 'Debris fragments must be created');
  assert.equal(plan.debrisRing.parentBodyId, 'earth');
});

test('T_D4_03_AUTOMATIC_TRIGGER_ON_CRITICAL_INTEGRITY', () => {
  const edits = new PlanetVolumeEditStore();
  const geomechanics = new GeomechanicalFractureService({
    edits,
    surfaceForBody: id => (id === 'moon' ? MoonSurfaceGenerator : undefined),
  });
  const service = new MacroBodyFractureService({
    edits,
    geomechanics,
    surfaceForBody: id => (id === 'moon' ? MoonSurfaceGenerator : undefined),
    bodyById: id => (id === 'moon' ? mockMoonBody : undefined),
  });

  // Integrity starts at 100% (> 35%) -> trigger should be blocked
  const planSafe = service.triggerMacroFractureIfCritical('moon');
  assert.equal(planSafe, undefined, 'Must not macro-fracture intact crust');

  // Set integrity below critical threshold (e.g. 20% < 35%)
  geomechanics.setCrustIntegrity('moon', 0.20);
  assert.ok(geomechanics.getCrustIntegrity('moon') < CRITICAL_CRUST_INTEGRITY_THRESHOLD);

  // Trigger macro-fracture
  const planCritical = service.triggerMacroFractureIfCritical('moon');
  assert.ok(planCritical, 'Crust below 35% integrity must undergo macro-body fracture');
  assert.equal(planCritical.bodyId, 'moon');
  assert.equal(service.isBodyFractured('moon'), true);
});

test('T_D4_04_CONSERVATION_OF_MASS_AND_STATE', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new MacroBodyFractureService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
    bodyById: id => (id === 'earth' ? mockEarthBody : undefined),
  });

  const rSurface = planetSurfaceRadius(EarthSurfaceGenerator, [1, 0, 0]);
  const initialMass = mockEarthBody.massKg!;
  const plan = service.detachPlate('earth', [rSurface, 0, 0], 300_000, 30_000, 5000);
  assert.ok(plan);

  const totalMass = plan.remainingMassKg + plan.detachedMassKg;
  assert.ok(
    Math.abs(totalMass - initialMass) / initialMass < 1e-12,
    'Total mass must be strictly conserved'
  );
  assert.equal(plan.state, 'PARTIALLY_FRACTURED');
});

test('T_D4_05_MULTI_BODY_ISOLATION', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new MacroBodyFractureService({
    edits,
    surfaceForBody: id => {
      if (id === 'earth') return EarthSurfaceGenerator;
      if (id === 'moon') return MoonSurfaceGenerator;
      return undefined;
    },
    bodyById: id => {
      if (id === 'earth') return mockEarthBody;
      if (id === 'moon') return mockMoonBody;
      return undefined;
    },
  });

  const rMoon = MoonSurfaceGenerator.body.semiMajorAxisM;
  service.detachPlate('moon', [rMoon, 0, 0], 100_000, 20_000, 2500);

  assert.equal(service.isBodyFractured('moon'), true, 'Moon must be marked as fractured');
  assert.equal(service.isBodyFractured('earth'), false, 'Earth must remain untouched');
  assert.equal(edits.editsForBody('earth').length, 0);
  assert.ok(edits.editsForBody('moon').length > 0);
});
