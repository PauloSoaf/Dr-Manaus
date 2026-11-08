import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CosmicAtlasModel,
  type CosmicAtlasEntry,
  type CosmicAtlasFilterOptions,
} from '../src/world/exploration/CosmicAtlasModel';
import {
  UniversalTargetCatalog,
  SOLAR_TARGET_ADDRESS,
} from '../src/world/travel/UniversalTargetCatalog';
import {
  createUniversalTarget,
  universalTargetKey,
  type UniversalTargetDescriptor,
} from '../src/world/travel/UniversalNavigationTarget';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';
import { ProceduralGalaxyDiscovery, DEFAULT_UNIVERSE_SEED } from '../src/world/galaxy/ProceduralGalaxyDiscovery';
import { SaveManager } from '../src/core/SaveManager';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation';
import {
  renderUniversalTargetCardHtml,
  describeNavigationGuidance,
  UniversalMapPanel,
} from '../src/ui/map/UniversalMapPanel';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';

function mockStorage(initial: Record<string, string> = {}): () => void {
  const previous = globalThis.localStorage;
  const store = new Map<string, string>(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
  return () => { globalThis.localStorage = previous; };
}

test('T_U452_01_ATLAS_BASELINE_INITIALIZATION', () => {
  const restore = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    // Initial visited baseline must include starting player address
    assert.equal(atlas.isVisited('galaxy/milky_way'), true);
    assert.equal(atlas.isVisited('universe/milky_way/0,0,0/system/sol'), true);
    assert.equal(atlas.isVisited('universe/milky_way/0,0,0/system/sol/body/earth'), true);

    // Distant/cataloged targets are NOT visited initially
    assert.equal(atlas.isVisited('galaxy/andromeda'), false);
    assert.equal(atlas.isVisited('universe/milky_way/0,0,0/system/sol/body/mars'), false);

    const stats = atlas.getStatistics('milky_way');
    assert.ok(stats.totalGalaxies >= 5, 'Should include local group canonical galaxies');
    assert.ok(stats.totalSystems >= 1, 'Should include solar system');
    assert.equal(stats.visitedCount >= 3, true);
    assert.equal(stats.favoritesCount, 0);
  } finally {
    restore();
  }
});

test('T_U452_02_VISITED_STRICTNESS_RULE', () => {
  const restore = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    // Catalog query or search must NOT mark target as visited
    const andromedaDesc = catalog.find('andromeda');
    assert.ok(andromedaDesc);
    const andromedaKey = universalTargetKey(andromedaDesc);
    assert.equal(atlas.isVisited(andromedaKey), false, 'Merely cataloged target must not be marked visited');

    // Searching in discovery must NOT mark as visited
    const discoveryResults = catalog.discovery.search('Andromeda');
    assert.ok(discoveryResults.length > 0);
    assert.equal(atlas.isVisited('galaxy/andromeda'), false, 'Search discovery must not mark visited');

    // Only actual arrival marks target as visited
    const arrivalLoc: UniverseLocation = {
      address: {
        galaxyId: 'andromeda',
        sector: sectorIndex(200n, 0n, 0n),
        systemId: 'system_alpha',
        bodyId: 'planet_one',
      },
      frameId: 'andromeda/system_alpha/planet_one',
    };
    atlas.recordArrival(arrivalLoc, 100);

    assert.equal(atlas.isVisited('galaxy/andromeda'), true);
    assert.equal(atlas.isVisited('universe/andromeda/200,0,0/system/system_alpha'), true);
    assert.equal(atlas.isVisited('universe/andromeda/200,0,0/system/system_alpha/body/planet_one'), true);

    // Verify history recorded the arrival
    const history = atlas.getHistory();
    assert.ok(history.some(h => h.type === 'arrival' && h.targetKey.includes('andromeda')));
  } finally {
    restore();
  }
});

