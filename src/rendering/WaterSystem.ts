import { Color, Group, Mesh, MeshStandardNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { cameraPosition, color, float, mix, normalWorld, positionLocal, positionWorld, sin, smoothstep, time, vec3 } from 'three/tsl';
/** One TSL shader runs through both WebGPU and the WebGL2 backend. No planar reflection pass. */
export class WaterSystem {
  readonly material = new MeshStandardNodeMaterial({ roughness: .33, metalness: .58, color: '#25464c' });
  constructor(root: Group) {
    const p = positionLocal;
    const wave = sin(p.x.mul(.13).add(time.mul(.6))).mul(sin(p.y.mul(.19).add(time.mul(.45))));
    const distant = smoothstep(250, 5000, cameraPosition.distance(positionWorld));
    const fresnel = float(1).sub(normalWorld.dot(cameraPosition.sub(positionWorld).normalize()).abs()).pow(3);
    const ripple = wave.mul(.11).mul(float(1).sub(distant));
    const water = mix(color('#183b40'), color('#88a6a0'), fresnel.mul(.7).add(ripple));
    // Geographic east/south seam preserves the confluence's dark and sediment-rich waters.
    const muddy = smoothstep(8700, 9400, p.x.add(p.y.mul(.21)));
    this.material.colorNode = mix(water, color('#91846a'), muddy.mul(.88));
    this.material.positionNode = vec3(p.x, p.y, wave.mul(.14).mul(float(1).sub(distant)));
    this.material.roughnessNode = mix(float(.25), float(.62), distant);
    const mesh = new Mesh(new PlaneGeometry(90000, 90000, 120, 120), this.material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, -3, 0); mesh.receiveShadow = true;
    root.add(mesh);
  }
  setNight(night: boolean) { this.material.emissive = new Color(night ? '#071417' : '#000000'); }
}
