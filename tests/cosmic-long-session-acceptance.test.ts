import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Group, Vector3 } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { TravelDomain } from '../src/world/travel/TravelDomain';
import { UniversalTeleportService } from '../src/world/travel/UniversalTeleportService';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';
import { GalaxyMaterializer } from '../src/world/galaxy/GalaxyMaterializer';
import { knownGalaxyRuntime } from '../src/world/galaxy/GalaxyRuntime';
import { findAndromedaU2Fixture } from '../src/world/galaxy/AndromedaU2Fixture';
import { ProceduralSystemMaterializer, type SystemResources } from '../src/world/runtime/ProceduralSystemMaterializer';
import { LargeScaleStructureProvider } from '../src/world/providers/LargeScaleStructureProvider';
import {
  evaluateCosmologicalNavigation,
  getCosmicAnchorDescriptor,
  resolveCosmologicalAnchorArrival,
} from '../src/world/cosmology/CosmologicalNavigation';
import { OBSERVABLE_HORIZON_MPC } from '../src/world/cosmology/CosmologicalStructure';
import { EarthTransitionController } from '../src/world/providers/EarthTransitionController';
import { SurfaceFrameService } from '../src/world/spatial/SurfaceFrameService';
import { gravitySourceFromBody, netGravityAcceleration } from '../src/world/celestial/GravitySource';
import { getPlanetVisualProfile } from '../src/world/celestial/PlanetVisualProfile';
import { COSMIC_LOD_HARD_CAPS, clampPlanetTileCap, clampRepresentativeGalaxyPoints, clampStarSectorRing, sectorCountForRing } from '../src/world/streaming/CosmicLodBudget';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { LIGHT_YEAR_M } from '../src/world/spatial/units';

