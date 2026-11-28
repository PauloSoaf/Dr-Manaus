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


import { nearestBlackHole, withAbsolutePosition } from '../src/world/travel/BlackHoleRuntime';
import { generateStellarBlackHole } from '../src/world/celestial/BlackHoleDescriptor';
import { SECTOR_SIZE_M } from '../src/world/spatial/UniverseAddress';

function findStellar() {
  for (let x = 0n; x < 400n; x++) {
    const s = sectorIndex(x, 3n, 1n);
    const bh = generateStellarBlackHole('milky_way', s);
    if (bh) return { s, bh };
  }
  throw new Error('no stellar black hole found');
}

test('T_BHRT_07_NEAREST_RESOLVES_STELLAR_BLACK_HOLE_IN_ABSOLUTE_COORDINATES', () => {
  const { s, bh } = findStellar();
  const abs = withAbsolutePosition(bh, s);
  assert.ok(Math.abs(abs.positionM[0] - Number(s.x) * SECTOR_SIZE_M - bh.positionM[0]) <= Math.abs(abs.positionM[0]) * 1e-12 + 1);
  const near = nearestBlackHole('milky_way', [abs.positionM[0] + 10 * bh.schwarzschildRadiusM, abs.positionM[1], abs.positionM[2]]);
  assert.equal(near!.id, bh.id);
  assert.deepEqual(near!.positionM, abs.positionM);
});

test('T_BHRT_08_NEAREST_FALLS_BACK_TO_CENTRAL_AND_IS_DETERMINISTIC', () => {
  const a = nearestBlackHole('milky_way', [1e9, 0, 0]);
  const b = nearestBlackHole('milky_way', [1e9, 0, 0]);
  assert.equal(a!.id, 'sgra');
  assert.equal(a!.id, b!.id);
  assert.equal(nearestBlackHole('unknown_galaxy', [1e9, 0, 0])?.id, nearestBlackHole('unknown_galaxy', [1e9, 0, 0])?.id);
});

test('T_BHRT_09_STELLAR_CAPTURE_STARTS_TRANSIT', () => withStorage(() => {
  const { s, bh } = findStellar();
  const abs = withAbsolutePosition(bh, s);
  const { rt, save, transit } = make();
  const r = rt.step({ ...base, localPhysicsActive: false, blackHole: abs,
    systemPositionM: [abs.positionM[0] + bh.eventHorizonRadiusM * 0.5, abs.positionM[1], abs.positionM[2]] });
  assert.ok(r.transitStarted);
  assert.equal(r.transitStarted!.sourceBlackHoleId, bh.id);
  assert.equal(save.getBlackHoleTraversalCount(bh.id), 0);
  assert.equal(transit.active, true);
}));


