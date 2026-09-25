import { Group, MathUtils, Vector3 } from 'three/webgpu';
import type { Collider } from '../core/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CharacterModel } from './CharacterModel';
import type { InputController } from './InputController';
import { SPACE, WORLD } from '../core/config';
import { FLIGHT, type FlightSpeedMode } from './flightConfig';
import { getDoubleJumpDuration, getJumpHeight, getJumpVelocity, getGravity } from './physics/JumpPhysics';
import { TitanGroundSupport } from './physics/TitanGroundSupport';
import type { FlipDirection } from './animations/types';
import { DodgeSystem, type DodgeKind } from './movement/DodgeSystem';
import { resolveImpact, type ImpactResult } from './combat/MeteorImpact';

/** Fraction of the run speed the somersault throws forward, so the flip travels. */
const DOUBLE_JUMP_CARRY = 0.45;
/** How long a committed downward strike stays committed, and how hard it drives. */
const SLAM = { window: 1.4, accel: 260, entry: 45 } as const;
/**
 * Metres per second of descent below which a contact is not a landing at all. Without it,
 * clipping a kerb during a 650 m/s boosted run would read as arriving from orbit, because the
 * horizontal speed alone would carry the energy. Skimming the ground at speed is the plough's
 * job; this system only answers for things that came down.
 */
const MIN_DESCENT = 12;

export interface LandingImpact {
  readonly impact: ImpactResult;
  readonly position: Vector3;
}

export class PlayerController {
  readonly position = new Vector3(WORLD.spawn.x, WORLD.spawn.y, WORLD.spawn.z);
  readonly velocity = new Vector3();
  readonly forward = new Vector3(0, 0, -1);
  readonly character = new CharacterModel();
  readonly model = this.character.group;
  readonly titanSupport = new TitanGroundSupport();
  readonly dodge = new DodgeSystem();
  /** The key that evades: a roll on the ground, a dash in the air. */
  dodgeKey = 'KeyZ';
  state: 'Grounded' | 'Hover' | 'Flight' = 'Grounded';
  facingYaw = 0;
  size = 1;
  speedMultiplier = 1;
  speedMode: FlightSpeedMode = 'ground';
  beforeMove?: (position: Vector3, velocity: Vector3, dt: number) => readonly Collider[];
  readonly input: InputController;
  private jumps = 0;
  private megaEnabled = false;
  private megaNeedsBoostRelease = false;
  private targetSize = 1;
  private readonly desired = new Vector3();
  private readonly physics = new PhysicsWorld();
  private grounded = false;
  private pose = '';
  private poseTime = 0;
  private readonly dodgeDirection = new Vector3(0, 0, -1);
  private readonly flipCarry = new Vector3();
  private readonly impactVelocity = new Vector3();
  private readonly impactPoint = new Vector3();
  private pendingImpact: ImpactResult | null = null;
  private slamTimer = 0;
  private desiredSpeed = 0;

  constructor(root: Group, input: InputController) {
    this.input = input;
    root.add(this.model);
    this.model.position.copy(this.position);
  }

  get jumpCount(): number { return this.jumps; }
  get isGrounded(): boolean { return this.grounded; }
  /** The speed the player is currently asking for; flight rights the body against it. */
  get requestedSpeed(): number { return this.desiredSpeed; }
  get isSlamming(): boolean { return this.slamTimer > 0; }
  /** True inside the evade window. Nothing damages the player yet; this is the hook for when it does. */
  get invulnerable(): boolean { return this.dodge.invulnerable; }

  /**
   * The landing that just happened, if it was hard enough to matter, handed over exactly once.
   * Polled by the power system, which owns the effects and the destruction hooks.
   */
  consumeImpact(): LandingImpact | null {
    if (!this.pendingImpact) return null;
    const landing = { impact: this.pendingImpact, position: this.impactPoint.clone() };
    this.pendingImpact = null;
    return landing;
  }

