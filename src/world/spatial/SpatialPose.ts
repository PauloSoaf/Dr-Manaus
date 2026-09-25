import {
  cloneQuat, cloneVec3, IDENTITY_QUAT, isFiniteQuat, isFiniteVec3,
  type Quat, type Vec3,
} from './units';

export type ReferenceFrameId = string;

/**
 * A position and orientation, and — crucially — the frame they are expressed in.
 *
 * A bare `Vector3` cannot say whether it means metres from the Largo, metres from the centre of
 * the Earth, or metres from the barycentre of the solar system. Carrying the frame with the
 * numbers is what lets the runtime refuse to add two of them together by accident.
 */
export interface SpatialPose {
  frame: ReferenceFrameId;
  position: Vec3;
  orientation: Quat;
}

export function pose(
  frame: ReferenceFrameId,
  position: Vec3 = [0, 0, 0],
  orientation: Quat = cloneQuat(IDENTITY_QUAT),
): SpatialPose {
  return { frame, position, orientation };
}

export function clonePose(source: SpatialPose): SpatialPose {
  return {
    frame: source.frame,
    position: cloneVec3(source.position),
    orientation: cloneQuat(source.orientation),
  };
}

export function copyPose(target: SpatialPose, source: SpatialPose): SpatialPose {
  target.frame = source.frame;
  target.position[0] = source.position[0];
  target.position[1] = source.position[1];
  target.position[2] = source.position[2];
  target.orientation[0] = source.orientation[0];
  target.orientation[1] = source.orientation[1];
  target.orientation[2] = source.orientation[2];
  target.orientation[3] = source.orientation[3];
  return target;
}

export function isFinitePose(value: SpatialPose): boolean {
  return isFiniteVec3(value.position) && isFiniteQuat(value.orientation);
}

/**
 * Distance between two poses. Throws rather than guessing when the frames differ: silently
 * treating two frames as one is the bug this whole layer exists to make impossible.
 */
export function distanceInFrame(a: SpatialPose, b: SpatialPose): number {
  if (a.frame !== b.frame) {
    throw new Error(`Cannot measure between poses in different frames: "${a.frame}" and "${b.frame}"`);
  }
  return Math.hypot(
    a.position[0] - b.position[0],
    a.position[1] - b.position[1],
    a.position[2] - b.position[2],
  );
}
