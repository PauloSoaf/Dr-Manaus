import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group, Euler } from 'three';
import { PlayerController } from '../src/player/PlayerController';
import { PowerSystem } from '../src/player/powers/PowerSystem';
import { CombatSystem } from '../src/player/combat/CombatSystem';
import { HitStopSystem } from '../src/player/combat/HitStopSystem';

test('PATCH 04B: 1. Player health and shield vitals system with shield absorption and regen', () => {
  const root = new Group();
  const mockInput = {
    held: () => false,
    consume: () => false,
    pressed: () => false,
    enabled: true,
  } as any;

  const player = new PlayerController(root, mockInput);
  assert.strictEqual(player.health, 1000, 'Initial health should be 1000');
  assert.strictEqual(player.shield, 500, 'Initial shield should be 500');

  // 1. Partial shield damage: 200 damage absorbed completely by shield
  const hit1 = player.takeDamage(200, 'Ataque Menor');
  assert.strictEqual(hit1.absorbedByShield, 200);
  assert.strictEqual(hit1.damageDealt, 0);
  assert.strictEqual(player.shield, 300);
  assert.strictEqual(player.health, 1000);
  assert.strictEqual(hit1.fatal, false);

  // 2. Shield break and spillover to health: 400 damage -> 300 to shield, 100 to health
  const hit2 = player.takeDamage(400, 'Ataque Pesado');
  assert.strictEqual(hit2.absorbedByShield, 300);
  assert.strictEqual(hit2.damageDealt, 100);
  assert.strictEqual(player.shield, 0);
  assert.strictEqual(player.health, 900);

  // 3. Shield regen after delay: advancing frames before delay does not regenerate shield
  for (let i = 0; i < 40; i++) player.update(0.05, [], 0, 0); // 2.0s passed
  assert.strictEqual(player.shield, 0, 'Shield must not recharge before shieldRegenDelay (3.0s)');

  // Advance past 3.0s delay (another 30 frames * 0.05 = 1.5s -> total 3.5s)
  for (let i = 0; i < 30; i++) player.update(0.05, [], 0, 0);
  assert.ok(player.shield > 20, `Shield should be regenerating (current: ${player.shield})`);

  // 4. Invulnerability immunity
  player.isGodMode = true;
  const godHit = player.takeDamage(500, 'Meteoro Orbital');
  assert.strictEqual(godHit.damageDealt, 0);
  assert.strictEqual(godHit.absorbedByShield, 0);
  assert.strictEqual(player.health, 900, 'Godmode / invulnerability must prevent all damage');
  player.isGodMode = false;

  // 5. Fatal damage and quantum respawn
  let deathReason = '';
  player.onDeath = (reason) => {
    deathReason = reason;
  };
  const fatalHit = player.takeDamage(2000, 'Supernova Astral');
  assert.strictEqual(fatalHit.fatal, true);
  assert.strictEqual(deathReason, 'Supernova Astral');
  assert.strictEqual(player.health, player.maxHealth, 'Quantum respawn restores player health');
  assert.strictEqual(player.shield, player.maxShield, 'Quantum respawn restores player shield');
});

test('PATCH 04B: 2. Dodge roll / airDash provides invulnerability window against lethal attacks', () => {
  const root = new Group();
  const keys = new Set<string>();
  const mockInput = {
    held: (code: string) => keys.has(code),
    consume: (code: string) => {
      const match = keys.has(code);
      keys.delete(code);
      return match;
    },
    pressed: (code: string) => keys.has(code),
    enabled: true,
  } as any;

  const player = new PlayerController(root, mockInput);
  player.state = 'Flight';

  // Trigger air dash with KeyZ
  keys.add('KeyZ');
  player.update(0.016, [], 0, 0);
  // Advance into the iFrame window [0.02, 0.20]
  player.update(0.04, [], 0, 0);

  assert.ok(player.dodge.active, 'Dodge should be active');
  assert.strictEqual(player.invulnerable, true, 'Player must be invulnerable during dodge window');

  // Lethal attack incoming during dodge
  const hit = player.takeDamage(10000, 'Raio Cósmico');
  assert.strictEqual(hit.damageDealt, 0, 'Dodge must negate attack completely');
  assert.strictEqual(hit.fatal, false);
  assert.strictEqual(player.health, 1000);
});

test('PATCH 04B: 3. Fluid CombatSystem polar soft-targeting and kinetic hitstop integrated in PowerSystem', () => {
  const root = new Group();
  const mockPlayer = {
    position: new Vector3(0, 0, 0),
    velocity: new Vector3(0, 0, 0),
    facingYaw: 0,
    size: 1.0,
    state: 'Grounded',
    isGrounded: true,
    consumeImpact: () => null,
    beginSlam: () => {},
    powerPose: () => {},
    character: {
      hips: { rotation: new Euler() },
      startCombatMove: () => {},
      cosmicDiagnostics: {},
      skinnedMeshes: [],
    },
  } as any;

  const mockCamera = {
    position: new Vector3(0, 1.8, 0),
    getWorldDirection: (out: Vector3) => out.set(0, 0, -1),
  } as any;

  const keys = new Set<string>();
  const mockInput = {
    held: (code: string) => keys.has(code),
    consume: (code: string) => {
      const has = keys.has(code);
      keys.delete(code);
      return has;
    },
    pressed: (code: string) => keys.has(code),
    enabled: true,
  } as any;

  // An enemy target 1.8 meters ahead within 22-degree cone
  const enemyTarget = {
    id: 'alien-corrupted-scout-01',
    position: new Vector3(0.2, 0.7, -1.8),
    radius: 1.0,
    active: true,
    kind: 'creature' as const,
  };

  let hitReported: { id: string; force: number } | null = null;
  const powers = new PowerSystem(root, mockPlayer, mockCamera, mockInput, {
    targets: () => [enemyTarget],
    hit: (id, force) => { hitReported = { id, force }; },
    reconstruct: () => 0,
    impulse: () => {},
    prepare: async () => {},
    notify: () => {},
    sound: () => {},
    getOrigin: () => new Vector3(),
    getColliders: () => [],
  });

  // Verify CombatSystem is directly accessible on powers
  assert.ok(powers.combat instanceof CombatSystem, 'PowerSystem must instantiate CombatSystem');
  assert.ok(powers.hitStop instanceof HitStopSystem, 'powers.hitStop must be available');

  // Trigger punch attack
  powers.use('punch');

  // Verify polar targeting adjusted the aim toward the target
  const softInfo = powers.softTargetInfo;
  assert.strictEqual(softInfo.id, 'alien-corrupted-scout-01');
  assert.ok(softInfo.angleDeg >= 0 && softInfo.angleDeg < 30.0, 'Soft targeting angle must be within 30-deg half-cone');

  // Advance time to melee hit event (0.25s exceeds contact time ~0.19s)
  powers.update(0.25, 0.25);

  // Verify hit was applied and hitstop triggered
  assert.ok(hitReported !== null, 'Hit must be reported on the soft target');
  assert.strictEqual(hitReported!.id, 'alien-corrupted-scout-01');
  assert.ok(powers.hitStop.active, 'HitStop must be triggered upon successful impact');
});
