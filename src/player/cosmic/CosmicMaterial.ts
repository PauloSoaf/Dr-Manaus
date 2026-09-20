import { MeshBasicNodeMaterial, Vector2, type Node, type PerspectiveCamera } from 'three/webgpu';
import {
  color, float, floor, fract, mix, normalView, positionView, pow, screenUV, sin, smoothstep, texture,
  uniform, vec2, vec3,
} from 'three/tsl';
import { cosmicHash, proceduralCosmos } from './CosmicFallback';
import type { CosmicTextureSource } from './CosmicVideoSource';

export type CosmicLevel = 'idle' | 'flight' | 'power' | 'boost' | 'mega';

/** Where each flight state sits on the 0..1 ramp every term in the shader reads. */
const LEVEL: Record<CosmicLevel, number> = { idle: .16, flight: .34, power: .66, boost: .74, mega: 1 };

/** How much of the clip is shown inside the silhouette; 1 would be one-to-one with the frame. */
export const NEBULA_ZOOM = 4.2;

export interface CosmicMaterialOptions {
  source: CosmicTextureSource;
  seed?: number;
}

/**
 * The star field, as data so it can be asserted on.
 *
 * `magnitude` is the exponent applied to the cell hash: at 6 almost every cell fell to black and
 * the body showed a handful of blobs. Keep it gentle.
 *
 * `density` is cells across the FULL FRAME; the character covers maybe a tenth of it, so these
 * have to be high or few cells ever land on the silhouette. `size` is a RADIUS IN CELL UNITS, so
 * a star's apparent diameter is `2 · size · frameWidth / density` — the discarded halo pass worked
 * out at 6.4 px on a 1920 frame, which is why it read as giant. These are tuned to about one to
 * two pixels: large enough not to shimmer, small enough to be a pinpoint.
 */
export interface StarLayer { density: number; size: number; drift: number; weight: number; magnitude: number }
export const STAR_LAYERS: readonly StarLayer[] = [
  { density: 620, size: .145, drift: .3, weight: .55, magnitude: 2.1 },
  { density: 430, size: .146, drift: .48, weight: .8, magnitude: 2.1 },
  { density: 260, size: .122, drift: .7, weight: 1, magnitude: 2.2 },
];

/** Apparent diameter in pixels on a frame of the given width. */
export function starPixels(layer: StarLayer, frameWidth = 1920): number {
  return 2 * layer.size * frameWidth / layer.density;
}

export interface CosmicMetrics {
  level: number;
  projection: 'screen';
  videoMix: number;
  parallax: number;
  materials: number;
}

/**
 * The body as a window, not as a costume.
 *
 * The galaxy is sampled in SCREEN space, not from the mesh's own UVs. That single decision is
 * what separates this from a printed shirt: two limbs that overlap the same part of the frame
 * reveal the same part of the universe, and swinging an arm slides the silhouette across a scene
 * that stays put rather than dragging a texture around with the bone. The mesh contributes only
 * its outline, its normal for the rim, and its depth.
 *
 * Aspect is corrected against the source so the nebula is never stretched by the window shape,
 * and the whole thing is unlit — a hole in the world has no roughness.
 */
export class CosmicMaterial {
  readonly material: MeshBasicNodeMaterial;
  private readonly source: CosmicTextureSource;
  private readonly intensity = uniform(LEVEL.idle);
  private readonly phase = uniform(0);
  private readonly videoMix = uniform(0);
  /** Camera-driven offset, so the universe behaves like a place behind the player. */
  private readonly parallax = uniform(new Vector2(0, 0));
  private readonly aspect = uniform(new Vector2(1, 1));
  private readonly enabledMix = uniform(1);
  private readonly previousYaw = { yaw: 0, pitch: 0, ready: false };
  private readonly drift = new Vector2(0, 0);
  private current = LEVEL.idle;
  private sourceVersion = -1;

