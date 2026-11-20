import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CosmicAtlasModel,
  isCanonicalTarget,
  type CosmicAtlasEntry,
} from '../src/world/exploration/CosmicAtlasModel';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import {
  createUniversalTarget,
  universalTargetKey,
  type UniversalTargetDescriptor,
} from '../src/world/travel/UniversalNavigationTarget';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';
import { SaveManager } from '../src/core/SaveManager';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation';
import { renderUniversalTargetCardHtml } from '../src/ui/map/UniversalMapPanel';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { generateStarSector } from '../src/world/celestial/StarSector';

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

test('T_U4531_01_UNIVERSAL_TARGET_CATALOG_PROCEDURAL_KEY_PARSING', () => {
  const catalog = new UniversalTargetCatalog();
  const sector = sectorIndex(17n, -2n, 4n);
  const starSector = generateStarSector('milky_way', sector);
  const starCandidate = starSector.stars.find(s => s.planetCount > 1)!;
  assert.ok(starCandidate, 'Should find star with multiple planets');

  const pDesc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id);
  assert.ok(pDesc, 'Procedural descriptor must exist');
  assert.ok(pDesc.system.bodies.length > 2, 'System must have at least star + 2 planets');

  const starBody = pDesc.system.bodies[0];
  const planetBody = pDesc.system.bodies[1];

  // 1. Procedural system target
  const sysTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'system')!;
  assert.ok(sysTarget);
  const sysKey = universalTargetKey(sysTarget);

  const foundSys = catalog.find(sysKey);
  assert.ok(foundSys, 'Catalog.find must resolve procedural system key');
  assert.equal(foundSys.kind, 'system');
  assert.equal(foundSys.objectId, starCandidate.id);

  // 2. Procedural star target
  const starTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'star', starBody.id)!;
  assert.ok(starTarget);
  const starKey = universalTargetKey(starTarget);

  const foundStar = catalog.find(starKey);
  assert.ok(foundStar, 'Catalog.find must resolve procedural star key');
  assert.equal(foundStar.kind, 'star');
  assert.equal(foundStar.objectId, starCandidate.id);

  // 3. Procedural planet target
  const planetTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'body', planetBody.id)!;
  assert.ok(planetTarget);
  const planetKey = universalTargetKey(planetTarget);

  const foundPlanet = catalog.find(planetKey);
  assert.ok(foundPlanet, 'Catalog.find must resolve procedural planet key');
  assert.equal(foundPlanet.kind, 'body');
  assert.equal(foundPlanet.objectId, planetBody.id);

  // 4. Find directly by raw procedural ID
  const foundByBodyId = catalog.find(planetBody.id);
  assert.ok(foundByBodyId, 'Catalog.find must resolve by raw procedural body ID');
  assert.equal(foundByBodyId.objectId, planetBody.id);

  const foundByStarId = catalog.find(starCandidate.id);
  assert.ok(foundByStarId, 'Catalog.find must resolve by raw procedural star/system ID');
});

test('T_U4531_02_CANONICAL_TARGET_TAXONOMY', () => {
  const catalog = new UniversalTargetCatalog();
  const sector = sectorIndex(17n, -2n, 4n);
  const starSector = generateStarSector('milky_way', sector);
  const starCandidate = starSector.stars.find(s => s.planetCount > 0)!;
  const pDesc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id)!;
  const pPlanet = pDesc.system.bodies[1];

  // Canonical Galaxies
  const mw = catalog.find('milky_way')!;
  assert.equal(isCanonicalTarget(mw), true, 'Milky Way must be canonical');
  const m31 = catalog.find('andromeda')!;
  assert.equal(isCanonicalTarget(m31), true, 'Andromeda must be canonical');

  // Procedural Galaxy
  const procGalaxy: UniversalTargetDescriptor = {
    kind: 'galaxy',
    displayName: 'DM-PG-999',
    objectId: 'pg_10_20_30_0',
    galaxyId: 'pg_10_20_30_0',
  };
  assert.equal(isCanonicalTarget(procGalaxy), false, 'Procedural galaxy must NOT be canonical');

  // Canonical Solar System
  const solSys = catalog.find('sol')!;
  assert.equal(isCanonicalTarget(solSys), true, 'Sol system must be canonical');

  // Procedural System in Milky Way
  const procSys = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'system')!;
  assert.equal(isCanonicalTarget(procSys), false, 'Procedural system in Milky Way must NOT be canonical');

  // Canonical Solar Bodies
  const earth = catalog.find('earth')!;
  assert.equal(isCanonicalTarget(earth), true, 'Earth must be canonical');
  const sun = catalog.find('sun')!;
  assert.equal(isCanonicalTarget(sun), true, 'Sun must be canonical');
  const mars = catalog.find('mars')!;
  assert.equal(isCanonicalTarget(mars), true, 'Mars must be canonical');

  // Procedural Planet and Star in Milky Way
  const procPlanetTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'body', pPlanet.id)!;
  assert.equal(isCanonicalTarget(procPlanetTarget), false, 'Procedural planet in Milky Way must NOT be canonical');

  const procStarTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'star', starCandidate.id)!;
  assert.equal(isCanonicalTarget(procStarTarget), false, 'Procedural star in Milky Way must NOT be canonical');

  // Black hole
  const sgra = catalog.find('sgra')!;
  assert.equal(isCanonicalTarget(sgra), true, 'Sagittarius A* must be canonical');
});

