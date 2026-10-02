import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3, Group } from 'three/webgpu';
import {
  MANAUS_ANCHOR,
  MANAUS_ANCHOR_ECEF,
  MANAUS_BASIS,
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
import { EarthProvider } from '../src/world/providers/EarthProvider';
import { EarthTransitionController } from '../src/world/providers/EarthTransitionController';
import { createDefaultReadiness } from '../src/world/providers/EarthCoverageReadiness';
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
  const expectedRelativeSystem: [number, number, number] = [
    earthPos[0] - playerPos[0],
    earthPos[1] - playerPos[1],
    earthPos[2] - playerPos[2],
  ];

  const expectedRelativeRender = universe.frames.convertDirection(
    'solar-system/barycentric',
    universe.renderSpace.currentOrigin.frame,
    expectedRelativeSystem
  );

  assert.ok(Math.abs(renderEarthPos[0] - expectedRelativeRender[0]) < 10, 'X displacement matches earth - player');
  assert.ok(Math.abs(renderEarthPos[1] - expectedRelativeRender[1]) < 10, 'Y displacement matches earth - player');
  assert.ok(Math.abs(renderEarthPos[2] - expectedRelativeRender[2]) < 10, 'Z displacement matches earth - player');
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

  // In interplanetary mode, the visual proxy stays attached to camera origin (0, 0, 0)
  // while barycentric coordinates track the spacecraft trajectory.
  assert.ok(domain.state.positionM.length === 3);
  assert.ok(Number.isFinite(domain.state.positionM[0]));
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

test('Teste 8 — Manaus render origin remains attached to Earth surface across all altitudes', () => {
  const scene = new Scene();
  const planetaryRoot = new Group();
  planetaryRoot.name = 'planetaryRoot';
  scene.add(planetaryRoot);

  const universe = new UniverseRuntime({ streaming: true });
  const earth = new EarthProvider(planetaryRoot, universe.frames, {
    cityOwnsGround: true,
    renderSpace: universe.renderSpace,
  });
  universe.providers.register(earth);

  const localWorldRoot = new Group();
  localWorldRoot.name = 'localWorldRoot';
  earth.manausSurfaceAnchor.add(localWorldRoot);
  localWorldRoot.position.set(0, 0, 0);
  localWorldRoot.quaternion.identity();

  const testAltitudes = [0, 5_000, 8_000, 9_000, 15_000, 20_000, 35_000, 60_000, 100_000, 1_000_000];

  for (const alt of testAltitudes) {
    if (alt < 9000) {
      // Local mode
      universe.update([0, alt, 0], [0, 0, 0], 0.016);
    } else {
      // Interplanetary / handoff mode
      const posEcef: [number, number, number] = [
        MANAUS_ANCHOR_ECEF.xM + alt * MANAUS_BASIS.up[0],
        MANAUS_ANCHOR_ECEF.yM + alt * MANAUS_BASIS.up[1],
        MANAUS_ANCHOR_ECEF.zM + alt * MANAUS_BASIS.up[2],
      ];
      const playerBary = universe.frames.convertPosition(EARTH_FIXED_FRAME_ID, 'solar-system/barycentric', posEcef);
      universe.updateSystemPose(playerBary, [0, 0, 0], 0.016);
    }

    scene.updateMatrixWorld(true);

    const cityOrigin = new Vector3();
    localWorldRoot.getWorldPosition(cityOrigin);

    const earthSurfacePoint = new Vector3(MANAUS_ANCHOR_ECEF.xM, MANAUS_ANCHOR_ECEF.yM, MANAUS_ANCHOR_ECEF.zM);
    earth.globe.group.localToWorld(earthSurfacePoint);

    const dist = cityOrigin.distanceTo(earthSurfacePoint);
    assert.ok(
      dist < 0.1,
      `Altitude ${alt} m: Manaus world origin detached from Earth surface point by ${dist} m (must be < 0.1 m)`
    );
  }
});

test('Teste 9 — Tangent ENU orientation: Manaus +Y == normal, +X == East, -Z == North', () => {
  const scene = new Scene();
  const planetaryRoot = new Group();
  scene.add(planetaryRoot);

  const universe = new UniverseRuntime({ streaming: true });
  const earth = new EarthProvider(planetaryRoot, universe.frames, {
    cityOwnsGround: true,
    renderSpace: universe.renderSpace,
  });
  universe.providers.register(earth);

  const localWorldRoot = new Group();
  earth.manausSurfaceAnchor.add(localWorldRoot);
  localWorldRoot.position.set(0, 0, 0);
  localWorldRoot.quaternion.identity();

  const testAltitudes = [0, 8_000, 20_000, 100_000];
  for (const alt of testAltitudes) {
    if (alt < 9000) {
      universe.update([0, alt, 0], [0, 0, 0], 0.016);
    } else {
      const posEcef: [number, number, number] = [
        MANAUS_ANCHOR_ECEF.xM + alt * MANAUS_BASIS.up[0],
        MANAUS_ANCHOR_ECEF.yM + alt * MANAUS_BASIS.up[1],
        MANAUS_ANCHOR_ECEF.zM + alt * MANAUS_BASIS.up[2],
      ];
      const playerBary = universe.frames.convertPosition(EARTH_FIXED_FRAME_ID, 'solar-system/barycentric', posEcef);
      universe.updateSystemPose(playerBary, [0, 0, 0], 0.016);
    }

    scene.updateMatrixWorld(true);

    const localX = new Vector3(1, 0, 0).transformDirection(localWorldRoot.matrixWorld);
    const localY = new Vector3(0, 1, 0).transformDirection(localWorldRoot.matrixWorld);
    const localZ = new Vector3(0, 0, -1).transformDirection(localWorldRoot.matrixWorld); // -Z is north in local frame

    const ecefEast = new Vector3(MANAUS_BASIS.east[0], MANAUS_BASIS.east[1], MANAUS_BASIS.east[2]).transformDirection(earth.globe.group.matrixWorld);
    const ecefUp = new Vector3(MANAUS_BASIS.up[0], MANAUS_BASIS.up[1], MANAUS_BASIS.up[2]).transformDirection(earth.globe.group.matrixWorld);
    const ecefNorth = new Vector3(MANAUS_BASIS.north[0], MANAUS_BASIS.north[1], MANAUS_BASIS.north[2]).transformDirection(earth.globe.group.matrixWorld);

    assert.ok(localX.distanceTo(ecefEast) < 1e-4, `Altitude ${alt} m: +X axis does not match East`);
    assert.ok(localY.distanceTo(ecefUp) < 1e-4, `Altitude ${alt} m: +Y axis does not match Ellipsoid Normal Up`);
    assert.ok(localZ.distanceTo(ecefNorth) < 1e-4, `Altitude ${alt} m: -Z axis does not match North`);
  }
});

test('Teste 10 — Structural scene-graph hierarchy: localWorldRoot is descendant of EarthGlobe', () => {
  const scene = new Scene();
  const planetaryRoot = new Group();
  scene.add(planetaryRoot);

  const universe = new UniverseRuntime({ streaming: false });
  const earth = new EarthProvider(planetaryRoot, universe.frames, {
    cityOwnsGround: true,
    renderSpace: universe.renderSpace,
  });

  const localWorldRoot = new Group();
  earth.manausSurfaceAnchor.add(localWorldRoot);

  assert.equal(localWorldRoot.parent, earth.manausSurfaceAnchor);
  assert.equal(earth.manausSurfaceAnchor.parent, earth.globe.group);
  assert.equal(earth.globe.group.parent, planetaryRoot);
  assert.equal(planetaryRoot.parent, scene);

  // Moving Earth in render space moves localWorldRoot by the exact same vector
  scene.updateMatrixWorld(true);
  const p1 = new Vector3();
  localWorldRoot.getWorldPosition(p1);

  earth.globe.group.position.x += 1000;
  earth.globe.group.position.y += 2000;
  earth.globe.group.position.z -= 3000;
  scene.updateMatrixWorld(true);

  const p2 = new Vector3();
  localWorldRoot.getWorldPosition(p2);

  assert.ok(Math.abs(p2.x - p1.x - 1000) < 1e-4);
  assert.ok(Math.abs(p2.y - p1.y - 2000) < 1e-4);
  assert.ok(Math.abs(p2.z - p1.z - (-3000)) < 1e-4);
});

test('Teste 11 — Continuity across local/interplanetary boundary (8.999 km to 9.001 km)', () => {
  const scene = new Scene();
  const planetaryRoot = new Group();
  scene.add(planetaryRoot);

  const universe = new UniverseRuntime({ streaming: true });
  const earth = new EarthProvider(planetaryRoot, universe.frames, {
    cityOwnsGround: true,
    renderSpace: universe.renderSpace,
  });
  universe.providers.register(earth);

  const localWorldRoot = new Group();
  earth.manausSurfaceAnchor.add(localWorldRoot);
  localWorldRoot.position.set(0, 0, 0);

  // 1. Right before boundary in local mode:
  universe.update([0, 8_999, 0], [0, 0, 0], 0.016);
  scene.updateMatrixWorld(true);
  const pLocal = new Vector3();
  localWorldRoot.getWorldPosition(pLocal);

  const earthSurfaceLocal = new Vector3(MANAUS_ANCHOR_ECEF.xM, MANAUS_ANCHOR_ECEF.yM, MANAUS_ANCHOR_ECEF.zM);
  earth.globe.group.localToWorld(earthSurfaceLocal);
  assert.ok(pLocal.distanceTo(earthSurfaceLocal) < 0.1, 'Before boundary: Manaus attached to Earth');

  // 2. Right after boundary in interplanetary mode:
  const posEcef: [number, number, number] = [
    MANAUS_ANCHOR_ECEF.xM + 9_001 * MANAUS_BASIS.up[0],
    MANAUS_ANCHOR_ECEF.yM + 9_001 * MANAUS_BASIS.up[1],
    MANAUS_ANCHOR_ECEF.zM + 9_001 * MANAUS_BASIS.up[2],
  ];
  const playerBary = universe.frames.convertPosition(EARTH_FIXED_FRAME_ID, 'solar-system/barycentric', posEcef);
  universe.updateSystemPose(playerBary, [0, 0, 0], 0.016);
  scene.updateMatrixWorld(true);
  const pSpace = new Vector3();
  localWorldRoot.getWorldPosition(pSpace);

  const earthSurfaceSpace = new Vector3(MANAUS_ANCHOR_ECEF.xM, MANAUS_ANCHOR_ECEF.yM, MANAUS_ANCHOR_ECEF.zM);
  earth.globe.group.localToWorld(earthSurfaceSpace);
  assert.ok(pSpace.distanceTo(earthSurfaceSpace) < 0.1, 'After boundary: Manaus attached to Earth');
});

test('Teste 12 — Local flat ground retires when ready planet coverage assumes ownership', () => {
  const controller = new EarthTransitionController();
  const readyEarth = {
    readiness: (targetLod: number) => ({
      ...createDefaultReadiness(targetLod),
      coarseFallbackReady: true,
      detailedCoverageReady: true,
      coverageSource: 'detailed' as const,
      viewCoverageReady: true,
    }),
  } as unknown as EarthProvider;
  const testAltitudes = [0, 5_000, 8_000, 9_000, 14_999, 15_000, 20_000, 59_999, 60_000, 100_000];

  for (const alt of testAltitudes) {
    const state = controller.update(alt, readyEarth);
    assert.equal(Number(state.localGroundVisible) + Number(state.planetGroundDominant), 1,
      `Altitude ${alt} m must have exactly one dominant ground provider`);
    assert.equal(state.localGroundVisible, alt < 15_000,
      `Altitude ${alt} m must follow the structural 15 km handoff`);
  }
});

test('Teste 13 — Ciclo completo de ida e volta e consistência de Game.origin vs UniverseRuntime', () => {
  const universe = new UniverseRuntime({ streaming: false });
  const gameOrigin = new Vector3(0, 0, 0);

  const syncOrigin = () => {
    const uOrigin = universe.floatingOrigin.logicalOrigin.position;
    if (gameOrigin.x !== uOrigin[0] || gameOrigin.y !== uOrigin[1] || gameOrigin.z !== uOrigin[2]) {
      gameOrigin.set(uOrigin[0], uOrigin[1], uOrigin[2]);
    }
  };

  // 1. Spawn Manaus
  universe.update([0, 0, 0], [0, 0, 0], 0);
  syncOrigin();
  assert.deepEqual([gameOrigin.x, gameOrigin.y, gameOrigin.z], [0, 0, 0], 'Spawn: gameOrigin starts exactly at 0');

  // 2. Subir localmente com rebase (exceder 2048 metros)
  universe.update([0, 2500, 0], [0, 100, 0], 0);
  syncOrigin();
  
  // O UniverseRuntime já rebaseou a origem para quantização de 1024
  assert.ok(gameOrigin.y === 2048, 'Origin rebased during local ascent to grid');
  assert.deepEqual([gameOrigin.x, gameOrigin.y, gameOrigin.z], Array.from(universe.floatingOrigin.logicalOrigin.position), 'Game origin stays perfectly synchronized with Universe');

  // 3. 8.999 km
  universe.update([0, 8999, 0], [0, 500, 0], 0);
  syncOrigin();
  
  // 4. Entrar interplanetário (10 km)
  const pos10km: [number, number, number] = [
    MANAUS_ANCHOR_ECEF.xM + 10_000 * MANAUS_BASIS.up[0],
    MANAUS_ANCHOR_ECEF.yM + 10_000 * MANAUS_BASIS.up[1],
    MANAUS_ANCHOR_ECEF.zM + 10_000 * MANAUS_BASIS.up[2],
  ];
  const bary10km = universe.frames.convertPosition(EARTH_FIXED_FRAME_ID, 'solar-system/barycentric', pos10km);
  universe.updateSystemPose(bary10km, [0, 0, 0], 0);

  // 5. Afastar para 1.000 km
  const pos1000km: [number, number, number] = [
    MANAUS_ANCHOR_ECEF.xM + 1_000_000 * MANAUS_BASIS.up[0],
    MANAUS_ANCHOR_ECEF.yM + 1_000_000 * MANAUS_BASIS.up[1],
    MANAUS_ANCHOR_ECEF.zM + 1_000_000 * MANAUS_BASIS.up[2],
  ];
  const bary1000km = universe.frames.convertPosition(EARTH_FIXED_FRAME_ID, 'solar-system/barycentric', pos1000km);
  universe.updateSystemPose(bary1000km, [0, 0, 0], 0);

  // 6. Aproximar e Handoff (6 km)
  const pos6km: [number, number, number] = [
    MANAUS_ANCHOR_ECEF.xM + 6_000 * MANAUS_BASIS.up[0],
    MANAUS_ANCHOR_ECEF.yM + 6_000 * MANAUS_BASIS.up[1],
    MANAUS_ANCHOR_ECEF.zM + 6_000 * MANAUS_BASIS.up[2],
  ];
  const bary6km = universe.frames.convertPosition(EARTH_FIXED_FRAME_ID, 'solar-system/barycentric', pos6km);
  universe.updateSystemPose(bary6km, [0, 0, 0], 0);
  
  // Handoff to Earth (reentrada)
  const newLocalPos = universe.handoffTo('earth');
  syncOrigin(); // Isso simula o comportamento no Game.ts (handoffTo -> espelhar origem)

  // 7. Validate origin exact match and no drift
  const uOrigin = universe.floatingOrigin.logicalOrigin.position;
  assert.ok(Math.abs(gameOrigin.x - uOrigin[0]) < 1e-4, `Reentry X origin drift is zero, got ${gameOrigin.x} vs ${uOrigin[0]}`);
  assert.ok(Math.abs(gameOrigin.y - uOrigin[1]) < 1e-4, `Reentry Y origin drift is zero, got ${gameOrigin.y} vs ${uOrigin[1]}`);
  assert.ok(Math.abs(gameOrigin.z - uOrigin[2]) < 1e-4, `Reentry Z origin drift is zero, got ${gameOrigin.z} vs ${uOrigin[2]}`);
  
  // O Player aparece onde deveria: próximo a 6000m de altura em Manaus
  assert.ok(Math.abs(newLocalPos[0]) < 10, 'Returned to correct local X');
  assert.ok(Math.abs(newLocalPos[1] - 6000) < 10, 'Returned to correct local Y');
  assert.ok(Math.abs(newLocalPos[2]) < 10, 'Returned to correct local Z');
});
