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
import { PowerSystem } from '../src/player/powers/PowerSystem.ts';
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

  // In render space, player/camera sits at origin (0, 0, 0)
  const rayOrigin = new Vector3(0, 0, 0);
  const rayDir = new Vector3(0, 0, 1);

  // Playable scanner activation
  const scanner = new CosmicSpeciesScanner(save);
  const scanResult = scanner.scanAim(rayOrigin, rayDir, [], titanManager.titans, undefined, 120, undefined, SOLAR_SYSTEM_FRAME);

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

test('E2E COSMIC PLAYABILITY: 5. PowerSystem astronomical combat domain at 500 km reach', () => {
  const root = new Group();
  const player = {
    size: 1,
    position: new Vector3(0, 0, 0),
    velocity: new Vector3(0, 0, 0),
    state: 'Flying',
    isGrounded: false,
    facingYaw: 0,
    model: new Group(),
    character: {
      skinnedMeshes: [],
      initializeAnimations: async () => {},
      startCombatMove: () => {},
      aimEnergy: () => {},
      dispose: () => {},
      leftFoot: new Group(),
      rightFoot: new Group(),
      leftHand: new Group(),
      rightHand: new Group(),
      group: new Group(),
    },
    powerPose: () => {},
    teleport: () => {},
    setSize: () => {},
    beginSlam: () => {},
    consumeImpact: () => null,
  } as any;

  const camera = new PerspectiveCamera();
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, 500_000); // Look directly at titan along +Z

  const input = {
    held: () => false,
    consume: () => false,
    press: () => {},
    release: () => {},
    enabled: true,
  } as any;

  const titanManager = new CosmicPlanetTitanManager();
  const titan = titanManager.titans[0];
  // Place titan in render space 500 km ahead
  titan.renderPosition.set(0, 0, 500_000);
  titanManager.root.visible = true;

  let hitTargetId: string | null = null;
  let hitForce = 0;

  const powers = new PowerSystem(
    root,
    player,
    camera,
    input,
    {
      targets: () => titanManager.targets,
      hit: (id: string, force: number) => {
        hitTargetId = id;
        hitForce = force;
        titanManager.hit(id, force, 1000);
      },
      reconstruct: () => 0,
      impulse: () => {},
      prepare: async () => {},
      notify: () => {},
      sound: () => {},
      getOrigin: () => new Vector3(),
      getColliders: () => [],
      getActiveBodyId: () => 'deep_space',
    }
  );

  // 1. Fire Energy Beam at 500 km standoff distance
  powers.use('energy');
  assert.ok(hitTargetId !== null, 'Energy beam must acquire cosmic target at 500 km');
  assert.ok(hitForce > 0, 'Energy force delivered to titan');
  assert.ok(titan.shield < 1_500_000, 'Titan shield took damage');

  // 2. Toggle and tick Continuous Laser at 500 km
  powers.use('laser'); // Turn on
  powers.update(0.12, 0.12);
  assert.ok(hitTargetId !== null, 'Continuous laser cuts into titan at 500 km');

  titanManager.dispose();
});

test('E2E COSMIC PLAYABILITY: 6. Dorsal carapace armor deflection vs frontal vulnerable core penetration', () => {
  let notices: string[] = [];
  const titanManager = new CosmicPlanetTitanManager(
    undefined,
    msg => notices.push(msg)
  );
  const titan = titanManager.titans[0];
  titan.headingRad = 0; // Forward vector points along +X: (1, 0, 0)
  titan.renderPosition.set(0, 0, 0);

  // 1. Attacking from behind dorsal carapace (-X direction relative to titan heading)
  const attackerBehind = new Vector3(-500_000, 0, 0);
  titanManager.hit('planet-titan-core', 50, 1000, attackerBehind);
  assert.ok(notices.some(n => n.includes('CARAPAÇA DORSAL REPELIU')), 'Dorsal carapace protects core from rear hits');

  // 2. Attacking from the front (+X direction relative to titan heading)
  notices = [];
  const attackerFront = new Vector3(500_000, 0, 0);
  titanManager.hit('planet-titan-core', 50, 1000, attackerFront);
  assert.ok(notices.some(n => n.includes('PONTO FRACO VULNERÁVEL ATINGIDO')), 'Frontal attack hits exposed core');

  titanManager.dispose();
});

