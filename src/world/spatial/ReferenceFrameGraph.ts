import {
  directionFromParent, directionToParent, fromParent, orientationFromParent, orientationToParent,
  type ReferenceFrame, toParent,
} from './ReferenceFrame';
import { clonePose, type ReferenceFrameId, type SpatialPose } from './SpatialPose';
import { cloneQuat, cloneVec3, type Quat, type Vec3 } from './units';

/**
 * The tree of reference frames, and the only thing allowed to move a quantity between them.
 *
 * Converting between two frames means walking up from each to their lowest common ancestor and
 * back down the other side. That keeps the arithmetic to the smallest chain that actually
 * separates the two — a position in Manaus converted to the Earth-fixed frame never touches the
 * galactic numbers, so it never loses precision to them.
 */
export class ReferenceFrameGraph {
  private readonly frames = new Map<ReferenceFrameId, ReferenceFrame>();
  /** Cached root-ward chains. Invalidated whenever the tree changes, which is rare. */
  private readonly chains = new Map<ReferenceFrameId, readonly ReferenceFrame[]>();

  get size(): number { return this.frames.size; }
  get ids(): readonly ReferenceFrameId[] { return [...this.frames.keys()]; }

  has(id: ReferenceFrameId): boolean { return this.frames.has(id); }

  get(id: ReferenceFrameId): ReferenceFrame {
    const frame = this.frames.get(id);
    if (!frame) throw new Error(`Unknown reference frame "${id}"`);
    return frame;
  }

  /**
   * Adds or replaces a frame. A frame may be registered before its parent — the solar system is
   * naturally described top-down, but tiles arrive bottom-up — so parents are resolved lazily and
   * only checked when a transform actually needs them.
   */
  register(frame: ReferenceFrame): this {
    if (frame.parentId === frame.id) throw new Error(`Frame "${frame.id}" cannot be its own parent`);
    this.frames.set(frame.id, frame);
    this.chains.clear();
    return this;
  }

  remove(id: ReferenceFrameId): boolean {
    const removed = this.frames.delete(id);
    if (removed) this.chains.clear();
    return removed;
  }

  clear(): void {
    this.frames.clear();
    this.chains.clear();
  }

  /** The chain from a frame up to its root, the frame itself first. */
  chainToRoot(id: ReferenceFrameId): readonly ReferenceFrame[] {
    const cached = this.chains.get(id);
    if (cached) return cached;
    const chain: ReferenceFrame[] = [];
    const seen = new Set<ReferenceFrameId>();
    let current: ReferenceFrame | undefined = this.get(id);
    while (current) {
      if (seen.has(current.id)) {
        throw new Error(`Reference frame cycle through "${current.id}"`);
      }
      seen.add(current.id);
      chain.push(current);
      current = current.parentId === undefined ? undefined : this.get(current.parentId);
    }
    this.chains.set(id, chain);
    return chain;
  }

  /** The nearest frame that is an ancestor of both, or undefined when they are in separate trees. */
  lowestCommonAncestor(a: ReferenceFrameId, b: ReferenceFrameId): ReferenceFrameId | undefined {
    if (a === b) return a;
    const ancestors = new Set(this.chainToRoot(a).map(frame => frame.id));
    for (const frame of this.chainToRoot(b)) {
      if (ancestors.has(frame.id)) return frame.id;
    }
    return undefined;
  }

  /**
   * Converts a position from one frame to another.
   *
   * The two walks are deliberately separate: up to the common ancestor by composing parents, then
   * down by composing inverses. Nothing ever materialises a single absolute coordinate.
   */
  convertPosition(from: ReferenceFrameId, to: ReferenceFrameId, position: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
    out[0] = position[0]; out[1] = position[1]; out[2] = position[2];
    if (from === to) return out;
    const meeting = this.requireCommonAncestor(from, to);
    for (const frame of this.chainUpTo(from, meeting)) toParent(frame, out, out);
    for (const frame of this.chainDownFrom(to, meeting)) fromParent(frame, out, out);
    return out;
  }

  /** Converts a direction — a velocity, a normal, an axis. Rotation only, never translation. */
  convertDirection(from: ReferenceFrameId, to: ReferenceFrameId, direction: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
    out[0] = direction[0]; out[1] = direction[1]; out[2] = direction[2];
    if (from === to) return out;
    const meeting = this.requireCommonAncestor(from, to);
    for (const frame of this.chainUpTo(from, meeting)) directionToParent(frame, out, out);
    for (const frame of this.chainDownFrom(to, meeting)) directionFromParent(frame, out, out);
    return out;
  }

  convertOrientation(from: ReferenceFrameId, to: ReferenceFrameId, orientation: Quat, out: Quat = [0, 0, 0, 1]): Quat {
    out[0] = orientation[0]; out[1] = orientation[1]; out[2] = orientation[2]; out[3] = orientation[3];
    if (from === to) return out;
    const meeting = this.requireCommonAncestor(from, to);
    for (const frame of this.chainUpTo(from, meeting)) orientationToParent(frame, out, out);
    for (const frame of this.chainDownFrom(to, meeting)) orientationFromParent(frame, out, out);
    return out;
  }

  /** Converts a whole pose, position and orientation together. */
  convertPose(pose: SpatialPose, to: ReferenceFrameId): SpatialPose {
    if (pose.frame === to) return clonePose(pose);
    return {
      frame: to,
      position: this.convertPosition(pose.frame, to, pose.position, cloneVec3(pose.position)),
      orientation: this.convertOrientation(pose.frame, to, pose.orientation, cloneQuat(pose.orientation)),
    };
  }

  private requireCommonAncestor(from: ReferenceFrameId, to: ReferenceFrameId): ReferenceFrameId {
    const meeting = this.lowestCommonAncestor(from, to);
    if (meeting === undefined) {
      throw new Error(`Reference frames "${from}" and "${to}" are not connected`);
    }
    return meeting;
  }

  /** Frames to compose walking from `id` up to, but not including, `meeting`. */
  private chainUpTo(id: ReferenceFrameId, meeting: ReferenceFrameId): readonly ReferenceFrame[] {
    const chain = this.chainToRoot(id);
    const stop = chain.findIndex(frame => frame.id === meeting);
    return stop < 0 ? chain : chain.slice(0, stop);
  }

  /** The same chain for the destination, reversed, so composing inverses walks downward. */
  private chainDownFrom(id: ReferenceFrameId, meeting: ReferenceFrameId): readonly ReferenceFrame[] {
    return [...this.chainUpTo(id, meeting)].reverse();
  }
}
