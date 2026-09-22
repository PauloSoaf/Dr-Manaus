/**
 * Builds DR Manaus from Quaternius' Superhero Male and selected UAL1/UAL2
 * Standard clips. Animation rotations are retargeted once from the UAL
 * mannequin rest pose to the Superhero rest pose; runtime uses the resulting
 * native glTF clips without an intermediate rig.
 *
 * Duplicate-rig canonicalization follows Station-Sciences/bot-crossing (MIT).
 * See docs/animation-credits.md.
 */
import { Accessor, AnimationChannel, AnimationSampler, NodeIO } from '@gltf-transform/core';
import { dedup, mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
import { AnimationMixer, Quaternion } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const BASE_ROOT = 'artifacts/animations/source/extracted/quaternius-base-characters/Universal Base Characters[Standard]';
const UAL1_ROOT = 'artifacts/animations/source/extracted/quaternius-ual1/Universal Animation Library[Standard]';
const UAL2_ROOT = 'artifacts/animations/source/extracted/quaternius/Universal Animation Library 2[Standard]';
const BASE = `${BASE_ROOT}/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf`;
const UAL1 = `${UAL1_ROOT}/Unreal-Godot/UAL1_Standard.glb`;
const UAL2 = `${UAL2_ROOT}/Unreal-Godot/UAL2_Standard.glb`;
const MODULAR_MEN = 'artifacts/animations/source/ultimate-modular-men/Animations.fbx';
const OUT = 'public/assets/player/dr-manaus-character.glb';
const WANTED_UAL1 = [
  'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop',
  'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Roll',
  'Punch_Jab', 'Punch_Cross', 'Hit_Chest', 'Hit_Head',
  'Swim_Idle_Loop', 'Swim_Fwd_Loop',
];
const WANTED_UAL2 = [
  'Idle_FoldArms_Loop', 'Melee_Hook', 'Melee_Hook_Rec',
  'NinjaJump_Start', 'NinjaJump_Idle_Loop', 'NinjaJump_Land',
  'ClimbUp_1m', 'Slide_Start', 'Slide_Loop', 'Slide_Exit',
  'OverhandThrow', 'Hit_Knockback',
];

// The Standard UAL packs do not contain a kick. These two authored CC0 clips
// come from Quaternius' Ultimate Modular Men Pack and are sampled/retargeted
// once here. Runtime still receives ordinary native glTF AnimationClips.
const KICK_CLIPS = new Map([
  ['CharacterArmature|Kick_Left', 'Kick_Left'],
  ['CharacterArmature|Kick_Right', 'Kick_Right'],
]);
const KICK_BONE_MAP = new Map([
  ['Root', 'root'], ['Body', 'pelvis'],
  ['Abdomen', 'spine_01'], ['Torso', 'spine_02'], ['Chest', 'spine_03'],
  ['Neck', 'neck_01'], ['Head', 'Head'],
  ['ShoulderL', 'clavicle_l'], ['UpperArmL', 'upperarm_l'], ['LowerArmL', 'lowerarm_l'], ['WristL', 'hand_l'],
  ['ShoulderR', 'clavicle_r'], ['UpperArmR', 'upperarm_r'], ['LowerArmR', 'lowerarm_r'], ['WristR', 'hand_r'],
  ['UpperLegL', 'thigh_l'], ['LowerLegL', 'calf_l'], ['FootL', 'foot_l'],
  ['UpperLegR', 'thigh_r'], ['LowerLegR', 'calf_r'], ['FootR', 'foot_r'],
]);

if (![BASE, UAL1, UAL2, MODULAR_MEN].every(existsSync)) {
  if (existsSync(OUT)) { console.log(`build-player: source packs absent; keeping ${OUT}`); process.exit(0); }
  throw new Error('Missing extracted Quaternius Base Characters / UAL1 / UAL2 source packs');
}

const io = new NodeIO();
const document = await io.read(BASE);
const root = document.getRoot(), canonicalScene = root.getDefaultScene();
if (!canonicalScene) throw new Error('Superhero character has no default scene');
const canonicalNodes = new Map();
const indexNode = node => {
  if (canonicalNodes.has(node.getName())) throw new Error(`Duplicate canonical node ${node.getName()}`);
  canonicalNodes.set(node.getName(), node); node.listChildren().forEach(indexNode);
};
canonicalScene.listChildren().forEach(indexNode);

function addKickAnimations() {
  const bytes = readFileSync(MODULAR_MEN);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const sourceRoot = new FBXLoader().parse(buffer, '');
  const sourceBones = new Map();
  sourceRoot.traverse(object => { if (object.isBone) sourceBones.set(object.name, object); });
  const missing = [...KICK_BONE_MAP.keys()].filter(name => !sourceBones.has(name));
  if (missing.length) throw new Error(`Ultimate Modular Men kick rig missing: ${missing.join(', ')}`);

  sourceRoot.updateMatrixWorld(true);
  const sourceRestWorld = new Map();
  for (const name of KICK_BONE_MAP.keys()) {
    sourceRestWorld.set(name, sourceBones.get(name).getWorldQuaternion(new Quaternion()));
  }
  const sourceRestLocal = new Map([...sourceBones].map(([name, bone]) => [name, {
    position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone(),
  }]));

  const parentByNode = new Map();
  for (const node of root.listNodes()) for (const child of node.listChildren()) parentByNode.set(child, node);
  const targetRestWorld = new Map();
  const restWorld = node => {
    if (targetRestWorld.has(node)) return targetRestWorld.get(node);
    const local = new Quaternion().fromArray(node.getRotation());
    const parent = parentByNode.get(node);
    const world = parent ? restWorld(parent).clone().multiply(local) : local;
    targetRestWorld.set(node, world);
    return world;
  };
  for (const targetName of KICK_BONE_MAP.values()) restWorld(canonicalNodes.get(targetName));

  const targetToSource = new Map([...KICK_BONE_MAP].map(([sourceName, targetName]) => [targetName, sourceName]));
  const orderedTargets = [...KICK_BONE_MAP.values()].map(name => canonicalNodes.get(name));
  const animationBuffer = root.listBuffers()[0] ?? document.createBuffer('player-animation-buffer');
  const mixer = new AnimationMixer(sourceRoot);
  const sourceAnimatedWorld = new Quaternion(), sourceRestInverse = new Quaternion();
  const desiredWorld = new Quaternion(), parentWorldInverse = new Quaternion(), local = new Quaternion();

  for (const [sourceClipName, outputName] of KICK_CLIPS) {
    const clip = sourceRoot.animations.find(animation => animation.name === sourceClipName);
    if (!clip) throw new Error(`Ultimate Modular Men missing ${sourceClipName}`);
    mixer.stopAllAction(); mixer.time = 0;
    for (const [name, transform] of sourceRestLocal) {
      const bone = sourceBones.get(name);
      bone.position.copy(transform.position); bone.quaternion.copy(transform.quaternion); bone.scale.copy(transform.scale);
    }
    sourceRoot.updateMatrixWorld(true);
    const action = mixer.clipAction(clip); action.reset().play();
    const frameCount = Math.ceil(clip.duration * 30) + 1;
    const times = Float32Array.from({ length: frameCount }, (_, index) => Math.min(clip.duration, index / 30));
    const valuesByTarget = new Map(orderedTargets.map(node => [node, new Float32Array(frameCount * 4)]));

    for (let frame = 0; frame < frameCount; frame++) {
      mixer.setTime(Math.min(times[frame], clip.duration - 1e-5));
      sourceRoot.updateMatrixWorld(true);
      const animatedTargetWorld = new Map();
      for (const target of orderedTargets) {
        const sourceName = targetToSource.get(target.getName());
        const sourceBone = sourceBones.get(sourceName);
        sourceBone.getWorldQuaternion(sourceAnimatedWorld);
        sourceRestInverse.copy(sourceRestWorld.get(sourceName)).invert();
        desiredWorld.copy(targetRestWorld.get(target)).multiply(sourceRestInverse).multiply(sourceAnimatedWorld).normalize();
        const parent = parentByNode.get(target);
        const animatedParent = animatedTargetWorld.get(parent) ?? targetRestWorld.get(parent) ?? new Quaternion();
        parentWorldInverse.copy(animatedParent).invert();
        local.copy(parentWorldInverse).multiply(desiredWorld).normalize();
        const values = valuesByTarget.get(target), offset = frame * 4;
        if (frame > 0) {
          const dot = values[offset - 4] * local.x + values[offset - 3] * local.y + values[offset - 2] * local.z + values[offset - 1] * local.w;
          if (dot < 0) local.set(-local.x, -local.y, -local.z, -local.w);
        }
        local.toArray(values, offset);
        animatedTargetWorld.set(target, desiredWorld.clone());
      }
    }

    const animation = document.createAnimation(outputName);
    for (const target of orderedTargets) {
      const input = document.createAccessor(`${outputName}:${target.getName()}:time`).setArray(times).setBuffer(animationBuffer);
      const output = document.createAccessor(`${outputName}:${target.getName()}:rotation`)
        .setArray(valuesByTarget.get(target)).setType(Accessor.Type.VEC4).setBuffer(animationBuffer);
      const sampler = document.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(AnimationSampler.Interpolation.LINEAR);
      const channel = document.createAnimationChannel().setTargetNode(target).setTargetPath(AnimationChannel.TargetPath.ROTATION).setSampler(sampler);
      animation.addSampler(sampler).addChannel(channel);
    }
    action.stop();
  }
}

addKickAnimations();

const sourceInverse = new Quaternion(), targetRest = new Quaternion(), animated = new Quaternion(), result = new Quaternion();
function prepareAnimations(source, wantedNames, label) {
  const sourceRoot = source.getRoot(), wanted = new Set(wantedNames);
  for (const animation of sourceRoot.listAnimations()) if (!wanted.has(animation.getName())) animation.dispose();
  for (const name of wantedNames) if (!sourceRoot.listAnimations().some(animation => animation.getName() === name)) throw new Error(`${label} missing ${name}`);
  let rotationTracks = 0, removedTracks = 0;
  for (const animation of sourceRoot.listAnimations()) for (const channel of animation.listChannels()) {
    const sourceNode = channel.getTargetNode(); if (!sourceNode) continue;
    const targetNode = canonicalNodes.get(sourceNode.getName());
    if (!targetNode) { channel.dispose(); removedTracks++; continue; }
    const path = channel.getTargetPath(), sampler = channel.getSampler(), output = sampler?.getOutput();
    if (!output) continue;
    if (path === 'rotation') {
      const values = output.getArray(); if (!values) continue;
      sourceInverse.fromArray(sourceNode.getRotation()).invert();
      targetRest.fromArray(targetNode.getRotation());
      for (let offset = 0; offset < values.length; offset += 4) {
        animated.fromArray(values, offset);
        result.copy(targetRest).multiply(sourceInverse).multiply(animated).normalize().toArray(values, offset);
      }
      output.setArray(values); rotationTracks++;
    } else if (path === 'translation' && (sourceNode.getName() === 'root' || sourceNode.getName() === 'pelvis')) {
      const values = output.getArray(); if (!values) continue;
      const sourcePosition = sourceNode.getTranslation(), targetPosition = targetNode.getTranslation();
      for (let offset = 0; offset < values.length; offset += 3) {
        values[offset] = targetPosition[0] + values[offset] - sourcePosition[0];
        values[offset + 1] = targetPosition[1] + values[offset + 1] - sourcePosition[1];
        values[offset + 2] = targetPosition[2] + values[offset + 2] - sourcePosition[2];
      }
      output.setArray(values);
    } else if (path === 'translation' || path === 'scale') {
      channel.dispose(); removedTracks++;
    }
  }
  return { rotationTracks, removedTracks };
}

let preparedRotations = 0, removedTracks = 0;
for (const [path, wanted, label] of [[UAL1, WANTED_UAL1, 'UAL1'], [UAL2, WANTED_UAL2, 'UAL2']]) {
  const source = await io.read(path);
  const prepared = prepareAnimations(source, wanted, label);
  preparedRotations += prepared.rotationTracks; removedTracks += prepared.removedTracks;
  mergeDocuments(document, source);
}

let redirected = 0;
for (const animation of root.listAnimations()) for (const channel of animation.listChannels()) {
  const sourceTarget = channel.getTargetNode(); if (!sourceTarget) continue;
  const canonical = canonicalNodes.get(sourceTarget.getName());
  if (!canonical) throw new Error(`${animation.getName()}: no canonical bone ${sourceTarget.getName()}`);
  if (canonical !== sourceTarget) { channel.setTargetNode(canonical); redirected++; }
}
for (const scene of root.listScenes()) if (scene !== canonicalScene) scene.dispose();
const liveNodes = new Set();
const visit = node => { liveNodes.add(node); node.listChildren().forEach(visit); };
canonicalScene.listChildren().forEach(visit);
const liveMeshes = new Set([...liveNodes].map(node => node.getMesh()).filter(Boolean));
const liveSkins = new Set([...liveNodes].map(node => node.getSkin()).filter(Boolean));
for (const node of root.listNodes()) if (!liveNodes.has(node)) node.dispose();
for (const mesh of root.listMeshes()) if (!liveMeshes.has(mesh)) mesh.dispose();
for (const skin of root.listSkins()) if (!liveSkins.has(skin)) skin.dispose();
// The runtime always replaces these materials with CosmicMaterial.
for (const mesh of root.listMeshes()) for (const primitive of mesh.listPrimitives()) primitive.setMaterial(null);
for (const material of root.listMaterials()) material.dispose();
for (const texture of root.listTextures()) texture.dispose();
await document.transform(dedup(), prune({ keepAttributes: false }), unpartition());

const skins = root.listSkins(), animations = root.listAnimations();
if (skins.length !== 1 || skins[0].listJoints().length !== 65) throw new Error('Expected one canonical 65-joint UAL rig');
if (!root.listMeshes().length) throw new Error('Generated character has no mesh');
if (animations.length !== WANTED_UAL1.length + WANTED_UAL2.length + KICK_CLIPS.size) throw new Error('Generated character has unexpected clip count');
const liveAfterPrune = new Set(root.listNodes());
for (const animation of animations) for (const channel of animation.listChannels()) if (!liveAfterPrune.has(channel.getTargetNode())) throw new Error(`${animation.getName()} targets a dead node`);
const names = root.listNodes().map(node => node.getName()).filter(Boolean);
const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
if (duplicates.length) throw new Error(`Duplicate node names: ${[...new Set(duplicates)].join(', ')}`);
mkdirSync('public/assets/player', { recursive: true });
await io.write(OUT, document);
console.log(`build-player: ${OUT}`);
console.log(`  canonical joints: ${skins[0].listJoints().length}`);
console.log(`  meshes: ${root.listMeshes().map(mesh => mesh.getName()).join(', ')}`);
console.log(`  animations: ${animations.length}`);
console.log(`  retargeted rotation tracks: ${preparedRotations}`);
console.log(`  removed translation/scale tracks: ${removedTracks}`);
console.log(`  redirected channels: ${redirected}`);
for (const animation of animations) console.log(`    ${animation.getName()}`);
