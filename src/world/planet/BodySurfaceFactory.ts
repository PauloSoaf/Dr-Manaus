import type { CelestialBody } from '../celestial/CelestialBody';
import { bodyProfile } from '../celestial/CelestialBodyProfile';
import { EarthSurfaceGenerator } from './EarthSurface';
import { MarsSurfaceGenerator } from './MarsSurface';
import { MoonSurfaceGenerator } from './MoonSurface';
import { planetBodyFromCelestial } from './PlanetBodyAdapter';
import type { PlanetSurfaceGenerator } from './PlanetSurface';

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
