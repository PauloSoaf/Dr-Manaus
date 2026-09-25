import { Euler, Quaternion, Vector3, type Bone } from 'three/webgpu';
import { computeFlightOrientation, flightModeFor, uprightBlend, type FlightMode } from './FlightOrientation.ts';
import { flipAngle, flipPhase, flipTuck, type FlipPhase } from './FlipMotion.ts';
import { AnimationEvents } from './AnimationEvents.ts';
import type { BoneMaskName, CombatMove, DoubleJumpState, FlipDirection, FlightPoseName, LandingTier, MovePhase } from './types';
import { getDoubleJumpDuration } from '../physics/JumpPhysics';

const tmpHead = new Vector3();
const tmpVelocity = new Vector3();
const tmpEuler = new Euler();
const up = new Vector3(0, 1, 0);

/** Metres of vertical sway at full rest. Small on purpose: breathing, not bobbing. */
const HOVER_SWAY = 0.045;

export type DodgePose = 'roll' | 'airDash' | null;

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
  /**
   * The speed the player is currently *asking* for, which is what tells a deliberate stop apart
   * from a lull. Without it the body cannot start righting itself until it has already stopped.
   */
  desiredSpeed?: number;
  dodge?: DodgePose;
}

export interface AnimationDebugState {
  baseLayer: string; jumpLayer: string; flightLayer: string; combatLayer: string;
  titanLayer: string; currentAnimation: string; normalizedTime: number; combatMove: string;
  movePhase: MovePhase; boneMask: BoneMaskName; jumpCount: number; doubleJumpProgress: number;
  flipDirection: FlipDirection; flightAlignment: number; rootPitch: number; rootBank: number;
  velocityDir: Vector3; flightMode: FlightMode; upright: number; flipPhase: FlipPhase; dodge: DodgePose;
}

/**
 * Gameplay animation state only. Bone poses are owned by CharacterAnimator and
 * native THREE.AnimationClips; this class never writes to skeleton transforms.
 */
export class AnimationController {
  readonly events = new AnimationEvents();
  readonly baseOrientation = new Quaternion();
  readonly rootOrientation = new Quaternion();
  readonly bodyOffset = new Vector3();
  private readonly qFlip = new Quaternion();
  private readonly flipAxis = new Vector3(1, 0, 0);
  private readonly targetYaw = new Quaternion();
  private doubleJump: DoubleJumpState = { active: false, progress: 0, duration: 0.44, direction: 'front' };
  private currentMove: CombatMove | null = null;
  private moveTimer = 0;
  private movePhase: MovePhase = 'startup';
  private locomotion = 'idle';
  private locomotionTime = 0;
  private flightPose: FlightPoseName = 'hover';
  private wasFlying = false;
  private takeoffTimer = 0;
  private landingTier: LandingTier = 'soft';
  private debugAlignment = 1;
  private debugPitch = 0;
  private debugBank = 0;
  private readonly debugVelocityDir = new Vector3();
  private flightMode: FlightMode = 'hover';
  private upright = 1;
  private restPose = 0;
  private hoverTime = 0;
  private flipPhaseName: FlipPhase = 'recovery';
  private flipTuckAmount = 0;
  private dodgePose: DodgePose = null;

  get isDoubleJumping(): boolean { return this.doubleJump.active; }
  get doubleJumpProgress(): number { return this.doubleJump.progress; }
  get activeCombatMove(): CombatMove | null { return this.currentMove; }
  get activeMovePhase(): MovePhase { return this.movePhase; }
  /** 0 is belly-down flight, 1 is standing in the air. Driven by speed *and* intent. */
  get uprightAmount(): number { return this.upright; }
  get currentFlightMode(): FlightMode { return this.flightMode; }
  get currentFlipPhase(): FlipPhase { return this.flipPhaseName; }
  /** How settled the hover is, 0 to 1. Drives both the sway and the at-ease posture. */
  get restAmount(): number { return this.restPose; }
  get flipTuckAmountNow(): number { return this.flipTuckAmount; }
  get debugState(): AnimationDebugState {
    const total = this.currentMove ? this.currentMove.startup + this.currentMove.active + this.currentMove.recovery : 1;
    return {
      baseLayer: this.locomotion,
      jumpLayer: this.doubleJump.active ? `doubleJump (${this.doubleJump.direction}·${this.flipPhaseName})` : 'ground',
      flightLayer: this.flightPose,
      combatLayer: this.currentMove ? `${this.currentMove.id} [${this.movePhase}]` : 'none',
      titanLayer: this.landingTier === 'titan' ? 'titan' : 'normal',
      currentAnimation: this.currentMove?.animation ?? this.locomotion,
      normalizedTime: this.currentMove ? Math.min(1, this.moveTimer / Math.max(0.001, total)) : this.locomotionTime % 1,
      combatMove: this.currentMove?.id ?? 'none', movePhase: this.movePhase,
      boneMask: this.currentMove?.boneMask ?? 'FULL_BODY', jumpCount: this.doubleJump.active ? 2 : 0,
      doubleJumpProgress: this.doubleJump.progress, flipDirection: this.doubleJump.direction,
      flightAlignment: this.debugAlignment, rootPitch: this.debugPitch, rootBank: this.debugBank,
      velocityDir: this.debugVelocityDir, flightMode: this.flightMode, upright: this.upright,
      flipPhase: this.flipPhaseName, dodge: this.dodgePose,
    };
  }

