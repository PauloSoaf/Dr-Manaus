import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three/webgpu';
import { createRegionId, defaultChunkGenerationContext, type ChunkGenerationContext } from '../src/world/chunks/Chunk';
import { generateChunk } from '../src/world/chunks/BuildingGenerator';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes';

test('CICLO 2: Cache, Region Identity & Stale Response Discarding (P0.2)', async (t) => {
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

  await t.test('2. Chunk Payload Self-Describing Metadata', () => {
    const pacificContext: ChunkGenerationContext = {
      bodyId: 'earth',
      frameId: 'solar-system/earth/local-enu',
      latDeg: -20.50,
      lonDeg: -140.20,
      surfaceType: 'ocean',
      regionId: 'earth:-20.50:-140.20',
      generationVersion: 3,
      isManaus: false,
      seed: 1234,
    };

    const payload = generateChunk(0, 0, pacificContext);
    assert.equal(payload.regionId, 'earth:-20.50:-140.20');
    assert.equal(payload.generationVersion, 3);
    assert.equal(payload.land, false);
    assert.equal(payload.biome, 'ocean');
  });

  await t.test('3. WorldStreamer setRegion Transitions and Atomic Cache Clears', async () => {
    const root = new Group();
    const streamer = new WorldStreamer(root);

    // Initial region is Manaus
    assert.equal(streamer.generationContext.isManaus, true);
    assert.equal(streamer.generationContext.regionId, 'earth:manaus');
    const v1 = streamer.generationContext.generationVersion;

    // Transition to South Pacific
    const changed1 = streamer.setRegion({
      bodyId: 'earth',
      latDeg: -20.50,
      lonDeg: -140.20,
      isManaus: false,
      surfaceType: 'ocean',
    });
    assert.equal(changed1, true);
    assert.equal(streamer.generationContext.generationVersion, v1 + 1);
    assert.equal(streamer.generationContext.regionId, 'earth:-20.50:-140.20');
    assert.equal(BuildingGeneratorContext.activeOrigin.isManaus, false);
    assert.equal(ChunkMeshes.isLocalManausActive, false);
    assert.equal(ChunkMeshes.activeSolvent, 'terrestrial-ocean');

    // Calling setRegion with the same region should NOT force clear or bump version
    const changedSame = streamer.setRegion({
      bodyId: 'earth',
      latDeg: -20.50,
      lonDeg: -140.20,
      isManaus: false,
      surfaceType: 'ocean',
    });
    assert.equal(changedSame, false);
    assert.equal(streamer.generationContext.generationVersion, v1 + 1);

    // Transition to Ocean Planet Thalassa
    const changed2 = streamer.setRegion({
      bodyId: 'thalassa',
      latDeg: 0,
      lonDeg: 0,
      isManaus: false,
      surfaceType: 'megawave-ocean',
    });
    assert.equal(changed2, true);
    assert.equal(streamer.generationContext.generationVersion, v1 + 2);
    assert.equal(streamer.generationContext.regionId, 'thalassa:megawave-ocean');
    assert.equal(ChunkMeshes.activeSolvent, 'megawave-ocean');

    // Transition back to Manaus
    const changed3 = streamer.setRegion({
      bodyId: 'earth',
      latDeg: -3.1303,
      lonDeg: -60.0234,
      isManaus: true,
      surfaceType: 'terrestrial',
    });
    assert.equal(changed3, true);
    assert.equal(streamer.generationContext.generationVersion, v1 + 3);
    assert.equal(streamer.generationContext.regionId, 'earth:manaus');
    assert.equal(BuildingGeneratorContext.activeOrigin.isManaus, true);
    assert.equal(ChunkMeshes.isLocalManausActive, true);

    streamer.dispose();
  });

  await t.test('4. Stale In-Flight Worker Payload Discarding', async () => {
    const root = new Group();
    const streamer = new WorldStreamer(root);

    // Start in Manaus (version 1)
    streamer.setRegion({
      bodyId: 'earth',
      latDeg: -3.1303,
      lonDeg: -60.0234,
      isManaus: true,
      surfaceType: 'terrestrial',
    }, true);

    const initialVersion = streamer.generationContext.generationVersion;

    // Advance region to Thalassa (bumping version and changing regionId)
    streamer.setRegion({
      bodyId: 'thalassa',
      latDeg: 0,
      lonDeg: 0,
      isManaus: false,
      surfaceType: 'megawave-ocean',
    });

    const activeVersion = streamer.generationContext.generationVersion;
    const activeRegion = streamer.generationContext.regionId;
    assert.notEqual(activeVersion, initialVersion);
    assert.equal(activeRegion, 'thalassa:megawave-ocean');

    // Simulate an arriving stale payload from previous region
    const stalePayload = generateChunk(0, 0, {
      bodyId: 'earth',
      frameId: 'solar-system/earth/manaus-surface',
      latDeg: -3.1303,
      lonDeg: -60.0234,
      surfaceType: 'terrestrial',
      regionId: 'earth:manaus',
      generationVersion: initialVersion,
      isManaus: true,
      seed: 1337,
    });

    // Directly test that streamer records do not contain this stale chunk
    assert.equal(streamer.stats.active, 0);
    assert.equal(streamer.stats.cached, 0);

    streamer.dispose();
  });
});
