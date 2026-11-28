import { Group, Vector3 } from 'three/webgpu';
import type { Collider } from '../../src/core/types';
import type { InputController } from '../../src/player/InputController';
import { PlayerController } from '../../src/player/PlayerController';

/** Headless course driven by the production player and collision solver. */
export function foundationLab(spawn = new Vector3(), colliders: readonly Collider[] = []) {
  const held = new Set<string>();
  const edges = new Set<string>();
  const input = {
    enabled: true,
    mouseDelta: { x: 0, y: 0 },
    held: (code: string) => held.has(code),
    pressed: (code: string) => edges.has(code),
    consume: (code: string) => edges.delete(code),
  } as InputController;
  const player = new PlayerController(new Group(), input);
  player.teleport(spawn);
  let time = 0;
  return {
    player, held, edges,
    step(dt: number, yaw = 0, pitch = 0) {
      time += dt;
      player.updateLocalFrame(dt, colliders, yaw, pitch, time);
      return time;
    },
  };
}
