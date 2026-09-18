import { BoxGeometry, CylinderGeometry, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry } from 'three/webgpu';

const skin = new MeshStandardMaterial({ color: 0x123332, roughness: 0.25, metalness: 0.82, emissive: 0x063b2e, emissiveIntensity: 0.7 });
const dark = new MeshStandardMaterial({ color: 0x071d24, roughness: 0.34, metalness: 0.88 });
const gold = new MeshStandardMaterial({ color: 0xeec981, roughness: 0.35, metalness: 0.8, emissive: 0x5e310b, emissiveIntensity: 0.25 });
const energy = new MeshBasicMaterial({ color: 0x69ffce, toneMapped: false });
const echoSkin = new MeshStandardMaterial({ color: 0x245d59, emissive: 0x37bda0, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.6 });
const echoEnergy = new MeshBasicMaterial({ color: 0xffd38d, toneMapped: false });
const box = new BoxGeometry(1, 1, 1);
const limb = new CylinderGeometry(0.115, 0.09, 1, 6);
const head = new IcosahedronGeometry(0.23, 1);
const ring = new TorusGeometry(0.42, 0.017, 5, 32);

export class CharacterModel {
  readonly group = new Group();
  readonly body = new Group();
  readonly leftArm = new Group();
  readonly rightArm = new Group();
  readonly leftLeg = new Group();
  readonly rightLeg = new Group();
  readonly halo = new Group();
  private phase = 0;

  constructor(echo = false) {
    this.group.add(this.body);
    const part = (parent: Group, geometry: typeof box | typeof limb | typeof head | typeof ring, material: MeshStandardMaterial | MeshBasicMaterial, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Mesh => {
      const surface = echo ? (material === energy || material === gold ? echoEnergy : echoSkin) : material;
      const mesh = new Mesh(geometry, surface); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = !echo; parent.add(mesh); return mesh;
    };
    part(this.body, box, dark, 0, 1.16, 0, 0.44, 0.55, 0.26);
    part(this.body, box, skin, 0, 1.37, -0.035, 0.62, 0.38, 0.28);
    part(this.body, box, gold, 0, 1.05, -0.155, 0.43, 0.06, 0.035);
    part(this.body, box, energy, 0, 1.33, -0.19, 0.027, 0.31, 0.012);
    const sigil = part(this.body, ring, gold, 0, 1.4, -0.2, 0.3, 0.3, 0.3); sigil.rotation.z = Math.PI / 4;
    part(this.body, head, skin, 0, 1.81, 0, 0.83, 1.14, 0.86);
    part(this.body, box, energy, 0, 1.84, -0.19, 0.23, 0.025, 0.016);
    part(this.body, box, gold, 0, 2.045, 0, 0.15, 0.12, 0.08);
    this.leftArm.position.set(-0.39, 1.49, 0); this.rightArm.position.set(0.39, 1.49, 0);
    this.leftLeg.position.set(-0.15, 0.97, 0); this.rightLeg.position.set(0.15, 0.97, 0);
    this.body.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg, this.halo);
    for (const arm of [this.leftArm, this.rightArm]) {
      part(arm, head, gold, 0, 0, 0, 0.68, 0.56, 0.7);
      part(arm, limb, skin, 0, -0.22, 0, 1, 0.39, 1);
      part(arm, limb, dark, 0, -0.56, -0.025, 0.86, 0.34, 0.9);
      part(arm, box, energy, 0, -0.56, -0.118, 0.026, 0.29, 0.018);
      part(arm, head, skin, 0, -0.78, -0.02, 0.46, 0.56, 0.45);
    }
    for (const leg of [this.leftLeg, this.rightLeg]) {
      part(leg, limb, skin, 0, -0.24, 0, 1.05, 0.47, 1.05);
      part(leg, limb, dark, 0, -0.68, 0, 0.84, 0.38, 0.84);
      part(leg, box, energy, 0, -0.65, -0.09, 0.025, 0.35, 0.025);
      part(leg, box, gold, 0, -0.89, -0.06, 0.17, 0.12, 0.31);
    }
    this.halo.position.set(0, 1.4, 0.23);
    part(this.halo, ring, gold, 0, 0, 0, 1.35, 1.35, 1.35);
    part(this.halo, ring, energy, 0, 0, 0.04, 1.12, 1.12, 1.12).rotation.x = 0.18;
  }

  animate(dt: number, speed: number, flying: boolean, boost: boolean, pose: string): void {
    this.phase += dt;
    const stride = Math.min(1, speed / 5);
    const swing = Math.sin(this.phase * (speed > 8 ? 12 : 8)) * stride * 0.62;
    const smooth = Math.min(1, dt * 10);
    const targetLean = flying ? (boost ? -1.13 : -0.18) : 0;
    this.body.rotation.x += (targetLean - this.body.rotation.x) * smooth;
    this.body.position.y = flying ? Math.sin(this.phase * 2) * 0.055 : Math.abs(Math.sin(this.phase * 8)) * stride * 0.035;
    this.leftLeg.rotation.x += ((flying ? 0.13 : swing) - this.leftLeg.rotation.x) * smooth;
    this.rightLeg.rotation.x += ((flying ? -0.09 : -swing) - this.rightLeg.rotation.x) * smooth;
    let left = flying ? -0.12 : -swing, right = flying ? -0.12 : swing;
    if (pose === 'energy') right = -1.6;
    if (pose === 'shockwave' || pose === 'reconstruct' || pose === 'teleport') { left = -1.25; right = -1.25; }
    this.leftArm.rotation.x += (left - this.leftArm.rotation.x) * smooth;
    this.rightArm.rotation.x += (right - this.rightArm.rotation.x) * smooth;
    this.leftArm.rotation.z = flying || pose === 'giant' ? 0.23 : 0.07;
    this.rightArm.rotation.z = flying || pose === 'giant' ? -0.23 : -0.07;
    this.halo.rotation.z = this.phase * 0.15;
  }
}
