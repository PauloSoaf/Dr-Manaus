import type { Box3, Group } from 'three/webgpu';
import type { Collider } from '../../core/types';

export enum ChunkState {
  UNLOADED = 'UNLOADED', REQUESTED = 'REQUESTED', LOADING = 'LOADING',
  READY = 'READY', ACTIVE = 'ACTIVE', CACHED = 'CACHED', EVICTING = 'EVICTING',
}

/** Packed worker transfer format: x,z,width,height,depth,r,g,b,roofHeight. */
export const BUILDING_STRIDE = 9;
/** x,z,height,crownRadius,palm */
export const TREE_STRIDE = 5;
/** Relief cells along one chunk edge outside Manaus (16 m vertex spacing). */
export const GROUND_SEGMENTS = 8;
export interface ChunkPayload {
  key: string; cx: number; cz: number;
  buildings: Float32Array; trees: Float32Array; land: boolean;
  biome?: string;
  regionId?: string;
  generationVersion?: number;
  /**
   * Earth outside Manaus: solid ground in the surface frame, (GROUND_SEGMENTS+1)² row-major from
   * the tile's minimum corner. The same surface the collision provider solves.
   */
  ground?: Float32Array;
  /** Linear RGB per ground vertex. */
  groundColors?: Float32Array;
  /** Local Y of mean sea level at the tile's (0,0), (size,0) and (0,size) corners, where water shows. */
  seaPlane?: Float32Array;
  /** Ground height under each tree record. */
  treeBase?: Float32Array;
}

/** Height of the drawn relief at tile-local (x, z), using the mesh's own cell diagonal. */
export function interpolateGroundHeight(ground: Float32Array, localX: number, localZ: number, size: number): number {
  const stride = GROUND_SEGMENTS + 1, step = size / GROUND_SEGMENTS;
  const gx = Math.max(0, Math.min(GROUND_SEGMENTS - 1e-6, localX / step));
  const gz = Math.max(0, Math.min(GROUND_SEGMENTS - 1e-6, localZ / step));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const at = (di: number, dj: number) => ground[(j + dj) * stride + i + di];
  return fx + fz <= 1
    ? at(0, 0) + (at(1, 0) - at(0, 0)) * fx + (at(0, 1) - at(0, 0)) * fz
    : at(1, 1) + (at(0, 1) - at(1, 1)) * (1 - fx) + (at(1, 0) - at(1, 1)) * (1 - fz);
}
export interface Chunk {
  key: string; cx: number; cz: number; state: ChunkState; priority: number;
  touched: number; payload?: ChunkPayload; group?: Group; colliders: Collider[];
  bytes: number;
  boundingBox?: Box3;
  worldBoundingBox?: Box3;
}
export interface ChunkGenerationContext {
  bodyId: string;
  frameId: string;
  latDeg: number;
  lonDeg: number;
  surfaceType: 'terrestrial' | 'ocean' | 'gas' | 'photosphere' | 'megawave-ocean' | 'barren';
  regionId: string;
  generationVersion: number;
  isManaus: boolean;
  seed: number;
}

export function createRegionId(bodyId: string, isManaus: boolean, latDeg: number, lonDeg: number): string {
  if (isManaus) return 'earth:manaus';
  if (bodyId === 'thalassa') return 'thalassa:megawave-ocean';
  return `${bodyId}:${latDeg.toFixed(2)}:${lonDeg.toFixed(2)}`;
}

export function defaultChunkGenerationContext(): ChunkGenerationContext {
  return {
    bodyId: 'earth',
    frameId: 'solar-system/earth/manaus-surface',
    latDeg: -3.1303,
    lonDeg: -60.0234,
    surfaceType: 'terrestrial',
    regionId: 'earth:manaus',
    generationVersion: 1,
    isManaus: true,
    seed: 1337,
  };
}

export interface WorkerRequest {
  type: 'generate';
  id: number;
  cx: number;
  cz: number;
  context: ChunkGenerationContext;
  seed: number;
}
export interface WorkerResponse {
  type: 'generated';
  id: number;
  payload: ChunkPayload;
  generationVersion?: number;
  regionId?: string;
}
export function chunkKey(cx: number, cz: number, regionId?: string): string {
  return regionId ? `${regionId}::${cx},${cz}` : `${cx},${cz}`;
}
