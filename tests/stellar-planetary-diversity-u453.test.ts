import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera } from 'three/webgpu';
import {
  generateSystem,
  generatedStarRadiusM,
  stellarAlbedo,
  stellarSolarGlow,
  describeSpectralClass,
  calculateEquilibriumTemperatureK,
  calculateSurfaceGravityMps2,
} from '../src/world/celestial/SystemGenerator';
import {
  bodyProfile,
  SOLAR_BODY_PROFILES,
  supportsLanding,
  type WorldClassification,
} from '../src/world/celestial/CelestialBodyProfile';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory';
import { ProceduralSystemMaterializer, type SystemResources } from '../src/world/runtime/ProceduralSystemMaterializer';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer';
import { renderUniversalTargetCardHtml } from '../src/ui/map/UniversalMapPanel';
import { CosmicAtlasModel } from '../src/world/exploration/CosmicAtlasModel';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { generateStarSector } from '../src/world/celestial/StarSector';

test('T_U453_01_STELLAR_DIVERSITY', () => {
  // Test spectral chromaticity (O to M)
  const oAlbedo = stellarAlbedo(35000, 'O');
  const bAlbedo = stellarAlbedo(18000, 'B');
  const aAlbedo = stellarAlbedo(8500, 'A');
  const fAlbedo = stellarAlbedo(6800, 'F');
  const gAlbedo = stellarAlbedo(5772, 'G');
  const kAlbedo = stellarAlbedo(4400, 'K');
  const mAlbedo = stellarAlbedo(3000, 'M');

  // Blue-white for hot stars, deep red for cool stars
  assert.ok(oAlbedo[2] > oAlbedo[0], 'O-type star must be blue-dominated');
  assert.ok(bAlbedo[2] > bAlbedo[0], 'B-type star must be blue-dominated');
  assert.ok(mAlbedo[0] > mAlbedo[2], 'M-type star must be red-dominated');
  assert.ok(kAlbedo[0] > kAlbedo[2], 'K-type star must be orange-dominated');

  // Corona / solar glow scaling
  const oGlow = stellarSolarGlow('O', 20000);
  const gGlow = stellarSolarGlow('G', 1.0);
  const mGlow = stellarSolarGlow('M', 0.001);

  assert.ok(oGlow.outerScale > gGlow.outerScale, 'O star corona must exceed Solar scale');
  assert.ok(gGlow.outerScale > mGlow.outerScale, 'Solar corona must exceed M dwarf scale');

  // Descriptive text
  assert.ok(describeSpectralClass('O', 35000, 20000).includes('Supergigante'));
  assert.ok(describeSpectralClass('G', 5772, 1.0).includes('anã amarela'));
  assert.ok(describeSpectralClass('M', 3000, 0.001).includes('Anã vermelha'));
});

test('T_U453_02_PLANETARY_ENVIRONMENT_TAXONOMY_AND_DIVERSITY', () => {
  const foundClassifications = new Set<WorldClassification>();
  let solidWorldCount = 0;
  let fluidWorldCount = 0;

  // Survey several procedural systems across different seeds
  for (let s = 1; s <= 20; s++) {
    const seed = BigInt(s) * 0x7f4a_7c15n + 0x1234n;
    const system = generateSystem(`star-${s}`, seed, {
      id: `star-${s}`,
      offsetM: [0, 0, 0],
      massSolar: 1.0 + (s % 5) * 0.3,
      temperatureK: 4000 + (s % 7) * 800,
      luminositySolar: 0.5 + (s % 4) * 1.2,
      spectralClass: 'G',
      planetCount: 8,
    });

    for (const body of system.bodies) {
      const p = bodyProfile(body);
      if (p.environment) {
        foundClassifications.add(p.environment.classification);
      }
      if (p.bodyClass !== 'star') {
        if (p.hasSolidSurface) {
          solidWorldCount++;
          assert.equal(p.canLand, true, 'Solid worlds must be landable');
          assert.equal(p.landingMode, 'surface');
          assert.equal(p.supportsVolumeDestruction, false);
          assert.ok(surfaceForBody(body), 'Solid body must have valid surface generator');
        } else {
          fluidWorldCount++;
          assert.equal(p.canLand, false, 'Gas/ice giants must not be landable');
          assert.equal(p.landingMode, 'none');
          assert.equal(surfaceForBody(body), undefined, 'Gas/ice giants must not have surface generator');
        }
      }
    }
  }

  assert.ok(solidWorldCount > 0, 'Must generate solid worlds');
  assert.ok(fluidWorldCount > 0, 'Must generate fluid giant worlds');

  // Ensure variety of classifications was produced
  assert.ok(foundClassifications.has('star'), 'Must classify stars');
  assert.ok(foundClassifications.has('gas-giant') || foundClassifications.has('ice-giant'), 'Must classify giants');
  assert.ok(
    foundClassifications.has('arid-rocky') ||
    foundClassifications.has('frozen-rocky') ||
    foundClassifications.has('volcanic-rocky') ||
    foundClassifications.has('oceanic-rocky') ||
    foundClassifications.has('dense-atmosphere-rocky'),
    'Must classify distinct terrestrial worlds',
  );
});

