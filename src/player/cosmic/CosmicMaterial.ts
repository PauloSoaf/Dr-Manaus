import { MeshStandardNodeMaterial, type Node } from 'three/webgpu';
import {
  attribute, cameraPosition, color, float, floor, fract, mix, modelWorldMatrixInverse,
  normalWorld, positionGeometry, positionWorld, sin, smoothstep, time, uniform, vec3, vec4,
} from 'three/tsl';

export type CosmicLevel = 'idle' | 'flight' | 'power' | 'boost' | 'mega';

type Float = Node<'float'>;
type Vec3 = Node<'vec3'>;

/** One row per level: the whole look is seven scalars, eased toward these targets every frame. */
interface Look { rate: number; rim: number; star: number; energy: number; streak: number; heat: number; glow: number }
const LOOKS: Record<CosmicLevel, Look> = {
  idle: { rate: .05, rim: .34, star: .6, energy: 0, streak: 0, heat: 0, glow: .6 },
  flight: { rate: .15, rim: .58, star: .9, energy: .22, streak: 0, heat: .18, glow: .92 },
  power: { rate: .36, rim: 1.1, star: 1.3, energy: .95, streak: .05, heat: .6, glow: 1.4 },
  boost: { rate: .55, rim: 1.3, star: 1.5, energy: 1.15, streak: .3, heat: .72, glow: 1.6 },
  mega: { rate: 1.1, rim: 2, star: 2.2, energy: 1.85, streak: 1, heat: 1, glow: 2.35 },
};
/** Near-black with a violet cast, then the three nebula tints and the two rim tints. */
const VOID = '#04050f', DEEP = '#2c1067', TIDE = '#1a3cb4', HALO = '#3fd9ff';
const EMBER = '#c06bff', STARLIGHT = '#dceaff', RIM_COOL = '#5f86ff', RIM_HOT = '#b96dff';
/** Sternum height in body metres: the energy pulses radiate from here out through the limbs. */
const SPINE = 1.34;
const TAU = 6.2831853;

/**
 * Trig-free hash. `fract(sin(...))` drifts between WGSL and GLSL and blows up at large coordinates;
 * this one is pure multiply-and-fract, so the WebGPU and WebGL2 backends agree on every star.
 */
function hash(p: Vec3): Float {
  const q = fract(p.mul(.3183099).add(.1)).mul(17);
  return fract(q.x.mul(q.y).mul(q.z).mul(q.x.add(q.y).add(q.z)));
}

/** Trilinear value noise with a smoothstep fade: the cheapest thing that still reads as gas. */
function noise(p: Vec3): Float {
  const cell = floor(p), f = fract(p);
  const u = f.mul(f).mul(f.mul(-2).add(3));
  const a = mix(hash(cell), hash(cell.add(vec3(1, 0, 0))), u.x);
  const b = mix(hash(cell.add(vec3(0, 1, 0))), hash(cell.add(vec3(1, 1, 0))), u.x);
  const c = mix(hash(cell.add(vec3(0, 0, 1))), hash(cell.add(vec3(1, 0, 1))), u.x);
  const d = mix(hash(cell.add(vec3(0, 1, 1))), hash(cell.add(vec3(1, 1, 1))), u.x);
  return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}

/**
 * One star per hashed cell. `stretch` divides the sampling depth, so a cell grows long along the
 * body's Z — which is the direction of travel — and the points draw out into streaks at mega speed.
 */
function stars(p: Vec3, stretch: Float, sparkle: Float): Float {
  const q = vec3(p.x, p.y, p.z.div(stretch));
  const cell = floor(q), f = fract(q);
  const h = hash(cell), g = hash(cell.add(19.37)), b = hash(cell.add(47.13));
  const drop = float(1).sub(f.sub(vec3(h, g, b)).length().mul(2.6)).max(0);
  // Most stars faint, a handful far brighter: a flat distribution reads as noise, not as a sky.
  const magnitude = b.mul(b).mul(b).mul(b).mul(b);
  const twinkle = sin(sparkle.add(h.mul(23.1))).mul(.3).add(.7);
  return drop.pow(11).mul(magnitude).mul(twinkle);
}

/**
 * The universe inside DR Manaus. Everything is procedural — no texture, no fetch, no third-party
 * asset — and everything is evaluated in rest-pose body space, which the geometry carries in the
 * `cosmicPos` attribute. That is what keeps the nebulae pinned inside the figure instead of
 * sliding over its surface when it turns, and what lets one material span every body part.
 */
export class CosmicMaterial {
  readonly material: MeshStandardNodeMaterial;
  /** Phases accumulate on the CPU: raising the drift rate then speeds the clouds up, never jumps them. */
  private readonly uDrift = uniform(0);
  private readonly uFlow = uniform(0);
  private readonly uRim = uniform(LOOKS.idle.rim);
  private readonly uStar = uniform(LOOKS.idle.star);
  private readonly uEnergy = uniform(0);
  private readonly uStretch = uniform(1);
  private readonly uHeat = uniform(0);
  private readonly uGlow = uniform(LOOKS.idle.glow);
  private rate = LOOKS.idle.rate;

