import { Group, MathUtils, Vector3, Quaternion } from 'three/webgpu';
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
import { manausBathymetry, type PlayerSubmersionState } from '../world/water/ManausBathymetry';
import type { SwimmingVisualState } from './animations/AnimationController';

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
  maxHealth = 1000;
  health = 1000;
  maxShield = 500;
  shield = 500;
  isGodMode = false;
  shieldRegenDelay = 3.0;
  shieldRegenRate = 50.0;
  lastHitTimer = 0;
  damageFlash = 0;
  lastDamageReason: string | null = null;
  onDamageTaken?: (amount: number, health: number, shield: number, reason: string) => void;
  onDeath?: (reason: string) => void;
  state: 'Grounded' | 'Falling' | 'Hover' | 'Flight' | 'Swimming' = 'Grounded';
  swimmingVisualState: SwimmingVisualState = 'None';
  submersion: PlayerSubmersionState = manausBathymetry.evaluateSubmersion(this.position, 1.8, 0);
  waterVolumeActive = true;
  onRiverbed = false;
  private swimExitTimer = 0;
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
  private flightTakeoffGraceS = 0;
  private desiredSpeed = 0;
  private bodyGravityMps2 = surfaceGravityMps2(EARTH);

  readonly sceneRoot: Group;
  private scripted = false;

  constructor(root: Group, input: InputController) {
    this.input = input;
    this.sceneRoot = root;
    root.add(this.model);
    this.model.position.copy(this.position);
  }

  setDivineVitals(): void {
    this.maxHealth = 1000000;
    this.health = 1000000;
    this.maxShield = 500000;
    this.shield = 500000;
    this.shieldRegenDelay = 0.2;
    this.shieldRegenRate = 50000.0;
  }

  get isScripted(): boolean { return this.scripted; }
  beginScripted(): void { this.scripted = true; this.velocity.set(0, 0, 0); }
  endScripted(): void { this.scripted = false; }
  setScriptedPose(position: Vector3, yaw?: number, speed = 0): void {
    this.position.copy(position);
    this.model.position.copy(position);
    if (yaw !== undefined) {
      this.facingYaw = yaw;
      this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    }
    this.velocity.set(0, 0, 0);
  }
  setScriptedLocal(isLocal: boolean): void {
    if (!isLocal) {
      this.model.position.copy(this.position);
    }
  }

  get jumpCount(): number { return this.jumps; }
  get isGrounded(): boolean { return this.grounded; }
  get isSwimming(): boolean { return this.state === 'Swimming'; }
  /** Physical gravity of the current body, before the existing Earth gameplay calibration. */
  get surfaceGravityMps2(): number { return this.bodyGravityMps2; }
  get gravity(): number { return this.bodyGravityMps2; }
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
  /** True inside the evade window or when godmode is active. */
  get invulnerable(): boolean { return this.isGodMode || this.dodge.invulnerable; }
  get isInvulnerable(): boolean { return this.invulnerable; }

  takeDamage(amount: number, reason: string = 'Impacto'): { damageDealt: number; absorbedByShield: number; fatal: boolean } {
    if (this.isInvulnerable || amount <= 0) {
      return { damageDealt: 0, absorbedByShield: 0, fatal: false };
    }

    this.lastHitTimer = this.shieldRegenDelay;
    this.damageFlash = 0.5;
    this.lastDamageReason = reason;

    let absorbedByShield = 0;
    let damageDealt = 0;

    if (this.shield > 0) {
      if (amount <= this.shield) {
        this.shield -= amount;
        absorbedByShield = amount;
      } else {
        absorbedByShield = this.shield;
        const remaining = amount - this.shield;
        this.shield = 0;
        this.health = Math.max(0, this.health - remaining);
        damageDealt = remaining;
      }
    } else {
      this.health = Math.max(0, this.health - amount);
      damageDealt = amount;
    }

    const fatal = this.health <= 0;
    this.onDamageTaken?.(amount, this.health, this.shield, reason);

    if (fatal) {
      this.onDeath?.(reason);
      this.respawn();
    }

    return { damageDealt, absorbedByShield, fatal };
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + Math.max(0, amount));
  }

  rechargeShield(amount: number): void {
    this.shield = Math.min(this.maxShield, this.shield + Math.max(0, amount));
  }

  respawn(): void {
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.lastHitTimer = 0;
    this.damageFlash = 0;
  }

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
  get isFlying(): boolean { return this.state === 'Hover' || this.state === 'Flight'; }
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
    if (this.lastHitTimer > 0) {
      this.lastHitTimer -= dt;
    } else if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate * dt);
    }
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.0);
    }
    if (this.flightTakeoffGraceS > 0) {
      this.flightTakeoffGraceS = Math.max(0, this.flightTakeoffGraceS - dt);
    }
    if (this.input.consume('KeyF')) {
      this.toggleFlight();
    }
    if (this.input.consume('KeyV')) this.tapArm();
    const isShift = this.input.held('ShiftLeft') || this.input.held('ShiftRight');
    const isB = this.input.held('KeyB');
    if (!isB) this.megaNeedsBoostRelease = false;
    const wasSwimming = this.state === 'Swimming';
    this.submersion = manausBathymetry.evaluateSubmersion(this.position, 1.8 * this.size, this.armClockS);

    // Descending cosmic flight that reaches the river surface (outside the take-off grace window,
    // not climbing with Space, not mid-slam) splashes down into Swimming instead of flying through
    // the water column. Voluntary flight above the surface is never overridden.
    if (
      this.isFlying
      && this.waterVolumeActive && this.submersion.inWater
      && this.submersion.totalWaterDepthM >= 1.15 * this.size
      && this.flightTakeoffGraceS <= 0
      && this.slamTimer <= 0
      && this.position.y <= this.submersion.surfaceY + 0.05
      && !this.input.held('Space')
    ) {
      this.state = 'Swimming';
      this.armedTier = 'none';
      this.megaNeedsBoostRelease = true;
      this.speedMode = 'ground';
      this.velocity.set(0, 0, 0);
    }
    const flying = this.isFlying;

    // Sample shared Manaus bathymetry & water volume authority with hysteresis near shoreline and surface
    const swimDepthEnter = 1.15 * this.size;
    const swimDepthStay = 0.90 * this.size;
    const swimSurfaceEnter = 0.06 * this.size;
    const swimSurfaceStay = 0.32 * this.size;
    const activeDepthThreshold = wasSwimming ? swimDepthStay : swimDepthEnter;
    const activeSurfaceMargin = wasSwimming ? swimSurfaceStay : swimSurfaceEnter;

    const inDeepWater = this.waterVolumeActive && this.submersion.inWater && this.submersion.totalWaterDepthM >= activeDepthThreshold;
    const isSwimming = !flying && inDeepWater && this.position.y <= this.submersion.surfaceY + activeSurfaceMargin;
    const isWading = !flying && !isSwimming && this.waterVolumeActive && this.submersion.inWater && this.submersion.feetSubmerged;

    const boosting = isB;
    const sprinting = isShift;
    const movementX = Number(this.input.held('KeyD')) - Number(this.input.held('KeyA'));
    const movementZ = Number(this.input.held('KeyS')) - Number(this.input.held('KeyW'));
    const ascent = Number(this.input.held('Space')) - Number(this.input.held('ControlLeft') || this.input.held('ControlRight'));
    const sizeSpeed = Math.sqrt(this.size);
    this.speedMode = this.localTier(flying, boosting, sprinting);
    const armedReady = this.armedTier !== 'none' && !this.megaNeedsBoostRelease;
    const ground = FLIGHT.groundBoostSpeed;
    const wadeFactor = isWading ? 0.85 : 1.0;
    const speed = isSwimming
      ? (sprinting ? 8.5 : 5.2) * sizeSpeed * this.speedMultiplier
      : this.speedMode === 'ground'
        ? Math.min(3000, (boosting ? armedReady ? ground.armed : ground.plain
          : sprinting ? FLIGHT.runSpeed : FLIGHT.walkSpeed) * sizeSpeed * this.speedMultiplier * wadeFactor)
        : Math.min(FLIGHT.maxSpeed, FLIGHT.speeds[this.speedMode] * this.speedMultiplier);

    this.dodge.update(dt);
    if (this.input.consume(this.dodgeKey)) this.requestDodge(flying, movementX, movementZ, cameraYaw, cameraPitch, speed);
    const dashing = this.dodge.kind === 'airDash';
    const rolling = this.dodge.kind === 'roll';
    // A roll that leaves the ground — off a kerb, or into flight — stops being a roll.
    if (rolling && (flying || isSwimming || !this.grounded)) this.dodge.cancel();

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
    } else {
      this.desired.set(movementX, 0, movementZ);
      if (this.desired.lengthSq() > 0) this.desired.normalize();
      const x = this.desired.x, z = this.desired.z;
      this.desired.x = x * Math.cos(cameraYaw) + z * Math.sin(cameraYaw);
      this.desired.z = -x * Math.sin(cameraYaw) + z * Math.cos(cameraYaw);
      this.desired.multiplyScalar(speed);
    }

    if (this.dodge.kind === 'roll') {
      this.desired.copy(this.dodge.direction).multiplyScalar(this.dodge.speed(this.size) * this.speedMultiplier);
      this.desired.y = 0;
    }
    this.desiredSpeed = this.desired.length();

    let response = isSwimming
      ? 6.5
      : this.speedMode === 'ground'
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
    } else if (isSwimming) {
      this.state = 'Swimming';
      this.jumps = 0;
      const floatFeetY = this.submersion.surfaceY - 1.18 * this.size;
      const wantsDive = this.input.held('ControlLeft') || this.input.held('ControlRight') || this.input.held('KeyC') || this.input.held('KeyZ');
      const wantsAscend = this.input.held('Space');

      // On initial water entry from fall or flight, absorb downward splash momentum at the surface
      // so the character stays swimming on top of the water instead of plunging meters underwater
      if (!wasSwimming && !wantsDive) {
        this.velocity.y = Math.max(this.velocity.y * 0.12, -1.8 * sizeSpeed);
        if (this.position.y < floatFeetY - 0.35 * this.size) {
          this.position.y = floatFeetY - 0.25 * this.size;
        }
      }

      if (wantsDive) {
        // Active downward diving toward the excavated 3D riverbed (no surface spring fighting the dive)
        const diveSpeed = (sprinting ? 9.5 : 6.8) * sizeSpeed;
        this.velocity.y = MathUtils.lerp(this.velocity.y, -diveSpeed, 1 - Math.exp(-dt * 6.5));
      } else if (wantsAscend) {
        if (this.position.y < floatFeetY - 0.08 * this.size) {
          // Active upward swimming from depth back to the water surface
          const ascendSpeed = (sprinting ? 9.5 : 7.2) * sizeSpeed;
          this.velocity.y = MathUtils.lerp(this.velocity.y, ascendSpeed, 1 - Math.exp(-dt * 7.0));
        } else {
          // At the water surface: stabilize at float height
          const surfaceError = floatFeetY - this.position.y;
          this.velocity.y = MathUtils.lerp(this.velocity.y, surfaceError * 7.0, 1 - Math.exp(-dt * 8.5));
        }
      } else {
        // Neutral vertical input in water column
        if (this.position.y <= this.submersion.riverbedY + 0.16 * this.size) {
          // Resting on the 3D riverbed after a dive: stable benthic contact without bobbing away
          this.velocity.y = Math.max(0, this.velocity.y * Math.exp(-dt * 10));
        } else {
          // Responsive surface buoyancy keeps head/shoulders cleanly above water
          const surfaceError = floatFeetY - this.position.y;
          const targetBuoyancyVel = MathUtils.clamp(surfaceError * 6.5, -4.0 * sizeSpeed, 8.2 * sizeSpeed);
          this.velocity.y = MathUtils.lerp(this.velocity.y, targetBuoyancyVel, 1 - Math.exp(-dt * 7.5));
        }
      }
    } else {
      if (this.grounded) this.jumps = 0;

      if (this.input.consume('Space') && this.jumps < 2) {
        if (this.grounded || this.jumps === 0) {
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

          if (this.desired.lengthSq() > 1) {
            this.flipCarry.copy(this.desired).setY(0).normalize().multiplyScalar(speed * DOUBLE_JUMP_CARRY);
            this.velocity.x += this.flipCarry.x;
            this.velocity.z += this.flipCarry.z;
          }

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

    // Re-evaluate submersion at post-move coordinates with hysteresis
    this.submersion = manausBathymetry.evaluateSubmersion(this.position, 1.8 * this.size, this.armClockS);
    const postDepthThreshold = (wasSwimming || isSwimming) ? swimDepthStay : swimDepthEnter;
    const postSurfaceMargin = (wasSwimming || isSwimming) ? swimSurfaceStay : swimSurfaceEnter;
    const nowDeepWater = this.waterVolumeActive && this.submersion.inWater && this.submersion.totalWaterDepthM >= postDepthThreshold;
    const nowSwimming = !flying && nowDeepWater && this.position.y <= this.submersion.surfaceY + postSurfaceMargin;
    const nowWading = !flying && !nowSwimming && this.waterVolumeActive && this.submersion.inWater && this.submersion.feetSubmerged;
    this.onRiverbed = this.submersion.inWater && this.position.y <= this.submersion.riverbedY + 0.08 * this.size;

    // Evaluate titan ground support and fall animation suppression
    const supportInfo = this.titanSupport.evaluateSupport(this.position, this.size, this.velocity.y, dt, colliders);
    if (this.size >= 4 && supportInfo.hasSupport) {
      this.grounded = true;
    }

    // State transition resolution:
    // Voluntary cosmic flight stays in Flight/Hover even underwater; only landing on dry land ends downward flight.
    if (nowSwimming) {
      this.state = 'Swimming';
    } else if (this.grounded && (!flying || (!this.submersion.inWater && this.desired.y <= 0 && !this.input.held('Space')))) {
      this.state = 'Grounded';
    } else if (!flying) {
      this.state = 'Falling';
    }

    // Resolve explicit visual swimming state for CharacterAnimator
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (nowSwimming) {
      this.swimExitTimer = 0;
      const wantsDiveNow = this.input.held('ControlLeft') || this.input.held('ControlRight') || this.input.held('KeyC') || this.input.held('KeyZ');
      const wantsAscendNow = this.input.held('Space');
      const isDeepSubmerged = this.position.y < this.submersion.surfaceY - 1.55 * this.size;
      if (wantsDiveNow || (isDeepSubmerged && this.velocity.y < -1.1 * sizeSpeed)) {
        this.swimmingVisualState = 'SwimmingDive';
      } else if ((wantsAscendNow && this.position.y < this.submersion.surfaceY - 1.30 * this.size) || (isDeepSubmerged && this.velocity.y > 1.1 * sizeSpeed)) {
        this.swimmingVisualState = 'SwimmingAscend';
      } else if (isDeepSubmerged) {
        this.swimmingVisualState = horizontalSpeed > 0.35 ? 'SwimmingSurfaceForward' : 'SwimmingUnderwaterIdle';
      } else if (horizontalSpeed > 0.35) {
        this.swimmingVisualState = 'SwimmingSurfaceForward';
      } else {
        this.swimmingVisualState = 'SwimmingSurfaceIdle';
      }
    } else if (wasSwimming && !flying) {
      this.swimExitTimer = 0.25;
      this.swimmingVisualState = 'SwimmingExit';
    } else if (this.swimExitTimer > 0 && !flying) {
      this.swimExitTimer = Math.max(0, this.swimExitTimer - dt);
      this.swimmingVisualState = this.swimExitTimer > 0 ? 'SwimmingExit' : (nowWading ? 'Wading' : 'None');
    } else if (nowWading) {
      this.swimmingVisualState = 'Wading';
    } else {
      this.swimmingVisualState = 'None';
    }

    // Contact impact craters only on dry land or high-speed meteor strikes
    if (!wasGrounded && this.grounded && !nowSwimming) this.registerImpact();

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

    const bank = horizontalSpeed > 2 ? Math.sin(Math.atan2(-this.velocity.x, -this.velocity.z) - this.facingYaw) : 0;

    // Titan Fall visual check: never trigger jump/fall pose while swimming or diving
    const showFallAnimation = !nowSwimming && !wasSwimming && (this.size >= 4
      ? supportInfo.isFallingVisually
      : (!flying && !this.grounded));

    this.character.animate(
      dt,
      horizontalSpeed / sizeSpeed,
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
      {
        desiredSpeed: this.desiredSpeed,
        grounded: this.grounded && !nowSwimming,
        swimming: nowSwimming,
        wading: nowWading,
        swimmingState: this.swimmingVisualState,
        dodge: this.dodge.kind,
      },
    );

    this.model.position.copy(this.position);
    this.model.scale.setScalar(this.size);
  }

  toggleFlight(): void {
    if (this.state === 'Grounded' || this.state === 'Falling' || this.state === 'Swimming') {
      const wasInWater = this.state === 'Swimming';
      this.state = 'Hover';
      this.flightTakeoffGraceS = 0.65;
      this.armedTier = 'none';
      this.speedMode = 'normal';
      this.velocity.set(0, 5, 0);
      this.position.y += wasInWater ? 0.35 : 0.18;
    } else {
      const sub = manausBathymetry.evaluateSubmersion(this.position, 1.8 * this.size, this.armClockS);
      if (this.waterVolumeActive && sub.inWater && sub.totalWaterDepthM >= 1.15 * this.size && this.position.y <= sub.surfaceY + 0.05) {
        this.state = 'Swimming';
        this.armedTier = 'none';
        this.speedMode = 'ground';
        this.velocity.set(0, 0, 0);
      } else {
        this.state = 'Falling';
      }
    }
  }

  private readonly travelVelocity = new Vector3();

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
    this.travelVelocity.copy(viewForward).normalize().multiplyScalar(speedMps);
    this.character.animate(
      dt,
      speedMps,
      true,
      issprinting,
      'interplanetary',
      this.travelVelocity.y,
      0,
      this.size,
      this.travelVelocity,
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
    const contact = this.lastTerrainContact;
    const slam = this.slamTimer > 0;
    this.slamTimer = 0;
    const impact = resolveContactImpact(this.impactVelocity, contact?.normal ?? { x: 0, y: 1, z: 0 }, this.size, slam, !!contact);
    this.character.animationController.triggerLanding(
      impact.profile === 'titan' ? 'titan'
        : impact.profile === 'meteor' ? 'super'
          : impact.profile === 'soft' ? 'soft' : 'hard',
    );
    if (impact.profile === 'soft') return;
    this.impactPoint.copy(contact?.position ?? this.position);
    this.pendingImpact = impact;
  }

  teleport(position: Vector3): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.armedTier = 'none';
    this.speedMode = 'normal';
    this.model.position.copy(position);
    this.submersion = manausBathymetry.evaluateSubmersion(position, 1.8 * this.size, this.armClockS);
    if (this.waterVolumeActive && this.submersion.inWater && position.y <= this.submersion.surfaceY + 0.5) {
      const isDeep = this.submersion.totalWaterDepthM >= 1.15 * this.size;
      this.state = isDeep ? 'Swimming' : 'Grounded';
      this.swimmingVisualState = isDeep ? 'SwimmingSurfaceIdle' : (this.submersion.feetSubmerged ? 'Wading' : 'None');
    } else {
      this.state = position.y > PhysicsWorld.terrainHeight(position.x, position.z, 0.32 * this.size) + 1 ? 'Hover' : 'Grounded';
      this.swimmingVisualState = 'None';
    }
    this.swimExitTimer = 0;
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
    this.armedTier = 'none';
    this.speedMode = 'normal';
    this.velocity.clampLength(0, FLIGHT.speeds.normal);
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
