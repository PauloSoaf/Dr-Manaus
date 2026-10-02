import test from 'node:test';
import assert from 'node:assert/strict';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { MANAUS_ANCHOR } from '../src/world/spatial/ManausFrameAdapter.ts';
import { AU_M, radToDeg } from '../src/world/spatial/units.ts';
import { MOON } from '../src/world/planet/PlanetBody.ts';

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

  for (let frame = 0; frame < 120; frame++) {
    runtime.update([38, 2.2, 12], [0, 0, 0], 1 / 60);
    runtime.updateStreaming(1 / 60);
  }
  assert.equal(runtime.telemetry.streaming.tracked, 0, 'nothing was streamed');
  assert.equal(runtime.telemetry.planetTiles, 0, 'and no planet tiles were selected');
  // But the model is live: the clock advanced and the solar system moved with it.
  assert.ok(runtime.time > 1.9 && runtime.time < 2.1, `clock reached ${runtime.time}`);

  runtime.streamingEnabled = true;
  runtime.update([38, 2.2, 12], [0, 0, 0], 1 / 60);
  runtime.updateStreaming(1 / 60);
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
  runtime.updateStreaming(1 / 60);
  const before = runtime.telemetry.streaming.generation;
  runtime.prepare();
  assert.ok(runtime.telemetry.streaming.generation > before, 'the generation must advance');
});

test('T1: Earth altitude in barycentric frame is ~100 km and dominantBody is earth', () => {
  const runtime = new UniverseRuntime({ streaming: false, epochS: 0 });
  const earthPos = runtime.solarSystem.positionOf('earth')!;
  // Position player 100 km radially outside Earth along Y
  // Earth equatorial radius is 6_378_137. Place player at Earth + [0, 6_378_137 + 100_000, 0]
  const playerBarycentric: [number, number, number] = [
    earthPos[0],
    earthPos[1] + 6_378_137 + 100_000,
    earthPos[2],
  ];

  runtime.updateSystemPose(playerBarycentric, [0, 0, 0], 1 / 60);

  const telemetry = runtime.telemetry;
  assert.equal(telemetry.dominantBody, 'earth');
  // Altitude must be approximately 100 km (within 500 m)
  assert.ok(
    Math.abs(telemetry.altitudeM - 100_000) < 500,
    `expected altitude ~100,000 m but got ${telemetry.altitudeM.toFixed(1)} m`,
  );

  // Spatial context must agree exactly with telemetry
  const resolved = runtime.resolveBodyContext();
  assert.equal(resolved.dominantBody, 'earth');
  assert.ok(Math.abs(resolved.altitudeM - telemetry.altitudeM) < 1e-6);
});

test('T2: Altitude remains continuous over 600 frames leaving Earth', () => {
  const runtime = new UniverseRuntime({ streaming: false, epochS: 0 });

  let prevAlt = 0;
  for (let frame = 0; frame < 600; frame++) {
    // Earth moves dynamically in orbit, so measure relative to current Earth position
    const earthPos = runtime.solarSystem.positionOf('earth')!;
    const altitude = 10_000 + frame * 1_000;
    const playerBarycentric: [number, number, number] = [
      earthPos[0],
      earthPos[1] + 6_378_137 + altitude,
      earthPos[2],
    ];

    runtime.updateSystemPose(playerBarycentric, [0, 1000, 0], 1 / 60);

    const telemetry = runtime.telemetry;
    assert.ok(Number.isFinite(telemetry.altitudeM), `altitude must be finite at frame ${frame}`);
    assert.equal(telemetry.dominantBody, 'earth');
    if (frame > 0) {
      assert.ok(
        telemetry.altitudeM > prevAlt,
        `altitude must monotonically increase (prev=${prevAlt}, curr=${telemetry.altitudeM})`,
      );
      assert.ok(
        Math.abs(telemetry.altitudeM - prevAlt - 1_000) < 50,
        `altitude step must match 1000 m (diff=${telemetry.altitudeM - prevAlt})`,
      );
    }
    prevAlt = telemetry.altitudeM;
  }
});

