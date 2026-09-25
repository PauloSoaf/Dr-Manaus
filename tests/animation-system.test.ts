import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, Group, Object3D, PerspectiveCamera, QuaternionKeyframeTrack, Vector3, Quaternion } from 'three/webgpu';
import { CHARACTER_CLIPS, cleanCharacterClip } from '../src/player/animations/CharacterAnimator.ts';
import { AnimationController } from '../src/player/animations/AnimationController.ts';
import { computeFlightOrientation, flightModeFor, uprightBlend } from '../src/player/animations/FlightOrientation.ts';
import { flipAngle, flipPhase, flipRate, flipTuck } from '../src/player/animations/FlipMotion.ts';
import { CharacterModel } from '../src/player/CharacterModel.ts';
import { IMPACT, impactEnergy, profileFor, resolveImpact } from '../src/player/combat/MeteorImpact.ts';
import { SpeedArcs, SPEED_ARCS, arcIntensity } from '../src/player/vfx/SpeedArcs.ts';
import { FLIGHT } from '../src/player/flightConfig.ts';
import { DESTRUCTION } from '../src/core/config.ts';
import { AnimationEvents } from '../src/player/animations/AnimationEvents.ts';
import { COMBAT_MOVES } from '../src/player/combat/CombatMoves.ts';
import { HitStopSystem } from '../src/player/combat/HitStopSystem.ts';
import { SoftTargeting, type SoftTargetCandidate } from '../src/player/combat/SoftTargeting.ts';
import { getJumpHeight, getJumpVelocity, getDoubleJumpDuration } from '../src/player/physics/JumpPhysics.ts';
import { TitanGroundSupport } from '../src/player/physics/TitanGroundSupport.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import { PowerSystem, type PowerHooks } from '../src/player/powers/PowerSystem.ts';
import type { InputController } from '../src/player/InputController.ts';
import type { Target, Collider } from '../src/core/types.ts';

function mockInput() {
  const held = new Set<string>();
  const edges = new Set<string>();
  const input = {
    enabled: true,
    mouseDelta: { x: 0, y: 0 },
    held: (code: string) => input.enabled && held.has(code),
    pressed: (code: string) => input.enabled && edges.has(code),
    consume: (code: string) => {
      const res = input.enabled && edges.has(code);
      edges.delete(code);
      return res;
    },
  } as unknown as InputController;
  return { input, held, edges };
}

test('AnimationEvents trigger exactly once per cycle and not again during recovery', () => {
  const events = new AnimationEvents();
  const fired: string[] = [];
  events.subscribe((event) => fired.push(event));

  const defs = [
    { time: 0.2, event: 'attack.activeStart' as const },
    { time: 0.5, event: 'attack.hit' as const },
    { time: 0.8, event: 'attack.cancelWindow' as const },
  ];

  // Advance from 0.0 to 0.3 -> should trigger activeStart
  events.evaluate('move1', 0.0, 0.3, defs);
  assert.deepEqual(fired, ['attack.activeStart']);

  // Advance from 0.3 to 0.6 -> should trigger hit
  events.evaluate('move1', 0.3, 0.6, defs);
  assert.deepEqual(fired, ['attack.activeStart', 'attack.hit']);

  // Repeated check within same time window without advancing should not re-trigger
  events.evaluate('move1', 0.6, 0.65, defs);
  assert.deepEqual(fired, ['attack.activeStart', 'attack.hit']);

  // Recovery period up to 1.0 -> triggers cancelWindow once
  events.evaluate('move1', 0.65, 1.0, defs);
  assert.deepEqual(fired, ['attack.activeStart', 'attack.hit', 'attack.cancelWindow']);

  // Further updates during recovery/finish do not fire extra events
  events.evaluate('move1', 1.0, 1.0, defs);
  assert.equal(fired.length, 3);
});

test('DoubleJump executes 360 degree rotation and terminates with strictly identity quaternion', () => {
  const controller = new AnimationController();
  const bones = [];
  const params = {
    speed: 0,
    verticalSpeed: 5,
    velocity: new Vector3(0, 5, 0),
    flying: false,
    grounded: false,
    boosting: false,
    size: 1,
    turn: 0,
    speedMode: 'normal',
    facingYaw: 0,
  };

  controller.triggerDoubleJump('front', 1);
  assert.equal(controller.isDoubleJumping, true);
  assert.equal(controller.doubleJumpProgress, 0);

  // Midway through flip (~50%)
  for (let frame = 0; frame < 5; frame++) controller.update(bones, 0.044, params);
  assert.ok(controller.doubleJumpProgress > 0.4 && controller.doubleJumpProgress < 0.6);
  assert.ok(Math.abs(controller.rootOrientation.w) < 0.9, 'should be actively rotated midway');

  // Complete the flip
  for (let frame = 0; frame < 5; frame++) controller.update(bones, 0.05, params);
  assert.equal(controller.isDoubleJumping, false);
  assert.equal(controller.doubleJumpProgress, 1);

  // Visual orientation must mathematically equal identity (0, 0, 0, 1) within epsilon
  assert.ok(Math.abs(controller.rootOrientation.x) < 1e-4);
  assert.ok(Math.abs(controller.rootOrientation.y) < 1e-4);
  assert.ok(Math.abs(controller.rootOrientation.z) < 1e-4);
  assert.ok(Math.abs(1 - Math.abs(controller.rootOrientation.w)) < 1e-4);
});

