import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { MOON } from '../src/world/planet/PlanetBody.ts';
import { RockyPlanetProvider } from '../src/world/providers/RockyPlanetProvider.ts';
import { UniverseRuntime, TRAVEL_VIEW_FRAME } from '../src/world/runtime/UniverseRuntime.ts';
import type { Quat, Vec3 } from '../src/world/spatial/units.ts';

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const quatDot = (a: Quat, b: Quat): number => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);

test('celestial directions use observer-centred travel axes instead of barycentric axes', () => {
  const universe = new UniverseRuntime({ epochS: 0 });
  const playerBary = universe.frames.convertPosition(
    universe.player.frame, 'solar-system/barycentric', universe.player.position,
  );
  universe.updateSystemPose(playerBary, universe.systemVelocityMps([0, 0, 0]), 0, [0, 0, -1]);
  assert.equal(universe.renderSpace.currentOrigin.frame, TRAVEL_VIEW_FRAME);

  const controller = new CelestialPresentationController(new CelestialBodyVisualLayer(new Group()));
  controller.prepare({ universe, fovRad: Math.PI / 3, viewportHeightPx: 1080 });
  const sun = (controller as unknown as { samples: Array<{ bodyId: string; directionRender: Vec3 }> })
    .samples.find(sample => sample.bodyId === 'sun');
  assert.ok(sun);

  const sunBary = universe.activeSystem.positionOf('sun')!;
  const delta: Vec3 = [sunBary[0] - playerBary[0], sunBary[1] - playerBary[1], sunBary[2] - playerBary[2]];
  const expected = universe.frames.convertDirection('solar-system/barycentric', TRAVEL_VIEW_FRAME, delta);
  const length = Math.hypot(...expected);
  expected[0] /= length; expected[1] /= length; expected[2] /= length;
  assert.ok(dot(sun.directionRender, expected) > 1 - 1e-12);

  const baryLength = Math.hypot(...delta);
  const baryDirection: Vec3 = [delta[0] / baryLength, delta[1] / baryLength, delta[2] / baryLength];
  assert.ok(dot(expected, baryDirection) < 0.99, 'fixture must distinguish travel axes from barycentric axes');
});

test('a rocky globe rotates body-fixed tiles into the active travel render frame', () => {
  const universe = new UniverseRuntime({ epochS: 0 });
  const playerBary = universe.frames.convertPosition(
    universe.player.frame, 'solar-system/barycentric', universe.player.position,
  );
  universe.updateSystemPose(playerBary, universe.systemVelocityMps([0, 0, 0]), 0, [0, 0, -1]);
  const provider = new RockyPlanetProvider(
    new Group(), universe.frames, MOON, MoonSurfaceGenerator, { renderSpace: universe.renderSpace },
  );
  const moonBary = universe.activeSystem.positionOf('moon')!;
  provider.setCentre(moonBary, 'solar-system/barycentric', TRAVEL_VIEW_FRAME, playerBary);

  const actual: Quat = provider.globe.root.quaternion.toArray();
  const expected = universe.frames.convertOrientation('moon/fixed', TRAVEL_VIEW_FRAME, [0, 0, 0, 1]);
  assert.ok(1 - quatDot(actual, expected) < 1e-12);
  assert.ok(1 - quatDot(actual, [0, 0, 0, 1]) > 1e-3, 'departure axes make the required rotation non-trivial');
});
