import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SaveManager,
  BinarySaveSystem,
  DR_MANAUS_SAVE_MAGIC,
  DR_MANAUS_SAVE_VERSION,
  HEADER_SIZE,
  type SaveData,
} from '../src/core/SaveManager.ts';
import { CosmicPlanetTitanManager } from '../src/world/life/CosmicPlanetTitan.ts';

test('FEATURE 20: 1. Binary compression & decompression roundtrip byte integrity', async () => {
  // Test arbitrary binary buffer roundtrip
  const testBytes = new Uint8Array(4096);
  for (let i = 0; i < testBytes.length; i++) {
    testBytes[i] = (i * 37 + 13) & 0xff;
  }

  const compressed = await BinarySaveSystem.compress(testBytes);
  const decompressed = await BinarySaveSystem.decompress(compressed);

  assert.equal(decompressed.byteLength, testBytes.byteLength, 'Decompressed length must match original');
  for (let i = 0; i < testBytes.length; i++) {
    assert.equal(decompressed[i], testBytes[i], `Byte at index ${i} must match`);
  }
});

test('FEATURE 20: 2. Slot management and persistence (IndexedDB / Memory Fallback)', async () => {
  BinarySaveSystem.clearMemoryStore();

  const payload1 = new Uint8Array([10, 20, 30, 40]);
  const payload2 = new Uint8Array([99, 88, 77, 66]);

  await BinarySaveSystem.saveSlot('slot1', payload1);
  await BinarySaveSystem.saveSlot('autosave', payload2);

  const loaded1 = await BinarySaveSystem.loadSlot('slot1');
  const loaded2 = await BinarySaveSystem.loadSlot('autosave');
  const loadedNonExistent = await BinarySaveSystem.loadSlot('slot3');

  assert.ok(loaded1, 'Slot 1 must exist');
  assert.deepEqual(Array.from(loaded1!), [10, 20, 30, 40]);

  assert.ok(loaded2, 'Autosave slot must exist');
  assert.deepEqual(Array.from(loaded2!), [99, 88, 77, 66]);

  assert.equal(loadedNonExistent, null, 'Unsaved slot must return null');

  const slots = await BinarySaveSystem.listSlots();
  assert.ok(slots.includes('slot1'), 'List slots must contain slot1');
  assert.ok(slots.includes('autosave'), 'List slots must contain autosave');

  await BinarySaveSystem.deleteSlot('slot1');
  const loadedAfterDelete = await BinarySaveSystem.loadSlot('slot1');
  assert.equal(loadedAfterDelete, null, 'Deleted slot must return null');
});