test('T_U452_03_FAVORITE_TOGGLE_AND_PERSISTENCE', () => {
  const restore = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    const solKey = 'universe/milky_way/0,0,0/system/sol';
    assert.equal(atlas.isFavorite(solKey), false);

    // Toggle on
    const onResult = atlas.toggleFavorite(solKey, 10);
    assert.equal(onResult, true);
    assert.equal(atlas.isFavorite(solKey), true);
    assert.equal(save.isFavorite(solKey), true);

    // Toggle off
    const offResult = atlas.toggleFavorite(solKey, 20);
    assert.equal(offResult, false);
    assert.equal(atlas.isFavorite(solKey), false);
    assert.equal(save.isFavorite(solKey), false);

    // Add again and verify reload from SaveManager
    atlas.toggleFavorite(solKey, 30);
    atlas.toggleFavorite('galaxy/andromeda', 35);

    const reloadedAtlas = new CosmicAtlasModel(catalog, save);
    assert.equal(reloadedAtlas.isFavorite(solKey), true);
    assert.equal(reloadedAtlas.isFavorite('galaxy/andromeda'), true);
    assert.equal(reloadedAtlas.getStatistics().favoritesCount, 2);
  } finally {
    restore();
  }
});

test('T_U452_04_SEARCH_FILTERING', () => {
  const restore = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    // Search by name
    const solResults = atlas.query({ query: 'Sol' });
    assert.ok(solResults.entries.length > 0);
    assert.ok(solResults.entries.some(e => e.displayName.includes('Sol')));

    // Search by canonical ID
    const andromedaResults = atlas.query({ query: 'andromeda' });
    assert.ok(andromedaResults.entries.length > 0);
    assert.ok(andromedaResults.entries.some(e => e.objectId === 'andromeda'));

    // Search by procedural cell coordinate
    const cellResults = atlas.query({ query: 'c:0,0,0' });
    assert.ok(cellResults.entries.length > 0);

    // Empty search should return all known items
    const allResults = atlas.query({ limit: 100 });
    assert.ok(allResults.entries.length > 0);
    assert.equal(allResults.totalCount >= allResults.entries.length, true);
  } finally {
    restore();
  }
});

test('T_U452_05_MORPHOLOGY_AND_KIND_FILTERS', () => {
  const restore = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    // Kind filter: galaxy
    const galaxiesOnly = atlas.query({ kind: 'galaxy' });
    assert.ok(galaxiesOnly.entries.length > 0);
    for (const e of galaxiesOnly.entries) {
      assert.equal(e.kind, 'galaxy');
    }

    // Kind filter: system
    const systemsOnly = atlas.query({ kind: 'system' });
    assert.ok(systemsOnly.entries.length > 0);
    for (const e of systemsOnly.entries) {
      assert.equal(e.kind, 'system');
    }

    // Morphology filter: spiral
    const spirals = atlas.query({ morphology: 'spiral' });
    assert.ok(spirals.entries.length > 0);
    for (const e of spirals.entries) {
      const morph = (e.family ?? e.morphology ?? '').toLowerCase();
      assert.ok(morph.includes('spiral'));
    }
  } finally {
    restore();
  }
});

test('T_U452_06_SLICING_AND_VIRTUALIZATION', () => {
  const restore = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    // Small limit to test paging
    const page1 = atlas.query({ offset: 0, limit: 3 });
    assert.equal(page1.entries.length, 3);
    assert.equal(page1.hasMore, true);
    assert.ok(page1.totalCount > 3);

    const page2 = atlas.query({ offset: 3, limit: 3 });
    assert.equal(page2.entries.length, 3);

    // Ensure distinct items between pages
    const keys1 = new Set(page1.entries.map(e => e.key));
    for (const item of page2.entries) {
      assert.equal(keys1.has(item.key), false, 'Paging must not overlap items');
    }
  } finally {
    restore();
  }
});

