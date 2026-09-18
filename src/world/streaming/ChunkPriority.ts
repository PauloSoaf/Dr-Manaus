import { WORLD } from '../../core/config';
import { chunkKey } from '../chunks/Chunk';

export interface ChunkDemand { key: string; cx: number; cz: number; priority: number; immediate: boolean }
export interface PositionLike { x: number; z: number }

/** Current position wins over the directional cone even at supersonic velocity. */
export function planChunks(position: PositionLike, velocity: PositionLike, radius: number): ChunkDemand[] {
  const demands = new Map<string, ChunkDemand>();
  const size = WORLD.chunkSize;
  const addDisk = (x: number, z: number, range: number, predictive: boolean, penalty: number) => {
    const cx = Math.floor(x / size), cz = Math.floor(z / size), count = Math.ceil(range / size);
    for (let dz = -count; dz <= count; dz++) for (let dx = -count; dx <= count; dx++) {
      const ix = cx + dx, iz = cz + dz;
      const distance = Math.hypot((ix + .5) * size - x, (iz + .5) * size - z);
      if (distance > range + size * .35) continue;
      const key = chunkKey(ix, iz);
      const actual = Math.hypot((ix + .5) * size - position.x, (iz + .5) * size - position.z);
      const priority = predictive ? radius + distance * .3 + penalty : actual;
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
