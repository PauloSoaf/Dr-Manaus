import type { CelestialBody } from './CelestialBody';

export interface BodyVisualProfile {
  readonly albedo: readonly [number, number, number];
  readonly ambient?: readonly [number, number, number];
  readonly minimumVisiblePx?: number;
  readonly pointGlowPx?: number;
  readonly pointGlowStrength?: number;
  readonly pointBrightness?: number;
  readonly phaseExponent?: number;
  /** Presentation-only indirect light floor scale (e.g. 0.10-0.18 for Moon earthshine). */
  readonly phaseFloor?: number;
  readonly solarGlow?: { readonly innerScale: number; readonly outerScale: number };
  readonly labelPriority?: number;
  readonly bands?: number;
  /** Low-cost optical haze; presentation only, included in the proxy extent budget. */
  readonly haze?: { readonly radiusScale: number; readonly strength: number };
  /** Dimensionless radii relative to the planet proxy, never logical metres. */
  readonly rings?: { readonly innerRadius: number; readonly outerRadius: number; readonly minimumDiameterPx?: number };
}

export type WorldClassification =
  | 'star'
  | 'arid-rocky'
  | 'frozen-rocky'
  | 'volcanic-rocky'
  | 'dense-atmosphere-rocky'
  | 'oceanic-rocky'
  | 'gas-giant'
  | 'ice-giant'
  | 'rocky-moon'
  | 'icy-moon'
  | 'volcanic-moon'
  | 'atmospheric-moon';

export interface WorldEnvironment {
  readonly classification: WorldClassification;
  readonly label: string;
  readonly temperatureK: number;
  readonly surfaceGravityMps2: number;
  readonly description: string;
  readonly atmosphericPressureAtm?: number;
  readonly hasRings?: boolean;
}

/** Capabilities only. Physics and ephemerides remain owned by CelestialBody. */
export interface CelestialBodyProfile {
  readonly bodyClass: 'star' | 'rocky' | 'rocky-moon' | 'icy-moon' | 'volcanic-moon' | 'atmospheric-moon' | 'gas-giant' | 'ice-giant';
  readonly hasSolidSurface: boolean;
  readonly canLand: boolean;
  readonly landingMode?: 'none' | 'surface' | 'photosphere';
  readonly hasAtmosphere: boolean;
  readonly supportsVolumeDestruction: boolean;
  readonly surfaceKind: 'none' | 'earth' | 'moon' | 'mars' | 'synthetic-base';
  readonly visual: BodyVisualProfile;
  readonly environment?: WorldEnvironment;
}

const solid = (surfaceKind: CelestialBodyProfile['surfaceKind'], albedo: BodyVisualProfile['albedo'],
  hasAtmosphere = false, moon = false, extra?: Partial<BodyVisualProfile>, environment?: WorldEnvironment): CelestialBodyProfile => ({
  bodyClass: moon ? 'rocky-moon' : 'rocky', hasSolidSurface: true, canLand: true, landingMode: 'surface',
  hasAtmosphere, supportsVolumeDestruction: true, surfaceKind, visual: { albedo, ...extra }, environment,
});
const giant = (bodyClass: 'gas-giant' | 'ice-giant', visual: BodyVisualProfile, environment?: WorldEnvironment): CelestialBodyProfile => ({
  bodyClass, hasSolidSurface: false, canLand: false, landingMode: 'none', hasAtmosphere: true,
  supportsVolumeDestruction: false, surfaceKind: 'none', visual, environment,
});
const moonProxy = (bodyClass: 'icy-moon' | 'volcanic-moon' | 'atmospheric-moon',
  albedo: BodyVisualProfile['albedo'], extra?: Partial<BodyVisualProfile>, environment?: WorldEnvironment): CelestialBodyProfile => ({
  bodyClass, hasSolidSurface: true, canLand: false, landingMode: 'none', hasAtmosphere: bodyClass === 'atmospheric-moon',
  supportsVolumeDestruction: false, surfaceKind: 'none',
  visual: { albedo, ambient: [0.025, 0.025, 0.025], minimumVisiblePx: 2.5,
    pointBrightness: 0.9, labelPriority: 5, ...extra },
  environment,
});