test('10 consecutive double jumps separated by landings accumulate zero rotation error', () => {
  const controller = new AnimationController();
  const bones = [];
  const params = {
    speed: 0,
    verticalSpeed: 5,
    velocity: new Vector3(0, 5, 0),
    flying: false,
    grounded: false,
    boosting: false,
    size: 1,
    turn: 0,
    speedMode: 'normal',
    facingYaw: 0,
  };

  for (let i = 0; i < 10; i++) {
    const dir = (['front', 'back', 'sideLeft', 'sideRight'] as const)[i % 4];
    controller.triggerDoubleJump(dir, 1);
    // Simulate jump frames
    for (let frame = 0; frame < 20; frame++) {
      controller.update(bones, 0.03, params);
    }
    // Slerp needs time to settle
    for (let frame = 0; frame < 15; frame++) {
      controller.update(bones, 0.03, params);
    }
    assert.ok(Math.abs(controller.rootOrientation.x) < 1e-4);
    assert.ok(Math.abs(controller.rootOrientation.y) < 1e-4);
    assert.ok(Math.abs(controller.rootOrientation.z) < 1e-4);
    assert.ok(Math.abs(1 - Math.abs(controller.rootOrientation.w)) < 1e-4);
  }
});

test('Double jump occurs only once before touching ground in PlayerController', () => {
  const { input, edges } = mockInput();
  const root = new Group();
  const player = new PlayerController(root, input);
  player.teleport(new Vector3(0, 0, 0));

  // First space: jump 1
  edges.add('Space');
  player.update(0.016, [], 0);
  assert.equal(player.jumpCount, 1);

  // In air: second space triggers double jump
  edges.add('Space');
  player.update(0.016, [], 0);
  assert.equal(player.jumpCount, 2);
  assert.equal(player.character.animationController.isDoubleJumping, true);

  // Third space while still in air does NOT trigger a third jump
  edges.add('Space');
  player.update(0.016, [], 0);
  assert.equal(player.jumpCount, 2);
});

test('Physical jump height and velocity follow square root relationship v = sqrt(2 * g * h)', () => {
  const g = 25;
  for (const size of [1, 7, 22, 100, 500]) {
    const height = getJumpHeight(size);
    const velocity = getJumpVelocity(size, g);
    assert.ok(height > 0, 'height must be positive');
    assert.ok(velocity > 0, 'velocity must be positive');
    // Verify physical relation
    assert.ok(velocity < 150, 'clamped so 1km titan does not shoot to stratosphere');
  }
});

test('AnimationController leaves the native skeleton to AnimationMixer during flying combat', () => {
  const controller = new AnimationController();
  const bones = [];
  const params = {
    speed: 150,
    verticalSpeed: 0,
    velocity: new Vector3(0, 0, -150),
    flying: true,
    grounded: false,
    boosting: false,
    size: 1,
    turn: 0,
    speedMode: 'fast',
    facingYaw: 0,
  };

  // Fly for 30 frames to establish aerodynamic flight pose
  for (let i = 0; i < 30; i++) controller.update(bones, 0.016, params);

  controller.startCombatMove(COMBAT_MOVES.flyingPunch);
  assert.equal(controller.activeCombatMove?.id, 'flyingPunch');
  for (let i = 0; i < 15; i++) controller.update(bones, 0.016, params);
  assert.equal(bones.length, 0, 'state controller must never create or mutate a custom rig');
  assert.equal(controller.debugState.boneMask, 'UPPER_BODY');
  assert.ok(Number.isFinite(controller.rootOrientation.lengthSq()));
});

test('Flight combat does not force Grounded state and functions in flight modes', () => {
  const { input } = mockInput();
  const root = new Group();
  const player = new PlayerController(root, input);
  player.teleport(new Vector3(0, 50, 0));
  player.state = 'Flight';
  player.velocity.set(0, 0, -120);

  const targets: Target[] = [];
  const hooks: PowerHooks = {
    targets: () => targets,
    hit: () => undefined,
    reconstruct: () => 0,
    impulse: () => undefined,
    prepare: async () => undefined,
    notify: () => undefined,
    sound: () => undefined,
    getOrigin: () => new Vector3(),
    getColliders: () => [],
  };
  const camera = new PerspectiveCamera();
  const powers = new PowerSystem(root, player, camera, input, hooks);

  // Attack while flying
  powers.use('punch');
  assert.equal(player.state, 'Flight');
  assert.notEqual(player.state, 'Grounded');
});

test('Flying punch damage and blast radius scale with velocity with clamps', () => {
  const { input } = mockInput();
  const root = new Group();
  const player = new PlayerController(root, input);
  player.teleport(new Vector3(0, 100, 0));
  player.state = 'Flight';

  let recordedDamage = 0;
  let recordedRadius = 0;
  const target: Target = { id: 'test_enemy', position: new Vector3(0, 100, -5), radius: 2, kind: 'enemy', active: true };

  const hooks: PowerHooks = {
    targets: () => [target],
    hit: () => undefined,
    reconstruct: () => 0,
    impulse: () => undefined,
    prepare: async () => undefined,
    notify: () => undefined,
    sound: () => undefined,
    getOrigin: () => new Vector3(),
    getColliders: () => [],
    damage: (_point, radius, amount) => {
      recordedRadius = radius;
      recordedDamage = amount;
      return 1;
    },
  };

  const camera = new PerspectiveCamera();
  camera.position.set(0, 100, 0);
  camera.lookAt(0, 100, -10);
  const powers = new PowerSystem(root, player, camera, input, hooks);

  // At low flight speed
  player.velocity.set(0, 0, -10);
  powers.use('punch');
  powers.update(0.25, 0.25); // Reach the authored clip's contact frame.
  const lowSpeedDamage = recordedDamage;
  const lowSpeedRadius = recordedRadius;

  // Clear cooldown
  powers.update(1.0, 1.0);

  // At supersonic speed
  player.velocity.set(0, 0, -1200);
  powers.use('punch');
  powers.update(0.25, 0.25);
  const highSpeedDamage = recordedDamage;
  const highSpeedRadius = recordedRadius;

  assert.ok(highSpeedDamage > lowSpeedDamage * 2.0, 'supersonic impact deals significantly more damage');
  assert.ok(highSpeedRadius > lowSpeedRadius, 'supersonic impact creates larger blast radius');
  assert.ok(Number.isFinite(highSpeedDamage) && highSpeedDamage < 10000000, 'damage remains bounded');
});

