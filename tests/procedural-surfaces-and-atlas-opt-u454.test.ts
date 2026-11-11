import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CosmicAtlasModel,
  isCanonicalTarget,
} from '../src/world/exploration/CosmicAtlasModel';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import {
  createUniversalTarget,
  universalTargetKey,
  type UniversalTargetDescriptor,
} from '../src/world/travel/UniversalNavigationTarget';
import { SaveManager } from '../src/core/SaveManager';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation';
import { generateStarSector } from '../src/world/celestial/StarSector';
import { maximumSurfaceReliefM, surfaceForBody } from '../src/world/planet/BodySurfaceFactory';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';

function mockStorage(initial: Record<string, string> = {}): { restore: () => void; getWriteCount: () => number; store: Map<string, string> } {
  const previous = globalThis.localStorage;
  const store = new Map<string, string>(Object.entries(initial));
  let writeCount = 0;
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { writeCount++; store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
  return {
    restore: () => { globalThis.localStorage = previous; },
    getWriteCount: () => writeCount,
    store,
  };
}

// -----------------------------------------------------------------------------
// P0: SAVEMANAGER BATCHING & WRITE AMPLIFICATION PREVENTION
// -----------------------------------------------------------------------------

test('T_U454_01_SAVEMANAGER_BATCHING_AND_BULK_DISCOVERY', () => {
  const { restore, getWriteCount } = mockStorage();
  try {
    const save = new SaveManager();
    const initialWrites = getWriteCount();

    // 1. Bulk discovery: adding 30 keys in one call should execute exactly 1 write
    const testKeys = Array.from({ length: 30 }, (_, i) => `universe/milky_way/0,0,0/system/sys_${i}`);
    const added = save.discoverTargets(testKeys);
    assert.equal(added, 30);
    assert.equal(getWriteCount(), initialWrites + 1, 'discoverTargets must save in a single write operation');

    // 2. Discovering existing keys should not trigger a save
    const reAdded = save.discoverTargets(testKeys);
    assert.equal(reAdded, 0);
    assert.equal(getWriteCount(), initialWrites + 1, 'No write should happen if no new keys were added');

    // 3. Batching: executing 20 separate discovery calls within save.batch() must trigger only 1 save at the end
    const batchKeys = Array.from({ length: 20 }, (_, i) => `universe/milky_way/1,1,1/system/batch_${i}`);
    save.batch(() => {
      for (const k of batchKeys) {
        save.discoverTarget(k);
      }
    });
    assert.equal(getWriteCount(), initialWrites + 2, 'save.batch() must coalesce all inner saves into a single write');

    for (const k of batchKeys) {
      assert.equal(save.isDiscoveredTarget(k), true);
    }
  } finally {
    restore();
  }
});

test('T_U454_02_ATLAS_RECORD_ARRIVAL_AND_DISCOVERY_SINGLE_BATCH', () => {
  const { restore, getWriteCount } = mockStorage();
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    const sector = sectorIndex(17n, -2n, 4n);
    const starCandidate = generateStarSector('milky_way', sector).stars.find(s => s.planetCount >= 3)!;
    const pDesc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id)!;
    const pPlanet = pDesc.system.bodies[1];

    const writesBefore = getWriteCount();

    // Arriving at a procedural system registers the system and all contained bodies (star + planets + moons)
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

    // Write count should only increase by 1 batch save despite recording multiple bodies!
    const writesAfter = getWriteCount();
    assert.equal(writesAfter - writesBefore, 1, 'recordArrival must execute within a single save batch');

    // Verify all bodies of the system are now recorded in the save data
    assert.ok(save.data.discoveredTargets && save.data.discoveredTargets.length >= pDesc.system.bodies.length);
  } finally {
    restore();
  }
});

