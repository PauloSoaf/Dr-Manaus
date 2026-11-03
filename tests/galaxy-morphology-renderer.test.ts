import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PointsNodeMaterial } from 'three/webgpu';
import {
  GalaxyPointCloudProvider,
  GALAXY_POINT_BUDGETS,
  resolveGalaxyDescriptor,
  buildPointCloudCacheKey,
  MAX_POINT_CLOUD_CACHE_SIZE,
} from '../src/world/galaxy/GalaxyPointCloudProvider.ts';
import { GalaxyMorphologyRenderer } from '../src/world/galaxy/GalaxyMorphologyRenderer.ts';
import { GalaxyProvider } from '../src/world/providers/GalaxyProvider.ts';
import { ProceduralGalaxyGenerator, GALAXY_GENERATOR_VERSION } from '../src/world/galaxy/ProceduralGalaxyGenerator.ts';
import { LOCAL_GROUP_CATALOG } from '../src/world/celestial/GalaxyDefinition.ts';
import { LIGHT_YEAR_M } from '../src/world/spatial/units.ts';
import { sectorIndex } from '../src/world/spatial/UniverseAddress.ts';
import { GalaxyMaterializer } from '../src/world/galaxy/GalaxyMaterializer.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';

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

  // 2. Pure Elliptical galaxy
  let targetEllDesc = mwDesc;
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
  assert.equal(GALAXY_POINT_BUDGETS.Ultra, 160_000);

  const geomLow = provider.getGeometry(desc, 'Low');
  assert.equal(geomLow.getAttribute('position').count, 10_000);

  const geomMed = provider.getGeometry(desc, 'Medium');
  assert.equal(geomMed.getAttribute('position').count, 40_000);

  const geomUltra = provider.getGeometry(desc, 'Ultra');
  assert.equal(geomUltra.getAttribute('position').count, 160_000);

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

test('T_U421_01_CACHE_IDENTITY_COLLISION_RESISTANCE_AND_LRU: distinct keys avoid cross-geometry reuse', () => {
  const provider = new GalaxyPointCloudProvider(3); // Small capacity for LRU eviction testing
  const descA = generator.generateGalaxy(universeSeed, cell, 0);
  const descB = generator.generateGalaxy(universeSeed ^ 0x999n, cell, 0); // Same ID possible, distinct seed

  // 1. Semantic cache keys must be distinct
  const keyA = buildPointCloudCacheKey(descA, 'Medium', 40_000);
  const keyB = buildPointCloudCacheKey(descB, 'Medium', 40_000);
  assert.notEqual(keyA, keyB, 'Different seeds must produce distinct cache keys');
  assert.ok(keyA.includes(`v${GALAXY_GENERATOR_VERSION}`), 'Cache key must encode generator version');

  // 2. Presets must differentiate cache keys
  const keyLow = buildPointCloudCacheKey(descA, 'Low', 10_000);
  const keyHigh = buildPointCloudCacheKey(descA, 'High', 100_000);
  assert.notEqual(keyLow, keyHigh, 'Different presets must produce distinct cache keys');

  // 3. Populate 3 entries (reaches max capacity 3)
  const geomA = provider.getGeometry(descA, 'Low');
  const geomB = provider.getGeometry(descB, 'Low');
  const geomC = provider.getGeometry(descA, 'Medium');
  assert.equal(provider.cacheSize, 3);

  // 4. Adding 4th entry evicts oldest (geomA)
  const descD = generator.generateGalaxy(0xbeef_cafen, cell, 0);
  const geomD = provider.getGeometry(descD, 'High');
  assert.equal(provider.cacheSize, 3, 'Cache size must remain bounded at maxCacheSize');
  assert.equal(provider.hasCached(descD, 'High'), true);

  provider.dispose();
  assert.equal(provider.cacheSize, 0);
});

