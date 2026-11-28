import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, Group, Mesh, Object3D, QuaternionKeyframeTrack, Vector3 } from 'three/webgpu';
import { PlayerController } from '../src/player/PlayerController';
import { CHARACTER_CLIPS, CharacterAnimator } from '../src/player/animations/CharacterAnimator';
import { TerrainDestruction } from '../src/world/destruction/TerrainDestruction';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { manausBathymetry } from '../src/world/water/ManausBathymetry';
import { createTerrain } from '../src/world/geodata/terrain';

function mockInput() {
  const held = new Set<string>();
  return {
    enabled: true, mouseDelta: { x: 0, y: 0 },
    held: (k: string) => held.has(k), consume: () => false, pressed: (k: string) => held.has(k),
    setHeld: (k: string, v: boolean) => { if (v) held.add(k); else held.delete(k); },
    tap: () => {},
  };
}

function dummyClips(): AnimationClip[] {
  const mk = (name: string, d: number) => new AnimationClip(name, d, [
    new QuaternionKeyframeTrack('pelvis.quaternion', [0, d], [0, 0, 0, 1, 0, 0, 0, 1]),
  ]);
  return [
    mk(CHARACTER_CLIPS.idle, 2.5), mk(CHARACTER_CLIPS.walk, 1.3), mk(CHARACTER_CLIPS.run, 0.9),
    mk(CHARACTER_CLIPS.sprint, 0.7), mk(CHARACTER_CLIPS.airborne, 1), mk(CHARACTER_CLIPS.jumpStart, 0.8),
    mk(CHARACTER_CLIPS.land, 0.6), mk(CHARACTER_CLIPS.hoverRest, 2.5), mk(CHARACTER_CLIPS.hoverCruise, 2.5),
    mk(CHARACTER_CLIPS.swimIdle, 3.3), mk(CHARACTER_CLIPS.swimForward, 1.3),
  ];
}

function rig() {
  const root = new Group();
  const terrain = new TerrainDestruction(root);
  PhysicsWorld.setTerrain(terrain);
  const input = mockInput();
  const player = new PlayerController(root, input as any);
  (player.character as any).animator = new CharacterAnimator(new Object3D(), dummyClips());
  return { player, input, dispose: () => { PhysicsWorld.setTerrain(null); terrain.dispose(); } };
}

const TERRESTRIAL = new Set(['Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Loop', 'Jump_Start', 'Jump_Land']);

