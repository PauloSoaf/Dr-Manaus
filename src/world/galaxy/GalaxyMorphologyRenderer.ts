import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
} from 'three/webgpu';
import { float, mix, smoothstep, uniform, uv } from 'three/tsl';
import type { ProceduralGalaxyDescriptor } from './ProceduralGalaxyGenerator';
import { GalaxyPointCloudProvider } from './GalaxyPointCloudProvider';
import type { QualityPreset } from '../../core/config';

export interface GalaxyMorphologyRendererOptions {
  qualityPreset?: QualityPreset;
  maxParticles?: number;
  lodThreshold01?: number; // default: 16 px
  lodThreshold12?: number; // default: 280 px
  hysteresisRatio?: number; // default: 0.85 (15% hysteresis band)
}

/**
 * Three-tier multi-scale GPU renderer for galaxies (LOD0, LOD1, LOD2).
 *
 * - LOD 0: Compact distant impostor (< 16 px).
 * - LOD 1: Extragalactic intermediate morphology (16 px to 280 px).
 * - LOD 2: High-density 3D GPU point cloud (>= 280 px) with spiral arms, bar, bulge, and halo.
 *
 * Employs a 15% directional hysteresis band to eliminate thrashing and popping on LOD boundaries.
 * Fully compatible with WebGPURenderer (both WebGPU and WebGL 2 backends) via TSL and NodeMaterials.
 */
export class GalaxyMorphologyRenderer {
  readonly root = new Group();

  private readonly pointCloudProvider = new GalaxyPointCloudProvider();
  private readonly options: Required<GalaxyMorphologyRendererOptions>;

  private lod0Mesh: Mesh;
  private lod0Material: MeshBasicNodeMaterial;
  private lod0Geometry: PlaneGeometry;

  private lod1Group = new Group();
  private lod1DiscMesh: Mesh;
  private lod1DiscMaterial: MeshBasicNodeMaterial;
  private lod1DiscGeometry: PlaneGeometry;
  private lod1Points: Points;
  private lod1PointsMaterial: PointsMaterial;

  private lod2Group = new Group();
  private lod2Points: Points;
  private lod2PointsMaterial: PointsMaterial;
  private lod2CoreGlow: Mesh;
  private lod2CoreMaterial: MeshBasicNodeMaterial;

  private _currentLod: 0 | 1 | 2 = 1;
  private _particleCount = 0;

  // Uniforms for smooth exposure and fading
  private uLod0Alpha = uniform(1.0);
  private uLod1Alpha = uniform(1.0);
  private uLod2Alpha = uniform(1.0);

