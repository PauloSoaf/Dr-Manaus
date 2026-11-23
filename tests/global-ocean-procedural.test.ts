import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isLand } from '../src/world/geodata/geodata';
import { generateChunk } from '../src/world/chunks/BuildingGenerator';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes';
import { WORLD } from '../src/core/config';

describe('UNIVERSAL-WATER-04: Global Procedural Consistency (Ocean vs Land)', () => {
  it('1. Planetary oceanic coordinates are classified as water, not land', () => {
    // Atlantic ocean coordinate (2500 km East of Manaus)
    const atlanticX = 2500000;
    const atlanticZ = 0;
    assert.equal(isLand(atlanticX, atlanticZ), false, 'Atlantic Ocean must be classified as water/ocean');

    // Pacific ocean coordinate (3500 km West of Manaus)
    const pacificX = -3500000;
    const pacificZ = 0;
    assert.equal(isLand(pacificX, pacificZ), false, 'Pacific Ocean must be classified as water/ocean');

    // Inland South American continent (500 km West, 200 km South)
    const inlandX = -500000;
    const inlandZ = -200000;
    assert.equal(isLand(inlandX, inlandZ), true, 'Inland South America must be classified as land');

    // Manaus city center
    assert.equal(isLand(0, 0), true, 'Manaus city center must be classified as land');

    // Manaus Rio Negro channel
    assert.equal(isLand(0, 3000), false, 'Rio Negro channel must be classified as water');
  });

  it('2. Oceanic chunk generation produces ZERO trees and land=false (no floating forest in ocean)', () => {
    const cxAtlantic = Math.floor(2500000 / WORLD.chunkSize);
    const czAtlantic = 0;
    const atlanticChunk = generateChunk(cxAtlantic, czAtlantic);
    assert.equal(atlanticChunk.land, false, 'Ocean chunk payload land must be false');
    assert.equal(atlanticChunk.trees.length, 0, 'Ocean chunk must contain exactly 0 trees');
    assert.equal(atlanticChunk.buildings.length, 0, 'Ocean chunk must contain 0 buildings');

    const cxPacific = Math.floor(-3500000 / WORLD.chunkSize);
    const czPacific = 0;
    const pacificChunk = generateChunk(cxPacific, czPacific);
    assert.equal(pacificChunk.land, false, 'Pacific ocean chunk payload land must be false');
    assert.equal(pacificChunk.trees.length, 0, 'Pacific ocean chunk must contain exactly 0 trees');
    assert.equal(pacificChunk.buildings.length, 0, 'Pacific ocean chunk must contain 0 buildings');
  });

  it('3. Continental wilderness chunk generation produces rich trees and land=true', () => {
    const cxForest = 250;
    const czForest = -250;
    const forestChunk = generateChunk(cxForest, czForest);
    assert.equal(forestChunk.land, true, 'Forest chunk payload land must be true');
    assert.ok(forestChunk.trees.length > 0, 'Rainforest chunk must contain procedural trees');
  });

  it('4. ChunkMeshes instantiates ocean-surface for ocean chunks and forest-ground for land chunks', () => {
    const previousDoc = globalThis.document;
    const ctx = { fillStyle: '', fillRect() {} };
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) } as unknown as Document;
    try {
      const chunkMeshes = new ChunkMeshes();

      // Atlantic ocean chunk
      const cxAtlantic = Math.floor(2500000 / WORLD.chunkSize);
      const atlanticChunk = generateChunk(cxAtlantic, 0);
      const { group: oceanGroup } = chunkMeshes.create(atlanticChunk);
      const oceanMesh = oceanGroup.getObjectByName('ocean-surface');
      assert.ok(oceanMesh, 'Ocean chunk must instantiate ocean-surface mesh');

      // Continental wilderness chunk
      const forestChunk = generateChunk(250, -250);
      const { group: forestGroup } = chunkMeshes.create(forestChunk);
      const forestGround = forestGroup.getObjectByName('forest-ground');
      assert.ok(forestGround, 'Continental wilderness chunk must instantiate forest-ground mesh');

      // Local Manaus chunk (within 26km) does not duplicate ocean/forest meshes (handled by terrain.ts & WaterSystem)
      const localChunk = generateChunk(0, 0);
      const { group: localGroup } = chunkMeshes.create(localChunk);
      assert.equal(localGroup.getObjectByName('ocean-surface'), undefined, 'Local Manaus must not duplicate ocean-surface');
      assert.equal(localGroup.getObjectByName('forest-ground'), undefined, 'Local Manaus must not duplicate forest-ground');

      chunkMeshes.disposeChunk(oceanGroup);
      chunkMeshes.disposeChunk(forestGroup);
      chunkMeshes.disposeChunk(localGroup);
      chunkMeshes.dispose();
    } finally {
      globalThis.document = previousDoc;
    }
  });
});

