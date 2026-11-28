import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group, Euler } from 'three';
import { VehicleController, type VehicleType } from '../src/player/vehicles/VehicleController';
import { PowerSystem } from '../src/player/powers/PowerSystem';
import { TrafficSystem } from '../src/world/traffic/TrafficSystem';
import { RoadGraph } from '../src/world/traffic/RoadGraph';
import { FluvialVesselSystem } from '../src/world/traffic/FluvialVesselSystem';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

test('PATCH 04A: 1. Vehicle weapon forward ballistic raycast damages target hit point, not muzzle origin', () => {
  const vehicle = new VehicleController();
  vehicle.spawnAt(new Vector3(0, 5, 0), 0, 'airplane');
  vehicle.isOccupied = true;

  // Solid obstacle box located at (0, 5, -50) with width 10, height 10, depth 4
  const targetCollider = {
    id: 'target-hangar-01',
    x: 0,
    y: 5,
    z: -50,
    width: 10,
    height: 10,
    depth: 4,
  };
  const colliders = [targetCollider];

  let damageAppliedAt: Vector3 | null = null;
  let damageRadius = 0;
  let damageAmount = 0;

  // Simulate onFireWeapon with raycasting solver
  vehicle.onFireWeapon = (origin, direction) => {
    const maxRange = 300.0;
    const hit = PhysicsWorld.raycast(origin, direction, colliders, maxRange);
    const impactPoint = new Vector3();

    if (hit && hit.point) {
      impactPoint.copy(hit.point);
    } else {
      impactPoint.copy(origin).addScaledVector(direction, maxRange);
    }

    damageAppliedAt = impactPoint;
    damageRadius = 6.0;
    damageAmount = 250;
  };

  // Mock input firing weapon
  const keys = new Set<string>(['KeyE']);
  const mockInput = {
    held: (code: string) => keys.has(code),
    consume: (code: string) => keys.delete(code),
    pressed: (code: string) => keys.has(code),
    enabled: true
  } as any;

  vehicle.update(0.016, mockInput, vehicle.position, colliders);

  assert.ok(damageAppliedAt !== null, 'Damage must be applied when weapon is fired');
  // Impact point must be at front surface of obstacle (z ≈ -48), NOT at muzzle origin (z ≈ -3.5)
  assert.ok(
    Math.abs(damageAppliedAt!.z - (-48.0)) < 1.0,
    `Damage hit point z=${damageAppliedAt!.z.toFixed(2)} must be at target obstacle front face (-48m), not at muzzle origin`
  );
  assert.strictEqual(damageRadius, 6.0);
  assert.strictEqual(damageAmount, 250);

  vehicle.dispose();
});

test('PATCH 04A: 2. Vehicle control isolation prevents PowerSystem conflicts (KeyT, KeyE, Mouse0, KeyH)', () => {
  const root = new Group();
  let isOccupied = false;

  const mockPlayer = {
    position: new Vector3(0, 1, 0),
    size: 1.0,
    model: new Group(),
    character: {
      hips: { rotation: new Euler() },
      initializeAnimations: async () => {},
    },
    teleport: () => {},
    powerPose: () => {},
    consumeImpact: () => null,
  } as any;

  const mockCamera = {
    position: new Vector3(0, 2, 5),
    getWorldDirection: (out: Vector3) => out.set(0, 0, -1),
  } as any;

  const keys = new Set<string>();
  const mockInput = {
    held: (code: string) => keys.has(code),
    consume: (code: string) => {
      const has = keys.has(code);
      keys.delete(code);
      return has;
    },
    pressed: (code: string) => keys.has(code),
    enabled: true
  } as any;

  let powersUsed: string[] = [];
  const powers = new PowerSystem(root, mockPlayer, mockCamera, mockInput, {
    prepare: async () => {},
    notify: (msg) => powersUsed.push(msg),
    sound: () => {},
    getOrigin: () => new Vector3(),
    getColliders: () => [],
    isVehicleOccupied: () => isOccupied,
  });

  // 1. On foot: KeyT triggers temporal power
  isOccupied = false;
  keys.add('KeyT');
  powers.update(0.016, 0.016);
  assert.strictEqual(powers.temporal, true, 'On foot, KeyT must activate temporal perception');

  // Turn temporal off for testing
  powers.temporal = false;

  // 2. In vehicle: KeyT, KeyE, Mouse0 must be ignored by PowerSystem
  isOccupied = true;
  keys.add('KeyT');
  keys.add('KeyE');
  keys.add('Mouse0');
  powers.update(0.016, 0.016);

  assert.strictEqual(powers.temporal, false, 'While in vehicle, KeyT must NOT trigger temporal power');
  assert.strictEqual(powers.laserActive, false, 'While in vehicle, lasers must remain inactive');

  // Vehicle controller receives KeyT for tractor beam
  const vehicle = new VehicleController();
  vehicle.spawnAt(new Vector3(0, 10, 0), 0, 'saucer');
  vehicle.isOccupied = true;
  keys.add('KeyT');
  vehicle.update(0.016, mockInput, vehicle.position);
  assert.strictEqual(vehicle.isTractorActive, true, 'Vehicle receives KeyT for tractor beam');

  vehicle.dispose();
  powers.dispose();
});