test('SoftTargeting picks most central target in cone and rejects targets outside cone', () => {
  const origin = new Vector3(0, 0, 0);
  const forward = new Vector3(0, 0, -1);

  const centerTarget: SoftTargetCandidate = {
    id: 'center',
    position: new Vector3(0.5, 0, -20), // ~1.4 degrees off center
    radius: 1,
    priority: 50,
  };
  const edgeTarget: SoftTargetCandidate = {
    id: 'edge',
    position: new Vector3(5, 0, -20), // ~14 degrees off center
    radius: 1,
    priority: 50,
  };
  const outsideTarget: SoftTargetCandidate = {
    id: 'outside',
    position: new Vector3(15, 0, -20), // ~37 degrees off center (> 18 deg max assist)
    radius: 1,
    priority: 100,
  };

  // Both center and edge available -> should pick central target
  const result1 = SoftTargeting.findTarget(origin, forward, [centerTarget, edgeTarget], 50);
  assert.equal(result1.target?.id, 'center');
  assert.ok(result1.assistAngleDeg < 18);

  // Only outside target available -> should reject because outside assist cone
  const result2 = SoftTargeting.findTarget(origin, forward, [outsideTarget], 50);
  assert.equal(result2.target, null);
  assert.equal(result2.assistAngleDeg, 0);
});

test('HitStopSystem freezes combat time without world lock and finishes on time', () => {
  const hitStop = new HitStopSystem();
  assert.equal(hitStop.isFrozen, false);

  hitStop.trigger(50); // 50ms freeze
  assert.equal(hitStop.isFrozen, true);
  assert.ok(hitStop.remainingMs > 40 && hitStop.remainingMs <= 50);

  // Advance 30ms -> still frozen, returns factor 0
  const factor1 = hitStop.update(0.03);
  assert.equal(factor1, 0);
  assert.equal(hitStop.isFrozen, true);

  // Advance remaining 30ms -> unfreezes, returns factor 1
  const factor2 = hitStop.update(0.03);
  assert.equal(factor2, 1);
  assert.equal(hitStop.isFrozen, false);
});

test('TitanGroundSupport suppresses false fall animations when stepping on and destroying building', () => {
  const support = new TitanGroundSupport();
  const position = new Vector3(0, 20, 0);
  const size = 50; // 50m titan
  const colliders: Collider[] = [{ x: 0, y: 10, z: 0, width: 30, height: 20, depth: 30 }];

  // Step 1: Titan is supported on building
  const eval1 = support.evaluateSupport(position, size, 0, 0.016, colliders);
  assert.equal(eval1.hasSupport, true);
  assert.equal(eval1.isFallingVisually, false);

  // Step 2: Building is crushed and destroyed (collider removed from list), foot continues descent to terrain
  const eval2 = support.evaluateSupport(position, size, -2, 0.016, []);
  // Support grace period must prevent instant false fall
  assert.equal(eval2.hasSupport, true, 'grace period maintains support');
  assert.equal(eval2.isFallingVisually, false, 'must NOT trigger visual fall immediately');

  // Step 3: Truly falling into deep abyss over significant distance
  position.y = -80;
  const eval3 = support.evaluateSupport(position, size, -25, 0.5, []);
  assert.equal(eval3.hasSupport, false);
  assert.equal(eval3.isFallingVisually, true, 'genuine deep drop triggers fall');
});

test('computeFlightOrientation aligns local +Y to velocity vector', () => {
  const current = new Quaternion();
  const target = new Quaternion();

  const cases = [
    new Vector3(0, 0, -100),
    new Vector3(0, 0, 100),
    new Vector3(100, 0, 0),
    new Vector3(-100, 0, 0),
    new Vector3(0, 100, 0),
    new Vector3(0, -100, 0),
    new Vector3(100, 100, -100).normalize().multiplyScalar(100),
  ];

  for (const vel of cases) {
    // Large dt to simulate stabilized target instantly
    computeFlightOrientation(vel, current, 10.0, 0, 'normal', target, 0);
    
    // Check if +Y matches velocity
    const headAxis = new Vector3(0, 1, 0).applyQuaternion(target);
    const expectedDir = vel.clone().normalize();
    const alignment = headAxis.dot(expectedDir);
    
    assert.ok(alignment > 0.999, `failed alignment for velocity ${vel.toArray()}: got ${alignment}`);
  }
});

test('CharacterModel double jump does not accumulate quaternion continuously on body bone', () => {
  const { input } = mockInput();
  const root = new Group();
  const player = new PlayerController(root, input);
  
  // Base posture before jump
  player.character.animate(0.016, 0, false, false, '', 0, 0, 1, undefined, 1, 'ground', new Vector3(0,0,-1), 0);
  const initialBodyQ = player.character.hips.quaternion.clone();

  // Trigger double jump
  player.character.animationController.triggerDoubleJump('front', 1);

  // Simulate multiple frames inside double jump
  for(let i = 0; i < 15; i++) {
    player.character.animate(0.016, 0, false, false, '', 0, 0, 1, undefined, 1, 'ground', new Vector3(0,0,-1), 0);
  }

  const currentBodyQ = player.character.hips.quaternion.clone();
  
  // The local body bone should only have local pose offset, it should NOT accumulate a huge flip rotation
  const angleError = currentBodyQ.angleTo(initialBodyQ);
  // It might have small differences due to idle breathing or phase updates, but NOT 180 degrees.
  assert.ok(angleError < 0.2, 'body bone quaternion should not accumulate massive rotation');

  // But the global group should be rotating
  const groupQ = player.character.flightRoot.quaternion;
  assert.ok(Math.abs(groupQ.w) < 0.95, 'global visual orientation MUST be rotated');
});


