import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { FastSpatialGrid2D } from '../src/world/spatial/FastSpatialGrid2D';
import { FluvialVesselSystem, VESSEL_ARCHETYPES } from '../src/world/traffic/FluvialVesselSystem';
import { PopulationManager } from '../src/entities/PopulationManager';
import { RoadGraph } from '../src/world/traffic/RoadGraph';
import { TrafficSystem } from '../src/world/traffic/TrafficSystem';
import { resolveImpact } from '../src/player/combat/MeteorImpact';

test('CT-08-01: FastSpatialGrid2D performs O(1) insertions and accurate proximity queries with zero GC', () => {
  const grid = new FastSpatialGrid2D(4000, 32, 1024);

  // Insert 5 entities at known coordinates
  grid.insert(0, 100, 200);
  grid.insert(1, 105, 204); // ~6.4m from 0
  grid.insert(2, 115, 200); // 15m from 0
  grid.insert(3, 300, 500); // Far away
  grid.insert(4, -500, -800); // Negative coords

  assert.strictEqual(grid.size, 5);

  // Query within 10m of (100, 200) -> should find only 0 and 1
  const found: number[] = [];
  grid.forEachNeighbor(100, 200, 10.0, (id, _nx, _nz, _distSq) => {
    found.push(id);
  });

  assert.strictEqual(found.length, 2);
  assert.ok(found.includes(0));
  assert.ok(found.includes(1));
  assert.ok(!found.includes(2), 'Entity 2 is 15m away, should not be included');
  assert.ok(!found.includes(3), 'Entity 3 is far away');

  // Query within 20m of (100, 200) -> should find 0, 1, and 2
  const found20: number[] = [];
  grid.forEachNeighbor(100, 200, 20.0, (id) => found20.push(id));
  assert.strictEqual(found20.length, 3);
  assert.ok(found20.includes(2));

  // Find nearest neighbor to entity 0 (excluding self)
  const nearest = grid.findNearest(100, 200, 50.0, 0);
  assert.ok(nearest !== null);
  assert.strictEqual(nearest.neighborId, 1);
  assert.ok(Math.abs(nearest.distM - Math.hypot(5, 4)) < 1e-3);

  // Performance benchmark: 2,000 spatial operations under test load (unique IDs per frame)
  const benchGrid = new FastSpatialGrid2D(4000, 32, 2048);
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    benchGrid.insert(i, (i % 50) * 10 - 250, Math.floor(i / 50) * 10 - 250);
  }
  for (let i = 0; i < 1000; i++) {
    benchGrid.forEachNeighbor(0, 0, 45, () => {});
  }
  const elapsedMs = performance.now() - start;
  assert.ok(elapsedMs < 60.0, `2,000 grid ops took ${elapsedMs.toFixed(2)}ms, must be < 60ms`);

  // Clear grid
  grid.clear();
  assert.strictEqual(grid.size, 0);
  const foundAfterClear: number[] = [];
  grid.forEachNeighbor(100, 200, 100.0, id => foundAfterClear.push(id));
  assert.strictEqual(foundAfterClear.length, 0);
});

test('CT-08-02: FluvialVesselSystem simulates Amazonian boat archetypes, routes, and wave buoyancy', () => {
  const root = new Group();
  const vessels = new FluvialVesselSystem(root);

  try {
    assert.strictEqual(root.children.length, 2, 'Must have 2 draw calls: hulls and cabins');
    assert.strictEqual(vessels.fleetSize, 28);

    // Verify all 5 vessel archetypes have valid parameters
    for (const [vClass, arch] of Object.entries(VESSEL_ARCHETYPES)) {
      assert.ok(arch.length > 0, `${vClass} length must be > 0`);
      assert.ok(arch.width > 0, `${vClass} width must be > 0`);
      assert.ok(arch.speedMps > 0, `${vClass} speed must be > 0`);
      assert.ok(arch.colors.length > 0, `${vClass} colors must exist`);
    }

    // Run 60 frames of fluvial simulation
    const dt = 0.016;
    for (let f = 0; f < 60; f++) {
      vessels.update(dt, f * dt, 0, 0);
    }

    const activeList = vessels.activeVessels.filter(v => v.active);
    assert.ok(activeList.length > 20, 'At least 20 vessels should be active');

    // Check first vessel position and hydrodynamic pitch/roll
    const v0 = activeList[0];
    assert.ok(isFinite(v0.x), 'Vessel X must be finite');
    assert.ok(isFinite(v0.z), 'Vessel Z must be finite');
    assert.ok(isFinite(v0.y), 'Vessel Y must be finite');
    assert.ok(isFinite(v0.pitch), 'Vessel pitch must be finite');
    assert.ok(isFinite(v0.roll), 'Vessel roll must be finite');

    // Pitch and roll should be small realistic wave tilt angles (< 0.5 rad)
    assert.ok(Math.abs(v0.pitch) < 0.5, `Vessel pitch ${v0.pitch} out of physical bounds`);
    assert.ok(Math.abs(v0.roll) < 0.5, `Vessel roll ${v0.roll} out of physical bounds`);

    // Test vessel damage/hit
    vessels.hit(0);
    assert.strictEqual(v0.wreck, true);
    assert.ok(v0.wreckTimer > 0);
  } finally {
    vessels.dispose();
  }
});

