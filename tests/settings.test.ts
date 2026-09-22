import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveManager } from '../src/core/SaveManager.ts';

/** SaveManager reads localStorage at construction, so each case installs its own store. */
function withStorage(raw: string | null, run: () => void): void {
  const previous = globalThis.localStorage;
  const store = new Map<string, string>();
  if (raw !== null) store.set('dr-manaus-v1', raw);
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
  try { run(); } finally { globalThis.localStorage = previous; }
}

test('a fresh save ships with an audible, playable default for every pause-menu control', () => {
  withStorage(null, () => {
    const settings = new SaveManager().data.settings;
    assert.ok(settings.masterVolume > 0 && settings.masterVolume <= 1);
    assert.ok(settings.ambienceVolume > 0 && settings.ambienceVolume <= 1);
    assert.ok(settings.effectsVolume > 0 && settings.effectsVolume <= 1);
    assert.ok(settings.fov >= 50 && settings.fov <= 95);
    assert.ok(settings.sensitivity > 0);
    assert.equal(typeof settings.invertY, 'boolean');
    assert.equal(typeof settings.shadows, 'boolean');
    assert.equal(settings.sound, true);
  });
});

test('a save written before these controls existed still opens a usable game', () => {
  // Exactly the shape the previous version wrote: no audio, camera or shadow fields at all.
  const old = JSON.stringify({
    version: 1, discovered: ['teatro', 'arena'], completed: [],
    settings: { quality: 'Ultra', dynamicResolution: false, sound: true, time: 'Night', weather: 'rain', dayCycle: true },
  });
  withStorage(old, () => {
    const save = new SaveManager();
    const settings = save.data.settings;
    // The player's existing choices survive untouched.
    assert.equal(settings.quality, 'Ultra');
    assert.equal(settings.time, 'Night');
    assert.equal(settings.weather, 'rain');
    assert.equal(settings.dynamicResolution, false);
    assert.deepEqual(save.data.discovered, ['teatro', 'arena']);
    // And the new ones arrive at their defaults rather than as undefined.
    assert.ok(settings.masterVolume > 0, 'an upgraded save must not be silent');
    assert.ok(settings.fov >= 50, 'an upgraded save must not have a zero field of view');
    assert.ok(settings.sensitivity > 0, 'an upgraded save must not freeze the camera');
    assert.equal(settings.shadows, true);
  });
});

test('a corrupted or hand-edited save is clamped instead of breaking the game', () => {
  const broken = JSON.stringify({
    version: 1, discovered: [], completed: [],
    settings: {
      quality: 'Insane', dynamicResolution: 'yes', sound: 1, time: 'Noon', weather: 'clear', dayCycle: null,
      masterVolume: 9, ambienceVolume: -4, effectsVolume: Number.NaN,
      fov: 0, sensitivity: 1e9, invertY: 'maybe', shadows: 'off',
    },
  });
  withStorage(broken, () => {
    const settings = new SaveManager().data.settings;
    assert.equal(settings.quality, 'High', 'an unknown preset falls back');
    assert.equal(settings.masterVolume, 1, 'volume above range is clamped, not rejected');
    assert.equal(settings.ambienceVolume, 0);
    assert.ok(settings.effectsVolume > 0, 'NaN falls back to the default rather than muting');
    assert.equal(settings.fov, 50, 'a zero field of view is clamped up to something usable');
    assert.equal(settings.sensitivity, 3, 'an absurd sensitivity is clamped down');
    assert.equal(typeof settings.invertY, 'boolean');
    assert.equal(typeof settings.dayCycle, 'boolean');
    assert.equal(typeof settings.shadows, 'boolean');
  });
});

test('settings round-trip through storage without drifting', () => {
  withStorage(null, () => {
    const first = new SaveManager();
    first.data.settings.masterVolume = .35;
    first.data.settings.fov = 74;
    first.data.settings.sensitivity = 2.1;
    first.data.settings.invertY = true;
    first.data.settings.shadows = false;
    first.save();
    const second = new SaveManager();
    assert.equal(second.data.settings.masterVolume, .35);
    assert.equal(second.data.settings.fov, 74);
    assert.equal(second.data.settings.sensitivity, 2.1);
    assert.equal(second.data.settings.invertY, true);
    assert.equal(second.data.settings.shadows, false);
  });
});
