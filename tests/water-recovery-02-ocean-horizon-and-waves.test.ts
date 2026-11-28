import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Box3, Color, Frustum, Group, Matrix4, PerspectiveCamera, Vector3 } from 'three/webgpu';
import {
  createUniversalLiquidMaterial,
  sampleGerstnerSpectrum,
  getWaveSpectrumForSolvent,
  updateUniversalLiquidOrigin,
  universalLiquidOrigin,
  universalLiquidTime,
  updateUniversalLiquidTime,
  universalLiquidSunDirection,
  universalLiquidSunIntensity,
  updateUniversalLiquidSun,
  universalLiquidSkyZenith,
  universalLiquidSkyHorizon,
  updateUniversalLiquidSky,
  FLUID_PRESETS,
} from '../src/world/water/UniversalLiquidSystem';
import { OceanHorizonPresentation } from '../src/world/water/OceanHorizonPresentation';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes';
import { WORLD } from '../src/core/config';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory';
import { CelestialBody } from '../src/world/celestial/CelestialBody';
import { ManausBathymetryService } from '../src/world/water/ManausBathymetry';
import { BuildingGeneratorContext } from '../src/world/chunks/BuildingGenerator';

describe('CICLO 2..8: Ocean Horizon Continuity, 3D Gerstner, Culling & Thalassa Seabed', () => {

  it('1. Ocean Horizon Presentation: Spans 65km continuously and tracks camera horizontally', () => {
    const horizon = new OceanHorizonPresentation();
    assert.ok(horizon.group instanceof Group, 'Horizon group exists');
    assert.ok(horizon.group.children.length > 0, 'Contains horizon disc mesh');

    const mesh = horizon.group.children[0] as any;
    assert.equal(mesh.frustumCulled, false, 'Ocean horizon is never culled by camera frustum');

    const geo = mesh.geometry;
    const posAttr = geo.getAttribute('position');
    assert.ok(posAttr.count > 500, 'Has sufficient radial resolution');

    // Check maximum radius: must reach 65,000m (65 km horizon)
    let maxDist = 0;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const d = Math.hypot(x, z);
      if (d > maxDist) maxDist = d;
    }
    assert.ok(maxDist >= 65000, `Max radius reaches horizon: ${maxDist} >= 65000`);

    // Check shore attribute: must be 1.0 (open ocean)
    const shoreAttr = geo.getAttribute('shore');
    assert.ok(shoreAttr, 'Ocean horizon geometry has shore attribute');
    assert.equal(shoreAttr.getX(0), 1.0);
    assert.equal(shoreAttr.getX(posAttr.count - 1), 1.0);

    // Follow camera position with grid snapping (Crest clipmap grid snapping within 16m)
    const camPos = new Vector3(12500, 45, -34200);
    horizon.update(camPos, true);
    assert.ok(Math.abs(mesh.position.x - 12500) <= 16, 'Tracks camera X within grid snap');
    assert.equal(mesh.position.y, 0);
    assert.ok(Math.abs(mesh.position.z - (-34200)) <= 16, 'Tracks camera Z within grid snap');
    assert.equal(horizon.group.visible, true);

    // Turn off when not over ocean
    horizon.update(camPos, false);
    assert.equal(horizon.group.visible, false);
  });

  it('2. 3D Gerstner GPU Displacement: Material node graph includes trocoidal X and Z displacement', () => {
    const matOcean = createUniversalLiquidMaterial('terrestrial-ocean');
    assert.ok(matOcean.positionNode, 'Material has positionNode');

    const matMega = createUniversalLiquidMaterial('megawave-ocean');
    assert.ok(matMega.positionNode, 'Megawave material has positionNode');

    // Verify CPU sampleGerstnerSpectrum produces horizontal trocoidal displacement
    const waves = getWaveSpectrumForSolvent('megawave-ocean');
    const out = { height: 0, displacementX: 0, displacementZ: 0, normal: new Vector3() };
    sampleGerstnerSpectrum(waves, 100, 200, 10.0, 0, out);

    assert.ok(Math.abs(out.displacementX) > 0.01, 'displacementX is calculated');
    assert.ok(Math.abs(out.displacementZ) > 0.01, 'displacementZ is calculated');
    assert.ok(Math.abs(out.height) > 0.01, 'height is calculated');
  });

  it('3. Dynamic Wave Bounding Box Culling: Megawaves chunk bounding box encompasses full amplitude (+/- 350m)', () => {
    const root = new Group();
    const streamer = new WorldStreamer(root);

    // Mock a megawave context
    streamer.setRegion({
      bodyId: 'thalassa',
      latDeg: 0,
      lonDeg: 0,
      isManaus: false,
      surfaceType: 'megawave-ocean',
    });

    ChunkMeshes.activeSolvent = 'megawave-ocean';

    // Build mock active chunk
    const key = 'thalassa:megawave-ocean::0,0';
    (streamer as any).active.add(key);
    const mockGroup = new Group();
    mockGroup.matrix.makeTranslation(0, 0, 0);
    mockGroup.matrixWorld.copy(mockGroup.matrix);
    (streamer as any).records.set(key, { key, group: mockGroup, state: 3 });

    // Cull with camera looking at a deep wave trough (y = -180m)
    const camera = new PerspectiveCamera(60, 1, 1, 2000);
    camera.position.set(64, -180, -100);
    camera.lookAt(64, -180, 64);
    camera.updateMatrixWorld();
    const frustum = new Frustum();
    frustum.setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );

    const stats = streamer.cullFrustum(frustum, camera.position, 10);
    assert.equal(stats.visible, 1, 'Megawave chunk is NOT culled when camera looks at wave trough');
    assert.equal(mockGroup.visible, true);
  });

  it('4. Thalassa Bathymetry & Planet Surface: Seabed is -4000m abyssal, sea level relief is 0m', () => {
    const thalassaBody: CelestialBody = {
      id: 'thalassa',
      name: 'Thalassa',
      radiusM: 6_800_000,
      massKg: 6.2e24,
      classification: 'oceanic-rocky',
      atmosphere: { composition: 'N2-O2', surfacePressureAtm: 1.2, scaleHeightM: 8500 },
      parentBodyId: 'sol',
      orbitalPeriodDays: 320,
      semiMajorAxisM: 1.5e11,
      rotationPeriodHours: 28,
      axialTiltDeg: 12,
    };

    const surface = surfaceForBody(thalassaBody);
    assert.ok(surface, 'Thalassa surface generator is defined');
    const sampleDir: [number, number, number] = [0, 1, 0];
    const seaLevelRelief = surface.heightAt(sampleDir);
    assert.equal(seaLevelRelief, 0, 'Thalassa sea level relief is strictly 0m (liquid sphere at radius R)');

    // Fluid column bathymetry: abyssal seabed at -4000m
    const bathymetry = new ManausBathymetryService();
    BuildingGeneratorContext.activeOrigin = { bodyId: 'thalassa', latDeg: 0, lonDeg: 0, isManaus: false };
    const seabedY = bathymetry.sampleRiverbedHeight(100, 200);
    assert.equal(seabedY, -4000.0, 'Thalassa physical seabed is -4000m abyssal depth');
  });

  it('5. Realistic Ocean Presets: Natural deep indigo and marine teal, avoiding glowing neon pool cyan', () => {
    const oceanPreset = FLUID_PRESETS['terrestrial-ocean'];
    assert.equal(oceanPreset.deepColor, '#03162c', 'Deep ocean is dark indigo/navy');
    assert.equal(oceanPreset.shallowColor, '#0b4c6b', 'Shallow ocean is marine teal, not #00b4d8 neon cyan');

    const megawavePreset = FLUID_PRESETS['megawave-ocean'];
    assert.equal(megawavePreset.deepColor, '#021020');
    assert.equal(megawavePreset.shallowColor, '#073c54');
  });

  it('6. Dynamic Sun and Sky Uniforms: Fades in night/space environment', () => {
    const sunDir = new Vector3(0.5, 0.8, 0.2);
    updateUniversalLiquidSun(sunDir, 1.0);
    assert.ok(Math.abs(universalLiquidSunDirection.value.x - sunDir.clone().normalize().x) < 1e-4);
    assert.equal(universalLiquidSunIntensity.value, 1.0);

    // Night / space
    updateUniversalLiquidSun(sunDir, 0.0);
    assert.equal(universalLiquidSunIntensity.value, 0.0);

    // Space vacuum sky
    const darkZenith = new Color('#010206');
    const darkHorizon = new Color('#010206');
    updateUniversalLiquidSky(darkZenith, darkHorizon);
    assert.equal(universalLiquidSkyZenith.value.getHexString(), '010206');
    assert.equal(universalLiquidSkyHorizon.value.getHexString(), '010206');
  });
});
