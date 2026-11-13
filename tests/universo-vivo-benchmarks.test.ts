import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group } from 'three/webgpu';
import { AlienFloraRenderer } from '../src/world/life/AlienFloraRenderer';
import { AlienFaunaManager } from '../src/world/life/AlienFaunaManager';
import { AlienSettlementManager } from '../src/world/life/AlienSettlementManager';
import { CosmicAnomaliesAndRuinsManager } from '../src/world/life/CosmicAnomaliesAndRuinsManager';
import { PlanetaryHazardService } from '../src/world/life/PlanetaryHazardService';
import { PlanetaryHazardRenderer } from '../src/world/life/PlanetaryHazardRenderer';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { SaveManager } from '../src/core/SaveManager';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

describe('Universo Vivo Benchmarks & Polish (VIVO-16)', () => {
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
    bodyId: 'procedural-ancient-benchmark-world',
    civilizationStage: 'ancient-ruins-guardians' as const,
    lifeTier: 'civilized' as const,
    habitabilityScore: 0.9,
  };

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

  it('T_VIVO16_01_AI_TICK_EXECUTION_BUDGET', () => {
    const save = new SaveManager();
    const fauna = new AlienFaunaManager();
    const settlements = new AlienSettlementManager(save);
    const ruins = new CosmicAnomaliesAndRuinsManager(save);

    const playerPos = new Vector3(0, 6378187, 0);

    // Initial warm-up & spawn
    fauna.update(0.016, playerPos, fakeSurface, ancientWorldBiosphere);
    settlements.update(0.016, playerPos, fakeSurface, ancientWorldBiosphere);
    ruins.update(0.016, playerPos, fakeSurface, ancientWorldBiosphere);

    const iterations = 60;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      fauna.update(0.125, playerPos, fakeSurface, ancientWorldBiosphere);
      settlements.update(0.125, playerPos, fakeSurface, ancientWorldBiosphere);
      ruins.update(0.125, playerPos, fakeSurface, ancientWorldBiosphere);
    }

    const elapsed = performance.now() - start;
    const avgMsPerTick = elapsed / iterations;

    assert.ok(
      avgMsPerTick < 3.0,
      `AI Tick must execute within 3.0 ms (actual: ${avgMsPerTick.toFixed(3)} ms)`,
    );

    fauna.dispose();
    settlements.dispose();
    ruins.dispose();
  });

  it('T_VIVO16_02_ZERO_MEMORY_LEAK_OVER_1000_FRAMES', () => {
    const save = new SaveManager();
    const flora = new AlienFloraRenderer();
    const fauna = new AlienFaunaManager();
    const settlements = new AlienSettlementManager(save);
    const ruins = new CosmicAnomaliesAndRuinsManager(save);
    const hazards = new PlanetaryHazardRenderer();

    const playerPos = new Vector3(0, 6378187, 0);

    // Pre-warm
    flora.update(playerPos, fakeSurface, ancientWorldBiosphere);
    fauna.update(0.016, playerPos, fakeSurface, ancientWorldBiosphere);
    settlements.update(0.016, playerPos, fakeSurface, ancientWorldBiosphere);
    ruins.update(0.016, playerPos, fakeSurface, ancientWorldBiosphere);

    const memBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      playerPos.x += Math.sin(i * 0.05) * 2;
      playerPos.z += Math.cos(i * 0.05) * 2;

      flora.update(playerPos, fakeSurface, ancientWorldBiosphere);
      fauna.update(0.016, playerPos, fakeSurface, ancientWorldBiosphere);
      settlements.update(0.016, playerPos, fakeSurface, ancientWorldBiosphere);
      ruins.update(0.016, playerPos, fakeSurface, ancientWorldBiosphere);

      const hazard = PlanetaryHazardService.evaluateHazard({
        bodyId: ancientWorldBiosphere.bodyId,
        classification: 'oceanic-rocky',
        biosphere: ancientWorldBiosphere,
        timeSeconds: i * 0.016,
      });
      hazards.update(0.016, playerPos, hazard);
    }

    const memAfter = process.memoryUsage().heapUsed;
    const deltaMB = (memAfter - memBefore) / (1024 * 1024);

    // Bounded heap growth check (< 20 MB for 1000 full world frames)
    assert.ok(
      deltaMB < 20,
      `Heap growth over 1000 frames must be strictly bounded (< 20 MB, actual: ${deltaMB.toFixed(2)} MB)`,
    );

    flora.dispose();
    fauna.dispose();
    settlements.dispose();
    ruins.dispose();
    hazards.dispose();
  });

  it('T_VIVO16_03_RAPID_CELESTIAL_BODY_HANDOFF_STABILITY', () => {
    const save = new SaveManager();
    const fauna = new AlienFaunaManager();
    const settlements = new AlienSettlementManager(save);
    const ruins = new CosmicAnomaliesAndRuinsManager(save);
    const playerPos = new Vector3(0, 6378187, 0);

    const bodies = [
      earthBiosphere,
      moonBiosphere,
      ancientWorldBiosphere,
      moonBiosphere,
      ancientWorldBiosphere,
      earthBiosphere,
    ];

    for (const bio of bodies) {
      assert.doesNotThrow(() => {
        fauna.update(0.016, playerPos, fakeSurface, bio);
        settlements.update(0.016, playerPos, fakeSurface, bio);
        ruins.update(0.016, playerPos, fakeSurface, bio);
      }, `Switching to body ${bio.bodyId} must execute cleanly without error`);
    }

    fauna.dispose();
    settlements.dispose();
    ruins.dispose();
  });

  it('T_VIVO16_04_SAVE_AND_RESTORE_INTEGRITY_CYCLE', () => {
    const saveA = new SaveManager();

    // Mutate all persistent Universo Vivo fields
    saveA.discoverSpecies('species:procedural-alpha:chitinous-quadrupeds');
    saveA.recordBodyRupture('mars');
    saveA.modifyFactionReputation('guardians', 45);
    saveA.discoverRuin('ruin:procedural-ancient-benchmark-world:0');
    saveA.recordColossusDefeat('colossus:procedural-ancient-benchmark-world:0');

    // Serialize
    const serialized = JSON.stringify(saveA.data);

    // Save into localStorage simulation
    const saveB = new SaveManager();
    saveB.data = JSON.parse(serialized);

    // Assert integrity
    assert.strictEqual(saveB.isSpeciesDiscovered('species:procedural-alpha:chitinous-quadrupeds'), true);
    assert.strictEqual(saveB.isBodyRuptured('mars'), true);
    assert.strictEqual(saveB.getFactionReputation('guardians'), 45);
    assert.strictEqual(saveB.isRuinDiscovered('ruin:procedural-ancient-benchmark-world:0'), true);
    assert.strictEqual(saveB.isColossusDefeated('colossus:procedural-ancient-benchmark-world:0'), true);

    // Restorations
    saveB.recordBodyRestoration('mars');
    assert.strictEqual(saveB.isBodyRuptured('mars'), false);
  });

  it('T_VIVO16_05_COMPLETE_DISPOSAL_CLEANUP', () => {
    const root = new Group();
    const save = new SaveManager();

    const flora = new AlienFloraRenderer();
    const fauna = new AlienFaunaManager();
    const settlements = new AlienSettlementManager(save);
    const ruins = new CosmicAnomaliesAndRuinsManager(save);
    const hazards = new PlanetaryHazardRenderer(root);

    root.add(flora.root, fauna.root, settlements.root, ruins.root);
    assert.strictEqual(root.children.length, 5);

    // Dispose all
    flora.dispose();
    fauna.dispose();
    settlements.dispose();
    ruins.dispose();
    hazards.dispose();

    assert.strictEqual(root.children.length, 0, 'Disposal must cleanly unparent all meshes');
  });
});

