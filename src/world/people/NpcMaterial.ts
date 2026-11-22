import { BufferAttribute, Color, MeshStandardNodeMaterial, type BufferGeometry, type SkinnedMesh } from 'three/webgpu';
import { attribute, float, pow, uniform } from 'three/tsl';

/**
 * Pedestrian clothing without textures: every vertex of a body carries how much of it belongs to
 * the head, torso, upper arms, forearms, hands, hips/thighs, shins and feet (summed skin weights of
 * the bones in each region). One shared node material turns those weights into skin, shirt,
 * trousers and shoes, with per-person colours fed through per-object uniforms — so a crowd of
 * different people is one shader, never a compile per pedestrian.
 */
export interface Outfit {
  skin: Color;
  shirt: Color;
  pants: Color;
  shoes: Color;
  hair: Color;
  /** 0 = bare forearms (short sleeves), 1 = sleeves. */
  sleeves: number;
  /** 0 = bare shins (shorts / skirt), 1 = trousers. */
  trousers: number;
}

const REGION_OF = (bone: string): number => {
  const n = bone.toLowerCase();
  if (n.startsWith('head') || n.startsWith('neck')) return 0;
  if (n.startsWith('spine') || n.startsWith('clavicle')) return 1;
  if (n.startsWith('upperarm')) return 2;
  if (n.startsWith('lowerarm')) return 3;
  if (n.startsWith('hand') || /^(thumb|index|middle|ring|pinky)/.test(n)) return 4;
  if (n.startsWith('pelvis') || n.startsWith('thigh') || n === 'root') return 5;
  if (n.startsWith('calf')) return 6;
  return 7; // foot, ball
};

const prepared = new WeakSet<BufferGeometry>();

/** Adds the two region-weight attributes to a skinned body's geometry (once per shared geometry). */
export function prepareRegions(mesh: SkinnedMesh): void {
  const geometry = mesh.geometry;
  if (prepared.has(geometry)) return;
  const index = geometry.getAttribute('skinIndex'), weight = geometry.getAttribute('skinWeight');
  const count = geometry.getAttribute('position').count;
  const a = new Float32Array(count * 4), b = new Float32Array(count * 4);
  const regions = mesh.skeleton.bones.map(bone => REGION_OF(bone.name));
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 4; k++) {
      const w = weight.getComponent(i, k);
      if (w <= 0) continue;
      const region = regions[index.getComponent(i, k)] ?? 1;
      if (region < 4) a[i * 4 + region] += w; else b[i * 4 + region - 4] += w;
    }
  }
  geometry.setAttribute('npcRegionA', new BufferAttribute(a, 4));
  geometry.setAttribute('npcRegionB', new BufferAttribute(b, 4));
  prepared.add(geometry);
}

type OutfitHolder = { userData: { outfit?: Outfit } };
const fallback: Outfit = { skin: new Color('#b07a55'), shirt: new Color('#3d6b8c'), pants: new Color('#2f3540'), shoes: new Color('#1d1d1f'), hair: new Color('#1a1410'), sleeves: 0, trousers: 1 };
const outfitOf = (object: unknown): Outfit => (object as OutfitHolder).userData?.outfit ?? fallback;

let bodyMaterial: MeshStandardNodeMaterial | undefined;
let hairMaterial: MeshStandardNodeMaterial | undefined;
let eyeMaterial: MeshStandardNodeMaterial | undefined;

/** The one material every pedestrian body shares. */
export function npcBodyMaterial(): MeshStandardNodeMaterial {
  if (bodyMaterial) return bodyMaterial;
  const skin = uniform(new Color()).onObjectUpdate(({ object }) => outfitOf(object).skin);
  const shirt = uniform(new Color()).onObjectUpdate(({ object }) => outfitOf(object).shirt);
  const pants = uniform(new Color()).onObjectUpdate(({ object }) => outfitOf(object).pants);
  const shoes = uniform(new Color()).onObjectUpdate(({ object }) => outfitOf(object).shoes);
  const sleeves = uniform(0).onObjectUpdate(({ object }) => outfitOf(object).sleeves);
  const trousers = uniform(1).onObjectUpdate(({ object }) => outfitOf(object).trousers);
  const a = attribute('npcRegionA', 'vec4'), b = attribute('npcRegionB', 'vec4');
  const sharp = (w: ReturnType<typeof float>) => pow(w.max(0), float(6));
  const forearm = sharp(a.w as never), shin = sharp(b.z as never);
  const wSkin = sharp(a.x as never).add(sharp(b.x as never)).add(forearm.mul(float(1).sub(sleeves))).add(shin.mul(float(1).sub(trousers)));
  const wShirt = sharp(a.y as never).add(sharp(a.z as never)).add(forearm.mul(sleeves));
  const wPants = sharp(b.y as never).add(shin.mul(trousers));
  const wShoes = sharp(b.w as never);
  const total = wSkin.add(wShirt).add(wPants).add(wShoes).max(1e-4);
  const material = new MeshStandardNodeMaterial({ roughness: 0.82, metalness: 0 });
  material.colorNode = skin.mul(wSkin).add(shirt.mul(wShirt)).add(pants.mul(wPants)).add(shoes.mul(wShoes)).div(total);
  material.name = 'npc-body';
  bodyMaterial = material;
  return material;
}

/** Hair and eyebrows: per-person hair colour. */
export function npcHairMaterial(): MeshStandardNodeMaterial {
  if (hairMaterial) return hairMaterial;
  const hair = uniform(new Color()).onObjectUpdate(({ object }) => outfitOf(object).hair);
  const material = new MeshStandardNodeMaterial({ roughness: 0.65, metalness: 0 });
  material.colorNode = hair;
  material.name = 'npc-hair';
  hairMaterial = material;
  return material;
}

export function npcEyeMaterial(): MeshStandardNodeMaterial {
  eyeMaterial ??= Object.assign(new MeshStandardNodeMaterial({ color: '#1b1612', roughness: 0.3, metalness: 0 }), { name: 'npc-eyes' });
  return eyeMaterial;
}
