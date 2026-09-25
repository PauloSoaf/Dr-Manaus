import test from 'node:test';
import assert from 'node:assert/strict';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { MANAUS_ANCHOR } from '../src/world/spatial/ManausFrameAdapter.ts';
import { AU_M, radToDeg } from '../src/world/spatial/units.ts';

test('the universe runtime places Manaus on the real Earth without moving it', () => {
  const runtime = new UniverseRuntime();
  // Spawn: the Largo, 38 m east and 12 m south of the Monumento.
  runtime.update([38, 2.2, 12], [0, 0, 0], 1 / 60);

  const here = runtime.playerGeodetic();
  assert.ok(Math.abs(radToDeg(here.latRad) - MANAUS_ANCHOR.latDeg) < 0.001, 'latitude must be Manaus');
  assert.ok(Math.abs(radToDeg(here.lonRad) - MANAUS_ANCHOR.lonDeg) < 0.001, 'longitude must be Manaus');
  assert.ok(Math.abs(here.heightM - 2.2) < 1e-9, 'and height passes straight through');

  // The player really is one Earth radius from the centre, give or take the ellipsoid.
  const ecef = runtime.playerEcef();
  const radius = Math.hypot(ecef.xM, ecef.yM, ecef.zM);
  assert.ok(Math.abs(radius - 6_378_000) < 5_000, `the player is ${(radius / 1000).toFixed(1)} km from the centre`);
});

test('the frame graph and the city projection agree where it matters', () => {
  const runtime = new UniverseRuntime();
  // At the anchor the two definitions are the same point, exactly.
  runtime.update([0, 0, 0], [0, 0, 0], 1 / 60);
  const viaCity = runtime.playerEcef();
  const viaFrames = runtime.playerEcefViaFrames();
  const atAnchor = Math.hypot(viaCity.xM - viaFrames.xM, viaCity.yM - viaFrames.yM, viaCity.zM - viaFrames.zM);
  assert.ok(atAnchor < 1e-6, `they differ by ${atAnchor} m at the origin`);

  // Across the compiled city they drift by the documented north stretch, and no more.
  runtime.update([0, 0, -20_000], [0, 0, 0], 1 / 60);
  const north = runtime.playerEcef();
  const northFrames = runtime.playerEcefViaFrames();
  const gap = Math.hypot(north.xM - northFrames.xM, north.yM - northFrames.yM, north.zM - northFrames.zM);
  assert.ok(gap > 100 && gap < 200, `20 km north they differ by ${gap.toFixed(1)} m`);
});

test('the runtime tracks the world without touching it until streaming is switched on', () => {
  const runtime = new UniverseRuntime();
  assert.equal(runtime.streamingEnabled, false, 'off by default, so nothing changes for the game');

  for (let frame = 0; frame < 120; frame++) runtime.update([38, 2.2, 12], [0, 0, 0], 1 / 60);
  assert.equal(runtime.telemetry.streaming.tracked, 0, 'nothing was streamed');
  assert.equal(runtime.telemetry.planetTiles, 0, 'and no planet tiles were selected');
  // But the model is live: the clock advanced and the solar system moved with it.
  assert.ok(runtime.time > 1.9 && runtime.time < 2.1, `clock reached ${runtime.time}`);

  runtime.streamingEnabled = true;
  runtime.update([38, 2.2, 12], [0, 0, 0], 1 / 60);
  assert.ok(runtime.telemetry.planetTiles > 0, 'switching it on selects planet tiles');
});

test('the floating origin follows the player out of the atmosphere', () => {
  const runtime = new UniverseRuntime();
  let worst = 0;
  // Straight up from the Largo, far past the old 140 km ceiling.
  for (let altitude = 0; altitude <= 500_000; altitude += 500) {
    runtime.update([38, altitude, 12], [0, 400, 0], 1 / 60);
    worst = Math.max(worst, runtime.telemetry.renderLocalM);
  }
  assert.ok(worst < 4000, `render-local coordinates reached ${worst.toFixed(0)} m`);
  assert.ok(runtime.telemetry.rebases > 100, 'the origin followed rather than being left behind');
  // And the altitude reported is the real height above the ellipsoid.
  assert.ok(Math.abs(runtime.telemetry.altitudeM - 500_000) < 1, `${runtime.telemetry.altitudeM} m`);
});

test('the solar system is live inside the runtime, and Earth is where it should be', () => {
  const runtime = new UniverseRuntime({ epochS: 0 });
  runtime.update([0, 0, 0], [0, 0, 0], 0);
  const earth = runtime.solarSystem.positionOf('earth')!;
  const au = Math.hypot(earth[0], earth[1], earth[2]) / AU_M;
  assert.ok(au > 0.98 && au < 0.99, `Earth is ${au.toFixed(4)} au from the Sun`);
  // Every body has a frame, and Manaus hangs off Earth's.
  assert.ok(runtime.frames.has('earth/manaus/legacy-enu'));
  assert.ok(runtime.frames.has('earth/fixed'));
  assert.equal(runtime.frames.lowestCommonAncestor('earth/manaus/legacy-enu', 'solar-system/moon-fixed'),
    'solar-system/barycentric');
});

test('a teleport cancels whatever was being streamed for somewhere else', () => {
  const runtime = new UniverseRuntime({ streaming: true });
  runtime.update([0, 0, 0], [0, 0, 0], 1 / 60);
  const before = runtime.telemetry.streaming.generation;
  runtime.prepare();
  assert.ok(runtime.telemetry.streaming.generation > before, 'the generation must advance');
});
