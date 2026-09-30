import { Group, Mesh, MeshBasicNodeMaterial, NormalBlending, PlaneGeometry, Vector3 } from 'three/webgpu';
import { color, float, max, mix, positionLocal, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { CelestialRenderSample } from './types';

export class MoonVisual {
  readonly group = new Group();
  private readonly disc: Mesh;
  private readonly material: MeshBasicNodeMaterial;
  
  // Direction to the sun from the moon in render space (for phase calculation)
  private readonly uPhaseLightDir = uniform(new Vector3(1, 0, 0));

  constructor() {
    this.group.name = 'MoonVisual';
    // 2x2 plane so local coords are [-1, 1]
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
    
    // The physical edge of the sphere is at r=1 in local normalized coords.
    const sx = x.div(0.9);
    const sy = y.div(0.9);
    const sphereR2 = sx.mul(sx).add(sy.mul(sy));
    const normR = sphereR2.pow(0.5);
    
    // We want the disc to be exactly normR <= 1.0. Smooth edge for anti-aliasing.
    const disc = float(1).sub(smoothstep(float(0.98), float(1.0), normR));
    
    const z = float(1).sub(sphereR2).max(0).pow(0.5);
    const normal = vec3(sx, sy, z).normalize();
    
    // Basic N.L diffuse lighting for phase
    // In local space, the camera looks down -Z. The moon is a billboard facing the camera, 
    // so its local +Z points towards the camera. 
    // We will transform uPhaseLightDir into the billboard's local space in update() 
    // or just pass it in world space and transform normal to world space.
    // Easiest is to pass light dir in billboard local space.
    const nDotL = max(0, normal.dot(this.uPhaseLightDir));
    
    // Albedo/Color
    // Very simple maria pattern based on local coords, or just a solid color with some contrast
    const albedo = vec3(0.6, 0.62, 0.65);
    // Darken terminator a bit more for realistic lunar phase
    const lit = albedo.mul(nDotL.pow(0.8)); 
    
    // Extremely subtle ambient so the dark side isn't pure black (earthshine)
    const earthshine = vec3(0.05, 0.08, 0.12).mul(float(1).sub(nDotL));
    
    const finalColor = lit.add(earthshine);
    // Multiply alpha by disc shape to get the circle
    const alpha = disc;

    this.material.colorNode = vec4(finalColor, alpha);

    this.disc = new Mesh(geometry, this.material);
    this.disc.frustumCulled = false;
    this.group.add(this.disc);
  }

  update(sample: CelestialRenderSample): void {
    this.group.visible = sample.visible;
    if (!this.group.visible) return;

    // Radius scaling. Our shader uses r=0.9 for the disc edge.
    // We want physical radius to be `proxyRadiusM`.
    // The quad is 2x2. r=0.9 means 0.9 * scale = proxyRadiusM.
    const scale = sample.proxyRadiusM / 0.9;
    this.disc.scale.setScalar(scale);

    const dir = sample.directionRender;
    this.group.position.set(dir[0], dir[1], dir[2]).multiplyScalar(sample.proxyDistanceM);
    
    // Look at origin (camera). Local +Z points back at the camera.
    this.group.lookAt(0, 0, 0);

    // Update phase light dir. We must convert the world space light dir into the local space of the billboard.
    if (sample.phaseLightDirection) {
      const lightDir = new Vector3(sample.phaseLightDirection[0], sample.phaseLightDirection[1], sample.phaseLightDirection[2]);
      // Transform world direction to local direction
      // The group's quaternion rotates local to world. Its inverse rotates world to local.
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
