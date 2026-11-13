import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CosmicAtlasModel, isCanonicalTarget } from '../src/world/exploration/CosmicAtlasModel';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { SaveManager } from '../src/core/SaveManager';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { generateStarSector } from '../src/world/celestial/StarSector';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation';

function mockStorage(initialData: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initialData));
  let writeCount = 0;
  const mock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      writeCount++;
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  const prev = (globalThis as any).localStorage;
  (globalThis as any).localStorage = mock;
  return {
    restore: () => {
      (globalThis as any).localStorage = prev;
    },
    getWriteCount: () => writeCount,
  };
}

test('T_ISSUE02_01_TARGET_MAP_CACHING_AND_INVALIDATION', () => {
  const { restore } = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    // Initial query caches the consolidated targetMap
    const q1 = atlas.query({ limit: 10 });
    const targetMap1 = (atlas as any).collectTargetMap();
    const q2 = atlas.query({ limit: 10 });
    const targetMap2 = (atlas as any).collectTargetMap();

    // Must be exact same Map instance (reused without re-allocation)
    assert.equal(targetMap1, targetMap2, 'Repeated queries must reuse cachedTargetMap without re-allocation');

    // Invalidation on recordDiscovery
    atlas.recordDiscovery({
      kind: 'galaxy',
      displayName: 'Test Galaxy Discovery',
      objectId: 'test_galaxy_inv_1',
      galaxyId: 'test_galaxy_inv_1',
    });
    assert.equal((atlas as any).cachedTargetMap, null, 'recordDiscovery must invalidate cachedTargetMap');

    // Invalidation on toggleFavorite
    const q3 = atlas.query({ limit: 10 });
    assert.ok((atlas as any).cachedTargetMap !== null, 'cachedTargetMap should be populated after query');
    atlas.toggleFavorite('galaxy/milky_way');
    assert.equal((atlas as any).cachedTargetMap, null, 'toggleFavorite must invalidate cachedTargetMap');
  } finally {
    restore();
  }
});

test('T_ISSUE02_02_BODY_METADATA_CACHING_AND_REUSE', () => {
  const { restore } = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    const sector = sectorIndex(5n, -3n, 8n);
    const starCandidate = generateStarSector('milky_way', sector).stars.find(s => s.planetCount >= 2)!;
    const pDesc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id)!;
    const pPlanet = pDesc.system.bodies[1];

    const arrivalLoc: UniverseLocation = {
      address: {
        galaxyId: 'milky_way',
        sector,
        systemId: starCandidate.id,
        bodyId: pPlanet.id,
      },
      frameId: `${starCandidate.id}/${pPlanet.id}`,
    };

    atlas.recordArrival(arrivalLoc);

    // Verify metadata was pre-cached in bodyMetadataCache
    const cache = (atlas as any).bodyMetadataCache as Map<string, any>;
    assert.ok(cache.size > 0, 'Procedural system bodies metadata must be populated in bodyMetadataCache');

    // Query specifically for this planet
    const q = atlas.query({ query: pPlanet.name, kind: 'body' });
    assert.ok(q.entries.length >= 1, 'Query must return the discovered planet');
    const entry = q.entries.find(e => e.objectId === pPlanet.id);
    assert.ok(entry, 'Discovered planet must exist in query results');
    assert.ok(entry.worldType !== undefined, 'Cached worldType must be preserved');
    assert.equal(entry.canLand, pPlanet.profile?.canLand, 'Cached canLand must match body profile');
  } finally {
    restore();
  }
});

test('T_ISSUE02_03_LARGE_ENTITY_QUERY_PERFORMANCE_AND_STATS_INTEGRITY', () => {
  const { restore } = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    // Register 30 procedural systems
    for (let i = 0; i < 30; i++) {
      const sec = sectorIndex(BigInt(i), 0n, 0n);
      const stars = generateStarSector('milky_way', sec).stars;
      if (stars.length > 0) {
        const s = stars[0];
        const sysTarget = catalog.proceduralTarget('milky_way', sec, s.id, 'system');
        if (sysTarget) {
          atlas.recordDiscovery(sysTarget);
        }
      }
    }

    const statsDirect = atlas.getStatistics('milky_way');
    const queryResult = atlas.query({ limit: 12 }, 'milky_way');
    const statsQuery = queryResult.statistics;

    // Verify 100% mathematical equality between single-pass stats and standalone stats
    assert.equal(statsQuery.totalKnown, statsDirect.totalKnown);
    assert.equal(statsQuery.totalGalaxies, statsDirect.totalGalaxies);
    assert.equal(statsQuery.proceduralGalaxies, statsDirect.proceduralGalaxies);
    assert.equal(statsQuery.canonicalGalaxies, statsDirect.canonicalGalaxies);
    assert.equal(statsQuery.totalSystems, statsDirect.totalSystems);
    assert.equal(statsQuery.visitedCount, statsDirect.visitedCount);
    assert.equal(statsQuery.favoritesCount, statsDirect.favoritesCount);
    assert.equal(statsQuery.flyableCount, statsDirect.flyableCount);

    // Verify paging
    assert.equal(queryResult.entries.length, 12);
    assert.equal(queryResult.hasMore, true);
    assert.ok(queryResult.totalCount > 12);
  } finally {
    restore();
  }
});
