/**
 * World-space rotation retargeting between humanoid rigs whose bones have different local axes,
 * different proportions and different rest postures.
 *
 * Why the previous kick import failed: it computed `targetRest * sourceRest^-1 * sourceAnimated`,
 * which applies the source's *local-frame* delta in the target's local frame. That is only right
 * when both bones share the same axes. The Modular Men rig does not (and its stored "rest" is a
 * walking stance, not a T-pose), so the knee folded about the wrong axis.
 *
 * What this does instead, per mapped bone b:
 *
 *   1. A reference posture is chosen on the source (a T-pose clip, or an idle frame). The target
 *      is bent into the same posture by aligning each bone's direction (joint -> child joint) to
 *      the source bone's direction with a minimal rotation, top-down. That gives T_ref.
 *   2. For every frame t the source's world rotation change since the reference is transferred:
 *        T_world(t) = S_world(t) * S_world(ref)^-1 * T_ref_world
 *   3. World rotations are converted back to local rotations through the animated parent chain.
 *
 * Bones with no source keep their rest local rotation (they ride their parent). Bones listed as a
 * blend take a spherical blend of two mapped bones' world deltas, which spreads a two-bone spine
 * over a three-bone one instead of kinking it at a single joint.
 *
 * The pelvis also receives translation: the source hip displacement since the reference, scaled
 * by the ratio of hip heights, so a crouch or a jump keeps its depth on a taller body.
 */
import { AnimationClip, AnimationMixer, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';

const _q = new Quaternion(), _q2 = new Quaternion(), _v = new Vector3(), _v2 = new Vector3();

function bonesByName(root) {
  const map = new Map();
  root.traverse(o => { if (o.isBone || o.type === 'Bone') map.set(o.name, o); });
  return map;
}

/** Bones of `root` in parent-before-child order. */
function hierarchyOrder(root) {
  const order = [];
  root.traverse(o => { if (o.isBone) order.push(o); });
  return order;
}

/** Reflects sampled world data across the YZ plane (x -> -x): a left-handed version of a move. */
function mirrorSample(sample) {
  for (const p of sample.positions.values()) p.x = -p.x;
  for (const q of sample.rotations.values()) q.set(q.x, -q.y, -q.z, q.w);
  return sample;
}

function sampleWorld(sourceRoot, bones, mixer, clip, time) {
  if (clip) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.reset().play();
    mixer.setTime(Math.max(0, Math.min(time, clip.duration - 1e-5)));
  }
  sourceRoot.updateMatrixWorld(true);
  const rotations = new Map(), positions = new Map();
  for (const [name, bone] of bones) {
    rotations.set(name, bone.getWorldQuaternion(new Quaternion()));
    positions.set(name, bone.getWorldPosition(new Vector3()));
  }
  return { rotations, positions };
}

/**
 * @param {object} options
 * @param {import('three').Object3D} options.sourceRoot  source skeleton scene (with the clip's bones)
 * @param {import('three').AnimationClip} options.clip   source clip to transfer
 * @param {{clip?: import('three').AnimationClip, time?: number}} options.reference  source posture matched to target rest
 * @param {import('three').Object3D} options.targetRoot  target skeleton scene, at rest
 * @param {Array<[string, string, string?, string?]>} options.map  [targetBone, sourceBone, targetDirChild?, sourceDirChild?]
 * @param {Array<[string, string, string, number]>} [options.blends]  [targetBone, targetA, targetB, weight]
 * @param {{target: string, source: string}} options.pelvis  hip bones for translation
 * @param {number} [options.fps]
 * @param {string} [options.name]
 * @param {boolean} [options.lockHorizontal]  keep hips over the origin (in-place clips)
 * @param {Vector3} [options.sourceForward]  source facing in world, if not +Z
 */
