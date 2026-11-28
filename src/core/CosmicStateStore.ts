/**
 * CosmicStateStore.ts
 *
 * High-performance Data-Oriented Entity Component System (ECS) based on
 * Structure of Arrays (SoA) for up to 50,000 active entities.
 *
 * Stores positions, velocities, health, shields, and metadata in contiguous typed arrays
 * (Float32Array / Uint8Array). Features zero-allocation trajectory integration,
 * entity ID recycling, direct InstancedMesh matrix buffer updates, and Web Worker readiness.
 *
 * Implements architectural requirements from docs/research/19-data-oriented-ecs-and-web-worker-concurrency.md.
 */

import type { InstancedMesh } from 'three/webgpu';

export const MAX_ENTITIES = 50_000;

export type EntityKind = 'vehicle' | 'npc' | 'vessel' | 'projectile' | 'celestial' | 'prop';

export const ENTITY_KIND_CODES: Record<EntityKind, number> = {
  vehicle: 1,
  npc: 2,
  vessel: 3,
  projectile: 4,
  celestial: 5,
  prop: 6,
};

export interface SoAPosition {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
}

export interface SoAVelocity {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
}

export interface SoAHealth {
  readonly current: Float32Array;
  readonly max: Float32Array;
  readonly shield: Float32Array;
}

export interface SoAMetadata {
  readonly kind: Uint8Array;
  readonly flags: Uint8Array;
  readonly alive: Uint8Array;
}

/**
 * Contiguous Structure of Arrays memory layout for extreme cache line efficiency.
 */
export class CosmicStateStore {
  readonly maxEntities: number;

  readonly position: SoAPosition;
  readonly velocity: SoAVelocity;
  readonly health: SoAHealth;
  readonly metadata: SoAMetadata;

  private readonly freeIds: Int32Array;
  private freeCount: number;

  readonly activeIds: Int32Array;
  private _activeCount = 0;

  constructor(maxEntities = MAX_ENTITIES) {
    this.maxEntities = maxEntities;

    // Allocate contiguous typed arrays
    this.position = {
      x: new Float32Array(maxEntities),
      y: new Float32Array(maxEntities),
      z: new Float32Array(maxEntities),
    };

    this.velocity = {
      x: new Float32Array(maxEntities),
      y: new Float32Array(maxEntities),
      z: new Float32Array(maxEntities),
    };

    this.health = {
      current: new Float32Array(maxEntities),
      max: new Float32Array(maxEntities),
      shield: new Float32Array(maxEntities),
    };

    this.metadata = {
      kind: new Uint8Array(maxEntities),
      flags: new Uint8Array(maxEntities),
      alive: new Uint8Array(maxEntities),
    };

    // Entity recycling pool
    this.freeIds = new Int32Array(maxEntities);
    for (let i = 0; i < maxEntities; i++) {
      this.freeIds[i] = maxEntities - 1 - i;
    }
    this.freeCount = maxEntities;

    this.activeIds = new Int32Array(maxEntities);
  }

  get activeCount(): number {
    return this._activeCount;
  }

  /**
   * Spawns an entity into the contiguous typed arrays, returning its unique integer ID.
   * Recycles previously destroyed entity IDs without leaking memory.
   */
  createEntity(
    kind: EntityKind = 'prop',
    x = 0,
    y = 0,
    z = 0,
    maxHp = 100,
    maxShield = 0,
  ): number {
    if (this.freeCount <= 0) {
      throw new Error(`CosmicStateStore capacity reached (${this.maxEntities} entities)`);
    }

    const id = this.freeIds[--this.freeCount];

    this.position.x[id] = x;
    this.position.y[id] = y;
    this.position.z[id] = z;

    this.velocity.x[id] = 0;
    this.velocity.y[id] = 0;
    this.velocity.z[id] = 0;

    this.health.current[id] = maxHp;
    this.health.max[id] = maxHp;
    this.health.shield[id] = maxShield;

    this.metadata.kind[id] = ENTITY_KIND_CODES[kind] ?? 0;
    this.metadata.flags[id] = 0;
    this.metadata.alive[id] = 1;

    this.activeIds[this._activeCount++] = id;
    return id;
  }

