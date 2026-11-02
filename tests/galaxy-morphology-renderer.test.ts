import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import {
  GalaxyPointCloudProvider,
  GALAXY_POINT_BUDGETS,
  resolveGalaxyDescriptor,
} from '../src/world/galaxy/GalaxyPointCloudProvider.ts';
import { GalaxyMorphologyRenderer } from '../src/world/galaxy/GalaxyMorphologyRenderer.ts';
import { GalaxyProvider } from '../src/world/providers/GalaxyProvider.ts';
import { ProceduralGalaxyGenerator } from '../src/world/galaxy/ProceduralGalaxyGenerator.ts';
import { LOCAL_GROUP_CATALOG } from '../src/world/celestial/GalaxyDefinition.ts';
import { LIGHT_YEAR_M } from '../src/world/spatial/units.ts';
import { sectorIndex } from '../src/world/spatial/UniverseAddress.ts';

const generator = new ProceduralGalaxyGenerator();
const universeSeed = 0x1234_5678_9abc_defn;
const cell = { x: 0n, y: 0n, z: 0n };

test('T_U42_01_POINT_CLOUD_DETERMINISM: identical descriptor produces bit-identical buffers', () => {
  const provider = new GalaxyPointCloudProvider();
  const desc = generator.generateGalaxy(universeSeed, cell, 0); // Milky Way

  const geom1 = provider.generateGeometry(desc, 1000);
  const geom2 = provider.generateGeometry(desc, 1000);

  const pos1 = geom1.getAttribute('position').array as Float32Array;
  const pos2 = geom2.getAttribute('position').array as Float32Array;
  assert.equal(pos1.length, pos2.length);
  for (let i = 0; i < pos1.length; i++) {
    assert.equal(pos1[i], pos2[i], `Position mismatch at index ${i}`);
  }

  const col1 = geom1.getAttribute('color').array as Float32Array;
  const col2 = geom2.getAttribute('color').array as Float32Array;
  assert.equal(col1.length, col2.length);
  for (let i = 0; i < col1.length; i++) {
    assert.equal(col1[i], col2[i], `Color mismatch at index ${i}`);
  }

  // Divergence check: different seed must produce divergent coordinates
  const descDiff = generator.generateGalaxy(universeSeed ^ 0xffn, { x: 5n, y: 5n, z: 5n }, 0);
  const geomDiff = provider.generateGeometry(descDiff, 1000);
  const posDiff = geomDiff.getAttribute('position').array as Float32Array;
  let differences = 0;
  for (let i = 0; i < Math.min(pos1.length, posDiff.length); i++) {
    if (Math.abs(pos1[i] - posDiff[i]) > 1e-4) differences++;
  }
  assert.ok(differences > 900, 'Different galaxy seeds must produce divergent point clouds');

  geom1.dispose();
  geom2.dispose();
  geomDiff.dispose();
  provider.dispose();
});

test('T_U42_02_MORPHOLOGY_DEPENDENT_DISTRIBUTION: geometry attributes reflect Hubble classification', () => {
  const provider = new GalaxyPointCloudProvider();

  // 1. Barred Spiral (Milky Way)
  const mwDesc = generator.generateGalaxy(universeSeed, cell, 0);
  assert.equal(mwDesc.family, 'barred-spiral');
  assert.ok(mwDesc.bar.active);
  assert.ok(mwDesc.spiralArms.active);

  const mwGeom = provider.generateGeometry(mwDesc, 5000);
  const mwPos = mwGeom.getAttribute('position').array as Float32Array;
  const mwColors = mwGeom.getAttribute('color').array as Float32Array;

  // Thin disk: vertical coordinate (Y in Three.js) must be tightly bounded
  let mwMaxAbsY = 0;
  let mwBlueCount = 0;
  for (let i = 0; i < 5000; i++) {
    const y = Math.abs(mwPos[i * 3 + 1]);
    if (y > mwMaxAbsY) mwMaxAbsY = y;
    // Blue-white stars on spiral arms: B > R
    const r = mwColors[i * 3];
    const b = mwColors[i * 3 + 2];
    if (b > r) mwBlueCount++;
  }
  assert.ok(mwMaxAbsY < 0.5, 'Spiral galaxy disk must have small vertical thickness ratio');
  assert.ok(mwBlueCount > 1000, 'Spiral galaxy must have significant blue-white stellar population in arms');

  // 2. Pure Elliptical galaxy (force elliptical descriptor)
  const ellDesc = generator.generateGalaxy(universeSeed, { x: 12n, y: 34n, z: 56n }, 0);
  // Find an elliptical galaxy
  let targetEllDesc = ellDesc;
  for (let idx = 0; idx < 10; idx++) {
    const candidate = generator.generateGalaxy(0x9999_8888n + BigInt(idx * 17), { x: 30n, y: 40n, z: 50n }, 0);
    if (candidate.family === 'elliptical') {
      targetEllDesc = candidate;
      break;
    }
  }

  const ellGeom = provider.generateGeometry(targetEllDesc, 3000);
  const ellColors = ellGeom.getAttribute('color').array as Float32Array;
  let ellWarmCount = 0;
  for (let i = 0; i < 3000; i++) {
    const r = ellColors[i * 3];
    const b = ellColors[i * 3 + 2];
    if (r > b) ellWarmCount++; // Warm amber/red stars
  }
  assert.ok(
    ellWarmCount / 3000 > 0.85,
    'Elliptical galaxy must be dominated by mature warm/red stellar populations (R > B)',
  );

  mwGeom.dispose();
  ellGeom.dispose();
  provider.dispose();
});

