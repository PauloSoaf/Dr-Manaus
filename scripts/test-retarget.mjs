import fs from 'node:fs';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

function parseGLB(path) {
  const b = fs.readFileSync(path);
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len));
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
  const root = new THREE.Group();
  root.add(...rootNodes);
  root.updateMatrixWorld(true);

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

  return { root, animations, nodes };
}

const source = parseGLB('artifacts/animations/source/KayKit/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_CombatMelee.glb');

// Target Rig (19 bones)
const tRoot = new THREE.Group();
const tHips = new THREE.Bone(); tHips.name = 'HIPS';
const tSpine = new THREE.Bone(); tSpine.name = 'SPINE';
const tChest = new THREE.Bone(); tChest.name = 'CHEST';
tRoot.add(tHips);
tHips.add(tSpine);
tSpine.add(tChest);
tRoot.updateMatrixWorld(true);

const clip = source.animations[0];
console.log('Original tracks:', clip.tracks.map(t => t.name));

const options = {
  names: {
    'HIPS': 'hips',
    'SPINE': 'spine',
    'CHEST': 'chest'
  }
};

const retargeted = SkeletonUtils.retargetClip(tRoot, source.root, clip, options);
console.log('Retargeted tracks:', retargeted.tracks.map(t => t.name));