export const SOLAR_BODY_PROFILES: Readonly<Record<string, CelestialBodyProfile>> = {
  sun: { bodyClass: 'star', hasSolidSurface: false, canLand: true, landingMode: 'photosphere', hasAtmosphere: false,
    supportsVolumeDestruction: false, surfaceKind: 'none', visual: { albedo: [1, 0.98, 0.9],
      solarGlow: { innerScale: 2, outerScale: 5 }, labelPriority: 10 },
    environment: { classification: 'star', label: 'Estrela Tipo G (Sol)', temperatureK: 5772, surfaceGravityMps2: 274,
      description: 'Estrela anã amarela da sequência principal de classe espectral G2V.' } },
  mercury: solid('synthetic-base', [0.38, 0.36, 0.33], false, false, { minimumVisiblePx: 1, labelPriority: 2 },
    { classification: 'arid-rocky', label: 'Planeta Rochoso Árido', temperatureK: 440, surfaceGravityMps2: 3.7,
      description: 'Mundo rochoso sem atmosfera, densamente craterado.' }),
  venus: solid('synthetic-base', [0.86, 0.76, 0.52], true, false, { minimumVisiblePx: 2, labelPriority: 3 },
    { classification: 'dense-atmosphere-rocky', label: 'Planeta c/ Atmosfera Densa', temperatureK: 737, surfaceGravityMps2: 8.87,
      atmosphericPressureAtm: 92, description: 'Atmosfera supercrítica de CO2 com espessas nuvens de ácido sulfúrico.' }),
  earth: solid('earth', [0.22, 0.48, 0.95], true, false, { minimumVisiblePx: 3.5, pointGlowPx: 8, pointGlowStrength: 0.45, pointBrightness: 1.1, labelPriority: 10 },
    { classification: 'oceanic-rocky', label: 'Planeta Oceânico Habitável', temperatureK: 288, surfaceGravityMps2: 9.81,
      atmosphericPressureAtm: 1, description: 'Biosfera ativa com oceanos de água líquida e atmosfera de N2-O2.' }),
  moon: solid('moon', [0.76, 0.76, 0.78], false, true, { ambient: [0.10, 0.10, 0.12], phaseFloor: 0.14, minimumVisiblePx: 2, labelPriority: 8 },
    { classification: 'rocky-moon', label: 'Lua Rochosa', temperatureK: 220, surfaceGravityMps2: 1.62,
      description: 'Satélite natural rochoso coberto por regolito e mares basálticos.' }),
  mars: solid('mars', [0.7, 0.3, 0.1], true, false, { minimumVisiblePx: 2, labelPriority: 5 },
    { classification: 'arid-rocky', label: 'Planeta Rochoso Desértico', temperatureK: 210, surfaceGravityMps2: 3.72,
      atmosphericPressureAtm: 0.006, description: 'Deserto gélido rico em óxidos de ferro com calotas polares de dióxido de carbono.' }),
  jupiter: giant('gas-giant', { albedo: [0.76, 0.59, 0.43], bands: 16, minimumVisiblePx: 2.5, labelPriority: 6 },
    { classification: 'gas-giant', label: 'Gigante Gasoso Joviano', temperatureK: 128, surfaceGravityMps2: 24.79,
      description: 'Maior planeta do sistema solar, com faixas de nuvens turbulentas.' }),
  saturn: giant('gas-giant', { albedo: [0.83, 0.74, 0.52], bands: 12,
    rings: { innerRadius: 1.25, outerRadius: 2.3, minimumDiameterPx: 6 }, minimumVisiblePx: 2.5, labelPriority: 6 },
    { classification: 'gas-giant', label: 'Gigante Gasoso Saturniano', temperatureK: 95, surfaceGravityMps2: 10.44, hasRings: true,
      description: 'Gigante gasoso com magnífico sistema de anéis analíticos de gelo e rocha.' }),
  uranus: giant('ice-giant', { albedo: [0.42, 0.81, 0.86], minimumVisiblePx: 2, labelPriority: 4 },
    { classification: 'ice-giant', label: 'Gigante Gelado Uraniano', temperatureK: 59, surfaceGravityMps2: 8.69,
      description: 'Gigante gelado rico em água, amônia e metano em estado supercrítico.' }),
  neptune: giant('ice-giant', { albedo: [0.12, 0.32, 0.82], bands: 6, minimumVisiblePx: 2, labelPriority: 4 },
    { classification: 'ice-giant', label: 'Gigante Gelado Netuniano', temperatureK: 47, surfaceGravityMps2: 11.15,
      description: 'Gigante gelado azul profundo com ventos de alta velocidade.' }),
  io: moonProxy('volcanic-moon', [0.95, 0.7, 0.18], { bands: 5 },
    { classification: 'volcanic-moon', label: 'Lua Vulcânica', temperatureK: 130, surfaceGravityMps2: 1.80,
      description: 'Corpo mais vulcanicamente ativo do sistema solar, impulsionado por marés gravitacionais.' }),
  europa: moonProxy('icy-moon', [0.9, 0.85, 0.7], { bands: 24 },
    { classification: 'icy-moon', label: 'Lua Gelada com Oceano', temperatureK: 102, surfaceGravityMps2: 1.31,
      description: 'Crosta de gelo de água fraturada cobrindo um oceano global líquido.' }),
  ganymede: moonProxy('icy-moon', [0.52, 0.49, 0.43], undefined,
    { classification: 'icy-moon', label: 'Lua Gelada Gigante', temperatureK: 110, surfaceGravityMps2: 1.43,
      description: 'Maior lua do sistema solar, dotada de campo magnético próprio.' }),
  callisto: moonProxy('icy-moon', [0.32, 0.31, 0.3], { bands: 9 },
    { classification: 'icy-moon', label: 'Lua Gelada Antiga', temperatureK: 134, surfaceGravityMps2: 1.24,
      description: 'Superfície antiga densamente craterada de gelo e rocha.' }),
  titan: moonProxy('atmospheric-moon', [0.95, 0.58, 0.16], { haze: { radiusScale: 1.12, strength: 0.3 } },
    { classification: 'atmospheric-moon', label: 'Lua com Atmosfera Densa', temperatureK: 94, surfaceGravityMps2: 1.35,
      atmosphericPressureAtm: 1.5, description: 'Satélite com densa névoa de nitrogênio e metano e mares de hidrocarbonetos.' }),
  enceladus: moonProxy('icy-moon', [0.98, 0.98, 1], undefined,
    { classification: 'icy-moon', label: 'Lua Gelada com Plumas', temperatureK: 75, surfaceGravityMps2: 0.11,
      description: 'Lua brilhante com criovulcanismo ativo e oceano global sob a crosta.' }),
  titania: moonProxy('icy-moon', [0.62, 0.67, 0.71], undefined,
    { classification: 'icy-moon', label: 'Lua Gelada Titânia', temperatureK: 60, surfaceGravityMps2: 0.38,
      description: 'Maior lua de Urano, composta de misturas de gelo e rocha silicatada.' }),
  oberon: moonProxy('icy-moon', [0.4, 0.41, 0.44], undefined,
    { classification: 'icy-moon', label: 'Lua Gelada Oberon', temperatureK: 60, surfaceGravityMps2: 0.35,
      description: 'Segunda maior lua de Urano com crosta de gelo densamente craterada.' }),
  triton: moonProxy('icy-moon', [0.82, 0.75, 0.77], undefined,
    { classification: 'icy-moon', label: 'Lua Gelada Retrógrada', temperatureK: 38, surfaceGravityMps2: 0.78,
      description: 'Lua capturada do Cinturão de Kuiper com órbita retrógrada e gêiseres de nitrogênio.' }),
};

