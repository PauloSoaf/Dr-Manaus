import {
  parsePlanetVolumeEdit,
  planetVolumeBoundsContainPoint,
  planetVolumeBoundsIntersect,
  planetVolumeEditBounds,
  type BodyFixedPoint,
  type PlanetVolumeBounds,
  type PlanetVolumeEdit,
} from './PlanetVolumeEdit';

interface IndexedEdit {
  readonly edit: PlanetVolumeEdit;
  readonly bounds: PlanetVolumeBounds;
  readonly sequence: number;
}

interface BvhNode {
  readonly bounds: PlanetVolumeBounds;
  readonly left?: BvhNode;
  readonly right?: BvhNode;
  readonly entry?: IndexedEdit;
}

const unionBounds = (entries: readonly IndexedEdit[]): PlanetVolumeBounds => {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const { bounds } of entries) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], bounds.minBodyFixedM[axis]);
      max[axis] = Math.max(max[axis], bounds.maxBodyFixedM[axis]);
    }
  }
  return { minBodyFixedM: min, maxBodyFixedM: max };
};

const centreOnAxis = (entry: IndexedEdit, axis: number): number =>
  (entry.bounds.minBodyFixedM[axis] + entry.bounds.maxBodyFixedM[axis]) * 0.5;

/**
 * An operation index, deliberately independent of volume chunks.
 *
 * It builds a balanced AABB tree over edit operations. A capsule across Earth's diameter remains
 * one leaf and one edit; its physical length never allocates spatial buckets, voxels or chunks.
 * The tree is rebuilt lazily after mutations, which keeps writes cheap and queries logarithmic for
 * the sparse histories this phase stores.
 */
export class PlanetVolumeEditIndex {
  private readonly entries = new Map<string, IndexedEdit>();
  private root?: BvhNode;
  private dirty = false;
  private nextSequence = 0;
  private nodes = 0;

  constructor(readonly bodyId: string) {
    if (!bodyId.trim()) throw new TypeError('bodyId must be a non-empty string');
  }

  get size(): number { return this.entries.size; }

  get stats(): { editCount: number; nodeCount: number } {
    this.rebuildIfNeeded();
    return { editCount: this.entries.size, nodeCount: this.nodes };
  }

  insert(candidate: PlanetVolumeEdit): void {
    const edit = parsePlanetVolumeEdit(candidate);
    if (edit.bodyId !== this.bodyId) {
      throw new RangeError(`edit ${edit.id} belongs to ${edit.bodyId}, not index ${this.bodyId}`);
    }
    if (this.entries.has(edit.id)) throw new Error(`duplicate planet volume edit id: ${edit.id}`);
    this.entries.set(edit.id, {
      edit, bounds: planetVolumeEditBounds(edit), sequence: this.nextSequence++,
    });
    this.dirty = true;
  }

  remove(id: string): boolean {
    const removed = this.entries.delete(id);
    if (removed) this.dirty = true;
    return removed;
  }

  clear(): void {
    if (this.entries.size === 0) return;
    this.entries.clear();
    this.dirty = true;
  }

  /** Edits whose conservative bounds contain the point, in insertion order. */
  queryPoint(point: BodyFixedPoint): readonly PlanetVolumeEdit[] {
    if (point.some(component => !Number.isFinite(component))) return [];
    this.rebuildIfNeeded();
    if (!this.root) return [];
    const found: IndexedEdit[] = [];
    const visit = (node: BvhNode): void => {
      if (!planetVolumeBoundsContainPoint(node.bounds, point)) return;
      if (node.entry) { found.push(node.entry); return; }
      if (node.left) visit(node.left);
      if (node.right) visit(node.right);
    };
    visit(this.root);
    found.sort((a, b) => a.sequence - b.sequence);
    return found.map(entry => entry.edit);
  }

  /** Edits whose conservative bounds overlap a body-fixed query region. */
  queryBounds(bounds: PlanetVolumeBounds): readonly PlanetVolumeEdit[] {
    this.rebuildIfNeeded();
    if (!this.root) return [];
    const found: IndexedEdit[] = [];
    const visit = (node: BvhNode): void => {
      if (!planetVolumeBoundsIntersect(node.bounds, bounds)) return;
      if (node.entry) { found.push(node.entry); return; }
      if (node.left) visit(node.left);
      if (node.right) visit(node.right);
    };
    visit(this.root);
    found.sort((a, b) => a.sequence - b.sequence);
    return found.map(entry => entry.edit);
  }

  /** Chunk-facing name for {@link queryBounds}. */
  query(bounds: PlanetVolumeBounds): readonly PlanetVolumeEdit[] {
    return this.queryBounds(bounds);
  }

  private rebuildIfNeeded(): void {
    if (!this.dirty) return;
    this.nodes = 0;
    const build = (entries: IndexedEdit[]): BvhNode | undefined => {
      if (entries.length === 0) return undefined;
      this.nodes++;
      if (entries.length === 1) return { bounds: entries[0].bounds, entry: entries[0] };
      const bounds = unionBounds(entries);
      const extents = [0, 1, 2].map(axis =>
        bounds.maxBodyFixedM[axis] - bounds.minBodyFixedM[axis]);
      const axis = extents[1] > extents[0]
        ? (extents[2] > extents[1] ? 2 : 1)
        : (extents[2] > extents[0] ? 2 : 0);
      entries.sort((a, b) => centreOnAxis(a, axis) - centreOnAxis(b, axis) || a.sequence - b.sequence);
      const middle = entries.length >> 1;
      return {
        bounds,
        left: build(entries.slice(0, middle)),
        right: build(entries.slice(middle)),
      };
    };
    this.root = build([...this.entries.values()]);
    this.dirty = false;
  }
}
