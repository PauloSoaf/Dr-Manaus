import { SOLAR_BODY_PROFILES, type CelestialBodyProfile } from './CelestialBodyProfile';
import { bodyById } from './CelestialBody';

export interface AtmosphereProfile {
  readonly hasAtmosphere: boolean;
  readonly surfacePressureAtm?: number;
  readonly scaleHeightM?: number;
  readonly rayleighScattering?: readonly [number, number, number];
  readonly fogNearM?: number;
  readonly fogFarM?: number;
  readonly hazeStrength?: number;
}

export interface RingProfile {
  readonly hasRings: boolean;
  readonly innerRadiusM: number;
  readonly outerRadiusM: number;
  readonly opacity: number;
  readonly innerRadiusScale: number;
  readonly outerRadiusScale: number;
}

export interface TerrainProfile {
  readonly hasSolidSurface: boolean;
  readonly canLand: boolean;
  readonly landingMode: 'none' | 'surface' | 'photosphere';
  readonly surfaceKind: 'none' | 'earth' | 'moon' | 'mars' | 'synthetic-base';
  readonly maxElevationM: number;
  readonly minElevationM: number;
}

/**
 * Visual and physical profile unifying celestial bodies with shaders and lod rendering.
 * Defined in specs/dr-manaus-cosmic-night-specs/07-SOLAR-SYSTEM-COMPLETE.md.
 */
export interface PlanetVisualProfile {
  readonly bodyId: string;
  readonly surfaceType: 'rocky' | 'ice' | 'gas' | 'star';
  readonly atmosphere: AtmosphereProfile;
  readonly rings?: RingProfile;
  readonly terrain: TerrainProfile;
  readonly albedo: readonly [number, number, number];
}

/**
 * Returns the unified PlanetVisualProfile for a given celestial body ID.
 */
export function getPlanetVisualProfile(bodyId: string): PlanetVisualProfile {
  const normalizedId = bodyId.toLowerCase();
  const profile: CelestialBodyProfile = SOLAR_BODY_PROFILES[normalizedId] ?? {
    bodyClass: 'rocky',
    hasSolidSurface: true,
    canLand: false,
    landingMode: 'none',
    hasAtmosphere: false,
    supportsVolumeDestruction: false,
    surfaceKind: 'synthetic-base',
    visual: { albedo: [0.5, 0.5, 0.5] },
  };

  const body = bodyById(normalizedId);
  const radiusM = body?.equatorialRadiusM ?? 1_000_000;

  // Determine surfaceType
  let surfaceType: PlanetVisualProfile['surfaceType'] = 'rocky';
  if (profile.bodyClass === 'star') {
    surfaceType = 'star';
  } else if (profile.bodyClass === 'gas-giant') {
    surfaceType = 'gas';
  } else if (profile.bodyClass === 'ice-giant' || profile.bodyClass === 'icy-moon') {
    surfaceType = 'ice';
  }

  // Determine rings
  let rings: RingProfile | undefined;
  if (profile.visual.rings) {
    const innerScale = profile.visual.rings.innerRadius;
    const outerScale = profile.visual.rings.outerRadius;
    rings = {
      hasRings: true,
      innerRadiusScale: innerScale,
      outerRadiusScale: outerScale,
      innerRadiusM: radiusM * innerScale,
      outerRadiusM: radiusM * outerScale,
      opacity: 0.85,
    };
  }

  // Atmosphere
  const atmosphere: AtmosphereProfile = {
    hasAtmosphere: profile.hasAtmosphere,
    surfacePressureAtm: profile.environment?.atmosphericPressureAtm ?? (profile.hasAtmosphere ? 1.0 : 0),
    scaleHeightM: profile.hasAtmosphere ? 8_500 : undefined,
    hazeStrength: profile.visual.haze?.strength ?? 0,
  };

  // Terrain
  let maxElevationM = 0;
  let minElevationM = 0;
  if (normalizedId === 'earth') {
    maxElevationM = 8_848;
    minElevationM = -11_034;
  } else if (normalizedId === 'moon') {
    maxElevationM = 10_786;
    minElevationM = -9_174;
  } else if (normalizedId === 'mars') {
    maxElevationM = 21_287; // Olympus Mons
    minElevationM = -8_200; // Hellas Planitia
  }

  const terrain: TerrainProfile = {
    hasSolidSurface: profile.hasSolidSurface,
    canLand: profile.canLand,
    landingMode: profile.landingMode ?? 'none',
    surfaceKind: profile.surfaceKind,
    maxElevationM,
    minElevationM,
  };

  return {
    bodyId: normalizedId,
    surfaceType,
    atmosphere,
    rings,
    terrain,
    albedo: profile.visual.albedo,
  };
}

