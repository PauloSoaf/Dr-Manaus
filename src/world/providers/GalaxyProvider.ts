import { globalTargetDeltaM, galaxyDefinition, orientGalaxyVector } from '../galaxy/GalaxyCoordinates';
import { LIGHT_YEAR_M, type Vec3 } from '../spatial/units';
import { Group, Matrix4, type Object3D, Vector3 } from 'three/webgpu';
import type { GalaxyDefinition } from '../celestial/GalaxyDefinition';
import { finite } from '../spatial/units';
import { GalaxyMorphologyRenderer } from '../galaxy/GalaxyMorphologyRenderer';
import { resolveGalaxyDescriptor } from '../galaxy/GalaxyPointCloudProvider';
import type { QualityPreset } from '../../core/config';

export interface GalaxyCameraContext {
  /** Vertical field of view in degrees. Defaults to 58 deg. */
  fovDeg?: number;
  /** Viewport height in pixels. Defaults to window.innerHeight or 1080. */
  viewportHeightPx?: number;
}

export interface GalaxyProviderOptions {
  galaxy: GalaxyDefinition;
  /** Altitude above which this galaxy is rendered as a macro structure. */
  minAltitudeM?: number;
  /** Visual quality tier controlling particle allocation. */
  qualityPreset?: QualityPreset;
  /** Optional custom maximum particle count. */
  maxParticles?: number;
  /** Default camera vertical FOV in degrees (default: 58). */
  cameraFovDeg?: number;
  /** Default viewport height in pixels (default: window.innerHeight or 1080). */
  viewportHeightPx?: number;
}

/**
 * GPU Presentation provider for macro-scale celestial galaxies.
 *
 * Replaces the previous crude exponential disc with a full 3-tier multi-scale morphology renderer:
 * - LOD 0: Compact distant impostor sprite (< 16 px).
 * - LOD 1: Extragalactic intermediate disk + sparse star sparkle (16 px to 280 px).
 * - LOD 2: High-density 3D GPU point cloud (>= 280 px) with logarithmic spiral arms, central bar,
 *          Hernquist-inspired bulge, and diffuse stellar halo.
 *
 * Coordinates are mapped through a bounded camera-relative proxy sphere (20 km) to preserve
 * Float32 rendering precision across intergalactic distances.
 */
export class GalaxyProvider {
  readonly id: string;
  readonly priority = 2; // Above StarSectors but below local bodies

  readonly group = new Group();
  readonly morphologyRenderer: GalaxyMorphologyRenderer;

  private readonly options: Required<GalaxyProviderOptions>;
  private readonly orientationMatrix = new Matrix4();
  private readonly axes = [new Vector3(), new Vector3(), new Vector3()];

  constructor(parent: Object3D, options: GalaxyProviderOptions) {
    this.id = `galaxy-macro/${options.galaxy.id}`;
    this.options = {
      galaxy: options.galaxy,
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 0)),
      qualityPreset: options.qualityPreset ?? 'High',
      maxParticles: options.maxParticles ?? 0,
      cameraFovDeg: options.cameraFovDeg ?? 58,
      viewportHeightPx: options.viewportHeightPx ?? 0,
    };

    this.group.name = `Galaxy ${options.galaxy.id}`;
    this.group.visible = false;

    // Resolve or generate morphological descriptor from galaxy definition
    const descriptor = resolveGalaxyDescriptor(options.galaxy);

    // Initialize 3-tier GPU morphology renderer
    this.morphologyRenderer = new GalaxyMorphologyRenderer(this.group, descriptor, {
      qualityPreset: this.options.qualityPreset,
      maxParticles: this.options.maxParticles,
    });

    if (this.options.galaxy.orientationEuler) {
      this.group.rotation.set(...this.options.galaxy.orientationEuler);
    }

    parent.add(this.group);
  }

  get stats() {
    return {
      visible: this.group.visible,
      currentLod: this.morphologyRenderer.currentLod,
      particleCount: this.morphologyRenderer.particleCount,
    };
  }

  /**
   * Updates quality preset dynamically across morphology renderer.
   */
  setQuality(preset: QualityPreset): void {
    this.options.qualityPreset = preset;
    this.morphologyRenderer.setQuality(preset);
  }

  update(
    address: import('../spatial/UniverseAddress').UniverseAddress,
    cameraPosM: Vec3,
    altitudeM: number,
    sectorOffsetM: Vec3 = [0, 0, 0],
    toRenderDirection: (v: Vec3) => Vec3 = (v) => v,
    cameraContext?: GalaxyCameraContext,
  ): void {
    const delta = globalTargetDeltaM(address, sectorOffsetM, this.options.galaxy.positionM);
    this.group.visible =
      address.galaxyId !== this.options.galaxy.id &&
      altitudeM >= this.options.minAltitudeM &&
      !!delta;

    if (!this.group.visible || !delta) return;

    const distance = Math.hypot(...delta);
    const proxyDistance = 20_000;
    if (distance <= 0) {
      this.group.visible = false;
      return;
    }

    const active = galaxyDefinition(address.galaxyId)!;
    const direction = toRenderDirection(
      orientGalaxyVector(active, delta.map((v) => v / distance) as Vec3, true),
    );

    this.group.position.set(
      ...(direction.map((v, i) => cameraPosM[i] + v * proxyDistance) as Vec3),
    );

    for (let i = 0; i < 3; i++) {
      const basis: Vec3 = [0, 0, 0];
      basis[i] = 1;
      this.axes[i].set(
        ...toRenderDirection(
          orientGalaxyVector(active, orientGalaxyVector(this.options.galaxy, basis), true),
        ),
      );
    }

    this.group.quaternion.setFromRotationMatrix(
      this.orientationMatrix.makeBasis(this.axes[0], this.axes[1], this.axes[2]),
    );

    const galaxyRadiusM = this.options.galaxy.diameterLy * 0.5 * LIGHT_YEAR_M;
    const proxyScale = Math.min(4000, (proxyDistance * galaxyRadiusM) / distance);
    this.group.scale.setScalar(proxyScale);

    // Compute apparent angular pixel diameter with actual camera FOV and viewport height
    const fovDeg = cameraContext?.fovDeg ?? this.options.cameraFovDeg ?? 58;
    const configuredHeight = this.options.viewportHeightPx > 0 ? this.options.viewportHeightPx : undefined;
    const viewportHeight =
      cameraContext?.viewportHeightPx ??
      configuredHeight ??
      (typeof window !== 'undefined' ? window.innerHeight : 1080);
    const tanHalfFov = Math.tan(((fovDeg * 0.5) * Math.PI) / 180);

    // If observer is within or intersecting the galactic envelope, select maximum resolution (LOD 2)
    let projectedPx: number;
    if (distance <= galaxyRadiusM) {
      projectedPx = 10_000;
    } else {
      projectedPx = Math.max(1, (viewportHeight * galaxyRadiusM) / (distance * tanHalfFov));
    }

    // Update morphology LOD selection with 15% hysteresis
    this.morphologyRenderer.update(distance, projectedPx);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.morphologyRenderer.dispose();
  }
}
