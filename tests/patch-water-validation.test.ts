import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group, Mesh } from 'three/webgpu';
import { AlienSettlementManager } from '../src/world/life/AlienSettlementManager';
import { AlienMetropolisGenerator } from '../src/world/life/AlienMetropolisGenerator';
import { generatePlanetaryBiosphere } from '../src/world/life/PlanetaryBiosphere';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { SaveManager } from '../src/core/SaveManager';
import { WaterSystem } from '../src/rendering/WaterSystem';
import { sampleManausWater } from '../src/world/water/ManausHydrology';
import { manausBathymetry } from '../src/world/water/ManausBathymetry';
import { createTerrain } from '../src/world/geodata/terrain';
import { TerrainDestruction } from '../src/world/destruction/TerrainDestruction';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { PlayerController } from '../src/player/PlayerController';
import type { CelestialBody } from '../src/world/celestial/CelestialBody';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import type { Vec3 } from '../src/world/spatial/units';

function createMockInput() {
  const heldKeys = new Set<string>();
  const consumedKeys = new Set<string>();
  return {
    enabled: true,
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

describe('PATCH WATER-01, WATER-02 & WATER-03 Complete Physical Riverbed Validation', () => {
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

  it('3. WATER-03A: Seção transversal contínua do Rio Negro (margem -> raso -> canal -> leito profundo)', () => {
    // Cross-section from downtown Manaus land (z = 1000) across the shoreline into deep Rio Negro (z = 3500)
    const section = manausBathymetry.sampleCrossSection(0, 1000, 3500, 26, 0);

    const landPoints = section.filter(p => !p.isWater);
    const waterPoints = section.filter(p => p.isWater);
    assert.ok(landPoints.length > 0, 'Cross-section must start on dry land');
    assert.ok(waterPoints.length > 0, 'Cross-section must enter the Rio Negro');

    // On land, riverbedY is 0
    for (const lp of landPoints) {
      assert.strictEqual(lp.riverbedY, 0, 'Land datum must be 0.0m');
    }

    // In water, riverbedY is strictly below surfaceY, and deepens progressively away from shore
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

  it('4. WATER-03B: Malha 3D manaus-riverbed existe, possui vértices escavados e concorda 100% com PhysicsWorld.terrainHeight', () => {
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
      let maxDiff = 0;

      // Verify rendered vertex heights match physical collision heightAt(vx, vz)
      for (let i = 0; i < posAttr.count; i += 17) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);

        const physY = PhysicsWorld.terrainHeight(vx, vz);
        const diff = Math.abs(vy - physY);
        if (diff > maxDiff) maxDiff = diff;

        if (Math.abs(vy) < 1e-4) shoreVertices++;
        if (vy < -15.0) deepVertices++;
      }

      assert.ok(shoreVertices > 0, 'Riverbed mesh must connect to Y=0.0m at shoreline vertices');
      assert.ok(deepVertices > 0, 'Riverbed mesh must have deeply excavated 3D channel vertices (< -15m)');
      assert.ok(maxDiff < 1e-4, `Rendered 3D riverbed mesh and PhysicsWorld.terrainHeight must match exactly (maxDiff=${maxDiff})`);
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
      const riverPoint = new Vector3(0, 0, 2800); // Deep in Rio Negro
      const naturalBedY = manausBathymetry.sampleRiverbedHeight(riverPoint.x, riverPoint.z);
      assert.ok(naturalBedY < -10.0, `Point must be in deep river (bedY=${naturalBedY.toFixed(2)}m)`);
      assert.ok(Math.abs(PhysicsWorld.terrainHeight(riverPoint.x, riverPoint.z) - naturalBedY) < 1e-4);

      // Excavate a crater on the riverbed
      riverPoint.y = naturalBedY;
      const damaged = destructTerrain.damageAt(riverPoint, 45, 5000, 12);
      assert.strictEqual(damaged, true, 'Must allow crater excavation on submerged riverbed');
      destructTerrain.update(riverPoint, new Vector3());

      const excavatedBedY = PhysicsWorld.terrainHeight(riverPoint.x, riverPoint.z);
      assert.ok(excavatedBedY < naturalBedY - 5.0, `Crater must deepen riverbed (${excavatedBedY.toFixed(2)}m < ${naturalBedY.toFixed(2)}m)`);

      // Reconstruct restores the crater back to natural bathymetry (NOT to 0m!)
      const restored = destructTerrain.restoreAt(riverPoint, 60);
      assert.strictEqual(restored, 1);
      destructTerrain.update(riverPoint, new Vector3());

      const restoredBedY = PhysicsWorld.terrainHeight(riverPoint.x, riverPoint.z);
      assert.ok(Math.abs(restoredBedY - naturalBedY) < 1e-4, `Reconstruction must preserve natural bathymetry (${restoredBedY} === ${naturalBedY})`);
    } finally {
      PhysicsWorld.setTerrain(null);
      destructTerrain.dispose();
    }
  });

  it('6. WATER-03C: Personagem caminha no raso, nada no fundo, mergulha até tocar o leito 3D, sobe à superfície e sai andando', () => {
    const root = new Group();
    const destructTerrain = new TerrainDestruction(root);
    PhysicsWorld.setTerrain(destructTerrain);
    const input = createMockInput();
    const player = new PlayerController(root, input as any);

    try {
      // Find shoreline transition along x = 0 from z = 1200 to z = 2500
      let shallowZ = -1;
      let deepZ = -1;
      for (let z = 1200; z <= 3200; z += 4) {
        const d = manausBathymetry.sampleWaterDepth(0, z, 0);
        if (d > 0.35 && d < 0.85 && shallowZ < 0) shallowZ = z;
        if (d > 8.0 && d < 14.0 && deepZ < 0) deepZ = z;
      }
      assert.ok(shallowZ > 0, 'Must locate shallow wading zone');
      assert.ok(deepZ > 0, 'Must locate deep swimming zone');

      // A. Shallow water wading: player stands on sloped riverbed and stays Grounded
      const shallowBedY = PhysicsWorld.terrainHeight(0, shallowZ);
      player.teleport(new Vector3(0, shallowBedY + 0.05, shallowZ));
      for (let i = 0; i < 15; i++) player.update(1 / 60, [], 0, 0);
      assert.strictEqual(player.state, 'Grounded', 'Player in shallow water (< 1.15m) must walk on riverbed (Grounded)');
      assert.strictEqual(player.submersion.feetSubmerged, true, 'Feet must be submerged while wading');

      // B. Enter deep water: player transitions to Swimming and floats near water surface
      const surfaceY = manausBathymetry.sampleWaterSurface(0, deepZ, 0);
      const deepBedY = PhysicsWorld.terrainHeight(0, deepZ);
      player.teleport(new Vector3(0, surfaceY - 1.2, deepZ));
      for (let i = 0; i < 20; i++) player.update(1 / 60, [], 0, 0);
      assert.strictEqual(player.state, 'Swimming', 'Player in deep water must enter Swimming state');
      assert.ok(player.position.y > deepBedY + 4.0, 'Swimmer floats near surface prior to diving');

      // C. Dive down with ControlLeft all the way until touching the 3D riverbed at the bottom
      input.setHeld('ControlLeft', true);
      for (let i = 0; i < 180; i++) player.update(1 / 30, [], 0, 0);
      input.setHeld('ControlLeft', false);

      const finalBedY = PhysicsWorld.terrainHeight(player.position.x, player.position.z);
      assert.ok(player.position.y >= finalBedY - 1e-3, `Player must not tunnel through riverbed (${player.position.y} >= ${finalBedY})`);
      assert.ok(player.position.y <= finalBedY + 0.35, `Player must reach and touch the 3D riverbed bottom (y=${player.position.y.toFixed(2)}, bed=${finalBedY.toFixed(2)})`);
      assert.strictEqual(player.onRiverbed, true, 'onRiverbed flag must be true when touching the riverbed');

      // D. Swim back up to the surface with Space
      input.setHeld('Space', true);
      for (let i = 0; i < 180; i++) player.update(1 / 30, [], 0, 0);
      input.setHeld('Space', false);
      assert.ok(player.position.y > surfaceY - 1.6, `Player must ascend back to water surface (y=${player.position.y.toFixed(2)}m)`);

      // E. Cosmic Flight independence: toggling flight underwater flies freely without being forced into Swimming
      player.toggleFlight();
      assert.strictEqual(player.isFlying, true, 'Cosmic flight must activate inside water');
      for (let i = 0; i < 10; i++) player.update(1 / 60, [], 0, 0);
      assert.strictEqual(player.isFlying, true, 'Voluntary flight must not be arbitrarily overridden by swimming');
    } finally {
      PhysicsWorld.setTerrain(null);
      destructTerrain.dispose();
    }
  });

  it('7. WATER-03D: WaterSystem fornece atributo geométrico depth, modo cristalino de depuração e ocultação de ripples submersos', () => {
    const root = new Group();
    const water = new WaterSystem(root);

    const mesh = root.getObjectByName('Rio Negro e Solimões') as Mesh;
    assert.ok(mesh, 'Water surface mesh must exist');
    const depthAttr = mesh.geometry.getAttribute('depth');
    assert.ok(depthAttr && depthAttr.count > 0, 'Water geometry must carry geometric depth attribute');

    water.setClearDebugMode(true);
    assert.strictEqual(water.telemetry.clearDebugMode, true);
    assert.ok(water.uTurbidityScale.value < 0.2, 'Clear debug mode must lower turbidity uniform');

    water.setCameraUnderwater(true);
    assert.strictEqual(water.telemetry.cameraUnderwater, true);

    const shoreSample = sampleManausWater(1500, 2500, 10.0, 0.12, undefined, 0.0);
    assert.strictEqual(shoreSample.height, 0.12, 'Zero wave displacement at shoreline');

    water.vfx.dispose();
  });
});
