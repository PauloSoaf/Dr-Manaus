import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group } from 'three/webgpu';
import {
  PlanetaryHazardService,
  type PlanetaryHazardState,
  type PlanetaryAtmospherePalette,
} from '../src/world/life/PlanetaryHazardService';
import { PlanetaryHazardRenderer } from '../src/world/life/PlanetaryHazardRenderer';
import {
  environmentalAudioMix,
  type AudioEnvironment,
  type AtmosphericMedium,
} from '../src/audio/AudioManager';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';

describe('PlanetaryHazardsAndSky (VIVO-11)', () => {
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

  const marsBody: CelestialBody = {
    id: 'mars',
    name: 'Marte',
    frameId: 'mars-frame',
    equatorialRadiusM: 3396200,
    massKg: 6.417e23,
  };
  const marsBiosphere = generatePlanetaryBiosphere(marsBody, SOLAR_BODY_PROFILES.mars, 1337n);

  const venusBody: CelestialBody = {
    id: 'venus',
    name: 'Vênus',
    frameId: 'venus-frame',
    equatorialRadiusM: 6051800,
    massKg: 4.867e24,
  };
  const venusBiosphere = generatePlanetaryBiosphere(venusBody, SOLAR_BODY_PROFILES.venus, 1337n);

  it('T_VIVO11_01_EARTH_NOMINAL_SAFETY', () => {
    const hazard = PlanetaryHazardService.evaluateHazard({
      bodyId: 'earth',
      classification: 'oceanic-rocky',
      biosphere: earthBiosphere,
      altitudeM: 50,
      timeSeconds: 100,
    });

    assert.strictEqual(hazard.type, 'none');
    assert.strictEqual(hazard.alertLevel, 'nominal');
    assert.strictEqual(hazard.intensity, 0);
    assert.strictEqual(hazard.damagePerSecond, 0);
  });

  it('T_VIVO11_02_AIRLESS_BODIES_VACUUM_AND_RADIATION', () => {
    // Moon is airless
    const moonHazard = PlanetaryHazardService.evaluateHazard({
      bodyId: 'moon',
      classification: 'rocky-moon',
      biosphere: moonBiosphere,
      altitudeM: 10,
      timeSeconds: 42,
    });

    assert.strictEqual(moonHazard.type, 'vacuum-exposure');
    assert.strictEqual(moonHazard.alertLevel, 'caution');
    assert.strictEqual(moonHazard.intensity, 1.0);

    // Lethal cosmic radiation on an airless asteroid
    const lethalAirlessBiosphere = {
      ...moonBiosphere,
      radiationLevel: 'lethal-cosmic' as const,
    };
    const radHazard = PlanetaryHazardService.evaluateHazard({
      bodyId: 'procedural-asteroid-99',
      classification: 'rocky-moon',
      biosphere: lethalAirlessBiosphere,
      altitudeM: 0,
      timeSeconds: 15,
    });

    assert.strictEqual(radHazard.type, 'radiation-storm');
    assert.strictEqual(radHazard.alertLevel, 'critical');
    assert.ok(radHazard.damagePerSecond > 0, 'Lethal radiation storm must cause damage');
  });

  it('T_VIVO11_03_MARS_ENVIRONMENT_AND_SKY', () => {
    const marsHazard = PlanetaryHazardService.evaluateHazard({
      bodyId: 'mars',
      classification: 'arid-rocky',
      biosphere: marsBiosphere,
      altitudeM: 500,
      timeSeconds: 50,
    });

    assert.strictEqual(marsHazard.type, 'none');
    assert.strictEqual(marsHazard.alertLevel, 'nominal');
    assert.ok(marsHazard.label.includes('Marciana'));

    const marsPalette = PlanetaryHazardService.getAtmospherePalette({
      bodyId: 'mars',
      classification: 'arid-rocky',
      biosphere: marsBiosphere,
    });

    assert.strictEqual(marsPalette.hasSkyDome, true);
    assert.strictEqual(marsPalette.label, 'Céu Marciano (CO2 e Óxidos)');
    assert.ok(marsPalette.skyDensity > 0.2, 'Mars has thin but visible atmospheric scattering');
    assert.ok(marsPalette.fogNear > 500 && marsPalette.fogFar < 50000);
  });

  it('T_VIVO11_04_VENUS_CORROSIVE_DOWNPOUR', () => {
    const venusHazard = PlanetaryHazardService.evaluateHazard({
      bodyId: 'venus',
      classification: 'dense-atmosphere-rocky',
      biosphere: venusBiosphere,
      altitudeM: 200,
      timeSeconds: 25,
    });

    // Venus has corrosive atmosphere / sulfuric wastes
    assert.strictEqual(venusHazard.type, 'acidic-downpour');
    assert.strictEqual(venusHazard.alertLevel, 'critical');
    assert.ok(venusHazard.damagePerSecond >= 7.5, 'Corrosive downpour must erode hull');

    const venusPalette = PlanetaryHazardService.getAtmospherePalette({
      bodyId: 'venus',
      classification: 'dense-atmosphere-rocky',
      biosphere: venusBiosphere,
    });

    assert.strictEqual(venusPalette.hasSkyDome, true);
    assert.ok(venusPalette.skyDensity >= 0.9, 'Dense greenhouse has high opacity scattering');
    assert.ok(venusPalette.fogFar <= 5000, 'Dense atmosphere severely limits visibility');
  });

  it('T_VIVO11_05_CRYOGENIC_BLIZZARD_AND_THERMAL_SCORCH', () => {
    // 1. Cryogenic world (average temp 90 K)
    const cryoBiosphere = {
      ...earthBiosphere,
      averageTemperatureK: 85,
      classification: 'frozen-rocky' as const,
    };
    const cryoHazard = PlanetaryHazardService.evaluateHazard({
      bodyId: 'titan-cryo',
      classification: 'frozen-rocky',
      biosphere: cryoBiosphere,
      temperatureK: 85,
      timeSeconds: 30,
    });

    assert.strictEqual(cryoHazard.type, 'cryogenic-blizzard');
    assert.ok(['caution', 'critical'].includes(cryoHazard.alertLevel));

    // 2. Volcanic world (average temp 550 K)
    const scorchHazard = PlanetaryHazardService.evaluateHazard({
      bodyId: 'io-volcanic',
      classification: 'volcanic-moon',
      temperatureK: 550,
      timeSeconds: 12,
    });

    assert.strictEqual(scorchHazard.type, 'thermal-scorch');
    assert.strictEqual(scorchHazard.alertLevel, 'critical');
    assert.ok(scorchHazard.damagePerSecond >= 10);
  });

  it('T_VIVO11_06_EXOTIC_BIOSPHERE_SPORES_AND_ATMOSPHERE', () => {
    const fungalBiosphere = {
      ...earthBiosphere,
      lifeTier: 'fauna' as const,
      dominantVegetationType: 'fungal-spores' as const,
      atmosphereBreathability: 'toxic-respirator-required' as const,
    };

    const sporeHazard = PlanetaryHazardService.evaluateHazard({
      bodyId: 'fungal-prime',
      classification: 'oceanic-rocky',
      biosphere: fungalBiosphere,
      biome: 'fungal-canopy',
      timeSeconds: 60,
    });

    assert.strictEqual(sporeHazard.type, 'toxic-spores');
    assert.strictEqual(sporeHazard.alertLevel, 'caution');
    assert.ok(sporeHazard.mitigationHint.includes('filtros'));

    const palette = PlanetaryHazardService.getAtmospherePalette({
      bodyId: 'fungal-prime',
      classification: 'oceanic-rocky',
      biosphere: fungalBiosphere,
    });

    assert.strictEqual(palette.hasSkyDome, true);
    assert.ok(palette.label.includes('Bioluminescente'));
  });

  it('T_VIVO11_07_ENVIRONMENTAL_AUDIO_MIXING_ACROSS_MEDIUMS', () => {
    // 1. Vacuum
    const vacMix = environmentalAudioMix({
      medium: 'vacuum',
      atmosphericDensity01: 0,
      speedMps: 150,
      altitudeM: 1000,
      rain: false,
      river: false,
    });
    assert.strictEqual(vacMix.ambienceGain, 0, 'Vacuum must have zero atmospheric ambience');
    assert.strictEqual(vacMix.windGain, 0, 'Vacuum must have zero atmospheric wind');

    // 2. Alien dense
    const denseMix = environmentalAudioMix({
      medium: 'alien-dense',
      atmosphericDensity01: 1.0,
      speedMps: 100,
      altitudeM: 50,
      rain: false,
      river: false,
    });
    assert.ok(denseMix.ambienceGain > 0.2, 'Dense atmosphere has heavy acoustic presence');
    assert.strictEqual(denseMix.frequency, 210, 'Dense medium has low acoustic rumble');

    // 3. Alien thin
    const thinMix = environmentalAudioMix({
      medium: 'alien-thin',
      atmosphericDensity01: 0.5,
      speedMps: 100,
      altitudeM: 50,
      rain: false,
      river: false,
    });
    assert.ok(thinMix.ambienceGain < 0.1, 'Thin atmosphere has attenuated audio');
    assert.strictEqual(thinMix.frequency, 490, 'Thin medium has higher whistling cutoff');

    // 4. Cryogenic winds
    const cryoMix = environmentalAudioMix({
      medium: 'cryogenic-winds',
      atmosphericDensity01: 0.9,
      speedMps: 200,
      altitudeM: 100,
      rain: false,
      river: false,
    });
    assert.ok(cryoMix.windGain > 0.15, 'Cryogenic howling winds have elevated gain');
    assert.strictEqual(cryoMix.frequency, 390 + 200 * 4, 'High speed cryo winds shift resonance');
  });

  it('T_VIVO11_08_PLANETARY_HAZARD_RENDERER_LIFECYCLE', () => {
    const parent = new Group();
    const renderer = new PlanetaryHazardRenderer(parent);

    assert.ok(parent.children.includes(renderer.root));
    const playerPos = new Vector3(100, 25, -200);

    // When hazard is none, visual lines must be invisible
    const nominalHazard: PlanetaryHazardState = {
      type: 'none',
      alertLevel: 'nominal',
      intensity: 0,
      label: 'Nominal',
      description: 'None',
      damagePerSecond: 0,
      mitigationHint: 'None',
    };
    renderer.update(0.016, playerPos, nominalHazard);
    assert.strictEqual(renderer.root.children[0].visible, false);

    // When active hazard occurs, lines become visible around player
    const stormHazard: PlanetaryHazardState = {
      type: 'acidic-downpour',
      alertLevel: 'critical',
      intensity: 0.85,
      label: 'Acid Rain',
      description: 'Corrosive',
      damagePerSecond: 10,
      mitigationHint: 'Shield',
    };
    renderer.update(0.016, playerPos, stormHazard);
    assert.strictEqual(renderer.root.children[0].visible, true);
    assert.strictEqual(renderer.root.children[0].position.x, playerPos.x);

    renderer.dispose();
    assert.ok(!parent.children.includes(renderer.root));
  });
});
