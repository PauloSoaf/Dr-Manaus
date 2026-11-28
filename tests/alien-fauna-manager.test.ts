import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { AlienFaunaManager, FAUNA_CAPACITY, FAUNA_AI_TICK_SEC } from '../src/world/life/AlienFaunaManager';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

describe('AlienFaunaManager (VIVO-04)', () => {
  const earthBody: CelestialBody = {
    id: 'earth',
    name: 'Terra',
    frameId: 'earth-frame',
    equatorialRadiusM: 6378137,
    polarRadiusM: 6356752,
    massKg: 5.972e24,
  };
  const earthBiosphere = generatePlanetaryBiosphere(earthBody, SOLAR_BODY_PROFILES.earth, 1337n);

  const moonBody: CelestialBody = {
    id: 'moon',
    name: 'Lua',
    frameId: 'moon-frame',
    equatorialRadiusM: 1737400,
    massKg: 7.342e22,
  };
  const moonBiosphere = generatePlanetaryBiosphere(moonBody, SOLAR_BODY_PROFILES.moon, 1337n);

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

  it('T_VIVO04_01: Initialization sets up creature pool and zero initial targets', () => {
    const manager = new AlienFaunaManager();
    assert.strictEqual(manager.creatures.length, FAUNA_CAPACITY);
    assert.strictEqual(manager.targets.length, 0, 'No targets should be active before update');
    assert.ok(manager.root.children.length >= 5, 'Must contain instanced morphology meshes');
    manager.dispose();
  });

  it('T_VIVO04_02: Sterile worlds suppress all creature spawning', () => {
    const manager = new AlienFaunaManager();
    const playerPos = new Vector3(0, 50, 0);

    manager.update(0.016, playerPos, fakeSurface, moonBiosphere);

    assert.strictEqual(manager.targets.length, 0, 'Sterile worlds must not spawn creatures');
    manager.dispose();
  });

  it('T_VIVO04_03: Habitable worlds spawn creatures with kind creature and valid elevation', () => {
    const manager = new AlienFaunaManager();
    const playerPos = new Vector3(0, 50, 0);

    manager.update(0.016, playerPos, fakeSurface, earthBiosphere);

    const targets = manager.targets;
    assert.ok(targets.length > 0, `Expected active targets, got ${targets.length}`);
    for (const t of targets) {
      assert.strictEqual(t.kind, 'creature');
      assert.strictEqual(t.active, true);
      assert.ok(Number.isFinite(t.position.x));
      assert.ok(Number.isFinite(t.position.y));
      assert.ok(Number.isFinite(t.position.z));
      assert.ok(t.radius >= 1.0);
    }
    manager.dispose();
  });

  it('T_VIVO04_04: Economic AI tick triggers fleeing on close player proximity', () => {
    const manager = new AlienFaunaManager();
    // Center in cell [0, 0]
    const playerPos = new Vector3(80, 50, 80);
    manager.update(0.016, playerPos, fakeSurface, earthBiosphere);

    const firstCreature = manager.targets[0];
    assert.ok(firstCreature);

    // Move player right next to the creature (within 8m)
    playerPos.copy(firstCreature.position).add(new Vector3(3, 0, 3));

    // Update with dt < AI tick -> should NOT trigger immediately
    manager.update(0.01, playerPos, fakeSurface, earthBiosphere);
    assert.notStrictEqual(firstCreature.state, 'fleeing', 'Small dt should not trigger AI update before accumulator fills');

    // Update with dt >= FAUNA_AI_TICK_SEC -> should trigger AI and flee
    manager.update(FAUNA_AI_TICK_SEC + 0.05, playerPos, fakeSurface, earthBiosphere);
    assert.strictEqual(firstCreature.state, 'fleeing', 'Proximity AI must trigger fleeing behavior');

    manager.dispose();
  });

  it('T_VIVO04_05: Combat hit damages, knocks, and defeats creatures', () => {
    const manager = new AlienFaunaManager();
    const playerPos = new Vector3(0, 50, 0);
    manager.update(0.016, playerPos, fakeSurface, earthBiosphere);

    const creature = manager.targets[0];
    assert.ok(creature);
    const initialHealth = creature.health;

    // Non-lethal hit
    const hitSuccess = manager.hit(creature.id, 50, 30);
    assert.strictEqual(hitSuccess, true);
    assert.strictEqual(creature.state, 'knocked');
    assert.strictEqual(creature.health, initialHealth - 30);
    assert.ok(creature.velocity.y > 0, 'Knocked creature must receive upward impulse');

    // Lethal hit
    const lethalSuccess = manager.hit(creature.id, 100, 200);
    assert.strictEqual(lethalSuccess, true);
    assert.strictEqual(creature.state, 'defeated');
    assert.strictEqual(creature.active, false);

    // Target must no longer be in active targets
    assert.ok(!manager.targets.some(t => t.id === creature.id));

    // Reconstruct restores defeated creature
    const restored = manager.reconstruct(creature.position, 100);
    assert.strictEqual(restored, 1);
    assert.strictEqual(creature.active, true);
    assert.strictEqual(creature.state, 'idle');

    manager.dispose();
  });
});
