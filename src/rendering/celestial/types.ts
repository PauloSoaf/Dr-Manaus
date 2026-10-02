import type { Quat, Vec3 } from '../../world/spatial/units';
import type { CelestialBodyProfile } from '../../world/celestial/CelestialBodyProfile';

export interface CelestialRenderSample {
  bodyId: string;
  profile?: CelestialBodyProfile;

  logicalDistanceM: number;
  physicalRadiusM: number;
  angularRadiusRad: number;

  directionRender: Vec3;

  proxyDistanceM: number;
  proxyRadiusM: number;
  /** Radius of the proxy for screen-space readability (point mode glow etc), independent of physical size. */
  presentationProxyRadiusM?: number;
  /** Radius of the proxy including the optional glow layer, independent of physical size. */
  glowProxyRadiusM?: number;
  physicalProjectedDiameterPx?: number;
  presentationDiameterPx?: number;
  /** Continuous point-to-disc weight; physical provider ownership is unchanged. */
  pointMix?: number;
  ringsOpacity?: number;

  visible: boolean;
  opacity: number;
  
  // Phase light direction in render space, optional (used by moon)
  phaseLightDirection?: Vec3;
  /** Catalog axial model converted into render axes, used for bands and Saturn's rings. */
  bodyOrientationRender?: Quat;
  /** Actual fixed frame, without extra catalog-only visual tilt. */
  bodyFixedOrientationRender?: Quat;
}
