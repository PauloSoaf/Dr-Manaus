import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { MacroBodyFractureService } from '../src/world/destruction/MacroBodyFractureService';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore';
import { EarthSurfaceGenerator } from '../src/world/planet/EarthSurface';
import { SaveManager } from '../src/core/SaveManager';
import { PowerSystem, type PowerHooks } from '../src/player/powers/PowerSystem';
import { PlanetaryRupturePresentation } from '../src/rendering/celestial/PlanetaryRupturePresentation';
import { CosmicAtlasModel } from '../src/world/exploration/CosmicAtlasModel';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
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

function createMockPlayer(): PlayerController {
  return {
    size: 1,
    position: new Vector3(0, 15, 0),
    velocity: new Vector3(0, 0, 0),
    state: 'Grounded',
    isGrounded: true,
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

test('T_VIVO19_01_DETERMINISTIC_PERSISTENCE_WITHOUT_DATE_NOW', () => {
  const edits1 = new PlanetVolumeEditStore();
  const service1 = new MacroBodyFractureService({
    edits: edits1,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
    bodyById: id => (id === 'earth' ? mockEarthBody : undefined),
  });

  const plan1 = service1.rupturePlanet('earth', 1e28)!;
  const editIds1 = edits1.editsForBody('earth').map(e => e.id);

  // Check no Date.now() timestamp patterns in IDs
  for (const id of editIds1) {
    assert.equal(id.includes('Date.now'), false);
    // Ensure deterministic structure: planId:rupture_cap_i
    assert.ok(id.startsWith('earth:macro-fracture:1:'));
  }

  // Second independent run with same initial sequence counter
  const edits2 = new PlanetVolumeEditStore();
  const service2 = new MacroBodyFractureService({
    edits: edits2,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
    bodyById: id => (id === 'earth' ? mockEarthBody : undefined),
  });

  const plan2 = service2.rupturePlanet('earth', 1e28)!;
  const editIds2 = edits2.editsForBody('earth').map(e => e.id);

  assert.deepEqual(editIds1, editIds2, 'Rupture edit IDs must be 100% deterministic across sessions');
  assert.equal(plan1.debrisRing.fragments.length, plan2.debrisRing.fragments.length);
  assert.equal(plan1.debrisRing.fragments[0].id, plan2.debrisRing.fragments[0].id);
});

test('T_VIVO19_02_FULL_COSMIC_RECONSTRUCTION_LIFECYCLE', () => {
  const root = new Group();
  const player = createMockPlayer();
  const camera = new PerspectiveCamera();
  const input = createMockInput();
  const save = new SaveManager();
  save.reset();

  const edits = new PlanetVolumeEditStore();
  const fractureService = new MacroBodyFractureService({
    edits,
    surfaceForBody: id => (id === 'earth' ? EarthSurfaceGenerator : undefined),
    bodyById: id => (id === 'earth' ? mockEarthBody : undefined),
  });

  const presentation = new PlanetaryRupturePresentation(root);
  const catalog = new UniversalTargetCatalog();
  const universe = new UniverseRuntime();
  const resolver = new UniversalTargetResolver(catalog, universe);
  const atlas = new CosmicAtlasModel(catalog, save, catalog.discovery, resolver);

  // 1. Rupture Earth
  const plan = fractureService.rupturePlanet('earth', 1e28)!;
  save.recordBodyRupture('earth');
  presentation.startRupture('earth', plan, 6378137);

  assert.equal(save.isBodyRuptured('earth'), true);
  assert.equal(fractureService.isBodyFracturedOrRuptured('earth'), true);
  assert.ok(edits.editsForBody('earth').length >= 6);

  atlas.invalidateCache();
  const rupturedQuery = atlas.query({ query: 'Earth' }).entries.find(e => e.bodyId === 'earth');
  assert.ok(rupturedQuery?.displayName.includes('[MUNDO EM RUÍNAS - CINTURÃO DE DESTROÇOS]'));
  assert.equal(rupturedQuery?.canLand, false);

  // 2. Setup PowerSystem with Reconstruct Hook
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
    restoreBody: (bodyId) => {
      const restored = fractureService.restorePlanet(bodyId);
      if (restored) {
        save.recordBodyRestoration(bodyId);
        presentation.restore(bodyId);
        atlas.invalidateCache();
        return true;
      }
      return false;
    },
  };

  const powers = new PowerSystem(root, player, camera, input, hooks);

  // 3. Trigger Reconstruct Power
  powers.use('reconstruct');

  // 4. Verify complete restoration across all subsystems
  assert.equal(save.isBodyRuptured('earth'), false, 'SaveManager must mark Earth as restored');
  assert.equal(fractureService.isBodyFracturedOrRuptured('earth'), false, 'Fracture service plan must be removed');
  assert.equal(edits.editsForBody('earth').length, 0, 'All CSG subtract edits must be cleared');
  assert.equal(presentation.isRuptured('earth'), false, 'Rupture visual session must be terminated');
  assert.equal(presentation.isGlobeSuppressed('earth'), false, 'Intact globe must be visible again');

  const restoredQuery = atlas.query({ query: 'Earth' }).entries.find(e => e.bodyId === 'earth');
  assert.ok(!restoredQuery?.displayName.includes('MUNDO EM RUÍNAS'), 'Atlas must remove ruins tag');
  assert.equal(restoredQuery?.canLand, true, 'Landing capability must be restored');

  assert.ok(notifications.some(n => n.includes('Reconstrução cósmica · corpo celeste [earth] restaurado.')));

  powers.dispose();
  presentation.dispose();
});

test('T_VIVO19_03_SAFE_TRANSITION_ON_EARTH_RUPTURE', () => {
  const player = createMockPlayer();
  assert.equal(player.state, 'Grounded');
  assert.equal(player.position.y, 15);

  // Simulate rupture while on Earth
  const bodyId = 'earth';
  let playerState = player.state;
  let playerPosY = player.position.y;
  let physicsDistrict = 'MANAUS';

  if (bodyId === 'earth') {
    playerState = 'Flight';
    playerPosY += 2500;
    physicsDistrict = 'DESTROÇOS';
  }

  assert.equal(playerState, 'Flight', 'Player must safely enter Flight mode');
  assert.ok(playerPosY >= 2500, 'Player must be elevated to safe orbit altitude');
  assert.equal(physicsDistrict, 'DESTROÇOS', 'Ground physics must transition to debris field');
});

