import type { UniverseLocation, TeleportTarget } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';

export class MapNavigationModel {
  location: UniverseLocation;
  destination?: Vector3;
  /** Presentation focus only; never changes the player's location or navigation target. */
  systemFocusBodyId?: string;
  /** Presentation hover key in Cosmos/Galaxy maps. */
  hoveredTargetKey?: string;
  /** Presentation selected target key in Cosmos/Galaxy maps. */
  selectedTargetKey?: string;
  precision: 'measured' | 'approximate' | 'procedural' | 'gameplay-placeholder' = 'measured';
  
  constructor(initialLocation: UniverseLocation) {
    this.location = initialLocation;
  }

  updateLocation(location: UniverseLocation) {
    this.location = location;
  }
}
