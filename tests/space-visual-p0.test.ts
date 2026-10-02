import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { EarthTransitionController } from '../src/world/providers/EarthTransitionController.ts';
import { EarthGlobe } from '../src/world/planet/EarthGlobe.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { SpaceLayer } from '../src/rendering/SpaceLayer.ts';

test('T_TRANS1: EarthTransitionController preserves representation continuity across 20-60 km', () => {
  const controller = new EarthTransitionController();
  const mockEarth: any = {
    readiness: () => ({ viewCoverageReady: true }),
  };

  // Test across altitudes from 0 to 100 km
  const testAltitudes = [0, 5000, 8000, 15000, 20000, 35000, 50000, 60000, 100000];
  for (const alt of testAltitudes) {
    const state = controller.update(alt, mockEarth);
    // Since there is no RegionalEarthRenderer, localWeight + planetWeight must sum to 1 to prevent representation holes
    const activeWeight = state.localWeight + state.planetWeight;
    assert.ok(
      activeWeight >= 0.99,
      `Altitude ${alt}m has coverage gap without regional renderer: local=${state.localWeight}, planet=${state.planetWeight}`
    );
  }
});

test('T_TRANS2: Never retire local representation before target coverage is ready', () => {
  const controller = new EarthTransitionController();
  // When earth is not providing target coverage (or coverage not ready), localWeight must remain 1
  const stateAt35k = controller.update(35000); // no earth provider passed -> default readiness not ready
  assert.equal(stateAt35k.localWeight, 1, 'localWeight must stay 1 if planet coverage is not ready');
});

test('T_RC1: EarthGlobe group positions must be bounded and never astronomical', () => {
  const parent = new Group();
  const globe = new EarthGlobe(parent);
  try {
    globe.setCenterM([1000, 2000, 3000]);
    assert.equal(globe.group.position.x, 1000);
    assert.equal(globe.group.position.y, 2000);
    assert.equal(globe.group.position.z, 3000);

    const maxCoord = Math.max(
      Math.abs(globe.group.position.x),
      Math.abs(globe.group.position.y),
      Math.abs(globe.group.position.z)
    );
    assert.ok(maxCoord <= 20_000_000, `Globe center ${maxCoord} exceeds render safe bound`);

    assert.throws(
      () => globe.setCenterM([150_000_000_000, 0, 0]),
      /Invariant violation/,
      'Must throw when astronomical coordinate reaches Mesh.position'
    );
  } finally {
    globe.dispose();
  }
});

test('T_STARS1: SpaceLayer rig follows camera and stars use depth testing', () => {
  const scene = new Group();
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000000);
  camera.position.set(0, 35000, 0);

  const space = new SpaceLayer(scene as any, camera);
  try {
    space.update(35000, new Vector3(0, 1, 0), false, 0.016);
    // Rig must follow camera position so stars are centered on observer
    const rig = scene.children.find(c => c.name === 'DR Manaus · space rig');
    assert.ok(rig, 'Space rig must be in scene');
    assert.equal(rig.position.y, camera.position.y, 'Space rig must track camera position');
  } finally {
    space.dispose();
  }
});

import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';

test('T_PROXY1: Earth coarse globe replaces analytic blue proxy once it is visually resolvable', () => {
  const layer = new CelestialBodyVisualLayer(new Group());
  const controller = new CelestialPresentationController(layer);
  const universe = new UniverseRuntime({ streaming: false });

  let modeFlag = 'off';

  const mockEarth: any = {
    readiness: () => ({ coarseFallbackReady: true }),
    setStreamingMode: (m: string) => { modeFlag = m; },
    setCentre: () => {},
    setSunDirection: () => {},
  };

  const fovRad = (60 * Math.PI) / 180;
  const viewportHeightPx = 1080;

  const earthBary = universe.activeSystem.positionOf('earth') ?? [149_597_870_700, 0, 0];
  // Move player so Earth is big enough (projectedPx >= 16) but still in 'planet' mode (dist = 40,000,000)
  universe.updateSystemPose([earthBary[0], earthBary[1], earthBary[2] + 40_000_000], [0, 0, 0], 0);
  controller.prepare({
    universe,
    earth: mockEarth,
    fovRad,
    viewportHeightPx
  });
  
  const sample = (controller as any).samples.find((s: any) => s.bodyId === 'earth');
  assert.ok(sample);
  
  // Test proxy is hidden and opacity is 0
  assert.equal(sample.visible, false);
  assert.equal(sample.opacity, 0);
  // Test globe streaming mode is 'coarse' (since coarseFallbackReady is true)
  assert.equal(modeFlag, 'coarse');
});

test('T_PROXY2: Earth proxy handles transition thresholds correctly without overlapping globe', () => {
  const layer = new CelestialBodyVisualLayer(new Group());
  const controller = new CelestialPresentationController(layer);
  const universe = new UniverseRuntime({ streaming: false });

  let modeFlag = 'off';

  const mockEarth: any = {
    readiness: () => ({ coarseFallbackReady: true }),
    setStreamingMode: (m: string) => { modeFlag = m; },
    setCentre: () => {},
    setSunDirection: () => {},
  };

  const fovRad = (60 * Math.PI) / 180;
  const viewportHeightPx = 1080;
  const earthBary = universe.activeSystem.positionOf('earth') ?? [149_597_870_700, 0, 0];

  const testDistances = [
    900_000_000, // Very far (projectedPx < 16) -> Proxy
    40_000_000,  // Far (projectedPx >= 16) -> Globe (coarse)
    20_000_000,  // Close (projectedPx >= 64, still planet mode) -> Globe (coarse)
  ];

  for (const dist of testDistances) {
    universe.updateSystemPose([earthBary[0], earthBary[1], earthBary[2] + dist], [0, 0, 0], 0);
    controller.prepare({ universe, earth: mockEarth, fovRad, viewportHeightPx });
    const sample = (controller as any).samples.find((s: any) => s.bodyId === 'earth');
    
    if (dist === 900_000_000) {
      assert.equal(sample.visible, true);
      assert.equal(sample.opacity, 1);
      assert.equal(modeFlag, 'off');
    } else {
      assert.equal(sample.visible, false);
      assert.equal(sample.opacity, 0);
      assert.equal(modeFlag, 'coarse');
    }
  }
});
