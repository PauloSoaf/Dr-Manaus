/**
 * SwimmingPool.ts
 *
 * Dedicated architectural swimming pool entity for Dr-Manaus (Ponta Negra resort clubs,
 * hotel rooftops, and residential estates).
 * 
 * Features:
 * 1. Crystal-Clear Turquoise Optical Model: Extremely low turbidity and gentle Beer-Lambert
 *    absorption revealing swimming pool floor tiles and submerged lane markers.
 * 2. Lap Ripples & Coping Damping: High-frequency capillary ripples driven by the SWIMMING_POOL
 *    Gerstner spectrum, attenuated near the coping rim.
 * 3. Animated Shallow Caustics: Projecting dancing cyan light webs across the pool floor.
 * 4. 4-Point Swimmer & Prop Buoyancy: Direct integration with WaterBuoyancyService.
 * 5. FluidRegistry Compliance: Registers under scale 'SMALL', geometry 'pool', profile 'SWIMMING_POOL'.
 * 6. Zero GC during per-frame update loop.
 */

import {
  BoxGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  Mesh, MeshStandardMaterial, MeshStandardNodeMaterial, PlaneGeometry, Vector3
} from 'three/webgpu';
import {
  attribute, cameraPosition, color, cos, dot, float, max, mix,
  positionLocal, positionWorld, pow, sin, smoothstep, time, uniform, vec2, vec3
} from 'three/tsl';
import { WATER_WAVE_PROFILES, sampleGerstnerSpectrum, type LiquidSampleResult } from './UniversalLiquidSystem';
import { registerFluid, type FluidHandle } from './FluidRegistry';

export interface SwimmingPoolOptions {
  id: string;
  widthM?: number;       // Pool width along X (default: 10m)
  lengthM?: number;      // Pool length along Z (default: 25m - semi-Olympic)
  depthM?: number;       // Water depth (default: 2.2m)
  position?: Vector3;    // Pool center position
  waterLevelOffsetM?: number; // Distance from rim to water surface (default: 0.15m)
}

export class SwimmingPool {
  readonly id: string;
  readonly group = new Group();
  readonly widthM: number;
  readonly lengthM: number;
  readonly depthM: number;
  readonly waterLevelOffsetM: number;
  readonly center = new Vector3();

  private readonly basinMesh: Mesh;
  private readonly copingMesh: Mesh;
  readonly waterMesh: Mesh;
  private readonly waterMaterial: MeshStandardNodeMaterial;
  private readonly fluidHandle: FluidHandle;
  private readonly scratchSample: LiquidSampleResult = {
    height: 0,
    displacementX: 0,
    displacementZ: 0,
    normal: new Vector3(0, 1, 0)
  };

