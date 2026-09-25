import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderRegistry } from '../src/world/runtime/ProviderRegistry.ts';
import type {
  CoverageClaim, SpatialContext, StreamingContext, WorldProvider,
} from '../src/world/providers/WorldProvider.ts';
import { regionContains } from '../src/world/providers/WorldProvider.ts';
import { GlobalStreamingScheduler } from '../src/world/streaming/GlobalStreamingScheduler.ts';
import { TileCache } from '../src/world/streaming/TileCache.ts';
import { PrefetchPredictor } from '../src/world/streaming/PrefetchPredictor.ts';
import {
  DEFAULT_STREAMING_BUDGET, StreamingLedger, budgetForSpeed,
} from '../src/world/streaming/StreamingBudget.ts';
import {
  type ActiveTile, type TileDemand, type TilePayload, type WorldTileKey,
  tileDemand, tileKeyToString,
} from '../src/world/streaming/TileDemand.ts';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

const FRAME = referenceFrame({ id: 'test/local', kind: 'render-local' });
const ACTIVE = activeFrame(FRAME, pose('test/local'));

function manausKey(tx: number, tz: number): WorldTileKey { return { kind: 'manaus', tx, tz }; }

function context(overrides: {
  position?: Vec3; velocity?: Vec3; budget?: typeof DEFAULT_STREAMING_BUDGET;
} = {}): StreamingContext {
  const spatial: SpatialContext = {
    timeS: 0,
    player: pose('test/local', overrides.position ?? [0, 0, 0]),
    frame: ACTIVE,
    localVelocityMps: overrides.velocity ?? [0, 0, 0],
  };
  return {
    spatial,
    camera: { fovRad: 1.0, viewportHeightPx: 1080, forward: [0, 0, -1] },
    quality: { sseTargetPx: 8, detailFactor: 1 },
    budget: overrides.budget ?? DEFAULT_STREAMING_BUDGET,
  };
}

interface FakeOptions {
  id?: string;
  priority?: number;
  tiles?: number;
  bytes?: number;
  failKeys?: Set<string>;
  claims?: readonly CoverageClaim[];
  /** Held promises, so a test can decide when a load resolves. */
  manual?: boolean;
}

/** A provider that records what happened to it, so tests can assert on behaviour not internals. */
class FakeProvider implements WorldProvider {
  readonly id: string;
  readonly priority: number;
  readonly loads: string[] = [];
  readonly activations: string[] = [];
  readonly deactivations: string[] = [];
  readonly aborted: string[] = [];
  private readonly pending = new Map<string, (payload: TilePayload) => void>();
  private options: FakeOptions;

  constructor(options: FakeOptions = {}) {
    this.options = options;
    this.id = options.id ?? 'fake';
    this.priority = options.priority ?? 100;
  }

  coverage(): readonly CoverageClaim[] { return this.options.claims ?? []; }
  covers(): boolean { return true; }

  /** Lets a test shrink what the provider wants without swapping the instance out. */
  setTileCount(count: number): void { this.options = { ...this.options, tiles: count }; }

  plan(): readonly TileDemand[] {
    const count = this.options.tiles ?? 3;
    const demands: TileDemand[] = [];
    for (let i = 0; i < count; i++) {
      demands.push(tileDemand({
        key: manausKey(i, 0), providerId: this.id,
        geometricErrorM: 10, distanceM: 100 * (i + 1), timeToContactS: Number.POSITIVE_INFINITY,
        gameplayCritical: false, representation: 'near', screenSpaceError: 16,
        centreM: [100 * (i + 1), 0, 0],
      }));
    }
    return demands;
  }

  load(demand: TileDemand, signal: AbortSignal): Promise<TilePayload> {
    const id = tileKeyToString(demand.key);
    this.loads.push(id);
    if (this.options.failKeys?.has(id)) return Promise.reject(new Error(`no such tile ${id}`));
    const payload: TilePayload = {
      key: demand.key, version: 1,
      cpuBytes: this.options.bytes ?? 1024,
      estimatedGpuBytes: this.options.bytes ?? 1024,
    };
    signal.addEventListener('abort', () => { this.aborted.push(id); });
    if (!this.options.manual) return Promise.resolve(payload);
    return new Promise(resolve => { this.pending.set(id, resolve); });
  }

