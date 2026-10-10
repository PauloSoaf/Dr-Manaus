import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERATOR_VERSION, MUTATION_SCHEMA_VERSION, WorldMutationStore, bodyKey,
} from '../src/world/persistence/WorldMutationStore.ts';
import type { CraterRecord } from '../src/world/destruction/TerrainDestruction.ts';

const crater = (id: number): CraterRecord => ({ id, x: id * 10, z: -id, radius: 12, depth: 4, order: id });

/** A backend that is just a variable, so the store can be exercised without a browser. */
class MemoryBackend {
  stored: unknown;
  writes = 0;
  /** When set, `write` refuses until this many bodies remain — a disk that is full. */
  acceptAtMost = Infinity;

  async read(): Promise<unknown> { return this.stored; }

  async write(state: { craters: Record<string, unknown> }): Promise<boolean> {
    this.writes++;
    if (Object.keys(state.craters).length > this.acceptAtMost) return false;
    this.stored = JSON.parse(JSON.stringify(state));
    return true;
  }
}

const storeWith = (backend: MemoryBackend) =>
  new WorldMutationStore(backend as unknown as never);

test('a body address is more than a body id, so two moons never collide', () => {
  assert.equal(bodyKey('earth'), 'solar/earth');
  assert.notEqual(
    bodyKey({ bodyId: 'moon', systemId: 'sol' }),
    bodyKey({ bodyId: 'moon', systemId: 'alpha', sector: 'milky_way/1,0,0' }),
    'a moon of another star is not our Moon',
  );
});

test('craters survive a round trip, and come back for the body they belong to', async () => {
  const backend = new MemoryBackend();
  const store = storeWith(backend);
  await store.hydrate();

  store.saveCraters('earth', [crater(1), crater(2)]);
  store.saveCraters({ bodyId: 'moon' }, [crater(3)]);
  store.discover('teatro');
  await store.flush();

  const reloaded = storeWith(backend);
  await reloaded.hydrate();
  assert.equal(reloaded.loadCraters('earth').length, 2);
  assert.equal(reloaded.loadCraters({ bodyId: 'moon' }).length, 1);
  assert.equal(reloaded.loadCraters('mars').length, 0, 'a body nobody touched has nothing');
  assert.equal(reloaded.hasDiscovered('teatro'), true);
  assert.equal(reloaded.stats.craters, 3);
});

test('writes are coalesced rather than one per crater', async () => {
  const backend = new MemoryBackend();
  const store = storeWith(backend);
  await store.hydrate();

  // Levelling a district: four hundred mutations, and it must not be four hundred saves.
  for (let i = 0; i < 400; i++) store.saveCraters('earth', [crater(i)]);
  await store.flush();
  assert.equal(backend.writes, 1, `flattening a district cost ${backend.writes} writes`);
});

test('a save from the previous schema is migrated rather than thrown away', async () => {
  const backend = new MemoryBackend();
  // Version 1: no schema version, no generator version, craters keyed by bare body id.
  backend.stored = { discoveries: ['teatro'], craters: { earth: [crater(7)] } };

  const store = storeWith(backend);
  await store.hydrate();
  assert.equal(store.hasDiscovered('teatro'), true);
  assert.equal(store.loadCraters('earth').length, 1, 'a bare body id meant the solar system');
  assert.equal(store.loadCraters('earth')[0].id, 7);
});

test('a corrupt save is discarded instead of becoming a crater at NaN', async () => {
  const backend = new MemoryBackend();
  backend.stored = {
    schemaVersion: MUTATION_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    discoveries: ['teatro', 42, null],
    craters: {
      'solar/earth': [
        crater(1),
        { id: 2, x: Number.NaN, z: 0, radius: 5, depth: 1, order: 2 },
        { id: 3, x: 0, z: 0, radius: -5, depth: 1, order: 3 },
        'not a crater',
        null,
      ],
    },
  };

  const store = storeWith(backend);
  await store.hydrate();
  const craters = store.loadCraters('earth');
  assert.equal(craters.length, 1, 'only the valid record survives');
  assert.equal(craters[0].id, 1);
  assert.equal(store.stats.discoveries, 1, 'and only the string discovery');
});

test('a newer schema is refused rather than misread', async () => {
  const backend = new MemoryBackend();
  backend.stored = {
    schemaVersion: MUTATION_SCHEMA_VERSION + 1,
    craters: { 'solar/earth': [crater(1)] },
    discoveries: ['teatro'],
  };
  const store = storeWith(backend);
  await store.hydrate();
  assert.equal(store.stats.craters, 0, 'a save from the future is not guessed at');
  assert.equal(store.hasDiscovered('teatro'), false);
});

test('a generator change drops the holes but keeps what the player saw', async () => {
  const backend = new MemoryBackend();
  backend.stored = {
    schemaVersion: MUTATION_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION + 1,
    craters: { 'solar/earth': [crater(1), crater(2)] },
    discoveries: ['teatro'],
  };
  const store = storeWith(backend);
  await store.hydrate();
  // The hillside those craters were dug into is not the hillside this generator builds.
  assert.equal(store.stats.craters, 0);
  // But having seen the Teatro is true whatever version built it.
  assert.equal(store.hasDiscovered('teatro'), true);
});

test('a full disk sheds the oldest bodies instead of losing everything', async () => {
  const backend = new MemoryBackend();
  const store = storeWith(backend);
  await store.hydrate();

  store.saveCraters('earth', [crater(1)]);
  store.saveCraters({ bodyId: 'moon' }, [crater(2)]);
  store.saveCraters({ bodyId: 'mars' }, [crater(3)]);
  // Room for one body only.
  backend.acceptAtMost = 1;
  await store.flush();

  const reloaded = storeWith(backend);
  await reloaded.hydrate();
  assert.equal(reloaded.stats.bodies, 1, 'something was saved rather than nothing');
  assert.equal(reloaded.loadCraters({ bodyId: 'mars' }).length, 1, 'the most recent body is kept');
});

test('clearing a body removes it rather than storing an empty list forever', async () => {
  const backend = new MemoryBackend();
  const store = storeWith(backend);
  await store.hydrate();
  store.saveCraters('earth', [crater(1)]);
  await store.flush();
  assert.equal(store.stats.bodies, 1);

  store.saveCraters('earth', []);
  await store.flush();
  assert.equal(store.stats.bodies, 0);
});

test('hydration tells whoever is holding stale data to read it again', async () => {
  const backend = new MemoryBackend();
  backend.stored = {
    schemaVersion: MUTATION_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    craters: { 'solar/earth': [crater(1)] },
    discoveries: [],
  };
  const store = storeWith(backend);

  // The terrain system reads on construction, before the disk has answered.
  assert.equal(store.loadCraters('earth').length, 0);
  assert.equal(store.ready, false);

  let notified = 0;
  store.onChange(() => { notified++; });
  await store.hydrate();
  await store.whenReady;

  assert.equal(notified, 1, 'the listener must fire exactly once for one hydration');
  assert.equal(store.ready, true);
  assert.equal(store.loadCraters('earth').length, 1);
});
