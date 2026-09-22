import { Euler, MathUtils, Quaternion, Vector3, type Bone } from 'three/webgpu';
import { computeFlightOrientation } from './FlightOrientation.ts';
import library from './character-clips.json' with { type: 'json' };
import { PARADE_REST } from './ParadeRest';
import { BoneMask } from './BoneMask';
import { AnimationEvents } from './AnimationEvents.ts';


const tmpHead = new Vector3();
const tmpVel = new Vector3();
const tmpEuler = new Euler();
const tmpUp = new Vector3(0, 1, 0);

import {
  BONES,
  type BoneId,
  type BoneMaskName,
  type CombatContext,
  type CombatMove,
  type DoubleJumpState,
  type FlipDirection,
  type FlightPoseName,
  type LandingTier,
  type MovePhase,
} from './types';
import { getDoubleJumpDuration } from '../physics/JumpPhysics';

export interface AnimationUpdateParams {
  speed: number;
  verticalSpeed: number;
  velocity: Vector3;
  flying: boolean;
  grounded: boolean;
  boosting: boolean;
  size: number;
  turn: number;
  powerPoseName?: string;
  combatTimeFactor?: number;
  speedMode?: string;
  forward?: Vector3;
  facingYaw?: number;
}

export interface AnimationDebugState {
  baseLayer: string;
  jumpLayer: string;
  flightLayer: string;
  combatLayer: string;
  titanLayer: string;
  currentAnimation: string;
  normalizedTime: number;
  combatMove: string;
  movePhase: MovePhase;
  boneMask: BoneMaskName;
  jumpCount: number;
  doubleJumpProgress: number;
  flipDirection: FlipDirection;
  flightAlignment: number;
  rootPitch: number;
  rootBank: number;
  velocityDir: Vector3;
}

export class AnimationController {
  readonly events = new AnimationEvents();

  // Base smoothed orientation (yaw + flight alignment)
  readonly baseOrientation = new Quaternion();
  // Final combined orientation (base + procedural flip) applied to the character group
  readonly rootOrientation = new Quaternion();
  readonly bodyOffset = new Vector3();

  // Internal layer states
  private phase = 0;
  private flightTime = 0;
  private wasFlying = false;
  private takeoffTimer = 0;
  private landingTimer = 0;
  private landingTier: LandingTier = 'soft';

  // Locomotion
  private locomotionClip = '';
  private locomotionTime = 0;
  private readonly locomotionQ1 = new Quaternion();
  private readonly locomotionQ2 = new Quaternion();

  // Jump & Double Jump
  private doubleJump: DoubleJumpState = {
    active: false,
    progress: 0,
    duration: 0.44,
    direction: 'front',
  };
  private readonly qFlip = new Quaternion();
  private readonly flipAxis = new Vector3(1, 0, 0);

  // Flight Orientation
  private flightPose: FlightPoseName = 'hover';

  // Combat
  private currentMove: CombatMove | null = null;
  private moveTimer = 0;
  private movePhase: MovePhase = 'startup';
  private posePhase = 0;
  private lastPose = '';
  private combatClip = '';
  private combatTime = 0;

  // Scratch temporaries
  private readonly previousArms = PARADE_REST.map(() => new Quaternion());
  private readonly armTarget = new Quaternion();
  private readonly tmpEuler = new Euler();
  private readonly tmpQ = new Quaternion();

  constructor() {
    this.baseOrientation.identity();
    this.rootOrientation.identity();
    this.qFlip.identity();
  }

  get isDoubleJumping(): boolean {
    return this.doubleJump.active;
  }

  get doubleJumpProgress(): number {
    return this.doubleJump.progress;
  }

  get activeCombatMove(): CombatMove | null {
    return this.currentMove;
  }

  get activeMovePhase(): MovePhase {
    return this.movePhase;
  }

