import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBlackHoleTransitExit,
  BlackHoleTransitController,
} from '../src/world/travel/BlackHoleTransitNetwork';
import {
  SAGITTARIUS_A_STAR,
  M31_CENTRAL_BLACK_HOLE,
  generateStellarBlackHole,
} from '../src/world/celestial/BlackHoleDescriptor';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { SaveManager } from '../src/core/SaveManager';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { SPEED_OF_LIGHT } from '../src/world/celestial/BlackHoleDescriptor';

function mockStorage(initial: Record<string, string> = {}): { restore: () => void; store: Map<string, string> } {
  const previous = globalThis.localStorage;
  const store = new Map<string, string>(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
  return {
    restore: () => { globalThis.localStorage = previous; },
    store,
  };
}

test('T_BH2_01_SAGITTARIUS_A_STAR_TO_ANDROMEDA_BRIDGE', () => {
  const catalog = new UniversalTargetCatalog();
  const seed = 0x1234567890abcdefn;

  // Traversal 0: Primary Einstein-Rosen Bridge -> M31 Central SMBH
  const exit = resolveBlackHoleTransitExit(seed, SAGITTARIUS_A_STAR, 0, catalog);

  assert.equal(exit.sourceBlackHoleId, 'sgra');
  assert.equal(exit.traversalIndex, 0);
  assert.equal(exit.exitTarget.objectId, 'm31_smbh');
  assert.equal(exit.exitTarget.galaxyId, 'andromeda');
  assert.ok(exit.exitBlackHole);
  assert.equal(exit.exitBlackHole!.id, 'm31_smbh');

  // Emergence position must be strictly outside M31 event horizon
  const rHorizon = exit.exitBlackHole!.eventHorizonRadiusM;
  const distFromCenter = Math.hypot(
    exit.emergencePositionM[0] - exit.exitBlackHole!.positionM[0],
    exit.emergencePositionM[1] - exit.exitBlackHole!.positionM[1],
    exit.emergencePositionM[2] - exit.exitBlackHole!.positionM[2]
  );
  assert.ok(distFromCenter > rHorizon * 5.0, `Emergence distance (${distFromCenter}) must exceed 5*r_horizon (${5 * rHorizon})`);

  // Safe outward escape velocity
  assert.ok(exit.emergenceVelocityMps[2] > 0, 'Emergence velocity must be directed outward away from hole');
  const speed = Math.hypot(...exit.emergenceVelocityMps);
  assert.ok(Math.abs(speed - SPEED_OF_LIGHT * 0.2) < 1e3, 'Safe speed should be ~0.2c');
});

test('T_BH2_02_ANDROMEDA_TO_SAGITTARIUS_RETURN_BRIDGE', () => {
  const catalog = new UniversalTargetCatalog();
  const seed = 0x1234567890abcdefn;

  // Traversal 0 from Andromeda: Return bridge -> Sgr A*
  const exit = resolveBlackHoleTransitExit(seed, M31_CENTRAL_BLACK_HOLE, 0, catalog);

  assert.equal(exit.sourceBlackHoleId, 'm31_smbh');
  assert.equal(exit.exitTarget.objectId, 'sgra');
  assert.equal(exit.exitTarget.galaxyId, 'milky_way');
  assert.ok(exit.exitBlackHole);
  assert.equal(exit.exitBlackHole!.id, 'sgra');

  // Clearance check
  const distFromCenter = Math.hypot(...exit.emergencePositionM);
  assert.ok(distFromCenter > exit.exitBlackHole!.eventHorizonRadiusM * 5.0);
});

test('T_BH2_03_CYCLICAL_ROUTING_AND_COSMIC_ANCHOR', () => {
  const catalog = new UniversalTargetCatalog();
  const seed = 0x42n;

  // Traversal 1: Norma Cluster / Cosmic Anchor
  const exit1 = resolveBlackHoleTransitExit(seed, SAGITTARIUS_A_STAR, 1, catalog);
  assert.ok(exit1.exitTarget.objectId.includes('norma') || exit1.exitTarget.objectId.includes('horizon'));
  assert.ok(exit1.description.includes('Norma'));

  // Traversal 2: Outer disk ejection
  const exit2 = resolveBlackHoleTransitExit(seed, SAGITTARIUS_A_STAR, 2, catalog);
  assert.ok(exit2.exitTarget.galaxyId === 'milky_way');

  // Traversal 3: Cycle wraps back to M31 (3 % 3 === 0)
  const exit3 = resolveBlackHoleTransitExit(seed, SAGITTARIUS_A_STAR, 3, catalog);
  assert.equal(exit3.exitTarget.objectId, 'm31_smbh');
});

test('T_BH2_04_PROCEDURAL_STELLAR_BLACK_HOLE_TRANSIT', () => {
  const catalog = new UniversalTargetCatalog();
  const seed = 0x987654321n;
  const sector = sectorIndex(15n, 12n, -5n);
  const sbh = generateStellarBlackHole('milky_way', sector)!;

  // 1. Deterministic resolution
  const exitA = resolveBlackHoleTransitExit(seed, sbh, 1, catalog);
  const exitB = resolveBlackHoleTransitExit(seed, sbh, 1, catalog);

  assert.equal(exitA.exitTarget.key, exitB.exitTarget.key);
  assert.deepEqual(exitA.emergencePositionM, exitB.emergencePositionM);
  assert.deepEqual(exitA.emergenceVelocityMps, exitB.emergenceVelocityMps);

  // 2. Different traversal counter yields different route
  const exitC = resolveBlackHoleTransitExit(seed, sbh, 2, catalog);
  assert.notEqual(exitA.description, exitC.description);
});

test('T_BH2_05_SAVEMANAGER_TRAVERSAL_PERSISTENCE', () => {
  const storage = mockStorage();
  try {
    const save1 = new SaveManager();
    assert.equal(save1.getBlackHoleTraversalCount('sgra'), 0);

    // Record traversals
    const count1 = save1.recordBlackHoleTraversal('sgra');
    assert.equal(count1, 1);
    const count2 = save1.recordBlackHoleTraversal('sgra');
    assert.equal(count2, 2);
    const countM31 = save1.recordBlackHoleTraversal('m31_smbh');
    assert.equal(countM31, 1);

    // Restore into fresh SaveManager instance from storage
    const save2 = new SaveManager();
    assert.equal(save2.getBlackHoleTraversalCount('sgra'), 2);
    assert.equal(save2.getBlackHoleTraversalCount('m31_smbh'), 1);
    assert.equal(save2.getBlackHoleTraversalCount('unknown_bh'), 0);
  } finally {
    storage.restore();
  }
});

test('T_BH2_06_TRANSIT_CONTROLLER_LIFECYCLE', () => {
  const storage = mockStorage();
  try {
    const catalog = new UniversalTargetCatalog();
    const save = new SaveManager();
    const controller = new BlackHoleTransitController(catalog, save);

    assert.equal(controller.active, false);
    assert.equal(controller.phase, 'idle');

    // 1. Start transit
    const dest = controller.startTransit(0x123n, SAGITTARIUS_A_STAR);
    assert.equal(controller.active, true);
    assert.equal(controller.phase, 'event-horizon-entry');
    assert.equal(save.getBlackHoleTraversalCount('sgra'), 1);
    assert.equal(dest.sourceBlackHoleId, 'sgra');

    // 2. Step forward into wormhole tunnel (dt = 2.0s)
    const step1 = controller.update(2.0);
    assert.equal(step1.phase, 'wormhole-tunnel');
    assert.equal(step1.completed, false);
    assert.ok(step1.progress01 > 0 && step1.progress01 < 1.0);

    // 3. Step forward to emergence (dt = 3.0s, total 5.0s / 6.0s)
    const step2 = controller.update(3.0);
    assert.equal(step2.phase, 'destination-emergence');
    assert.equal(step2.completed, false);

    // 4. Step forward to completion (dt = 2.0s, total 7.0s > 6.0s)
    const step3 = controller.update(2.0);
    assert.equal(step3.phase, 'completed');
    assert.equal(step3.completed, true);
    assert.equal(controller.active, false);

    // 5. Reset
    controller.reset();
    assert.equal(controller.phase, 'idle');
    assert.equal(controller.active, false);
  } finally {
    storage.restore();
  }
});

test('T_BH2_07_EMERGENCE_SAFETY_INVARIANT', () => {
  const catalog = new UniversalTargetCatalog();
  const seed = 0xabcdef123456n;

  // Test across multiple black holes and multiple counters
  const testBhs = [SAGITTARIUS_A_STAR, M31_CENTRAL_BLACK_HOLE];

  for (const bh of testBhs) {
    for (let counter = 0; counter < 10; counter++) {
      const exit = resolveBlackHoleTransitExit(seed, bh, counter, catalog);

      // Invariant 1: Clearance must be non-zero and positive
      assert.ok(exit.safeClearanceDistanceM > 0);

      // Invariant 2: Emergence speed must be subluminal safe escape speed (0.2c)
      const speed = Math.hypot(...exit.emergenceVelocityMps);
      assert.ok(speed < SPEED_OF_LIGHT);
      assert.ok(speed > 10_000);

      // Invariant 3: If exit has black hole, emergence position must exceed horizon radius
      if (exit.exitBlackHole) {
        const dx = exit.emergencePositionM[0] - exit.exitBlackHole.positionM[0];
        const dy = exit.emergencePositionM[1] - exit.exitBlackHole.positionM[1];
        const dz = exit.emergencePositionM[2] - exit.exitBlackHole.positionM[2];
        const dist = Math.hypot(dx, dy, dz);
        assert.ok(
          dist > exit.exitBlackHole.eventHorizonRadiusM,
          `Emergence distance ${dist} must strictly exceed event horizon ${exit.exitBlackHole.eventHorizonRadiusM}`
        );
      }
    }
  }
});
