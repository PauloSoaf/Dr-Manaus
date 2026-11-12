import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { CosmicAnomaliesAndRuinsManager } from '../src/world/life/CosmicAnomaliesAndRuinsManager';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { SaveManager } from '../src/core/SaveManager';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

describe('CosmicAnomaliesAndRuinsManager (VIVO-15)', () => {
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

  const ancientWorldBiosphere = {
    ...earthBiosphere,
    bodyId: 'procedural-ancient-world-42',
    civilizationStage: 'ancient-ruins-guardians' as const,
    lifeTier: 'civilized' as const,
    habitabilityScore: 0.85,
  };

  const fakeSurface: PlanetSurfaceGenerator = {
    body: { semiMajorAxisM: 6378137, flattening: 0.0033528 },
    radiusM: 6378137,
    heightAt: (_direction: Vec3) => 60,
    normalEnu: (_direction: Vec3, out: Vec3) => {
      out[0] = 0;
      out[1] = 1;
      out[2] = 0;
    },
    colourAt: (_direction: Vec3, out: [number, number, number]) => {
      out[0] = 0.3;
      out[1] = 0.4;
      out[2] = 0.3;
    },
  };

  it('T_VIVO15_01_INITIALIZATION_AND_MESH_SETUP', () => {
    const save = new SaveManager();
    const manager = new CosmicAnomaliesAndRuinsManager(save);

    assert.strictEqual(manager.ruins.length, 0);
    assert.strictEqual(manager.colossi.length, 0);
    assert.strictEqual(manager.targets.length, 0);
    assert.ok(manager.root.children.length >= 5, 'Must have sanctuary, obelisk, relic and colossus meshes');

    manager.dispose();
  });

  it('T_VIVO15_02_STERILE_WORLDS_SUPPRESSION', () => {
    const save = new SaveManager();
    const manager = new CosmicAnomaliesAndRuinsManager(save);

    manager.update(0.016, new Vector3(0, 6378197, 0), fakeSurface, moonBiosphere);

    assert.strictEqual(manager.ruins.length, 0, 'Sterile world must have 0 ruins');
    assert.strictEqual(manager.colossi.length, 0, 'Sterile world must have 0 colossi');
    assert.strictEqual(manager.targets.length, 0);

    manager.dispose();
  });

  it('T_VIVO15_03_ANCIENT_RUINS_AND_COLOSSUS_SPAWN', () => {
    const save = new SaveManager();
    const manager = new CosmicAnomaliesAndRuinsManager(save);

    manager.update(0.016, new Vector3(0, 6378197, 0), fakeSurface, ancientWorldBiosphere);

    assert.ok(manager.ruins.length > 0, 'Ancient world must spawn ruins');
    assert.ok(manager.colossi.length > 0, 'Ancient world must spawn guardian colossi');
    assert.ok(manager.targets.length > 0, 'Ruins and colossi must be registered as targets');

    const firstColossus = manager.colossi[0];
    assert.strictEqual(firstColossus.maxHealth, 1200);
    assert.strictEqual(firstColossus.health, 1200);
    assert.strictEqual(firstColossus.phase, 1);
    assert.strictEqual(firstColossus.kind, 'creature');

    manager.dispose();
  });

  it('T_VIVO15_04_FIRST_CONTACT_AND_DISCOVERY', () => {
    const save = new SaveManager();
    let notificationReceived = '';
    const manager = new CosmicAnomaliesAndRuinsManager(
      save,
      msg => { notificationReceived = msg; },
    );

    manager.update(0.016, new Vector3(0, 6378197, 0), fakeSurface, ancientWorldBiosphere);

    const firstRuin = manager.ruins[0];
    assert.strictEqual(save.isRuinDiscovered(firstRuin.id), false);

    // Player approaches within 20m of ruin
    manager.update(0.016, firstRuin.position.clone(), fakeSurface, ancientWorldBiosphere);

    assert.strictEqual(save.isRuinDiscovered(firstRuin.id), true, 'Approaching ruin must mark it discovered');
    assert.ok(notificationReceived.includes('PRIMEIRO CONTATO'));
    assert.strictEqual(save.getFactionReputation('guardians'), 20);

    manager.dispose();
  });

  it('T_VIVO15_05_COLOSSUS_COMBAT_ENRAGE_PHASE_AND_DEFEAT', () => {
    const save = new SaveManager();
    let notificationReceived = '';
    const manager = new CosmicAnomaliesAndRuinsManager(
      save,
      msg => { notificationReceived = msg; },
    );

    manager.update(0.016, new Vector3(0, 6378197, 0), fakeSurface, ancientWorldBiosphere);
    const colossus = manager.colossi[0];

    // 1. Initial hit deals standard damage
    const hitOk = manager.hit(colossus.id, 200);
    assert.strictEqual(hitOk, true);
    assert.strictEqual(colossus.health, 1000);
    assert.strictEqual(colossus.phase, 1);

    // 2. Damage below 50% triggers Phase 2 (enrage + shields active)
    manager.hit(colossus.id, 500); // 1000 - 500 = 500 <= 600
    manager.update(0.016, colossus.position.clone(), fakeSurface, ancientWorldBiosphere);

    assert.strictEqual(colossus.phase, 2, 'Colossus at <= 50% HP must enter Phase 2');
    assert.strictEqual(colossus.shieldActive, true, 'Phase 2 activates defensive shields');

    // 3. Shield halves damage
    manager.hit(colossus.id, 200); // Effective damage = 100 -> health = 400
    assert.strictEqual(colossus.health, 400);

    // 4. Lethal blow defeats colossus
    manager.hit(colossus.id, 800); // 400 - 400 = 0
    assert.strictEqual(colossus.health, 0);
    assert.strictEqual(colossus.state, 'defeated');
    assert.strictEqual(save.isColossusDefeated(colossus.id), true, 'Defeat must be recorded in SaveManager');
    assert.ok(save.getFactionReputation('guardians') >= 35, 'Defeat awards significant reputation');
    assert.ok(notificationReceived.includes('COLOSSO DERROTADO'));

    manager.dispose();
  });

  it('T_VIVO15_06_RECONSTRUCTION_OF_RUINS', () => {
    const save = new SaveManager();
    const manager = new CosmicAnomaliesAndRuinsManager(save);

    manager.update(0.016, new Vector3(0, 6378197, 0), fakeSurface, ancientWorldBiosphere);
    const ruin = manager.ruins[0];

    // Damage ruin structure
    manager.hit(ruin.id, 350);
    assert.strictEqual(ruin.health, 150);

    // Reconstruct power repairs it
    const restored = manager.reconstruct(ruin.position, 25);
    assert.strictEqual(restored, 1);
    assert.strictEqual(ruin.health, 500, 'Reconstruct must fully restore ruin health');

    manager.dispose();
  });
});
