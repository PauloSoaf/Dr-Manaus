import { MathUtils, PerspectiveCamera, Vector3 } from 'three/webgpu';
import type { Collider } from '../core/types';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { InputController } from './InputController';
import type { PlayerController } from './PlayerController';
import { WORLD } from '../core/config';

export class CameraController {
  mode: 'rear' | 'shoulder' | 'first' | 'front' | 'lookBack' = 'rear';
  yaw = 0;
  pitch = 0.19;
  /** Set from the pause menu; the speed widening is applied on top of `baseFov`. */
  sensitivity = 1;
  invertY = false;
  baseFov = 57;
  /** Extra degrees contributed by the speed effect, already damped by the caller. */
  speedFov = 0;
  intro = true;
  private elapsed = 0;
  private shakeAmount = 0;
  private readonly target = new Vector3();
  private readonly desired = new Vector3();
  private readonly globalPosition = new Vector3(0, 65, 110);
  private readonly direction = new Vector3();

  constructor(readonly camera: PerspectiveCamera, readonly input: InputController) {}
  shake(amount: number): void { this.shakeAmount = Math.max(this.shakeAmount, amount); }
  skipIntro(): void { this.intro = false; }

  update(player: PlayerController, origin: Vector3, dt: number, colliders: readonly Collider[]): void {
    const switched = this.input.consume('F5');
    if (switched) {
      const modes = ['rear', 'shoulder', 'first', 'front', 'lookBack'] as const;
      this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length];
      this.intro = false;
    }
    player.model.visible = this.mode !== 'first' && this.mode !== 'lookBack';
    this.elapsed += dt;
    if (this.input.held('KeyW') || this.input.held('KeyA') || this.input.held('KeyS') || this.input.held('KeyD') || this.input.held('KeyF') || Math.abs(this.input.mouseDelta.x) > 1) this.intro = false;
    this.target.copy(player.position); this.target.y += 1.5 * player.size;
    if (this.intro && this.elapsed < 6) {
      const progress = MathUtils.smoothstep(this.elapsed, 0.4, 6);
      // Ends the fly-in facing the Teatro Amazonas across the Largo, the game's first sight.
      this.yaw = WORLD.spawnYaw + (progress - 1) * 2.94;
      const distance = MathUtils.lerp(110, 9, progress);
      this.desired.set(Math.sin(this.yaw) * distance, MathUtils.lerp(27, 3.2, progress), Math.cos(this.yaw) * distance).add(this.target);
      this.globalPosition.lerp(this.desired, Math.min(1, dt * 5));
    } else {
      this.intro = false;
      if (this.input.enabled) {
        this.yaw -= this.input.mouseDelta.x * 0.00215 * this.sensitivity;
        if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
        else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
        this.pitch = MathUtils.clamp(this.pitch + this.input.mouseDelta.y * 0.00195 * this.sensitivity * (this.invertY ? -1 : 1), -1.15, 1.27);
      }
      const distance = (8.3 + Math.min(7, player.velocity.length() * 0.014)) * Math.pow(player.size, 0.83);
      this.direction.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      if (this.mode === 'front') {
        // Face the actual character, independently of the movement/camera heading.
        this.direction.set(-Math.sin(player.model.rotation.y) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(player.model.rotation.y) * Math.cos(this.pitch));
      }
      if (this.mode === 'shoulder') {
        const side = 1.5 * Math.pow(player.size, .83);
        this.target.x += Math.cos(this.yaw) * side; this.target.z -= Math.sin(this.yaw) * side;
      }
      const obstruction = PhysicsWorld.raycast(this.target, this.direction, colliders, distance, 0.35);
      const safeDistance = obstruction ? Math.max(0.1, obstruction.distance - 0.6) : distance;
      this.desired.copy(this.target).addScaledVector(this.direction, safeDistance);
      this.desired.y = Math.max(PhysicsWorld.terrainHeight(this.desired.x, this.desired.z) + .3, this.desired.y);
      if (switched || this.globalPosition.distanceToSquared(this.desired) > 400 * 400) this.globalPosition.copy(this.desired);
      else this.globalPosition.lerp(this.desired, 1 - Math.exp(-dt * (obstruction ? 25 : 9)));
      if (this.mode === 'first' || this.mode === 'lookBack') {
        this.globalPosition.copy(player.position); this.globalPosition.y += 1.94 * player.size;
        this.target.copy(this.globalPosition).addScaledVector(this.direction, this.mode === 'lookBack' ? 100 : -100);
      }
    }
    const targetFov = Math.min(112, this.baseFov + Math.min(17, player.velocity.length() * 0.028) + this.speedFov);
    this.camera.fov = MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-dt * 3));
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.globalPosition).sub(origin);
    this.shakeAmount *= Math.exp(-dt * 9);
    if (this.shakeAmount > 0.001) { this.camera.position.x += Math.sin(this.elapsed * 83) * this.shakeAmount; this.camera.position.y += Math.cos(this.elapsed * 97) * this.shakeAmount; }
    this.target.sub(origin);
    this.camera.lookAt(this.target);
  }
}
