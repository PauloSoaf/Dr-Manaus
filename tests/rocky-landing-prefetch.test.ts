import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { RockyPlanetProvider, LANDING_PATCH_LEVEL } from '../src/world/providers/RockyPlanetProvider.ts';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { MOON } from '../src/world/planet/PlanetBody.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import { tileCentreDirection } from '../src/world/planet/PlanetTileAddress.ts';
import type { CubeFace } from '../src/world/planet/CubeSphere.ts';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { createRenderOrigin } from '../src/world/spatial/RenderOrigin.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { normalizeVec3, type Vec3 } from '../src/world/spatial/units.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';
import { tileKeyToString, type TileDemand } from '../src/world/streaming/TileDemand.ts';
import { landingCaptureRangeM, resolveLandingCandidate } from '../src/world/travel/PlanetaryLanding.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';

const direction: Vec3 = normalizeVec3([1, 0.17, 0.09]);

function fixture(mode: 'off' | 'coarse' | 'surface' = 'coarse') {
  const universe = new UniverseRuntime({ epochS: 0 });
  // The production budget is unchanged: landing may add at most five demands to this cut.
  const provider = new RockyPlanetProvider(new Group(), universe.frames, MOON, MoonSurfaceGenerator,
    { renderSpace: universe.renderSpace });
  const player = pose('moon/fixed', [MOON.semiMajorAxisM + 80_000, 0, 0]);
  const context: StreamingContext = {
    spatial: { timeS: 0, player, frame: activeFrame(referenceFrame({ id: 'moon/fixed', kind: 'body-fixed' }), player),
      localVelocityMps: [-2000, 0, 0], altitudeM: 80_000, bodyId: 'moon' },
    camera: { fovRad: 1, viewportHeightPx: 1080, forward: [-1, 0, 0] },
    quality: { sseTargetPx: 8, detailFactor: 1 }, budget: DEFAULT_STREAMING_BUDGET,
  };
  provider.setStreamingMode(mode);
  const request = (fixed: Vec3 = direction, eta = 4) => provider.setLandingPrefetch({ directionFixed: fixed, timeToContactS: eta });
  const patch = (demands: readonly TileDemand[]) => {
    const keys = new Set(provider.readiness().landingPrefetchKeys);
    return demands.filter(demand => keys.has(tileKeyToString(demand.key)));
  };
  const load = async (demands: readonly TileDemand[]) => {
    for (const demand of demands) provider.activate(await provider.load(demand));
  };
  const dispose = () => { provider.globe.dispose(); universe.dispose(); };
  return { universe, provider, context, request, patch, load, dispose };
}

test('T_LANDING_PREFETCH_CREATES_SMALL_PATCH', () => {
  const f = fixture();
  try {
    const before = f.provider.plan(f.context);
    f.request();
    const demands = f.provider.plan(f.context), patch = f.patch(demands);
    assert.ok(patch.length >= 1 && patch.length <= 5);
    assert.ok(demands.length <= before.length + 5);
    assert.equal(new Set(patch.map(d => tileKeyToString(d.key))).size, patch.length);
    assert.ok(patch.every(d => d.key.kind === 'planet' && d.key.level === LANDING_PATCH_LEVEL));
    assert.equal(f.provider.readiness().landingCoverageReady, false);
  } finally { f.dispose(); }
});

test('T_LANDING_PREFETCH_MAX_FIVE_TILES', () => {
  const f = fixture();
  try {
    // Tile boundaries, cube-face edges and poles all keep the same fixed patch budget.
    for (const fixed of [[1, 0, 0], [1, 1, 0], [1, 1, 1], [0, 0, 1], [0, 0, -1], [-1, 0, 0]] as Vec3[]) {
      f.request(normalizeVec3(fixed));
      const patch = f.patch(f.provider.plan(f.context));
      assert.ok(patch.length >= 1 && patch.length <= 5, `${fixed}: ${patch.length} tiles`);
    }
  } finally { f.dispose(); }
});

test('T_LANDING_PREFETCH_IS_GAMEPLAY_CRITICAL', () => {
  const f = fixture();
  try {
    f.request();
    const demands = f.provider.plan(f.context), patch = f.patch(demands);
    assert.ok(patch.length > 0);
    assert.ok(patch.every(d => d.gameplayCritical && d.providerId === 'moon/surface'));
    assert.ok(demands.some(d => !d.gameplayCritical), 'visual refinement keeps its ordinary priority');
  } finally { f.dispose(); }
});

