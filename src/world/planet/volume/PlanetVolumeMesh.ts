import type { BodyFixedPoint } from './PlanetVolumeEdit';
import type { PlanetVolumeChunkKey } from './PlanetVolumeChunkKey';

/** Discardable isosurface data. Positions are chunk-local metres, never planetary Float32 coordinates. */
export interface PlanetVolumeMesh {
  readonly key: PlanetVolumeChunkKey;
  readonly originBodyFixedM: BodyFixedPoint;
  readonly sourceRevision: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
  readonly vertexCount: number;
  readonly droppedDegenerateTriangles: number;
  /** Classic-table ambiguous faces are observable; this is not an MC33 topology guarantee. */
  readonly ambiguousFaceCount: number;
}
export function volumeMeshByteLength(mesh: PlanetVolumeMesh): number {
  return mesh.positions.byteLength + mesh.normals.byteLength + mesh.indices.byteLength;
}
/** At most one vertex per grid edge and at most five triangles per cell. */
export function maximumVolumeMeshBytes(samplesPerAxis: number): number {
  const n = samplesPerAxis, cells = n-1;
  return 3*n*n*cells*24 + cells**3*15*4;
}
