/**
 * PlanetaryHazardService.ts
 *
 * Evaluates deterministic environmental hazards, alerts, and planetary sky & atmosphere palettes.
 * Pure, deterministic, and non-allocating where appropriate.
 */

import { Color } from 'three/webgpu';
import type { WorldClassification } from '../celestial/CelestialBodyProfile';
import type { PlanetaryBiosphereProfile } from './PlanetaryBiosphere';
import type { PlanetaryBiomeSample, PlanetaryBiomeType } from './PlanetaryBiomeService';

export type PlanetaryHazardType =
  | 'none'
  | 'radiation-storm'
  | 'acidic-downpour'
  | 'cryogenic-blizzard'
  | 'toxic-spores'
  | 'thermal-scorch'
  | 'vacuum-exposure';

export type PlanetaryHazardAlertLevel = 'nominal' | 'caution' | 'critical';

export interface PlanetaryHazardState {
  readonly type: PlanetaryHazardType;
  readonly alertLevel: PlanetaryHazardAlertLevel;
  readonly intensity: number; // 0.0 to 1.0
  readonly label: string;
  readonly description: string;
  readonly damagePerSecond: number;
  readonly mitigationHint: string;
}

export interface PlanetaryAtmospherePalette {
  readonly hasSkyDome: boolean;
  readonly top: Color;
  readonly horizon: Color;
  readonly zenith: Color;
  readonly glow: Color;
  readonly sunColor: Color;
  readonly fogColor: Color;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly skyDensity: number;
  readonly label: string;
}

export interface HazardEvaluationParams {
  readonly bodyId: string;
  readonly classification?: WorldClassification;
  readonly biosphere?: PlanetaryBiosphereProfile;
  readonly biome?: PlanetaryBiomeSample | PlanetaryBiomeType;
  readonly altitudeM?: number;
  readonly temperatureK?: number;
  readonly timeSeconds?: number;
}

export interface AtmospherePaletteParams {
  readonly bodyId: string;
  readonly classification?: WorldClassification;
  readonly biosphere?: PlanetaryBiosphereProfile;
  readonly biome?: PlanetaryBiomeSample | PlanetaryBiomeType;
}

/**
 * Deterministic pseudo-random noise for temporal hazard fluctuations.
 */
function temporalNoise(seed: number, timeSec: number): number {
  const t = Math.floor(timeSec * 0.25);
  const frac = (timeSec * 0.25) - t;
  const h0 = Math.sin((seed ^ t) * 12.9898) * 43758.5453;
  const v0 = h0 - Math.floor(h0);
  const h1 = Math.sin((seed ^ (t + 1)) * 12.9898) * 43758.5453;
  const v1 = h1 - Math.floor(h1);
  return v0 * (1 - frac) + v1 * frac;
}

