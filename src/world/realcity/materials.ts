import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, color, float, mix, uniform } from 'three/tsl';

/**
 * Three shared materials cover the whole real city, so a tile costs draw calls, never materials.
 * Colour lives in a vertex attribute and window glow in a second one, which keeps facades
 * varied without a single texture upload or per-building material.
 * 
 * Integrated with PBR Wetness Model (RF-15-03, Sébastien Lagarde):
 * - Albedo darkening by up to 30% on porous surfaces under water saturation.
 * - Roughness modulation: drops towards 0.04 (mirror-like asphalt puddle reflections).
 */
export class RealCityMaterials {
  private readonly nightLevel = uniform(0);
  private readonly wetnessLevel = uniform(0);
  readonly near: MeshStandardNodeMaterial;
  readonly shell: MeshStandardNodeMaterial;
  readonly road: MeshStandardNodeMaterial;
  readonly lamp: MeshStandardNodeMaterial;

  constructor() {
    const vertexColor = attribute('color', 'vec3');
    const wetness = this.wetnessLevel;

    // Albedo darkening on wet porous materials (RF-15-03)
    const wetAlbedo = vertexColor.mul(float(1.0).sub(wetness.mul(0.30)));

    this.near = new MeshStandardNodeMaterial({ roughness: .82, metalness: .03 });
    this.near.colorNode = wetAlbedo;
    this.near.roughnessNode = mix(float(0.82), float(0.18), wetness);
    // `lit` is 1 only on window panes, so nothing else can glow after dark.
    this.near.emissiveNode = color('#ffc178').mul(attribute('lit', 'float')).mul(this.nightLevel);
    this.near.name = 'real-city-near';

    this.shell = new MeshStandardNodeMaterial({ roughness: .9, metalness: 0 });
    this.shell.colorNode = wetAlbedo;
    this.shell.roughnessNode = mix(float(0.90), float(0.25), wetness);
    this.shell.name = 'real-city-shell';

    this.road = new MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
    this.road.colorNode = wetAlbedo;
    this.road.roughnessNode = mix(float(0.92), float(0.04), wetness);
    this.road.name = 'real-city-roads';

    // Street furniture and foliage share one material; only lamp heads carry the `lit` mask.
    this.lamp = new MeshStandardNodeMaterial({ roughness: .78, metalness: 0 });
    this.lamp.colorNode = vertexColor;
    this.lamp.emissiveNode = color('#ffd9a0').mul(attribute('lit', 'float')).mul(this.nightLevel);
    this.lamp.name = 'real-city-lamps';
  }

  setNight(night: boolean): void { this.nightLevel.value = night ? 1 : 0; }

  setWetness(factor: number): void {
    this.wetnessLevel.value = Number.isFinite(factor) ? Math.max(0, Math.min(1, factor)) : 0;
  }

  get wetness(): number {
    return this.wetnessLevel.value;
  }

  dispose(): void { this.near.dispose(); this.shell.dispose(); this.road.dispose(); this.lamp.dispose(); }
}

/** Tests and headless tooling build geometry without ever touching a GPU material. */
export function supportsNodeMaterials(): boolean {
  try { return typeof float === 'function'; } catch { return false; }
}
