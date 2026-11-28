import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { TeleportSystem } from '../src/world/spatial/TeleportSystem';
import type { Collider } from '../src/core/types';

test('CT-09-01: TeleportSystem resolveTacticalTarget raycasts, calculates surface normal and offsets capsule safely', () => {
  const teleport = new TeleportSystem();
  const rayOrigin = new Vector3(0, 5, 0);
  const rayDirection = new Vector3(0, 0, 1); // Aiming forward along +Z

  // Building collider located at Z=20, width=10, height=20, depth=10 (bounds Z: [15, 25])
  const colliders: Collider[] = [
    {
      id: 'building_1',
      x: 0,
      y: 10,
      z: 20,
      width: 10,
      height: 20,
      depth: 10,
      minX: -5,
      maxX: 5,
      minY: 0,
      maxY: 20,
      minZ: 15,
      maxZ: 25
    }
  ];

  const result = teleport.resolveTacticalTarget(rayOrigin, rayDirection, colliders, 1.0, 100.0);

  assert.strictEqual(result.success, true, 'Raycast should hit the front face of the building');
  assert.ok(result.hitDistance > 0 && result.hitDistance <= 25, 'Hit distance should be within range');

  // Front face normal should point towards the ray origin (-Z)
  assert.strictEqual(result.surfaceNormal.z, -1, 'Surface normal of front wall should face negative Z');
  assert.strictEqual(result.surfaceNormal.x, 0);
  assert.strictEqual(result.surfaceNormal.y, 0);

  // Safe placement should be offset along normal away from the building interior
  assert.ok(result.safePlacement.z < result.destination.z, 'Safe placement must be pushed outwards from wall');
  // Safe placement Y should include capsule half-height
  assert.ok(result.safePlacement.y >= result.destination.y, 'Safe placement must offset capsule vertically');
});

test('CT-09-02: TeleportSystem quantum jump lifecycle and gravitational lens distortion curve', () => {
  const teleport = new TeleportSystem();

  teleport.startQuantumJump('earth', 'mars');

  // Initial update at t = 0
  const state0 = teleport.updateQuantumJump(0.0);
  assert.strictEqual(state0.active, true);
  assert.ok(state0.lensDistortion >= 0);

  // Mid-jump update at t = 200ms (0.2s of 0.4s duration = 50% progress)
  const stateMid = teleport.updateQuantumJump(0.2);
  assert.strictEqual(stateMid.active, true);
  assert.strictEqual(stateMid.completed, false);
  // At peak progress (0.5), sin(0.5 * PI) = 1.0
  assert.ok(Math.abs(stateMid.lensDistortion - 1.0) < 0.05, 'Gravitational lens distortion must peak near 1.0 at midpoint');

  // Finish jump at t = 200ms more (total 0.4s)
  const stateEnd = teleport.updateQuantumJump(0.2);
  assert.strictEqual(stateEnd.active, false, 'Jump must be inactive after duration completes');
  assert.strictEqual(stateEnd.completed, true, 'Jump must report completed');
  assert.strictEqual(stateEnd.lensDistortion, 0, 'Lens distortion must return to 0');
});

test('CT-09-03: TeleportSystem transformMomentum preserves kinetic energy across reference frame rotations', () => {
  const teleport = new TeleportSystem();

  const initialVelocity = new Vector3(0, 0, 75.0); // 75 m/s along Z
  const initialSpeed = initialVelocity.length();

  const sourceOrientation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0);
  // Rotate target frame 90 degrees around Y axis
  const targetOrientation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI * 0.5);

  const transformedVelocity = teleport.transformMomentum(initialVelocity, sourceOrientation, targetOrientation);

  // Speed magnitude must be strictly conserved
  assert.ok(
    Math.abs(transformedVelocity.length() - initialSpeed) < 1e-4,
    `Momentum magnitude must be strictly conserved: got ${transformedVelocity.length()}, expected ${initialSpeed}`
  );

  // Direction should have rotated by 90 degrees towards X
  assert.ok(Math.abs(transformedVelocity.x - 75.0) < 0.1, 'Velocity direction should be mapped into target frame');
  assert.ok(Math.abs(transformedVelocity.z) < 0.1, 'Z component should rotate to near 0');

  // Zero velocity edge-case test
  const zeroVel = teleport.transformMomentum(new Vector3(0, 0, 0), sourceOrientation, targetOrientation);
  assert.strictEqual(zeroVel.length(), 0, 'Zero velocity must remain zero without NaN');
});

