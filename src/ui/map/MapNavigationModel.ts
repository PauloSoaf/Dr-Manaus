import type { UniverseLocation, TeleportTarget } from '../../world/spatial/UniverseLocation';
import type { Vector3 } from 'three/webgpu';

export class MapNavigationModel {
  location: UniverseLocation;
  destination?: Vector3;
  precision: 'measured' | 'approximate' | 'procedural' | 'gameplay-placeholder' = 'measured';
  
  constructor(initialLocation: UniverseLocation) {
    this.location = initialLocation;
  }

  updateLocation(location: UniverseLocation) {
    this.location = location;
  }
}
