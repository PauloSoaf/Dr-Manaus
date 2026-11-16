import type { Object3D } from 'three/webgpu';
import type { CelestialBody } from '../celestial/CelestialBody';
import type { PlanetBody } from './PlanetBody';
import type { PlanetSurfaceGenerator } from './PlanetSurface';
import type { PlanetVisualProfile } from '../celestial/PlanetVisualProfile';
import { getPlanetVisualProfile } from '../celestial/PlanetVisualProfile';
import { surfaceForBody } from './BodySurfaceFactory';
import { planetBodyFromCelestial } from './PlanetBodyAdapter';
import { RockyPlanetProvider, type RockyPlanetProviderOptions } from '../providers/RockyPlanetProvider';
import { PlanetTerrainProvider } from './PlanetTerrainProvider';
import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import type { RenderSpaceService } from '../spatial/RenderSpaceService';

export interface PlanetSurfaceSystem {
  readonly body: PlanetBody;
  readonly visualProfile: PlanetVisualProfile;
  readonly surfaceGenerator?: PlanetSurfaceGenerator;
  readonly provider?: RockyPlanetProvider;
  readonly terrainProvider?: PlanetTerrainProvider;
  dispose(): void;
}

/**
 * Creates the unified multi-planet surface system specified in 08-PLANET-SURFACES-AND-LANDING.md.
 * Integrates visual profiles, terrain generators, streaming quadtree providers, and physical collision.
 */
export function createPlanetSurfaceSystem(
  body: CelestialBody,
  parent: Object3D,
  frames: ReferenceFrameGraph,
  renderSpace?: RenderSpaceService,
  providerOptions?: RockyPlanetProviderOptions,
): PlanetSurfaceSystem {
  const planetModel = planetBodyFromCelestial(body);
  const visualProfile = getPlanetVisualProfile(body.id);
  const surfaceGenerator = surfaceForBody(body);

  let provider: RockyPlanetProvider | undefined;
  let terrainProvider: PlanetTerrainProvider | undefined;

  if (surfaceGenerator) {
    provider = new RockyPlanetProvider(
      parent,
      frames,
      planetModel,
      surfaceGenerator,
      { ...providerOptions, renderSpace },
    );
    terrainProvider = new PlanetTerrainProvider(frames, planetModel, surfaceGenerator);
  }

  return {
    body: planetModel,
    visualProfile,
    surfaceGenerator,
    provider,
    terrainProvider,
    dispose() {
      provider?.dispose();
    },
  };
}

