import type { QualityPreset } from './config';
import type { TimeKind, WeatherKind } from './types';
export interface Settings {
  quality: QualityPreset; dynamicResolution: boolean; sound: boolean;
  time: TimeKind; weather: WeatherKind; dayCycle: boolean;
  /** 0..1 mixer buses. `sound` still mutes everything, independently of these. */
  masterVolume: number; ambienceVolume: number; effectsVolume: number;
  /** Degrees at rest; the camera still widens it with speed. */
  fov: number;
  sensitivity: number; invertY: boolean; shadows: boolean;
}
const RANGES: Record<string, readonly [number, number]> = {
  masterVolume: [0, 1], ambienceVolume: [0, 1], effectsVolume: [0, 1],
  fov: [50, 95], sensitivity: [.2, 3],
};
export interface TitanSaveRecord {
  health: number;
  shield: number;
  phase: number;
  defeated: boolean;
}

export const DR_MANAUS_SAVE_MAGIC = new Uint8Array([0x44, 0x52, 0x4D, 0x4E]); // 'D', 'R', 'M', 'N'
export const DR_MANAUS_SAVE_VERSION = 1;
export const HEADER_SIZE = 18;

export class BinarySaveSystem {
  public static readonly DB_NAME = 'DrManausSaveDB';
  public static readonly STORE_NAME = 'save_slots';
  private static readonly memoryFallbackStore = new Map<string, Uint8Array>();

