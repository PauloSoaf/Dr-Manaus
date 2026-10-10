import test from 'node:test';
import assert from 'node:assert/strict';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { SolarSystem } from '../src/world/celestial/SolarSystem';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph';
import { MARS, MOON, polarRadiusM } from '../src/world/planet/PlanetBody';

test('UniverseRuntime.navigationState uses this.address as true authority', () => {
  const runtime = new UniverseRuntime();
  
  // Initial state should match initial address
  assert.equal(runtime.navigationState.galaxyId, 'milky_way');
  assert.equal(runtime.navigationState.systemId, 'sol');
  assert.equal(runtime.navigationState.sector.x, 0n);
  assert.equal(runtime.navigationState.sector.y, 0n);

  // Cross-system changes now require a transactional runtime install (U3).
  const previous=runtime.address;
  assert.throws(()=>runtime.setAddress({galaxyId:'andromeda',sector:sectorIndex(50000n,-25000n,12000n),systemId:'m31-prime'}));
  assert.equal(runtime.address,previous);
  assert.equal(runtime.navigationState.galaxyId,runtime.activeGalaxy.id);
});

test('SolarSystem.update() dynamically updates reference frame origins on ephemeris change', () => {
  const frames = new ReferenceFrameGraph();
  const solarSystem = new SolarSystem();
  solarSystem.registerFrames(frames);

  // Get initial Earth frame origin at epoch 0
  const earthFrame0 = frames.get('solar-system/earth-fixed');
  assert.ok(earthFrame0);
  const pos0 = [...earthFrame0.originInParent];

  // Advance time by 90 days (~quarter orbit around Sun)
  solarSystem.update(90 * 86400);

  const earthFrame90 = frames.get('solar-system/earth-fixed');
  assert.ok(earthFrame90);
  const pos90 = earthFrame90.originInParent;

  // The position in parent must have genuinely moved millions of kilometres along its orbit
  const delta = Math.hypot(pos90[0] - pos0[0], pos90[1] - pos0[1], pos90[2] - pos0[2]);
  assert.ok(delta > 1e10, `Earth frame did not move: delta was ${delta} m`);
});

test('UniverseRuntime.location converts body-fixed Moon and Mars positions through their models', () => {
  const runtime = new UniverseRuntime();
  
  runtime.setPlayerPose('solar-system/moon-fixed', [MOON.semiMajorAxisM + 50, 0, 0]);
  const moonLoc = runtime.location;
  assert.ok(moonLoc.surface);
  // Altitude must be relative to Moon radius
  assert.ok(Math.abs(moonLoc.surface.altitudeM - 50) < 1e-6);
  // Lat/Lon should be bounded to sphere [-90, 90] and [-180, 180]
  assert.ok(moonLoc.surface.latDeg >= -90 && moonLoc.surface.latDeg <= 90);
  assert.ok(moonLoc.surface.lonDeg >= -180 && moonLoc.surface.lonDeg <= 180);

  runtime.setPlayerPose('solar-system/mars-fixed', [0, 0, polarRadiusM(MARS) + 120]);
  const marsLoc = runtime.location;
  assert.ok(marsLoc.surface);
  assert.ok(Math.abs(marsLoc.surface.altitudeM - 120) < 1e-6);
  // Lat at (0, 0, R) should be North pole = 90 deg
  assert.ok(Math.abs(marsLoc.surface.latDeg - 90) < 0.1);
});

test('End-to-end frame conversion: Manaus -> Orbit -> Barycentric', () => {
  const runtime = new UniverseRuntime();

  // Convert surface position at Manaus to Earth fixed
  const manausLocal: [number, number, number] = [0, 100, 0];
  const earthFixed = runtime.frames.convertPosition('earth/manaus/legacy-enu', 'earth/fixed', manausLocal);
  // Radius from Earth center must be ~6.37e6 m
  const earthR = Math.hypot(earthFixed[0], earthFixed[1], earthFixed[2]);
  assert.ok(earthR > 6.3e6 && earthR < 6.4e6, `Earth radius unexpected: ${earthR}`);

  // Convert to Solar System Barycentric
  const barycentric = runtime.frames.convertPosition('earth/fixed', 'solar-system/barycentric', earthFixed);
  // Earth distance from Sun is ~1 AU (1.49e11 m)
  const sunDistanceM = Math.hypot(barycentric[0], barycentric[1], barycentric[2]);
  assert.ok(sunDistanceM > 1.4e11 && sunDistanceM < 1.6e11, `Sun distance unexpected: ${sunDistanceM}`);
});
