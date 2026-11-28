import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Vector3 } from 'three/webgpu';
import { WORLD } from '../src/core/config';
import { ChunkState } from '../src/world/chunks/Chunk';
import { MAX_PREFETCH_LEAD_M, planChunks, streamingReach } from '../src/world/streaming/ChunkPriority';
import { chunkWorkerCount } from '../src/world/streaming/GenerationPool';
import { SampleWindow, StreamingDiagnostics } from '../src/world/streaming/StreamingDiagnostics';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';

const size = WORLD.chunkSize;
const centre = (value: number) => (value + .5) * size;

/** Drives a real streamer without a GPU: canvas textures are stubbed and generation runs in-process. */
async function withStreamer(run: (streamer: WorldStreamer, frames: (count: number, position: Vector3, velocity: Vector3) => Promise<void>) => Promise<void>) {
  const previousDocument = globalThis.document;
  const context = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  const streamer = new WorldStreamer(new Group());
  try {
    await run(streamer, async (count, position, velocity) => {
      for (let frame = 0; frame < count; frame++) {
        streamer.update(position, velocity, .05);
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    });
  } finally {
    streamer.dispose();
    globalThis.document = previousDocument;
  }
}

test('the detail disk shrinks only when speed outruns activation and the look-ahead follows time to arrive', () => {
  assert.deepEqual(streamingReach(0, 480), { radius: 480, leadM: 0 });
  assert.deepEqual(streamingReach(6, 480), { radius: 480, leadM: 0 });
  assert.deepEqual(streamingReach(300, 480), { radius: 480, leadM: 300 * WORLD.prefetchSeconds });
  const fast = streamingReach(3_000, 480);
  assert.ok(fast.radius > size && fast.radius < 240, `${fast.radius} m`);
  assert.equal(fast.leadM, MAX_PREFETCH_LEAD_M);
  assert.deepEqual(streamingReach(1e6, 480), { radius: size, leadM: MAX_PREFETCH_LEAD_M });
  assert.deepEqual(streamingReach(Number.NaN, 480), { radius: 480, leadM: 0 });
});

test('requests are ordered by need: ground underfoot, then the flight corridor, then the rest', () => {
  const position = { x: 64, z: 64 };
  const plan = planChunks(position, { x: 300, z: 0 }, WORLD.detailRadius);
  const rank = new Map(plan.map((demand, index) => [demand.key, index]));
  assert.equal(plan[0].key, '0,0');
  const distance = (d: { cx: number; cz: number }) => Math.hypot(centre(d.cx) - position.x, centre(d.cz) - position.z);
  // Ahead of the player, on the flight line, within the prefetch window.
  const corridor = plan.filter(d => centre(d.cx) > position.x + 200 && centre(d.cx) - position.x <= 300 * WORLD.prefetchSeconds
    && Math.abs(centre(d.cz) - position.z) < size);
  const behind = plan.filter(d => d.immediate && centre(d.cx) < position.x - 200);
  assert.ok(corridor.length >= 4 && corridor.some(d => !d.immediate), 'the corridor reaches past the detail disk');
  assert.ok(behind.length > 0);
  assert.ok(Math.max(...corridor.map(d => rank.get(d.key)!)) < Math.min(...behind.map(d => rank.get(d.key)!)),
    'every chunk the player is about to cross is requested before those left behind');
  const underfoot = plan.filter(d => distance(d) <= size * 1.5);
  assert.ok(underfoot.every(d => rank.get(d.key)! < underfoot.length), 'collision ground always comes first');
});

test('a chunk inside the detail disk stays immediate even when a look-ahead disk ranks it higher', () => {
  for (const speed of [40, 120, 300, 900]) {
    const plan = planChunks({ x: 10, z: -30 }, { x: speed, z: speed * .3 }, WORLD.detailRadius);
    const still = new Set(planChunks({ x: 10, z: -30 }, { x: 0, z: 0 }, streamingReach(Math.hypot(speed, speed * .3), WORLD.detailRadius).radius)
      .map(d => d.key));
    for (const demand of plan) if (still.has(demand.key)) assert.ok(demand.immediate, `${demand.key} at ${speed} m/s lost its place in the disk`);
  }
});

test('a plan never asks for more than the streamer can keep, at any speed', () => {
  for (const speed of [0, 20, 80, 300, 1_200, 3_000, 10_000, 100_000]) {
    for (const radius of [WORLD.chunkSize, 390, WORLD.detailRadius, 900]) {
      const plan = planChunks({ x: 33, z: -71 }, { x: speed * .6, z: -speed * .8 }, radius);
      assert.ok(plan.filter(d => d.immediate).length <= WORLD.maxActiveChunks, `${speed} m/s, ${radius} m`);
      assert.ok(plan.filter(d => !d.immediate).length < WORLD.maxCachedChunks, `${speed} m/s, ${radius} m`);
      assert.ok(plan.every(d => Number.isFinite(d.priority)));
    }
  }
});

test('a steady fast plan stops generating once everything it asks for is resident', async () => {
  await withStreamer(async (streamer, frames) => {
    const position = new Vector3(0, 60, 0), velocity = new Vector3(1_200, 0, 0);
    await frames(150, position, velocity);
    const settled = streamer.diagnostics.counts.generated;
    await frames(60, position, velocity);
    assert.equal(streamer.diagnostics.counts.generated, settled, 'no chunk is regenerated just to be evicted again');
  });
});

test('streaming records latency, cancellations, discards and coverage after a region change', async () => {
  await withStreamer(async (streamer, frames) => {
    const origin = new Vector3(0, 60, 0);
    await streamer.prepare(origin);
    await frames(60, origin, new Vector3());
    const { diagnostics } = streamer;
    assert.ok(diagnostics.counts.activated >= 9);
    assert.ok(diagnostics.counts.requested >= diagnostics.counts.generated);
    assert.equal(diagnostics.counts.failed, 0);
    assert.ok(diagnostics.summary('latency').count >= 9 && diagnostics.summary('generation').count > 0 && diagnostics.summary('build').count > 0);
    assert.ok(diagnostics.physicalCoverageMs !== null && diagnostics.detailCoverageMs !== null);
    assert.ok(diagnostics.physicalCoverageMs! <= diagnostics.detailCoverageMs!);

    // Leaving and coming back is served from the cache while the data is still resident.
    const reused = diagnostics.counts.reused;
    await frames(20, new Vector3(260, 60, 0), new Vector3());
    await frames(20, origin, new Vector3());
    assert.ok(diagnostics.counts.reused > reused, 'returning chunks are cache hits');

    // A dash leaves queued work behind before it ever reaches a worker.
    const cancelled = diagnostics.counts.cancelled;
    for (let step = 1; step <= 6; step++) streamer.update(new Vector3(step * 4_000, 60, 0), new Vector3(), .2);
    assert.ok(diagnostics.counts.cancelled > cancelled);

    // A region change discards what was in flight and restarts the coverage clocks. The widest
    // quality preset asks for more than the active set holds, and still reaches detail coverage.
    streamer.setDetailRadius(600);
    streamer.update(new Vector3(0, 60, 9_000), new Vector3(), .2);
    const discarded = diagnostics.counts.discarded;
    streamer.setRegion({ bodyId: 'earth', isManaus: false, latDeg: -15.79, lonDeg: -47.88 });
    assert.equal(diagnostics.physicalCoverageMs, null);
    await streamer.prepare(origin);
    await frames(80, origin, new Vector3());
    assert.ok(diagnostics.counts.discarded > discarded, 'stale generation results are discarded, never drawn');
    assert.ok(diagnostics.physicalCoverageMs !== null && diagnostics.detailCoverageMs !== null);
    assert.ok(streamer.stats.active <= WORLD.maxActiveChunks);
  });
});

test('distant representations keep drawing wherever detailed tiles are not resident yet', async () => {
  await withStreamer(async (streamer, frames) => {
    streamer.setRegion({ bodyId: 'earth', isManaus: false, latDeg: -15.79, lonDeg: -47.88 });
    const position = new Vector3(5, 0, -3);
    assert.equal(streamer.coveredSurfaceRadiusM(position.x, position.z, streamer.detailRadiusM), 0);
    await streamer.prepare(position);
    const afterPrepare = streamer.coveredSurfaceRadiusM(position.x, position.z, streamer.detailRadiusM);
    assert.ok(afterPrepare >= size / 2 && afterPrepare < streamer.detailRadiusM, `${afterPrepare} m right after arriving`);
    await frames(80, position, new Vector3());
    const settled = streamer.coveredSurfaceRadiusM(position.x, position.z, streamer.detailRadiusM);
    assert.ok(settled >= streamer.detailRadiusM - size / 2, `${settled} m once settled`);
    const record = [...(streamer as unknown as { records: Map<string, { state: ChunkState }> }).records.values()];
    assert.ok(record.some(chunk => chunk.state === ChunkState.ACTIVE));
  });
});

test('workers follow the machine without ever dropping below two or above the request limit', () => {
  assert.deepEqual([1, 2, 4, 6, 8, 12, 16, 64].map(chunkWorkerCount), [2, 2, 2, 2, 3, 4, 4, 4]);
  assert.equal(chunkWorkerCount(Number.NaN), 2);
  assert.ok(WORLD.maxRequests === 4);
});

test('sample windows report nearest-rank percentiles over the most recent samples only', () => {
  const window = new SampleWindow(100);
  assert.deepEqual(window.summary(), { count: 0, p50: 0, p95: 0, p99: 0 });
  for (let i = 1; i <= 100; i++) window.add(i);
  assert.deepEqual(window.summary(), { count: 100, p50: 50, p95: 95, p99: 99 });
  window.add(-1); window.add(Number.NaN);
  assert.equal(window.summary().count, 100);
  for (let i = 0; i < 100; i++) window.add(7);
  assert.deepEqual(window.summary(), { count: 100, p50: 7, p95: 7, p99: 7 });
  const diagnostics = new StreamingDiagnostics();
  diagnostics.recordCoverage(5, true, true);
  assert.equal(diagnostics.physicalCoverageMs, null, 'nothing is timed before a region starts');
  diagnostics.startRegion(10);
  diagnostics.recordCoverage(30, true, false);
  diagnostics.recordCoverage(90, true, true);
  assert.deepEqual([diagnostics.physicalCoverageMs, diagnostics.detailCoverageMs], [20, 80]);
  assert.equal(diagnostics.awaitingCoverage, false);
});
