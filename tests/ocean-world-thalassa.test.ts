import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createUniversalLiquidMaterial,
  getWaveSpectrumForSolvent,
  sampleUniversalLiquid,
  FLUID_PRESETS,
  updateUniversalLiquidTime,
} from '../src/world/water/UniversalLiquidSystem';
import {
  THALASSA_OCEAN_WORLD,
  SOLAR_SYSTEM_BODIES,
  bodyById,
} from '../src/world/celestial/CelestialBody';
import { OfflineEphemeris } from '../src/world/celestial/OfflineEphemeris';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory';
import { BuildingGeneratorContext } from '../src/world/spatial/ActiveSurfaceOrigin';
import { generateChunk } from '../src/world/chunks/BuildingGenerator';
import { ChunkMeshes } from '../src/world/chunks/ChunkMeshes';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { UniverseCoordinates } from '../src/world/spatial/UniverseCoordinates';
import { ManausBathymetryService } from '../src/world/water/ManausBathymetry';

describe('UNIVERSAL-OCEAN: Planetary Oceans & Thalassa 500m Megawave Water World', () => {

  it('1. Terrestrial Ocean and Megawave Ocean presets & wave harmonics', () => {
    // Both fluid presets exist with physically calibrated properties
    assert.ok(FLUID_PRESETS['terrestrial-ocean'], 'terrestrial-ocean preset exists');
    assert.ok(FLUID_PRESETS['megawave-ocean'], 'megawave-ocean preset exists');

    assert.equal(FLUID_PRESETS['megawave-ocean'].densityKgM3, 1030);
    assert.equal(FLUID_PRESETS['megawave-ocean'].roughness, 0.05);

    // Spectrum for megawave-ocean: 4 Gerstner harmonics with exactly 250m amplitude (500m peak-to-trough)
    const waves = getWaveSpectrumForSolvent('megawave-ocean');
    assert.equal(waves.length, 4);

    const totalAmp = waves.reduce((sum, w) => sum + w.amplitude, 0);
    assert.equal(totalAmp, 250.0, 'Total amplitude is exactly 250m (yielding 500m peak-to-trough megawaves)');

    // Circling the planet eastward: wave direction X components are dominant positive
    for (const w of waves) {
      assert.ok(w.direction[0] > 0.7, `Wave direction eastward component ${w.direction[0]} > 0.7`);
    }

    // Material compilation
    const oceanMat = createUniversalLiquidMaterial('terrestrial-ocean');
    assert.ok(oceanMat, 'terrestrial-ocean material created');
    assert.ok(oceanMat.positionNode, 'ocean material has vertex displacement positionNode');
    assert.ok(oceanMat.normalNode, 'ocean material has analytical wave normalNode');

    const megaMat = createUniversalLiquidMaterial('megawave-ocean');
    assert.ok(megaMat, 'megawave-ocean material created');
    assert.ok(megaMat.positionNode, 'megawave material has vertex displacement positionNode');
    assert.ok(megaMat.normalNode, 'megawave material has analytical wave normalNode');
  });

  it('2. Thalassa Celestial Body in Solar System and Orbital Ephemeris', () => {
    assert.equal(THALASSA_OCEAN_WORLD.id, 'thalassa');
    assert.equal(THALASSA_OCEAN_WORLD.equatorialRadiusM, 6_200_000);
    assert.equal(THALASSA_OCEAN_WORLD.parentId, 'sun');

    // Registered in SOLAR_SYSTEM_BODIES
    const foundInSolar = SOLAR_SYSTEM_BODIES.find(b => b.id === 'thalassa');
    assert.ok(foundInSolar, 'Thalassa is in SOLAR_SYSTEM_BODIES');

    // bodyById resolves it
    const byId = bodyById('thalassa');
    assert.equal(byId?.id, 'thalassa');

    // Ephemeris provides orbital position at ~2.14 AU (~3.2e11 m from Sun)
    const ephemeris = new OfflineEphemeris();
    const sample = ephemeris.sample('thalassa', 0);
    assert.ok(sample, 'Thalassa has orbital sample');
    const distFromSun = Math.hypot(...sample.positionM);
    assert.ok(distFromSun > 3.0e11 && distFromSun < 3.4e11, `Thalassa distance ${distFromSun}m is at 2.14 AU`);
  });

  it('3. Procedural Surface of Thalassa is 100% Ocean (zero dry land, 0m relief)', () => {
    const surface = surfaceForBody(THALASSA_OCEAN_WORLD);
    assert.ok(surface, 'Thalassa has surface generator');

    // Sample across multiple directions on the sphere
    const directions: [number, number, number][] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [-0.577, 0.577, -0.577],
      [0.85, -0.15, 0.5],
    ];

    for (const dir of directions) {
      const h = surface.heightAt(dir);
      assert.equal(h, 0, `Relief on ocean world is strictly 0m at direction [${dir.join(', ')}]`);

      const col: [number, number, number] = [0, 0, 0];
      surface.colourAt(dir, col);
      // Deep sapphire ocean: blue component is dominant
      assert.ok(col[2] > col[0] && col[2] > col[1], `Ocean surface color is sapphire blue: RGB(${col.join(', ')})`);
    }
  });

  it('4. BuildingGenerator and ChunkMeshes on Thalassa generate pure ocean chunks', () => {
    BuildingGeneratorContext.activeOrigin = {
      latDeg: 0,
      lonDeg: 0,
      isManaus: false,
      bodyId: 'thalassa',
    };

    // Chunks generated on Thalassa must be 100% water with 0 trees and 0 buildings
    const chunk0 = generateChunk(0, 0);
    assert.equal(chunk0.land, false);
    assert.equal(chunk0.biome, 'ocean');
    assert.equal(chunk0.buildings.length, 0);
    assert.equal(chunk0.trees.length, 0);

    const chunk1 = generateChunk(5, -3);
    assert.equal(chunk1.land, false);
    assert.equal(chunk1.biome, 'ocean');
    assert.equal(chunk1.buildings.length, 0);
    assert.equal(chunk1.trees.length, 0);

    // ChunkMeshes instantiates ocean-surface with megawave geometry
    ChunkMeshes.isLocalManausActive = false;
    ChunkMeshes.activeSolvent = 'megawave-ocean';
    const meshes = new ChunkMeshes();
    const built = meshes.create(chunk0);
    const oceanMesh = built.group.children.find(c => c.name === 'ocean-surface');
    assert.ok(oceanMesh, 'Chunk has ocean-surface mesh');
  });

  it('5. UniversalTargetCatalog and drm:v1 URI Map Teleportation for Thalassa', () => {
    const catalog = new UniversalTargetCatalog();
    const thalassaTarget = catalog.find('thalassa') ?? catalog.descriptors.find(d => d.bodyId === 'thalassa');
    assert.ok(thalassaTarget, 'Thalassa is registered in UniversalTargetCatalog');
    assert.equal(thalassaTarget.bodyId, 'thalassa');

    // Parse the exact URI bound to the Map Panel button
    const mapUri = 'drm:v1://?kind=surface&gal=milky_way&sys=sol&body=thalassa&lat=0&lon=0&alt=250';
    const parsed = UniverseCoordinates.parse(mapUri);
    assert.ok(parsed, 'URI parses successfully');
    assert.equal(parsed.kind, 'surface-geodetic');
    if (parsed.kind === 'surface-geodetic') {
      assert.equal(parsed.bodyId, 'thalassa');
      assert.equal(parsed.altitudeM, 250);
      assert.equal(parsed.latDeg, 0);
      assert.equal(parsed.lonDeg, 0);
    }
  });

  it('6. ManausBathymetry and CPU Hydrology sample 500m Megawaves on Thalassa', () => {
    BuildingGeneratorContext.activeOrigin.bodyId = 'thalassa';
    const bathymetry = new ManausBathymetryService();

    assert.equal(bathymetry.isWater(0, 0), true);
    assert.equal(bathymetry.isWater(1000, 2000), true);
    assert.equal(bathymetry.sampleRiverbedHeight(0, 0), -4000.0, 'Abyssal depth is -4000m');

    // Sample wave crests and troughs over time and space
    let minWaveY = Infinity;
    let maxWaveY = -Infinity;

    for (let t = 0; t < 60; t += 5) {
      for (let x = 0; x < 5000; x += 500) {
        const y = bathymetry.sampleWaterSurface(x, 0, t);
        if (y < minWaveY) minWaveY = y;
        if (y > maxWaveY) maxWaveY = y;
      }
    }

    const peakToTrough = maxWaveY - minWaveY;
    assert.ok(peakToTrough > 400.0, `Peak to trough wave height is colossal: ${peakToTrough.toFixed(1)}m (target 500m)`);
    assert.ok(maxWaveY > 200.0, `Wave crest reaches > +200m: ${maxWaveY.toFixed(1)}m`);
    assert.ok(minWaveY < -200.0, `Wave trough reaches < -200m: ${minWaveY.toFixed(1)}m`);

    // Restore context for other tests
    BuildingGeneratorContext.activeOrigin = {
      latDeg: -3.1303,
      lonDeg: -60.0234,
      isManaus: true,
      bodyId: 'earth',
    };
    ChunkMeshes.isLocalManausActive = true;
    ChunkMeshes.activeSolvent = 'terrestrial-ocean';
  });
});
