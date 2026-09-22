import { Group, MathUtils, Vector3 } from 'three/webgpu';
import type { Collider } from '../core/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CharacterModel } from './CharacterModel';
import type { InputController } from './InputController';
import { SPACE, WORLD } from '../core/config';
import { FLIGHT, type FlightSpeedMode } from './flightConfig';

export class PlayerController {
  readonly position = new Vector3(WORLD.spawn.x, WORLD.spawn.y, WORLD.spawn.z);
  readonly velocity = new Vector3();
  readonly forward = new Vector3(0, 0, -1);
  readonly character = new CharacterModel();
  readonly model = this.character.group;
  state: 'Grounded' | 'Hover' | 'Flight' = 'Grounded';
  size = 1;
  speedMultiplier = 1;
  speedMode: FlightSpeedMode = 'ground';
  beforeMove?: (position: Vector3, velocity: Vector3, dt: number) => readonly Collider[];
  private jumps = 0;
  private megaEnabled = false;
  private megaNeedsBoostRelease = false;
  private targetSize = 1;
  private readonly desired = new Vector3();
  private readonly physics = new PhysicsWorld();
  private grounded = false;
  private pose = '';
  private poseTime = 0;

  constructor(root: Group, readonly input: InputController) {
    root.add(this.model); this.model.position.copy(this.position);
  }

  get megaMode(): boolean { return this.megaEnabled; }
  set megaMode(enabled: boolean) {
    if (enabled === this.megaEnabled) return;
    this.megaEnabled = enabled;
    // Arming while already boosting cannot unexpectedly quadruple the speed.
    this.megaNeedsBoostRelease = enabled && this.input.held('KeyB');
  }
  toggleMegaMode(): void { this.megaMode = !this.megaMode; }

  update(dt: number, colliders: readonly Collider[], cameraYaw: number, cameraPitch = 0): void {
    dt = Math.min(0.06, dt);
    if (this.input.consume('KeyV')) this.toggleMegaMode();
    if (!this.input.held('KeyB')) this.megaNeedsBoostRelease = false;
    if (this.input.consume('KeyF')) {
      this.state = this.state === 'Grounded' ? 'Hover' : 'Grounded';
      if (this.state === 'Hover') { this.velocity.y = 5; this.position.y += 0.18; }
    }
    const flying = this.state !== 'Grounded';
    const boosting = this.input.held('KeyB');
    const sprinting = this.input.held('ShiftLeft') || this.input.held('ShiftRight');
    const movementX = Number(this.input.held('KeyD')) - Number(this.input.held('KeyA'));
    const movementZ = Number(this.input.held('KeyS')) - Number(this.input.held('KeyW'));
    const ascent = Number(this.input.held('Space')) - Number(this.input.held('ControlLeft') || this.input.held('ControlRight'));
    const sizeSpeed = Math.sqrt(this.size);
    this.speedMode = flying ? boosting ? this.megaEnabled && !this.megaNeedsBoostRelease ? 'mega' : 'super' : sprinting ? 'fast' : 'normal' : 'ground';
    // Flight tiers retain their meaning in giant form; stride length scales walking.
    const speed = this.speedMode === 'ground'
      ? Math.min(3000, (boosting ? this.megaEnabled && !this.megaNeedsBoostRelease ? 650 : 120 : sprinting ? FLIGHT.runSpeed : FLIGHT.walkSpeed) * sizeSpeed * this.speedMultiplier)
      : Math.min(FLIGHT.maxSpeed, FLIGHT.speeds[this.speedMode] * this.speedMultiplier);
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
    const response = this.speedMode === 'ground' ? FLIGHT.groundResponse
      : this.desired.lengthSq() < this.velocity.lengthSq() ? FLIGHT.response.braking : FLIGHT.response[this.speedMode];
    const acceleration = 1 - Math.exp(-dt * response);
    this.velocity.x = MathUtils.lerp(this.velocity.x, this.desired.x, acceleration);
    this.velocity.z = MathUtils.lerp(this.velocity.z, this.desired.z, acceleration);
    if (flying) {
      this.velocity.y = MathUtils.lerp(this.velocity.y, this.desired.y, acceleration);
      this.state = this.desired.lengthSq() > 1 || this.velocity.lengthSq() > 36 ? 'Flight' : 'Hover';
    } else {
      if (this.grounded) this.jumps = 0;
      if (this.input.consume('Space') && this.jumps < 2) {
        this.jumps = this.grounded ? 1 : 2;
        this.velocity.y = 10 * sizeSpeed; this.grounded = false;
        if (this.desired.lengthSq() > 1) {
          const direction = this.desired.clone().normalize();
          const start = this.position.clone(); start.y += .65 * this.size;
          const hit = PhysicsWorld.raycast(start, direction, colliders, 1.4 * this.size, .2 * this.size);
          if (hit?.collider) {
            const rise = hit.collider.y + hit.collider.height / 2 - this.position.y;
            start.y = this.position.y + 2.2 * this.size;
            const ceiling = PhysicsWorld.raycast(start, new Vector3(0, 1, 0), colliders, Math.max(0, rise), .32 * this.size);
            if (rise > .55 * this.size && rise < 2.5 * this.size && !ceiling) {
              this.velocity.y = Math.sqrt(2 * 25 * sizeSpeed * (rise + .5 * this.size));
              this.powerPose('vault', .55);
            }
          }
        }
      }
      this.velocity.y -= 25 * dt * sizeSpeed;
    }
    this.size = MathUtils.lerp(this.size, this.targetSize, 1 - Math.exp(-dt * 4));
    if (Math.abs(this.size - this.targetSize) < 0.005) this.size = this.targetSize;
    if (!flying && this.velocity.length() >= 420 && this.beforeMove) colliders = this.beforeMove(this.position, this.velocity, dt);
    this.grounded = this.physics.move(this.position, this.velocity, dt, 0.32 * this.size, 2.1 * this.size, colliders, !flying ? 0.55 * this.size : 0);
    // The old 12 km lid made orbit unreachable; climbing out of the atmosphere is now a real place to go.
    if (this.position.y >= SPACE.maxAltitude) { this.position.y = SPACE.maxAltitude; this.velocity.y = Math.min(0, this.velocity.y); }
    if (this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z > 0.2) {
      this.forward.set(this.velocity.x, 0, this.velocity.z).normalize();
      const angle = Math.atan2(-this.forward.x, -this.forward.z);
      this.model.rotation.y += Math.atan2(Math.sin(angle - this.model.rotation.y), Math.cos(angle - this.model.rotation.y)) * Math.min(1, dt * 8);
    }
    this.poseTime -= dt;
    if (this.poseTime <= 0) this.pose = '';
    const bank = Math.sin(Math.atan2(-this.velocity.x, -this.velocity.z) - this.model.rotation.y);
    this.character.animate(dt, Math.hypot(this.velocity.x, this.velocity.z) / sizeSpeed, flying, boosting, this.pose || (!flying && !this.grounded ? 'jump' : ''), this.velocity.y / sizeSpeed, bank);
    this.model.position.copy(this.position); this.model.scale.setScalar(this.size);
  }

  teleport(position: Vector3): void {
    this.position.copy(position); this.velocity.set(0, 0, 0); this.model.position.copy(position);
    this.state = position.y > 1 ? 'Hover' : 'Grounded'; this.grounded = false; this.jumps = 0;
  }
  setSize(scale: number): void { this.targetSize = MathUtils.clamp(scale, 1, 1000 / 2.07); this.powerPose('giant', 1.5); }
  powerPose(name: string, duration = 0.5): void { this.pose = name; this.poseTime = duration; }
}
