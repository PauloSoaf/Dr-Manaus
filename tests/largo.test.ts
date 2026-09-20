import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, InstancedMesh, Mesh, Vector3 } from 'three/webgpu';
import { LANDMARKS } from '../src/world/geodata/geodata.ts';
import { LargoDistrict } from '../src/world/landmarks/largo/index.ts';
import { LARGO_VENUES } from '../src/world/landmarks/largo/venues.ts';
import { clearance, isPaved, zoneAt } from '../src/world/landmarks/largo/plaza.ts';
import { MONUMENT_COLLIDERS, MONUMENT_HEIGHT, createMonument } from '../src/world/landmarks/largo/monument.ts';
import { IGREJA_ANCHOR, createIgreja } from '../src/world/landmarks/largo/igreja.ts';
import { createLargoProps } from '../src/world/landmarks/largo/props.ts';

function cost(group: Group): { triangles: number; draws: number } {
  let triangles = 0, draws = 0;
  group.traverse(object => {
    if (object instanceof InstancedMesh) { draws++; triangles += object.geometry.getAttribute('position').count / 3 * object.count; }
    else if (object instanceof Mesh) { draws++; triangles += object.geometry.getAttribute('position').count / 3; }
  });
  return { triangles: Math.round(triangles), draws };
}

test('the square is built on real ground, not on an authored rectangle', () => {
  // The paving comes from a mask of ground that is neither building nor carriageway.
  assert.equal(isPaved(0, 0), true, 'the monument stands on the square');
  assert.equal(isPaved(0, 6), true);
  // The Teatro is a real building 98 m west; its footprint cannot be paved over.
  assert.equal(isPaved(-98, -7), false, 'the theatre footprint must not be paved');
  // And nothing is paved out beyond the compiled reach.
  assert.equal(isPaved(900, 900), false);
  assert.ok(clearance(0, 0, 12) > 8, 'the middle of the square must be open ground');
});

test('every venue sits on a real building footprint found from its own place record', () => {
  assert.ok(LARGO_VENUES.length >= 8, `only ${LARGO_VENUES.length} venues compiled`);
  for (const item of LARGO_VENUES) {
    assert.ok(item.building, `${item.id} has no footprint`);
    const plot = item.building!;
    // Matched by containment or by proximity, never by street address.
    assert.ok(item.match === 'containment' || item.match === 'nearest', `${item.id} matched by ${item.match}`);
    assert.ok(Math.hypot(plot.x - item.x, plot.z - item.z) < 50, `${item.id} is far from its building`);
    // Human scale: a shopfront is metres, not a toy.
    assert.ok(plot.width > 4 && plot.depth > 3, `${item.id} is ${plot.width}x${plot.depth} m`);
    assert.ok(plot.height >= 3, `${item.id} is ${plot.height} m tall`);
    assert.ok(Math.hypot(item.x, item.z) < 220, `${item.id} is not on the square`);
  }
  // The venues the square is known for must all be there.
  const names = LARGO_VENUES.map(item => item.id);
  for (const id of ['juma', 'valer', 'tambaqui', 'casa-artes', 'gisela', 'galeria']) {
    assert.ok(names.includes(id), `missing ${id}`);
  }
});

test('every facade turns toward the monument rather than away from it', () => {
  for (const item of LARGO_VENUES) {
    const plot = item.building!;
    const span = Math.hypot(plot.x, plot.z) || 1;
    const tx = -plot.x / span, tz = -plot.z / span;
    let best = -Infinity;
    for (let quarter = 0; quarter < 4; quarter++) {
      const candidate = plot.angle + quarter * Math.PI / 2;
      best = Math.max(best, Math.sin(candidate) * tx + Math.cos(candidate) * tz);
    }
    assert.ok(best > .5, `${item.id} has no side facing the square (best alignment ${best.toFixed(2)})`);
  }
});