// Unclassified procedural bodies remain proxies; their surfaces require an explicit profile.
const UNKNOWN_PROFILE: CelestialBodyProfile = { ...SOLAR_BODY_PROFILES.mercury,
  canLand: false, landingMode: 'none', supportsVolumeDestruction: false, surfaceKind: 'none' };

export const PROCEDURAL_STAR_PROFILE: CelestialBodyProfile = {
  bodyClass: 'star',
  hasSolidSurface: false,
  canLand: false,
  landingMode: 'none',
  hasAtmosphere: false,
  supportsVolumeDestruction: false,
  surfaceKind: 'none',
  visual: {
    albedo: [1, 0.98, 0.9],
    solarGlow: { innerScale: 2, outerScale: 5 },
    labelPriority: 10,
  },
};

export function bodyProfile(body: CelestialBody): CelestialBodyProfile {
  if (SOLAR_BODY_PROFILES[body.id]) {
    return SOLAR_BODY_PROFILES[body.id];
  }
  if (body.profile) {
    return body.profile;
  }
  return body.parentId ? UNKNOWN_PROFILE : PROCEDURAL_STAR_PROFILE;
}

export type LandingSupportKind = 'none' | 'surface' | 'photosphere';

/**
 * Centrally evaluates the landing capability supported by a celestial profile.
 * - 'surface': rocky / solid surface terrain landing (Earth, Moon, Mars)
 * - 'photosphere': controlled stellar photosphere landing (Sun / Sol)
 * - 'none': cannot be landed on (gas giants, icy moon proxies, generic procedural stars)
 */
