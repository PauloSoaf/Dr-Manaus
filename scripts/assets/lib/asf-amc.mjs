/**
 * Acclaim ASF/AMC (CMU Graphics Lab Motion Capture Database) to a three.js skeleton and clip.
 *
 * ASF: each bone has a rest `direction` and `length` in world axes, an `axis` (Euler, degrees)
 * defining its local frame C, and a list of rotational DOFs. AMC: per frame, the DOF values.
 * The world rotation of a bone relative to rest is  M_world = M_world(parent) * C * R * C^-1,
 * with R the DOF rotation (static XYZ order: Rz * Ry * Rx). The bone starts where its parent
 * ends; the root carries the frame's translation.
 *
 * The produced skeleton has identity rest rotations (ASF rest is expressed in world axes), so each
 * bone's local quaternion per frame is simply C * R * C^-1 and three.js reproduces the motion.
 */
import { readFileSync } from 'node:fs';
import { AnimationClip, Bone, Group, Matrix4, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';

const DEG = Math.PI / 180;

export function parseAsf(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const bones = new Map(); let units = { length: 1, angle: 'deg' };
  const root = { name: 'root', order: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ'], axisOrder: 'XYZ', position: [0, 0, 0], orientation: [0, 0, 0] };
  const hierarchy = new Map();
  let section = '', current = null;
  for (const line of lines) {
    if (line.startsWith(':')) {
      const [key, ...rest] = line.slice(1).split(/\s+/);
      section = key;
      if (key === 'units') units = {};
      continue;
    }
    if (section === 'units') { const [k, v] = line.split(/\s+/); units[k] = k === 'angle' ? v : Number(v); }
    else if (section === 'root') {
      const [k, ...v] = line.split(/\s+/);
      if (k === 'order') root.order = v.map(s => s.toUpperCase());
      else if (k === 'axis') root.axisOrder = v[0].toUpperCase();
      else if (k === 'position') root.position = v.map(Number);
      else if (k === 'orientation') root.orientation = v.map(Number);
    } else if (section === 'bonedata') {
      const [k, ...v] = line.split(/\s+/);
      if (k === 'begin') current = { dof: [], axis: [0, 0, 0], axisOrder: 'XYZ', direction: [0, 0, 0], length: 0 };
      else if (k === 'end') { bones.set(current.name, current); current = null; }
      else if (!current) continue;
      else if (k === 'name') current.name = v[0];
      else if (k === 'direction') current.direction = v.map(Number);
      else if (k === 'length') current.length = Number(v[0]);
      else if (k === 'axis') { current.axis = v.slice(0, 3).map(Number); current.axisOrder = (v[3] ?? 'XYZ').toUpperCase(); }
      else if (k === 'dof') current.dof = v.map(s => s.toUpperCase());
    } else if (section === 'hierarchy') {
      const [k, ...v] = line.split(/\s+/);
      if (k === 'begin' || k === 'end') continue;
      hierarchy.set(k, v);
    }
  }
  return { units, root, bones, hierarchy };
}

export function parseAmc(text) {
  const frames = []; let frame = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(':')) continue;
    if (/^\d+$/.test(line)) { frame = new Map(); frames.push(frame); continue; }
    if (!frame) continue;
    const [name, ...values] = line.split(/\s+/);
    frame.set(name, values.map(Number));
  }
  return frames;
}

/** Rotation matrix for Euler angles applied in static `order` (e.g. 'XYZ' = X first, then Y, then Z). */
function staticEuler(angles, order) {
  const m = new Matrix4().identity();
  for (let i = 0; i < order.length; i++) {
    const axis = order[i], a = angles[i];
    const r = new Matrix4();
    if (axis === 'X') r.makeRotationX(a); else if (axis === 'Y') r.makeRotationY(a); else r.makeRotationZ(a);
    m.premultiply(r);
  }
  return m;
}

/**
 * Builds a three.js skeleton (Group with Bones) and an AnimationClip from ASF/AMC text.
 * `scale` converts ASF length units to metres-ish (only proportions matter for retargeting).
 * `start`/`end` crop frames; `step` decimates 120 fps capture.
 */
