import { Box3, BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three/webgpu';
import type { Collider } from '../../core/types';

export interface AuthoredSpan { id: string; start: number; count: number }
export interface AuthoredEntity { id: string; collider: Collider }
export interface AuthoredInstance { id: string; index: number; collider?: Collider }
interface Binding { attribute: BufferAttribute; start: number; count: number; backup?: Float32Array; instance: boolean }
interface RecordEntry { id: string; colliders: Collider[]; bindings: Set<Binding>; destroyed: boolean; x: number; y: number; z: number }

/** Finite authored inventory: edits survive streaming without retaining disposed GPU geometry. */
export class AuthoredDestruction {
  private readonly records = new Map<string, RecordEntry>();
  private readonly groups = new Map<Group, { entry: RecordEntry; binding: Binding }[]>();
  private readonly destroyed = new Set<string>();
  readonly maxDestroyed: number;
  constructor(maxDestroyed = 8192) { this.maxDestroyed = Math.max(1, Math.floor(maxDestroyed)); }
  get destroyedCount(): number { return this.destroyed.size; }
  get stats(): { entities: number; destroyed: number; bindings: number; backupBytes: number } {
    let bindings = 0, backupBytes = 0;
    for (const entry of this.records.values()) for (const binding of entry.bindings) { bindings++; backupBytes += binding.backup?.byteLength ?? 0; }
    return { entities: this.records.size, destroyed: this.destroyed.size, bindings, backupBytes };
  }
  isDestroyed(id: string): boolean { return this.destroyed.has(id); }

  private record(id: string): RecordEntry {
    let entry = this.records.get(id);
    if (!entry) { entry = { id, colliders: [], bindings: new Set(), destroyed: false, x: 0, y: 0, z: 0 }; this.records.set(id, entry); }
    return entry;
  }

  addCollider(collider: Collider): void {
    if (!collider.id) return;
    const entry = this.record(collider.id);
    if (entry.colliders.some(box => box.x === collider.x && box.y === collider.y && box.z === collider.z && box.width === collider.width && box.height === collider.height && box.depth === collider.depth)) return;
    entry.colliders.push(collider);
    const n = entry.colliders.length;
    entry.x += (collider.x - entry.x) / n; entry.y += (collider.y - entry.y) / n; entry.z += (collider.z - entry.z) / n;
  }

  /** One administrative walk when a tier is built. Never called by the frame's damage scan. */
  register(group: Group, defaultId: string, origin: { x: number; z: number }): void {
    if (this.groups.has(group)) return;
    const owned: { entry: RecordEntry; binding: Binding }[] = [];
    const resolve = (id: string) => id.includes(':') ? id : id ? `${defaultId}/${id}` : defaultId;
    const matrix = new Matrix4(), point = new Vector3(), bounds = new Box3();
    const transformOf = (object: Group | Mesh): Matrix4 => {
      matrix.identity();
      let current = object as import('three/webgpu').Object3D | null;
      while (current && current !== group.parent) { current.updateMatrix(); matrix.premultiply(current.matrix); current = current.parent; }
      return matrix;
    };
    const attach = (id: string, binding: Binding) => {
      const entry = this.record(resolve(id)); entry.bindings.add(binding); owned.push({ entry, binding });
      if (entry.destroyed) this.collapse(binding);
    };
    group.traverse(object => {
      const entities = object.userData.authoredEntities as AuthoredEntity[] | undefined;
      if (entities) {
        const transform = transformOf(object as Group);
        for (const entity of entities) {
          const box = entity.collider;
          bounds.min.set(box.x - box.width / 2, box.y - box.height / 2, box.z - box.depth / 2);
          bounds.max.set(box.x + box.width / 2, box.y + box.height / 2, box.z + box.depth / 2);
          bounds.applyMatrix4(transform); bounds.getCenter(point);
          this.addCollider({ id: resolve(entity.id), x: point.x + origin.x, y: point.y, z: point.z + origin.z, width: bounds.max.x - bounds.min.x, height: bounds.max.y - bounds.min.y, depth: bounds.max.z - bounds.min.z });
        }
      }
      if (!(object instanceof Mesh)) return;
      if (object instanceof InstancedMesh) {
        for (const instance of (object.userData.authoredInstances ?? []) as AuthoredInstance[]) {
          attach(instance.id, { attribute: object.instanceMatrix, start: instance.index * 16, count: 16, instance: true });
          if (instance.collider) this.addCollider({ ...instance.collider, x: instance.collider.x + origin.x, z: instance.collider.z + origin.z, id: resolve(instance.id) });
        }
        return;
      }
      if (object.userData.authoredIndestructible) return;
      const attribute = object.geometry.getAttribute('position');
      if (!(attribute instanceof BufferAttribute)) return;
      const spans = object.geometry.userData.authoredSpans as AuthoredSpan[] | undefined;
      if (spans?.length) {
        for (const span of spans) attach(span.id, { attribute, start: span.start * 3, count: span.count * 3, instance: false });
      } else attach('', { attribute, start: 0, count: attribute.count * 3, instance: false });
    });
    this.groups.set(group, owned);
  }

  unregister(group: Group): void {
    const owned = this.groups.get(group); if (!owned) return;
    for (const { entry, binding } of owned) entry.bindings.delete(binding);
    this.groups.delete(group);
  }

  private collapse(binding: Binding): void {
    if (binding.backup) return;
    const array = binding.attribute.array as Float32Array;
    binding.backup = array.slice(binding.start, binding.start + binding.count);
    array.fill(0, binding.start, binding.start + binding.count);
    if (binding.instance) array[binding.start + 15] = 1;
    binding.attribute.addUpdateRange(binding.start, binding.count); binding.attribute.needsUpdate = true;
  }

  destroy(id: string): boolean {
    const entry = this.records.get(id);
    if (!entry || entry.destroyed) return false;
    entry.destroyed = true; this.destroyed.add(id);
    for (const binding of entry.bindings) this.collapse(binding);
    return true;
  }

  restore(position: Vector3, radius: number): number {
    if (!(radius >= 0) || !Number.isFinite(radius)) return 0;
    let restored = 0;
    for (const id of this.destroyed) {
      const entry = this.records.get(id)!;
      const close = entry.colliders.some(box => {
        const dx = Math.max(0, Math.abs(position.x - box.x) - box.width / 2), dy = Math.max(0, Math.abs(position.y - box.y) - box.height / 2), dz = Math.max(0, Math.abs(position.z - box.z) - box.depth / 2);
        return dx * dx + dy * dy + dz * dz <= radius * radius;
      });
      if (!close) continue;
      for (const binding of entry.bindings) {
        if (!binding.backup) continue;
        (binding.attribute.array as Float32Array).set(binding.backup, binding.start);
        binding.backup = undefined;
        binding.attribute.addUpdateRange(binding.start, binding.count); binding.attribute.needsUpdate = true;
      }
      entry.destroyed = false; this.destroyed.delete(id); restored++;
    }
    return restored;
  }

  appendColliders(target: Collider[], player: Vector3, radius: number): void {
    for (const entry of this.records.values()) {
      if (entry.destroyed || !entry.bindings.size) continue;
      for (const box of entry.colliders) if (Math.abs(box.x - player.x) <= radius + box.width / 2 && Math.abs(box.z - player.z) <= radius + box.depth / 2) target.push(box);
    }
  }
  dispose(): void { this.groups.clear(); this.records.clear(); this.destroyed.clear(); }
}
