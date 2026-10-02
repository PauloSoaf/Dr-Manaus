import { flattening, gravitationalParameter, type CelestialBody } from '../celestial/CelestialBody';
import type { PlanetBody } from './PlanetBody';

/** The only bridge from the physical catalog to surface/volume geometry. */
export function planetBodyFromCelestial(body: CelestialBody): PlanetBody {
  return {
    id: body.id,
    semiMajorAxisM: body.equatorialRadiusM,
    flattening: flattening(body),
    rotationPeriodS: body.rotationPeriodS ?? 0,
    parentFrame: body.frameId,
    gravitationalParameter: gravitationalParameter(body),
  };
}
