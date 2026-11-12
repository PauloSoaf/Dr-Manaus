import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { AlienSettlementManager, SETTLEMENT_TICK_SEC } from '../src/world/life/AlienSettlementManager';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { SaveManager } from '../src/core/SaveManager';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

describe('AlienSettlementManager (VIVO-08 & VIVO-09)', () => {
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

  it('T_VIVO08_01_INITIALIZATION_AND_POOLS', () => {
    const save = new SaveManager();
    const manager = new AlienSettlementManager(save);

    assert.ok(manager.structures.length > 0);
    assert.ok(manager.inhabitants.length > 0);
    assert.strictEqual(manager.targets.length, 0);
    assert.ok(manager.root.children.length >= 5, 'Must contain structure and inhabitant meshes');

    manager.dispose();
  });

  it('T_VIVO08_02_STERILE_WORLDS_SUPPRESSION', () => {
    const save = new SaveManager();
    const manager = new AlienSettlementManager(save);
    const playerPos = new Vector3(0, 50, 0);

    manager.update(0.016, playerPos, fakeSurface, moonBiosphere);

    assert.strictEqual(manager.activeSettlements.length, 0, 'Moon must not spawn alien settlements');
    assert.strictEqual(manager.targets.length, 0);

    manager.dispose();
  });

  it('T_VIVO08_03_SETTLEMENT_SPAWN_AND_MODULAR_STRUCTURES', () => {
    const save = new SaveManager();
    const manager = new AlienSettlementManager(save);

    // Scan through coordinate cells until a populated settlement cluster is encountered
    let spawned = false;
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        const playerPos = new Vector3(x * 240 + 120, 50, z * 240 + 120);
        manager.update(0.016, playerPos, fakeSurface, earthBiosphere);
        if (manager.activeSettlements.length > 0) {
          spawned = true;
          break;
        }
      }
      if (spawned) break;
    }

    assert.ok(spawned, 'Civilized biosphere must generate at least one modular settlement outpost');
    const settlement = manager.activeSettlements[0];
    assert.ok(settlement);
    assert.ok(settlement.structureCount >= 4, 'Must contain multiple modular structures');
    assert.ok(settlement.inhabitantCount >= 4, 'Must contain resident inhabitants');
    assert.ok(manager.targets.length > 0, 'Must expose structures and inhabitants to targeting');

    manager.dispose();
  });

  it('T_VIVO09_01_FACTION_DISPOSITION_AND_SALUTE', () => {
    const save = new SaveManager();
    save.reset();

    const manager = new AlienSettlementManager(save);

    // Locate a settlement
    for (let x = 0; x < 5; x++) {
      const playerPos = new Vector3(x * 240 + 120, 50, 120);
      manager.update(0.016, playerPos, fakeSurface, earthBiosphere);
      if (manager.activeSettlements.length > 0) break;
    }

    assert.ok(manager.activeSettlements.length > 0);
    const settlement = manager.activeSettlements[0];
    const factionId = settlement.factionId;

    // Set reputation to friendly
    save.modifyFactionReputation(factionId, 50);

    // Move player right into the settlement
    const playerPos = settlement.center.clone().add(new Vector3(5, 0, 5));
    manager.update(SETTLEMENT_TICK_SEC + 0.05, playerPos, fakeSurface, earthBiosphere);

    const inhabitant = manager.inhabitants.find(i => i.active && i.factionId === factionId);
    assert.ok(inhabitant);
    assert.strictEqual(inhabitant.state, 'saluting', 'Friendly inhabitants must salute Dr-Manaus on approach');

    manager.dispose();
  });

  it('T_VIVO09_02_COMBAT_HIT_REPUTATION_AND_MOBILIZATION', () => {
    const save = new SaveManager();
    save.reset();

    const manager = new AlienSettlementManager(save);

    for (let x = 0; x < 5; x++) {
      const playerPos = new Vector3(x * 240 + 120, 50, 120);
      manager.update(0.016, playerPos, fakeSurface, earthBiosphere);
      if (manager.activeSettlements.length > 0) break;
    }

    assert.ok(manager.activeSettlements.length > 0);
    const settlement = manager.activeSettlements[0];
    const factionId = settlement.factionId;
    const initialRep = save.getFactionReputation(factionId);

    const targetStructure = manager.structures.find(s => s.active && !s.destroyed);
    assert.ok(targetStructure);

    // Strike the structure with power
    const hitRes = manager.hit(targetStructure.id, 100, 500);
    assert.strictEqual(hitRes, true);

    const postRep = save.getFactionReputation(factionId);
    assert.ok(postRep < initialRep, 'Attacking settlement structures must reduce faction reputation');

    // Guards must mobilize into defending state
    const guards = manager.inhabitants.filter(i => i.active && i.role === 'guard');
    for (const g of guards) {
      assert.strictEqual(g.state, 'defending', 'Guards must enter defending state when settlement is attacked');
    }

    manager.dispose();
  });

  it('T_VIVO09_03_RECONSTRUCTION_AND_REPUTATION_RESTORATION', () => {
    const save = new SaveManager();
    save.reset();

    const manager = new AlienSettlementManager(save);

    for (let x = 0; x < 5; x++) {
      const playerPos = new Vector3(x * 240 + 120, 50, 120);
      manager.update(0.016, playerPos, fakeSurface, earthBiosphere);
      if (manager.activeSettlements.length > 0) break;
    }

    const structure = manager.structures.find(s => s.active);
    assert.ok(structure);

    // Destroy structure
    manager.hit(structure.id, 500, 10000);
    assert.strictEqual(structure.destroyed, true);

    const repBeforeReconstruct = save.getFactionReputation(structure.factionId);

    // Reconstruct with power
    const restored = manager.reconstruct(structure.position, 50);
    assert.ok(restored >= 1, 'Reconstruction must restore destroyed settlement structure');
    assert.strictEqual(structure.destroyed, false, 'Structure must be un-destroyed');
    assert.strictEqual(structure.health, structure.maxHealth);

    const repAfter = save.getFactionReputation(structure.factionId);
    assert.ok(repAfter > repBeforeReconstruct, 'Reconstructing settlement must award positive faction reputation');

    manager.dispose();
  });
});