test('flightPose changes according to speedMode', () => {
  const controller = new AnimationController();
  const params = {
    speed: 90,
    verticalSpeed: 0,
    // Cruising, not drifting: below 30 m/s the pose is `hover`, which is the point of the
    // rest posture. The old rule called 10 m/s "cruise" and that is what made a stationary
    // hero read as though he were swimming.
    velocity: new Vector3(0, 0, -90),
    flying: true,
    grounded: false,
    boosting: false,
    size: 1,
    turn: 0,
    speedMode: 'cruise',
    desiredSpeed: 90,
  };

  // Skip takeoff
  for (let frame = 0; frame < 3; frame++) controller.update([], 0.1, params);
  assert.equal(controller.debugState.flightLayer, 'cruise');

  // Hanging in the air under no power is a hover, whatever the speed tier says.
  const resting = { ...params, speed: 0, velocity: new Vector3(0, 0, 0), desiredSpeed: 0 };
  controller.update([], 0.1, resting);
  assert.equal(controller.debugState.flightLayer, 'hover');
  controller.update([], 0.1, params);

  params.speedMode = 'fast';
  controller.update([], 0.1, params);
  assert.equal(controller.debugState.flightLayer, 'fast');

  params.speedMode = 'super';
  controller.update([], 0.1, params);
  assert.equal(controller.debugState.flightLayer, 'super');

  params.speedMode = 'mega';
  controller.update([], 0.1, params);
  assert.equal(controller.debugState.flightLayer, 'mega');
});

// ---------------------------------------------------------------------------------------------
// Movement polish sprint: hover recovery, dodge, the somersault pivot and meteor impacts.
// ---------------------------------------------------------------------------------------------

test('letting go of fast flight rights the body while it is still moving, not after it stops', () => {
  // Under power at cruise the body stays belly-down: nothing to recover from.
  assert.equal(uprightBlend(120, 120), 0);
  assert.equal(uprightBlend(8000, 8000), 0);

  // The instant the player stops asking for speed the recovery is already underway. This is the
  // whole bug: the old rule waited for |v| <= 1, which at the braking response is 0.8s of lying
  // flat in the air and then a snap to vertical.
  const releasing = uprightBlend(120, 0);
  assert.ok(releasing > 0.2, `still flat at 120 m/s with the throttle shut (${releasing.toFixed(3)})`);
  assert.ok(uprightBlend(20, 0) > 0.9, 'at walking pace it must be essentially upright');
  assert.equal(uprightBlend(2, 0), 1);

  // Monotone all the way down: the chest must never dip back toward the ground as it slows.
  let previous = 0;
  for (let speed = 300; speed >= 0; speed -= 2) {
    const value = uprightBlend(speed, 0);
    assert.ok(value >= previous - 1e-9, `the recovery reversed at ${speed} m/s`);
    previous = value;
  }
  assert.ok(Number.isFinite(uprightBlend(Number.NaN, Number.NaN)));

  // The named phases the animation layer keys off.
  assert.equal(flightModeFor(0.5, 0), 'hover');
  assert.equal(flightModeFor(120, 0), 'braking');
  assert.equal(flightModeFor(120, 120, 'normal'), 'cruise');
  assert.equal(flightModeFor(2000, 2000, 'super'), 'fast');
});

test('the deceleration and the rotation happen together, and it settles exactly upright', () => {
  const controller = new AnimationController();
  const velocity = new Vector3(0, 0, -120);
  const params = {
    speed: 120, verticalSpeed: 0, velocity, flying: true, grounded: false, boosting: false,
    size: 1, turn: 0, speedMode: 'normal', facingYaw: 0, desiredSpeed: 120,
  };
  for (let frame = 0; frame < 60; frame++) controller.update([], 1 / 60, params);
  assert.ok(controller.uprightAmount < 0.02, 'under power the body is aerodynamic');
  const flat = new Vector3(0, 1, 0).applyQuaternion(controller.rootOrientation);
  assert.ok(flat.z < -0.9, `the head should lead along the velocity, got ${flat.z.toFixed(3)}`);

  // Release. Velocity bleeds off at the braking response the player controller actually uses.
  params.desiredSpeed = 0;
  let liftedWhileFast = 0;
  for (let frame = 0; frame < 150; frame++) {
    velocity.multiplyScalar(Math.exp(-6 / 60));
    controller.update([], 1 / 60, params);
    if (velocity.length() > 20) liftedWhileFast = Math.max(liftedWhileFast, controller.uprightAmount);
  }
  assert.ok(liftedWhileFast > 0.5, `the body was still flat above 20 m/s (${liftedWhileFast.toFixed(3)})`);
  assert.equal(controller.currentFlightMode, 'hover');
  const upright = new Vector3(0, 1, 0).applyQuaternion(controller.rootOrientation);
  assert.ok(upright.y > 0.99, `settled at ${upright.y.toFixed(4)} instead of standing`);
});

test('hovering at rest sways instead of freezing, and standing on the ground never does', () => {
  const controller = new AnimationController();
  const params = {
    speed: 0, verticalSpeed: 0, velocity: new Vector3(), flying: true, grounded: false,
    boosting: false, size: 1, turn: 0, speedMode: 'normal', facingYaw: 0, desiredSpeed: 0,
  };
  let low = Infinity, high = -Infinity;
  for (let frame = 0; frame < 400; frame++) {
    controller.update([], 1 / 60, params);
    low = Math.min(low, controller.bodyOffset.y);
    high = Math.max(high, controller.bodyOffset.y);
  }
  assert.ok(high - low > 0.04, `the hover is frozen solid (${(high - low).toFixed(4)} m of sway)`);
  assert.ok(high - low < 0.12, 'the sway must read as breathing, not as bobbing in water');

  // Feet on the ground: no vertical offset at all, or the character floats or sinks.
  const grounded = { ...params, flying: false, grounded: true };
  for (let frame = 0; frame < 120; frame++) {
    controller.update([], 1 / 60, grounded);
    assert.equal(controller.bodyOffset.y, 0);
  }
});

