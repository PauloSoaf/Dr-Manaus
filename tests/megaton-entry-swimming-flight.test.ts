import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { FLIGHT } from '../src/player/flightConfig';
import { proximitySpeedCapMps } from '../src/world/travel/CosmicFlight';
import { PlayerController } from '../src/player/PlayerController';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter';

function createMockInput() {
  const heldKeys = new Set<string>();
  const consumedKeys = new Set<string>();
  return {
    enabled: true,
    mouseDelta: { x: 0, y: 0 },
    held: (k: string) => heldKeys.has(k),
    consume: (k: string) => {
      const had = consumedKeys.has(k);
      consumedKeys.delete(k);
      return had;
    },
    pressed: (k: string) => heldKeys.has(k),
    setHeld: (k: string, val: boolean) => {
      if (val) heldKeys.add(k);
      else heldKeys.delete(k);
    },
    tap: (k: string) => {
      consumedKeys.add(k);
    },
  };
}

test('Megaton Rainfall Atmospheric Entry & Swimming/Takeoff Dynamics', async (t) => {
  await t.test('1. Megaton Rainfall Speed Governor Curve across Altitudes', () => {
    // Surface normal flight threshold at 150m: strictly 120 m/s
    const speedAt150m = proximitySpeedCapMps(150);
    assert.equal(speedAt150m, 120, 'At 150m above ground/ocean, speed must be 120 m/s (normal flight)');

    // Touchdown contact clearance (<= 0m): capped to 120 m/s
    const speedAt0m = proximitySpeedCapMps(0);
    assert.equal(speedAt0m, 120, 'At 0m clearance, speed must be 120 m/s');

    // Tropospheric descent: 500m -> ~300 m/s (smooth aerodynamic deceleration)
    const speedAt500m = proximitySpeedCapMps(500);
    assert.ok(speedAt500m > 120 && speedAt500m < 600, `Speed at 500m (${speedAt500m}) must be in [120, 600] m/s`);

    // High troposphere: 2,000m -> 1,200 m/s (fast descent)
    const speedAt2km = proximitySpeedCapMps(2000);
    assert.equal(speedAt2km, 1200, 'Speed at 2,000m must be 1,200 m/s');

    // Stratospheric cruise: 20,000m -> 8,000 m/s (hypersonic)
    const speedAt20km = proximitySpeedCapMps(20000);
    assert.equal(speedAt20km, 8000, 'Speed at 20,000m must be 8,000 m/s');

    // Upper exosphere / Low Orbit: 100,000m -> 50,000 m/s
    const speedAt100km = proximitySpeedCapMps(100000);
    assert.equal(speedAt100km, 50000, 'Speed at 100,000m must be 50,000 m/s');

    // Deep space: 100M km -> >= 256c
    const speedDeepSpace = proximitySpeedCapMps(100_000_000_000);
    assert.ok(speedDeepSpace >= 256 * 299_792_458, 'Speed in deep space must scale to superluminal');
  });

  await t.test('2. Takeoff from Swimming resets cosmic tiers and prevents space catapulting', () => {
    const input = createMockInput();
    const player = new PlayerController(new Group(), input as any);

    // Simulate arriving from space with armed interplanetary tier
    player.armed = 'interplanetary';
    assert.equal(player.armed, 'interplanetary', 'Player should have armed interplanetary tier');

    // Player enters water and starts swimming
    player.state = 'Swimming';
    // Simulate player initiating flight from water
    player.toggleFlight();

    // Flight takeoff: MUST be in Hover, speedMode normal, armed tier 'none'
    assert.equal(player.state, 'Hover', 'Takeoff must transition to Hover');
    assert.equal(player.speedMode, 'normal', 'Takeoff must begin at normal flight speed');
    assert.equal(player.armed, 'none', 'Armed tier must be reset to none upon takeoff');
    assert.equal(player.velocity.y, 5, 'Vertical takeoff speed must be gentle 5 m/s, never cosmic catapult');
    assert.equal(player.velocity.x, 0, 'Horizontal takeoff velocity must be 0');
    assert.equal(player.velocity.z, 0, 'Horizontal takeoff velocity must be 0');
  });

  await t.test('3. Entering water clears armed tier and subsequent takeoff starts in normal flight', () => {
    const input = createMockInput();
    const player = new PlayerController(new Group(), input as any);

    // Player flying in mega speed
    player.position.set(0, 10, 2000);
    player.state = 'Flight';
    player.armed = 'mega';
    player.speedMode = 'mega';

    // Teleport or plunge into deep river water at (0, -5, 2000)
    player.teleport(new Group().position.set(0, -5, 2000));

    // Splashing down into water clears armed tier and resets speed mode
    assert.equal(player.state, 'Swimming', 'Plunging into water transitions to Swimming');
    assert.equal(player.armed, 'none', 'Swimming must clear armed tier');

    // Player takes off again
    player.toggleFlight();
    assert.equal(player.state, 'Hover', 'Takeoff enters Hover');
    assert.equal(player.armed, 'none', 'Armed tier remains none upon takeoff');
    assert.equal(player.speedMode, 'normal', 'Takeoff starts in normal speed mode');
  });

  await t.test('4. Global Earth handoff outside Manaus creates local ENU at true touchdown position', () => {
    const universe = new UniverseRuntime({ streaming: false });

    // Position player in the Pacific Ocean (0°N, 140°W) at 200m altitude
    const pacificPos = [-4886000, 0, -4099000] as [number, number, number];
    universe.frames.register({
      id: 'test/pacific',
      parentId: 'earth/fixed',
      kind: 'surface-enu',
      originInParent: pacificPos,
      rotationToParent: [0, 0, 0, 1],
    });
    universe.setPlayerPose('test/pacific', [0, 200, 0]);

    // Perform handoff to Earth
    const localCoords = universe.handoffTo('earth');

    // Target frame should be 'earth/local-enu', NOT MANAUS_FRAME_ID!
    assert.notEqual(universe.player.frame, MANAUS_FRAME_ID, 'Pacific Ocean landing must not be teleported to Manaus');
    assert.equal(universe.player.frame, 'earth/local-enu', 'Pacific Ocean landing must create earth/local-enu');
    assert.ok(Number.isFinite(localCoords[0]) && Number.isFinite(localCoords[1]) && Number.isFinite(localCoords[2]));
  });
});
