import type { CraterRecord } from '../destruction/TerrainDestruction';

/**
 * What the player did to the world, kept across sessions and across planets.
 *
 * The contract this closes is P1-08. What was here before kept two maps in memory and wrote the
 * whole of both to `localStorage` on every single crater — synchronously, in the middle of a
 * destruction event — with no schema version, no validation on the way back in, and no answer for
 * a full disk. A corrupt entry became a crater at `NaN`, which the terrain system then tried to
 * dig.
 *
 * The shape of the fix:
 *
 * - **Versioned.** A schema version so old saves can be migrated, and a *generator* version so
 *   mutations that refer to geometry a newer generator no longer produces can be dropped rather
 *   than applied to the wrong building.
 * - **Addressed.** Mutations belong to a body, and a body belongs to a system and a sector. A
 *   crater on the Moon is not a crater on Earth even at the same coordinates.
 * - **Asynchronous and coalesced.** IndexedDB where there is one, `localStorage` where there is
 *   not, and writes debounced so that flattening a district is one save and not four hundred.
 * - **Suspicious of what it reads.** Every record is validated field by field. A save that does
 *   not survive that is discarded with a warning, because starting fresh is better than digging
 *   a hole at `NaN`.
 */

/** Bumped when the stored shape changes. `migrate` has to grow a case when this moves. */
export const MUTATION_SCHEMA_VERSION = 2;

/**
 * Bumped when procedural generation changes in a way that invalidates recorded mutations.
 *
 * A crater is a hole in a particular hillside and a destroyed building is a particular building.
 * When the generator that produced them changes, the records still load but no longer describe
 * anything that exists, so they are dropped. Discoveries survive: "the player has seen the Teatro"
 * is true regardless of how the Teatro is built.
 */
export const GENERATOR_VERSION = 1;

const STORAGE_KEY = 'dr-manaus-world-mutations';
const DB_NAME = 'dr-manaus';
const DB_STORE = 'world-mutations';
/** Long enough that levelling a district is one write; short enough to survive a tab closing. */
const WRITE_DEBOUNCE_MS = 1500;

export interface BodyAddress {
  readonly bodyId: string;
  readonly systemId?: string;
  /** `sectorKey` when the body is outside the solar system. */
  readonly sector?: string;
}

interface StoredState {
  schemaVersion: number;
  generatorVersion: number;
  worldSeed: string;
  savedAt: string;
  craters: Record<string, CraterRecord[]>;
  discoveries: string[];
}

