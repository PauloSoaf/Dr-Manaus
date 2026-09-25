import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { Quaternion } from 'three';

const PLAYER = 'public/assets/player/dr-manaus-character.glb';

function rotationRange(values: ArrayLike<number>): number {
  const first = new Quaternion().fromArray(values, 0), sample = new Quaternion();
  let range = 0;
  for (let offset = 4; offset < values.length; offset += 4) {
    sample.fromArray(values, offset);
    range = Math.max(range, first.angleTo(sample));
  }
  return range * 180 / Math.PI;
}

test('final player GLB contains one canonical adult rig and all gameplay clips', async () => {
  const document = await new NodeIO().read(PLAYER), root = document.getRoot();
  assert.equal(root.listScenes().length, 1);
  assert.equal(root.listSkins().length, 1);
  assert.equal(root.listSkins()[0].listJoints().length, 65);
  assert.equal(root.listMaterials().length, 0, 'runtime applies the one shared cosmic material');

  const names = root.listNodes().map(node => node.getName()).filter(Boolean);
  assert.equal(new Set(names).size, names.length, 'duplicate rigs must be pruned');
  const clips = new Map(root.listAnimations().map(clip => [clip.getName(), clip]));
  for (const name of [
    'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop',
    'Jump_Start', 'Jump_Loop', 'Jump_Land', 'NinjaJump_Idle_Loop',
    'Punch_Jab', 'Punch_Cross', 'Melee_Hook', 'Kick_Left', 'Kick_Right',
  ]) assert.ok(clips.has(name), `missing ${name}`);

  const live = new Set(root.listNodes());
  for (const clip of clips.values()) for (const channel of clip.listChannels()) {
    assert.ok(live.has(channel.getTargetNode()!));
    const values = channel.getSampler()?.getOutput()?.getArray();
    assert.ok(values && Array.from(values).every(Number.isFinite), `${clip.getName()} has invalid samples`);
  }
});

test('punches and kicks have real non-identity skeletal motion', async () => {
  const root = (await new NodeIO().read(PLAYER)).getRoot();
  const metrics = (clipName: string, pattern: RegExp) => {
    const clip = root.listAnimations().find(animation => animation.getName() === clipName)!;
    const channels = clip.listChannels().filter(channel =>
      channel.getTargetPath() === 'rotation' && pattern.test(channel.getTargetNode()?.getName() ?? '')
    );
    const duration = Math.max(...clip.listSamplers().map(sampler => {
      const times = sampler.getInput()!.getArray()!;
      return times[times.length - 1];
    }));
    return { duration, channels, max: Math.max(...channels.map(channel => rotationRange(channel.getSampler()!.getOutput()!.getArray()!))) };
  };
  const jab = metrics('Punch_Jab', /upperarm|lowerarm|spine_03/);
  const cross = metrics('Punch_Cross', /upperarm|lowerarm|spine_03/);
  const leftKick = metrics('Kick_Left', /thigh_l|calf_l|foot_l/);
  const rightKick = metrics('Kick_Right', /thigh_r|calf_r|foot_r/);
  assert.ok(jab.duration > 0 && jab.channels.length >= 5 && jab.max > 45);
  assert.ok(cross.duration > 0 && cross.channels.length >= 5 && cross.max > 60);
  assert.ok(leftKick.max > 100 && rightKick.max > 100);
});