export function retargetClip(options) {
  const { sourceRoot, clip, reference = {}, targetRoot, map, blends = [], pelvis, fps = 30, name = clip.name, lockHorizontal = false } = options;
  const sourceBones = bonesByName(sourceRoot), targetBones = bonesByName(targetRoot);
  for (const [t, s] of map) {
    if (!targetBones.has(t)) throw new Error(`retarget: target bone missing ${t}`);
    if (!sourceBones.has(s)) throw new Error(`retarget: source bone missing ${s}`);
  }
  const mixer = new AnimationMixer(sourceRoot);

  // Source facing correction: rotate the source world so it faces +Z like the target.
  const facing = new Quaternion();
  if (options.sourceForward) facing.setFromUnitVectors(_v.copy(options.sourceForward).setY(0).normalize(), new Vector3(0, 0, 1));
  const facingInv = facing.clone().invert();

  // --- Reference posture on the source.
  const ref = sampleWorld(sourceRoot, sourceBones, mixer, reference.clip ?? null, reference.time ?? 0);
  if (options.mirror) mirrorSample(ref);
  for (const q of ref.rotations.values()) q.premultiply(facing);
  for (const p of ref.positions.values()) p.applyQuaternion(facing);

  // --- Target rest, then bent into the reference posture by direction alignment.
  targetRoot.updateMatrixWorld(true);
  const order = hierarchyOrder(targetRoot);
  const restLocal = new Map(order.map(b => [b.name, b.quaternion.clone()]));
  const restWorldPos = new Map(order.map(b => [b.name, b.getWorldPosition(new Vector3())]));
  const parentWorldStatic = new Map(order.map(b => [b.name, b.parent && !b.parent.isBone ? b.parent.getWorldQuaternion(new Quaternion()) : null]));
  const mapByTarget = new Map(map.map(entry => [entry[0], entry]));

  // Reference world rotations and joint positions for the target, computed top-down.
  const refWorld = new Map(), refPos = new Map();
  for (const bone of order) {
    const parentWorld = bone.parent?.isBone ? refWorld.get(bone.parent.name) : parentWorldStatic.get(bone.name) ?? new Quaternion();
    const parentPos = bone.parent?.isBone ? refPos.get(bone.parent.name) : null;
    let world = parentWorld.clone().multiply(restLocal.get(bone.name));
    // Joint position follows the (re-posed) parent chain.
    let pos;
    if (parentPos) {
      _v.copy(bone.position).multiply(bone.parent.scale.clone().set(1, 1, 1)).applyQuaternion(parentWorld);
      // bone.position is in parent space; parent scale assumed uniform 1 on skeleton bones.
      pos = parentPos.clone().add(_v);
    } else {
      pos = restWorldPos.get(bone.name).clone();
    }
    const entry = mapByTarget.get(bone.name);
    if (entry && entry[2] && entry[3] && targetBones.has(entry[2]) && sourceBones.has(entry[3])) {
      // Direction of this bone in the current (re-posed) chain, using the child's rest offset.
      const child = targetBones.get(entry[2]);
      const childOffset = _v2.copy(child.position);
      // Offset of the child relative to this bone, rotated into world by this bone's world rotation.
      const currentDir = childOffset.clone().applyQuaternion(world).normalize();
      const desiredDir = ref.positions.get(entry[3]).clone().sub(ref.positions.get(entry[1])).normalize();
      if (currentDir.lengthSq() > 0 && desiredDir.lengthSq() > 0) {
        _q.setFromUnitVectors(currentDir, desiredDir);
        world = _q.clone().multiply(world);
      }
    }
    refWorld.set(bone.name, world);
    refPos.set(bone.name, pos);
  }

  // Hip height ratio for translation.
  const sourceHip = ref.positions.get(pelvis.source);
  const targetHip = restWorldPos.get(pelvis.target);
  const sourceGround = Math.min(...[...ref.positions.values()].map(p => p.y));
  let hipScale = (targetHip.y) / Math.max(1e-6, sourceHip.y - sourceGround);
  // Prefer the ratio of leg lengths (hip joint -> knee -> ankle) when the legs are mapped: some rigs'
  // "hip" bone sits well below the real hip joints, which would exaggerate every vertical motion.
  {
    const src = name => mapByTarget.get(name)?.[1];
    const s0 = src('thigh_l'), s1 = src('calf_l'), s2 = src('foot_l');
    const t0 = targetBones.get('thigh_l'), t1 = targetBones.get('calf_l'), t2 = targetBones.get('foot_l');
    if (s0 && s1 && s2 && t0 && t1 && t2 && ref.positions.get(s0) && ref.positions.get(s1) && ref.positions.get(s2)) {
      const legT = restWorldPos.get('thigh_l').distanceTo(restWorldPos.get('calf_l')) + restWorldPos.get('calf_l').distanceTo(restWorldPos.get('foot_l'));
      const legS = ref.positions.get(s0).distanceTo(ref.positions.get(s1)) + ref.positions.get(s1).distanceTo(ref.positions.get(s2));
      if (legS > 1e-6) hipScale = legT / legS;
    }
  }
  // The clip's own floor: captures (CMU) place the root at its real height while the reference
  // rest may sit at the origin, so the floor is measured on the clip rather than assumed.
  let clipFloor = options.sourceFloor;
  let firstHip = null;
  {
    let lowest = Infinity;
    const probes = 24;
    for (let i = 0; i < probes; i++) {
      const s = sampleWorld(sourceRoot, sourceBones, mixer, clip, clip.duration * i / (probes - 1));
      if (options.mirror) mirrorSample(s);
      for (const pos of s.positions.values()) { pos.applyQuaternion(facing); lowest = Math.min(lowest, pos.y); }
      if (i === 0) firstHip = s.positions.get(pelvis.source).clone().applyQuaternion(facing);
    }
    if (clipFloor === undefined) clipFloor = lowest;
  }

  // --- Sample every frame.
  const frameCount = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(frameCount);
  const tracks = new Map(order.map(b => [b.name, new Float32Array(frameCount * 4)]));
  const pelvisValues = new Float32Array(frameCount * 3);
  const animatedTargets = new Set([...map.map(m => m[0]), ...blends.map(b => b[0])]);

  for (let frame = 0; frame < frameCount; frame++) {
    const time = Math.min(clip.duration, frame / fps);
    times[frame] = time;
    const cur = sampleWorld(sourceRoot, sourceBones, mixer, clip, time);
    if (options.mirror) mirrorSample(cur);
    for (const q of cur.rotations.values()) q.premultiply(facing);
    for (const p of cur.positions.values()) p.applyQuaternion(facing);

    const deltas = new Map();
    for (const [targetName, sourceName] of map) {
      const delta = cur.rotations.get(sourceName).clone().multiply(_q2.copy(ref.rotations.get(sourceName)).invert());
      deltas.set(targetName, delta);
    }
    for (const [targetName, a, b, w] of blends) {
      const qa = deltas.get(a), qb = deltas.get(b);
      if (qa && qb) deltas.set(targetName, qa.clone().slerp(qb, w));
    }

    const animWorld = new Map();
    for (const bone of order) {
      const parentWorld = bone.parent?.isBone ? animWorld.get(bone.parent.name) : parentWorldStatic.get(bone.name) ?? new Quaternion();
      let world;
      const delta = deltas.get(bone.name);
      if (delta) world = delta.clone().multiply(refWorld.get(bone.name));
      else world = parentWorld.clone().multiply(restLocal.get(bone.name));
      animWorld.set(bone.name, world);
      const local = parentWorld.clone().invert().multiply(world).normalize();
      const values = tracks.get(bone.name), offset = frame * 4;
      if (frame > 0) {
        const dot = values[offset - 4] * local.x + values[offset - 3] * local.y + values[offset - 2] * local.z + values[offset - 1] * local.w;
        if (dot < 0) local.set(-local.x, -local.y, -local.z, -local.w);
      }
      local.toArray(values, offset);
    }

    // Pelvis translation: source hip displacement since the reference, scaled, in parent space.
    const hipNow = cur.positions.get(pelvis.source);
    const worldPos = new Vector3(
      lockHorizontal ? targetHip.x : targetHip.x + (hipNow.x - firstHip.x) * hipScale,
      (hipNow.y - clipFloor) * hipScale,
      lockHorizontal ? targetHip.z : targetHip.z + (hipNow.z - firstHip.z) * hipScale,
    );
    const pelvisBone = targetBones.get(pelvis.target);
    const parent = pelvisBone.parent;
    parent.updateMatrixWorld(true);
    const localPos = parent.worldToLocal(worldPos.clone());
    localPos.toArray(pelvisValues, frame * 3);
  }

  const out = [];
  for (const bone of order) {
    if (!animatedTargets.has(bone.name) && !isDescendantOfAnimated(bone, animatedTargets)) continue;
    out.push(new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, tracks.get(bone.name)));
  }
  out.push(new VectorKeyframeTrack(`${pelvis.target}.position`, times, pelvisValues));
  mixer.stopAllAction(); mixer.uncacheRoot(sourceRoot);
  return new AnimationClip(name, clip.duration, out);
}