  get debugState(): AnimationDebugState {
    return {
      baseLayer: this.locomotionClip || 'idle',
      jumpLayer: this.doubleJump.active ? `doubleJump (${this.doubleJump.direction})` : 'ground',
      flightLayer: this.flightPose,
      combatLayer: this.currentMove ? `${this.currentMove.id} [${this.movePhase}]` : 'none',
      titanLayer: 'normal',
      currentAnimation: this.currentMove?.animation ?? (this.locomotionClip || 'idle'),
      normalizedTime: this.currentMove
        ? (this.moveTimer / Math.max(0.001, this.currentMove.startup + this.currentMove.active + this.currentMove.recovery))
        : (this.locomotionTime % 1),
      combatMove: this.currentMove?.id ?? 'none',
      movePhase: this.movePhase,
      boneMask: this.currentMove?.boneMask ?? 'FULL_BODY',
      jumpCount: this.doubleJump.active ? 2 : 0,
      doubleJumpProgress: this.doubleJump.progress,
      flipDirection: this.doubleJump.direction,
      flightAlignment: this.debugAlignment,
      rootPitch: this.debugPitch,
      rootBank: this.debugBank,
      velocityDir: this.debugVelocityDir,
    };
  }

  // Telemetry fields for debug
  private debugAlignment = 1.0;
  private debugPitch = 0;
  private debugBank = 0;
  private readonly debugVelocityDir = new Vector3();

  triggerDoubleJump(direction: FlipDirection, size = 1): void {
    this.doubleJump.active = true;
    this.doubleJump.progress = 0;
    this.doubleJump.duration = getDoubleJumpDuration(size);
    this.doubleJump.direction = direction;

    switch (direction) {
      case 'front':
        this.flipAxis.set(1, 0, 0);
        break;
      case 'back':
        this.flipAxis.set(-1, 0, 0);
        break;
      case 'sideLeft':
        this.flipAxis.set(0, 0, -1);
        break;
      case 'sideRight':
        this.flipAxis.set(0, 0, 1);
        break;
    }

    this.events.dispatch('doubleJump.impulse');
    this.events.dispatch('doubleJump.flipStart');
  }

  triggerTakeoff(): void {
    this.takeoffTimer = 0.25;
    this.events.dispatch('takeoff.launch');
  }

  triggerLanding(tier: LandingTier): void {
    this.landingTier = tier;
    this.landingTimer = tier === 'titan' ? 0.4 : tier === 'hard' ? 0.35 : 0.2;
    this.events.dispatch('landing.contact', tier);
  }

  startCombatMove(move: CombatMove): void {
    if (this.currentMove && this.movePhase !== 'cancelWindow') {
      const totalTime = this.currentMove.startup + this.currentMove.active + this.currentMove.recovery;
      if (this.moveTimer < this.currentMove.cancelAt * totalTime) {
        return;
      }
    }
    this.currentMove = move;
    this.moveTimer = 0;
    this.movePhase = 'startup';
    this.events.reset();
    this.events.dispatch('attack.start', move.id);
  }

  cancelCombatMove(): void {
    if (this.currentMove) {
      this.currentMove = null;
      this.moveTimer = 0;
      this.movePhase = 'startup';
    }
  }

