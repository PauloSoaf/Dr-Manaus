import { AnimationClip, Bone, Group, SkinnedMesh } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export const PLAYER_CHARACTER_URL = `${import.meta.env?.BASE_URL ?? '/'}assets/player/dr-manaus-character.glb`;

export interface CharacterAsset {
  readonly scene: Group;
  readonly skinnedMeshes: readonly SkinnedMesh[];
  readonly skeletonBones: readonly Bone[];
  readonly bonesByName: ReadonlyMap<string, Bone>;
  readonly animations: readonly AnimationClip[];
  readonly clipsByName: ReadonlyMap<string, AnimationClip>;
}

let sourcePromise: ReturnType<GLTFLoader['loadAsync']> | undefined;
const plain = (name: string) => name.replace(/[.\s_-]/g, '').toLowerCase();

export async function loadCharacterAsset(): Promise<CharacterAsset> {
  sourcePromise ??= new GLTFLoader().loadAsync(PLAYER_CHARACTER_URL);
  const source = await sourcePromise;
  const scene = cloneSkeleton(source.scene) as Group;
  scene.name = 'DR Manaus · native Quaternius character';
  const skinnedMeshes: SkinnedMesh[] = [];
  scene.traverse(object => {
    if ((object as SkinnedMesh).isSkinnedMesh) skinnedMeshes.push(object as SkinnedMesh);
  });
  if (!skinnedMeshes.length) throw new Error('Player character GLB has no SkinnedMesh');
  const skeletonBones = skinnedMeshes[0].skeleton.bones;
  if (skeletonBones.length !== 65) throw new Error(`Expected Universal humanoid rig with 65 bones, got ${skeletonBones.length}`);
  const bonesByName = new Map(skeletonBones.map(bone => [plain(bone.name), bone]));
  const animations = source.animations.map(clip => clip.clone());
  const clipsByName = new Map(animations.map(clip => [clip.name, clip]));
  return { scene, skinnedMeshes, skeletonBones, bonesByName, animations, clipsByName };
}

export function findCharacterBone(asset: CharacterAsset, sourceName: string): Bone {
  const bone = asset.bonesByName.get(plain(sourceName));
  if (!bone) throw new Error(`Player character is missing bone ${sourceName}`);
  return bone;
}