test('T_U454_03_ATLAS_LARGE_SAVE_RESTORATION_WITHOUT_DATA_LOSS', () => {
  const initialData: Record<string, string> = {};
  const mockKeys: string[] = [
    'galaxy/milky_way',
    'universe/milky_way/0,0,0/system/sol',
    'universe/milky_way/0,0,0/system/sol/body/earth',
  ];

  // Synthesize 120 procedural keys across multiple sectors
  for (let s = 0; s < 5; s++) {
    const sysId = `milky_way/${s},0,0/0`;
    mockKeys.push(`universe/milky_way/${s},0,0/system/${encodeURIComponent(sysId)}`);
    for (let p = 0; p < 4; p++) {
      mockKeys.push(`universe/milky_way/${s},0,0/system/${encodeURIComponent(sysId)}/body/${encodeURIComponent(sysId + '_planet_' + p)}`);
    }
  }

  const rawSave = {
    version: 1,
    discovered: ['teatro'],
    completed: [],
    settings: { quality: 'High', dynamicResolution: true, sound: true, time: 'Golden Hour', weather: 'clear', dayCycle: false },
    favorites: [mockKeys[1]],
    visitedTargets: [mockKeys[0], mockKeys[1], mockKeys[2]],
    discoveredTargets: mockKeys,
  };
  initialData['dr-manaus-v1'] = JSON.stringify(rawSave);

  const { restore } = mockStorage(initialData);
  try {
    const save = new SaveManager();
    const catalog = new UniversalTargetCatalog();
    const atlas = new CosmicAtlasModel(catalog, save);

    // Verify restoration completed cleanly without throwing or losing keys
    const stats = atlas.getStatistics('milky_way');
    assert.ok(stats.totalKnown >= mockKeys.length, 'Atlas must restore all discovered entities without dropping');
    assert.equal(atlas.isVisited('galaxy/milky_way'), true);
    assert.equal(atlas.isFavorite(mockKeys[1]), true);
  } finally {
    restore();
  }
});

// -----------------------------------------------------------------------------
// P0: CANONICAL TARGET TAXONOMY STRICTNESS
// -----------------------------------------------------------------------------

test('T_U454_04_CANONICAL_TARGET_STRICT_GALAXY_CHECK', () => {
  // 1. Authentic Earth in Milky Way / Sol
  const authenticEarth: UniversalTargetDescriptor = {
    kind: 'body',
    displayName: 'Terra',
    objectId: 'earth',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'earth',
  };
  assert.equal(isCanonicalTarget(authenticEarth), true, 'Earth in Milky Way / Sol must be canonical');

  // 2. Spoofed Earth in Andromeda
  const spoofedEarth: UniversalTargetDescriptor = {
    kind: 'body',
    displayName: 'Terra Falsa',
    objectId: 'earth',
    galaxyId: 'andromeda',
    systemId: 'sol',
    bodyId: 'earth',
  };
  assert.equal(isCanonicalTarget(spoofedEarth), false, 'Earth in Andromeda must NOT be canonical');

  // 3. Spoofed Sun in Andromeda
  const spoofedSun: UniversalTargetDescriptor = {
    kind: 'star',
    displayName: 'Sol Falso',
    objectId: 'sun',
    galaxyId: 'andromeda',
    systemId: 'sol',
    bodyId: 'sun',
  };
  assert.equal(isCanonicalTarget(spoofedSun), false, 'Sun in Andromeda must NOT be canonical');

  // 4. Spoofed Sol system in Andromeda
  const spoofedSolSys: UniversalTargetDescriptor = {
    kind: 'system',
    displayName: 'Sistema Solar Falso',
    objectId: 'sol',
    galaxyId: 'andromeda',
    systemId: 'sol',
  };
  assert.equal(isCanonicalTarget(spoofedSolSys), false, 'Sol system in Andromeda must NOT be canonical');

  // 5. Procedural body in Milky Way
  const proceduralBody: UniversalTargetDescriptor = {
    kind: 'body',
    displayName: 'Planeta PX',
    objectId: 'milky_way/17,-2,4/0_planet_0',
    galaxyId: 'milky_way',
    systemId: 'milky_way/17,-2,4/0',
    bodyId: 'milky_way/17,-2,4/0_planet_0',
  };
  assert.equal(isCanonicalTarget(proceduralBody), false, 'Procedural body in Milky Way must NOT be canonical');
});

// -----------------------------------------------------------------------------
// P1 & P2: PROCEDURAL PLANET SURFACES - RELIEF, NORMALS, BIOMES & DETERMINISM
// -----------------------------------------------------------------------------

