import { Vector3 } from 'three/webgpu';
import type { WorldStreamer } from '../streaming/WorldStreamer';
import type { RealCityLayer } from '../realcity/RealCityLayer';
import type { HLODManager } from '../lod/HLODManager';
import type { LandmarkManager } from '../landmarks/LandmarkManager';
import { MANAUS_COVERAGE } from './EarthProvider';
import { type ActiveTile, type TileDemand, type TilePayload, type WorldTileKey, tileDemand } from '../streaming/TileDemand';
import type { CoverageClaim, SpatialContext, StreamingContext, WorldProvider } from './WorldProvider';

/**
 * A composite provider that owns the Manaus city region.
 * It integrates the independent WorldStreamer, RealCityLayer, HLODManager, and LandmarkManager
 * under the global streaming scheduler, ensuring they share the same budget as the planet.
 */
export class ManausProvider implements WorldProvider {
  readonly id = 'earth/manaus';
  readonly priority = 20;

  constructor(
    private readonly streamer: WorldStreamer,
    private readonly realCity: RealCityLayer,
    private readonly hlod: HLODManager,
    private readonly landmarks: LandmarkManager
  ) {}

  coverage(): readonly CoverageClaim[] {
    return [{
      providerId: this.id,
      priority: this.priority,
      region: MANAUS_COVERAGE,
      channels: ['terrain', 'buildings', 'vegetation', 'roads', 'landmarks']
    }];
  }

  covers(context: SpatialContext): boolean {
    return true;
  }

  plan(context: StreamingContext): readonly TileDemand[] {
    return [];
  }

  load(demand: TileDemand, signal: AbortSignal): Promise<TilePayload> {
    return Promise.reject(new Error('ManausProvider.load not fully wired'));
  }

  activate(payload: TilePayload, frame: any): ActiveTile {
    throw new Error('ManausProvider.activate not fully wired');
  }

  deactivate(tile: ActiveTile): void {}

  dispose(): void {}
}
