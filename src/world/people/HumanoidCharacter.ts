import {
  BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Vector3,
  type AnimationClip, type BufferGeometry, type Bone, type Object3D, type SkinnedMesh,
} from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { loadCharacterSource } from '../../player/animations/CharacterAsset';
import { loadAnimationLibrary } from '../../player/animations/AnimationLibrary';
import { AnimationGraph, createRigAdapter, Priority, type ActionHandle, type ActionOptions, type GaitSet, type RigAdapter } from '../../player/animations/graph/AnimationGraph';
import { npcBodyMaterial, npcEyeMaterial, npcHairMaterial, prepareRegions } from './NpcMaterial';
import type { Appearance, HairStyle } from './Appearance';

/**
 * A real, rigged pedestrian: the hero's own 65-bone skeleton (male) or Quaternius' female body on
 * the same rig, dressed by a shared palette material, with a hairstyle on the head bone, simple
 * accessories, and an AnimationGraph that plays the very same authored clips as the hero (walk,
 * talk, phone, sit, drive, flee, wave…). Geometry, clips and materials are shared across the crowd.
 */
export const NPC_BODIES_URL = `${import.meta.env?.BASE_URL ?? '/'}assets/npc/npc-bodies.glb`;
const HERO_PELVIS_Y = 0.949, FEMALE_PELVIS_Y = 0.932;

interface SharedAssets {
  male: Object3D;
  female: Object3D;
  hair: Map<string, BufferGeometry>;
  clips: AnimationClip[];
  femaleAdapter: RigAdapter;
}

let shared: Promise<SharedAssets> | undefined;

const plain = (name: string) => name.replace(/[.\s_-]/g, '').toLowerCase();
function boneByName(root: Object3D, name: string): Bone | undefined {
  let found: Bone | undefined;
  const key = plain(name);
  root.traverse(o => { if (!found && (o as Bone).isBone && plain(o.name) === key) found = o as Bone; });
  return found;
}
function bonesOf(root: Object3D): Bone[] {
  const out: Bone[] = [];
  root.traverse(o => { if ((o as Bone).isBone) out.push(o as Bone); });
  return out;
}

/** Loads (once) the bodies, hair and every clip pedestrians may play. */
export function loadHumanoidAssets(): Promise<SharedAssets> {
  shared ??= (async () => {
    const [hero, npc, library] = await Promise.all([
      loadCharacterSource(),
      new GLTFLoader().loadAsync(NPC_BODIES_URL),
      loadAnimationLibrary(),
    ]);
    const female = npc.scene.getObjectByName('npc_female') ?? npc.scene;
    const hair = new Map<string, BufferGeometry>();
    npc.scene.traverse(o => { if ((o as Mesh).isMesh && o.name.startsWith('hair_')) hair.set(o.name.slice(5), (o as Mesh).geometry); });
    const heroBones = bonesOf(hero.scene), femaleBones = bonesOf(female);
    return {
      male: hero.scene, female, hair,
      clips: [...hero.animations, ...library],
      femaleAdapter: createRigAdapter(heroBones, femaleBones, HERO_PELVIS_Y, FEMALE_PELVIS_Y),
    };
  })();
  return shared;
}

/** Pedestrian gaits: same speed bands as the hero, but the walk may be formal or carrying. */
export function pedestrianGaits(walk: string): GaitSet {
  return {
    idle: 'Idle_Loop',
    gaits: [{ name: walk, pure: [0.55, 1.9] }, { name: 'Jog_Fwd_Loop', pure: [4.2, 7.4] }, { name: 'Sprint_Loop', pure: [8.8, 99] }],
    minRate: 0.6, maxRate: 2.0,
  };
}

const accessoryMaterial = new MeshStandardMaterial({ color: '#2a2f36', roughness: 0.85 });
const phoneMaterial = new MeshStandardMaterial({ color: '#0e1013', roughness: 0.3, metalness: 0.4 });
const backpackGeometry = new BoxGeometry(0.3, 0.38, 0.16);
const capGeometry = new CylinderGeometry(0.1, 0.1, 0.07, 14);
const brimGeometry = new BoxGeometry(0.17, 0.012, 0.11);
const phoneGeometry = new BoxGeometry(0.075, 0.15, 0.012);

export class HumanoidCharacter {
  /** World placement: the owner sets position and `rotation.y` (yaw 0 faces -Z, like the hero). */
  readonly group = new Group();
  readonly graph: AnimationGraph;
  readonly appearance: Appearance;
  private readonly body: Object3D;
  private readonly meshes: SkinnedMesh[] = [];
  private readonly phone?: Mesh;
  private phoneVisible = false;
  /** Seconds since the graph was last advanced (for reduced-rate LOD updates). */
  private pending = 0;

