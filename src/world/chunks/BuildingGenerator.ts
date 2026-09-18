import { WORLD } from '../../core/config';
import { buildingAllowed, isLand } from '../geodata/geodata';
import { chunkKey, type ChunkPayload } from './Chunk';

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let n = Math.imul(state ^ state >>> 15, 1 | state);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export function chunkSeed(cx: number, cz: number): number {
  return Math.imul(cx + 13717, 73856093) ^ Math.imul(cz - 9271, 19349663);
}

/** A broad density envelope preserves the green fringe of metropolitan Manaus. */
export function urbanDensity(x: number, z: number): number {
  const main = 1 - Math.hypot((x - 1200) / 14200, (z + 7400) / 16500);
  const west = 1 - Math.hypot((x + 10200) / 5200, (z + 5800) / 9000);
  return Math.min(1, Math.max(0, Math.max(main, west) * 2.2));
}

const PALETTE = [
  [0.91, 0.76, 0.59], [0.82, 0.52, 0.39], [0.97, 0.86, 0.66],
  [0.67, 0.77, 0.70], [0.91, 0.65, 0.54], [0.85, 0.84, 0.74],
  [0.55, 0.69, 0.72], [0.84, 0.75, 0.60],
];

/** Pure deterministic generation; used in workers and for the medium-distance proxy. */
export function generateChunk(cx: number, cz: number): ChunkPayload {
  const random = seededRandom(chunkSeed(cx, cz));
  const originX = cx * WORLD.chunkSize, originZ = cz * WORLD.chunkSize;
  const buildings: number[] = [], trees: number[] = [];
  const unit = WORLD.chunkSize / 128;
  const density = urbanDensity(originX + WORLD.chunkSize * .5, originZ + WORLD.chunkSize * .5);
  let land = false;
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = originX + (25 + col * 26 + (random() - .5) * 5) * unit;
    const z = originZ + (25 + row * 26 + (random() - .5) * 5) * unit;
    const width = (15 + random() * 7) * unit, depth = (15 + random() * 7) * unit;
    const chance = random();
    const tall = random() > .92 && Math.hypot(x, z) > 210;
    const height = tall ? 28 + random() * 43 : 5.5 + Math.floor(random() * 4) * 3.4;
    const color = PALETTE[Math.floor(random() * PALETTE.length)];
    const roofHeight = tall || random() > .77 ? .55 : 2.1 + random() * 1.9;
    if (!isLand(x, z)) continue;
    land = true;
    if (!buildingAllowed(x, z, Math.max(width, depth) * .5 + 3)) continue;
    if (chance > density * .9) {
      trees.push(x, z, 7 + random() * 8, 4 + random() * 3, random() > .6 ? 1 : 0);
      continue;
    }
    buildings.push(x, z, width, height, depth, ...color, roofHeight);
  }
  for (let n = 0; n < 6; n++) {
    const x = originX + (10 + random() * 108) * unit;
    const z = originZ + (n % 2 ? 10 : 118) * unit;
    if (isLand(x, z) && buildingAllowed(x, z, 3)) {
      trees.push(x, z, 8 + random() * 5, 3 + random() * 2, n % 3 === 0 ? 1 : 0);
    }
  }
  return { key: chunkKey(cx, cz), cx, cz, land, buildings: new Float32Array(buildings), trees: new Float32Array(trees) };
}