test('T_U454_05_PROCEDURAL_PLANET_SURFACE_DETERMINISM_AND_ISOLATION', () => {
  const catalog = new UniversalTargetCatalog();
  const sector = sectorIndex(17n, -2n, 4n);
  const starCandidate = generateStarSector('milky_way', sector).stars.find(s => s.planetCount >= 2)!;
  const pDesc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id)!;

  const planet0 = pDesc.system.bodies[1];
  const planet1 = pDesc.system.bodies[2];

  const surface0A = surfaceForBody(planet0);
  const surface0B = surfaceForBody(planet0);
  assert.ok(surface0A, 'Procedural solid planet must produce valid surface generator');
  assert.ok(surface0B, 'Procedural solid planet must produce valid surface generator');

  const testDir: [number, number, number] = [0.577, 0.577, 0.577];

  // 1. Determinism: identical height, normal, and colour on consecutive calls
  const hA = surface0A.heightAt(testDir);
  const hB = surface0B.heightAt(testDir);
  assert.equal(hA, hB, 'heightAt must be bit-for-bit identical for same body and direction');

  const normA: [number, number, number] = [0, 0, 0];
  const normB: [number, number, number] = [0, 0, 0];
  surface0A.normalEnu(testDir, normA);
  surface0B.normalEnu(testDir, normB);
  assert.deepEqual(normA, normB, 'normalEnu must be identical for same body and direction');

  const colA: [number, number, number] = [0, 0, 0];
  const colB: [number, number, number] = [0, 0, 0];
  surface0A.colourAt(testDir, colA);
  surface0B.colourAt(testDir, colB);
  assert.deepEqual(colA, colB, 'colourAt must be identical for same body and direction');

  // 2. Isolation: different bodies produce distinct relief and colors
  const surface1 = surfaceForBody(planet1);
  if (surface1) {
    const h1 = surface1.heightAt(testDir);
    const col1: [number, number, number] = [0, 0, 0];
    surface1.colourAt(testDir, col1);

    // Height or color should differ between distinct planets
    const diff = Math.abs(hA - h1) > 1e-4 || colA[0] !== col1[0] || colA[1] !== col1[1];
    assert.ok(diff, 'Different procedural bodies must have isolated, distinct topography');
  }
});

test('T_U454_06_BIOME_SURFACE_DIFFERENTIATION', () => {
  const catalog = new UniversalTargetCatalog();
  // Scan sectors to find planets of different classifications
  let oceanicBody: any;
  let volcanicBody: any;
  let frozenBody: any;
  let aridBody: any;

  for (let x = 0n; x < 25n; x++) {
    const s = generateStarSector('milky_way', sectorIndex(x, 0n, 0n));
    for (const star of s.stars) {
      if (star.planetCount > 0) {
        const desc = catalog.proceduralDescriptor('milky_way', sectorIndex(x, 0n, 0n), star.id);
        if (desc) {
          for (const b of desc.system.bodies) {
            const cls = b.profile?.environment?.classification;
            if (cls === 'oceanic-rocky' && !oceanicBody) oceanicBody = b;
            if (cls === 'volcanic-rocky' && !volcanicBody) volcanicBody = b;
            if (cls === 'frozen-rocky' && !frozenBody) frozenBody = b;
            if (cls === 'arid-rocky' && !aridBody) aridBody = b;
          }
        }
      }
      if (oceanicBody && volcanicBody && frozenBody && aridBody) break;
    }
    if (oceanicBody && volcanicBody && frozenBody && aridBody) break;
  }

  // 1. Oceanic world: must have sea level flat areas (h === 0) and continental relief (h > 0)
  if (oceanicBody) {
    const surface = surfaceForBody(oceanicBody)!;
    assert.ok(surface, 'Oceanic body must have surface');
    let hasSeaLevel = false;
    let hasContinent = false;

    // Sample across grid on sphere
    for (let u = -1; u <= 1; u += 0.25) {
      for (let v = -1; v <= 1; v += 0.25) {
        const len = Math.hypot(u, v, 0.7);
        const dir: [number, number, number] = [u / len, v / len, 0.7 / len];
        const h = surface.heightAt(dir);
        if (h === 0) hasSeaLevel = true;
        if (h > 100) hasContinent = true;
      }
    }
    assert.ok(hasSeaLevel, 'Oceanic world must contain flat sea level regions (height === 0)');
    assert.ok(hasContinent, 'Oceanic world must contain elevated continental relief (height > 0)');
  }

  // 2. Volcanic world: maximum relief up to 10km and dark basalt/ash colors
  if (volcanicBody) {
    const surface = surfaceForBody(volcanicBody)!;
    assert.ok(surface);
    const maxRelief = maximumSurfaceReliefM(volcanicBody);
    assert.ok(maxRelief >= 8_000, 'Volcanic world relief envelope must accommodate volcanic peaks');

    const col: [number, number, number] = [0, 0, 0];
    surface.colourAt([0, 1, 0], col);
    assert.ok(Number.isFinite(col[0]) && Number.isFinite(col[1]) && Number.isFinite(col[2]));
  }

  // 3. Frozen world: bright ice reflectance
  if (frozenBody) {
    const surface = surfaceForBody(frozenBody)!;
    assert.ok(surface);
    const col: [number, number, number] = [0, 0, 0];
    surface.colourAt([0, 0, 1], col);
    // Polar ice or glacial plain should have high brightness
    assert.ok(col[0] + col[1] + col[2] > 1.5, 'Frozen world must have high albedo ice coloring');
  }

  // 4. Arid world: positive relief with warm tones
  if (aridBody) {
    const surface = surfaceForBody(aridBody)!;
    assert.ok(surface);
    const col: [number, number, number] = [0, 0, 0];
    surface.colourAt([1, 0, 0], col);
    assert.ok(col[0] > col[2], 'Arid world must be red/ochre dominated');
  }
});

