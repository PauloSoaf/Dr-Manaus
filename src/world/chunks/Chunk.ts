import type { Group } from 'three/webgpu';
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
}
export interface Chunk {
  key: string; cx: number; cz: number; state: ChunkState; priority: number;
  touched: number; payload?: ChunkPayload; group?: Group; colliders: Collider[];
  bytes: number;
}
export interface WorkerRequest { type: 'generate'; id: number; cx: number; cz: number }
export interface WorkerResponse { type: 'generated'; id: number; payload: ChunkPayload }
export function chunkKey(cx: number, cz: number): string { return `${cx},${cz}`; }
