/**
 * Compact Vector Tile Storage & IndexedDB Cache for Overture Maps & OSM Data.
 * Fulfills RF-17-05 (Offline resilience) & RNF-17-03 (Strict RAM budget < 40MB).
 */

export interface CachedVectorTile {
  key: string;
  data: any;
  timestamp: number;
  byteSize: number;
}

export class VectorTileCache {
  private static instance: VectorTileCache | null = null;
  private readonly memoryCache = new Map<string, CachedVectorTile>();
  private currentMemoryBytes = 0;
  private readonly maxMemoryBytes: number;
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor(maxMemoryMB = 40) {
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this.initIndexedDB();
  }

  public static getInstance(): VectorTileCache {
    if (!VectorTileCache.instance) {
      VectorTileCache.instance = new VectorTileCache(40);
    }
    return VectorTileCache.instance;
  }

  private initIndexedDB(): void {
    if (typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.resolve(null);
      return;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open('DrManaus_GIS_Tiles', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('vector_tiles')) {
            db.createObjectStore('vector_tiles', { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private estimateSize(data: any): number {
    try {
      const json = typeof data === 'string' ? data : JSON.stringify(data);
      return json.length * 2; // approximation for UTF-16 in memory
    } catch {
      return 1024;
    }
  }

  public async getTile(key: string): Promise<any | null> {
    // 1. Check memory cache (fastest)
    const mem = this.memoryCache.get(key);
    if (mem) {
      mem.timestamp = Date.now();
      return mem.data;
    }

    // 2. Check IndexedDB
    const db = await this.dbPromise;
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('vector_tiles', 'readonly');
        const store = tx.objectStore('vector_tiles');
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result) {
            this.putMemory(key, req.result.data);
            resolve(req.result.data);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async setTile(key: string, data: any): Promise<void> {
    this.putMemory(key, data);

    const db = await this.dbPromise;
    if (!db) return;

    try {
      const tx = db.transaction('vector_tiles', 'readwrite');
      const store = tx.objectStore('vector_tiles');
      store.put({ key, data, timestamp: Date.now() });
    } catch {
      // Storage quota or transaction errors fail gracefully
    }
  }

  public hasMemory(key: string): boolean {
    return this.memoryCache.has(key);
  }

  public getMemoryUsageBytes(): number {
    return this.currentMemoryBytes;
  }

  private putMemory(key: string, data: any): void {
    const size = this.estimateSize(data);

    // Evict oldest tiles if memory budget exceeded (LRU)
    while (this.currentMemoryBytes + size > this.maxMemoryBytes && this.memoryCache.size > 0) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.memoryCache) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        const item = this.memoryCache.get(oldestKey);
        if (item) {
          this.currentMemoryBytes -= item.byteSize;
          this.memoryCache.delete(oldestKey);
        }
      } else {
        break;
      }
    }

    this.memoryCache.set(key, {
      key,
      data,
      timestamp: Date.now(),
      byteSize: size,
    });
    this.currentMemoryBytes += size;
  }

  public clearMemory(): void {
    this.memoryCache.clear();
    this.currentMemoryBytes = 0;
  }
}