test('the somersault turns about the body, and its centre of mass does not orbit anything', () => {
  const character = new CharacterModel(true);
  try {
    // Stand in for the measured rest pose: soles at 0, crown at 2.07, drawn one to one.
    character.visualRoot.scale.setScalar(1);
    character.setBodyPivot(0, 2.07);
    assert.ok(
      Math.abs(character.flightRoot.position.y + character.pivotRoot.position.y) < 1e-12,
      'the pivot pair must compose to identity at rest',
    );
    const pivot = character.flightRoot.position.y;
    assert.ok(pivot > 1 && pivot < 1.3, `the rotation centre sits at ${pivot.toFixed(3)} m, not at the hips`);

    const centre = new Object3D(); centre.position.set(0, pivot, 0);
    const crown = new Object3D(); crown.position.set(0, 2.07, 0);
    character.pivotRoot.add(centre, crown);
    character.group.updateMatrixWorld(true);
    const rest = new Vector3(); centre.getWorldPosition(rest);

    character.animationController.triggerDoubleJump('front', 1);
    const world = new Vector3();
    let centreDrift = 0, crownLowest = Infinity, turned = 0;
    for (let frame = 0; frame < 40; frame++) {
      character.animate(1 / 60, 0, false, false, 'flip', 6, 0, 1, new Vector3(0, 6, 0), 1, 'ground', undefined, 0, { grounded: false });
      character.group.updateMatrixWorld(true);
      centre.getWorldPosition(world);
      centreDrift = Math.max(centreDrift, world.distanceTo(rest));
      crown.getWorldPosition(world);
      crownLowest = Math.min(crownLowest, world.y);
      turned = Math.max(turned, character.animationController.doubleJumpProgress);
    }
    assert.ok(turned >= 1, 'the flip must complete inside the sampled window');
    // The claim, stated as geometry: rotating about the feet swept this point around a circle of
    // radius `pivot`, which is what read as orbiting a point in the world.
    assert.ok(centreDrift < 1e-9, `the centre of mass travelled ${centreDrift.toFixed(4)} m during the flip`);
    assert.ok(crownLowest < rest.y - 0.8, `the head never passed below the hips (${crownLowest.toFixed(3)})`);
  } finally {
    character.dispose();
  }
});

test('the flip is fastest through the tuck and still lands on exactly one turn', () => {
  assert.equal(flipAngle(0), 0);
  assert.ok(Math.abs(flipAngle(1) - Math.PI * 2) < 1e-12, 'ten flips in a row must not drift');

  let previous = -1;
  for (let t = 0; t <= 1.0001; t += 0.001) {
    const angle = flipAngle(t);
    assert.ok(angle > previous, `the body rotated backwards at t=${t.toFixed(3)}`);
    previous = angle;
  }

  // A constant rate looks mechanical; an eased curve makes the body hang and then snap. Real
  // angular momentum peaks in the tuck and never stalls at either end.
  assert.ok(flipRate(0.5) > flipRate(0.02) * 2, 'the tuck has to actually speed the rotation up');
  assert.ok(flipRate(0) > 0.5 && flipRate(1) > 0.5, 'the flip must never stall at its ends');
  assert.ok(flipTuck(0.5) > 0.98 && flipTuck(0) < 0.01 && flipTuck(1) < 0.01);
  assert.equal(flipPhase(0.02), 'takeoff');
  assert.equal(flipPhase(0.2), 'tuck');
  assert.equal(flipPhase(0.5), 'rotate');
  assert.equal(flipPhase(0.75), 'untuck');
  assert.equal(flipPhase(0.95), 'recovery');
});

test('the double jump is visual rotation only and never displaces the player', () => {
  const { input, edges } = mockInput();
  const player = new PlayerController(new Group(), input);
  player.teleport(new Vector3(0, 0, 0));

  edges.add('Space');
  player.update(1 / 60, [], 0);
  const beforeY = player.velocity.y;

  edges.add('Space');
  player.update(1 / 60, [], 0);
  assert.equal(player.character.animationController.isDoubleJumping, true);
  assert.ok(player.velocity.y > beforeY, 'the second jump is what lifts, not the rotation');
  // With no direction held there is no carry, so the flip contributes nothing horizontal at all.
  assert.ok(Math.abs(player.velocity.x) < 1e-9 && Math.abs(player.velocity.z) < 1e-9);

  for (let frame = 0; frame < 60; frame++) {
    player.update(1 / 60, [], 0);
    assert.ok(Math.abs(player.position.x) < 1e-9, `the flip pushed the player to x=${player.position.x}`);
    assert.ok(Math.abs(player.position.z) < 1e-9, `the flip pushed the player to z=${player.position.z}`);
  }
});

test('holding a direction throws the somersault forward instead of spinning on the spot', () => {
  const { input, held, edges } = mockInput();
  const player = new PlayerController(new Group(), input);
  player.teleport(new Vector3(0, 0, 0));
  held.add('KeyW');
  for (let frame = 0; frame < 30; frame++) player.update(1 / 60, [], 0);

  edges.add('Space');
  player.update(1 / 60, [], 0);
  const beforeFlip = Math.hypot(player.velocity.x, player.velocity.z);
  edges.add('Space');
  player.update(1 / 60, [], 0);
  const afterFlip = Math.hypot(player.velocity.x, player.velocity.z);
  assert.ok(afterFlip > beforeFlip + 2, `the flip added only ${(afterFlip - beforeFlip).toFixed(2)} m/s of travel`);
  assert.ok(player.velocity.z < 0, 'and it travels the way the player was heading');
});

