import { Vec3 } from '../../world/spatial/units';

export interface CelestialRenderSample {
  bodyId: string;

  logicalDistanceM: number;
  physicalRadiusM: number;
  angularRadiusRad: number;

  directionRender: Vec3;

  proxyDistanceM: number;
  proxyRadiusM: number;

  mode: 'celestial' | 'planet' | 'surface';
  blend: number;
  
  // Phase light direction in render space, optional (used by moon)
  phaseLightDirection?: Vec3;
}
