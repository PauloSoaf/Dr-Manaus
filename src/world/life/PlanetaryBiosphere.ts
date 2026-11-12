import type { CelestialBody } from '../celestial/CelestialBody';
import type { CelestialBodyProfile, WorldClassification } from '../celestial/CelestialBodyProfile';

export type LifeTier =
  | 'sterile'
  | 'microbial'
  | 'vegetative'
  | 'fauna'
  | 'civilized';

export type BiochemistryType =
  | 'carbon-water'
  | 'silicon-hydrocarbon'
  | 'ammonia-solvent'
  | 'mineral-geothermal'
  | 'none';

export type DominantVegetationType =
  | 'none'
  | 'fungal-spores'
  | 'crystalline-shrubs'
  | 'bioluminescent-canopy'
  | 'chlorophyll-broadleaf'
  | 'silicate-lichens';

export type DominantFaunaType =
  | 'none'
  | 'amphibious-crawlers'
  | 'chitinous-quadrupeds'
  | 'avian-gliders'
  | 'serpentine-burrowers'
  | 'bipedal-predators';

export type CivilizationStage =
  | 'none'
  | 'tribal-clans'
  | 'modular-colonies'
  | 'advanced-industrial'
  | 'ancient-ruins-guardians';

export type AtmosphereBreathability =
  | 'breathable'
  | 'toxic-respirator-required'
  | 'corrosive-hazard'
  | 'vacuum-sealed-suit';

export type RadiationLevel =
  | 'negligible'
  | 'moderate'
  | 'lethal-cosmic';

export interface PlanetarySeedChannels {
  readonly rootSeed: number;
  readonly climateSeed: number;
  readonly lifeSeed: number;
  readonly floraSeed: number;
  readonly faunaSeed: number;
  readonly factionSeed: number;
}

export interface PlanetaryBiosphereProfile {
  readonly schemaVersion: 1;
  readonly bodyId: string;
  readonly classification: WorldClassification;
  readonly seeds: PlanetarySeedChannels;
  readonly lifeTier: LifeTier;
  readonly biochemistry: BiochemistryType;
  readonly habitabilityScore: number; // 0.0 to 1.0
  readonly dominantVegetationType: DominantVegetationType;
  readonly dominantFaunaType: DominantFaunaType;
  readonly civilizationStage: CivilizationStage;
  readonly atmosphereBreathability: AtmosphereBreathability;
  readonly radiationLevel: RadiationLevel;
  readonly averageTemperatureK: number;
  readonly description: string;
}

/**
 * 32-bit FNV-1a hash for deterministic seed derivation.
 */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Derives independent orthogonal seed channels from a root seed.
 */
export function deriveSeedChannels(bodyId: string, systemSeed = 0n): PlanetarySeedChannels {
  const root = (hashString(bodyId) ^ Number(systemSeed & 0xffffffffn)) >>> 0;

  const mix = (channelSalt: number): number => {
    let h = (root ^ channelSalt) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  };

  return {
    rootSeed: root,
    climateSeed: mix(0x1a85ec53),
    lifeSeed: mix(0x2bb9d417),
    floraSeed: mix(0x3c7e098b),
    faunaSeed: mix(0x4f128d43),
    factionSeed: mix(0x5e91b2c7),
  };
}

class SeedRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  nextFloat(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return (this.state >>> 0) / 0xffffffff;
  }
  pick<T>(items: readonly T[]): T {
    const idx = Math.floor(this.nextFloat() * items.length);
    return items[Math.min(idx, items.length - 1)];
  }
  chance(probability: number): boolean {
    return this.nextFloat() < probability;
  }
}

/**
 * Generates an authoritative, deterministic biosphere profile for any celestial body.
 */