/** Unmapped bones under an animated parent still get explicit rest tracks (keeps clips self-contained). */
function isDescendantOfAnimated(bone, animated) {
  let p = bone.parent;
  while (p) { if (animated.has(p.name)) return true; p = p.parent; }
  return false;
}

/**
 * Bone map from Quaternius' Modular Men "CharacterArmature" rig to the Universal (UE-style) rig.
 * Entries: [target, source, targetChildForDirection, sourceChildForDirection].
 */
export const MODULAR_TO_UNIVERSAL = [
  ['pelvis', 'Body', 'spine_01', 'Abdomen'],
  ['spine_01', 'Abdomen', 'spine_02', 'Torso'],
  ['spine_02', 'Torso', 'spine_03', 'Chest'],
  ['spine_03', 'Chest', 'neck_01', 'Neck'],
  ['neck_01', 'Neck', 'Head', 'Head'],
  ['Head', 'Head'],
  ['clavicle_l', 'ShoulderL', 'upperarm_l', 'UpperArmL'], ['upperarm_l', 'UpperArmL', 'lowerarm_l', 'LowerArmL'],
  ['lowerarm_l', 'LowerArmL', 'hand_l', 'WristL'], ['hand_l', 'WristL', 'middle_01_l', 'Middle1L'],
  ['clavicle_r', 'ShoulderR', 'upperarm_r', 'UpperArmR'], ['upperarm_r', 'UpperArmR', 'lowerarm_r', 'LowerArmR'],
  ['lowerarm_r', 'LowerArmR', 'hand_r', 'WristR'], ['hand_r', 'WristR', 'middle_01_r', 'Middle1R'],
  ['thigh_l', 'UpperLegL', 'calf_l', 'LowerLegL'], ['calf_l', 'LowerLegL', 'foot_l', 'LowerLegL_end'],
  // Modular Men feet are flat IK controls at floor level; the hero's ankle-to-ball slopes down.
  // Aligning their directions would lift the toes, so only the foot's rotation change transfers.
  ['foot_l', 'FootL'],
  ['thigh_r', 'UpperLegR', 'calf_r', 'LowerLegR'], ['calf_r', 'LowerLegR', 'foot_r', 'LowerLegR_end'],
  ['foot_r', 'FootR'],
  ...['l', 'r'].flatMap(side => {
    const S = side.toUpperCase();
    return [
      [`thumb_01_${side}`, `Thumb1${S}`, `thumb_02_${side}`, `Thumb2${S}`], [`thumb_02_${side}`, `Thumb2${S}`, `thumb_03_${side}`, `Thumb3${S}`],
      [`thumb_03_${side}`, `Thumb3${S}`, `thumb_04_leaf_${side}`, `Thumb3${S}_end`],
      ...['index', 'middle', 'ring', 'pinky'].flatMap(finger => {
        const F = finger[0].toUpperCase() + finger.slice(1);
        return [
          [`${finger}_01_${side}`, `${F}1${S}`, `${finger}_02_${side}`, `${F}2${S}`],
          [`${finger}_02_${side}`, `${F}2${S}`, `${finger}_03_${side}`, `${F}3${S}`],
          [`${finger}_03_${side}`, `${F}3${S}`, `${finger}_04_leaf_${side}`, `${F}4${S}`],
        ];
      }),
    ];
  }),
];