function collectFilesRecursively(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursively(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

test('T_ACCEPTANCE_01_CLEAN_CODE_ARCHITECTURAL_BOUNDARIES', () => {
  const srcRoot = path.resolve(process.cwd(), 'src');
  const allSrcFiles = collectFilesRecursively(srcRoot);
  const basenames = new Set(allSrcFiles.map(f => path.basename(f)));

  // 15-CLEAN-CODE-ARCHITECTURE.md: Forbidden God objects must never exist
  for (const forbidden of ['UniverseManager.ts', 'SpaceManager.ts', 'CosmicRenderer.ts']) {
    assert.equal(basenames.has(forbidden), false, `Forbidden God object ${forbidden} must not exist`);
  }

  // 15-CLEAN-CODE-ARCHITECTURE.md: Pure math layer must have zero Three.js imports
  const pureMathModules = [
    'src/world/spatial/WGS84.ts',
    'src/world/spatial/ECEF.ts',
    'src/world/spatial/ENU.ts',
    'src/world/celestial/GravitySource.ts',
    'src/world/celestial/OfflineEphemeris.ts',
    'src/world/celestial/SatelliteOrbit.ts',
    'src/world/spatial/UniverseAddress.ts',
    'src/world/cosmology/CosmologicalStructure.ts',
  ];

  for (const relPath of pureMathModules) {
    const absPath = path.resolve(process.cwd(), relPath);
    const source = fs.readFileSync(absPath, 'utf8');
    assert.equal(
      /from\s+['"]three(\/webgpu|\/tsl)?['"]/.test(source),
      false,
      `Pure math module ${relPath} must not import Three.js`,
    );
  }
});

test('T_ACCEPTANCE_02_LONG_SESSION_FULL_COSMIC_ROUTE_AND_RESIDENCY', async () => {
  // Setup full multi-scale runtime environment
  const universe = new UniverseRuntime({ epochS: 123_456 });
  const travelDomain = new TravelDomain();
  const catalog = new UniversalTargetCatalog();
  const resolver = new UniversalTargetResolver(catalog, universe);
  const root = new Group();
  const galaxyMaterializer = new GalaxyMaterializer(universe, root);
  const noopResources: SystemResources = { install: () => {}, activate: () => {}, dispose: () => {} };

  const mw = knownGalaxyRuntime('milky_way')!;
  const andromeda = knownGalaxyRuntime('andromeda')!;
  const initialStage = galaxyMaterializer.prepare(mw.id);
  initialStage.install();
  initialStage.activate();
  initialStage.complete?.();

  const systemMaterializer = new ProceduralSystemMaterializer(
    universe,
    catalog,
    noopResources,
    () => noopResources,
    undefined,
    galaxyMaterializer,
  );

  const player = {
    position: new Vector3(0, 2, 0),
    velocity: new Vector3(0, 0, 0),
    size: 1.0,
    teleport(pos: { x: number; y: number; z: number }) {
      this.position.set(pos.x, pos.y, pos.z);
    },
    powerPose(_pose: string, _duration?: number) {},
  };

  const teleportService = new UniversalTeleportService({
    universe,
    travelDomain,
    player,
    getColliders: () => [],
    prepareManaus: async () => {},
    prepareSystem: target => ({
      commit: () => {
        universe.address = { ...universe.address, systemId: target.systemId };
      },
    }),
    notify: () => {},
    sound: () => {},
    burstVfx: () => {},
  });

  // --- LEG 1: Manaus Curved WGS84 Origin ---
  const earthTransition = new EarthTransitionController();
  const manausGroundState = earthTransition.update(0, undefined, true);
  assert.equal(manausGroundState.phase, 'LOCAL_ONLY');
  assert.equal(manausGroundState.localWeight, 1.0);

  const surfaceFrames = new SurfaceFrameService();
  const distantTile = surfaceFrames.frameForTile('acceptance:16,16', 16 * 1024, 16 * 1024);
  const directCorner = surfaceFrames.legacyPointToRenderLocal(16 * 1024 + 512, 0, 16 * 1024 + 512);
  const tileCorner = new Vector3(512, 0, 512).applyMatrix4(distantTile.getSceneMatrix());
  const horizErr = Math.hypot(directCorner.x - tileCorner.x, directCorner.z - tileCorner.z);
  const vertErr = Math.abs(directCorner.y - tileCorner.y);
  assert.ok(horizErr < 0.05, `Distant Manaus tile horizontal parity (${horizErr} m) must be < 5 cm`);
  assert.ok(vertErr < 0.20, `Distant Manaus tile vertical parity (${vertErr} m) must be < 20 cm`);

  // --- LEG 2: Moon Surface ---
  const moonArrival = await teleportService.teleport({
    kind: 'surface-geodetic',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'moon',
    latDeg: 0.6741,
    lonDeg: 23.473,
    altitudeM: 2.0,
  });
  assert.equal(moonArrival.success, true);
  assert.equal(universe.address.bodyId, 'moon');
  assert.ok(player.position.length() < 10_000, 'Player local render position on Moon must remain small');

  // --- LEG 3: Mars Surface ---
  const marsArrival = await teleportService.teleport({
    kind: 'surface-geodetic',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'mars',
    latDeg: -14.5684,
    lonDeg: 175.4729,
    altitudeM: 2.0,
  });
  assert.equal(marsArrival.success, true);
  assert.equal(universe.address.bodyId, 'mars');

  // --- LEG 4: Outer Solar System (Saturn Visual Profile & Point-Mass Inverse Square Gravity) ---
  const saturnProfile = getPlanetVisualProfile('saturn');
  assert.ok(saturnProfile);
  assert.equal(saturnProfile.surfaceType, 'gas');
  assert.ok(saturnProfile.rings && saturnProfile.rings.outerRadiusScale > saturnProfile.rings.innerRadiusScale);

  const saturnBody = universe.solarSystem.bodies.find(b => b.id === 'saturn')!;
  const saturnGrav = gravitySourceFromBody(saturnBody, [0, 0, 0])!;
  assert.ok(saturnGrav);
  const r1 = saturnBody.equatorialRadiusM * 3;
  const a1 = Math.hypot(...netGravityAcceleration([saturnGrav], [r1, 0, 0]));
  const a2 = Math.hypot(...netGravityAcceleration([saturnGrav], [2 * r1, 0, 0]));
  assert.ok(Math.abs(a1 / a2 - 4.0) < 1e-6, 'Point-mass gravity must obey inverse-square law a(r)/a(2r) = 4');

  // --- LEG 5: Milky Way Procedural Sector ---
  const mwSector = mw.generateSector(sectorIndex(17n, -2n, 4n));
  assert.ok(mwSector.stars.length > 0 && mwSector.stars.length <= COSMIC_LOD_HARD_CAPS.localVisibleStars);
  assert.equal(mwSector.stars[0].id, 'milky_way/17,-2,4/0');

  // --- LEG 6: External Milky Way & Andromeda (M31) Arrival (~2.5 Mly) ---
  const andromedaFixture = findAndromedaU2Fixture(catalog);
  const andromedaTarget = catalog.proceduralTarget(
    andromeda.id,
    andromedaFixture.address.sector,
    andromedaFixture.star.id,
    'star',
  )!;
  systemMaterializer.testArrival(andromedaTarget);
  assert.equal(universe.address.galaxyId, 'andromeda');
  galaxyMaterializer.update([0, 0, 0], 1e6);

  const externalMw = galaxyMaterializer.current!.externalGalaxies.find(g => g.id === 'galaxy-macro/milky_way');
  assert.ok(externalMw, 'Milky Way must be rendered as external macro galaxy from Andromeda');
  assert.equal(externalMw.stats.visible, true);
  assert.ok(
    externalMw.group.position.length() < 1e7,
    'External Milky Way render proxy must stay within safe Float32 scene bounds (< 1e7 m)',
  );
  const sgraFromM31Ly = resolver.resolve(catalog.target('sgra')!).distanceM! / LIGHT_YEAR_M;
  assert.ok(sgraFromM31Ly > 2.4e6 && sgraFromM31Ly < 2.6e6, 'Sgr A* must sit ~2.5 Mly from Andromeda');

  // --- LEG 7: Great Attractor Scale (Norma Cluster) ---
  const lssRoot = new Group();
  const lss = new LargeScaleStructureProvider(lssRoot, { drawCMB: true });
  const normaDesc = getCosmicAnchorDescriptor('norma_cluster')!;
  const normaArrival = resolveCosmologicalAnchorArrival(normaDesc, [0, 0, 0]);
  assert.equal(normaArrival.cell.x, 34n);
  const normaCell = lss.sampleCell(normaDesc.positionMpc, 1);
  assert.ok(normaCell.density01 > 0.5 && normaCell.clusterCandidates.includes('norma_cluster'));

  // --- LEG 8: Observable Universe Horizon ---
  const horizonTarget = catalog.target('observable-horizon')!;
  const horizonNav = evaluateCosmologicalNavigation(horizonTarget, {
    cell: normaArrival.cell,
    localMpc: normaArrival.localMpc,
  });
  assert.equal(horizonNav.isHorizon, true);
  assert.equal(horizonNav.distanceMpc, OBSERVABLE_HORIZON_MPC);
  assert.equal(horizonNav.horizonState.isPhysicalWall, false);
  assert.equal(horizonNav.horizonState.hasUniversalCenter, false);

  lss.update({ galaxyId: 'cosmology', sector: normaArrival.cell }, [0, 0, 0], 100);
  assert.equal(lss.stats.visible, true);
  for (const child of lssRoot.children) {
    assert.ok(
      child.position.length() < 1e7,
      'No Float32 scene transform in LargeScaleStructureProvider may receive raw Mpc/Gpc coordinates',
    );
  }

  // --- LEG 9: Return to Solar System & Manaus ---
  systemMaterializer.returnToSolar();
  assert.equal(universe.address.galaxyId, 'milky_way');
  assert.equal(universe.activeSystem, universe.solarSystem);

  const earthReturn = await teleportService.teleport({
    kind: 'surface-geodetic',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'earth',
    latDeg: -3.119028,
    lonDeg: -60.021731,
    altitudeM: 2.0,
  });
  assert.equal(earthReturn.success, true);
  assert.equal(universe.address.bodyId, 'earth');
  assert.ok(player.position.length() < 10_000, 'Returned Manaus player render coordinates must be bounded');

  // --- LEG 10: Residency & Budget Verification ---
  assert.equal(clampPlanetTileCap(500), COSMIC_LOD_HARD_CAPS.planetTiles);
  assert.equal(sectorCountForRing(clampStarSectorRing(5)), COSMIC_LOD_HARD_CAPS.starSectors);
  assert.equal(clampRepresentativeGalaxyPoints(500_000), COSMIC_LOD_HARD_CAPS.representativeGalaxyPoints);

  lss.dispose();
  assert.equal(lssRoot.children.length, 0);
});
