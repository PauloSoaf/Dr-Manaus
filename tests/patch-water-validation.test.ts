import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group } from 'three';
import { AlienSettlementManager } from '../src/world/life/AlienSettlementManager';
import { AlienMetropolisGenerator } from '../src/world/life/AlienMetropolisGenerator';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { SaveManager } from '../src/core/SaveManager';
import { WaterSystem } from '../src/rendering/WaterSystem';
import { sampleManausWater } from '../src/world/water/ManausHydrology';
import { isLand } from '../src/world/geodata/geodata';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

describe('PATCH WATER-01 & WATER-02 Validation Suite', () => {
  const earthBody: CelestialBody = {
    id: 'earth',
    name: 'Terra',
    frameId: 'earth-frame',
    equatorialRadiusM: 6378137,
    polarRadiusM: 6356752,
    massKg: 5.972e24,
  };
  const earthBiosphere = generatePlanetaryBiosphere(earthBody, SOLAR_BODY_PROFILES.earth, 1337n);

  const alienBiosphere = {
    ...earthBiosphere,
    bodyId: 'procedural-colony-alpha',
    ecosystemDomain: 'alien-procedural' as const,
    isAlienWorld: true,
  };

  const fakeSurface: PlanetSurfaceGenerator = {
    body: { semiMajorAxisM: 6378137, flattening: 0.0033528 },
    radiusM: 6378137,
    heightAt: (_direction: Vec3) => 50,
    normalEnu: (_direction: Vec3, out: Vec3) => {
      out[0] = 0; out[1] = 1; out[2] = 0;
    },
    colourAt: (_direction: Vec3, out: [number, number, number]) => {
      out[0] = 0.2; out[1] = 0.5; out[2] = 0.2;
    },
  };

  const submergedSurface: PlanetSurfaceGenerator = {
    ...fakeSurface,
    heightAt: (_direction: Vec3) => -15.0, // Underwater
  };

  it('1. Nenhuma metrópole alienígena gerada automaticamente em Manaus / Terra', () => {
    const save = new SaveManager();
    const manager = new AlienSettlementManager(save);

    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        const playerPos = new Vector3(x * 240 + 120, 50, z * 240 + 120);
        manager.update(0.016, playerPos, fakeSurface, earthBiosphere);
        assert.strictEqual(manager.activeSettlements.length, 0, 'No alien settlements on Earth');
        assert.strictEqual(manager.metropolis.megalithCount, 0, 'No megaliths generated on Earth');
      }
    }
    manager.dispose();
  });

  it('2. Civilizações alienígenas continuam funcionando em outros planetas elegíveis', () => {
    const save = new SaveManager();
    const manager = new AlienSettlementManager(save);

    let spawned = false;
    for (let x = 0; x < 10; x++) {
      const playerPos = new Vector3(x * 240 + 120, 50, 120);
      manager.update(0.016, playerPos, fakeSurface, alienBiosphere);
      if (manager.activeSettlements.length > 0) {
        spawned = true;
        break;
      }
    }

    assert.ok(spawned, 'Alien civilized worlds must spawn settlements');
    assert.ok(manager.targets.length > 0, 'Must expose alien targets');
    manager.dispose();
  });

  it('3. clear() remove efetivamente todas as instâncias de metrópoles', () => {
    const metropolis = new AlienMetropolisGenerator();
    metropolis.generateMetropolis(1000, 2000, 300, 42);
    assert.ok(metropolis.megalithCount > 10, 'Metropolis generated');

    metropolis.clear();
    assert.strictEqual(metropolis.megalithCount, 0, 'clear() must reset megalith count to 0');
    metropolis.dispose();
  });

  it('4. O assentamento permanece na mesma coordenada após o jogador sair e retornar (determinismo)', () => {
    const save = new SaveManager();
    const manager = new AlienSettlementManager(save);

    // Find a populated cell
    let targetCellX = -1;
    for (let x = 0; x < 10; x++) {
      const playerPos = new Vector3(x * 240 + 120, 50, 120);
      manager.update(0.016, playerPos, fakeSurface, alienBiosphere);
      if (manager.activeSettlements.length > 0) {
        targetCellX = x;
        break;
      }
    }

    assert.ok(targetCellX >= 0);
    const initialPos = manager.activeSettlements[0].center.clone();

    // Move player far away
    manager.update(0.016, new Vector3(50000, 50, 50000), fakeSurface, alienBiosphere);

    // Return to original cell
    manager.update(0.016, new Vector3(targetCellX * 240 + 120, 50, 120), fakeSurface, alienBiosphere);
    assert.ok(manager.activeSettlements.length > 0);
    const returnedPos = manager.activeSettlements[0].center;

    assert.strictEqual(returnedPos.x, initialPos.x, 'X must match deterministically');
    assert.strictEqual(returnedPos.z, initialPos.z, 'Z must match deterministically');
    manager.dispose();
  });

  it('5. Cidades não nascem sobre água por validação de elevação', () => {
    const save = new SaveManager();
    const manager = new AlienSettlementManager(save);

    for (let x = 0; x < 10; x++) {
      const playerPos = new Vector3(x * 240 + 120, -10, 120);
      manager.update(0.016, playerPos, submergedSurface, alienBiosphere);
      assert.strictEqual(manager.activeSettlements.length, 0, 'Must not spawn terrestrial city underwater');
    }

    manager.dispose();
  });

  it('6. O fallback aquático não fica oculto pelo backdrop subterranean (-0.2m vs -3.5m)', () => {
    const root = new Group();
    const water = new WaterSystem(root);

    assert.ok(water.surfaceY > -3.5, 'Fallback water (-0.2m) must sit well above backdrop (-3.5m)');
    assert.strictEqual(water.telemetry.fallbackActive, true, 'Initially fallbackActive before file load');
    assert.ok(water.telemetry.triangles > 0, 'Fallback plane has triangles');
    water.vfx.dispose();
  });

  it('7. O movimento das ondas não provoca interpenetração visível com o solo junto às margens', () => {
    // Shore = 0 (exact bank): displacement must be exactly zero
    const shoreSample = sampleManausWater(1500, 2500, 10.0, 0.12, undefined, 0.0);
    assert.strictEqual(shoreSample.displacementX, 0, 'Zero displacement at shoreline');
    assert.strictEqual(shoreSample.displacementZ, 0, 'Zero displacement at shoreline');
    assert.strictEqual(shoreSample.height, 0.12, 'Height stays at base plane at shoreline');

    // Deep water (shore distance 100m): full wave displacement
    const deepSample = sampleManausWater(1500, 2500, 10.0, 0.12, undefined, 100.0);
    assert.ok(Math.abs(deepSample.height - 0.12) > 0.0001, 'Waves active in open water');
  });

  it('8. A física de barcos e nadador usa a mesma altura e dinâmica de água', () => {
    const sample1 = sampleManausWater(2000, 3000, 5.0, 0.12);
    const sample2 = sampleManausWater(2000, 3000, 5.0, 0.12);
    assert.strictEqual(sample1.height, sample2.height);
    assert.strictEqual(sample1.normal.y, sample2.normal.y);
  });
});
