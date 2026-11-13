import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EarthTransitionController,
  EARTH_HANDOFF,
} from '../src/world/providers/EarthTransitionController';
import type { EarthCoverageReadiness } from '../src/world/providers/EarthCoverageReadiness';

function readyEarthProvider(ready = true): any {
  return {
    readiness: (lod: number): EarthCoverageReadiness => ({
      requestedKeys: ['earth:0,0'],
      requiredKeys: ['earth:0,0'],
      activeRequiredKeys: ready ? ['earth:0,0'] : [],
      missingRequiredKeys: ready ? [] : ['earth:0,0'],
      coverageRatio: ready ? 1 : 0,
      coarseFallbackReady: ready,
      detailedCoverageReady: ready,
      coverageSource: ready ? 'detailed' : 'none',
      viewCoverageReady: ready,
      targetLod: lod,
    }),
  };
}

test('T_EARTH_TRANS_01_LOCAL_BAND_0_TO_8KM', () => {
  const controller = new EarthTransitionController();
  const earth = readyEarthProvider(true);
  const altitudes = [0, 50, 1000, 4000, 7999];

  for (const alt of altitudes) {
    const state = controller.update(alt, earth, true);
    assert.equal(state.localWeight, 1.0, `At ${alt}m localWeight must be 1.0`);
    assert.equal(state.regionalWeight, 0.0, `At ${alt}m regionalWeight must be 0.0`);
    assert.equal(state.planetWeight, 0.0, `At ${alt}m planetWeight must be 0.0`);
    assert.equal(state.atmosphereWeight, 1.0, `At ${alt}m atmosphereWeight must be 1.0`);
    assert.equal(state.phase, 'LOCAL_ONLY');
    assert.equal(state.groundOwner, 'local');
    assert.equal(state.localGroundVisible, true);
    assert.equal(state.presentationDomain, 'local');
  }
});

test('T_EARTH_TRANS_02_CROSSFADE_BAND_8_TO_15KM', () => {
  const controller = new EarthTransitionController();
  const earth = readyEarthProvider(true);
  const state11_5k = controller.update(11_500, earth, true);

  // At 11.5 km (midpoint between 8 km and 15 km)
  assert.ok(Math.abs(state11_5k.localWeight - 0.5) < 1e-4, 'localWeight at 0.5');
  assert.ok(Math.abs(state11_5k.planetWeight - 0.5) < 1e-4, 'planetWeight at 0.5');
  assert.equal(state11_5k.phase, 'OVERLAP_SAFE');
  assert.equal(state11_5k.presentationDomain, 'planetary');
  // Invariant: sum of weights is exactly 1.0
  assert.ok(
    Math.abs(state11_5k.localWeight + state11_5k.planetWeight - 1.0) < 1e-4,
    'local + planet must equal 1.0 (zero gap)'
  );
});

test('T_EARTH_TRANS_03_PLANETARY_DOMINANT_15_TO_60KM', () => {
  const controller = new EarthTransitionController();
  const earth = readyEarthProvider(true);
  controller.update(10_000, earth, true);
  controller.update(16_000, earth, true);
  const state40k = controller.update(40_000, earth, true);

  assert.equal(state40k.localWeight, 0, 'Local street mesh retired above 15km');
  assert.equal(state40k.planetWeight, 1.0, 'Planet globe at full weight');
  assert.ok(state40k.atmosphereWeight < 1.0, 'Atmosphere thins continuously');
  assert.equal(state40k.phase, 'PLANET_DOMINANT');
  assert.equal(state40k.groundOwner, 'planet');
});

test('T_EARTH_TRANS_04_ORBITAL_BAND_ABOVE_60KM', () => {
  const controller = new EarthTransitionController();
  const earth = readyEarthProvider(true);
  controller.update(10_000, earth, true);
  controller.update(16_000, earth, true);
  const state80k = controller.update(80_000, earth, true);

  assert.equal(state80k.localWeight, 0);
  assert.equal(state80k.planetWeight, 1.0, 'Planet at full 1.0 weight');
  assert.equal(state80k.phase, 'PLANET_ONLY');
  assert.equal(state80k.presentationDomain, 'orbital');

  // At 120 km (above Karman line), atmosphere drops to 0
  const state120k = controller.update(120_000, earth, true);
  assert.equal(state120k.atmosphereWeight, 0, 'Atmosphere reaches full vacuum in orbit');
});

test('T_EARTH_TRANS_05_NO_BLACK_GROUND_INVARIANT', () => {
  const controller = new EarthTransitionController();
  const earth = readyEarthProvider(true);
  // Sample altitudes from 0 to 400,000m (ISS orbit)
  const altitudes = [
    0, 100, 500, 1000, 2000, 5000, 8000, 10000, 11500, 12000, 14000, 15000, 16000,
    18000, 20000, 25000, 30000, 45000, 60000, 80000, 100000, 200000, 400000
  ];

  for (const alt of altitudes) {
    const state = controller.update(alt, earth, true);
    // At every altitude, at least one visual surface representation is active
    const surfaceCoverage = state.localWeight + state.planetWeight;
    assert.ok(
      surfaceCoverage >= 0.99,
      `At altitude ${alt}m surface coverage (${surfaceCoverage}) must be >= 0.99 (no black ground)`
    );
    assert.ok(
      state.localGroundVisible || state.planetGroundDominant,
      `At altitude ${alt}m exactly one ground owner must be dominant`
    );
  }
});

test('T_EARTH_TRANS_06_READINESS_GATE_PRESERVES_FALLBACK', () => {
  const controller = new EarthTransitionController();
  // Regional / planet presentation is NOT ready (targetCoverageReady = false)
  const unready = controller.update(16_000, undefined, false);

  assert.equal(unready.targetCoverageReady, false);
  assert.equal(unready.localWeight, 1.0, 'Must keep localWeight at 1.0 when target is not ready');
  assert.equal(unready.planetWeight, 0.0, 'Must not blend to planet before target is ready');
  assert.equal(unready.groundOwner, 'local', 'Must retain local ground ownership');
  assert.equal(unready.phase, 'REQUESTING_PLANET');
});

test('T_EARTH_TRANS_07_GROUND_OWNER_HYSTERESIS', () => {
  const controller = new EarthTransitionController();
  const earth = readyEarthProvider(true);

  // 1. Ascend to 14 km (between returnLocalM=13km and planetOwnsGroundM=15km)
  const s1 = controller.update(14_000, earth, true);
  assert.equal(s1.groundOwner, 'local', 'Ascending below 15km keeps local owner');

  // 2. Cross 15 km threshold
  const s2 = controller.update(16_000, earth, true);
  assert.equal(s2.groundOwner, 'planet', 'Crossing 15km switches owner to planet');

  // 3. Hover / descend slightly to 14 km
  const s3 = controller.update(14_000, earth, true);
  assert.equal(s3.groundOwner, 'planet', 'Hysteresis keeps planet owner at 14km on descent');

  // 4. Descend below 13 km
  const s4 = controller.update(12_000, earth, true);
  assert.equal(s4.groundOwner, 'local', 'Descending below 13km switches back to local owner');
});