export function asfAmcToThree(asfText, amcText, { name = 'cmu', fps = 120, step = 4, start = 0, end = Infinity, scale = 0.056444 } = {}) {
  const asf = parseAsf(asfText);
  const frames = parseAmc(amcText).slice(start, Math.min(end, Infinity));
  const group = new Group(); group.name = `${name}-skeleton`;
  const threeBones = new Map();
  const rootBone = new Bone(); rootBone.name = 'root'; group.add(rootBone); threeBones.set('root', rootBone);
  const C = new Map(), Cinv = new Map();
  const rootC = staticEuler(asf.root.orientation.map(a => a * DEG), asf.root.axisOrder);
  C.set('root', rootC); Cinv.set('root', rootC.clone().invert());
  for (const [boneName, bone] of asf.bones) {
    const c = staticEuler(bone.axis.map(a => a * DEG), bone.axisOrder);
    C.set(boneName, c); Cinv.set(boneName, c.clone().invert());
  }
  // Rest offsets: a bone starts where its parent ends.
  const build = parentName => {
    for (const childName of asf.hierarchy.get(parentName) ?? []) {
      const child = new Bone(); child.name = childName;
      const parent = threeBones.get(parentName);
      if (parentName !== 'root') {
        const p = asf.bones.get(parentName);
        child.position.set(p.direction[0] * p.length * scale, p.direction[1] * p.length * scale, p.direction[2] * p.length * scale);
      }
      parent.add(child); threeBones.set(childName, child);
      build(childName);
    }
  };
  build('root');
  // End joints so the last segment of every chain has a direction (e.g. `ltoes_end`).
  for (const [boneName, bone] of asf.bones) {
    if ((asf.hierarchy.get(boneName) ?? []).length) continue;
    const tip = new Bone(); tip.name = `${boneName}_end`;
    tip.position.set(bone.direction[0] * bone.length * scale, bone.direction[1] * bone.length * scale, bone.direction[2] * bone.length * scale);
    threeBones.get(boneName).add(tip); threeBones.set(tip.name, tip);
  }

  const used = frames.filter((_, i) => i % step === 0);
  const times = new Float32Array(used.length);
  const rotations = new Map([...threeBones.keys()].map(n => [n, new Float32Array(used.length * 4)]));
  const rootPositions = new Float32Array(used.length * 3);
  const q = new Quaternion();
  used.forEach((frame, f) => {
    times[f] = f * step / fps;
    for (const [boneName] of threeBones) {
      if (boneName.endsWith('_end')) { q.identity(); q.toArray(rotations.get(boneName), f * 4); continue; }
      let local;
      if (boneName === 'root') {
        const values = frame.get('root') ?? [0, 0, 0, 0, 0, 0];
        const order = asf.root.order;
        const angles = [], axes = [];
        order.forEach((channel, i) => {
          if (channel[0] === 'T') rootPositions[f * 3 + 'XYZ'.indexOf(channel[1])] = values[i] * scale;
          else { angles.push(values[i] * DEG); axes.push(channel[1]); }
        });
        local = C.get('root').clone().multiply(staticEuler(angles, axes.join(''))).multiply(Cinv.get('root'));
      } else {
        const bone = asf.bones.get(boneName);
        const values = frame.get(boneName) ?? [];
        const angles = [], axes = [];
        bone.dof.forEach((channel, i) => { if (channel[0] === 'R') { angles.push((values[i] ?? 0) * DEG); axes.push(channel[1]); } });
        local = C.get(boneName).clone().multiply(staticEuler(angles, axes.join(''))).multiply(Cinv.get(boneName));
      }
      q.setFromRotationMatrix(local);
      const arr = rotations.get(boneName), o = f * 4;
      if (f > 0 && arr[o - 4] * q.x + arr[o - 3] * q.y + arr[o - 2] * q.z + arr[o - 1] * q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      q.toArray(arr, o);
    }
  });
  const tracks = [new VectorKeyframeTrack('root.position', times, rootPositions)];
  for (const [boneName, values] of rotations) tracks.push(new QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values));
  const clip = new AnimationClip(name, times[times.length - 1] ?? 0, tracks);
  return { group, clip, bones: threeBones };
}

export function loadCmu(asfPath, amcPath, options) {
  return asfAmcToThree(readFileSync(asfPath, 'utf8'), readFileSync(amcPath, 'utf8'), options);
}

/** Bone map from the CMU ASF skeleton to the Universal rig. */
export const CMU_TO_UNIVERSAL = [
  ['pelvis', 'root', 'spine_01', 'upperback'],
  ['spine_01', 'lowerback', 'spine_02', 'upperback'],
  ['spine_02', 'upperback', 'spine_03', 'thorax'],
  ['spine_03', 'thorax', 'neck_01', 'lowerneck'],
  ['neck_01', 'lowerneck', 'Head', 'head'],
  ['Head', 'head'],
  ['clavicle_l', 'lclavicle', 'upperarm_l', 'lhumerus'], ['upperarm_l', 'lhumerus', 'lowerarm_l', 'lradius'],
  ['lowerarm_l', 'lradius', 'hand_l', 'lwrist'], ['hand_l', 'lhand', 'middle_01_l', 'lfingers'],
  ['clavicle_r', 'rclavicle', 'upperarm_r', 'rhumerus'], ['upperarm_r', 'rhumerus', 'lowerarm_r', 'rradius'],
  ['lowerarm_r', 'rradius', 'hand_r', 'rwrist'], ['hand_r', 'rhand', 'middle_01_r', 'rfingers'],
  ['thigh_l', 'lfemur', 'calf_l', 'ltibia'], ['calf_l', 'ltibia', 'foot_l', 'lfoot'],
  ['foot_l', 'lfoot', 'ball_l', 'ltoes'], ['ball_l', 'ltoes'],
  ['thigh_r', 'rfemur', 'calf_r', 'rtibia'], ['calf_r', 'rtibia', 'foot_r', 'rfoot'],
  ['foot_r', 'rfoot', 'ball_r', 'rtoes'], ['ball_r', 'rtoes'],
];
