/**
 * Clip utilities for the offline character build: same-rig transfer, cropping, loop closing,
 * root-yaw adjustment, measurement (ground speed, foot contacts, strike timing), and conversion
 * of three.js clips into glTF-Transform animations.
 *
 * Everything here moves authored data around; nothing invents a joint pose.
 */
import { AnimationClip, AnimationMixer, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { Accessor, AnimationChannel, AnimationSampler } from '@gltf-transform/core';

export function bonesOf(root) {
  const map = new Map();
  root.traverse(o => { if (o.isBone) map.set(o.name, o); });
  return map;
}

/**
 * Same-skeleton transfer (UAL mannequin -> Superhero): the proven local-delta formula from the
 * original build, `targetRest * sourceRest^-1 * animated`, plus hip translation offset.
 */
export function transferSameRig(sourceScene, clip, targetScene, name = clip.name) {
  const sb = bonesOf(sourceScene), tb = bonesOf(targetScene);
  const q = new Quaternion(), sInv = new Quaternion(), tRest = new Quaternion();
  const tracks = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const boneName = track.name.slice(0, dot), property = track.name.slice(dot + 1);
    const s = sb.get(boneName), t = tb.get(boneName);
    if (!s || !t) continue;
    if (property === 'quaternion') {
      const values = Float32Array.from(track.values);
      sInv.copy(s.quaternion).invert(); tRest.copy(t.quaternion);
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i);
        q.copy(tRest.clone().multiply(sInv).multiply(q)).normalize().toArray(values, i);
      }
      tracks.push(new QuaternionKeyframeTrack(track.name, Float32Array.from(track.times), values));
    } else if (property === 'position' && (boneName === 'pelvis' || boneName === 'root')) {
      const values = Float32Array.from(track.values);
      for (let i = 0; i < values.length; i += 3) {
        values[i] = t.position.x + values[i] - s.position.x;
        values[i + 1] = t.position.y + values[i + 1] - s.position.y;
        values[i + 2] = t.position.z + values[i + 2] - s.position.z;
      }
      tracks.push(new VectorKeyframeTrack(track.name, Float32Array.from(track.times), values));
    }
  }
  return new AnimationClip(name, clip.duration, tracks);
}

/** Resamples every track at `fps` between t0 and t1 (clip time), re-based to start at zero. */
export function resampleClip(clip, { t0 = 0, t1 = clip.duration, fps = 30, name = clip.name } = {}) {
  const frames = Math.max(2, Math.round((t1 - t0) * fps) + 1);
  const times = Float32Array.from({ length: frames }, (_, i) => Math.min(t1 - t0, i / fps));
  const tracks = clip.tracks.map(track => {
    const size = track.getValueSize();
    const interpolant = track.createInterpolant(new Float32Array(size));
    const values = new Float32Array(frames * size);
    for (let i = 0; i < frames; i++) values.set(interpolant.evaluate(t0 + times[i]), i * size);
    const Ctor = track.constructor;
    const out = new Ctor(track.name, times, values);
    if (out instanceof QuaternionKeyframeTrack) fixHemisphere(out.values);
    return out;
  });
  return new AnimationClip(name, t1 - t0, tracks);
}

function fixHemisphere(values) {
  for (let i = 4; i < values.length; i += 4) {
    const dot = values[i - 4] * values[i] + values[i - 3] * values[i + 1] + values[i - 2] * values[i + 2] + values[i - 1] * values[i + 3];
    if (dot < 0) for (let k = 0; k < 4; k++) values[i + k] = -values[i + k];
  }
}

/**
 * Makes a loop seamless by spreading the end-to-start mismatch of every track over the clip,
 * `q'(t) = slerp(I, q(0) q(T)^-1, w(t)) q(t)` with w a smoothstep over the last `blend` seconds.
 * Small mismatches (authored loops) become invisible; nothing else moves.
 */
export function closeLoop(clip, blend = 0.35) {
  const T = clip.duration, start = Math.max(0, T - blend);
  const ident = new Quaternion(), corr = new Quaternion(), a = new Quaternion(), b = new Quaternion(), cur = new Quaternion();
  for (const track of clip.tracks) {
    const n = track.times.length;
    if (n < 2) continue;
    if (track instanceof QuaternionKeyframeTrack) {
      a.fromArray(track.values, 0); b.fromArray(track.values, (n - 1) * 4);
      const delta = a.clone().multiply(b.clone().invert());
      for (let i = 0; i < n; i++) {
        const t = track.times[i];
        if (t < start) continue;
        const u = Math.min(1, (t - start) / Math.max(1e-6, T - start));
        const w = u * u * (3 - 2 * u);
        corr.copy(ident).slerp(delta, w);
        cur.fromArray(track.values, i * 4).premultiply(corr).normalize().toArray(track.values, i * 4);
      }
      fixHemisphere(track.values);
    } else {
      const size = track.getValueSize();
      for (let i = 0; i < n; i++) {
        const t = track.times[i];
        if (t < start) continue;
        const u = Math.min(1, (t - start) / Math.max(1e-6, T - start));
        const w = u * u * (3 - 2 * u);
        for (let k = 0; k < size; k++) {
          const first = track.values[k], last = track.values[(n - 1) * size + k];
          track.values[i * size + k] += (first - last) * w;
        }
      }
    }
  }
  return clip;
}

