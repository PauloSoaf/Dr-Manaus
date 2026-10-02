import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector3 } from 'three/webgpu';
import { color, float, mix, positionLocal, smoothstep, vec3, vec4 } from 'three/tsl';
import type { CelestialRenderSample } from './types';

export class SunVisual {
  readonly group = new Group();
  private readonly disc: Mesh;
  private readonly material: MeshBasicNodeMaterial;

  constructor() {
    this.group.name = 'SunVisual';
    // Use a simple quad. The shader will draw a circle and corona.
    const geometry = new PlaneGeometry(2, 2); 
    
    this.material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true, 
      blending: AdditiveBlending,
      fog: false,
    });

    // UV-based shader for the sun disc and corona
    // positionLocal is in [-1, 1] range for a 2x2 plane
    const radius = positionLocal.xy.length();
    
    // Physical disc: sharp edge at r=0.5 (scaled in update)
    const disc = float(1).sub(smoothstep(float(0.48), float(0.50), radius));
    
    // Corona: falls off exponentially outside the disc
    const drop = float(1).sub(radius).max(0);
    const corona = drop.pow(3.5).mul(0.6).add(drop.pow(12).mul(0.4));
    
    // Core is very bright white-yellow, corona is warmer/softer
    const coreColor = vec3(1.0, 0.98, 0.95).mul(2.5);
    const coronaColor = vec3(1.0, 0.8, 0.5).mul(1.5);
    
    const finalColor = mix(coronaColor, coreColor, disc);
    const alpha = disc.add(corona).saturate();

    this.material.colorNode = vec4(finalColor, alpha);
    
    this.disc = new Mesh(geometry, this.material);
    this.disc.frustumCulled = false;
    this.group.add(this.disc);
  }

  update(sample: CelestialRenderSample, cameraPos: Vector3): void {
    this.group.visible = sample.visible;
    if (!this.group.visible) return;

    // The quad size needs to be larger than the physical proxy radius to fit the corona
    // The disc is drawn at r=0.5 in local quad space. So a quad of size S means r=0.5 is S/4.
    // If we want the physical radius to be `proxyRadiusM`, we need the quad width/height to be `proxyRadiusM * 4`.
    // We can also allow some extra space for the corona. Let's make the quad size `proxyRadiusM * 6`,
    // and scale the shader accordingly, or just scale the mesh.
    // At scale = proxyRadiusM * 2, the plane is 4 * proxyRadiusM wide (since geom is 2x2).
    // Local coords go from -1 to 1. r=0.5 corresponds to proxyRadiusM.
    const scale = sample.proxyRadiusM * 2.0; 
    // ^ This means local r=1 (edge of quad) is 2 * proxyRadiusM, giving 1 radius of corona space.
    
    this.disc.scale.setScalar(scale);

    // Place the proxy in the sky
    const dir = sample.directionRender;
    this.group.position.set(dir[0], dir[1], dir[2]).multiplyScalar(sample.proxyDistanceM);
    
    // Look at camera so it's a billboard
    this.group.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...dir).negate().normalize());
  }

  dispose(): void {
    this.disc.geometry.dispose();
    this.material.dispose();
  }
}
