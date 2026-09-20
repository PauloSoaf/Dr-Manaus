import { AdditiveBlending, BufferGeometry, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Mesh, MeshBasicMaterial, Object3D, Sphere, Vector3 } from 'three/webgpu';
import type { CosmicLevel } from './CosmicMaterial';

export const COSMIC_TRAIL_BUDGET = { samples: 24, streaks: 8, maxLength: 70, maxAge: 0.32 } as const;
const QUADS = (COSMIC_TRAIL_BUDGET.samples - 1) * 2 + COSMIC_TRAIL_BUDGET.streaks;
const STRENGTH: Record<CosmicLevel, number> = { idle: 0, flight: 0.065, power: 0.1, boost: 0.18, mega: 0.32 };

/**
 * Two thin ribbons and eight star streaks in one reusable mesh. History lives in the character
 * parent's meter coordinates, so a floating-origin shift of that parent changes no trail data.
 * GPU vertices are relative to the latest sample rather than large absolute world coordinates.
 */
export class CosmicTrail {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly points = new Float64Array(COSMIC_TRAIL_BUDGET.samples * 3);
  private readonly ages = new Float64Array(COSMIC_TRAIL_BUDGET.samples);
  private readonly positions = new Float32BufferAttribute(new Float32Array(QUADS * 12), 3);
  private readonly colors = new Float32BufferAttribute(new Float32Array(QUADS * 16), 4);
  private readonly current = new Vector3();
  private readonly previous = new Vector3();
  private readonly direction = new Vector3(0, 0, -1);
  private readonly side = new Vector3(1, 0, 0);
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly widthAxis = new Vector3();
  private head = -1;
  private count = 0;
  private clock = 0;
  private fade = 0;
  private quads = 0;
  private disposed = false;

