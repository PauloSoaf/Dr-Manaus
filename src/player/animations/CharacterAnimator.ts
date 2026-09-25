import { AnimationAction, AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, NumberKeyframeTrack, Object3D, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three/webgpu';
import type { AnimationUpdateParams, DodgePose } from './AnimationController';
import type { CombatMove } from './types';
import type { FlipPhase } from './FlipMotion';
import { DODGE } from '../movement/DodgeSystem';

export const CHARACTER_CLIPS = {
  idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', jumpStart: 'Jump_Start',
  airborne: 'Jump_Loop', land: 'Jump_Land', doubleJump: 'NinjaJump_Idle_Loop', dodge: 'Roll',
  punch: 'Punch_Jab', punchCross: 'Punch_Cross', hook: 'Melee_Hook', hookRecovery: 'Melee_Hook_Rec',
  meteor: 'OverhandThrow', aim: 'Idle_FoldArms_Loop', hitA: 'Hit_Chest', hitB: 'Hit_Head',
  /**
   * Hovering at rest: arms folded, weight settled — a hero looking at the city rather than
   * swimming through it. This is the character's own authored rest pose. The rig ships no
   * hands-behind-the-back parade rest, and solving one procedurally mangled the shoulders.
   */
  hoverRest: 'Idle_FoldArms_Loop', hoverCruise: 'Idle_Loop',
  /** The somersault in two halves: the launch and tuck, then the opening out. */
  flipLaunch: 'NinjaJump_Start', flipRecover: 'NinjaJump_Land',
  /** Evades. The ground roll is authored; the air dash borrows the committed slide pose. */
  airDash: 'Slide_Loop',
} as const;

/**
 * Hover rest engages below `enter` and only lets go above `exit`. Without the gap the pose
 * flickers every time a gust of input crosses a single threshold.
 */
export const HOVER_REST = { enter: 8, exit: 13 } as const;

const UPPER = new Set(['pelvis', 'spine01', 'spine02', 'spine03', 'neck01', 'head', 'claviclel', 'upperarml', 'lowerarml', 'handl', 'clavicler', 'upperarmr', 'lowerarmr', 'handr']);
/**
 * `Kick_Left` and `Kick_Right` are unusable and the game does not reference them.
 *
 * Sampled straight out of the GLB and run through forward kinematics: they fold the knee about
 * an axis 0.001 and 0.006 off the sideways hinge (every other clip scores 0.29 to 1.0), and the
 * foot never travels forward at all — `Kick_Left` reaches 0.02 forward against 0.50 backward, and
 * neither ever lifts the foot above the hip. They are not kicks, and stripping the shin channel
 * only turned a folding knee into a straight leg swinging backwards.
 *
 * Until the character ships a real kick, the kick moves borrow authored strikes that do not
 * deform. This is a placeholder, not a fix.
 */
const NO_KICK_CLIP = /^Kick_/;
const plain = (name: string) => name.replace(/[.\s_-]/g, '').toLowerCase();
const trackNode = (trackName: string) => plain(trackName.slice(0, trackName.lastIndexOf('.')));

/**
 * Keeps rotations, removes redundant per-bone translations, and neutralizes root X/Z motion.
 * `dropRotation` suppresses named bones' rotation entirely, which is how a clip with one bad
 * channel is salvaged without hand-animating a replacement.
 */
export function cleanCharacterClip(source: AnimationClip, upperOnly = false, dropRotation?: ReadonlySet<string>): AnimationClip {
  const tracks = source.tracks.flatMap(track => {
    const property = track.name.slice(track.name.lastIndexOf('.') + 1);
    const node = trackNode(track.name);
    if (upperOnly && !UPPER.has(node)) return [];
    if (dropRotation?.has(node) && property === 'quaternion') return [];
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
  kick: CHARACTER_CLIPS.hook, flyingKick: CHARACTER_CLIPS.hook,
  kickSide: CHARACTER_CLIPS.punchCross,
};
/** Exported so a test can hold the line: no move may point at a clip that breaks the body. */
export const MOVE_CLIPS: Readonly<Record<string, string>> = MOVE_CLIP;
export const REJECTED_CLIP = NO_KICK_CLIP;

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
  private hoverRest = false;
  private lastDodge: DodgePose = null;
  private lastFlipPhase: FlipPhase = 'recovery';
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

  update(dt: number, params: AnimationUpdateParams, move: CombatMove | null, doubleJumping: boolean, flipPhase: FlipPhase = 'recovery'): void {
    // Hovering settles into the rest pose with hysteresis, measured on the full 3D speed so that
    // rising straight up still counts as hovering.
    if (params.flying) {
      const airSpeed = Math.hypot(params.speed, params.verticalSpeed);
      if (this.hoverRest ? airSpeed > HOVER_REST.exit : airSpeed < HOVER_REST.enter) this.hoverRest = !this.hoverRest;
    } else {
      this.hoverRest = false;
    }

    this.desiredBase = params.powerPoseName === 'energy' ? CHARACTER_CLIPS.aim
      : params.flying ? (this.hoverRest ? CHARACTER_CLIPS.hoverRest : CHARACTER_CLIPS.hoverCruise)
      : !params.grounded ? CHARACTER_CLIPS.airborne
      : params.speed > 16 ? CHARACTER_CLIPS.sprint
      : params.speed > 8 ? CHARACTER_CLIPS.run
      : params.speed > 0.4 ? CHARACTER_CLIPS.walk
      : CHARACTER_CLIPS.idle;

    const startedJump = this.wasGrounded === true && !params.grounded && !params.flying;
    const landed = this.wasGrounded === false && params.grounded && !params.flying;
    const startedDoubleJump = doubleJumping && !this.wasDoubleJumping;
    const dodge = params.dodge ?? null;
    const startedDodge = dodge !== null && this.lastDodge !== dodge;
    // The flip opens out halfway through, which is a different clip from the launch.
    const openedOut = doubleJumping && flipPhase === 'untuck' && this.lastFlipPhase !== 'untuck';
    this.wasGrounded = params.grounded;
    this.wasDoubleJumping = doubleJumping;
    this.lastDodge = dodge;
    this.lastFlipPhase = doubleJumping ? flipPhase : 'recovery';

    if (startedDodge) {
      this.moveId = '';
      this.playOnce(
        dodge === 'roll' ? CHARACTER_CLIPS.dodge : CHARACTER_CLIPS.airDash,
        dodge === 'roll' ? DODGE.roll.duration : DODGE.dash.duration,
      );
    } else if (move && move.id !== this.moveId) {
      this.moveId = move.id;
      this.playOnce(MOVE_CLIP[move.id] ?? CHARACTER_CLIPS.punch, move.startup + move.active + move.recovery, params.flying && move.boneMask === 'UPPER_BODY');
    } else if (!move && this.moveId) {
      this.moveId = '';
      if (!this.oneShot) this.playLoop(this.desiredBase, 0.14);
    } else if (!move && startedDoubleJump) {
      this.playOnce(CHARACTER_CLIPS.flipLaunch, 0.42);
    } else if (!move && openedOut) {
      this.playOnce(CHARACTER_CLIPS.flipRecover, 0.34);
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
