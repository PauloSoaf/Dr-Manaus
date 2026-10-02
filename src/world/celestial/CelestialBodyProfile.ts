import type { CelestialBody } from './CelestialBody';

export interface BodyVisualProfile {
  readonly albedo: readonly [number, number, number];
  readonly ambient?: readonly [number, number, number];
  readonly minimumVisiblePx?: number;
  readonly pointGlowPx?: number;
  readonly pointGlowStrength?: number;
  readonly pointBrightness?: number;
  readonly phaseExponent?: number;
  readonly solarGlow?: { readonly innerScale: number; readonly outerScale: number };
  readonly labelPriority?: number;
  readonly bands?: number;
  /** Low-cost optical haze; presentation only, included in the proxy extent budget. */
  readonly haze?: { readonly radiusScale: number; readonly strength: number };
  /** Dimensionless radii relative to the planet proxy, never logical metres. */
  readonly rings?: { readonly innerRadius: number; readonly outerRadius: number; readonly minimumDiameterPx?: number };
}

/** Capabilities only. Physics and ephemerides remain owned by CelestialBody. */
export interface CelestialBodyProfile {
  readonly bodyClass: 'star' | 'rocky' | 'rocky-moon' | 'icy-moon' | 'volcanic-moon' | 'atmospheric-moon' | 'gas-giant' | 'ice-giant';
  readonly hasSolidSurface: boolean;
  readonly canLand: boolean;
  readonly hasAtmosphere: boolean;
  readonly supportsVolumeDestruction: boolean;
  readonly surfaceKind: 'none' | 'earth' | 'moon' | 'mars' | 'synthetic-base';
  readonly visual: BodyVisualProfile;
}

const solid = (surfaceKind: CelestialBodyProfile['surfaceKind'], albedo: BodyVisualProfile['albedo'],
  hasAtmosphere = false, moon = false, extra?: Partial<BodyVisualProfile>): CelestialBodyProfile => ({
  bodyClass: moon ? 'rocky-moon' : 'rocky', hasSolidSurface: true, canLand: true,
  hasAtmosphere, supportsVolumeDestruction: true, surfaceKind, visual: { albedo, ...extra },
});
const giant = (bodyClass: 'gas-giant' | 'ice-giant', visual: BodyVisualProfile): CelestialBodyProfile => ({
  bodyClass, hasSolidSurface: false, canLand: false, hasAtmosphere: true,
  supportsVolumeDestruction: false, surfaceKind: 'none', visual,
});
const moonProxy = (bodyClass: 'icy-moon' | 'volcanic-moon' | 'atmospheric-moon',
  albedo: BodyVisualProfile['albedo'], extra?: Partial<BodyVisualProfile>): CelestialBodyProfile => ({
  bodyClass, hasSolidSurface: true, canLand: false, hasAtmosphere: bodyClass === 'atmospheric-moon',
  supportsVolumeDestruction: false, surfaceKind: 'none',
  visual: { albedo, ambient: [0.025, 0.025, 0.025], minimumVisiblePx: 2.5,
    pointBrightness: 0.9, labelPriority: 5, ...extra },
});

export const SOLAR_BODY_PROFILES: Readonly<Record<string, CelestialBodyProfile>> = {
  sun: { bodyClass: 'star', hasSolidSurface: false, canLand: false, hasAtmosphere: false,
    supportsVolumeDestruction: false, surfaceKind: 'none', visual: { albedo: [1, 0.98, 0.9],
      solarGlow: { innerScale: 2, outerScale: 5 }, labelPriority: 10 } },
  mercury: solid('synthetic-base', [0.38, 0.36, 0.33], false, false, { minimumVisiblePx: 1, labelPriority: 2 }),
  venus: solid('synthetic-base', [0.86, 0.76, 0.52], true, false, { minimumVisiblePx: 2, labelPriority: 3 }),
  earth: solid('earth', [0.22, 0.48, 0.95], true, false, { minimumVisiblePx: 3.5, pointGlowPx: 8, pointGlowStrength: 0.45, pointBrightness: 1.1, labelPriority: 10 }),
  moon: solid('moon', [0.65, 0.65, 0.65], false, true, { ambient: [0.08, 0.08, 0.08], minimumVisiblePx: 2, labelPriority: 8 }),
  mars: solid('mars', [0.7, 0.3, 0.1], true, false, { minimumVisiblePx: 2, labelPriority: 5 }),
  jupiter: giant('gas-giant', { albedo: [0.76, 0.59, 0.43], bands: 16, minimumVisiblePx: 2.5, labelPriority: 6 }),
  saturn: giant('gas-giant', { albedo: [0.83, 0.74, 0.52], bands: 12,
    rings: { innerRadius: 1.25, outerRadius: 2.3, minimumDiameterPx: 6 }, minimumVisiblePx: 2.5, labelPriority: 6 }),
  uranus: giant('ice-giant', { albedo: [0.42, 0.81, 0.86], minimumVisiblePx: 2, labelPriority: 4 }),
  neptune: giant('ice-giant', { albedo: [0.12, 0.32, 0.82], bands: 6, minimumVisiblePx: 2, labelPriority: 4 }),
  io: moonProxy('volcanic-moon', [0.95, 0.7, 0.18], { bands: 5 }),
  europa: moonProxy('icy-moon', [0.9, 0.85, 0.7], { bands: 24 }),
  ganymede: moonProxy('icy-moon', [0.52, 0.49, 0.43]),
  callisto: moonProxy('icy-moon', [0.32, 0.31, 0.3], { bands: 9 }),
  titan: moonProxy('atmospheric-moon', [0.95, 0.58, 0.16], { haze: { radiusScale: 1.12, strength: 0.3 } }),
  enceladus: moonProxy('icy-moon', [0.98, 0.98, 1]),
  titania: moonProxy('icy-moon', [0.62, 0.67, 0.71]),
  oberon: moonProxy('icy-moon', [0.4, 0.41, 0.44]),
  triton: moonProxy('icy-moon', [0.82, 0.75, 0.77]),
};

// Unclassified procedural bodies remain proxies; their surfaces require an explicit profile.
const UNKNOWN_PROFILE: CelestialBodyProfile = { ...SOLAR_BODY_PROFILES.mercury,
  canLand: false, supportsVolumeDestruction: false, surfaceKind: 'none' };
export function bodyProfile(body: CelestialBody): CelestialBodyProfile {
  return SOLAR_BODY_PROFILES[body.id] ?? (body.parentId ? UNKNOWN_PROFILE : SOLAR_BODY_PROFILES.sun);
}

export interface BodyArrivalPolicy {
  readonly arrivalMarginM: number;
  readonly exclusionMarginM: number;
}

/** Gameplay clearances, derived from class and physical radius; not atmospheric simulation. */
export function bodyArrivalPolicy(body: CelestialBody): BodyArrivalPolicy {
  const profile = bodyProfile(body);
  if (profile.bodyClass === 'star') {
    const marginM = body.equatorialRadiusM;
    return { arrivalMarginM: marginM, exclusionMarginM: marginM };
  }
  if (!profile.hasSolidSurface) {
    const marginM = Math.max(1_000_000, body.equatorialRadiusM * 0.25);
    return { arrivalMarginM: marginM, exclusionMarginM: marginM };
  }
  return { arrivalMarginM: Math.max(50_000, body.equatorialRadiusM * 0.01), exclusionMarginM: 1_000 };
}
