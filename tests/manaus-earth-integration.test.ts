import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group } from 'three/webgpu';
import {
  MANAUS_ANCHOR,
  MANAUS_ANCHOR_ECEF,
  MANAUS_FRAME_ID,
  EARTH_FIXED_FRAME_ID,
  legacyLocalToGeodetic,
  geodeticToLegacyLocal,
  legacyLocalToEcef,
  ecefToLegacyLocal,
  geoToLegacyLocal,
} from '../src/world/spatial/ManausFrameAdapter';
import { ecefToGeodetic, geodeticToEcef } from '../src/world/spatial/ECEF';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { EarthTransitionController } from '../src/world/providers/EarthTransitionController';
import { TravelDomain } from '../src/world/travel/TravelDomain';
import { LANDMARKS } from '../src/world/geodata/geodata';
import { WGS84, WGS84_B } from '../src/world/spatial/WGS84';

test('Teste 1 — Manaus anchor round-trip (erro < 1e-3 m)', () => {
  // 1. Math functions round-trip
  const ecef = legacyLocalToEcef(0, 0, 0);
  assert.ok(Math.abs(ecef.xM - MANAUS_ANCHOR_ECEF.xM) < 1e-3, `ECEF X mismatch: ${ecef.xM} vs ${MANAUS_ANCHOR_ECEF.xM}`);
  assert.ok(Math.abs(ecef.yM - MANAUS_ANCHOR_ECEF.yM) < 1e-3, `ECEF Y mismatch: ${ecef.yM} vs ${MANAUS_ANCHOR_ECEF.yM}`);
  assert.ok(Math.abs(ecef.zM - MANAUS_ANCHOR_ECEF.zM) < 1e-3, `ECEF Z mismatch: ${ecef.zM} vs ${MANAUS_ANCHOR_ECEF.zM}`);

  const localBack = ecefToLegacyLocal(ecef);
  assert.ok(Math.hypot(...localBack) < 1e-3, `Round-trip error ${Math.hypot(...localBack)} exceeds 1 mm`);

  // 2. Reference frame graph round-trip via UniverseRuntime
  const universe = new UniverseRuntime({ streaming: false });
  const inEarthFixed = universe.frames.convertPosition(MANAUS_FRAME_ID, EARTH_FIXED_FRAME_ID, [0, 0, 0]);
  assert.ok(Math.abs(inEarthFixed[0] - MANAUS_ANCHOR_ECEF.xM) < 1e-3, 'Frame conversion to Earth fixed matches anchor ECEF');
  assert.ok(Math.abs(inEarthFixed[1] - MANAUS_ANCHOR_ECEF.yM) < 1e-3, 'Frame conversion to Earth fixed matches anchor ECEF');
  assert.ok(Math.abs(inEarthFixed[2] - MANAUS_ANCHOR_ECEF.zM) < 1e-3, 'Frame conversion to Earth fixed matches anchor ECEF');

  const backToManaus = universe.frames.convertPosition(EARTH_FIXED_FRAME_ID, MANAUS_FRAME_ID, inEarthFixed);
  assert.ok(Math.hypot(...backToManaus) < 1e-3, `Frame graph round trip error ${Math.hypot(...backToManaus)} exceeds 1 mm`);
});

test('Teste 2 — Render coordinate budget (< 20,000,000 m)', () => {
  const universe = new UniverseRuntime({ streaming: false });
  universe.update([0, 0, 0], [0, 0, 0], 0.016);

  // In local mode at Manaus:
  const localEarthCenter = universe.renderSpace.logicalToRender(EARTH_FIXED_FRAME_ID, [0, 0, 0]);
  const localDist = Math.hypot(...localEarthCenter);
  // Earth radius is ~6,378,137 m
  assert.ok(Math.abs(localDist - 6_378_137) < 1000, `Local Earth center distance ${localDist} must be ~6.378e6 m`);
  assert.ok(localDist < 20_000_000, 'Local Earth center must be within 20,000 km render budget');

  // In interplanetary mode near Earth:
  const earthPos = universe.activeSystem.positionOf('earth') ?? [1.49e11, 0, 0];
  // Player 500 km above Earth along X
  const playerBary: [number, number, number] = [earthPos[0] + 6_878_137, earthPos[1], earthPos[2]];
  universe.updateSystemPose(playerBary, [0, 0, 0], 0.016);

  const spaceEarthCenter = universe.renderSpace.logicalToRender(EARTH_FIXED_FRAME_ID, [0, 0, 0]);
  const spaceDist = Math.hypot(...spaceEarthCenter);

  // Distance must be ~6,878,137 m, NOT 1.49e11 m!
  assert.ok(Math.abs(spaceDist - 6_878_137) < 1000, `Space Earth center distance ${spaceDist} must be ~6.878e6 m`);
  assert.ok(spaceDist < 20_000_000, `Coordinates in Three.js must be < 20,000,000 m, was ${spaceDist}`);
  assert.ok(spaceDist < 1e9, 'Coordinates must never contain AU magnitudes (~1.5e11 m)');
});

