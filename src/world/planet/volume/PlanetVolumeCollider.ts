import type { PlanetVolumeMesh } from './PlanetVolumeMesh';
import { chunkBoundsBodyFixedM } from './PlanetVolumeChunkKey';
import type { PlanetVolumeBounds } from './PlanetVolumeEdit';
import type { PlanetVolumeCollisionBvh } from './PlanetVolumeCollisionBvh';

/** Immutable ownership contract: mesh typed arrays are shared read-only, never mutated after
 * publication. Holding sourceMesh retains them across visual/scalar cache invalidation. */
export interface PlanetVolumeCollider {
  readonly key: PlanetVolumeMesh['key']; readonly bodyId: string;
  readonly originBodyFixedM: PlanetVolumeMesh['originBodyFixedM']; readonly sourceRevision: number;
  readonly sourceMesh: PlanetVolumeMesh; readonly classification: 'MIXED';
  readonly boundsBodyFixedM: PlanetVolumeBounds; readonly triangleCount: number;
  readonly positions: Float32Array; readonly indices: Uint32Array; readonly normals: Float32Array;
  readonly bvh: PlanetVolumeCollisionBvh;
  readonly memory: { readonly sharedBytes:number; readonly nodeBytes:number;readonly referenceBytes:number;readonly metadataBytes:number;readonly bytes:number };
}
export function volumeCollider(mesh: PlanetVolumeMesh,bvh: PlanetVolumeCollisionBvh,bounds=chunkBoundsBodyFixedM(mesh.key)): PlanetVolumeCollider {
  const sharedBytes=mesh.positions.byteLength+mesh.indices.byteLength+mesh.normals.byteLength,
    nodeBytes=bvh.bounds.byteLength+bvh.nodes.byteLength,referenceBytes=bvh.triangles.byteLength,metadataBytes=256;
  return Object.freeze({key:mesh.key,bodyId:mesh.key.bodyId,originBodyFixedM:mesh.originBodyFixedM,sourceRevision:mesh.sourceRevision,
    sourceMesh:mesh,classification:'MIXED',boundsBodyFixedM:bounds,triangleCount:mesh.triangleCount,
    positions:mesh.positions,indices:mesh.indices,normals:mesh.normals,bvh,
    memory:Object.freeze({sharedBytes,nodeBytes,referenceBytes,metadataBytes,bytes:sharedBytes+nodeBytes+referenceBytes+metadataBytes})});
}
