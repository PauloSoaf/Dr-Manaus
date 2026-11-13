/**
 * PlanetaryBiomeService.ts
 *
 * Deterministic climate and biome classification engine for planetary surfaces.
 * Evaluates local temperature, moisture, and ecosystem parameters per surface coordinate (lat, lon, altitude).
 * Strictly deterministic, non-allocating where possible, and powered by the body's PlanetaryBiosphereProfile.
 */

import type { PlanetaryBiosphereProfile, DominantVegetationType } from './PlanetaryBiosphere';

export type PlanetaryBiomeType =
  // Aquatic / Marine
  | 'deep-abyss'
  | 'oceanic-shelf'
  | 'coastal-waters'
  | 'methane-sea'
  | 'ammonia-basin'
  // Sterile / Vacuum / High Radiation
  | 'barren-rock'
  | 'cratered-highlands'
  | 'basalt-plains'
  | 'vacuum-dust'
  | 'extreme-cryo-ice'
  // Hostile / Volcanic / Silicon
  | 'magma-fields'
  | 'sulfuric-wastes'
  | 'scorched-crags'
  | 'crystal-desert'
  // Cryogenic / Exotic Solvents
  | 'tholin-plateaus'
  | 'cryo-dunes'
  | 'nitrogen-plains'
  // Vegetative / Living Worlds
  | 'alien-rainforest'
  | 'fungal-canopy'
  | 'bioluminescent-wetlands'
  | 'temperate-woodland'
  | 'savanna-steppe'
  | 'alien-taiga'
  | 'subpolar-lichen'
  | 'glacial-cap';

export type FloraArchetype =
  | 'none'
  | 'bioluminescent-fungi'
  | 'giant-spore-trees'
  | 'crystalline-spires'
  | 'alien-conifers'
  | 'canopy-broadleaf'
  | 'xenoflora-succulents'
  | 'hydrocarbon-tendrils';

export interface PlanetaryBiomeColorPalette {
  readonly surface: number;
  readonly rock: number;
  readonly foliage: number;
  readonly liquid: number;
}

export interface PlanetaryBiomeSample {
  readonly biomeId: PlanetaryBiomeType;
  readonly displayName: string;
  readonly temperatureK: number;
  readonly temperatureC: number;
  readonly moisture: number; // 0..1
  readonly isUnderwater: boolean;
  readonly vegetationDensity: number; // 0..1
  readonly floraArchetype: FloraArchetype;
  readonly colorPalette: PlanetaryBiomeColorPalette;
}

export interface BiomeSampleParams {
  readonly biosphere: PlanetaryBiosphereProfile;
  readonly latRad: number; // -PI/2 to PI/2
  readonly lonRad: number; // -PI to PI
  readonly altitudeM?: number; // relative to surface datum / sea level
  readonly seaLevelM?: number; // default 0
}

interface BiomeDefinition {
  readonly displayName: string;
  readonly defaultFlora: FloraArchetype;
  readonly baseVegetationDensity: number;
  readonly palette: PlanetaryBiomeColorPalette;
}

