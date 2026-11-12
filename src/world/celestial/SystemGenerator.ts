import { circularOrbitRateRadS, GRAVITATIONAL_CONSTANT_SI, type CelestialBody } from './CelestialBody';
import type { GeneratedStar } from './StarSector';
import type { CelestialBodyProfile, WorldClassification, WorldEnvironment } from './CelestialBodyProfile';
import { generatePlanetaryBiosphere } from '../life/PlanetaryBiosphere';

export type { WorldClassification, WorldEnvironment };

export interface ProceduralSystem {
  readonly starId: string;
  readonly star?: GeneratedStar;
  readonly seed: bigint;
  readonly bodies: readonly CelestialBody[];
}

/** Physical stellar radius from L = 4πR²σT⁴, relative to Solar values. */
export function generatedStarRadiusM(star: Pick<GeneratedStar, 'luminositySolar' | 'temperatureK'>): number {
  return 6.957e8 * Math.sqrt(star.luminositySolar) / (star.temperatureK / 5772) ** 2;
}

/** Morgan-Keenan spectral chromaticity and albedo for stars. */
export function stellarAlbedo(temperatureK: number, spectralClass?: string): readonly [number, number, number] {
  if (spectralClass === 'O' || temperatureK >= 30000) return [0.60, 0.72, 1.0];
  if (spectralClass === 'B' || temperatureK >= 10000) return [0.75, 0.85, 1.0];
  if (spectralClass === 'A' || temperatureK >= 7500) return [0.92, 0.95, 1.0];
  if (spectralClass === 'F' || temperatureK >= 6000) return [1.0, 0.96, 0.88];
  if (spectralClass === 'G' || (temperatureK >= 5200 && temperatureK < 6500)) return [1.0, 0.94, 0.82];
  if (spectralClass === 'K' || (temperatureK >= 3700 && temperatureK < 5200)) return [1.0, 0.68, 0.35];
  return [1.0, 0.38, 0.16];
}

/** Corona and outer glow halo scaling based on stellar spectral class and luminosity. */
export function stellarSolarGlow(
  spectralClass: string,
  luminositySolar: number,
): { readonly innerScale: number; readonly outerScale: number } {
  if (spectralClass === 'O' || luminositySolar > 10000) return { innerScale: 2.8, outerScale: 8.0 };
  if (spectralClass === 'B' || luminositySolar > 100) return { innerScale: 2.4, outerScale: 6.5 };
  if (spectralClass === 'A' || luminositySolar > 10) return { innerScale: 2.2, outerScale: 5.5 };
  if (spectralClass === 'F' || spectralClass === 'G') return { innerScale: 2.0, outerScale: 5.0 };
  if (spectralClass === 'K') return { innerScale: 1.8, outerScale: 4.2 };
  return { innerScale: 1.5, outerScale: 3.5 };
}

/** User-facing description of stellar type and astrophysical context. */
export function describeSpectralClass(spectralClass: string, temperatureK: number, luminositySolar: number): string {
  const t = Math.round(temperatureK);
  switch (spectralClass) {
    case 'O': return `Supergigante / Estrela azul hiperluminosa de classe O (${t} K, ${luminositySolar.toFixed(0)} L☉).`;
    case 'B': return `Estrela azul-esbranquiçada de classe B de alta luminosidade (${t} K, ${luminositySolar.toFixed(0)} L☉).`;
    case 'A': return `Estrela branca da sequência principal de classe A (${t} K, ${luminositySolar.toFixed(1)} L☉).`;
    case 'F': return `Estrela amarelo-esbranquiçada de classe F (${t} K, ${luminositySolar.toFixed(1)} L☉).`;
    case 'G': return `Estrela anã amarela de classe G, análoga ao Sol (${t} K, ${luminositySolar.toFixed(2)} L☉).`;
    case 'K': return `Anã laranja de classe K de longa duração (${t} K, ${luminositySolar.toFixed(2)} L☉).`;
    case 'M': return `Anã vermelha de classe M com emissão preponderantemente infravermelha (${t} K, ${luminositySolar.toFixed(3)} L☉).`;
    default: return `Estrela estelar (${t} K).`;
  }
}

/**
 * Calculates planetary equilibrium surface temperature from stellar irradiance:
 * T_eq = T_star * sqrt(R_star / (2 * D_orbit)) * (1 - albedo)^0.25
 */
export function calculateEquilibriumTemperatureK(
  starTempK: number,
  starRadiusM: number,
  orbitDistanceM: number,
  albedo = 0.3,
): number {
  const safeDistance = Math.max(orbitDistanceM, starRadiusM * 1.5);
  const geometricalRatio = Math.sqrt(starRadiusM / (2 * safeDistance));
  const temp = starTempK * geometricalRatio * Math.pow(Math.max(0.01, 1 - albedo), 0.25);
  return Math.max(20, Math.round(temp));
}

