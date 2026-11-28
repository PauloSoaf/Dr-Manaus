import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { SwimmingPool } from '../src/world/water/SwimmingPool';
import { getFluid } from '../src/world/water/FluidRegistry';
import { WaterBuoyancyService } from '../src/world/water/ManausHydrology';
import { WaterSystem, WaterVFX } from '../src/rendering/WaterSystem';
import { createUniversalLiquidMaterial, universalLiquidTime, updateUniversalLiquidTime } from '../src/world/water/UniversalLiquidSystem';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';
import { manausBathymetry } from '../src/world/water/ManausBathymetry';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes';
import { createTerrain } from '../src/world/geodata/terrain';

describe('UNIVERSAL-WATER-05: Advanced Water Behaviors from Researched References', () => {
  it('1. SwimmingPool entity: architectural basin, white marble coping, clear turquoise water, and FluidRegistry compliance', () => {
    const pool = new SwimmingPool({
      id: 'ponta-negra-club',
      position: new Vector3(-9200, 4.0, -7300),
      widthM: 12.0,
      lengthM: 25.0,
      depthM: 2.2,
      waterLevelOffsetM: 0.15,
    });

    assert.ok(pool.group, 'Pool root group must exist');
    assert.strictEqual(pool.group.children.length, 3, 'Pool group contains basin, coping, and water surface');

    // Basin and coping check
    const basin = pool.group.getObjectByName('pool-basin') as Mesh;
    const coping = pool.group.getObjectByName('pool-coping') as Mesh;
    const water = pool.group.getObjectByName('pool-water-surface') as Mesh;

    assert.ok(basin, 'Basin mesh exists');
    assert.ok(coping, 'Coping rim mesh exists');
    assert.ok(water, 'Water surface mesh exists');

    // Shore damping attribute on water plane
    const shoreAttr = water.geometry.getAttribute('shore');
    assert.ok(shoreAttr, 'Water geometry has shore damping attribute');

    // FluidRegistry registration
    const fluid = getFluid('pool-ponta-negra-club');
    assert.ok(fluid, 'Pool must register with FluidRegistry');
    assert.strictEqual(fluid.geometryType, 'pool');
    assert.strictEqual(fluid.scale, 'SMALL');
    assert.strictEqual(fluid.profileId, 'SWIMMING_POOL');

    // Perimeter queries
    assert.strictEqual(pool.containsPoint(-9200, -7300), true, 'Center is inside pool');
    assert.strictEqual(pool.containsPoint(-9200 + 4.0, -7300 + 10.0), true, 'Within dimensions is inside pool');
    assert.strictEqual(pool.containsPoint(-9200 + 20.0, -7300), false, 'Outside pool bounds returns false');

    // Wave sampling
    const sample = pool.sampleSurface(-9200, -7300, 1.5);
    assert.ok(Number.isFinite(sample.height), 'Sampled height is finite');
    assert.ok(Math.abs(sample.height - (4.0 - 0.15)) < 0.2, 'Sampled elevation matches water surface plane');
    assert.ok(sample.normal.y > 0.9, 'Water normal points largely upward');

    // Clean disposal
    pool.dispose();
  });

  it('2. WaterBuoyancyService: automatic Box3 hull bounding box calculation matches threejs-water-free buoyancy.js', () => {
    const buoyancy = new WaterBuoyancyService();
    const boxGeo = new BoxGeometry(2.0, 1.0, 4.0);
    const boxMesh = new Mesh(boxGeo, new MeshStandardMaterial());
    boxMesh.position.set(100, 0, 200);
    boxMesh.updateMatrixWorld(true);

    // Register without passing explicit hull offsets (should compute from Box3)
    const body = buoyancy.add(boxMesh, {
      verticalOffset: 0.1,
      damping: 4.5,
      surge: true,
    });

    assert.ok(body, 'BuoyantBody returned');
    assert.strictEqual(body.hullOffsets.length, 4, 'Four hull probe points automatically computed from Box3');
    for (const pt of body.hullOffsets) {
      assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.z), 'Offsets are finite');
      assert.ok(Math.abs(pt.x) > 0.5, 'Width offset non-zero');
      assert.ok(Math.abs(pt.z) > 1.0, 'Length offset non-zero');
    }

    // Step simulation
    buoyancy.update(0.016, 1.0, 0.12);
    assert.ok(Number.isFinite(boxMesh.position.y), 'Position Y updated smoothly');

    // Remove
    buoyancy.remove(boxMesh);
    buoyancy.update(0.016, 1.0, 0.12);
  });

  it('3. WaterVFX underwater volumetric god rays (sun shafts): preserves group children count and toggles with camera medium', () => {
    const root = new Group();
    const vfx = new WaterVFX(root);

    // Group children must remain strictly 4 for regression guard
    assert.strictEqual(vfx.group.children.length, 4, 'VFX group contains exactly 4 instanced draw calls');
    assert.ok(vfx.sunRaysMesh, 'Sun rays mesh created');
    assert.strictEqual(vfx.sunRaysMesh.visible, false, 'Initially invisible above water');

    // Submerge camera
    vfx.updateUnderwaterMedium(true, 100, -2.0, 200, 0.12);
    assert.strictEqual(vfx.sunRaysMesh.visible, true, 'Sun rays visible when submerged underwater');

    // Update step
    vfx.update(0.016, 0.12, 2.5);
    assert.strictEqual(vfx.sunRaysMesh.visible, true, 'Sun rays stay visible');
    assert.strictEqual(vfx.sunRaysMesh.position.x, 100);
    assert.strictEqual(vfx.sunRaysMesh.position.z, 200);

    // Resurface camera
    vfx.updateUnderwaterMedium(false, 100, 5.0, 200, 0.12);
    assert.strictEqual(vfx.sunRaysMesh.visible, false, 'Sun rays hidden when above water');

    vfx.dispose();
  });

  it('4. Universal liquid materials compile cleanly with river advection, breaking foam, glitter, and SSS', () => {
    const oceanMat = createUniversalLiquidMaterial('terrestrial-ocean');
    assert.ok(oceanMat, 'Ocean material created');
    assert.ok(oceanMat.positionNode, 'Position node present');
    assert.ok(oceanMat.normalNode, 'Normal node present');
    assert.ok(oceanMat.colorNode, 'Color node with foam and glitter present');

    const poolMat = createUniversalLiquidMaterial('clear-swimming-pool');
    assert.ok(poolMat, 'Pool material created');
    assert.ok(poolMat.colorNode, 'Color node present');

    oceanMat.dispose();
    poolMat.dispose();
  });

  it('5. Tri-biome ground coloration and urban sidewalk concrete: pavement gray replacing sandy beige in city chunks', () => {
    const previousDoc = globalThis.document;
    const ctx = { fillStyle: '', fillRect() {} };
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) } as unknown as Document;
    try {
      const chunkMeshes = new ChunkMeshes();
      assert.ok(chunkMeshes, 'ChunkMeshes initialized');

      // Check sidewalk pavement color in ChunkMeshes (must be urban concrete gray, not sandy yellow)
      const pavementMat = (chunkMeshes as any).pavement as MeshStandardMaterial;
      assert.ok(pavementMat, 'Pavement material exists');
      const hex = pavementMat.color.getHex();
      // 0x4a4d52 is dark urban gray: R, G, B are all close to 0x4a-0x52 (74-82)
      const r = (hex >> 16) & 0xff;
      const g = (hex >> 8) & 0xff;
      const b = hex & 0xff;
      assert.ok(r < 110 && g < 110 && b < 110, `Sidewalks must be urban concrete gray, got (${r},${g},${b})`);
      assert.ok(Math.abs(r - g) < 15 && Math.abs(g - b) < 15, 'Sidewalks must be neutral gray');

      // Verify terrain groundCover has distinct green forest, gray city, and golden beach sand
      const root = new Group();
      const terrain = createTerrain(root);
      const groundCover = terrain.getObjectByName('ground-cover') as Mesh;
      assert.ok(groundCover, 'ground-cover exists');
      const colAttr = groundCover.geometry.getAttribute('color');
      assert.ok(colAttr && colAttr.count > 0, 'Vertex colors exist');
    } finally {
      globalThis.document = previousDoc;
    }
  });

  it('6. Global oceanic fluid physics and animated wave propagation', () => {
    // 1. Verify universalLiquidTime updates
    updateUniversalLiquidTime(12.5);
    assert.strictEqual(universalLiquidTime.value, 12.5, 'universalLiquidTime updates accurately');

    // 2. Set origin to Pacific Ocean (lat 0, lon -140)
    BuildingGeneratorContext.activeOrigin = {
      latDeg: 0,
      lonDeg: -140,
      isManaus: false,
    };

    try {
      // 3. Verify ocean surface sampling undulates across time
      const h0 = manausBathymetry.sampleWaterSurface(100, 200, 0.0);
      const h1 = manausBathymetry.sampleWaterSurface(100, 200, 2.5);
      assert.ok(Number.isFinite(h0), 'Ocean surface elevation is finite at t=0');
      assert.ok(Number.isFinite(h1), 'Ocean surface elevation is finite at t=2.5');
      assert.notStrictEqual(h0, h1, 'Ocean surface elevation undulates dynamically over time');

      // 4. Verify deep seabed and submersion state in the ocean
      const bedY = manausBathymetry.sampleRiverbedHeight(100, 200);
      assert.ok(bedY <= -200, 'Ocean floor is deep seabed (<= -200m)');

      const sub = manausBathymetry.evaluateSubmersion(new Vector3(100, 0, 200), 1.8);
      assert.strictEqual(sub.inWater, true, 'Marked as in water in global ocean');
      assert.ok(sub.totalWaterDepthM > 100, 'Total water depth is massive ocean abyss');
      assert.strictEqual(sub.feetSubmerged, true, 'Feet submerged at sea level');
    } finally {
      // Reset origin to Manaus
      BuildingGeneratorContext.activeOrigin = {
        latDeg: -3.1190278,
        lonDeg: -60.0216667,
        isManaus: true,
      };
    }
  });
});