test('T_U452_07_SAVE_MANAGER_SAFE_SERIALIZATION', () => {
  const restore = mockStorage();
  try {
    const save = new SaveManager();
    save.toggleFavorite('galaxy/andromeda');
    save.markVisited('universe/andromeda/200,0,0/system/sys1');

    // Retrieve raw stored json
    const raw = globalThis.localStorage.getItem('dr-manaus-v1');
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed.favorites));
    assert.ok(Array.isArray(parsed.visitedTargets));
    assert.ok(parsed.favorites.includes('galaxy/andromeda'));
    assert.ok(parsed.visitedTargets.includes('universe/andromeda/200,0,0/system/sys1'));

    // Corrupted save with non-string entries must be filtered safely
    globalThis.localStorage.setItem('dr-manaus-v1', JSON.stringify({
      version: 1,
      discovered: ['teatro'],
      completed: [],
      settings: save.data.settings,
      favorites: ['valid_fav', 1234, null, { bad: true }],
      visitedTargets: ['valid_vis', true],
    }));

    const cleanSave = new SaveManager();
    assert.deepEqual(cleanSave.data.favorites, ['valid_fav']);
    assert.deepEqual(cleanSave.data.visitedTargets, ['valid_vis']);
  } finally {
    restore();
  }
});

test('T_U452_08_TARGET_CARD_FAVORITE_AND_VISITED_RENDER', () => {
  const universe = new UniverseRuntime();
  try {
    const catalog = new UniversalTargetCatalog(universe.solarSystem);
    const resolver = new UniversalTargetResolver(catalog, universe);
    const marsTarget = catalog.target('mars')!;
    const resolved = resolver.resolve(marsTarget);

    // Unvisited, unfavorited
    const html1 = renderUniversalTargetCardHtml(resolved, catalog.discovery, 'milky_way', false, false);
    assert.match(html1, /data-target-section="identidade"/);
    assert.match(html1, /data-target-fav-toggle=/);
    assert.match(html1, /☆ FAVORITAR/);
    assert.match(html1, /Não visitado/);

    // Visited and favorited
    const html2 = renderUniversalTargetCardHtml(resolved, catalog.discovery, 'milky_way', true, true);
    assert.match(html2, /★ FAVORITO/);
    assert.match(html2, /✓ Visitado/);
    assert.doesNotMatch(html2, /NaN|undefined/);
  } finally {
    universe.dispose();
  }
});

test('T_U452_09_UNIVERSAL_MAP_PANEL_ATLAS_LEVEL_INTEGRATION', () => {
  const restore = mockStorage();
  try {
    let selectedTarget: string | undefined;
    let travelledTarget: string | undefined;

    const container = {
      innerHTML: '',
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
    } as unknown as HTMLElement;

    // Verify UniversalMapPanel accepts 'atlas' level without throwing
    const panel = Object.create(UniversalMapPanel.prototype) as any;
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog);

    panel.atlasModel = atlas;
    panel.currentLevel = 'surface';
    panel.model = { location: { address: { galaxyId: 'milky_way', sector: sectorIndex(0n,0n,0n), systemId: 'sol' } } };
    panel.updateCard = () => {};
    panel.updateBreadcrumb = () => {};
    panel.updateCanvasVisibility = () => {};
    panel.renderAtlasView = () => {};
    panel.updateScale = () => {};
    panel.drawMap = () => {};

    panel.setLevel('atlas');
    assert.equal(panel.currentLevel, 'atlas');
  } finally {
    restore();
  }
});

test('T_U452_10_EXPORT_IMPORT_STATE_CONSISTENCY', () => {
  const restore = mockStorage();
  try {
    const catalog = new UniversalTargetCatalog();
    const atlas1 = new CosmicAtlasModel(catalog);

    atlas1.toggleFavorite('galaxy/andromeda');
    atlas1.markVisited('universe/andromeda/200,0,0/system/sysA');
    const exported = atlas1.exportState();

    const atlas2 = new CosmicAtlasModel(catalog);
    atlas2.importState(exported);

    assert.equal(atlas2.isFavorite('galaxy/andromeda'), true);
    assert.equal(atlas2.isVisited('universe/andromeda/200,0,0/system/sysA'), true);
  } finally {
    restore();
  }
});

