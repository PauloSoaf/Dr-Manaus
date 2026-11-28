import { WORLD } from '../../core/config';
import { chunkKey } from '../chunks/Chunk';

export interface ChunkDemand { key: string; cx: number; cz: number; priority: number; immediate: boolean }
export interface PositionLike { x: number; z: number }

/** How far ahead streaming asks for detail; beyond this the distant representations carry the view. */
export const MAX_PREFETCH_LEAD_M = 6_000;

/** Prefetch fills at most this share of the cache; the rest keeps the ground just left behind. */
const PREFETCH_CACHE_SHARE = .8;

/**
 * What the detailed disk can sustain at a speed.
 *
 * Chunks activate at a bounded rate, and a disk of radius r moving at v sweeps about 2·r·v / size²
 * new chunks per second. The disk shrinks before the queue falls behind (never below one chunk
 * around the player); the look-ahead grows with the time to arrive, up to the lead limit.
 */
export function streamingReach(speedMps: number, radius: number): { radius: number; leadM: number } {
  const size = WORLD.chunkSize;
  const speed = Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0;
  // Seventy percent of the activation ceiling at 60 frames per second.
  const activationsPerSecond = WORLD.maxActivationsPerFrame * 60 * .7;
  const sustainable = speed > 1 ? activationsPerSecond * size * size / (2 * speed) : radius;
  return {
    radius: Math.min(radius, Math.max(size, sustainable)),
    leadM: speed > 12 ? Math.min(speed * WORLD.prefetchSeconds, MAX_PREFETCH_LEAD_M) : 0,
  };
}

/**
 * GTA / RAGE-style view-cone prioritized streaming planner, ordered by need:
 *
 * 1. the ground under and around the player (collision),
 * 2. the corridor the player will cross within the prefetch window, by time of arrival,
 * 3. the rest of the immediate disk, favouring the view cone,
 * 4. look-ahead disks further out.
 */
export function planChunks(
  position: PositionLike,
  velocity: PositionLike,
  radius: number,
  viewDirection?: PositionLike,
): ChunkDemand[] {
  const demands = new Map<string, ChunkDemand>();
  const size = WORLD.chunkSize;
  const hasViewDir = viewDirection && (viewDirection.x !== 0 || viewDirection.z !== 0);
  let vdx = 0, vdz = 0;
  if (hasViewDir) {
    const vlen = Math.hypot(viewDirection.x, viewDirection.z);
    if (vlen > 1e-4) {
      vdx = viewDirection.x / vlen;
      vdz = viewDirection.z / vlen;
    }
  }
  const speed = Math.hypot(velocity.x, velocity.z);
  const reach = streamingReach(speed, radius);
  const moving = reach.leadM > 0;
  const headingX = moving ? velocity.x / speed : 0, headingZ = moving ? velocity.z / speed : 0;

  const addDisk = (x: number, z: number, range: number, predictive: boolean, penalty: number) => {
    const cx = Math.floor(x / size), cz = Math.floor(z / size), count = Math.ceil(range / size);
    for (let dz = -count; dz <= count; dz++) for (let dx = -count; dx <= count; dx++) {
      const ix = cx + dx, iz = cz + dz;
      const distance = Math.hypot((ix + .5) * size - x, (iz + .5) * size - z);
      if (distance > range + size * .35) continue;
      const key = chunkKey(ix, iz);
      const toChunkX = (ix + .5) * size - position.x;
      const toChunkZ = (iz + .5) * size - position.z;
      const actual = Math.hypot(toChunkX, toChunkZ);

      let dirFactor = 1.0;
      if (hasViewDir && actual > size * 0.8) {
        const dot = (toChunkX * vdx + toChunkZ * vdz) / actual;
        if (dot > 0.25) {
          // Forward view cone: up to 35% priority bonus (streamed first)
          dirFactor = 0.65 + (1 - dot) * 0.35;
        } else if (dot < -0.2) {
          // Rear view (behind player): de-prioritize chunks beyond safety ring
          dirFactor = 1.45 + Math.abs(dot) * 0.65;
        }
      }

      let priority: number;
      const along = toChunkX * headingX + toChunkZ * headingZ;
      const arrivalS = along / speed;
      if (!predictive && actual <= size * 1.5) priority = actual;
      else if (moving && along > 0 && arrivalS <= WORLD.prefetchSeconds && Math.hypot(toChunkX - along * headingX, toChunkZ - along * headingZ) <= size * 1.5) {
        priority = 1_000 + arrivalS * 200;
      } else if (!predictive) priority = 2_000 + actual * dirFactor;
      else priority = 5_000 + (radius + distance * .3 + penalty) * dirFactor;

      const previous = demands.get(key);
      if (!previous) demands.set(key, { key, cx: ix, cz: iz, priority, immediate: !predictive });
      else {
        // Overlapping look-ahead disks never take a chunk out of the immediate set.
        previous.priority = Math.min(previous.priority, priority);
        previous.immediate ||= !predictive;
      }
    }
  };
  addDisk(position.x, position.z, reach.radius, false, 0);
  if (moving) {
    for (let step = 1; step <= 3; step++) {
      const length = reach.leadM * step / 3;
      addDisk(position.x + headingX * length, position.z + headingZ * length,
        Math.max(size, reach.radius * (.65 - step * .11)), true, step * 50);
    }
  }
  return withinResidency([...demands.values()].sort((a, b) => a.priority - b.priority));
}

/**
 * Backpressure: never ask for more than can stay resident, or the least urgent work is generated,
 * evicted and generated again on every plan. A disk wider than the active set keeps its farthest
 * chunks as prefetch.
 */
function withinResidency(sorted: ChunkDemand[]): ChunkDemand[] {
  const cacheShare = Math.floor(WORLD.maxCachedChunks * PREFETCH_CACHE_SHARE);
  let active = 0, cached = 0;
  const plan: ChunkDemand[] = [];
  for (const demand of sorted) {
    if (demand.immediate && active < WORLD.maxActiveChunks) { active++; plan.push(demand); }
    else if (cached < cacheShare) { cached++; plan.push(demand.immediate ? { ...demand, immediate: false } : demand); }
  }
  return plan;
}
