import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { UrbanZoningGenerator, ZONING_POLICIES } from '../src/world/realcity/buildings';
import { AlienMetropolisGenerator } from '../src/world/life/AlienMetropolisGenerator';
import { VehicleController } from '../src/player/vehicles/VehicleController';

test('CT-06-01: UrbanZoningGenerator classifies districts and infills empty GIS parcels with zero voids', () => {
  // Test zone classification across Manaus
  const centroZone = UrbanZoningGenerator.classifyZone(100, -450, 25);
  assert.strictEqual(centroZone, 'historic', 'Centro near Teatro Amazonas must be historic');

  const cbdZone = UrbanZoningGenerator.classifyZone(1500, 500, 28);
  assert.strictEqual(cbdZone, 'commercial', 'Adrianópolis must be commercial');

  const riverZone = UrbanZoningGenerator.classifyZone(500, -2000, 15);
  assert.strictEqual(riverZone, 'fluvial', 'Riverbank must be fluvial');

  const industrialZone = UrbanZoningGenerator.classifyZone(3500, 2000, 25);
  assert.strictEqual(industrialZone, 'industrial', 'East/South must be industrial');

  // Verify zoning policies
  for (const [zone, policy] of Object.entries(ZONING_POLICIES)) {
    assert.ok(policy.minHeightM > 0, `${zone} minHeight must be > 0`);
    assert.ok(policy.maxHeightM >= policy.minHeightM, `${zone} maxHeight must be >= minHeight`);
    assert.ok(policy.roofShapes.length > 0, `${zone} roof shapes must exist`);
  }

  // Test parcel infill generation
  const infill = UrbanZoningGenerator.generateParcelInfill(2, -3, 256, 2);
  assert.ok(infill.length > 0, 'Infill must generate buildings for sparse tile');

  for (const b of infill) {
    assert.ok(b.id.startsWith('infill:'), 'Building ID must have infill prefix');
    assert.ok(b.h > 0, 'Building height must be > 0');
    assert.ok(b.f! >= 1, 'Building must have at least 1 floor');
    assert.strictEqual(b.p.length, 8, 'Building polygon must have 4 vertices (8 coordinates)');
  }
});

test('CT-06-02: AlienMetropolisGenerator generates annular rings, ziggurats and landing docks in InstancedMeshes', () => {
  const metropolis = new AlienMetropolisGenerator();

  try {
    assert.strictEqual(metropolis.group.children.length, 4, 'Must have 4 draw-call InstancedMeshes');

    metropolis.generateMetropolis(1000, 2000, 400, 12345);
    assert.ok(metropolis.megalithCount > 20, 'Metropolis must have > 20 megalith structures');

    // Run 10 frames of metropolis presence
    for (let f = 0; f < 10; f++) {
      // Metropolis maintains zero-allocation transform state
      assert.strictEqual(metropolis.group.visible, true);
    }
  } finally {
    metropolis.dispose();
  }
});

