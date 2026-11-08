import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Points,
  PointsNodeMaterial,
} from 'three/webgpu';
import { attribute, color, float, mix, smoothstep, uniform, uv } from 'three/tsl';
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
 * Geometric Alignment:
 * - Galactic disc plane is aligned with the X-Z plane (polar normal axis along +Y).
 * - All quads (LOD0 impostor, LOD1 disc, LOD2 core glow) rotate -90° around X to share
 *   the exact same normal (+Y) and plane (XZ) as the 3D stellar particle clouds.
 *
 * Multi-Scale Presentation:
 * - LOD 0: Compact distant impostor (< 16 px). Minimal initial footprint.
 * - LOD 1: Extragalactic intermediate morphology (16 px to 280 px). Materialized on demand.
 * - LOD 2: High-density 3D GPU point cloud (>= 280 px) with spiral arms, bar, bulge, and halo.
 *          Predictively preheated synchronously during approach to eliminate transition stutter.
 *
 * Employs a 15% directional hysteresis band to eliminate thrashing and popping on LOD boundaries.
 * Fully compatible with WebGPURenderer (both WebGPU and WebGL 2 backends) via TSL and NodeMaterials.
 */
export class GalaxyMorphologyRenderer {
  readonly root = new Group();

  private readonly pointCloudProvider = new GalaxyPointCloudProvider();
  private readonly options: Required<GalaxyMorphologyRendererOptions>;

  private readonly baseColor: Color;
  private readonly coreColor: Color;

  // LOD 0 (Minimal, always built in constructor, coplanar with XZ disk plane)
  private lod0Mesh: Mesh;
  private lod0Material: MeshBasicNodeMaterial;
  private lod0Geometry: PlaneGeometry;

  // LOD 1 (Lazy initialized on first entry to LOD 1 or LOD 2)
  private lod1Group?: Group;
  private lod1DiscMesh?: Mesh;
  private lod1DiscMaterial?: MeshBasicNodeMaterial;
  private lod1DiscGeometry?: PlaneGeometry;
  private lod1Points?: Points;
  private lod1PointsMaterial?: PointsNodeMaterial;
  private _lod1Materialized = false;

  // LOD 2 (Lazy initialized with predictive preheating)
  private lod2Group?: Group;
  private lod2Points?: Points;
  private lod2PointsMaterial?: PointsNodeMaterial;
  private lod2CoreGlow?: Mesh;
  private lod2CoreMaterial?: MeshBasicNodeMaterial;
  private _lod2Materialized = false;
  private _lod2Preheated = false;

  private _currentLod: 0 | 1 | 2 = 0;
  private _particleCount = 0;
  private _lodTransitionCount = 0;
  private _lastProjectedPx = 0;
  private _lastDistanceM = 0;
  private _disposed = false;

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
    this.baseColor = spectralColors[descriptor.dominantSpectralClass] || new Color('#ffe8c8');
    this.coreColor = new Color('#fff0d0');

    /* ------------------------------------------------------------------------ */
    /* 1. Build LOD 0 (Distant Impostor Quad) - Coplanar in galactic XZ plane    */
    /* ------------------------------------------------------------------------ */
    this.lod0Geometry = new PlaneGeometry(2.0, 2.0);
    // Align normal to +Y so disc plane matches particle XZ coordinates
    this.lod0Geometry.rotateX(-Math.PI / 2);

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
    this.lod0Material.colorNode = mix(color(this.baseColor), color(this.coreColor), coreGlow0);
    this.lod0Material.opacityNode = coreGlow0.add(outerHalo0).mul(this.uLod0Alpha).saturate();

    this.lod0Mesh = new Mesh(this.lod0Geometry, this.lod0Material);
    this.lod0Mesh.name = 'LOD0_DistantSprite';
    this.lod0Mesh.renderOrder = -10;
    this.lod0Mesh.frustumCulled = false;
    this.root.add(this.lod0Mesh);

