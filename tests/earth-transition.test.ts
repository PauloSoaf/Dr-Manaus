import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { EarthTransitionController } from '../src/world/providers/EarthTransitionController';
import { EarthProvider } from '../src/world/providers/EarthProvider';
import { createDefaultReadiness } from '../src/world/providers/EarthCoverageReadiness';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame';
import { pose } from '../src/world/spatial/SpatialPose';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget';
import type { StreamingContext } from '../src/world/providers/WorldProvider';
import { tileKeyToString } from '../src/world/streaming/TileDemand';

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

test('EarthTransitionController waits for required detail, then transfers sole ground ownership', async () => {
  const controller = new EarthTransitionController();
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const earth = new EarthProvider(parent, runtime.frames);

  try {
    const ctx = makeContext(30_000);
    earth.covers(ctx.spatial);
    const demands = earth.plan(ctx);

    const waiting = controller.update(30_000, earth);
    assert.equal(waiting.targetCoverageReady, false, 'coarse fallback must not impersonate requested LOD 4');
    assert.equal(waiting.groundOwner, 'local');
    assert.equal(waiting.localGroundVisible, true);

    const required = new Set(waiting.readiness.requiredKeys);
    for (const demand of demands) {
      if (!required.has(tileKeyToString(demand.key))) continue;
      earth.activate(await earth.load(demand));
    }

    const handedOff = controller.update(30_000, earth);
    assert.equal(handedOff.targetCoverageReady, true);
    assert.equal(handedOff.phase, 'PLANET_DOMINANT');
    assert.equal(handedOff.groundOwner, 'planet');
    assert.equal(handedOff.localGroundVisible, false);
    assert.equal(handedOff.planetGroundDominant, true);
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
    assert.equal(groundReadiness.coverageSource, 'coarse');
    assert.equal(earth.readiness(6).viewCoverageReady, false, 'surface LOD needs active detailed keys');

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

test('ground ownership and presentation stay mutually exclusive through ascent and reentry', () => {
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

  const expected = [
    { altitudeM: 0, owner: 'local', domain: 'local' },
    { altitudeM: 11_499, owner: 'local', domain: 'local' },
    { altitudeM: 11_500, owner: 'local', domain: 'planetary' },
    { altitudeM: 15_000, owner: 'planet', domain: 'planetary' },
    { altitudeM: 60_000, owner: 'planet', domain: 'orbital' },
  ] as const;

  for (const sample of expected) {
    const state = controller.update(sample.altitudeM, readyEarth);
    assert.equal(state.groundOwner, sample.owner);
    assert.equal(state.presentationDomain, sample.domain);
    assert.equal(Number(state.localGroundVisible) + Number(state.planetGroundDominant), 1,
      `exactly one ground owner at ${sample.altitudeM} m`);
  }

  const detailChurn = {
    readiness: (targetLod: number) => ({
      ...createDefaultReadiness(targetLod),
      coarseFallbackReady: true,
      coverageSource: 'coarse' as const,
    }),
  } as unknown as EarthProvider;
  assert.equal(controller.update(40_000, detailChurn).groundOwner, 'planet',
    'streaming churn after handoff must use coarse coverage, never resurrect the flat sheet');

  // Hysteresis: descending across 15 km keeps the globe stable, then returns below 13 km.
  assert.equal(controller.update(14_000, readyEarth).groundOwner, 'planet');
  assert.equal(controller.update(12_999, readyEarth).groundOwner, 'local');
});
