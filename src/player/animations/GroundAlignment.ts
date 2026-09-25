import { Matrix4, Object3D, SkinnedMesh, Vector3 } from 'three/webgpu';

export interface GroundAlignmentResult {
  readonly offset: number;
  readonly minY: number;
  readonly maxY: number;
  readonly sampledVertices: number;
}

const localPoint = new Vector3();
const visualPoint = new Vector3();
const meshToVisual = new Matrix4();
const inverseVisual = new Matrix4();

/**
 * Measures the posed, skinned vertices in visual-root space. This is run only
 * after binding (or from the animation lab), never in the frame loop.
 */
export function measureSkinnedGround(
  visualRoot: Object3D,
  meshes: readonly SkinnedMesh[],
): GroundAlignmentResult {
  visualRoot.updateWorldMatrix(true, true);
  inverseVisual.copy(visualRoot.matrixWorld).invert();
  let minY = Infinity, maxY = -Infinity, sampledVertices = 0;

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    meshToVisual.multiplyMatrices(inverseVisual, mesh.matrixWorld);
    const positions = mesh.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      localPoint.fromBufferAttribute(positions, index);
      mesh.applyBoneTransform(index, localPoint);
      visualPoint.copy(localPoint).applyMatrix4(meshToVisual);
      minY = Math.min(minY, visualPoint.y);
      maxY = Math.max(maxY, visualPoint.y);
      sampledVertices++;
    }
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { offset: 0, minY: 0, maxY: 0, sampledVertices: 0 };
  }
  return { offset: -minY, minY, maxY, sampledVertices };
}

export function applyGroundAlignment(
  visualRoot: Object3D,
  meshes: readonly SkinnedMesh[],
): GroundAlignmentResult {
  const result = measureSkinnedGround(visualRoot, meshes);
  visualRoot.position.y = result.offset;
  visualRoot.updateWorldMatrix(true, true);
  return result;
}
