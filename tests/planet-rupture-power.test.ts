import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { PowerSystem, type PowerHooks } from '../src/player/powers/PowerSystem';
import { MacroBodyFractureService } from '../src/world/destruction/MacroBodyFractureService';
import { MinorBodyDisruptionService } from '../src/world/destruction/MinorBodyDisruptionService';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface';
import { SaveManager } from '../src/core/SaveManager';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlayerController } from '../src/player/PlayerController';
import type { InputController } from '../src/player/InputController';

const mockEarthBody: CelestialBody = {
  id: 'earth',
  name: 'Earth',
  frameId: 'earth-frame',
  equatorialRadiusM: 6378137,
  polarRadiusM: 6356752,
  massKg: 5.972e24,
};

const mockPhobosBody: CelestialBody = {
  id: 'phobos',
  name: 'Phobos',
  frameId: 'phobos-frame',
  parentId: 'mars',
  equatorialRadiusM: 11_260,
  massKg: 1.06e16,
};

function createMockPlayer(): PlayerController {
  return {
    size: 1,
    position: new Vector3(0, 50, 0),
    velocity: new Vector3(0, 0, 0),
    state: 'Flying',
    isGrounded: false,
    facingYaw: 0,
    model: new Group(),
    character: {
      skinnedMeshes: [],
      initializeAnimations: async () => {},
      startCombatMove: () => {},
      aimEnergy: () => {},
      dispose: () => {},
      leftFoot: new Group(),
      rightFoot: new Group(),
      leftHand: new Group(),
      rightHand: new Group(),
      group: new Group(),
    },
    powerPose: () => {},
    teleport: () => {},
    setSize: () => {},
    beginSlam: () => {},
    consumeImpact: () => null,
  } as unknown as PlayerController;
}

function createMockInput(): InputController {
  const heldKeys = new Set<string>();
  const consumedKeys = new Set<string>();
  return {
    enabled: true,
    held: (k: string) => heldKeys.has(k),
    consume: (k: string) => {
      const had = consumedKeys.has(k);
      consumedKeys.delete(k);
      return had;
    },
    press: (k: string) => {
      consumedKeys.add(k);
      heldKeys.add(k);
    },
    release: (k: string) => {
      heldKeys.delete(k);
    },
  } as unknown as InputController;
}

test('T_RUPTURE_01_POWER_HOOK_TRIGGER', () => {
  const root = new Group();
  const player = createMockPlayer();
  const camera = new PerspectiveCamera();
  const input = createMockInput();

  let hookBodyId: string | null = null;
  let hookEnergy = 0;
  const notifications: string[] = [];

  const hooks: PowerHooks = {
    targets: () => [],
    hit: () => {},
    reconstruct: () => 0,
    impulse: () => {},
    prepare: async () => {},
    notify: msg => notifications.push(msg),
    sound: () => {},
    getOrigin: () => new Vector3(),
    getColliders: () => [],
    getActiveBodyId: () => 'earth',
    planetRupture: (bodyId, energy) => {
      hookBodyId = bodyId;
      hookEnergy = energy;
      return true;
    },
  };

  const powers = new PowerSystem(root, player, camera, input, hooks);

  // 1. Selecting planet rupture MUST NOT execute immediately
  powers.use('planetRupture');
  assert.equal(powers.selected, 'planetRupture');
  assert.equal(powers.planetRuptureState, 'idle', 'State must remain idle after arming');
  assert.equal(hookBodyId, null, 'Must not execute upon arming/selection');
  assert.ok(notifications.some(n => n.includes('Ruptura planetária armada')));

  // 2. Early release cancels charge
  input.press('Digit9');
  powers.update(1.0, 1.0);
  assert.equal(powers.planetRuptureState, 'charging', 'Must enter charging state while held');
  assert.ok(powers.planetRuptureCharge >= 1.0);
  input.release('Digit9');
  powers.update(0.016, 0.016);
  assert.equal(powers.planetRuptureState, 'idle', 'Early release must abort back to idle');
  assert.equal(powers.planetRuptureCharge, 0, 'Charge must reset to 0');
  assert.equal(hookBodyId, null, 'No rupture executed on early release');

  // 3. Full 2.5s charge triggers execution and initiates cooldown
  input.press('Digit9');
  powers.update(1.2, 1.2);
  powers.update(1.4, 1.4); // total charge = 2.6s >= 2.5s
  assert.equal(hookBodyId, 'earth', 'Dominant body must be passed to planetRupture hook');
  assert.equal(hookEnergy, 1e28, 'Planetary rupture energy must match canonical 1e28 Joules');
  assert.equal(powers.cooldowns.planetRupture, 5.0, 'Cooldown must be set to 5.0s');
  assert.equal(powers.planetRuptureState, 'cooldown', 'State must enter cooldown');
  assert.ok(notifications.some(n => n.includes('Ruptura planetária catastrófica executada')));

  // 4. Holding while on cooldown must not trigger or charge
  powers.update(1.0, 1.0);
  assert.equal(powers.planetRuptureState, 'cooldown');
  assert.equal(powers.planetRuptureCharge, 0);

  // 5. Cooldown expiration returns state to idle
  powers.update(4.1, 4.1);
  assert.equal(powers.planetRuptureState, 'idle');

  powers.dispose();
});

