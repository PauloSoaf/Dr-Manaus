import { BoxGeometry, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, type Vector3 } from 'three/webgpu';

export interface DebrisOptions {
  /** Above real gravity on purpose: rubble that hangs in the air reads as polystyrene. */
  gravity: number;
  /** Fraction of the vertical speed kept across a ground bounce. */
  restitution: number;
  /** Per-second decay of the horizontal speed once a chunk is rolling. */
  friction: number;
  lifetime: number;
  speedScale: number;
  sizeScale: number;
  /** Chunks further than this from the player are retired early rather than simulated. */
  cullRadius: number;
}

/**
 * One InstancedMesh, one material, one draw call. Every chunk lives in parallel typed arrays
 * so a collapse allocates nothing and the integrator stays a linear scan over cache lines.
 */
export class DebrisPool {
  readonly mesh: InstancedMesh;
  private readonly capacity: number;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly vz: Float32Array;
  private readonly ax: Float32Array;
  private readonly ay: Float32Array;
  private readonly az: Float32Array;
  private readonly rx: Float32Array;
  private readonly ry: Float32Array;
  private readonly rz: Float32Array;
  private readonly life: Float32Array;
  private readonly span: Float32Array;
  private readonly size: Float32Array;
  private readonly alive: Uint8Array;
  private readonly dummy = new Object3D();
  private readonly color = new Color();
  private readonly hidden = new Matrix4();
  private cursor = 0;
  private limit: number;
  private live = 0;
  private seed = 0x9e3779b9;

  constructor(root: Group, capacity: number, private readonly options: DebrisOptions) {
    this.capacity = capacity;
    this.limit = capacity;
    this.px = new Float32Array(capacity); this.py = new Float32Array(capacity); this.pz = new Float32Array(capacity);
    this.vx = new Float32Array(capacity); this.vy = new Float32Array(capacity); this.vz = new Float32Array(capacity);
    this.ax = new Float32Array(capacity); this.ay = new Float32Array(capacity); this.az = new Float32Array(capacity);
    this.rx = new Float32Array(capacity); this.ry = new Float32Array(capacity); this.rz = new Float32Array(capacity);
    this.life = new Float32Array(capacity); this.span = new Float32Array(capacity); this.size = new Float32Array(capacity);
    this.alive = new Uint8Array(capacity);
    // Slightly non-cubic chunks: a perfect cube reads as a crate, a slab reads as masonry.
    this.mesh = new InstancedMesh(new BoxGeometry(1, .78, .92), new MeshStandardMaterial({ roughness: .94, metalness: .02 }), capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    // Shadow casting on several hundred tumbling instances doubles the shadow pass for rubble
    // that is airborne for under two seconds; the pool receives shadows instead.
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'destruction-debris';
    this.hidden.makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) { this.mesh.setMatrixAt(i, this.hidden); this.mesh.setColorAt(i, this.color.setRGB(.6, .6, .6)); }
    root.add(this.mesh);
  }

  get count(): number { return this.live; }

  /** xorshift32: deterministic across runs, and cheaper than `Math.random`. */
  private random(): number {
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed & 0xffffff) / 0x1000000;
  }

  /** `energy` is the blast's characteristic length in metres: it drives both throw and chunk size. */
  spawn(x: number, y: number, z: number, count: number, colour: number, energy: number): void {
    if (this.limit <= 0) return;
    const throwScale = (.6 + energy * .25) * this.options.speedScale;
    const chunkScale = (.5 + energy * .35) * this.options.sizeScale;
    const spread = .25 + energy * .55;
    this.color.set(colour);
    for (let n = 0; n < count; n++) {
      // Ring cursor: slots are handed out in order, so overwriting the next one always
      // recycles the oldest chunk without a search.
      const i = this.cursor;
      this.cursor = this.cursor + 1 >= this.limit ? 0 : this.cursor + 1;
      if (!this.alive[i]) this.live++;
      this.alive[i] = 1;
      this.px[i] = x + (this.random() - .5) * spread * 2;
      this.py[i] = y + (this.random() - .5) * spread * 2;
      this.pz[i] = z + (this.random() - .5) * spread * 2;
      const speed = (4 + this.random() * 10) * throwScale;
      const theta = this.random() * Math.PI * 2, height = .15 + this.random() * .95;
      const flat = Math.sqrt(Math.max(0, 1 - height * height));
      this.vx[i] = Math.cos(theta) * flat * speed;
      this.vy[i] = height * speed;
      this.vz[i] = Math.sin(theta) * flat * speed;
      this.ax[i] = (this.random() - .5) * 9; this.ay[i] = (this.random() - .5) * 9; this.az[i] = (this.random() - .5) * 9;
      this.rx[i] = this.random() * 6.283; this.ry[i] = this.random() * 6.283; this.rz[i] = this.random() * 6.283;
      this.size[i] = (.18 + this.random() * .5) * chunkScale;
      this.life[i] = this.span[i] = this.options.lifetime * (.6 + this.random() * .7);
      // Per-chunk shade keeps a single-colour collapse from looking like plastic.
      const tint = .72 + this.random() * .5;
      this.mesh.setColorAt(i, this.color.set(colour).multiplyScalar(tint));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number, player: Vector3): void {
    if (!this.live) return;
    const { gravity, restitution, friction, cullRadius } = this.options;
    const cullSq = cullRadius * cullRadius;
    const decay = Math.exp(-dt * friction);
    for (let i = 0; i < this.limit; i++) {
      if (!this.alive[i]) continue;
      let life = this.life[i] - dt;
      const dx = this.px[i] - player.x, dz = this.pz[i] - player.z;
      if (dx * dx + dz * dz > cullSq) life = 0;
      if (life <= 0) { this.alive[i] = 0; this.live--; this.life[i] = 0; this.mesh.setMatrixAt(i, this.hidden); continue; }
      this.life[i] = life;
      const half = this.size[i] * .5;
      this.vy[i] -= gravity * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] <= half) {
        this.py[i] = half;
        this.vy[i] = this.vy[i] < 0 ? -this.vy[i] * restitution : this.vy[i];
        this.vx[i] *= decay; this.vz[i] *= decay;
        this.ax[i] *= decay; this.ay[i] *= decay; this.az[i] *= decay;
      }
      this.rx[i] += this.ax[i] * dt; this.ry[i] += this.ay[i] * dt; this.rz[i] += this.az[i] * dt;
      // The last quarter of the life shrinks the chunk away: no per-instance opacity is needed.
      const fade = life / this.span[i];
      const scale = this.size[i] * (fade > .25 ? 1 : fade * 4);
      this.dummy.position.set(this.px[i], this.py[i], this.pz[i]);
      this.dummy.rotation.set(this.rx[i], this.ry[i], this.rz[i]);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Shrinking the budget parks the surplus chunks once instead of skipping them every frame. */
  setLimit(limit: number): void {
    const next = Math.max(0, Math.min(this.capacity, Math.floor(limit)));
    for (let i = next; i < this.limit; i++) {
      if (this.alive[i]) { this.alive[i] = 0; this.live--; }
      this.mesh.setMatrixAt(i, this.hidden);
    }
    if (next < this.limit) this.mesh.instanceMatrix.needsUpdate = true;
    this.limit = next;
    if (this.cursor >= next) this.cursor = 0;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
    this.mesh.dispose();
  }
}