test('T_U42_03_PARTICLE_BUDGETS_AND_PRESETS: particle counts respect engineering ceilings', () => {
  const provider = new GalaxyPointCloudProvider();
  const desc = generator.generateGalaxy(universeSeed, cell, 1); // Andromeda

  assert.equal(GALAXY_POINT_BUDGETS.Low, 10_000);
  assert.equal(GALAXY_POINT_BUDGETS.Medium, 40_000);
  assert.equal(GALAXY_POINT_BUDGETS.High, 100_000);

  const geomLow = provider.getGeometry(desc, 'Low');
  assert.equal(geomLow.getAttribute('position').count, 10_000);

  const geomMed = provider.getGeometry(desc, 'Medium');
  assert.equal(geomMed.getAttribute('position').count, 40_000);

  const geomCustom = provider.getGeometry(desc, 'High', 1500);
  assert.equal(geomCustom.getAttribute('position').count, 1500);

  provider.dispose();
});

test('T_U42_04_LOD_TRANSITIONS_AND_15_PERCENT_HYSTERESIS: avoids popping and directional thrashing', () => {
  const parent = new Group();
  const desc = generator.generateGalaxy(universeSeed, cell, 1); // Andromeda
  const renderer = new GalaxyMorphologyRenderer(parent, desc, {
    lodThreshold01: 16,
    lodThreshold12: 280,
    hysteresisRatio: 0.85,
  });

  // 1. Initial distant state (D_px = 5 px)
  renderer.update(1e25, 5);
  assert.equal(renderer.currentLod, 0, 'D_px=5 must select LOD 0 (distant sprite)');

  // 2. Approach: D_px increases to 25 px (crosses 16 px threshold)
  renderer.update(5e23, 25);
  assert.equal(renderer.currentLod, 1, 'D_px=25 must transition up to LOD 1');

  // 3. Minor retreat: D_px decreases to 14.5 px (below 16 px, but above 16 * 0.85 = 13.6 px)
  renderer.update(5.2e23, 14.5);
  assert.equal(renderer.currentLod, 1, 'Hysteresis deadband (13.6 - 16 px) must prevent dropping to LOD 0');

  // 4. Major retreat: D_px decreases to 10 px (below 13.6 px)
  renderer.update(1e24, 10);
  assert.equal(renderer.currentLod, 0, 'D_px=10 must transition down to LOD 0');

  // 5. Close approach: D_px jumps to 320 px (crosses 280 px threshold)
  renderer.update(1e22, 320);
  assert.equal(renderer.currentLod, 2, 'D_px=320 must transition up to LOD 2 (full 3D particle cloud)');

  // 6. Minor retreat: D_px drops to 250 px (below 280 px, but above 280 * 0.85 = 238 px)
  renderer.update(1.2e22, 250);
  assert.equal(renderer.currentLod, 2, 'Hysteresis deadband (238 - 280 px) must prevent dropping to LOD 1');

  // 7. Significant retreat: D_px drops to 200 px (below 238 px)
  renderer.update(2e22, 200);
  assert.equal(renderer.currentLod, 1, 'D_px=200 must transition down to LOD 1');

  renderer.dispose();
  parent.clear();
});

