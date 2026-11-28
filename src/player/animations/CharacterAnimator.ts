import { AnimationClip, NumberKeyframeTrack, Object3D, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three/webgpu';
import type { AnimationUpdateParams, DodgePose } from './AnimationController';
import type { CombatMove, LandingTier } from './types';
import type { FlipPhase } from './FlipMotion';
import { DODGE } from '../movement/DodgeSystem';
import { AnimationGraph, Priority, type ActionHandle, type ActionOptions, type DirectionalSet, type GaitSet } from './graph/AnimationGraph';

/**
 * The hero's animation policy on top of the shared AnimationGraph: which authored clip plays,
 * when, on which layer, at what rate. Locomotion is stride-matched (the feet stay planted because
 * each gait plays at the speed the body really moves), strikes and casts overlay the upper body
 * while the legs keep running, and one-shots carry gameplay priorities.
 *
 * Every pose is an authored or motion-captured clip retargeted onto the 65-bone rig by
 * `scripts/assets/build-character-animations.mjs`; this file never writes a bone.
 */
export const CHARACTER_CLIPS = {
  idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', jumpStart: 'Jump_Start',
  airborne: 'Jump_Loop', land: 'Jump_Land', doubleJump: 'NinjaJump_Idle_Loop', dodge: 'Roll',
  punch: 'Punch_Jab', punchCross: 'Punch_Cross', hook: 'Melee_Hook', hookRecovery: 'Melee_Hook_Rec',
  meteor: 'OverhandThrow', aim: 'Cast_Loop', hitA: 'Hit_Chest', hitB: 'Hit_Head',
  /** Hovering at rest: arms folded, weight settled — the character's own authored rest pose. */
  hoverRest: 'Idle_FoldArms_Loop', hoverCruise: 'Idle_Loop',
  /** The somersault in two halves: the launch and tuck, then the opening out. */
  flipLaunch: 'NinjaJump_Start', flipRecover: 'NinjaJump_Land',
  airDash: 'Slide_Loop',
  /** Real kicks, retargeted correctly (Modular Men and CMU motion capture). */
  kickFront: 'Kick_Front_R', kickFrontLeft: 'Kick_Front_L', kickSide: 'Kick_Side_R',
  kickRoundhouse: 'Kick_Roundhouse_R', kickSpin: 'Kick_Spin_Jump', kickPush: 'Kick_Push',
  guard: 'Guard_Idle_Loop', crouchIdle: 'Crouch_Idle_Loop', crouchWalk: 'Crouch_Fwd_Loop',
  strafeLeft: 'Strafe_L_Loop', strafeRight: 'Strafe_R_Loop', runBack: 'Run_Back_Loop', runForward: 'Run_Fwd_Loop',
  dodgeLeft: 'Dodge_Left', dodgeRight: 'Dodge_Right', dodgeBack: 'Dodge_Back',
  castEnter: 'Cast_Enter', castLoop: 'Cast_Loop', castShoot: 'Cast_Shoot', castExit: 'Cast_Exit',
  powerRaise: 'Power_Raise', powerSummon: 'Power_Summon', teleportArrive: 'Teleport_Arrive',
  hitReactA: 'Hit_React_A', hitReactB: 'Hit_React_B', knockback: 'Hit_Knockback', knockout: 'Knockout_Fall', getUp: 'GetUp_Back',
  vault: 'ClimbUp_1m', sitEnter: 'Sit_Enter', sitIdle: 'Sit_Idle_Loop', sitExit: 'Sit_Exit', driving: 'Driving_Loop',
  reachRight: 'Reach_R', reachLeft: 'Reach_L', push: 'Push_Loop',
  talk: 'Talk_Loop', wave: 'Wave', nodYes: 'Nod_Yes', shakeNo: 'Shake_No',
  swimIdle: 'Swim_Idle_Loop', swimForward: 'Swim_Fwd_Loop',
} as const;

/** Hover rest engages below `enter` and only lets go above `exit`, so the pose never flickers. */
export const HOVER_REST = { enter: 8, exit: 13 } as const;

/** Legacy names of the broken kick retarget; no move may reference them. */
export const REJECTED_CLIP = /^Kick_(Left|Right)$/;

const MOVE_CLIP: Record<string, string> = {
  punch: CHARACTER_CLIPS.punch, punchCross: CHARACTER_CLIPS.punchCross, punchUpper: CHARACTER_CLIPS.hook,
  flyingPunch: CHARACTER_CLIPS.punchCross, kineticStrike: CHARACTER_CLIPS.hook, meteorPunch: CHARACTER_CLIPS.meteor,
  kick: CHARACTER_CLIPS.kickFront, kickSide: CHARACTER_CLIPS.kickSide, kickRoundhouse: CHARACTER_CLIPS.kickRoundhouse,
  kickSpin: CHARACTER_CLIPS.kickSpin, kickPush: CHARACTER_CLIPS.kickPush, flyingKick: CHARACTER_CLIPS.kickFront,
};
/** Exported so a test can hold the line: no move may point at a clip that breaks the body. */
export const MOVE_CLIPS: Readonly<Record<string, string>> = MOVE_CLIP;

const plain = (name: string) => name.replace(/[.\s_-]/g, '').toLowerCase();
const trackNode = (trackName: string) => plain(trackName.slice(0, trackName.lastIndexOf('.')));
const UPPER = new Set(['spine01', 'spine02', 'spine03', 'neck01', 'head', 'claviclel', 'upperarml', 'lowerarml', 'handl', 'clavicler', 'upperarmr', 'lowerarmr', 'handr']);

/** Kept for tools and tests: rotations only, root X/Z neutralised, optional upper-body subset. */
export function cleanCharacterClip(source: AnimationClip, upperOnly = false, dropRotation?: ReadonlySet<string>): AnimationClip {
  const tracks = source.tracks.flatMap(track => {
    const property = track.name.slice(track.name.lastIndexOf('.') + 1);
    const node = trackNode(track.name);
    if (upperOnly && !UPPER.has(node)) return [];
    if (dropRotation?.has(node) && property === 'quaternion') return [];
    if (property === 'position' && node !== 'root' && node !== 'pelvis') return [];
    const copy = track.clone();
    if (property === 'position' && node === 'root' && copy instanceof VectorKeyframeTrack) {
      const values = copy.values, x = values[0], z = values[2];
      for (let i = 0; i < values.length; i += 3) { values[i] = x; values[i + 2] = z; }
    }
    return [copy as VectorKeyframeTrack | QuaternionKeyframeTrack | NumberKeyframeTrack];
  });
  return new AnimationClip(`${source.name}${upperOnly ? '::upper' : ''}`, source.duration, tracks);
}

/** Speed bands (rig metres per second) in which each gait plays alone. Measured speeds: walk 1.0, jog 6.1, sprint 9.2. */
export const GAITS: GaitSet = {
  idle: CHARACTER_CLIPS.idle,
  gaits: [
    { name: CHARACTER_CLIPS.walk, pure: [0.55, 1.75] },
    { name: CHARACTER_CLIPS.run, pure: [4.2, 7.4] },
    { name: CHARACTER_CLIPS.sprint, pure: [8.8, 99] },
  ],
  minRate: 0.6, maxRate: 2.1,
};
export const CROUCH_GAITS: GaitSet = {
  idle: CHARACTER_CLIPS.crouchIdle,
  gaits: [{ name: CHARACTER_CLIPS.crouchWalk, pure: [0.35, 99] }],
  minRate: 0.6, maxRate: 1.9,
};
export const STRAFE_SET: DirectionalSet = {
  idle: CHARACTER_CLIPS.guard, forward: CHARACTER_CLIPS.runForward, right: CHARACTER_CLIPS.strafeRight,
  back: CHARACTER_CLIPS.runBack, left: CHARACTER_CLIPS.strafeLeft, minRate: 0.6, maxRate: 1.7,
};

/** Extra per-frame intent beyond the legacy params. */
export interface HeroIntent {
  crouch?: boolean;
  /** Combat stance: face the target and strafe instead of turning toward travel. */
  strafe?: boolean;
  /** Travel direction relative to facing (radians, 0 forward, +pi/2 right). */
  localDirection?: number;
  landingTier?: LandingTier;
  /** Sustained cast (continuous laser). */
  casting?: boolean;
}

export class CharacterAnimator {
  readonly graph: AnimationGraph;
  private moveId = '';
  private moveHandle: ActionHandle | null = null;
  private wasGrounded?: boolean;
  private wasFlying = false;
  private wasSwimming = false;
  private wasDoubleJumping = false;
  private hoverRest = false;
  private lastDodge: DodgePose = null;
  private lastFlipPhase: FlipPhase = 'recovery';
  private lastPose = '';
  private castHandle: ActionHandle | null = null;
  private override: { pose: string; rate: number } | null = null;
  private previewClip?: string;
  private previewSpeed = 1;
  private paused_ = false;
  intent: HeroIntent = {};

  constructor(root: Object3D, sourceClips: readonly AnimationClip[]) {
    this.graph = new AnimationGraph(root, sourceClips);
    this.graph.setLocomotion(GAITS, { speed: 0 });
  }

  /** Clip names this animator can play right now, including any borrowed from the library. */
  get available(): readonly string[] { return this.graph.clipNames; }

  /** Adds clips from the optional library. Existing names are kept: the character wins. */
  registerClips(clips: readonly AnimationClip[]): number { return this.graph.register(clips); }

  /** Visual scale of the skeleton in the world (character scale × player size), for stride matching. */
  set worldScale(value: number) { this.graph.worldScale = Math.max(1e-3, value); }

  /** Forces a looping base pose (seated, driving, talking) until cleared with null. */
  setBaseOverride(pose: string | null, rate = 1): void { this.override = pose ? { pose, rate } : null; }
  get baseOverride(): string | null { return this.override?.pose ?? null; }

  /** Plays any clip as an action with gameplay priority (interactions, reactions, dialogue). */
  playAction(name: string, options: ActionOptions): ActionHandle | null { return this.graph.play(name, options); }
  stopAction(handle: ActionHandle | null | undefined, fade?: number): void { this.graph.stop(handle, fade); }
  consumeRootYaw(): number { return this.graph.consumeRootYaw(); }

  /** Hit reaction scaled by severity: flinch, stagger, or knockback. */
  react(severity: 'light' | 'medium' | 'heavy'): void {
    const clip = severity === 'heavy' ? CHARACTER_CLIPS.knockback : severity === 'medium' ? CHARACTER_CLIPS.hitReactB : CHARACTER_CLIPS.hitReactA;
    this.graph.play(clip, { priority: severity === 'heavy' ? Priority.Critical : Priority.Combat, part: severity === 'light' ? 'upper' : 'full', fadeIn: 0.05, fadeOut: 0.2, tag: 'hit' });
  }

  private playMove(move: CombatMove, params: AnimationUpdateParams): void {
    const clip = MOVE_CLIP[move.id] ?? CHARACTER_CLIPS.punch;
    const total = move.startup + move.active + move.recovery;
    // Punches ride over the legs when the body is travelling or flying; kicks need the whole body.
    const upper = move.boneMask === 'UPPER_BODY' && (params.flying || params.speed > 1.2 || !params.grounded);
    this.graph.stop(this.moveHandle, 0.06);
    this.moveHandle = this.graph.play(clip, {
      priority: Priority.Combat, part: upper ? 'upper' : 'full', duration: total,
      fadeIn: 0.06, fadeOut: 0.18, rootYaw: !upper, tag: 'combat',
    });
  }

  update(dt: number, params: AnimationUpdateParams, move: CombatMove | null, doubleJumping: boolean, flipPhase: FlipPhase = 'recovery'): void {
    const graph = this.graph;
    graph.timeScale = this.paused_ ? 0 : (params.combatTimeFactor ?? 1) * this.previewSpeed;
    if (this.previewClip) { graph.setPose(this.previewClip); graph.update(dt); return; }

    // Hover rest with hysteresis, measured on the full 3D speed.
    if (params.flying) {
      const airSpeed = Math.hypot(params.speed, params.verticalSpeed);
      if (this.hoverRest ? airSpeed > HOVER_REST.exit : airSpeed < HOVER_REST.enter) this.hoverRest = !this.hoverRest;
    } else this.hoverRest = false;

    const intent = this.intent;
    const isSwimming = Boolean(params.swimming) && !params.flying;
    const swimState = params.swimmingState ?? (
      isSwimming
        ? (params.speed > 0.35 || Math.abs(params.verticalSpeed) > 0.45 ? 'SwimmingSurfaceForward' : 'SwimmingSurfaceIdle')
        : 'None'
    );
    graph.suppressFootsteps = isSwimming;

    // ---- Base layer.
    if (this.override) {
      graph.setTransition(0.3).setPose(this.override.pose, this.override.rate);
    } else if (params.flying) {
      graph.setTransition(0.35).setPose(this.hoverRest ? CHARACTER_CLIPS.hoverRest : CHARACTER_CLIPS.hoverCruise);
    } else if (isSwimming) {
      const hasExplicitSwimState = params.swimmingState !== undefined && params.swimmingState !== 'None';
      const isMovingInWater = hasExplicitSwimState
        ? (swimState === 'SwimmingSurfaceForward' || swimState === 'SwimmingDive' || swimState === 'SwimmingAscend')
        : (params.speed > 0.35 || Math.abs(params.verticalSpeed) > 0.45);
      if (isMovingInWater) {
        const swim3DSpeed = Math.hypot(params.speed, params.verticalSpeed);
        const swimRate = Math.min(1.65, Math.max(0.82, 0.78 + swim3DSpeed * 0.11));
        graph.setTransition(0.22).setPose(CHARACTER_CLIPS.swimForward, swimRate);
      } else {
        graph.setTransition(0.24).setPose(CHARACTER_CLIPS.swimIdle, 1.0);
      }
    } else if (!params.grounded) {
      graph.setTransition(0.18).setPose(CHARACTER_CLIPS.airborne);
    } else if (intent.crouch) {
      graph.setTransition(0.28).setLocomotion(CROUCH_GAITS, { speed: params.speed });
    } else if (intent.strafe && graph.has(STRAFE_SET.forward)) {
      graph.setTransition(0.22).setDirectional(STRAFE_SET, { speed: params.speed, direction: intent.localDirection ?? 0 });
    } else {
      const wadeSpeed = params.wading ? params.speed * 0.88 : params.speed;
      graph.setTransition(this.wasGrounded === false && !this.wasSwimming ? 0.12 : 0.24).setLocomotion(GAITS, { speed: wadeSpeed });
    }

    // ---- Edges.
    if (isSwimming && !this.wasSwimming) {
      graph.stopTag('jump', 0.12);
      graph.stopTag('land', 0.12);
      graph.stopTag('flip', 0.12);
    }
    const startedJump = this.wasGrounded === true && !params.grounded && !params.flying && !isSwimming && !this.wasSwimming;
    const landed = this.wasGrounded === false && !this.wasSwimming && params.grounded && !params.flying && !isSwimming;
    const tookOff = params.flying && !this.wasFlying;
    const startedDoubleJump = doubleJumping && !this.wasDoubleJumping && !isSwimming;
    const dodge = params.dodge ?? null;
    const startedDodge = dodge !== null && this.lastDodge !== dodge;
    const openedOut = doubleJumping && flipPhase === 'untuck' && this.lastFlipPhase !== 'untuck' && !isSwimming;
    const pose = params.powerPoseName ?? '';
    const poseStarted = pose !== this.lastPose && pose !== '';
    this.wasGrounded = params.grounded;
    this.wasFlying = params.flying;
    this.wasSwimming = isSwimming;
    this.wasDoubleJumping = doubleJumping;
    this.lastDodge = dodge;
    this.lastFlipPhase = doubleJumping ? flipPhase : 'recovery';
    this.lastPose = pose;

    if (startedDodge) {
      this.moveId = '';
      if (dodge === 'roll') {
        const dir = intent.strafe ? intent.localDirection ?? 0 : 0;
        const side = Math.abs(dir) > Math.PI * 0.75 ? CHARACTER_CLIPS.dodgeBack : dir > Math.PI * 0.25 ? CHARACTER_CLIPS.dodgeRight : dir < -Math.PI * 0.25 ? CHARACTER_CLIPS.dodgeLeft : CHARACTER_CLIPS.dodge;
        graph.play(side, { priority: Priority.Evade, duration: DODGE.roll.duration, fadeIn: 0.05, fadeOut: 0.18, tag: 'dodge' });
      } else {
        graph.play(CHARACTER_CLIPS.airDash, { priority: Priority.Evade, duration: DODGE.dash.duration, fadeIn: 0.05, fadeOut: 0.15, tag: 'dodge' });
      }
    } else if (move && move.id !== this.moveId) {
      this.moveId = move.id;
      this.playMove(move, params);
    } else if (!move && this.moveId) {
      this.moveId = '';
    } else if (!move && startedDoubleJump) {
      graph.play(CHARACTER_CLIPS.flipLaunch, { priority: Priority.Locomotion, duration: 0.42, fadeIn: 0.05, tag: 'flip' });
    } else if (!move && openedOut) {
      graph.play(CHARACTER_CLIPS.flipRecover, { priority: Priority.Locomotion, duration: 0.34, fadeIn: 0.06, tag: 'flip' });
    } else if (!move && landed) {
      this.playLanding(params, intent.landingTier ?? 'soft');
    } else if (!move && startedJump && pose !== 'vault') {
      // The push-off of the authored jump; the long crouch of anticipation is skipped because the
      // body already left the ground this frame.
      graph.play(CHARACTER_CLIPS.jumpStart, { priority: Priority.Locomotion, from: 0.32, to: 0.78, rate: 1.35, fadeIn: 0.05, fadeOut: 0.2, tag: 'jump' });
    } else if (!move && tookOff) {
      graph.play(CHARACTER_CLIPS.jumpStart, { priority: Priority.Flight, from: 0.3, to: 0.75, rate: 1.6, fadeIn: 0.06, fadeOut: 0.3, tag: 'takeoff' });
    }

    if (poseStarted) this.onPowerPose(pose, params);

    // Sustained cast for the continuous laser rides the upper body.
    if (intent.casting && !this.castHandle) {
      this.castHandle = graph.play(CHARACTER_CLIPS.castLoop, { priority: Priority.Combat, part: 'upper', loop: true, fadeIn: 0.15, fadeOut: 0.25, tag: 'cast' });
    } else if (!intent.casting && this.castHandle) {
      graph.stop(this.castHandle); this.castHandle = null;
    }

    graph.update(dt);
  }

  private playLanding(params: AnimationUpdateParams, tier: LandingTier): void {
    const graph = this.graph;
    if (tier === 'soft') {
      // Running landings flow straight into the stride; standing ones absorb the drop.
      if (params.speed > 3) return;
      graph.play(CHARACTER_CLIPS.land, { priority: Priority.Locomotion, from: 0, to: 0.55, rate: 1.4, fadeIn: 0.04, fadeOut: 0.2, tag: 'land' });
    } else if (tier === 'hard') {
      if (params.speed > 6) graph.play(CHARACTER_CLIPS.dodge, { priority: Priority.Locomotion, rate: 1.25, fadeIn: 0.04, fadeOut: 0.2, tag: 'land' });
      else graph.play(CHARACTER_CLIPS.land, { priority: Priority.Locomotion, rate: 1.05, fadeIn: 0.03, fadeOut: 0.25, tag: 'land' });
    } else {
      // Super and titan landings: the heavy authored landing, full length.
      graph.play(CHARACTER_CLIPS.flipRecover, { priority: Priority.Locomotion, rate: 0.9, fadeIn: 0.03, fadeOut: 0.3, tag: 'land' });
    }
  }

  private onPowerPose(pose: string, params: AnimationUpdateParams): void {
    const graph = this.graph;
    const upperIfMoving = params.flying || params.speed > 1.2 ? 'upper' as const : 'full' as const;
    switch (pose) {
      case 'energy':
        graph.play(CHARACTER_CLIPS.castShoot, { priority: Priority.Combat, part: 'upper', rate: 1.2, fadeIn: 0.05, fadeOut: 0.2, tag: 'cast' });
        break;
      case 'shockwave':
        graph.play(CHARACTER_CLIPS.powerSummon, { priority: Priority.Combat, part: upperIfMoving, from: 0.45, to: 0.75, duration: 0.7, fadeIn: 0.08, fadeOut: 0.25, tag: 'power' });
        break;
      case 'giant':
        graph.play(CHARACTER_CLIPS.powerRaise, { priority: Priority.Combat, part: upperIfMoving, duration: 1.4, fadeIn: 0.1, fadeOut: 0.3, tag: 'power' });
        break;
      case 'teleport':
        graph.play(CHARACTER_CLIPS.teleportArrive, { priority: Priority.Combat, from: 0.35, duration: 0.6, fadeIn: 0.04, fadeOut: 0.25, tag: 'power' });
        break;
      case 'vault':
        graph.play(CHARACTER_CLIPS.vault, { priority: Priority.Evade, duration: 0.55, fadeIn: 0.05, fadeOut: 0.18, tag: 'vault' });
        break;
      case 'reconstruct': case 'clone': case 'temporal':
        graph.play(CHARACTER_CLIPS.castShoot, { priority: Priority.Gesture, part: 'upper', rate: 0.9, fadeIn: 0.08, fadeOut: 0.25, tag: 'power' });
        break;
      default: break;
    }
  }

  // ---- Animation Lab support.
  preview(name: string): void { this.previewClip = name; this.graph.setTransition(0.12).setPose(name); }
  set paused(paused: boolean) { this.paused_ = paused; }
  set speed(speed: number) { this.previewSpeed = Math.max(0.01, speed); }
  seek(normalized: number): void {
    if (!this.previewClip) return;
    this.graph.seekPose(this.previewClip, normalized);
  }
  get debugState(): { clip: string; time: number; duration: number } {
    const action = this.graph.currentAction ?? this.graph.currentOverlay;
    const name = action?.name ?? this.graph.baseClip;
    return { clip: name, time: (action?.progress ?? this.graph.poseTime(name)) * this.graph.duration(name), duration: this.graph.duration(name) };
  }
  dispose(): void { this.graph.dispose(); }
}