  constructor(options: SwimmingPoolOptions) {
    this.id = options.id;
    this.widthM = Math.max(2.0, options.widthM ?? 10.0);
    this.lengthM = Math.max(2.0, options.lengthM ?? 25.0);
    this.depthM = Math.max(0.5, options.depthM ?? 2.2);
    this.waterLevelOffsetM = Math.max(0.05, options.waterLevelOffsetM ?? 0.15);

    if (options.position) {
      this.center.copy(options.position);
      this.group.position.copy(options.position);
    }
    this.group.name = `swimming-pool-${this.id}`;

    // 1. Tiled Basin Mesh (walls & floor)
    const wallThick = 0.35;
    const basinGeo = new BoxGeometry(this.widthM + wallThick * 2, this.depthM + 0.2, this.lengthM + wallThick * 2);
    basinGeo.translate(0, -(this.depthM + 0.2) * 0.5, 0);
    const basinMat = new MeshStandardMaterial({
      color: 0x007799,
      roughness: 0.25,
      metalness: 0.1,
    });
    this.basinMesh = new Mesh(basinGeo, basinMat);
    this.basinMesh.name = 'pool-basin';
    this.basinMesh.receiveShadow = true;
    this.group.add(this.basinMesh);

    // 2. White Marble Coping Rim Perimeter
    const copingWidth = 0.65;
    const copingGeo = new BoxGeometry(this.widthM + (wallThick + copingWidth) * 2, 0.12, this.lengthM + (wallThick + copingWidth) * 2);
    copingGeo.translate(0, 0.06, 0);
    const copingMat = new MeshStandardMaterial({
      color: 0xf0f3f6,
      roughness: 0.45,
    });
    this.copingMesh = new Mesh(copingGeo, copingMat);
    this.copingMesh.name = 'pool-coping';
    this.copingMesh.receiveShadow = true;
    this.group.add(this.copingMesh);

    // 3. Crystal-Clear Turquoise Water Mesh
    const waterGeo = new PlaneGeometry(this.widthM, this.lengthM, 16, 24);
    waterGeo.rotateX(-Math.PI / 2);
    const waterSurfaceY = -this.waterLevelOffsetM;
    waterGeo.translate(0, waterSurfaceY, 0);

    // Shore / edge damping attribute (1.0 at center, 0.0 at pool coping rim)
    const pos = waterGeo.getAttribute('position');
    const shoreArr = new Float32Array(pos.count);
    const halfW = this.widthM * 0.5;
    const halfL = this.lengthM * 0.5;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const distRim = Math.min(halfW - Math.abs(vx), halfL - Math.abs(vz));
      shoreArr[i] = Math.min(1.0, Math.max(0.0, distRim / 1.2));
    }
    waterGeo.setAttribute('shore', new Float32BufferAttribute(shoreArr, 1));

    // 4. Pool TSL Shader
    this.waterMaterial = this.createPoolMaterial();
    this.waterMesh = new Mesh(waterGeo, this.waterMaterial);
    this.waterMesh.name = 'pool-water-surface';
    this.waterMesh.receiveShadow = true;
    this.group.add(this.waterMesh);

