import { Group, MathUtils, Vector3 } from 'three/webgpu';
import type { Collider } from '../core/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CharacterModel } from './CharacterModel';
import type { InputController } from './InputController';

export class PlayerController {
  readonly position = new Vector3(0, 38.5, 0);
  readonly velocity = new Vector3();
  readonly forward = new Vector3(0, 0, -1);
  readonly character = new CharacterModel();
  readonly model = this.character.group;
  state: 'Grounded' | 'Hover' | 'Flight' = 'Grounded';
  size = 1;
  speedMultiplier = 1;
  private targetSize = 1;
  private readonly desired = new Vector3();
  private readonly physics = new PhysicsWorld();
  private grounded = false;
  private pose = '';
  private poseTime = 0;

  constructor(root: Group, readonly input: InputController) {
    root.add(this.model); this.model.position.copy(this.position);
  }

  update(dt: number, colliders: readonly Collider[], cameraYaw: number): void {
    dt = Math.min(0.06, dt);
    if (this.input.consume('KeyF')) {
      this.state = this.state === 'Grounded' ? 'Hover' : 'Grounded';
      if (this.state === 'Hover') { this.velocity.y = 5; this.position.y += 0.18; }
    }
    const flying = this.state !== 'Grounded';
    const boosting = flying && this.input.held('KeyB');
    const sprinting = this.input.held('ShiftLeft') || this.input.held('ShiftRight');
    const movementX = Number(this.input.held('KeyD')) - Number(this.input.held('KeyA'));
    const movementZ = Number(this.input.held('KeyS')) - Number(this.input.held('KeyW'));
    const ascent = Number(this.input.held('Space')) - Number(this.input.held('ControlLeft') || this.input.held('ControlRight'));
    const sizeSpeed = Math.sqrt(this.size);
    const speed = (flying ? boosting ? 720 : sprinting ? 155 : 36 : sprinting ? 12 : 5.5) * sizeSpeed * this.speedMultiplier;
    this.desired.set(movementX, flying ? ascent : 0, movementZ);
    if (this.desired.lengthSq() > 0) this.desired.normalize();
    const x = this.desired.x, z = this.desired.z;
    this.desired.x = x * Math.cos(cameraYaw) + z * Math.sin(cameraYaw);
    this.desired.z = -x * Math.sin(cameraYaw) + z * Math.cos(cameraYaw);
    this.desired.multiplyScalar(speed);
    // Boost follows forward even without W, making B a distinct superspeed action.
    if (boosting && movementX === 0 && movementZ === 0 && ascent === 0) this.desired.set(-Math.sin(cameraYaw) * speed, 0, -Math.cos(cameraYaw) * speed);
    const acceleration = 1 - Math.exp(-dt * (flying ? boosting ? 2.4 : 4.5 : 13));
    this.velocity.x = MathUtils.lerp(this.velocity.x, this.desired.x, acceleration);
    this.velocity.z = MathUtils.lerp(this.velocity.z, this.desired.z, acceleration);
    if (flying) {
      this.velocity.y = MathUtils.lerp(this.velocity.y, this.desired.y, acceleration);
      this.state = this.desired.lengthSq() > 1 || this.velocity.lengthSq() > 36 ? 'Flight' : 'Hover';
    } else {
      if (this.input.consume('Space') && this.grounded) { this.velocity.y = 10 * sizeSpeed; this.grounded = false; }
      this.velocity.y -= 25 * dt * sizeSpeed;
    }
    this.size = MathUtils.lerp(this.size, this.targetSize, 1 - Math.exp(-dt * 4));
    if (Math.abs(this.size - this.targetSize) < 0.005) this.size = this.targetSize;
    this.grounded = this.physics.move(this.position, this.velocity, dt, 0.32 * this.size, 2.1 * this.size, colliders, !flying ? 0.55 * this.size : 0);
    this.position.y = Math.min(12000, this.position.y);
    if (this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z > 0.2) {
      this.forward.set(this.velocity.x, 0, this.velocity.z).normalize();
      const angle = Math.atan2(-this.forward.x, -this.forward.z);
      this.model.rotation.y += Math.atan2(Math.sin(angle - this.model.rotation.y), Math.cos(angle - this.model.rotation.y)) * Math.min(1, dt * 8);
    }
    this.poseTime -= dt;
    if (this.poseTime <= 0) this.pose = '';
    this.character.animate(dt, Math.hypot(this.velocity.x, this.velocity.z) / sizeSpeed, flying, boosting, this.pose);
    this.model.position.copy(this.position); this.model.scale.setScalar(this.size);
  }

  teleport(position: Vector3): void {
    this.position.copy(position); this.velocity.set(0, 0, 0); this.model.position.copy(position);
    this.state = position.y > 1 ? 'Hover' : 'Grounded'; this.grounded = false;
  }
  setSize(scale: number): void { this.targetSize = MathUtils.clamp(scale, 1, 22); this.powerPose('giant', 1.5); }
  powerPose(name: string, duration = 0.5): void { this.pose = name; this.poseTime = duration; }
}