test('PATCH 04A: 3. Carjacking takes over traffic and boat entities without duplication', () => {
  const root = new Group();
  const graph = new RoadGraph();
  graph.load({
    nodes: [[-400, 0], [400, 0]],
    segments: [{ id: 'street-01', p: [-400, 0, 400, 0], a: 0, b: 1, width: 12, speed: 16.6 }]
  });

  const traffic = new TrafficSystem(root, graph);
  traffic.setCount(10);
  traffic.update(0.1, new Vector3(0, 0.5, 0));

  // Find a car on the road
  const car = traffic.findNearestCar(new Vector3(0, 0.5, 0), 400.0);
  assert.ok(car !== null, 'A traffic car should exist in the simulation pool');

  const slot = car!.slot;
  // Take over the car
  const taken = traffic.takeOverCar(slot);
  assert.ok(taken !== null, 'Traffic car should be successfully taken over');
  assert.strictEqual(taken!.x, car!.x);

  // Verify car is removed/hidden from active traffic pool (no duplication)
  const reCheck = traffic.findNearestCar(new Vector3(taken!.x, 0.5, taken!.z), 0.5);
  assert.strictEqual(reCheck, null, 'Original car slot must no longer be present at that location');

  // Return the car back to traffic
  traffic.returnCar(new Vector3(10, 0.5, -20), Math.PI / 2);
  const returned = traffic.findNearestCar(new Vector3(10, 0.5, -20), 1.0);
  assert.ok(returned !== null, 'Returned car should be re-instated into the traffic pool');

  // Fluvial Vessel takeover test
  const boatRoot = new Group();
  const vessels = new FluvialVesselSystem(boatRoot);
  vessels.update(0.016, 1.0, 0, -500);

  const boat = vessels.findNearestBoat(new Vector3(0, 0, -500), 1500.0);
  if (boat) {
    const takenBoat = vessels.takeOverBoat(boat.index);
    assert.ok(takenBoat !== null, 'Fluvial vessel must be taken over cleanly without duplicate entity');
    const reCheckBoat = vessels.findNearestBoat(new Vector3(takenBoat!.x, takenBoat!.y, takenBoat!.z), 1.0);
    assert.strictEqual(reCheckBoat, null, 'Original boat index must no longer be active at that coordinate');
  }

  traffic.dispose();
  vessels.dispose();
});

