import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChunk, chunkSeed } from '../src/world/chunks/BuildingGenerator';
import { defaultChunkGenerationContext, type ChunkGenerationContext } from '../src/world/chunks/Chunk';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';

test('CICLO 1: Worker & Generation Context Standardization', async (t) => {
  await t.test('1. Thread isolation: generateChunk uses explicit context without depending on static state', () => {
    const manausContext: ChunkGenerationContext = {
      bodyId: 'earth',
      frameId: 'solar-system/earth/manaus-surface',
      latDeg: -3.1303,
      lonDeg: -60.0234,
      surfaceType: 'terrestrial',
      regionId: 'manaus-city',
      generationVersion: 1,
      isManaus: true,
      seed: 42,
    };

    const thalassaContext: ChunkGenerationContext = {
      bodyId: 'thalassa',
      frameId: 'solar-system/thalassa/local-enu',
      latDeg: 0,
      lonDeg: 0,
      surfaceType: 'megawave-ocean',
      regionId: 'thalassa-ocean-world',
      generationVersion: 1,
      isManaus: false,
      seed: 99,
    };

    // Intentionally corrupt global static activeOrigin to something else
    BuildingGeneratorContext.activeOrigin = {
      latDeg: 45.0,
      lonDeg: 12.0,
      isManaus: false,
      bodyId: 'moon',
    };

    // Generating Manaus chunk with explicit context must respect manausContext, NOT the static moon state
    const manausChunk = generateChunk(0, 0, manausContext, 42);
    assert.equal(manausChunk.cx, 0);
    assert.equal(manausChunk.cz, 0);
    assert.equal(manausChunk.key, '0,0');
    // Manaus city center has land and urban/rainforest features
    assert.equal(manausChunk.land, true);

    // Generating Thalassa chunk with explicit context must generate ocean world
    const thalassaChunk = generateChunk(0, 0, thalassaContext, 99);
    assert.equal(thalassaChunk.land, false);
    assert.equal(thalassaChunk.biome, 'ocean');
    assert.equal(thalassaChunk.buildings.length, 0);
    assert.equal(thalassaChunk.trees.length, 0);
  });

  await t.test('2. Deterministic reproducibility: same coordinates and context yield bit-for-bit identical payloads', () => {
    const context: ChunkGenerationContext = {
      bodyId: 'earth',
      frameId: 'solar-system/earth/local-enu',
      latDeg: -3.119,
      lonDeg: -60.0217,
      surfaceType: 'terrestrial',
      regionId: 'manaus-periphery',
      generationVersion: 1,
      isManaus: true,
      seed: 12345,
    };

    const payloadA = generateChunk(5, -3, context, 12345);
    const payloadB = generateChunk(5, -3, context, 12345);

    assert.equal(payloadA.key, payloadB.key);
    assert.equal(payloadA.land, payloadB.land);
    assert.equal(payloadA.biome, payloadB.biome);
    assert.equal(payloadA.buildings.length, payloadB.buildings.length);
    assert.equal(payloadA.trees.length, payloadB.trees.length);

    // Deep Float32Array equality verification
    for (let i = 0; i < payloadA.buildings.length; i++) {
      assert.equal(payloadA.buildings[i], payloadB.buildings[i]);
    }
    for (let i = 0; i < payloadA.trees.length; i++) {
      assert.equal(payloadA.trees[i], payloadB.trees[i]);
    }
  });

  await t.test('3. Open Ocean coordinates generate pure water without buildings or trees across Earth and ocean worlds', () => {
    // Middle of the Pacific Ocean
    const pacificContext: ChunkGenerationContext = {
      bodyId: 'earth',
      frameId: 'solar-system/earth/local-enu',
      latDeg: -15.0,
      lonDeg: -140.0,
      surfaceType: 'ocean',
      regionId: 'earth-south-pacific',
      generationVersion: 1,
      isManaus: false,
      seed: 777,
    };

    const pacificChunk = generateChunk(0, 0, pacificContext, 777);
    assert.equal(pacificChunk.land, false, 'Pacific ocean must NOT be land');
    assert.equal(pacificChunk.biome, 'ocean');
    assert.equal(pacificChunk.buildings.length, 0, 'No buildings in open ocean');
    assert.equal(pacificChunk.trees.length, 0, 'No trees in open ocean');
  });

  await t.test('4. defaultChunkGenerationContext provides standard Manaus parameters', () => {
    const def = defaultChunkGenerationContext();
    assert.equal(def.bodyId, 'earth');
    assert.equal(def.isManaus, true);
    assert.equal(def.surfaceType, 'terrestrial');
    assert.equal(def.generationVersion, 1);
  });
});

