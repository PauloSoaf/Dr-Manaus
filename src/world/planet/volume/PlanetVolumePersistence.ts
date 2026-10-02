import type {
  PlanetVolumeEdit,
  SubtractCapsuleEdit,
  SubtractSphereEdit,
} from './PlanetVolumeEdit';
import { PlanetVolumeEditStore } from './PlanetVolumeEditStore';

/** Bump only with a corresponding loader migration. */
export const PLANET_VOLUME_EDIT_SCHEMA_VERSION = 1;

export type StoredPlanetVolumeEdit =
  | Omit<SubtractSphereEdit, 'bodyId'>
  | Omit<SubtractCapsuleEdit, 'bodyId'>;

/** JSON document stored per body. Procedural samples and meshes are intentionally absent. */
export interface PlanetVolumeEditDocument {
  readonly schemaVersion: number;
  readonly bodyId: string;
  readonly edits: readonly StoredPlanetVolumeEdit[];
}

/** Serializes the procedural edit log for one body, never any derived voxel or mesh cache. */
export function serializePlanetVolumeEdits(store: PlanetVolumeEditStore, bodyId: string): string {
  if (!bodyId.trim()) throw new TypeError('bodyId must be a non-empty string');
  const edits = store.editsForBody(bodyId).map(edit => {
    if (edit.type === 'subtract-sphere') {
      return {
        id: edit.id, type: edit.type,
        centerBodyFixedM: edit.centerBodyFixedM,
        radiusM: edit.radiusM,
      };
    }
    return {
      id: edit.id, type: edit.type,
      aBodyFixedM: edit.aBodyFixedM,
      bBodyFixedM: edit.bBodyFixedM,
      radiusM: edit.radiusM,
    };
  });
  const document: PlanetVolumeEditDocument = {
    schemaVersion: PLANET_VOLUME_EDIT_SCHEMA_VERSION,
    bodyId,
    edits,
  };
  return JSON.stringify(document);
}

/**
 * Parses an edit document and rebuilds the store and its spatial index.
 *
 * Unknown schemas and malformed coordinates fail loudly so corrupt saves cannot place enormous or
 * non-finite CSG operations in the world.
 */
export function deserializePlanetVolumeEdits(serialized: string | unknown): PlanetVolumeEditStore {
  let raw: unknown = serialized;
  if (typeof serialized === 'string') {
    try { raw = JSON.parse(serialized); }
    catch (error) { throw new TypeError(`planet volume edit document is not valid JSON: ${String(error)}`); }
  }
  if (!raw || typeof raw !== 'object') throw new TypeError('planet volume edit document must be an object');
  const document = raw as Record<string, unknown>;
  if (document.schemaVersion !== PLANET_VOLUME_EDIT_SCHEMA_VERSION) {
    throw new RangeError(`unsupported planet volume edit schema version: ${String(document.schemaVersion)}`);
  }
  if (typeof document.bodyId !== 'string' || document.bodyId.trim().length === 0) {
    throw new TypeError('bodyId must be a non-empty string');
  }
  if (!Array.isArray(document.edits)) throw new TypeError('edits must be an array');

  const store = new PlanetVolumeEditStore();
  for (const stored of document.edits) {
    if (!stored || typeof stored !== 'object') throw new TypeError('stored edit must be an object');
    store.add({ ...(stored as PlanetVolumeEdit), bodyId: document.bodyId } as PlanetVolumeEdit);
  }
  return store;
}
