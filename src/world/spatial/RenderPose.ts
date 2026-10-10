import type { ReferenceFrameId } from './SpatialPose';
import { cloneQuat, cloneVec3, type Quat, type Vec3 } from './units';

/**
 * Carries both logical position (Float64 in its reference frame) and render position
 * (Float32-friendly coordinates relative to the active RenderOrigin).
 */
export interface RenderPose {
  readonly frame: ReferenceFrameId;
  readonly logicalPosition: Vec3;
  readonly renderPosition: Vec3;
  readonly orientation: Quat;
}

export function cloneRenderPose(pose: RenderPose): RenderPose {
  return {
    frame: pose.frame,
    logicalPosition: cloneVec3(pose.logicalPosition),
    renderPosition: cloneVec3(pose.renderPosition),
    orientation: cloneQuat(pose.orientation),
  };
}
