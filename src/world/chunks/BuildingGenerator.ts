import { WORLD } from '../../core/config';
import { buildingAllowed, IRANDUBA_CENTER, isLand, isUrban, urbanDensity, vegetationAllowed, worldToLatLon } from '../geodata/geodata';
import { chunkKey, type ChunkPayload, type ChunkGenerationContext, defaultChunkGenerationContext, createRegionId } from './Chunk';
import { classifyEarthBiome, isLandAt } from '../planet/EarthLandMask';
import { enuBasis, enuToGeodetic } from '../spatial/ENU';
import { degToRad } from '../spatial/units';
import { BuildingGeneratorContext } from '../spatial/ActiveSurfaceOrigin';

export { BuildingGeneratorContext } from '../spatial/ActiveSurfaceOrigin';

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let n = Math.imul(state ^ state >>> 15, 1 | state);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export function chunkSeed(cx: number, cz: number, contextSeed?: number): number {
  const base = Math.imul(cx + 13717, 73856093) ^ Math.imul(cz - 9271, 19349663);
  return contextSeed !== undefined ? (base ^ Math.imul(contextSeed, 0x9e3779b9)) : base;
}

export { urbanDensity } from '../geodata/geodata';

const PALETTE = [
  [0.91, 0.76, 0.59], [0.82, 0.52, 0.39], [0.97, 0.86, 0.66],
  [0.67, 0.77, 0.70], [0.91, 0.65, 0.54], [0.85, 0.84, 0.74],
  [0.55, 0.69, 0.72], [0.84, 0.75, 0.60],
];
/** Palm leaves are offset and wider than the packed nominal radius (ChunkMeshes). */
export function treeFootprintRadius(crown:number,kind:number):number {
  return kind>.5?1.6+Math.hypot(crown*1.15,.85):crown;
}

