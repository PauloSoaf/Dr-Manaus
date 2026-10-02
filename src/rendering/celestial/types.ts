import type { Quat, Vec3 } from '../../world/spatial/units';

export interface CelestialRenderSample {
  bodyId: string;

  logicalDistanceM: number;
  physicalRadiusM: number;
  angularRadiusRad: number;

  directionRender: Vec3;

  proxyDistanceM: number;
  proxyRadiusM: number;

  visible: boolean;
  opacity: number;
  
  // Phase light direction in render space, optional (used by moon)
  phaseLightDirection?: Vec3;
  /** Catalog axial model converted into render axes, used for bands and Saturn's rings. */
  bodyOrientationRender?: Quat;
}