  constructor(options: CosmicMaterialOptions) {
    this.source = options.source;
    const seed = options.seed ?? 0x5eed1a;

    // Screen space, corrected for the source's aspect and nudged by camera motion.
    const centred = screenUV.sub(.5);
    const framed = vec2(centred.x.mul(this.aspect.x), centred.y.mul(this.aspect.y));
    // Zoomed out hard. At 1:1 the character covers a tenth of the frame, so a bright core in the
    // clip landed on the body as a white ball the size of a fist. Showing several times more of
    // the clip inside the same silhouette turns those cores back into distant light.
    const zoomed = framed.mul(NEBULA_ZOOM).add(this.parallax.mul(.09));
    // Mirrored tiling rather than `fract`, because the zoom takes the coordinate outside 0..1 and
    // a hard wrap would put a seam down the middle of the body.
    const pingPong = (v: Node<'float'>): Node<'float'> => fract(v.mul(.5)).mul(2).sub(1).abs();
    const nebulaUV = vec2(pingPong(zoomed.x.add(.5)), pingPong(zoomed.y.add(.5)));
    // The star layer drifts faster than the nebula, which is what reads as depth inside the body.
    const starUV = framed.add(this.parallax.mul(.06)).add(.5);

    const videoColor = texture(this.source.texture, nebulaUV).rgb;
    const fallback = proceduralCosmos(nebulaUV, this.phase, seed);
    // Crossfaded rather than switched: the character is never briefly untextured.
    const cosmos = mix(fallback, videoColor, this.videoMix);

    // Deepen the blacks and lift only what was already bright, so the frame keeps its contrast
    // instead of turning into a wash of pale violet.
    const luma = cosmos.r.mul(.3).add(cosmos.g.mul(.59)).add(cosmos.b.mul(.11));
    const deep = cosmos.mul(smoothstep(float(.015), float(.32), luma));
    const lifted = deep.mul(float(1.9).add(this.intensity.mul(1.5)));
    // Soft-clipped rather than added to. The old bloom term stacked on top of an already bright
    // region, so the clip's cores saturated to flat white discs; this rolls them off instead.
    const nebula = lifted.div(lifted.mul(.75).add(1))
      .add(color('#6fb6ff').mul(smoothstep(float(.55), float(1), luma)).mul(this.intensity.mul(.35)));

    // Three star layers in the same screen plane, drifting at different rates so the field has
    // depth. Density matters more than it looks: the character covers a small part of the frame,
    // so a low cell count puts only a handful of cells on the body. Magnitude matters even more —
    // the previous curve was h^6, which drove all but the rarest cells to black and left three
    // enormous stars. A gentle exponent keeps hundreds of small ones visible.
    const starLayer = (spec: StarLayer, offset: number): Node<'float'> => {
      const size = spec.size;
      // Slow: a starfield that scrolls is a texture sliding past, not a sky.
      const slide = vec2(this.phase.mul(spec.drift * .0012), this.phase.mul(-spec.drift * .0008));
      const p = starUV.add(slide).mul(spec.density).add(offset);
      const cell = floor(p), f = fract(p);
      const h = cosmicHash(cell);
      // `j` is derived from `h` rather than hashed again: halving the hash count per layer is
      // most of this shader's cost, and the correlation is invisible in a star field.
      const j = fract(h.mul(437.5853));
      // Off-centre placement stops the field reading as a grid.
      const centre = vec2(h, j).mul(.68).add(.16);
      const distance = f.sub(centre).length();
      // Size varies per star, so a layer is a spread of magnitudes rather than one stamp repeated.
      const scale = float(.55).add(j.mul(.9));
      const point = float(1).sub(smoothstep(float(size).mul(scale).mul(.3), float(size).mul(scale), distance));
      const twinkle = sin(this.phase.mul(1.7).add(j.mul(41.3))).mul(.26).add(.74);
      return point.mul(h.pow(spec.magnitude)).mul(twinkle);
    };
    let stars = starLayer(STAR_LAYERS[0], seed & 255).mul(STAR_LAYERS[0].weight);
    for (let i = 1; i < STAR_LAYERS.length; i++) {
      stars = stars.add(starLayer(STAR_LAYERS[i], (seed >> (i * 8)) & 255).mul(STAR_LAYERS[i].weight));
    }
    // Colour temperature, not just brightness. A real field runs from hot blue-white through
    // white to cool amber, and a single tint is most of what makes a star field look printed.
    const tintCell = floor(starUV.mul(STAR_LAYERS[1].density).add(7.1));
    const temperature = cosmicHash(tintCell);
    const starTint = mix(
      mix(color('#9fc8ff'), color('#ffffff'), smoothstep(float(0), float(.55), temperature)),
      color('#ffd9a8'), smoothstep(float(.72), float(1), temperature),
    );
    // No halo pass: a four-times-wider blob on the sparse layer read as a handful of giant stars
    // rather than a few bright ones. Brightness comes from the weight, never from the size.

    // Fresnel against the view normal: the silhouette edge is where the portal meets the world.
    const facing = normalView.normalize().dot(positionView.normalize().negate()).abs();
    const rim = pow(float(1).sub(facing), float(2.6));
    const rimColor = mix(color('#2f6bff'), color('#a05bff'), this.intensity);
    // A much tighter inner line reads as the event horizon of the cut-out.
    const horizon = pow(float(1).sub(facing), float(7)).mul(.55);

    const body = nebula
      .add(starTint.mul(stars).mul(float(1.15).add(this.intensity.mul(1.1))))
      .add(rimColor.mul(rim).mul(float(.35).add(this.intensity.mul(1.9))))
      .add(color('#7fd8ff').mul(horizon).mul(float(.4).add(this.intensity)));

    this.material = new MeshBasicNodeMaterial({ toneMapped: true });
    // Unlit: the cosmos is emitted, not shaded. A window has no surface to catch the sun.
    this.material.colorNode = mix(vec3(.01, .012, .03), body, this.enabledMix);
    this.material.name = 'cosmic-portal';
  }