/** Pure deterministic generation; used in workers, main-thread fallback, and for the medium-distance proxy. */
export function generateChunk(cx: number, cz: number, context?: ChunkGenerationContext, customSeed?: number): ChunkPayload {
  const resolvedContext: ChunkGenerationContext = context ?? {
    bodyId: BuildingGeneratorContext.activeOrigin.bodyId ?? 'earth',
    frameId: BuildingGeneratorContext.activeOrigin.isManaus ? 'solar-system/earth/manaus-surface' : `${BuildingGeneratorContext.activeOrigin.bodyId ?? 'earth'}/local-enu`,
    latDeg: BuildingGeneratorContext.activeOrigin.latDeg,
    lonDeg: BuildingGeneratorContext.activeOrigin.lonDeg,
    surfaceType: BuildingGeneratorContext.activeOrigin.bodyId === 'thalassa' ? 'megawave-ocean' : 'terrestrial',
    regionId: createRegionId(
      BuildingGeneratorContext.activeOrigin.bodyId ?? 'earth',
      BuildingGeneratorContext.activeOrigin.isManaus,
      BuildingGeneratorContext.activeOrigin.latDeg,
      BuildingGeneratorContext.activeOrigin.lonDeg
    ),
    generationVersion: 1,
    isManaus: BuildingGeneratorContext.activeOrigin.isManaus,
    seed: 1337,
  };
  const seed = customSeed ?? chunkSeed(cx, cz, resolvedContext.seed);
  const random = seededRandom(seed);
  const originX = cx * WORLD.chunkSize, originZ = cz * WORLD.chunkSize;
  const buildings: number[] = [], trees: number[] = [];
  const unit = WORLD.chunkSize / 128;
  const centerX = originX + WORLD.chunkSize * .5;
  const centerZ = originZ + WORLD.chunkSize * .5;
  const isThalassa = resolvedContext.bodyId === 'thalassa' || resolvedContext.surfaceType === 'megawave-ocean';
  if (isThalassa) {
    return {
      key: chunkKey(cx, cz, resolvedContext.regionId), cx, cz, land: false, biome: 'ocean',
      buildings: new Float32Array(), trees: new Float32Array(),
      regionId: resolvedContext.regionId,
      generationVersion: resolvedContext.generationVersion,
    };
  }
  const isManaus = resolvedContext.isManaus;
  let latRad: number;
  let lonRad: number;
  let chunkIsLand: boolean;

  if (isManaus) {
    const geo = worldToLatLon(centerX, centerZ);
    latRad = geo.lat * (Math.PI / 180);
    lonRad = geo.lon * (Math.PI / 180);
    chunkIsLand = isLand(centerX, centerZ, resolvedContext);
  } else {
    const basis = enuBasis({
      latRad: degToRad(resolvedContext.latDeg),
      lonRad: degToRad(resolvedContext.lonDeg),
      heightM: 0,
    });
    const geodetic = enuToGeodetic(basis, [centerX, -centerZ, 0]);
    latRad = geodetic.latRad;
    lonRad = geodetic.lonRad;
    chunkIsLand = isLandAt(latRad, lonRad);
  }

  const biome = classifyEarthBiome(latRad, lonRad);
  let land = chunkIsLand && biome !== 'ocean' && biome !== 'coastal-water';

  // Water chunks: strictly zero trees and zero buildings
  if (!land) {
    return {
      key: chunkKey(cx, cz, resolvedContext.regionId), cx, cz, land: false, biome: 'ocean',
      buildings: new Float32Array(), trees: new Float32Array(),
      regionId: resolvedContext.regionId,
      generationVersion: resolvedContext.generationVersion,
    };
  }

  const density = isManaus ? urbanDensity(centerX, centerZ) : 0;
  const inCity = isManaus && isUrban(centerX, centerZ, resolvedContext) && density >= 0.18;
  // City reservations exclude wilderness by design; forest must not use the building filter.
  if (!inCity) {
    if (land && biome !== 'desert' && biome !== 'ice') {
      const isRainforest = biome === 'rainforest' || isManaus;
      const spacing = isRainforest ? 16 : 24;
      for (let z = 8; z < WORLD.chunkSize; z += spacing) for (let x = 8; x < WORLD.chunkSize; x += spacing) {
        const px = originX + x + (random() - .5) * 8, pz = originZ + z + (random() - .5) * 8;
        const height = isRainforest ? 16 + random() * 12 : 10 + random() * 8;
        const crown = isRainforest ? 8 + random() * 4 : 5 + random() * 3;
        if (isManaus && (isUrban(px, pz, resolvedContext) || !vegetationAllowed(px, pz, crown, resolvedContext))) continue;
        trees.push(px, pz, height, crown, 0);
      }
    }
    const chunkBiome = (isManaus && biome !== 'desert' && biome !== 'ice') ? 'rainforest' : biome;
    return {
      key: chunkKey(cx, cz, resolvedContext.regionId), cx, cz, land, biome: chunkBiome,
      buildings: new Float32Array(), trees: new Float32Array(trees),
      regionId: resolvedContext.regionId,
      generationVersion: resolvedContext.generationVersion,
    };
  }
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = originX + (25 + col * 26 + (random() - .5) * 5) * unit;
    const z = originZ + (25 + row * 26 + (random() - .5) * 5) * unit;
    const width = (15 + random() * 7) * unit, depth = (15 + random() * 7) * unit;
    const chance = random();
    const tall = random() > .92 && Math.hypot(x, z) > 210;
    const height = tall ? 28 + random() * 43 : 5.5 + Math.floor(random() * 4) * 3.4;
    const color = PALETTE[Math.floor(random() * PALETTE.length)];
    const roofHeight = tall || random() > .77 ? .55 : 2.1 + random() * 1.9;
    if (!isLand(x, z, resolvedContext)) continue;
    land = true;
    if (!buildingAllowed(x, z, Math.max(width, depth) * .5 + 3, resolvedContext)) continue;
    if (chance > density * .9) {
      const height=7+random()*8,crown=4+random()*3,kind=random()>.6?1:0;
      if(vegetationAllowed(x,z,treeFootprintRadius(crown,kind),resolvedContext))trees.push(x,z,height,crown,kind);
      continue;
    }
    buildings.push(x, z, width, height, depth, ...color, roofHeight);
  }
  for (let n = 0; n < 6; n++) {
    const x = originX + (10 + random() * 108) * unit;
    const z = originZ + (n % 2 ? 10 : 118) * unit;
    const height=8+random()*5,crown=3+random()*2;
    if (vegetationAllowed(x,z,treeFootprintRadius(crown,n%3===0?1:0),resolvedContext)) {
      trees.push(x,z,height,crown,n%3===0?1:0);
    }
  }
  return {
    key: chunkKey(cx, cz, resolvedContext.regionId), cx, cz, land, biome: 'urban',
    buildings: new Float32Array(buildings), trees: new Float32Array(trees),
    regionId: resolvedContext.regionId,
    generationVersion: resolvedContext.generationVersion,
  };
}
