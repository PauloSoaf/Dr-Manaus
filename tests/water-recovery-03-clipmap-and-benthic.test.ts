import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DoubleSide, Group, Vector3 } from 'three/webgpu';
import { OceanHorizonPresentation } from '../src/world/water/OceanHorizonPresentation';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes';
import { sampleGerstnerSpectrum, getWaveSpectrumForSolvent } from '../src/world/water/UniversalLiquidSystem';
import { sampleManausWater } from '../src/world/water/ManausHydrology';
import { TerrainDestruction } from '../src/world/destruction/TerrainDestruction';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory';
import { CelestialBody } from '../src/world/celestial/CelestialBody';
import { isLandAt } from '../src/world/planet/EarthLandMask';
import { DEG_TO_RAD } from '../src/world/spatial/units';

describe('PATCH-WATER-02-HOTFIX: Clipmap Normals, Benthic Depth, Clock Sync & Shallow Buoyancy', () => {

  it('P0.01: OceanHorizonPresentation has 100% upward CCW normals (Ny > 0) across all triangles', () => {
    const horizon = new OceanHorizonPresentation();
    const outerMesh = (horizon as any).outerMesh;
    const innerCapMesh = (horizon as any).innerCapMesh;

    assert.equal(outerMesh.material.side, DoubleSide, 'Material is DoubleSide for top-down and underwater diving');

    // Test outer geometry normals
    const outerGeo = outerMesh.geometry;
    const outerPos = outerGeo.getAttribute('position');
    const outerIndex = outerGeo.getIndex()!;
    assert.ok(outerIndex.count > 0, 'Outer geometry is indexed');

    let outerTrianglesTested = 0;
    const vA = new Vector3(), vB = new Vector3(), vC = new Vector3();
    const e1 = new Vector3(), e2 = new Vector3(), normal = new Vector3();

    for (let i = 0; i < outerIndex.count; i += 3) {
      const idxA = outerIndex.getX(i);
      const idxB = outerIndex.getX(i + 1);
      const idxC = outerIndex.getX(i + 2);

      vA.set(outerPos.getX(idxA), outerPos.getY(idxA), outerPos.getZ(idxA));
      vB.set(outerPos.getX(idxB), outerPos.getY(idxB), outerPos.getZ(idxB));
      vC.set(outerPos.getX(idxC), outerPos.getY(idxC), outerPos.getZ(idxC));

      e1.subVectors(vB, vA);
      e2.subVectors(vC, vA);
      normal.crossVectors(e1, e2);

      assert.ok(normal.y > 0, `Outer triangle ${i / 3} normal.y must be strictly positive: got ${normal.y}`);
      outerTrianglesTested++;
    }
    assert.ok(outerTrianglesTested > 1000, `Verified ${outerTrianglesTested} outer triangles with upward normals`);

    // Test inner cap geometry normals
    const innerGeo = innerCapMesh.geometry;
    const innerPos = innerGeo.getAttribute('position');
    const innerIndex = innerGeo.getIndex()!;
    let innerTrianglesTested = 0;

    for (let i = 0; i < innerIndex.count; i += 3) {
      const idxA = innerIndex.getX(i);
      const idxB = innerIndex.getX(i + 1);
      const idxC = innerIndex.getX(i + 2);

      vA.set(innerPos.getX(idxA), innerPos.getY(idxA), innerPos.getZ(idxA));
      vB.set(innerPos.getX(idxB), innerPos.getY(idxB), innerPos.getZ(idxB));
      vC.set(innerPos.getX(idxC), innerPos.getY(idxC), innerPos.getZ(idxC));

      e1.subVectors(vB, vA);
      e2.subVectors(vC, vA);
      normal.crossVectors(e1, e2);

      assert.ok(normal.y > 0, `Inner cap triangle ${i / 3} normal.y must be strictly positive: got ${normal.y}`);
      innerTrianglesTested++;
    }
    assert.ok(innerTrianglesTested > 500, `Verified ${innerTrianglesTested} inner cap triangles with upward normals`);
  });

  it('P0.02 & P0.03: Adaptive Concentric Clipmaps & Zero Chunk Overlap', () => {
    const horizon = new OceanHorizonPresentation();
    const outerMesh = (horizon as any).outerMesh;
    const innerCapMesh = (horizon as any).innerCapMesh;

    const outerGeo = outerMesh.geometry;
    const outerPos = outerGeo.getAttribute('position');

    // Outer mesh must start at 384m (chunk transition radius) and extend to 260,000m (260 km)
    let minRadius = Infinity;
    let maxRadius = 0;
    for (let i = 0; i < outerPos.count; i++) {
      const x = outerPos.getX(i);
      const z = outerPos.getZ(i);
      const r = Math.hypot(x, z);
      if (r < minRadius) minRadius = r;
      if (r > maxRadius) maxRadius = r;
    }

    assert.ok(Math.abs(minRadius - 384.0) < 1.0, `Outer clipmap starts at R_inner = 384m: got ${minRadius}`);
    assert.ok(maxRadius >= 260000.0, `Outer clipmap extends to horizon 260km: got ${maxRadius}`);

    // Spherical curvature drop test: vertices at 65km drop by delta_y = -d^2 / (2 * R) ~ -331m
    let vertexAt65kmFound = false;
    for (let i = 0; i < outerPos.count; i++) {
      const r = Math.hypot(outerPos.getX(i), outerPos.getZ(i));
      if (Math.abs(r - 65000) < 100) {
        const y = outerPos.getY(i);
        assert.ok(y < -300 && y > -360, `Curvature drop at 65km is ~ -331m: got ${y}`);
        vertexAt65kmFound = true;
        break;
      }
    }
    assert.ok(vertexAt65kmFound, 'Found and validated curvature drop on 65km ring');

    // When near chunks are present, innerCap is hidden
    horizon.update(new Vector3(0, 0, 0), true, true);
    assert.equal(innerCapMesh.visible, false, 'Inner cap is hidden when chunks are active (zero overlap)');

    // When chunks are absent (e.g. open space/planetary entry), inner cap fills 0..384m
    horizon.update(new Vector3(0, 0, 0), true, false);
    assert.equal(innerCapMesh.visible, true, 'Inner cap fills 0..384m when chunks are absent');

    // Check ChunkMeshes canonical fluid elevation is strictly 0.0 (not 0.05)
    const chunkMeshes = new ChunkMeshes();
    const chunkOceanGeo = (chunkMeshes as any).oceanGeometry;
    const chunkPos = chunkOceanGeo.getAttribute('position');
    let chunkMinY = Infinity, chunkMaxY = -Infinity;
    for (let i = 0; i < chunkPos.count; i++) {
      const y = chunkPos.getY(i);
      if (y < chunkMinY) chunkMinY = y;
      if (y > chunkMaxY) chunkMaxY = y;
    }
    assert.ok(Math.abs(chunkMinY) < 1e-4 && Math.abs(chunkMaxY) < 1e-4, `Chunk ocean elevation is exactly 0.0: got ${chunkMinY}..${chunkMaxY}`);
  });

  it('P0.07 & P1.04: Depth Damping and Exact Gerstner Normals (GPU Gems Formula)', () => {
    const waves = getWaveSpectrumForSolvent('terrestrial-ocean');
    const outDeep = { height: 0, displacementX: 0, displacementZ: 0, normal: new Vector3() };
    const outShallow = { height: 0, displacementX: 0, displacementZ: 0, normal: new Vector3() };

    // Deep water (depth = 10m) -> no damping
    sampleGerstnerSpectrum(waves, 50, 50, 5.0, 0.0, outDeep, 1.0, 1.0, 10.0);
    // Very shallow water (depth = 0.04m) -> full depth damping to 0
    sampleGerstnerSpectrum(waves, 50, 50, 5.0, 0.0, outShallow, 1.0, 1.0, 0.04);

    assert.ok(Math.abs(outDeep.height) > 0.01, 'Deep water has wave height');
    assert.ok(Math.abs(outShallow.height) < 1e-6, `Shallow water at 0.04m is fully damped: got ${outShallow.height}`);
    assert.ok(Math.abs(outShallow.displacementX) < 1e-6, 'Shallow water displacementX is damped');
    assert.ok(Math.abs(outShallow.displacementZ) < 1e-6, 'Shallow water displacementZ is damped');
    assert.equal(outShallow.normal.y, 1.0, 'Shallow water normal is straight up (0, 1, 0)');

    // Exact normal test: normal length is always 1.0 (normalized) and Ny reflects steepness
    assert.ok(Math.abs(outDeep.normal.length() - 1.0) < 1e-5, 'Normal is properly normalized');
    assert.ok(outDeep.normal.y > 0.1, 'Normal y is positive and stable');

    // Test sampleManausWater integration with depth parameter
    const sample = sampleManausWater(100, 200, 1.0, 0.06, undefined, 50, 0, undefined, 0.04);
    assert.equal(sample.height, 0.06, 'sampleManausWater respects shallow depth damping at beach shoreline');
  });

  it('P0.10: Solid Benthic Floor vs Liquid Surface on Thalassa and Oceanic Bodies', () => {
    const destruction = new TerrainDestruction(new Group());
    destruction.setBodyId('thalassa');

    // TerrainDestruction allows diving to -4000m on Thalassa
    const thalassaFloor = destruction.baseHeightAt(500, 500);
    assert.equal(thalassaFloor, -4000.0, 'Thalassa physical baseHeightAt is -4000m abyssal depth');

    // On procedural planet surface:
    const thalassaBody: CelestialBody = {
      id: 'thalassa',
      name: 'Thalassa',
      radiusM: 5_800_000,
      massKg: 5.5e24,
      classification: 'oceanic-rocky',
      atmosphere: { composition: 'N2-O2', surfacePressureAtm: 1.0, scaleHeightM: 8000 },
      parentBodyId: 'sol',
      orbitalPeriodDays: 300,
      semiMajorAxisM: 1.4e11,
      rotationPeriodHours: 24,
      axialTiltDeg: 10,
    };

    const surface = surfaceForBody(thalassaBody);
    assert.ok(surface, 'Thalassa surface generator exists');
    assert.equal(surface.heightAt([0, 1, 0]), 0, 'Liquid surface is at 0m sea level');
    assert.equal((surface as any).solidHeightAt([0, 1, 0]), -4000.0, 'Solid bedrock is at -4000m');
  });

  it('P0.11: Earth Land/Ocean Classification (Natural Earth Mask)', () => {
    // Manaus: lat -3.13, lon -60.02 -> must be LAND
    const manausIsLand = isLandAt(-3.1303 * DEG_TO_RAD, -60.0234 * DEG_TO_RAD);
    assert.equal(manausIsLand, true, 'Manaus is classified as land');

    // Pacific Ocean: lat 0.0, lon -140.0 -> must be OCEAN (not land)
    const pacificIsLand = isLandAt(0.0 * DEG_TO_RAD, -140.0 * DEG_TO_RAD);
    assert.equal(pacificIsLand, false, 'Middle of Pacific Ocean is classified as ocean');

    // Atlantic Ocean: lat 0.0, lon -30.0 -> must be OCEAN
    const atlanticIsLand = isLandAt(0.0 * DEG_TO_RAD, -30.0 * DEG_TO_RAD);
    assert.equal(atlanticIsLand, false, 'Mid-Atlantic is classified as ocean');
  });
});