  /**
   * Commits to a downward strike. The dive is what separates a meteor punch from falling over:
   * the impact system reads the flag on contact and scales the crater accordingly.
   */
  beginSlam(): void {
    this.slamTimer = SLAM.window;
    const dive = SLAM.entry * Math.sqrt(Math.max(1, this.size));
    this.velocity.y = Math.min(this.velocity.y, 0) - dive;
  }
  get megaMode(): boolean { return this.megaEnabled; }
  set megaMode(enabled: boolean) {
    if (enabled === this.megaEnabled) return;
    this.megaEnabled = enabled;
    this.megaNeedsBoostRelease = enabled && this.input.held('KeyB');
  }
  toggleMegaMode(): void { this.megaMode = !this.megaMode; }

  update(dt: number, colliders: readonly Collider[], cameraYaw: number, cameraPitch = 0): void {
    dt = Math.min(0.06, dt);
    if (this.input.consume('KeyV')) this.toggleMegaMode();
    if (!this.input.held('KeyB')) this.megaNeedsBoostRelease = false;
    if (this.input.consume('KeyF')) {
      this.state = this.state === 'Grounded' ? 'Hover' : 'Grounded';
      if (this.state === 'Hover') {
        this.velocity.y = 5;
        this.position.y += 0.18;
      }
    }
    const flying = this.state !== 'Grounded';
    const boosting = this.input.held('KeyB');
    const sprinting = this.input.held('ShiftLeft') || this.input.held('ShiftRight');
    const movementX = Number(this.input.held('KeyD')) - Number(this.input.held('KeyA'));
    const movementZ = Number(this.input.held('KeyS')) - Number(this.input.held('KeyW'));
    const ascent = Number(this.input.held('Space')) - Number(this.input.held('ControlLeft') || this.input.held('ControlRight'));
    const sizeSpeed = Math.sqrt(this.size);

    this.speedMode = flying
      ? boosting
        ? this.megaEnabled && !this.megaNeedsBoostRelease ? 'mega' : 'super'
        : sprinting ? 'fast' : 'normal'
      : 'ground';

    const speed = this.speedMode === 'ground'
      ? Math.min(3000, (boosting ? this.megaEnabled && !this.megaNeedsBoostRelease ? 650 : 120 : sprinting ? FLIGHT.runSpeed : FLIGHT.walkSpeed) * sizeSpeed * this.speedMultiplier)
      : Math.min(FLIGHT.maxSpeed, FLIGHT.speeds[this.speedMode] * this.speedMultiplier);

    this.dodge.update(dt);
    if (this.input.consume(this.dodgeKey)) this.requestDodge(flying, movementX, movementZ, cameraYaw, cameraPitch, speed);
    const dashing = this.dodge.kind === 'airDash';
    const rolling = this.dodge.kind === 'roll';
    // A roll that leaves the ground — off a kerb, or into flight — stops being a roll.
    if (rolling && (flying || !this.grounded)) this.dodge.cancel();

    if (flying) {
      const cosPitch = Math.cos(cameraPitch);
      const forwardX = -Math.sin(cameraYaw) * cosPitch;
      const forwardY = -Math.sin(cameraPitch);
      const forwardZ = -Math.cos(cameraYaw) * cosPitch;
      const rightX = Math.cos(cameraYaw), rightZ = -Math.sin(cameraYaw);
      this.desired.set(
        rightX * movementX + forwardX * -movementZ,
        forwardY * -movementZ + ascent,
        rightZ * movementX + forwardZ * -movementZ,
      );
      if (this.desired.lengthSq() > 0) this.desired.normalize().multiplyScalar(speed);
      if (boosting && movementX === 0 && movementZ === 0 && ascent === 0) {
        this.desired.set(forwardX, forwardY, forwardZ).multiplyScalar(speed);
      }
    } else {
      this.desired.set(movementX, 0, movementZ);
      if (this.desired.lengthSq() > 0) this.desired.normalize();
      const x = this.desired.x, z = this.desired.z;
      this.desired.x = x * Math.cos(cameraYaw) + z * Math.sin(cameraYaw);
      this.desired.z = -x * Math.sin(cameraYaw) + z * Math.cos(cameraYaw);
      this.desired.multiplyScalar(speed);
    }

    // A committed roll owns the horizontal velocity outright: that is what makes it an evade
    // rather than a sprint with a clip attached.
    if (this.dodge.kind === 'roll') {
      this.desired.copy(this.dodge.direction).multiplyScalar(this.dodge.speed(this.size) * this.speedMultiplier);
      this.desired.y = 0;
    }
    this.desiredSpeed = this.desired.length();

    let response = this.speedMode === 'ground'
      ? this.grounded ? FLIGHT.groundResponse : FLIGHT.airControl
      : this.desired.lengthSq() < this.velocity.lengthSq() ? FLIGHT.response.braking : FLIGHT.response[this.speedMode];
    if (dashing) response *= FLIGHT.dashControl;
    const acceleration = 1 - Math.exp(-dt * response);
    this.velocity.x = MathUtils.lerp(this.velocity.x, this.desired.x, acceleration);
    this.velocity.z = MathUtils.lerp(this.velocity.z, this.desired.z, acceleration);

    if (this.slamTimer > 0) {
      this.slamTimer = Math.max(0, this.slamTimer - dt);
      this.velocity.y -= SLAM.accel * sizeSpeed * dt;
    }

    if (flying) {
      if (this.slamTimer <= 0) this.velocity.y = MathUtils.lerp(this.velocity.y, this.desired.y, acceleration);
      this.state = this.desired.lengthSq() > 1 || this.velocity.lengthSq() > 36 ? 'Flight' : 'Hover';
    } else {
      if (this.grounded) this.jumps = 0;

      if (this.input.consume('Space') && this.jumps < 2) {
        if (this.grounded || this.jumps === 0) {
          // First jump: standard jump scaled by v = sqrt(2 * g * h)
          this.jumps = 1;
          this.velocity.y = getJumpVelocity(this.size);
          this.grounded = false;

          // Parkour vault query
          if (this.desired.lengthSq() > 1) {
            const direction = this.desired.clone().normalize();
            const start = this.position.clone();
            start.y += 0.65 * this.size;
            const hit = PhysicsWorld.raycast(start, direction, colliders, 1.4 * this.size, 0.2 * this.size);
            if (hit?.collider) {
              const rise = hit.collider.y + hit.collider.height / 2 - this.position.y;
              start.y = this.position.y + 2.2 * this.size;
              const ceiling = PhysicsWorld.raycast(start, new Vector3(0, 1, 0), colliders, Math.max(0, rise), 0.32 * this.size);
              if (rise > 0.55 * this.size && rise < 2.5 * this.size && !ceiling) {
                this.velocity.y = Math.sqrt(2 * getGravity(this.size) * (rise + 0.5 * this.size));
                this.powerPose('vault', 0.55);
              }
            }
          }
        } else if (this.jumps === 1) {
          // Second jump: Double Jump with 360 flip
          this.jumps = 2;
          this.velocity.y = Math.max(this.velocity.y, 0) + getJumpVelocity(this.size) * 0.85;

          // Carry the jump forward. A somersault that only rises reads as a pirouette; the throw
          // is what makes it travel, and reduced air control is what lets it survive the frame.
          if (this.desired.lengthSq() > 1) {
            this.flipCarry.copy(this.desired).setY(0).normalize().multiplyScalar(speed * DOUBLE_JUMP_CARRY);
            this.velocity.x += this.flipCarry.x;
            this.velocity.z += this.flipCarry.z;
          }

          // Direction based on input
          let flipDir: FlipDirection = 'back';
          if (this.input.held('KeyW')) flipDir = 'front';
          else if (this.input.held('KeyA')) flipDir = 'sideLeft';
          else if (this.input.held('KeyD')) flipDir = 'sideRight';

          this.character.animationController.triggerDoubleJump(flipDir, this.size);
          this.powerPose('flip', getDoubleJumpDuration(this.size));
        }
      }
      this.velocity.y -= getGravity(this.size) * dt;
    }

    this.size = MathUtils.lerp(this.size, this.targetSize, 1 - Math.exp(-dt * 4));
    if (Math.abs(this.size - this.targetSize) < 0.005) this.size = this.targetSize;

    if (!flying && this.velocity.length() >= 420 && this.beforeMove) {
      colliders = this.beforeMove(this.position, this.velocity, dt);
    }

    const wasGrounded = this.grounded;
    this.impactVelocity.copy(this.velocity);
    this.grounded = this.physics.move(
      this.position,
      this.velocity,
      dt,
      0.32 * this.size,
      2.1 * this.size,
      colliders,
      !flying ? 0.55 * this.size : 0
    );

    // Evaluate titan ground support and fall animation suppression
    const supportInfo = this.titanSupport.evaluateSupport(this.position, this.size, this.velocity.y, dt, colliders);
    if (this.size >= 4 && supportInfo.hasSupport) {
      this.grounded = true;
    }

    // The one reliable contact event: the frame the sweep first reports ground. `velocity` has
    // already been zeroed by the sweep, so the arrival speed is the snapshot taken before it.
    if (!wasGrounded && this.grounded) this.registerImpact();

    if (this.position.y >= SPACE.maxAltitude) {
      this.position.y = SPACE.maxAltitude;
      this.velocity.y = Math.min(0, this.velocity.y);
    }

    // Model facing rotation
    if (flying && this.velocity.lengthSq() > 2) {
      this.forward.copy(this.velocity).normalize();
      const angle = Math.atan2(-this.forward.x, -this.forward.z);
      this.facingYaw += Math.atan2(Math.sin(angle - this.facingYaw), Math.cos(angle - this.facingYaw)) * Math.min(1, dt * 8);
    } else if (this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z > 0.2) {
      this.forward.set(this.velocity.x, 0, this.velocity.z).normalize();
      const angle = Math.atan2(-this.forward.x, -this.forward.z);
      this.facingYaw += Math.atan2(Math.sin(angle - this.facingYaw), Math.cos(angle - this.facingYaw)) * Math.min(1, dt * 8);
    }

    this.poseTime -= dt;
    if (this.poseTime <= 0) this.pose = '';

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const bank = horizontalSpeed > 2 ? Math.sin(Math.atan2(-this.velocity.x, -this.velocity.z) - this.facingYaw) : 0;

    // Titan Fall visual check: giants only show jump/fall pose if supportInfo.isFallingVisually
    const showFallAnimation = this.size >= 4
      ? supportInfo.isFallingVisually
      : (!flying && !this.grounded);

    this.character.animate(
      dt,
      Math.hypot(this.velocity.x, this.velocity.z) / sizeSpeed,
      flying,
      boosting,
      this.pose || (showFallAnimation ? 'jump' : ''),
      this.velocity.y / sizeSpeed,
      bank,
      this.size,
      this.velocity,
      1, // combatFactor
      this.speedMode,
      this.forward,
      this.facingYaw,
      { desiredSpeed: this.desiredSpeed, grounded: this.grounded, dodge: this.dodge.kind },
    );

    this.model.position.copy(this.position);
    this.model.scale.setScalar(this.size);
  }

