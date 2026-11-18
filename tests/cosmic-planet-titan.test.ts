import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { CosmicPlanetTitanManager } from '../src/world/life/CosmicPlanetTitan.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { RenderSpaceService } from '../src/world/spatial/RenderSpaceService.ts';
import { createRenderOrigin } from '../src/world/spatial/RenderOrigin.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from '../src/world/travel/UniversalTargetCatalog.ts';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver.ts';
import { SolarSystem, SOLAR_SYSTEM_FRAME } from '../src/world/celestial/SolarSystem.ts';

test('COSMIC-TITAN: Initialization spawns planet-scale titan with 11.2 AU deep solar orbit beyond Saturn', () => {
  let soundPlayed = '';
  let notice = '';
  const manager = new CosmicPlanetTitanManager(
    undefined,
    msg => { notice = msg; },
    snd => { soundPlayed = snd; },
  );

  assert.ok(manager.titans.length >= 1);
  const titan = manager.titans[0];
  assert.ok(titan.radiusM >= 50_000, 'Titan must have planetary scale (>= 50 km)');
  assert.equal(titan.radiusM, 120_000, '120 km radius astral leviathan');
  assert.equal(titan.active, true);
  // Orbit beyond Saturn: Saturn is ~1.43e12 m (9.54 AU). Titan is 11.2 AU (~1.675e12 m).
  assert.ok(titan.orbitRadiusM > 1.5e12, 'Orbit radius must be beyond Saturn (> 1.5e12 m)');
  assert.ok(titan.maxHealth + titan.maxShield >= 3_000_000, 'Effective cosmic health pool balanced');

  const targets = manager.targets;
  assert.ok(targets.length >= 2, 'Must include titan body and core weak spot');
  assert.ok(targets.some(t => t.id === titan.id));
  assert.ok(targets.some(t => t.id === 'planet-titan-core'));

  manager.dispose();
});

test('COSMIC-TITAN: RenderSpaceService floating origin and system frame isolation', () => {
  const manager = new CosmicPlanetTitanManager();
  const titan = manager.titans[0];

  const graph = new ReferenceFrameGraph();
  graph.register(referenceFrame({ id: SOLAR_SYSTEM_FRAME, kind: 'system', label: 'Sistema Solar' }));
  graph.register(referenceFrame({ id: 'andromeda/barycentric', kind: 'system', label: 'Andromeda' }));

  const origin = createRenderOrigin(SOLAR_SYSTEM_FRAME, [titan.position.x, titan.position.y, titan.position.z]);
  const renderSpace = new RenderSpaceService(graph, origin);

  // 1. In Andromeda, solar titan must be culled
  manager.update(1.0, renderSpace, 'andromeda/barycentric');
  assert.equal(manager.root.visible, false, 'Titan must not render when player is outside Solar System');

  // 2. In Solar System close to player (at origin), titan renders detailed mesh
  manager.update(0.0, renderSpace, SOLAR_SYSTEM_FRAME);
  assert.equal(manager.root.visible, true, 'Titan must render when player is in Solar System');
  assert.ok(Math.hypot(manager.root.position.x, manager.root.position.y, manager.root.position.z) < 50_000);

  // 3. From Earth (far away, > 1e11 m), proxy LOD is used at bounded distance (60,000 m)
  const earthOrigin = createRenderOrigin(SOLAR_SYSTEM_FRAME, [0, 0, 1.496e11]);
  const renderSpaceEarth = new RenderSpaceService(graph, earthOrigin);
  manager.update(1.0, renderSpaceEarth, SOLAR_SYSTEM_FRAME);
  assert.equal(manager.root.visible, true);
  const proxyDist = Math.hypot(manager.root.position.x, manager.root.position.y, manager.root.position.z);
  assert.ok(proxyDist <= 65_000, 'Distant titan must be projected onto bounded proxy distance <= 65 km');

  manager.dispose();
});

test('COSMIC-TITAN: Deterministic roar timer without Math.random', () => {
  const manager1 = new CosmicPlanetTitanManager();
  const manager2 = new CosmicPlanetTitanManager();

  // Advance both managers identically
  const cam = new Vector3(0, 0, 0);
  manager1.update(10.0, cam);
  manager2.update(10.0, cam);

  assert.equal(manager1.titans[0].roarTimer, manager2.titans[0].roarTimer, 'Roar timer must be deterministic');

  manager1.dispose();
  manager2.dispose();
});

test('COSMIC-TITAN: Balanced combat, weak spots, shield and phase 2 transition', () => {
  let soundPlayed = '';
  let notice = '';
  const manager = new CosmicPlanetTitanManager(
    undefined,
    msg => { notice = msg; },
    snd => { soundPlayed = snd; },
  );
  const titan = manager.titans[0];
  const initialShield = titan.shield;
  const initialHealth = titan.health;

  // 1. Weak spot hit on core deals 3x damage and bypasses 50% shield
  const hitCore = manager.hit('planet-titan-core', 50, 1000); // 50 * 1000 * 3 = 150,000
  assert.equal(hitCore, true);
  assert.ok(titan.shield < initialShield, 'Shield should take damage');
  assert.ok(titan.health < initialHealth, 'Core hit must penetrate shield to deal health damage');
  assert.ok(notice.includes('PONTO FRACO'), 'Weak spot notification emitted');

  // 2. Sustained combat breaks shield and enrages titan
  manager.hit(titan.id, 2_000_000, 1000);
  assert.equal(titan.shield, 0, 'Shield broken');
  assert.equal(titan.enraged, true, 'Titan enrages on shield break');

  // 3. Drop health below 50% triggers Phase 2
  manager.hit(titan.id, 1_500_000, 1000);
  assert.equal(titan.phase, 2, 'Titan entered Phase 2: Supernova Rage');

  // 4. Fatal hit transitions to Phase 3 (Dormant)
  manager.hit(titan.id, 5_000_000, 1000);
  assert.equal(titan.health, 0);
  assert.equal(titan.active, false);
  assert.equal(titan.phase, 3);
  assert.equal(soundPlayed, 'planet-crack');

  manager.dispose();
});

test('COSMIC-TITAN: UniversalTargetCatalog and Resolver navigability contract', () => {
  const catalog = new UniversalTargetCatalog();
  const solarSystem = new SolarSystem();
  const context = {
    activeSystem: solarSystem,
    solarSystem,
    address: SOLAR_TARGET_ADDRESS,
    playerSystemPositionM: () => [0, 0, 1.496e11] as [number, number, number],
  };

  const resolver = new UniversalTargetResolver(catalog, context);
  const titanTarget = catalog.find('titan-astral-leviathan-01');
  assert.ok(titanTarget, 'Leviathan must exist in UniversalTargetCatalog');

  const resolved = resolver.resolve(titanTarget);
  assert.equal(resolved.valid, true, 'Resolved target must be valid');
  assert.equal(resolved.materialized, true, 'Resolved target must be materialized in solar system');
  assert.equal(resolved.domain, 'system');
  assert.equal(resolved.travelCapability, 'solar', 'Solar autopilot must be available');
  assert.ok(resolved.distanceM !== undefined && resolved.distanceM > 1e11, 'Calculated physical distance in metres');
  assert.equal(resolved.logicalPosition?.frame, 'solar-system');
});
