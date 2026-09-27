import test from 'node:test';
import assert from 'node:assert/strict';
import { GlobalStreamingScheduler } from '../src/world/streaming/GlobalStreamingScheduler.ts';
import { ProviderRegistry } from '../src/world/runtime/ProviderRegistry.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';
import type { ManagedDemand, ManagedStats, ManagedSubsystem } from '../src/world/streaming/ManagedSubsystem.ts';

const context = (): StreamingContext => ({
  spatial: {
    timeS: 0,
    player: pose('x', [0, 100, 0]),
    frame: activeFrame(referenceFrame({ id: 'x', kind: 'render-local' }), pose('x')),
    localVelocityMps: [0, 0, 0],
    altitudeM: 100,
    bodyId: 'earth',
  },
  camera: { fovRad: 1, viewportHeightPx: 900, forward: [0, 0, -1] },
  quality: { sseTargetPx: 8, detailFactor: 1 },
  budget: DEFAULT_STREAMING_BUDGET,
});

class Fake implements ManagedSubsystem {
  grants: number[] = [];
  covering = true;
  pending = 100;
  critical = false;
  throwOnAdvance = false;

  constructor(readonly id: string) {}

  covers(): boolean { return this.covering; }
  plan(): readonly ManagedDemand[] {
    return this.pending
      ? [{ id: `${this.id}/work`, pending: this.pending, estimatedMs: 1, critical: this.critical }]
      : [];
  }
  advance(budgetMs: number): void {
    if (this.throwOnAdvance) throw new Error('subsystem exploded');
    this.grants.push(budgetMs);
  }
  stats(): ManagedStats { return { id: this.id, pending: this.pending, grantedMs: 0 }; }
}

test('a managed subsystem is granted what is left of the frame, not a budget of its own', () => {
  const scheduler = new GlobalStreamingScheduler(new ProviderRegistry());
  const city = new Fake('manaus/city');
  scheduler.registerSubsystem(city);

  scheduler.update(context(), 1 / 60);
  assert.equal(city.grants.length, 1, 'it must be served every frame it covers');
  const grant = city.grants[0];
  assert.ok(grant > 0, 'there is nothing else competing, so there is budget left');
  assert.ok(
    grant <= DEFAULT_STREAMING_BUDGET.mainThreadMs,
    `granted ${grant} ms out of a ${DEFAULT_STREAMING_BUDGET.mainThreadMs} ms frame`,
  );
});

test('registering twice does not serve twice', () => {
  const scheduler = new GlobalStreamingScheduler(new ProviderRegistry());
  const city = new Fake('manaus/city');
  scheduler.registerSubsystem(city).registerSubsystem(city);
  scheduler.update(context(), 1 / 60);
  assert.equal(city.grants.length, 1);
});

test('a subsystem that does not cover the player is not served at all', () => {
  const scheduler = new GlobalStreamingScheduler(new ProviderRegistry());
  const city = new Fake('manaus/city');
  city.covering = false;
  scheduler.registerSubsystem(city);
  scheduler.update(context(), 1 / 60);
  assert.equal(city.grants.length, 0);
  assert.deepEqual(scheduler.stats.subsystems, []);
});

test('two subsystems share the frame, and neither is always first', () => {
  const scheduler = new GlobalStreamingScheduler(new ProviderRegistry());
  const a = new Fake('a');
  const b = new Fake('b');
  scheduler.registerSubsystem(a).registerSubsystem(b);

  const servedFirst: string[] = [];
  for (let frame = 0; frame < 6; frame++) {
    scheduler.update(context(), 1 / 60);
    servedFirst.push(scheduler.stats.subsystems[0].id);
  }
  assert.equal(a.grants.length, 6);
  assert.equal(b.grants.length, 6);

  // Equal shares, so the rotation shows in who is served first rather than in how much they get.
  // It matters because the last in the rotation absorbs the rounding, and because a subsystem
  // that always went first would always see the freshest clock.
  assert.ok(servedFirst.includes('a') && servedFirst.includes('b'), `order was ${servedFirst.join(', ')}`);

  // And the frame is shared, not handed to one of them.
  for (let i = 0; i < 6; i++) {
    assert.ok(a.grants[i] > 0 && b.grants[i] > 0, 'both are served every frame');
    assert.ok(
      a.grants[i] + b.grants[i] <= DEFAULT_STREAMING_BUDGET.mainThreadMs + 1e-9,
      'together they must not exceed one frame budget',
    );
  }
});

test('critical work is served before optional work', () => {
  const scheduler = new GlobalStreamingScheduler(new ProviderRegistry());
  const optional = new Fake('optional');
  const urgent = new Fake('urgent');
  urgent.critical = true;
  // Registered in the order that would serve the optional one first without the rule.
  scheduler.registerSubsystem(optional).registerSubsystem(urgent);

  scheduler.update(context(), 1 / 60);
  const reported = scheduler.stats.subsystems.map(s => s.id);
  assert.equal(reported[0], 'urgent', `served ${reported.join(', ')}`);
});

test('a subsystem that throws does not take the scheduler with it', () => {
  const scheduler = new GlobalStreamingScheduler(new ProviderRegistry());
  const broken = new Fake('broken');
  const fine = new Fake('fine');
  broken.throwOnAdvance = true;
  scheduler.registerSubsystem(broken).registerSubsystem(fine);

  assert.doesNotThrow(() => scheduler.update(context(), 1 / 60));
  assert.equal(fine.grants.length, 1, 'the working subsystem is still served');
});

test('a subsystem can be removed again', () => {
  const scheduler = new GlobalStreamingScheduler(new ProviderRegistry());
  const city = new Fake('manaus/city');
  scheduler.registerSubsystem(city);
  scheduler.update(context(), 1 / 60);
  assert.equal(city.grants.length, 1);

  assert.equal(scheduler.unregisterSubsystem('manaus/city'), true);
  assert.equal(scheduler.unregisterSubsystem('manaus/city'), false, 'removing twice is not an error');
  scheduler.update(context(), 1 / 60);
  assert.equal(city.grants.length, 1, 'no longer served');
});