  get enabled(): boolean { return this.enabledMix.value > .5; }
  set enabled(enabled: boolean) { this.enabledMix.value = enabled ? 1 : 0; }

  get metrics(): CosmicMetrics {
    return {
      level: Number(this.current.toFixed(3)),
      projection: 'screen',
      videoMix: Number(this.videoMix.value.toFixed(3)),
      parallax: Number(this.drift.length().toFixed(3)),
      materials: 1,
    };
  }

  /**
   * Feeds the camera's orientation in so the universe lags behind the body. Turning the camera
   * slides the window across the scene, which is what sells it as a space that is really there.
   */
  updateView(camera: PerspectiveCamera): void {
    const yaw = Math.atan2(camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]);
    const pitch = Math.asin(Math.max(-1, Math.min(1, -camera.matrixWorld.elements[9])));
    if (!this.previousYaw.ready) { this.previousYaw.yaw = yaw; this.previousYaw.pitch = pitch; this.previousYaw.ready = true; }
    // Shortest angular difference, so crossing the yaw seam does not throw the universe sideways.
    let dYaw = yaw - this.previousYaw.yaw;
    if (dYaw > Math.PI) dYaw -= Math.PI * 2; else if (dYaw < -Math.PI) dYaw += Math.PI * 2;
    this.previousYaw.yaw = yaw;
    const dPitch = pitch - this.previousYaw.pitch;
    this.previousYaw.pitch = pitch;
    // Accumulated and bounded: the offset is a lag, not an ever-growing scroll.
    this.drift.x = Math.max(-1, Math.min(1, this.drift.x + dYaw * .9));
    this.drift.y = Math.max(-1, Math.min(1, this.drift.y + dPitch * .9));
    this.parallax.value.set(this.drift.x, this.drift.y);

    // Keep the clip's own aspect: a 16:9 galaxy through a tall silhouette must not be squashed.
    const sourceAspect = Number.isFinite(this.source.aspect) && this.source.aspect > 0 ? this.source.aspect : 16 / 9;
    const viewAspect = camera.aspect > 0 ? camera.aspect : 1;
    const ratio = viewAspect / sourceAspect;
    if (ratio > 1) this.aspect.value.set(1, 1 / ratio); else this.aspect.value.set(ratio, 1);
  }

  update(dt: number, level: CosmicLevel, speed: number): void {
    if (!Number.isFinite(dt) || dt < 0) return;
    const pace = Number.isFinite(speed) ? Math.min(1, Math.max(0, speed / 9000)) : 0;
    const target = Math.min(1, LEVEL[level] + pace * .2);
    // Damped both ways, faster into a surge than out of it.
    this.current += (target - this.current) * (1 - Math.exp(-dt * (target > this.current ? 4.2 : 1.7)));
    this.intensity.value = this.current;
    // The clip carries its own motion; this only advances the procedural layers.
    this.phase.value += dt * (1 + this.current * 2.2);
    // The drift decays back to centre so a still camera settles instead of holding an offset.
    const settle = Math.exp(-dt * 1.3);
    this.drift.x *= settle; this.drift.y *= settle;
    this.parallax.value.set(this.drift.x, this.drift.y);

    // The source swaps its texture when the clip becomes ready; fade rather than pop.
    if (this.source.version !== this.sourceVersion) {
      this.sourceVersion = this.source.version;
      this.material.needsUpdate = true;
    }
    const wantVideo = this.source.state === 'VIDEO' ? 1 : 0;
    this.videoMix.value += (wantVideo - this.videoMix.value) * (1 - Math.exp(-dt * 2.4));
  }

  dispose(): void { this.material.dispose(); }
}
