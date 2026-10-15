import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { EarthGlobe } from '../src/world/planet/EarthGlobe';
import { EarthContinentalRiverRenderer, RIVER_SURFACE_OFFSET_M } from '../src/world/planet/EarthContinentalRiverRenderer';
import { EarthRiverLayer } from '../src/world/planet/EarthRiverLayer';
import { PLANET_LAYER } from '../src/rendering/domains/RenderDomains';
import { ecefToGeodetic } from '../src/world/spatial/ECEF';

test('T_EARTH_GLOBE_CONSUMES_RIVER_LAYER', () => {
  const root = new Group();
  const globe = new EarthGlobe(root);
  try {
    assert.ok(globe.riverRenderer instanceof EarthContinentalRiverRenderer, 'EarthGlobe must own EarthContinentalRiverRenderer');
    assert.ok(globe.surfaceGroup.children.includes(globe.riverRenderer.group), 'River renderer must be child of surfaceGroup');
  } finally {
    globe.dispose();
  }
});

test('T_AMAZON_VISIBLE_IN_ORBITAL_SCENE and T_AMAZON_NOT_MAP_ONLY', () => {
  const root = new Group();
  const globe = new EarthGlobe(root);
  try {
    globe.setCenterM([0, 0, 0], undefined, 150_000);
    globe.visible = true;
    globe.opacity = 1.0;

    const stats = globe.riverRenderer.stats;
    assert.equal(stats.visible, true, 'Rivers must be visible in orbital scene');
    assert.ok(stats.vertices > 500, `Expected dense river vertices in orbital scene, got ${stats.vertices}`);
    assert.ok(stats.opacity > 0.5, 'River opacity must be high in orbit');

    // Check layer mask
    const mesh = globe.riverRenderer.group.children[0];
    assert.ok(mesh, 'Active mesh must exist in group');
    assert.equal(mesh.layers.isEnabled(PLANET_LAYER), true, 'River mesh must have PLANET_LAYER enabled');
  } finally {
    globe.dispose();
  }
});

test('T_RIVER_FOLLOWS_EARTH_CURVATURE and T_RIVER_DOES_NOT_FLOAT', () => {
  const renderer = new EarthContinentalRiverRenderer();
  try {
    renderer.setLOD('lod2');
    const mesh = renderer.group.children[0] as any;
    assert.ok(mesh);
    const pos = mesh.geometry.getAttribute('position');
    assert.ok(pos && pos.count > 0);

    for (let i = 0; i < Math.min(pos.count, 200); i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x, y, z);

      // Distance from center must be close to WGS84 Earth radius (~6,356km to 6,378km) + offset
      assert.ok(dist >= 6_350_000 && dist <= 6_385_000, `Vertex distance ${dist} must follow Earth radius`);

      // Geodetic height must equal RIVER_SURFACE_OFFSET_M exactly
      const geodetic = ecefToGeodetic({ xM: x, yM: y, zM: z });
      assert.ok(
        Math.abs(geodetic.heightM - RIVER_SURFACE_OFFSET_M) < 2.0,
        `Vertex height ${geodetic.heightM} must stay close to surface offset ${RIVER_SURFACE_OFFSET_M}m`
      );
    }
  } finally {
    renderer.dispose();
  }
});

test('T_RIVER_NO_PLANET_Z_FIGHTING', () => {
  assert.equal(RIVER_SURFACE_OFFSET_M, 40, 'RIVER_SURFACE_OFFSET_M should be 40m');
  const renderer = new EarthContinentalRiverRenderer();
  try {
    const mesh = renderer.group.children[0] as any;
    assert.equal(mesh.material.depthWrite, false, 'depthWrite must be false to avoid clipping terrain');
    assert.equal(mesh.material.depthTest, true, 'depthTest must be true for planetary occlusion');
  } finally {
    renderer.dispose();
  }
});

test('T_RIVER_BODY_FIXED and T_RIVER_REBASE_STABLE', () => {
  const root = new Group();
  const globe = new EarthGlobe(root);
  try {
    // Rebase 1
    globe.setCenterM([1000, 2000, 3000], [0, 0, 0, 1], 100_000);
    assert.equal(globe.group.position.x, 1000);
    assert.equal(globe.group.position.y, 2000);
    assert.equal(globe.group.position.z, 3000);

    // Rebase 2
    globe.setCenterM([-5000, 10000, -20000], [0, 1, 0, 0], 200_000);
    assert.equal(globe.group.position.x, -5000);
    assert.equal(globe.group.position.y, 10000);
    assert.equal(globe.group.position.z, -20000);
    assert.equal(globe.group.quaternion.y, 1);
  } finally {
    globe.dispose();
  }
});

test('T_RIVER_LOD_DISTANCE_DEPENDENT', () => {
  const renderer = new EarthContinentalRiverRenderer();
  try {
    // High orbital altitude (> 500 km) -> lod0
    renderer.update(1_000_000);
    assert.equal(renderer.stats.activeLOD, 'lod0');
    const lod0Verts = renderer.stats.vertices;

    // Continental altitude (80 km - 500 km) -> lod1
    renderer.update(200_000);
    assert.equal(renderer.stats.activeLOD, 'lod1');
    const lod1Verts = renderer.stats.vertices;

    // Regional altitude (< 80 km) -> lod2
    renderer.update(40_000);
    assert.equal(renderer.stats.activeLOD, 'lod2');
    const lod2Verts = renderer.stats.vertices;

    // Verify detail scaling: lod2 has more vertices than lod1, and lod1 has more than lod0
    assert.ok(lod2Verts > lod1Verts, `lod2 (${lod2Verts}) should have more vertices than lod1 (${lod1Verts})`);
    assert.ok(lod1Verts > lod0Verts, `lod1 (${lod1Verts}) should have more vertices than lod0 (${lod0Verts})`);
  } finally {
    renderer.dispose();
  }
});

test('T_RIVER_MANAUS_HANDOFF', () => {
  const renderer = new EarthContinentalRiverRenderer();
  try {
    // Under 12 km altitude: Manaus local water takes total authority
    renderer.update(5_000);
    assert.equal(renderer.stats.opacity, 0, 'Opacity must be 0 near ground (<12km) for local water handoff');
    assert.equal(renderer.stats.visible, false, 'Group must be invisible near ground');

    // At 18.5 km altitude: midway crossfade
    renderer.update(18_500);
    assert.ok(renderer.stats.opacity > 0.4 && renderer.stats.opacity < 0.6, 'Mid-altitude cross-fade');

    // At 50 km altitude: fully visible
    renderer.update(50_000);
    assert.ok(renderer.stats.opacity >= 0.89, 'High altitude full visibility');
  } finally {
    renderer.dispose();
  }
});

test('T_RIVER_LAYER_PRESENTATION_ONLY', () => {
  assert.equal(EarthRiverLayer.presentationOnly, true, 'EarthRiverLayer must declare presentationOnly');
  const renderer = new EarthContinentalRiverRenderer();
  try {
    assert.equal((renderer.group as any).isCollider, undefined);
    assert.equal((renderer.group as any).physicsBody, undefined);
  } finally {
    renderer.dispose();
  }
});