test('T_U421_02_TSL_POINTS_NODE_MATERIAL_AND_GPU_ATTRIBUTES: size, color, dust connected to GPU nodes', () => {
  const parent = new Group();
  const desc = generator.generateGalaxy(universeSeed, cell, 0);
  const renderer = new GalaxyMorphologyRenderer(parent, desc);

  // Force LOD 2 to inspect high-resolution GPU materials and attributes
  renderer.forceLod(2);
  assert.equal(renderer.currentLod, 2);
  assert.equal(renderer.isLod2Materialized, true);

  // Inspect children of root to retrieve LOD2 Points
  const lod2Group = parent.children[0].children.find((c) => c.name === 'LOD2_PointCloudGroup') as Group;
  assert.ok(lod2Group, 'LOD2 group must be present in scene hierarchy');

  const points = lod2Group.children.find((c) => (c as any).isPoints) as any;
  assert.ok(points, 'LOD2 Points mesh must exist');

  const material = points.material as PointsNodeMaterial;
  assert.ok(material.isPointsNodeMaterial, 'Points must use PointsNodeMaterial for TSL WebGPU compatibility');
  assert.ok(material.sizeNode, 'sizeNode must be attached to PointsNodeMaterial');
  assert.ok(material.colorNode, 'colorNode must be attached to PointsNodeMaterial');
  assert.ok(material.opacityNode, 'opacityNode must be attached to PointsNodeMaterial');

  // Verify custom buffer attributes on geometry
  const geom = points.geometry;
  const sizeAttr = geom.getAttribute('size');
  const dustAttr = geom.getAttribute('dust');
  assert.ok(sizeAttr, 'size attribute must be present on geometry');
  assert.ok(dustAttr, 'dust attribute must be present on geometry');

  assert.equal(sizeAttr.itemSize, 1);
  assert.equal(dustAttr.itemSize, 1);

  // Values inspection: size is positive, dust is in [0, 1]
  const sizes = sizeAttr.array as Float32Array;
  const dust = dustAttr.array as Float32Array;
  for (let i = 0; i < Math.min(100, sizes.length); i++) {
    assert.ok(sizes[i] > 0, `Stellar size at index ${i} must be positive`);
    assert.ok(dust[i] >= 0 && dust[i] <= 1.0, `Dust extinction factor at index ${i} must be in [0, 1]`);
  }

  renderer.dispose();
  parent.clear();
});

test('T_U421_03_PROGRESSIVE_LAZY_LOD_MATERIALIZATION: LOD1 and LOD2 buffers allocated only when entered', () => {
  const parent = new Group();
  const desc = generator.generateGalaxy(universeSeed, cell, 1); // Andromeda
  const renderer = new GalaxyMorphologyRenderer(parent, desc);

  // 1. Initial distant state: LOD0 active, neither LOD1 nor LOD2 materialized
  assert.equal(renderer.currentLod, 0, 'Initial LOD must be 0 (minimal distant sprite)');
  assert.equal(renderer.isLod1Materialized, false, 'LOD1 must NOT be materialized at constructor time');
  assert.equal(renderer.isLod2Materialized, false, 'LOD2 must NOT be materialized at constructor time');
  assert.equal(renderer.particleCount, 0, 'Zero particles active at LOD 0');

  // 2. Stay distant (D_px = 8)
  renderer.update(1e25, 8);
  assert.equal(renderer.isLod1Materialized, false, 'Distant updates must preserve unmaterialized state');
  assert.equal(renderer.isLod2Materialized, false);

  // 3. Move into intermediate extragalactic range (D_px = 50): enters LOD1
  renderer.update(1e23, 50);
  assert.equal(renderer.currentLod, 1);
  assert.equal(renderer.isLod1Materialized, true, 'LOD1 must be materialized upon entering tier 1');
  assert.equal(renderer.isLod2Materialized, false, 'LOD2 must still NOT be materialized while in tier 1');
  assert.equal(renderer.particleCount, 5_000, 'LOD1 allocates 5,000 sparse sparkle particles');

  // 4. Move into close range (D_px = 350): enters LOD2
  renderer.update(1e21, 350);
  assert.equal(renderer.currentLod, 2);
  assert.equal(renderer.isLod2Materialized, true, 'LOD2 must be materialized upon entering tier 2');
  assert.ok(renderer.particleCount >= 40_000, 'LOD2 particle count reflects high quality tier');

  // 5. Clean disposal and safety against stale calls
  renderer.dispose();
  assert.doesNotThrow(() => {
    renderer.update(1e21, 350);
    renderer.forceLod(1);
    renderer.setQuality('Low');
  }, 'Post-dispose calls must execute safely without throwing');

  parent.clear();
});