test('T8: consecutive floating origin rebases do not cause visual proxy shifts', () => {
  const runtime = new UniverseRuntime({ streaming: false, epochS: 0 });
  const earthPos = runtime.solarSystem.positionOf('earth')!;

  // Initial state at 100 km
  runtime.updateSystemPose(
    [earthPos[0], earthPos[1] + 6_378_137 + 100_000, earthPos[2]],
    [0, 0, 0],
    1 / 60,
  );
  const initialRebases = runtime.telemetry.rebases;

  // Move across several 1024m grid thresholds in barycentric
  for (let step = 1; step <= 10; step++) {
    runtime.updateSystemPose(
      [earthPos[0] + step * 2048, earthPos[1] + 6_378_137 + 100_000, earthPos[2]],
      [2048, 0, 0],
      1 / 60,
    );
  }

  // Rebases occurred
  assert.ok(runtime.telemetry.rebases > initialRebases);
  // Render local distance remains bounded by floating origin grid threshold (2048m)
  assert.ok(runtime.telemetry.renderLocalM <= 2048 * Math.SQRT2 + 100);
});
test('T_STREAMING_SPLIT: update does not execute scheduler, updateStreaming executes exactly once, time does not increase in streaming', () => {
  const runtime = new UniverseRuntime({ streaming: true, epochS: 0 });
  
  const startTime = runtime.time;
  runtime.update([0,0,0], [0,0,0], 0.1);
  const updatedTime = runtime.time;
  
  assert.equal(updatedTime, startTime + 0.1, 'time increases after update()');
  
  let updates = 0;
  const originalUpdate = runtime.scheduler.update.bind(runtime.scheduler);
  runtime.scheduler.update = (ctx, dt) => {
    updates++;
    originalUpdate(ctx, dt);
  };
  
  runtime.updateStreaming(0.1);
  assert.equal(updates, 1, 'scheduler is updated exactly once per updateStreaming() call');
  
  runtime.updateStreaming(0.1);
  assert.equal(updates, 2, 'scheduler executes again');
  
  const finalTime = runtime.time;
  assert.equal(finalTime, updatedTime, 'time does NOT increase after updateStreaming()');
});

// --- Task 008: Reentrada unica ------------------------------------------------------------------

test('T8_REENTRY: handoff from earth is idempotent - calling twice does not change frame again', () => {
  const runtime = new UniverseRuntime({ streaming: false, epochS: 0 });

  // Start in Manaus frame (earth domain)
  runtime.update([0, 0, 0], [0, 0, 0], 1 / 60);
  assert.equal(runtime.player.frame, 'earth/manaus/legacy-enu', 'starts in Manaus frame');

  // First handoffTo earth - should stay in Manaus (already on earth)
  runtime.handoffTo('earth');
  const afterFirst = runtime.player.frame;
  assert.equal(afterFirst, 'earth/manaus/legacy-enu', 'handoffTo earth stays in Manaus');

  // Second handoffTo earth - must be no-op
  runtime.handoffTo('earth');
  assert.equal(runtime.player.frame, afterFirst, 'second handoffTo is idempotent, no ping-pong');
});

test('T8_NO_PINGPONG: dominant body remains stable at fixed altitude with no velocity', () => {
  const runtime = new UniverseRuntime({ streaming: false, epochS: 0 });
  const earthPos = runtime.solarSystem.positionOf('earth')!;
  const EARTH_R = 6_378_137;

  let dominant = '';
  let switches = 0;

  for (let frame = 0; frame < 30; frame++) {
    runtime.updateSystemPose(
      [earthPos[0], earthPos[1] + EARTH_R + 400_000, earthPos[2]],
      [0, 0, 0], 1 / 60,
    );
    const cur = runtime.resolveBodyContext().dominantBody;
    if (cur !== dominant && frame > 0) switches++;
    dominant = cur;
  }
  assert.equal(switches, 0, `dominant body switched ${switches} times at stable altitude`);
});

// --- Task 009: ENU de pouso -------------------------------------------------------------------

test('T9_ENU_FRAME: handoffTo moon creates local-enu frame at correct altitude', () => {
  const runtime = new UniverseRuntime({ streaming: false, epochS: 0 });
  const moonPos = runtime.solarSystem.positionOf('moon')!;
  const moonRadiusM = MOON.semiMajorAxisM;

  // Place player in barycentric at Moon surface + 10 km
  runtime.updateSystemPose(
    [moonPos[0], moonPos[1] + moonRadiusM + 10_000, moonPos[2]],
    [0, 0, 0], 1 / 60,
  );

  runtime.handoffTo('moon');

  // The ENU frame must exist
  assert.ok(runtime.frames.has('moon/local-enu'), 'moon/local-enu frame must be registered');

  // Player should be in the ENU frame
  assert.equal(runtime.player.frame, 'moon/local-enu', 'player moves into moon/local-enu');

  // y coordinate should be ~10 km (altitude)
  const y = runtime.player.position[1];
  assert.ok(Math.abs(y - 10_000) < 1e-3,
    `y in ENU frame should be ~10,000 m, got ${y.toFixed(1)} m`);
});

test('T9_ENU_SURFACE: landing at surface (y=0) in ENU frame means alt = 0', () => {
  const runtime = new UniverseRuntime({ streaming: false, epochS: 0 });
  const moonPos = runtime.solarSystem.positionOf('moon')!;
  const moonRadiusM = MOON.semiMajorAxisM;

  // Place player exactly on the Moon surface (altitude = 0)
  runtime.updateSystemPose(
    [moonPos[0], moonPos[1] + moonRadiusM, moonPos[2]],
    [0, 0, 0], 1 / 60,
  );

  runtime.handoffTo('moon');

  // y should be 0 (on the surface)
  const y = runtime.player.position[1];
  assert.ok(Math.abs(y) < 1e-3, `y in ENU frame at surface should be ~0, got ${y.toFixed(6)} m`);
});

