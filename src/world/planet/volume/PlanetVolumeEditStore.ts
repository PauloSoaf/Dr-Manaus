import { PlanetVolumeEditIndex } from './PlanetVolumeEditIndex';
import {
  parsePlanetVolumeEdit,
  type BodyFixedPoint,
  type PlanetVolumeBounds,
  type PlanetVolumeEdit,
} from './PlanetVolumeEdit';

export interface SubtractSphereInput {
  readonly id?: string;
  readonly bodyId: string;
  readonly centerBodyFixedM: BodyFixedPoint;
  readonly radiusM: number;
}

export interface SubtractCapsuleInput {
  readonly id?: string;
  readonly bodyId: string;
  readonly aBodyFixedM: BodyFixedPoint;
  readonly bBodyFixedM: BodyFixedPoint;
  readonly radiusM: number;
}

/**
 * Authoritative sparse edit log, grouped and indexed by body.
 *
 * The log owns logical Float64 coordinates. Mesh samples and future resident chunks are derived
 * caches and therefore never enter this store.
 */
export class PlanetVolumeEditStore {
  private readonly edits = new Map<string, PlanetVolumeEdit>();
  private readonly bodyEdits = new Map<string, Map<string, PlanetVolumeEdit>>();
  private readonly indices = new Map<string, PlanetVolumeEditIndex>();
  private readonly revisions = new Map<string, number>();
  private nextGeneratedId = 1;

  get editCount(): number { return this.edits.size; }

  add(candidate: PlanetVolumeEdit): string {
    const edit = parsePlanetVolumeEdit(candidate);
    if (this.edits.has(edit.id)) throw new Error(`duplicate planet volume edit id: ${edit.id}`);
    this.edits.set(edit.id, edit);
    let body = this.bodyEdits.get(edit.bodyId);
    if (!body) { body = new Map(); this.bodyEdits.set(edit.bodyId, body); }
    body.set(edit.id, edit);
    let index = this.indices.get(edit.bodyId);
    if (!index) { index = new PlanetVolumeEditIndex(edit.bodyId); this.indices.set(edit.bodyId, index); }
    index.insert(edit);
    this.bump(edit.bodyId);
    return edit.id;
  }

  subtractSphere(input: SubtractSphereInput): string {
    return this.add({
      id: input.id ?? this.generateId(input.bodyId, 'sphere'),
      bodyId: input.bodyId,
      type: 'subtract-sphere',
      centerBodyFixedM: input.centerBodyFixedM,
      radiusM: input.radiusM,
    });
  }

  subtractCapsule(input: SubtractCapsuleInput): string {
    return this.add({
      id: input.id ?? this.generateId(input.bodyId, 'capsule'),
      bodyId: input.bodyId,
      type: 'subtract-capsule',
      aBodyFixedM: input.aBodyFixedM,
      bBodyFixedM: input.bBodyFixedM,
      radiusM: input.radiusM,
    });
  }

  get(id: string): PlanetVolumeEdit | undefined { return this.edits.get(id); }

  remove(id: string): boolean {
    const edit = this.edits.get(id);
    if (!edit) return false;
    this.edits.delete(id);
    const body = this.bodyEdits.get(edit.bodyId);
    body?.delete(id);
    if (body?.size === 0) this.bodyEdits.delete(edit.bodyId);
    this.indices.get(edit.bodyId)?.remove(id);
    this.bump(edit.bodyId);
    return true;
  }

  revision(bodyId: string): number { return this.revisions.get(bodyId) ?? 0; }

  editsForBody(bodyId: string): readonly PlanetVolumeEdit[] {
    return [...(this.bodyEdits.get(bodyId)?.values() ?? [])];
  }

  allEdits(): readonly PlanetVolumeEdit[] { return [...this.edits.values()]; }

  queryPoint(bodyId: string, point: BodyFixedPoint): readonly PlanetVolumeEdit[] {
    return this.indices.get(bodyId)?.queryPoint(point) ?? [];
  }

  queryBounds(bodyId: string, bounds: PlanetVolumeBounds): readonly PlanetVolumeEdit[] {
    return this.indices.get(bodyId)?.queryBounds(bounds) ?? [];
  }

  /** Queries the edits a future body-fixed volume chunk must apply. */
  queryEdits(bodyId: string, bounds: PlanetVolumeBounds): readonly PlanetVolumeEdit[] {
    return this.queryBounds(bodyId, bounds);
  }

  indexStats(bodyId: string): { editCount: number; nodeCount: number } {
    return this.indices.get(bodyId)?.stats ?? { editCount: 0, nodeCount: 0 };
  }

  private bump(bodyId: string): void {
    this.revisions.set(bodyId, (this.revisions.get(bodyId) ?? 0) + 1);
  }

  private generateId(bodyId: string, kind: string): string {
    let id: string;
    do id = `${bodyId}:volume-${kind}:${this.nextGeneratedId++}`;
    while (this.edits.has(id));
    return id;
  }
}