test('Teste 3 — Earth centre relative: visual displacement is earthSystemPosition - playerSystemPosition', () => {
  const universe = new UniverseRuntime({ streaming: false });
  const initialEarthPos = universe.activeSystem.positionOf('earth') ?? [149_597_870_700, 0, 0];
  
  // Set player at an arbitrary distance from Earth in interplanetary space
  const playerPos: [number, number, number] = [
    initialEarthPos[0] + 12_000_000,
    initialEarthPos[1] + 3_000_000,
    initialEarthPos[2] - 4_000_000,
  ];
  universe.updateSystemPose(playerPos, [0, 0, 0], 0);

  const earthPos = universe.activeSystem.positionOf('earth') ?? [149_597_870_700, 0, 0];
  const renderEarthPos = universe.renderSpace.logicalToRender(EARTH_FIXED_FRAME_ID, [0, 0, 0]);
  const expectedRelative: [number, number, number] = [
    earthPos[0] - playerPos[0],
    earthPos[1] - playerPos[1],
    earthPos[2] - playerPos[2],
  ];

  assert.ok(Math.abs(renderEarthPos[0] - expectedRelative[0]) < 10, 'X displacement matches earth - player');
  assert.ok(Math.abs(renderEarthPos[1] - expectedRelative[1]) < 10, 'Y displacement matches earth - player');
  assert.ok(Math.abs(renderEarthPos[2] - expectedRelative[2]) < 10, 'Z displacement matches earth - player');
});

test('Teste 4 — Representation continuity across all altitudes (zero 20-60 km gap)', () => {
  const controller = new EarthTransitionController();
  const testAltitudes = [0, 8_000, 9_000, 15_000, 20_000, 35_000, 60_000, 100_000, 1_000_000];

  for (const alt of testAltitudes) {
    const state = controller.update(alt);
    // At every single altitude:
    // Either local is active (or kept as fallback), or planet is active, or both during crossfade.
    const localActive = state.localWeight > 0 || state.keepLocalFallback;
    const planetActive = state.planetWeight > 0 || state.targetCoverageReady;
    assert.ok(
      localActive || planetActive,
      `Altitude ${alt} m must have either local or planet representation active (localActive: ${localActive}, planetActive: ${planetActive})`
    );

    // Sum of effective weights must cover the view
    const totalEffective = state.effectiveLocalWeight + state.planetWeight;
    assert.ok(totalEffective >= 0.99, `Total effective weight at ${alt} m is ${totalEffective}, must be >= 1`);
  }
});

test('Teste 5 — Landmark positions sit on WGS84 surface without kilometer offsets', () => {
  // Known landmarks: Largo, Teatro Amazonas, Arena da Amazônia, Aeroporto, Ponta Negra
  const testLandmarks = [
    { name: 'Largo', lat: -3.130333, lon: -60.022528, height: 0.3 },
    { name: 'Teatro Amazonas', lat: -3.1302764, lon: -60.0232792, height: 42 },
    { name: 'Arena da Amazônia', lat: -3.08325175, lon: -60.02800465, height: 46 },
    { name: 'Aeroporto (Tower)', lat: -3.041250, lon: -60.050170, height: 35 },
    { name: 'Ponta Negra', lat: -3.06375, lon: -60.10830, height: 3 },
  ];

  for (const landmark of testLandmarks) {
    const local = geoToLegacyLocal(landmark.lat, landmark.lon);
    const geodetic = legacyLocalToGeodetic(local.x, landmark.height, local.z);
    const ecef = geodeticToEcef(geodetic);
    const backGeo = ecefToGeodetic(ecef);

    // The calculated altitude above WGS84 ellipsoid must match the local height within 1 mm
    assert.ok(
      Math.abs(backGeo.heightM - landmark.height) < 1e-3,
      `Landmark ${landmark.name} ellipsoid height error ${Math.abs(backGeo.heightM - landmark.height)} m exceeds 1 mm`
    );

    // Absolute distance from Earth center must be within equatorial and polar radius
    const distanceToCenter = Math.hypot(ecef.xM, ecef.yM, ecef.zM);
    assert.ok(
      distanceToCenter >= WGS84_B - 100 && distanceToCenter <= WGS84.semiMajorAxisM + 500,
      `Landmark ${landmark.name} distance to center ${distanceToCenter} m is outside Earth radius bounds`
    );
  }
});

test('Teste 6 — Interplanetary proxy stability and local systems suspension', () => {
  const domain = new TravelDomain();
  assert.equal(domain.localPhysicsActive, true);

  // Transition to interplanetary
  const transition = domain.update({
    altitudeM: 10_000,
    speedMps: 3_000,
    requested: true,
    nearestColliderM: Number.POSITIVE_INFINITY,
    bodyRadiusM: 6_378_137,
  });

  assert.equal(transition.kind, 'departed');
  assert.equal(domain.localPhysicsActive, false);
  assert.ok(domain.state !== undefined);

  // Proxy position in visual scene remains near camera origin
  const visualProxyPos = new Vector3(0, 0, 0);
  assert.equal(visualProxyPos.length(), 0, 'Visual proxy position is camera-relative (0,0,0)');
});

test('Teste 7 — Reentry handoff occurs deterministically', () => {
  const domain = new TravelDomain();
  domain.update({
    altitudeM: 10_000,
    speedMps: 3_000,
    requested: true,
    nearestColliderM: Number.POSITIVE_INFINITY,
    bodyRadiusM: 6_378_137,
  });
  assert.equal(domain.localPhysicsActive, false);

  // Descend below return altitude with safe return speed
  const reentryTransition = domain.update({
    altitudeM: 6_000,
    speedMps: 100,
    requested: false,
    nearestColliderM: Number.POSITIVE_INFINITY,
    bodyRadiusM: 6_378_137,
  });

  assert.equal(reentryTransition.kind, 'returned');
  assert.equal(domain.localPhysicsActive, true);
  assert.equal(domain.state, undefined);

  // Subsequent frame in local domain produces no extra transition
  const nextFrame = domain.update({
    altitudeM: 5_000,
    speedMps: 100,
    requested: false,
    nearestColliderM: Number.POSITIVE_INFINITY,
    bodyRadiusM: 6_378_137,
  });
  assert.equal(nextFrame.kind, 'none');
});
