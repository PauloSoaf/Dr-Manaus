import assert from 'node:assert/strict';
import test, { describe, it } from 'node:test';
import { Box3, Color, Frustum, Group, Matrix4, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes';
import { WORLD } from '../src/core/config';
import type { ChunkPayload } from '../src/world/chunks/Chunk';
import {
  createUniversalLiquidMaterial,
  universalLiquidOrigin,
  updateUniversalLiquidOrigin,
  universalLiquidSkyZenith,
  universalLiquidSkyHorizon,
  updateUniversalLiquidSky,
  getWaveSpectrumForSolvent,
} from '../src/world/water/UniversalLiquidSystem';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';

describe('CICLO 3 / STABILITY-01B: Spatial Reference Frames, Floating Origin & Wave Invariance', () => {

  it('1. Decoupled Local ENU Presentation: Chunks outside Manaus use pure translation matrix', () => {
    const meshes = new ChunkMeshes();
    const mockPayload: ChunkPayload = {
      cx: 10,
      cz: -5,
      key: 'thalassa:megawave-ocean::10,-5',
      buildings: new Float32Array(0),
      trees: new Float32Array(0),
      land: false,
      biome: 'ocean',
    };

    // Outside Manaus
    ChunkMeshes.isLocalManausActive = false;
    const resOutside = meshes.create(mockPayload);
    const expectedX = 10 * WORLD.chunkSize;
    const expectedZ = -5 * WORLD.chunkSize;

    const elementsOutside = resOutside.group.matrix.elements;
    assert.equal(elementsOutside[12], expectedX, 'Matrix translateX matches ENU local coordinates');
    assert.equal(elementsOutside[13], 0, 'Matrix translateY is 0');
    assert.equal(elementsOutside[14], expectedZ, 'Matrix translateZ matches ENU local coordinates');
    assert.equal(elementsOutside[0], 1, 'Matrix is pure identity basis + translation');
    assert.equal(elementsOutside[5], 1);
    assert.equal(elementsOutside[10], 1);

    // Inside Manaus
    ChunkMeshes.isLocalManausActive = true;
    const resManaus = meshes.create(mockPayload);
    assert.ok(resManaus.group.matrix, 'Manaus chunk has matrix');
  });

  it('2. Gerstner Wave Phase Invariance: Floating origin rebase produces identical phase (zero jumping)', () => {
    const originA = new Vector3(0, 0, 0);
    const originB = new Vector3(2048, 0, 4096); // Rebase delta of [2048, 0, 4096]

    const playerWorldLogical = new Vector3(3500, 10, 5200);

    // Coordinate in render space before rebase
    const renderPosBefore = playerWorldLogical.clone().sub(originA); // (3500, 10, 5200)
    // Coordinate in render space after rebase
    const renderPosAfter = playerWorldLogical.clone().sub(originB);  // (1452, 10, 1104)

    // Verify stable position node invariant
    updateUniversalLiquidOrigin(originA);
    const stablePosBefore = renderPosBefore.clone().add(universalLiquidOrigin.value);

    updateUniversalLiquidOrigin(originB);
    const stablePosAfter = renderPosAfter.clone().add(universalLiquidOrigin.value);

    assert.equal(stablePosBefore.x, playerWorldLogical.x, 'Stable pos matches logical position before rebase');
    assert.equal(stablePosBefore.z, playerWorldLogical.z);
    assert.equal(stablePosAfter.x, playerWorldLogical.x, 'Stable pos matches logical position after rebase');
    assert.equal(stablePosAfter.z, playerWorldLogical.z);

    // Verify wave phase for all harmonics
    const waves = getWaveSpectrumForSolvent('terrestrial-ocean');
    const timeSec = 42.5;

    for (const w of waves) {
      const k = (2.0 * Math.PI) / w.wavelength;
      const c = Math.sqrt(9.80665 / k);

      // Phase before rebase
      const phaseBefore = (stablePosBefore.x * w.direction[0] + stablePosBefore.z * w.direction[1]) * k - timeSec * (w.speed * c);
      // Phase after rebase
      const phaseAfter = (stablePosAfter.x * w.direction[0] + stablePosAfter.z * w.direction[1]) * k - timeSec * (w.speed * c);

      assert.ok(Math.abs(phaseBefore - phaseAfter) < 1e-10, `Wave phase must be identical across floating origin rebase (diff=${Math.abs(phaseBefore - phaseAfter)})`);
    }
  });

  it('3. Open Ocean Wave Materials instantiate with valid PBR and TSL nodes', () => {
    const oceanMat = createUniversalLiquidMaterial('terrestrial-ocean');
    assert.ok(oceanMat, 'Terrestrial ocean material created');
    assert.ok(oceanMat.positionNode, 'Position node with Gerstner displacement attached');
    assert.ok(oceanMat.normalNode, 'Normal node with analytical Gerstner normal attached');
    assert.ok(oceanMat.colorNode, 'Color node with Beer-Lambert absorption attached');

    const megawaveMat = createUniversalLiquidMaterial('megawave-ocean');
    assert.ok(megawaveMat, 'Megawave ocean material created');
    assert.ok(megawaveMat.positionNode, 'Megawave position node attached');
  });

  it('4. Dynamic Sky Environmental Reflection updates correctly', () => {
    const zenithDay = new Color('#164e8a');
    const horizonDay = new Color('#6bb6e8');
    updateUniversalLiquidSky(zenithDay, horizonDay);
    assert.equal(universalLiquidSkyZenith.value.getHexString(), zenithDay.getHexString());
    assert.equal(universalLiquidSkyHorizon.value.getHexString(), horizonDay.getHexString());

    const zenithNight = new Color('#01030b');
    const horizonNight = new Color('#122a3f');
    updateUniversalLiquidSky(zenithNight, horizonNight);
    assert.equal(universalLiquidSkyZenith.value.getHexString(), zenithNight.getHexString());
    assert.equal(universalLiquidSkyHorizon.value.getHexString(), horizonNight.getHexString());
  });

  it('5. Hierarchical Frustum Culling remains accurate under floating origin rebase', async () => {
    const root = new Group();
    const streamer = new WorldStreamer(root);

    await streamer.prepare(new Vector3(0, 5, 0));
    assert.ok(streamer.activeKeys.size >= 9, 'Initial 3x3 chunks prepared');

    // Create camera viewing (0, 0, 0)
    const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 10, -50);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const vp = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const frustum = new Frustum();
    frustum.setFromProjectionMatrix(vp);

    const initialCull = streamer.cullFrustum(frustum, camera.position);
    assert.ok(initialCull.visible > 0, 'At least one chunk visible initially');

    // Rebase root by -2048m along X
    root.position.x -= 2048;
    root.updateMatrixWorld(true);

    // Camera also moves by -2048m in render space to view the same world location
    const cameraRebased = new PerspectiveCamera(60, 1, 0.1, 1000);
    cameraRebased.position.set(-2048, 10, -50);
    cameraRebased.lookAt(-2048, 0, 0);
    cameraRebased.updateMatrixWorld(true);

    const vpRebased = new Matrix4().multiplyMatrices(cameraRebased.projectionMatrix, cameraRebased.matrixWorldInverse);
    const frustumRebased = new Frustum();
    frustumRebased.setFromProjectionMatrix(vpRebased);

    const rebasedCull = streamer.cullFrustum(frustumRebased, cameraRebased.position);
    assert.equal(rebasedCull.visible, initialCull.visible, 'Culling result invariant across floating origin shift');

    streamer.dispose();
  });
});
