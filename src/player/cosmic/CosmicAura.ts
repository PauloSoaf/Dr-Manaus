import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three/webgpu';
import type { CosmicLevel } from './CosmicMaterial';

const OPACITY: Record<CosmicLevel, number> = { idle: 0, flight: 0.025, power: 0.12, boost: 0.055, mega: 0.1 };

/**
 * A restrained energy accent, separate from the universe rendered inside the body material.
 * Scales visually with character size for giant and titanic forms.
 */
export class CosmicAura {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  private elapsed = 0;
  private disposed = false;

  constructor(parent: Object3D, _options: { count?: number; seed?: number } = {}) {
    const geometry = new BufferGeometry();
    const vertices: number[] = [], colors: number[] = [];
    const segments = 32;
    for (let arc = 0; arc < 2; arc++) {
      for (let i = 0; i < segments; i++) {
        const a = (i / segments * 0.7 + arc) * Math.PI, b = ((i + 1) / segments * 0.7 + arc) * Math.PI;
        for (const [angle, radius] of [[a, 0.52], [b, 0.52], [b, 0.532], [a, 0.52], [b, 0.532], [a, 0.532]]) {
          vertices.push(Math.cos(angle) * radius, Math.sin(angle * 2) * 0.04 + arc * 0.12, Math.sin(angle) * radius);
          colors.push(arc ? 0.45 : 0.2, arc ? 0.24 : 0.7, 1);
        }
      }
    }
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    this.mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: AdditiveBlending, side: DoubleSide, depthWrite: false, toneMapped: false }));
    this.mesh.name = 'cosmic-aura-accent';
    this.mesh.position.y = 1.13;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  update(dt: number, level: CosmicLevel, _speed: number, _forward: Vector3, size = 1): void {
    if (this.disposed) return;
    const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0;
    this.elapsed += step;

    // Scale visual aura according to form:
    // 15m (size ~7) -> subtle boost
    // 46m (size ~22) -> stronger field
    // 200m (size ~100) -> energy field
    // 500m (size ~250) -> huge field
    // 1000m (size ~500) -> titanic field
    const sizeMultiplier = size > 4 ? 1 + Math.min(3.5, Math.log10(size) * 0.8) : 1;
    const target = (OPACITY[level] ?? (size > 10 ? 0.03 : 0)) * sizeMultiplier;

    this.mesh.material.opacity += (target - this.mesh.material.opacity) * (1 - Math.exp(-step * 6));
    this.mesh.rotation.y = this.elapsed * 0.3;

    if (size > 4) {
      const auraScale = 1 + Math.min(2.5, Math.pow(size, 0.25) * 0.4);
      this.mesh.scale.set(auraScale, auraScale, auraScale);
    } else {
      this.mesh.scale.set(1, 1, 1);
    }

    this.mesh.visible = this.mesh.material.opacity > 0.003;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