test('the monument is world zero, is solid, and is climbable at its base', () => {
  const largo = LANDMARKS.find(landmark => landmark.id === 'largo')!;
  assert.ok(Math.hypot(largo.x, largo.z) < 1, 'the square anchors on the origin');
  assert.ok(MONUMENT_HEIGHT > 11, `the monument is only ${MONUMENT_HEIGHT.toFixed(1)} m tall`);
  assert.ok(MONUMENT_COLLIDERS.length > 4, 'the monument needs more than one box');
  // The stepped base rises in climbable increments, and the column above is not passable.
  const steps = MONUMENT_COLLIDERS.filter(box => box.height < 2).map(box => box.height).sort((a, b) => a - b);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] - steps[i - 1] <= .55);
  const column = MONUMENT_COLLIDERS.reduce((tall, box) => box.height > tall.height ? box : tall, MONUMENT_COLLIDERS[0]);
  assert.ok(column.height > 5, 'the column must block the player');
  const model = cost(createMonument());
  assert.ok(model.triangles > 500 && model.triangles < 6000, `the monument costs ${model.triangles} triangles`);
});

test('furniture is placed by zone and never in the middle of the square', () => {
  assert.equal(zoneAt(0, 0), 'monument');
  assert.equal(zoneAt(0, 8), 'monument', 'the clear zone extends around the monument');
  const props = createLargoProps();
  const matrix = new Float32Array(16);
  let intruders = 0, placed = 0;
  for (const child of props.children) {
    if (!(child instanceof InstancedMesh)) continue;
    for (let i = 0; i < child.count; i++) {
      const array = child.instanceMatrix.array as Float32Array;
      matrix.set(array.subarray(i * 16, i * 16 + 16));
      const x = matrix[12], z = matrix[14];
      placed++;
      if (Math.hypot(x, z) < 14) intruders++;
      // Nothing may stand where there is no paving, which is how props end up inside buildings.
      assert.equal(isPaved(x, z), true, `a ${child.name} stands off the square at ${x.toFixed(0)},${z.toFixed(0)}`);
    }
  }
  assert.ok(placed > 200, `only ${placed} props placed`);
  assert.equal(intruders, 0, `${intruders} props stand in the monument's clear zone`);
});

test('the square stays within its draw and triangle budget at every level of detail', () => {
  const root = new Group(), district = new LargoDistrict(root);
  try {
    const seen: Record<string, { triangles: number; draws: number }> = {};
    for (const [label, distance] of [['ultra', 0], ['medium', 400], ['low', 900], ['off', 4000]] as const) {
      district.update(new Vector3(distance, 2, 0), 1);
      assert.equal(district.detail, label, `at ${distance} m the square should be ${label}`);
      seen[label] = cost(root);
    }
    assert.ok(seen.ultra.draws < 100, `the detailed square costs ${seen.ultra.draws} draw calls`);
    assert.ok(seen.ultra.triangles < 120000, `the detailed square costs ${seen.ultra.triangles} triangles`);
    // Each tier must be strictly cheaper than the one before, and they are exclusive.
    assert.ok(seen.medium.triangles < seen.ultra.triangles / 2, 'medium must be much cheaper than ultra');
    assert.ok(seen.low.triangles < seen.medium.triangles);
    assert.equal(seen.off.draws, 0, 'the square must cost nothing from across the city');

    // Hysteresis: sitting on the boundary must not thrash the build.
    district.update(new Vector3(0, 2, 0), 1);
    assert.equal(district.detail, 'ultra');
    district.update(new Vector3(240, 2, 0), 1);
    assert.equal(district.detail, 'ultra', 'inside the exit band the detailed build is kept');
    district.update(new Vector3(300, 2, 0), 1);
    assert.equal(district.detail, 'medium');
  } finally {
    district.dispose();
    assert.equal(root.children.length, 0);
  }
});

test('the church stands on its own compiled footprint south of the square', () => {
  assert.ok(Math.hypot(IGREJA_ANCHOR.x, IGREJA_ANCHOR.z) > 40, 'the church is not on top of the monument');
  assert.ok(IGREJA_ANCHOR.z < -30, 'the church closes the south end of the square');
  const model = cost(createIgreja());
  assert.ok(model.triangles > 400 && model.triangles < 16000, `the church costs ${model.triangles} triangles`);
});