const BIOME_DEFINITIONS: Record<PlanetaryBiomeType, BiomeDefinition> = {
  // Aquatic
  'deep-abyss': {
    displayName: 'Abismo Oceânico Profundo',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x051025, rock: 0x030814, foliage: 0x000000, liquid: 0x020b1e },
  },
  'oceanic-shelf': {
    displayName: 'Plataforma Oceânica',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x0b2d4f, rock: 0x061e36, foliage: 0x000000, liquid: 0x0e4170 },
  },
  'coastal-waters': {
    displayName: 'Águas Costeiras Rasas',
    defaultFlora: 'none',
    baseVegetationDensity: 0.05,
    palette: { surface: 0x1b556b, rock: 0x2d434d, foliage: 0x156348, liquid: 0x1e6f85 },
  },
  'methane-sea': {
    displayName: 'Mar de Metano Líquido',
    defaultFlora: 'hydrocarbon-tendrils',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x141e1b, rock: 0x28312b, foliage: 0x22382e, liquid: 0x1a2e26 },
  },
  'ammonia-basin': {
    displayName: 'Bacia de Amônia Criogênica',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x1c2333, rock: 0x2d3240, foliage: 0x000000, liquid: 0x2b3b59 },
  },

  // Sterile / Vacuum
  'barren-rock': {
    displayName: 'Rególito Rochoso Estéril',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x5a5652, rock: 0x3d3a37, foliage: 0x000000, liquid: 0x000000 },
  },
  'cratered-highlands': {
    displayName: 'Terras Altas Craterizadas',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x7c7873, rock: 0x585551, foliage: 0x000000, liquid: 0x000000 },
  },
  'basalt-plains': {
    displayName: 'Planícies de Basalto Vulcânico',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x2b2927, rock: 0x1e1d1b, foliage: 0x000000, liquid: 0x000000 },
  },
  'vacuum-dust': {
    displayName: 'Mares de Poeira no Vácuo',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x47423e, rock: 0x35312e, foliage: 0x000000, liquid: 0x000000 },
  },
  'extreme-cryo-ice': {
    displayName: 'Gelo Glacial Criogênico',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x98b5cf, rock: 0x6e889e, foliage: 0x000000, liquid: 0x000000 },
  },

  // Hostile / Volcanic
  'magma-fields': {
    displayName: 'Campos de Magma Ativo',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x29120c, rock: 0x190805, foliage: 0xff3b00, liquid: 0xff5500 },
  },
  'sulfuric-wastes': {
    displayName: 'Ermos Sulfúricos Corrosivos',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x736c28, rock: 0x4f4917, foliage: 0x8a7f1a, liquid: 0x998c17 },
  },
  'scorched-crags': {
    displayName: 'Penhascos Calcinados',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x3d312a, rock: 0x241d19, foliage: 0x000000, liquid: 0x000000 },
  },
  'crystal-desert': {
    displayName: 'Deserto de Cristais Minerais',
    defaultFlora: 'crystalline-spires',
    baseVegetationDensity: 0.15,
    palette: { surface: 0x8f7d6b, rock: 0x5e4f40, foliage: 0x6ee2d8, liquid: 0x000000 },
  },

  // Cryogenic
  'tholin-plateaus': {
    displayName: 'Planalto de Tolinas Alaranjadas',
    defaultFlora: 'hydrocarbon-tendrils',
    baseVegetationDensity: 0.05,
    palette: { surface: 0x7a432b, rock: 0x542917, foliage: 0xa85c3b, liquid: 0x211714 },
  },
  'cryo-dunes': {
    displayName: 'Dunas Criogênicas de Hidrocarbonetos',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x543b2f, rock: 0x3d271c, foliage: 0x000000, liquid: 0x000000 },
  },
  'nitrogen-plains': {
    displayName: 'Planícies de Nitrogênio Congelado',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0x8fa3a1, rock: 0x607371, foliage: 0x000000, liquid: 0x000000 },
  },

  // Vegetative
  'alien-rainforest': {
    displayName: 'Floresta Pluvial Alienígena',
    defaultFlora: 'canopy-broadleaf',
    baseVegetationDensity: 0.9,
    palette: { surface: 0x1d361d, rock: 0x2a3828, foliage: 0x1b6329, liquid: 0x1a453e },
  },
  'fungal-canopy': {
    displayName: 'Dossel de Fungos Gigantes',
    defaultFlora: 'giant-spore-trees',
    baseVegetationDensity: 0.8,
    palette: { surface: 0x2f1f38, rock: 0x3d2a47, foliage: 0x85369c, liquid: 0x2a1533 },
  },
  'bioluminescent-wetlands': {
    displayName: 'Pântano Bioluminescente',
    defaultFlora: 'bioluminescent-fungi',
    baseVegetationDensity: 0.85,
    palette: { surface: 0x122426, rock: 0x1a3033, foliage: 0x00d9b8, liquid: 0x0b3d3b },
  },
  'temperate-woodland': {
    displayName: 'Bosque Temperado',
    defaultFlora: 'canopy-broadleaf',
    baseVegetationDensity: 0.65,
    palette: { surface: 0x354024, rock: 0x474238, foliage: 0x3b6e22, liquid: 0x274954 },
  },
  'savanna-steppe': {
    displayName: 'Savana e Estepes Xéricas',
    defaultFlora: 'xenoflora-succulents',
    baseVegetationDensity: 0.35,
    palette: { surface: 0x695f3a, rock: 0x54472d, foliage: 0x827d3b, liquid: 0x3b5246 },
  },
  'alien-taiga': {
    displayName: 'Taiga Boreal Alienígena',
    defaultFlora: 'alien-conifers',
    baseVegetationDensity: 0.55,
    palette: { surface: 0x27362a, rock: 0x343d36, foliage: 0x184729, liquid: 0x233b47 },
  },
  'subpolar-lichen': {
    displayName: 'Tundra e Líquens Subpolares',
    defaultFlora: 'none',
    baseVegetationDensity: 0.2,
    palette: { surface: 0x505749, rock: 0x4a4740, foliage: 0x616e50, liquid: 0x354b57 },
  },
  'glacial-cap': {
    displayName: 'Calota Glacial Polar',
    defaultFlora: 'none',
    baseVegetationDensity: 0.0,
    palette: { surface: 0xd8e6f0, rock: 0x8ba2b5, foliage: 0x000000, liquid: 0x4f718c },
  },
};

