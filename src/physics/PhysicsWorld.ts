import { Vector3 } from 'three/webgpu';
import type { Collider } from '../core/types';

export interface RayHit { distance: number; collider: Collider | null; point: Vector3 }

/** Axis-swept character AABB. Continuous face crossing prevents boost tunnelling. */
export class PhysicsWorld {
  private readonly nearby: Collider[] = [];

  move(position: Vector3, velocity: Vector3, dt: number, radius: number, height: number, colliders: readonly Collider[], stepHeight = 0): boolean {
    const deltaX = velocity.x * dt, deltaY = velocity.y * dt, deltaZ = velocity.z * dt;
    const reach = Math.max(Math.abs(deltaX), Math.abs(deltaY), Math.abs(deltaZ)) + height + radius;
    this.nearby.length = 0;
    for (const box of colliders) {
      if (Math.abs(box.x - position.x) <= box.width / 2 + reach && Math.abs(box.z - position.z) <= box.depth / 2 + reach && Math.abs(box.y - position.y) <= box.height / 2 + reach) this.nearby.push(box);
    }
    // Small substeps preserve sliding at corners; each axis remains swept.
    const steps = Math.min(8, Math.max(1, Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaY), Math.abs(deltaZ)) / Math.max(radius * 3, 2))));
    let grounded = false;
    for (let step = 0; step < steps; step++) {
      for (const axis of ['x', 'z'] as const) {
        let travel = velocity[axis] * dt / steps;
        const other = axis === 'x' ? 'z' : 'x';
        for (const box of this.nearby) {
          const half = (axis === 'x' ? box.width : box.depth) / 2;
          const otherHalf = (axis === 'x' ? box.depth : box.width) / 2;
          const bottom = box.y - box.height / 2, top = box.y + box.height / 2;
          if (position.y >= top - 0.01 || position.y + height <= bottom + 0.01 || Math.abs(position[other] - box[other]) >= otherHalf + radius - 0.001) continue;
          const low = box[axis] - half - radius, high = box[axis] + half + radius;
          const crossing = (travel > 0 && position[axis] <= low + 0.001 && position[axis] + travel > low) || (travel < 0 && position[axis] >= high - 0.001 && position[axis] + travel < high);
          if (!crossing) continue;
          if (stepHeight > 0 && top - position.y <= stepHeight && velocity.y <= 0) { position.y = top + 0.002; grounded = true; continue; }
          travel = (travel > 0 ? low : high) - position[axis];
          velocity[axis] = 0;
        }
        position[axis] += travel;
      }
      let rise = velocity.y * dt / steps;
      for (const box of this.nearby) {
        if (Math.abs(position.x - box.x) >= box.width / 2 + radius - 0.001 || Math.abs(position.z - box.z) >= box.depth / 2 + radius - 0.001) continue;
        const bottom = box.y - box.height / 2, top = box.y + box.height / 2;
        if (rise <= 0 && position.y >= top - 0.01 && position.y + rise <= top) { rise = top - position.y; velocity.y = 0; grounded = true; }
        else if (rise > 0 && position.y + height <= bottom + 0.01 && position.y + height + rise >= bottom) { rise = bottom - height - position.y; velocity.y = 0; }
      }
      position.y += rise;
      if (position.y <= 0) { position.y = 0; velocity.y = Math.max(0, velocity.y); grounded = true; }
    }
    return grounded;
  }

  static raycast(origin: Vector3, direction: Vector3, colliders: readonly Collider[], maxDistance: number, margin = 0, ground = false): RayHit | null {
    let nearest = maxDistance;
    let hit: Collider | null = null;
    let found = false;
    for (const box of colliders) {
      let enter = 0, leave = nearest;
      for (const axis of ['x', 'y', 'z'] as const) {
        const half = (axis === 'x' ? box.width : axis === 'y' ? box.height : box.depth) / 2 + margin;
        const lo = box[axis] - half, hi = box[axis] + half;
        const speed = direction[axis];
        if (Math.abs(speed) < 0.000001) {
          if (origin[axis] < lo || origin[axis] > hi) { enter = Infinity; break; }
        } else {
          let a = (lo - origin[axis]) / speed, b = (hi - origin[axis]) / speed;
          if (a > b) [a, b] = [b, a];
          enter = Math.max(enter, a); leave = Math.min(leave, b);
          if (enter > leave) break;
        }
      }
      if (enter <= leave && enter > 0.025 && enter < nearest) { nearest = enter; hit = box; found = true; }
    }
    if (ground && direction.y < -0.0001) {
      const distance = -origin.y / direction.y;
      if (distance > 0 && distance < nearest) { nearest = distance; hit = null; found = true; }
    }
    return found ? { distance: nearest, collider: hit, point: origin.clone().addScaledVector(direction, nearest) } : null;
  }

  static safeLanding(destination: Vector3, colliders: readonly Collider[], radius: number, height: number): Vector3 {
    const safe = destination.clone();
    safe.y = Math.max(0.05, safe.y);
    for (const box of colliders) {
      if (Math.abs(safe.x - box.x) < box.width / 2 + radius && Math.abs(safe.z - box.z) < box.depth / 2 + radius && safe.y < box.y + box.height / 2 && safe.y + height > box.y - box.height / 2) safe.y = box.y + box.height / 2 + 0.05;
    }
    return safe;
  }
}
