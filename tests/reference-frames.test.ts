import test from 'node:test';
import assert from 'node:assert/strict';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { pose, distanceInFrame } from '../src/world/spatial/SpatialPose.ts';
import { quatFromAxisAngle, rotateVec3, type Vec3 } from '../src/world/spatial/units.ts';
import {
  SECTOR_SIZE_M, addressKey, normalizeSectorOffset, sectorIndex, sectorSeed, separationM,
} from '../src/world/spatial/UniverseAddress.ts';

/** A three-level tree: a root, a body offset inside it, and a surface patch rotated on the body. */
function buildGraph(): ReferenceFrameGraph {
  const graph = new ReferenceFrameGraph();
  graph.register(referenceFrame({ id: 'system', kind: 'system' }));
  graph.register(referenceFrame({
    id: 'body', parentId: 'system', kind: 'body-fixed',
    originInParent: [1_000_000, 0, 0],
  }));
  graph.register(referenceFrame({
    id: 'surface', parentId: 'body', kind: 'surface-enu',
    originInParent: [0, 6_378_137, 0],
    rotationToParent: quatFromAxisAngle([0, 0, 1], Math.PI / 2),
  }));
  return graph;
}

test('a frame graph composes transforms up and down through a common ancestor', () => {
  const graph = buildGraph();
  // The surface origin, expressed in the system frame, is the body offset plus the surface offset.
  const origin = graph.convertPosition('surface', 'system', [0, 0, 0]);
  assert.ok(Math.abs(origin[0] - 1_000_000) < 1e-6, `x ${origin[0]}`);
  assert.ok(Math.abs(origin[1] - 6_378_137) < 1e-6, `y ${origin[1]}`);
  assert.ok(Math.abs(origin[2]) < 1e-6);

  // A point one metre along the surface +X axis lands on the body's +Y, because of the rotation.
  const stepped = graph.convertPosition('surface', 'body', [1, 0, 0]);
  assert.ok(Math.abs(stepped[0]) < 1e-9, `x ${stepped[0]}`);
  assert.ok(Math.abs(stepped[1] - (6_378_137 + 1)) < 1e-6, `y ${stepped[1]}`);
});

test('converting a position there and back is the identity', () => {
  const graph = buildGraph();
  const probes: Vec3[] = [[0, 0, 0], [12, -3, 48], [-5000, 900, 12_000], [1e6, -1e6, 5e5]];
  for (const source of probes) {
    const up = graph.convertPosition('surface', 'system', source);
    const back = graph.convertPosition('system', 'surface', up);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(back[i] - source[i]) < 1e-6, `${source} came back as ${back}`);
    }
  }
});

test('a direction is rotated but never translated', () => {
  const graph = buildGraph();
  // A position a kilometre out picks up the frame offsets; the same vector as a direction does not.
  const asPosition = graph.convertPosition('surface', 'system', [1000, 0, 0]);
  const asDirection = graph.convertDirection('surface', 'system', [1000, 0, 0]);
  assert.ok(Math.hypot(...asPosition) > 1e6, 'a position carries the frame offset');
  assert.ok(Math.abs(Math.hypot(...asDirection) - 1000) < 1e-6, 'a direction keeps its length');
  // The rotation still applies: surface +X is body +Y is system +Y.
  assert.ok(Math.abs(asDirection[1] - 1000) < 1e-6, `direction became ${asDirection}`);
});

test('an orientation composes the same way the axes do', () => {
  const graph = buildGraph();
  // The surface frame is rotated a quarter turn about Z relative to the body.
  const identityInSurface = graph.convertOrientation('surface', 'body', [0, 0, 0, 1]);
  const expected = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(identityInSurface[i] - expected[i]) < 1e-9, `component ${i}`);
  }
  // And a vector rotated by that orientation matches converting the vector directly.
  const rotated = rotateVec3(identityInSurface, [1, 0, 0]);
  const converted = graph.convertDirection('surface', 'body', [1, 0, 0]);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(rotated[i] - converted[i]) < 1e-9);
});

test('distance between two objects is the same in any frame that holds them both', () => {
  const graph = buildGraph();
  const a: Vec3 = [120, 40, -75];
  const b: Vec3 = [-3000, 18, 900];
  const local = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (const frame of ['body', 'system']) {
    const ca = graph.convertPosition('surface', frame, a);
    const cb = graph.convertPosition('surface', frame, b);
    const converted = Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]);
    assert.ok(Math.abs(converted - local) < 1e-6, `distance changed in ${frame}: ${converted} vs ${local}`);
  }
});

test('the graph finds the lowest common ancestor across a branch', () => {
  const graph = buildGraph();
  graph.register(referenceFrame({
    id: 'moon', parentId: 'system', kind: 'body-fixed', originInParent: [0, 0, 384_400_000],
  }));
  assert.equal(graph.lowestCommonAncestor('surface', 'moon'), 'system');
  assert.equal(graph.lowestCommonAncestor('surface', 'body'), 'body');
  assert.equal(graph.lowestCommonAncestor('surface', 'surface'), 'surface');

  // Converting between two sibling branches goes through the shared ancestor and back.
  const onMoon = graph.convertPosition('surface', 'moon', [0, 0, 0]);
  assert.ok(Math.abs(onMoon[2] + 384_400_000) < 1e-3, `moon-relative z ${onMoon[2]}`);
  const back = graph.convertPosition('moon', 'surface', onMoon);
  assert.ok(Math.hypot(...back) < 1e-3, 'and comes home again');
});

