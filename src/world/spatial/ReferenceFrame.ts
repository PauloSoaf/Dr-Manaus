import { clonePose, type ReferenceFrameId, type SpatialPose } from './SpatialPose';
import {
  addVec3, cloneQuat, cloneVec3, conjugateQuat, IDENTITY_QUAT, multiplyQuat,
  type Quat, rotateVec3, subVec3, type Vec3,
} from './units';

/**
 * What kind of thing a frame is attached to. The runtime uses this to decide which render domain
 * and which physics regime apply, without having to pattern-match on frame names.
 */
export type ReferenceFrameKind =
  | 'render-local'
  | 'surface-enu'
  | 'body-fixed'
  | 'body-inertial'
  | 'system'
  | 'galactic'
  | 'cosmic';

/**
 * A node in the frame tree.
 *
 * `origin` is where this frame sits *inside its parent*: apply the frame's orientation to a local
 * vector and add the frame's position, and the result is in the parent's coordinates. A frame
 * with no parent is a root and defines its own absolute meaning.
 */
export interface ReferenceFrame {
  readonly id: ReferenceFrameId;
  readonly parentId?: ReferenceFrameId;
  readonly kind: ReferenceFrameKind;
  /** Position of this frame's origin, in the parent's coordinates. */
  readonly originInParent: Vec3;
  /** Rotation from this frame's axes to the parent's axes. */
  readonly rotationToParent: Quat;
  /** Free-form label for debug overlays. Never used for logic. */
  readonly label?: string;
}

export interface ReferenceFrameInit {
  id: ReferenceFrameId;
  parentId?: ReferenceFrameId;
  kind: ReferenceFrameKind;
  originInParent?: Vec3;
  rotationToParent?: Quat;
  label?: string;
}

export function referenceFrame(init: ReferenceFrameInit): ReferenceFrame {
  return {
    id: init.id,
    parentId: init.parentId,
    kind: init.kind,
    originInParent: cloneVec3(init.originInParent ?? [0, 0, 0]),
    rotationToParent: cloneQuat(init.rotationToParent ?? IDENTITY_QUAT),
    label: init.label,
  };
}

/** A local vector expressed in the parent's coordinates. */
export function toParent(frame: ReferenceFrame, local: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  rotateVec3(frame.rotationToParent, local, out);
  return addVec3(out, frame.originInParent, out);
}

/** A parent vector expressed in this frame's coordinates. */
export function fromParent(frame: ReferenceFrame, parent: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  subVec3(parent, frame.originInParent, out);
  return rotateVec3(conjugateQuat(frame.rotationToParent, [0, 0, 0, 1]), out, out);
}

/** A direction — rotated but not translated. Velocities and normals take this path. */
export function directionToParent(frame: ReferenceFrame, local: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  return rotateVec3(frame.rotationToParent, local, out);
}

export function directionFromParent(frame: ReferenceFrame, parent: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  return rotateVec3(conjugateQuat(frame.rotationToParent, [0, 0, 0, 1]), parent, out);
}

export function orientationToParent(frame: ReferenceFrame, local: Quat, out: Quat = [0, 0, 0, 1]): Quat {
  return multiplyQuat(frame.rotationToParent, local, out);
}

export function orientationFromParent(frame: ReferenceFrame, parent: Quat, out: Quat = [0, 0, 0, 1]): Quat {
  return multiplyQuat(conjugateQuat(frame.rotationToParent, [0, 0, 0, 1]), parent, out);
}

/**
 * The frame the runtime is currently working in, with the logical origin it was pinned at.
 * `logicalOrigin` is what a rebase moves; the frame's own definition does not change.
 */
export interface ActiveReferenceFrame {
  readonly id: ReferenceFrameId;
  readonly parentId?: ReferenceFrameId;
  readonly kind: ReferenceFrameKind;
  readonly logicalOrigin: SpatialPose;
}

export function activeFrame(frame: ReferenceFrame, logicalOrigin: SpatialPose): ActiveReferenceFrame {
  return {
    id: frame.id,
    parentId: frame.parentId,
    kind: frame.kind,
    logicalOrigin: clonePose(logicalOrigin),
  };
}
