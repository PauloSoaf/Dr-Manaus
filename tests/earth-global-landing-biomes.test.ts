import test from 'node:test';
import assert from 'node:assert/strict';
import { DEG_TO_RAD } from '../src/world/spatial/units';
import {
  classifyEarthSurface,
  classifyEarthBiome,
  EarthSurfaceClass,
  isLandAt,
} from '../src/world/planet/EarthLandMask';
import {
  generateChunk,
  BuildingGeneratorContext,
} from '../src/world/chunks/BuildingGenerator';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes';
import { EarthProvider, MANAUS_COVERAGE } from '../src/world/providers/EarthProvider';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter';
import { Group } from 'three/webgpu';

test('GEO-EARTH-01: Global Consistency from Orbit to Ground across Biomes', async (t) => {
  const previousDoc = globalThis.document;
  const ctx = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) } as unknown as Document;

  try {
    const chunkMeshes = new ChunkMeshes();

    await t.test('1. Pacific Ocean landing (0°N, 140°W) -> Ocean surface, 0 trees', () => {
      BuildingGeneratorContext.activeOrigin = {
        latDeg: 0,
        lonDeg: -140,
        isManaus: false,
      };

      const payload = generateChunk(0, 0);
      assert.equal(payload.land, false, 'Pacific chunk must have land: false');
      assert.equal(payload.biome, 'ocean', 'Pacific chunk must have biome: ocean');
      assert.equal(payload.trees.length, 0, 'Pacific ocean must have strictly 0 trees');
      assert.equal(payload.buildings.length, 0, 'Pacific ocean must have strictly 0 buildings');

      ChunkMeshes.isLocalManausActive = false;
      const { group } = chunkMeshes.create(payload);
      const oceanMesh = group.getObjectByName('ocean-surface');
      assert.ok(oceanMesh, 'Ocean chunk must instantiate ocean-surface mesh');
      assert.equal(group.getObjectByName('forest-ground'), undefined, 'Ocean chunk must not have forest ground');
      chunkMeshes.disposeChunk(group);
    });

    await t.test('2. Atlantic Ocean landing (10°N, 35°W) -> Ocean surface, 0 trees', () => {
      BuildingGeneratorContext.activeOrigin = {
        latDeg: 10,
        lonDeg: -35,
        isManaus: false,
      };

      const payload = generateChunk(0, 0);
      assert.equal(payload.land, false, 'Atlantic chunk must have land: false');
      assert.equal(payload.biome, 'ocean', 'Atlantic chunk must have biome: ocean');
      assert.equal(payload.trees.length, 0, 'Atlantic ocean must have strictly 0 trees');

      ChunkMeshes.isLocalManausActive = false;
      const { group } = chunkMeshes.create(payload);
      assert.ok(group.getObjectByName('ocean-surface'), 'Atlantic chunk must instantiate ocean-surface');
      chunkMeshes.disposeChunk(group);
    });

    await t.test('3. Sahara Desert landing (23°N, 12°E) -> Desert biome, golden sand, 0 trees', () => {
      BuildingGeneratorContext.activeOrigin = {
        latDeg: 23,
        lonDeg: 12,
        isManaus: false,
      };

      const payload = generateChunk(0, 0);
      assert.equal(payload.land, true, 'Sahara chunk must be land');
      assert.equal(payload.biome, 'desert', 'Sahara chunk must classify as desert biome');
      assert.equal(payload.trees.length, 0, 'Sahara desert chunk must have strictly 0 trees');

      ChunkMeshes.isLocalManausActive = false;
      const { group } = chunkMeshes.create(payload);
      const groundMesh = group.getObjectByName('forest-ground');
      assert.ok(groundMesh, 'Sahara chunk must instantiate ground mesh');
      chunkMeshes.disposeChunk(group);
    });

    await t.test('4. Antarctica landing (-75°S, 0°E) -> Ice biome, snow ground, 0 trees', () => {
      BuildingGeneratorContext.activeOrigin = {
        latDeg: -75,
        lonDeg: 0,
        isManaus: false,
      };

      const payload = generateChunk(0, 0);
      assert.equal(payload.land, true, 'Antarctica ice sheet must be classified as solid land/ice');
      assert.equal(payload.biome, 'ice', 'Antarctica chunk must classify as ice biome');
      assert.equal(payload.trees.length, 0, 'Antarctica chunk must have strictly 0 trees');

      ChunkMeshes.isLocalManausActive = false;
      const { group } = chunkMeshes.create(payload);
      const groundMesh = group.getObjectByName('forest-ground');
      assert.ok(groundMesh, 'Antarctica chunk must instantiate ground mesh');
      chunkMeshes.disposeChunk(group);
    });

    await t.test('5. Manaus urban core vs Rio Negro water channel classification', () => {
      BuildingGeneratorContext.activeOrigin = {
        latDeg: -3.1303,
        lonDeg: -60.0234,
        isManaus: true,
      };

      // Manaus city center: lat -3.119°, lon -60.021°
      const urbanClass = classifyEarthSurface(-3.119 * DEG_TO_RAD, -60.021 * DEG_TO_RAD);
      assert.equal(urbanClass, EarthSurfaceClass.Urban, 'Manaus city center must classify as Urban');

      // Rio Negro river channel inside Manaus rectangle: lat -3.155°, lon -60.050°
      const riverClass = classifyEarthSurface(-3.155 * DEG_TO_RAD, -60.050 * DEG_TO_RAD);
      assert.equal(riverClass, EarthSurfaceClass.ShallowWater, 'Rio Negro channel inside Manaus must classify as water, never Urban');

      // Amazon rainforest interior: lat -3.0°, lon -65.0°
      const rainforestBiome = classifyEarthBiome(-3.0 * DEG_TO_RAD, -65.0 * DEG_TO_RAD);
      assert.equal(rainforestBiome, 'rainforest', 'Amazon interior must classify as rainforest');
    });

    await t.test('6. EarthProvider preserves 100% opacity down to ground outside Manaus', () => {
      const parent = new Group();
      const universe = new UniverseRuntime({ streaming: false });
      const provider = new EarthProvider(parent, universe.frames, { minAltitudeM: 8000, fadeM: 7000, renderSpace: universe.renderSpace });

      // Inside Manaus at 500m altitude: globe fades out so local city renders
      const manausContext: any = {
        frame: { id: MANAUS_FRAME_ID },
        player: { position: [0, 500, 0] },
        altitudeM: 500,
        timeS: 0,
      };
      provider.covers(manausContext);
      assert.equal(provider.stats.visible, false, 'Globe must fade out and be hidden at 500m inside Manaus');

      // Outside Manaus (e.g. Pacific ocean at 0°N, 140°W) at 50m altitude: globe stays visible (opacity = 1.0)
      const pacificContext: any = {
        frame: { id: 'earth/fixed' },
        player: { position: [-6378137, 0, 0] },
        altitudeM: 50,
        timeS: 0,
      };
      const visible = provider.covers(pacificContext);
      assert.equal(visible, true, 'EarthProvider must stay visible right to the surface outside Manaus');
      assert.equal(provider.stats.visible, true, 'Globe must be visible at 50m in Pacific');
    });

    chunkMeshes.dispose();
  } finally {
    globalThis.document = previousDoc;
    BuildingGeneratorContext.activeOrigin = {
      latDeg: -3.1303,
      lonDeg: -60.0234,
      isManaus: true,
    };
    ChunkMeshes.isLocalManausActive = true;
  }
});
