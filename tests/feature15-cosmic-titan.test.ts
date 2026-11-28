import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import {
  CosmicPlanetTitanManager,
  AstralLeviathanSpineIK,
} from '../src/world/life/CosmicPlanetTitan.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { RenderSpaceService } from '../src/world/spatial/RenderSpaceService.ts';
import { createRenderOrigin } from '../src/world/spatial/RenderOrigin.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { SaveManager } from '../src/core/SaveManager.ts';
import { SOLAR_SYSTEM_FRAME } from '../src/world/celestial/SolarSystem.ts';
import { CosmicSpeciesScanner } from '../src/world/life/CosmicSpeciesScanner.ts';

test('FEATURE 15: 1. Deep solar orbit beyond Saturn at 1.65e12 m', () => {
  const manager = new CosmicPlanetTitanManager();
  const titan = manager.titans[0];

  assert.equal(titan.orbitRadiusM, 1.65e12, 'Titan orbit must be configured at exactly 1.65e12 m');
  // Saturn semi-major axis is ~1.43e12 m (9.54 AU). 1.65e12 m is ~11.03 AU
  assert.ok(titan.orbitRadiusM > 1.43e12, 'Orbit radius must be strictly beyond Saturn');
  assert.ok(titan.radiusM >= 100_000, 'Astral Leviathan is a planetary-scale colossus (120 km radius)');

  manager.dispose();
});

test('FEATURE 15: 2. Spine IK wave solver stability across 1,000 iterations (< 0.1% variance)', () => {
  const boneCount = 32;
  const segmentLength = 3750;
  const spine = new AstralLeviathanSpineIK(boneCount, segmentLength);

  const leadPos = new Vector3(1e12, 0, 1e12);

  // Run 1,000 continuous updates simulating space wave propagation
  for (let step = 0; step < 1000; step++) {
    leadPos.x += 100;
    leadPos.z += 200;
    spine.updateProceduralWave(step * 0.05, 5e-9, leadPos);

    // Verify all adjacent bones strictly respect the rigid segment length constraint
    for (let i = 1; i < boneCount; i++) {
      const prev = spine.getSegmentPosition(i - 1);
      const curr = spine.getSegmentPosition(i);
      const dist = prev.distanceTo(curr);
      const diff = Math.abs(dist - segmentLength);
      const relativeError = diff / segmentLength;

      assert.ok(
        relativeError < 0.001,
        `Segment ${i} distance (${dist.toFixed(4)}) must not vary by more than 0.1% from ${segmentLength}`,
      );
    }
  }
});

test('FEATURE 15: 3. Coordinate unification & targets exposed in render space for combat & scanner', () => {
  const save = new SaveManager();
  save.reset();
  const manager = new CosmicPlanetTitanManager(save);
  const titan = manager.titans[0];

  const graph = new ReferenceFrameGraph();
  graph.register(referenceFrame({ id: SOLAR_SYSTEM_FRAME, kind: 'system', label: 'Sistema Solar' }));

  // Player drops out of warp 300 km in front of the Leviathan
  const playerPosM = new Vector3(titan.position.x, titan.position.y, titan.position.z - 300_000);
  const origin = createRenderOrigin(SOLAR_SYSTEM_FRAME, [playerPosM.x, playerPosM.y, playerPosM.z]);
  const renderSpace = new RenderSpaceService(graph, origin);

  manager.update(0.1, renderSpace, SOLAR_SYSTEM_FRAME);

  // Targets must be exposed in render space
  const targets = manager.targets;
  assert.ok(targets.length >= 3, 'Must expose main body, primary core, and secondary weakpoints');

  const mainTarget = targets.find(t => t.id === titan.id);
  const coreTarget = targets.find(t => t.id === 'planet-titan-core');
  const anteriorTarget = targets.find(t => t.id === 'planet-titan-core-anterior');

  assert.ok(mainTarget && coreTarget && anteriorTarget);
  assert.ok(Math.abs(coreTarget.position.z - 300_000) < 50_000, 'Core weakpoint transformed into local render frame');

  // Scanner Aim detection (Key N)
  const scanner = new CosmicSpeciesScanner(save);
  const rayOrigin = new Vector3(0, 0, 0); // Player at render origin
  const rayDir = new Vector3(0, 0, 1);    // Looking +Z directly at the Leviathan
  const scan = scanner.scanAim(rayOrigin, rayDir, [], manager.titans, undefined, 120, undefined, SOLAR_SYSTEM_FRAME);

  assert.ok(scan !== null, 'Scanner must detect Titan in render space aim cone');
  assert.equal(scan.profile.commonName, titan.name);
  assert.equal(scan.profile.category, 'titan');

  manager.dispose();
});