/** Calculates surface gravity g = G * M / R² in m/s². */
export function calculateSurfaceGravityMps2(massKg: number, radiusM: number): number {
  if (radiusM <= 0 || massKg <= 0) return 0;
  const g = (GRAVITATIONAL_CONSTANT_SI * massKg) / (radiusM * radiusM);
  return Number(g.toFixed(2));
}

/** Pure deterministic hash stream for per-body attribute derivation without disturbing main PRNG. */
function bodySubRandom(seed: bigint, bodyId: string) {
  let h = seed;
  for (let i = 0; i < bodyId.length; i++) {
    h = (h * 31n + BigInt(bodyId.charCodeAt(i))) & 0xffff_ffff_ffff_ffffn;
  }
  h = (h ^ 0x5555_5555_5555_5555n) & 0xffff_ffff_ffff_ffffn;
  if (h === 0n) h = 0x9e37_79b9_7f4a_7c15n;
  return {
    nextFloat(): number {
      h ^= (h << 13n) & 0xffff_ffff_ffff_ffffn;
      h ^= h >> 7n;
      h ^= (h << 17n) & 0xffff_ffff_ffff_ffffn;
      h &= 0xffff_ffff_ffff_ffffn;
      return Number(h >> 11n) / 2 ** 53;
    },
    range(min: number, max: number): number {
      return min + (max - min) * this.nextFloat();
    },
    chance(p: number): boolean {
      return this.nextFloat() < p;
    },
  };
}