export class PlanetaryHazardService {
  /**
   * Evaluates the active environmental hazard for a player on a celestial body.
   */
  static evaluateHazard(params: HazardEvaluationParams): PlanetaryHazardState {
    const { bodyId, classification, biosphere, altitudeM = 0, timeSeconds = 0 } = params;
    const biomeType: PlanetaryBiomeType | undefined = typeof params.biome === 'string'
      ? params.biome
      : params.biome?.biomeId;

    const tempK = params.temperatureK ?? biosphere?.averageTemperatureK ?? 288;
    const seed = biosphere?.seeds?.climateSeed ?? 42;
    const timeFactor = temporalNoise(seed, timeSeconds);

    // 1. Earth is always nominal / safe
    if (bodyId === 'earth') {
      return {
        type: 'none',
        alertLevel: 'nominal',
        intensity: 0.0,
        label: 'Ambiente Benigno',
        description: 'Condições atmosféricas ideais e proteção magnetosférica plena.',
        damagePerSecond: 0,
        mitigationHint: 'Nenhuma ação necessária.',
      };
    }

    // 2. Airless / Vacuum bodies (Moon, Mercury, Asteroids, or vacuum breathability)
    const isAirless = classification === 'rocky-moon' ||
      classification === 'icy-moon' ||
      classification === 'arid-rocky' && (bodyId === 'mercury') ||
      biosphere?.atmosphereBreathability === 'vacuum-sealed-suit';

    if (isAirless && bodyId !== 'mars' && bodyId !== 'titan') {
      const isExtremeRadiation = biosphere?.radiationLevel === 'lethal-cosmic';
      if (isExtremeRadiation) {
        const intensity = Math.min(1.0, 0.7 + timeFactor * 0.3);
        return {
          type: 'radiation-storm',
          alertLevel: 'critical',
          intensity,
          label: 'Tempestade de Radiação Cósmica',
          description: 'Fluxo letal de raios gama e vento estelar sem atenuação magnética.',
          damagePerSecond: 15 * intensity,
          mitigationHint: 'Ative blindagem cinética ou procure abrigo subterrâneo.',
        };
      }
      return {
        type: 'vacuum-exposure',
        alertLevel: 'caution',
        intensity: 1.0,
        label: 'Vácuo Absoluto',
        description: 'Ausência total de atmosfera mensurável e pressão quase nula.',
        damagePerSecond: 0,
        mitigationHint: 'Mantenha o traje pressurizado.',
      };
    }

    // 3. Corrosive / Acidic Downpour (checked before generic heat so Venus/dense greenhouse receives corrosive hazards)
    const isCorrosive = biosphere?.atmosphereBreathability === 'corrosive-hazard' ||
      biomeType === 'sulfuric-wastes' ||
      classification === 'dense-atmosphere-rocky' ||
      bodyId === 'venus';
    if (isCorrosive) {
      const intensity = Math.min(1.0, 0.75 + timeFactor * 0.25);
      return {
        type: 'acidic-downpour',
        alertLevel: 'critical',
        intensity,
        label: 'Precipitação Ácida Corrosiva',
        description: 'Gotículas de ácidos concentrados atacam a integridade superficial da couraça.',
        damagePerSecond: 10 * intensity,
        mitigationHint: 'Utilize o poder de escudo cinético para repelir o aerossol ácido.',
      };
    }

    // 4. Volcanic / Thermal Scorch
    const isExtremeHeat = tempK > 380 || biomeType === 'magma-fields' || biomeType === 'scorched-crags' || classification === 'volcanic-moon';
    if (isExtremeHeat) {
      const intensity = Math.min(1.0, 0.6 + ((tempK - 380) / 250) * 0.4);
      return {
        type: 'thermal-scorch',
        alertLevel: intensity >= 0.75 ? 'critical' : 'caution',
        intensity,
        label: 'Sobreaquecimento Térmico',
        description: 'Fluxo de calor extremo superando o limite dissipativo do traje.',
        damagePerSecond: intensity >= 0.75 ? 12 : 4,
        mitigationHint: 'Evite fumarolas vulcânicas e rios de magma.',
      };
    }

    // 5. Cryogenic Blizzard
    const isCryogenic = tempK < 165 || biomeType === 'extreme-cryo-ice' || biomeType === 'glacial-cap' || biomeType === 'nitrogen-plains';
    if (isCryogenic) {
      const intensity = Math.min(1.0, 0.5 + timeFactor * 0.5);
      return {
        type: 'cryogenic-blizzard',
        alertLevel: intensity > 0.75 ? 'critical' : 'caution',
        intensity,
        label: 'Nevasca Criogênica',
        description: 'Ventos subsônicos de nitrogênio/metano superresfriado a temperaturas criogênicas.',
        damagePerSecond: intensity > 0.75 ? 8 : 2,
        mitigationHint: 'Ative propulsão térmica para estabilizar a temperatura.',
      };
    }

    // 6. Toxic Biotic Spores
    const hasBioticSpores = biomeType === 'fungal-canopy' ||
      biomeType === 'bioluminescent-wetlands' ||
      biosphere?.dominantVegetationType === 'fungal-spores';
    if (hasBioticSpores && biosphere?.atmosphereBreathability !== 'breathable') {
      const intensity = Math.min(1.0, 0.45 + timeFactor * 0.4);
      return {
        type: 'toxic-spores',
        alertLevel: 'caution',
        intensity,
        label: 'Bruma de Esporos Tóxicos',
        description: 'Aerossol orgânico denso saturado de micro-esporos alienígenas.',
        damagePerSecond: 3 * intensity,
        mitigationHint: 'Mantenha os filtros purificadores atmosféricos ativados.',
      };
    }

    // 7. High Radiation on Surface
    if (biosphere?.radiationLevel === 'lethal-cosmic' || (biosphere?.radiationLevel === 'moderate' && altitudeM > 5000)) {
      const intensity = Math.min(1.0, 0.6 + timeFactor * 0.35);
      return {
        type: 'radiation-storm',
        alertLevel: intensity > 0.8 ? 'critical' : 'caution',
        intensity,
        label: 'Radiação Ionizante Alta',
        description: 'Fluxo radioativo elevado penetrando o envelope atmosférico.',
        damagePerSecond: intensity > 0.8 ? 9 : 2,
        mitigationHint: 'Mantenha altitude baixa ou utilize campos de força.',
      };
    }

    // 8. Mars dust storms
    if (bodyId === 'mars') {
      const intensity = 0.3 + timeFactor * 0.4;
      return {
        type: 'none',
        alertLevel: 'nominal',
        intensity,
        label: 'Ventos de Poeira Marciana',
        description: 'Atmosfera rarefeita de dióxido de carbono com partículas em suspensão.',
        damagePerSecond: 0,
        mitigationHint: 'Visibilidade moderadamente atenuada.',
      };
    }

    // Nominal
    return {
      type: 'none',
      alertLevel: 'nominal',
      intensity: 0.0,
      label: 'Condições Estáveis',
      description: 'Nenhum perigo iminente registrado pelos sensores.',
      damagePerSecond: 0,
      mitigationHint: 'Operação padrão.',
    };
  }

