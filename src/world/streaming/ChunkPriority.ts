import { WORLD } from '../../core/config';
import { chunkKey } from '../chunks/Chunk';

export interface ChunkDemand { key: string; cx: number; cz: number; priority: number; immediate: boolean }
export interface PositionLike { x: number; z: number }

/**
 * GTA / RAGE-style view-cone prioritized streaming planner.
 * Chunks within the camera view cone receive priority bonuses, while rear chunks
 * beyond an immediate safety ring are de-prioritized to preserve streaming bandwidth and GPU memory.
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

      const priority = (predictive ? radius + distance * .3 + penalty : actual) * dirFactor;
      const previous = demands.get(key);
      if (!previous || priority < previous.priority) demands.set(key, { key, cx: ix, cz: iz, priority, immediate: !predictive });
    }
  };
  addDisk(position.x, position.z, radius, false, 0);
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed > 12) {
    // Clamp the prediction length, keeping its direction rather than exploding a radial budget.
    const lead = Math.min(speed * WORLD.prefetchSeconds, 1600);
    for (let step = 1; step <= 3; step++) {
      const length = lead * step / 3;
      addDisk(position.x + velocity.x / speed * length, position.z + velocity.z / speed * length,
        Math.max(size, radius * (.65 - step * .11)), true, step * 50);
    }
  }
  return [...demands.values()].sort((a, b) => a.priority - b.priority).slice(0, WORLD.maxActiveChunks + WORLD.maxCachedChunks);
}