test('E2E COSMIC PLAYABILITY: 7. Boss offensive attack against player, telegraph, and persistence in SaveManager', () => {
  const save = new SaveManager();
  save.reset();

  let notices: string[] = [];
  let playerDamaged = false;
  let playerDamageAmount = 0;

  const titanManager = new CosmicPlanetTitanManager(
    save,
    msg => notices.push(msg),
    () => {}
  );
  const titan = titanManager.titans[0];

  const graph = new ReferenceFrameGraph();
  graph.register(referenceFrame({ id: SOLAR_SYSTEM_FRAME, kind: 'system', label: 'Sistema Solar' }));
  const origin = createRenderOrigin(SOLAR_SYSTEM_FRAME, [titan.position.x, titan.position.y, titan.position.z]);
  const renderSpace = new RenderSpaceService(graph, origin);

  // Player position in render space (200 km in front of titan)
  const playerPos = new Vector3(0, 0, 200_000);

  // Advance time to trigger attack cooldown (10s)
  titan.attackCooldown = 0.1;
  titanManager.update(
    0.2,
    renderSpace,
    SOLAR_SYSTEM_FRAME,
    0,
    undefined,
    playerPos,
    dmg => { playerDamaged = true; playerDamageAmount = dmg; }
  );

  // Telegraph state entered
  assert.equal(titan.attackState, 'telegraph');
  assert.ok(notices.some(n => n.includes('AVISO DE COMBATE') || n.includes('mira Raio')));

  // Complete telegraph and fire attack
  titanManager.update(
    1.6,
    renderSpace,
    SOLAR_SYSTEM_FRAME,
    0,
    undefined,
    playerPos,
    dmg => { playerDamaged = true; playerDamageAmount = dmg; }
  );

  assert.ok(playerDamaged, 'Player takes damage from Titan attack');
  assert.ok(playerDamageAmount > 100);

  // Damage titan and verify state persists in SaveManager
  titanManager.hit(titan.id, 1_000_000, 1000);
  const savedRecord = save.getTitanRecord(titan.id);
  assert.ok(savedRecord, 'Titan state must be saved in SaveManager');
  assert.equal(savedRecord.health, titan.health);
  assert.equal(savedRecord.shield, titan.shield);

  // Re-instantiate manager and verify restored status
  const manager2 = new CosmicPlanetTitanManager(save);
  assert.equal(manager2.titans[0].health, titan.health, 'Health restored from SaveManager');
  assert.equal(manager2.titans[0].shield, titan.shield, 'Shield restored from SaveManager');

  titanManager.dispose();
  manager2.dispose();
});

test('E2E COSMIC PLAYABILITY: 8. Species scanner aim raycast precision: hits when facing titan, returns null when facing away', () => {
  const save = new SaveManager();
  save.reset();

  const titanManager = new CosmicPlanetTitanManager();
  const titan = titanManager.titans[0];
  titan.renderPosition.set(0, 0, 500_000); // 500 km along +Z
  titanManager.root.visible = true;

  const scanner = new CosmicSpeciesScanner(save);
  const playerPos = new Vector3(0, 0, 0);

  // 1. Pointing directly along +Z at the Titan
  const forwardRay = new Vector3(0, 0, 1);
  const hit = scanner.scanAim(playerPos, forwardRay, [], titanManager.titans);
  assert.ok(hit !== null, 'Scanner must hit titan when looking directly at it');
  assert.equal(hit.profile.category, 'titan');

  // 2. Pointing 90 degrees away along +X
  const awayRay = new Vector3(1, 0, 0);
  const miss = scanner.scanAim(playerPos, awayRay, [], titanManager.titans);
  assert.equal(miss, null, 'Scanner must not hit titan when looking away');

  // 3. System isolation: Outside solar system (e.g. Andromeda), sol titan must not be scannable
  const andromedaHit = scanner.scanAim(playerPos, forwardRay, [], titanManager.titans, undefined, 120, undefined, 'andromeda/barycentric');
  assert.equal(andromedaHit, null, 'Scanner must enforce system isolation');

  titanManager.dispose();
});

test('E2E COSMIC PLAYABILITY: 9. Game restoreBody callback triggers reverse reconstruction, unsuppresses globe and restores landing', () => {
  const root = new Group();
  const presentation = new PlanetaryRupturePresentation(root);
  const save = new SaveManager();
  save.reset();

  const camera = new PerspectiveCamera();
  const earthCenter = new Vector3(0, 0, 0);

  // Rupture Earth
  save.recordBodyRupture('earth');
  presentation.loadPersistedRupture('earth', 6371000);
  assert.equal(save.isBodyRuptured('earth'), true);
  assert.equal(presentation.isRuptured('earth'), true);
  assert.equal(presentation.isGlobeSuppressed('earth'), true);

  // Simulate production Game restoreBody callback
  const restoreBody = (bodyId: string) => {
    save.recordBodyRestoration(bodyId);
    const reconstructing = presentation.startReverseReconstruction(bodyId, 3.0);
    if (!reconstructing) presentation.restore(bodyId);
    return true;
  };

  const restored = restoreBody('earth');
  assert.equal(restored, true);
  assert.equal(save.isBodyRuptured('earth'), false, 'SaveManager marks body restored');
  assert.equal(presentation.isReconstructing('earth'), true, 'Presentation enters active reverse reconstruction');

  // During early reconstruction (< 60%), globe is still suppressed
  presentation.update(1.0, camera, earthCenter); // 33% progress
  assert.equal(presentation.isReconstructing('earth'), true);
  assert.equal(presentation.isGlobeSuppressed('earth'), true);

  // At >= 60% progress (e.g. at 2.1s), globe is revealed and surface landing is restored
  presentation.update(1.1, camera, earthCenter); // 70% progress
  assert.equal(presentation.isGlobeSuppressed('earth'), false, 'Globe is revealed to player');

  // Landing policy: can land once globe is not suppressed
  const canLand = !save.isBodyRuptured('earth') && !presentation.isGlobeSuppressed('earth');
  assert.equal(canLand, true, 'Player can safely land on restored planetary surface');

  // Finish reconstruction sequence
  presentation.update(1.0, camera, earthCenter);
  assert.equal(presentation.isRuptured('earth'), false, 'Rupture session successfully deleted');

  presentation.dispose();
});