  /** Resolves a held load, for testing what happens to results that arrive late. */
  release(key: WorldTileKey): void {
    const id = tileKeyToString(key);
    const resolve = this.pending.get(id);
    if (!resolve) return;
    this.pending.delete(id);
    resolve({ key, version: 1, cpuBytes: this.options.bytes ?? 1024, estimatedGpuBytes: this.options.bytes ?? 1024 });
  }

  activate(payload: TilePayload): ActiveTile {
    const id = tileKeyToString(payload.key);
    this.activations.push(id);
    return { key: payload.key, providerId: this.id, payload, representation: 'near', dispose: () => undefined };
  }

  deactivate(tile: ActiveTile): void { this.deactivations.push(tileKeyToString(tile.key)); }
}

/** Lets queued promise callbacks run, which is where the scheduler applies finished loads. */
const settle = async (): Promise<void> => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

test('the registry orders providers by fidelity and resolves who owns a place', () => {
  const registry = new ProviderRegistry();
  const region = { bodyId: 'earth', minLatDeg: -3.2, maxLatDeg: -3.0, minLonDeg: -60.1, maxLonDeg: -59.9 };
  const authored = new FakeProvider({
    id: 'earth/manaus/largo', priority: 300,
    claims: [{ providerId: 'earth/manaus/largo', priority: 300, region, channels: ['buildings', 'landmarks'] }],
  });
  const city = new FakeProvider({
    id: 'earth/manaus', priority: 200,
    claims: [{ providerId: 'earth/manaus', priority: 200, region, channels: ['buildings', 'roads'] }],
  });
  const planet = new FakeProvider({ id: 'earth/terrain', priority: 10 });
  registry.register(city).register(planet).register(authored);

  assert.deepEqual(registry.all.map(p => p.id), ['earth/manaus/largo', 'earth/manaus', 'earth/terrain']);

  // Inside the claimed region the authored source owns buildings; the city keeps roads.
  assert.equal(registry.ownerOf('earth', -3.13, -60.02, 'buildings'), 'earth/manaus/largo');
  assert.equal(registry.ownerOf('earth', -3.13, -60.02, 'roads'), 'earth/manaus');
  // This is the planetary form of `replacesChunk`: generic terrain must stand down here.
  assert.equal(registry.maySupply('earth/terrain', 'earth', -3.13, -60.02, 'buildings'), false);
  assert.equal(registry.maySupply('earth/manaus/largo', 'earth', -3.13, -60.02, 'buildings'), true);
  // And outside it, nobody has claimed anything, so a generic provider may fill in.
  assert.equal(registry.ownerOf('earth', 10, 10, 'buildings'), undefined);
  assert.equal(registry.maySupply('earth/terrain', 'earth', 10, 10, 'buildings'), true);
  // A claim on Earth must never shadow the same place on another body.
  assert.equal(registry.maySupply('moon/terrain', 'moon', -3.13, -60.02, 'buildings'), true);

  assert.throws(() => registry.register(new FakeProvider({ id: 'earth/manaus' })), /already registered/);
});

test('a coverage region handles the antimeridian instead of silently excluding it', () => {
  const across = { bodyId: 'earth', minLatDeg: -10, maxLatDeg: 10, minLonDeg: 170, maxLonDeg: -170 };
  assert.equal(regionContains(across, 0, 175), true);
  assert.equal(regionContains(across, 0, -175), true);
  assert.equal(regionContains(across, 0, 0), false);
  assert.equal(regionContains(across, 40, 175), false);
  const normal = { bodyId: 'earth', minLatDeg: -10, maxLatDeg: 10, minLonDeg: -20, maxLonDeg: 20 };
  assert.equal(regionContains(normal, 0, 0), true);
  assert.equal(regionContains(normal, 0, 100), false);
});