test('T_U421_04_QUALITY_PRESET_DYNAMIC_SWITCHING: updates particle count and geometry across levels', () => {
  const parent = new Group();
  const desc = generator.generateGalaxy(universeSeed, cell, 0);
  const renderer = new GalaxyMorphologyRenderer(parent, desc);

  // Materialize LOD2
  renderer.forceLod(2);
  assert.equal(renderer.particleCount, 100_000); // Default: High

  // Switch to Low
  renderer.setQuality('Low');
  assert.equal(renderer.particleCount, 10_000);

  // Switch to Ultra
  renderer.setQuality('Ultra');
  assert.equal(renderer.particleCount, 160_000);

  // Switch to Medium
  renderer.setQuality('Medium');
  assert.equal(renderer.particleCount, 40_000);

  // Integration with GalaxyProvider
  const andDef = LOCAL_GROUP_CATALOG.find((g) => g.id === 'andromeda')!;
  const provider = new GalaxyProvider(parent, { galaxy: andDef, qualityPreset: 'Low' });
  provider.morphologyRenderer.forceLod(2);
  assert.equal(provider.stats.particleCount, 10_000);

  provider.setQuality('High');
  assert.equal(provider.stats.particleCount, 100_000);

  provider.dispose();
  renderer.dispose();
  parent.clear();
});

test('T_U421_05_CAMERA_FOV_AND_ENVELOPE_PROJECTION: FOV alters projected pixels and envelope forces LOD2', () => {
  const parent = new Group();
  const mwDef = LOCAL_GROUP_CATALOG.find((g) => g.id === 'milky_way')!;
  const provider = new GalaxyProvider(parent, { galaxy: mwDef });

  const andAddress = { galaxyId: 'andromeda', sector: sectorIndex(0n, 0n, 0n), systemId: 'sys-0' };
  const cameraPosM: [number, number, number] = [0, 0, 0];

  // 1. Narrow FOV (30°) produces larger apparent angular pixel size than Wide FOV (90°)
  provider.update(andAddress, cameraPosM, 1e20, [0, 0, 0], (v) => v, { fovDeg: 30, viewportHeightPx: 1080 });
  const lodNarrow = provider.stats.currentLod;

  provider.update(andAddress, cameraPosM, 1e20, [0, 0, 0], (v) => v, { fovDeg: 90, viewportHeightPx: 1080 });
  const lodWide = provider.stats.currentLod;
  assert.ok(lodNarrow >= lodWide, 'Narrower FOV must result in equal or higher LOD tier');

  // 2. Observer located inside the galactic envelope (distance <= radius): forces LOD2
  const nearbySatellite: import('../src/world/celestial/GalaxyDefinition.ts').GalaxyDefinition = {
    id: 'nearby_satellite',
    name: 'Nearby Satellite',
    type: 'spiral',
    diameterLy: 10_000,
    thicknessLy: 1_000,
    positionM: [1_000_000, 0, 0], // Within 1,000 km of origin (observer at [0,0,0])
    addressOriginM: [0, 0, 0],
    densityProfile: 'milky-way',
  };
  const closeProvider = new GalaxyProvider(parent, { galaxy: nearbySatellite });
  // Observer in Milky Way at origin, distance is 1,000 km, well within 5,000 ly radius
  closeProvider.update({ galaxyId: 'milky_way', sector: sectorIndex(0n, 0n, 0n), systemId: 'sol' }, cameraPosM, 100);
  assert.equal(closeProvider.stats.currentLod, 2, 'Observer within galactic envelope must force LOD 2');

  closeProvider.dispose();
  provider.dispose();
  parent.clear();
});