  constructor(
    parent: Group,
    readonly descriptor: ProceduralGalaxyDescriptor,
    options: GalaxyMorphologyRendererOptions = {},
  ) {
    this.options = {
      qualityPreset: options.qualityPreset ?? 'High',
      maxParticles: options.maxParticles ?? 0,
      lodThreshold01: options.lodThreshold01 ?? 16,
      lodThreshold12: options.lodThreshold12 ?? 280,
      hysteresisRatio: options.hysteresisRatio ?? 0.85,
    };

    this.root.name = `MorphologyRenderer_${descriptor.id}`;
    parent.add(this.root);

    // Color derivation based on dominant spectral class and morphology
    const spectralColors: Record<string, Color> = {
      O: new Color('#a8c8ff'),
      B: new Color('#b8d5ff'),
      A: new Color('#e0ebff'),
      F: new Color('#fff4e8'),
      G: new Color('#ffe8c8'),
      K: new Color('#ffd296'),
      M: new Color('#ffad6b'),
    };
    const baseColor = spectralColors[descriptor.dominantSpectralClass] || new Color('#ffe8c8');
    const coreColor = new Color('#fff0d0');

    /* ------------------------------------------------------------------------ */
    /* 1. Build LOD 0 (Distant Impostor Quad)                                   */
    /* ------------------------------------------------------------------------ */
    this.lod0Geometry = new PlaneGeometry(2.0, 2.0);
    this.lod0Material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      fog: false,
    });

    const uvRadial0 = uv().sub(0.5).length().mul(2.0);
    const coreGlow0 = float(1.0).sub(smoothstep(0.0, 0.75, uvRadial0)).pow(2.8);
    const outerHalo0 = float(1.0).sub(smoothstep(0.2, 1.0, uvRadial0)).pow(5.0).mul(0.45);
    this.lod0Material.colorNode = mix(baseColor, coreColor, coreGlow0);
    this.lod0Material.opacityNode = coreGlow0.add(outerHalo0).mul(this.uLod0Alpha).saturate();

    this.lod0Mesh = new Mesh(this.lod0Geometry, this.lod0Material);
    this.lod0Mesh.name = 'LOD0_DistantSprite';
    this.lod0Mesh.renderOrder = -10;
    this.lod0Mesh.frustumCulled = false;
    this.root.add(this.lod0Mesh);

    /* ------------------------------------------------------------------------ */
    /* 2. Build LOD 1 (Intermediate Morphological Disc + Sparse Cloud)          */
    /* ------------------------------------------------------------------------ */
    this.lod1DiscGeometry = new PlaneGeometry(2.0, 2.0);
    this.lod1DiscMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      fog: false,
    });

    // Morphological disk shader with central bulge and dust lane modulation
    const uvOffset1 = uv().sub(0.5);
    const uvRadial1 = uvOffset1.length().mul(2.0);
    const discGlow = float(1.0).sub(smoothstep(0.1, 0.95, uvRadial1)).pow(2.2);
    const bulgeGlow = float(1.0).sub(smoothstep(0.0, 0.35, uvRadial1)).pow(3.0).mul(1.5);

    // Dust lane absorption across middle plane
    const dustLane = float(1.0).sub(smoothstep(0.0, 0.08, uvOffset1.y.abs())).mul(0.4);
    const netGlow = discGlow.add(bulgeGlow).mul(float(1.0).sub(dustLane));

    this.lod1DiscMaterial.colorNode = mix(baseColor, coreColor, bulgeGlow.saturate());
    this.lod1DiscMaterial.opacityNode = netGlow.mul(0.85).mul(this.uLod1Alpha).saturate();

    this.lod1DiscMesh = new Mesh(this.lod1DiscGeometry, this.lod1DiscMaterial);
    this.lod1DiscMesh.renderOrder = -10;
    this.lod1DiscMesh.frustumCulled = false;
    this.lod1Group.add(this.lod1DiscMesh);

    // Sparse point cloud for LOD 1 (5,000 stars)
    const lod1Geom = this.pointCloudProvider.getGeometry(descriptor, 'Low', 5_000);
    this.lod1PointsMaterial = new PointsMaterial({
      size: 1.0,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      fog: false,
    });
    this.lod1Points = new Points(lod1Geom, this.lod1PointsMaterial);
    this.lod1Points.renderOrder = -10;
    this.lod1Points.frustumCulled = false;
    this.lod1Group.add(this.lod1Points);

    this.lod1Group.name = 'LOD1_IntermediateGroup';
    this.root.add(this.lod1Group);

    /* ------------------------------------------------------------------------ */
    /* 3. Build LOD 2 (High-Resolution 3D Point Cloud)                          */
    /* ------------------------------------------------------------------------ */
    const customCount = this.options.maxParticles > 0 ? this.options.maxParticles : undefined;
    const lod2Geom = this.pointCloudProvider.getGeometry(
      descriptor,
      this.options.qualityPreset,
      customCount,
    );
    this._particleCount = lod2Geom.getAttribute('position').count;

    this.lod2PointsMaterial = new PointsMaterial({
      size: 1.0,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      fog: false,
    });
    this.lod2Points = new Points(lod2Geom, this.lod2PointsMaterial);
    this.lod2Points.renderOrder = -10;
    this.lod2Points.frustumCulled = false;
    this.lod2Group.add(this.lod2Points);

    // Nuclear core glow for LOD 2
    this.lod2CoreMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      fog: false,
    });
    const coreRadial2 = uv().sub(0.5).length().mul(2.0);
    const coreDrop2 = float(1.0).sub(smoothstep(0.0, 0.45, coreRadial2)).pow(3.5).mul(2.0);
    this.lod2CoreMaterial.colorNode = coreColor;
    this.lod2CoreMaterial.opacityNode = coreDrop2.mul(this.uLod2Alpha).saturate();

    this.lod2CoreGlow = new Mesh(this.lod0Geometry, this.lod2CoreMaterial);
    this.lod2CoreGlow.scale.setScalar(0.35); // Concentrated in galactic nucleus
    this.lod2CoreGlow.renderOrder = -9;
    this.lod2CoreGlow.frustumCulled = false;
    this.lod2Group.add(this.lod2CoreGlow);

    this.lod2Group.name = 'LOD2_PointCloudGroup';
    this.root.add(this.lod2Group);

    // Initial state
    this.applyLodVisibility(this._currentLod);
  }

  get currentLod(): 0 | 1 | 2 {
    return this._currentLod;
  }

  get particleCount(): number {
    return this._particleCount;
  }

  /**
   * Updates LOD tier with 15% directional hysteresis.
   *
   * @param distanceM Distance to galaxy center in metres.
   * @param projectedPx Apparent projected pixel size on viewport.
   */
  update(distanceM: number, projectedPx: number): void {
    const { lodThreshold01, lodThreshold12, hysteresisRatio } = this.options;
    const current = this._currentLod;
    let next: 0 | 1 | 2 = current;

    if (current === 0) {
      if (projectedPx >= lodThreshold01) {
        next = projectedPx >= lodThreshold12 ? 2 : 1;
      }
    } else if (current === 1) {
      if (projectedPx < lodThreshold01 * hysteresisRatio) {
        next = 0;
      } else if (projectedPx >= lodThreshold12) {
        next = 2;
      }
    } else {
      // current === 2
      if (projectedPx < lodThreshold12 * hysteresisRatio) {
        next = projectedPx < lodThreshold01 * hysteresisRatio ? 0 : 1;
      }
    }

    if (next !== current) {
      this._currentLod = next;
      this.applyLodVisibility(next);
    }
  }

  /**
   * Sets LOD level manually (useful for testing or forced quality presets).
   */
  forceLod(level: 0 | 1 | 2): void {
    this._currentLod = level;
    this.applyLodVisibility(level);
  }

  private applyLodVisibility(activeLod: 0 | 1 | 2): void {
    this.lod0Mesh.visible = activeLod === 0;
    this.lod1Group.visible = activeLod === 1;
    this.lod2Group.visible = activeLod === 2;
  }

  dispose(): void {
    this.root.removeFromParent();

    this.lod0Geometry.dispose();
    this.lod0Material.dispose();

    this.lod1DiscGeometry.dispose();
    this.lod1DiscMaterial.dispose();
    this.lod1PointsMaterial.dispose();

    this.lod2PointsMaterial.dispose();
    this.lod2CoreMaterial.dispose();

    this.pointCloudProvider.dispose();
    this.root.clear();
  }
}