test('T_RUPTURE_01B_TARGET_RESOLUTION_PRIORITY', () => {
  const root = new Group();
  const player = createMockPlayer();
  const camera = new PerspectiveCamera();
  const input = createMockInput();

  let targetLock: string | null = 'mars';
  let executedTarget: string | null = null;

  const hooks: PowerHooks = {
    targets: () => [],
    hit: () => {},
    reconstruct: () => 0,
    impulse: () => {},
    prepare: async () => {},
    notify: () => {},
    sound: () => {},
    getOrigin: () => new Vector3(),
    getColliders: () => [],
    getTargetBodyId: () => targetLock,
    getActiveBodyId: () => 'earth',
    planetRupture: (bodyId) => {
      executedTarget = bodyId;
      return true;
    },
  };

  const powers = new PowerSystem(root, player, camera, input, hooks);

  // When targetLock exists, it takes precedence over dominant body (mars > earth)
  input.press('Digit9');
  powers.update(2.6, 2.6);
  assert.equal(executedTarget, 'mars', 'Navigation lock target must take precedence over active dominant body');

  // Release trigger and clear cooldown for next activation
  input.release('Digit9');
  targetLock = null;
  powers.cooldowns.planetRupture = 0;
  powers.update(0.016, 0.016);
  assert.equal(powers.planetRuptureState, 'idle');

  input.press('Digit9');
  powers.update(2.6, 2.6);
  assert.equal(executedTarget, 'earth', 'Fallback to active dominant body when no explicit lock');

  powers.dispose();
});

test('T_RUPTURE_02_MACRO_PLANET_RUPTURE', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new MacroBodyFractureService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
    bodyById: id => (id === 'earth' ? mockEarthBody : undefined),
  });

  const plan = service.rupturePlanet('earth', 1e28);
  assert.ok(plan, 'Rupture plan must be generated');
  assert.equal(plan.state, 'RUPTURED', 'Plan state must be RUPTURED');
  assert.equal(service.isBodyFracturedOrRuptured('earth'), true);

  // Check orthogonal fissure cap CSG subtract edits
  const earthEdits = edits.editsForBody('earth');
  assert.ok(earthEdits.length >= 6, 'Must generate primary cavity and orthogonal antipodal rupture caps');
  assert.ok(earthEdits.some(e => e.id.includes('rupture_cap')));

  // Check Keplerian debris ring
  assert.ok(plan.debrisRing.fragments.length > 0, 'Debris ring must contain discrete Keplerian fragments');
  assert.equal(plan.debrisRing.parentBodyId, 'earth');
  assert.ok(plan.debrisRing.outerRadiusM > plan.debrisRing.innerRadiusM);
});

test('T_RUPTURE_03_SAVE_PERSISTENCE', () => {
  const save = new SaveManager();
  save.reset();

  assert.equal(save.isBodyRuptured('earth'), false, 'Initial state must be unruptured');

  save.recordBodyRupture('earth');
  assert.equal(save.isBodyRuptured('earth'), true, 'Body must be marked as ruptured');
  assert.ok(save.data.rupturedBodies?.includes('earth'));

  // Duplicate record must be idempotent
  save.recordBodyRupture('earth');
  assert.equal(save.data.rupturedBodies?.filter(b => b === 'earth').length, 1);

  // Restoration removes from save data
  save.recordBodyRestoration('earth');
  assert.equal(save.isBodyRuptured('earth'), false);
  assert.ok(!save.data.rupturedBodies?.includes('earth'));
});

test('T_RUPTURE_04_PLANETARY_RECONSTRUCTION', () => {
  const root = new Group();
  const player = createMockPlayer();
  const camera = new PerspectiveCamera();
  const input = createMockInput();

  const edits = new PlanetVolumeEditStore();
  const service = new MacroBodyFractureService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
    bodyById: id => (id === 'earth' ? mockEarthBody : undefined),
  });

  // Rupture planet
  service.rupturePlanet('earth', 1e28);
  assert.ok(edits.editsForBody('earth').length > 0);
  assert.equal(service.isBodyFracturedOrRuptured('earth'), true);

  const notifications: string[] = [];
  const hooks: PowerHooks = {
    targets: () => [],
    hit: () => {},
    reconstruct: () => 0,
    impulse: () => {},
    prepare: async () => {},
    notify: msg => notifications.push(msg),
    sound: () => {},
    getOrigin: () => new Vector3(),
    getColliders: () => [],
    getActiveBodyId: () => 'earth',
    restoreBody: bodyId => service.restorePlanet(bodyId),
  };

  const powers = new PowerSystem(root, player, camera, input, hooks);

  // Call reconstruct
  powers.use('reconstruct');

  assert.equal(service.isBodyFracturedOrRuptured('earth'), false, 'Planet must be restored');
  assert.equal(edits.editsForBody('earth').length, 0, 'All rupture CSG edits must be wiped');
  assert.ok(notifications.some(n => n.includes('Reconstrução cósmica · corpo celeste [earth] restaurado.')));

  powers.dispose();
});

test('T_RUPTURE_05_MINOR_BODY_DISRUPTION_AND_RESTORATION', () => {
  const edits = new PlanetVolumeEditStore();
  const service = new MinorBodyDisruptionService({
    edits,
    bodyById: id => (id === 'phobos' ? mockPhobosBody : undefined),
  });

  const plan = service.disruptMinorBody('phobos', 1e25);
  assert.ok(plan, 'Phobos must be disrupted');
  assert.equal(plan.state, 'DISRUPTED');
  assert.equal(service.isBodyDisrupted('phobos'), true);
  assert.equal(plan.asteroidField.fragments.length, 32);

  const restored = service.restoreBody('phobos');
  assert.equal(restored, true, 'Minor body restoration must succeed');
  assert.equal(service.isBodyDisrupted('phobos'), false, 'Phobos must no longer be disrupted');
});

