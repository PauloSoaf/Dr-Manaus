import type { PerspectiveCamera } from 'three/webgpu';

/**
 * Render domains: drawing a world that spans metres to planetary distances in one frame.
 *
 * A character on a pavement needs a near plane around 0.15 m. The horizon from orbit is 1 300 km
 * away and the Moon is 384 000 km. A *linear* depth buffer cannot hold both, which is why the
 * specification says not to answer the problem by raising `far` — and why this started out as two
 * cameras drawing two passes with the depth buffer cleared between them.
 *
 * That is not what ships, because it does not work: two successive `render()` calls to the screen
 * do not composite in `WebGPURenderer`. Each call resolves through its own frame-buffer target and
 * the second replaces the first, whatever `autoClearColor` says. Measured directly — the far pass
 * alone drew the planet, the local pass alone drew the world, and the two together drew only the
 * second.
 *
 * What does work, and what this game already enables, is a **logarithmic depth buffer**. Its
 * precision is relative rather than absolute, so one camera spans 0.15 m to 50 000 km with depth
 * to spare at both ends — 24 bits over about 28 doublings is roughly half a million values per
 * doubling. So there is one camera and one pass, and this class is what decides how far it sees.
 *
 * Layers still separate the domains, because the planet has to be able to stand down without
 * touching anything else.
 */

/** Layer 0 stays the local domain, because that is what every existing object already uses. */
export const LOCAL_LAYER = 0;
export const PLANET_LAYER = 1;

/** The far plane used when nothing planetary is in view. Unchanged from the flat-world game. */
export const LOCAL_FAR_M = 260_000;
/** The floor for the planetary far plane: low orbit, the closest the globe is ever drawn from. */
export const PLANET_FAR_FLOOR_M = 50_000_000;

/**
 * Owns the camera's depth range and which domains it can see.
 *
 * Deliberately small. It holds a policy, not a pipeline: with one camera there is nothing to
 * compose, and the moment there is — an atmosphere resolved from a render target, say — it should
 * be its own pass with its own target rather than a second render to the screen.
 */
export class RenderDomains {
  private enabled = false;
  private farM = LOCAL_FAR_M;

  constructor(private readonly camera: PerspectiveCamera) {}

  get active(): boolean { return this.enabled; }

  /**
   * Turns the planetary domain on or off.
   *
   * On, the camera can see planetary geometry and its far plane reaches orbital distances. Off, it
   * is exactly the camera the flat-world game had, so the feature flag really does mean "as
   * before".
   */
  set active(value: boolean) {
    if (this.enabled === value) return;
    this.enabled = value;
    if (value) {
      this.camera.layers.enable(PLANET_LAYER);
    } else {
      this.camera.layers.disable(PLANET_LAYER);
      this.farM = LOCAL_FAR_M;
      this.camera.far = LOCAL_FAR_M;
      this.camera.updateProjectionMatrix();
    }
  }

  get stats(): { farM: number; planetary: boolean } {
    return { farM: this.farM, planetary: this.enabled };
  }

  /**
   * Grows the far plane with how far away the planet is.
   *
   * A fixed 50 000 km reaches low orbit and no further: from the Moon's distance the Earth would
   * be clipped away entirely, which is precisely the view the domain exists to make possible. The
   * near plane does not move with it — under a logarithmic buffer it does not need to, and moving
   * it would clip the player's own hands.
   */
  setRange(distanceToBodyM: number): void {
    if (!this.enabled) return;
    const distance = Number.isFinite(distanceToBodyM) ? Math.max(0, distanceToBodyM) : 0;
    const farM = Math.max(PLANET_FAR_FLOOR_M, distance * 4);
    if (farM === this.farM) return;
    this.farM = farM;
    this.camera.far = farM;
    this.camera.updateProjectionMatrix();
  }
}