/** A body's key: the address flattened, so two moons of different stars never collide. */
export function bodyKey(address: BodyAddress | string): string {
  if (typeof address === 'string') return `solar/${address}`;
  const sector = address.sector ?? 'solar';
  const system = address.systemId ?? 'sol';
  return `${sector}/${system}/${address.bodyId}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * One crater, or nothing.
 *
 * Every field checked. This is the boundary between the game and a string somebody could have
 * edited by hand, and the only safe assumption about the other side of it is that it is wrong.
 */
function validateCrater(value: unknown): CraterRecord | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const c = value as Record<string, unknown>;
  if (!isFiniteNumber(c.id) || !isFiniteNumber(c.x) || !isFiniteNumber(c.z)) return undefined;
  if (!isFiniteNumber(c.radius) || !isFiniteNumber(c.depth) || !isFiniteNumber(c.order)) return undefined;
  if (c.radius <= 0 || c.depth <= 0) return undefined;
  return { id: c.id, x: c.x, z: c.z, radius: c.radius, depth: c.depth, order: c.order };
}

/** Whatever was stored, turned into something this version understands, or discarded. */
function migrate(raw: unknown): StoredState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const state = raw as Record<string, unknown>;

  // Version 1 had no schema version, no addressing and no generator version: craters were keyed
  // by bare body id. Those keys become solar-system addresses, which is what they meant.
  const version = isFiniteNumber(state.schemaVersion) ? state.schemaVersion : 1;
  if (version > MUTATION_SCHEMA_VERSION) return undefined;

  const craters: Record<string, CraterRecord[]> = {};
  const sourceCraters = state.craters;
  if (sourceCraters && typeof sourceCraters === 'object') {
    for (const [key, list] of Object.entries(sourceCraters as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const valid = list.map(validateCrater).filter((c): c is CraterRecord => c !== undefined);
      if (valid.length) craters[version < 2 ? bodyKey(key) : key] = valid;
    }
  }

  const discoveries = Array.isArray(state.discoveries)
    ? state.discoveries.filter((d): d is string => typeof d === 'string')
    : [];

  return {
    schemaVersion: MUTATION_SCHEMA_VERSION,
    // Absent means the save predates generator versioning, which means there has only ever been
    // one generator and it is this one. Defaulting to zero instead would call every old save
    // stale and throw away craters the player actually dug.
    generatorVersion: isFiniteNumber(state.generatorVersion) ? state.generatorVersion : GENERATOR_VERSION,
    worldSeed: typeof state.worldSeed === 'string' ? state.worldSeed : 'default',
    savedAt: typeof state.savedAt === 'string' ? state.savedAt : new Date(0).toISOString(),
    craters,
    discoveries,
  };
}

/**
 * IndexedDB when it exists, `localStorage` when it does not, nothing when neither does.
 *
 * Separated from the store so the store can be tested without either, and so the fallback path is
 * a visible decision rather than a `typeof` check buried in a method.
 */
class MutationBackend {
  private db?: Promise<IDBDatabase | undefined>;

  private open(): Promise<IDBDatabase | undefined> {
    if (this.db) return this.db;
    this.db = new Promise(resolve => {
      if (typeof indexedDB === 'undefined') { resolve(undefined); return; }
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        // A blocked or refused database is not an error worth stopping for: the fallback is fine.
        request.onerror = () => resolve(undefined);
        request.onblocked = () => resolve(undefined);
      } catch { resolve(undefined); }
    });
    return this.db;
  }

  async read(): Promise<unknown> {
    const db = await this.open();
    if (db) {
      const fromDb = await new Promise<unknown>(resolve => {
        try {
          const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(STORAGE_KEY);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(undefined);
        } catch { resolve(undefined); }
      });
      if (fromDb !== undefined) return fromDb;
    }
    // Either there is no database, or nothing in it yet — a save from before IndexedDB existed
    // here still deserves to be read.
    if (typeof localStorage === 'undefined') return undefined;
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('dr_manaus_world_mutations');
      return raw ? JSON.parse(raw) : undefined;
    } catch { return undefined; }
  }

  /** Returns false when the write failed for want of room, so the caller can shed load and retry. */
  async write(state: StoredState): Promise<boolean> {
    const db = await this.open();
    if (db) {
      return new Promise<boolean>(resolve => {
        try {
          const tx = db.transaction(DB_STORE, 'readwrite');
          tx.objectStore(DB_STORE).put(state, STORAGE_KEY);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        } catch { resolve(false); }
      });
    }
    if (typeof localStorage === 'undefined') return true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }
}

export class WorldMutationStore {
  private readonly craters = new Map<string, CraterRecord[]>();
  private readonly discoveries = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private readonly backend: MutationBackend;
  private worldSeed = 'default';
  private hydrated = false;
  private writeTimer?: ReturnType<typeof setTimeout>;
  private pendingWrite?: Promise<void>;
  private warnedCorrupt = false;

  constructor(backend: MutationBackend = new MutationBackend()) {
    this.backend = backend;
    this.whenReady = new Promise(resolve => { this.markReady = resolve; });
  }

  /** Resolves when whatever was on disk has been read, validated and applied. */
  readonly whenReady: Promise<void>;
  private markReady!: () => void;

  get ready(): boolean { return this.hydrated; }
  get seed(): string { return this.worldSeed; }

  get stats(): { bodies: number; craters: number; discoveries: number; hydrated: boolean } {
    let total = 0;
    for (const list of this.craters.values()) total += list.length;
    return { bodies: this.craters.size, craters: total, discoveries: this.discoveries.size, hydrated: this.hydrated };
  }

  /** Called when hydration replaces what was in memory, so a consumer can re-read. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  async hydrate(): Promise<void> {
    const raw = await this.backend.read();
    const state = migrate(raw);
    if (raw !== undefined && !state && !this.warnedCorrupt) {
      this.warnedCorrupt = true;
      console.warn('World mutations could not be read and were discarded; starting fresh.');
    }
    if (state) {
      // A generator change means the recorded holes are in a world that no longer exists. The
      // discoveries are still true, so they stay.
      const stale = state.generatorVersion !== GENERATOR_VERSION;
      if (!stale) {
        for (const [key, list] of Object.entries(state.craters)) this.craters.set(key, list);
      }
      for (const id of state.discoveries) this.discoveries.add(id);
      this.worldSeed = state.worldSeed;
      if (stale) this.schedule();
    }
    this.hydrated = true;
    this.markReady();
    for (const listener of this.listeners) listener();
  }

  loadCraters(address: BodyAddress | string): CraterRecord[] {
    return this.craters.get(bodyKey(address)) ?? [];
  }

  saveCraters(address: BodyAddress | string, craters: readonly Readonly<CraterRecord>[]): void {
    const key = bodyKey(address);
    if (craters.length === 0) this.craters.delete(key);
    else this.craters.set(key, craters.map(c => ({ ...c })));
    this.schedule();
  }

  discover(landmarkId: string): boolean {
    if (this.discoveries.has(landmarkId)) return false;
    this.discoveries.add(landmarkId);
    this.schedule();
    return true;
  }

  hasDiscovered(landmarkId: string): boolean { return this.discoveries.has(landmarkId); }

  /** Writes now rather than on the debounce, for a tab that is about to go away. */
  async flush(): Promise<void> {
    if (this.writeTimer !== undefined) { clearTimeout(this.writeTimer); this.writeTimer = undefined; }
    await this.write();
  }

  private schedule(): void {
    if (this.writeTimer !== undefined) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => { this.writeTimer = undefined; void this.write(); }, WRITE_DEBOUNCE_MS);
    // Node keeps the process alive for a pending timer; a save should never do that to a test.
    (this.writeTimer as unknown as { unref?: () => void }).unref?.();
  }

  private async write(): Promise<void> {
    // Coalesce: a write that arrives while one is in flight waits for it rather than racing it.
    if (this.pendingWrite) { await this.pendingWrite; }
    this.pendingWrite = this.writeOnce();
    try { await this.pendingWrite; } finally { this.pendingWrite = undefined; }
  }

  private async writeOnce(): Promise<void> {
    if (await this.backend.write(this.snapshot())) return;
    // Out of room. Shed the bodies nobody is standing on, oldest first, and try once more. The
    // alternative is to fail silently and lose the lot at the next reload.
    const keys = [...this.craters.keys()];
    while (keys.length > 1) {
      this.craters.delete(keys.shift()!);
      if (await this.backend.write(this.snapshot())) {
        console.warn('World mutations exceeded the storage quota; the oldest bodies were dropped.');
        return;
      }
    }
    console.warn('World mutations could not be saved: no room.');
  }

  private snapshot(): StoredState {
    return {
      schemaVersion: MUTATION_SCHEMA_VERSION,
      generatorVersion: GENERATOR_VERSION,
      worldSeed: this.worldSeed,
      savedAt: new Date().toISOString(),
      craters: Object.fromEntries(this.craters.entries()),
      discoveries: [...this.discoveries],
    };
  }
}

export const mutationStore = new WorldMutationStore();

/**
 * Hydration is kicked off here rather than in the constructor so that constructing a store in a
 * test touches no storage at all.
 */
const hydration = mutationStore.hydrate();
void hydration;

if (typeof window !== 'undefined') {
  // `pagehide` fires where `beforeunload` does not, notably on mobile Safari.
  window.addEventListener('pagehide', () => { void mutationStore.flush(); });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void mutationStore.flush();
  });
}