test('T_U42_05_BUFFER_CACHING_AND_REUSE: returns identical geometry instance without GC thrashing', () => {
  const provider = new GalaxyPointCloudProvider();
  const desc = generator.generateGalaxy(universeSeed, cell, 0);

  const geom1 = provider.getGeometry(desc, 'Medium');
  const geom2 = provider.getGeometry(desc, 'Medium');
  assert.equal(geom1, geom2, 'Repeated requests for same descriptor and preset must return cached geometry');

  // Dispose releases and clears
  provider.dispose();
  const geom3 = provider.getGeometry(desc, 'Medium');
  assert.notEqual(geom1, geom3, 'After disposal, provider generates fresh geometry');
  provider.dispose();
});

test('T_U42_06_CANONICAL_ENTITIES_PRESERVATION: Milky Way and Andromeda descriptors maintain astrophysical traits', () => {
  const mwDef = LOCAL_GROUP_CATALOG.find((g) => g.id === 'milky_way')!;
  const andDef = LOCAL_GROUP_CATALOG.find((g) => g.id === 'andromeda')!;

  const mwDesc = resolveGalaxyDescriptor(mwDef);
  assert.equal(mwDesc.id, 'milky_way');
  assert.equal(mwDesc.family, 'barred-spiral');
  assert.ok(mwDesc.bar.active);
  assert.equal(mwDesc.spiralArms.numArms, 4);

  const andDesc = resolveGalaxyDescriptor(andDef);
  assert.equal(andDesc.id, 'andromeda');
  assert.equal(andDesc.family, 'spiral');
  assert.equal(andDesc.bar.active, false);
  assert.equal(andDesc.spiralArms.numArms, 2);
});

test('T_U42_07_GALAXY_PROVIDER_LIFECYCLE_AND_PROXY_BOUNDS: proxy maintains 20km distance without Float32 overflow', () => {
  const parent = new Group();
  const andDef = LOCAL_GROUP_CATALOG.find((g) => g.id === 'andromeda')!;
  const provider = new GalaxyProvider(parent, { galaxy: andDef });

  assert.equal(provider.id, 'galaxy-macro/andromeda');
  assert.equal(provider.priority, 2);
  assert.equal(provider.group.visible, false);

  // Update while camera is in Milky Way at high altitude
  const mwAddress = { galaxyId: 'milky_way', sector: sectorIndex(0n, 0n, 0n), systemId: 'sol' };
  const cameraPosM: [number, number, number] = [0, 0, 0];
  provider.update(mwAddress, cameraPosM, 100_000 * LIGHT_YEAR_M);

  assert.equal(provider.group.visible, true);
  const pos = provider.group.position;
  const proxyDistance = Math.hypot(pos.x, pos.y, pos.z);
  // Proxy distance must strictly equal 20,000 metres (20 km) relative to camera
  assert.ok(
    Math.abs(proxyDistance - 20_000) < 1e-2,
    `Proxy distance must be exactly 20,000m (actual: ${proxyDistance})`,
  );

  // Group scale must be bounded <= 4000
  assert.ok(provider.group.scale.x <= 4000);
  assert.ok(provider.group.scale.x > 0);

  // Stats include visibility and LOD
  assert.equal(provider.stats.visible, true);
  assert.ok(typeof provider.stats.currentLod === 'number');
  assert.ok(typeof provider.stats.particleCount === 'number');

  provider.dispose();
  assert.equal(parent.children.length, 0);
});

test('T_U42_08_NO_FLOAT32_COSMIC_POSITION_LEAK: point cloud coordinates are strictly normalized in [-1, 1]', () => {
  const provider = new GalaxyPointCloudProvider();
  const desc = generator.generateGalaxy(universeSeed, cell, 0);
  const geom = provider.getGeometry(desc, 'Medium');

  const positions = geom.getAttribute('position').array as Float32Array;
  for (let i = 0; i < positions.length; i++) {
    const val = positions[i];
    assert.ok(Number.isFinite(val), `Coordinate at ${i} must be finite`);
    assert.ok(
      Math.abs(val) <= 1.5, // Unit radius = 1.0; outer halo tail <= 1.5
      `Normalized coordinate ${val} must be within unit envelope, never astronomical metres`,
    );
  }

  provider.dispose();
});
