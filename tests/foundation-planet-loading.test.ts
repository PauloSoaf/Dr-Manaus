import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Mesh } from 'three/webgpu';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface';
import { PlanetGlobe } from '../src/world/planet/PlanetGlobe';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { tileDemand } from '../src/world/streaming/TileDemand';

/** The real lunar generator, counting how many vertices it is asked to evaluate. */
function countedMoon() {
  let vertices = 0;
  const surface: PlanetSurfaceGenerator = Object.create(MoonSurfaceGenerator, {
    colourAt: { value: (...args: Parameters<PlanetSurfaceGenerator['colourAt']>) => { vertices++; return MoonSurfaceGenerator.colourAt(...args); } },
  });
  return { surface, get vertices() { return vertices; } };
}

const faces = (globe: PlanetGlobe) => (globe.fallbackGroup.children as Mesh[]).map(mesh => mesh.geometry);

test('the coarse planet is built once and reused every time the body becomes physical again', t => {
  const globe = new PlanetGlobe('moon'), moon = countedMoon();
  t.after(() => globe.dispose());
  globe.ensureFallback(moon.surface);
  const built = moon.vertices, first = faces(globe);
  globe.releaseFallback();
  assert.equal(globe.fallbackReady, false);
  assert.equal(globe.fallbackGroup.children.length, 0);
  globe.ensureFallback(moon.surface);
  assert.equal(moon.vertices, built, 'no vertex is evaluated again');
  assert.deepEqual(faces(globe), first);
});

test('a budgeted coarse planet builds a row per call and appears only with all six faces', t => {
  const resolution = MoonSurfaceGenerator.coarseResolution!;
  const sliced = new PlanetGlobe('moon'), whole = new PlanetGlobe('moon'), moon = countedMoon();
  t.after(() => { sliced.dispose(); whole.dispose(); });
  let calls = 0;
  sliced.ensureFallback(moon.surface, 0);
  assert.equal(moon.vertices, resolution, 'a zero budget still makes progress: one row');
  while (!sliced.fallbackReady && calls < 10_000) {
    assert.equal(sliced.fallbackGroup.children.length, 0, 'no partial planet is ever shown');
    sliced.ensureFallback(moon.surface, 0);
    calls++;
  }
  assert.equal(moon.vertices, 6 * resolution * resolution);
  whole.ensureFallback(MoonSurfaceGenerator);
  faces(sliced).forEach((geometry, face) => {
    for (const name of ['position', 'normal', 'color']) {
      assert.deepEqual(geometry.getAttribute(name).array, faces(whole)[face].getAttribute(name).array, `${name} of face ${face}`);
    }
  });
});

test('prewarming prepares the geometry without attaching a distant body', t => {
  const globe = new PlanetGlobe('moon'), moon = countedMoon();
  t.after(() => globe.dispose());
  while (!globe.prepareFallback(moon.surface, 2)) assert.equal(globe.fallbackGroup.children.length, 0);
  assert.equal(globe.fallbackReady, false);
  const built = moon.vertices;
  globe.ensureFallback(moon.surface, 0);
  assert.equal(globe.fallbackReady, true, 'a prewarmed planet attaches at once, even without budget');
  assert.equal(moon.vertices, built);
});

test('dense streamed tiles are built across frames, identical to the one-shot tile, and honour aborts', async t => {
  const universe = new UniverseRuntime({ streaming: false, epochS: 0 });
  const sliced = createPlanetProviders(new Group(), universe, undefined, false, { slices: { coarseMs: 0, surfaceMs: 0 } });
  const whole = createPlanetProviders(new Group(), universe, undefined, false);
  const moon = sliced.get('moon')!, reference = whole.get('moon')!;
  t.after(() => { for (const p of [...sliced.values(), ...whole.values()]) p.dispose(); universe.dispose(); });
  const demand = (level: number) => tileDemand({
    key: { kind: 'planet', bodyId: 'moon', face: 2, level, x: 0, y: 0 }, providerId: moon.id, geometricErrorM: 1,
    screenSpaceError: 1, distanceM: 1, timeToContactS: 1, gameplayCritical: false, representation: 'planet', centreM: [0, 0, 0],
  });
  let done = false;
  const pending = moon.load(demand(1)).then(payload => { done = true; return payload; });
  await Promise.resolve();
  assert.equal(done, false, 'a dense tile is not built inside load()');
  assert.equal(moon.pendingDenseTiles, 1);
  for (let frame = 0; frame < MoonSurfaceGenerator.coarseResolution!; frame++) moon.advanceLoading(0);
  const [built, expected] = await Promise.all([pending, reference.load(demand(1))]);
  assert.equal(moon.pendingDenseTiles, 0);
  type Mesh_ = { geometry: import('three/webgpu').BufferGeometry };
  assert.deepEqual((built.geometry as Mesh_).geometry.getAttribute('position').array,
    (expected.geometry as Mesh_).geometry.getAttribute('position').array);
  assert.equal(built.cpuBytes, expected.cpuBytes);
  // Standard tiles stay immediate, so landing patches never wait on a queue.
  await moon.load(demand(6));
  assert.equal(moon.pendingDenseTiles, 0);

  const controller = new AbortController();
  const aborted = moon.load(demand(2), controller.signal);
  const orphaned = moon.load(demand(0));
  controller.abort();
  moon.advanceLoading(0);
  await assert.rejects(aborted, /aborted/);
  moon.dispose();
  await assert.rejects(orphaned, /disposed/);
});

test('approaching a planet keeps its distant disc until the sliced globe is ready', t => {
  const universe = new UniverseRuntime({ streaming: false, epochS: 0 });
  const providers = createPlanetProviders(new Group(), universe, undefined, true, { slices: { coarseMs: 0, surfaceMs: 0 } });
  const layer = new CelestialBodyVisualLayer(), controller = new CelestialPresentationController(layer);
  const moon = providers.get('moon')!;
  t.after(() => { for (const provider of providers.values()) provider.dispose(); layer.dispose(); universe.dispose(); });
  const centre = universe.activeSystem.positionOf('moon')!;
  universe.updateSystemPose([centre[0] + moon.bodyDef.semiMajorAxisM + 1_000_000, centre[1], centre[2]], [0, 0, 0], 0);
  let frames = 0;
  do {
    controller.prepare({ universe, planetProviders: providers, fovRad: 1, viewportHeightPx: 1080 });
    assert.equal(controller.physicalBodyId, 'moon');
    const sample = controller.renderSamples.find(s => s.bodyId === 'moon')!;
    const disc = sample.visible && sample.opacity > 0;
    const globe = moon.globe.visible && moon.readiness().fallbackReady;
    assert.ok(disc !== globe, `frame ${frames}: exactly one representation of the Moon (disc ${disc}, globe ${globe})`);
    frames++;
  } while (!moon.readiness().fallbackReady && frames < 10_000);
  assert.ok(frames > 100, `built across ${frames} frames`);
});