test('the scheduler loads and activates within budget, and never all at once', async () => {
  const registry = new ProviderRegistry();
  const provider = new FakeProvider({ tiles: 10 });
  registry.register(provider);
  const scheduler = new GlobalStreamingScheduler(registry);

  const budget = { ...DEFAULT_STREAMING_BUDGET, maxActivationsPerFrame: 2, maxConcurrentFetches: 4 };
  scheduler.update(context({ budget }), 1 / 60);
  await settle();
  // Fetching is capped, so ten wanted tiles do not become ten simultaneous loads.
  assert.ok(provider.loads.length <= 4, `started ${provider.loads.length} fetches at once`);

  scheduler.update(context({ budget }), 1 / 60);
  await settle();
  assert.ok(scheduler.stats.activationsLastFrame <= 2, 'activation budget must hold');

  // Given enough frames everything wanted does arrive — the budget delays work, never drops it.
  for (let frame = 0; frame < 20; frame++) {
    scheduler.update(context({ budget }), 1 / 60);
    await settle();
  }
  assert.equal(scheduler.stats.active, 10, 'every demanded tile should end up active');
  assert.equal(provider.activations.length, 10);
});

test('a result that arrives after the world moved on is dropped, not applied', async () => {
  const registry = new ProviderRegistry();
  const provider = new FakeProvider({ tiles: 1, manual: true });
  registry.register(provider);
  const scheduler = new GlobalStreamingScheduler(registry);

  scheduler.update(context(), 1 / 60);
  await settle();
  assert.equal(scheduler.stats.fetching, 1, 'the load is in flight');

  // A teleport: everything being fetched is now somewhere the player is not.
  scheduler.invalidate();
  assert.deepEqual(provider.aborted, ['manaus:0,0'], 'the in-flight fetch must be aborted');

  // The provider resolves anyway, as a real fetch that was already on the wire would.
  provider.release(manausKey(0, 0));
  await settle();
  assert.equal(provider.activations.length, 0, 'a stale payload must never reach the world');
});

test('a tile nobody wants any more is deactivated and its provider is told', async () => {
  const registry = new ProviderRegistry();
  const provider = new FakeProvider({ tiles: 2 });
  registry.register(provider);
  const scheduler = new GlobalStreamingScheduler(registry);

  for (let frame = 0; frame < 6; frame++) { scheduler.update(context(), 1 / 60); await settle(); }
  assert.equal(scheduler.stats.active, 2);

  // The provider stops asking for the second tile.
  provider.setTileCount(1);
  scheduler.update(context(), 1 / 60);
  await settle();
  assert.deepEqual(provider.deactivations, ['manaus:1,0'], 'the dropped tile must be taken back out');
});

test('a failing tile is retried a few times and then left alone rather than storming', async () => {
  const registry = new ProviderRegistry();
  const provider = new FakeProvider({ tiles: 2, failKeys: new Set(['manaus:1,0']) });
  registry.register(provider);
  const scheduler = new GlobalStreamingScheduler(registry, { maxFailures: 3 });

  for (let frame = 0; frame < 30; frame++) { scheduler.update(context(), 1 / 60); await settle(); }

  const attempts = provider.loads.filter(id => id === 'manaus:1,0').length;
  assert.ok(attempts >= 2 && attempts <= 3, `retried ${attempts} times`);
  // The healthy neighbour is unaffected: one bad tile is a gap, not an outage.
  assert.equal(scheduler.stats.active, 1);
  assert.ok(provider.activations.includes('manaus:0,0'));
});

test('the cache keeps what was recently used and lets go of what was not', () => {
  const cache = new TileCache({ maxCpuBytes: 3000, maxEntries: 10 });
  const payload = (tx: number, bytes: number): TilePayload =>
    ({ key: manausKey(tx, 0), version: 1, cpuBytes: bytes, estimatedGpuBytes: bytes });

  cache.set(payload(0, 1000));
  cache.tick(1);
  cache.set(payload(1, 1000));
  cache.tick(1);
  // Touching tile 0 makes tile 1 the least recently used.
  assert.ok(cache.get(manausKey(0, 0)));
  cache.tick(1);
  cache.set(payload(2, 1500));

  assert.ok(cache.has(manausKey(0, 0)), 'the recently used tile survives');
  assert.equal(cache.has(manausKey(1, 0)), false, 'the idle one is evicted');
  assert.ok(cache.stats.cpuBytes <= 3000);
  assert.ok(cache.stats.evictions >= 1);
});