export function supportsLanding(profile: CelestialBodyProfile): LandingSupportKind {
  if (!profile.canLand) return 'none';
  if (profile.landingMode === 'photosphere') return 'photosphere';
  if (profile.landingMode === 'surface' || (profile.hasSolidSurface && profile.landingMode !== 'none')) {
    return 'surface';
  }
  return 'none';
}

/**
 * Explicit named gameplay gravity policy for photosphere contact (m/s²).
 * Solar surface gravity in reality is ~274 m/s² (28g), which would immediately immobilize
 * or crush a humanoid character controller. Fictional contact semantics use an active
 * Lorentz/magnetohydrodynamic buoyancy suspension field calibrated to Earth-normal gravity (9.81 m/s²),
 * allowing stable and responsive character locomotion across the convective photosphere envelope.
 */
export const PHOTOSPHERE_GAMEPLAY_GRAVITY_MPS2 = 9.80665;

export interface BodyArrivalPolicy {
  readonly arrivalMarginM: number;
  readonly exclusionMarginM: number;
  /** Navigation standoff only; optical corona is owned by the visual profile. */
  readonly observationMarginM?: number;
}

/** Gameplay clearances, derived from class and physical radius; not atmospheric simulation. */
export function bodyArrivalPolicy(body: CelestialBody): BodyArrivalPolicy {
  const profile = bodyProfile(body);
  if (profile.bodyClass === 'star') {
    const observationMarginM = body.equatorialRadiusM * .03;
    return { arrivalMarginM: observationMarginM, observationMarginM,
      exclusionMarginM: Math.max(100_000, body.equatorialRadiusM * 1e-4) };
  }
  if (!profile.hasSolidSurface) {
    const marginM = Math.max(1_000_000, body.equatorialRadiusM * 0.25);
    return { arrivalMarginM: marginM, exclusionMarginM: marginM };
  }
  return { arrivalMarginM: Math.max(50_000, body.equatorialRadiusM * 0.01), exclusionMarginM: 1_000 };
}