  constructor(options: { seed?: number } = {}) {
    this.material = new MeshStandardNodeMaterial({ color: '#080b1c', roughness: .44, metalness: .36, emissive: '#1a1050' });
    this.material.name = 'cosmic-body';
    // Headless tooling and the unit tests build this material with no GPU and no shader compiler.
    try { this.write(options.seed ?? 17.43); } catch { this.material.colorNode = null; }
  }

  /** Smoothly drives the whole look; call once per frame, before the renderer draws the character. */
  update(dt: number, level: CosmicLevel, speed: number): void {
    const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), .25) : 0;
    const look = LOOKS[level] ?? LOOKS.idle;
    const push = Math.min(1, Math.max(0, Number.isFinite(speed) ? speed : 0) / 2400);
    const blend = 1 - Math.exp(-step * 3.6);
    this.rate += (look.rate * (1 + push * 1.6) - this.rate) * blend;
    this.uRim.value += (look.rim * (1 + push * .35) - this.uRim.value) * blend;
    this.uStar.value += (look.star - this.uStar.value) * blend;
    this.uEnergy.value += (look.energy * (1 + push * .5) - this.uEnergy.value) * blend;
    this.uStretch.value += (1 + look.streak * (1 + push * 3) * 6 - this.uStretch.value) * blend;
    this.uHeat.value += (look.heat - this.uHeat.value) * blend;
    this.uGlow.value += (look.glow - this.uGlow.value) * blend;
    // Wrapped so an hour-long session cannot walk the phase out of float precision.
    this.uDrift.value = (this.uDrift.value + step * this.rate) % 2048;
    this.uFlow.value = (this.uFlow.value + step * (.35 + this.rate * 1.9)) % 2048;
  }

  dispose(): void { this.material.dispose(); }

  private write(seed: number): void {
    const body = attribute('cosmicPos', 'vec3'), partScale = attribute('cosmicScale', 'vec3');
    const p = body.mul(2.15).add(vec3(seed * .137, seed * .311, seed * .713));
    // Camera in this part's own space, rescaled into body space: a direction, so the huge world
    // coordinates cancel and the offset below reads as interior depth rather than as a decal.
    const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz;
    const look = eye.sub(positionGeometry).mul(partScale).normalize();
    const flow = vec3(this.uDrift.mul(.07), this.uDrift.mul(.34), this.uDrift.mul(.18));
    const near = noise(p.add(flow));
    const mid = noise(p.mul(2.37).sub(flow.mul(1.7)).add(11.3));
    const deep = noise(p.mul(.63).sub(look.mul(.9)).add(flow.mul(.5)).add(31.7));
    const cloud = near.mul(.58).add(mid.mul(.27)).add(deep.mul(.42));
    const veil = smoothstep(.28, .92, cloud), core = smoothstep(.62, 1.04, cloud);
    const gas = mix(color(DEEP), color(TIDE), smoothstep(.2, .8, near)).mul(veil).add(color(HALO).mul(core.mul(.55)));
    const hot = mix(gas, mix(color(EMBER), color(HALO), core), this.uHeat.mul(.55));
    // Cell-constant grain at roughly three centimetres: the dust that keeps the gas from looking painted.
    const dust = hash(floor(p.mul(17).add(look.mul(.4)))).mul(.5).add(.72);
    const lit = hot.mul(dust);
    const field = stars(p.mul(3.1).sub(look.mul(.35)), this.uStretch, time.mul(2.3))
      .add(stars(p.mul(6.7).sub(look.mul(1.1)).add(53.1), this.uStretch, time.mul(1.6).add(1.7)).mul(.55))
      .mul(this.uStar);
    const fresnel = float(1).sub(normalWorld.dot(cameraPosition.sub(positionWorld).normalize()).abs()).pow(2.6);
    const rim = mix(color(RIM_COOL), color(RIM_HOT), this.uHeat).mul(fresnel).mul(this.uRim);
    // A band climbing the torso plus a shell expanding from the sternum, which is what carries the
    // charge out along the arms and legs without needing a second attribute to describe them.
    const rise = sin(body.y.mul(1.7).sub(this.uFlow).mul(TAU)).max(0).pow(16);
    const shell = sin(body.sub(vec3(0, SPINE, 0)).length().mul(2.1).sub(this.uFlow.mul(1.35)).mul(TAU)).max(0).pow(10);
    const charge = mix(color(HALO), color(EMBER), this.uHeat).mul(rise.mul(.65).add(shell.mul(.9)).mul(this.uEnergy));
    // Albedo stays nearly black so scene lighting cannot wash the interior out; the universe is emissive.
    this.material.colorNode = color(VOID).rgb.add(lit.mul(.22));
    this.material.emissiveNode = lit.mul(this.uGlow).add(color(STARLIGHT).mul(field)).add(rim).add(charge);
  }
}