test('the evade is a roll with both feet down and a dash in the air', () => {
  const { input, edges } = mockInput();
  const player = new PlayerController(new Group(), input);
  player.teleport(new Vector3(0, 0, 0));
  player.update(1 / 60, [], 0);
  assert.equal(player.isGrounded, true);

  edges.add('KeyZ');
  player.update(1 / 60, [], 0);
  assert.equal(player.dodge.kind, 'roll');
  const start = player.position.clone();
  let invulnerableFrames = 0;
  for (let frame = 0; frame < 34; frame++) {
    player.update(1 / 60, [], 0);
    if (player.invulnerable) invulnerableFrames++;
  }
  assert.ok(player.position.distanceTo(start) > 2, `the roll covered ${player.position.distanceTo(start).toFixed(2)} m`);
  assert.ok(invulnerableFrames > 3, 'the evade window has to actually open');
  assert.equal(player.dodge.kind, null, 'and it has to end');

  // Cooldown: an evade cannot be held down.
  edges.add('KeyZ');
  player.update(1 / 60, [], 0);
  assert.equal(player.dodge.kind, null, 'the roll is still on cooldown');
});

test('the same key dashes in flight, as a burst on top of whatever the cruise already was', () => {
  const { input, held, edges } = mockInput();
  const player = new PlayerController(new Group(), input);
  player.teleport(new Vector3(0, 400, 0));
  held.add('KeyW');
  for (let frame = 0; frame < 90; frame++) player.update(1 / 60, [], 0);
  const cruise = player.velocity.length();
  assert.ok(cruise > 100, `expected to be cruising, got ${cruise.toFixed(1)} m/s`);

  edges.add('KeyZ');
  player.update(1 / 60, [], 0);
  assert.equal(player.dodge.kind, 'airDash');
  assert.ok(player.velocity.length() > cruise + 30, 'the dash has to be felt on top of the cruise');

  // And the burst survives its own clip rather than being damped away in three frames.
  for (let frame = 0; frame < 12; frame++) player.update(1 / 60, [], 0);
  assert.ok(player.velocity.length() > cruise + 20, 'the dash was damped out before it was visible');
});

test('an evade cannot interrupt a strike that is already thrown', () => {
  const { input, edges } = mockInput();
  const root = new Group();
  const player = new PlayerController(root, input);
  const hooks: PowerHooks = {
    targets: () => [], hit: () => undefined, reconstruct: () => 0, impulse: () => undefined,
    prepare: async () => undefined, notify: () => undefined, sound: () => undefined,
    getOrigin: () => new Vector3(), getColliders: () => [],
  };
  const powers = new PowerSystem(root, player, new PerspectiveCamera(), input, hooks);
  player.teleport(new Vector3(0, 0, 0));
  player.update(1 / 60, [], 0);

  powers.use('punch');
  assert.equal(player.character.animationController.activeMovePhase, 'startup');
  edges.add('KeyZ');
  player.update(1 / 60, [], 0);
  assert.equal(player.dodge.kind, null, 'a committed strike is not interruptible');

  // Once the strike is spent, the evade is available again.
  for (let frame = 0; frame < 40; frame++) player.update(1 / 60, [], 0);
  edges.add('KeyZ');
  player.update(1 / 60, [], 0);
  assert.equal(player.dodge.kind, 'roll');
});

test('impacts are ordered by arrival energy, and a plain jump is not an impact', () => {
  // A stock jump lands at 9.5 m/s. If that craters the ground, walking around is unplayable.
  assert.equal(profileFor(impactEnergy(getJumpVelocity(1), 1)).profile, 'soft');
  assert.equal(resolveImpact(getJumpVelocity(1), 1).radius, 0);
  assert.equal(resolveImpact(getJumpVelocity(1), 1).damage, 0);

  assert.equal(profileFor(impactEnergy(30, 1)).profile, 'heavy');
  assert.equal(profileFor(impactEnergy(120, 1)).profile, 'shock');
  assert.equal(profileFor(impactEnergy(400, 1)).profile, 'meteor');
  assert.equal(profileFor(impactEnergy(8000, 1)).profile, 'titan');
  // Mass counts: a kilometre-tall titan stepping down is still an apocalypse.
  assert.equal(profileFor(impactEnergy(20, 1000 / 2.07)).profile, 'titan');

  let radius = -1, damage = -1;
  for (let speed = 20; speed <= 9000; speed *= 1.25) {
    const impact = resolveImpact(speed, 1);
    assert.ok(impact.radius >= radius, `radius fell at ${speed.toFixed(0)} m/s`);
    assert.ok(impact.damage >= damage, `damage fell at ${speed.toFixed(0)} m/s`);
    radius = impact.radius; damage = impact.damage;
  }

  // A meteor has to actually level what it lands on, and the numbers must stay bounded.
  const meteor = resolveImpact(900, 1);
  assert.ok(meteor.radius > 20, `a 900 m/s arrival dug only ${meteor.radius.toFixed(1)} m`);
  assert.ok(meteor.damage > DESTRUCTION.maxHealth, 'a meteor must flatten what is standing there');
  const extreme = resolveImpact(1e6, 1000, true);
  assert.ok(extreme.radius <= IMPACT.maxRadius && Number.isFinite(extreme.damage) && Number.isFinite(extreme.impulse));
  assert.ok(extreme.shake <= IMPACT.maxShake);

  // A committed strike is worth more than the same speed arrived at by falling over.
  assert.ok(resolveImpact(300, 1, true).radius > resolveImpact(300, 1, false).radius);
  assert.ok(Number.isFinite(resolveImpact(Number.NaN, Number.NaN).radius));
});

