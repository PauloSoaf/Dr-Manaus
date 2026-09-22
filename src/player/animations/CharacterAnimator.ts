import { AnimationAction, AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, NumberKeyframeTrack, Object3D, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three/webgpu';
import type { AnimationUpdateParams } from './AnimationController';
import type { CombatMove } from './types';

export const CHARACTER_CLIPS = {
  idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', jumpStart: 'Jump_Start',
  airborne: 'Jump_Loop', land: 'Jump_Land', doubleJump: 'NinjaJump_Idle_Loop', dodge: 'Roll',
  punch: 'Punch_Jab', punchCross: 'Punch_Cross', hook: 'Melee_Hook', hookRecovery: 'Melee_Hook_Rec',
  kickLeft: 'Kick_Left', kickRight: 'Kick_Right',
  meteor: 'OverhandThrow', aim: 'Idle_FoldArms_Loop', hitA: 'Hit_Chest', hitB: 'Hit_Head',
} as const;

const UPPER = new Set(['pelvis', 'spine01', 'spine02', 'spine03', 'neck01', 'head', 'claviclel', 'upperarml', 'lowerarml', 'handl', 'clavicler', 'upperarmr', 'lowerarmr', 'handr']);
const plain = (name: string) => name.replace(/[.\s_-]/g, '').toLowerCase();
const trackNode = (trackName: string) => plain(trackName.slice(0, trackName.lastIndexOf('.')));

/** Keeps rotations, removes redundant per-bone translations, and neutralizes root X/Z motion. */
export function cleanCharacterClip(source: AnimationClip, upperOnly = false): AnimationClip {
  const tracks = source.tracks.flatMap(track => {
    const property = track.name.slice(track.name.lastIndexOf('.') + 1);
    const node = trackNode(track.name);
    if (upperOnly && !UPPER.has(node)) return [];
    if (property === 'position' && node !== 'root' && node !== 'pelvis') return [];
    const copy = track.clone();
    if (property === 'position' && node === 'root' && copy instanceof VectorKeyframeTrack) {
      const values = copy.values;
      const x = values[0], z = values[2];
      for (let index = 0; index < values.length; index += 3) { values[index] = x; values[index + 2] = z; }
    }
    return [copy as VectorKeyframeTrack | QuaternionKeyframeTrack | NumberKeyframeTrack];
  });
  return new AnimationClip(`${source.name}${upperOnly ? '::upper' : ''}`, source.duration, tracks);
}

const MOVE_CLIP: Record<string, string> = {
  punch: CHARACTER_CLIPS.punch, flyingPunch: CHARACTER_CLIPS.punch,
  punchCross: CHARACTER_CLIPS.punchCross, kineticStrike: CHARACTER_CLIPS.hook,
  punchUpper: CHARACTER_CLIPS.hook, meteorPunch: CHARACTER_CLIPS.meteor,
  kick: CHARACTER_CLIPS.kickLeft, flyingKick: CHARACTER_CLIPS.kickRight,
  kickSide: CHARACTER_CLIPS.kickRight,
};

export class CharacterAnimator {
  private readonly mixer: AnimationMixer;
  private readonly clips = new Map<string, AnimationClip>();
  private current?: AnimationAction;
  private currentName = '';
  private desiredBase: string = CHARACTER_CLIPS.idle;
  private moveId = '';
  private oneShot?: AnimationAction;
  private wasGrounded?: boolean;
  private wasDoubleJumping = false;
  private readonly onFinished = (event: { action: AnimationAction }): void => {
    if (event.action !== this.oneShot) return;
    this.oneShot = undefined;
    if (!this.moveId) this.playLoop(this.desiredBase, 0.12);
  };

  constructor(root: Object3D, sourceClips: readonly AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    for (const source of sourceClips) {
      this.clips.set(source.name, cleanCharacterClip(source));
      this.clips.set(`${source.name}::upper`, cleanCharacterClip(source, true));
    }
    this.mixer.addEventListener('finished', this.onFinished);
    this.playLoop(CHARACTER_CLIPS.idle, 0);
  }

  private action(name: string): AnimationAction {
    const clip = this.clips.get(name);
    if (!clip) throw new Error(`Character animation clip not found: ${name}`);
    return this.mixer.clipAction(clip);
  }

  private prepare(action: AnimationAction, reset: boolean): AnimationAction {
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    if (reset) action.reset();
    action.play();
    return action;
  }

  private transition(to: AnimationAction, name: string, duration: number): void {
    const from = this.current;
    if (from === to && this.currentName === name) return;
    if (from) {
      this.prepare(from, false);
      this.prepare(to, true);
      from.crossFadeTo(to, duration, false);
    } else {
      this.prepare(to, true);
    }
    this.current = to;
    this.currentName = name;
  }

  playLoop(name: string, fade = 0.18, timeScale = 1): void {
    const action = this.action(name);
    action.setLoop(LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    this.transition(action, name, fade);
    action.setEffectiveTimeScale(timeScale);
  }

  playOnce(name: string, duration?: number, upperOnly = false): void {
    const key = `${name}${upperOnly ? '::upper' : ''}`;
    const action = this.action(key);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    this.transition(action, key, 0.08);
    if (duration !== undefined) action.setDuration(Math.max(0.08, duration));
    this.oneShot = action;
  }

  update(dt: number, params: AnimationUpdateParams, move: CombatMove | null, doubleJumping: boolean): void {
    this.desiredBase = params.powerPoseName === 'energy' ? CHARACTER_CLIPS.aim
      : params.flying ? (params.speed < 4 ? CHARACTER_CLIPS.aim : CHARACTER_CLIPS.idle)
      : !params.grounded ? CHARACTER_CLIPS.airborne
      : params.speed > 16 ? CHARACTER_CLIPS.sprint
      : params.speed > 8 ? CHARACTER_CLIPS.run
      : params.speed > 0.4 ? CHARACTER_CLIPS.walk
      : CHARACTER_CLIPS.idle;

    const startedJump = this.wasGrounded === true && !params.grounded && !params.flying;
    const landed = this.wasGrounded === false && params.grounded && !params.flying;
    const startedDoubleJump = doubleJumping && !this.wasDoubleJumping;
    this.wasGrounded = params.grounded;
    this.wasDoubleJumping = doubleJumping;

    if (move && move.id !== this.moveId) {
      this.moveId = move.id;
      this.playOnce(MOVE_CLIP[move.id] ?? CHARACTER_CLIPS.punch, move.startup + move.active + move.recovery, params.flying && move.boneMask === 'UPPER_BODY');
    } else if (!move && this.moveId) {
      this.moveId = '';
      if (!this.oneShot) this.playLoop(this.desiredBase, 0.14);
    } else if (!move && startedDoubleJump) {
      this.playOnce(CHARACTER_CLIPS.doubleJump, 0.44);
    } else if (!move && landed) {
      this.playOnce(CHARACTER_CLIPS.land);
    } else if (!move && startedJump) {
      this.playOnce(CHARACTER_CLIPS.jumpStart);
    } else if (!move && !this.oneShot && this.currentName !== this.desiredBase) {
      this.playLoop(this.desiredBase, this.currentName === CHARACTER_CLIPS.walk || this.desiredBase === CHARACTER_CLIPS.walk ? 0.17 : 0.2);
    }

    if (!move && !this.oneShot && this.current) {
      const pace = this.desiredBase === CHARACTER_CLIPS.walk ? Math.max(0.65, Math.min(1.45, params.speed / 4))
        : this.desiredBase === CHARACTER_CLIPS.run ? Math.max(0.8, Math.min(1.8, params.speed / 11))
        : this.desiredBase === CHARACTER_CLIPS.sprint ? Math.max(0.85, Math.min(1.7, params.speed / 18)) : 1;
      this.current.setEffectiveTimeScale(pace);
    }
    this.mixer.update(dt);
  }

  preview(name: string): void { this.moveId = ''; this.oneShot = undefined; this.desiredBase = name; this.playLoop(name, 0.12); }
  set paused(paused: boolean) { this.mixer.timeScale = paused ? 0 : Math.max(0.01, this.previewSpeed); }
  set speed(speed: number) { this.previewSpeed = Math.max(0.01, speed); if (this.mixer.timeScale > 0) this.mixer.timeScale = this.previewSpeed; }
  seek(normalized: number): void {
    if (!this.current) return;
    this.current.time = Math.max(0, Math.min(1, normalized)) * this.current.getClip().duration;
    this.mixer.update(0);
  }
  private previewSpeed = 1;
  get debugState(): { clip: string; time: number; duration: number } {
    return { clip: this.currentName, time: this.current?.time ?? 0, duration: this.current?.getClip().duration ?? 0 };
  }
  dispose(): void { this.mixer.removeEventListener('finished', this.onFinished); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.mixer.getRoot()); }
}
