/**
 * Builds the hero's animation set from free sources, retargeted onto the 65-bone Universal rig.
 *
 *   node scripts/assets/build-character-animations.mjs
 *
 * Sources (downloaded into the git-ignored `artifacts/` tree; the script skips cleanly when absent):
 *   - Quaternius Universal Animation Library 1 & 2 [Standard]   CC0 1.0   (same skeleton as the hero)
 *   - Quaternius Ultimate Modular Men, Animations.fbx            CC0 1.0
 *   - KayKit Character Animations 1.1 (Kay Lousberg)             CC0 1.0
 *   - CMU Graphics Lab Motion Capture Database (ASF/AMC)         free for any use, may not be resold as data
 *
 * Outputs:
 *   - public/assets/player/dr-manaus-character.glb   mesh + core gameplay clips (boot)
 *   - public/assets/player/animation-library.glb     social / NPC / extra clips (loaded after boot)
 *   - src/player/animations/clipCatalog.json         per-clip metadata: loop, measured ground speed,
 *                                                    foot plants, strike timing, provenance
 *   - src/player/animations/libraryManifest.json     names in the library (read by AnimationLibrary)
 *
 * Retargeting is world-space with reference-posture alignment (scripts/assets/lib/retarget.mjs);
 * same-skeleton UAL clips use the original local-delta transfer. Every pose is authored or captured.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { AnimationMixer, Vector3 } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { loadGltf } from './lib/pose-renderer.mjs';
import { retargetClip, MODULAR_TO_UNIVERSAL, KAYKIT_TO_UNIVERSAL, KAYKIT_BLENDS, universalSelfMap } from './lib/retarget.mjs';
import { loadCmu, CMU_TO_UNIVERSAL } from './lib/asf-amc.mjs';
import {
  transferSameRig, resampleClip, closeLoop, rotateBodyYaw, lockPelvisHorizontal, pelvisYawAt,
  measureLocomotion, measureStrike, addClipToDocument, stripStaticTracks, extractRootYaw, calibrateFloor,
} from './lib/clip-tools.mjs';

const CHARACTER = 'public/assets/player/dr-manaus-character.glb';
const LIBRARY = 'public/assets/player/animation-library.glb';
const CATALOG = 'src/player/animations/clipCatalog.json';
const LIBRARY_MANIFEST = 'src/player/animations/libraryManifest.json';
const SRC = {
  ual1: 'artifacts/animations/source/extracted/quaternius-ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
  ual2: 'artifacts/animations/source/extracted/quaternius/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb',
  modular: 'artifacts/animations/source/ultimate-modular-men/Animations.fbx',
  kaykit: 'artifacts/animations/source/extracted/kaykit/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/',
  cmu: 'artifacts/downloads/cmu/',
};
const CREDIT = {
  ual1: { source: 'Quaternius · Universal Animation Library [Standard]', licence: 'CC0 1.0', url: 'https://quaternius.com/packs/universalanimationlibrary.html' },
  ual2: { source: 'Quaternius · Universal Animation Library 2 [Standard]', licence: 'CC0 1.0', url: 'https://quaternius.com/packs/universalanimationlibrary2.html' },
  modular: { source: 'Quaternius · Ultimate Modular Men Pack (Animations.fbx)', licence: 'CC0 1.0', url: 'https://quaternius.com/packs/ultimatemodularcharacters.html' },
  kaykit: { source: 'Kay Lousberg · KayKit Character Animations 1.1', licence: 'CC0 1.0', url: 'https://kaylousberg.com/game-assets/character-animations' },
  cmu: { source: 'CMU Graphics Lab Motion Capture Database (NSF EIA-0196217)', licence: 'Free for use in products; the data itself may not be resold', url: 'http://mocap.cs.cmu.edu/' },
};

/**
 * The clip list. `core` clips ship inside the character GLB; the rest go to the library.
 * kind: loop | strike | action. `effector` marks the striking end for strike timing.
 */
