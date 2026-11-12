import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { PowerSystem, type PowerHooks } from '../src/player/powers/PowerSystem';
import { AlienFloraRenderer } from '../src/world/life/AlienFloraRenderer';
import { AlienFaunaManager } from '../src/world/life/AlienFaunaManager';
import { AlienSettlementManager } from '../src/world/life/AlienSettlementManager';
import { CosmicAnomaliesAndRuinsManager } from '../src/world/life/CosmicAnomaliesAndRuinsManager';
import { PlanetaryHazardRenderer } from '../src/world/life/PlanetaryHazardRenderer';
import { SaveManager } from '../src/core/SaveManager';
import type { PlayerController } from '../src/player/PlayerController';
import type { InputController } from '../src/player/InputController';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { PlanetaryBiosphereProfile } from '../src/world/life/PlanetaryBiosphere';

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

const mockSurface: PlanetSurfaceGenerator = {
  body: { id: 'alien-planet', name: 'Alien Planet', frameId: 'alien-frame', equatorialRadiusM: 4_000_000, polarRadiusM: 4_000_000, massKg: 3e24 },
  radiusM: 4_000_000,
  heightAt: () => 12.5,
  normalEnu: (_dir, out) => { out[0] = 0; out[1] = 1; out[2] = 0; },
} as unknown as PlanetSurfaceGenerator;

const mockBiosphere: PlanetaryBiosphereProfile = {
  bodyId: 'alien-planet',
  lifeTier: 'civilized',
  habitabilityScore: 0.85,
  civilizationStage: 'ancient-ruins-guardians',
  dominantFaunaType: 'chitinous-quadrupeds',
  floraDensity: 0.8,
  hazardAffliction: 'none',
  seeds: { floraSeed: 42, faunaSeed: 137, factionSeed: 999 },
} as unknown as PlanetaryBiosphereProfile;

test('T_VIVO17_01_ECOSYSTEM_REFERENCE_FRAME_AND_LIFE_ROOT', () => {
  const actorRoot = new Group();
  actorRoot.name = 'actorRoot';
  const activePlanetaryLifeRoot = new Group();
  activePlanetaryLifeRoot.name = 'activePlanetaryLifeRoot';
  actorRoot.add(activePlanetaryLifeRoot);

  const save = new SaveManager();
  save.reset();

  const flora = new AlienFloraRenderer();
  activePlanetaryLifeRoot.add(flora.root);

  const fauna = new AlienFaunaManager();
  activePlanetaryLifeRoot.add(fauna.root);

  const settlements = new AlienSettlementManager(save);
  activePlanetaryLifeRoot.add(settlements.root);

  const ruins = new CosmicAnomaliesAndRuinsManager(save);
  activePlanetaryLifeRoot.add(ruins.root);

  const hazard = new PlanetaryHazardRenderer(activePlanetaryLifeRoot);

  // Verify all life entities belong to activePlanetaryLifeRoot inside actorRoot
  assert.equal(flora.root.parent, activePlanetaryLifeRoot);
  assert.equal(fauna.root.parent, activePlanetaryLifeRoot);
  assert.equal(settlements.root.parent, activePlanetaryLifeRoot);
  assert.equal(ruins.root.parent, activePlanetaryLifeRoot);
  assert.equal(hazard.root.parent, activePlanetaryLifeRoot);
  assert.equal(activePlanetaryLifeRoot.parent, actorRoot);

  // Populate ecosystem on alien-planet
  const playerPos = new Vector3(0, 15, 0);
  flora.update(playerPos, mockSurface, mockBiosphere);
  fauna.update(0.1, playerPos, mockSurface, mockBiosphere);
  settlements.update(0.1, playerPos, mockSurface, mockBiosphere);
  ruins.update(0.1, playerPos, mockSurface, mockBiosphere);

  assert.ok(ruins.ruins.length > 0, 'Ruins must be generated');
  assert.ok(ruins.colossi.length > 0, 'Colossi must be generated');
  // Check ruin coordinates are in local ENU space (distance < 500m), NOT planet-center radius (4,000,000m)
  for (const r of ruins.ruins) {
    assert.ok(r.position.distanceTo(playerPos) < 1000, `Ruin ${r.id} must be in local ENU space`);
  }

  // Clear ecosystem when transitioning bodies
  flora.clear();
  fauna.clear();
  settlements.clear();
  ruins.clear();

  assert.equal(ruins.ruins.length, 0, 'Ruins must be cleared');
  assert.equal(ruins.colossi.length, 0, 'Colossi must be cleared');
  assert.equal(fauna.targets.length, 0, 'Fauna must be cleared');

  // Dispose cleanup
  flora.dispose();
  fauna.dispose();
  settlements.dispose();
  ruins.dispose();
  hazard.dispose();

  assert.equal(flora.root.parent, null);
  assert.equal(fauna.root.parent, null);
  assert.equal(settlements.root.parent, null);
  assert.equal(ruins.root.parent, null);
  assert.equal(hazard.root.parent, null);
});

test('T_VIVO17_02_PLANET_RUPTURE_STATE_MACHINE_AND_HOLD_CHARGE', () => {
  const root = new Group();
  const player = createMockPlayer();
  const camera = new PerspectiveCamera();
  const input = createMockInput();

  let targetRuptured: string | null = null;
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
    getActiveBodyId: () => 'mars',
    planetRupture: (bodyId) => {
      targetRuptured = bodyId;
      return true;
    },
  };

  const powers = new PowerSystem(root, player, camera, input, hooks);

  // 1. Initial state
  assert.equal(powers.planetRuptureState, 'idle');
  assert.equal(powers.planetRuptureCharge, 0);

  // 2. Selecting does not execute
  powers.use('planetRupture');
  assert.equal(powers.selected, 'planetRupture');
  assert.equal(powers.planetRuptureState, 'idle');
  assert.equal(targetRuptured, null);

  // 3. Early cancel
  input.press('Digit9');
  powers.update(0.8, 0.8);
  assert.equal(powers.planetRuptureState, 'charging');
  assert.ok(powers.planetRuptureCharge >= 0.8);
  assert.ok(powers.planetRuptureProgress > 0 && powers.planetRuptureProgress < 1);
  input.release('Digit9');
  powers.update(0.016, 0.016);
  assert.equal(powers.planetRuptureState, 'idle');
  assert.equal(powers.planetRuptureCharge, 0);
  assert.equal(targetRuptured, null);

  // 4. Full 2.5s charge execution
  input.press('Digit9');
  powers.update(1.0, 1.0);
  assert.equal(powers.planetRuptureState, 'charging');
  powers.update(1.6, 1.6); // Total 2.6s >= 2.5s
  assert.equal(targetRuptured, 'mars', 'Mars must be ruptured');
  assert.equal(powers.cooldowns.planetRupture, 5.0);
  assert.equal(powers.planetRuptureState, 'cooldown');

  // 5. Holding while on cooldown does NOT retrigger (Single trigger = single execution)
  powers.update(2.0, 2.0);
  assert.equal(powers.planetRuptureState, 'cooldown');
  powers.update(3.1, 3.1); // Cooldown expires while still holding key
  assert.equal(powers.planetRuptureState, 'idle');
  // Because key was held without release, it must not start charging
  assert.equal(powers.planetRuptureCharge, 0);

  // 6. Release and press again allows new activation
  input.release('Digit9');
  powers.update(0.016, 0.016);
  input.press('Digit9');
  powers.update(0.5, 0.5);
  assert.equal(powers.planetRuptureState, 'charging');
  assert.ok(powers.planetRuptureCharge >= 0.5);

  powers.dispose();
});
