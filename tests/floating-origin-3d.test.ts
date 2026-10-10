import test from 'node:test';
import assert from 'node:assert/strict';
import { FloatingOrigin3D, type RebaseEvent } from '../src/world/spatial/FloatingOrigin3D.ts';
import { clonePose, pose } from '../src/world/spatial/SpatialPose.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

const FRAME = 'earth/manaus/legacy-enu';
const origin = () => pose(FRAME, [0, 0, 0]);

test('the origin holds still until the subject has wandered far enough', () => {
  const floating = new FloatingOrigin3D(origin(), { thresholdM: 2048, gridM: 1024 });
  assert.equal(floating.shouldRebase(pose(FRAME, [0, 0, 0])), false);
  assert.equal(floating.shouldRebase(pose(FRAME, [2000, 0, 0])), false);
  assert.equal(floating.shouldRebase(pose(FRAME, [2049, 0, 0])), true);
  // It is a sphere, not a box: height counts exactly as much as the other two axes, which is the
  // whole reason the old X/Z-only rebase had to be generalised before leaving the ground.
  assert.equal(floating.shouldRebase(pose(FRAME, [0, 2049, 0])), true);
  assert.equal(floating.shouldRebase(pose(FRAME, [1400, 1400, 1400])), true);
  assert.equal(floating.rebaseCount, 0, 'asking must never move anything');
});

test('a rebase never moves anything logically — the invariant the whole layer exists for', () => {
  const floating = new FloatingOrigin3D(origin(), { thresholdM: 2048, gridM: 1024 });

  // Two landmarks, held in logical coordinates, and a player who flies away from them.
  const teatro: Vec3 = [-83, 0, -6];
  const arena: Vec3 = [5400, 0, -7400];
  const separationBefore = Math.hypot(teatro[0] - arena[0], teatro[1] - arena[1], teatro[2] - arena[2]);
  const teatroLocalBefore = floating.toRenderLocal(teatro, [0, 0, 0]);

  const player = pose(FRAME, [9000, 140_000, -12_000]);
  const event = floating.update(player);
  assert.ok(event, 'that distance must trigger a rebase');

  // The logical numbers are untouched; only the view of them changed.
  assert.deepEqual(teatro, [-83, 0, -6]);
  assert.deepEqual(arena, [5400, 0, -7400]);

  const teatroLocalAfter = floating.toRenderLocal(teatro, [0, 0, 0]);
  const arenaLocalAfter = floating.toRenderLocal(arena, [0, 0, 0]);
  const separationAfter = Math.hypot(
    teatroLocalAfter[0] - arenaLocalAfter[0],
    teatroLocalAfter[1] - arenaLocalAfter[1],
    teatroLocalAfter[2] - arenaLocalAfter[2],
  );
  assert.ok(Math.abs(separationAfter - separationBefore) < 1e-9, 'distances must survive a rebase');

  // And the delta is exactly what a listener has to add to its stored render-local positions.
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs((teatroLocalBefore[i] + event!.localDeltaM[i]) - teatroLocalAfter[i]) < 1e-9,
      `component ${i}: delta did not carry the stored local position across`,
    );
  }

  // Round tripping through the origin returns the logical position untouched.
  const back = floating.toLogical(teatroLocalAfter, [0, 0, 0]);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(back[i] - teatro[i]) < 1e-9);
});

test('the origin snaps to the grid so repeated rebases cannot accumulate drift', () => {
  const floating = new FloatingOrigin3D(origin(), { thresholdM: 2048, gridM: 1024 });
  floating.update(pose(FRAME, [5000.37, -3000.91, 9999.5]));
  const snapped = floating.logicalOrigin.position;
  // `Math.abs`, because -3072 % 1024 is -0 and strict equality tells -0 and 0 apart.
  for (const component of snapped) {
    assert.equal(Math.abs(component % 1024), 0, `${component} is not on the 1024 m grid`);
  }
  assert.deepEqual(snapped, [5120, -3072, 10240]);

  // Flying a long way in small steps must leave the origin on the grid, every time.
  const player = pose(FRAME, [0, 0, 0]);
  for (let step = 0; step < 400; step++) {
    player.position[0] += 137.5;
    player.position[1] += 41.25;
    floating.update(player);
    for (const component of floating.logicalOrigin.position) {
      assert.equal(Math.abs(component % 1024), 0, 'the origin left the grid mid-flight');
    }
  }
  // And the player is still close to the render origin, which is the point of the exercise.
  assert.ok(floating.localDistance(player.position) <= floating.thresholdM + floating.gridM);
});

