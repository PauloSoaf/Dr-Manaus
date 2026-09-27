import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, type Mesh } from 'three/webgpu';
import { buildMoonTileMesh, MOON_TILE_RESOLUTION } from '../src/world/planet/MoonGlobe.ts';
import { MOON_RADIUS_M, MOON_RELIEF_M, moonColourAt, moonHeightAt } from '../src/world/planet/MoonSurface.ts';
import { MoonProvider } from '../src/world/providers/MoonProvider.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { planetTile, tileChildren } from '../src/world/planet/PlanetTileAddress.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

const context = (position: Vec3, altitudeM: number): StreamingContext => ({
  spatial: {
    timeS: 0,
    player: pose('earth/manaus/legacy-enu', position),
    frame: activeFrame(referenceFrame({ id: 'x', kind: 'render-local' }), pose('x')),
    localVelocityMps: [0, 0, 0],
    altitudeM,
    bodyId: 'earth',
  },
  camera: { fovRad: 1, viewportHeightPx: 900, forward: [0, 0, -1] },
  quality: { sseTargetPx: 8, detailFactor: 1 },
  budget: DEFAULT_STREAMING_BUDGET,
});

test('the Moon surface is deterministic, bounded, and grey', () => {
  const a: Vec3 = [0.3, 0.5, 0.81];
  const length = Math.hypot(...a);
  const direction: Vec3 = [a[0] / length, a[1] / length, a[2] / length];

  // The same direction gives the same answer, forever and on every machine.
  assert.equal(moonHeightAt(direction), moonHeightAt([...direction] as Vec3));

  let low = Infinity, high = -Infinity;
  for (let i = 0; i < 2000; i++) {
    const t = i / 2000 * Math.PI * 2;
    const d: Vec3 = [Math.cos(t) * 0.7, Math.sin(t) * 0.7, Math.cos(t * 3.1) * 0.5];
    const l = Math.hypot(...d);
    const h = moonHeightAt([d[0] / l, d[1] / l, d[2] / l]);
    low = Math.min(low, h); high = Math.max(high, h);
  }
  assert.ok(Math.abs(low) <= MOON_RELIEF_M && Math.abs(high) <= MOON_RELIEF_M, 'relief must stay in its band');
  assert.ok(high - low > 100, 'a Moon with no relief is a ball');

  const colour: [number, number, number] = [0, 0, 0];
  moonColourAt(direction, colour);
  // Grey: the channels stay close together. A coloured Moon would be a bug in the ramp.
  const spread = Math.max(...colour) - Math.min(...colour);
  assert.ok(spread < 0.05, `the Moon came out tinted (${colour.map(c => c.toFixed(3)).join(', ')})`);
  for (const channel of colour) assert.ok(channel > 0 && channel < 1);
});

test('a Moon tile sits on the Moon, at the height the surface says', () => {
  const mesh = buildMoonTileMesh(planetTile('moon', 1, 3, 2, 5));
  const positions = mesh.geometry.getAttribute('position');
  assert.equal(positions.count, MOON_TILE_RESOLUTION * MOON_TILE_RESOLUTION);

  for (let i = 0; i < positions.count; i += 13) {
    const x = positions.getX(i) + mesh.centre[0];
    const y = positions.getY(i) + mesh.centre[1];
    const z = positions.getZ(i) + mesh.centre[2];
    const radius = Math.hypot(x, y, z);
    const direction: Vec3 = [x / radius, y / radius, z / radius];
    const expected = MOON_RADIUS_M + moonHeightAt(direction);
    // Float32 storage of offsets from the tile centre is the entire budget, as on Earth.
    assert.ok(
      Math.abs(radius - expected) < 30,
      `a vertex sits ${(radius - expected).toFixed(1)} m off the surface`,
    );
  }
  assert.equal(mesh.triangles, (MOON_TILE_RESOLUTION - 1) ** 2 * 2);
});