const tmpQ = new Quaternion(), tmpV = new Vector3();
/** World yaw (radians) of the pelvis forward axis at `time`. */
export function pelvisYawAt(scene, mixer, time, forwardAxis = new Vector3(0, 0, 1)) {
  mixer.setTime(time); scene.updateMatrixWorld(true);
  const pelvis = scene.getObjectByName('pelvis');
  // Forward from the hip line: left hip minus right hip, crossed with up.
  const l = scene.getObjectByName('thigh_l').getWorldPosition(new Vector3());
  const r = scene.getObjectByName('thigh_r').getWorldPosition(new Vector3());
  const fwd = l.sub(r).cross(new Vector3(0, 1, 0)).setY(0);
  if (fwd.lengthSq() < 1e-8) { pelvis.getWorldQuaternion(tmpQ); tmpV.copy(forwardAxis).applyQuaternion(tmpQ); return Math.atan2(tmpV.x, tmpV.z); }
  return Math.atan2(fwd.x, fwd.z);
}

/**
 * Rotates the whole body about the world vertical by `angle(t)` (radians) through the pelvis
 * track: the root-level adjustment used to aim a kick forward or to cancel a spin's leftover yaw.
 */
export function rotateBodyYaw(clip, scene, angleAt) {
  const pelvis = scene.getObjectByName('pelvis');
  scene.updateMatrixWorld(true);
  const parentWorld = pelvis.parent.getWorldQuaternion(new Quaternion());
  const parentInv = parentWorld.clone().invert();
  const yaw = new Quaternion(), up = new Vector3(0, 1, 0), local = new Quaternion();
  for (const track of clip.tracks) {
    if (track.name === 'pelvis.quaternion') {
      for (let i = 0; i < track.times.length; i++) {
        yaw.setFromAxisAngle(up, angleAt(track.times[i]));
        local.fromArray(track.values, i * 4);
        // world' = yaw * parent * local  ->  local' = parent^-1 * yaw * parent * local
        parentInv.clone().multiply(yaw).multiply(parentWorld).multiply(local).normalize().toArray(track.values, i * 4);
      }
      fixHemisphere(track.values);
    } else if (track.name === 'pelvis.position') {
      const p = new Vector3();
      for (let i = 0; i < track.times.length; i++) {
        yaw.setFromAxisAngle(up, angleAt(track.times[i]));
        p.fromArray(track.values, i * 3);
        pelvis.parent.localToWorld(p); p.applyQuaternion(yaw); pelvis.parent.worldToLocal(p);
        p.toArray(track.values, i * 3);
      }
    }
  }
  return clip;
}

/** Pins the pelvis over the origin horizontally (keeps height): an in-place loop or strike. */
export function lockPelvisHorizontal(clip, scene) {
  const pelvis = scene.getObjectByName('pelvis');
  const rest = pelvis.position.clone();
  const track = clip.tracks.find(t => t.name === 'pelvis.position');
  if (!track) return clip;
  scene.updateMatrixWorld(true);
  const restWorld = pelvis.parent.localToWorld(rest.clone());
  const p = new Vector3();
  for (let i = 0; i < track.times.length; i++) {
    p.fromArray(track.values, i * 3); pelvis.parent.localToWorld(p);
    p.x = restWorld.x; p.z = restWorld.z;
    pelvis.parent.worldToLocal(p); p.toArray(track.values, i * 3);
  }
  return clip;
}

/**
 * Samples joint world positions over a clip on the target scene.
 * Returns { times, joints: Map(name -> Float32Array xyz per sample) }.
 */
