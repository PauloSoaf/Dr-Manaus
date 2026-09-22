import { CircleGeometry, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MultiplyBlending, Object3D } from 'three/webgpu';

export interface ScarOptions {
  /** Total life of a scorch mark, in seconds. Long: these are meant to read as a trail. */
  duration: number;
  /** Seconds spent cooling from the glowing core to charcoal. */
  hotTime: number;
  /** Seconds of the tail spent dissolving the charcoal back into the ground. */
  fadeTime: number;
  /**
   * Metres above y=0. Road ribbons occupy .22..34 and their lane paint sits at +.012, so a scar
   * must be clearly above .352 or it disappears under exactly the asphalt most beams land on.
   */
  height: number;
}

const FREE = 0, COOLING = 1, SETTLED = 2, FADING = 3;

/**
 * Persistent scorch marks in a single instanced draw call. The material multiplies the ground
 * instead of painting over it, so one flat disc darkens asphalt, sand and grass alike, and a
 * scar retires simply by fading its instance colour back to white, which is multiply's identity.
 */
export class ScarField {
  readonly mesh: InstancedMesh;
  private readonly capacity: number;
  private readonly life: Float32Array;
  private readonly phase: Uint8Array;
  private readonly dummy = new Object3D();
  private readonly color = new Color();
  private readonly hidden = new Matrix4();
  // Multiply blending clamps at 1, so the "hot" state tints rather than adds light; the actual
  // glow of an impact is the additive flash EffectPool puts at the same point.
  private readonly hot = new Color(1, .54, .2);
  private readonly char = new Color(.1, .094, .088);
  private cursor = 0;
  private limit: number;
  private live = 0;
  private seed = 0x6d2b79f5;
  private matrixDirty = false;
  private colorDirty = false;

  constructor(root: Group, capacity: number, private readonly options: ScarOptions) {
    this.capacity = capacity;
    this.limit = capacity;
    this.life = new Float32Array(capacity);
    this.phase = new Uint8Array(capacity);
    const geometry = new CircleGeometry(.5, 18);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new InstancedMesh(geometry, new MeshBasicMaterial({
      // MultiplyBlending only composites correctly against a premultiplied source; without
      // this the WebGL backend warns on every single frame.
      color: 0xffffff, transparent: true, premultipliedAlpha: true, depthWrite: false, blending: MultiplyBlending, toneMapped: false,
    }), capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    // Below the beams and bursts so a fresh crater never covers its own impact flash.
    this.mesh.renderOrder = -2;
    this.mesh.name = 'destruction-scars';
    this.hidden.makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) { this.mesh.setMatrixAt(i, this.hidden); this.mesh.setColorAt(i, this.color.setRGB(1, 1, 1)); }
    root.add(this.mesh);
  }

  get count(): number { return this.live; }

  private random(): number {
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed & 0xffffff) / 0x1000000;
  }

  /** `heat` in 0..1 biases the starting colour: 1 is a fresh beam strike, 0 is cold rubble. */
  spawn(x: number, z: number, radius: number, heat = 1): void {
    if (this.limit <= 0) return;
    const i = this.cursor;
    this.cursor = this.cursor + 1 >= this.limit ? 0 : this.cursor + 1;
    if (!this.phase[i]) this.live++;
    this.phase[i] = heat > .05 ? COOLING : SETTLED;
    this.life[i] = this.options.duration;
    // A 27 mm ladder over sixteen slots stops overlapping scars from fighting each other for depth.
    this.dummy.position.set(x, this.options.height + (i & 15) * .0018, z);
    this.dummy.rotation.set(0, this.random() * Math.PI * 2, 0);
    this.dummy.scale.set(radius * 2, 1, radius * 2);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.matrixDirty = true;
    this.write(i, this.color.copy(this.char).lerp(this.hot, heat));
  }

  private write(index: number, value: Color): void {
    this.mesh.setColorAt(index, value);
    this.colorDirty = true;
  }

  /**
   * A settled scar costs one float subtract and one compare per frame: its matrix was written
   * when it spawned and its colour is only rewritten while it is actually cooling or fading.
   */
  update(dt: number): void {
    if (!this.live) return;
    const { duration, hotTime, fadeTime } = this.options;
    for (let i = 0; i < this.limit; i++) {
      const phase = this.phase[i];
      if (phase === FREE) continue;
      const life = this.life[i] - dt;
      this.life[i] = life;
      if (life <= 0) {
        this.phase[i] = FREE; this.live--;
        this.mesh.setMatrixAt(i, this.hidden); this.matrixDirty = true;
        continue;
      }
      if (phase === COOLING) {
        const age = duration - life;
        if (age >= hotTime) { this.phase[i] = SETTLED; this.write(i, this.char); continue; }
        this.write(i, this.color.copy(this.hot).lerp(this.char, age / hotTime));
      } else if (phase === SETTLED) {
        if (life <= fadeTime) this.phase[i] = FADING;
      } else {
        this.color.copy(this.char);
        this.color.r += (1 - this.color.r) * (1 - life / fadeTime);
        this.color.g += (1 - this.color.g) * (1 - life / fadeTime);
        this.color.b += (1 - this.color.b) * (1 - life / fadeTime);
        this.write(i, this.color);
      }
    }
    if (this.colorDirty && this.mesh.instanceColor) { this.mesh.instanceColor.needsUpdate = true; this.colorDirty = false; }
    if (this.matrixDirty) { this.mesh.instanceMatrix.needsUpdate = true; this.matrixDirty = false; }
  }

  setLimit(limit: number): void {
    const next = Math.max(0, Math.min(this.capacity, Math.floor(limit)));
    for (let i = next; i < this.limit; i++) {
      if (this.phase[i]) { this.phase[i] = FREE; this.live--; }
      this.mesh.setMatrixAt(i, this.hidden);
    }
    // Flushed here rather than flagged: `update` short-circuits on an empty field, and a budget
    // cut to zero would otherwise leave the parked instances on screen.
    if (next < this.limit) this.mesh.instanceMatrix.needsUpdate = true;
    this.limit = next;
    if (this.cursor >= next) this.cursor = 0;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.mesh.dispose();
  }
}
