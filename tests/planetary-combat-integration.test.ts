import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group } from 'three';
import { AlienFaunaManager } from '../src/world/life/AlienFaunaManager';
import { AlienFloraRenderer } from '../src/world/life/AlienFloraRenderer';
import { PlanetExcavationService } from '../src/world/destruction/PlanetExcavationService';
import { PlanetVolumeEditStore } from '../src/world/planet/volume/PlanetVolumeEditStore';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

describe('Planetary Multi-Domain Combat Integration (VIVO-06)', () => {
  const earthBody: CelestialBody = {
    id: 'earth',
    name: 'Terra',
    frameId: 'earth-frame',
    equatorialRadiusM: 6378137,
    polarRadiusM: 6356752,
    massKg: 5.972e24,
  };
  const habitableBiosphere = generatePlanetaryBiosphere(earthBody, SOLAR_BODY_PROFILES.earth, 1337n);

  const dummySurface: PlanetSurfaceGenerator = {
    body: { semiMajorAxisM: 6378137, flattening: 0.0033528 },
    radiusM: 6378137,
    heightAt: () => 50,
    normalEnu: (_direction: Vec3, out: Vec3) => {
      out[0] = 0;
      out[1] = 1;
      out[2] = 0;
    },
    elevationAt: () => 50,
    normalAt: () => [0, 1, 0],
    colourAt: (_direction: Vec3, out: [number, number, number]) => {
      out[0] = 0.2;
      out[1] = 0.5;
      out[2] = 0.2;
    },
  };

  it('T_VIVO06_01_MULTI_DOMAIN_TARGET_INTEGRATION: Alien fauna entities are registered as combat targets', () => {
    const root = new Group();
    const fauna = new AlienFaunaManager(root);

    // Seed creatures at cell center
    fauna.update(0.1, new Vector3(80, 15, 80), dummySurface, habitableBiosphere);

    const targets = fauna.targets;
    assert.ok(targets.length > 0, 'Must have at least one active creature target');
    const first = targets[0];
    assert.equal(first.kind, 'creature', 'Target kind must be creature');
    assert.ok(first.health > 0, 'Target health must be greater than zero');
    assert.ok(first.radius > 0, 'Target must have non-zero collision radius');
  });

  it('T_VIVO06_02_AREA_DAMAGE_AND_FAUNA_KNOCKBACK: Blast radius damages and knocks back alien creatures', () => {
    const root = new Group();
    const fauna = new AlienFaunaManager(root);
    fauna.update(0.1, new Vector3(80, 15, 80), dummySurface, habitableBiosphere);

    const initialTargets = fauna.targets;
    assert.ok(initialTargets.length >= 2, 'Should spawn multiple creatures');
    const targetPos = initialTargets[0].position.clone();

    // Inflict localized area damage centered on first creature
    const affected = fauna.damageInRadius(targetPos, 20, 40, 30);
    assert.ok(affected >= 1, 'At least one creature must be affected by area damage');

    // Affected creature health is depleted and it transitions to knocked or defeated
    const damaged = initialTargets[0];
    assert.ok(damaged.health < damaged.maxHealth, 'Health must decrease');
    assert.ok(damaged.state === 'knocked' || damaged.state === 'defeated', 'State must be knocked or defeated');
    if (damaged.state === 'knocked') {
      assert.ok(damaged.velocity.length() > 0, 'Velocity must reflect physical impulse');
    }

    // High damage blast defeats creatures in radius
    const killedCount = fauna.damageInRadius(targetPos, 20, 200, 50);
    assert.ok(killedCount >= 1, 'Creature in lethal blast radius must be defeated');
    assert.equal(damaged.state, 'defeated', 'Over-damaged creature must enter defeated state');
    assert.equal(damaged.active, false, 'Defeated creature must become inactive');
  });

  it('T_VIVO06_03_FLORA_DESTRUCTION_AND_RECONSTRUCTION: Flora instances are eradicated by blast and regrown via reconstruction', () => {
    const root = new Group();
    const flora = new AlienFloraRenderer(root);
    const center = new Vector3(0, 15, 0);

    flora.update(center, dummySurface, habitableBiosphere);
    const initialCount = flora.getActiveCount('canopy-broadleaf');
    assert.ok(initialCount > 0, 'Broadleaf canopy instances should be active');

    // Blast eradicates flora in radius
    const destroyed = flora.destroyInRadius(center, 40, habitableBiosphere);
    assert.ok(destroyed > 0, 'Flora within 40m blast radius must be destroyed');

    flora.update(center, dummySurface, habitableBiosphere);
    const postBlastCount = flora.getActiveCount('canopy-broadleaf');
    assert.ok(postBlastCount < initialCount, 'Active flora count must decrease after blast');

    // Reconstruction restores destroyed flora
    const restored = flora.reconstruct(center, 40);
    assert.ok(restored >= destroyed, 'Reconstruction must restore destroyed flora instances');

    flora.update(center, dummySurface, habitableBiosphere);
    const postReconstructCount = flora.getActiveCount('canopy-broadleaf');
    assert.equal(postReconstructCount, initialCount, 'Flora count must fully restore to pre-destruction count');
  });

  it('T_VIVO06_04_PLANETARY_VOLUME_CRATERING: Power impacts carve spherical craters on celestial volumes', () => {
    const editStore = new PlanetVolumeEditStore();
    const excavation = new PlanetExcavationService({
      edits: editStore,
      surfaceForBody: () => dummySurface,
    });

    const bodyId = 'alien-planet';
    const craterCenter: [number, number, number] = [0, 3_000_000, 0];
    const craterRadiusM = 45;

    const editId = excavation.carveSphere(bodyId, craterCenter, craterRadiusM);
    assert.ok(editId.startsWith(`${bodyId}:crater:`), 'Edit ID must adhere to planetary crater naming convention');

    const edit = editStore.get(editId);
    assert.ok(edit, 'Crater edit must exist in the edit store');
    assert.equal(edit.type, 'subtract-sphere', 'Edit type must be subtract-sphere');
    if (edit.type === 'subtract-sphere') {
      assert.deepEqual(edit.centerBodyFixedM, craterCenter, 'Crater center must match');
      assert.equal(edit.radiusM, craterRadiusM, 'Crater radius must match');
    }
    assert.equal(editStore.editCount, 1, 'Store must contain exactly 1 edit');
  });

  it('T_VIVO06_05_CELESTIAL_SURFACE_POWER_COMBAT_FLOW: Combined multi-domain combat dispatches damage, impulse, and full reconstruction', () => {
    const faunaRoot = new Group();
    const floraRoot = new Group();
    const fauna = new AlienFaunaManager(faunaRoot);
    const flora = new AlienFloraRenderer(floraRoot);
    const editStore = new PlanetVolumeEditStore();
    const excavation = new PlanetExcavationService({
      edits: editStore,
      surfaceForBody: () => dummySurface,
    });

    const playerPos = new Vector3(80, 15, 80);
    fauna.update(0.1, playerPos, dummySurface, habitableBiosphere);
    flora.update(playerPos, dummySurface, habitableBiosphere);

    const initialTargets = fauna.targets;
    assert.ok(initialTargets.length > 0, 'Fauna must exist');
    const target = initialTargets[0];
    const targetPos = target.position.clone();

    // Simulate multi-domain combat damage handler (as invoked in Game.ts)
    const handleDamage = (point: Vector3, radius: number, amount: number, deform = false) => {
      let count = 0;
      count += flora.destroyInRadius(point, radius, habitableBiosphere);
      count += fauna.damageInRadius(point, radius, amount, 35);
      if (deform || amount >= 5000) {
        excavation.carveSphere('alien-planet', [point.x, point.y, point.z], Math.min(radius, 250));
        count += 1;
      }
      return count;
    };

    // Simulate multi-domain reconstruct handler (as invoked in Game.ts)
    const handleReconstruct = (point: Vector3, radius: number) => {
      const faunaRestored = fauna.reconstruct(point, radius);
      const floraRestored = flora.reconstruct(point, radius);
      return faunaRestored + floraRestored;
    };

    // 1. Kinetic attack / Shockwave
    const affectedCount = handleDamage(targetPos, 30, 85000, true);
    assert.ok(affectedCount >= 2, 'Combined damage must affect flora/fauna and carve crater');
    assert.equal(editStore.editCount, 1, 'Planetary surface must be cratered by heavy kinetic power');
    assert.equal(target.active, false, 'Creature hit by 85000 damage must be defeated');

    // 2. Cosmic Reconstruct power
    const restoredCount = handleReconstruct(targetPos, 50);
    assert.ok(restoredCount >= 1, 'Reconstruction must restore defeated entities in radius');
    assert.equal(target.active, true, 'Defeated creature must be resurrected');
    assert.equal(target.state, 'idle', 'Resurrected creature must return to idle state');
    assert.equal(target.health, target.maxHealth, 'Resurrected creature must have full health');
  });
});
