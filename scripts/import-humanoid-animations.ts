import fs from 'node:fs';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { BONES, BoneId } from '../src/player/animations/types.js';
import { KAYKIT_MAP, QUATERNIUS_MAP } from '../src/player/animations/RetargetMap.js';

// Recreate the target 19-bone rig exactly as CharacterModel does
const targetBones = Array.from({ length: 19 }, (_, i) => {
  const b = new THREE.Bone();
  b.name = BONES[i];
  return b;
});

const [
  hips, spine, chest, neck, head,
  lShoulder, lArm, lForearm, lHand,
  rShoulder, rArm, rForearm, rHand,
  lLeg, lShin, lFoot,
  rLeg, rShin, rFoot
] = targetBones;

hips.add(spine, lLeg, rLeg);
spine.add(chest);
chest.add(neck, lShoulder, rShoulder);
neck.add(head);
lShoulder.add(lArm); lArm.add(lForearm); lForearm.add(lHand);
rShoulder.add(rArm); rArm.add(rForearm); rForearm.add(rHand);
lLeg.add(lShin); lShin.add(lFoot);
rLeg.add(rShin); rShin.add(rFoot);

const targetRoot = new THREE.Group();
targetRoot.add(hips);
targetRoot.updateMatrixWorld(true);

const targetSkeleton = new THREE.Skeleton(targetBones);
const targetMesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
targetMesh.add(targetRoot);
targetMesh.bind(targetSkeleton);

function parseGLB(path) {
  const b = fs.readFileSync(path);
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
  const bin = b.subarray(28 + len);
  
  function data(i) {
    const a = j.accessors[i];
    const v = j.bufferViews[a.bufferView];
    return new Float32Array(bin.buffer, bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0), a.count * ({SCALAR: 1, VEC3: 3, VEC4: 4}[a.type]));
  }

  const nodes = j.nodes.map(n => {
    const o = new THREE.Bone();
    o.name = n.name || 'unnamed';
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });

  j.nodes.forEach((n, i) => n.children?.forEach(c => nodes[i].add(nodes[c])));
  
  const isChild = new Set(j.nodes.flatMap(n => n.children || []));
  const rootNodes = nodes.filter((n, i) => !isChild.has(i));
  const rootGroup = new THREE.Group();
  rootGroup.add(...rootNodes);
  rootGroup.updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton(nodes);
  const sourceMesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  sourceMesh.add(rootGroup);
  sourceMesh.bind(skeleton);

  const animations = j.animations?.map(a => {
    const tracks = a.channels.map(c => {
      const nodeName = nodes[c.target.node].name;
      const path = c.target.path;
      const t = data(a.samplers[c.sampler].input);
      const v = data(a.samplers[c.sampler].output);
      if (path === 'translation') return new THREE.VectorKeyframeTrack(`${nodeName}.position`, t, v);
      if (path === 'rotation') return new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, t, v);
      if (path === 'scale') return new THREE.VectorKeyframeTrack(`${nodeName}.scale`, t, v);
      return null;
    }).filter(Boolean);
    return new THREE.AnimationClip(a.name || 'unnamed', -1, tracks);
  }) || [];

  return { sourceMesh, animations };
}

const clipsToExtract = {
  'walk': ['kaykit', 'Rig_Medium_MovementBasic.glb', 'Walk'],
  'run': ['kaykit', 'Rig_Medium_MovementBasic.glb', 'Run'],
  'jump': ['kaykit', 'Rig_Medium_MovementBasic.glb', 'Jump'],
  'punch': ['kaykit', 'Rig_Medium_CombatMelee.glb', 'Melee_Unarmed_Attack_Punch_A'],
  'punchCross': ['kaykit', 'Rig_Medium_CombatMelee.glb', 'Melee_Unarmed_Attack_Kick'],
  'vault': ['quaternius2', 'UAL2_Standard.glb', 'NinjaJump_Start'],
  'roll': ['kaykit', 'Rig_Medium_MovementAdvanced.glb', 'Dodge_Forward'],
  'land': ['quaternius2', 'UAL2_Standard.glb', 'NinjaJump_Land'],
  'swimFwd': ['quaternius1', 'AnimationLibrary_Godot_Standard.glb', 'Swim_Fwd_Loop'],
  'swimIdle': ['quaternius1', 'AnimationLibrary_Godot_Standard.glb', 'Swim_Idle_Loop'],
  'swordAttack': ['quaternius1', 'AnimationLibrary_Godot_Standard.glb', 'Sword_Attack'],
  'spellIdle': ['quaternius1', 'AnimationLibrary_Godot_Standard.glb', 'Spell_Simple_Idle_Loop'],
  'spellEnter': ['quaternius1', 'AnimationLibrary_Godot_Standard.glb', 'Spell_Simple_Enter']
};

const fps = 30;
const output = { source: 'KayKit & Quaternius', fps, clips: {} };

for (const [outName, [lib, file, clipName]] of Object.entries(clipsToExtract)) {
  let path = '';
  let map = {};
  if (lib === 'kaykit') {
    path = `artifacts/animations/source/KayKit/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/${file}`;
    map = KAYKIT_MAP;
  } else if (lib === 'quaternius2') {
    path = `artifacts/animations/source/Quaternius/Universal Animation Library 2[Standard]/Unreal-Godot/${file}`;
    map = QUATERNIUS_MAP;
  } else {
    path = `artifacts/animations/source/Animation Library[Standard]/Godot/${file}`;
    map = QUATERNIUS_MAP;
  }

  const { sourceMesh, animations } = parseGLB(path);
  const sourceClip = animations.find(a => a.name === clipName || a.name.includes(clipName));
  if (!sourceClip) {
    console.error(`Clip ${clipName} not found in ${file}`);
    continue;
  }

  // Map DR Manaus bones -> Source Bones
  // SkeletonUtils wants options.names: { targetBoneName: sourceBoneName }
  // Our RetargetMap is exactly { TARGET_BONE: 'source_bone' }
  const invertedMap = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
  const options = { names: invertedMap };
  const retargeted = SkeletonUtils.retargetClip(targetMesh, sourceMesh, sourceClip, options);

  const duration = sourceClip.duration;
  console.log(`Clip ${outName} duration: ${duration}`);
  const count = Math.ceil(duration * fps);
  
  const mixer = new THREE.AnimationMixer(targetMesh);
  const action = mixer.clipAction(retargeted);
  action.play();

  const frames = [];
  for (let f = 0; f <= count; f++) {
    const time = (f / count) * duration;
    mixer.setTime(time);
    targetMesh.updateMatrixWorld(true);

    const frameData = [];
    for (let i = 0; i < 19; i++) {
      const q = targetBones[i].quaternion.normalize();
      frameData.push(Number(q.x.toFixed(5)), Number(q.y.toFixed(5)), Number(q.z.toFixed(5)), Number(q.w.toFixed(5)));
    }
    frames.push(frameData);
  }
  
  output.clips[outName] = { duration, frames };
  console.log(`Baking ${outName} (${frames.length} frames)`);
}

fs.writeFileSync('src/player/animations/character-clips.json', JSON.stringify(output));
console.log('Exported', Object.keys(output.clips), fs.statSync('src/player/animations/character-clips.json').size, 'bytes');
