import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { EarthProvider } from '../src/world/providers/EarthProvider.ts';
import { RockyPlanetProvider } from '../src/world/providers/RockyPlanetProvider.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { MarsSurfaceGenerator } from '../src/world/planet/MarsSurface.ts';
import { MOON, MARS } from '../src/world/planet/PlanetBody.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';
import { MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter.ts';

const FOV_RAD = (60 * Math.PI) / 180;
const VIEWPORT_H_PX = 1080;

test('T_BOOT_MANAUS: initial Manaus frame does not throw during prepare()', () => {
  const universe = new UniverseRuntime({ streaming: true, epochS: 0 });

  const sceneRoot = new Group();

  // Earth provider
  const earth = new EarthProvider(sceneRoot, universe.frames, {
    renderSpace: universe.renderSpace,
  });
  universe.providers.register(earth);

  // Moon physical provider
  const moonProvider = new RockyPlanetProvider(
    sceneRoot, universe.frames, MOON, MoonSurfaceGenerator,
    { renderSpace: universe.renderSpace },
  );
  universe.providers.register(moonProvider);

  // Mars physical provider
  const marsProvider = new RockyPlanetProvider(
    sceneRoot, universe.frames, MARS, MarsSurfaceGenerator,
    { renderSpace: universe.renderSpace },
  );
  universe.providers.register(marsProvider);

  const layer = new CelestialBodyVisualLayer();
  const controller = new CelestialPresentationController(layer);

  // Player is at Manaus ground level — same initial state as Game.ts boot
  universe.setPlayerPose(MANAUS_FRAME_ID, [0, 1.8, 0]);
  universe.update([0, 1.8, 0], [0, 0, 0], 0.016, [0, 0, -1]);

  // THIS must not throw — this was the regression introduced in 164282d
  assert.doesNotThrow(() => {
    controller.prepare({
      universe,
      earth,
      planetProviders: new Map([['moon', moonProvider], ['mars', marsProvider]]),
      fovRad: FOV_RAD,
      viewportHeightPx: VIEWPORT_H_PX,
    });
  }, 'controller.prepare() must not throw at Manaus spawn');


  // Physical globes for distant bodies must be inactive
  assert.equal(
    moonProvider.globe.visible, false,
    'Moon physical globe must be hidden when player is at Manaus',
  );
  assert.equal(
    marsProvider.globe.visible, false,
    'Mars physical globe must be hidden when player is at Manaus',
  );

  // Physical globes must not have astronomical coordinates
  const moonPos = moonProvider.globe.root.position;
  const marsPos = marsProvider.globe.root.position;
  const SAFE_LIMIT = 20_000_000;

  assert.ok(
    Math.abs(moonPos.x) <= SAFE_LIMIT &&
    Math.abs(moonPos.y) <= SAFE_LIMIT &&
    Math.abs(moonPos.z) <= SAFE_LIMIT,
    `Moon globe has unsafe render position [${moonPos.x}, ${moonPos.y}, ${moonPos.z}]`,
  );
  assert.ok(
    Math.abs(marsPos.x) <= SAFE_LIMIT &&
    Math.abs(marsPos.y) <= SAFE_LIMIT &&
    Math.abs(marsPos.z) <= SAFE_LIMIT,
    `Mars globe has unsafe render position [${marsPos.x}, ${marsPos.y}, ${marsPos.z}]`,
  );
});
