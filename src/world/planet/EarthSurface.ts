import type { Vec3 } from '../spatial/units';
import { directionToGeodetic } from './CubeSphere';
import { surfaceColour } from './EarthLandMask';
import { surfaceHeightAt, surfaceNormalEnu } from './EarthElevation';
import { EARTH } from './PlanetBody';
import type { PlanetSurfaceGenerator } from './PlanetSurface';

/**
 * The shared Earth surface adapter.
 *
 * Earth rendering predates {@link PlanetSurfaceGenerator} and owns authoritative global relief in
 * `EarthElevation` and colour in `EarthLandMask`. This adapter does not introduce another terrain
 * model: it exposes those same functions through the interface already used by Moon and Mars.
 */
export const EarthSurfaceGenerator: PlanetSurfaceGenerator = {
  body: EARTH,
  radiusM: EARTH.semiMajorAxisM,
  heightAt(direction: Vec3): number {
    const { latRad, lonRad } = directionToGeodetic(direction);
    return surfaceHeightAt(latRad, lonRad);
  },
  normalEnu(direction: Vec3, out: Vec3): void {
    const { latRad, lonRad } = directionToGeodetic(direction);
    surfaceNormalEnu(latRad, lonRad, out);
  },
  colourAt(direction: Vec3, out: [number, number, number]): void {
    const { latRad, lonRad } = directionToGeodetic(direction);
    surfaceColour(latRad, lonRad, out);
  },
};
