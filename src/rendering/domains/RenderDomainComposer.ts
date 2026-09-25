import { Vector3 } from 'three/webgpu';
import type { Camera, PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu';

/**
 * Render domains: drawing a world that spans metres to planetary distances in one frame.
 *
 * One camera cannot do it. A near plane of 0.15 m is what a character on a pavement needs, and a
 * far plane that reaches the horizon from orbit is 1 300 km away — the depth buffer cannot hold
 * both, and raising `far` to astronomical units, as the specification says explicitly, is not the
 * answer.
 *
 * So the frame is drawn in passes, furthest first, with the depth buffer cleared between them:
 *
 *   planet domain   near 1 km, far 50 000 km   the globe, the horizon, the limb
 *   local domain    near 0.15 m, far 260 km    the city, the player, everything played with
 *
 * Each pass has its own camera sharing the main camera's position and orientation, so the two
 * images register exactly. Clearing depth between passes means local geometry always draws over
 * the planet, which is correct: anything in the local domain is nearer than anything in the
 * planetary one by construction.
 *
 * Objects choose their domain with a layer, so nothing has to be moved between scenes.
 */

/** Layer 0 stays the local domain, because that is what every existing object already uses. */
export const LOCAL_LAYER = 0;
export const PLANET_LAYER = 1;

export interface DomainCameraSettings {
  readonly nearM: number;
  readonly farM: number;
}

export const PLANET_DOMAIN: DomainCameraSettings = { nearM: 1_000, farM: 50_000_000 };

/**
 * Drives the passes. Deliberately tiny: it owns the order and the depth clear, and nothing else.
 * The cameras and the scene belong to the renderer manager.
 */
export class RenderDomainComposer {
  private enabled = true;
  private planetDraws = 0;
  private localDraws = 0;
  private farM = PLANET_DOMAIN.farM;

  private readonly scratchScale = new Vector3();

  constructor(
    private readonly renderer: WebGPURenderer,
    private readonly planetCamera: PerspectiveCamera,
  ) {}

  get active(): boolean { return this.enabled; }
  set active(value: boolean) { this.enabled = value; }
  get stats(): { planetDraws: number; localDraws: number; farM: number } {
    return { planetDraws: this.planetDraws, localDraws: this.localDraws, farM: this.farM };
  }

  /**
   * Grows the far plane with how far away the planet is.
   *
   * A fixed 50 000 km reaches low orbit and no further: from the Moon's distance the Earth would
   * be clipped away entirely, which is precisely the view the whole domain exists to make
   * possible. The near plane grows with it, because a depth buffer spanning a metre to a million
   * kilometres has no precision anywhere.
   */
  setRange(distanceToBodyM: number): void {
    const distance = Number.isFinite(distanceToBodyM) ? Math.max(0, distanceToBodyM) : 0;
    this.farM = Math.max(PLANET_DOMAIN.farM, distance * 4);
    this.planetCamera.far = this.farM;
    this.planetCamera.near = Math.max(PLANET_DOMAIN.nearM, this.farM / 1e6);
    this.planetCamera.updateProjectionMatrix();
  }

  /**
   * Aligns the planet camera with the main one. Position and orientation are copied rather than
   * parented: a shared transform with a different projection is exactly what registers the two
   * images, and copying keeps the main camera free of anything domain-specific.
   */
  syncCamera(main: PerspectiveCamera): void {
    main.updateMatrixWorld(true);
    // The *world* transform, decomposed — not the local one. `position` and `quaternion` are
    // relative to whatever the camera is parented to, and the planet camera has no parent, so
    // copying those puts it somewhere else entirely and the planet falls outside its frustum.
    main.matrixWorld.decompose(this.planetCamera.position, this.planetCamera.quaternion, this.scratchScale);
    this.planetCamera.fov = main.fov;
    this.planetCamera.aspect = main.aspect;
    this.planetCamera.updateProjectionMatrix();
    this.planetCamera.updateMatrixWorld(true);
  }

  /**
   * Draws one frame. Returns false when the composer is off, so the caller can fall back to a
   * single ordinary render and the game keeps working with the feature disabled.
   */
  render(scene: Scene, main: PerspectiveCamera): boolean {
    if (!this.enabled) return false;
    this.syncCamera(main);

    const previousAutoClear = this.renderer.autoClear;
    const previousClearColour = this.renderer.autoClearColor;
    const previousClearDepth = this.renderer.autoClearDepth;
    // Fog is calibrated for the local domain, where the far plane is 260 km. The planet is
    // thousands of kilometres away, so every one of its pixels would come out fully fogged — the
    // globe turns the colour of the haze and then black at night. Distance haze on a planet seen
    // from orbit is the atmosphere's job, and that is a limb, not a fog ramp.
    const previousFog = scene.fog;
    try {
      // Furthest first, into a cleared frame.
      scene.fog = null;
      this.renderer.autoClear = true;
      this.renderer.autoClearColor = true;
      this.renderer.autoClearDepth = true;
      this.renderer.render(scene, this.planetCamera as unknown as Camera);
      this.planetDraws = this.renderer.info.render.drawCalls;

      // Then the local domain on top. Keeping the colour is the whole point — clearing it here
      // would draw the planet and then wipe it — while depth starts afresh so local geometry is
      // never occluded by something thousands of kilometres away.
      scene.fog = previousFog;
      this.renderer.autoClear = false;
      this.renderer.autoClearColor = false;
      this.renderer.autoClearDepth = false;
      this.renderer.clearDepth();
      this.renderer.render(scene, main as unknown as Camera);
      this.localDraws = this.renderer.info.render.drawCalls;
    } finally {
      scene.fog = previousFog;
      this.renderer.autoClear = previousAutoClear;
      this.renderer.autoClearColor = previousClearColour;
      this.renderer.autoClearDepth = previousClearDepth;
    }
    return true;
  }
}