    // Initial state: LOD 0 active, zero high-density particle arrays allocated
    this.applyLodVisibility(this._currentLod);
  }

  get currentLod(): 0 | 1 | 2 {
    return this._currentLod;
  }

  get particleCount(): number {
    if (this._currentLod === 2 && this._lod2Materialized) {
      return this._particleCount;
    }
    if (this._currentLod === 1 && this._lod1Materialized && this.lod1Points) {
      return this.lod1Points.geometry.getAttribute('position').count;
    }
    return 0;
  }

  get isLod1Materialized(): boolean {
    return this._lod1Materialized;
  }

  get isLod2Materialized(): boolean {
    return this._lod2Materialized;
  }

  get isLod2Preheated(): boolean {
    return this._lod2Preheated;
  }

  get lodTransitionCount(): number {
    return this._lodTransitionCount;
  }

  get lastProjectedPx(): number {
    return this._lastProjectedPx;
  }

  get lastDistanceM(): number {
    return this._lastDistanceM;
  }

  getLodAlphas(): { lod0: number; lod1: number; lod2: number } {
    return {
      lod0: Number(this.uLod0Alpha.value),
      lod1: Number(this.uLod1Alpha.value),
      lod2: Number(this.uLod2Alpha.value),
    };
  }

  /**
   * Updates LOD tier with 15% directional hysteresis and predictive preheating.
   *
   * @param distanceM Distance to galaxy center in metres.
   * @param projectedPx Apparent projected pixel size on viewport.
   */
  update(distanceM: number, projectedPx: number): void {
    if (this._disposed) return;

    this._lastDistanceM = distanceM;
    this._lastProjectedPx = projectedPx;

    const { lodThreshold01, lodThreshold12, hysteresisRatio } = this.options;
    const current = this._currentLod;
    let next: 0 | 1 | 2 = current;

    // Predictive pre-heating: when approaching LOD 2 threshold in LOD 1, pre-warm cache
    if (current === 1 && projectedPx >= lodThreshold12 * 0.6 && !this._lod2Materialized && !this._lod2Preheated) {
      this.preheatLod2();
    }

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
      this._lodTransitionCount++;
      this.applyLodVisibility(next);
    }

    // Smooth exposure modulation within active LOD tier
    const safePx = Math.max(0, Number.isFinite(projectedPx) ? projectedPx : 0);
    if (next === 0) {
      const t0 = Math.min(1, safePx / Math.max(1, lodThreshold01));
      this.uLod0Alpha.value = 0.84 + 0.16 * t0;
    } else if (next === 1) {
      const lowBand = lodThreshold01 * hysteresisRatio;
      const t1 = Math.min(1, Math.max(0, (safePx - lowBand) / Math.max(1, lodThreshold01 * 0.5)));
      this.uLod1Alpha.value = 0.86 + 0.14 * t1;
    } else {
      const lowBand2 = lodThreshold12 * hysteresisRatio;
      const t2 = Math.min(1, Math.max(0, (safePx - lowBand2) / Math.max(1, lodThreshold12 * 0.35)));
      this.uLod2Alpha.value = 0.88 + 0.12 * t2;
    }
  }

  /**
   * Sets LOD level manually (useful for testing or forced quality presets).
   */
  forceLod(level: 0 | 1 | 2): void {
    if (this._disposed) return;
    this._currentLod = level;
    this.applyLodVisibility(level);
  }

  /**
   * Updates quality preset dynamically, updating active point cloud buffer if LOD 2 is materialized.
   */
  setQuality(preset: QualityPreset): void {
    if (this._disposed || this.options.qualityPreset === preset) return;
    this.options.qualityPreset = preset;

    if (this._lod2Materialized && this.lod2Points) {
      const customCount = this.options.maxParticles > 0 ? this.options.maxParticles : undefined;
      const oldGeom = this.lod2Points.geometry;
      this.pointCloudProvider.release(oldGeom);

      const newGeom = this.pointCloudProvider.getGeometry(this.descriptor, preset, customCount);
      this.pointCloudProvider.retain(newGeom);
      this.lod2Points.geometry = newGeom;
      this._particleCount = newGeom.getAttribute('position').count;
    }
  }

  /**
   * Pre-warms the cache entry in GalaxyPointCloudProvider so that entering LOD 2 is an O(1) lookup.
   * Note: Executes synchronously during update() upon approaching the LOD 2 threshold in LOD 1.
   * Asynchronous Web Worker / frame-budgeted streaming is planned for a dedicated performance pass.
   */
  private preheatLod2(): void {
    if (this._lod2Preheated || this._lod2Materialized || this._disposed) return;
    this._lod2Preheated = true;
    const customCount = this.options.maxParticles > 0 ? this.options.maxParticles : undefined;
    this.pointCloudProvider.getGeometry(this.descriptor, this.options.qualityPreset, customCount);
  }

  /**
   * Lazy materialization of LOD 1 resources (morphological disk and 5,000 sparse stars).
   * Aligned to X-Z plane (+Y normal) to be strictly co-planar with LOD 2 particles.
   */
  private ensureLod1(): void {
    if (this._lod1Materialized || this._disposed) return;
    this._lod1Materialized = true;

    this.lod1Group = new Group();
    this.lod1Group.name = 'LOD1_IntermediateGroup';

    this.lod1DiscGeometry = new PlaneGeometry(2.0, 2.0);
    // Align normal to +Y so disc plane matches particle XZ coordinates
    this.lod1DiscGeometry.rotateX(-Math.PI / 2);

    this.lod1DiscMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      fog: false,
    });

    const uvOffset1 = uv().sub(0.5);
    const uvRadial1 = uvOffset1.length().mul(2.0);
    const discGlow = float(1.0).sub(smoothstep(0.1, 0.95, uvRadial1)).pow(2.2);
    const bulgeGlow = float(1.0).sub(smoothstep(0.0, 0.35, uvRadial1)).pow(3.0).mul(1.5);
    const dustLane = float(1.0).sub(smoothstep(0.0, 0.08, uvOffset1.y.abs())).mul(0.4);
    const netGlow = discGlow.add(bulgeGlow).mul(float(1.0).sub(dustLane));

    this.lod1DiscMaterial.colorNode = mix(color(this.baseColor), color(this.coreColor), bulgeGlow.saturate());
    this.lod1DiscMaterial.opacityNode = netGlow.mul(0.85).mul(this.uLod1Alpha).saturate();

    this.lod1DiscMesh = new Mesh(this.lod1DiscGeometry, this.lod1DiscMaterial);
    this.lod1DiscMesh.renderOrder = -10;
    this.lod1DiscMesh.frustumCulled = false;
    this.lod1Group.add(this.lod1DiscMesh);

    // Sparse point cloud for LOD 1 (5,000 stars) using PointsNodeMaterial with size and dust attributes
    const lod1Geom = this.pointCloudProvider.getGeometry(this.descriptor, 'Low', 5_000);
    this.pointCloudProvider.retain(lod1Geom);

    this.lod1PointsMaterial = new PointsNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      fog: false,
    });

    const lod1ColorAttr = attribute('color', 'vec3');
    const lod1SizeAttr = attribute('size', 'float');
    const lod1DustAttr = attribute('dust', 'float');

    this.lod1PointsMaterial.sizeNode = lod1SizeAttr.mul(float(1.2));
    this.lod1PointsMaterial.colorNode = lod1ColorAttr.mul(lod1DustAttr).mul(lod1SizeAttr.mul(0.5).add(0.5));
    this.lod1PointsMaterial.opacityNode = lod1DustAttr.mul(this.uLod1Alpha).saturate();

    this.lod1Points = new Points(lod1Geom, this.lod1PointsMaterial);
    this.lod1Points.renderOrder = -10;
    this.lod1Points.frustumCulled = false;
    this.lod1Group.add(this.lod1Points);

    this.root.add(this.lod1Group);
  }

  /**
   * Lazy materialization of LOD 2 resources (full 3D stellar cloud and nuclear core glow).
   */
  private ensureLod2(): void {
    if (this._lod2Materialized || this._disposed) return;
    this._lod2Materialized = true;

    this.lod2Group = new Group();
    this.lod2Group.name = 'LOD2_PointCloudGroup';

    const customCount = this.options.maxParticles > 0 ? this.options.maxParticles : undefined;
    const lod2Geom = this.pointCloudProvider.getGeometry(
      this.descriptor,
      this.options.qualityPreset,
      customCount,
    );
    this.pointCloudProvider.retain(lod2Geom);
    this._particleCount = lod2Geom.getAttribute('position').count;

    this.lod2PointsMaterial = new PointsNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      fog: false,
    });

    const lod2ColorAttr = attribute('color', 'vec3');
    const lod2SizeAttr = attribute('size', 'float');
    const lod2DustAttr = attribute('dust', 'float');

    this.lod2PointsMaterial.sizeNode = lod2SizeAttr.mul(float(1.5));
    this.lod2PointsMaterial.colorNode = lod2ColorAttr.mul(lod2DustAttr).mul(lod2SizeAttr.mul(0.6).add(0.4));
    this.lod2PointsMaterial.opacityNode = lod2DustAttr.mul(this.uLod2Alpha).saturate();

    this.lod2Points = new Points(lod2Geom, this.lod2PointsMaterial);
    this.lod2Points.renderOrder = -10;
    this.lod2Points.frustumCulled = false;
    this.lod2Group.add(this.lod2Points);

    // Nuclear core glow for LOD 2 (coplanar with XZ disk plane)
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
    this.lod2CoreMaterial.colorNode = color(this.coreColor);
    this.lod2CoreMaterial.opacityNode = coreDrop2.mul(this.uLod2Alpha).saturate();

    this.lod2CoreGlow = new Mesh(this.lod0Geometry, this.lod2CoreMaterial);
    this.lod2CoreGlow.scale.setScalar(0.35); // Concentrated in galactic nucleus
    this.lod2CoreGlow.renderOrder = -9;
    this.lod2CoreGlow.frustumCulled = false;
    this.lod2Group.add(this.lod2CoreGlow);

    this.root.add(this.lod2Group);
  }

  private applyLodVisibility(activeLod: 0 | 1 | 2): void {
    if (this._disposed) return;

    if (activeLod === 1 || activeLod === 2) {
      this.ensureLod1();
    }
    if (activeLod === 2) {
      this.ensureLod2();
    }

    this.lod0Mesh.visible = activeLod === 0;
    if (this.lod1Group) {
      this.lod1Group.visible = activeLod === 1;
    }
    if (this.lod2Group) {
      this.lod2Group.visible = activeLod === 2;
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    this.root.removeFromParent();

    this.lod0Geometry.dispose();
    this.lod0Material.dispose();

    if (this.lod1DiscGeometry) this.lod1DiscGeometry.dispose();
    if (this.lod1DiscMaterial) this.lod1DiscMaterial.dispose();
    if (this.lod1Points) {
      this.pointCloudProvider.release(this.lod1Points.geometry);
    }
    if (this.lod1PointsMaterial) this.lod1PointsMaterial.dispose();

    if (this.lod2Points) {
      this.pointCloudProvider.release(this.lod2Points.geometry);
    }
    if (this.lod2PointsMaterial) this.lod2PointsMaterial.dispose();
    if (this.lod2CoreMaterial) this.lod2CoreMaterial.dispose();

    this.pointCloudProvider.dispose();
    this.root.clear();
  }
}