/** Legacy mass-only callers remain deterministic; catalog/materialization always supply GeneratedStar. */
export function generateSystem(starId: string, starSeed: bigint, properties: number | GeneratedStar): ProceduralSystem {
  let state = starSeed || 0x9e37_79b9_7f4a_7c15n;
  const nextFloat = () => {
    state ^= (state << 13n) & 0xffff_ffff_ffff_ffffn;
    state ^= state >> 7n;
    state ^= (state << 17n) & 0xffff_ffff_ffff_ffffn;
    state &= 0xffff_ffff_ffff_ffffn;
    return Number(state >> 11n) / 2 ** 53;
  };
  const nextInt = (min: number, max: number) => Math.floor(nextFloat() * (max - min + 1)) + min;

  const star: GeneratedStar = typeof properties === 'number' ? {
    id: starId, offsetM: [0, 0, 0], massSolar: properties, temperatureK: 5772 * Math.pow(properties, .5),
    luminositySolar: Math.pow(properties, 3.5), spectralClass: 'G', planetCount: nextInt(2, 10),
  } : properties;

  const starRadiusM = generatedStarRadiusM(star), starMassKg = 1.989e30 * star.massSolar;
  const starName = 'PX-' + starId.split('/').slice(1).join('-').replaceAll(',', '·');
  const bodies: CelestialBody[] = [];

  const starAlbedo = stellarAlbedo(star.temperatureK, star.spectralClass);
  const starGlow = stellarSolarGlow(star.spectralClass, star.luminositySolar);

  const starProfile: CelestialBodyProfile = {
    bodyClass: 'star',
    hasSolidSurface: false,
    canLand: false,
    landingMode: 'none',
    hasAtmosphere: false,
    supportsVolumeDestruction: false,
    surfaceKind: 'none',
    visual: {
      albedo: starAlbedo,
      solarGlow: starGlow,
      labelPriority: 10,
    },
    environment: {
      classification: 'star',
      label: `Estrela Classe ${star.spectralClass}`,
      temperatureK: Math.round(star.temperatureK),
      surfaceGravityMps2: calculateSurfaceGravityMps2(starMassKg, starRadiusM),
      description: describeSpectralClass(star.spectralClass, star.temperatureK, star.luminositySolar),
    },
  };

  const starBody: CelestialBody = {
    id: starId,
    name: starName,
    equatorialRadiusM: starRadiusM,
    polarRadiusM: starRadiusM,
    massKg: starMassKg,
    rotationPeriodS: 2.14e6,
    frameId: starId + '-fixed',
    stellar: {
      temperatureK: star.temperatureK,
      luminositySolar: star.luminositySolar,
      spectralClass: star.spectralClass,
    },
    profile: starProfile,
  };

  if (starProfile.environment) {
    (starProfile.environment as { biosphere?: unknown }).biosphere = generatePlanetaryBiosphere(starBody, starProfile, starSeed);
  }

  bodies.push(starBody);

  let currentOrbitM = Math.max(5e10, starRadiusM * 12);

  for (let i = 0; i < star.planetCount; i++) {
    currentOrbitM += nextFloat() * 1.5e11 + 2e10;
    const draw = nextFloat(), giant = i > 0 && draw > .55, icy = giant && draw > .82;
    const radiusM = giant ? (icy ? 1.8e7 + nextFloat() * 1.5e7 : 3e7 + nextFloat() * 4e7) : 2e6 + nextFloat() * 6e6;
    const density = giant ? (icy ? 1600 : 1300) : 5500;
    const massKg = 4 / 3 * Math.PI * radiusM ** 3 * density;
    const planetId = starId + '_planet_' + i, planetName = starName + ' ' + String.fromCharCode(98 + i);

    // Consume base draws from main PRNG in exact sequence
    let baseHasAtmosphere = false;
    let baseAlbedo: [number, number, number];
    if (giant) {
      if (icy) {
        baseAlbedo = [.18, .55 + nextFloat() * .25, .85];
      } else {
        baseAlbedo = [.7 + nextFloat() * .2, .45 + nextFloat() * .2, .25 + nextFloat() * .2];
      }
      baseHasAtmosphere = true;
    } else {
      baseHasAtmosphere = nextFloat() > .7;
      baseAlbedo = [.3 + nextFloat() * .45, .2 + nextFloat() * .4, .15 + nextFloat() * .35];
    }

    const rotationPeriodS = 10000 + nextFloat() * 172800;
    const phaseRad = nextFloat() * Math.PI * 2;
    const inclinationRad = (nextFloat() - .5) * .12;

    // Derived physical & visual characteristics via deterministic sub-random
    const sub = bodySubRandom(starSeed, planetId);
    const tempK = calculateEquilibriumTemperatureK(star.temperatureK, starRadiusM, currentOrbitM, baseAlbedo[0]);
    const gravity = calculateSurfaceGravityMps2(massKg, radiusM);

    let profile: CelestialBodyProfile;

    if (giant) {
      if (icy) {
        // Ice Giant (Uranian / Neptunian)
        const hasRings = sub.chance(0.35);
        const bands = sub.chance(0.5) ? 6 : 4;
        const albedo: [number, number, number] = sub.chance(0.5) ? [0.38, 0.78, 0.86] : [0.14, 0.35, 0.84];
        profile = {
          bodyClass: 'ice-giant',
          hasSolidSurface: false,
          canLand: false,
          landingMode: 'none',
          hasAtmosphere: true,
          supportsVolumeDestruction: false,
          surfaceKind: 'none',
          visual: {
            albedo,
            bands,
            haze: { radiusScale: 1.06, strength: 0.25 },
            rings: hasRings ? { innerRadius: 1.3, outerRadius: 1.75, minimumDiameterPx: 4 } : undefined,
            minimumVisiblePx: 2.5,
            labelPriority: 6,
          },
          environment: {
            classification: 'ice-giant',
            label: 'Gigante Gelado',
            temperatureK: tempK,
            surfaceGravityMps2: gravity,
            hasRings,
            description: hasRings
              ? 'Gigante gelado rico em água, amônia e metano com sistema de anéis analíticos.'
              : 'Gigante gelado rico em compostos voláteis supercríticos e ventos de alta velocidade.',
          },
        };
      } else {
        // Gas Giant (Jovian / Saturnian / Hot Jupiter)
        const isHotJupiter = tempK > 380;
        const hasRings = !isHotJupiter && sub.chance(0.42);
        const bands = sub.chance(0.5) ? 16 : 12;
        let albedo: [number, number, number];
        if (isHotJupiter) {
          albedo = [0.68, 0.38, 0.22];
        } else if (sub.chance(0.5)) {
          albedo = [0.82, 0.74, 0.52]; // Saturnian golden
        } else {
          albedo = [0.76, 0.58, 0.42]; // Jovian striped
        }
        profile = {
          bodyClass: 'gas-giant',
          hasSolidSurface: false,
          canLand: false,
          landingMode: 'none',
          hasAtmosphere: true,
          supportsVolumeDestruction: false,
          surfaceKind: 'none',
          visual: {
            albedo,
            bands,
            rings: hasRings ? { innerRadius: 1.25, outerRadius: 2.2, minimumDiameterPx: 6 } : undefined,
            minimumVisiblePx: 2.5,
            labelPriority: 6,
          },
          environment: {
            classification: 'gas-giant',
            label: isHotJupiter ? 'Júpiter Quente (Gasoso)' : hasRings ? 'Gigante Gasoso c/ Anéis' : 'Gigante Gasoso',
            temperatureK: tempK,
            surfaceGravityMps2: gravity,
            hasRings,
            description: hasRings
              ? 'Gigante gasoso com bandas atmosféricas turbulentas e magnífico sistema de anéis.'
              : isHotJupiter
                ? 'Gigante gasoso em órbita próxima com atmosfera superior superaquecida.'
                : 'Gigante gasoso com bandas de nuvens turbulentas de hidrogênio e hélio.',
          },
        };
      }
    } else {
      // Solid Worlds (Arid, Frozen, Volcanic, Dense Atmosphere, Oceanic)
      let classification: WorldClassification;
      let label: string;
      let description: string;
      let visualAlbedo: [number, number, number];
      let haze: { radiusScale: number; strength: number } | undefined;
      let bands: number | undefined;
      let phaseFloor: number | undefined;
      let pointGlowStrength: number | undefined;
      let pressureAtm: number | undefined;

      if (tempK > 520 || (tempK > 400 && sub.chance(0.5))) {
        classification = 'volcanic-rocky';
        label = 'Planeta Vulcânico';
        description = 'Mundo telúrico hiperaquecido com vulcanismo ativo e crosta basáltica exposta.';
        visualAlbedo = [0.26, 0.16, 0.12];
        haze = { radiusScale: 1.05, strength: 0.20 };
        pressureAtm = 0.05;
      } else if (tempK >= 340 && baseHasAtmosphere) {
        classification = 'dense-atmosphere-rocky';
        label = 'Planeta c/ Atmosfera Densa';
        description = 'Mundo superaquecido com densa camada de nuvens e elevado efeito estufa.';
        visualAlbedo = [0.84, 0.76, 0.52];
        haze = { radiusScale: 1.15, strength: 0.55 };
        bands = 8;
        pressureAtm = Number((50 + sub.range(0, 45)).toFixed(1));
      } else if (tempK >= 230 && tempK <= 340 && baseHasAtmosphere && sub.chance(0.65)) {
        classification = 'oceanic-rocky';
        label = 'Planeta Oceânico';
        description = 'Mundo temperado com hidrosfera líquida e atmosfera rica em voláteis (composição não confirmada).';
        visualAlbedo = [0.20, 0.46, 0.88];
        haze = { radiusScale: 1.08, strength: 0.35 };
        pointGlowStrength = 0.4;
        pressureAtm = Number((0.8 + sub.range(0, 0.5)).toFixed(2));
      } else if (tempK < 210) {
        classification = 'frozen-rocky';
        label = 'Planeta Congelado';
        description = 'Mundo criogênico coberto por mantos de gelo permanente e temperaturas glaciais.';
        visualAlbedo = [0.74, 0.82, 0.92];
        phaseFloor = 0.12;
        pressureAtm = baseHasAtmosphere ? 0.02 : 0;
      } else {
        classification = 'arid-rocky';
        label = 'Planeta Rochoso Árido';
        description = 'Planeta telúrico desértico com regolito, cânions e planícies áridas.';
        visualAlbedo = [0.58, 0.35, 0.20];
        pressureAtm = baseHasAtmosphere ? Number((0.01 + sub.range(0, 0.05)).toFixed(3)) : 0;
      }

      profile = {
        bodyClass: 'rocky',
        hasSolidSurface: true,
        canLand: true,
        landingMode: 'surface',
        hasAtmosphere: baseHasAtmosphere,
        supportsVolumeDestruction: false,
        surfaceKind: 'synthetic-base',
        visual: {
          albedo: visualAlbedo,
          haze,
          bands,
          phaseFloor,
          pointGlowStrength,
          minimumVisiblePx: 2,
          labelPriority: 6,
        },
        environment: {
          classification,
          label,
          temperatureK: tempK,
          surfaceGravityMps2: gravity,
          atmosphericPressureAtm: pressureAtm,
          description,
        },
      };
    }

    const planetBody: CelestialBody = {
      id: planetId,
      name: planetName,
      parentId: starId,
      equatorialRadiusM: radiusM,
      polarRadiusM: radiusM,
      massKg,
      rotationPeriodS,
      frameId: planetId + '-fixed',
      profile,
      orbit: {
        semiMajorAxisM: currentOrbitM,
        phaseRad,
        angularRateRadS: circularOrbitRateRadS(currentOrbitM, starMassKg),
        inclinationRad,
      },
    };

    if (profile.environment) {
      (profile.environment as { biosphere?: unknown }).biosphere = generatePlanetaryBiosphere(planetBody, profile, starSeed);
    }

    bodies.push(planetBody);

    const moonCount = giant ? nextInt(1, 5) : nextInt(0, 2);
    let moonOrbitM = radiusM * 3;

    for (let m = 0; m < moonCount; m++) {
      moonOrbitM += nextFloat() * radiusM * 2;
      const moonRadiusM = 1e5 + nextFloat() * 1e6;
      const moonId = planetId + '_moon_' + m;
      const moonMassKg = 4 / 3 * Math.PI * moonRadiusM ** 3 * 3000;
      const moonRotationPeriodS = 10000 + nextFloat() * 432000;

      // In solid(true, icy): moon is true, so `!moon && nextFloat()>.7` short-circuits.
      // If not icy, it draws 3 floats from nextFloat().
      if (!icy) {
        nextFloat();
        nextFloat();
        nextFloat();
      }

      const moonPhaseRad = nextFloat() * Math.PI * 2;
      const moonInclinationRad = (nextFloat() - .5) * .3;

      const moonSub = bodySubRandom(starSeed, moonId);
      const moonTempK = Math.max(20, Math.round(tempK * (1 - 0.05 * m)));
      const moonGravity = calculateSurfaceGravityMps2(moonMassKg, moonRadiusM);

      let moonProfile: CelestialBodyProfile;

      if (icy) {
        moonProfile = {
          bodyClass: 'icy-moon',
          hasSolidSurface: true,
          canLand: true,
          landingMode: 'surface',
          hasAtmosphere: false,
          supportsVolumeDestruction: false,
          surfaceKind: 'synthetic-base',
          visual: {
            albedo: [0.75, 0.82, 0.90],
            minimumVisiblePx: 2,
            labelPriority: 4,
          },
          environment: {
            classification: 'icy-moon',
            label: 'Lua Gelada',
            temperatureK: moonTempK,
            surfaceGravityMps2: moonGravity,
            description: 'Satélite natural com crosta brilhante de gelo volátil.',
          },
        };
      } else {
        const isVolcanic = m === 0 && giant && moonSub.chance(0.35);
        const hasThickAtmo = moonSub.chance(0.20);

        let moonClass: WorldClassification = 'rocky-moon';
        let moonLabel = 'Lua Rochosa';
        let moonDesc = 'Satélite rochoso com crateras de impacto e regolito estéril.';
        let moonAlbedo: [number, number, number] = [0.45, 0.44, 0.42];
        let moonHaze: { radiusScale: number; strength: number } | undefined;

        if (isVolcanic) {
          moonClass = 'volcanic-moon';
          moonLabel = 'Lua Vulcânica';
          moonDesc = 'Lua aquecida por forças de maré orbitais com vulcanismo ativo.';
          moonAlbedo = [0.92, 0.70, 0.20];
        } else if (hasThickAtmo) {
          moonClass = 'atmospheric-moon';
          moonLabel = 'Lua c/ Atmosfera';
          moonDesc = 'Lua envolvida por névoa densa de hidrocarbonetos.';
          moonAlbedo = [0.85, 0.58, 0.24];
          moonHaze = { radiusScale: 1.10, strength: 0.25 };
        }

        moonProfile = {
          bodyClass: 'rocky-moon',
          hasSolidSurface: true,
          canLand: true,
          landingMode: 'surface',
          hasAtmosphere: hasThickAtmo,
          supportsVolumeDestruction: false,
          surfaceKind: 'synthetic-base',
          visual: {
            albedo: moonAlbedo,
            haze: moonHaze,
            minimumVisiblePx: 2,
            labelPriority: 4,
          },
          environment: {
            classification: moonClass,
            label: moonLabel,
            temperatureK: moonTempK,
            surfaceGravityMps2: moonGravity,
            description: moonDesc,
          },
        };
      }

      const moonBody: CelestialBody = {
        id: moonId,
        name: planetName + ' ' + ['I', 'II', 'III', 'IV', 'V'][m],
        parentId: planetId,
        equatorialRadiusM: moonRadiusM,
        polarRadiusM: moonRadiusM,
        massKg: moonMassKg,
        rotationPeriodS: moonRotationPeriodS,
        frameId: moonId + '-fixed',
        profile: moonProfile,
        orbit: {
          semiMajorAxisM: moonOrbitM,
          phaseRad: moonPhaseRad,
          angularRateRadS: circularOrbitRateRadS(moonOrbitM, massKg),
          inclinationRad: moonInclinationRad,
        },
      };

      if (moonProfile.environment) {
        (moonProfile.environment as { biosphere?: unknown }).biosphere = generatePlanetaryBiosphere(moonBody, moonProfile, starSeed);
      }

      bodies.push(moonBody);
    }
  }

  return { starId, star, seed: starSeed, bodies };
}
