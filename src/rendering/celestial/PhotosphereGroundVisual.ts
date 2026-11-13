import { Color, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector3 } from 'three/webgpu';
import { Fn, float, mix, mx_noise_float, mx_worley_noise_float, positionLocal, smoothstep, uniform, vec3, vec4 } from 'three/tsl';

/**
 * Tangent-plane photospheric surface visual for solar landing (sun/local-enu).
 *
 * Renders an expansive, boiling convective plasma ocean under the player's feet
 * at y = 0, with granulation cells, hot upwelling centers, darker lanes and
 * radial horizon fading.
 */
export class PhotosphereGroundVisual {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private readonly material: MeshBasicNodeMaterial;
  private readonly clock = uniform(0);
  private timeS = 0;

  constructor() {
    this.group.name = 'PhotosphereGroundVisual';
    this.group.visible = false;

    // 80 km x 80 km horizontal plane
    const geometry = new PlaneGeometry(80_000, 80_000, 32, 32);
    geometry.rotateX(-Math.PI / 2);

    this.material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: true,
      depthTest: true,
      fog: false,
    });

    const clockNode = this.clock;

    this.material.colorNode = Fn(() => {
      // Local UV/position relative to the 80 km plane
      const p = positionLocal;
      const distFromCenter = p.xz.length();
      
      // Normalized coordinates for multi-scale convective noise
      const uvMacro = p.xz.mul(0.0003); // ~3 km granules
      const uvMicro = p.xz.mul(0.002);  // ~500 m fine granulation

      const tSlow = clockNode.mul(0.08);
      const tFast = clockNode.mul(0.18);

      // Convective cells via Worley noise (Voronoi)
      const macroCell = mx_worley_noise_float(vec3(uvMacro.x, tSlow, uvMacro.y));
      const microNoise = mx_noise_float(vec3(uvMicro.x, uvMicro.y, tFast)).mul(0.5).add(0.5);

      // Granule profile: bright hot centers, darker intergranular lanes
      const lane = smoothstep(0.35, 0.75, macroCell);
      const convection = float(1.0).sub(lane.mul(0.42)).mul(microNoise.mul(0.25).add(0.85));

      // Solar color palette: deep orange intergranular lanes to blinding white-gold centers
      const cDeepOrange = vec3(1.6, 0.45, 0.05); // #ff5500 high intensity
      const cGolden = vec3(2.3, 1.25, 0.25);     // #ffaa22 hot convective plasma
      const cBrightCenter = vec3(2.8, 2.1, 1.2); // near-white solar core

      const baseColor = mix(cDeepOrange, cGolden, convection);
      const finalColor = mix(baseColor, cBrightCenter, smoothstep(0.72, 1.1, convection));

      // Horizon falloff: smooth radial fade towards 40 km edge
      const edgeAlpha = float(1.0).sub(smoothstep(28_000, 39_500, distFromCenter));

      return vec4(finalColor, edgeAlpha);
    })();

    this.mesh = new Mesh(geometry, this.material);
    this.mesh.position.y = -0.05; // Slightly below y=0 ground plane for clean character contact
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  update(dtS: number, playerPosition?: Vector3, isPhotosphere = false): void {
    this.group.visible = isPhotosphere;
    if (!isPhotosphere) return;

    this.timeS += Math.max(0, Math.min(0.25, dtS));
    this.clock.value = this.timeS;

    if (playerPosition) {
      // Keep the 80 km plane centered under the player on X and Z
      this.mesh.position.x = playerPosition.x;
      this.mesh.position.z = playerPosition.z;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
