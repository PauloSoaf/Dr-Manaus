import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Mesh, Object3D, Quaternion,
  Sphere, SpriteNodeMaterial, Uint32BufferAttribute, Vector3,
} from 'three/webgpu';
import { attribute, cos, float, positionGeometry, sin, uniform, vec2, vec3 } from 'three/tsl';
import type { CosmicLevel } from './CosmicMaterial';

/** Fade, trail length, mote size and orbit rate per level. `idle` is a hard zero: standing still is clean. */
interface Halo { fade: number; trail: number; size: number; spin: number }
const HALOS: Record<CosmicLevel, Halo> = {
  idle: { fade: 0, trail: 0, size: .5, spin: .12 },
  flight: { fade: .55, trail: .6, size: .85, spin: .5 },
  power: { fade: 1, trail: .45, size: 1.1, spin: 1.7 },
  boost: { fade: 1.05, trail: 1.6, size: 1.15, spin: 1.1 },
  mega: { fade: 1.3, trail: 3.6, size: 1.4, spin: .85 },
};
const MOTE_COOL = new Color('#6f7dff'), MOTE_WARM = new Color('#c77bff'), MOTE_HOT = new Color('#7ef4ff');
const TAU = 6.2831853;
const BACK = new Vector3(0, 0, 1);
/** mulberry32, the same generator SpaceLayer seeds its sky with, so the halo is identical everywhere. */
const seeded = (seed: number) => () => {
  seed = seed + 0x6d2b79f5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

/**
 * The motes drifting around the figure and the short trail they leave behind it: one mesh of
 * billboarded quads, one draw call, hidden entirely while the character is idle. Points are not
 * an option here — WebGPU clamps point primitives to a single pixel — so this is the sprite path
 * three documents for instanced points, with the quad corners in the position attribute and each
 * mote's own centre fed to the sprite vertex stage through `positionNode`.
 */
export class CosmicAura {
  private readonly mesh: Mesh;
  private readonly material = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false, toneMapped: false });
  private readonly uSpin = uniform(0);
  private readonly uBob = uniform(0);
  private readonly uFade = uniform(0);
  private readonly uTrail = uniform(0);
  private readonly uSize = uniform(HALOS.idle.size);
  private readonly uBack = uniform(new Vector3().copy(BACK));
  private readonly turn = new Quaternion();
  private readonly local = new Vector3();
  private rate = HALOS.idle.spin;

  constructor(private readonly parent: Object3D, options: { count?: number; seed?: number } = {}) {
    const count = Math.max(8, Math.min(512, Math.round(options.count ?? 96)));
    this.mesh = new Mesh(this.build(count, options.seed ?? 0x1acea7), this.material);
    this.mesh.name = 'cosmic-aura';
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    this.write();
    parent.add(this.mesh);
  }

  update(dt: number, level: CosmicLevel, speed: number, forward: Vector3): void {
    const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), .25) : 0;
    const halo = HALOS[level] ?? HALOS.idle;
    const push = Math.min(1, Math.max(0, Number.isFinite(speed) ? speed : 0) / 2400);
    const blend = 1 - Math.exp(-step * 3.6);
    this.rate += (halo.spin - this.rate) * blend;
    this.uFade.value += (halo.fade - this.uFade.value) * blend;
    this.uTrail.value += (halo.trail * (1 + push * 1.4) - this.uTrail.value) * blend;
    this.uSize.value += (halo.size * (1 + push * .3) - this.uSize.value) * blend;
    this.uSpin.value = (this.uSpin.value + step * (this.rate + push * .8)) % TAU;
    this.uBob.value = (this.uBob.value + step * 2.1) % TAU;
    // The trail has to lie behind the figure in its own frame, and the figure keeps turning.
    if (forward.lengthSq() > 1e-6) {
      this.parent.getWorldQuaternion(this.turn).invert();
      this.local.copy(forward).applyQuaternion(this.turn).normalize().negate();
      this.uBack.value.lerp(this.local, blend);
    }
    this.mesh.visible = this.uFade.value > .004;
  }

  dispose(): void {
    this.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  /** Golden-angle shell around the body, seeded, built once: every mote is placed at construction. */
  private build(count: number, seed: number): BufferGeometry {
    const random = seeded(seed);
    const corner = new Float32Array(count * 12), anchor = new Float32Array(count * 12);
    const spark = new Float32Array(count * 12), tint = new Float32Array(count * 12);
    const index = new Uint32Array(count * 6);
    const hue = new Color();
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963 + random() * .4;
      const height = .16 + (i + random()) / count * 2.16;
      // Widest around the chest, tighter at the head and the feet, so the halo follows the figure.
      const radius = .5 + Math.sin((height / 2.32) * Math.PI) * .42 + random() * .26;
      const ax = Math.cos(angle) * radius, az = Math.sin(angle) * radius;
      const size = .022 + random() * random() * .075;
      const drag = random() * random();
      const warmth = random();
      hue.copy(MOTE_COOL).lerp(MOTE_WARM, warmth).lerp(MOTE_HOT, random() * .5);
      for (let c = 0; c < 4; c++) {
        const u = c === 0 || c === 3 ? -1 : 1, v = c < 2 ? -1 : 1, slot = (i * 4 + c) * 3;
        corner[slot] = u; corner[slot + 1] = v; corner[slot + 2] = 0;
        anchor[slot] = ax; anchor[slot + 1] = height; anchor[slot + 2] = az;
        spark[slot] = size; spark[slot + 1] = random(); spark[slot + 2] = drag;
        tint[slot] = hue.r; tint[slot + 1] = hue.g; tint[slot + 2] = hue.b;
      }
      const base = i * 4, slice = i * 6;
      index[slice] = base; index[slice + 1] = base + 1; index[slice + 2] = base + 2;
      index[slice + 3] = base; index[slice + 4] = base + 2; index[slice + 5] = base + 3;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(corner, 3));
    geometry.setAttribute('anchor', new Float32BufferAttribute(anchor, 3));
    geometry.setAttribute('spark', new Float32BufferAttribute(spark, 3));
    geometry.setAttribute('tint', new Float32BufferAttribute(tint, 3));
    geometry.setIndex(new Uint32BufferAttribute(index, 1));
    // Set by hand: the vertices sit at the quad corners, not where the vertex stage puts the motes.
    geometry.boundingSphere = new Sphere(new Vector3(0, 1.2, 0), 5.4);
    return geometry;
  }

  private write(): void {
    try {
      const anchor = attribute('anchor', 'vec3'), spark = attribute('spark', 'vec3'), tint = attribute('tint', 'vec3');
      const angle = spark.y.mul(TAU).add(this.uSpin);
      const c = cos(angle), s = sin(angle);
      const orbit = vec3(anchor.x.mul(c).sub(anchor.z.mul(s)), anchor.y, anchor.x.mul(s).add(anchor.z.mul(c)));
      const bob = sin(this.uBob.add(spark.y.mul(TAU))).mul(.07);
      this.material.positionNode = orbit.add(vec3(0, bob, 0)).add(this.uBack.mul(spark.z.mul(this.uTrail)));
      this.material.scaleNode = vec2(spark.x.mul(this.uSize));
      const drop = float(1).sub(positionGeometry.xy.length()).max(0);
      const flicker = sin(this.uBob.mul(1.7).add(spark.y.mul(31.4))).mul(.24).add(.76);
      this.material.colorNode = tint;
      this.material.opacityNode = drop.pow(2.4).mul(this.uFade).mul(flicker).saturate();
    } catch { this.material.positionNode = null; }
  }
}
