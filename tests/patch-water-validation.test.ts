import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AnimationClip, Group, Mesh, Object3D, QuaternionKeyframeTrack, Vector3 } from 'three/webgpu';
import { AlienSettlementManager } from '../src/world/life/AlienSettlementManager';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { SaveManager } from '../src/core/SaveManager';
import { WaterSystem } from '../src/rendering/WaterSystem';
import {
  WaterDiagnosticIsolationController,
  VISUAL_ISOLATION_MODES,
} from '../src/rendering/WaterDiagnosticIsolation';
import { QualityManager } from '../src/rendering/QualityManager';
import {
  sampleManausWater,
  WATER_WAVE_PROFILES,
  type WaterWaveProfileId,
} from '../src/world/water/ManausHydrology';
import { manausBathymetry } from '../src/world/water/ManausBathymetry';
import { createTerrain } from '../src/world/geodata/terrain';
import { TerrainDestruction } from '../src/world/destruction/TerrainDestruction';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { PlayerController } from '../src/player/PlayerController';
import { CHARACTER_CLIPS, CharacterAnimator } from '../src/player/animations/CharacterAnimator';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

function createMockInput() {
  const heldKeys = new Set<string>();
  const consumedKeys = new Set<string>();
  return {
    enabled: true,
    mouseDelta: { x: 0, y: 0 },
    held: (k: string) => heldKeys.has(k),
    consume: (k: string) => {
      const had = consumedKeys.has(k);
      consumedKeys.delete(k);
      return had;
    },
    pressed: (k: string) => heldKeys.has(k),
    setHeld: (k: string, val: boolean) => {
      if (val) heldKeys.add(k);
      else heldKeys.delete(k);
    },
    tap: (k: string) => {
      consumedKeys.add(k);
    },
  };
}

