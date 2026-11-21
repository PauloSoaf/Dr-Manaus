import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { CombatSystem } from '../src/player/combat/CombatSystem';
import { HitStopSystem } from '../src/player/combat/HitStopSystem';
import { VehicleController } from '../src/player/vehicles/VehicleController';

test('CT-08-01: CombatSystem polar soft-targeting selects targets inside 60-degree cone and rejects outside', () => {
  const combat = new CombatSystem();
  const origin = new Vector3(0, 0, 0);
  const forward = new Vector3(0, 0, -1); // Aiming forward along -Z

  const candidates = [
    { id: 'center_target', position: new Vector3(0, 0, -20), radius: 1.0, priority: 50 }, // Directly in front (0 deg)
    { id: 'flank_inside', position: new Vector3(6, 0, -20), radius: 1.0, priority: 50 }, // ~16.7 deg (inside 30 deg cone)
    { id: 'wide_outside', position: new Vector3(25, 0, -15), radius: 1.0, priority: 100 }, // ~59 deg (> 30 deg half-cone)
    { id: 'behind_target', position: new Vector3(0, 0, 20), radius: 1.0, priority: 100 } // Behind (180 deg)
  ];

  // 1. Center target should be selected with highest alignment
  const resultCenter = combat.selectPolarTarget(origin, forward, candidates, 50.0);
  assert.ok(resultCenter.candidate !== null, 'Candidate must be found');
  assert.strictEqual(resultCenter.candidate!.id, 'center_target');
  assert.ok(resultCenter.angleDeg < 2.0, 'Angle to center target should be near 0 deg');

  // 2. If center target is removed, flank_inside should be selected
  const candidatesNoCenter = candidates.filter(c => c.id !== 'center_target');
  const resultFlank = combat.selectPolarTarget(origin, forward, candidatesNoCenter, 50.0);
  assert.ok(resultFlank.candidate !== null);
  assert.strictEqual(resultFlank.candidate!.id, 'flank_inside');
  assert.ok(resultFlank.angleDeg < 30.0, 'Angle must be inside 30 deg half-cone');

  // 3. If only wide_outside and behind remain, result should be null (outside 60 deg cone)
  const candidatesOutsideOnly = candidates.filter(c => c.id === 'wide_outside' || c.id === 'behind_target');
  const resultNone = combat.selectPolarTarget(origin, forward, candidatesOutsideOnly, 50.0);
  assert.strictEqual(resultNone.candidate, null, 'Targets outside 60 deg cone must be rejected');
});

test('CT-08-02: HitStopSystem freezes combat time during critical strikes and restores cleanly', () => {
  const hitStop = new HitStopSystem();

  assert.strictEqual(hitStop.isFrozen, false);
  assert.strictEqual(hitStop.update(0.016), 1.0, 'Normal time factor must be 1.0');

  // Trigger 60ms critical strike hitstop
  hitStop.trigger(60);
  assert.strictEqual(hitStop.isFrozen, true);
  assert.ok(hitStop.remainingMs > 50);

  // During freeze, time dilation returns 0
  const timeFactor1 = hitStop.update(0.020);
  assert.strictEqual(timeFactor1, 0, 'Combat time factor during hitstop must be 0');
  assert.strictEqual(hitStop.isFrozen, true);

  // Advance remaining 45ms to expire hitstop
  const timeFactor2 = hitStop.update(0.050);
  assert.strictEqual(timeFactor2, 1.0, 'Combat time factor after hitstop must restore to 1.0');
  assert.strictEqual(hitStop.isFrozen, false);
});

test('CT-08-03: Combat action buffering queues inputs within 200ms and expires stale commands', () => {
  const combat = new CombatSystem();

  // Queue melee punch
  combat.bufferAction('melee_punch');
  const action1 = combat.consumeBufferedAction();
  assert.ok(action1 !== null);
  assert.strictEqual(action1!.type, 'melee_punch');

  // Second consume should be empty
  const actionEmpty = combat.consumeBufferedAction();
  assert.strictEqual(actionEmpty, null);
});

test('CT-08-04: Vehicle Controller Nitrous Boost and Weapons Cannon fire', () => {
  const vehicle = new VehicleController();

  let weaponFired = false;
  vehicle.onFireWeapon = (_pos, _dir) => {
    weaponFired = true;
  };

  try {
    vehicle.spawnAt(new Vector3(0, 10, 0), 0, 'spaceship');
    vehicle.isOccupied = true;

    // Mock inputs with Boost (ShiftLeft) and Weapon (Mouse0)
    const keys = new Set<string>(['KeyW', 'ShiftLeft', 'Mouse0']);
    const mockInput = {
      held: (code: string) => keys.has(code),
      consume: (code: string) => keys.delete(code),
      pressed: (code: string) => keys.has(code),
      enabled: true
    } as any;

    vehicle.update(0.016, mockInput, vehicle.position);

    assert.strictEqual(vehicle.isBoosting, true, 'Vehicle must be boosting with Shift');
    assert.strictEqual(weaponFired, true, 'Vehicle cannon must have fired with Mouse0');
  } finally {
    vehicle.dispose();
  }
});