test('a pinned tile survives whatever else happens, which is what teleport destinations need', () => {
  const cache = new TileCache({ maxCpuBytes: 2000, maxEntries: 4 });
  const payload = (tx: number): TilePayload =>
    ({ key: manausKey(tx, 0), version: 1, cpuBytes: 900, estimatedGpuBytes: 900 });

  cache.set(payload(0));
  cache.pin(manausKey(0, 0));
  for (let i = 1; i < 8; i++) { cache.tick(1); cache.set(payload(i)); }

  assert.ok(cache.has(manausKey(0, 0)), 'a pinned tile must never be evicted');
  assert.equal(cache.isPinned(manausKey(0, 0)), true);
  cache.unpin(manausKey(0, 0));
  cache.tick(1);
  for (let i = 8; i < 14; i++) { cache.tick(1); cache.set(payload(i)); }
  assert.equal(cache.has(manausKey(0, 0)), false, 'and must be evictable again once released');

  // A payload larger than the whole budget is refused rather than emptying the cache for nothing.
  assert.equal(cache.set({ key: manausKey(99, 0), version: 1, cpuBytes: 1e9, estimatedGpuBytes: 1e9 }), false);
});

test('the ledger refuses work once the frame or the memory budget is spent', () => {
  class TestLedger extends StreamingLedger {
    private fake = 0;
    advance(ms: number): void { this.fake += ms; }
    protected override nowMs(): number { return this.fake; }
  }
  const ledger = new TestLedger({ ...DEFAULT_STREAMING_BUDGET, mainThreadMs: 4, maxActivationsPerFrame: 2 });
  ledger.beginFrame();
  assert.equal(ledger.canActivate(1000), true);
  ledger.activated(1000, 1000);
  ledger.activated(1000, 1000);
  assert.equal(ledger.canActivate(1000), false, 'the activation count is a hard cap');

  ledger.beginFrame();
  ledger.advance(5);
  assert.equal(ledger.hasFrameTime, false, 'and so is the frame time');
  assert.equal(ledger.canActivate(1), false);

  // The hard memory ceiling refuses outright; the soft one only asks the cache to start trimming.
  const memory = new TestLedger({ ...DEFAULT_STREAMING_BUDGET, gpuMemorySoftBytes: 1000, gpuMemoryHardBytes: 2000 });
  memory.beginFrame();
  memory.activated(0, 1500);
  assert.equal(memory.shouldEvict, true);
  assert.equal(memory.canActivate(600), false);
  memory.deactivated(0, 1500);
  assert.equal(memory.shouldEvict, false);
  assert.equal(memory.gpuBytes, 0);
});

test('speed reshapes the budget toward reaching ahead instead of refining underfoot', () => {
  const base = DEFAULT_STREAMING_BUDGET;
  assert.deepEqual(budgetForSpeed(base, 0), base, 'standing still changes nothing');
  assert.deepEqual(budgetForSpeed(base, 200), base);

  const fast = budgetForSpeed(base, 2400);
  assert.ok(fast.maxConcurrentFetches > base.maxConcurrentFetches, 'more in flight, to cover ground');
  assert.ok(fast.maxActivationsPerFrame <= base.maxActivationsPerFrame, 'less put in per frame');
  assert.ok(fast.gpuUploadBytesPerFrame < base.gpuUploadBytesPerFrame, 'and less uploaded per frame');
  assert.ok(fast.maxConcurrentFetches <= 16, 'bounded, not unbounded');
});

