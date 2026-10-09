import type { Object3D } from 'three/webgpu';
import type { CelestialBody } from '../celestial/CelestialBody';
import type { UniverseRuntime } from '../runtime/UniverseRuntime';
import { surfaceForBody } from '../planet/BodySurfaceFactory';
import { RockyPlanetProvider } from './RockyPlanetProvider';

/** Registers lightweight provider shells; terrain meshes only exist after scheduler demand. */
export function createPlanetProviders(parent: Object3D, universe: UniverseRuntime,
  bodies: readonly CelestialBody[] = universe.activeSystem.bodies, register = true): Map<string, RockyPlanetProvider> {
  const providers = new Map<string, RockyPlanetProvider>();
  try {
  for (const body of bodies) {
    // Earth keeps its specialized WGS84/Manaus provider.
    if (body.id === 'earth') continue;
    const surface = surfaceForBody(body);
    if (!surface) continue;
    const provider = new RockyPlanetProvider(parent, universe.frames, surface.body, surface,
      { renderSpace: universe.renderSpace });
    providers.set(body.id, provider);
    if (register) universe.providers.register(provider);
  }
  } catch(error) {
    for(const provider of providers.values()) {
      if(universe.providers.get(provider.id)===provider)universe.providers.unregister(provider.id);
      provider.dispose();
    }
    throw error;
  }
  return providers;
}
