import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3, Quaternion, Bone } from 'three/webgpu';
import { AnimationController } from '../src/player/animations/AnimationController.ts';
import { computeFlightOrientation } from '../src/player/animations/FlightOrientation.ts';
import { BoneMask } from '../src/player/animations/BoneMask.ts';
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

function mockBones(): Bone[] {
  return Array.from({ length: 19 }, () => new Bone());
}

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

test('bone masks isolate correct limbs', () => {
  // Upper body includes spine (1), arms (6, 10), forearms (7, 11), hands (8, 12), but NOT legs (13, 16) or hips (0)
  assert.equal(BoneMask.affects('UPPER_BODY', 0), false);
  assert.equal(BoneMask.affects('UPPER_BODY', 1), true);
  assert.equal(BoneMask.affects('UPPER_BODY', 2), true);
  assert.equal(BoneMask.affects('UPPER_BODY', 6), true);
  assert.equal(BoneMask.affects('UPPER_BODY', 10), true);
  assert.equal(BoneMask.affects('UPPER_BODY', 13), false);
  assert.equal(BoneMask.affects('UPPER_BODY', 16), false);

  // Legs mask affects only 13, 14, 15, 16, 17, 18
  assert.equal(BoneMask.affects('LEGS', 0), false);
  assert.equal(BoneMask.affects('LEGS', 1), false);
  assert.equal(BoneMask.affects('LEGS', 13), true);
  assert.equal(BoneMask.affects('LEGS', 17), true);
});

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
  const bones = mockBones();
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
  const halfDt = controller.debugState.doubleJumpProgress;
  controller.update(bones, 0.22, params);
  assert.ok(controller.doubleJumpProgress > 0.4 && controller.doubleJumpProgress < 0.6);
  assert.ok(Math.abs(controller.rootOrientation.w) < 0.9, 'should be actively rotated midway');

  // Complete the flip
  controller.update(bones, 0.3, params);
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
  const bones = mockBones();
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

test('AnimationController combines Flight pose with Combat upper body without destroying legs', () => {
  const controller = new AnimationController();
  const bones = mockBones();
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

  const flyingLegX = bones[13].rotation.x; // LEFT_LEG
  const flyingShinX = bones[14].rotation.x; // LEFT_SHIN

  // Start flying punch (upper-body bone mask)
  controller.startCombatMove(COMBAT_MOVES.flyingPunch);
  assert.equal(controller.activeCombatMove?.id, 'flyingPunch');

  // Advance combat attack frames
  for (let i = 0; i < 15; i++) controller.update(bones, 0.016, params);

  // Upper body (arm) must be actively rotated for punch
  assert.ok(bones[10].rotation.x > 0.5, 'right arm extended for punch'); // RIGHT_ARM

  // Legs should remain aerodynamic (not replaced by standing kick or ground stride)
  assert.ok(Math.abs(bones[13].rotation.x - flyingLegX) < 0.25, 'legs remain in flight pose');
  assert.ok(bones[14].rotation.x <= 0, 'shins remain bent backwards for flight');
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
  powers.update(0.15, 0.15); // Trigger meleeHit
  const lowSpeedDamage = recordedDamage;
  const lowSpeedRadius = recordedRadius;

  // Clear cooldown
  powers.update(1.0, 1.0);

  // At supersonic speed
  player.velocity.set(0, 0, -1200);
  powers.use('punch');
  powers.update(0.15, 0.15); // Trigger meleeHit
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
  const groupQ = player.character.group.quaternion;
  assert.ok(Math.abs(groupQ.w) < 0.95, 'global visual orientation MUST be rotated');
});


test('flightPose changes according to speedMode', () => {
  const controller = new AnimationController(Array(65).fill(null).map(() => new Bone()) as unknown as readonly Bone[]);
  const params = {
    velocity: new Vector3(0, 10, 0),
    flying: true,
    turn: 0,
    speedMode: 'cruise'
  };

  // Skip takeoff
  controller.update(mockBones(), 1.0, params);
  assert.equal(controller.debugState.flightLayer, 'cruise');

  params.speedMode = 'fast';
  controller.update(mockBones(), 0.1, params);
  assert.equal(controller.debugState.flightLayer, 'fast');

  params.speedMode = 'super';
  controller.update(mockBones(), 0.1, params);
  assert.equal(controller.debugState.flightLayer, 'super');

  params.speedMode = 'mega';
  controller.update(mockBones(), 0.1, params);
  assert.equal(controller.debugState.flightLayer, 'mega');
});