test('T_U453_03_EQUILIBRIUM_TEMPERATURE_PHYSICS', () => {
  const starTemp = 5772;
  const starRadius = 6.957e8;

  // Temperature must monotonically decrease with orbital distance
  const d1 = 6e10; // close (Mercury-like)
  const d2 = 1.5e11; // 1 AU (Earth-like)
  const d3 = 7.5e11; // 5 AU (Jupiter-like)
  const d4 = 4.5e12; // 30 AU (Neptune-like)

  const t1 = calculateEquilibriumTemperatureK(starTemp, starRadius, d1);
  const t2 = calculateEquilibriumTemperatureK(starTemp, starRadius, d2);
  const t3 = calculateEquilibriumTemperatureK(starTemp, starRadius, d3);
  const t4 = calculateEquilibriumTemperatureK(starTemp, starRadius, d4);

  assert.ok(t1 > t2, `Inner orbit (${t1}K) must be hotter than 1 AU (${t2}K)`);
  assert.ok(t2 > t3, `1 AU (${t2}K) must be hotter than 5 AU (${t3}K)`);
  assert.ok(t3 > t4, `5 AU (${t3}K) must be hotter than 30 AU (${t4}K)`);

  assert.ok(t1 > 350, 'Inner orbit must exceed 350K');
  assert.ok(t2 >= 200 && t2 <= 320, '1 AU orbit must be in temperate range');
  assert.ok(t4 < 100, '30 AU orbit must be cryogenic (< 100K)');
});

test('T_U453_04_SURFACE_GRAVITY_COMPUTATION', () => {
  // Earth-like body: M ~ 5.972e24 kg, R ~ 6.371e6 m
  const gEarth = calculateSurfaceGravityMps2(5.972e24, 6.371e6);
  assert.ok(Math.abs(gEarth - 9.81) < 0.1, `Earth gravity should be ~9.81 m/s², got ${gEarth}`);

  // Moon-like body: M ~ 7.342e22 kg, R ~ 1.737e6 m
  const gMoon = calculateSurfaceGravityMps2(7.342e22, 1.737e6);
  assert.ok(Math.abs(gMoon - 1.62) < 0.1, `Moon gravity should be ~1.62 m/s², got ${gMoon}`);

  // Degenerate inputs safely return 0
  assert.equal(calculateSurfaceGravityMps2(0, 1e6), 0);
  assert.equal(calculateSurfaceGravityMps2(1e24, 0), 0);
});

test('T_U453_05_OPTICAL_ATMOSPHERIC_HAZE_AND_BANDS', () => {
  const seed = 0x8899_aabb_ccddn;
  const system = generateSystem('test-star', seed, {
    id: 'test-star',
    offsetM: [0, 0, 0],
    massSolar: 1.1,
    temperatureK: 6000,
    luminositySolar: 1.3,
    spectralClass: 'G',
    planetCount: 9,
  });

  for (const body of system.bodies) {
    const p = bodyProfile(body);
    if (p.bodyClass === 'star') continue;

    // Check optical haze bounds
    if (p.visual.haze) {
      assert.ok(p.visual.haze.radiusScale >= 1.02, 'Haze must extend beyond planet radius');
      assert.ok(p.visual.haze.strength > 0 && p.visual.haze.strength <= 1.0, 'Haze strength must be in (0, 1]');
    }

    // Check cloud bands bounds
    if (p.visual.bands !== undefined) {
      assert.ok(p.visual.bands >= 4 && p.visual.bands <= 32, 'Cloud bands must be reasonable integer count');
    }
  }
});

