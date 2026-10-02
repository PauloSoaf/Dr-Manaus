import type { Object3D } from 'three/webgpu';
import type { CelestialBody } from '../celestial/CelestialBody';
import type { UniverseRuntime } from '../runtime/UniverseRuntime';
import { surfaceForBody } from '../planet/BodySurfaceFactory';
import { RockyPlanetProvider } from './RockyPlanetProvider';

/** Registers lightweight provider shells; terrain meshes only exist after scheduler demand. */
export function createPlanetProviders(parent: Object3D, universe: UniverseRuntime,
  bodies: readonly CelestialBody[] = universe.activeSystem.bodies): Map<string, RockyPlanetProvider> {
  const providers = new Map<string, RockyPlanetProvider>();
  for (const body of bodies) {
    // Earth keeps its specialized WGS84/Manaus provider.
    if (body.id === 'earth') continue;
    const surface = surfaceForBody(body);
    if (!surface) continue;
    const provider = new RockyPlanetProvider(parent, universe.frames, surface.body, surface,
      { renderSpace: universe.renderSpace });
    providers.set(body.id, provider);
    universe.providers.register(provider);
  }
  return providers;
}
