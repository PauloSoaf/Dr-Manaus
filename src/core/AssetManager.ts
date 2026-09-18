/** Central promise cache: simultaneous requests share one download and one decoded value. */
export class AssetManager {
  private cache = new Map<string, Promise<unknown>>();
  load<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.cache.get(key);
    if (existing) return existing as Promise<T>;
    const pending = loader().catch((error: unknown) => { this.cache.delete(key); throw error; });
    this.cache.set(key, pending);
    return pending;
  }
  json<T>(url: string) { return this.load<T>(url, async () => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json() as Promise<T>; }); }
  clear() { this.cache.clear(); }
}