test('T_U453_06_PLANETARY_RINGS_CONSTRAINTS', () => {
  let foundRings = 0;

  for (let s = 1; s <= 30; s++) {
    const system = generateSystem(`ring-star-${s}`, BigInt(s) * 0x9988n, {
      id: `ring-star-${s}`,
      offsetM: [0, 0, 0],
      massSolar: 1.0,
      temperatureK: 5772,
      luminositySolar: 1.0,
      spectralClass: 'G',
      planetCount: 6,
    });

    for (const body of system.bodies) {
      const p = bodyProfile(body);
      if (p.visual.rings) {
        foundRings++;
        assert.ok(p.visual.rings.innerRadius > 1.0, 'Rings inner radius must be outside surface quad (> 1.0)');
        assert.ok(p.visual.rings.outerRadius > p.visual.rings.innerRadius, 'Rings outer radius must exceed inner');
        assert.ok(p.visual.rings.outerRadius <= 3.5, 'Rings outer radius must stay within reasonable bounds');
      }
    }
  }

  assert.ok(foundRings > 0, 'Procedural generation must produce planetary rings on eligible giants');
});

test('T_U453_07_STABLE_SEEDED_DETERMINISM', () => {
  const seed = 0xcafe_babe_dead_beefn;
  const star = {
    id: 'det-star',
    offsetM: [0, 0, 0] as [number, number, number],
    massSolar: 1.2,
    temperatureK: 6200,
    luminositySolar: 1.8,
    spectralClass: 'F' as const,
    planetCount: 7,
  };

  const baseline = generateSystem('det-star', seed, star);

  for (let iter = 0; iter < 50; iter++) {
    const copy = generateSystem('det-star', seed, star);
    assert.deepEqual(copy.bodies.map(b => b.id), baseline.bodies.map(b => b.id));
    assert.deepEqual(copy.bodies.map(b => b.equatorialRadiusM), baseline.bodies.map(b => b.equatorialRadiusM));
    assert.deepEqual(copy.bodies.map(b => b.massKg), baseline.bodies.map(b => b.massKg));
    assert.deepEqual(copy.bodies.map(b => b.orbit?.semiMajorAxisM), baseline.bodies.map(b => b.orbit?.semiMajorAxisM));
    assert.deepEqual(copy.bodies.map(b => bodyProfile(b)), baseline.bodies.map(b => bodyProfile(b)));
  }
});

test('T_U453_08_BACKWARDS_COMPATIBILITY_AND_LANDING_POLICY', () => {
  const seed = 0x55aa_1122n;
  const system = generateSystem('compat-star', seed, {
    id: 'compat-star',
    offsetM: [0, 0, 0],
    massSolar: 0.9,
    temperatureK: 5200,
    luminositySolar: 0.7,
    spectralClass: 'K',
    planetCount: 5,
  });

  // Verify ProceduralSystemMaterializer capability requirements
  for (const b of system.bodies) {
    const p = bodyProfile(b);
    assert.equal(p.supportsVolumeDestruction, false, 'Procedural bodies must have supportsVolumeDestruction === false');
    assert.equal(p.canLand === p.hasSolidSurface, true, 'canLand must match hasSolidSurface');

    if (p.canLand) {
      assert.equal(supportsLanding(p), 'surface');
    } else {
      assert.equal(supportsLanding(p), 'none');
    }
  }

  // Canonical Sun has landingMode 'photosphere'
  assert.equal(supportsLanding(SOLAR_BODY_PROFILES.sun), 'photosphere');
});