  update(bones: readonly Bone[], dt: number, params: AnimationUpdateParams): void {
    const combatFactor = params.combatTimeFactor ?? 1;
    const combatDt = dt * combatFactor;

    this.phase += dt;
    const pose = params.powerPoseName ?? '';
    if (pose !== this.lastPose) {
      this.lastPose = pose;
      this.posePhase = 0;
    }
    this.posePhase += dt;

    if (params.flying !== this.wasFlying) {
      this.flightTime = 0;
      this.wasFlying = params.flying;
      if (params.flying) this.triggerTakeoff();
    }
    this.flightTime += dt;

    if (this.takeoffTimer > 0) {
      this.takeoffTimer -= dt;
    }

    if (!params.flying) {
      this.flightPose = 'hover';
    } else if (this.takeoffTimer > 0) {
      this.flightPose = 'takeoff';
    } else if (params.speedMode === 'mega') {
      this.flightPose = 'mega';
    } else if (params.speedMode === 'super') {
      this.flightPose = 'super';
    } else if (params.speedMode === 'fast') {
      this.flightPose = 'fast';
    } else {
      this.flightPose = 'cruise';
    }

    // 1. Compute Base & Flight Orientation
    const facingYaw = params.facingYaw ?? 0;
    if (params.flying && params.velocity.lengthSq() > 1 && params.speedMode) {
      computeFlightOrientation(
        params.velocity, 
        this.baseOrientation, 
        dt, 
        params.turn, 
        params.speedMode, 
        this.baseOrientation, 
        facingYaw
      );
      // Telemetry
      tmpHead.set(0, 1, 0).applyQuaternion(this.baseOrientation);
      tmpVel.copy(params.velocity).normalize();
      this.debugAlignment = tmpHead.dot(tmpVel);
      this.debugVelocityDir.copy(tmpVel);
      this.debugBank = params.turn;
      tmpEuler.setFromQuaternion(this.baseOrientation, 'YXZ');
      this.debugPitch = tmpEuler.x;
    } else {
      // Grounded or hovering upright
      const target = this.tmpQ.setFromAxisAngle(tmpUp, facingYaw);
      this.baseOrientation.slerp(target, 1 - Math.exp(-dt * 12));
      this.debugAlignment = 1.0;
      this.debugBank = 0;
      this.debugPitch = 0;
    }

    // 2. Evaluate Jump & Double Jump (computes qFlip)
    this.updateJumpLayer(dt);

    // Combine orientations
    this.rootOrientation.copy(this.baseOrientation).multiply(this.qFlip);

    // 3. Evaluate Layers onto bones
    this.evaluateLayers(bones, dt, combatDt, params);
  }

  private updateJumpLayer(dt: number): void {
    if (this.doubleJump.active) {
      this.doubleJump.progress += dt / Math.max(0.1, this.doubleJump.duration);
      if (this.doubleJump.progress >= 1) {
        this.doubleJump.progress = 1;
        this.doubleJump.active = false;
        this.qFlip.identity(); // Strict identity: no accumulated drift
        this.events.dispatch('doubleJump.flipEnd');
      } else {
        const angle = this.doubleJump.progress * Math.PI * 2;
        this.qFlip.setFromAxisAngle(this.flipAxis, angle);
      }
    } else {
      this.qFlip.identity();
    }
  }

