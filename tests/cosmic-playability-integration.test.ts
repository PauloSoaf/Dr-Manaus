/**
 * cosmic-playability-integration.test.ts
 *
 * DR-MANAUS | PATCH COSMIC-PLAYABILITY-HARDENING-01
 * End-to-end headless integration suite covering the entire cosmic gameplay loop:
 * 1. Atlas discovery and target resolution for the Astral Leviathan (11.2 AU).
 * 2. Physical approach, standoff arrival margin and exclusion envelope.
 * 3. Playable species scanner activation via reticle raycast and persistence in SaveManager.
 * 4. Multi-phase cosmic titan boss combat (shield break, weak spot, supernova phase 2, defeat).
 * 5. Planetary rupture and reverse reconstruction sequence with contracting debris ring.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from '../src/world/travel/UniversalTargetCatalog.ts';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver.ts';
import { SolarSystem, SOLAR_SYSTEM_FRAME } from '../src/world/celestial/SolarSystem.ts';
import { selectBodyDestination, resolveBodyDestination, bodyExclusionEnvelopes } from '../src/world/travel/BodyNavigation.ts';
import { CosmicPlanetTitanManager } from '../src/world/life/CosmicPlanetTitan.ts';
import { CosmicSpeciesScanner } from '../src/world/life/CosmicSpeciesScanner.ts';
import { SaveManager } from '../src/core/SaveManager.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { RenderSpaceService } from '../src/world/spatial/RenderSpaceService.ts';
import { createRenderOrigin } from '../src/world/spatial/RenderOrigin.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { PlanetaryRupturePresentation } from '../src/rendering/celestial/PlanetaryRupturePresentation.ts';
import { MacroBodyFractureService } from '../src/world/destruction/MacroBodyFractureService.ts';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore.ts';
import { MarsSurfaceGenerator } from '../src/world/planet/MarsSurface.ts';
import { MARS } from '../src/world/planet/PlanetBody.ts';

test('E2E COSMIC PLAYABILITY: 1. Atlas discovery & navigation resolution to Astral Leviathan beyond Saturn', () => {
  const catalog = new UniversalTargetCatalog();
  const solarSystem = new SolarSystem();
  const context = {
    activeSystem: solarSystem,
    solarSystem,
    address: SOLAR_TARGET_ADDRESS,
    playerSystemPositionM: () => [0, 0, 1.496e11] as [number, number, number], // At Earth
  };

  const resolver = new UniversalTargetResolver(catalog, context);
  const titanTarget = catalog.find('titan-astral-leviathan-01');
  assert.ok(titanTarget, 'Leviathan must be indexed in UniversalTargetCatalog');

  // Verify resolution
  const resolved = resolver.resolve(titanTarget);
  assert.equal(resolved.valid, true);
  assert.equal(resolved.materialized, true, 'Titan must be materialized in active Sol system');
  assert.equal(resolved.domain, 'system');
  assert.equal(resolved.travelCapability, 'solar');
  assert.ok(resolved.distanceM !== undefined && resolved.distanceM > 1.4e12, 'Distance from Earth must be > 1.4 billion km');

  // Verify navigation destination contract
  const destination = selectBodyDestination(solarSystem, titanTarget.objectId);
  assert.ok(destination, 'Destination must be selectable by navigation flight controller');
  assert.equal(destination.bodyId, 'titan-astral-leviathan-01');
  assert.ok(destination.arrivalMarginM >= 500_000, 'Arrival margin must maintain safe standoff distance (>= 500 km)');

  const resolvedDest = resolveBodyDestination(solarSystem, destination);
  assert.ok(resolvedDest, 'Destination must resolve with valid physical ephemeris');
  assert.equal(resolvedDest.radiusM, 120_000, 'Physical radius 120 km');

  // Verify exclusion envelope prevents warp collision clipping
  const envelopes = bodyExclusionEnvelopes(solarSystem, true);
  const titanEnvelope = envelopes.find(e => e.bodyId === 'titan-astral-leviathan-01');
  assert.ok(titanEnvelope, 'Titan must have an exclusion envelope');
  assert.ok(titanEnvelope.radiusM > 120_000, 'Exclusion envelope must exceed physical body radius');
});

test('E2E COSMIC PLAYABILITY: 2. Arrival in deep space, floating origin rendering & playable scanning via KeyF', () => {
  const save = new SaveManager();
  save.reset();

  const titanManager = new CosmicPlanetTitanManager();
  const titan = titanManager.titans[0];

  // Graph setup
  const graph = new ReferenceFrameGraph();
  graph.register(referenceFrame({ id: SOLAR_SYSTEM_FRAME, kind: 'system', label: 'Sistema Solar' }));

  // Player drops out of warp 500 km in front of the Leviathan
  const playerPosM = new Vector3(titan.position.x, titan.position.y, titan.position.z - 500_000);
  const origin = createRenderOrigin(SOLAR_SYSTEM_FRAME, [playerPosM.x, playerPosM.y, playerPosM.z]);
  const renderSpace = new RenderSpaceService(graph, origin);

  // Update titan rendering with floating origin
  titanManager.update(1.0, renderSpace, SOLAR_SYSTEM_FRAME);
  assert.equal(titanManager.root.visible, true, 'Titan must be visible in render space');

  // Player looks directly ahead along +Z towards the Leviathan
  const rayOrigin = playerPosM;
  const rayDir = new Vector3(0, 0, 1);

  // Playable scanner activation
  const scanner = new CosmicSpeciesScanner(save);
  const scanResult = scanner.scanAim(rayOrigin, rayDir, [], titanManager.titans);

  assert.ok(scanResult, 'Scanner raycast must hit Leviathan in aim reticle');
  assert.equal(scanResult.profile.category, 'titan');
  assert.equal(scanResult.profile.threatLevel, 5);
  assert.equal(scanResult.isNewDiscovery, true, 'First scan awards new cosmic discovery');
  assert.equal(save.isSpeciesDiscovered(scanResult.profile.speciesId), true, 'Discovery persists in SaveManager');

  // Second scan returns already cataloged
  const secondScan = scanner.scanAim(rayOrigin, rayDir, [], titanManager.titans);
  assert.ok(secondScan);
  assert.equal(secondScan.isNewDiscovery, false);

  titanManager.dispose();
});

test('E2E COSMIC PLAYABILITY: 3. Titan combat encounters: shield break, weak spots, supernova phase 2 and defeat', () => {
  let noticeLog: string[] = [];
  let soundLog: string[] = [];
  const titanManager = new CosmicPlanetTitanManager(
    undefined,
    msg => noticeLog.push(msg),
    snd => soundLog.push(snd),
  );
  const titan = titanManager.titans[0];

  assert.equal(titan.phase, 1, 'Initial phase 1: Astral Drifting');
  assert.equal(titan.shield, 1_500_000);
  assert.equal(titan.health, 2_500_000);

  // Hit 1: Weak spot on core (deals 3x critical damage and penetrates 50% shield)
  titanManager.hit('planet-titan-core', 50, 1000);
  assert.ok(titan.shield < 1_500_000);
  assert.ok(titan.health < 2_500_000);
  assert.ok(noticeLog.some(n => n.includes('PONTO FRACO VULNERÁVEL ATINGIDO')));

  // Hit 2: Shatter remaining shield
  titanManager.hit(titan.id, 1_500_000, 1000);
  assert.equal(titan.shield, 0, 'Shield shattered');
  assert.equal(titan.enraged, true, 'Enraged on shield break');
  assert.ok(noticeLog.some(n => n.includes('ESCUDO ASTRAL ROMPIDO')));

  // Hit 3: Damage health below 50% -> triggers Phase 2: Supernova Rage
  titanManager.hit(titan.id, 1_500_000, 1000);
  assert.equal(titan.phase, 2, 'Must enter Phase 2: Supernova Rage');
  assert.ok(noticeLog.some(n => n.includes('Fúria de Supernova')));

  // Hit 4: Fatal cosmic strike -> enters Phase 3 (Dormancy)
  titanManager.hit(titan.id, 2_000_000, 1000);
  assert.equal(titan.health, 0);
  assert.equal(titan.active, false);
  assert.equal(titan.phase, 3);
  assert.ok(soundLog.includes('planet-crack'));
  assert.ok(noticeLog.some(n => n.includes('dormência cósmica')));

  titanManager.dispose();
});

test('E2E COSMIC PLAYABILITY: 4. Planetary rupture and reverse reconstruction sequence with debris contraction', () => {
  const root = new Group();
  const presentation = new PlanetaryRupturePresentation(root);
  const camera = new PerspectiveCamera();
  const marsCenter = new Vector3(0, 0, 0);

  const edits = new PlanetVolumeEditStore();
  const fractureService = new MacroBodyFractureService({
    edits,
    surfaceForBody: id => (id === 'mars' ? MarsSurfaceGenerator : undefined),
    bodyById: id => (id === 'mars' ? { ...MARS, id: 'mars', name: 'Marte', frameId: 'mars-frame' } as any : undefined),
  });

  const plan = fractureService.rupturePlanet('mars', 1e28)!;
  presentation.startRupture('mars', plan, 3389500);

  // Fast forward into Phase 7 (persistent debris ring, globe suppressed)
  presentation.update(8.0, camera, marsCenter);
  assert.equal(presentation.currentPhase('mars'), 7);
  assert.equal(presentation.isGlobeSuppressed('mars'), true);

  // Start reverse reconstruction
  presentation.startReverseReconstruction('mars', 3.0);
  assert.equal(presentation.isReconstructing('mars'), true);

  // At 1.5s (50% progress): debris ring contracts inward
  presentation.update(1.5, camera, marsCenter);
  assert.equal(presentation.isReconstructing('mars'), true);
  assert.equal(presentation.isGlobeSuppressed('mars'), true);

  // At 2.1s (70% progress): fragments merge, intact globe revealed
  presentation.update(0.6, camera, marsCenter);
  assert.equal(presentation.isGlobeSuppressed('mars'), false, 'Intact globe restored at >= 60% progress');

  // Complete reconstruction
  presentation.update(1.0, camera, marsCenter);
  assert.equal(presentation.isRuptured('mars'), false, 'Session cleanly closed');
  assert.equal(presentation.isGlobeSuppressed('mars'), false);

  presentation.dispose();
});