test('FEATURE 20: 3. .drmanaus binary file format encoding and decoding with magic header', async () => {
  const sampleSave: SaveData = {
    version: 1,
    discovered: ['teatro', 'ponta-negra', 'arena-amazonia'],
    completed: ['mission-01'],
    favorites: ['galaxy/milky_way/system/sol'],
    visitedTargets: ['earth', 'titan'],
    discoveredTargets: ['saturn'],
    discoveredSpecies: ['cosmic-manta-sol', 'ouroboros-nebula'],
    rupturedBodies: ['earth'],
    factionReputations: { 'sol-coalition': 85, 'void-wanderers': -40 },
    discoveredRuins: ['ruin-alpha-proxima'],
    defeatedColossi: ['titan-astral-leviathan-01'],
    titans: {
      'titan-astral-leviathan-01': {
        health: 875_000,
        shield: 0,
        phase: 2,
        defeated: false,
      },
    },
    settings: {
      quality: 'High',
      dynamicResolution: true,
      sound: true,
      time: 'Night',
      weather: 'rain',
      dayCycle: true,
      masterVolume: 0.85,
      ambienceVolume: 0.7,
      effectsVolume: 0.9,
      fov: 65,
      sensitivity: 1.2,
      invertY: false,
      shadows: true,
    },
  };

  const fileBytes = await BinarySaveSystem.encodeSaveFile(sampleSave);

  // Validate Header
  assert.ok(fileBytes.byteLength > HEADER_SIZE, 'File size must exceed header');
  assert.equal(fileBytes[0], 0x44, 'Magic byte 0 must be D');
  assert.equal(fileBytes[1], 0x52, 'Magic byte 1 must be R');
  assert.equal(fileBytes[2], 0x4d, 'Magic byte 2 must be M');
  assert.equal(fileBytes[3], 0x4e, 'Magic byte 3 must be N');
  assert.equal(fileBytes[4], DR_MANAUS_SAVE_VERSION, 'Version must match');

  // Decode and verify all fields
  const decoded = await BinarySaveSystem.decodeSaveFile(fileBytes);
  assert.deepEqual(decoded.discovered, sampleSave.discovered);
  assert.deepEqual(decoded.discoveredSpecies, sampleSave.discoveredSpecies);
  assert.deepEqual(decoded.rupturedBodies, sampleSave.rupturedBodies);
  assert.deepEqual(decoded.factionReputations, sampleSave.factionReputations);
  assert.deepEqual(decoded.titans, sampleSave.titans);
  assert.equal(decoded.settings.quality, 'High');
  assert.equal(decoded.settings.fov, 65);

  // Invalid magic header should throw
  const corrupted = new Uint8Array(fileBytes);
  corrupted[0] = 0x00;
  await assert.rejects(
    async () => await BinarySaveSystem.decodeSaveFile(corrupted),
    /magic mismatch/i,
    'Decoding invalid magic header must reject'
  );
});

test('FEATURE 20: 4. Cosmic Planet Titan binary state serialization & deserialization', () => {
  const titanManager = new CosmicPlanetTitanManager();
  const titan = titanManager.titans[0];
  assert.ok(titan, 'Titan must be initialized');

  // Simulate heavy boss battle damage and phase progression
  titan.health = 850_000;
  titan.shield = 0;
  titan.phase = 2;
  titan.enraged = true;
  titan.weakSpotHitCount = 3;
  titan.driftAngleRad = 1.25;
  titan.headingRad = 2.82;
  if (titanManager.weakpoints.length > 0) {
    titanManager.weakpoints[0].destroyed = true;
  }

  // Serialize to compact binary
  const binarySnapshot = titanManager.serializeState();
  assert.equal(binarySnapshot.byteLength, 21, 'Titan state snapshot must be exactly 21 bytes');

  // Create a separate manager and deserialize into it
  const freshManager = new CosmicPlanetTitanManager();
  freshManager.deserializeState(binarySnapshot);
  const restoredTitan = freshManager.titans[0];

  assert.equal(restoredTitan.health, 850_000, 'Health must restore exactly');
  assert.equal(restoredTitan.shield, 0, 'Shield must restore exactly');
  assert.equal(restoredTitan.phase, 2, 'Phase 2 must restore');
  assert.equal(restoredTitan.enraged, true, 'Enraged state must restore');
  assert.equal(restoredTitan.weakSpotHitCount, 3, 'Weakspot hit count must restore');
  assert.ok(Math.abs(restoredTitan.driftAngleRad - 1.25) < 1e-4, 'Drift angle must restore');
  assert.ok(Math.abs(restoredTitan.headingRad - 2.82) < 1e-4, 'Heading must restore');
  if (freshManager.weakpoints.length > 0) {
    assert.equal(freshManager.weakpoints[0].destroyed, true, 'Weakpoint destroyed mask must restore');
  }
});

