import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { EarthTransitionController, type EarthTransitionPhase } from '../src/world/providers/EarthTransitionController';
import { EarthProvider } from '../src/world/providers/EarthProvider';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame';
import { pose } from '../src/world/spatial/SpatialPose';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget';
import type { StreamingContext } from '../src/world/providers/WorldProvider';

function makeContext(altitudeM: number): StreamingContext {
  const frame = referenceFrame({ id: 'earth/manaus/legacy-enu', kind: 'surface-enu' });
  return {
    spatial: {
      timeS: 0,
      player: pose('earth/manaus/legacy-enu', [0, altitudeM, 0]),
      frame: activeFrame(frame, pose('earth/manaus/legacy-enu')),
      localVelocityMps: [0, 0, 0],
      altitudeM,
    },
    camera: { fovRad: 1.0, viewportHeightPx: 1080, forward: [0, -1, 0] }, // looking nadir
    quality: { sseTargetPx: 8, detailFactor: 1 },
    budget: DEFAULT_STREAMING_BUDGET,
  };
}

test('EarthTransitionController starts in LOCAL_ONLY at ground level', () => {
  const controller = new EarthTransitionController();
  const state = controller.update(50);

  assert.equal(state.phase, 'LOCAL_ONLY');
  assert.equal(state.localWeight, 1);
  assert.equal(state.planetWeight, 0);
  assert.equal(state.regionalWeight, 0);
});

test('EarthTransitionController transitions through OVERLAP_SAFE or PLANET_DOMINANT when coverage is ready', () => {
  const controller = new EarthTransitionController();
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const earth = new EarthProvider(parent, runtime.frames);

  try {
    const ctx = makeContext(30_000);
    earth.covers(ctx.spatial);
    earth.plan(ctx);

    const state = controller.update(30_000, earth);
    assert.ok(state.targetCoverageReady, 'coarse fallback should ensure readiness');
    assert.ok(state.planetWeight > 0);
    assert.ok(state.phase === 'OVERLAP_SAFE' || state.phase === 'PLANET_DOMINANT');
  } finally {
    earth.dispose();
  }
});

test('EarthTransitionController reaches PLANET_ONLY in orbit with zero representation holes', () => {
  const controller = new EarthTransitionController();
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const earth = new EarthProvider(parent, runtime.frames);

  try {
    const ctx = makeContext(236_300);
    earth.covers(ctx.spatial);

    const state = controller.update(236_300, earth);
    assert.equal(state.phase, 'PLANET_ONLY');
    assert.equal(state.localWeight, 0);
    assert.equal(state.planetWeight, 1);
    assert.equal(state.targetCoverageReady, true);
    assert.equal(state.readiness.coarseFallbackReady, true);
  } finally {
    earth.dispose();
  }
});

test('EarthProvider readiness contract reports ready and guarantees coarse fallback', () => {
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const earth = new EarthProvider(parent, runtime.frames, { minAltitudeM: 10_000 });

  try {
    const groundCtx = makeContext(100);
    const groundReadiness = earth.readiness(0);
    assert.equal(groundReadiness.coarseFallbackReady, true, 'coarse fallback is always primed');

    const orbitCtx = makeContext(236_300);
    earth.covers(orbitCtx.spatial);
    assert.equal(earth.globe.visible, true);
    
    const orbitReadiness = earth.readiness(0);
    assert.equal(orbitReadiness.viewCoverageReady, true, 'readiness must be satisfied in orbit');
    assert.equal(orbitReadiness.coarseFallbackReady, true);
  } finally {
    earth.dispose();
  }
});
