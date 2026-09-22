import { DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace, type Node } from 'three/webgpu';
import { color, float, floor, fract, mix, sin, smoothstep, vec2, vec3 } from 'three/tsl';

type Float = Node<'float'>;
type Vec2 = Node<'vec2'>;

/** Multiply/fract hashing stays stable on both the GLSL and WGSL backends. */
export function cosmicHash(p: Vec2): Float {
  const q = fract(vec3(p.x, p.y, p.x).mul(.1031));
  const r = q.add(q.dot(q.yzx.add(33.33)));
  return fract(r.x.add(r.y).mul(r.z));
}

function gasNoise(p: Vec2): Float {
  const cell = floor(p), f = fract(p), u = f.mul(f).mul(float(3).sub(f.mul(2)));
  return mix(
    mix(cosmicHash(cell), cosmicHash(cell.add(vec2(1, 0))), u.x),
    mix(cosmicHash(cell.add(vec2(0, 1))), cosmicHash(cell.add(vec2(1, 1))), u.x), u.y,
  );
}

/** Two gas scales only; this is an immediate fallback while the shared video loads. */
export function proceduralCosmos(uv: Vec2, phase: Float, seed: number): Node<'vec3'> {
  const p = uv.mul(4.6).add(vec2(seed * .013, seed * .071));
  const flow = vec2(phase.mul(.006), phase.mul(-.009));
  const broad = gasNoise(p.add(flow));
  const fine = gasNoise(p.mul(2.23).sub(flow.mul(.8)).add(11.3));
  const cloud = broad.mul(.69).add(fine.mul(.31));
  const veil = smoothstep(.44, .79, cloud);
  const filament = smoothstep(.66, .91, cloud).mul(smoothstep(.3, .8, fine));
  const deep = mix(color('#310c70'), color('#173d91'), smoothstep(.27, .77, broad));
  return color('#010107').rgb.add(deep.mul(veil).mul(1.4))
    .add(mix(color('#9544d1'), color('#45bfd1'), fine).mul(filament).mul(.72));
}

/** Analytic pinpoints are projected into the same screen plane, never attached to a limb. */
export function projectedStars(uv: Vec2, phase: Float, density: number, layerSeed: number, streak: Float): Float {
  const p = uv.mul(density).add(layerSeed);
  const cell = floor(p), f = fract(p);
  const h = cosmicHash(cell), j = cosmicHash(cell.add(27.71));
  const center = vec2(h, j).mul(.76).add(.12);
  const delta = f.sub(center);
  const metric = vec2(delta.x, delta.y.div(float(1).add(streak.mul(2.8)))).length();
  const magnitude = h.pow(6);
  const point = float(1).sub(smoothstep(.008, .045, metric));
  const rareHalo = float(1).sub(smoothstep(.012, .12, metric)).mul(smoothstep(.982, 1, j)).mul(.18);
  const twinkle = sin(phase.mul(.8).add(j.mul(31.7))).mul(.18).add(.82);
  return point.add(rareHalo).mul(magnitude).mul(twinkle);
}

/** The sampler is always valid, including Node tests and the first frame before DOM/video init. */
export function createCosmicPlaceholder(): DataTexture {
  const texture = new DataTexture(new Uint8Array([1, 1, 5, 255]), 1, 1, RGBAFormat);
  texture.name = 'cosmic-procedural-placeholder'; texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter; texture.magFilter = LinearFilter;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  return texture;
}
