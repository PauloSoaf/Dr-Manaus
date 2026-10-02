import { AdditiveBlending, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector3 } from 'three/webgpu';
import { float, mix, positionLocal, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { CelestialRenderSample } from './types';
import { SOLAR_BODY_PROFILES } from '../../world/celestial/CelestialBodyProfile';

export class SunVisual {
  readonly group = new Group();
  private readonly disc: Mesh;
  private readonly material: MeshBasicNodeMaterial;
  private readonly uOpacity = uniform(1);
  private readonly glow = SOLAR_BODY_PROFILES.sun.visual.solarGlow!;

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
    
    const discRadius = 1 / this.glow.outerScale;
    const disc = float(1).sub(smoothstep(float(discRadius * 0.95), float(discRadius), radius));
    
    // Optical inner halo and corona are separate from the physical angular disc.
    const innerDrop = radius.sub(discRadius).max(0).div(discRadius * (this.glow.innerScale - 1));
    const innerGlow = float(1).sub(innerDrop).max(0).pow(1.5).mul(0.8);
    
    const outerDrop = radius.sub(discRadius).max(0).div(1 - discRadius);
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
    const alpha = disc.add(innerGlow).add(outerCorona).saturate().mul(this.uOpacity);

    this.material.colorNode = vec4(finalColor, alpha);
    
    this.disc = new Mesh(geometry, this.material);
    this.disc.frustumCulled = false;
    this.group.add(this.disc);
  }

  update(sample: CelestialRenderSample, cameraPos: Vector3): void {
    this.group.visible = sample.visible;
    if (!this.group.visible) return;

    // Only the optical quad expands; the disc's radius remains proxyRadiusM.
    const scale = sample.proxyRadiusM * this.glow.outerScale;
    this.uOpacity.value = Math.max(0, Math.min(1, sample.opacity));
    
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