  public static async openDatabase(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return null;
    }
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch {
        resolve(null);
      }
    });
  }

  public static async saveSlot(slotId: string, binaryPayload: Uint8Array): Promise<void> {
    this.memoryFallbackStore.set(slotId, binaryPayload);
    try {
      const db = await this.openDatabase();
      if (!db) return;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.put(binaryPayload, slotId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback in memoryFallbackStore already stored
    }
  }

  public static async loadSlot(slotId: string): Promise<Uint8Array | null> {
    try {
      const db = await this.openDatabase();
      if (!db) {
        return this.memoryFallbackStore.get(slotId) ?? null;
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.get(slotId);
        req.onsuccess = () => {
          if (req.result) {
            resolve(req.result as Uint8Array);
          } else {
            resolve(this.memoryFallbackStore.get(slotId) ?? null);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.memoryFallbackStore.get(slotId) ?? null;
    }
  }

  public static async deleteSlot(slotId: string): Promise<void> {
    this.memoryFallbackStore.delete(slotId);
    try {
      const db = await this.openDatabase();
      if (!db) return;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.delete(slotId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignore
    }
  }

  public static async listSlots(): Promise<string[]> {
    const memoryKeys = Array.from(this.memoryFallbackStore.keys());
    try {
      const db = await this.openDatabase();
      if (!db) return memoryKeys;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => {
          const keys = (req.result as string[]).concat(memoryKeys);
          resolve(Array.from(new Set(keys)));
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return memoryKeys;
    }
  }

  public static clearMemoryStore(): void {
    this.memoryFallbackStore.clear();
  }

  public static async compress(data: Uint8Array): Promise<Uint8Array> {
    if (typeof CompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Response !== 'undefined') {
      try {
        const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
        const response = new Response(stream);
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      } catch {
        return data;
      }
    }
    return data;
  }

  public static async decompress(data: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Response !== 'undefined') {
      try {
        const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
        const response = new Response(stream);
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      } catch {
        return data;
      }
    }
    return data;
  }

  public static async encodeSaveFile(data: SaveData): Promise<Uint8Array> {
    const jsonStr = JSON.stringify(data);
    const uncompressedBytes = new TextEncoder().encode(jsonStr);
    const uncompressedLength = uncompressedBytes.byteLength;

    const compressedBytes = await this.compress(uncompressedBytes);
    const isCompressed = compressedBytes !== uncompressedBytes && compressedBytes.byteLength < uncompressedLength;
    const payloadBytes = isCompressed ? compressedBytes : uncompressedBytes;

    const totalLength = HEADER_SIZE + payloadBytes.byteLength;
    const result = new Uint8Array(totalLength);
    const view = new DataView(result.buffer);

    // Magic: 'DRMN' (0x44, 0x52, 0x4D, 0x4E)
    result[0] = 0x44;
    result[1] = 0x52;
    result[2] = 0x4D;
    result[3] = 0x4E;
    // Version
    result[4] = DR_MANAUS_SAVE_VERSION;
    // Flags: 1 = compressed, 0 = uncompressed
    result[5] = isCompressed ? 1 : 0;
    // Uncompressed byte length
    view.setUint32(6, uncompressedLength, true);
    // Timestamp
    view.setFloat64(10, Date.now(), true);
    // Payload
    result.set(payloadBytes, HEADER_SIZE);

    return result;
  }

  public static async decodeSaveFile(buffer: Uint8Array): Promise<SaveData> {
    if (buffer.byteLength < HEADER_SIZE) {
      throw new Error(`Invalid save file: byteLength (${buffer.byteLength}) is less than header size (${HEADER_SIZE})`);
    }
    if (buffer[0] !== 0x44 || buffer[1] !== 0x52 || buffer[2] !== 0x4D || buffer[3] !== 0x4E) {
      throw new Error('Invalid save file: header magic mismatch (expected DRMN)');
    }
    const isCompressed = buffer[5] === 1;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const uncompressedLength = view.getUint32(6, true);

    const payload = buffer.subarray(HEADER_SIZE);
    let uncompressedBytes: Uint8Array;
    if (isCompressed) {
      uncompressedBytes = await this.decompress(payload);
    } else {
      uncompressedBytes = payload;
    }

    if (uncompressedBytes.byteLength !== uncompressedLength) {
      console.warn(`Save length mismatch: expected ${uncompressedLength}, got ${uncompressedBytes.byteLength}`);
    }

    const jsonStr = new TextDecoder().decode(uncompressedBytes);
    return JSON.parse(jsonStr) as SaveData;
  }
}
export interface SaveData {
  version: number;
  discovered: string[];
  completed: string[];
  settings: Settings;
  favorites?: string[];
  visitedTargets?: string[];
  discoveredTargets?: string[];
  discoveredSpecies?: string[];
  blackHoleTraversals?: Record<string, number>;
  rupturedBodies?: string[];
  factionReputations?: Record<string, number>;
  discoveredRuins?: string[];
  defeatedColossi?: string[];
  titans?: Record<string, TitanSaveRecord>;
}
const defaults = (): SaveData => ({
  version: 1,
  discovered: ['teatro'],
  completed: [],
  settings: {
    quality: 'High', dynamicResolution: true, sound: true, time: 'Golden Hour', weather: 'clear', dayCycle: false,
    masterVolume: .7, ambienceVolume: .6, effectsVolume: .8, fov: 57, sensitivity: 1, invertY: false, shadows: true,
  },
  favorites: [],
  visitedTargets: [
    'galaxy/milky_way',
    'universe/milky_way/0,0,0/system/sol',
    'universe/milky_way/0,0,0/system/sol/body/earth',
  ],
  discoveredTargets: [],
  discoveredSpecies: [],
  blackHoleTraversals: {},
});
export class SaveManager {
  data = defaults();
  private autosaveIntervalId: ReturnType<typeof setInterval> | null = null;
  public onSave?: (slotId: string, timestamp: number) => void;

  constructor() {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem('dr-manaus-v1') ?? 'null');
      if (raw && typeof raw === 'object' && 'version' in raw && raw.version === 1) {
        this.populateData(raw as Partial<SaveData>);
      }
    } catch { /* Private browsing and malformed saves still allow play. */ }
  }

  public populateData(saved: Partial<SaveData>): void {
    if (Array.isArray(saved.discovered)) this.data.discovered = saved.discovered.filter((v): v is string => typeof v === 'string');
    if (Array.isArray(saved.completed)) this.data.completed = saved.completed.filter((v): v is string => typeof v === 'string');
    if (Array.isArray(saved.favorites)) this.data.favorites = saved.favorites.filter((v): v is string => typeof v === 'string');
    if (Array.isArray(saved.visitedTargets)) this.data.visitedTargets = saved.visitedTargets.filter((v): v is string => typeof v === 'string');
    if (Array.isArray(saved.discoveredTargets)) this.data.discoveredTargets = saved.discoveredTargets.filter((v): v is string => typeof v === 'string');
    if (Array.isArray(saved.discoveredSpecies)) this.data.discoveredSpecies = saved.discoveredSpecies.filter((v): v is string => typeof v === 'string');
    if (Array.isArray(saved.discoveredRuins)) this.data.discoveredRuins = saved.discoveredRuins.filter((v): v is string => typeof v === 'string');
    if (Array.isArray(saved.defeatedColossi)) this.data.defeatedColossi = saved.defeatedColossi.filter((v): v is string => typeof v === 'string');
    if (Array.isArray(saved.rupturedBodies)) this.data.rupturedBodies = saved.rupturedBodies.filter((v): v is string => typeof v === 'string');
    if (saved.factionReputations && typeof saved.factionReputations === 'object') {
      this.data.factionReputations = { ...saved.factionReputations };
    }
    if (saved.titans && typeof saved.titans === 'object') {
      this.data.titans = { ...saved.titans };
    }
    if (saved.blackHoleTraversals && typeof saved.blackHoleTraversals === 'object') {
      this.data.blackHoleTraversals = { ...saved.blackHoleTraversals };
    }
    this.data.settings = { ...this.data.settings, ...saved.settings };
    if (!['Low', 'Medium', 'High', 'Ultra'].includes(this.data.settings.quality)) this.data.settings.quality = 'High';

    const settings = this.data.settings as unknown as Record<string, unknown>;
    const fallback = defaults().settings as unknown as Record<string, number>;
    for (const [key, [low, high]] of Object.entries(RANGES)) {
      const value = settings[key];
      settings[key] = typeof value === 'number' && Number.isFinite(value)
        ? Math.min(high, Math.max(low, value)) : fallback[key];
    }
    for (const key of ['dynamicResolution', 'sound', 'dayCycle', 'invertY', 'shadows']) {
      if (typeof settings[key] !== 'boolean') settings[key] = (fallback as unknown as Record<string, boolean>)[key];
    }
  }
  private batchDepth = 0;
  private dirty = false;

  save() {
    if (this.batchDepth > 0) {
      this.dirty = true;
      return;
    }
    try {
      localStorage.setItem('dr-manaus-v1', JSON.stringify(this.data));
    } catch { /* Storage is optional. */ }
  }

  batch<T>(fn: () => T): T {
    this.batchDepth++;
    try {
      return fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.dirty) {
        this.dirty = false;
        this.save();
      }
    }
  }

  discover(id: string) { if (this.data.discovered.includes(id)) return false; this.data.discovered.push(id); this.save(); return true; }
  complete(id: string) { if (!this.data.completed.includes(id)) this.data.completed.push(id); this.save(); }
  isFavorite(key: string): boolean { return this.data.favorites?.includes(key) ?? false; }
  toggleFavorite(key: string): boolean {
    if (!this.data.favorites) this.data.favorites = [];
    const idx = this.data.favorites.indexOf(key);
    let active = false;
    if (idx >= 0) {
      this.data.favorites.splice(idx, 1);
      active = false;
    } else {
      this.data.favorites.push(key);
      active = true;
    }
    this.save();
    return active;
  }
  isVisited(key: string): boolean { return this.data.visitedTargets?.includes(key) ?? false; }
  markVisited(key: string): boolean {
    if (!this.data.visitedTargets) this.data.visitedTargets = [];
    if (this.data.visitedTargets.includes(key)) return false;
    this.data.visitedTargets.push(key);
    this.save();
    return true;
  }
  markVisitedTargets(keys: readonly string[]): number {
    if (!this.data.visitedTargets) this.data.visitedTargets = [];
    const set = new Set(this.data.visitedTargets);
    let added = 0;
    for (const k of keys) {
      if (!set.has(k)) {
        set.add(k);
        this.data.visitedTargets.push(k);
        added++;
      }
    }
    if (added > 0) this.save();
    return added;
  }
  isDiscoveredTarget(key: string): boolean { return this.data.discoveredTargets?.includes(key) ?? false; }
  discoverTarget(key: string): boolean {
    if (!this.data.discoveredTargets) this.data.discoveredTargets = [];
    if (this.data.discoveredTargets.includes(key)) return false;
    this.data.discoveredTargets.push(key);
    this.save();
    return true;
  }
  discoverTargets(keys: readonly string[]): number {
    if (!this.data.discoveredTargets) this.data.discoveredTargets = [];
    const set = new Set(this.data.discoveredTargets);
    let added = 0;
    for (const k of keys) {
      if (!set.has(k)) {
        set.add(k);
        this.data.discoveredTargets.push(k);
        added++;
      }
    }
    if (added > 0) this.save();
    return added;
  }
  getBlackHoleTraversalCount(id: string): number {
    return this.data.blackHoleTraversals?.[id] ?? 0;
  }
  recordBlackHoleTraversal(id: string): number {
    if (!this.data.blackHoleTraversals) this.data.blackHoleTraversals = {};
    const count = (this.data.blackHoleTraversals[id] ?? 0) + 1;
    this.data.blackHoleTraversals[id] = count;
    this.save();
    return count;
  }
  isSpeciesDiscovered(speciesId: string): boolean {
    return this.data.discoveredSpecies?.includes(speciesId) ?? false;
  }
  discoverSpecies(speciesId: string): boolean {
    if (!this.data.discoveredSpecies) this.data.discoveredSpecies = [];
    if (this.data.discoveredSpecies.includes(speciesId)) return false;
    this.data.discoveredSpecies.push(speciesId);
    this.save();
    return true;
  }
  isBodyRuptured(bodyId: string): boolean {
    return this.data.rupturedBodies?.includes(bodyId) ?? false;
  }
  recordBodyRupture(bodyId: string): void {
    if (!this.data.rupturedBodies) this.data.rupturedBodies = [];
    if (!this.data.rupturedBodies.includes(bodyId)) {
      this.data.rupturedBodies.push(bodyId);
      this.save();
    }
  }
  recordBodyRestoration(bodyId: string): void {
    if (!this.data.rupturedBodies) return;
    const index = this.data.rupturedBodies.indexOf(bodyId);
    if (index >= 0) {
      this.data.rupturedBodies.splice(index, 1);
      this.save();
    }
  }
  getFactionReputation(factionId: string): number {
    return this.data.factionReputations?.[factionId] ?? 0;
  }
  modifyFactionReputation(factionId: string, delta: number): number {
    if (!this.data.factionReputations) this.data.factionReputations = {};
    const current = this.data.factionReputations[factionId] ?? 0;
    const updated = Math.max(-100, Math.min(100, current + delta));
    this.data.factionReputations[factionId] = updated;
    this.save();
    return updated;
  }
  isRuinDiscovered(ruinId: string): boolean {
    return this.data.discoveredRuins?.includes(ruinId) ?? false;
  }
  discoverRuin(ruinId: string): boolean {
    if (!this.data.discoveredRuins) this.data.discoveredRuins = [];
    if (this.data.discoveredRuins.includes(ruinId)) return false;
    this.data.discoveredRuins.push(ruinId);
    this.save();
    return true;
  }
  isColossusDefeated(colossusId: string): boolean {
    return this.data.defeatedColossi?.includes(colossusId) ?? false;
  }
  recordColossusDefeat(colossusId: string): boolean {
    if (!this.data.defeatedColossi) this.data.defeatedColossi = [];
    if (this.data.defeatedColossi.includes(colossusId)) return false;
    this.data.defeatedColossi.push(colossusId);
    this.save();
    return true;
  }
  getTitanRecord(titanId: string): TitanSaveRecord | undefined {
    return this.data.titans?.[titanId];
  }
  saveTitanRecord(titanId: string, record: TitanSaveRecord): void {
    if (!this.data.titans) this.data.titans = {};
    this.data.titans[titanId] = { ...record };
    this.save();
  }

  async saveToSlot(slotId = 'autosave'): Promise<void> {
    const encoded = await BinarySaveSystem.encodeSaveFile(this.data);
    await BinarySaveSystem.saveSlot(slotId, encoded);
    this.save();
    this.onSave?.(slotId, Date.now());
  }

  async loadFromSlot(slotId = 'autosave'): Promise<boolean> {
    const raw = await BinarySaveSystem.loadSlot(slotId);
    if (!raw) return false;
    try {
      const loaded = await BinarySaveSystem.decodeSaveFile(raw);
      this.populateData(loaded);
      this.save();
      return true;
    } catch (e) {
      console.error('Failed to load save from slot:', slotId, e);
      return false;
    }
  }

  async deleteSlot(slotId: string): Promise<void> {
    await BinarySaveSystem.deleteSlot(slotId);
  }

  async listSlots(): Promise<string[]> {
    return BinarySaveSystem.listSlots();
  }

  async exportSaveFile(): Promise<Uint8Array> {
    return BinarySaveSystem.encodeSaveFile(this.data);
  }

  async importSaveFile(buffer: Uint8Array | ArrayBuffer): Promise<SaveData> {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const loaded = await BinarySaveSystem.decodeSaveFile(uint8);
    this.populateData(loaded);
    this.save();
    return this.data;
  }

  startAutosave(intervalMs = 60_000): void {
    this.stopAutosave();
    this.autosaveIntervalId = setInterval(() => {
      void this.triggerAutosave();
    }, intervalMs);
  }

  stopAutosave(): void {
    if (this.autosaveIntervalId !== null) {
      clearInterval(this.autosaveIntervalId);
      this.autosaveIntervalId = null;
    }
  }

  isAutosaveRunning(): boolean {
    return this.autosaveIntervalId !== null;
  }

  async triggerAutosave(): Promise<void> {
    await this.saveToSlot('autosave');
  }

  reset() { this.data = defaults(); this.save(); }
}
