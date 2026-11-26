/**
 * OceanHorizonPresentation.ts
 *
 * Multi-scale concentric continuous ocean horizon presentation for Dr-Manaus.
 *
 * Problem:
 * WorldStreamer generates chunks up to detailRadius (480m). Beyond 480m, the surface
 * previously cut off abruptly into empty space/void in straight polygonal lines.
 *
 * Architecture:
 * - Provides a continuous radial concentric ocean mesh spanning 0m to 65,000m (65 km horizon).
 * - Shares createUniversalLiquidMaterial(solvent) with the same GPU node uniforms
 *   (universalLiquidOrigin, universalLiquidTime, universalLiquidSky*).
 * - Tracks cameraRenderLocalPos horizontally (X, Z) so the horizon is mathematically infinite.
 * - Invariant under floating origin rebases: wave phase is computed from world position + origin.
 * - Active whenever surfaceType is 'ocean' or 'megawave-ocean' (or oceanic planet/body).
 */

import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three/webgpu';
import { createUniversalLiquidMaterial, LiquidSolventType } from './UniversalLiquidSystem';

export class OceanHorizonPresentation {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private currentSolvent: LiquidSolventType = 'terrestrial-ocean';
  private currentElevation = 0;

  constructor() {
    this.group.name = 'Ocean Horizon Presentation (Continuous 65km)';
    const geometry = this.buildRadialOceanGeometry();
    const material = createUniversalLiquidMaterial(this.currentSolvent);
    this.mesh = new Mesh(geometry, material);
    this.mesh.name = 'ocean-horizon-disc';
    this.mesh.frustumCulled = false; // The horizon wraps the world and must never be frustum culled
    this.mesh.receiveShadow = false;
    this.group.add(this.mesh);
  }

  setSolvent(solvent: LiquidSolventType, baseElevation = 0): void {
    if (this.currentSolvent !== solvent) {
      this.currentSolvent = solvent;
      this.mesh.material = createUniversalLiquidMaterial(solvent);
    }
    this.currentElevation = baseElevation;
  }

  update(cameraRenderLocalPos: Vector3, active: boolean): void {
    this.group.visible = active;
    if (!active) return;
    // Follow camera horizontally at the target fluid surface elevation
    this.mesh.position.set(cameraRenderLocalPos.x, this.currentElevation, cameraRenderLocalPos.z);
  }

  private buildRadialOceanGeometry(): BufferGeometry {
    // Concentric radial rings from 0m out to 65,000m (65 km horizon)
    // Denser near the camera (0 to 1000m) and geometrically spaced towards the horizon
    const radii = [
      0, 50, 120, 220, 360, 550, 850, 1300, 2000, 3200, 5000, 8000, 13000, 21000, 35000, 50000, 65000
    ];
    const segments = 64;
    const positions: number[] = [];
    const uvs: number[] = [];
    const shores: number[] = [];
    const indices: number[] = [];

    // Center vertex (index 0)
    positions.push(0, 0, 0);
    uvs.push(0.5, 0.5);
    shores.push(1.0); // Open ocean shore damping is 1.0 (no damping)

    // Vertices for rings 1 to radii.length - 1
    for (let r = 1; r < radii.length; r++) {
      const radius = radii[r];
      for (let s = 0; s < segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        positions.push(x, 0, z);
        uvs.push((x / 65000) * 0.5 + 0.5, (z / 65000) * 0.5 + 0.5);
        shores.push(1.0);
      }
    }

    // Faces for innermost ring (triangles connecting center to ring 1)
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      indices.push(0, 1 + s, 1 + nextS);
    }

    // Faces between consecutive rings
    for (let r = 1; r < radii.length - 1; r++) {
      const innerRingStart = 1 + (r - 1) * segments;
      const outerRingStart = 1 + r * segments;
      for (let s = 0; s < segments; s++) {
        const nextS = (s + 1) % segments;
        const i0 = innerRingStart + s;
        const i1 = innerRingStart + nextS;
        const o0 = outerRingStart + s;
        const o1 = outerRingStart + nextS;
        indices.push(i0, o0, i1);
        indices.push(i1, o0, o1);
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geo.setAttribute('shore', new Float32BufferAttribute(shores, 1));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
}
