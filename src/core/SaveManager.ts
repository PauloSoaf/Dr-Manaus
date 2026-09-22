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
export interface SaveData { version: number; discovered: string[]; completed: string[]; settings: Settings }
const defaults = (): SaveData => ({ version: 1, discovered: ['teatro'], completed: [], settings: {
    quality: 'High', dynamicResolution: true, sound: true, time: 'Golden Hour', weather: 'clear', dayCycle: false,
    masterVolume: .7, ambienceVolume: .6, effectsVolume: .8, fov: 57, sensitivity: 1, invertY: false, shadows: true,
  } });
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
        // A save written before these existed, or hand-edited, must not produce a silent or unusable game.
        const settings = this.data.settings as unknown as Record<string, unknown>;
        const fallback = defaults().settings as unknown as Record<string, number>;
        for (const [key, [low, high]] of Object.entries(RANGES)) {
          // JSON turns NaN and Infinity into null, and Number(null) is 0 — which would silently
          // mute the game or flatten the field of view. Anything not already a finite number
          // falls back rather than being coerced.
          const value = settings[key];
          settings[key] = typeof value === 'number' && Number.isFinite(value)
            ? Math.min(high, Math.max(low, value)) : fallback[key];
        }
        for (const key of ['dynamicResolution', 'sound', 'dayCycle', 'invertY', 'shadows']) {
          if (typeof settings[key] !== 'boolean') settings[key] = (fallback as unknown as Record<string, boolean>)[key];
        }
      }
    } catch { /* Private browsing and malformed saves still allow play. */ }
  }
  save() { try { localStorage.setItem('dr-manaus-v1', JSON.stringify(this.data)); } catch { /* Storage is optional. */ } }
  discover(id: string) { if (this.data.discovered.includes(id)) return false; this.data.discovered.push(id); this.save(); return true; }
  complete(id: string) { if (!this.data.completed.includes(id)) this.data.completed.push(id); this.save(); }
  reset() { this.data = defaults(); this.save(); }
}
