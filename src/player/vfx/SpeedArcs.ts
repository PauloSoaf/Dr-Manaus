import { AdditiveBlending, BoxGeometry, Color, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D, Quaternion, Vector3 } from 'three/webgpu';

/**
 * Cosmic lightning shed by running fast enough that the ground stops mattering.
 *
 * Ten bolts of three segments each, one InstancedMesh, one draw call, no allocation in the frame
 * loop. Bolts live in the character's own space, so they inherit the yaw and the size scale and
 * cost nothing to keep attached.
 */
export const SPEED_ARCS = {
  bolts: 10,
  segments: 3,
  /**
   * Metres per second, already divided by sqrt(size), so a titan needs a titan's pace. Walking is
   * 6.5 and sprinting is 16, so a sprint sparks and a boosted run at 120 is a full storm.
   */
  threshold: 9,
  full: 34,
  minLife: 0.05,
  maxLife: 0.15,
  /** Bolts per second at full intensity. */
  rate: 46,
} as const;

const COUNT = SPEED_ARCS.bolts * SPEED_ARCS.segments;
const WHITE = new Color('#ffffff');
const VIOLET = new Color('#a05cff');
const BLUE = new Color('#6fb6ff');

/** Where a bolt may start and end: down the legs, along the arms, off the back, around the body. */
const ANCHORS: readonly (readonly [number, number, number])[] = [
  [-0.19, 0.12, 0.02], [0.19, 0.12, 0.02],
  [-0.21, 0.58, 0.04], [0.21, 0.58, 0.04],
  [-0.34, 1.18, 0.0], [0.34, 1.18, 0.0],
  [-0.41, 1.44, -0.04], [0.41, 1.44, -0.04],
  [0.0, 1.52, 0.17], [0.0, 1.06, 0.2],
  [-0.4, 0.96, 0.12], [0.4, 0.96, 0.12],
  [0.0, 0.32, -0.18], [0.0, 1.66, 0.0],
];

interface Bolt { life: number; duration: number }

const clamp01 = (value: number): number => (value > 1 ? 1 : value < 0 ? 0 : value);
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Intensity of the arcs at a given ground speed. Zero below the threshold, one at `full`. */
export function arcIntensity(groundSpeed: number, size = 1): number {
  if (!Number.isFinite(groundSpeed) || !Number.isFinite(size)) return 0;
  const normalised = Math.max(0, groundSpeed) / Math.sqrt(Math.max(1, size));
  return smoothstep(SPEED_ARCS.threshold, SPEED_ARCS.full, normalised);
}

export class SpeedArcs {
  readonly mesh: InstancedMesh<BoxGeometry, MeshBasicMaterial>;
  private readonly bolts: Bolt[] = Array.from({ length: SPEED_ARCS.bolts }, () => ({ life: 0, duration: 1 }));
  private readonly dummy = new Object3D();
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly mid = new Vector3();
  private readonly step = new Vector3();
  private readonly axis = new Vector3(0, 1, 0);
  private readonly rotation = new Quaternion();
  private readonly colour = new Color();
  private readonly points: Vector3[] = Array.from({ length: SPEED_ARCS.segments + 1 }, () => new Vector3());
  private seed = 0x9e3779b9;
  private spawnDebt = 0;
  private cursor = 0;
  private intensity = 0;
  private live = 0;
  private disposed = false;