/**
 * Bone map from KayKit Character Animations' Rig_Medium (21 bones) to the Universal rig.
 * KayKit has two spine bones and no neck, clavicles or fingers: the middle spine and the neck
 * take a blend of their neighbours' world deltas, clavicles and fingers keep their rest.
 * Names are three.js-sanitised (`upperarm.l` loads as `upperarml`).
 */
export const KAYKIT_TO_UNIVERSAL = [
  ['pelvis', 'hips', 'spine_01', 'spine'],
  ['spine_01', 'spine', 'spine_02', 'chest'],
  ['spine_03', 'chest', 'neck_01', 'head'],
  ['Head', 'head'],
  ['upperarm_l', 'upperarml', 'lowerarm_l', 'lowerarml'], ['lowerarm_l', 'lowerarml', 'hand_l', 'wristl'],
  ['hand_l', 'wristl', 'middle_01_l', 'handl'],
  ['upperarm_r', 'upperarmr', 'lowerarm_r', 'lowerarmr'], ['lowerarm_r', 'lowerarmr', 'hand_r', 'wristr'],
  ['hand_r', 'wristr', 'middle_01_r', 'handr'],
  ['thigh_l', 'upperlegl', 'calf_l', 'lowerlegl'], ['calf_l', 'lowerlegl', 'foot_l', 'footl'],
  ['foot_l', 'footl', 'ball_l', 'toesl'], ['ball_l', 'toesl'],
  ['thigh_r', 'upperlegr', 'calf_r', 'lowerlegr'], ['calf_r', 'lowerlegr', 'foot_r', 'footr'],
  ['foot_r', 'footr', 'ball_r', 'toesr'], ['ball_r', 'toesr'],
];
export const KAYKIT_BLENDS = [
  ['spine_02', 'spine_01', 'spine_03', 0.5],
  ['neck_01', 'spine_03', 'Head', 0.5],
];

/**
 * Identity map for a source on the same Universal skeleton (UAL), optionally swapping sides for a
 * mirrored move. Directions come from each bone's first child.
 */
export function universalSelfMap(targetRoot, { mirror = false } = {}) {
  const swap = name => !mirror ? name : name.replace(/_l$/, '_#').replace(/_r$/, '_l').replace(/_#$/, '_r').replace(/_l_/, '_#_').replace(/_r_/, '_l_').replace(/_#_/, '_r_');
  const map = [];
  targetRoot.traverse(o => {
    if (!o.isBone) return;
    const child = o.children.find(c => c.isBone);
    map.push(child ? [o.name, swap(o.name), child.name, swap(child.name)] : [o.name, swap(o.name)]);
  });
  return map;
}