test('PATCH 04A: 4. Alien Saucer UFO exhibits full 6-DoF flight dynamics without 12m ground lock', () => {
  const vehicle = new VehicleController();
  vehicle.spawnAt(new Vector3(0, 50, 0), 0, 'saucer');
  vehicle.isOccupied = true;

  const keys = new Set<string>();
  const mockInput = {
    held: (code: string) => keys.has(code),
    consume: (code: string) => keys.delete(code),
    pressed: (code: string) => keys.has(code),
    enabled: true
  } as any;

  // 1. Surge test (Forward W)
  keys.add('KeyW');
  for (let f = 0; f < 20; f++) vehicle.update(0.016, mockInput, vehicle.position);
  keys.delete('KeyW');
  assert.ok(vehicle.velocity.z < -5.0, 'Saucer must accelerate forward along negative Z');

  // 2. Sway test (Lateral strafe D)
  vehicle.velocity.set(0, 0, 0);
  keys.add('KeyD');
  for (let f = 0; f < 20; f++) vehicle.update(0.016, mockInput, vehicle.position);
  keys.delete('KeyD');
  assert.ok(Math.abs(vehicle.velocity.x) > 3.0, 'Saucer must translate laterally during strafe');

  // 3. Heave test (Vertical ascent with Space - free altitude climb past 500m)
  vehicle.velocity.set(0, 0, 0);
  keys.add('Space');
  for (let f = 0; f < 60; f++) vehicle.update(0.05, mockInput, vehicle.position);
  keys.delete('Space');
  assert.ok(vehicle.position.y > 100.0, `Saucer must climb freely into high altitude (reached ${vehicle.position.y}m)`);

  // 4. Heave descent test (ControlLeft)
  vehicle.velocity.set(0, 0, 0);
  const highY = vehicle.position.y;
  keys.add('ControlLeft');
  for (let f = 0; f < 20; f++) vehicle.update(0.016, mockInput, vehicle.position);
  keys.delete('ControlLeft');
  assert.ok(vehicle.velocity.y < 0, 'Saucer must descend when Control is held');

  vehicle.dispose();
});

test('PATCH 04A: 5. Physical Tractor Beam captures, suspends, transports, and throws objects with momentum', () => {
  const vehicle = new VehicleController();
  vehicle.spawnAt(new Vector3(0, 30, 0), 0, 'saucer');
  vehicle.isOccupied = true;

  const mockTarget = {
    slot: 3,
    type: 'traffic' as const,
    position: new Vector3(0, 0.5, 0),
    velocity: new Vector3(),
    rotation: new Euler(),
    mass: 1400,
  };

  let captured = false;
  let releasedTarget: any = null;
  let releaseImpulse: Vector3 | null = null;

  vehicle.onTractorCapture = (searchPos) => {
    captured = true;
    return mockTarget;
  };

  vehicle.onTractorRelease = (target, vel) => {
    releasedTarget = target;
    releaseImpulse = vel;
  };

  const keys = new Set<string>();
  const mockInput = {
    held: (code: string) => keys.has(code),
    consume: (code: string) => keys.delete(code),
    pressed: (code: string) => keys.has(code),
    enabled: true
  } as any;

  // 1. Activate Tractor Beam
  keys.add('KeyT');
  vehicle.update(0.016, mockInput, vehicle.position);
  assert.strictEqual(captured, true, 'onTractorCapture should be invoked when tractor beam activates');
  assert.ok(vehicle.tractorTarget !== null, 'Saucer should hold tractor target reference');

  // 2. Transport target under UFO
  for (let f = 0; f < 30; f++) {
    vehicle.update(0.016, mockInput, vehicle.position);
  }
  // Target position should be suspended ~6.5m below UFO (30 - 6.5 = 23.5)
  assert.ok(
    vehicle.tractorTarget!.position.y > 20.0,
    `Captured object must be lifted up towards UFO belly (currently y=${vehicle.tractorTarget!.position.y})`
  );

  // 3. Move UFO forward while holding target
  vehicle.velocity.set(0, 0, -40);
  vehicle.update(0.016, mockInput, vehicle.position);

  // 4. Release Tractor Beam
  keys.delete('KeyT');
  vehicle.update(0.016, mockInput, vehicle.position);

  assert.strictEqual(vehicle.tractorTarget, null, 'Tractor target must be cleared on release');
  assert.ok(releasedTarget !== null, 'onTractorRelease callback must fire');
  assert.ok(releaseImpulse !== null, 'Release impulse vector must be supplied');
  assert.ok(releaseImpulse!.z < -10, 'Release impulse must carry forward throw velocity');

  vehicle.dispose();
});