test('T_LANDING_PREFETCH_HAS_FINITE_CONTACT_ETA', () => {
  const f = fixture();
  try {
    // A stationary hold and a rapidly falling ETA must update even inside the plan cache interval.
    for (const eta of [4, 0.125, 0]) {
      f.request(direction, eta);
      const patch = f.patch(f.provider.plan(f.context));
      assert.ok(patch.length > 0);
      assert.ok(patch.every(d => Number.isFinite(d.timeToContactS) && d.timeToContactS === eta));
    }
  } finally { f.dispose(); }
});

test('T_LANDING_COVERAGE_IGNORES_UNRELATED_VISIBLE_TILES', async () => {
  const f = fixture('surface');
  try {
    f.request();
    const demands = f.provider.plan(f.context), patch = f.patch(demands);
    assert.ok(demands.length > patch.length);
    await f.load(patch.slice(0, -1));
    assert.equal(f.provider.readiness().landingCoverageReady, false);
    await f.load(patch.slice(-1));
    const ready = f.provider.readiness();
    assert.equal(ready.landingCoverageReady, true);
    assert.equal(ready.activeTiles, patch.length);
    assert.equal(ready.surfaceCoverageReady, false, 'ordinary under-observer refinement is a different patch');
    assert.ok(demands.some(d => !f.provider.globe.has(tileKeyToString(d.key))), 'unrelated horizon/far-side tiles remain unloaded');
  } finally { f.dispose(); }
});

test('T_LANDING_COVERAGE_REQUIRES_FALLBACK', async () => {
  const f = fixture();
  try {
    f.request();
    await f.load(f.patch(f.provider.plan(f.context)));
    assert.equal(f.provider.readiness().landingCoverageReady, true);
    f.provider.globe.releaseFallback();
    assert.equal(f.provider.readiness().landingPrefetchMissingKeys.length, 0);
    assert.equal(f.provider.readiness().landingCoverageReady, false);
    f.provider.globe.ensureFallback(MoonSurfaceGenerator);
    assert.equal(f.provider.readiness().landingCoverageReady, true);
  } finally { f.dispose(); }
});

test('T_LANDING_PREFETCH_BODY_FIXED', () => {
  const f = fixture();
  try {
    f.request();
    const first = f.patch(f.provider.plan(f.context));
    for (const demand of first) {
      assert.equal(demand.key.kind, 'planet');
      if (demand.key.kind !== 'planet') continue;
      const centre = tileCentreDirection({ bodyId: 'moon', face: demand.key.face as CubeFace,
        level: demand.key.level, x: demand.key.x, y: demand.key.y }, [0, 0, 0]);
      assert.ok(centre.reduce((dot, value, i) => dot + value * direction[i], 0) > 0.9999);
    }
    const bary = f.universe.frames.convertPosition('moon/fixed', 'solar-system/barycentric', f.context.spatial.player.position);
    const baryPose = pose('solar-system/barycentric', bary);
    const samePlace = { ...f.context, spatial: { ...f.context.spatial, timeS: 1, player: baryPose,
      frame: activeFrame(referenceFrame({ id: 'solar-system/barycentric', kind: 'system' }), baryPose) } };
    assert.deepEqual(f.patch(f.provider.plan(samePlace)).map(d => d.key), first.map(d => d.key));
  } finally { f.dispose(); }
});

test('T_LANDING_PREFETCH_SURVIVES_REBASE', async () => {
  const f = fixture();
  try {
    f.request();
    const first = f.patch(f.provider.plan(f.context));
    await f.load(first);
    f.universe.renderSpace.setOrigin(createRenderOrigin('moon/fixed', [1_500_000, 30_000, -40_000]));
    const rebased = { ...f.context, spatial: { ...f.context.spatial, timeS: 1 } };
    assert.deepEqual(f.patch(f.provider.plan(rebased)).map(d => d.key), first.map(d => d.key));
    assert.equal(f.provider.readiness().landingCoverageReady, true);
    assert.equal(f.provider.stats.tiles, first.length);
  } finally { f.dispose(); }
});

test('T_LANDING_PREFETCH_DOES_NOT_LOAD_WHOLE_MOON', async () => {
  const f = fixture();
  try {
    const visualCount = f.provider.plan(f.context).length;
    f.request();
    const demands = f.provider.plan(f.context), patch = f.patch(demands);
    assert.ok(visualCount <= 96 && demands.length <= 96 + 5);
    assert.ok(demands.length <= visualCount + 5);
    await f.load(patch);
    assert.ok(f.provider.stats.tiles <= 5);
    assert.equal(f.provider.globe.fallbackGroup.children.length, 6, 'only the fixed six-face fallback accompanies the patch');
    assert.equal(f.provider.readiness().landingCoverageReady, true);
  } finally { f.dispose(); }
});