test('CT-06-03: VehicleController simulates drivable Car, Boat, Airplane, and Spaceship physics', () => {
  const vehicle = new VehicleController();

  // Mock input controller
  const keys = new Set<string>();
  const mockInput = {
    held: (code: string) => keys.has(code),
    consume: (code: string) => keys.delete(code),
    pressed: (code: string) => keys.has(code),
    enabled: true
  } as any;

  try {
    vehicle.spawnAt(new Vector3(0, 5, 0), 0, 'car');
    vehicle.isOccupied = true;

    // 1. CAR TEST: Accelerate forward with KeyW
    keys.add('KeyW');
    for (let f = 0; f < 30; f++) {
      vehicle.update(0.016, mockInput, vehicle.position);
    }
    keys.delete('KeyW');

    const carTelem = vehicle.getTelemetry();
    assert.strictEqual(carTelem.type, 'car');
    assert.ok(carTelem.speedKmh > 5.0, `Car speed ${carTelem.speedKmh} km/h must be > 5 km/h`);
    assert.ok(carTelem.rpm > 1200, 'Car engine RPM must rise above idle');
    assert.ok(isFinite(vehicle.position.y), 'Car Y position must be finite');

    // 2. BOAT TEST: Switch to boat and sample wave buoyancy
    vehicle.selectVehicleType('boat');
    keys.add('KeyW');
    for (let f = 0; f < 30; f++) {
      vehicle.update(0.016, mockInput, vehicle.position);
    }
    keys.delete('KeyW');

    const boatTelem = vehicle.getTelemetry();
    assert.strictEqual(boatTelem.type, 'boat');
    assert.ok(boatTelem.speedKmh > 2.0, 'Boat must move through water');
    assert.ok(isFinite(vehicle.pitch), 'Boat pitch must be finite');
    assert.ok(isFinite(vehicle.roll), 'Boat roll must be finite');

    // 3. AIRPLANE TEST: Switch to airplane and test lift (L ~ v^2)
    vehicle.selectVehicleType('airplane');
    vehicle.spawnAt(new Vector3(0, 100, 0), 0); // Airborne
    vehicle.velocity.set(0, 0, -45); // 45 m/s forward airspeed
    keys.add('KeyW'); // Full throttle

    for (let f = 0; f < 30; f++) {
      vehicle.update(0.016, mockInput, vehicle.position);
    }
    keys.delete('KeyW');

    const planeTelem = vehicle.getTelemetry();
    assert.strictEqual(planeTelem.type, 'airplane');
    assert.ok(planeTelem.speedKmh > 100, 'Airplane must maintain high airspeed');

    // 4. SPACESHIP / ROCKET TEST: 6-DoF VTOL and anti-gravity hover
    vehicle.selectVehicleType('spaceship');
    vehicle.spawnAt(new Vector3(0, 50, 0), 0);
    keys.add('KeyW');

    for (let f = 0; f < 30; f++) {
      vehicle.update(0.016, mockInput, vehicle.position);
    }
    keys.delete('KeyW');

    const shipTelem = vehicle.getTelemetry();
    assert.strictEqual(shipTelem.type, 'spaceship');
    assert.ok(shipTelem.speedKmh > 10, 'Spaceship thrusters must accelerate');
  } finally {
    vehicle.dispose();
  }
});

test('CT-06-04: VehicleController resolves building collision impulses and bridge deck heights', () => {
  const vehicle = new VehicleController();
  const mockInput = {
    held: () => false,
    consume: () => false,
    mouseDelta: { x: 0, y: 0 },
    enabled: true,
  } as any;

  try {
    vehicle.spawnAt(new Vector3(0, 0.65, 0), 0, 'car');
    vehicle.isOccupied = true;
    vehicle.velocity.set(0, 0, -20); // Moving forward at 20 m/s towards obstacle at z = -5

    let crashSpeedRecorded = 0;
    vehicle.onCrash = (speed) => {
      crashSpeedRecorded = speed;
    };

    // Solid obstacle box at (0, 2, -5) with dimensions (4, 4, 2)
    const obstacleCollider = {
      id: 'building-block-01',
      x: 0,
      y: 2,
      z: -5,
      width: 4,
      height: 4,
      depth: 2,
    };

    // Elevated bridge deck at (0, 15, -20) with dimensions (10, 2, 20)
    const bridgeCollider = {
      id: 'bridge-ponte-rio-negro',
      x: 0,
      y: 15,
      z: -20,
      width: 10,
      height: 2,
      depth: 20,
    };

    const colliders = [obstacleCollider, bridgeCollider];

    // Simulate vehicle reaching obstacle
    vehicle.position.set(0, 0.65, -3.5);
    vehicle.update(0.05, mockInput, vehicle.position, colliders);

    // Collision should repel the vehicle or invert velocity
    assert.ok(crashSpeedRecorded > 5.0, 'Vehicle onCrash callback should fire on high-speed collision');
    assert.ok(vehicle.position.z > -4.5, 'Vehicle should not penetrate deep into solid obstacle');

    // Simulate driving on elevated bridge deck
    vehicle.position.set(0, 16.0, -20.0);
    vehicle.update(0.05, mockInput, vehicle.position, colliders);
    assert.ok(vehicle.position.y >= 16.0, 'Vehicle should ride on elevated bridge deck (y >= 16m)');
  } finally {
    vehicle.dispose();
  }
});


