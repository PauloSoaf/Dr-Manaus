import type { ReferenceFrameId } from './SpatialPose';
import { cloneQuat, cloneVec3, type Quat, type Vec3 } from './units';

/**
 * Representation of the visual render origin in logical space.
 * Logical positions in `frame` are converted to small camera-relative render coordinates
 * by subtracting `position`.
 */
export interface RenderOrigin {
  readonly frame: ReferenceFrameId;
  readonly position: Vec3;
  readonly orientation: Quat;
  readonly epochS?: number;
}

export function createRenderOrigin(
  frame: ReferenceFrameId,
  position: Vec3 = [0, 0, 0],
  orientation: Quat = [0, 0, 0, 1],
  epochS = 0,
): RenderOrigin {
  return {
    frame,
    position: cloneVec3(position),
    orientation: cloneQuat(orientation),
    epochS,
  };
}

export function cloneRenderOrigin(origin: RenderOrigin): RenderOrigin {
  return {
    frame: origin.frame,
    position: cloneVec3(origin.position),
    orientation: cloneQuat(origin.orientation),
    epochS: origin.epochS,
  };
}
