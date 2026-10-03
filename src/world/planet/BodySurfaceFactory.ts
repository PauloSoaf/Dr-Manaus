import type { CelestialBody } from '../celestial/CelestialBody';
import { bodyProfile } from '../celestial/CelestialBodyProfile';
import { EarthSurfaceGenerator } from './EarthSurface';
import { MarsSurfaceGenerator, MARS_RELIEF_M } from './MarsSurface';
import { MoonSurfaceGenerator, MOON_RELIEF_M } from './MoonSurface';
import { EARTH_MAX_ELEVATION_M } from './EarthElevation';
import { planetBodyFromCelestial } from './PlanetBodyAdapter';
import type { PlanetSurfaceGenerator } from './PlanetSurface';

/** Broad-phase upper bound from the existing relief authorities, independent of rendering. */
export function maximumSurfaceReliefM(body: CelestialBody): number {
  switch (bodyProfile(body).surfaceKind) {
    case 'earth': return Math.max(0, EARTH_MAX_ELEVATION_M);
    case 'moon': return MOON_RELIEF_M;
    case 'mars': return MARS_RELIEF_M;
    default: return 0;
  }
}

/** All intact solid surfaces feed the same future PlanetVolumeField, keyed by bodyId. */
export function surfaceForBody(body: CelestialBody): PlanetSurfaceGenerator | undefined {
  const profile = bodyProfile(body);
  if (!profile.hasSolidSurface || profile.surfaceKind === 'none') return undefined;
  if (profile.surfaceKind === 'earth') return EarthSurfaceGenerator;
  const model = planetBodyFromCelestial(body);
  if (profile.surfaceKind === 'moon') return { ...MoonSurfaceGenerator, body: model, radiusM: model.semiMajorAxisM };
  if (profile.surfaceKind === 'mars') return { ...MarsSurfaceGenerator, body: model, radiusM: model.semiMajorAxisM };
  // Explicit synthetic base ellipsoid for Mercury/Venus: no claimed real elevation or atmosphere.
  return {
    body: model, radiusM: model.semiMajorAxisM,
    heightAt: () => 0,
    normalEnu: (_direction, out) => { out[0] = 0; out[1] = 0; out[2] = 1; },
    colourAt: (_direction, out) => {
      out[0] = profile.visual.albedo[0]; out[1] = profile.visual.albedo[1]; out[2] = profile.visual.albedo[2];
    },
  };
}
