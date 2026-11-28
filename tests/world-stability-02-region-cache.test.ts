import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three/webgpu';
import { createRegionId, chunkKey, defaultChunkGenerationContext, type ChunkGenerationContext } from '../src/world/chunks/Chunk';
import { generateChunk } from '../src/world/chunks/BuildingGenerator';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes';
import { isLand, isUrban, buildingAllowed, vegetationAllowed } from '../src/world/geodata/geodata';

test('CICLO 2 / STABILITY-01B: Cache, Region Identity & Purity Audit', async (t) => {
  await t.test('1. Deterministic Region Identity Discrimination', () => {
    const manaus = createRegionId('earth', true, -3.1303, -60.0234);
    assert.equal(manaus, 'earth:manaus');

    const pacific = createRegionId('earth', false, -20.50, -140.20);
    assert.equal(pacific, 'earth:-20.50:-140.20');

    const atlantic = createRegionId('earth', false, 35.15, -40.85);
    assert.equal(atlantic, 'earth:35.15:-40.85');

    const thalassa = createRegionId('thalassa', false, 0, 0);
    assert.equal(thalassa, 'thalassa:megawave-ocean');

    // Distinct locations MUST yield distinct region IDs
    assert.notEqual(manaus, pacific);
    assert.notEqual(pacific, atlantic);
    assert.notEqual(pacific, thalassa);
  });

  await t.test('2. Chunk Key Partitioning prevents collisions for identical (0,0) across regions', () => {
    const manausKey = chunkKey(0, 0, 'earth:manaus');
    const pacificKey = chunkKey(0, 0, 'earth:-20.50:-140.20');
    const atlanticKey = chunkKey(0, 0, 'earth:35.15:-40.85');
    const thalassaKey = chunkKey(0, 0, 'thalassa:megawave-ocean');

    assert.equal(manausKey, 'earth:manaus::0,0');
    assert.equal(pacificKey, 'earth:-20.50:-140.20::0,0');
    assert.equal(atlanticKey, 'earth:35.15:-40.85::0,0');
    assert.equal(thalassaKey, 'thalassa:megawave-ocean::0,0');

    // Identical tile offsets (0,0) are isolated into distinct key namespaces
    assert.notEqual(manausKey, pacificKey);
    assert.notEqual(pacificKey, atlanticKey);
    assert.notEqual(pacificKey, thalassaKey);
  });

  await t.test('3. generateChunk() Purity: immune to static BuildingGeneratorContext.activeOrigin corruption', () => {
    const manausContext: ChunkGenerationContext = {
      bodyId: 'earth',
      frameId: 'solar-system/earth/manaus-surface',
      latDeg: -3.1303,
      lonDeg: -60.0234,
      surfaceType: 'terrestrial',
      regionId: 'earth:manaus',
      generationVersion: 1,
      isManaus: true,
      seed: 42,
    };

    const pacificContext: ChunkGenerationContext = {
      bodyId: 'earth',
      frameId: 'solar-system/earth/local-enu',
      latDeg: -20.50,
      lonDeg: -140.20,
      surfaceType: 'ocean',
      regionId: 'earth:-20.50:-140.20',
      generationVersion: 2,
      isManaus: false,
      seed: 99,
    };

    // Deliberately corrupt static activeOrigin to Moon
    BuildingGeneratorContext.activeOrigin = {
      latDeg: 45.0,
      lonDeg: 12.0,
      isManaus: false,
      bodyId: 'moon',
    };

    // generateChunk with manausContext MUST evaluate isLand, isUrban, vegetationAllowed purely
    const manausChunk = generateChunk(0, 0, manausContext, 42);
    assert.equal(manausChunk.land, true);
    assert.equal(manausChunk.regionId, 'earth:manaus');
    assert.equal(manausChunk.key, 'earth:manaus::0,0');

    // generateChunk with pacificContext MUST generate pure ocean water
    const pacificChunk = generateChunk(0, 0, pacificContext, 99);
    assert.equal(pacificChunk.land, false);
    assert.equal(pacificChunk.biome, 'ocean');
    assert.equal(pacificChunk.regionId, 'earth:-20.50:-140.20');
    assert.equal(pacificChunk.key, 'earth:-20.50:-140.20::0,0');
    assert.equal(pacificChunk.buildings.length, 0);
    assert.equal(pacificChunk.trees.length, 0);

    // Verify geodata helper functions directly respect explicit context
    assert.equal(isUrban(0, 0, manausContext), true);
    assert.equal(isUrban(0, 0, pacificContext), false);
    assert.equal(isLand(0, 0, pacificContext), false);
  });

  await t.test('4. WorldStreamer multi-hop region travel and atomic purges', async () => {
    const root = new Group();
    const streamer = new WorldStreamer(root);

    // 1. Manaus start
    assert.equal(streamer.generationContext.regionId, 'earth:manaus');
    const v1 = streamer.generationContext.generationVersion;

    // 2. Travel to Pacific
    streamer.setRegion({
      bodyId: 'earth',
      latDeg: -20.50,
      lonDeg: -140.20,
      isManaus: false,
      surfaceType: 'ocean',
    });
    assert.equal(streamer.generationContext.regionId, 'earth:-20.50:-140.20');
    assert.equal(streamer.generationContext.generationVersion, v1 + 1);

    // 3. Travel to Atlantic
    streamer.setRegion({
      bodyId: 'earth',
      latDeg: 35.15,
      lonDeg: -40.85,
      isManaus: false,
      surfaceType: 'ocean',
    });
    assert.equal(streamer.generationContext.regionId, 'earth:35.15:-40.85');
    assert.equal(streamer.generationContext.generationVersion, v1 + 2);

    // 4. Travel to Thalassa
    streamer.setRegion({
      bodyId: 'thalassa',
      latDeg: 0,
      lonDeg: 0,
      isManaus: false,
      surfaceType: 'megawave-ocean',
    });
    assert.equal(streamer.generationContext.regionId, 'thalassa:megawave-ocean');
    assert.equal(streamer.generationContext.generationVersion, v1 + 3);
    assert.equal(ChunkMeshes.activeSolvent, 'megawave-ocean');

    // 5. Return to Manaus
    streamer.setRegion({
      bodyId: 'earth',
      latDeg: -3.1303,
      lonDeg: -60.0234,
      isManaus: true,
      surfaceType: 'terrestrial',
    });
    assert.equal(streamer.generationContext.regionId, 'earth:manaus');
    assert.equal(streamer.generationContext.generationVersion, v1 + 4);
    assert.equal(ChunkMeshes.isLocalManausActive, true);

    streamer.dispose();
  });

  await t.test('5. Procedural Destruction preserves activeContext outside Manaus', () => {
    const root = new Group();
    const streamer = new WorldStreamer(root);

    // Set active region to Thalassa
    streamer.setRegion({
      bodyId: 'thalassa',
      latDeg: 0,
      lonDeg: 0,
      isManaus: false,
      surfaceType: 'megawave-ocean',
    });

    // Attempting to destroy an ungenerated building in ocean world safely uses activeContext
    const destroyed = streamer.destroy('thalassa:megawave-ocean::0,0/building/0');
    // On pure ocean there are zero buildings, so destroy returns false without crashing
    assert.equal(destroyed, false);

    streamer.dispose();
  });
});