function makeDummyClips(): AnimationClip[] {
  const makeClip = (name: string, duration = 1.2) =>
    new AnimationClip(name, duration, [
      new QuaternionKeyframeTrack('pelvis.quaternion', [0, duration], [0, 0, 0, 1, 0, 0, 0, 1]),
      new QuaternionKeyframeTrack('spine_01.quaternion', [0, duration], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);
  return [
    makeClip(CHARACTER_CLIPS.idle, 2.5),
    makeClip(CHARACTER_CLIPS.walk, 1.333),
    makeClip(CHARACTER_CLIPS.run, 0.933),
    makeClip(CHARACTER_CLIPS.sprint, 0.667),
    makeClip(CHARACTER_CLIPS.airborne, 1.0),
    makeClip(CHARACTER_CLIPS.jumpStart, 0.8),
    makeClip(CHARACTER_CLIPS.land, 0.6),
    makeClip(CHARACTER_CLIPS.hoverRest, 2.5),
    makeClip(CHARACTER_CLIPS.hoverCruise, 2.5),
    makeClip(CHARACTER_CLIPS.swimIdle, 3.333),
    makeClip(CHARACTER_CLIPS.swimForward, 1.333),
  ];
}

describe('PATCH WATER-01..WATER-04A Complete Physical Riverbed, Swimming & Wave Recovery Validation', () => {
  const earthBody: CelestialBody = {
    id: 'earth',
    name: 'Terra',
    frameId: 'earth-frame',
    equatorialRadiusM: 6378137,
    polarRadiusM: 6356752,
    massKg: 5.972e24,
  };
  const earthBiosphere = generatePlanetaryBiosphere(earthBody, SOLAR_BODY_PROFILES.earth, 1337n);

  const alienBiosphere = {
    ...earthBiosphere,
    bodyId: 'procedural-colony-alpha',
    ecosystemDomain: 'alien-procedural' as const,
    isAlienWorld: true,
  };

  const fakeSurface: PlanetSurfaceGenerator = {
    body: { semiMajorAxisM: 6378137, flattening: 0.0033528 },
    radiusM: 6378137,
    heightAt: (_direction: Vec3) => 50,
    normalEnu: (_direction: Vec3, out: Vec3) => {
      out[0] = 0; out[1] = 1; out[2] = 0;
    },
    colourAt: (_direction: Vec3, out: [number, number, number]) => {
      out[0] = 0.2; out[1] = 0.5; out[2] = 0.2;
    },
  };

  const submergedSurface: PlanetSurfaceGenerator = {
    ...fakeSurface,
    heightAt: (_direction: Vec3) => -15.0,
  };

  it('1. Isolamento de Ecossistemas: Nenhuma metrópole alienígena gerada em Manaus / Terra', () => {
    const save = new SaveManager();
    const manager = new AlienSettlementManager(save);

    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const playerPos = new Vector3(x * 240 + 120, 50, z * 240 + 120);
        manager.update(0.016, playerPos, fakeSurface, earthBiosphere);
        assert.strictEqual(manager.activeSettlements.length, 0, 'No alien settlements on Earth');
        assert.strictEqual(manager.metropolis.megalithCount, 0, 'No megaliths generated on Earth');
      }
    }
    manager.dispose();
  });

  it('2. Civilizações alienígenas e clear() funcionam em outros planetas elegíveis', () => {
    const save = new SaveManager();
    const manager = new AlienSettlementManager(save);

    let spawned = false;
    for (let x = 0; x < 10; x++) {
      const playerPos = new Vector3(x * 240 + 120, 50, 120);
      manager.update(0.016, playerPos, fakeSurface, alienBiosphere);
      if (manager.activeSettlements.length > 0) {
        spawned = true;
        break;
      }
    }
    assert.ok(spawned, 'Alien civilized worlds must spawn settlements');

    manager.clear();
    for (let x = 0; x < 10; x++) {
      manager.update(0.016, new Vector3(x * 240 + 120, -10, 120), submergedSurface, alienBiosphere);
      assert.strictEqual(manager.activeSettlements.length, 0, 'Must not spawn terrestrial city underwater');
    }
    manager.dispose();
  });

  it('3. WATER-04A (P0.7): Amostragem densa (0.5m..1m) da margem e corte transversal completo do Rio Negro', () => {
    // 3A. High-resolution (0.5m step) shoreline transition profile across the first 60m of water
    const denseProfile = manausBathymetry.sampleDenseShorelineProfile(0, 10, 60, 0.5, 0);
    const denseLand = denseProfile.filter(p => !p.isWater);
    const denseWater = denseProfile.filter(p => p.isWater);

    assert.ok(denseLand.length >= 10, 'Dense profile must capture dry land leading up to shoreline');
    assert.ok(denseWater.length >= 80, 'Dense profile must capture first 60m of water at 0.5m resolution');

    for (const lp of denseLand) {
      assert.strictEqual(lp.riverbedY, 0, 'Land datum must be 0.0m');
    }

    // Verify C0 continuity at the shoreline edge and gentle walkable slope across the first 24m
    const firstWater = denseWater[0];
    assert.ok(firstWater.depthM < 0.25, `First water sample at 0.5m resolution must be very shallow (depth=${firstWater.depthM.toFixed(3)}m)`);
    assert.ok(firstWater.riverbedY > -0.15, `Riverbed at shoreline boundary must be continuous with 0m land datum (bedY=${firstWater.riverbedY.toFixed(3)}m)`);

    let maxStepDeltaM = 0;
    for (let i = 1; i < denseWater.length; i++) {
      const stepDelta = Math.abs(denseWater[i].riverbedY - denseWater[i - 1].riverbedY);
      if (stepDelta > maxStepDeltaM) maxStepDeltaM = stepDelta;
    }
    assert.ok(maxStepDeltaM < 0.15, `Shoreline slope must be continuous without vertical cliffs (maxStepDelta=${maxStepDeltaM.toFixed(3)}m per 0.5m)`);

    // 3B. Macro cross-section across the full channel (z = 1000 to z = 3500)
    const section = manausBathymetry.sampleCrossSection(0, 1000, 3500, 126, 0);
    const waterPoints = section.filter(p => p.isWater);

    let minBedY = 0;
    let shallowFound = false;
    let intermediateFound = false;
    let deepChannelFound = false;

    for (const wp of waterPoints) {
      assert.ok(wp.riverbedY < wp.surfaceY, `Riverbed (${wp.riverbedY}) must be below water surface (${wp.surfaceY})`);
      assert.ok(wp.depthM > 0.1, 'Water column depth must be positive');
      if (wp.depthM > 0.2 && wp.depthM < 2.5) shallowFound = true;
      if (wp.depthM >= 3.0 && wp.depthM < 14.0) intermediateFound = true;
      if (wp.depthM >= 15.0) deepChannelFound = true;
      if (wp.riverbedY < minBedY) minBedY = wp.riverbedY;
    }

    assert.ok(shallowFound, 'Must have shallow wading/margin zone');
    assert.ok(intermediateFound, 'Must have intermediate sloped channel zone');
    assert.ok(deepChannelFound, 'Must have deep main fairway channel (> 15m depth)');
    assert.ok(minBedY < -18.0, `Main channel bed must be deeply excavated (found minBedY = ${minBedY.toFixed(2)}m)`);
  });

  it('4. WATER-03B & P0.7: Malha 3D manaus-riverbed concorda com PhysicsWorld.terrainHeight nos vértices e nos pontos médios costeiros', () => {
    const root = new Group();
    const terrainGroup = createTerrain(root);
    const destructTerrain = new TerrainDestruction(root);
    PhysicsWorld.setTerrain(destructTerrain);

    try {
      const riverbedMesh = terrainGroup.getObjectByName('manaus-riverbed') as Mesh;
      assert.ok(riverbedMesh, 'manaus-riverbed 3D mesh must exist in terrain group');

      const posAttr = riverbedMesh.geometry.getAttribute('position');
      assert.ok(posAttr.count > 5000, 'manaus-riverbed must have thousands of 3D vertices');

      let shoreVertices = 0;
      let deepVertices = 0;
      let maxVertexDiff = 0;

      for (let i = 0; i < posAttr.count; i += 17) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);

        const physY = PhysicsWorld.terrainHeight(vx, vz);
        const diff = Math.abs(vy - physY);
        if (diff > maxVertexDiff) maxVertexDiff = diff;

        if (Math.abs(vy) < 1e-4) shoreVertices++;
        if (vy < -15.0) deepVertices++;
      }

      assert.ok(shoreVertices > 0, 'Riverbed mesh must connect to Y=0.0m at shoreline vertices');
      assert.ok(deepVertices > 0, 'Riverbed mesh must have deeply excavated 3D channel vertices (< -15m)');
      assert.ok(maxVertexDiff < 1e-4, `Rendered 3D riverbed mesh and PhysicsWorld.terrainHeight must match at vertices (maxDiff=${maxVertexDiff})`);

      // Verify inter-vertex midpoint agreement on the 16m coastal triangles in the shallow wading/shelf zone
      let coastalMidpointChecked = 0;
      let maxCoastalMidpointDiff = 0;
      for (let tri = 0; tri < posAttr.count; tri += 3) {
        const ax = posAttr.getX(tri), ay = posAttr.getY(tri), az = posAttr.getZ(tri);
        const bx = posAttr.getX(tri + 1), by = posAttr.getY(tri + 1), bz = posAttr.getZ(tri + 1);
        const cx = posAttr.getX(tri + 2), cy = posAttr.getY(tri + 2), cz = posAttr.getZ(tri + 2);
        const edgeSpan = Math.hypot(bx - ax, bz - az);
        if (edgeSpan <= 18 && Math.abs(ax) < 1500 && az > 1500 && az < 2200 && ay < -0.05 && by < -0.05 && cy < -0.05) {
          const mx = (ax + bx + cx) / 3;
          const my = (ay + by + cy) / 3;
          const mz = (az + bz + cz) / 3;
          const physMidY = PhysicsWorld.terrainHeight(mx, mz);
          const midDiff = Math.abs(my - physMidY);
          if (midDiff > maxCoastalMidpointDiff) maxCoastalMidpointDiff = midDiff;
          coastalMidpointChecked++;
          if (coastalMidpointChecked >= 60) break;
        }
      }
      assert.ok(coastalMidpointChecked > 10, 'Must locate 16m coastal triangles along central Manaus shoreline');
      assert.ok(maxCoastalMidpointDiff < 0.25, `16m coastal triangle centroids must closely match continuous collision heightfield (maxDiff=${maxCoastalMidpointDiff.toFixed(3)}m)`);
    } finally {
      PhysicsWorld.setTerrain(null);
      destructTerrain.dispose();
    }
  });

  it('5. WATER-03B: Crateras submersas escavam o leito do rio e a reconstrução restaura a batimetria natural', () => {
    const root = new Group();
    const destructTerrain = new TerrainDestruction(root);
    PhysicsWorld.setTerrain(destructTerrain);

    try {
      const riverPoint = new Vector3(0, 0, 2800);
      const naturalBedY = manausBathymetry.sampleRiverbedHeight(riverPoint.x, riverPoint.z);
      assert.ok(naturalBedY < -10.0, `Point must be in deep river (bedY=${naturalBedY.toFixed(2)}m)`);

      riverPoint.y = naturalBedY;
      const damaged = destructTerrain.damageAt(riverPoint, 45, 5000, 12);
      assert.strictEqual(damaged, true, 'Must allow crater excavation on submerged riverbed');
      destructTerrain.update(riverPoint, new Vector3());

      const excavatedBedY = PhysicsWorld.terrainHeight(riverPoint.x, riverPoint.z);
      assert.ok(excavatedBedY < naturalBedY - 5.0, 'Crater must deepen riverbed');

      const restored = destructTerrain.restoreAt(riverPoint, 60);
      assert.strictEqual(restored, 1);
      destructTerrain.update(riverPoint, new Vector3());

      const restoredBedY = PhysicsWorld.terrainHeight(riverPoint.x, riverPoint.z);
      assert.ok(Math.abs(restoredBedY - naturalBedY) < 1e-4, 'Reconstruction must preserve natural bathymetry');
    } finally {
      PhysicsWorld.setTerrain(null);
      destructTerrain.dispose();
    }
  });

  it('6. WATER-04A (P0.1, P0.2, P0.3, P0.8): Natação seleciona Swim_Idle_Loop / Swim_Fwd_Loop, nunca corre na água, não emite footsteps e restaura caminhada ao sair', () => {
    // 6A. Verify Swim_Idle_Loop and Swim_Fwd_Loop exist in the actual binary GLB asset on disk
    const glbPath = path.resolve(process.cwd(), 'public/assets/player/dr-manaus-character.glb');
    assert.ok(fs.existsSync(glbPath), 'dr-manaus-character.glb must exist on disk');
    const glbBytes = fs.readFileSync(glbPath);
    const jsonChunkLength = glbBytes.readUInt32LE(12);
    const gltfJson = JSON.parse(glbBytes.subarray(20, 20 + jsonChunkLength).toString('utf8'));
    const glbAnimationNames = new Set<string>((gltfJson.animations ?? []).map((a: { name: string }) => a.name));
    assert.ok(glbAnimationNames.has('Swim_Idle_Loop'), 'GLB binary must contain Swim_Idle_Loop');
    assert.ok(glbAnimationNames.has('Swim_Fwd_Loop'), 'GLB binary must contain Swim_Fwd_Loop');

    // 6B. Wire CharacterAnimator onto player character so we test the full pipeline:
    // PlayerController -> CharacterModel.animate -> AnimationController & CharacterAnimator -> AnimationGraph
    const root = new Group();
    const destructTerrain = new TerrainDestruction(root);
    PhysicsWorld.setTerrain(destructTerrain);
    const input = createMockInput();
    const player = new PlayerController(root, input as any);

    const animRoot = new Object3D();
    const animator = new CharacterAnimator(animRoot, makeDummyClips());
    (player.character as any).animator = animator;

    let footstepCountWhileSwimming = 0;
    let footstepCountOnLand = 0;
    animator.graph.onFootstep = () => {
      if (player.state === 'Swimming') footstepCountWhileSwimming++;
      else footstepCountOnLand++;
    };

    try {
      const bankZ = manausBathymetry.findShorelineZ(0, 1200, 2500, 0.5);
      const shallowZ = bankZ + 8; // ~8m into water: depth ~0.6m (< 1.15m) -> Wading
      const deepZ = bankZ + 120;  // ~120m into water: depth ~11m -> Deep Swimming

      // 1. Shallow water wading (< 1.15m): Grounded + Wading
      const shallowBedY = PhysicsWorld.terrainHeight(0, shallowZ);
      player.teleport(new Vector3(0, shallowBedY + 0.02, shallowZ));
      for (let i = 0; i < 15; i++) player.update(1 / 60, [], 0, 0);
      assert.strictEqual(player.state, 'Grounded', 'Shallow water must remain Grounded');
      assert.strictEqual(player.swimmingVisualState, 'Wading', 'Visual state in shallow water must be Wading');

      // 2. Deep water stationary: Swimming + SwimmingSurfaceIdle -> Swim_Idle_Loop
      const surfaceY = manausBathymetry.sampleWaterSurface(0, deepZ, 0);
      player.teleport(new Vector3(0, surfaceY - 1.18, deepZ));
      for (let i = 0; i < 25; i++) player.update(1 / 60, [], 0, 0);
      assert.strictEqual(player.state, 'Swimming', 'Deep water must enter Swimming state');
      assert.strictEqual(player.swimmingVisualState, 'SwimmingSurfaceIdle');
      assert.strictEqual(player.character.animationDebug?.clip, 'Swim_Idle_Loop', 'Stationary swimmer must play Swim_Idle_Loop');
      assert.strictEqual(player.character.animationController.debugState.currentAnimation, 'Swim_Idle_Loop');

      // 3. Deep water forward swimming (KeyW + ShiftLeft): SwimmingSurfaceForward -> Swim_Fwd_Loop (never Jog/Sprint!)
      input.setHeld('KeyW', true);
      input.setHeld('ShiftLeft', true);
      for (let i = 0; i < 40; i++) player.update(1 / 60, [], 0, 0);
      assert.strictEqual(player.state, 'Swimming');
      assert.strictEqual(player.swimmingVisualState, 'SwimmingSurfaceForward');
      assert.strictEqual(player.character.animationDebug?.clip, 'Swim_Fwd_Loop', 'Moving swimmer must play Swim_Fwd_Loop');
      assert.notStrictEqual(player.character.animationDebug?.clip, 'Jog_Fwd_Loop', 'Must never select Jog_Fwd_Loop while swimming');
      assert.notStrictEqual(player.character.animationDebug?.clip, 'Sprint_Loop', 'Must never select Sprint_Loop while swimming');
      assert.strictEqual(footstepCountWhileSwimming, 0, 'Swimming must emit ZERO footstep events');
      input.setHeld('KeyW', false);
      input.setHeld('ShiftLeft', false);

      // 4. Diving to the 3D riverbed (ControlLeft): SwimmingDive -> Swim_Fwd_Loop (never Jump_Loop/fall)
      input.setHeld('ControlLeft', true);
      for (let i = 0; i < 30; i++) {
        player.update(1 / 30, [], 0, 0);
        assert.notStrictEqual(player.character.animationDebug?.clip, 'Jump_Loop', 'Diving must never activate fall animation');
        assert.notStrictEqual(player.character.animationDebug?.clip, 'Jump_Start', 'Diving must never activate jump animation');
      }
      assert.strictEqual(player.swimmingVisualState, 'SwimmingDive');
      assert.strictEqual(player.character.animationDebug?.clip, 'Swim_Fwd_Loop');
      for (let i = 0; i < 150; i++) player.update(1 / 30, [], 0, 0);
      input.setHeld('ControlLeft', false);

      const finalBedY = PhysicsWorld.terrainHeight(player.position.x, player.position.z);
      assert.ok(player.position.y <= finalBedY + 0.35, 'Diver must touch the 3D riverbed');
      assert.strictEqual(player.onRiverbed, true);

      // 5. Ascending back to the water surface (Space): SwimmingAscend -> Swim_Fwd_Loop (never running!)
      input.setHeld('Space', true);
      for (let i = 0; i < 30; i++) {
        player.update(1 / 30, [], 0, 0);
        assert.notStrictEqual(player.character.animationDebug?.clip, 'Jog_Fwd_Loop');
        assert.notStrictEqual(player.character.animationDebug?.clip, 'Sprint_Loop');
      }
      assert.strictEqual(player.swimmingVisualState, 'SwimmingAscend');
      for (let i = 0; i < 150; i++) player.update(1 / 30, [], 0, 0);
      input.setHeld('Space', false);
      assert.ok(player.position.y > surfaceY - 1.6, 'Swimmer must return to surface');
      assert.strictEqual(footstepCountWhileSwimming, 0, 'Zero footsteps during entire swim/dive/ascend cycle');

      // 6. Exiting the water onto dry land restores terrestrial locomotion (Walk/Jog + footsteps)
      const dryLandZ = bankZ - 25;
      player.teleport(new Vector3(0, 0.05, dryLandZ));
      input.setHeld('KeyW', true);
      for (let i = 0; i < 45; i++) player.update(1 / 60, [], 0, 0);
      input.setHeld('KeyW', false);
      assert.strictEqual(player.state, 'Grounded');
      assert.strictEqual(player.swimmingVisualState, 'None');
      assert.ok(
        ['Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop'].includes(player.character.animationDebug?.clip ?? ''),
        `Exiting water onto land must restore terrestrial locomotion (got ${player.character.animationDebug?.clip})`,
      );
      assert.ok(footstepCountOnLand > 0, 'Terrestrial running on dry land must emit footsteps normally');

      // 7. Voluntary cosmic flight independence
      player.teleport(new Vector3(0, surfaceY - 1.18, deepZ));
      player.update(1 / 60, [], 0, 0);
      assert.strictEqual(player.state, 'Swimming');
      player.toggleFlight();
      assert.strictEqual(player.isFlying, true, 'Cosmic flight must activate from water');
      for (let i = 0; i < 20; i++) player.update(1 / 60, [], 0, 0);
      assert.strictEqual(player.isFlying, true, 'Voluntary flight must not be forced back into Swimming');
    } finally {
      PhysicsWorld.setTerrain(null);
      destructTerrain.dispose();
    }
  });

  it('7. WATER-04A (P0.4 & P0.8): Contrato único de ondas CPU/GPU, perfis parametrizados e independência de FPS', () => {
    const root = new Group();
    const water = new WaterSystem(root);

    const profiles: WaterWaveProfileId[] = [
      'RIO_NEGRO_CALM',
      'RIO_NEGRO_WINDY',
      'SOLIMOES_CURRENT',
      'TERRESTRIAL_OCEAN',
    ];

    for (const profileId of profiles) {
      water.setWaveProfile(profileId);
      assert.strictEqual(water.getWaveProfile(), profileId);
      assert.strictEqual(WATER_WAVE_PROFILES[profileId].length, 4);

      water.update(1 / 60, 14.25);
      const testCoords = [
        { x: 0, z: 2200, camDist: 50 },
        { x: 1450, z: 3100, camDist: 450 },
        { x: -820, z: 1950, camDist: 1200 },
      ];

      for (const pt of testCoords) {
        const shoreDist = Math.max(0, manausBathymetry.sampleSignedShoreDistance(pt.x, pt.z));
        const cpuSample = water.sampleHeight(pt.x, pt.z, 14.25, undefined, pt.camDist);
        const gpuSample = water.evaluateGpuWaveAt(pt.x, pt.z, 14.25, shoreDist, pt.camDist);

        assert.ok(
          Math.abs(cpuSample.height - gpuSample.height) < 1e-6,
          `CPU/GPU wave height mismatch for ${profileId} at (${pt.x},${pt.z}): cpu=${cpuSample.height}, gpu=${gpuSample.height}`,
        );
        assert.ok(
          cpuSample.normal.distanceTo(gpuSample.normal) < 1e-6,
          `CPU/GPU wave normal mismatch for ${profileId}`,
        );
      }
    }

    // Shoreline wave damping: zero displacement at shoreDistance = 0
    const shoreZero = sampleManausWater(1500, 2500, 10.0, 0.12, undefined, 0.0);
    assert.strictEqual(shoreZero.height, 0.12, 'Zero wave displacement at shoreline (d=0)');

    // FPS consistency: advancing water clock to T=10.0s at 30 FPS, 60 FPS, and 120 FPS yields identical wave state
    water.setWaveProfile('RIO_NEGRO_CALM');
    const sampleAtFps = (fps: number) => {
      let t = 0;
      const dt = 1 / fps;
      const steps = Math.round(10 * fps);
      for (let i = 0; i < steps; i++) {
        t += dt;
        water.update(dt, t);
      }
      return water.sampleHeight(500, 2600, t);
    };
    const s30 = sampleAtFps(30);
    const s60 = sampleAtFps(60);
    const s120 = sampleAtFps(120);
    assert.ok(Math.abs(s30.height - s60.height) < 1e-5, 'Wave height must be consistent between 30 FPS and 60 FPS');
    assert.ok(Math.abs(s60.height - s120.height) < 1e-5, 'Wave height must be consistent between 60 FPS and 120 FPS');

    water.vfx.dispose();
  });

  it('8. WATER-04A (P0.5, P0.6 & P0.8): Diagnóstico óptico (U), trava de resolução nativa (O) e isolamento visual de camadas (I) sem persistência', () => {
    const root = new Group();
    const water = new WaterSystem(root);
    const terrainGroup = createTerrain(root);
    const fakeCityRoot = new Group();
    const fakeStreamerRoot = new Group();

    // 8A. Optical diagnostic mode (KeyU)
    assert.strictEqual(water.uOpticalDebugMode.value, 0.0);
    water.setClearDebugMode(true);
    assert.strictEqual(water.telemetry.clearDebugMode, true);
    assert.strictEqual(water.uOpticalDebugMode.value, 1.0, 'Optical debug mode uniform must activate');
    assert.ok(water.uTurbidityScale.value < 0.2, 'Turbidity scale must drop in clear debug mode');
    assert.strictEqual(water.material.depthWrite, false, 'Optical debug mode disables depthWrite so riverbed is clearly visible');
    water.setClearDebugMode(false);
    assert.strictEqual(water.uOpticalDebugMode.value, 0.0);
    assert.strictEqual(water.material.depthWrite, true);

    // 8B. Visual layer isolation controller (KeyI)
    const isolation = new WaterDiagnosticIsolationController();
    const targets = {
      waterMesh: water.mesh,
      waterVfxGroup: water.vfx.group,
      flatTerrainGroup: terrainGroup,
      realCityRoot: fakeCityRoot,
      streamerRoot: fakeStreamerRoot,
    };
    const riverbedMesh = terrainGroup.getObjectByName('manaus-riverbed')!;
    const groundCoverMesh = terrainGroup.getObjectByName('ground-cover')!;

    assert.strictEqual(isolation.mode, 'none');
    for (const mode of VISUAL_ISOLATION_MODES) {
      isolation.setMode(mode, targets);
      assert.strictEqual(isolation.mode, mode);
      if (mode === 'water-only') {
        assert.strictEqual(water.mesh.visible, true);
        assert.strictEqual(terrainGroup.visible, false);
        assert.strictEqual(fakeCityRoot.visible, false);
      } else if (mode === 'riverbed-only') {
        assert.strictEqual(water.mesh.visible, false);
        assert.strictEqual(terrainGroup.visible, true);
        assert.strictEqual(riverbedMesh.visible, true);
        assert.strictEqual(groundCoverMesh.visible, false);
      } else if (mode === 'ground-cover-only') {
        assert.strictEqual(water.mesh.visible, false);
        assert.strictEqual(riverbedMesh.visible, false);
        assert.strictEqual(groundCoverMesh.visible, true);
      } else if (mode === 'real-city-only') {
        assert.strictEqual(water.mesh.visible, false);
        assert.strictEqual(terrainGroup.visible, false);
        assert.strictEqual(fakeCityRoot.visible, true);
      }
    }

    // Resetting isolation restores all layers and never persists in SaveManager
    isolation.reset(targets);
    assert.strictEqual(isolation.mode, 'none');
    assert.strictEqual(water.mesh.visible, true);
    assert.strictEqual(terrainGroup.visible, true);
    assert.strictEqual(riverbedMesh.visible, true);
    assert.strictEqual(groundCoverMesh.visible, true);
    assert.strictEqual(fakeCityRoot.visible, true);

    // 8C. Dynamic resolution diagnostic lock (KeyO) does not alter user settings
    const save = new SaveManager();
    const initialDynResSetting = save.data.settings.dynamicResolution;
    const mockRenderer = {
      renderScale: 0.64,
      resizeCalled: 0,
      resize() { this.resizeCalled++; },
    };
    const quality = new QualityManager(mockRenderer as any, () => {});
    quality.level = 3;
    quality.setDiagnosticNativeLock(true);
    assert.strictEqual(quality.diagnosticNativeLock, true);
    assert.strictEqual(mockRenderer.renderScale, 1.0, 'Diagnostic lock must force renderScale = 1.0');
    quality.update(0.05); // Simulate slow 50ms frame while locked
    assert.strictEqual(mockRenderer.renderScale, 1.0, 'Diagnostic lock must prevent dynamic downscaling');
    assert.strictEqual(save.data.settings.dynamicResolution, initialDynResSetting, 'User setting must remain untouched');

    water.vfx.dispose();
  });
});
