import type { BodyFixedPoint, PlanetVolumeBounds } from './PlanetVolumeEdit';
import type { PlanetVolumeChunkKey } from './PlanetVolumeChunkKey';

/** Derived scalar grid. No mesh/collider data, no persistent authority. */
export interface PlanetVolumeChunk {
  readonly key: PlanetVolumeChunkKey;
  readonly boundsBodyFixedM: PlanetVolumeBounds;
  /** Numerical CSG influence region, also used for exact local cache invalidation. */
  readonly editQueryBoundsBodyFixedM: PlanetVolumeBounds;
  readonly originBodyFixedM: BodyFixedPoint;
  readonly samplesPerAxis: number;
  readonly cellsPerAxis: number;
  readonly spacingM: number;
  readonly generationSignature:string;
  /** X + N * (Y + N * Z). Negative solid, positive empty, zero boundary. */
  readonly distances: Float32Array;
  /** HIGH-only exterior faces for identical central gradients at chunk seams. */
  readonly boundaryDistances?:Float32Array;
  readonly materials?: Uint8Array;
  readonly intactMaterial: string;
  readonly sourceRevision: number;
  readonly overlappingEditCount: number;
  /** Grid classification only; sub-grid surfaces are not topologically certified. */
  readonly classification: 'EMPTY' | 'SOLID' | 'MIXED';
  state: 'ready' | 'stale';
}
export function chunkByteLength(chunk: PlanetVolumeChunk): number {
  return chunk.distances.byteLength + (chunk.boundaryDistances?.byteLength??0) + (chunk.materials?.byteLength ?? 0);
}