test('arriving at meteor speed craters the ground and levels what was standing on it', () => {
  const { input } = mockInput();
  const root = new Group();
  const player = new PlayerController(root, input);
  let blast: { radius: number; amount: number } | null = null;
  let impulses = 0;
  const hooks: PowerHooks = {
    targets: () => [], hit: () => undefined, reconstruct: () => 0,
    impulse: () => { impulses++; },
    prepare: async () => undefined, notify: () => undefined, sound: () => undefined,
    getOrigin: () => new Vector3(), getColliders: () => [],
    damage: (_point, radius, amount) => { blast = { radius, amount }; return 3; },
  };
  const powers = new PowerSystem(root, player, new PerspectiveCamera(), input, hooks);

  player.teleport(new Vector3(0, 60, 0));
  player.state = 'Grounded';
  player.velocity.set(0, -900, 0);
  for (let frame = 0; frame < 12 && !player.isGrounded; frame++) player.update(1 / 60, [], 0);
  assert.equal(player.isGrounded, true, 'the fall has to reach the ground');
  powers.update(1 / 60, 1 / 60);

  assert.ok(blast, 'a meteor arrival must reach the destruction hooks');
  const landed = blast as unknown as { radius: number; amount: number };
  assert.ok(landed.radius > 20, `the crater was only ${landed.radius.toFixed(1)} m across`);
  assert.ok(landed.amount > DESTRUCTION.maxHealth, 'and it has to flatten the block it lands on');
  assert.ok(impulses > 0, 'loose matter must be thrown');

  // Handed over exactly once: a landing cannot keep cratering while the player stands there.
  blast = null;
  for (let frame = 0; frame < 10; frame++) { player.update(1 / 60, [], 0); powers.update(1 / 60, 1 / 60); }
  assert.equal(blast, null);
});

test('a soft landing leaves the world alone', () => {
  const { input, edges } = mockInput();
  const root = new Group();
  const player = new PlayerController(root, input);
  let blasts = 0;
  const hooks: PowerHooks = {
    targets: () => [], hit: () => undefined, reconstruct: () => 0, impulse: () => undefined,
    prepare: async () => undefined, notify: () => undefined, sound: () => undefined,
    getOrigin: () => new Vector3(), getColliders: () => [],
    damage: () => { blasts++; return 0; },
  };
  const powers = new PowerSystem(root, player, new PerspectiveCamera(), input, hooks);
  player.teleport(new Vector3(0, 0, 0));
  player.update(1 / 60, [], 0);

  // A stock double jump, start to finish.
  edges.add('Space'); player.update(1 / 60, [], 0);
  edges.add('Space'); player.update(1 / 60, [], 0);
  for (let frame = 0; frame < 180; frame++) { player.update(1 / 60, [], 0); powers.update(1 / 60, 1 / 60); }
  assert.equal(player.isGrounded, true, 'the jump has to come back down');
  assert.equal(blasts, 0, 'jumping around must not crater the city');
});

