import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three/webgpu';
import { PlayerController } from '../src/player/PlayerController.ts';
import type { InputController } from '../src/player/InputController.ts';
import { FLIGHT } from '../src/player/flightConfig.ts';

function controls() {
  const held = new Set<string>(), edges = new Set<string>();
  const input = {
    enabled: true, mouseDelta: { x: 0, y: 0 },
    held: (code: string) => input.enabled && held.has(code),
    pressed: (code: string) => input.enabled && edges.has(code),
    consume: (code: string) => { const result = input.enabled && edges.has(code); edges.delete(code); return result; },
  } as unknown as InputController;
  return { input, held, edges };
}

/** A player in the air, boost available, nothing else pressed. */
function airborne(altitudeM = 20_000) {
  const { input, held, edges } = controls();
  const player = new PlayerController(new Group(), input);
  player.teleport(new Vector3(0, altitudeM, 0));
  player.state = 'Hover';
  return { player, held, edges, input };
}

const hold = (player: PlayerController, seconds: number) => {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds / dt); i++) player.update(dt, [], 0);
};

// ------------------------------------------------- explicit tier control
test('T_W_SHIFT_COSMIC_FORWARD: Shift alone is fast, KeyB is super', () => {
  const { player, held } = airborne();
  held.add('KeyW');

  // No boost: the base flight tier.
  hold(player, 0.2);
  assert.equal(player.speedMode, 'normal');

  held.add('ShiftLeft');
  hold(player, 0.2);
  assert.equal(player.speedMode, 'fast', 'sprint gives fast');

  held.delete('ShiftLeft');
  held.add('KeyB');
  hold(player, 0.2);
  assert.equal(player.speedMode, 'super');
});

test('the tier resets when boost is released', () => {
  const { player, held } = airborne();
  held.add('KeyW'); held.add('KeyB');
  hold(player, 0.5);
  assert.equal(player.speedMode, 'super');

  held.delete('KeyB');
  hold(player, 0.2);
  assert.equal(player.speedMode, 'normal');
});

test('interplanetary needs sky under it', () => {
  // Below the floor the arming stops at mega, because a frame at 222 km/s covers thirteen
  // kilometres and nothing on the ground could be collided with.
  const { player, held } = airborne(FLIGHT.interplanetaryFloorM - 1_000);
  player['armedTier'] = 'interplanetary'; // simulate arming
  held.add('KeyW'); held.add('KeyB');
  hold(player, 0.5);
  assert.equal(player.speedMode, 'mega');

  const { player: high, held: highHeld } = airborne(FLIGHT.interplanetaryFloorM + 1_000);
  high['armedTier'] = 'interplanetary'; // simulate arming
  highHeld.add('KeyW'); highHeld.add('KeyB');
  hold(high, 0.5);
  assert.equal(high.speedMode, 'interplanetary');
});

test('on the ground boost gives ground armed speed, not super/mega/interplanetary', () => {
  const { input, held } = controls();
  const player = new PlayerController(new Group(), input);
  player.teleport(new Vector3(0, 0, 0));
  player.state = 'Grounded';
  held.add('KeyB'); held.add('KeyW');
  hold(player, 0.5);
  assert.equal(player.speedMode, 'ground');
});

// --------------------------------------------- T_SHIFT_ALONE_NO_FORWARD_THRUST
test('T_SHIFT_ALONE_NO_FORWARD_THRUST: boost alone moves nobody', () => {
  const { player, held } = airborne();
  const before = player.position.clone();
  held.add('KeyB');
  hold(player, 1.5);

  // Boost is a modifier. With no movement key it must not synthesise a forward intent.
  const moved = player.position.distanceTo(before);
  assert.ok(moved < 50, `boost alone moved the player ${moved.toFixed(1)} m`);
});

test('boost with a direction does move', () => {
  const { player, held } = airborne();
  const before = player.position.clone();
  held.add('KeyB'); held.add('KeyW');
  hold(player, 1.5);
  assert.ok(player.position.distanceTo(before) > 100, 'W with boost must actually fly');
});