  triggerDoubleJump(direction: FlipDirection, size = 1): void {
    this.doubleJump = { active: true, progress: 0, duration: getDoubleJumpDuration(size), direction };
    if (direction === 'front') this.flipAxis.set(1, 0, 0);
    else if (direction === 'back') this.flipAxis.set(-1, 0, 0);
    else if (direction === 'sideLeft') this.flipAxis.set(0, 0, -1);
    else this.flipAxis.set(0, 0, 1);
    this.flipPhaseName = 'takeoff';
    this.flipTuckAmount = 0;
    this.events.dispatch('doubleJump.impulse');
    this.events.dispatch('doubleJump.flipStart');
  }
  /** Ends the flip cleanly at identity. A dash or a landing must never leave the body tilted. */
  endDoubleJump(): void {
    if (!this.doubleJump.active) return;
    this.doubleJump.active = false;
    this.doubleJump.progress = 1;
    this.flipPhaseName = 'recovery';
    this.flipTuckAmount = 0;
    this.qFlip.identity();
    this.events.dispatch('doubleJump.flipEnd');
  }
  triggerTakeoff(): void { this.takeoffTimer = 0.25; this.events.dispatch('takeoff.launch'); }
  triggerLanding(tier: LandingTier): void { this.landingTier = tier; this.events.dispatch('landing.contact', tier); }
  startCombatMove(move: CombatMove): void {
    if (this.currentMove) {
      const total = this.currentMove.startup + this.currentMove.active + this.currentMove.recovery;
      if (this.moveTimer < this.currentMove.cancelAt * total) return;
    }
    this.currentMove = move; this.moveTimer = 0; this.movePhase = 'startup';
    this.events.reset(); this.events.dispatch('attack.start', move.id);
  }
  cancelCombatMove(): void { this.currentMove = null; this.moveTimer = 0; this.movePhase = 'startup'; }