test('T_U422_01_COPLANAR_XZ_ORIENTATION_AND_PREDICTIVE_PREHEATING: quads share XZ plane (+Y normal) and preheat on approach', () => {
  const parent = new Group();
  const desc = generator.generateGalaxy(universeSeed, cell, 0);
  const renderer = new GalaxyMorphologyRenderer(parent, desc, {
    lodThreshold01: 16,
    lodThreshold12: 280,
  });

  // 1. LOD 0 geometry is coplanar in the XZ plane with polar normal along +Y
  const lod0Pos = (renderer as any).lod0Geometry.getAttribute('position').array as Float32Array;
  for (let i = 0; i < lod0Pos.length / 3; i++) {
    const y = lod0Pos[i * 3 + 1];
    assert.ok(Math.abs(y) < 1e-5, `LOD0 impostor quad vertex ${i} must lie in XZ plane (Y ~= 0)`);
  }

  // 2. LOD 1 disc geometry is also rotated -90 deg around X into the XZ plane
  renderer.forceLod(1);
  const lod1Pos = (renderer as any).lod1DiscGeometry.getAttribute('position').array as Float32Array;
  for (let i = 0; i < lod1Pos.length / 3; i++) {
    const y = lod1Pos[i * 3 + 1];
    assert.ok(Math.abs(y) < 1e-5, `LOD1 intermediate disc vertex ${i} must lie in XZ plane (Y ~= 0)`);
  }

  renderer.dispose();
  parent.clear();

  // 3. Predictive preheating trigger
  const preheatRenderer = new GalaxyMorphologyRenderer(parent, desc, {
    lodThreshold01: 16,
    lodThreshold12: 280,
  });

  // Distant: LOD 0, not preheated
  preheatRenderer.update(1e25, 5);
  assert.equal(preheatRenderer.currentLod, 0);
  assert.equal(preheatRenderer.isLod2Preheated, false);

  // Enters LOD 1 at 50 px (< 280 * 0.6 = 168 px): not yet preheated
  preheatRenderer.update(1e23, 50);
  assert.equal(preheatRenderer.currentLod, 1);
  assert.equal(preheatRenderer.isLod2Preheated, false);
  assert.equal(preheatRenderer.isLod2Materialized, false);

  // Approaches LOD 2 threshold at 190 px (>= 168 px): preheats cache without materializing scene points
  preheatRenderer.update(1e22, 190);
  assert.equal(preheatRenderer.currentLod, 1);
  assert.equal(preheatRenderer.isLod2Preheated, true, 'LOD 2 geometry must be predictively pre-warmed in cache');
  assert.equal(preheatRenderer.isLod2Materialized, false, 'LOD 2 points must not yet be materialized in scene hierarchy');

  // Crosses 280 px: enters LOD 2
  preheatRenderer.update(1e21, 300);
  assert.equal(preheatRenderer.currentLod, 2);
  assert.equal(preheatRenderer.isLod2Materialized, true);

  preheatRenderer.dispose();
  parent.clear();
});

test('T_U422_02_REFERENCE_COUNTED_CACHE_AND_SAFE_EVICTION: active scene geometries are never disposed on LRU eviction', () => {
  const provider = new GalaxyPointCloudProvider(2); // Capacity 2
  const descA = generator.generateGalaxy(universeSeed, cell, 0);
  const descB = generator.generateGalaxy(universeSeed, cell, 1);
  const descC = generator.generateGalaxy(universeSeed, cell, 2);

  // 1. Get and retain geometry A
  const geomA = provider.getGeometry(descA, 'Low');
  provider.retain(geomA);
  assert.equal(provider.getRefCount(geomA), 1);

  // 2. Get and retain geometry B
  const geomB = provider.getGeometry(descB, 'Low');
  provider.retain(geomB);
  assert.equal(provider.getRefCount(geomB), 1);
  assert.equal(provider.cacheSize, 2);

  // 3. Fetch geometry C: forces eviction from 2-element cache
  const geomC = provider.getGeometry(descC, 'Low');
  assert.equal(provider.cacheSize, 2);

  // Despite eviction from cache map, geomA must still be usable with position attribute intact because refCount > 0
  assert.ok(geomA.getAttribute('position'), 'Retained evicted geometry must not be disposed');
  assert.equal(geomA.getAttribute('position').count, 10_000);

  // 4. Release geomA: refCount becomes 0 and since it was evicted, it disposes cleanly
  provider.release(geomA);
  assert.equal(provider.getRefCount(geomA), 0);

  // 5. Release geomB while still in cache
  provider.release(geomB);
  assert.equal(provider.getRefCount(geomB), 0);

  provider.dispose();
  assert.equal(provider.cacheSize, 0);
});