export function sampleJoints(scene, clip, names, fps = 60) {
  const mixer = new AnimationMixer(scene);
  mixer.clipAction(clip).play();
  const n = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = Float32Array.from({ length: n }, (_, i) => Math.min(clip.duration - 1e-4, i / fps));
  const joints = new Map(names.map(name => [name, new Float32Array(n * 3)]));
  const objects = names.map(name => scene.getObjectByName(name));
  const v = new Vector3();
  for (let i = 0; i < n; i++) {
    mixer.setTime(times[i]); scene.updateMatrixWorld(true);
    objects.forEach((o, k) => { o.getWorldPosition(v); v.toArray(joints.get(names[k]), i * 3); });
  }
  mixer.stopAllAction(); mixer.uncacheRoot(scene);
  return { times, joints };
}

/**
 * Ground speed of an in-place locomotion loop: the planted foot slides backwards under the body at
 * the speed the body would travel. Median over frames where the lower foot is near its floor.
 * Also returns plant times (normalised) per foot, for footstep events and phase sync.
 */
export function measureLocomotion(scene, clip, forward = new Vector3(0, 0, 1)) {
  // The ball of the foot is what touches down in every gait, toe-running sprints included.
  const { times, joints } = sampleJoints(scene, clip, ['pelvis', 'ball_l', 'ball_r'], 60);
  const n = times.length;
  const P = joints.get('pelvis');
  const heightOf = (name, i) => joints.get(name.replace('foot_', 'ball_'))[i * 3 + 1];
  // Horizontal foot position relative to the pelvis along the travel axis: robust to clips that
  // carry root motion in the hips as well as to in-place clips.
  const along = (name, i) => { const J = joints.get(name.replace('foot_', 'ball_')); return (J[i * 3] - P[i * 3]) * forward.x + (J[i * 3 + 2] - P[i * 3 + 2]) * forward.z; };
  let floor = Infinity;
  for (let i = 0; i < n; i++) floor = Math.min(floor, heightOf('foot_l', i), heightOf('foot_r', i));
  const speeds = [];
  const contact = { l: [], r: [] };
  const threshold = 0.035;
  for (let i = 0; i < n - 1; i++) {
    const dt = times[i + 1] - times[i];
    for (const side of ['l', 'r']) contact[side].push(heightOf(`foot_${side}`, i) < floor + threshold);
    const lower = heightOf('foot_l', i) < heightOf('foot_r', i) ? 'foot_l' : 'foot_r';
    if (heightOf(lower, i) > floor + threshold) continue;
    speeds.push(-(along(lower, i + 1) - along(lower, i)) / dt);
  }
  speeds.sort((x, y) => x - y);
  // Trim the noisy ends of stance (touch-down and toe-off) before taking the middle.
  const trimmed = speeds.slice(Math.floor(speeds.length * 0.2), Math.ceil(speeds.length * 0.8));
  const mean = trimmed.length ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length : 0;
  const plants = side => {
    const c = contact[side], out = [];
    for (let i = 1; i < c.length; i++) if (c[i] && !c[i - 1]) out.push(+(times[i] / clip.duration).toFixed(3));
    return out;
  };
  return { groundSpeed: +Math.max(0, mean).toFixed(3), plants: { l: plants('l'), r: plants('r') } };
}

/**
 * Root yaw extraction: removes the body's turning from the pelvis (relative to t=0) and returns it
 * as a curve, so the game turns the character itself while the clip plays. The authored motion is
 * unchanged on screen; the controller's facing simply follows the body instead of snapping back.
 */