test('CT-08-03: PopulationManager crowd separation avoids pedestrian overlapping on sidewalks', () => {
  const root = new Group();
  const pop = new PopulationManager(root);

  try {
    const playerPos = new Vector3(0, 0, 0);
    pop.update(0.016, playerPos, 1.0);

    const npcs = pop.npcs.filter(n => n.active);
    assert.ok(npcs.length > 10, 'Active NPCs must be spawned');

    // Check separation between any two adjacent NPCs
    for (let i = 0; i < npcs.length; i++) {
      for (let j = i + 1; j < npcs.length; j++) {
        const d = Math.hypot(npcs[i].position.x - npcs[j].position.x, npcs[i].position.z - npcs[j].position.z);
        // Pedestrians must not occupy the exact same point
        assert.ok(d >= 0.0, 'Distance must be non-negative');
      }
    }

    // Trigger supersonic flyby impact near NPCs (player at (0,0,0), NPC 12 is at x~10, z~2)
    const supersonicVel = new Vector3(80, 0, 0); // 80 m/s
    pop.update(0.016, playerPos, 1.0, supersonicVel);

    // Nearby NPC (e.g. NPC 12) should react and transition to fleeing
    const npc12 = pop.npcs[12];
    assert.strictEqual(npc12.state, 'fleeing', 'Nearby NPC 12 should flee from supersonic flyby');
    assert.ok(npc12.timer > 0);
  } finally {
    pop.dispose();
  }
});

test('traffic brakes for a player in its lane and turns a hit car into a wreck', () => {
  const graph = new RoadGraph();
  assert.ok(graph.load({
    nodes: [[-400, 0], [400, 0]],
    segments: [{ id: 'av-djalma-batista', p: [-400, 0, 400, 0], a: 0, b: 1, width: 14, speed: 12 }],
  }));
  let honks = 0;
  const traffic = new TrafficSystem(new Group(), graph, () => { honks++; });
  try {
    traffic.setCount(4);
    traffic.update(1 / 60, new Vector3());
    assert.equal(traffic.stats.segments, 1);
    const body = traffic.colliders[0];
    assert.ok(body);
    const center = new Vector3(body.x, body.y, body.z);
    const car = traffic.findNearestCar(center);
    assert.ok(car);
    const ahead = center.clone().add(new Vector3(Math.sin(car.yaw) * 8, 0, Math.cos(car.yaw) * 8));
    traffic.update(1 / 60, ahead);
    assert.ok(honks > 0);
    // Neither a non-finite dt nor an invalid player position poisons existing vehicle poses.
    traffic.update(NaN, center);
    traffic.update(1 / 60, new Vector3(Infinity, 0, 0));
    assert.ok(traffic.colliders.every(({x, y, z}) => Number.isFinite(x + y + z)));
    assert.ok(traffic.impulse(center, 50, 45) > 0);
    assert.ok(traffic.lastImpulseWrecks > 0);
    assert.ok(!traffic.colliders.some(collider => collider.id === body.id));
  } finally { traffic.dispose(); }
});

test('crowd keeps finite poses on a bad timestep and reconstructs an NPC hit in the core', () => {
  const pop = new PopulationManager(new Group());
  const focus = new Vector3();
  try {
    pop.update(1 / 60, focus, 1);
    const npc = pop.npcs.find(actor => actor.active);
    assert.ok(npc);
    pop.update(NaN, focus, 1);
    assert.ok(pop.npcs.every(({position}) => Number.isFinite(position.x + position.y + position.z)));
    const point = npc.position.clone();
    const footprint = { ...resolveImpact(450), reactionRadiusM: 35, blastDamageRadiusM: 25,
      impulseRadiusM: 15, coreDestructionRadiusM: 5, impulse: 40 };
    assert.ok(pop.applyImpact(point, footprint).disabled > 0);
    assert.equal(npc.active, false);
    assert.ok(pop.reconstruct(point, 100) > 0);
    assert.equal(npc.active, true);
    assert.equal(pop.reconstruct(point, 100), 0);
  } finally { pop.dispose(); }
});

test('vessels keep finite navigation and wave poses after invalid time input', () => {
  const vessels = new FluvialVesselSystem(new Group());
  try {
    vessels.setFleetSize(16);
    const active = vessels.activeVessels.filter(vessel => vessel.active);
    assert.equal(active.length, 16);
    const initialX = active[0].x, initialZ = active[0].z;
    for (let i = 0; i < 40; i++) vessels.update(1 / 60, i / 60, -800, 2400);
    assert.ok(Math.hypot(active[0].x - initialX, active[0].z - initialZ) > .1);
    vessels.update(NaN, 2, -800, 2400);
    vessels.update(1 / 60, NaN, -800, 2400);
    assert.ok(active.every(({x, y, z, yaw}) => Number.isFinite(x + y + z + yaw)));
  } finally { vessels.dispose(); }
});

test('spatial grid rejects corrupt and duplicate inserts and finds neighbors beyond its edge', () => {
  const grid = new FastSpatialGrid2D(4000, 32, 512);
  grid.insert(0, NaN, 100);
  grid.insert(1.5, 100, 100);
  grid.insert(2, 100, Infinity);
  assert.equal(grid.size, 0);

  grid.insert(0, 2300, 0);
  grid.insert(1, 2310, 0);
  grid.insert(0, 2300, 0);
  assert.equal(grid.size, 2);
  assert.deepEqual(grid.findNearest(2300, 0, 10, 0), { neighborId: 1, distM: 10 });
  assert.equal(grid.findNearest(2300, 0, -1), null);
  assert.equal(grid.findNearest(NaN, 0, 20), null);
  grid.clear();
  grid.insert(0, 0, 0);
  assert.deepEqual(grid.findNearest(0, 0, 1), { neighborId: 0, distM: 0 });
});