const SPECS = [
  // --- Strikes: real kicks (the old Kick_Left/Kick_Right were a broken retarget of these same moves).
  { name: 'Kick_Front_R', src: 'modular', clip: 'Kick_Right', core: true, kind: 'strike', effector: 'ball_r', lock: true },
  { name: 'Kick_Front_L', src: 'modular', clip: 'Kick_Left', core: true, kind: 'strike', effector: 'ball_l', lock: true },
  { name: 'Kick_Side_R', src: 'cmu', subject: '135', trial: '11', crop: [2.35, 3.75], core: true, kind: 'strike', effector: 'ball_r', aim: true, lock: true },
  { name: 'Kick_Roundhouse_R', src: 'cmu', subject: '135', trial: '07', crop: [5.9, 7.05], core: true, kind: 'strike', effector: 'ball_r', aim: true, rootYaw: true, lock: true },
  { name: 'Kick_Spin_Jump', src: 'cmu', subject: '88', trial: '06', crop: [0.38, 1.02], core: true, kind: 'strike', effector: 'ball_l', aim: true, rootYaw: true, lock: true },
  { name: 'Kick_Push', src: 'kaykit', file: 'Rig_Medium_CombatMelee.glb', clip: 'Melee_Unarmed_Attack_Kick', core: true, kind: 'strike', effector: 'ball_r', lock: true },
  { name: 'Punch_Guard_R', src: 'modular', clip: 'Punch_Right', core: true, kind: 'strike', effector: 'hand_r', lock: true },
  { name: 'Punch_Guard_L', src: 'modular', clip: 'Punch_Left', core: true, kind: 'strike', effector: 'hand_l', lock: true },
  // --- Guard and reactions.
  { name: 'Guard_Idle_Loop', src: 'cmu', subject: '135', trial: '04', crop: [3.55, 4.4], core: true, kind: 'loop', lock: true, faceForward: true },
  { name: 'Hit_React_A', src: 'modular', clip: 'HitRecieve', core: true, kind: 'action', lock: true },
  { name: 'Hit_React_B', src: 'modular', clip: 'HitRecieve_2', core: true, kind: 'action', lock: true },
  { name: 'GetUp_Back', src: 'ual2', clip: 'LayToIdle', core: true, kind: 'action' },
  { name: 'Knockout_Fall', src: 'ual1', clip: 'Death01', core: true, kind: 'action' },
  // --- Locomotion beyond walk/jog/sprint.
  { name: 'Strafe_L_Loop', src: 'modular', clip: 'Run_Left', core: true, kind: 'loop', lock: true, travel: new Vector3(1, 0, 0) },
  { name: 'Strafe_R_Loop', src: 'modular', clip: 'Run_Right', core: true, kind: 'loop', lock: true, travel: new Vector3(-1, 0, 0) },
  { name: 'Run_Back_Loop', src: 'modular', clip: 'Run_Back', core: true, kind: 'loop', lock: true, travel: new Vector3(0, 0, -1) },
  { name: 'Run_Fwd_Loop', src: 'modular', clip: 'Run', core: true, kind: 'loop', lock: true },
  { name: 'Walk_Guard_Loop', src: 'modular', clip: 'Walk', core: false, kind: 'loop', lock: true },
  { name: 'Crouch_Idle_Loop', src: 'ual1', clip: 'Crouch_Idle_Loop', core: true, kind: 'loop' },
  { name: 'Crouch_Fwd_Loop', src: 'ual1', clip: 'Crouch_Fwd_Loop', core: true, kind: 'loop' },
  { name: 'Dodge_Left', src: 'kaykit', file: 'Rig_Medium_MovementAdvanced.glb', clip: 'Dodge_Left', core: true, kind: 'action', lock: true },
  { name: 'Dodge_Right', src: 'kaykit', file: 'Rig_Medium_MovementAdvanced.glb', clip: 'Dodge_Right', core: true, kind: 'action', lock: true },
  { name: 'Dodge_Back', src: 'kaykit', file: 'Rig_Medium_MovementAdvanced.glb', clip: 'Dodge_Backward', core: true, kind: 'action', lock: true },
  // --- Powers.
  { name: 'Cast_Enter', src: 'ual1', clip: 'Spell_Simple_Enter', core: true, kind: 'action' },
  { name: 'Cast_Loop', src: 'ual1', clip: 'Spell_Simple_Idle_Loop', core: true, kind: 'loop' },
  { name: 'Cast_Shoot', src: 'ual1', clip: 'Spell_Simple_Shoot', core: true, kind: 'strike', effector: 'hand_r' },
  { name: 'Cast_Exit', src: 'ual1', clip: 'Spell_Simple_Exit', core: true, kind: 'action' },
  { name: 'Power_Raise', src: 'kaykit', file: 'Rig_Medium_CombatRanged.glb', clip: 'Ranged_Magic_Raise', core: true, kind: 'action', lock: true },
  { name: 'Power_Summon', src: 'kaykit', file: 'Rig_Medium_CombatRanged.glb', clip: 'Ranged_Magic_Summon', core: true, kind: 'action', lock: true },
  { name: 'Teleport_Arrive', src: 'kaykit', file: 'Rig_Medium_General.glb', clip: 'Spawn_Ground', core: true, kind: 'action', lock: true, floorWindow: [0.6, 1] },
  // --- Vehicles and handles.
  { name: 'Reach_R', src: 'ual1', clip: 'Interact', mirror: true, core: true, kind: 'action', effector: 'hand_r' },
  { name: 'Reach_L', src: 'ual1', clip: 'Interact', core: true, kind: 'action', effector: 'hand_l' },
  { name: 'Sit_Enter', src: 'ual1', clip: 'Sitting_Enter', core: true, kind: 'action' },
  { name: 'Sit_Idle_Loop', src: 'ual1', clip: 'Sitting_Idle_Loop', core: true, kind: 'loop' },
  { name: 'Sit_Exit', src: 'ual1', clip: 'Sitting_Exit', core: true, kind: 'action' },
  { name: 'Driving_Loop', src: 'ual1', clip: 'Driving_Loop', core: true, kind: 'loop' },
  { name: 'Push_Loop', src: 'ual1', clip: 'Push_Loop', core: true, kind: 'loop' },
  { name: 'PickUp_Table', src: 'ual1', clip: 'PickUp_Table', core: false, kind: 'action' },
  // --- Social (player and pedestrians).
  { name: 'Talk_Loop', src: 'ual1', clip: 'Idle_Talking_Loop', core: true, kind: 'loop' },
  { name: 'Sit_Talk_Loop', src: 'ual1', clip: 'Sitting_Talking_Loop', core: false, kind: 'loop' },
  { name: 'Phone_Loop', src: 'ual2', clip: 'Idle_TalkingPhone_Loop', core: false, kind: 'loop' },
  { name: 'Nod_Yes', src: 'ual2', clip: 'Yes', core: true, kind: 'action' },
  { name: 'Shake_No', src: 'ual2', clip: 'Idle_No_Loop', core: true, kind: 'action' },
  { name: 'Wave', src: 'modular', clip: 'Wave', core: true, kind: 'action', lock: true },
  { name: 'Cheer', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Cheering', core: false, kind: 'action', lock: true },
  { name: 'Walk_Formal_Loop', src: 'ual1', clip: 'Walk_Formal_Loop', core: false, kind: 'loop' },
  { name: 'Walk_Carry_Loop', src: 'ual2', clip: 'Walk_Carry_Loop', core: false, kind: 'loop' },
  { name: 'Lean_Rail_Loop', src: 'ual2', clip: 'Idle_Rail_Loop', core: false, kind: 'loop' },
  { name: 'Look_Around', src: 'ual2', clip: 'Idle_Rail_Call', core: false, kind: 'action' },
  { name: 'Fix_Kneel_Loop', src: 'ual1', clip: 'Fixing_Kneeling', core: false, kind: 'loop' },
  { name: 'Dance_Loop', src: 'ual1', clip: 'Dance_Loop', core: false, kind: 'loop' },
  // --- Pedestrian routines (library): benches, parks, vendors, errands.
  { name: 'Drink', src: 'ual2', clip: 'Consume', core: false, kind: 'action' },
  { name: 'Open_Trunk', src: 'ual2', clip: 'Chest_Open', core: false, kind: 'action' },
  { name: 'Garden_Harvest', src: 'ual2', clip: 'Farm_Harvest', core: false, kind: 'action' },
  { name: 'Garden_Plant', src: 'ual2', clip: 'Farm_PlantSeed', core: false, kind: 'action' },
  { name: 'Garden_Water', src: 'ual2', clip: 'Farm_Watering', core: false, kind: 'action' },
  { name: 'Hold_Lantern_Loop', src: 'ual2', clip: 'Idle_Lantern_Loop', core: false, kind: 'loop' },
  { name: 'Hold_Torch_Loop', src: 'ual1', clip: 'Idle_Torch_Loop', core: false, kind: 'loop' },
  { name: 'Bench_Sit_Down', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Sit_Chair_Down', core: false, kind: 'action', lock: true },
  { name: 'Bench_Sit_Loop', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Sit_Chair_Idle', core: false, kind: 'loop', lock: true },
  { name: 'Bench_Stand_Up', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Sit_Chair_StandUp', core: false, kind: 'action', lock: true },
  { name: 'Floor_Sit_Down', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Sit_Floor_Down', core: false, kind: 'action', lock: true },
  { name: 'Floor_Sit_Loop', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Sit_Floor_Idle', core: false, kind: 'loop', lock: true },
  { name: 'Floor_Stand_Up', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Sit_Floor_StandUp', core: false, kind: 'action', lock: true },
  { name: 'Lie_Down', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Lie_Down', core: false, kind: 'action', lock: true, floor: false },
  { name: 'Lie_Loop', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Lie_Idle', core: false, kind: 'loop', lock: true, floor: false },
  { name: 'Lie_Stand_Up', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Lie_StandUp', core: false, kind: 'action', lock: true, floor: false },
  { name: 'Exercise_PushUps', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Push_Ups', core: false, kind: 'loop', lock: true, floor: false },
  { name: 'Exercise_SitUps', src: 'kaykit', file: 'Rig_Medium_Simulation.glb', clip: 'Sit_Ups', core: false, kind: 'loop', lock: true, floor: false },
  { name: 'Pick_Up', src: 'kaykit', file: 'Rig_Medium_General.glb', clip: 'PickUp', core: false, kind: 'action', lock: true },
  { name: 'Throw_Object', src: 'kaykit', file: 'Rig_Medium_General.glb', clip: 'Throw', core: false, kind: 'action', lock: true },
  { name: 'Use_Item', src: 'kaykit', file: 'Rig_Medium_General.glb', clip: 'Use_Item', core: false, kind: 'action', lock: true },
  { name: 'Interact_Generic', src: 'kaykit', file: 'Rig_Medium_General.glb', clip: 'Interact', core: false, kind: 'action', lock: true },
];

const missing = Object.entries(SRC).filter(([, p]) => !existsSync(p)).map(([k]) => k);
if (missing.length) {
  console.log(`build-character-animations: source packs absent (${missing.join(', ')}); keeping the shipped GLBs.`);
  process.exit(0);
}

// --- Load target and sources (cached).
const target = await loadGltf(CHARACTER);
const targetScene = target.scene;
const cache = new Map();
async function source(spec) {
  const key = spec.src === 'kaykit' ? `kaykit:${spec.file}` : spec.src === 'cmu' ? `cmu:${spec.subject}_${spec.trial}` : spec.src;
  if (cache.has(key)) return cache.get(key);
  let value;
  if (spec.src === 'ual1' || spec.src === 'ual2') value = await loadGltf(SRC[spec.src]);
  else if (spec.src === 'modular') {
    const bytes = readFileSync(SRC.modular);
    const root = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    value = { scene: root, animations: root.animations };
  } else if (spec.src === 'kaykit') value = await loadGltf(SRC.kaykit + spec.file);
  else value = loadCmu(`${SRC.cmu}${spec.subject}.asf`, `${SRC.cmu}${spec.subject}_${spec.trial}.amc`, { name: spec.name, step: 4 });
  cache.set(key, value);
  return value;
}

function hipForward(group) {
  const b = new Map(); group.traverse(o => o.isBone && b.set(o.name, o));
  const l = b.get('lfemur').getWorldPosition(new Vector3()), r = b.get('rfemur').getWorldPosition(new Vector3());
  return l.sub(r).cross(new Vector3(0, 1, 0)).setY(0).normalize();
}

/** Runs the right retarget for a spec and returns a target-rig clip. */
async function buildClip(spec) {
  const src = await source(spec);
  if (spec.src === 'ual1' || spec.src === 'ual2') {
    const clip = src.animations.find(c => c.name === spec.clip);
    if (!clip) throw new Error(`${spec.src} missing ${spec.clip}`);
    if (!spec.mirror) return transferSameRig(src.scene, clip, targetScene, spec.name);
    return retargetClip({ sourceRoot: src.scene, clip, reference: {}, targetRoot: targetScene, map: universalSelfMap(targetScene, { mirror: true }),
      pelvis: { target: 'pelvis', source: 'pelvis' }, mirror: true, name: spec.name });
  }
  if (spec.src === 'modular') {
    const find = n => src.animations.find(c => c.name === `CharacterArmature|${n}`);
    return retargetClip({ sourceRoot: src.scene, clip: find(spec.clip), reference: { clip: find('Idle_Neutral'), time: 0 }, targetRoot: targetScene,
      map: MODULAR_TO_UNIVERSAL, pelvis: { target: 'pelvis', source: 'Body' }, name: spec.name, lockHorizontal: !!spec.lock });
  }
  if (spec.src === 'kaykit') {
    const clip = src.animations.find(c => c.name === spec.clip);
    const tpose = src.animations.find(c => c.name === 'T-Pose');
    return retargetClip({ sourceRoot: src.scene, clip, reference: { clip: tpose, time: 0 }, targetRoot: targetScene,
      map: KAYKIT_TO_UNIVERSAL, blends: KAYKIT_BLENDS, pelvis: { target: 'pelvis', source: 'hips' }, name: spec.name, lockHorizontal: !!spec.lock });
  }
  // CMU: crop, face the crop start forward, retarget at rest reference.
  const { group, clip } = src;
  const [t0, t1] = spec.crop ?? [0, clip.duration];
  const mixer = new AnimationMixer(group); mixer.clipAction(clip).play(); mixer.setTime(t0); group.updateMatrixWorld(true);
  const forward = hipForward(group);
  mixer.stopAllAction(); mixer.uncacheRoot(group);
  group.traverse(o => { if (o.isBone) o.quaternion.identity(); });
  group.getObjectByName('root').position.set(0, 0, 0);
  const cropped = resampleClip(clip, { t0, t1, fps: 30, name: spec.name });
  return retargetClip({ sourceRoot: group, clip: cropped, reference: {}, targetRoot: targetScene, map: CMU_TO_UNIVERSAL,
    pelvis: { target: 'pelvis', source: 'root' }, sourceForward: forward, name: spec.name, lockHorizontal: !!spec.lock });
}

const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

const built = [];
for (const spec of SPECS) {
  let clip = await buildClip(spec);
  clip = resampleClip(clip, { fps: 30, name: spec.name });
  const meta = { kind: spec.kind, core: !!spec.core, loop: spec.kind === 'loop', duration: +clip.duration.toFixed(3), ...CREDIT[spec.src], from: spec.src === 'cmu' ? `${spec.subject}_${spec.trial}${spec.crop ? ` [${spec.crop.join('-')}s]` : ''}` : spec.clip };
  if (spec.mirror) meta.from += ' (mirrored)';

  // Aim a strike so it lands along the character's forward (+Z), then settle any leftover spin.
  if (spec.aim && spec.effector) {
    const strike = measureStrike(targetScene, clip, spec.effector);
    const correction = wrap(0 - strike.direction);
    rotateBodyYaw(clip, targetScene, () => correction);
  }
  if (spec.faceForward) {
    const mixer = new AnimationMixer(targetScene); mixer.clipAction(clip).play();
    const yaw = pelvisYawAt(targetScene, mixer, 0);
    mixer.stopAllAction(); mixer.uncacheRoot(targetScene);
    rotateBodyYaw(clip, targetScene, () => wrap(-yaw));
  }
  if (spec.settleYaw && spec.effector) {
    const strike = measureStrike(targetScene, clip, spec.effector);
    const mixer = new AnimationMixer(targetScene); mixer.clipAction(clip).play();
    const startYaw = pelvisYawAt(targetScene, mixer, 0), endYaw = pelvisYawAt(targetScene, mixer, clip.duration - 1e-3);
    mixer.stopAllAction(); mixer.uncacheRoot(targetScene);
    const residual = wrap(endYaw - startYaw), hitT = strike.hit * clip.duration;
    rotateBodyYaw(clip, targetScene, t => -residual * smooth((t - hitT) / Math.max(1e-3, clip.duration - hitT)));
    meta.settledYawDeg = +(residual * 180 / Math.PI).toFixed(1);
  }
  if (spec.rootYaw) {
    const root = extractRootYaw(clip, targetScene);
    meta.rootYaw = root;
    meta.rootYawTotalDeg = root.yawDeg[root.yawDeg.length - 1];
  }
  if (spec.lock) lockPelvisHorizontal(clip, targetScene);
  // Cross-rig retargets can float or sink by a few centimetres; contact frames go back to the floor.
  if (spec.src !== 'ual1' && spec.src !== 'ual2' || spec.mirror) {
    if (spec.floor !== false) meta.floorOffsetCm = +(calibrateFloor(clip, targetScene, { window: spec.floorWindow ?? [0, 1] }) * 100).toFixed(1);
  }
  if (spec.kind === 'loop') closeLoop(clip, Math.min(0.35, clip.duration * 0.3));

  if (spec.kind === 'loop') Object.assign(meta, measureLocomotion(targetScene, clip, spec.travel ?? new Vector3(0, 0, 1)));
  if (spec.effector) {
    const strike = measureStrike(targetScene, clip, spec.effector);
    Object.assign(meta, { hit: strike.hit, reach: strike.reach, hitHeight: strike.height, effector: spec.effector });
  }
  stripStaticTracks(clip);
  built.push({ spec, clip, meta });
  console.log(`  ${spec.name.padEnd(20)} ${clip.duration.toFixed(2)}s ${spec.core ? 'core' : 'lib '} ${meta.groundSpeed !== undefined ? `speed ${meta.groundSpeed} m/s` : ''}${meta.hit !== undefined ? ` hit ${meta.hit} reach ${meta.reach}` : ''}${meta.settledYawDeg !== undefined ? ` settled ${meta.settledYawDeg}°` : ''}${meta.rootYawTotalDeg !== undefined ? ` rootYaw ${meta.rootYawTotalDeg}°` : ''}${meta.floorOffsetCm !== undefined ? ` floor ${meta.floorOffsetCm}cm` : ''}`);
}

// Measure the existing core loops too, so locomotion can be stride-synced from data.
const existing = target.animations;
const existingMeta = {};
for (const name of ['Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Idle_Loop', 'Idle_FoldArms_Loop', 'Swim_Fwd_Loop', 'Slide_Loop', 'NinjaJump_Idle_Loop', 'Jump_Loop', 'Swim_Idle_Loop']) {
  const clip = existing.find(c => c.name === name);
  if (!clip) continue;
  existingMeta[name] = { kind: 'loop', core: true, loop: true, duration: +clip.duration.toFixed(3), ...CREDIT[name === 'Idle_FoldArms_Loop' || name === 'Slide_Loop' || name === 'NinjaJump_Idle_Loop' ? 'ual2' : 'ual1'], from: name,
    ...measureLocomotion(targetScene, clip) };
}
for (const [name, effector] of [['Punch_Jab', 'hand_l'], ['Punch_Cross', 'hand_r'], ['Melee_Hook', 'hand_r'], ['OverhandThrow', 'hand_r']]) {
  const clip = existing.find(c => c.name === name);
  if (!clip) continue;
  const strike = measureStrike(targetScene, clip, effector);
  existingMeta[name] = { kind: 'strike', core: true, loop: false, duration: +clip.duration.toFixed(3), ...CREDIT.ual1, from: name, hit: strike.hit, reach: strike.reach, hitHeight: strike.height, effector };
}
for (const name of ['Jump_Start', 'Jump_Land', 'Roll', 'Hit_Chest', 'Hit_Head', 'ClimbUp_1m', 'Hit_Knockback', 'Melee_Hook_Rec', 'NinjaJump_Start', 'NinjaJump_Land', 'Slide_Start', 'Slide_Exit']) {
  const clip = existing.find(c => c.name === name);
  if (clip) existingMeta[name] = { kind: 'action', core: true, loop: false, duration: +clip.duration.toFixed(3), ...CREDIT[/Ninja|Climb|Knockback|Hook|Slide/.test(name) ? 'ual2' : 'ual1'], from: name };
}

// --- Write the character GLB: drop the broken legacy kicks, add the core clips.
const io = new NodeIO();
const charDoc = await io.read(CHARACTER);
const charRoot = charDoc.getRoot();
const newNames = new Set(built.map(b => b.spec.name));
for (const animation of charRoot.listAnimations()) {
  if (/^Kick_(Left|Right)$/.test(animation.getName()) || newNames.has(animation.getName())) animation.dispose();
}
const charNodes = new Map(charRoot.listNodes().map(n => [n.getName(), n]));
const charBuffer = charRoot.listBuffers()[0];
for (const { spec, clip } of built) if (spec.core) addClipToDocument(charDoc, clip, charNodes, charBuffer);
const COPYRIGHT = 'Animation: CC0 1.0 (Quaternius, KayKit/Kay Lousberg); CMU Graphics Lab Motion Capture Database (free use, not for resale as data). See docs/assets/CREDITS.md';
charRoot.getAsset().copyright = `Mesh: CC0 1.0 (Quaternius Universal Base Characters). ${COPYRIGHT}`;
await charDoc.transform(resample({ tolerance: 1e-4 }), dedup(), prune({ keepAttributes: true }));
await io.write(CHARACTER, charDoc);

// --- Write the library GLB: the same skeleton nodes, no mesh, only library clips.
const libDoc = await io.read(CHARACTER);
const libRoot = libDoc.getRoot();
for (const animation of libRoot.listAnimations()) animation.dispose();
for (const node of libRoot.listNodes()) { node.setMesh(null); node.setSkin(null); }
for (const mesh of libRoot.listMeshes()) mesh.dispose();
for (const skin of libRoot.listSkins()) skin.dispose();
const libNodes = new Map(libRoot.listNodes().map(n => [n.getName(), n]));
const libBuffer = libRoot.listBuffers()[0];
for (const { spec, clip } of built) if (!spec.core) addClipToDocument(libDoc, clip, libNodes, libBuffer);
libRoot.getAsset().copyright = COPYRIGHT;
await libDoc.transform(resample({ tolerance: 1e-4 }), dedup(), prune({ keepAttributes: false }));
await io.write(LIBRARY, libDoc);

// --- Catalog and library manifest.
const catalog = { generatedBy: 'scripts/assets/build-character-animations.mjs', rigHeightMeters: 1.81, clips: { ...existingMeta } };
for (const { spec, meta } of built) catalog.clips[spec.name] = meta;
mkdirSync('src/player/animations', { recursive: true });
writeFileSync(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`);
writeFileSync(LIBRARY_MANIFEST, `${JSON.stringify({
  source: 'DR Manaus animation library (see clipCatalog.json for per-clip provenance)',
  licence: 'CC0 1.0 (Quaternius, KayKit); CMU Graphics Lab Motion Capture Database terms for the captured kicks',
  url: 'https://quaternius.com/ · https://kaylousberg.com/ · http://mocap.cs.cmu.edu/',
  clips: built.filter(b => !b.spec.core).map(b => b.spec.name),
}, null, 2)}\n`);

const sizeOf = p => (readFileSync(p).length / 1048576).toFixed(2);
console.log(`character: ${charRoot.listAnimations().length} clips, ${sizeOf(CHARACTER)} MB`);
console.log(`library:   ${libRoot.listAnimations().length} clips, ${sizeOf(LIBRARY)} MB`);
