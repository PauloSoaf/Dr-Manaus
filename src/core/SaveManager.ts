import type { QualityPreset } from './config';
import type { TimeKind, WeatherKind } from './types';
export interface Settings { quality: QualityPreset; dynamicResolution: boolean; sound: boolean; time: TimeKind; weather: WeatherKind; dayCycle: boolean }
export interface SaveData { version: number; discovered: string[]; completed: string[]; settings: Settings }
const defaults = (): SaveData => ({ version: 1, discovered: ['teatro'], completed: [], settings: { quality: 'High', dynamicResolution: true, sound: true, time: 'Golden Hour', weather: 'clear', dayCycle: false } });
export class SaveManager {
  data = defaults();
  constructor() {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem('dr-manaus-v1') ?? 'null');
      if (raw && typeof raw === 'object' && 'version' in raw && raw.version === 1) {
        const saved = raw as Partial<SaveData>;
        if (Array.isArray(saved.discovered)) this.data.discovered = saved.discovered.filter((v): v is string => typeof v === 'string');
        if (Array.isArray(saved.completed)) this.data.completed = saved.completed.filter((v): v is string => typeof v === 'string');
        this.data.settings = { ...this.data.settings, ...saved.settings };
        if (!['Low', 'Medium', 'High', 'Ultra'].includes(this.data.settings.quality)) this.data.settings.quality = 'High';
      }
    } catch { /* Private browsing and malformed saves still allow play. */ }
  }
  save() { try { localStorage.setItem('dr-manaus-v1', JSON.stringify(this.data)); } catch { /* Storage is optional. */ } }
  discover(id: string) { if (this.data.discovered.includes(id)) return false; this.data.discovered.push(id); this.save(); return true; }
  complete(id: string) { if (!this.data.completed.includes(id)) this.data.completed.push(id); this.save(); }
  reset() { this.data = defaults(); this.save(); }
}
