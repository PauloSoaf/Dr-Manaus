import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import {
  cubeFaceToDirection,
  createCubeSpherePatchGeometry,
  CubeSpherePlanet,
  type PlanetSurfaceGenerator,
  type CubeSphereFaceId
} from '../src/world/planet/PlanetSurface';
import type { PlanetBody } from '../src/world/planet/PlanetBody';

const mockBody: PlanetBody = {
  id: 'test_mars',
  semiMajorAxisM: 3_389_500, // Mars radius ~3,389.5 km
  flattening: 0.00589,
  rotationPeriodS: 88642,
  parentFrame: 'solar'
};

const mockSurface: PlanetSurfaceGenerator = {
  body: mockBody,
  radiusM: 3_389_500,
  heightAt: () => 150.0, // 150m plateau relief
  normalEnu: (_dir, out) => { out[0] = 0; out[1] = 0; out[2] = 1; },
  colourAt: (_dir, out) => { out[0] = 0.82; out[1] = 0.45; out[2] = 0.25; } // Martian rust red
};

test('CT-12-01: cubeFaceToDirection maps all 6 cube faces to normalized unit sphere vectors with low distortion', () => {
  const faces: CubeSphereFaceId[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  const out = new Vector3();

  for (const face of faces) {
    // Face center
    cubeFaceToDirection(face, 0, 0, out);
    assert.ok(Math.abs(out.length() - 1.0) < 1e-5, `Face ${face} center must be unit length`);

    // Face corners
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [u, v] of corners) {
      cubeFaceToDirection(face, u, v, out);
      assert.ok(Math.abs(out.length() - 1.0) < 1e-5, `Face ${face} corner (${u}, ${v}) must be unit length`);
    }
  }

  // Specific direction assertions
  cubeFaceToDirection('px', 0, 0, out);
  assert.ok(out.x > 0.99, 'px face center must point towards positive X');

  cubeFaceToDirection('py', 0, 0, out);
  assert.ok(out.y > 0.99, 'py face center must point towards positive Y');

  cubeFaceToDirection('pz', 0, 0, out);
  assert.ok(out.z > 0.99, 'pz face center must point towards positive Z');
});

test('CT-12-02: createCubeSpherePatchGeometry produces valid geometry with perimeter skirts sealing LOD cracks', () => {
  const geo = createCubeSpherePatchGeometry({
    face: 'pz',
    uMin: -1,
    uMax: 1,
    vMin: -1,
    vMax: 1,
    surface: mockSurface,
    resolution: 8,
    skirtDepthRatio: 0.05 // 5% skirt drop
  });

  const posAttr = geo.getAttribute('position');
  const normAttr = geo.getAttribute('normal');
  const colorAttr = geo.getAttribute('color');
  const indexAttr = geo.getIndex();

  assert.ok(posAttr && posAttr.count > 0, 'Position attribute must exist');
  assert.ok(normAttr && normAttr.count > 0, 'Normal attribute must exist');
  assert.ok(colorAttr && colorAttr.count > 0, 'Color attribute must exist');
  assert.ok(indexAttr && indexAttr.count > 0, 'Indices must exist');

  // Resolution 8x8 has (8+1)^2 = 81 main vertices
  // Perimeter has 8 * 4 = 32 edges, each adding 1 skirt vertex -> 81 + 32 = 113 vertices
  const expectedVertices = (8 + 1) * (8 + 1) + (8 * 4);
  assert.strictEqual(posAttr.count, expectedVertices, `Should have ${expectedVertices} vertices including skirts`);

  // Verify that skirt vertices are placed at smaller radius than main surface vertices
  const mainVertexRadius = Math.hypot(posAttr.getX(0), posAttr.getY(0), posAttr.getZ(0));
  const skirtVertexIdx = (8 + 1) * (8 + 1); // First skirt vertex
  const skirtVertexRadius = Math.hypot(posAttr.getX(skirtVertexIdx), posAttr.getY(skirtVertexIdx), posAttr.getZ(skirtVertexIdx));

  assert.ok(
    skirtVertexRadius < mainVertexRadius,
    `Skirt vertex radius (${skirtVertexRadius}) must be strictly smaller than main surface radius (${mainVertexRadius})`
  );

  geo.dispose();
});

test('CT-12-03: CubeSpherePlanet adaptive quadtree subdivides when camera approaches and collapses when receding', () => {
  const planet = new CubeSpherePlanet(mockSurface);

  // 1. Far away camera (orbital view at 50,000 km)
  const farCameraPos = new Vector3(0, 0, 50_000_000);
  planet.update(farCameraPos, 3);
  assert.strictEqual(planet.root.children.length, 6, 'Far view should have 6 root face patches');

  // 2. Approach close to +Z face (at 4,000 km, near surface of 3,389 km)
  const nearCameraPos = new Vector3(0, 0, 4_000_000);
  planet.update(nearCameraPos, 3);
  // Approaching +Z should cause +Z face to subdivide into children (more than 6 total patches)
  assert.ok(
    planet.root.children.length > 6,
    `Approaching surface should increase patch count through subdivision: got ${planet.root.children.length}`
  );

  // 3. Move back to orbit
  planet.update(farCameraPos, 3);
  assert.strictEqual(planet.root.children.length, 6, 'Receding should collapse children back to 6 root patches');

  planet.dispose();
});

test('CT-12-04: Radial spherical gravity vector points toward planet center with inverse square law', () => {
  const planet = new CubeSpherePlanet(mockSurface);
  const out = new Vector3();

  const r0 = mockSurface.radiusM; // ~3,389,500 m

  // Position at surface along X axis
  planet.computeRadialGravity(new Vector3(r0, 0, 0), out);
  assert.ok(out.x < 0, 'Gravity vector must point inwards towards the center (negative X)');
  assert.ok(Math.abs(out.y) < 1e-4);
  assert.ok(Math.abs(out.z) < 1e-4);
  const gSurface = out.length();
  assert.ok(Math.abs(gSurface - 9.81) < 0.1, `Surface gravity should be near 9.81 m/s^2: got ${gSurface}`);

  // Position at double radius (2 * r0)
  planet.computeRadialGravity(new Vector3(2 * r0, 0, 0), out);
  const gDouble = out.length();
  // By inverse square law: g(2R) = g(R) / 4
  const expectedG = gSurface / 4;
  assert.ok(
    Math.abs(gDouble - expectedG) < 0.05,
    `Double radius gravity should follow 1/r^2: expected ${expectedG}, got ${gDouble}`
  );

  planet.dispose();
});