  /**
   * Recycles an entity ID back into the free stack.
   */
  destroyEntity(id: number): boolean {
    if (id < 0 || id >= this.maxEntities || this.metadata.alive[id] === 0) {
      return false;
    }

    this.metadata.alive[id] = 0;
    this.metadata.kind[id] = 0;
    this.freeIds[this.freeCount++] = id;

    // Compact activeIds array
    for (let i = 0; i < this._activeCount; i++) {
      if (this.activeIds[i] === id) {
        this.activeIds[i] = this.activeIds[--this._activeCount];
        break;
      }
    }

    return true;
  }

  hasEntity(id: number): boolean {
    return id >= 0 && id < this.maxEntities && this.metadata.alive[id] === 1;
  }

  /**
   * Pure SoA trajectory kinematic integration.
   * Runs tightly packed in CPU L1/L2 cache lines with zero allocations per frame.
   */
  integrate(dt: number): void {
    if (dt <= 0 || this._activeCount === 0) return;

    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;

    const vx = this.velocity.x;
    const vy = this.velocity.y;
    const vz = this.velocity.z;

    const ids = this.activeIds;
    const count = this._activeCount;

    for (let i = 0; i < count; i++) {
      const eid = ids[i];
      px[eid] += vx[eid] * dt;
      py[eid] += vy[eid] * dt;
      pz[eid] += vz[eid] * dt;
    }
  }

  /**
   * Drains shields first, then structural health.
   * Returns true if entity was destroyed.
   */
  applyDamage(id: number, damage: number): boolean {
    if (!this.hasEntity(id) || damage <= 0) return false;

    const shield = this.health.shield[id];
    let remDmg = damage;

    if (shield > 0) {
      if (shield >= remDmg) {
        this.health.shield[id] -= remDmg;
        remDmg = 0;
      } else {
        remDmg -= shield;
        this.health.shield[id] = 0;
      }
    }

    if (remDmg > 0) {
      const curr = this.health.current[id];
      if (curr <= remDmg) {
        this.health.current[id] = 0;
        this.destroyEntity(id);
        return true;
      } else {
        this.health.current[id] -= remDmg;
      }
    }

    return false;
  }

  /**
   * Directly updates Three.js InstancedMesh matrices straight from SoA positions
   * without allocating Matrix4 instances on the JS heap (Zero GC).
   */
  syncToInstancedMesh(mesh: InstancedMesh, maxInstances?: number, scale = 1.0): void {
    const matrixArray = mesh.instanceMatrix.array as Float32Array;
    const count = Math.min(
      this._activeCount,
      mesh.count,
      maxInstances ?? this._activeCount,
      matrixArray.length / 16,
    );

    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;
    const ids = this.activeIds;

    for (let i = 0; i < count; i++) {
      const eid = ids[i];
      const base = i * 16;

      // Identity matrix scaled and translated directly in buffer
      matrixArray[base + 0] = scale;
      matrixArray[base + 1] = 0;
      matrixArray[base + 2] = 0;
      matrixArray[base + 3] = 0;

      matrixArray[base + 4] = 0;
      matrixArray[base + 5] = scale;
      matrixArray[base + 6] = 0;
      matrixArray[base + 7] = 0;

      matrixArray[base + 8] = 0;
      matrixArray[base + 9] = 0;
      matrixArray[base + 10] = scale;
      matrixArray[base + 11] = 0;

      matrixArray[base + 12] = px[eid];
      matrixArray[base + 13] = py[eid];
      matrixArray[base + 14] = pz[eid];
      matrixArray[base + 15] = 1.0;
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this._activeCount = 0;
    this.freeCount = this.maxEntities;
    for (let i = 0; i < this.maxEntities; i++) {
      this.freeIds[i] = this.maxEntities - 1 - i;
      this.metadata.alive[i] = 0;
    }
  }
}