test('neighbouring Moon tiles agree on their shared edge', () => {
  const parent = planetTile('moon', 2, 2, 1, 1);
  const [a, b] = tileChildren(parent);
  const left = buildMoonTileMesh(a);
  const right = buildMoonTileMesh(b);
  const lp = left.geometry.getAttribute('position');
  const rp = right.geometry.getAttribute('position');

  let worst = 0;
  for (let row = 0; row < MOON_TILE_RESOLUTION; row++) {
    const i = row * MOON_TILE_RESOLUTION + (MOON_TILE_RESOLUTION - 1);
    const j = row * MOON_TILE_RESOLUTION;
    worst = Math.max(worst, Math.hypot(
      (lp.getX(i) + left.centre[0]) - (rp.getX(j) + right.centre[0]),
      (lp.getY(i) + left.centre[1]) - (rp.getY(j) + right.centre[1]),
      (lp.getZ(i) + left.centre[2]) - (rp.getZ(j) + right.centre[2]),
    ));
  }
  // A pure function of the direction means edges match without any seam handling.
  assert.ok(worst < 30, `the shared edge is ${worst.toFixed(1)} m apart`);
});

test('the Moon is a light in the sky until the player is a long way from Earth', () => {
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const moon = new MoonProvider(parent, runtime.frames, { minAltitudeM: 400_000, maxRangeM: 4_000_000 });
  try {
    moon.setCentre([0, 384_400_000, 0], 'earth/fixed');
    // On the ground: no surface, whatever the distance says.
    assert.equal(moon.covers(context([0, 100, 0], 100).spatial), false);
    // High above the Earth but still four hundred thousand kilometres from the Moon.
    assert.equal(moon.covers(context([0, 1_000_000, 0], 1_000_000).spatial), false);
    assert.equal(moon.globe.visible, false);
  } finally {
    moon.dispose();
  }
});

test('close to the Moon it becomes a surface, and the surface streams', async () => {
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const moon = new MoonProvider(parent, runtime.frames, {
    minAltitudeM: 0, maxRangeM: 10_000_000, maxTiles: 24, maxLevel: 5,
  });
  try {
    const centre: Vec3 = [0, 20_000_000, 0];
    moon.setCentre(centre, 'earth/manaus/legacy-enu');
    // A hundred kilometres above the surface, on the near side.
    const player: Vec3 = [0, centre[1] - MOON_RADIUS_M - 100_000, 0];
    const ctx = context(player, 20_000_000);

    assert.equal(moon.covers(ctx.spatial), true, 'this close it is a place');
    const demands = moon.plan(ctx);
    assert.ok(demands.length > 0, 'a visible Moon must want tiles');
    for (const demand of demands) {
      assert.equal(demand.key.kind, 'planet');
      if (demand.key.kind === 'planet') assert.equal(demand.key.bodyId, 'moon');
    }

    const payload = await moon.load(demands[0]);
    const tile = moon.activate(payload);
    assert.equal(moon.stats.tiles, 1);
    const mesh = parent.children[0].children.find(child => child.name.startsWith('moon-')) as Mesh;
    assert.ok(mesh?.isMesh, 'the tile must be in the scene');

    moon.deactivate(tile);
    assert.equal(moon.stats.tiles, 0, 'and disposed when nobody wants it');
  } finally {
    moon.dispose();
  }
});

test('a Moon key is never an Earth key', async () => {
  const runtime = new UniverseRuntime();
  const parent = new Group();
  const moon = new MoonProvider(parent, runtime.frames, { minAltitudeM: 0, maxRangeM: 1e12 });
  try {
    await assert.rejects(
      () => moon.load({
        key: { kind: 'planet', bodyId: 'earth', face: 0, level: 1, x: 0, y: 0 },
        providerId: 'moon/surface', priority: 0, geometricErrorM: 1, screenSpaceError: 1,
        distanceM: 1, timeToContactS: Infinity, gameplayCritical: false, representation: 'planet',
      }),
      /not a Moon tile/,
    );
  } finally {
    moon.dispose();
  }
});
