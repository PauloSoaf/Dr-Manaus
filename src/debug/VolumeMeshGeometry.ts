import { BufferAttribute,BufferGeometry } from 'three';
import type { PlanetVolumeMesh } from '../world/planet/volume/PlanetVolumeMesh';

/** Thin presentation adapter. The logical Float64 origin is never added into vertex attributes. */
export function createVolumeMeshGeometry(mesh:PlanetVolumeMesh):BufferGeometry {
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(mesh.positions,3));
  geometry.setAttribute('normal',new BufferAttribute(mesh.normals,3));
  geometry.setIndex(new BufferAttribute(mesh.indices,1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
