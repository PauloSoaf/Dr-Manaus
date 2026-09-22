import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Mesh, Vector3 } from 'three/webgpu';
import { LANDMARKS } from '../src/world/geodata/geodata.ts';
import { LAND_MASK } from '../src/world/geodata/landmask.ts';
import {
  BRIDGE_PATH, bridgeDeckColliders, createBridgeDistant, createBridgeModel,
  deckHeight, halfWidthAt, sampleBridge,
} from '../src/world/landmarks/bridge.ts';
import { drawnByLandmark, roadOwner, OWNERSHIP_RULES } from '../src/world/realcity/ownership.ts';
import type { RoadRecord } from '../src/world/realcity/roads.ts';

const DATA = path.resolve('public/geodata/real-city');
const BRIDGE_NAME = /^ponte sobre o rio negro$/i;

function carriageways(): RoadRecord[] {
  const file = path.join(DATA, 'roads.json');
  if (!existsSync(file)) return [];
  const roads = JSON.parse(readFileSync(file, 'utf8')) as RoadRecord[];
  return roads.filter(road => BRIDGE_NAME.test((road.name ?? '').trim()));
}

function triangles(group: { traverse: (visit: (object: unknown) => void) => void }): number {
  let total = 0;
  group.traverse(object => { if (object instanceof Mesh) total += object.geometry.getAttribute('position').count / 3; });
  return total;
}

test('the crossing is laid out on the centreline that exists in the compiled dataset', () => {
  const real = carriageways();
  if (!real.length) return;
  assert.equal(real.length, 2, 'the Ponte Rio Negro is two carriageways in the data');

  // The bundled centreline has to agree with what the pipeline compiled, or it has drifted.
  const position = new Vector3(), tangent = new Vector3();
  let outside = 0, worst = 0, sampled = 0;
  for (const road of real) {
    for (let i = 0; i < road.p.length; i += 2) {
      const x = road.p[i], z = road.p[i + 1];
      let best = Infinity, bestS = 0;
      for (let s = 0; s <= BRIDGE_PATH.length; s += 20) {
        sampleBridge(s, position, tangent);
        const distance = Math.hypot(position.x - x, position.z - z);
        if (distance < best) { best = distance; bestS = s; }
      }
      sampled++;
      const allowed = halfWidthAt(bestS);
      if (best > allowed) { outside++; worst = Math.max(worst, best - allowed); }
    }
  }
  assert.ok(sampled > 80, 'the fixture must cover the real geometry');
  // Both carriageways must lie on the deck; only the diverging interchange ramps may overhang.
  assert.ok(outside <= sampled * .05, `${outside} of ${sampled} carriageway points fall off the deck`);
  assert.ok(worst < 12, `a carriageway overhangs the deck by ${worst.toFixed(1)} m`);
});

test('exactly one renderer owns the crossing, so there can never be two bridges', () => {
  const real = carriageways();
  if (!real.length) return;
  for (const road of real) {
    assert.equal(roadOwner(road), 'landmark-bridge');
    assert.equal(drawnByLandmark(road), true, 'the road ribbon must stand down over the bridge');
  }
  const roads = JSON.parse(readFileSync(path.join(DATA, 'roads.json'), 'utf8')) as RoadRecord[];
  const owned = roads.filter(drawnByLandmark);
  assert.equal(owned.length, real.length, 'ownership must not swallow any other street');
  // An ordinary avenue keeps its ribbon.
  assert.equal(roadOwner({ name: 'Avenida Constantino Nery' }), 'real-road');
  assert.equal(roadOwner({}), 'real-road');
  assert.ok(OWNERSHIP_RULES.length > 0);
});

test('the deck spans bank to bank, clears the river, and lands on dry ground', () => {
  assert.ok(BRIDGE_PATH.length > 5000, `the crossing is only ${BRIDGE_PATH.length.toFixed(0)} m long`);
  const position = new Vector3(), tangent = new Vector3();

  sampleBridge(0, position, tangent);
  assert.equal(LAND_MASK.isWater(position.x, position.z), false, 'the south abutment must be on land');
  sampleBridge(BRIDGE_PATH.length, position, tangent);
  assert.equal(LAND_MASK.isWater(position.x, position.z), false, 'the north abutment must be on land');

  // The middle is genuinely over the Rio Negro, and the navigation span is high.
  sampleBridge(BRIDGE_PATH.length * .5, position, tangent);
  assert.equal(LAND_MASK.isWater(position.x, position.z), true, 'midspan must be over the river');
  assert.ok(deckHeight(BRIDGE_PATH.length * .5) > 45, 'shipping has to fit under the navigation span');
  // The approaches come back down to meet the road.
  assert.ok(deckHeight(0) < 20 && deckHeight(BRIDGE_PATH.length) < 20);
  // Height is continuous: no step the player could fall through.
  let previous = deckHeight(0);
  for (let s = 10; s <= BRIDGE_PATH.length; s += 10) {
    const height = deckHeight(s);
    assert.ok(Math.abs(height - previous) < 1.5, `the deck jumps ${Math.abs(height - previous).toFixed(1)} m at ${s} m`);
    previous = height;
  }
});

test('the collision deck is sampled from the same path as the geometry', () => {
  const ponte = LANDMARKS.find(landmark => landmark.id === 'ponte')!;
  const boxes = bridgeDeckColliders();
  assert.ok(boxes.length > 100, `only ${boxes.length} deck colliders`);
  const position = new Vector3(), tangent = new Vector3();
  for (const box of boxes) {
    const x = box.x + ponte.x, z = box.z + ponte.z;
    // Every collider must sit on the path, within its own footprint.
    let best = Infinity;
    for (let s = 0; s <= BRIDGE_PATH.length; s += 12) {
      sampleBridge(s, position, tangent);
      best = Math.min(best, Math.hypot(position.x - x, position.z - z));
    }
    assert.ok(best < 20, `a deck collider sits ${best.toFixed(1)} m off the centreline`);
    assert.ok(box.y > 5 && box.y < 60, `a deck collider is at ${box.y.toFixed(1)} m`);
  }
});

test('the crossing stays cheap at both levels of detail', () => {
  const near = triangles(createBridgeModel()), far = triangles(createBridgeDistant());
  assert.ok(near > 3000, 'the detailed crossing must actually have a structure');
  assert.ok(near < 40000, `the detailed crossing costs ${near} triangles`);
  assert.ok(far < near / 4, `the distant crossing costs ${far} triangles against ${near}`);
  // Deterministic: the same call twice must produce the same geometry.
  assert.equal(triangles(createBridgeModel()), near);
});

test('the bridge landmark sits at the midpoint of its own deck', () => {
  const ponte = LANDMARKS.find(landmark => landmark.id === 'ponte')!;
  const position = new Vector3(), tangent = new Vector3();
  sampleBridge(BRIDGE_PATH.length * .5, position, tangent);
  const offset = Math.hypot(position.x - ponte.x, position.z - ponte.z);
  assert.ok(offset < 120, `the landmark is ${offset.toFixed(0)} m from the middle of its deck`);
  // The radius has to cover the structure, or the crossing pops in and out as a whole.
  assert.ok(ponte.radius > 1000);
});
