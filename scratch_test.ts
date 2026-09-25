import { Vector3, Group } from 'three';
import { AnimationController } from './src/player/animations/AnimationController.ts';

const controller = new AnimationController();
const params = {
  speed: 0,
  verticalSpeed: 5,
  velocity: new Vector3(0, 5, 0),
  flying: false,
  grounded: false,
  boosting: false,
  size: 1,
  turn: 0,
  speedMode: 'normal' as const,
  facingYaw: 0,
};

const bones = Array.from({ length: 11 }, () => ({ rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 }, quaternion: { identity: () => {} } } as any));

controller.triggerDoubleJump('front', 1);
console.log('Before update:', controller.doubleJumpProgress);
controller.update(bones, 0.22, params);
console.log('After update:', controller.doubleJumpProgress);
console.log('rootOrientation w:', controller.rootOrientation.w);