  /**
   * Computes the atmospheric sky and fog palette for any world.
   */
  static getAtmospherePalette(params: AtmospherePaletteParams): PlanetaryAtmospherePalette {
    const { bodyId, classification, biosphere } = params;

    // Airless / Vacuum worlds
    const isAirless = bodyId === 'moon' ||
      bodyId === 'mercury' ||
      classification === 'rocky-moon' ||
      classification === 'icy-moon' ||
      biosphere?.atmosphereBreathability === 'vacuum-sealed-suit';

    if (isAirless && bodyId !== 'mars' && bodyId !== 'titan') {
      return {
        hasSkyDome: false,
        top: new Color('#000002'),
        horizon: new Color('#020308'),
        zenith: new Color('#000001'),
        glow: new Color('#050810'),
        sunColor: new Color('#ffffff'),
        fogColor: new Color('#010204'),
        fogNear: 50000,
        fogFar: 500000,
        skyDensity: 0.0,
        label: 'Vácuo Profundo',
      };
    }

    // Mars
    if (bodyId === 'mars') {
      return {
        hasSkyDome: true,
        top: new Color('#875a45'),
        horizon: new Color('#c48967'),
        zenith: new Color('#422619'),
        glow: new Color('#f0a578'),
        sunColor: new Color('#ffe0cc'),
        fogColor: new Color('#996347'),
        fogNear: 1800,
        fogFar: 22000,
        skyDensity: 0.35,
        label: 'Céu Marciano (CO2 e Óxidos)',
      };
    }

    // Venus / Dense Greenhouse
    if (bodyId === 'venus' || classification === 'dense-atmosphere-rocky') {
      return {
        hasSkyDome: true,
        top: new Color('#a8682a'),
        horizon: new Color('#d49746'),
        zenith: new Color('#4c280d'),
        glow: new Color('#ffaf4d'),
        sunColor: new Color('#ffe3a6'),
        fogColor: new Color('#8a521e'),
        fogNear: 400,
        fogFar: 4500,
        skyDensity: 0.95,
        label: 'Supercrítica Venusiana',
      };
    }

    // Titan / Methane Moon
    if (bodyId === 'titan' || classification === 'atmospheric-moon') {
      return {
        hasSkyDome: true,
        top: new Color('#879447'),
        horizon: new Color('#cca25a'),
        zenith: new Color('#36401e'),
        glow: new Color('#e0b86a'),
        sunColor: new Color('#ffd585'),
        fogColor: new Color('#75753b'),
        fogNear: 1200,
        fogFar: 14000,
        skyDensity: 0.75,
        label: 'Névoa de Hidrocarbonetos',
      };
    }

    // Volcanic / Magma Worlds
    if (classification === 'volcanic-rocky' || classification === 'volcanic-moon') {
      return {
        hasSkyDome: true,
        top: new Color('#733215'),
        horizon: new Color('#bf5a22'),
        zenith: new Color('#2e1107'),
        glow: new Color('#ff772e'),
        sunColor: new Color('#ffb073'),
        fogColor: new Color('#692a10'),
        fogNear: 800,
        fogFar: 10000,
        skyDensity: 0.8,
        label: 'Bruma Sulfúrica e Cinzas',
      };
    }

    // Cryogenic Worlds
    if (classification === 'frozen-rocky' || (biosphere && biosphere.averageTemperatureK < 165)) {
      return {
        hasSkyDome: true,
        top: new Color('#678da8'),
        horizon: new Color('#a9cbde'),
        zenith: new Color('#274357'),
        glow: new Color('#cce7f7'),
        sunColor: new Color('#f0f7ff'),
        fogColor: new Color('#8fb0c2'),
        fogNear: 1500,
        fogFar: 18000,
        skyDensity: 0.45,
        label: 'Atmosfera Crio-polar',
      };
    }

    // Alien Bioluminescent / Living Worlds
    if (biosphere && (biosphere.lifeTier === 'fauna' || biosphere.lifeTier === 'civilized')) {
      if (biosphere.dominantVegetationType === 'bioluminescent-canopy' || biosphere.dominantVegetationType === 'fungal-spores') {
        return {
          hasSkyDome: true,
          top: new Color('#32687a'),
          horizon: new Color('#52b39f'),
          zenith: new Color('#122a36'),
          glow: new Color('#65fad1'),
          sunColor: new Color('#d4fce8'),
          fogColor: new Color('#2d6961'),
          fogNear: 2000,
          fogFar: 24000,
          skyDensity: 0.55,
          label: 'Atmosfera Bioluminescente Exótica',
        };
      }
    }

    // Default Earth-like / Breathable
    return {
      hasSkyDome: true,
      top: new Color('#4e8bb2'),
      horizon: new Color('#cfdfdd'),
      zenith: new Color('#1b5896'),
      glow: new Color('#ffe9c4'),
      sunColor: new Color('#fff4d8'),
      fogColor: new Color('#d2bb98'),
      fogNear: 2800,
      fogFar: 26000,
      skyDensity: 0.5,
      label: 'Atmosfera Temperada Padrão',
    };
  }
}