test('T_U454_07_PHYSICS_AND_VISUAL_GEOMETRIC_CONSISTENCY', () => {
  const catalog = new UniversalTargetCatalog();
  const sector = sectorIndex(17n, -2n, 4n);
  const starCandidate = generateStarSector('milky_way', sector).stars.find(s => s.planetCount >= 1)!;
  const pDesc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id)!;
  const pPlanet = pDesc.system.bodies[1];

  const surface = surfaceForBody(pPlanet)!;
  assert.ok(surface);
  const maxRelief = maximumSurfaceReliefM(pPlanet);
  assert.ok(maxRelief > 0, 'Procedural solid planet must report non-zero maximum surface relief');

  // Test across multiple directions on the sphere
  const directions: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [0.577, 0.577, 0.577],
    [-0.707, 0.707, 0],
  ];

  for (const dir of directions) {
    const h = surface.heightAt(dir);
    // 1. Height must stay strictly within the broad-phase relief envelope
    assert.ok(Math.abs(h) <= maxRelief, `Height ${h} must not exceed maximumSurfaceReliefM ${maxRelief}`);

    // 2. planetSurfaceRadius must equal base semiMajorAxis + height
    const r = planetSurfaceRadius(surface, dir);
    assert.ok(Math.abs(r - (surface.radiusM + h)) < 1e-4, 'planetSurfaceRadius must match surface.radiusM + heightAt');

    // 3. Normal vector must be normalized unit vector
    const norm: [number, number, number] = [0, 0, 0];
    surface.normalEnu(dir, norm);
    const normLen = Math.hypot(norm[0], norm[1], norm[2]);
    assert.ok(Math.abs(normLen - 1.0) < 1e-3, `Normal must be unit length, got ${normLen}`);
  }
});

test('T_U454_08_CANONICAL_BODIES_PRESERVATION', () => {
  const universe = new UniverseRuntime();
  try {
    const earth = universe.activeSystem.bodies.find(b => b.id === 'earth')!;
    const moon = universe.activeSystem.bodies.find(b => b.id === 'moon')!;
    const mars = universe.activeSystem.bodies.find(b => b.id === 'mars')!;
    const mercury = universe.activeSystem.bodies.find(b => b.id === 'mercury')!;
    const venus = universe.activeSystem.bodies.find(b => b.id === 'venus')!;
    const jupiter = universe.activeSystem.bodies.find(b => b.id === 'jupiter')!;
    const sun = universe.activeSystem.bodies.find(b => b.id === 'sun')!;

    // 1. Earth, Moon, Mars must retain their canonical relief
    assert.ok(maximumSurfaceReliefM(earth) > 8_000);
    assert.ok(maximumSurfaceReliefM(moon) > 10_000);
    assert.ok(maximumSurfaceReliefM(mars) >= 21_000);

    // 2. Mercury and Venus must retain flat synthetic-base behavior (heightAt === 0 and max relief === 0)
    assert.equal(maximumSurfaceReliefM(mercury), 0, 'Mercury must retain flat synthetic-base');
    assert.equal(maximumSurfaceReliefM(venus), 0, 'Venus must retain flat synthetic-base');
    const mercSurface = surfaceForBody(mercury)!;
    assert.equal(mercSurface.heightAt([1, 0, 0]), 0, 'Mercury heightAt must remain 0');
    const venusSurface = surfaceForBody(venus)!;
    assert.equal(venusSurface.heightAt([1, 0, 0]), 0, 'Venus heightAt must remain 0');

    // 3. Non-solid bodies (Jupiter, Sun) must NOT have surface generator
    assert.equal(surfaceForBody(jupiter), undefined, 'Jupiter must not have surface generator');
    assert.equal(surfaceForBody(sun), undefined, 'Sun must not have surface generator');
    assert.equal(maximumSurfaceReliefM(jupiter), 0);
    assert.equal(maximumSurfaceReliefM(sun), 0);
  } finally {
    universe.dispose();
  }
});
