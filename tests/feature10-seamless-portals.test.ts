import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { PortalSystem } from '../src/world/spatial/PortalSystem';

test('CT-10-01: PortalSystem pair registration, bidirectional linking, and world transform updating', () => {
  const portalSystem = new PortalSystem();

  const portalA = portalSystem.registerPortal({
    id: 'portal_praca_sao_sebastiao',
    name: 'Portal São Sebastião (Manaus)',
    position: new Vector3(0, 5, 0),
    rotation: new Euler(0, 0, 0),
    width: 4.0,
    height: 6.0
  });

  const portalB = portalSystem.registerPortal({
    id: 'portal_marte_crater',
    name: 'Portal Cratera de Marte',
    position: new Vector3(500, 80, -300),
    rotation: new Euler(0, Math.PI, 0),
    width: 4.0,
    height: 6.0
  });

  const linked = portalSystem.linkPortals('portal_praca_sao_sebastiao', 'portal_marte_crater');
  assert.strictEqual(linked, true, 'Portals must link successfully');
  assert.strictEqual(portalA.targetPortal, portalB);
  assert.strictEqual(portalB.targetPortal, portalA);

  const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 5, 0);
  camera.updateMatrixWorld();

  portalSystem.update(camera, 0.016);

  // Portal A is in front of the camera and facing it
  assert.strictEqual(portalA.facingCamera, true, 'Portal A must be facing the approaching camera');
  assert.strictEqual(portalA.inFrustum, true, 'Portal A must be within view frustum');

  portalSystem.dispose();
});

test('CT-10-02: Oblique near-plane clipping matrix modification prevents interior z-fighting', () => {
  const portalSystem = new PortalSystem();
  const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 2, 10);
  camera.lookAt(0, 2, 0);
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

  const planePos = new Vector3(0, 2, 0);
  const planeNormal = new Vector3(0, 0, 1);

  const initialM22 = camera.projectionMatrix.elements[10];

  portalSystem.applyObliqueNearPlane(camera, planePos, planeNormal);

  const modifiedM22 = camera.projectionMatrix.elements[10];

  // Modified row 2 should be updated without NaN
  assert.ok(Number.isFinite(modifiedM22), 'Modified matrix element must be a valid finite number');
  assert.notStrictEqual(modifiedM22, initialM22, 'Oblique matrix element M22 should differ from standard perspective');

  for (let i = 0; i < 16; i++) {
    assert.ok(Number.isFinite(camera.projectionMatrix.elements[i]), `Element ${i} must be finite`);
  }

  portalSystem.dispose();
});

test('CT-10-03: Continuous portal crossing detection and momentum/orientation transformation', () => {
  const portalSystem = new PortalSystem();

  const portalA = portalSystem.registerPortal({
    id: 'portal_a',
    name: 'Portal A',
    position: new Vector3(0, 0, 0),
    rotation: new Euler(0, 0, 0), // Facing +Z
    width: 4.0,
    height: 6.0
  });

  const portalB = portalSystem.registerPortal({
    id: 'portal_b',
    name: 'Portal B',
    position: new Vector3(200, 10, 50),
    rotation: new Euler(0, Math.PI * 0.5, 0), // Rotated 90 degrees around Y
    width: 4.0,
    height: 6.0
  });

  portalSystem.linkPortals('portal_a', 'portal_b');

  // Step 1: Normal straight crossing from front (Z = +1.5) to behind (Z = -0.5) through portal A quad
  const prevPos = new Vector3(0, 2.0, 1.5);
  const currPos = new Vector3(0, 2.0, -0.5);
  const velocity = new Vector3(0, 0, -30); // 30 m/s entering portal
  const initialSpeed = velocity.length();
  const orientation = new Quaternion();

  const crossing = portalSystem.checkCrossing(prevPos, currPos, velocity, orientation, 0.35);

  assert.ok(crossing !== null, 'Crossing must be detected');
  assert.strictEqual(crossing!.crossed, true);
  assert.strictEqual(crossing!.sourcePortalId, 'portal_a');
  assert.strictEqual(crossing!.targetPortalId, 'portal_b');

  // Verify new position is near portal B
  assert.ok(
    crossing!.newPosition.distanceTo(portalB.worldPosition) < 15.0,
    'Player must emerge within proximity of target portal B'
  );

  // Speed magnitude (kinetic energy) must be conserved
  assert.ok(
    Math.abs(crossing!.newVelocity.length() - initialSpeed) < 1e-3,
    `Velocity magnitude must be conserved: expected ${initialSpeed}, got ${crossing!.newVelocity.length()}`
  );

  // Step 2: Test missed crossing (passing wide to the left outside the 4m width)
  const prevWide = new Vector3(-8.0, 2.0, 1.5);
  const currWide = new Vector3(-8.0, 2.0, -0.5);
  const missWide = portalSystem.checkCrossing(prevWide, currWide, velocity, orientation, 0.35);
  assert.strictEqual(missWide, null, 'Trajectory outside portal quad width must be rejected');

  // Step 3: Test moving away from portal (from Z = -0.5 to Z = +1.5)
  const revCrossing = portalSystem.checkCrossing(currPos, prevPos, velocity, orientation, 0.35);
  assert.strictEqual(revCrossing, null, 'Movement from back to front must not trigger forward crossing');

  portalSystem.dispose();
});

