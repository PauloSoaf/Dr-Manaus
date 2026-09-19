import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, TorusGeometry, Vector3 } from 'three/webgpu';
import { CosmicAura } from './cosmic/CosmicAura';
import { CosmicMaterial, type CosmicLevel } from './cosmic/CosmicMaterial';

export type { CosmicLevel };

const skin = new MeshStandardMaterial({ color: 0x10162d, roughness: 0.22, metalness: 0.76, emissive: 0x25105e, emissiveIntensity: 1.05 });
const dark = new MeshStandardMaterial({ color: 0x050714, roughness: 0.28, metalness: 0.9, emissive: 0x080d2c, emissiveIntensity: 0.55 });
const gold = new MeshStandardMaterial({ color: 0x9c8cff, roughness: 0.28, metalness: 0.82, emissive: 0x281865, emissiveIntensity: 0.55 });
const energy = new MeshBasicMaterial({ color: 0x77f7ff, toneMapped: false });
const cosmic = new MeshBasicMaterial({ color: 0xb08cff, toneMapped: false });
const echoSkin = new MeshStandardMaterial({ color: 0x245d59, emissive: 0x37bda0, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.6 });
const echoEnergy = new MeshBasicMaterial({ color: 0xffd38d, toneMapped: false });
const starGeometry = new IcosahedronGeometry(0.028, 0);
const starMaterial = new MeshBasicMaterial({ color: 0xd8fbff, transparent: true, opacity: 0.92, depthWrite: false, toneMapped: false });
const box = new BoxGeometry(1, 1, 1);
const limb = new CylinderGeometry(0.115, 0.09, 1, 6);
const head = new IcosahedronGeometry(0.23, 1);
const ring = new TorusGeometry(0.42, 0.017, 5, 32);
const ORIGIN = new Vector3();

/**
 * Bakes each vertex's rest-pose position in body metres, plus the part's own scale. One shared
 * cosmic material can then paint a single continuous universe across every piece of the figure:
 * `positionLocal` alone would restart it inside each box and cylinder, and a world-space mapping
 * would either swim as the character moves or lag a frame behind it at mega speed.
 */
function cosmicGeometry(source: BufferGeometry, base: Vector3, x: number, y: number, z: number, sx: number, sy: number, sz: number): BufferGeometry {
  const geometry = source.clone();
  const local = geometry.getAttribute('position');
  const body = new Float32Array(local.count * 3), scale = new Float32Array(local.count * 3);
  for (let i = 0; i < local.count; i++) {
    const slot = i * 3;
    body[slot] = base.x + x + local.getX(i) * sx;
    body[slot + 1] = base.y + y + local.getY(i) * sy;
    body[slot + 2] = base.z + z + local.getZ(i) * sz;
    scale[slot] = sx; scale[slot + 1] = sy; scale[slot + 2] = sz;
  }
  geometry.setAttribute('cosmicPos', new Float32BufferAttribute(body, 3));
  geometry.setAttribute('cosmicScale', new Float32BufferAttribute(scale, 3));
  return geometry;
}

export class CharacterModel {
  readonly group = new Group();
  readonly body = new Group();
  readonly leftArm = new Group();
  readonly rightArm = new Group();
  readonly leftLeg = new Group();
  readonly rightLeg = new Group();
  readonly halo = new Group();
  readonly starfield?: InstancedMesh;
  private phase = 0;
  private readonly universe?: CosmicMaterial;
  private readonly aura?: CosmicAura;
  private readonly baked: BufferGeometry[] = [];
  private readonly facing = new Vector3(0, 0, -1);
  private level: CosmicLevel | null = null;
  private levelSpeed = 0;

  constructor(echo = false) {
    this.group.add(this.body);
    // Echoes stay the old teal silhouette: three clones must not each pay for a universe.
    if (!echo) this.universe = new CosmicMaterial();
    const cosmicSurface = this.universe?.material;
    const part = (parent: Group, geometry: typeof box | typeof limb | typeof head | typeof ring, material: MeshStandardMaterial | MeshBasicMaterial, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Mesh => {
      const universal = !echo && (material === skin || material === dark) && cosmicSurface !== undefined;
      const surface = echo ? (material === energy || material === gold || material === cosmic ? echoEnergy : echoSkin) : universal && cosmicSurface ? cosmicSurface : material;
      let shape: BufferGeometry = geometry;
      if (universal) { shape = cosmicGeometry(geometry, parent === this.body ? ORIGIN : parent.position, x, y, z, sx, sy, sz); this.baked.push(shape); }
      const mesh = new Mesh(shape, surface); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = !echo; parent.add(mesh); return mesh;
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
    part(this.halo, ring, cosmic, 0, 0, 0.065, .88, .88, .88).rotation.set(.38, .16, Math.PI / 4);
    if (!echo) {
      this.aura = new CosmicAura(this.group);
      this.starfield = new InstancedMesh(starGeometry, starMaterial, 30);
      const star = new Object3D();
      for (let i = 0; i < 30; i++) {
        const angle = i * 2.399963;
        const band = i % 6;
        const radius = .16 + (i % 5) * .07;
        star.position.set(Math.cos(angle) * radius, .22 + band * .29, Math.sin(angle) * .11 - .13);
        const scale = .55 + (i % 4) * .18;
        star.scale.setScalar(scale);
        star.rotation.set(angle * .17, angle * .31, angle * .13);
        star.updateMatrix();
        this.starfield.setMatrixAt(i, star.matrix);
      }
      this.starfield.instanceMatrix.needsUpdate = true;
      this.body.add(this.starfield);
    }
  }

  /**
   * Drives the cosmic look from outside. Call it every frame before `animate`; `forward` is the
   * player's world-space heading and only steers the aura trail. Left uncalled, `animate` derives
   * a sensible level from the flags it already receives.
   */
  setCosmicLevel(level: CosmicLevel, speed: number, forward?: Vector3): void {
    this.level = level;
    this.levelSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    if (forward && forward.lengthSq() > 1e-6) this.facing.copy(forward);
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
    if (this.starfield) {
      this.starfield.rotation.y = Math.sin(this.phase * .37) * .11;
      this.starfield.rotation.z = this.phase * .035;
      this.starfield.scale.setScalar(1 + Math.sin(this.phase * 2.4) * .018);
    }
    if (!this.universe && !this.aura) return;
    const level = this.level ?? (pose ? 'power' : boost ? 'boost' : flying ? 'flight' : speed > .4 ? 'flight' : 'idle');
    const pace = this.level ? this.levelSpeed : speed;
    this.universe?.update(dt, level, pace);
    this.aura?.update(dt, level, pace, this.facing);
  }

  dispose(): void {
    this.aura?.dispose();
    this.universe?.dispose();
    for (const geometry of this.baked) geometry.dispose();
    this.baked.length = 0;
  }
}
