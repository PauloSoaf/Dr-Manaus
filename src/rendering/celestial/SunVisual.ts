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
    
    // Scale is set such that radius=0.1 corresponds to the physical disc.
    // 0.1 allows the quad to be 5x the physical disc radius.
    const disc = float(1).sub(smoothstep(float(0.19), float(0.20), radius));
    
    // Inner glow (up to 2x physical radius, so radius 0.4)
    const innerDrop = radius.sub(0.2).max(0).div(0.2);
    const innerGlow = float(1).sub(innerDrop).max(0).pow(1.5).mul(0.8);
    
    // Outer corona (up to 5x physical radius, so radius 1.0)
    const outerDrop = radius.sub(0.2).max(0).div(0.8);
    const outerCorona = float(1).sub(outerDrop).max(0).pow(3.0).mul(0.4);
    
    // Core is very bright white-yellow, corona is warmer/softer
    const coreColor = vec3(1.0, 0.98, 0.95).mul(2.5);
    const innerColor = vec3(1.0, 0.9, 0.7).mul(1.5);
    const coronaColor = vec3(1.0, 0.6, 0.2).mul(0.8);
    
    // Blend them
    const finalColor = mix(
      mix(coronaColor, innerColor, innerGlow),
      coreColor,
      disc
    );
    const alpha = disc.add(innerGlow).add(outerCorona).saturate();

    this.material.colorNode = vec4(finalColor, alpha);
    
    this.disc = new Mesh(geometry, this.material);
    this.disc.frustumCulled = false;
    this.group.add(this.disc);
  }

  update(sample: CelestialRenderSample, cameraPos: Vector3): void {
    this.group.visible = sample.visible;
    if (!this.group.visible) return;

    // The quad size needs to be larger than the physical proxy radius to fit the corona
    // The disc is drawn at r=0.2 in local quad space.
    // So if local r=0.2 corresponds to proxyRadiusM, local r=1.0 is 5 * proxyRadiusM.
    const scale = sample.proxyRadiusM * 5.0; 
    
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
