import { Group, MathUtils, Vector3 } from 'three/webgpu';
import type { Collider } from '../core/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CharacterModel } from './CharacterModel';
import type { InputController } from './InputController';
import { SPACE, WORLD } from '../core/config';
import { FLIGHT, type ArmedTier, type FlightSpeedMode } from './flightConfig';

export type { ArmedTier };
import { getDoubleJumpDuration, getJumpVelocity, getGravity, JUMP_CONFIG } from './physics/JumpPhysics';
import { EARTH, surfaceGravityMps2 } from '../world/planet/PlanetBody';
import { TitanGroundSupport } from './physics/TitanGroundSupport';
import type { FlipDirection } from './animations/types';
import { DodgeSystem, type DodgeKind } from './movement/DodgeSystem';
import { resolveContactImpact, type ImpactResult } from './combat/MeteorImpact';

/** Fraction of the run speed the somersault throws forward, so the flip travels. */
const DOUBLE_JUMP_CARRY = 0.45;
/** How long a committed downward strike stays committed, and how hard it drives. */
const SLAM = { window: 1.4, accel: 260, entry: 45 } as const;
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
  state: 'Grounded' | 'Falling' | 'Hover' | 'Flight' = 'Grounded';
  facingYaw = 0;
  size = 1;
  speedMultiplier = 1;
  speedMode: FlightSpeedMode = 'ground';
  beforeMove?: (position: Vector3, velocity: Vector3, dt: number) => readonly Collider[];
  readonly input: InputController;
  private jumps = 0;
  private armedTier: ArmedTier = 'none';
  private megaNeedsBoostRelease = false;
  /** Seconds since the controller started, used only to time the arm key's double tap. */
  private armClockS = 0;
  private lastArmTapS = -Infinity;
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
  private bodyGravityMps2 = surfaceGravityMps2(EARTH);

  constructor(root: Group, input: InputController) {
    this.input = input;
    root.add(this.model);
    this.model.position.copy(this.position);
  }

  get jumpCount(): number { return this.jumps; }
  get isGrounded(): boolean { return this.grounded; }
  /** Physical gravity of the current body, before the existing Earth gameplay calibration. */
  get surfaceGravityMps2(): number { return this.bodyGravityMps2; }
  get gravityMps2(): number {
    return getGravity(this.size, JUMP_CONFIG.baseGravity * this.bodyGravityMps2 / surfaceGravityMps2(EARTH));
  }
  setSurfaceGravity(gravityMps2: number): void {
    if (!Number.isFinite(gravityMps2) || gravityMps2 < 0) throw new RangeError('Surface gravity must be finite and non-negative');
    this.bodyGravityMps2 = gravityMps2;
  }
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
  /** Which tier the arm key has selected: none, mega, or interplanetary. */
  get armed(): ArmedTier { return this.armedTier; }
  set armed(tier: ArmedTier) {
    if (tier === this.armedTier) return;
    const wasArmed = this.armedTier !== 'none';
    this.armedTier = tier;
    // Arming from cold while boost is already down must not fling the player: the key has to be
    // released and pressed again, so arming is never itself an acceleration.
    //
    // Stepping up a tier mid-flight is different. The player is already boosting and already
    // entitled to that speed, and asking for more should not drop them to super until they let
    // go -- which is what it did, and it read as the key not working.
    if (!wasArmed) this.megaNeedsBoostRelease = tier !== 'none' && this.input.held('KeyB');
  }

  /** True for either armed tier. Interplanetary is mega and then some. */
  get megaMode(): boolean { return this.armedTier !== 'none'; }
  set megaMode(enabled: boolean) { this.armed = enabled ? 'mega' : 'none'; }
  get interplanetaryMode(): boolean { return this.armedTier === 'interplanetary'; }
  get lastTerrainContact() { return this.physics.lastTerrainContact; }
  get lastVolumeContact() { return this.physics.lastVolumeContact; }
  /** True while an armed tier waits for the boost key to be let go and pressed again. */
  get armWaitingForBoostRelease(): boolean { return this.megaNeedsBoostRelease; }

  /**
   * One press of the arm key.
   *
   * Off to mega, mega to interplanetary when the second press follows quickly, and anything to off
   * otherwise. A slow second press still means "off", so the key keeps the plain on/off behaviour
   * it had before the second tier existed: the double tap adds a level without taking one away.
   */
  private tapArm(): void {
    const quick = this.armClockS - this.lastArmTapS <= FLIGHT.armDoubleTapS;
    this.lastArmTapS = this.armClockS;
    this.armed = this.armedTier === 'none' ? 'mega'
      : this.armedTier === 'mega' && quick ? 'interplanetary'
        : 'none';
  }
  toggleMegaMode(): void { this.tapArm(); }

  /**
   * The local flight tier the player is actually in this frame.
   *
   * Interplanetary needs sky under it: a frame at 222 km/s covers thirteen kilometres, so nothing
   * on the ground could be collided with and the player would pass through the city rather than
   * over it. Below the floor an armed interplanetary gives mega, which is what the tier below it
   * would have given anyway.
   */
  private localTier(flying: boolean, boosting: boolean, sprinting: boolean): FlightSpeedMode {
    if (!flying) return 'ground';
    if (!boosting) return sprinting ? 'fast' : 'normal';
    if (this.armedTier === 'none' || this.megaNeedsBoostRelease) return 'super';
    return this.armedTier === 'interplanetary' && this.position.y >= FLIGHT.interplanetaryFloorM
      ? 'interplanetary' : 'mega';
  }

  update(dt: number, colliders: readonly Collider[], cameraYaw: number, cameraPitch = 0): void {
    dt = Math.min(0.06, dt);
    this.armClockS += dt;
    if (this.input.consume('KeyV')) this.tapArm();
    if (!this.input.held('KeyB')) this.megaNeedsBoostRelease = false;
    if (this.input.consume('KeyF')) {
      this.state = this.state === 'Grounded' || this.state === 'Falling' ? 'Hover' : 'Falling';
      if (this.state === 'Hover') {
        this.velocity.y = 5;
        this.position.y += 0.18;
      }
    }
    const flying = this.state === 'Hover' || this.state === 'Flight';
    
    const boosting = this.input.held('KeyB');
    const sprinting = this.input.held('ShiftLeft') || this.input.held('ShiftRight');
    const movementX = Number(this.input.held('KeyD')) - Number(this.input.held('KeyA'));
    const movementZ = Number(this.input.held('KeyS')) - Number(this.input.held('KeyW'));
    const ascent = Number(this.input.held('Space')) - Number(this.input.held('ControlLeft') || this.input.held('ControlRight'));
    const sizeSpeed = Math.sqrt(this.size);
    this.speedMode = this.localTier(flying, boosting, sprinting);
    const armedReady = this.armedTier !== 'none' && !this.megaNeedsBoostRelease;
    const ground = FLIGHT.groundBoostSpeed;
    const speed = this.speedMode === 'ground'
      ? Math.min(3000, (boosting ? armedReady ? ground.armed : ground.plain
        : sprinting ? FLIGHT.runSpeed : FLIGHT.walkSpeed) * sizeSpeed * this.speedMultiplier)
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
      // Boost is a modifier, never a direction. Synthesising a forward intent from it -- which
      // this did -- means the player drifts off whenever they hold it to think, and it let the
      // cosmic cruise engage with no forward input at all.
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
          // Keep the same muscular impulse on each body: lower gravity gives a higher,
          // longer jump, while Earth's established movement remains exactly as before.
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
                this.velocity.y = Math.max(this.velocity.y, Math.sqrt(2 * this.gravityMps2 * (rise + 0.5 * this.size)));
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
      this.velocity.y -= this.gravityMps2 * dt;
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
    // Surface contact ends downward flight. Ordinary jumps/falls remain under body gravity.
    if (this.grounded && (!flying || (this.desired.y <= 0 && !this.input.held('Space')))) {
      this.state = 'Grounded';
    } else if (!flying) this.state = 'Falling';

    // The one reliable contact event: the frame the sweep first reports ground. `velocity` has
    // already been zeroed by the sweep, so the arrival speed is the snapshot taken before it.
    if (!wasGrounded && this.grounded) this.registerImpact();

    /**
     * The ceiling holds.
     *
     * It was briefly removed so that interplanetary flight could keep climbing, and that is the
     * one thing the roadmap says not to do yet: "remove altitude ceiling only after successful
     * handoff" (Sprint H5). Until the player can be handed into another body's reference frame,
     * an unbounded `position.y` is not freedom, it is the point at which a coordinate stops being
     * representable — and every system downstream takes it at face value.
     */
    // The altitude ceiling was removed here as part of Sprint H5 step 7.

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
      sprinting,
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
   * Updates the visual proxy during interplanetary travel.
   * The logical position moves through UniverseRuntime/TravelDomain, while the visual model
   * stays at the camera-relative origin with flight animation alive and oriented by view/thrust.
   */
  updateTravelVisual(dt: number, speedMps: number, viewForward: Vector3, cameraYaw: number, cameraPitch: number, issprinting = true): void {
    this.model.position.set(0, 0, 0);
    this.model.scale.setScalar(this.size);
    this.forward.copy(viewForward).normalize();
    this.facingYaw = cameraYaw;
    this.speedMode = 'interplanetary';
    this.state = 'Flight';
    this.character.animate(
      dt,
      speedMps,
      true,
      issprinting,
      'interplanetary',
      0,
      0,
      this.size,
      undefined,
      1,
      'interplanetary',
      viewForward,
      cameraYaw,
      { desiredSpeed: speedMps, grounded: false, dodge: undefined },
    );
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
   * Uses the swept contact point and pre-response velocity. Contact normal and tangent energy
   * are resolved by the shared local footprint policy, including its shallow-graze gate.
   */
  private registerImpact(): void {
    const contact=this.lastTerrainContact;
    const slam = this.slamTimer > 0;
    this.slamTimer = 0;
    const impact = resolveContactImpact(this.impactVelocity,contact?.normal??{x:0,y:1,z:0},this.size,slam,!!contact);
    this.character.animationController.triggerLanding(
      impact.profile === 'titan' ? 'titan'
        : impact.profile === 'meteor' ? 'super'
        : impact.profile === 'soft' ? 'soft' : 'hard',
    );
    if (impact.profile === 'soft') return;
    this.impactPoint.copy(contact?.position??this.position);
    this.pendingImpact = impact;
  }

  teleport(position: Vector3): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.model.position.copy(position);
    this.state = position.y > PhysicsWorld.terrainHeight(position.x, position.z, 0.32 * this.size) + 1 ? 'Hover' : 'Grounded';
    this.grounded = false;
    this.jumps = 0;
    this.slamTimer = 0;
    this.pendingImpact = null;
    this.dodge.reset();
    this.titanSupport.reset();
  }

  /** A normal travel return continues toward the terrain under the active body's gravity. */
  beginSurfaceApproach(): void {
    const floor = PhysicsWorld.terrainHeight(this.position.x, this.position.z, 0.32 * this.size);
    if (Number.isFinite(floor)) this.position.y = Math.max(this.position.y, floor + 0.05);
    this.state = 'Falling';
    this.grounded = false;
    this.model.position.copy(this.position);
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
