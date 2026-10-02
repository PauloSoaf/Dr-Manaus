import type { CelestialBody } from './CelestialBody';

export interface BodyVisualProfile {
  readonly albedo: readonly [number, number, number];
  readonly bands?: number;
  /** Dimensionless radii relative to the planet proxy, never logical metres. */
  readonly rings?: { readonly innerRadius: number; readonly outerRadius: number };
}

/** Capabilities only. Physics and ephemerides remain owned by CelestialBody. */
export interface CelestialBodyProfile {
  readonly bodyClass: 'star' | 'rocky' | 'rocky-moon' | 'gas-giant' | 'ice-giant';
  readonly hasSolidSurface: boolean;
  readonly canLand: boolean;
  readonly hasAtmosphere: boolean;
  readonly supportsVolumeDestruction: boolean;
  readonly surfaceKind: 'none' | 'earth' | 'moon' | 'mars' | 'synthetic-base';
  readonly visual: BodyVisualProfile;
}

const solid = (surfaceKind: CelestialBodyProfile['surfaceKind'], albedo: BodyVisualProfile['albedo'],
  hasAtmosphere = false, moon = false): CelestialBodyProfile => ({
  bodyClass: moon ? 'rocky-moon' : 'rocky', hasSolidSurface: true, canLand: true,
  hasAtmosphere, supportsVolumeDestruction: true, surfaceKind, visual: { albedo },
});
const giant = (bodyClass: 'gas-giant' | 'ice-giant', visual: BodyVisualProfile): CelestialBodyProfile => ({
  bodyClass, hasSolidSurface: false, canLand: false, hasAtmosphere: true,
  supportsVolumeDestruction: false, surfaceKind: 'none', visual,
});

export const SOLAR_BODY_PROFILES: Readonly<Record<string, CelestialBodyProfile>> = {
  sun: { bodyClass: 'star', hasSolidSurface: false, canLand: false, hasAtmosphere: false,
    supportsVolumeDestruction: false, surfaceKind: 'none', visual: { albedo: [1, 0.98, 0.9] } },
  mercury: solid('synthetic-base', [0.38, 0.36, 0.33]),
  venus: solid('synthetic-base', [0.86, 0.76, 0.52], true),
  earth: solid('earth', [0.1, 0.3, 0.8], true),
  moon: solid('moon', [0.5, 0.5, 0.5], false, true),
  mars: solid('mars', [0.7, 0.3, 0.1], true),
  jupiter: giant('gas-giant', { albedo: [0.76, 0.59, 0.43], bands: 16 }),
  saturn: giant('gas-giant', { albedo: [0.83, 0.74, 0.52], bands: 12,
    rings: { innerRadius: 1.25, outerRadius: 2.3 } }),
  uranus: giant('ice-giant', { albedo: [0.42, 0.81, 0.86] }),
  neptune: giant('ice-giant', { albedo: [0.12, 0.32, 0.82], bands: 6 }),
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
