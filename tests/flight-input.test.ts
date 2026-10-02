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

// ------------------------------------------------- the ladder that had gone missing
test('T_W_SHIFT_COSMIC_FORWARD: holding boost climbs the tier ladder', () => {
  const { player, held } = airborne();
  held.add('KeyW');

  // No boost: the base flight tier.
  hold(player, 0.2);
  assert.equal(player.speedMode, 'normal');

  held.add('ShiftLeft');
  hold(player, 0.2);
  assert.equal(player.speedMode, 'fast', 'boost starts at fast');

  hold(player, FLIGHT.boostSpoolS.super);
  assert.equal(player.speedMode, 'super');

  hold(player, FLIGHT.boostSpoolS.mega - FLIGHT.boostSpoolS.super);
  assert.equal(player.speedMode, 'mega');
  assert.equal(player.megaMode, true);

  hold(player, FLIGHT.boostSpoolS.interplanetary - FLIGHT.boostSpoolS.mega);
  assert.equal(player.speedMode, 'interplanetary', 'the top tier must be reachable at all');
  assert.equal(player.interplanetaryMode, true);
});

test('the ladder resets when boost is released', () => {
  const { player, held } = airborne();
  held.add('KeyW'); held.add('ShiftLeft');
  hold(player, FLIGHT.boostSpoolS.mega + 0.5);
  assert.equal(player.speedMode, 'mega');

  held.delete('ShiftLeft');
  hold(player, 0.2);
  assert.equal(player.speedMode, 'normal');
  assert.equal(player.boostCharge, 0, 'the spool must empty, not hold its charge');
});

test('interplanetary needs sky under it', () => {
  // Below the floor the ladder stops at mega, because a frame at 222 km/s covers thirteen
  // kilometres and nothing on the ground could be collided with.
  const { player, held } = airborne(FLIGHT.interplanetaryFloorM - 1_000);
  held.add('KeyW'); held.add('ShiftLeft');
  hold(player, FLIGHT.boostSpoolS.interplanetary + 1);
  assert.equal(player.speedMode, 'mega');

  const { player: high, held: highHeld } = airborne(FLIGHT.interplanetaryFloorM + 1_000);
  highHeld.add('KeyW'); highHeld.add('ShiftLeft');
  hold(high, FLIGHT.boostSpoolS.interplanetary + 1);
  assert.equal(high.speedMode, 'interplanetary');
});

test('on the ground the ladder does not spool at all', () => {
  const { input, held } = controls();
  const player = new PlayerController(new Group(), input);
  player.teleport(new Vector3(0, 0, 0));
  player.state = 'Grounded';
  held.add('ShiftLeft'); held.add('KeyW');
  hold(player, FLIGHT.boostSpoolS.interplanetary + 2);
  // Sprinting on foot is its own thing and keeps its own speed; what must not happen is the
  // flight ladder charging while the player is standing on the ground.
  assert.equal(player.boostCharge, 0, 'the spool must not charge on foot');
  assert.ok(player.speedMode !== 'super' && player.speedMode !== 'mega' && player.speedMode !== 'interplanetary');
});

// --------------------------------------------- T_SHIFT_ALONE_NO_FORWARD_THRUST
test('T_SHIFT_ALONE_NO_FORWARD_THRUST: boost alone moves nobody', () => {
  const { player, held } = airborne();
  const before = player.position.clone();
  held.add('ShiftLeft');
  hold(player, 1.5);

  // Shift is a modifier. With no movement key it must not synthesise a forward intent: the
  // previous build copied the camera forward into the thrust vector when only boost was held,
  // which flew the player and could enter cosmic cruise with no forward input at all.
  const moved = player.position.distanceTo(before);
  assert.ok(moved < 50, `boost alone moved the player ${moved.toFixed(1)} m`);
});

test('boost with a direction does move', () => {
  const { player, held } = airborne();
  const before = player.position.clone();
  held.add('ShiftLeft'); held.add('KeyW');
  hold(player, 1.5);
  assert.ok(player.position.distanceTo(before) > 100, 'W with boost must actually fly');
});