test('T_LANDING_PREFETCH_CLEAR_RELEASES_REQUIREMENT', () => {
  const f = fixture();
  try {
    const ordinary = f.provider.plan(f.context).map(d => tileKeyToString(d.key));
    f.request();
    assert.ok(f.patch(f.provider.plan(f.context)).length > 0);
    f.provider.setLandingPrefetch(undefined);
    assert.deepEqual(f.provider.readiness().landingPrefetchKeys, []);
    assert.deepEqual(f.provider.readiness().landingPrefetchMissingKeys, []);
    assert.equal(f.provider.readiness().landingCoverageReady, false);
    assert.deepEqual(f.provider.plan(f.context).map(d => tileKeyToString(d.key)), ordinary);
  } finally { f.dispose(); }
});

test('Moon valid capture range already owns presentation, fallback and executable critical demands', async () => {
  const universe = new UniverseRuntime({ streaming: true, epochS: 0 });
  const providers = createPlanetProviders(new Group(), universe), moon = providers.get('moon')!;
  const layer = new CelestialBodyVisualLayer(), presentation = new CelestialPresentationController(layer);
  const range = landingCaptureRangeM(MOON.semiMajorAxisM);
  try {
    for (const fixed of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as Vec3[]) {
      for (const clearance of [range, range / 2, 10_000]) {
        const radius = planetSurfaceRadius(MoonSurfaceGenerator, fixed);
        const position = universe.frames.convertPosition('moon/fixed', 'solar-system/barycentric', fixed.map(v => v * (radius + clearance)) as Vec3);
        universe.updateSystemPose(position, [0, 0, 0], 0);
        assert.deepEqual(resolveLandingCandidate([{ id: 'moon', canLand: true, clearanceM: clearance,
          radiusM: MOON.semiMajorAxisM }], 'moon', 'moon'), { ok: true, bodyId: 'moon' });
        presentation.prepare({ universe, planetProviders: providers, fovRad: 1, viewportHeightPx: 1080 });
        assert.equal(presentation.physicalBodyId, 'moon');
        assert.notEqual(moon.presentationMode, 'off');
        assert.equal(moon.readiness().fallbackReady, true);
        assert.ok([...providers].filter(([id]) => id !== 'moon').every(([, p]) => p.presentationMode === 'off'));
        moon.setLandingPrefetch({ directionFixed: fixed, timeToContactS: 5 });
        for (let i = 0; i < 80 && !moon.readiness().landingCoverageReady; i++) {
          universe.updateStreaming(1 / 60);
          await Promise.resolve();
        }
        // Force planning once even if a previous patch was ready when the request changed.
        universe.updateStreaming(1 / 60);
        await Promise.resolve();
        for (let i = 0; i < 80 && !moon.readiness().landingCoverageReady; i++) {
          universe.updateStreaming(1 / 60);
          await Promise.resolve();
        }
        assert.equal(moon.readiness().landingCoverageReady, true, `${fixed} at ${clearance} m`);
      }
    }
    universe.updateSystemPose([0, 0, 1e13], [0, 0, 0], 0);
    presentation.prepare({ universe, planetProviders: providers, fovRad: 1, viewportHeightPx: 1080 });
    assert.equal(presentation.physicalBodyId, undefined);
    assert.ok([...providers.values()].every(p => p.presentationMode === 'off' && !p.readiness().fallbackReady));
  } finally { universe.dispose(); layer.dispose(); for (const p of providers.values()) p.globe.dispose(); }
});

test('An off provider never enables a distant physical Moon merely because prefetch was requested', () => {
  const f = fixture('off');
  try {
    f.request();
    assert.deepEqual(f.provider.plan(f.context), []);
    assert.equal(f.provider.covers(f.context.spatial), false);
    assert.equal(f.provider.readiness().fallbackReady, false);
    assert.equal(f.provider.readiness().landingCoverageReady, false);
  } finally { f.dispose(); }
});

test('Invalid non-finite landing ETA never enters streaming priority', () => {
  const f = fixture();
  try {
    for (const eta of [Infinity, NaN, -Infinity]) {
      f.request(direction, 1);
      assert.ok(f.patch(f.provider.plan(f.context)).length > 0);
      f.request(direction, eta);
      assert.equal(f.patch(f.provider.plan(f.context)).length, 0);
      assert.equal(f.provider.readiness().landingCoverageReady, false);
    }
  } finally { f.dispose(); }
});
