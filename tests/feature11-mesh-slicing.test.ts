import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { MeshSlicing } from '../src/world/destruction/MeshSlicing';

test('CT-11-01: MeshSlicing cuts a BoxGeometry with a horizontal plane into two watertight halves', () => {
  // Box of size 10x20x10 centered at (0, 10, 0), spanning Y from 0 to 20
  const box = new BoxGeometry(10, 20, 10);
  box.translate(0, 10, 0);

  const planeOrigin = new Vector3(0, 10, 0);
  const planeNormal = new Vector3(0, 1, 0); // Horizontal plane cutting at Y=10

  const result = MeshSlicing.sliceGeometry(box, planeOrigin, planeNormal);

  assert.ok(result !== null, 'Slice result must not be null');
  assert.ok(result!.cutArea > 0, 'Cut area (cap surface) must be greater than zero');
  assert.ok(result!.intersectionCount >= 4, 'Cut should generate at least 4 intersection segments for a box');

  // Verify top geometry Y coordinates (all should be >= 10 - eps)
  const topPos = result!.topGeometry.getAttribute('position');
  assert.ok(topPos.count > 0, 'Top geometry must contain vertices');
  let topMinY = Infinity;
  let topMaxY = -Infinity;
  for (let i = 0; i < topPos.count; i++) {
    const y = topPos.getY(i);
    if (y < topMinY) topMinY = y;
    if (y > topMaxY) topMaxY = y;
  }
  assert.ok(topMinY >= 10.0 - 1e-4, `Top slice minimum Y should be at or above 10: got ${topMinY}`);
  assert.ok(topMaxY <= 20.0 + 1e-4, `Top slice maximum Y should be at or below 20: got ${topMaxY}`);

  // Verify bottom geometry Y coordinates (all should be <= 10 + eps)
  const botPos = result!.bottomGeometry.getAttribute('position');
  assert.ok(botPos.count > 0, 'Bottom geometry must contain vertices');
  let botMinY = Infinity;
  let botMaxY = -Infinity;
  for (let i = 0; i < botPos.count; i++) {
    const y = botPos.getY(i);
    if (y < botMinY) botMinY = y;
    if (y > botMaxY) botMaxY = y;
  }
  assert.ok(botMinY >= 0.0 - 1e-4, `Bottom slice minimum Y should be at or above 0: got ${botMinY}`);
  assert.ok(botMaxY <= 10.0 + 1e-4, `Bottom slice maximum Y should be at or below 10: got ${botMaxY}`);
});

test('CT-11-02: MeshSlicing cuts with an oblique diagonal plane', () => {
  const box = new BoxGeometry(8, 8, 8);
  const planeOrigin = new Vector3(0, 0, 0);
  const planeNormal = new Vector3(1, 1, 0).normalize(); // 45-degree diagonal cut

  const result = MeshSlicing.sliceGeometry(box, planeOrigin, planeNormal);

  assert.ok(result !== null, 'Oblique slice should bisect geometry');
  assert.ok(result!.topGeometry.getAttribute('position').count > 0);
  assert.ok(result!.bottomGeometry.getAttribute('position').count > 0);
  assert.ok(result!.cutArea > 0, 'Cut cap area must be generated on oblique incision');
});

test('CT-11-03: MeshSlicing cleanly rejects plane that does not intersect mesh bounds', () => {
  const box = new BoxGeometry(4, 4, 4);
  const planeOrigin = new Vector3(0, 100, 0); // Far above box
  const planeNormal = new Vector3(0, 1, 0);

  const result = MeshSlicing.sliceGeometry(box, planeOrigin, planeNormal);
  assert.strictEqual(result, null, 'Non-intersecting plane must return null without throwing');
});

test('CT-11-04: MeshSlicing sliceMesh generates physical separated mesh pairs with opposite velocities', () => {
  const geo = new BoxGeometry(6, 12, 6);
  const mat = new MeshStandardMaterial({ color: 0x336699 });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(20, 10, -30);

  const planeOrigin = new Vector3(20, 10, -30);
  const planeNormal = new Vector3(0, 1, 0);

  const pair = MeshSlicing.sliceMesh(mesh, planeOrigin, planeNormal, 15.0);

  assert.ok(pair !== null, 'Mesh pair should be generated');
  assert.strictEqual(pair!.topVelocity.y, 15.0, 'Top velocity should push upwards along cut normal');
  assert.strictEqual(pair!.bottomVelocity.y, -15.0, 'Bottom velocity should push downwards along cut normal');
  assert.ok(pair!.topMesh instanceof Mesh);
  assert.ok(pair!.bottomMesh instanceof Mesh);
});