describe('WATER adversarial: swimming state machine, scale, hysteresis, teleport', () => {
  it('A1. Random seeded input walk through the river never plays a terrestrial clip while Swimming', () => {
    const { player, input, dispose } = rig();
    try {
      const bankZ = manausBathymetry.findShorelineZ(0, 1200, 2500, 0.5);
      let seed = 1337;
      const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      player.teleport(new Vector3(0, 0.05, bankZ - 5));
      let swimmingFrames = 0;
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ControlLeft', 'Space'];
      for (let f = 0; f < 4000; f++) {
        if (f % 20 === 0) for (const k of keys) input.setHeld(k, rnd() < 0.35);
        input.setHeld('KeyW', f < 600 ? true : input.held('KeyW'));
        player.update(1 / (rnd() < 0.5 ? 30 : 144), [], Math.PI + (rnd() - 0.5) * 0.8, 0);
        if (player.state === 'Swimming') {
          swimmingFrames++;
          const clip = player.character.animationDebug?.clip ?? '';
          assert.ok(!TERRESTRIAL.has(clip), `frame ${f}: terrestrial clip ${clip} while Swimming`);
          assert.ok(!player.submersion || player.position.y >= player.submersion.riverbedY - 1e-3, `frame ${f}: below riverbed`);
        }
      }
      assert.ok(swimmingFrames > 200, `random walk must actually swim (swimmingFrames=${swimmingFrames})`);
    } finally { dispose(); }
  });

  it('A2. Hysteresis band: depth between stay and enter thresholds does not flip state', () => {
    const { player, dispose } = rig();
    try {
      const bankZ = manausBathymetry.findShorelineZ(0, 1200, 2500, 0.5);
      // find z with water depth ~1.0 m (between 0.90 stay and 1.15 enter)
      let z = bankZ;
      while (manausBathymetry.sampleWaterDepth(0, z, 0) < 1.02 && z < bankZ + 200) z += 0.25;
      const d = manausBathymetry.sampleWaterDepth(0, z, 0);
      assert.ok(d >= 0.95 && d <= 1.12, `probe depth ${d}`);
      const surf = manausBathymetry.sampleWaterSurface(0, z, 0);
      player.teleport(new Vector3(0, PhysicsWorld.terrainHeight(0, z) + 0.02, z));
      for (let i = 0; i < 30; i++) player.update(1 / 60, [], 0, 0);
      assert.equal(player.state, 'Grounded', 'entering from shallow must not swim inside hysteresis band');
      // force into Swimming then verify it stays while in band
      player.state = 'Swimming';
      player.position.y = surf - 1.18;
      let flips = 0, last = player.state;
      for (let i = 0; i < 120; i++) {
        player.update(1 / 60, [], 0, 0);
        if (player.state !== last) { flips++; last = player.state; }
      }
      assert.ok(flips <= 1, `state flipped ${flips} times inside hysteresis band`);
    } finally { dispose(); }
  });

  it('A3. Scaled character (size 2.5) still reaches the riverbed and never tunnels', () => {
    const { player, input, dispose } = rig();
    try {
      player.size = 2.5; (player as any).targetSize = 2.5;
      const bankZ = manausBathymetry.findShorelineZ(0, 1200, 2500, 0.5);
      const z = bankZ + 160;
      const surf = manausBathymetry.sampleWaterSurface(0, z, 0);
      player.teleport(new Vector3(0, surf - 1.18 * 2.5, z));
      input.setHeld('ControlLeft', true);
      for (let i = 0; i < 600; i++) {
        player.update(1 / 30, [], 0, 0);
        assert.ok(player.position.y >= PhysicsWorld.terrainHeight(player.position.x, player.position.z) - 1e-3, 'tunnelled through bed');
      }
      assert.ok(player.onRiverbed, 'scaled diver must touch bed');
    } finally { dispose(); }
  });

  it('A4. Flight started while swimming stays flight, and descending into water auto-splashes to Swimming', () => {
    const { player, input, dispose } = rig();
    try {
      const bankZ = manausBathymetry.findShorelineZ(0, 1200, 2500, 0.5);
      const z = bankZ + 150;
      const surf = manausBathymetry.sampleWaterSurface(0, z, 0);
      player.teleport(new Vector3(0, surf - 1.18, z));
      player.update(1 / 60, [], 0, 0);
      assert.equal(player.state, 'Swimming');
      player.toggleFlight();
      for (let i = 0; i < 20; i++) player.update(1 / 60, [], 0, 0);
      assert.ok(player.isFlying, 'voluntary flight kept');
      // let flight descend (hold Ctrl) after grace
      input.setHeld('ControlLeft', true);
      for (let i = 0; i < 400 && player.isFlying; i++) player.update(1 / 60, [], 0, 0);
      input.setHeld('ControlLeft', false);
      assert.equal(player.state, 'Swimming', 'descending flight must splash down into Swimming');
    } finally { dispose(); }
  });

  it('A5. Rapid enter/exit of the water 50 times leaves no swim visual lift or pitch on land', () => {
    const { player, dispose } = rig();
    try {
      const bankZ = manausBathymetry.findShorelineZ(0, 1200, 2500, 0.5);
      for (let n = 0; n < 50; n++) {
        const surf = manausBathymetry.sampleWaterSurface(0, bankZ + 140, 0);
        player.teleport(new Vector3(0, surf - 1.18, bankZ + 140));
        for (let i = 0; i < 5; i++) player.update(1 / 60, [], 0, 0);
        player.teleport(new Vector3(0, 0.05, bankZ - 30));
        for (let i = 0; i < 5; i++) player.update(1 / 60, [], 0, 0);
      }
      for (let i = 0; i < 120; i++) player.update(1 / 60, [], 0, 0);
      assert.equal(player.state, 'Grounded');
      assert.equal(player.character.animationController.bodyOffset.y, 0, 'swim lift must decay to zero on land');
      assert.ok(Math.abs(player.character.animationController.debugState.rootPitch) < 1e-3, 'swim pitch must decay on land');
    } finally { dispose(); }
  });

  it('B1. Independent three-way bed check: math field vs rendered triangles (barycentric) vs physics, 16 m coastal strip', () => {
    const root = new Group();
    const terrainGroup = createTerrain(root);
    const destruct = new TerrainDestruction(root);
    PhysicsWorld.setTerrain(destruct);
    try {
      const mesh = terrainGroup.getObjectByName('manaus-riverbed') as Mesh;
      const pos = mesh.geometry.getAttribute('position');
      let seed = 99;
      const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      let checked = 0, maxMeshVsPhysics = 0, maxMeshVsMath = 0;
      for (let t = 0; t < pos.count && checked < 400; t += 3) {
        const ax = pos.getX(t), az = pos.getZ(t);
        if (Math.abs(ax) > 1500 || az < 1500 || az > 2300) continue;
        const bx = pos.getX(t + 1), bz = pos.getZ(t + 1), cx = pos.getX(t + 2), cz = pos.getZ(t + 2);
        if (Math.hypot(bx - ax, bz - az) > 24 || Math.hypot(cx - ax, cz - az) > 24) continue;
        const u = rnd(), v = rnd() * (1 - u), w = 1 - u - v;
        const px = ax * w + bx * u + cx * v, pz = az * w + bz * u + cz * v;
        const py = pos.getY(t) * w + pos.getY(t + 1) * u + pos.getY(t + 2) * v;
        maxMeshVsPhysics = Math.max(maxMeshVsPhysics, Math.abs(py - PhysicsWorld.terrainHeight(px, pz)));
        maxMeshVsMath = Math.max(maxMeshVsMath, Math.abs(py - manausBathymetry.sampleRiverbedHeight(px, pz)));
        checked++;
      }
      assert.ok(checked >= 100, `need coastal sample (checked=${checked})`);
      // Documented tolerance: 16 m triangles linearly interpolating a smooth bed -> <= 0.20 m.
      assert.ok(maxMeshVsPhysics <= 0.20, `mesh vs physics ${maxMeshVsPhysics.toFixed(3)} m`);
      assert.ok(maxMeshVsMath <= 0.20, `mesh vs math ${maxMeshVsMath.toFixed(3)} m`);
      console.log(`# B1 checked=${checked} meshVsPhysics=${maxMeshVsPhysics.toFixed(3)}m meshVsMath=${maxMeshVsMath.toFixed(3)}m`);
    } finally { PhysicsWorld.setTerrain(null); destruct.dispose(); }
  });
});