test('T_U4531_03_RECORD_ARRIVAL_DISCOVERY_PROPAGATION', () => {
  const restoreStorage = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    const sector = sectorIndex(17n, -2n, 4n);
    const starCandidate = generateStarSector('milky_way', sector).stars.find(s => s.planetCount >= 2)!;
    const pDesc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id)!;
    const pBodyArrived = pDesc.system.bodies[1];
    const pBodyUnvisited = pDesc.system.bodies[2];

    const arrivalLoc: UniverseLocation = {
      address: {
        galaxyId: 'milky_way',
        sector,
        systemId: starCandidate.id,
        bodyId: pBodyArrived.id,
      },
      frameId: `${starCandidate.id}/${pBodyArrived.id}`,
    };

    atlas.recordArrival(arrivalLoc);

    const arrivedTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'body', pBodyArrived.id)!;
    const unvisitedTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'body', pBodyUnvisited.id)!;
    const sysTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'system')!;

    const arrivedKey = universalTargetKey(arrivedTarget);
    const unvisitedKey = universalTargetKey(unvisitedTarget);
    const sysKey = universalTargetKey(sysTarget);

    // Arrived body and system must be marked visited
    assert.equal(atlas.isVisited(arrivedKey), true, 'Arrived body must be marked visited');
    assert.equal(atlas.isVisited(sysKey), true, 'System arrived at must be marked visited');

    // Sibling body must NOT be visited
    assert.equal(atlas.isVisited(unvisitedKey), false, 'Sibling body in same system must NOT be visited');

    // Both bodies must be discovered and present in Atlas query
    const queryResult = atlas.query({ query: pBodyUnvisited.name });
    assert.ok(queryResult.entries.length > 0, 'Sibling body must be discoverable in Atlas');
    const siblingEntry = queryResult.entries.find(e => e.objectId === pBodyUnvisited.id);
    assert.ok(siblingEntry, 'Sibling entry must exist in Atlas');
    assert.equal(siblingEntry.visited, false, 'Sibling entry visited status must be false');
    assert.equal(siblingEntry.isCanonical, false, 'Procedural sibling must not be canonical');
    assert.ok(siblingEntry.worldType, 'Sibling must have worldType populated');
    assert.ok(siblingEntry.temperatureK !== undefined, 'Sibling must have temperatureK populated');
  } finally {
    restoreStorage();
  }
});

test('T_U4531_04_QUERY_BY_WORLD_TYPE_AND_ACCENT_INSENSITIVITY', () => {
  const restoreStorage = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    // Baseline includes Earth, which is an oceanic planet
    const earthQueryAccent = atlas.query({ query: 'oceânico' });
    assert.ok(earthQueryAccent.entries.some(e => e.objectId === 'earth'), 'Query with accent must find Earth');

    const earthQueryNoAccent = atlas.query({ query: 'oceanico' });
    assert.ok(earthQueryNoAccent.entries.some(e => e.objectId === 'earth'), 'Query without accent must find Earth');

    // Sol system star search
    const starQuery = atlas.query({ query: 'estrela' });
    assert.ok(starQuery.entries.some(e => e.objectId === 'sun'), 'Query "estrela" must find Sun');
  } finally {
    restoreStorage();
  }
});

test('T_U4531_05_FAVORITE_PROCEDURAL_BODY_PERSISTENCE', () => {
  const restoreStorage = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    const sector = sectorIndex(17n, -2n, 4n);
    const starCandidate = generateStarSector('milky_way', sector).stars.find(s => s.planetCount >= 1)!;
    const pDesc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id)!;
    const pPlanet = pDesc.system.bodies[1];

    const planetTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'body', pPlanet.id)!;
    const planetKey = universalTargetKey(planetTarget);

    // Toggle favorite
    const active = atlas.toggleFavorite(planetKey);
    assert.equal(active, true, 'Favorite should be toggled active');
    assert.equal(atlas.isFavorite(planetKey), true);
    assert.ok(save.data.favorites?.includes(planetKey), 'Key must be saved to SaveManager');

    // Reconstruct Atlas from same save manager
    const reloadedAtlas = new CosmicAtlasModel(catalog, save);
    assert.equal(reloadedAtlas.isFavorite(planetKey), true, 'Reloaded Atlas must remember favorite');

    const favQuery = reloadedAtlas.query({ statusFilter: 'favorites' });
    const favEntry = favQuery.entries.find(e => e.key === planetKey);
    assert.ok(favEntry, 'Favorited procedural body must be returned in favorites query');
    assert.equal(favEntry.displayName, planetTarget.displayName);
    assert.equal(favEntry.favorite, true);
    assert.equal(favEntry.isCanonical, false);
  } finally {
    restoreStorage();
  }
});

