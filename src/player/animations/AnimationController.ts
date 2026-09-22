import { Euler, Quaternion, Vector3, type Bone } from 'three/webgpu';
import { computeFlightOrientation } from './FlightOrientation.ts';
import { AnimationEvents } from './AnimationEvents.ts';
import type { BoneMaskName, CombatMove, DoubleJumpState, FlipDirection, FlightPoseName, LandingTier, MovePhase } from './types';
import { getDoubleJumpDuration } from '../physics/JumpPhysics';

const tmpHead = new Vector3();
const tmpVelocity = new Vector3();
const tmpEuler = new Euler();
const up = new Vector3(0, 1, 0);

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
  baseLayer: string; jumpLayer: string; flightLayer: string; combatLayer: string;
  titanLayer: string; currentAnimation: string; normalizedTime: number; combatMove: string;
  movePhase: MovePhase; boneMask: BoneMaskName; jumpCount: number; doubleJumpProgress: number;
  flipDirection: FlipDirection; flightAlignment: number; rootPitch: number; rootBank: number;
  velocityDir: Vector3;
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

  get isDoubleJumping(): boolean { return this.doubleJump.active; }
  get doubleJumpProgress(): number { return this.doubleJump.progress; }
  get activeCombatMove(): CombatMove | null { return this.currentMove; }
  get activeMovePhase(): MovePhase { return this.movePhase; }
  get debugState(): AnimationDebugState {
    const total = this.currentMove ? this.currentMove.startup + this.currentMove.active + this.currentMove.recovery : 1;
    return {
      baseLayer: this.locomotion,
      jumpLayer: this.doubleJump.active ? `doubleJump (${this.doubleJump.direction})` : 'ground',
      flightLayer: this.flightPose,
      combatLayer: this.currentMove ? `${this.currentMove.id} [${this.movePhase}]` : 'none',
      titanLayer: this.landingTier === 'titan' ? 'titan' : 'normal',
      currentAnimation: this.currentMove?.animation ?? this.locomotion,
      normalizedTime: this.currentMove ? Math.min(1, this.moveTimer / Math.max(0.001, total)) : this.locomotionTime % 1,
      combatMove: this.currentMove?.id ?? 'none', movePhase: this.movePhase,
      boneMask: this.currentMove?.boneMask ?? 'FULL_BODY', jumpCount: this.doubleJump.active ? 2 : 0,
      doubleJumpProgress: this.doubleJump.progress, flipDirection: this.doubleJump.direction,
      flightAlignment: this.debugAlignment, rootPitch: this.debugPitch, rootBank: this.debugBank,
      velocityDir: this.debugVelocityDir,
    };
  }

  triggerDoubleJump(direction: FlipDirection, size = 1): void {
    this.doubleJump = { active: true, progress: 0, duration: getDoubleJumpDuration(size), direction };
    if (direction === 'front') this.flipAxis.set(1, 0, 0);
    else if (direction === 'back') this.flipAxis.set(-1, 0, 0);
    else if (direction === 'sideLeft') this.flipAxis.set(0, 0, -1);
    else this.flipAxis.set(0, 0, 1);
    this.events.dispatch('doubleJump.impulse');
    this.events.dispatch('doubleJump.flipStart');
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
    dt = Math.max(0, Math.min(0.1, dt));
    this.bodyOffset.set(0, 0, 0);
    if (params.flying !== this.wasFlying) {
      this.wasFlying = params.flying;
      if (params.flying) this.triggerTakeoff();
    }
    this.takeoffTimer = Math.max(0, this.takeoffTimer - dt);
    this.flightPose = !params.flying ? 'hover'
      : this.takeoffTimer > 0 ? 'takeoff'
      : params.speedMode === 'mega' ? 'mega'
      : params.speedMode === 'super' ? 'super'
      : params.speedMode === 'fast' ? 'fast' : 'cruise';

    const facingYaw = params.facingYaw ?? 0;
    if (params.flying && params.velocity.lengthSq() > 1 && params.speedMode) {
      computeFlightOrientation(params.velocity, this.baseOrientation, dt, params.turn, params.speedMode, this.baseOrientation, facingYaw);
      tmpHead.set(0, 1, 0).applyQuaternion(this.baseOrientation);
      tmpVelocity.copy(params.velocity).normalize();
      this.debugAlignment = tmpHead.dot(tmpVelocity);
      this.debugVelocityDir.copy(tmpVelocity);
      this.debugBank = params.turn;
      tmpEuler.setFromQuaternion(this.baseOrientation, 'YXZ');
      this.debugPitch = tmpEuler.x;
    } else {
      this.targetYaw.setFromAxisAngle(up, facingYaw);
      this.baseOrientation.slerp(this.targetYaw, 1 - Math.exp(-dt * 12));
      this.debugAlignment = 1; this.debugBank = 0; this.debugPitch = 0;
    }

    this.updateDoubleJump(dt);
    this.rootOrientation.copy(this.baseOrientation).multiply(this.qFlip);
    this.locomotion = this.doubleJump.active ? 'doubleJump'
      : params.flying ? this.flightPose
      : !params.grounded ? 'airborne'
      : params.speed > 8 ? 'run' : params.speed > 0.4 ? 'walk' : 'idle';
    this.locomotionTime += dt;
    this.updateCombat(dt * (params.combatTimeFactor ?? 1));
  }

  private updateDoubleJump(dt: number): void {
    if (!this.doubleJump.active) { this.qFlip.identity(); return; }
    this.doubleJump.progress += dt / Math.max(0.1, this.doubleJump.duration);
    if (this.doubleJump.progress >= 1) {
      this.doubleJump.progress = 1; this.doubleJump.active = false; this.qFlip.identity();
      this.events.dispatch('doubleJump.flipEnd');
      return;
    }
    this.qFlip.setFromAxisAngle(this.flipAxis, this.doubleJump.progress * Math.PI * 2);
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