  constructor(private readonly character: Object3D) {
    const geometry = new BufferGeometry();
    this.positions.setUsage(DynamicDrawUsage); this.colors.setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', this.positions); geometry.setAttribute('color', this.colors);
    const indices = new Uint16Array(QUADS * 6);
    for (let i = 0; i < QUADS; i++) {
      const vertex = i * 4, slot = i * 6;
      indices[slot] = vertex; indices[slot + 1] = vertex + 1; indices[slot + 2] = vertex + 2;
      indices[slot + 3] = vertex; indices[slot + 4] = vertex + 2; indices[slot + 5] = vertex + 3;
    }
    geometry.setIndex(Array.from(indices)); geometry.setDrawRange(0, 0);
    geometry.boundingSphere = new Sphere(new Vector3(), COSMIC_TRAIL_BUDGET.maxLength + 4);
    this.mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: AdditiveBlending, side: DoubleSide, depthWrite: false, toneMapped: false }));
    this.mesh.name = 'cosmic-trail'; this.mesh.visible = false;
  }

  get sampleCount(): number { return this.count; }

  update(dt: number, level: CosmicLevel, speed: number, forward: Vector3): void {
    if (this.disposed) return;
    const root = this.character.parent;
    if (!root) { this.mesh.removeFromParent(); this.clear(); return; }
    if (this.mesh.parent !== root) { root.add(this.mesh); this.clear(); }
    const step = Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0;
    const pace = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    const size = Number.isFinite(this.character.scale.y) ? Math.max(0.1, Math.min(22, this.character.scale.y)) : 1;
    this.clock += step;
    this.current.copy(this.character.position); this.current.y += 1.18 * size;
    if (!Number.isFinite(this.current.x + this.current.y + this.current.z)) { this.clear(); return; }
    if (Number.isFinite(forward.x + forward.y + forward.z) && forward.lengthSq() > 0.00001) this.direction.copy(forward).normalize();
    this.side.set(-this.direction.z, 0, this.direction.x);
    if (this.side.lengthSq() < 0.0001) this.side.set(1, 0, 0); else this.side.normalize();
    if (this.count > 0 && this.current.distanceTo(this.previous) > Math.max(150, pace * step * 2.5 + 8)) this.clear();
    const strength = pace > 12 ? (STRENGTH[level] ?? 0) : 0;
    this.fade += (strength - this.fade) * (1 - Math.exp(-step * 10));
    if (this.count === 0 || this.current.distanceToSquared(this.previous) > 0.0004) this.sample();
    this.previous.copy(this.current); this.mesh.position.copy(this.current);
    this.quads = 0;
    const length = Math.min(COSMIC_TRAIL_BUDGET.maxLength, Math.max(4, pace * 0.012));
    if (this.fade > 0.002) this.writeRibbons(length, size);
    if (this.quads > 0 && (level === 'mega' || level === 'boost')) this.writeStreaks(length, size, level === 'mega' ? COSMIC_TRAIL_BUDGET.streaks : 3);
    this.mesh.geometry.setDrawRange(0, this.quads * 6); this.mesh.visible = this.quads > 0;
    if (this.quads > 0) {
      this.positions.clearUpdateRanges(); this.positions.addUpdateRange(0, this.quads * 12); this.positions.needsUpdate = true;
      this.colors.clearUpdateRanges(); this.colors.addUpdateRange(0, this.quads * 16); this.colors.needsUpdate = true;
    }
  }

  clear(): void { this.count = 0; this.head = -1; this.fade = 0; this.mesh.visible = false; this.mesh.geometry.setDrawRange(0, 0); }

  private sample(): void {
    this.head = (this.head + 1) % COSMIC_TRAIL_BUDGET.samples;
    const index = this.head * 3;
    this.points[index] = this.current.x; this.points[index + 1] = this.current.y; this.points[index + 2] = this.current.z;
    this.ages[this.head] = this.clock; this.count = Math.min(COSMIC_TRAIL_BUDGET.samples, this.count + 1);
  }

  private writeRibbons(maxLength: number, size: number): void {
    let distance = 0;
    this.a.copy(this.direction).multiplyScalar(-Math.min(0.9 * size, 3));
    const halfWidth = Math.min(0.7, 0.085 * size);
    for (let i = 1; i < this.count; i++) {
      const index = (this.head - i + COSMIC_TRAIL_BUDGET.samples) % COSMIC_TRAIL_BUDGET.samples;
      const age = this.clock - this.ages[index];
      if (age > COSMIC_TRAIL_BUDGET.maxAge) break;
      this.b.set(this.points[index * 3], this.points[index * 3 + 1], this.points[index * 3 + 2]).sub(this.current);
      const segment = this.a.distanceTo(this.b);
      if (segment < 0.01) continue;
      const fraction = Math.min(1, (maxLength - distance) / segment);
      if (fraction < 1) this.b.lerpVectors(this.a, this.b, fraction);
      const nextDistance = distance + segment * fraction;
      const alphaA = this.fade * Math.pow(Math.max(0, 1 - distance / maxLength), 1.5);
      const alphaB = this.fade * Math.pow(Math.max(0, 1 - nextDistance / maxLength), 1.5) * Math.max(0, 1 - age / COSMIC_TRAIL_BUDGET.maxAge);
      this.widthAxis.copy(this.side).multiplyScalar(halfWidth);
      this.quad(this.a, this.b, this.widthAxis, alphaA, alphaB, 0.22, 0.68, 1);
      this.widthAxis.set(0, halfWidth * 0.7, 0);
      this.quad(this.a, this.b, this.widthAxis, alphaA * 0.65, alphaB * 0.65, 0.53, 0.23, 1);
      this.a.copy(this.b); distance = nextDistance;
      if (fraction < 1 || distance >= maxLength) break;
    }
  }

  private writeStreaks(length: number, size: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const phase = (i * 0.61803398875 + this.clock * 0.65) % 1;
      const distance = 2 + phase * Math.max(0, length - 6);
      const lateral = Math.sin(i * 7.13) * Math.min(2, size * 0.7);
      this.a.copy(this.direction).multiplyScalar(-distance).addScaledVector(this.side, lateral);
      this.a.y += Math.cos(i * 3.74) * Math.min(1.5, size * 0.65);
      this.b.copy(this.a).addScaledVector(this.direction, -Math.min(2, length * 0.06));
      this.widthAxis.copy(this.side).multiplyScalar(Math.min(0.055, 0.012 * size));
      this.quad(this.a, this.b, this.widthAxis, this.fade * 0.8, 0, 0.65, 0.83, 1);
    }
  }

  private quad(a: Vector3, b: Vector3, axis: Vector3, alphaA: number, alphaB: number, r: number, g: number, blue: number): void {
    if (this.quads >= QUADS) return;
    const base = this.quads * 4;
    this.positions.setXYZ(base, a.x - axis.x, a.y - axis.y, a.z - axis.z);
    this.positions.setXYZ(base + 1, a.x + axis.x, a.y + axis.y, a.z + axis.z);
    this.positions.setXYZ(base + 2, b.x + axis.x, b.y + axis.y, b.z + axis.z);
    this.positions.setXYZ(base + 3, b.x - axis.x, b.y - axis.y, b.z - axis.z);
    this.colors.setXYZW(base, r, g, blue, alphaA); this.colors.setXYZW(base + 1, r, g, blue, alphaA);
    this.colors.setXYZW(base + 2, r, g, blue, alphaB); this.colors.setXYZW(base + 3, r, g, blue, alphaB);
    this.quads++;
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear(); this.disposed = true; this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose();
  }
}