test('T_U4531_06_CARD_LANDING_MODES_AND_TAXONOMY', () => {
  const universe = new UniverseRuntime();
  try {
    const catalog = new UniversalTargetCatalog(universe.solarSystem);
    const resolver = new UniversalTargetResolver(catalog, universe);

    // 1. Sun
    const sunTarget = catalog.target('sun')!;
    const sunResolved = resolver.resolve(sunTarget);
    const sunHtml = renderUniversalTargetCardHtml(sunResolved, catalog.discovery, 'milky_way', false, true, catalog);

    assert.ok(sunHtml.includes('✓ Entrada permitida na fotosfera'), 'Sun must allow photosphere entry');
    assert.ok(sunHtml.includes('Temperatura Média (observada)'), 'Sun must display observed mean temperature');
    assert.ok(sunHtml.includes('Corpo Canônico (Sistema Solar)'), 'Sun must be canonical Solar body');

    // 2. Earth
    const earthTarget = catalog.target('earth')!;
    const earthResolved = resolver.resolve(earthTarget);
    const earthHtml = renderUniversalTargetCardHtml(earthResolved, catalog.discovery, 'milky_way', false, true, catalog);

    assert.ok(earthHtml.includes('✓ Pouso permitido (superfície sólida)'), 'Earth must allow solid surface landing');
    assert.ok(earthHtml.includes('Temperatura Média (observada)'), 'Earth must display observed mean temperature');
    assert.ok(earthHtml.includes('Corpo Canônico (Sistema Solar)'), 'Earth must be canonical Solar body');

    // 3. Jupiter
    const jupiterTarget = catalog.target('jupiter')!;
    const jupiterResolved = resolver.resolve(jupiterTarget);
    const jupiterHtml = renderUniversalTargetCardHtml(jupiterResolved, catalog.discovery, 'milky_way', false, false, catalog);

    assert.ok(jupiterHtml.includes('✗ Pouso impossível (gigante fluido)'), 'Jupiter must show impossible fluid giant landing');
    assert.ok(jupiterHtml.includes('Corpo Canônico (Sistema Solar)'), 'Jupiter must be canonical Solar body');

    // 4. Procedural Planet
    const sector = sectorIndex(17n, -2n, 4n);
    const starCandidate = generateStarSector('milky_way', sector).stars.find(s => s.planetCount >= 1)!;
    const pDesc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id)!;
    const pPlanet = pDesc.system.bodies[1];

    const pTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'body', pPlanet.id)!;
    const pResolved = resolver.resolve(pTarget);
    const pHtml = renderUniversalTargetCardHtml(pResolved, catalog.discovery, 'milky_way', false, false, catalog);

    assert.ok(pHtml.includes('Corpo Procedural Sintético'), 'Procedural planet must be classified as procedural synthetic');
    assert.ok(pHtml.includes('Temperatura de Equilíbrio (estimada)'), 'Procedural planet must show estimated equilibrium temp');

    if (pPlanet.profile?.canLand) {
      assert.ok(pHtml.includes('✓ Pouso permitido (superfície sólida)'), 'Solid procedural world must show solid landing');
    } else {
      assert.ok(pHtml.includes('✗ Pouso impossível (gigante fluido)'), 'Fluid procedural giant must show fluid landing');
    }

    // 5. Procedural Star
    const pStarTarget = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'star', starCandidate.id)!;
    const pStarResolved = resolver.resolve(pStarTarget);
    const pStarHtml = renderUniversalTargetCardHtml(pStarResolved, catalog.discovery, 'milky_way', false, false, catalog);

    assert.ok(pStarHtml.includes('Corpo Procedural Sintético'), 'Procedural star must be classified as procedural synthetic');
    assert.ok(pStarHtml.includes('✗ Sem pouso (fotosfera inóspita)'), 'Procedural star must show inhospitable photosphere');

    // 6. Systems and Galaxies
    const solSys = catalog.target('sol')!;
    const solResolved = resolver.resolve(solSys);
    const solHtml = renderUniversalTargetCardHtml(solResolved, catalog.discovery, 'milky_way', false, true, catalog);
    assert.ok(solHtml.includes('Sistema Catalogado'), 'Sol must be cataloged system');

    const procSys = catalog.proceduralTarget('milky_way', sector, starCandidate.id, 'system')!;
    const procSysResolved = resolver.resolve(procSys);
    const procSysHtml = renderUniversalTargetCardHtml(procSysResolved, catalog.discovery, 'milky_way', false, false, catalog);
    assert.ok(procSysHtml.includes('Sistema Procedural'), 'Procedural system must be procedural system');

    const mwTarget = catalog.target('milky_way')!;
    const mwResolved = resolver.resolve(mwTarget);
    const mwHtml = renderUniversalTargetCardHtml(mwResolved, catalog.discovery, 'milky_way', false, true, catalog);
    assert.ok(mwHtml.includes('Galáxia Canônica'), 'Milky Way must be canonical galaxy');
  } finally {
    universe.dispose();
  }
});