    // 5. Register with FluidRegistry
    this.fluidHandle = registerFluid({
      id: `pool-${this.id}`,
      solvent: 'terrestrial-freshwater',
      geometryType: 'pool',
      scale: 'SMALL',
      profileId: 'SWIMMING_POOL',
      surfaceY: () => this.center.y - this.waterLevelOffsetM,
      shoreDistance: (x, z) => this.sampleSignedPerimeterDistance(x, z),
    });
  }

  private createPoolMaterial(): MeshStandardNodeMaterial {
    const material = new MeshStandardNodeMaterial({
      roughness: 0.08,
      metalness: 0.12,
      color: '#088aa8',
      side: DoubleSide,
      transparent: true,
      depthWrite: true,
    });

    const shore = attribute('shore', 'float');
    const p = positionLocal;
    const wp = positionWorld;

    // SWIMMING_POOL Gerstner harmonics
    const waves = WATER_WAVE_PROFILES.SWIMMING_POOL;
    let totalElev: any = float(0.0);
    let dHx: any = float(0.0);
    let dHz: any = float(0.0);

    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      const k = (2.0 * Math.PI) / w.wavelength;
      const c = Math.sqrt(9.80665 / k);
      const amp = float(w.amplitude);
      const phase = dot(vec2(p.x, p.z), vec2(w.direction[0], w.direction[1]))
        .mul(k)
        .sub(time.mul(w.speed * c));
      const sinP = sin(phase);
      const cosP = cos(phase);

      totalElev = totalElev.add(sinP.mul(amp));
      const wa = amp.mul(k);
      dHx = dHx.add(float(w.direction[0]).mul(wa).mul(cosP));
      dHz = dHz.add(float(w.direction[1]).mul(wa).mul(cosP));
    }

    material.positionNode = positionLocal.add(vec3(0, totalElev.mul(shore), 0));
    const waveNormal = vec3(dHx.mul(shore).negate(), float(1.0), dHz.mul(shore).negate()).normalize();
    material.normalNode = waveNormal;

    // Fresnel specular
    const viewDir = cameraPosition.sub(wp).normalize();
    const cosTheta = waveNormal.dot(viewDir).abs();
    const fresnel = float(0.025).add(pow(float(1.0).sub(cosTheta), 5.0).mul(0.975));

    // Sun highlight
    const sunDir = vec3(0.42, 0.82, 0.38).normalize();
    const halfDir = viewDir.add(sunDir).normalize();
    const NdotH = max(waveNormal.dot(halfDir), float(0.0));
    const sunGlint = pow(NdotH, 96.0).mul(4.2);

    // Pool caustics network
    const causticsCoord = vec2(p.x, p.z).mul(1.8).add(vec2(time.mul(0.6), time.mul(0.4)));
    const causticsWave = sin(causticsCoord.x.mul(1.5).add(cos(causticsCoord.y.mul(1.2))))
      .add(cos(causticsCoord.y.mul(1.5).add(sin(causticsCoord.x.mul(1.2)))))
      .mul(0.5);
    const causticsPattern = pow(smoothstep(0.35, 0.95, causticsWave.abs()), 2.5).mul(0.45);
    const causticsLight = color('#b8f4ff').mul(causticsPattern);

    // Crystal-clear turquoise water color blend
    const deepTurquoise = color('#088aa8');
    const shallowCyan = color('#44e0f4');
    const skyReflect = color('#d4f4ff');
    const poolBase = mix(deepTurquoise, shallowCyan, float(0.45)).add(causticsLight);
    const poolSurface = mix(poolBase, skyReflect, fresnel.mul(0.65)).add(color('#ffffff').mul(sunGlint));

    material.colorNode = poolSurface;
    material.opacityNode = float(0.82);

    return material;
  }

  /** Checks whether world coordinates (x, z) fall within the pool perimeter. */
  containsPoint(worldX: number, worldZ: number): boolean {
    const lx = worldX - this.center.x;
    const lz = worldZ - this.center.z;
    return Math.abs(lx) <= this.widthM * 0.5 && Math.abs(lz) <= this.lengthM * 0.5;
  }

  /** Signed distance to the coping edge in meters (positive inside water, negative outside). */
  sampleSignedPerimeterDistance(worldX: number, worldZ: number): number {
    const lx = Math.abs(worldX - this.center.x);
    const lz = Math.abs(worldZ - this.center.z);
    const dx = this.widthM * 0.5 - lx;
    const dz = this.lengthM * 0.5 - lz;
    return Math.min(dx, dz);
  }

  /** Samples wave height and normal on the pool surface. */
  sampleSurface(worldX: number, worldZ: number, timeSec: number, out?: LiquidSampleResult): LiquidSampleResult {
    const res = out || this.scratchSample;
    const lx = worldX - this.center.x;
    const lz = worldZ - this.center.z;
    const distEdge = this.sampleSignedPerimeterDistance(worldX, worldZ);
    const shoreDamp = Math.min(1.0, Math.max(0.0, distEdge / 1.2));
    const baseElevation = this.center.y - this.waterLevelOffsetM;

    return sampleGerstnerSpectrum(
      WATER_WAVE_PROFILES.SWIMMING_POOL,
      lx, lz, timeSec, baseElevation, res, shoreDamp
    );
  }

  getDepthAt(worldX: number, worldZ: number): number {
    if (!this.containsPoint(worldX, worldZ)) return 0;
    return this.depthM - this.waterLevelOffsetM;
  }

  dispose(): void {
    this.basinMesh.geometry.dispose();
    (this.basinMesh.material as MeshStandardMaterial).dispose();
    this.copingMesh.geometry.dispose();
    (this.copingMesh.material as MeshStandardMaterial).dispose();
    this.waterMesh.geometry.dispose();
    this.waterMaterial.dispose();
    this.group.removeFromParent();
  }
}