  /**
   * One button, read against the situation: a roll with both feet down, a dash otherwise. The
   * direction comes from the movement keys relative to the camera, and from the facing when the
   * player is holding nothing — dodging on the spot should still go somewhere.
   */
  private requestDodge(flying: boolean, movementX: number, movementZ: number, cameraYaw: number, cameraPitch: number, cruiseSpeed: number): void {
    if (!this.dodge.ready) return;
    // A strike already thrown is not interruptible. Its recovery is, which is what makes
    // cancelling into an evade a decision rather than an accident.
    const move = this.character.animationController.activeCombatMove;
    const phase = this.character.animationController.activeMovePhase;
    if (move && (phase === 'startup' || phase === 'active')) return;

    const airborne = flying || !this.grounded;
    const kind: DodgeKind = airborne ? 'airDash' : 'roll';
    const steering = movementX !== 0 || movementZ !== 0;

    if (airborne) {
      // The flight basis, pitch included, so a dash can dive or climb with the camera.
      const cosPitch = Math.cos(cameraPitch);
      const forwardX = -Math.sin(cameraYaw) * cosPitch;
      const forwardY = -Math.sin(cameraPitch);
      const forwardZ = -Math.cos(cameraYaw) * cosPitch;
      if (steering) {
        this.dodgeDirection.set(
          Math.cos(cameraYaw) * movementX + forwardX * -movementZ,
          forwardY * -movementZ,
          -Math.sin(cameraYaw) * movementX + forwardZ * -movementZ,
        );
      } else {
        this.dodgeDirection.set(forwardX, forwardY, forwardZ);
      }
    } else if (steering) {
      this.dodgeDirection.set(
        movementX * Math.cos(cameraYaw) + movementZ * Math.sin(cameraYaw),
        0,
        -movementX * Math.sin(cameraYaw) + movementZ * Math.cos(cameraYaw),
      );
    } else {
      this.dodgeDirection.set(-Math.sin(this.facingYaw), 0, -Math.cos(this.facingYaw));
    }

    if (this.dodgeDirection.lengthSq() < 1e-8) return;
    if (!this.dodge.tryStart(kind, this.dodgeDirection.normalize())) return;

    this.character.animationController.cancelCombatMove();
    this.character.animationController.endDoubleJump();
    if (kind === 'roll') {
      // Rolling turns the body to face the roll, which is why a soulslike roll reads as a choice.
      this.facingYaw = Math.atan2(-this.dodgeDirection.x, -this.dodgeDirection.z);
      this.powerPose('roll', 0.5);
    } else {
      // The dash is an impulse, not a steering change: it has to be visible at 8000 m/s too.
      this.velocity.addScaledVector(this.dodgeDirection, DodgeSystem.dashBurst(cruiseSpeed, this.size));
      this.powerPose('dash', 0.28);
    }
  }

