import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { AlienFaunaManager, FAUNA_AI_TICK_SEC, FAUNA_CAPACITY } from '../src/world/life/AlienFaunaManager';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

describe('AlienFauna Ecological AI (VIVO-07)', () => {
  const earthBody: CelestialBody = {
    id: 'earth',
    name: 'Terra',
    frameId: 'earth-frame',
    equatorialRadiusM: 6378137,
    polarRadiusM: 6356752,
    massKg: 5.972e24,
  };
  const earthBiosphere = generatePlanetaryBiosphere(earthBody, SOLAR_BODY_PROFILES.earth, 1337n);

  const fakeSurface: PlanetSurfaceGenerator = {
    body: { semiMajorAxisM: 6378137, flattening: 0.0033528 },
    radiusM: 6378137,
    heightAt: (_direction: Vec3) => 50,
    normalEnu: (_direction: Vec3, out: Vec3) => {
      out[0] = 0;
      out[1] = 1;
      out[2] = 0;
    },
    colourAt: (_direction: Vec3, out: [number, number, number]) => {
      out[0] = 0.2;
      out[1] = 0.5;
      out[2] = 0.2;
    },
  };

  it('T_VIVO07_01_ECOLOGICAL_ROLES_AND_PYRAMID', () => {
    const manager = new AlienFaunaManager();
    const playerPos = new Vector3(0, 50, 0);

    manager.update(0.016, playerPos, fakeSurface, earthBiosphere);

    const active = manager.targets;
    assert.ok(active.length > 0);

    const herbivores = active.filter(c => c.role === 'herbivore');
    const carnivores = active.filter(c => c.role === 'carnivore');
    const apex = active.filter(c => c.role === 'apex');

    assert.ok(herbivores.length > 0, 'Must contain herbivores');
    assert.ok(carnivores.length > 0, 'Must contain carnivores');
    assert.ok(apex.length > 0, 'Must contain apex predators');
    assert.ok(herbivores.length > carnivores.length, 'Ecological pyramid: herbivores must outnumber predators');

    manager.dispose();
  });

  it('T_VIVO07_02_PREDATION_HUNTING_AND_STRIKE', () => {
    const manager = new AlienFaunaManager();
    const playerPos = new Vector3(500, 50, 500); // Far away player

    manager.update(0.016, playerPos, fakeSurface, earthBiosphere);

    const predator = manager.creatures.find(c => c.active && (c.role === 'carnivore' || c.role === 'apex'));
    const herbivore = manager.creatures.find(c => c.active && c.role === 'herbivore');

    assert.ok(predator, 'Predator must exist');
    assert.ok(herbivore, 'Herbivore must exist');

    // Place predator near herbivore (within 15m)
    predator.position.copy(herbivore.position).add(new Vector3(10, 0, 0));
    predator.state = 'idle';
    predator.timer = 0;

    // Trigger AI tick
    manager.update(FAUNA_AI_TICK_SEC + 0.05, playerPos, fakeSurface, earthBiosphere);

    // Predator must detect herbivore and switch to aggressive
    assert.strictEqual(predator.state, 'aggressive', 'Predator must enter aggressive hunting state');
    assert.ok(predator.targetCreatureId, 'Predator must lock onto a target ID');
    const targetPrey = manager.creatures.find(c => c.id === predator.targetCreatureId);
    assert.ok(targetPrey, 'Target prey must exist');
    assert.strictEqual(targetPrey.role, 'herbivore', 'Target prey must be a herbivore');

    // Place predator within strike distance (< 2.5m)
    predator.position.copy(targetPrey.position).add(new Vector3(1.5, 0, 0));
    const initialPreyHealth = targetPrey.health;

    // Trigger strike tick
    manager.update(FAUNA_AI_TICK_SEC + 0.05, playerPos, fakeSurface, earthBiosphere);

    assert.ok(targetPrey.health < initialPreyHealth, 'Prey health must decrease from predator bite');
    assert.strictEqual(targetPrey.state, 'knocked', 'Prey must be knocked by predator strike');
    assert.strictEqual(predator.state, 'idle', 'Predator enters resting state after feeding');

    manager.dispose();
  });

  it('T_VIVO07_03_HERD_ALARM_PROPAGATION', () => {
    const manager = new AlienFaunaManager();
    const playerPos = new Vector3(500, 50, 500);

    manager.update(0.016, playerPos, fakeSurface, earthBiosphere);

    const herbivores = manager.creatures.filter(c => c.active && c.role === 'herbivore');
    assert.ok(herbivores.length >= 3);

    const h1 = herbivores[0];
    const h2 = herbivores[1];
    const h3 = herbivores[2];

    // Position h1 and h2 close (10m apart), h3 far away (80m)
    h1.position.set(100, 50, 100);
    h1.state = 'idle';
    h2.position.set(108, 50, 102);
    h2.state = 'idle';
    h3.position.set(200, 50, 200);
    h3.state = 'idle';

    // Strike h1 with Dr-Manaus power
    manager.hit(h1.id, 50, 20);
    assert.strictEqual(h1.state, 'knocked');

    // Trigger AI tick
    manager.update(FAUNA_AI_TICK_SEC + 0.05, playerPos, fakeSurface, earthBiosphere);

    // Nearby h2 should be alerted and fleeing
    assert.strictEqual(h2.state, 'fleeing', 'Nearby herd member must be alerted and flee');

    // Distant h3 should remain undisturbed
    assert.notStrictEqual(h3.state, 'fleeing', 'Distant herbivore outside alarm radius must not panic');

    manager.dispose();
  });

  it('T_VIVO07_04_HERD_FLOCKING_SEPARATION_AND_COHESION', () => {
    const manager = new AlienFaunaManager();
    const playerPos = new Vector3(500, 50, 500);

    manager.update(0.016, playerPos, fakeSurface, earthBiosphere);

    const herbivores = manager.creatures.filter(c => c.active && c.role === 'herbivore');
    assert.ok(herbivores.length >= 2);

    const h1 = herbivores[0];
    const h2 = herbivores[1];

    // Place them very close (1.5m < 3.5m threshold)
    h1.morphology = h2.morphology;
    h1.position.set(50, 50, 50);
    h2.position.set(51.5, 50, 50);
    const initialDist = h1.position.distanceTo(h2.position);

    // Update AI tick
    manager.update(FAUNA_AI_TICK_SEC + 0.05, playerPos, fakeSurface, earthBiosphere);

    const postDist = h1.position.distanceTo(h2.position);
    assert.ok(postDist > initialDist, 'Separation force must push crowded herd members apart');

    manager.dispose();
  });

  it('T_VIVO07_05_DETERMINISTIC_AI_WANDER', () => {
    const m1 = new AlienFaunaManager();
    const m2 = new AlienFaunaManager();
    const playerPos = new Vector3(100, 50, 100);

    m1.update(0.016, playerPos, fakeSurface, earthBiosphere);
    m2.update(0.016, playerPos, fakeSurface, earthBiosphere);

    // Run 5 AI ticks
    for (let i = 0; i < 5; i++) {
      m1.update(FAUNA_AI_TICK_SEC + 0.01, playerPos, fakeSurface, earthBiosphere);
      m2.update(FAUNA_AI_TICK_SEC + 0.01, playerPos, fakeSurface, earthBiosphere);
    }

    // Creature states and positions should match between runs
    for (let i = 0; i < FAUNA_CAPACITY; i++) {
      const c1 = m1.creatures[i];
      const c2 = m2.creatures[i];
      assert.strictEqual(c1.state, c2.state, `Creature ${i} state must match deterministically`);
      assert.strictEqual(c1.role, c2.role, `Creature ${i} role must match deterministically`);
      assert.ok(c1.position.distanceTo(c2.position) < 1e-4, `Creature ${i} positions must match`);
    }

    m1.dispose();
    m2.dispose();
  });
});