  private constructor(assets: SharedAssets, appearance: Appearance) {
    this.appearance = appearance;
    const female = appearance.body === 'female';
    this.body = cloneSkeleton(female ? assets.female : assets.male);
    this.body.rotation.y = Math.PI;
    this.body.scale.setScalar(appearance.scale);
    this.body.position.y = 0.01 * appearance.scale;
    this.group.name = `pedestre · ${appearance.name} (${appearance.label})`;
    this.group.add(this.body);
    this.body.traverse(o => {
      const mesh = o as SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const name = mesh.name.toLowerCase();
      if (name.includes('eye') && !name.includes('brow')) mesh.material = npcEyeMaterial();
      else if (name.includes('brow')) mesh.material = npcHairMaterial();
      else { prepareRegions(mesh); mesh.material = npcBodyMaterial(); }
      mesh.userData.outfit = appearance.outfit;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
    });
    const head = boneByName(this.body, 'Head');
    const attachHair = (style: HairStyle) => {
      const geometry = style !== 'none' ? assets.hair.get(style) : undefined;
      if (!head || !geometry) return;
      const mesh = new Mesh(geometry, npcHairMaterial());
      mesh.userData.outfit = appearance.outfit;
      mesh.castShadow = true;
      head.add(mesh);
    };
    attachHair(appearance.hair);
    if (appearance.beard) attachHair('beard');
    if (appearance.cap && head) {
      const cap = new Mesh(capGeometry, new MeshStandardMaterial({ color: appearance.capColor, roughness: 0.8 }));
      cap.position.set(0, 0.17, 0.005);
      const brim = new Mesh(brimGeometry, cap.material);
      brim.position.set(0, -0.03, 0.09);
      cap.add(brim);
      head.add(cap);
    }
    const chest = boneByName(this.body, 'spine_03');
    if (appearance.backpack && chest) {
      const pack = new Mesh(backpackGeometry, accessoryMaterial);
      // Bone space of the chest: up the spine is +Y; the back is -Z in the GLB frame.
      pack.position.set(0, 0.02, -0.17);
      chest.add(pack);
    }
    const hand = boneByName(this.body, 'hand_r');
    if (hand) {
      this.phone = new Mesh(phoneGeometry, phoneMaterial);
      this.phone.position.set(0.0, 0.09, 0.03);
      this.phone.visible = false;
      hand.add(this.phone);
    }
    this.graph = new AnimationGraph(this.body, assets.clips, female ? assets.femaleAdapter : undefined);
    this.graph.worldScale = appearance.scale;
    this.graph.setLocomotion(pedestrianGaits(appearance.walkClip), { speed: 0 });
  }

  static async create(appearance: Appearance): Promise<HumanoidCharacter> {
    return new HumanoidCharacter(await loadHumanoidAssets(), appearance);
  }

  /** Synchronous creation once `loadHumanoidAssets()` has resolved. */
  static createWith(assets: SharedAssets, appearance: Appearance): HumanoidCharacter {
    return new HumanoidCharacter(assets, appearance);
  }

  get visible(): boolean { return this.group.visible; }
  set visible(v: boolean) { this.group.visible = v; }

  /** Speed in m/s (world); the gait set is chosen by the archetype. */
  walk(speed: number): void { this.graph.setTransition(0.25).setLocomotion(pedestrianGaits(this.appearance.walkClip), { speed }); }
  /** Loop a pose as the base (sit, talk, phone, drive, lean). */
  pose(name: string, rate = 1, fade = 0.3): void { this.graph.setTransition(fade).setPose(name, rate); }
  play(name: string, options: ActionOptions): ActionHandle | null { return this.graph.play(name, options); }
  stop(handle: ActionHandle | null | undefined, fade?: number): void { this.graph.stop(handle, fade); }
  /** Shows the phone prop in the right hand (for the phone-call loop). */
  set holdingPhone(on: boolean) { if (this.phone && on !== this.phoneVisible) { this.phone.visible = on; this.phoneVisible = on; } }

  /**
   * Advances animation. `interval` > 0 throttles distant pedestrians: their clocks accumulate and
   * the skeleton is evaluated every `interval` seconds instead of every frame.
   */
  update(dt: number, interval = 0): void {
    this.pending += dt;
    if (interval > 0 && this.pending < interval) return;
    this.graph.update(this.pending);
    this.pending = 0;
  }

  /** World position of a bone (e.g. the head, for look-at and dialogue framing). */
  bonePosition(name: string, out = new Vector3()): Vector3 {
    const bone = boneByName(this.body, name);
    return bone ? bone.getWorldPosition(out) : this.group.getWorldPosition(out);
  }

  dispose(): void {
    this.graph.dispose();
    this.group.removeFromParent();
    this.body.traverse(o => { const m = o as Mesh; if (m.isMesh && m.material instanceof MeshStandardMaterial && m.material !== accessoryMaterial && m.material !== phoneMaterial) m.material.dispose(); });
  }
}

export { Priority };
