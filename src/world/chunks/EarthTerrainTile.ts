/**
 * Detailed chunk records for the Earth outside Manaus.
 *
 * The ground is the surface the collision provider solves in the same tangent frame, sampled on a
 * vertex grid, so what the player sees is what the player stands on. Water appears wherever that
 * ground lies under sea level, per vertex rather than one verdict for the whole chunk, and trees
 * only grow on dry ground. Deterministic and worker safe.
 */
import { WORLD } from '../../core/config';
import { earthSurfaceChart, localGeodetic, localSeaLevelY, localSurfaceY } from '../planet/LocalSurface';
import { EARTH } from '../planet/PlanetBody';
import { EarthGroundSurface } from '../planet/EarthSurface';
import { EARTH_WET_TOLERANCE_M } from '../planet/EarthElevation';
import { earthGroundColor, earthTerrainBiome } from '../planet/EarthGroundPalette';
import { GROUND_SEGMENTS, chunkKey, interpolateGroundHeight, type ChunkGenerationContext, type ChunkPayload } from './Chunk';

/** Trees keep this far above the water line. */
const TREE_CLEARANCE_M = 1;

export function generateEarthTile(cx: number, cz: number, context: ChunkGenerationContext, random: () => number): ChunkPayload {
  const size = WORLD.chunkSize, n = GROUND_SEGMENTS, step = size / n, stride = n + 1;
  const originX = cx * size, originZ = cz * size;
  const chart = earthSurfaceChart(context.latDeg, context.lonDeg);
  const record = {
    key: chunkKey(cx, cz, context.regionId), cx, cz, buildings: new Float32Array(),
    regionId: context.regionId, generationVersion: context.generationVersion,
  };
  const ground = new Float32Array(stride * stride), groundColors = new Float32Array(stride * stride * 3);
  const seaPlane = new Float32Array([
    localSeaLevelY(chart, EARTH, originX, originZ),
    localSeaLevelY(chart, EARTH, originX + size, originZ),
    localSeaLevelY(chart, EARTH, originX, originZ + size),
  ]);
  let wet = 0, dry = 0;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = originX + i * step, z = originZ + j * step, index = j * stride + i;
    const y = localSurfaceY(chart, EARTH, EarthGroundSurface, x, z, true);
    // Beyond the tangent horizon there is no surface in this chart: publish nothing.
    if (!Number.isFinite(y)) return { ...record, land: false, biome: 'ocean', trees: new Float32Array() };
    ground[index] = y;
    const geo = localGeodetic(chart, x, y, z);
    const above = y - localSeaLevelY(chart, EARTH, x, z);
    if (above < -EARTH_WET_TOLERANCE_M) wet++; else dry++;
    earthGroundColor(geo.latRad, geo.lonRad, above, groundColors, index * 3);
  }
  if (!dry) return { ...record, land: false, biome: 'ocean', trees: new Float32Array(), seaPlane };

  const centreY = interpolateGroundHeight(ground, size / 2, size / 2, size);
  const centre = localGeodetic(chart, originX + size / 2, centreY, originZ + size / 2);
  const biome = earthTerrainBiome(centre.latRad, centre.lonRad, centreY - localSeaLevelY(chart, EARTH, originX + size / 2, originZ + size / 2));
  const trees: number[] = [], treeBase: number[] = [];
  if (biome !== 'desert' && biome !== 'ice') {
    const rainforest = biome === 'rainforest';
    const spacing = rainforest ? 16 : 24;
    for (let z = 8; z < size; z += spacing) for (let x = 8; x < size; x += spacing) {
      // Four draws per cell whatever happens next, so one rejected tree never reshuffles the rest.
      const px = originX + x + (random() - .5) * 8, pz = originZ + z + (random() - .5) * 8;
      const height = rainforest ? 16 + random() * 12 : 10 + random() * 8;
      const crown = rainforest ? 8 + random() * 4 : 5 + random() * 3;
      const base = interpolateGroundHeight(ground, px - originX, pz - originZ, size);
      if (base - localSeaLevelY(chart, EARTH, px, pz) < TREE_CLEARANCE_M) continue;
      trees.push(px, pz, height, crown, 0);
      treeBase.push(base);
    }
  }
  return {
    ...record, land: true, biome, trees: new Float32Array(trees), ground, groundColors,
    treeBase: new Float32Array(treeBase), seaPlane: wet ? seaPlane : undefined,
  };
}