export function generatePlanetaryBiosphere(
  body: CelestialBody,
  profile?: CelestialBodyProfile,
  systemSeed = 0n
): PlanetaryBiosphereProfile {
  const channels = deriveSeedChannels(body.id, systemSeed);
  const lifeRng = new SeedRng(channels.lifeSeed);
  const floraRng = new SeedRng(channels.floraSeed);
  const faunaRng = new SeedRng(channels.faunaSeed);
  const factionRng = new SeedRng(channels.factionSeed);

  const env = profile?.environment;
  const classification: WorldClassification = env?.classification ?? 'rocky-moon';
  const tempK = env?.temperatureK ?? 250;
  const hasAtmosphere = profile?.hasAtmosphere ?? false;
  const pressureAtm = env?.atmosphericPressureAtm ?? (hasAtmosphere ? 1.0 : 0);

  // 1. Gas giants, stars, and black holes cannot harbor conventional surface biospheres
  if (
    classification === 'star' ||
    classification === 'gas-giant' ||
    classification === 'ice-giant'
  ) {
    return {
      schemaVersion: 1,
      bodyId: body.id,
      classification,
      seeds: channels,
      lifeTier: 'sterile',
      biochemistry: 'none',
      habitabilityScore: 0.0,
      dominantVegetationType: 'none',
      dominantFaunaType: 'none',
      civilizationStage: 'none',
      atmosphereBreathability: 'corrosive-hazard',
      radiationLevel: classification === 'star' ? 'lethal-cosmic' : 'moderate',
      averageTemperatureK: tempK,
      description: 'Ambiente inóspito sem superfície sólida habitável.',
    };
  }

  // 2. Canonical Solar System Bodies
  if (body.id === 'earth') {
    return {
      schemaVersion: 1,
      bodyId: 'earth',
      classification: 'oceanic-rocky',
      seeds: channels,
      lifeTier: 'civilized',
      biochemistry: 'carbon-water',
      habitabilityScore: 1.0,
      dominantVegetationType: 'chlorophyll-broadleaf',
      dominantFaunaType: 'bipedal-predators',
      civilizationStage: 'advanced-industrial',
      atmosphereBreathability: 'breathable',
      radiationLevel: 'negligible',
      averageTemperatureK: 288,
      description: 'Berço da civilização humana, biosfera rica com oceanos líquidos e vasta cobertura vegetal.',
    };
  }

  if (body.id === 'moon' || body.id === 'mercury') {
    return {
      schemaVersion: 1,
      bodyId: body.id,
      classification: 'rocky-moon',
      seeds: channels,
      lifeTier: 'sterile',
      biochemistry: 'none',
      habitabilityScore: 0.0,
      dominantVegetationType: 'none',
      dominantFaunaType: 'none',
      civilizationStage: 'none',
      atmosphereBreathability: 'vacuum-sealed-suit',
      radiationLevel: 'moderate',
      averageTemperatureK: tempK,
      description: 'Mundo árido em vácuo total, bombardeado por radiação solar sem biosfera ativa.',
    };
  }

  if (body.id === 'mars') {
    return {
      schemaVersion: 1,
      bodyId: 'mars',
      classification: 'arid-rocky',
      seeds: channels,
      lifeTier: 'microbial',
      biochemistry: 'carbon-water',
      habitabilityScore: 0.18,
      dominantVegetationType: 'silicate-lichens',
      dominantFaunaType: 'none',
      civilizationStage: 'none',
      atmosphereBreathability: 'toxic-respirator-required',
      radiationLevel: 'moderate',
      averageTemperatureK: 210,
      description: 'Deserto vermelho com permafrost polar e colônias bacterianas extremófilas subterrâneas.',
    };
  }

  if (body.id === 'titan') {
    return {
      schemaVersion: 1,
      bodyId: 'titan',
      classification: 'atmospheric-moon',
      seeds: channels,
      lifeTier: 'microbial',
      biochemistry: 'silicon-hydrocarbon',
      habitabilityScore: 0.32,
      dominantVegetationType: 'crystalline-shrubs',
      dominantFaunaType: 'none',
      civilizationStage: 'none',
      atmosphereBreathability: 'toxic-respirator-required',
      radiationLevel: 'negligible',
      averageTemperatureK: 94,
      description: 'Mundo criogênico com lagos de metano líquido e bioquímica exótica baseada em hidrocarbonetos.',
    };
  }

  // 3. Procedural Solid Worlds
  let lifeTier: LifeTier = 'sterile';
  let biochemistry: BiochemistryType = 'none';
  let habitabilityScore = 0.0;
  let dominantVegetation: DominantVegetationType = 'none';
  let dominantFauna: DominantFaunaType = 'none';
  let civilizationStage: CivilizationStage = 'none';
  let breathability: AtmosphereBreathability = 'vacuum-sealed-suit';
  let radiation: RadiationLevel = 'moderate';
  let desc = '';

  const inHabitableThermalZone = tempK >= 220 && tempK <= 350;
  const hasDenseAtmosphere = pressureAtm >= 0.2;

  if (!hasAtmosphere || pressureAtm < 0.01) {
    // Airless vacuum bodies
    breathability = 'vacuum-sealed-suit';
    radiation = 'lethal-cosmic';
    if (lifeRng.chance(0.04) && tempK > 150) {
      lifeTier = 'microbial';
      biochemistry = 'mineral-geothermal';
      habitabilityScore = 0.05;
      desc = 'Organismos quimiotróficos microscópicos habitando fissuras geotermais profundas no vácuo.';
    } else {
      desc = 'Mundo estéril e desprovido de atmosfera ou biosfera observável.';
    }
  } else if (classification === 'volcanic-rocky' || tempK > 450) {
    // Scorched volcanic worlds
    breathability = 'corrosive-hazard';
    radiation = 'moderate';
    if (lifeRng.chance(0.25)) {
      lifeTier = 'microbial';
      biochemistry = 'mineral-geothermal';
      habitabilityScore = 0.08;
      desc = 'Extremófilos hipertermofílicos sintetizando enxofre em fluxos de lava ativa.';
    } else {
      desc = 'Superfície vulcânica hiperaquecida estéril.';
    }
  } else if (classification === 'oceanic-rocky' && inHabitableThermalZone) {
    // Prime habitable oceanic worlds
    habitabilityScore = Number((0.65 + lifeRng.nextFloat() * 0.30).toFixed(2));
    biochemistry = 'carbon-water';
    radiation = 'negligible';
    breathability = lifeRng.chance(0.70) ? 'breathable' : 'toxic-respirator-required';

    const lifeRoll = lifeRng.nextFloat();
    if (lifeRoll < 0.35) {
      lifeTier = 'civilized';
      dominantVegetation = floraRng.pick([
        'chlorophyll-broadleaf',
        'bioluminescent-canopy',
        'fungal-spores',
      ]);
      dominantFauna = faunaRng.pick([
        'bipedal-predators',
        'amphibious-crawlers',
        'chitinous-quadrupeds',
        'avian-gliders',
      ]);
      civilizationStage = factionRng.pick([
        'tribal-clans',
        'modular-colonies',
        'advanced-industrial',
        'ancient-ruins-guardians',
      ]);
      desc = `Mundo oceânico florescente habitado por civilização em estágio de ${civilizationStage}.`;
    } else if (lifeRoll < 0.75) {
      lifeTier = 'fauna';
      dominantVegetation = floraRng.pick([
        'chlorophyll-broadleaf',
        'bioluminescent-canopy',
        'fungal-spores',
      ]);
      dominantFauna = faunaRng.pick([
        'amphibious-crawlers',
        'chitinous-quadrupeds',
        'avian-gliders',
        'serpentine-burrowers',
      ]);
      desc = 'Biosfera verdejante com fauna alienígena ativa e cadeias ecológicas autossustentáveis.';
    } else {
      lifeTier = 'vegetative';
      dominantVegetation = floraRng.pick([
        'chlorophyll-broadleaf',
        'bioluminescent-canopy',
        'fungal-spores',
      ]);
      desc = 'Extensas florestas e canópias vegetais sem presença identificada de animais superiores.';
    }
  } else if (classification === 'arid-rocky' && hasDenseAtmosphere) {
    // Desert worlds with atmosphere
    habitabilityScore = Number((0.25 + lifeRng.nextFloat() * 0.30).toFixed(2));
    biochemistry = lifeRng.chance(0.85) ? 'carbon-water' : 'silicon-hydrocarbon';
    breathability = lifeRng.chance(0.35) ? 'breathable' : 'toxic-respirator-required';
    radiation = 'moderate';

    const lifeRoll = lifeRng.nextFloat();
    if (lifeRoll < 0.20) {
      lifeTier = 'civilized';
      dominantVegetation = floraRng.pick(['silicate-lichens', 'crystalline-shrubs']);
      dominantFauna = faunaRng.pick(['serpentine-burrowers', 'chitinous-quadrupeds']);
      civilizationStage = factionRng.pick(['modular-colonies', 'tribal-clans', 'ancient-ruins-guardians']);
      desc = 'Mundo desértico árido abrigando assentamentos e postos avançados adaptados à escassez hídrica.';
    } else if (lifeRoll < 0.55) {
      lifeTier = 'fauna';
      dominantVegetation = floraRng.pick(['silicate-lichens', 'crystalline-shrubs']);
      dominantFauna = faunaRng.pick(['serpentine-burrowers', 'chitinous-quadrupeds']);
      desc = 'Ecossistema árido dominado por escavadores subterrâneos e predadores quitinosos.';
    } else if (lifeRoll < 0.85) {
      lifeTier = 'vegetative';
      dominantVegetation = floraRng.pick(['silicate-lichens', 'crystalline-shrubs']);
      desc = 'Vegetação xerófita adaptada com arbustos cristalinos e líquens nas rochas.';
    } else {
      lifeTier = 'microbial';
      desc = 'Microorganismos halófilos em oásis salinos e bacias secas.';
    }
  } else if (classification === 'frozen-rocky' || classification === 'icy-moon') {
    // Cryogenic worlds
    habitabilityScore = Number((0.08 + lifeRng.nextFloat() * 0.22).toFixed(2));
    biochemistry = lifeRng.chance(0.5) ? 'ammonia-solvent' : 'silicon-hydrocarbon';
    breathability = 'toxic-respirator-required';
    radiation = 'moderate';

    if (lifeRng.chance(0.30)) {
      lifeTier = 'vegetative';
      dominantVegetation = floraRng.pick(['crystalline-shrubs', 'fungal-spores']);
      desc = 'Colônias de fungos criogênicos e estruturas cristalinas fotossintetizantes sob o gelo.';
    } else if (lifeRng.chance(0.50)) {
      lifeTier = 'microbial';
      desc = 'Bactérias psicrófilas em bolsas de salmoura líquida sob calotas glaciais.';
    } else {
      lifeTier = 'sterile';
      desc = 'Estepes de gelo eterno sem sinais de vida biológica.';
    }
  } else {
    // Default fallback
    lifeTier = 'sterile';
    desc = 'Mundo desolado estéril.';
  }

  return {
    schemaVersion: 1,
    bodyId: body.id,
    classification,
    seeds: channels,
    lifeTier,
    biochemistry,
    habitabilityScore,
    dominantVegetationType: dominantVegetation,
    dominantFaunaType: dominantFauna,
    civilizationStage,
    atmosphereBreathability: breathability,
    radiationLevel: radiation,
    averageTemperatureK: tempK,
    description: desc,
  };
}