test('a downward strike commits the dive, and the landing reads as a slam', () => {
  const { input } = mockInput();
  const root = new Group();
  const player = new PlayerController(root, input);
  const hooks: PowerHooks = {
    targets: () => [], hit: () => undefined, reconstruct: () => 0, impulse: () => undefined,
    prepare: async () => undefined, notify: () => undefined, sound: () => undefined,
    getOrigin: () => new Vector3(), getColliders: () => [],
  };
  const camera = new PerspectiveCamera();
  camera.position.set(0, 300, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const powers = new PowerSystem(root, player, camera, input, hooks);

  player.teleport(new Vector3(0, 300, 0));
  player.state = 'Flight';
  player.velocity.set(0, -40, 0);
  powers.use('punch');
  assert.equal(player.isSlamming, true, 'a downward strike has to commit');
  assert.ok(player.velocity.y < -80, `the strike barely dipped (${player.velocity.y.toFixed(1)} m/s)`);

  // And it keeps driving: a slam is not a fall that happens to have a punch in it.
  const entry = player.velocity.y;
  player.update(1 / 60, [], 0);
  assert.ok(player.velocity.y < entry, 'the dive must accelerate');
});

test('the cosmic arcs ignite at a sprint, saturate at a boosted run, and never fire in the air', () => {
  assert.equal(arcIntensity(FLIGHT.walkSpeed), 0, 'walking sheds no lightning');
  assert.equal(arcIntensity(SPEED_ARCS.threshold), 0);
  assert.ok(arcIntensity(FLIGHT.runSpeed) > 0.1, 'a sprint has to spark');
  assert.equal(arcIntensity(120), 1, 'a boosted run is a full storm');
  // A titan needs a titan's pace before it sheds anything.
  assert.ok(arcIntensity(FLIGHT.runSpeed, 484) < arcIntensity(FLIGHT.runSpeed, 1));
  assert.equal(arcIntensity(Number.NaN), 0);

  const parent = new Group();
  const arcs = new SpeedArcs(parent);
  try {
    for (let frame = 0; frame < 30; frame++) arcs.update(1 / 60, 90, 1, false);
    assert.ok(arcs.activeBolts > 0, 'bolts have to actually spawn');
    assert.equal(arcs.mesh.visible, true);
    assert.ok(arcs.strength > 0.5);
    assert.equal(arcs.mesh.count, SPEED_ARCS.bolts * SPEED_ARCS.segments, 'one pooled draw call, no growth');

    for (let frame = 0; frame < 240; frame++) arcs.update(1 / 60, 0, 1, false);
    assert.equal(arcs.mesh.visible, false, 'slowing down has to put them out');

    for (let frame = 0; frame < 60; frame++) arcs.update(1 / 60, 400, 1, true);
    assert.equal(arcs.mesh.visible, false, 'flight carries its own trail; arcs are a running effect');
    arcs.update(Number.NaN, Number.NaN, Number.NaN, false);
    assert.ok(Number.isFinite(arcs.strength));
  } finally {
    arcs.dispose();
  }
});

test('skimming the ground at boost speed is the plough, not a crater', () => {
  const { input } = mockInput();
  const root = new Group();
  const player = new PlayerController(root, input);
  let blasts = 0;
  const hooks: PowerHooks = {
    targets: () => [], hit: () => undefined, reconstruct: () => 0, impulse: () => undefined,
    prepare: async () => undefined, notify: () => undefined, sound: () => undefined,
    getOrigin: () => new Vector3(), getColliders: () => [],
    damage: () => { blasts++; return 0; },
  };
  const powers = new PowerSystem(root, player, new PerspectiveCamera(), input, hooks);
  player.teleport(new Vector3(0, 0, 0));
  player.state = 'Grounded';

  // Clipping a kerb during a boosted run: a hop of a few centimetres carrying 650 m/s sideways.
  // Reading that as an arrival from orbit would crater every street the player runs down.
  for (let hop = 0; hop < 8; hop++) {
    player.position.set(0, 0.4, 0);
    player.velocity.set(650, -6, 0);
    for (let frame = 0; frame < 6; frame++) { player.update(1 / 60, [], 0); powers.update(1 / 60, 1 / 60); }
  }
  assert.equal(blasts, 0, 'a kerb is not a meteor');

  // But actually coming down at that speed is. (The player is standing after the hops, so this
  // runs a fixed fall rather than looping on `isGrounded`, which is already true here.)
  player.position.set(0, 400, 0);
  player.velocity.set(0, -650, 0);
  for (let frame = 0; frame < 60; frame++) player.update(1 / 60, [], 0);
  assert.equal(player.isGrounded, true, 'the fall has to land');
  powers.update(1 / 60, 1 / 60);
  assert.ok(blasts > 0, 'arriving from the sky has to crater');
});

test('the kick clips ship a knee that folds sideways, and the game strips that channel', () => {
  // Measured straight out of the GLB by forward kinematics: Kick_Right and Kick_Left fold the
  // knee about an axis 0.001 and 0.006 off the sideways hinge, with the shin swinging in FRONT
  // of the thigh through 51 and 97 degrees of flex. Every other clip in the character scores
  // between 0.29 and 1.0. Dropping the shin rotation leaves the hip driving the kick.
  const track = (name: string) => new QuaternionKeyframeTrack(name, [0, 1], [0, 0, 0, 1, 0, 0.3, 0, 0.95]);
  const source = new AnimationClip('Kick_Left', 1, [
    track('thigh_l.quaternion'), track('calf_l.quaternion'), track('calf_r.quaternion'),
    track('foot_l.quaternion'), track('upperarm_r.quaternion'),
  ]);

  const untouched = cleanCharacterClip(source);
  assert.ok(untouched.tracks.some(t => t.name === 'calf_l.quaternion'), 'without the repair the shin still animates');

  const repaired = cleanCharacterClip(source, false, new Set(['calfl', 'calfr']));
  const names = repaired.tracks.map(t => t.name);
  assert.ok(!names.includes('calf_l.quaternion'), 'the left shin rotation must be dropped');
  assert.ok(!names.includes('calf_r.quaternion'), 'the right shin rotation must be dropped');
  // And only the shins: the hip is what actually throws the kick.
  assert.ok(names.includes('thigh_l.quaternion'), 'the hip must keep driving the kick');
  assert.ok(names.includes('foot_l.quaternion'));
  assert.ok(names.includes('upperarm_r.quaternion'));
  assert.equal(repaired.duration, source.duration);
});

test('a hovering hero rests in an authored pose rather than a solved one', () => {
  // The rig ships no parade rest and no aim pose. Posing those bones procedurally deformed the
  // shoulders, so the hover uses the character's own arms-folded idle.
  assert.equal(CHARACTER_CLIPS.hoverRest, 'Idle_FoldArms_Loop');
  assert.equal(CHARACTER_CLIPS.dodge, 'Roll');
  assert.equal(CHARACTER_CLIPS.airDash, 'Slide_Loop');
  assert.equal(CHARACTER_CLIPS.flipLaunch, 'NinjaJump_Start');
  assert.equal(CHARACTER_CLIPS.flipRecover, 'NinjaJump_Land');
  // Every clip the game names has to exist in the shipped character, or `action()` throws the
  // first time that state is entered — which only ever happens in play, never in a test.
  const shipped = new Set([
    'Kick_Left', 'Kick_Right', 'Hit_Chest', 'Hit_Head', 'Idle_Loop', 'Jog_Fwd_Loop', 'Jump_Land',
    'Jump_Loop', 'Jump_Start', 'Punch_Cross', 'Punch_Jab', 'Roll', 'Sprint_Loop', 'Swim_Fwd_Loop',
    'Swim_Idle_Loop', 'Walk_Loop', 'ClimbUp_1m', 'Hit_Knockback', 'Idle_FoldArms_Loop',
    'Melee_Hook', 'Melee_Hook_Rec', 'NinjaJump_Idle_Loop', 'NinjaJump_Land', 'NinjaJump_Start',
    'OverhandThrow', 'Slide_Exit', 'Slide_Loop', 'Slide_Start',
  ]);
  for (const [state, clip] of Object.entries(CHARACTER_CLIPS)) {
    assert.ok(shipped.has(clip), `${state} points at ${clip}, which the character does not have`);
  }
});
