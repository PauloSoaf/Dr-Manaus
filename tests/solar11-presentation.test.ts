import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, PerspectiveCamera, Quaternion, Vector3 } from 'three/webgpu';
import { SOLAR_SYSTEM_BODIES } from '../src/world/celestial/CelestialBody.ts';
import { bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';
import { celestialProxyGeometry } from '../src/rendering/celestial/math.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';

const options = { fovRad: Math.PI / 3, viewportHeightPx: 1080, cameraFarM: 100_000 };

for (const body of SOLAR_SYSTEM_BODIES) {
  test(`T_ALL_PLANETS_RENDER_SAMPLES: ${body.id} is finite, bounded and grows on approach`, () => {
    const universe = new UniverseRuntime({ epochS: 0 });
    const layer = new CelestialBodyVisualLayer();
    const controller = new CelestialPresentationController(layer);
    const position = universe.activeSystem.positionOf(body.id)!;
    const angles: number[] = [];
    try {
      for (const ratio of [100, 20, 3]) {
        universe.updateSystemPose([position[0], position[1] + body.equatorialRadiusM * ratio, position[2]], [0, 0, 0], 0);
        controller.prepare({ universe, ...options });
        assert.equal(controller.renderSamples.length, 19);
        const sample = controller.renderSamples.find(sample => sample.bodyId === body.id)!;
        assert.ok(sample.visible, `${body.id} proxy must be visible without a physical provider`);
        assert.ok([sample.angularRadiusRad, sample.proxyDistanceM, sample.proxyRadiusM,
          ...sample.directionRender, ...sample.bodyOrientationRender!].every(Number.isFinite));
        assert.ok(Math.abs(Math.hypot(...sample.directionRender) - 1) < 1e-12);
        angles.push(sample.angularRadiusRad);
        const camera = new PerspectiveCamera(60, 1, 0.1, options.cameraFarM);
        camera.position.set(23, -15, 100);
        controller.render({ camera });
        let seenMeshes = 0;
        layer.root.traverse(object => {
          assert.ok(object.position.toArray().every(Number.isFinite));
          assert.ok(Math.max(...object.position.toArray().map(Math.abs)) <= 10_000_000);
          if (object instanceof Mesh) {
            seenMeshes++;
            assert.ok(Math.max(...object.scale.toArray().map(Math.abs)) <= 10_000_000);
          }
        });
        assert.equal(seenMeshes, 22, 'nineteen point proxies, two geographic spheres and one analytic ring mesh');
      }
      assert.ok(angles[0] < angles[1] && angles[1] < angles[2]);
    } finally { layer.dispose(); }
  });
}

test('Saturn rings follow catalog obliquity, proxy scale and parent visibility', () => {
  const universe = new UniverseRuntime();
  const layer = new CelestialBodyVisualLayer();
  const controller = new CelestialPresentationController(layer);
  const camera = new PerspectiveCamera(60, 1, 0.1, 100_000);
  try {
    const position = universe.activeSystem.positionOf('saturn')!;
    universe.updateSystemPose([position[0], position[1] + 600_000_000, position[2]], [0, 0, 0], 0);
    controller.prepare({ universe, ...options });
    controller.render({ camera });
    const sample = controller.renderSamples.find(sample => sample.bodyId === 'saturn')!;
    const proxy = layer.root.getObjectByName('saturn-proxy')!;
    const rings = proxy.getObjectByName('analytic-rings')!;
    assert.ok(rings);
    assert.equal(rings.scale.x, sample.proxyRadiusM);
    const actual = proxy.quaternion.clone().multiply(rings.quaternion);
    assert.ok(actual.angleTo(new Quaternion(...sample.bodyOrientationRender!)) < 1e-7);
    assert.ok(sample.proxyDistanceM + sample.proxyRadiusM * bodyProfile(SOLAR_SYSTEM_BODIES.find(b => b.id === 'saturn')!).visual.rings!.outerRadius < camera.far);
    layer.update(controller.renderSamples.map(s => ({ ...s, visible: false })), camera);
    assert.equal(proxy.visible, false, 'rings are culled with the same parent as Saturn');
  } finally { layer.dispose(); }
});

test('proxy geometry remains bounded at huge far planes and finite inside an exclusion sphere', () => {
  for (const angle of [0, 0.01, 0.5, 1.2, Math.PI / 2]) {
    const proxy = celestialProxyGeometry(angle, 1e15, 2.3);
    assert.equal(proxy.safe, true);
    assert.ok(proxy.distanceM <= 5_000_000);
    assert.ok(proxy.radiusM * 2.3 < 10_000_000);
  }
});

test('T_GLOBAL_STREAM_BUDGET: overview has zero terrain; one nearby solid body shares the global scheduler', async () => {
  const universe = new UniverseRuntime({ streaming: true, epochS: 0 });
  const root = new Group();
  const providers = createPlanetProviders(root, universe);
  const layer = new CelestialBodyVisualLayer();
  const controller = new CelestialPresentationController(layer);
  try {
    universe.updateSystemPose([0, 0, 1e13], [0, 0, 0], 0);
    controller.prepare({ universe, planetProviders: providers, ...options });
    universe.updateStreaming(1 / 60);
    assert.equal(universe.scheduler.stats.tracked, 0);
    assert.ok([...providers.values()].every(provider => provider.stats.tiles === 0));
    assert.equal(controller.physicalBodyId, undefined);

    const position = universe.activeSystem.positionOf('mercury')!;
    for (let frame = 0; frame < 40; frame++) {
      universe.updateSystemPose([position[0], position[1] + 3_000_000, position[2]], [0, 0, 0], 0);
      controller.prepare({ universe, planetProviders: providers, ...options });
      universe.updateStreaming(1 / 60);
      await Promise.resolve();
      assert.ok(universe.scheduler.stats.activationsLastFrame <= DEFAULT_STREAMING_BUDGET.maxLightActivationsPerFrame
        + DEFAULT_STREAMING_BUDGET.maxActivationsPerFrame);
      assert.ok(universe.scheduler.stats.fetching <= DEFAULT_STREAMING_BUDGET.maxConcurrentFetches);
      assert.ok([...providers].filter(([, provider]) => provider.presentationMode !== 'off').length <= 1);
    }
    assert.equal(controller.physicalBodyId, 'mercury');
    assert.ok(providers.get('mercury')!.stats.tiles > 0, 'nearby provider must actually stream');
    assert.ok([...providers].filter(([id]) => id !== 'mercury').every(([, provider]) => provider.stats.tiles === 0));
    for (const provider of providers.values()) {
      assert.ok(provider.globe.root.position.length() < 20_000_000);
    }
    // Leaving the system overview retires previously resident terrain through the same scheduler.
    universe.updateSystemPose([0, 0, 1e13], [0, 0, 0], 0);
    controller.prepare({ universe, planetProviders: providers, ...options });
    for (let frame = 0; frame < 8; frame++) universe.updateStreaming(1 / 60);
    assert.ok([...providers.values()].every(provider => provider.stats.tiles === 0));
  } finally { layer.dispose(); for (const provider of providers.values()) provider.globe.dispose(); }
});