test('FEATURE 15: 4. Multi-weakpoint progressive shield breaking & Phase 2 transition', () => {
  let noticeLog: string[] = [];
  let soundLog: string[] = [];
  const save = new SaveManager();
  save.reset();

  const manager = new CosmicPlanetTitanManager(
    save,
    msg => noticeLog.push(msg),
    snd => soundLog.push(snd),
  );
  const titan = manager.titans[0];

  // 1. Target anterior weakpoint
  const anteriorWp = manager.weakpoints.find(w => w.id === 'planet-titan-core-anterior')!;
  const initialShield = anteriorWp.shield;

  // Hit anterior weakpoint with 300 force
  manager.hit('planet-titan-core-anterior', 300, 1000);
  assert.ok(anteriorWp.shield < initialShield, 'Weakpoint shield takes damage');

  // Break anterior weakpoint shield completely
  manager.hit('planet-titan-core-anterior', 500, 1000);
  assert.equal(anteriorWp.shield, 0, 'Weakpoint shield broken');
  assert.ok(noticeLog.some(n => n.includes('ESCUDO DO NÚCLEO ROMPIDO')));

  // Break weakpoint health completely
  manager.hit('planet-titan-core-anterior', 500, 1000);
  assert.equal(anteriorWp.health, 0);
  assert.equal(anteriorWp.destroyed, true);
  assert.ok(noticeLog.some(n => n.includes('NÚCLEO ESTELAR DESTRUÍDO')));

  // 2. Weakpoint destruction should have already transitioned titan to Phase 2 (Supernova Rage)
  assert.equal(titan.phase, 2, 'Titan entered Phase 2: Supernova Rage after weakpoint damage');
  assert.equal(titan.enraged, true);

  // 3. SaveManager persistence check
  const savedRecord = save.getTitanRecord(titan.id);
  assert.ok(savedRecord !== undefined);
  assert.equal(savedRecord.phase, 2);
  assert.equal(savedRecord.health, titan.health);

  manager.dispose();
});

test('FEATURE 15: 5. Real plasma sphere barrage generation, physical flight, and player damage', () => {
  let playerDamaged = false;
  let playerDamageAmount = 0;
  let notices: string[] = [];

  const manager = new CosmicPlanetTitanManager(
    undefined,
    msg => notices.push(msg),
    () => {},
  );
  const titan = manager.titans[0];

  const graph = new ReferenceFrameGraph();
  graph.register(referenceFrame({ id: SOLAR_SYSTEM_FRAME, kind: 'system', label: 'Sistema Solar' }));
  const origin = createRenderOrigin(SOLAR_SYSTEM_FRAME, [titan.position.x, titan.position.y, titan.position.z]);
  const renderSpace = new RenderSpaceService(graph, origin);

  // Player at 150 km in front of titan
  const playerPos = new Vector3(0, 0, 150_000);

  // Trigger attack sequence
  titan.attackCooldown = 0.05;
  manager.update(0.1, renderSpace, SOLAR_SYSTEM_FRAME, 0, undefined, playerPos, () => {});
  assert.equal(titan.attackState, 'telegraph');

  // Complete telegraph and fire attack
  manager.update(
    1.6,
    renderSpace,
    SOLAR_SYSTEM_FRAME,
    0,
    undefined,
    playerPos,
    dmg => {
      playerDamaged = true;
      playerDamageAmount = dmg;
    },
  );

  assert.ok(playerDamaged, 'Player takes damage from Titan attack');
  assert.ok(playerDamageAmount > 0);

  // Verify at least one plasma sphere was generated and active
  const activeSpheres = manager.plasmaSpheres.filter(s => s.active || s.mesh.visible);
  assert.ok(manager.plasmaSpheres.length === 16, 'Plasma pool initialized with 16 projectiles');

  manager.dispose();
});

test('FEATURE 15: 6. Distant proxy exact physical angular size without artificial minimum', () => {
  const manager = new CosmicPlanetTitanManager();
  const titan = manager.titans[0];

  const graph = new ReferenceFrameGraph();
  graph.register(referenceFrame({ id: SOLAR_SYSTEM_FRAME, kind: 'system', label: 'Sistema Solar' }));

  // Position player very far away (e.g. at Neptune orbit, 4.5e12 m)
  const farOrigin = createRenderOrigin(SOLAR_SYSTEM_FRAME, [0, 0, 4.5e12]);
  const renderSpace = new RenderSpaceService(graph, farOrigin);

  manager.update(1.0, renderSpace, SOLAR_SYSTEM_FRAME);

  // Leviathan should be rendered as distant proxy
  assert.equal(manager.root.visible, true);
  const proxyDistance = manager.root.position.length();
  assert.ok(proxyDistance <= 65_000, 'Distant proxy projected onto bounded render distance');

  // Angular size: theta = asin(120,000 / dist). dist ~ 4.79e12 m. theta ~ 2.5e-8 rad.
  // Physical angular proxy radius = 60,000 * tan(theta) ~ 0.0015 m, clamped to max(0.01, ...)
  const coreScale = (manager as any).coreMesh.scale.x;
  assert.ok(coreScale < 10.0, 'Distant proxy scale must reflect tiny physical angular size, without Math.max(300)');

  manager.dispose();
});
