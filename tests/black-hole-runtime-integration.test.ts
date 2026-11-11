import test from 'node:test';
import assert from 'node:assert/strict';
import { BlackHoleRuntime, galacticPositionM } from '../src/world/travel/BlackHoleRuntime';
import { BlackHoleTransitController } from '../src/world/travel/BlackHoleTransitNetwork';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { SAGITTARIUS_A_STAR } from '../src/world/celestial/BlackHoleDescriptor';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { SaveManager } from '../src/core/SaveManager';

function withStorage<T>(fn: () => T): T {
  const prev = globalThis.localStorage;
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
    key: () => null, get length() { return store.size; },
  } as Storage;
  try { return fn(); } finally { globalThis.localStorage = prev; }
}

const sector = sectorIndex(0n, 0n, 0n);
const rs = SAGITTARIUS_A_STAR.schwarzschildRadiusM;

function make() {
  const save = new SaveManager();
  const transit = new BlackHoleTransitController(new UniversalTargetCatalog(), save);
  return { save, transit, rt: new BlackHoleRuntime(transit, 0x42n) };
}
const base = { galaxyId: 'milky_way', sector, systemVelocityMps: [0, 0, 0] as [number, number, number], dt: 0.1 };

test('T_BHRT_01_LOCAL_PHYSICS_UNAFFECTED', () => withStorage(() => {
  const { rt } = make();
  const r = rt.step({ ...base, localPhysicsActive: true, systemPositionM: [rs * 0.1, 0, 0] });
  assert.equal(r.proximity, undefined);
  assert.equal(r.nextVelocityMps, undefined);
}));

test('T_BHRT_02_DISTANT_NO_PULL_STRONG_FIELD_PULLS_INWARD', () => withStorage(() => {
  const { rt } = make();
  const far = rt.step({ ...base, localPhysicsActive: false, systemPositionM: [1000 * rs, 0, 0] });
  assert.equal(far.nextVelocityMps, undefined);
  const near = rt.step({ ...base, localPhysicsActive: false, systemPositionM: [5 * rs, 0, 0] });
  assert.equal(near.proximity!.zone, 'strong-field');
  assert.ok(near.nextVelocityMps![0] < 0, 'pull must point toward singularity');
}));

test('T_BHRT_03_CAPTURE_STARTS_TRANSIT_WITHOUT_PERSISTING', () => withStorage(() => {
  const { rt, save, transit } = make();
  const r = rt.step({ ...base, localPhysicsActive: false, systemPositionM: [SAGITTARIUS_A_STAR.eventHorizonRadiusM * 0.5, 0, 0] });
  assert.ok(r.transitStarted);
  assert.equal(transit.active, true);
  assert.equal(save.getBlackHoleTraversalCount('sgra'), 0);
  // No re-trigger while transit active
  const again = rt.step({ ...base, localPhysicsActive: false, systemPositionM: [1, 0, 0] });
  assert.equal(again.transitStarted, undefined);
}));

test('T_BHRT_04_EMERGENCE_COMMITS_AND_OUTSIDE_HORIZON', () => withStorage(() => {
  const { rt, save, transit } = make();
  const r = rt.step({ ...base, localPhysicsActive: false, systemPositionM: [1, 0, 0] });
  const d = r.transitStarted!;
  if (d.exitBlackHole) {
    const dist = Math.hypot(...d.emergencePositionM.map((v, i) => v - d.exitBlackHole!.positionM[i]));
    assert.ok(dist > d.exitBlackHole.eventHorizonRadiusM);
  }
  transit.update(10);
  assert.equal(rt.confirmEmergence(), 1);
  assert.equal(save.getBlackHoleTraversalCount('sgra'), 1);
  assert.equal(transit.active, false);
}));

test('T_BHRT_05_FAILED_TRANSIT_ROLLS_BACK', () => withStorage(() => {
  const { rt, save, transit } = make();
  rt.step({ ...base, localPhysicsActive: false, systemPositionM: [1, 0, 0] });
  rt.failTransit();
  assert.equal(save.getBlackHoleTraversalCount('sgra'), 0);
  assert.equal(transit.active, false);
  assert.equal(transit.hasReservation, false);
}));

test('T_BHRT_06_GALACTIC_POSITION_OFFSETS_BY_SECTOR', () => {
  const p = galacticPositionM(sectorIndex(1n, 0n, 0n), [5, 6, 7]);
  assert.ok(p[0] > 5 && p[1] === 6 && p[2] === 7);
});