/**
 * Multi-harmonic deterministic trigonometric perturbation for planetary climate.
 * Smoothly varies across sphere without discontinuities or external RNG states.
 */
function climatePerturbation(seed: number, latRad: number, lonRad: number): number {
  const s = (Math.abs(seed) % 10007) / 10007;
  const h1 = Math.sin(latRad * 3.7 + lonRad * 4.3 + s * 6.28318);
  const h2 = Math.cos(latRad * 7.1 - lonRad * 8.9 + s * 12.56637);
  const h3 = Math.sin(latRad * 15.3 + lonRad * 14.1 + s * 3.14159);
  return h1 * 0.5 + h2 * 0.35 + h3 * 0.15; // in range [-1.0, 1.0]
}

export class PlanetaryBiomeService {
  /**
   * Samples deterministic climate and biome type at a specific planetary coordinate.
   */
  static sampleBiome(params: BiomeSampleParams): PlanetaryBiomeSample {
    const { biosphere, latRad, lonRad } = params;
    const altitudeM = params.altitudeM ?? 0;
    const seaLevelM = params.seaLevelM ?? 0;
    const isUnderwater = altitudeM < seaLevelM;

    const noise = climatePerturbation(biosphere.seeds.climateSeed, latRad, lonRad);

    // 1. Calculate local temperature in Kelvin
    const baseTempK = biosphere.averageTemperatureK;
    const hasAtmosphere = biosphere.atmosphereBreathability !== 'vacuum-sealed-suit';
    const atmFactor = hasAtmosphere ? 1.0 : 0.0;
    const poleDropK = 35 + (1 - atmFactor) * 45; // 35K to 80K drop at poles
    const latFactor = Math.sin(latRad) * Math.sin(latRad); // 0 at equator, 1 at poles

    // Lapse rate (cooling with altitude)
    const lapseRate = 0.0065 * Math.max(0.1, Math.min(1.5, atmFactor)); // ~6.5 K/km
    const altitudeDropK = Math.max(0, altitudeM - seaLevelM) * lapseRate;

    // Local temperature perturbation: +/- 8 K
    const tempNoiseK = noise * 8.0;

    let temperatureK = baseTempK - poleDropK * latFactor - altitudeDropK + tempNoiseK;
    temperatureK = Math.max(2.7, temperatureK); // Cosmic CMB floor
    const temperatureC = temperatureK - 273.15;

    // 2. Calculate local moisture (0..1)
    let moisture = 0.0;
    if (isUnderwater) {
      moisture = 1.0;
    } else if (!hasAtmosphere || biosphere.lifeTier === 'sterile') {
      moisture = 0.0;
    } else {
      // Atmospheric circulation precipitation profile:
      // Equatorial maximum (|lat| < 15 deg), Subtropical dry belt (20-35 deg), Temperate rains (40-60 deg), Polar dry (> 65 deg)
      const absLatDeg = (Math.abs(latRad) * 180) / Math.PI;
      let baseMoist = 0.5;
      if (absLatDeg < 15) {
        baseMoist = 0.85; // ITCZ wet belt
      } else if (absLatDeg >= 15 && absLatDeg < 35) {
        baseMoist = 0.25; // Subtropical arid zone
      } else if (absLatDeg >= 35 && absLatDeg < 62) {
        baseMoist = 0.65; // Mid-latitude temperate storms
      } else {
        baseMoist = 0.15; // Polar desert
      }

      // Perturb moisture by climate noise: +/- 0.25
      moisture = Math.max(0.0, Math.min(1.0, baseMoist + noise * 0.25));

      // Arid modulation if biosphere is not carbon-water
      if (biosphere.biochemistry !== 'carbon-water') {
        moisture *= 0.2;
      }
    }

    // 3. Classify Biome
    const biomeId = PlanetaryBiomeService.classifyBiome({
      biosphere,
      temperatureK,
      moisture,
      isUnderwater,
      altitudeM,
      seaLevelM,
    });

    const def = BIOME_DEFINITIONS[biomeId];

    // Determine flora archetype and vegetation density
    let floraArchetype = def.defaultFlora;
    let vegetationDensity = def.baseVegetationDensity;

    // If life tier is sterile, no vegetation regardless of biome default
    if (biosphere.lifeTier === 'sterile') {
      floraArchetype = 'none';
      vegetationDensity = 0.0;
    } else if (biosphere.lifeTier === 'microbial') {
      floraArchetype = 'none';
      vegetationDensity = Math.min(0.1, vegetationDensity * 0.2);
    } else {
      // Scale vegetation density by moisture and temperature friendliness
      if (!isUnderwater) {
        const tempFriendly = Math.max(0.1, 1.0 - Math.abs(temperatureK - 295) / 60);
        vegetationDensity = Math.max(0.0, Math.min(1.0, vegetationDensity * (0.5 + 0.5 * moisture) * tempFriendly));
      }
    }

    // Adapt flora archetype according to dominant vegetation
    if (floraArchetype !== 'none') {
      if (biosphere.dominantVegetationType === 'crystalline-shrubs' || biosphere.biochemistry === 'silicon-hydrocarbon') {
        floraArchetype = 'crystalline-spires';
      } else if (biosphere.dominantVegetationType === 'bioluminescent-canopy') {
        floraArchetype = 'bioluminescent-fungi';
      } else if (biosphere.dominantVegetationType === 'fungal-spores') {
        floraArchetype = 'giant-spore-trees';
      } else if (biosphere.biochemistry === 'ammonia-solvent') {
        floraArchetype = 'hydrocarbon-tendrils';
      }
    }

    return {
      biomeId,
      displayName: def.displayName,
      temperatureK,
      temperatureC,
      moisture,
      isUnderwater,
      vegetationDensity,
      floraArchetype,
      colorPalette: def.palette,
    };
  }