test('the player stays near the render origin across a climb to orbit', () => {
  const floating = new FloatingOrigin3D(origin(), { thresholdM: 2048, gridM: 1024 });
  const player = pose(FRAME, [38, 2.2, 12]);
  let worst = 0;
  // Straight up from the Largo to well past the old 140 km ceiling.
  for (let altitude = 0; altitude <= 400_000; altitude += 250) {
    player.position[1] = 2.2 + altitude;
    floating.update(player);
    worst = Math.max(worst, floating.localDistance(player.position));
  }
  assert.ok(worst < 4000, `render-local coordinates reached ${worst.toFixed(0)} m`);
  assert.ok(floating.rebaseCount > 100, 'and the origin followed the climb rather than being left behind');
});

test('changing frame forces a rebase and reports no delta, because the axes themselves moved', () => {
  const floating = new FloatingOrigin3D(origin(), { thresholdM: 2048, gridM: 1024 });
  const moon = pose('moon/fixed', [10, 20, 30]);
  assert.equal(floating.shouldRebase(moon), true, 'a different frame always rebases');

  const event = floating.update(moon)!;
  assert.equal(event.frameId, 'moon/fixed');
  assert.equal(floating.frame, 'moon/fixed');
  // A delta across frames would be meaningless; listeners must rebuild from logical positions.
  assert.deepEqual(event.localDeltaM, [0, 0, 0]);
  assert.equal(event.previousOrigin.frame, FRAME);
  assert.equal(event.nextOrigin.frame, 'moon/fixed');
});

test('the origin carries no rotation, so a rebase cannot tilt anything', () => {
  const floating = new FloatingOrigin3D(origin(), { thresholdM: 100, gridM: 100 });
  const tilted = pose(FRAME, [5000, 0, 0], [0.5, 0.5, 0.5, 0.5]);
  const event = floating.update(tilted)!;
  assert.deepEqual(event.nextOrigin.orientation, [0, 0, 0, 1]);
  assert.deepEqual(floating.logicalOrigin.orientation, [0, 0, 0, 1]);
});

test('every listener is told, and one that throws does not silence the rest', () => {
  const floating = new FloatingOrigin3D(origin(), { thresholdM: 100, gridM: 100 });
  const seen: string[] = [];
  floating.subscribe({ onRebase: () => seen.push('first') });
  floating.subscribe({ onRebase: () => { throw new Error('a listener blew up'); } });
  floating.subscribe({ onRebase: (event: RebaseEvent) => seen.push(`third:${event.frameId}`) });

  const previousError = console.error;
  console.error = () => undefined;
  try {
    floating.update(pose(FRAME, [900, 0, 0]));
  } finally {
    console.error = previousError;
  }
  assert.deepEqual(seen, ['first', `third:${FRAME}`]);

  // And unsubscribing actually stops the callbacks.
  const unsubscribe = floating.subscribe({ onRebase: () => seen.push('fourth') });
  unsubscribe();
  floating.update(pose(FRAME, [9000, 0, 0]));
  assert.ok(!seen.includes('fourth'));
});

test('a broken position is ignored rather than poisoning the origin', () => {
  const floating = new FloatingOrigin3D(origin(), { thresholdM: 2048, gridM: 1024 });
  assert.equal(floating.shouldRebase(pose(FRAME, [Number.NaN, 0, 0])), false);
  assert.equal(floating.update(pose(FRAME, [Number.POSITIVE_INFINITY, 0, 0])), null);
  assert.deepEqual(floating.logicalOrigin.position, [0, 0, 0]);
  assert.equal(floating.rebaseCount, 0);

  // Nonsense options fall back to the defaults instead of producing a zero or negative grid.
  const guarded = new FloatingOrigin3D(origin(), { thresholdM: Number.NaN, gridM: 0 });
  assert.ok(guarded.thresholdM > 0 && guarded.gridM > 0);
});

test('resetting places the origin exactly, for teleports and for tests', () => {
  const floating = new FloatingOrigin3D(origin(), { thresholdM: 2048, gridM: 1024 });
  const target = pose('moon/fixed', [123, 456, 789]);
  floating.reset(target);
  assert.equal(floating.frame, 'moon/fixed');
  assert.deepEqual(floating.logicalOrigin.position, [123, 456, 789]);
  // The returned pose is a copy: mutating it must not reach inside.
  const snapshot = floating.logicalOrigin;
  snapshot.position[0] = 999;
  assert.deepEqual(floating.logicalOrigin.position, [123, 456, 789]);
  // And the pose handed in is not captured by reference either.
  const held = clonePose(target);
  target.position[1] = -1;
  assert.deepEqual(floating.logicalOrigin.position, held.position);
});
