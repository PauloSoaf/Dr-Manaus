import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Vector3 } from 'three/webgpu';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { TEATRO_COLLIDERS, TEATRO_PLINTH, createTheatre, createTheatreSilhouette } from '../src/world/landmarks/theatre.ts';

function triangles(group: { traverse: (visit: (object: unknown) => void) => void }): number {
  let total = 0;
  group.traverse(object => { if (object instanceof Mesh) total += object.geometry.getAttribute('position').count / 3; });
  return total;
}

test('the theatre stands on a raised plinth reached by a real staircase', () => {
  assert.ok(TEATRO_PLINTH > 2.5, 'the embasamento must actually lift the building off the street');
  const group = createTheatre();
  let lowest = Infinity, highest = -Infinity;
  group.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const position = object.geometry.getAttribute('position');
    const lift = object.parent?.position.y ?? 0;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i) + lift;
      if (y < lowest) lowest = y;
      if (y > highest) highest = y;
    }
  });
  assert.ok(lowest <= .1, 'the staircase has to start at street level');
  assert.ok(highest > 35, `the theatre only reaches ${highest.toFixed(1)} m`);
});

test('the staircase is climbable and the terrace is a surface you can stand on', () => {
  const physics = new PhysicsWorld();
  const position = new Vector3(0, .1, 54), velocity = new Vector3();
  // Walk north into the theatre for ten seconds with the character's own step-up height.
  for (let frame = 0; frame < 600; frame++) {
    velocity.set(0, -6, -4);
    physics.move(position, velocity, 1 / 60, .32, 2.1, TEATRO_COLLIDERS, .55);
  }
  assert.ok(Math.abs(position.y - TEATRO_PLINTH) < .3,
    `the character ended at ${position.y.toFixed(2)} m instead of the ${TEATRO_PLINTH} m terrace`);
  assert.ok(position.z < 36, 'the character must have got past the bottom of the flight');

  // No single step may be taller than the character can step up, or the stairs become a wall.
  const treads = TEATRO_COLLIDERS.filter(box => box.depth < 2 && box.width > 20).map(box => box.y * 2).sort((a, b) => a - b);
  assert.ok(treads.length > 6, `only ${treads.length} treads found`);
  for (let i = 1; i < treads.length; i++) {
    assert.ok(treads[i] - treads[i - 1] <= .55, `a step rises ${(treads[i] - treads[i - 1]).toFixed(2)} m`);
  }
});

test('the theatre keeps the building itself solid above the plinth', () => {
  // The main volume must be lifted with the facade, or the player would walk through the walls.
  const mass = TEATRO_COLLIDERS.find(box => box.width > 50 && box.height > 20);
  assert.ok(mass, 'the main volume must have a collider');
  assert.ok(mass.y > TEATRO_PLINTH, 'the main volume sits on the plinth, not in it');
  const dome = TEATRO_COLLIDERS.reduce((best, box) => box.y > best.y ? box : best, TEATRO_COLLIDERS[0]);
  assert.ok(dome.y > 35, 'the cupola must still be up there after the lift');
});

test('the detailed theatre stays affordable and the distant one much cheaper', () => {
  const near = triangles(createTheatre()), far = triangles(createTheatreSilhouette());
  assert.ok(near > 12000, 'the showcase model must carry real detail');
  assert.ok(near < 70000, `the detailed theatre costs ${near} triangles`);
  assert.ok(far < near / 3, `the distant theatre costs ${far} against ${near}`);
  // Deterministic: the same call twice must produce the same geometry.
  assert.equal(triangles(createTheatre()), near);
});
