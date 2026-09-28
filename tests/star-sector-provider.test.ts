import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, type Points } from 'three/webgpu';
import { StarSectorProvider } from '../src/world/providers/StarSectorProvider.ts';
import { sectorIndex } from '../src/world/spatial/UniverseAddress.ts';
import { DEFAULT_STREAMING_BUDGET } from '../src/world/streaming/StreamingBudget.ts';
import { pose } from '../src/world/spatial/SpatialPose.ts';
import { activeFrame, referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import type { StreamingContext } from '../src/world/providers/WorldProvider.ts';

const frame = () => activeFrame(referenceFrame({ id: 'x', kind: 'render-local' }), pose('x'));

function context(altitudeM: number): StreamingContext {
  return {
    spatial: {
      timeS: 0,
      player: pose('x', [0, altitudeM, 0]),
      frame: frame(),
      localVelocityMps: [0, 0, 0],
      altitudeM,
      bodyId: 'earth',
      address: { galaxyId: 'milky_way', sector: sectorIndex(0, 0, 0) },
    },
    camera: { fovRad: 1, viewportHeightPx: 900, forward: [0, -1, 0] },
    quality: { sseTargetPx: 8, detailFactor: 1 },
    budget: DEFAULT_STREAMING_BUDGET,
  };
}

test('the galaxy stays out of the way until there is nothing else to look at', () => {
  const parent = new Group();
  const galaxy = new StarSectorProvider(parent, { minAltitudeM: 200_000 });
  try {
    assert.equal(galaxy.covers(context(1_000).spatial), false, 'not from the ground');
    assert.equal(galaxy.covers(context(100_000).spatial), false, 'not from the stratosphere');
    assert.equal(galaxy.covers(context(500_000).spatial), true);
    assert.equal(galaxy.stats.visible, true);

    // It claims no channel at all, which is what makes it lose every overlap.
    assert.deepEqual(galaxy.coverage(), []);
  } finally {
    galaxy.dispose();
  }
});

test('a sector is generated once, deterministically, and disposed when nobody wants it', async () => {
  const parent = new Group();
  const galaxy = new StarSectorProvider(parent, { minAltitudeM: 0, ringSectors: 0, maxStarsPerSector: 64 });
  try {
    const ctx = context(500_000);
    galaxy.covers(ctx.spatial);
    const demands = galaxy.plan(ctx);
    assert.equal(demands.length, 1, 'one ring of zero is one sector');

    const payload = await galaxy.load(demands[0]);
    const tile = galaxy.activate(payload);
    assert.equal(galaxy.stats.sectors, 1);
    assert.ok(galaxy.stats.stars > 0, 'the sector has stars in it');

    // The same sector, generated again, must be identical: no Math.random anywhere in the path.
    const again = await galaxy.load(demands[0]);
    const first = (payload.geometry as { geometry: { getAttribute(n: string): { array: Float32Array } } }).geometry;
    const second = (again.geometry as { geometry: { getAttribute(n: string): { array: Float32Array } } }).geometry;
    assert.deepEqual(
      Array.from(first.getAttribute('position').array.slice(0, 12)),
      Array.from(second.getAttribute('position').array.slice(0, 12)),
    );

    // Eviction: the renderer this replaced never released anything it built.
    const mesh = parent.children[0].children[0] as Points;
    galaxy.deactivate(tile);
    assert.equal(galaxy.stats.sectors, 0, 'the sector is gone');
    assert.equal(mesh.parent, null, 'and out of the scene, not merely forgotten');
  } finally {
    galaxy.dispose();
  }
});

test('the plan is a ring around the player sector, nearest first by error', () => {
  const parent = new Group();
  const galaxy = new StarSectorProvider(parent, { minAltitudeM: 0, ringSectors: 1 });
  try {
    const ctx = context(500_000);
    galaxy.covers(ctx.spatial);
    const demands = galaxy.plan(ctx);
    assert.equal(demands.length, 27, 'three cubed');

    // Every key is a star sector, and the centre one has the largest claim on the queue.
    const centre = demands.find(d => d.key.kind === 'star-sector'
      && d.key.sector.x === 0n && d.key.sector.y === 0n && d.key.sector.z === 0n);
    assert.ok(centre, 'the sector the player is in must be planned');
    for (const demand of demands) {
      assert.equal(demand.key.kind, 'star-sector');
      assert.ok(demand.screenSpaceError <= centre.screenSpaceError);
    }
  } finally {
    galaxy.dispose();
  }
});

test('without a cosmic address the galaxy centres on the origin rather than on city metres', () => {
  const parent = new Group();
  const galaxy = new StarSectorProvider(parent, { minAltitudeM: 0, ringSectors: 0 });
  try {
    // A player a long way up in Manaus metres is still in sector zero. The renderer this replaced
    // derived the sector from exactly this number and so never left it either -- but silently,
    // and while claiming to.
    const ctx = context(400_000_000);
    galaxy.covers(ctx.spatial);
    const [demand] = galaxy.plan(ctx);
    assert.equal(demand.key.kind, 'star-sector');
    if (demand.key.kind !== 'star-sector') return;
    assert.deepEqual(demand.key.sector, sectorIndex(0, 0, 0));
  } finally {
    galaxy.dispose();
  }
});