  constructor(parent: Object3D) {
    this.mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      COUNT,
    );
    this.mesh.name = 'cosmic-speed-arcs';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let index = 0; index < COUNT; index++) {
      this.mesh.setMatrixAt(index, this.dummy.matrix);
      this.mesh.setColorAt(index, WHITE);
    }
    parent.add(this.mesh);
  }

  get activeBolts(): number { return this.live; }
  get strength(): number { return this.intensity; }

  /** xorshift32, because the same sprint has to look the same twice and Math.random is banned. */
  private random(): number {
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed & 0xffffff) / 0x1000000;
  }

  private anchor(target: Vector3): Vector3 {
    const pick = ANCHORS[Math.floor(this.random() * ANCHORS.length) % ANCHORS.length];
    return target.set(pick[0], pick[1], pick[2]);
  }

  private spawn(index: number): void {
    const bolt = this.bolts[index];
    bolt.duration = SPEED_ARCS.minLife + this.random() * (SPEED_ARCS.maxLife - SPEED_ARCS.minLife);
    bolt.life = bolt.duration;

    this.anchor(this.from);
    this.anchor(this.to);
    // Two anchors that landed on the same spot would give a zero-length bolt; push them apart.
    if (this.from.distanceToSquared(this.to) < 0.02) this.to.y += 0.4 + this.random() * 0.5;

    this.points[0].copy(this.from);
    this.points[SPEED_ARCS.segments].copy(this.to);
    const spread = 0.09 + this.intensity * 0.1;
    for (let segment = 1; segment < SPEED_ARCS.segments; segment++) {
      const t = segment / SPEED_ARCS.segments;
      this.mid.lerpVectors(this.from, this.to, t);
      this.mid.x += (this.random() - 0.5) * spread * 2;
      this.mid.y += (this.random() - 0.5) * spread;
      this.mid.z += (this.random() - 0.5) * spread * 2;
      this.points[segment].copy(this.mid);
    }

    // White core with violet and blue accents: the palette the rest of the skin already uses.
    const tint = this.random();
    this.colour.copy(tint > 0.62 ? VIOLET : tint > 0.34 ? WHITE : BLUE);
    if (tint > 0.62) this.colour.lerp(WHITE, this.random() * 0.45);

    const base = index * SPEED_ARCS.segments;
    const width = (0.012 + this.random() * 0.016) * (0.6 + this.intensity * 0.8);
    for (let segment = 0; segment < SPEED_ARCS.segments; segment++) {
      const a = this.points[segment], b = this.points[segment + 1];
      this.step.subVectors(b, a);
      const length = this.step.length();
      this.dummy.position.copy(a).addScaledVector(this.step, 0.5);
      if (length > 1e-5) {
        this.step.multiplyScalar(1 / length);
        this.rotation.setFromUnitVectors(this.axis, this.step);
        this.dummy.quaternion.copy(this.rotation);
      } else {
        this.dummy.quaternion.identity();
      }
      this.dummy.scale.set(width, Math.max(0.02, length), width);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(base + segment, this.dummy.matrix);
      this.mesh.setColorAt(base + segment, this.colour);
    }
  }

  private hide(index: number): void {
    this.dummy.position.set(0, 0, 0);
    this.dummy.quaternion.identity();
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    const base = index * SPEED_ARCS.segments;
    for (let segment = 0; segment < SPEED_ARCS.segments; segment++) this.mesh.setMatrixAt(base + segment, this.dummy.matrix);
  }

  /**
   * `groundSpeed` is the horizontal speed; `airborne` suppresses the arcs entirely, because this
   * is a running effect and the flight skin already carries its own trail.
   */
  update(dt: number, groundSpeed: number, size = 1, airborne = false): void {
    if (this.disposed) return;
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    const target = airborne ? 0 : arcIntensity(groundSpeed, size);
    // Fades rather than switches, so slowing down does not cut the arcs off mid-bolt.
    this.intensity += (target - this.intensity) * (1 - Math.exp(-step * (target > this.intensity ? 14 : 7)));
    if (this.intensity < 0.004) this.intensity = 0;

    let live = 0;
    let dirty = false;
    for (let index = 0; index < this.bolts.length; index++) {
      const bolt = this.bolts[index];
      if (bolt.life <= 0) continue;
      bolt.life -= step;
      if (bolt.life <= 0) { this.hide(index); dirty = true; continue; }
      live++;
    }

    if (this.intensity > 0.01) {
      this.spawnDebt += step * SPEED_ARCS.rate * this.intensity;
      let budget = SPEED_ARCS.bolts;
      while (this.spawnDebt >= 1 && budget-- > 0) {
        this.spawnDebt -= 1;
        const index = this.cursor++ % this.bolts.length;
        this.spawn(index);
        dirty = true;
        live++;
      }
      if (this.spawnDebt > SPEED_ARCS.bolts) this.spawnDebt = SPEED_ARCS.bolts;
    } else {
      this.spawnDebt = 0;
    }

    this.live = Math.min(live, this.bolts.length);
    this.mesh.material.opacity = 0.35 + this.intensity * 0.6;
    this.mesh.visible = this.intensity > 0.01 && this.live > 0;
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
