import type { ReferenceFrameGraph } from './ReferenceFrameGraph';
import { cloneRenderOrigin, type RenderOrigin } from './RenderOrigin';
import type { RenderPose } from './RenderPose';
import type { ReferenceFrameId } from './SpatialPose';
import { cloneQuat, cloneVec3, type Quat, type Vec3 } from './units';

export interface RenderSpaceOptions {
  /** Maximum safe magnitude in metres for coordinates delivered to Three.js. Default 20,000,000 m. */
  maxRenderMagnitudeM?: number;
}

/**
 * Service responsible for camera-relative coordinates:
 * Logical space:
 *   - Float64
 *   - Arbitrary hierarchical reference frames (AU, km, m)
 * Render space:
 *   - Float32-friendly offsets relative to RenderOrigin
 *   - Never astronomically large numbers (e.g. 1 AU)
 */
export class RenderSpaceService {
  private origin: RenderOrigin;
  private readonly maxMagnitudeM: number;

  constructor(
    private readonly frames: ReferenceFrameGraph,
    initialOrigin: RenderOrigin,
    options: RenderSpaceOptions = {},
  ) {
    this.origin = cloneRenderOrigin(initialOrigin);
    this.maxMagnitudeM = options.maxRenderMagnitudeM ?? 20_000_000;
  }

  get currentOrigin(): RenderOrigin {
    return cloneRenderOrigin(this.origin);
  }

  setOrigin(next: RenderOrigin): void {
    this.origin = cloneRenderOrigin(next);
  }

  /**
   * Converts a logical position in any registered frame into a render-relative offset
   * in the render origin's frame axes:
   * out = posInOriginFrame - origin.position
   */
  logicalToRender(
    fromFrame: ReferenceFrameId,
    logicalPosition: Vec3,
    out: Vec3 = [0, 0, 0],
  ): Vec3 {
    let inOriginFrame: Vec3;
    if (fromFrame === this.origin.frame) {
      inOriginFrame = logicalPosition;
    } else {
      inOriginFrame = this.frames.convertPosition(fromFrame, this.origin.frame, logicalPosition);
    }

    out[0] = inOriginFrame[0] - this.origin.position[0];
    out[1] = inOriginFrame[1] - this.origin.position[1];
    out[2] = inOriginFrame[2] - this.origin.position[2];
    return out;
  }

  /**
   * The inverse: converts a render-relative coordinate back to a logical position in targetFrame:
   * logicalInOriginFrame = renderPosition + origin.position
   * out = convertPosition(origin.frame, targetFrame, logicalInOriginFrame)
   */
  renderToLogical(
    renderPosition: Vec3,
    targetFrame: ReferenceFrameId,
    out: Vec3 = [0, 0, 0],
  ): Vec3 {
    const logicalInOrigin: Vec3 = [
      renderPosition[0] + this.origin.position[0],
      renderPosition[1] + this.origin.position[1],
      renderPosition[2] + this.origin.position[2],
    ];

    if (targetFrame === this.origin.frame) {
      out[0] = logicalInOrigin[0];
      out[1] = logicalInOrigin[1];
      out[2] = logicalInOrigin[2];
      return out;
    }

    return this.frames.convertPosition(this.origin.frame, targetFrame, logicalInOrigin, out);
  }

  /**
   * Computes the full RenderPose for an object with a given logical position and orientation.
   */
  toRenderPose(
    fromFrame: ReferenceFrameId,
    logicalPosition: Vec3,
    orientation: Quat,
  ): RenderPose {
    const renderPosition = this.logicalToRender(fromFrame, logicalPosition);
    let renderOrientation: Quat;
    if (fromFrame === this.origin.frame) {
      renderOrientation = cloneQuat(orientation);
    } else {
      renderOrientation = this.frames.convertOrientation(fromFrame, this.origin.frame, orientation);
    }

    return {
      frame: fromFrame,
      logicalPosition: cloneVec3(logicalPosition),
      renderPosition,
      orientation: renderOrientation,
    };
  }

  /**
   * Checks whether a render coordinate is finite and within safe Float32 bounds.
   */
  isRenderSafe(renderPos: Vec3, maxMagnitudeM: number = this.maxMagnitudeM): boolean {
    return (
      Number.isFinite(renderPos[0]) &&
      Number.isFinite(renderPos[1]) &&
      Number.isFinite(renderPos[2]) &&
      Math.abs(renderPos[0]) <= maxMagnitudeM &&
      Math.abs(renderPos[1]) <= maxMagnitudeM &&
      Math.abs(renderPos[2]) <= maxMagnitudeM
    );
  }
}
