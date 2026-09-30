import { Group, Mesh, MeshBasicNodeMaterial, NormalBlending, PlaneGeometry, Vector3 } from 'three/webgpu';
import { color, float, max, mix, positionLocal, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { CelestialRenderSample } from './types';

export class EarthVisual {
  readonly group = new Group();
  private readonly disc: Mesh;
  private readonly material: MeshBasicNodeMaterial;
  
  private readonly uPhaseLightDir = uniform(new Vector3(1, 0, 0));
  private readonly uOpacity = uniform(1);

  constructor() {
    this.group.name = 'EarthVisual';
    const geometry = new PlaneGeometry(2, 2);
    
    this.material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: NormalBlending,
      fog: false,
    });

    const x = positionLocal.x;
    const y = positionLocal.y;
    const rSq = x.mul(x).add(y.mul(y));
    const r = rSq.pow(0.5);
    
    const sx = x.div(0.9);
    const sy = y.div(0.9);
    const sphereR2 = sx.mul(sx).add(sy.mul(sy));
    const normR = sphereR2.pow(0.5);
    
    const disc = float(1).sub(smoothstep(float(0.98), float(1.0), normR));
    const z = float(1).sub(sphereR2).max(0).pow(0.5);
    const normal = vec3(sx, sy, z).normalize();
    
    const nDotL = max(0, normal.dot(this.uPhaseLightDir));
    
    // Albedo for Earth (blue with some atmosphere scattering look)
    const albedo = vec3(0.1, 0.3, 0.8);
    const lit = albedo.mul(nDotL.pow(0.8)); 
    
    const earthshine = vec3(0.02, 0.02, 0.05).mul(float(1).sub(nDotL));
    const finalColor = lit.add(earthshine);
    const alpha = disc.mul(this.uOpacity);

    this.material.colorNode = vec4(finalColor, alpha);

    this.disc = new Mesh(geometry, this.material);
    this.disc.frustumCulled = false;
    this.group.add(this.disc);
  }

  update(sample: CelestialRenderSample, cameraPos: Vector3): void {
    this.group.visible = sample.visible;
    this.uOpacity.value = Math.max(0, Math.min(1, sample.opacity));
    if (!this.group.visible) return;

    const scale = sample.proxyRadiusM / 0.9;
    this.disc.scale.setScalar(scale);

    const dir = sample.directionRender;
    this.group.position.set(dir[0], dir[1], dir[2]).multiplyScalar(sample.proxyDistanceM);
    
    this.group.lookAt(cameraPos);

    if (sample.phaseLightDirection) {
      const lightDir = new Vector3(sample.phaseLightDirection[0], sample.phaseLightDirection[1], sample.phaseLightDirection[2]);
      const invQuat = this.group.quaternion.clone().invert();
      lightDir.applyQuaternion(invQuat).normalize();
      this.uPhaseLightDir.value.copy(lightDir);
    }
  }

  dispose(): void {
    this.disc.geometry.dispose();
    this.material.dispose();
  }
}