  /**
   * Turns a contact into an impact. Descent is what digs a crater; a grazing pass at speed still
   * cracks the ground, but it counts for a third, because most of that energy carries on past.
   */
  private registerImpact(): void {
    const descent = Math.max(0, -this.impactVelocity.y);
    const horizontal = Math.hypot(this.impactVelocity.x, this.impactVelocity.z);
    const arrival = descent < MIN_DESCENT ? 0 : descent + horizontal * 0.25;
    const slam = this.slamTimer > 0;
    this.slamTimer = 0;
    const impact = resolveImpact(arrival, this.size, slam);
    this.character.animationController.triggerLanding(
      impact.profile === 'titan' ? 'titan'
        : impact.profile === 'meteor' ? 'super'
        : impact.profile === 'soft' ? 'soft' : 'hard',
    );
    if (impact.profile === 'soft') return;
    this.impactPoint.copy(this.position);
    this.pendingImpact = impact;
  }

  teleport(position: Vector3): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.model.position.copy(position);
    this.state = position.y > 1 ? 'Hover' : 'Grounded';
    this.grounded = false;
    this.jumps = 0;
    this.slamTimer = 0;
    this.pendingImpact = null;
    this.dodge.reset();
    this.titanSupport.reset();
  }

  setSize(scale: number): void {
    this.targetSize = MathUtils.clamp(scale, 1, 1000 / 2.07);
    this.powerPose('giant', 1.5);
  }

  powerPose(name: string, duration = 0.5): void {
    this.pose = name;
    this.poseTime = duration;
  }
}
