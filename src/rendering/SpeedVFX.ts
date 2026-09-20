import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicNodeMaterial, Scene } from 'three/webgpu';
import { float, max, mix, positionGeometry, smoothstep, uniform, uv, vec3, vec4 } from 'three/tsl';

export type SpeedState = 'normal' | 'fast' | 'super' | 'mega';

/** Where each state sits on the 0..1 intensity ramp the shader reads. */
const LEVEL: Record<SpeedState, number> = { normal: 0, fast: .22, super: .62, mega: 1 };

/**
 * Edge-only speed effect.
 *
 * The whole point is that the centre of the screen stays readable — the player still has to see
 * the city they are flying at. So the streaks, the vignette and the colour separation are all
 * driven by distance from the centre and are zero across the middle of the frame. One fullscreen
 * triangle, one material, no post-processing pass and no render target.
 */
export class SpeedVFX {
  private readonly intensity = uniform(0);
  private readonly elapsed = uniform(0);
  private readonly mesh: Mesh;
  private current = 0;
  private target = 0;

  constructor(scene: Scene) {
    // A single oversized triangle in clip space: cheaper than a quad and never needs resizing.
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

    const material = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending });
    const centred = uv().sub(0.5).mul(2);
    const radius = centred.length();
    // Nothing at all until well outside the middle; full strength only at the corners.
    const edge = smoothstep(float(.46), float(1.05), radius);

    // Streaks that scroll outward, so the frame reads as motion rather than noise. Built from the
    // unit direction rather than an angle: `atan2` is not in this version of TSL, and the slightly
    // irregular spoke spacing this gives actually reads better than a mechanical comb.
    const direction = centred.div(max(radius, float(.0001)));
    const comb = direction.x.mul(23).add(direction.y.mul(19)).add(radius.mul(-34)).add(this.elapsed.mul(9))
      .sin().abs().pow(6);
    const streak = comb.mul(edge).mul(this.intensity);

    // A cool-to-hot shift as the speed climbs, so mega reads differently from super at a glance.
    const tint = mix(vec3(.38, .62, 1), vec3(.78, .46, 1), this.intensity);
    // Chromatic separation, kept deliberately slight and also edge-only.
    const fringe = edge.mul(this.intensity).mul(.16);
    const rgb = tint.mul(streak.mul(1.7)).add(vec3(fringe.mul(.6), float(0), fringe));
    // The vignette darkens rather than adds, so it cannot wash the corners out to white.
    const vignette = edge.mul(this.intensity).mul(.42);

    material.colorNode = vec4(rgb, streak.mul(.9).add(vignette).mul(smoothstep(float(0), float(.08), this.intensity)));
    material.positionNode = vec4(positionGeometry.xy, float(0), float(1));
    material.name = 'speed-vfx';

    this.mesh = new Mesh(geometry, material);
    this.mesh.name = 'speed-vfx';
    this.mesh.frustumCulled = false;
    // Drawn last so it sits over the world, and never over the HUD, which is DOM.
    this.mesh.renderOrder = 1200;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  get level(): number { return this.current; }

  /**
   * `state` sets the target and `speed` fine-tunes within it, so accelerating inside one band
   * still builds. The approach is damped: nothing about this effect may switch on or off hard.
   */
  update(dt: number, state: SpeedState, speed: number): void {
    if (!Number.isFinite(dt) || !Number.isFinite(speed)) return;
    const within = Math.min(1, Math.max(0, speed / 9000));
    this.target = Math.min(1, LEVEL[state] + within * .18);
    // Rising fast enough to feel like a surge, falling slowly enough to feel like coasting down.
    const rate = this.target > this.current ? 3.4 : 1.6;
    this.current += (this.target - this.current) * (1 - Math.exp(-dt * rate));
    if (this.current < .004) this.current = 0;
    this.intensity.value = this.current;
    this.elapsed.value += dt * (1 + this.current * 3);
    this.mesh.visible = this.current > 0;
  }

  /** Extra field of view the camera should add on top of its own, in degrees. */
  get fovBoost(): number { return this.current * 34; }

  /** Shake amplitude, driven by how hard the intensity is currently changing, not by speed alone. */
  shakeFor(acceleration: number): number {
    return Math.min(.5, Math.abs(acceleration) * .00018 * (.35 + this.current));
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicNodeMaterial).dispose();
  }
}
