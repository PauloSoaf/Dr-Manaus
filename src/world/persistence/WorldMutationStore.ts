import type { CraterRecord } from '../destruction/TerrainDestruction';

/**
 * Persists modifications (like terrain craters or destroyed buildings) per planetary body.
 * 
 * Solves Fase 12: destruição persiste depois de viagem planetária.
 * Instead of relying entirely on LocalStorage which can fill up, this creates a modular
 * interface to store mutations against a `WorldObjectId` or `UniverseAddress`.
 */
export class WorldMutationStore {
  private readonly bodyCraters = new Map<string, CraterRecord[]>();
  private readonly discoveries = new Set<string>();

  /** 
   * Load craters for a specific celestial body.
   */
  loadCraters(bodyId: string): CraterRecord[] {
    return this.bodyCraters.get(bodyId) || [];
  }

  /**
   * Save craters for a celestial body when the player leaves orbit or unloads the terrain.
   */
  saveCraters(bodyId: string, craters: readonly Readonly<CraterRecord>[]): void {
    // Clone to ensure immutability in the store
    this.bodyCraters.set(bodyId, craters.map(c => ({ ...c })));
    this.persistToDisk();
  }

  discover(landmarkId: string): boolean {
    if (this.discoveries.has(landmarkId)) return false;
    this.discoveries.add(landmarkId);
    this.persistToDisk();
    return true;
  }

  hasDiscovered(landmarkId: string): boolean {
    return this.discoveries.has(landmarkId);
  }

  private persistToDisk() {
    // In a real implementation with electron or Tauri, we'd write to the file system.
    // For web, we push to IndexedDB or localStorage.
    if (typeof localStorage === 'undefined') return;
    try {
      const state = {
        discoveries: Array.from(this.discoveries),
        craters: Object.fromEntries(this.bodyCraters.entries())
      };
      localStorage.setItem('dr_manaus_world_mutations', JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to persist mutations", e);
    }
  }

  loadFromDisk() {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = localStorage.getItem('dr_manaus_world_mutations');
      if (data) {
        const state = JSON.parse(data);
        if (state.discoveries) {
          state.discoveries.forEach((d: string) => this.discoveries.add(d));
        }
        if (state.craters) {
          for (const [bodyId, craters] of Object.entries(state.craters)) {
            this.bodyCraters.set(bodyId, craters as CraterRecord[]);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load mutations", e);
    }
  }
}

export const mutationStore = new WorldMutationStore();
mutationStore.loadFromDisk();
