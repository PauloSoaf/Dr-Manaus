import { NodeIO } from '@gltf-transform/core';
import { Quaternion } from 'three';

const file = process.argv[2] ?? 'public/assets/player/dr-manaus-character.glb';
const document = await new NodeIO().read(file);
const root = document.getRoot(), skins = root.listSkins(), animations = root.listAnimations();
if (root.listScenes().length !== 1) throw new Error(`Expected one scene, found ${root.listScenes().length}`);
if (skins.length !== 1 || skins[0].listJoints().length !== 65) throw new Error('Expected one UAL skeleton with 65 joints');
if (!root.listMeshes().length) throw new Error('No player mesh');
const nodes = new Set(root.listNodes());
for (const animation of animations) for (const channel of animation.listChannels()) {
  if (!nodes.has(channel.getTargetNode())) throw new Error(`${animation.getName()} targets a missing node`);
}
for (const name of ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Punch_Jab', 'Punch_Cross', 'Melee_Hook', 'Kick_Left', 'Kick_Right']) {
  if (!animations.some(animation => animation.getName() === name)) throw new Error(`Missing required clip ${name}`);
}
const names = root.listNodes().map(node => node.getName()).filter(Boolean);
const duplicate = names.find((name, index) => names.indexOf(name) !== index);
if (duplicate) throw new Error(`Duplicate node ${duplicate}`);
for (const mesh of root.listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const weights = primitive.getAttribute('WEIGHTS_0')?.getArray();
  const joints = primitive.getAttribute('JOINTS_0')?.getArray();
  if (!weights || !joints) throw new Error(`${mesh.getName()} is not skinned`);
  for (let offset = 0; offset < weights.length; offset += 4) {
    const sum = weights[offset] + weights[offset + 1] + weights[offset + 2] + weights[offset + 3];
    if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-4) throw new Error(`${mesh.getName()} has invalid skin weights`);
    if (joints[offset] >= 65 || joints[offset + 1] >= 65 || joints[offset + 2] >= 65 || joints[offset + 3] >= 65) throw new Error(`${mesh.getName()} has an out-of-range joint`);
  }
}
for (const animation of animations) for (const sampler of animation.listSamplers()) {
  const values = sampler.getOutput()?.getArray();
  if (!values || !Array.from(values).every(Number.isFinite)) throw new Error(`${animation.getName()} has invalid samples`);
}
const angularRange = channel => {
  const values = channel.getSampler().getOutput().getArray();
  const first = new Quaternion().fromArray(values, 0), sample = new Quaternion();
  let max = 0;
  for (let offset = 4; offset < values.length; offset += 4) {
    sample.fromArray(values, offset); max = Math.max(max, first.angleTo(sample));
  }
  return max * 180 / Math.PI;
};
const punch = animations.find(animation => animation.getName() === 'Punch_Cross');
const proofBones = ['upperarm_r', 'lowerarm_r', 'spine_03'];
const proof = Object.fromEntries(proofBones.map(name => {
  const channel = punch.listChannels().find(candidate => candidate.getTargetPath() === 'rotation' && candidate.getTargetNode()?.getName() === name);
  return [name, Number(angularRange(channel).toFixed(1))];
}));
const duration = Math.max(...punch.listSamplers().map(sampler => {
  const times = sampler.getInput().getArray(); return times[times.length - 1];
}));
console.log(`valid player GLB: 65 joints, ${root.listMeshes().length} mesh, ${animations.length} clips`);
console.log(`Punch_Cross proof: ${duration.toFixed(3)}s, ${punch.listChannels().length} tracks, ${new Set(punch.listChannels().map(channel => channel.getTargetNode()?.getName())).size} animated bones, ranges ${JSON.stringify(proof)}`);
