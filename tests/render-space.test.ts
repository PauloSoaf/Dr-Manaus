import test from 'node:test';
import assert from 'node:assert/strict';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { createRenderOrigin, type RenderOrigin } from '../src/world/spatial/RenderOrigin.ts';
import { RenderSpaceService } from '../src/world/spatial/RenderSpaceService.ts';
import { EARTH_FIXED_FRAME_ID, MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

function createSolarGraph(): ReferenceFrameGraph {
  const graph = new ReferenceFrameGraph();
  // Root: solar-system/barycentric
  graph.register(referenceFrame({ id: 'solar-system/barycentric', kind: 'inertial' }));
  
  // Earth orbit: 1 AU along X for this test scenario
  const AU_METRES = 149_597_870_700;
  graph.register(referenceFrame({
    id: EARTH_FIXED_FRAME_ID,
    kind: 'body-fixed',
    parentId: 'solar-system/barycentric',
    originInParent: [AU_METRES, 0, 0],
  }));

  // Moon orbit: ~384,400 km from Earth along Y
  graph.register(referenceFrame({
    id: 'moon/fixed',
    kind: 'body-fixed',
    parentId: EARTH_FIXED_FRAME_ID,
    originInParent: [0, 384_400_000, 0],
  }));

  return graph;
}

test('T_RS1: RenderSpace preserves 1 m precision at 1 AU distance', () => {
  const graph = createSolarGraph();
  const AU_METRES = 149_597_870_700;

  // Observer at 1 AU + 500 km
  const observerBarycentric: Vec3 = [AU_METRES + 500_000, 0, 0];
  const origin = createRenderOrigin('solar-system/barycentric', observerBarycentric);
  const service = new RenderSpaceService(graph, origin);

  // Target object only 123.45 metres ahead of observer in barycentric space
  const targetBarycentric: Vec3 = [AU_METRES + 500_123.45, 0, 0];
  const renderPos = service.logicalToRender('solar-system/barycentric', targetBarycentric);

  // In render space, offset must be exactly 123.45 m, not 1.5e11 m!
  assert.ok(Math.abs(renderPos[0] - 123.45) < 1e-3, `render X was ${renderPos[0]}, expected ~123.45`);
  assert.equal(renderPos[1], 0);
  assert.equal(renderPos[2], 0);

  // Confirm it is safe for Float32 Three.js buffers (< 20,000,000 m)
  assert.ok(service.isRenderSafe(renderPos), 'render position must be render-safe');

  // Inverse round-trip back to logical space
  const roundTrip = service.renderToLogical(renderPos, 'solar-system/barycentric');
  assert.ok(Math.abs(roundTrip[0] - targetBarycentric[0]) < 1e-3, 'round-trip logical position must match');
});

test('T_RS2: Earth tile in barycentric space is rendered relative to observer, bounded < 20,000 km', () => {
  const graph = createSolarGraph();
  const AU_METRES = 149_597_870_700;

  // Observer is 300 km above Earth surface along X in barycentric space
  // Earth radius ~6,378,137 m, so observer is at AU_METRES + 6,678,137 m
  const observerBarycentric: Vec3 = [AU_METRES + 6_678_137, 0, 0];
  const origin = createRenderOrigin('solar-system/barycentric', observerBarycentric);
  const service = new RenderSpaceService(graph, origin);

  // Earth center in earth/fixed frame is [0, 0, 0]
  const earthCenterRender = service.logicalToRender(EARTH_FIXED_FRAME_ID, [0, 0, 0]);

  // Distance from observer to Earth center must be ~6,678,137 m
  const dist = Math.hypot(...earthCenterRender);
  assert.ok(Math.abs(dist - 6_678_137) < 10, `Earth center distance in render space was ${dist} m`);

  // It must be bounded well below 20,000,000 m and NEVER in AU scale!
  assert.ok(dist < 20_000_000, 'Earth render distance must be < 20,000 km');
  assert.ok(dist < 1e9, 'Earth render distance must never reach AU scale');
  assert.ok(service.isRenderSafe(earthCenterRender, 20_000_000), 'Earth center must be render-safe');
});

test('T_RS3: Moon center render coordinates are bounded when in Earth-Moon space', () => {
  const graph = createSolarGraph();
  const AU_METRES = 149_597_870_700;

  // Observer halfway between Earth and Moon (192,200 km from Earth along Y)
  const observerBarycentric: Vec3 = [AU_METRES, 192_200_000, 0];
  const origin = createRenderOrigin('solar-system/barycentric', observerBarycentric);
  const service = new RenderSpaceService(graph, origin);

  // Moon center in moon/fixed is [0, 0, 0]
  const moonRenderPos = service.logicalToRender('moon/fixed', [0, 0, 0]);
  const moonDist = Math.hypot(...moonRenderPos);

  // Distance should be ~192,200,000 m
  assert.ok(Math.abs(moonDist - 192_200_000) < 10, `Moon render distance was ${moonDist}`);
  // Still astronomically small compared to 1 AU (1.5e11 m)
  assert.ok(moonDist < 400_000_000, 'Moon distance should be within lunar orbit range');
});

test('T_RS4: RenderOrigin rebase preserves logical positions while shifting render offsets', () => {
  const graph = createSolarGraph();
  const initialOrigin = createRenderOrigin('solar-system/barycentric', [1000, 2000, 3000]);
  const service = new RenderSpaceService(graph, initialOrigin);

  const targetLogical: Vec3 = [1100, 2050, 3020];
  const renderPos1 = service.logicalToRender('solar-system/barycentric', targetLogical);
  assert.deepEqual(renderPos1, [100, 50, 20]);

  // Rebase origin by +50 m in X
  service.setOrigin(createRenderOrigin('solar-system/barycentric', [1050, 2000, 3000]));
  const renderPos2 = service.logicalToRender('solar-system/barycentric', targetLogical);
  assert.deepEqual(renderPos2, [50, 50, 20]);

  // Target logical position remains identical
  const recoveredLogical = service.renderToLogical(renderPos2, 'solar-system/barycentric');
  assert.deepEqual(recoveredLogical, targetLogical);
});