test('prefetch leads where the player is going, and further the faster they travel', () => {
  const predictor = new PrefetchPredictor({ leadSecondsBase: 1.6, leadSecondsMax: 6, smoothing: 0.01 });

  // Standing still, the lead point is the player.
  let lead = predictor.update([0, 0, 0], [0, 0, 0], 1 / 60);
  assert.ok(Math.hypot(...lead) < 1e-6);

  // Flying, it runs ahead along the heading.
  for (let i = 0; i < 120; i++) lead = predictor.update([0, 0, 0], [0, 0, -120], 1 / 60);
  assert.ok(lead[2] < -100, `lead should be ahead on -Z, got ${lead[2]}`);
  const slowLead = Math.hypot(...lead);

  for (let i = 0; i < 240; i++) lead = predictor.update([0, 0, 0], [0, 0, -2400], 1 / 60);
  assert.ok(Math.hypot(...lead) > slowLead * 5, 'a faster player needs far more warning');

  // The lead is capped, so a teleport-speed velocity does not request a continent.
  const capped = new PrefetchPredictor({ maxLeadM: 5000, smoothing: 0.01 });
  for (let i = 0; i < 240; i++) lead = capped.update([0, 0, 0], [0, 0, -1e6], 1 / 60);
  assert.ok(Math.hypot(...lead) <= 5000 + 1e-6, `lead reached ${Math.hypot(...lead)}`);

  // And what is behind the player is worth less than what is in front of them.
  assert.ok(capped.relevance([0, 0, -1000]) > 0.9);
  assert.ok(capped.relevance([0, 0, 1000]) < 0.1);
});

test('what is ahead outranks what is behind, and gameplay-critical outranks both', async () => {
  const registry = new ProviderRegistry();

  class DirectionalProvider extends FakeProvider {
    override plan(): readonly TileDemand[] {
      return [
        tileDemand({
          key: manausKey(1, 0), providerId: this.id, geometricErrorM: 10, distanceM: 4000,
          timeToContactS: Number.POSITIVE_INFINITY, gameplayCritical: false,
          representation: 'near', screenSpaceError: 16, centreM: [0, 0, -4000],
        }),
        tileDemand({
          key: manausKey(2, 0), providerId: this.id, geometricErrorM: 10, distanceM: 1000,
          timeToContactS: Number.POSITIVE_INFINITY, gameplayCritical: false,
          representation: 'near', screenSpaceError: 16, centreM: [0, 0, 1000],
        }),
        tileDemand({
          key: manausKey(3, 0), providerId: this.id, geometricErrorM: 1, distanceM: 9000,
          timeToContactS: Number.POSITIVE_INFINITY, gameplayCritical: true,
          representation: 'active', screenSpaceError: 1, centreM: [0, 0, 9000],
        }),
      ];
    }
  }
  registry.register(new DirectionalProvider({ id: 'directional' }));

  const scheduler = new GlobalStreamingScheduler(registry, {
    predictor: new PrefetchPredictor({ smoothing: 0.01 }),
  });
  // Flying along -Z, so tile 1 is ahead and tile 2 is behind despite being four times closer.
  const flying = context({ velocity: [0, 0, -400] });
  for (let i = 0; i < 40; i++) scheduler.prefetch.update([0, 0, 0], [0, 0, -400], 1 / 60);

  const provider = registry.get('directional') as DirectionalProvider;
  scheduler.update(flying, 1 / 60);
  await settle();

  // The critical tile is fetched first even though it is the furthest and the least detailed.
  assert.equal(provider.loads[0], 'manaus:3,0', `order was ${provider.loads.join(', ')}`);
  // And the distant tile ahead beats the near one behind.
  assert.ok(provider.loads.indexOf('manaus:1,0') < provider.loads.indexOf('manaus:2,0'),
    `ahead should outrank behind: ${provider.loads.join(', ')}`);
});

test('disposing takes everything back out of the world', async () => {
  const registry = new ProviderRegistry();
  const provider = new FakeProvider({ tiles: 3 });
  registry.register(provider);
  const scheduler = new GlobalStreamingScheduler(registry);
  for (let frame = 0; frame < 8; frame++) { scheduler.update(context(), 1 / 60); await settle(); }
  assert.equal(scheduler.stats.active, 3);

  scheduler.dispose();
  assert.equal(scheduler.stats.tracked, 0);
  assert.equal(scheduler.stats.cache.entries, 0);
  assert.equal(provider.deactivations.length, 3, 'every active tile must be handed back');
});
