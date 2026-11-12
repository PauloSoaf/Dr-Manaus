import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { CosmicSpeciesScanner } from '../src/world/life/CosmicSpeciesScanner';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { SaveManager } from '../src/core/SaveManager';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { CreatureEntity } from '../src/world/life/AlienFaunaManager';

describe('CosmicSpeciesScanner (VIVO-05)', () => {
  const earthBody: CelestialBody = {
    id: 'earth',
    name: 'Terra',
    frameId: 'earth-frame',
    equatorialRadiusM: 6378137,
    polarRadiusM: 6356752,
    massKg: 5.972e24,
  };
  const earthBiosphere = generatePlanetaryBiosphere(earthBody, SOLAR_BODY_PROFILES.earth, 1337n);

  it('T_VIVO05_01: Resolves deterministic fauna taxonomy', () => {
    const profile = CosmicSpeciesScanner.resolveFaunaProfile('titan', 'chitinous-quadrupeds');
    assert.strictEqual(profile.originBodyId, 'titan');
    assert.strictEqual(profile.category, 'fauna');
    assert.strictEqual(profile.morphology, 'chitinous-quadrupeds');
    assert.ok(profile.scientificName.includes('Chitinus quadrupes'));
    assert.ok(profile.commonName.includes('Blindado Terrestre'));
    assert.strictEqual(profile.diet, 'herbivore');
    assert.strictEqual(profile.temperament, 'defensive');
    assert.ok(profile.threatLevel >= 1 && profile.threatLevel <= 5);
  });

  it('T_VIVO05_02: Resolves deterministic flora taxonomy', () => {
    const profile = CosmicSpeciesScanner.resolveFloraProfile('eden', 'bioluminescent-fungi', earthBiosphere);
    assert.strictEqual(profile.originBodyId, 'eden');
    assert.strictEqual(profile.category, 'flora');
    assert.strictEqual(profile.morphology, 'bioluminescent-fungi');
    assert.ok(profile.scientificName.includes('Lumina mycenis'));
    assert.ok(profile.commonName.includes('Cogumelo Luminoso'));
    assert.strictEqual(profile.diet, 'chemotrophic');
    assert.strictEqual(profile.threatLevel, 1);
  });

  it('T_VIVO05_03: Aim cone accurately picks creature in front of scanner', () => {
    const scanner = new CosmicSpeciesScanner();
    const rayOrigin = new Vector3(0, 10, 0);
    const rayDirection = new Vector3(0, 0, 1); // Looking along +Z

    const targetInSight: CreatureEntity = {
      id: 'creature:01',
      index: 0,
      kind: 'creature',
      morphology: 'bipedal-predators',
      base: new Vector3(0, 10, 30),
      position: new Vector3(0, 10, 30), // Directly ahead at 30m
      velocity: new Vector3(),
      targetPos: new Vector3(),
      headingRad: 0,
      radius: 1.5,
      active: true,
      state: 'idle',
      health: 100,
      maxHealth: 100,
      timer: 0,
      isAirborne: false,
      speedMps: 4,
    };

    const targetBehind: CreatureEntity = {
      id: 'creature:02',
      index: 1,
      kind: 'creature',
      morphology: 'amphibious-crawlers',
      base: new Vector3(0, 10, -25),
      position: new Vector3(0, 10, -25), // Behind player
      velocity: new Vector3(),
      targetPos: new Vector3(),
      headingRad: 0,
      radius: 1.5,
      active: true,
      state: 'idle',
      health: 100,
      maxHealth: 100,
      timer: 0,
      isAirborne: false,
      speedMps: 4,
    };

    // Scan with target in front
    const result = scanner.scanAim(rayOrigin, rayDirection, [targetInSight, targetBehind], earthBiosphere);
    assert.ok(result);
    assert.strictEqual(result.profile.morphology, 'bipedal-predators');
    assert.strictEqual(Math.round(result.distanceM), 30);

    // Scan looking opposite direction (along -X) -> should find nothing
    const noResult = scanner.scanAim(rayOrigin, new Vector3(-1, 0, 0), [targetInSight], earthBiosphere);
    assert.strictEqual(noResult, null);
  });

  it('T_VIVO05_04: Tracks new discovery and persists in SaveManager', () => {
    const save = new SaveManager();
    const scanner = new CosmicSpeciesScanner(save);

    const rayOrigin = new Vector3(0, 0, 0);
    const rayDirection = new Vector3(1, 0, 0);

    const creature: CreatureEntity = {
      id: 'test_creature',
      index: 0,
      kind: 'creature',
      morphology: 'avian-gliders',
      base: new Vector3(20, 0, 0),
      position: new Vector3(20, 0, 0),
      velocity: new Vector3(),
      targetPos: new Vector3(),
      headingRad: 0,
      radius: 1.5,
      active: true,
      state: 'idle',
      health: 100,
      maxHealth: 100,
      timer: 0,
      isAirborne: true,
      speedMps: 10,
    };

    // First scan -> new discovery
    const firstScan = scanner.scanAim(rayOrigin, rayDirection, [creature], earthBiosphere);
    assert.ok(firstScan);
    assert.strictEqual(firstScan.isNewDiscovery, true);
    assert.strictEqual(save.isSpeciesDiscovered(firstScan.profile.speciesId), true);

    // Second scan -> already discovered
    const secondScan = scanner.scanAim(rayOrigin, rayDirection, [creature], earthBiosphere);
    assert.ok(secondScan);
    assert.strictEqual(secondScan.isNewDiscovery, false);
  });
});