  private evaluateLayers(
    bones: readonly Bone[],
    dt: number,
    combatDt: number,
    params: AnimationUpdateParams
  ): void {
    const { speed, verticalSpeed, flying, boosting, turn, size } = params;
    const pose = params.powerPoseName ?? '';
    const smooth = 1 - Math.exp(-dt * 10);
    const stride = flying ? 0 : Math.min(1, speed / 5);
    const swing = Math.sin(this.phase * (speed > 8 ? 12 : 8)) * stride * 0.62;

    const body = bones[BONES.HIPS];
    const leftArm = bones[BONES.LEFT_ARM];
    const rightArm = bones[BONES.RIGHT_ARM];
    const leftLeg = bones[BONES.LEFT_LEG];
    const rightLeg = bones[BONES.RIGHT_LEG];
    const leftForearm = bones[BONES.LEFT_FOREARM];
    const rightForearm = bones[BONES.RIGHT_FOREARM];
    const leftShin = bones[BONES.LEFT_SHIN];
    const rightShin = bones[BONES.RIGHT_SHIN];
    const leftHand = bones[BONES.LEFT_HAND];
    const rightHand = bones[BONES.RIGHT_HAND];

    const flightArms = [leftArm, rightArm, leftForearm, rightForearm];
    for (let i = 0; i < 4; i++) this.previousArms[i].copy(flightArms[i].quaternion);

    for (const bone of bones) {
      bone.rotation.y *= 1 - smooth;
      bone.rotation.z *= 1 - smooth;
    }

    const bend = (bone: Bone, target: number) => {
      bone.rotation.x += (target - bone.rotation.x) * smooth;
    };

    const hasCombat = this.currentMove !== null || (pose.startsWith('punch') || pose.startsWith('kick'));
    const isUpperBodyCombat = this.currentMove ? this.currentMove.boneMask === 'UPPER_BODY' : pose.startsWith('punch');

    // ----------------------------------------------------
    // BASE LOCOMOTION / FLIGHT EVALUATION
    // ----------------------------------------------------
    if (!flying || (pose && !isUpperBodyCombat)) {
      body.rotation.x += ((flying && pose !== 'energy' ? (boosting ? -1.13 : -0.18) : 0) - body.rotation.x) * smooth;
      this.bodyOffset.set(0, flying ? Math.sin(this.phase * 2) * 0.055 : Math.abs(Math.sin(this.phase * 8)) * stride * 0.025, 0);

      leftLeg.rotation.x += ((flying ? 0 : swing) - leftLeg.rotation.x) * smooth;
      rightLeg.rotation.x += ((flying ? 0 : -swing) - rightLeg.rotation.x) * smooth;

      let left = flying ? -0.12 : -swing;
      let right = flying ? -0.12 : swing;
      if (pose === 'energy') right = Math.PI / 2;
      if (['shockwave', 'reconstruct', 'teleport'].includes(pose)) {
        left = 1.25;
        right = 1.25;
      }

      leftArm.rotation.x += (left - leftArm.rotation.x) * smooth;
      rightArm.rotation.x += (right - rightArm.rotation.x) * smooth;

      leftArm.rotation.z = flying || pose === 'giant' ? 0.23 : 0.07;
      rightArm.rotation.z = flying || pose === 'giant' ? -0.23 : -0.07;

      bend(leftForearm, flying ? -0.25 : -0.12 - Math.max(0, swing) * 0.5);
      bend(rightForearm, pose === 'energy' ? -0.07 : flying ? -0.25 : -0.12 - Math.max(0, -swing) * 0.5);
      bend(leftShin, flying ? -0.025 : Math.max(0, -swing) * 1.05);
      bend(rightShin, flying ? -0.025 : Math.max(0, swing) * 1.05);

      leftHand.rotation.x = -0.035;
      rightHand.rotation.x = pose === 'energy' ? -0.12 : -0.035;
    }

    if (flying && (!pose || isUpperBodyCombat)) {
      const takeoff = Math.max(0, 1 - this.flightTime / 0.5);
      const sway = Math.sin(this.phase * 1.6);
      this.bodyOffset.set(0, sway * 0.025 + takeoff * 0.025, 0);
    }

    // ----------------------------------------------------
    // BASE LOCOMOTION LAYER
    // ----------------------------------------------------
    const baseClipName = flying
      ? (speed > 5 ? 'swimFwd' : 'swimIdle')
      : pose === 'jump' || pose === 'vault' || pose === 'roll'
        ? pose
        : !pose && speed > 0.4 ? (speed > 8 ? 'run' : 'walk') : '';

    if (baseClipName !== this.locomotionClip) {
      this.locomotionClip = baseClipName;
      this.locomotionTime = 0;
    }
    this.locomotionTime += dt * (baseClipName === 'walk' ? Math.min(1.5, speed / 4) : baseClipName === 'run' ? Math.min(2, speed / 12) : 1);

    if (baseClipName && baseClipName in library.clips) {
      const clip = library.clips[baseClipName as keyof typeof library.clips];
      const time = baseClipName === 'vault' || baseClipName === 'roll'
        ? Math.min(this.locomotionTime, clip.duration)
        : this.locomotionTime % clip.duration;
      const frame = (time / clip.duration) * (clip.frames.length - 1);
      const index = Math.floor(frame);
      const first = clip.frames[index];
      const next = clip.frames[Math.min(index + 1, clip.frames.length - 1)];

      for (let i = 0; i < bones.length; i++) {
        this.locomotionQ1.fromArray(first, i * 4);
        this.locomotionQ2.fromArray(next, i * 4);
        bones[i].quaternion.slerp(this.locomotionQ1.slerp(this.locomotionQ2, frame - index), 1 - Math.exp(-dt * 22));
      }
    }

    // ----------------------------------------------------
    // COMBAT LAYER OVERRIDE
    // ----------------------------------------------------
    const combatClipName = pose === 'punch' || pose === 'punchCross' ? pose : '';
    if (combatClipName !== this.combatClip) {
      this.combatClip = combatClipName;
      this.combatTime = 0;
    }
    this.combatTime += dt;

    if (combatClipName && combatClipName in library.clips) {
      const clip = library.clips[combatClipName as keyof typeof library.clips];
      const time = Math.min(this.combatTime / 0.42, 1) * clip.duration;
      const frame = (time / clip.duration) * (clip.frames.length - 1);
      const index = Math.floor(frame);
      const first = clip.frames[index];
      const next = clip.frames[Math.min(index + 1, clip.frames.length - 1)];

      for (let i = 0; i < bones.length; i++) {
        if (!BoneMask.affects('UPPER_BODY', i as BoneId)) continue;
        
        this.locomotionQ1.fromArray(first, i * 4);
        this.locomotionQ2.fromArray(next, i * 4);
        bones[i].quaternion.slerp(this.locomotionQ1.slerp(this.locomotionQ2, frame - index), 1 - Math.exp(-dt * 22));
      }
    }

    // ----------------------------------------------------
    // ADVANCED COMBAT LAYER & PROCEDURAL ATTACKS
    // ----------------------------------------------------
    if (this.currentMove) {
      const move = this.currentMove;
      const totalDuration = move.startup + move.active + move.recovery;
      const prevNorm = this.moveTimer / Math.max(0.001, totalDuration);
      this.moveTimer += combatDt;
      const currNorm = Math.min(1, this.moveTimer / Math.max(0.001, totalDuration));

      this.events.evaluate(move.id, prevNorm, currNorm, move.events, false);

      if (this.moveTimer < move.startup) {
        this.movePhase = 'startup';
      } else if (this.moveTimer < move.startup + move.active) {
        this.movePhase = 'active';
      } else if (this.moveTimer < move.cancelAt * totalDuration) {
        this.movePhase = 'recovery';
      } else {
        this.movePhase = 'cancelWindow';
      }

      const extension = Math.sin(currNorm * Math.PI);
      if (move.id === 'flyingPunch' || move.id === 'kineticStrike') {
        body.rotation.x += (-extension * 0.15 - body.rotation.x) * smooth;
        body.rotation.y = -extension * 0.35;
        rightArm.rotation.set(Math.PI * 0.52 * extension + 0.1, 0, -0.1);
        rightForearm.rotation.x = 0.1 * (1 - extension);
        leftArm.rotation.set(-0.4 * extension, 0, 0.2);
      } else if (move.id === 'meteorPunch') {
        body.rotation.x += (-1.35 * extension - body.rotation.x) * smooth;
        rightArm.rotation.set(2.8 * extension, 0, 0);
        leftArm.rotation.set(2.4 * extension, 0, 0.1);
      }

      if (this.moveTimer >= totalDuration) {
        this.events.dispatch('attack.complete', move.id);
        this.currentMove = null;
        this.movePhase = 'startup';
      }
    }

    // Legacy Kicks and Uppercuts
    if (pose.startsWith('kick')) {
      const extension = Math.sin(Math.min(1, this.posePhase / 0.55) * Math.PI);
      rightLeg.rotation.x = extension * 1.65;
      rightShin.rotation.x = 0.2 * (1 - extension);
      body.rotation.x = -extension * 0.2;
      leftArm.rotation.x = 0.65;
      rightArm.rotation.x = 0.65;
      if (pose === 'kickSide') {
        body.rotation.y = extension * Math.PI / 2;
        rightLeg.rotation.set(0.12, 0, extension * 1.65);
        leftArm.rotation.x = 1.1;
      } else if (pose === 'kickRound') {
        body.rotation.y = Math.sin(Math.min(1, this.posePhase / 0.55) * Math.PI * 2) * 1.2;
        rightLeg.rotation.z = extension * 0.9;
        leftArm.rotation.z = 0.8 * extension;
      }
    }
    if (pose === 'punchUpper') {
      const extension = Math.sin(Math.min(1, this.posePhase / 0.42) * Math.PI);
      body.rotation.y = -0.35 * extension;
      body.rotation.x = -0.12 * extension;
      rightArm.rotation.set(extension * 2.1, 0, -0.15);
      rightForearm.rotation.x = 0.65 * extension;
      leftArm.rotation.x = 0.9;
      leftForearm.rotation.x = 0.65;
      leftShin.rotation.x = 0.2 * extension;
      rightShin.rotation.x = 0.25 * extension;
    }
  }
}
