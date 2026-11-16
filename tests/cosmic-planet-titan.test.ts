import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { CosmicPlanetTitanManager } from '../src/world/life/CosmicPlanetTitan.ts';

test('COSMIC-TITAN: Initialization spawns planet-scale titan with planetary radius', () => {
  let soundPlayed = '';
  let notice = '';
  const manager = new CosmicPlanetTitanManager(
    undefined,
    msg => { notice = msg; },
    snd => { soundPlayed = snd; },
  );

  assert.ok(manager.titans.length >= 1);
  const titan = manager.titans[0];
  assert.ok(titan.radiusM >= 50_000, 'Titan must have planetary scale (>= 50 km)');
  assert.equal(titan.active, true);
  assert.ok(titan.maxHealth >= 1e9);

  const targets = manager.targets;
  assert.equal(targets.length, 1);
  assert.equal(targets[0].id, titan.id);

  manager.dispose();
});

test('COSMIC-TITAN: Orbital motion updates position and camera-relative root', () => {
  const manager = new CosmicPlanetTitanManager();
  const titan = manager.titans[0];
  const initialPos = titan.position.clone();

  // Advance time
  const cameraPos = new Vector3(initialPos.x + 10_000, initialPos.y, initialPos.z);
  manager.update(100.0, cameraPos);

  assert.notDeepEqual(titan.position, initialPos, 'Titan must drift along orbit');
  assert.ok(manager.root.visible);

  manager.dispose();
});

test('COSMIC-TITAN: Combat damage enrages titan and triggers audio reaction', () => {
  let soundPlayed = '';
  let notice = '';
  const manager = new CosmicPlanetTitanManager(
    undefined,
    msg => { notice = msg; },
    snd => { soundPlayed = snd; },
  );
  const titan = manager.titans[0];

  const hitRes = manager.hit(titan.id, 5e7, 1000);
  assert.equal(hitRes, true);
  assert.equal(titan.enraged, true);
  assert.equal(soundPlayed, 'colossus-roar');
  assert.ok(titan.health < titan.maxHealth);

  manager.dispose();
});
