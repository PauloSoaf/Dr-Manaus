import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three/webgpu';
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
  readonly globalPosition = new Vector3(0, 65, 110);
  private readonly direction = new Vector3();
  private readonly previousPlayer = new Vector3();
  private readonly pivotOffset = new Vector3();
  private readonly collisionDirection = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private following = false;
  inSpace = false;
  private wasInSpace = false;
  private lookPrepared = false;
  private readonly spaceOrientation = new Quaternion();
  private swimRigWeight = 0;
  private diveRigWeight = 0;

  constructor(readonly camera: PerspectiveCamera, readonly input: InputController) {}
  shake(amount: number): void { this.shakeAmount = Math.max(this.shakeAmount, amount); }
  skipIntro(): void { this.intro = false; }

  /** Read mouse intent before flight thrust; the rendered crosshair and W use this same view. */
  prepareLook(): void {
    if (this.lookPrepared) return;
    this.lookPrepared = true;
    if (this.inSpace && !this.wasInSpace) this.spaceOrientation.copy(this.camera.quaternion);
    if (!this.inSpace && this.wasInSpace) this.setLocalView(this.camera.getWorldDirection(new Vector3()).toArray());
    this.wasInSpace = this.inSpace;
    const dx = this.input.enabled ? this.input.mouseDelta.x * 0.00215 * this.sensitivity : 0;
    const dy = this.input.enabled ? this.input.mouseDelta.y * 0.00195 * this.sensitivity * (this.invertY ? -1 : 1) : 0;
    if (this.inSpace) {
      this.spaceOrientation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -dx))
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -dy)).normalize();
      this.camera.quaternion.copy(this.spaceOrientation);
      this.camera.updateMatrixWorld();
      const forward = this.camera.getWorldDirection(new Vector3());
      // Compatibility readouts only; the quaternion owns space orientation through both poles.
      this.yaw = Math.atan2(-forward.x, -forward.z);
      this.pitch = Math.asin(MathUtils.clamp(-forward.y, -1, 1));
    } else {
      this.yaw = MathUtils.euclideanModulo(this.yaw - dx + Math.PI, Math.PI * 2) - Math.PI;
      this.pitch = MathUtils.clamp(this.pitch + dy, -1.15, 1.27);
    }
  }

  /** Caller has already transported the outgoing aim into the new body's local ENU. */
  setLocalView(forward: readonly number[]): void {
    this.inSpace = false;
    this.wasInSpace = false;
    this.yaw = Math.atan2(-forward[0], -forward[2]);
    this.pitch = MathUtils.clamp(Math.asin(MathUtils.clamp(-forward[1], -1, 1)), -1.15, 1.27);
    this.camera.quaternion.setFromEuler(new Euler(-this.pitch, this.yaw, 0, 'YXZ'));
    this.following = false;
  }

  /**
   * The camera has no scene scale.
   *
   * It used to take one, defaulting to 1, and no caller ever passed anything else. Scaling the
   * scene is not how this engine gets from metres to astronomical distances -- reference frames
   * and a logarithmic depth buffer are -- and a scale that also multiplies `near` changes depth
   * behaviour in a way nobody had measured. Dead scaffolding that quietly fights the real
   * mechanism is worse than no mechanism, so it is gone.
   */
  update(
    player: PlayerController,
    origin: Vector3,
    dt: number,
    colliders: readonly Collider[],
    isVehicleOccupied = false,
    vehicleType: string = 'car',
  ): void {
    this.prepareLook();
    const switched = this.input.consume('F5');
    if (switched) {
      const modes = ['rear', 'shoulder', 'first', 'front', 'lookBack'] as const;
      this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length];
      this.intro = false;
    }
    player.model.visible = !isVehicleOccupied && this.mode !== 'first' && this.mode !== 'lookBack';
    this.elapsed += dt;
    if (this.input.held('KeyW') || this.input.held('KeyA') || this.input.held('KeyS') || this.input.held('KeyD') || this.input.held('KeyF') || Math.abs(this.input.mouseDelta.x) > 1) this.intro = false;
    this.target.copy(player.position); this.target.y += 1.5 * player.size;
    if (this.inSpace) {
      this.intro = false;
      const baseDist = isVehicleOccupied ? (vehicleType === 'spaceship' || vehicleType === 'rocket' ? 18.0 : 12.0) : 6.2;
      const distance = (this.mode === 'first' || this.mode === 'lookBack') ? 0 : baseDist * player.size;
      this.desired.set(0, (isVehicleOccupied ? 2.5 : 1.5) * player.size, distance).applyQuaternion(this.spaceOrientation).add(player.position);
      this.globalPosition.copy(this.desired);
      this.following = true;
    } else if (this.intro && this.elapsed < 6) {
      const progress = MathUtils.smoothstep(this.elapsed, 0.4, 6);
      // Ends the fly-in facing the Teatro Amazonas across the Largo, the game's first sight.
      this.yaw = WORLD.spawnYaw + (progress - 1) * 2.94;
      const distance = MathUtils.lerp(110, 9, progress);
      this.desired.set(Math.sin(this.yaw) * distance, MathUtils.lerp(27, 3.2, progress), Math.cos(this.yaw) * distance).add(this.target);
      this.globalPosition.lerp(this.desired, Math.min(1, dt * 5));
    } else {
      this.intro = false;
      // Transport the rig with its subject before damping the orbit. World-space
      // damping accumulated speed/rate metres of lag, then repeatedly snapped at 400 m.
      if (this.following) this.globalPosition.add(player.position).sub(this.previousPlayer);
      let baseDistance = 6.2;
      let heightOffset = 1.05;
      if (isVehicleOccupied) {
        if (vehicleType === 'car') {
          baseDistance = 8.5;
          heightOffset = 1.35;
        } else if (vehicleType === 'hovercraft') {
          baseDistance = 10.5;
          heightOffset = 1.7;
        } else if (vehicleType === 'boat') {
          baseDistance = 14.0;
          heightOffset = 2.4;
        } else if (vehicleType === 'airplane') {
          baseDistance = 16.5;
          heightOffset = 2.6;
        } else if (vehicleType === 'saucer') {
          baseDistance = 15.0;
          heightOffset = 2.5;
        } else if (vehicleType === 'spaceship' || vehicleType === 'rocket') {
          baseDistance = 22.0;
          heightOffset = 3.6;
        }
        this.target.copy(player.position);
        this.target.y += heightOffset;
      } else {
        const surfY = player.submersion?.surfaceY ?? 0;
        const targetSwimWeight = player.state === 'Swimming' ? 1.0 : 0.0;
        this.swimRigWeight = MathUtils.lerp(this.swimRigWeight, targetSwimWeight, 1 - Math.exp(-dt * 4.0));

        const targetDiveWeight = (player.state === 'Swimming' && player.position.y < surfY - 1.8 * player.size) ? 1.0 : 0.0;
        this.diveRigWeight = MathUtils.lerp(this.diveRigWeight, targetDiveWeight, 1 - Math.exp(-dt * 3.5));

        const swimDistance = MathUtils.lerp(7.8, 6.5, this.diveRigWeight);
        baseDistance = MathUtils.lerp(baseDistance, swimDistance, this.swimRigWeight);

        const regularTargetY = player.position.y + (player.state !== 'Grounded' ? 1.05 * player.size : 0);
        const surfaceTargetY = Math.max(player.position.y + 1.65 * player.size, surfY + 0.72 * player.size);
        const diveTargetY = player.position.y + 1.15 * player.size;
        const aquaticTargetY = MathUtils.lerp(surfaceTargetY, diveTargetY, this.diveRigWeight);

        this.target.copy(player.position);
        if (player.state !== 'Grounded' && this.swimRigWeight < 0.1) {
          this.pivotOffset.set(0, 1.05 * player.size, 0).applyEuler(player.character.hips.rotation).applyAxisAngle(this.up, player.model.rotation.y);
          this.target.add(this.pivotOffset);
        } else {
          this.target.y = MathUtils.lerp(regularTargetY, aquaticTargetY, this.swimRigWeight);
        }
      }

      const swimMinPitch = MathUtils.lerp(0.38, 0.18, this.diveRigWeight);
      const minPitch = !isVehicleOccupied ? MathUtils.lerp(0.0, swimMinPitch, this.swimRigWeight) : 0.0;
      const effectivePitch = Math.max(this.pitch, minPitch);

      const distance = (baseDistance + Math.min(isVehicleOccupied ? 4.0 : 0.6, player.velocity.length() * (isVehicleOccupied ? 0.02 : 0.001))) * player.size;
      this.direction.set(Math.sin(this.yaw) * Math.cos(effectivePitch), Math.sin(effectivePitch), Math.cos(this.yaw) * Math.cos(effectivePitch));
      if (this.mode === 'front') {
        // Face the actual character, independently of the movement/camera heading.
        this.direction.set(-Math.sin(player.model.rotation.y) * Math.cos(effectivePitch), Math.sin(effectivePitch), -Math.cos(player.model.rotation.y) * Math.cos(effectivePitch));
      }
      if (this.mode === 'shoulder') {
        const side = 1.5 * Math.pow(player.size, .83);
        this.target.x += Math.cos(this.yaw) * side; this.target.z -= Math.sin(this.yaw) * side;
      }
      const obstruction = this.inSpace ? null : PhysicsWorld.raycast(this.target, this.direction, colliders, distance, 0.35);
      const safeDistance = obstruction ? Math.max(0.1, obstruction.distance - 0.6) : distance;
      this.desired.copy(this.target).addScaledVector(this.direction, safeDistance);
      if (!this.inSpace) {
        this.desired.y = Math.max(PhysicsWorld.terrainHeight(this.desired.x, this.desired.z) + .35, this.desired.y);
        if (this.swimRigWeight > 0.05 && this.diveRigWeight < 0.5 && player.submersion?.inWater) {
          const surfY = player.submersion.surfaceY;
          const minSwimCamY = surfY + MathUtils.lerp(1.2, 2.8, this.swimRigWeight) * player.size;
          this.desired.y = Math.max(this.desired.y, minSwimCamY);
        }
      }
      if (switched || !this.following) this.globalPosition.copy(this.desired);
      else this.globalPosition.lerp(this.desired, 1 - Math.exp(-dt * (obstruction ? 25 : 9)));

      if (obstruction && !this.inSpace) {
        this.pivotOffset.subVectors(this.globalPosition, this.target);
        const hit = PhysicsWorld.raycast(this.target, this.collisionDirection.copy(this.pivotOffset).normalize(), colliders, this.pivotOffset.length(), .35);
        if (hit) this.globalPosition.copy(this.target).addScaledVector(this.pivotOffset.normalize(), Math.max(.1, hit.distance - .6));
      }

      // Soft water surface floor guard during surface swimming
      if (!this.inSpace && this.swimRigWeight > 0.5 && this.diveRigWeight < 0.2 && player.submersion?.inWater) {
        const waterFloor = player.submersion.surfaceY + 0.25 * player.size;
        if (this.globalPosition.y < waterFloor) this.globalPosition.y = waterFloor;
      }
      if (this.mode === 'first' || this.mode === 'lookBack') {
        this.globalPosition.copy(player.position); this.globalPosition.y += 1.94 * player.size;
        this.target.copy(this.globalPosition).addScaledVector(this.direction, this.mode === 'lookBack' ? 100 : -100);
      }
      this.following = true;
    }
    this.previousPlayer.copy(player.position);
    const targetFov = Math.min(112, this.baseFov + Math.min(6, player.velocity.length() * .006 + this.speedFov * .12));
    this.camera.fov = MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-dt * 3));
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.globalPosition).sub(origin);
    this.shakeAmount *= Math.exp(-dt * 9);
    if (this.shakeAmount > 0.001) { this.camera.position.x += Math.sin(this.elapsed * 83) * this.shakeAmount; this.camera.position.y += Math.cos(this.elapsed * 97) * this.shakeAmount; }
    this.target.sub(origin);
    if (this.inSpace) this.camera.quaternion.copy(this.spaceOrientation);
    else this.camera.lookAt(this.target);
    this.lookPrepared = false;
  }
}

/** Camera-local axes stay orthonormal at zenith/nadir; there is no world-up fallback. */
export function cameraFlightAxes(camera: PerspectiveCamera) {
  const orientation = camera.getWorldQuaternion(new Quaternion());
  return { forward: new Vector3(0, 0, -1).applyQuaternion(orientation),
    right: new Vector3(1, 0, 0).applyQuaternion(orientation),
    up: new Vector3(0, 1, 0).applyQuaternion(orientation) };
}
