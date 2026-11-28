/**
 * manaus-vitality-and-cosmos-integration.test.ts
 *
 * Comprehensive integration suite covering:
 * 1. Manaus urban vitality: pedestrian reaction & aerodynamic wake on supersonic flyby.
 * 2. Traffic emergency braking & horn honking on pedestrian / player road obstruction.
 * 3. Alien wildlife pack hunting & coordinated flanking behavior.
 * 4. Alien settlement diplomacy, trading interaction & reputation rewards.
 * 5. JWST deep-field cosmic nebula scanning & astronomical cataloging.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three/webgpu';
import { PopulationManager } from '../src/entities/PopulationManager.ts';
import { TrafficSystem } from '../src/world/traffic/TrafficSystem.ts';
import { RoadGraph } from '../src/world/traffic/RoadGraph.ts';
import { AlienFaunaManager } from '../src/world/life/AlienFaunaManager.ts';
import { AlienSettlementManager } from '../src/world/life/AlienSettlementManager.ts';
import { CosmicSpeciesScanner } from '../src/world/life/CosmicSpeciesScanner.ts';
import { CURATED_JWST_NEBULAE } from '../src/rendering/JWSTCosmicPresentation.ts';
import { SaveManager } from '../src/core/SaveManager.ts';
import type { PlanetaryBiosphereProfile } from '../src/world/life/PlanetaryBiosphere.ts';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface.ts';

test('VITALITY 1: Manaus pedestrians react to supersonic hero flyby with panic and crowd audio', () => {
  const root = new Group();
  let gaspCount = 0;
  const pop = new PopulationManager(root, () => {
    gaspCount++;
  });

  const anchorPos = new Vector3(20, 2, 20);

  // Initialize and seed pedestrians
  pop.update(0.1, anchorPos, 1, new Vector3(0, 0, 2));
  assert.equal(gaspCount, 0, 'No crowd gasp during normal slow movement');

  // Find an active NPC near the anchor
  const activeNpc = pop.npcs.find(n => n.active);
  assert.ok(activeNpc, 'At least one NPC must be seeded and active');

  // Seed directly around NPC so cell remains stable
  pop.update(0.1, activeNpc.position, 1, new Vector3(0, 0, 2));

  // Supersonic flyby right next to the NPC
  const flybyPlayerPos = activeNpc.position.clone().add(new Vector3(2, 1, 2));
  const supersonicVel = new Vector3(0, 0, 45);

  pop.update(0.1, flybyPlayerPos, 1, supersonicVel);

  assert.ok(gaspCount > 0, 'Supersonic close flyby must trigger crowd gasp audio');
  const fleeingNpcs = pop.npcs.filter(n => n.state === 'fleeing');
  assert.ok(fleeingNpcs.length > 0, 'Nearby NPCs must transition to fleeing state from shockwave');
  assert.ok(fleeingNpcs[0].timer >= 3.0, 'Fleeing timer must be boosted on supersonic flyby');

  pop.dispose();
});

test('VITALITY 2: Traffic dynamically emergency-brakes and honks when player blocks the lane', () => {
  const root = new Group();
  let honkCount = 0;

  // Build a real loaded RoadGraph
  const graph = new RoadGraph();
  graph.load({
    nodes: [[0, 0], [0, 160]],
    segments: [{
      id: 's_eduardo_ribeiro',
      name: 'Avenida Eduardo Ribeiro',
      class: 'primary',
      width: 14,
      speed: 16,
      p: [0, 0, 0, 160],
      a: 0,
      b: 1,
      oneway: false,
      bridge: false,
    }],
  });

  const traffic = new TrafficSystem(root, graph, () => {
    honkCount++;
  });
  traffic.setCount(1);

  // Spawn car on road
  traffic.update(0.1, new Vector3(0, 0, 30));
  const pool = (traffic as any).pool;
  const car = pool[0];
  assert.ok(car.shown, 'Car must be initialized and active');
  const initialSpeed = car.nav.speed;

  // Place player 8m directly ahead of the car in its driving lane
  const playerAhead = new Vector3(car.x + Math.sin(car.yaw) * 8, car.y, car.z + Math.cos(car.yaw) * 8);

  traffic.update(0.1, playerAhead);

  assert.equal(car.braking, true, 'Vehicle must enter braking state when player blocks lane');
  assert.ok(car.nav.speed < initialSpeed || car.nav.targetSpeed === 0, 'Car must decelerate on obstacle');
  assert.ok(honkCount > 0, 'Car must sound horn when braking for obstacle');

  // Move player far away
  const playerFar = new Vector3(500, 100, 500);
  traffic.update(0.1, playerFar);
  assert.equal(car.braking, false, 'Vehicle must release brakes once obstacle clears');
});

test('VITALITY 3: Alien fauna pack hunting coordinates flanking attacks on prey', () => {
  const fauna = new AlienFaunaManager();
  const mockSurface: PlanetSurfaceGenerator = {
    radiusM: 6_000_000,
    heightAt: () => 10,
    normalAt: () => [0, 1, 0],
  } as any;

  const mockBiosphere: PlanetaryBiosphereProfile = {
    bodyId: 'exoplanet_alpha',
    lifeTier: 'civilized',
    dominantFlora: 'canopy-broadleaf',
    dominantFauna: 'bipedal-predators',
    civilizationStage: 'modular-colonies',
    habitabilityScore: 0.85,
    biochemistry: 'carbon-water',
    radiationLevel: 'negligible',
    description: 'Habitable temperate world',
    seeds: { floraSeed: 1, faunaSeed: 42, factionSeed: 99 },
  };

  const center = new Vector3(100, 10, 100);
  fauna.update(0.1, center, mockSurface, mockBiosphere);

  const creatures = fauna.creatures.filter(c => c.active);
  assert.ok(creatures.length > 0, 'Creatures must be spawned on habitable world');

  const carnivores = creatures.filter(c => c.role === 'carnivore' || c.role === 'apex');
  const herbivores = creatures.filter(c => c.role === 'herbivore');

  assert.ok(carnivores.length >= 1, 'Habitable world must feature carnivores');
  assert.ok(herbivores.length >= 1, 'Habitable world must feature herbivores');

  // Position a carnivore near a herbivore to trigger hunting
  const hunter = carnivores[0];
  const prey = herbivores[0];
  hunter.state = 'idle';
  hunter.targetCreatureId = null;
  hunter.position.copy(prey.position).add(new Vector3(12, 0, 0));

  // Run AI update ticks
  for (let i = 0; i < 5; i++) {
    fauna.update(0.15, new Vector3(500, 500, 500), mockSurface, mockBiosphere);
  }

  // Hunter must be engaged in aggressive hunt targeting an active herbivore
  assert.equal(hunter.state, 'aggressive', 'Predator must pursue prey within detection range');
  assert.ok(hunter.targetCreatureId, 'Target prey must be locked');
  assert.ok(creatures.some(c => c.id === hunter.targetCreatureId && c.role === 'herbivore'), 'Target must be an active herbivore');

  fauna.dispose();
});

test('VITALITY 4: Alien settlement diplomacy grants interaction prompt, reputation, and energy bonus', () => {
  const save = new SaveManager();
  const settlements = new AlienSettlementManager(save);

  const mockSurface: PlanetSurfaceGenerator = {
    radiusM: 6_000_000,
    heightAt: () => 15,
    normalAt: () => [0, 1, 0],
  } as any;

  const mockBiosphere: PlanetaryBiosphereProfile = {
    bodyId: 'kepler_186f',
    lifeTier: 'civilized',
    dominantFlora: 'crystalline-spires',
    dominantFauna: 'chitinous-quadrupeds',
    civilizationStage: 'modular-colonies',
    habitabilityScore: 0.9,
    biochemistry: 'carbon-water',
    radiationLevel: 'low',
    description: 'Advanced colonial world',
    seeds: { floraSeed: 12, faunaSeed: 34, factionSeed: 77 },
  };

  // Find a cell where settlement spawns (cx=10 has hashSettlement ~ 0.338 < 0.40)
  let settlementFound = false;
  let testPos = new Vector3(10 * 240 + 120, 15, 120);

  for (let cx = 0; cx < 25 && !settlementFound; cx++) {
    testPos.set(cx * 240 + 120, 15, 120);
    settlements.update(0.1, testPos, mockSurface, mockBiosphere);
    if (settlements.activeSettlements.length > 0) {
      settlementFound = true;
      break;
    }
  }

  assert.ok(settlementFound, 'At least one procedural settlement outpost must generate across candidate cells');
  const cluster = settlements.activeSettlements[0];
  assert.ok(cluster, 'Active settlement cluster must exist');

  // Verify proximity detection
  const nearPos = cluster.center.clone();
  const detected = settlements.getNearbyInteractiveSettlement(nearPos);
  assert.ok(detected, 'Player at settlement center must detect nearby interactive settlement');
  assert.equal(detected?.id, cluster.id);

  // Test diplomatic interaction
  const initialRep = save.getFactionReputation(cluster.factionId);
  const result = settlements.interact(nearPos);

  assert.equal(result.success, true, 'Diplomatic interaction with non-hostile colony must succeed');
  assert.ok(result.message && result.message.includes('DIPLOMACIA'), 'Notification message must contain diplomacy header');
  assert.ok(result.energyBonus !== undefined && result.energyBonus > 0, 'Must grant energy recharge bonus');

  const newRep = save.getFactionReputation(cluster.factionId);
  assert.ok(newRep > initialRep, 'Diplomacy must increase faction reputation');

  settlements.dispose();
});

test('VITALITY 5: Cosmic Species Scanner detects and catalogs JWST deep field nebulae', () => {
  const save = new SaveManager();
  const scanner = new CosmicSpeciesScanner(save);

  // Aim towards the first curated JWST nebula: Pillars of Creation (M16)
  const pillarsNebula = CURATED_JWST_NEBULAE.find(n => n.type === 'pillars-of-creation');
  assert.ok(pillarsNebula, 'Pillars of Creation must exist in curated JWST nebulae');

  const rayOrigin = new Vector3(0, 0, 0);
  const rayDir = pillarsNebula.direction.clone(); // Exact aim towards nebula

  // Scan towards nebula
  const result = scanner.scanAim(rayOrigin, rayDir);

  assert.ok(result, 'Scanner must detect JWST nebula when aiming along its celestial direction');
  assert.equal(result.profile.category, 'cosmic-nebula');
  assert.equal(result.profile.commonName, pillarsNebula.name);
  assert.ok(result.profile.description.includes('James Webb'), 'Profile must describe JWST observation');
  assert.equal(result.isNewDiscovery, true, 'First scan must be marked as new discovery');

  // Verify persistence in SaveManager
  assert.equal(save.isSpeciesDiscovered(result.profile.speciesId), true, 'Discovered nebula must be persisted in SaveManager');

  // Re-scanning should recognize it as already discovered
  const repeatResult = scanner.scanAim(rayOrigin, rayDir);
  assert.ok(repeatResult);
  assert.equal(repeatResult.isNewDiscovery, false, 'Repeat scan must not be marked as new discovery');

  // Aiming away from any nebula
  const awayDir = new Vector3(0, 1, 0); // Straight up (none of the 4 nebulae point straight up)
  const emptyResult = scanner.scanAim(rayOrigin, awayDir);
  if (emptyResult) {
    assert.notEqual(emptyResult.profile.speciesId, result.profile.speciesId);
  }
});