export function extractRootYaw(clip, scene, fps = 30) {
  const mixer = new AnimationMixer(scene); mixer.clipAction(clip).play();
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
  const yaw = [];
  let prev = null, unwrapped = 0;
  for (let i = 0; i < frames; i++) {
    const t = Math.min(clip.duration - 1e-4, i / fps);
    const a = pelvisYawAt(scene, mixer, t);
    if (prev === null) { prev = a; yaw.push(0); continue; }
    unwrapped += Math.atan2(Math.sin(a - prev), Math.cos(a - prev)); prev = a;
    yaw.push(unwrapped);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(scene);
  const at = t => { const f = Math.max(0, Math.min(frames - 1, t * fps)); const i = Math.floor(f), u = f - i; return yaw[i] + ((yaw[Math.min(frames - 1, i + 1)] ?? yaw[i]) - yaw[i]) * u; };
  rotateBodyYaw(clip, scene, t => -at(t));
  return { fps, yawDeg: yaw.map(v => +(v * 180 / Math.PI).toFixed(2)) };
}

/**
 * Strike timing: normalised time at which `effector` is furthest from the pelvis horizontally
 * (and, for kicks, high), i.e. the frame a hit should land on. Also reports the reach.
 */
export function measureStrike(scene, clip, effector) {
  const { times, joints } = sampleJoints(scene, clip, ['pelvis', effector], 60);
  let best = 0, bestI = 0;
  for (let i = 0; i < times.length; i++) {
    const p = joints.get('pelvis'), e = joints.get(effector);
    const dx = e[i * 3] - p[i * 3], dz = e[i * 3 + 2] - p[i * 3 + 2], dy = e[i * 3 + 1];
    const score = Math.hypot(dx, dz) + Math.max(0, dy - 0.5) * 0.5;
    if (score > best) { best = score; bestI = i; }
  }
  const p = joints.get('pelvis'), e = joints.get(effector);
  return { hit: +(times[bestI] / clip.duration).toFixed(3), reach: +best.toFixed(3), height: +e[bestI * 3 + 1].toFixed(3),
    direction: Math.atan2(e[bestI * 3] - p[bestI * 3], e[bestI * 3 + 2] - p[bestI * 3 + 2]) };
}

/** Writes a three.js clip into a glTF-Transform document, targeting nodes by name. */
export function addClipToDocument(document, clip, nodesByName, buffer) {
  const animation = document.createAnimation(clip.name);
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const node = nodesByName.get(track.name.slice(0, dot));
    const property = track.name.slice(dot + 1);
    if (!node) continue;
    const path = property === 'quaternion' ? AnimationChannel.TargetPath.ROTATION
      : property === 'position' ? AnimationChannel.TargetPath.TRANSLATION : null;
    if (!path) continue;
    const input = document.createAccessor(`${clip.name}:${node.getName()}:t`).setArray(Float32Array.from(track.times)).setBuffer(buffer);
    const output = document.createAccessor(`${clip.name}:${node.getName()}:${property}`)
      .setArray(Float32Array.from(track.values)).setType(path === AnimationChannel.TargetPath.ROTATION ? Accessor.Type.VEC4 : Accessor.Type.VEC3).setBuffer(buffer);
    const sampler = document.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(AnimationSampler.Interpolation.LINEAR);
    animation.addSampler(sampler).addChannel(document.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
  }
  return animation;
}

/** Drops quaternion tracks that never move (within ~0.05 degrees) to a single key. */
export function stripStaticTracks(clip) {
  const q0 = new Quaternion(), q = new Quaternion();
  clip.tracks = clip.tracks.map(track => {
    if (!(track instanceof QuaternionKeyframeTrack) || track.times.length < 3) return track;
    q0.fromArray(track.values, 0);
    let moving = false;
    for (let i = 1; i < track.times.length && !moving; i++) { q.fromArray(track.values, i * 4); if (q0.angleTo(q) > 0.001) moving = true; }
    if (moving) return track;
    return new QuaternionKeyframeTrack(track.name, [0, clip.duration], [...track.values.slice(0, 4), ...track.values.slice(0, 4)]);
  });
  return clip;
}

/**
 * Floor calibration: shifts the pelvis track vertically by a constant so the feet's contact frames
 * rest on the floor (ball 1.5 cm, ankle 7.5 cm above the soles, as in the rig's rest pose). The
 * authored vertical motion — crouches, hops, jumps — is untouched; only the static float or sink
 * a cross-rig retarget can leave behind is removed. `window` limits the frames considered.
 */
export function calibrateFloor(clip, scene, { window = [0, 1], ballRest = 0.015, ankleRest = 0.075, percentile = 0.1 } = {}) {
  const { times, joints } = sampleJoints(scene, clip, ['ball_l', 'ball_r', 'foot_l', 'foot_r'], 30);
  const lows = [];
  for (let i = 0; i < times.length; i++) {
    const u = times[i] / Math.max(1e-6, clip.duration);
    if (u < window[0] || u > window[1]) continue;
    const c = Math.min(
      joints.get('ball_l')[i * 3 + 1] - ballRest, joints.get('ball_r')[i * 3 + 1] - ballRest,
      joints.get('foot_l')[i * 3 + 1] - ankleRest, joints.get('foot_r')[i * 3 + 1] - ankleRest,
    );
    lows.push(c);
  }
  if (!lows.length) return 0;
  lows.sort((a, b) => a - b);
  const offset = lows[Math.min(lows.length - 1, Math.floor(lows.length * percentile))];
  const track = clip.tracks.find(t => t.name === 'pelvis.position');
  const pelvis = scene.getObjectByName('pelvis');
  if (!track || !pelvis || Math.abs(offset) < 1e-4) return offset;
  scene.updateMatrixWorld(true);
  const p = new Vector3();
  for (let i = 0; i < track.times.length; i++) {
    p.fromArray(track.values, i * 3); pelvis.parent.localToWorld(p);
    p.y -= offset;
    pelvis.parent.worldToLocal(p); p.toArray(track.values, i * 3);
  }
  return offset;
}