  private static classifyBiome(context: {
    biosphere: PlanetaryBiosphereProfile;
    temperatureK: number;
    moisture: number;
    isUnderwater: boolean;
    altitudeM: number;
    seaLevelM: number;
  }): PlanetaryBiomeType {
    const { biosphere, temperatureK, moisture, isUnderwater, altitudeM, seaLevelM } = context;

    // Submerged / Marine classification
    if (isUnderwater) {
      if (biosphere.bodyId === 'titan' || biosphere.averageTemperatureK < 120) {
        return 'methane-sea';
      }
      if (biosphere.biochemistry === 'ammonia-solvent') {
        return 'ammonia-basin';
      }
      const depth = seaLevelM - altitudeM;
      if (depth > 250) return 'deep-abyss';
      if (depth > 40) return 'oceanic-shelf';
      return 'coastal-waters';
    }

    // Extreme temperature environments
    if (temperatureK > 700) {
      return 'magma-fields';
    }
    if (temperatureK > 450) {
      return 'sulfuric-wastes';
    }
    if (temperatureK > 373 && biosphere.atmosphereBreathability === 'vacuum-sealed-suit') {
      return 'scorched-crags';
    }
    if (temperatureK < 100) {
      if (biosphere.bodyId === 'titan' || biosphere.classification === 'ice-giant') {
        if (altitudeM > 1000) return 'tholin-plateaus';
        if (moisture < 0.3) return 'cryo-dunes';
        return 'nitrogen-plains';
      }
      return 'extreme-cryo-ice';
    }

    // Sterile / Airless worlds (e.g. Moon, Mercury)
    if (biosphere.lifeTier === 'sterile') {
      if (biosphere.biochemistry === 'silicon-hydrocarbon') {
        return 'crystal-desert';
      }
      if (altitudeM > 1500) {
        return 'cratered-highlands';
      }
      if (altitudeM < -500) {
        return 'basalt-plains';
      }
      if (biosphere.atmosphereBreathability === 'vacuum-sealed-suit') {
        return 'vacuum-dust';
      }
      return 'barren-rock';
    }

    // Silicon biochemistry worlds
    if (biosphere.biochemistry === 'silicon-hydrocarbon') {
      return 'crystal-desert';
    }

    // Habitable / Vegetative / Fauna Whittaker matrix
    if (temperatureK < 263) {
      // Sub-zero freezing
      return 'glacial-cap';
    }
    if (temperatureK < 273) {
      // Near freezing
      if (moisture > 0.4) return 'alien-taiga';
      return 'subpolar-lichen';
    }
    if (temperatureK < 290) {
      // Temperate
      if (moisture > 0.65) {
        return biosphere.lifeTier === 'vegetative' || biosphere.lifeTier === 'fauna'
          ? 'fungal-canopy'
          : 'temperate-woodland';
      }
      if (moisture > 0.3) return 'temperate-woodland';
      return 'savanna-steppe';
    }

    // Warm to Tropical (T >= 290 K)
    if (moisture > 0.7) {
      if (biosphere.dominantVegetationType === 'bioluminescent-canopy') {
        return 'bioluminescent-wetlands';
      }
      return 'alien-rainforest';
    }
    if (moisture > 0.35) {
      return 'savanna-steppe';
    }
    return 'crystal-desert';
  }

  /**
   * Quick lookup for biome definition metadata.
   */
  static getBiomeDefinition(biomeId: PlanetaryBiomeType): BiomeDefinition {
    return BIOME_DEFINITIONS[biomeId];
  }
}