test('the graph refuses the mistakes that would silently corrupt a position', () => {
  const graph = buildGraph();
  assert.throws(() => graph.get('nowhere'), /Unknown reference frame/);
  assert.throws(() => graph.convertPosition('surface', 'nowhere', [0, 0, 0]), /Unknown reference frame/);

  // Two separate trees have no relationship, so a conversion between them is meaningless.
  graph.register(referenceFrame({ id: 'elsewhere', kind: 'cosmic' }));
  assert.throws(() => graph.convertPosition('surface', 'elsewhere', [0, 0, 0]), /not connected/);

  // A cycle would loop forever if it were walked naively.
  const looped = new ReferenceFrameGraph();
  looped.register(referenceFrame({ id: 'a', parentId: 'b', kind: 'system' }));
  looped.register(referenceFrame({ id: 'b', parentId: 'a', kind: 'system' }));
  assert.throws(() => looped.chainToRoot('a'), /cycle/);

  // And the degenerate case of a frame parented to itself is caught at registration.
  const selfParented = referenceFrame({ id: 'self', parentId: 'self', kind: 'system' });
  assert.throws(() => looped.register(selfParented), /cannot be its own parent/);
});

test('a pose knows its frame, and refuses to be measured against a different one', () => {
  const here = pose('surface', [10, 0, 0]);
  const there = pose('surface', [13, 4, 0]);
  assert.equal(distanceInFrame(here, there), 5);
  assert.throws(() => distanceInFrame(here, pose('body', [0, 0, 0])), /different frames/);
});

test('a frame can be registered before its parent exists', () => {
  // Tiles arrive bottom-up while the solar system is described top-down; neither order may fail.
  const graph = new ReferenceFrameGraph();
  graph.register(referenceFrame({ id: 'child', parentId: 'parent', kind: 'surface-enu', originInParent: [5, 0, 0] }));
  assert.throws(() => graph.convertPosition('child', 'parent', [0, 0, 0]), /Unknown reference frame/);
  graph.register(referenceFrame({ id: 'parent', kind: 'body-fixed' }));
  const converted = graph.convertPosition('child', 'parent', [0, 0, 0]);
  assert.ok(Math.abs(converted[0] - 5) < 1e-9);
});

test('universe addresses stay exact past the point where metres stop working', () => {
  // A double cannot hold 10^26 metres and a one-metre step at the same time. Sector indices are
  // integers, offsets are metres inside the sector, and the two are never added together.
  const a = { sector: sectorIndex(0, 0, 0), offsetM: [0, 0, 0] as Vec3 };
  const b = { sector: sectorIndex(1_000_000_000n, 0, 0), offsetM: [0, 0, 0] as Vec3 };
  const separation = separationM(a, b);
  assert.ok(Math.abs(separation - 1e9 * SECTOR_SIZE_M) / (1e9 * SECTOR_SIZE_M) < 1e-12);

  // One metre apart inside the same sector is still one metre, at any sector index.
  const far = { sector: sectorIndex(987_654_321n, -5n, 42n), offsetM: [0, 0, 0] as Vec3 };
  const farPlusOne = { sector: sectorIndex(987_654_321n, -5n, 42n), offsetM: [1, 0, 0] as Vec3 };
  assert.equal(separationM(far, farPlusOne), 1);

  // Offsets that wander past a sector edge are folded back into the index.
  const drifted = normalizeSectorOffset(sectorIndex(3, 0, 0), [SECTOR_SIZE_M * 2.5, -SECTOR_SIZE_M * 0.25, 0]);
  assert.equal(drifted.sector.x, 5n);
  assert.equal(drifted.sector.y, -1n);
  // Relative, not absolute: a sector is 9.5e17 m across, where a double's own spacing is about
  // 16 m. Demanding millimetres there would be demanding the very thing this design gives up on.
  assert.ok(Math.abs(drifted.offsetM[0] - SECTOR_SIZE_M * 0.5) / SECTOR_SIZE_M < 1e-12);
  assert.ok(drifted.offsetM[1] >= 0 && drifted.offsetM[1] < SECTOR_SIZE_M);
  // Which is the point: inside a sector, metres are exact where it matters.
  assert.equal(separationM(
    { sector: sectorIndex(0, 0, 0), offsetM: [1000, 0, 0] },
    { sector: sectorIndex(0, 0, 0), offsetM: [1000.5, 0, 0] },
  ), 0.5);
});

test('sector seeds are deterministic, which is the whole contract of a procedural universe', () => {
  const sector = sectorIndex(17, -4, 9001);
  assert.equal(sectorSeed('milky-way', sector), sectorSeed('milky-way', sector));
  assert.notEqual(sectorSeed('milky-way', sector), sectorSeed('andromeda', sector));
  assert.notEqual(sectorSeed('milky-way', sector), sectorSeed('milky-way', sectorIndex(17, -4, 9002)));
  // The key is stable and sortable, so it works as a cache key and as a save key.
  assert.equal(addressKey({ galaxyId: 'milky-way', sector, systemId: 'sol', bodyId: 'earth' }),
    'milky-way/17,-4,9001/sol/earth');
  // And a seed is a full 64 bits rather than a float that has lost its low end.
  assert.ok(sectorSeed('milky-way', sector) <= 0xffff_ffff_ffff_ffffn);
  assert.ok(typeof sectorSeed('milky-way', sector) === 'bigint');
});