test('T_U453_09_VISUAL_LAYER_GPU_DISPOSE_AND_LOD', () => {
  const seed = 0x1122_3344n;
  const system = generateSystem('gpu-star', seed, {
    id: 'gpu-star',
    offsetM: [0, 0, 0],
    massSolar: 1.0,
    temperatureK: 5772,
    luminositySolar: 1.0,
    spectralClass: 'G',
    planetCount: 6,
  });

  const parent = new Group();
  const visualLayer = new CelestialBodyVisualLayer(parent, system.bodies);

  assert.ok(visualLayer.stats.planets > 0, 'Visual layer must track created planet visuals');

  const camera = new PerspectiveCamera(60, 1, 0.1, 1e8);
  const samples = system.bodies.map(b => ({
    bodyId: b.id,
    profile: bodyProfile(b),
    stellar: b.stellar,
    visible: true,
    opacity: 1,
    logicalDistanceM: 1e11,
    physicalRadiusM: b.equatorialRadiusM,
    angularRadiusRad: 0.005,
    directionRender: [0, 0, -1] as [number, number, number],
    proxyDistanceM: 10000,
    proxyRadiusM: 50,
  }));

  visualLayer.update(samples, camera);

  // Clean disposal
  visualLayer.dispose();
  assert.equal(parent.children.length, 0, 'Parent group must be cleared on dispose');
  assert.equal(visualLayer.root.children.length, 0, 'Root group must be cleared on dispose');
  assert.equal(visualLayer.stats.planets, 0, 'Visual maps must be cleared');
});

test('T_U453_10_ATLAS_EXPLORATION_INTEGRATION_AND_METADATA', () => {
  const universe = new UniverseRuntime();
  try {
    const catalog = new UniversalTargetCatalog(universe.solarSystem);
    const resolver = new UniversalTargetResolver(catalog, universe);
    const atlas = new CosmicAtlasModel(catalog, undefined, catalog.discovery, resolver);

    // Query celestial bodies in Atlas
    const result = atlas.query({ kind: 'body', limit: 20 });
    assert.ok(result.entries.length > 0, 'Atlas must return bodies');

    // Confirm that body entries carry enriched metadata
    const earthEntry = result.entries.find(e => e.bodyId === 'earth');
    if (earthEntry) {
      assert.ok(earthEntry.worldType, 'Earth entry must have worldType');
      assert.equal(earthEntry.canLand, true, 'Earth must be landable');
      assert.ok(earthEntry.temperatureK && earthEntry.temperatureK > 200, 'Earth must have temperatureK');
    }

    const jupiterEntry = result.entries.find(e => e.bodyId === 'jupiter');
    if (jupiterEntry) {
      assert.ok(jupiterEntry.worldType?.includes('Gasoso'), 'Jupiter must be classified as gas giant');
      assert.equal(jupiterEntry.canLand, false, 'Jupiter must not be landable');
    }

    const saturnEntry = result.entries.find(e => e.bodyId === 'saturn');
    if (saturnEntry) {
      assert.equal(saturnEntry.hasRings, true, 'Saturn must have rings in Atlas metadata');
    }

    // Test renderUniversalTargetCardHtml with astrophysics section
    const earthTarget = catalog.target('earth')!;
    const resolved = resolver.resolve(earthTarget);
    const html = renderUniversalTargetCardHtml(resolved, catalog.discovery, 'milky_way', false, true, catalog);

    assert.ok(html.includes('ALVO DE NAVEGAÇÃO'), 'Must render header');
    assert.ok(html.includes('ASTROFÍSICA &amp; SUPERFÍCIE'), 'Must render astrophysics section');
    assert.ok(html.includes('Classificação'), 'Must display classification row');
    assert.ok(html.includes('Temperatura'), 'Must display temperature row');
    assert.ok(html.includes('Gravidade'), 'Must display surface gravity row');
    assert.ok(html.includes('✓ Pouso permitido'), 'Must display landing capability');

    // Test procedural body target card
    const sector = sectorIndex(17n, -2n, 4n);
    const starCandidate = generateStarSector('milky_way', sector).stars.find(s => s.planetCount > 0);
    if (starCandidate) {
      const desc = catalog.proceduralDescriptor('milky_way', sector, starCandidate.id);
      if (desc && desc.system.bodies.length > 1) {
        const pBody = desc.system.bodies[1];
        const pTarget = catalog.proceduralTarget('milky_way', sector, desc.star.id, 'body', pBody.id);
        if (pTarget) {
          const resolvedProc = resolver.resolve(pTarget);
          const procHtml = renderUniversalTargetCardHtml(resolvedProc, catalog.discovery, 'milky_way', false, false, catalog);
          assert.ok(procHtml.includes('ASTROFÍSICA &amp; SUPERFÍCIE'), 'Procedural body card must include astrophysics');
        }
      }
    }
  } finally {
    universe.dispose();
  }
});
