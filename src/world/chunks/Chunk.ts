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
export interface ChunkPayload {
  key: string; cx: number; cz: number;
  buildings: Float32Array; trees: Float32Array; land: boolean;
  biome?: string;
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

export function defaultChunkGenerationContext(): ChunkGenerationContext {
  return {
    bodyId: 'earth',
    frameId: 'solar-system/earth/manaus-surface',
    latDeg: -3.1303,
    lonDeg: -60.0234,
    surfaceType: 'terrestrial',
    regionId: 'manaus-city',
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
export function chunkKey(cx: number, cz: number): string { return `${cx},${cz}`; }