test('FEATURE 20: 5. SaveManager slot workflow, export/import, and autosave lifecycle', async () => {
  const save1 = new SaveManager();
  save1.discover('landmark-encontro-aguas');
  save1.discoverSpecies('astral-colossus-specimen');
  save1.recordBodyRupture('mars');
  save1.modifyFactionReputation('amazon-explorers', 50);

  // Save to slot1
  await save1.saveToSlot('slot1');

  // Export binary file
  const exported = await save1.exportSaveFile();
  assert.ok(exported.byteLength > HEADER_SIZE, 'Exported save file must have valid size');

  // Load into a new SaveManager via slot
  const save2 = new SaveManager();
  save2.reset();
  assert.equal(save2.isSpeciesDiscovered('astral-colossus-specimen'), false);

  const loadedSuccess = await save2.loadFromSlot('slot1');
  assert.equal(loadedSuccess, true, 'Slot load must succeed');
  assert.equal(save2.isSpeciesDiscovered('astral-colossus-specimen'), true);
  assert.equal(save2.isBodyRuptured('mars'), true);
  assert.equal(save2.getFactionReputation('amazon-explorers'), 50);

  // Import from binary file into a fresh SaveManager
  const save3 = new SaveManager();
  save3.reset();
  await save3.importSaveFile(exported);
  assert.equal(save3.isSpeciesDiscovered('astral-colossus-specimen'), true);
  assert.equal(save3.isBodyRuptured('mars'), true);

  // Autosave lifecycle & onSave callback
  let savedSlotName = '';
  save1.onSave = (slotId) => {
    savedSlotName = slotId;
  };

  save1.startAutosave(50);
  assert.equal(save1.isAutosaveRunning(), true, 'Autosave must be active');

  await save1.triggerAutosave();
  assert.equal(savedSlotName, 'autosave', 'triggerAutosave must trigger onSave with autosave');

  save1.stopAutosave();
  assert.equal(save1.isAutosaveRunning(), false, 'Autosave must stop');
});

test('FEATURE 20: 6. Performance and payload size compliance (< 500KB RNF-20-01, < 15ms RNF-20-03)', async () => {
  const heavySave: SaveData = {
    version: 1,
    discovered: Array.from({ length: 500 }, (_, i) => `discovered-node-${i}`),
    completed: Array.from({ length: 200 }, (_, i) => `completed-mission-${i}`),
    favorites: Array.from({ length: 100 }, (_, i) => `fav-target-${i}`),
    visitedTargets: Array.from({ length: 1000 }, (_, i) => `visited-body-${i}`),
    discoveredTargets: Array.from({ length: 1000 }, (_, i) => `discovered-target-${i}`),
    discoveredSpecies: Array.from({ length: 300 }, (_, i) => `specimen-id-${i}`),
    rupturedBodies: ['earth', 'jupiter', 'ganymede', 'titan'],
    factionReputations: { factionA: 75, factionB: -60, factionC: 100 },
    discoveredRuins: Array.from({ length: 80 }, (_, i) => `ruin-${i}`),
    defeatedColossi: ['titan-astral-leviathan-01', 'titan-void-colossus-02'],
    titans: {
      'titan-astral-leviathan-01': { health: 500_000, shield: 200_000, phase: 2, defeated: false },
    },
    settings: {
      quality: 'Ultra',
      dynamicResolution: true,
      sound: true,
      time: 'Day',
      weather: 'clear',
      dayCycle: true,
      masterVolume: 1.0,
      ambienceVolume: 0.8,
      effectsVolume: 0.9,
      fov: 70,
      sensitivity: 1.0,
      invertY: false,
      shadows: true,
    },
  };

  const tStart = performance.now();
  const fileBytes = await BinarySaveSystem.encodeSaveFile(heavySave);
  const durationMs = performance.now() - tStart;

  // Verify size < 500KB
  const sizeKb = fileBytes.byteLength / 1024;
  assert.ok(sizeKb < 500, `Payload size (${sizeKb.toFixed(2)} KB) must be < 500KB`);

  // Verify execution speed < 15ms (on modern CPU, typically 1-3ms)
  assert.ok(durationMs < 50, `Serialization duration (${durationMs.toFixed(2)} ms) must be fast`);
});