  update(_bones: readonly Bone[], dt: number, params: AnimationUpdateParams): void {
    dt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
    this.bodyOffset.set(0, 0, 0);
    this.dodgePose = params.dodge ?? null;
    if (params.flying !== this.wasFlying) {
      this.wasFlying = params.flying;
      if (params.flying) this.triggerTakeoff();
    }
    this.takeoffTimer = Math.max(0, this.takeoffTimer - dt);

    const speed = params.velocity.length();
    // Absent an explicit intent, assume the player is asking for exactly what they already have,
    // which reproduces the old behaviour rather than inventing a brake.
    const desiredSpeed = Number.isFinite(params.desiredSpeed) ? Math.max(0, params.desiredSpeed as number) : speed;
    this.upright = params.flying ? uprightBlend(speed, desiredSpeed) : 1;
    this.flightMode = params.flying ? flightModeFor(speed, desiredSpeed, params.speedMode) : 'hover';

    this.flightPose = !params.flying ? 'hover'
      : this.dodgePose === 'airDash' ? 'dash'
      : this.takeoffTimer > 0 ? 'takeoff'
      : this.flightMode === 'braking' && this.upright > 0.28 ? 'braking'
      : params.speedMode === 'mega' ? 'mega'
      : params.speedMode === 'super' ? 'super'
      : params.speedMode === 'fast' ? 'fast'
      : this.flightMode === 'hover' ? 'hover' : 'cruise';

    const facingYaw = params.facingYaw ?? 0;
    if (params.flying) {
      computeFlightOrientation(params.velocity, this.baseOrientation, dt, params.turn, params.speedMode ?? 'normal', this.baseOrientation, facingYaw, this.upright);
      tmpHead.set(0, 1, 0).applyQuaternion(this.baseOrientation);
      if (speed > 1e-4) {
        tmpVelocity.copy(params.velocity).multiplyScalar(1 / speed);
        this.debugAlignment = tmpHead.dot(tmpVelocity);
        this.debugVelocityDir.copy(tmpVelocity);
      } else {
        this.debugAlignment = 1;
        this.debugVelocityDir.set(0, 0, 0);
      }
      this.debugBank = params.turn * (1 - this.upright);
      tmpEuler.setFromQuaternion(this.baseOrientation, 'YXZ');
      this.debugPitch = tmpEuler.x;
    } else {
      this.targetYaw.setFromAxisAngle(up, facingYaw);
      this.baseOrientation.slerp(this.targetYaw, 1 - Math.exp(-dt * 12));
      this.debugAlignment = 1; this.debugBank = 0; this.debugPitch = 0;
    }

    // Resting in the air is the one state with nothing else moving the body, so it gets a slow
    // sway. It rides `bodyOffset`, which is visual only and never touches the collider.
    this.hoverTime += dt;
    if (this.currentMove || this.dodgePose) {
      // A strike or an evade owns the whole body. Easing the posture out instead of dropping it
      // lets the at-ease pose fight the first frames of a kick, which bends the leg sideways.
      this.restPose = 0;
    } else if (params.flying) {
      const resting = this.upright * (1 - Math.min(1, speed / 12));
      this.restPose += (resting - this.restPose) * (1 - Math.exp(-dt * 5));
      if (this.restPose > 0.002) this.bodyOffset.y = Math.sin(this.hoverTime * 1.15) * HOVER_SWAY * this.restPose;
    } else {
      // Feet on the ground means exactly zero offset. Decaying it instead would leave the
      // character standing a few centimetres above or below the surface for a third of a second.
      this.restPose = 0;
    }

    this.updateDoubleJump(dt);
    this.rootOrientation.copy(this.baseOrientation).multiply(this.qFlip);
    this.locomotion = this.dodgePose ? this.dodgePose
      : this.doubleJump.active ? 'doubleJump'
      : params.flying ? this.flightPose
      : !params.grounded ? 'airborne'
      : params.speed > 8 ? 'run' : params.speed > 0.4 ? 'walk' : 'idle';
    this.locomotionTime += dt;
    this.updateCombat(dt * (params.combatTimeFactor ?? 1));
  }

  private updateDoubleJump(dt: number): void {
    if (!this.doubleJump.active) { this.qFlip.identity(); this.flipTuckAmount = 0; return; }
    this.doubleJump.progress += dt / Math.max(0.1, this.doubleJump.duration);
    if (this.doubleJump.progress >= 1) {
      this.doubleJump.progress = 1; this.doubleJump.active = false; this.qFlip.identity();
      this.flipPhaseName = 'recovery'; this.flipTuckAmount = 0;
      this.events.dispatch('doubleJump.flipEnd');
      return;
    }
    const phase = flipPhase(this.doubleJump.progress);
    if (phase !== this.flipPhaseName) {
      this.flipPhaseName = phase;
      if (phase === 'tuck') this.events.dispatch('doubleJump.tuck');
      else if (phase === 'untuck') this.events.dispatch('doubleJump.untuck');
    }
    this.flipTuckAmount = flipTuck(this.doubleJump.progress);
    // The angle is eased by conservation of angular momentum, not by a constant rate: the body
    // leaves the ground already turning, spins up through the tuck and opens out to land.
    this.qFlip.setFromAxisAngle(this.flipAxis, flipAngle(this.doubleJump.progress));
  }

  private updateCombat(dt: number): void {
    if (!this.currentMove) return;
    const move = this.currentMove;
    const total = move.startup + move.active + move.recovery;
    const previous = this.moveTimer / Math.max(0.001, total);
    this.moveTimer += dt;
    const current = Math.min(1, this.moveTimer / Math.max(0.001, total));
    this.events.evaluate(move.id, previous, current, move.events, false);
    this.movePhase = this.moveTimer < move.startup ? 'startup'
      : this.moveTimer < move.startup + move.active ? 'active'
      : this.moveTimer < move.cancelAt * total ? 'recovery' : 'cancelWindow';
    if (this.moveTimer >= total) {
      this.events.dispatch('attack.complete', move.id);
      this.currentMove = null; this.moveTimer = 0; this.movePhase = 'startup';
    }
  }
}
