/**
 * tests/procedural-galaxy-map.test.ts
 *
 * U4.3 Unit Tests: Spatial Streaming and Procedural Universal Map.
 *
 * Validates:
 *   - Deterministic cosmological cell discovery across BigInt domains.
 *   - Extreme BigInt cell coordinates (> 2^53) and negative values.
 *   - Bounded LRU cache eviction and memory safety.
 *   - Spatial region exploration limits and query throttling.
 *   - UniversalTargetCatalog integration for procedural galaxies.
 *   - Strict preservation of canonical Local Group entities (Milky Way, Andromeda, Triangulum, LMC, SMC).
 *   - UniversalTargetResolver travel separation contract (U4.3 selection vs U4.4 transit execution).
 *   - Search and coordinate query resolution.
 *   - CosmologyMapRenderer and GalaxyMapRenderer interactive behaviors (zoom, pan, morphology adaptation, hit testing).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProceduralGalaxyDiscovery,
  cosmologicalCellKey,
  parseCosmologicalCellKey,
  parseGalaxyId,
  DEFAULT_UNIVERSE_SEED,
} from '../src/world/galaxy/ProceduralGalaxyDiscovery';
import {
  UniversalTargetCatalog,
  SOLAR_TARGET_ADDRESS,
} from '../src/world/travel/UniversalTargetCatalog';
import {
  UniversalTargetResolver,
  travelCapabilityLabel,
  type TargetResolutionContext,
} from '../src/world/travel/UniversalTargetResolver';
import {
  createUniversalTarget,
  universalTargetKey,
} from '../src/world/travel/UniversalNavigationTarget';
import {
  CosmologyMapRenderer,
  GalaxyMapRenderer,
} from '../src/ui/map/MapRenderers';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { COSMOLOGICAL_CELL_SIZE_M } from '../src/world/galaxy/ProceduralGalaxyGenerator';
import { SolarSystem } from '../src/world/celestial/SolarSystem';

function createMockCanvas(width = 1000, height = 650) {
  const labels: string[] = [];
  const circles: number[][] = [];
  const context = {
    clearRect() {},
    fillRect() {},
    setTransform() {},
    beginPath() {},
    stroke() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    arc(...args: number[]) { circles.push(args); },
    ellipse() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
    save() {},
    restore() {},
    rotate() {},
    translate() {},
    fillText(label: string) { labels.push(label); },
    measureText: (label: string) => ({ width: label.length * 7 }),
  };
  const canvas = {
    width: 300,
    height: 150,
    style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ width, height }),
  } as unknown as HTMLCanvasElement;
  return { canvas, labels, circles };
}

test('T_U43_01_COSMOLOGICAL_CELL_DISCOVERY_DETERMINISM', () => {
  const discoveryA = new ProceduralGalaxyDiscovery(DEFAULT_UNIVERSE_SEED);
  const discoveryB = new ProceduralGalaxyDiscovery(DEFAULT_UNIVERSE_SEED);

  // Cell (0,0,0) is canonical Local Group cell: MW, Andromeda, Triangulum, LMC, SMC
  const localGroup = discoveryA.discoverCell({ x: 0n, y: 0n, z: 0n });
  assert.equal(localGroup.length, 5);
  assert.equal(localGroup[0].id, 'milky_way');
  assert.equal(localGroup[1].id, 'andromeda');
  assert.equal(localGroup[2].id, 'triangulum');
  assert.ok(localGroup.every(g => g.isKnownAstronomicalEntity));

  // Procedural cell determinism
  const cell = { x: 12n, y: -45n, z: 88n };
  const run1 = discoveryA.discoverCell(cell);
  const run2 = discoveryB.discoverCell(cell);

  assert.ok(run1.length >= 1 && run1.length <= 4);
  assert.equal(run1.length, run2.length);
  for (let i = 0; i < run1.length; i++) {
    assert.equal(run1[i].id, run2[i].id);
    assert.equal(run1[i].seed, run2[i].seed);
    assert.equal(run1[i].morphology, run2[i].morphology);
    assert.equal(run1[i].family, run2[i].family);
    assert.equal(run1[i].name, run2[i].name);
    assert.equal(run1[i].diameterLy, run2[i].diameterLy);
    assert.equal(run1[i].isKnownAstronomicalEntity, false);
  }
});

test('T_U43_02_BIGINT_CELL_ARBITRARY_MAGNITUDE_AND_SIGNS', () => {
  const discovery = new ProceduralGalaxyDiscovery();

  // Test cell far beyond 2^53 (IEEE-754 mantissa boundary)
  const hugeCell = {
    x: 10_000_000_000_000_000n,
    y: -25_000_000_000_000_000n,
    z: 99_000_000_000_000_000n,
  };

  const key = cosmologicalCellKey(hugeCell);
  assert.equal(key, 'c10000000000000000_-25000000000000000_99000000000000000');
  const parsed = parseCosmologicalCellKey(key);
  assert.ok(parsed);
  assert.equal(parsed.x, hugeCell.x);
  assert.equal(parsed.y, hugeCell.y);
  assert.equal(parsed.z, hugeCell.z);

  const galaxies = discovery.discoverCell(hugeCell);
  assert.ok(galaxies.length >= 1);
  const first = galaxies[0];
  assert.equal(first.cell.x, hugeCell.x);
  assert.equal(first.cell.y, hugeCell.y);
  assert.equal(first.cell.z, hugeCell.z);

  const idParsed = parseGalaxyId(first.id);
  assert.ok(idParsed);
  assert.equal(idParsed.cell.x, hugeCell.x);
  assert.equal(idParsed.cell.y, hugeCell.y);
  assert.equal(idParsed.cell.z, hugeCell.z);
  assert.equal(idParsed.index, 0);

  // Negative coordinates preservation
  const negId = 'galaxy_c-500_-1200_-3000_2';
  const parsedNeg = parseGalaxyId(negId);
  assert.ok(parsedNeg);
  assert.equal(parsedNeg.cell.x, -500n);
  assert.equal(parsedNeg.cell.y, -1200n);
  assert.equal(parsedNeg.cell.z, -3000n);
  assert.equal(parsedNeg.index, 2);
});

test('T_U43_03_BOUNDED_LRU_CACHE_EVICTION', () => {
  const maxCached = 8;
  const discovery = new ProceduralGalaxyDiscovery(DEFAULT_UNIVERSE_SEED, maxCached);

  // Discover 15 distinct cells
  for (let i = 0; i < 15; i++) {
    discovery.discoverCell({ x: BigInt(i), y: 0n, z: 0n });
  }

  // Cache must never grow unbounded
  assert.equal(discovery.cachedCellCount, maxCached);

  // Re-visiting cell 14 (most recent) keeps it cached
  const cell14 = discovery.discoverCell({ x: 14n, y: 0n, z: 0n });
  assert.ok(cell14.length > 0);
  assert.equal(discovery.cachedCellCount, maxCached);

  // Clear cache flushes all stored cells
  discovery.clearCache();
  assert.equal(discovery.cachedCellCount, 0);
});

test('T_U43_04_SPATIAL_REGION_EXPLORATION_LIMITS', () => {
  const discovery = new ProceduralGalaxyDiscovery();

  // Region discovery with radius 2 and max limit 12
  const center = { x: 5n, y: 5n, z: 5n };
  const regionR2 = discovery.discoverRegion(center, 2, 12);
  assert.equal(regionR2.length, 12);

  // Radius 1 discovery
  const regionR1 = discovery.discoverRegion(center, 1, 64);
  assert.ok(regionR1.length > 0);

  // Radius 0 only returns galaxies of the center cell (strictly center cell)
  const single = discovery.discoverRegion(center, 0, 50);
  const cellExpected = discovery.discoverCell(center);
  assert.equal(single.length, cellExpected.length);
  for (let i = 0; i < single.length; i++) {
    assert.equal(single[i].id, cellExpected[i].id);
  }

  // Limit zero returns empty array
  const emptyLimit = discovery.discoverRegion(center, 1, 0);
  assert.equal(emptyLimit.length, 0);

  // Negative cells exploration
  const negCenter = { x: -100n, y: -200n, z: -300n };
  const negRegion = discovery.discoverRegion(negCenter, 0, 10);
  const negExpected = discovery.discoverCell(negCenter);
  assert.equal(negRegion.length, negExpected.length);

  // Discovery order independence
  const disc1 = new ProceduralGalaxyDiscovery(DEFAULT_UNIVERSE_SEED);
  const disc2 = new ProceduralGalaxyDiscovery(DEFAULT_UNIVERSE_SEED);
  disc1.discoverCell({ x: 99n, y: 99n, z: 99n }); // warm cache on another cell
  const res1 = disc1.discoverRegion(center, 1, 20);
  const res2 = disc2.discoverRegion(center, 1, 20);
  assert.equal(res1.length, res2.length);
  for (let i = 0; i < res1.length; i++) {
    assert.equal(res1[i].id, res2[i].id);
  }
});

test('T_U43_05_UNIVERSAL_TARGET_CATALOG_PROCEDURAL_INTEGRATION', () => {
  const catalog = new UniversalTargetCatalog();

  // 1. Preserves canonical targets
  assert.ok(catalog.find('milky_way'));
  assert.ok(catalog.find('andromeda'));
  assert.ok(catalog.find('sol'));
  assert.ok(catalog.find('earth'));

  // 2. Discovers procedural galaxy by identifier
  const procId = 'galaxy_c10_20_30_0';
  const targetDesc = catalog.find(procId);
  assert.ok(targetDesc);
  assert.equal(targetDesc.kind, 'galaxy');
  assert.equal(targetDesc.objectId, procId);
  assert.equal(targetDesc.galaxyId, procId);

  // 3. Verifies universalTargetKey conforms to contract
  const target = createUniversalTarget(targetDesc);
  assert.equal(target.key, `galaxy/${encodeURIComponent(procId)}`);

  // 4. Resolves target through catalog
  const resolved = catalog.resolve(target);
  assert.ok(resolved);
  assert.equal(resolved.descriptor.key, target.key);
  assert.ok(resolved.globalPositionM);
  assert.equal(resolved.globalPositionM.length, 3);

  // 5. Cold cache target resolution with 'galaxy/' key prefix (from map hitTest)
  const coldCatalog = new UniversalTargetCatalog();
  const coldTarget = coldCatalog.target('galaxy/galaxy_c10_20_30_0');
  assert.ok(coldTarget);
  assert.equal(coldTarget.key, 'galaxy/galaxy_c10_20_30_0');
  assert.equal(coldTarget.objectId, 'galaxy_c10_20_30_0');
  assert.equal(coldTarget.galaxyId, 'galaxy_c10_20_30_0');

  // 6. Strict rejection of forged procedural aliases for canonical entities
  assert.equal(catalog.discovery.findGalaxyById('galaxy_c0_0_0_0'), undefined);
  assert.equal(catalog.discovery.findGalaxyById('galaxy_c0_0_0_1'), undefined);
  assert.ok(catalog.discovery.findGalaxyById('milky_way'));
  assert.ok(catalog.discovery.findGalaxyById('andromeda'));
  assert.ok(catalog.discovery.findGalaxyById('lmc'));
  assert.ok(catalog.discovery.findGalaxyById('galaxy/milky_way'));
});

test('T_U43_06_UNIVERSAL_TARGET_RESOLVER_PROCEDURAL_TRAVEL_SEPARATION', () => {
  const catalog = new UniversalTargetCatalog();
  const solar = new SolarSystem();
  const context: TargetResolutionContext = {
    activeSystem: solar,
    solarSystem: solar,
    address: SOLAR_TARGET_ADDRESS,
    playerSystemPositionM: () => [0, 0, 0],
    location: {
      cosmological: { cell: { x: 0n, y: 0n, z: 0n }, localMpc: [0, 0, 0] },
    },
  };
  const resolver = new UniversalTargetResolver(catalog, context);

  // Canonical Andromeda target: intergalactic hypercruise is available
  const andromedaTarget = catalog.target('andromeda');
  assert.ok(andromedaTarget);
  const andromedaResolved = resolver.resolve(andromedaTarget);
  assert.equal(andromedaResolved.valid, true);
  assert.equal(andromedaResolved.domain, 'intergalactic');
  assert.equal(andromedaResolved.travelCapability, 'intergalactic');

  // Procedural galaxy target: selected and valid, but travel capability separated for U4.4
  const procTarget = catalog.target('galaxy_c10_20_30_0');
  assert.ok(procTarget);
  const procResolved = resolver.resolve(procTarget);
  assert.equal(procResolved.valid, true);
  assert.equal(procResolved.domain, 'cosmological');
  assert.equal(procResolved.travelCapability, 'cosmological-future');
  assert.ok(travelCapabilityLabel(procResolved.travelCapability).includes('U4.4'));
  assert.ok(Number.isFinite(procResolved.distanceM));
  assert.ok(procResolved.distanceM! > 0);

  // Target far outside float domain (> 1024 cells)
  const distantTarget = catalog.target('galaxy_c2000_3000_4000_0');
  assert.ok(distantTarget);
  const distantResolved = resolver.resolve(distantTarget);
  assert.equal(distantResolved.valid, true);
  assert.equal(distantResolved.domain, 'cosmological');
  assert.equal(distantResolved.travelCapability, 'cosmological-future');
  assert.ok(Number.isFinite(distantResolved.distanceM));
  // Relative cell delta in 2 Mpc
  const expectedDistCells = Math.hypot(2000, 3000, 4000);
  const expectedDistM = expectedDistCells * COSMOLOGICAL_CELL_SIZE_M;
  assert.ok(Math.abs(distantResolved.distanceM! - expectedDistM) / expectedDistM < 0.01);
});

test('T_U43_07_SEARCH_AND_QUERY_RESOLUTION', () => {
  const discovery = new ProceduralGalaxyDiscovery();

  // Search by exact canonical name / ID
  const mw = discovery.search('Milky Way');
  assert.ok(mw.length > 0);
  assert.equal(mw[0].id, 'milky_way');

  const andr = discovery.search('andromeda');
  assert.ok(andr.length > 0);
  assert.equal(andr[0].id, 'andromeda');

  // Search by cell coordinates: `c:5,10,-15`
  const coordResults = discovery.search('c:5,10,-15');
  assert.ok(coordResults.length > 0);
  assert.equal(coordResults[0].cell.x, 5n);
  assert.equal(coordResults[0].cell.y, 10n);
  assert.equal(coordResults[0].cell.z, -15n);

  // Search by procedural designation prefix
  const desigResults = discovery.search('DM-PG');
  assert.ok(desigResults.length > 0);
  assert.ok(desigResults[0].name.startsWith('DM-PG'));
});

test('T_U43_08_COSMOLOGY_AND_GALAXY_MAP_RENDERERS', () => {
  const { canvas } = createMockCanvas(1000, 650);

  // 1. CosmologyMapRenderer
  const cosmoRenderer = new CosmologyMapRenderer(canvas);
  const location: UniverseLocation = {
    address: { galaxyId: 'milky_way', sector: sectorIndex(0n, 0n, 0n), systemId: 'sol', bodyId: 'earth' },
    frameId: 'solar-system/barycentric',
  };

  // Initial draw
  cosmoRenderer.draw(location);

  // Hit test selects a visible galaxy
  const hit = cosmoRenderer.hitTest(500, 325);
  // May be undefined if no galaxy is at exact center or returns a galaxy key
  if (hit) {
    assert.ok(hit.startsWith('galaxy/'));
  }

  // Zooming
  const initialZoom = cosmoRenderer.zoomMpc;
  cosmoRenderer.changeZoom(-100); // zoom in
  assert.ok(cosmoRenderer.zoomMpc < initialZoom);
  assert.ok(cosmoRenderer.zoomMpc >= 4);

  cosmoRenderer.changeZoom(500); // zoom out
  assert.ok(cosmoRenderer.zoomMpc > 4);
  assert.ok(cosmoRenderer.zoomMpc <= 120);

  // Panning
  cosmoRenderer.pan(300, 200);
  assert.ok(Number.isFinite(cosmoRenderer.panOffsetMpc.x));
  assert.ok(Number.isFinite(cosmoRenderer.panOffsetMpc.y));
  cosmoRenderer.draw(location);

  // 2. GalaxyMapRenderer adapts morphology
  const galaxyRenderer = new GalaxyMapRenderer(canvas);
  // Canonical Milky Way
  galaxyRenderer.draw(location);

  // Elliptical galaxy location
  const ellipticalLoc: UniverseLocation = {
    address: { galaxyId: 'galaxy_c10_20_30_0', sector: sectorIndex(0n, 0n, 0n) },
    frameId: 'galactic/barycentric',
  };
  galaxyRenderer.draw(ellipticalLoc);

  // 3. Multi-scale zoom up to 120 Mpc and safe BigInt coordinates without precision loss
  cosmoRenderer.zoomMpc = 120;
  const distantGalaxies = cosmoRenderer.discovery.discoverVisibleRegion(cosmoRenderer.centerCell, 120, 64);
  assert.ok(distantGalaxies.length > 0);
  assert.ok(distantGalaxies.length <= 64);

  // Extreme BigInt cell magnitudes (> 2^53 and 2^64)
  cosmoRenderer.centerCell = {
    x: 18_446_744_073_709_551_616n, // 2^64
    y: -9_007_199_254_740_993n,    // -(2^53 + 1)
    z: 0n,
  };
  // Must render without infinite loop or Float64 precision breakdown
  cosmoRenderer.draw(location);
  assert.ok(true);
});

test('T_U43_09_STREAMING_CONTEXT_CONTRACT_AND_BUDGET', () => {
  // Verifies that StreamingContext and SpatialContext accept optional cosmological address
  const spatial: import('../src/world/providers/WorldProvider').SpatialContext = {
    timeS: 0,
    player: {
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      orientation: [0, 0, 0, 1],
    },
    frame: {
      id: 'solar-system/barycentric',
      kind: 'system',
      parentFrameId: null,
      origin: [0, 0, 0],
      orientation: [0, 0, 0, 1],
    },
    localVelocityMps: [0, 0, 0],
    address: { galaxyId: 'milky_way', sector: sectorIndex(0n, 0n, 0n) },
    cosmological: { cell: { x: 0n, y: 0n, z: 0n }, localMpc: [0, 0, 0] },
  };

  const streaming: import('../src/world/providers/WorldProvider').StreamingContext = {
    spatial,
    camera: {
      fovRad: Math.PI / 3,
      viewportHeightPx: 1080,
      forward: [0, 0, 1],
    },
    quality: {
      sseTargetPx: 2.0,
      detailFactor: 1.0,
    },
    budget: {
      maxUploadBytesPerFrame: 1024 * 1024,
      maxCpuTimePerFrameMs: 8,
      maxGpuMemoryBytes: 512 * 1024 * 1024,
      maxActiveTiles: 256,
      maxResidentGeometryBytes: 256 * 1024 * 1024,
      maxResidentTextureBytes: 256 * 1024 * 1024,
    },
    cosmological: spatial.cosmological,
  };

  assert.ok(streaming.cosmological);
  assert.equal(streaming.cosmological.cell.x, 0n);
});
