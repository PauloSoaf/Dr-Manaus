import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import type { InputController } from '../src/player/InputController.ts';
import { getGravity, getJumpVelocity } from '../src/player/physics/JumpPhysics.ts';
import { EARTH, MARS, MOON, bodyGeodeticToFixed, polarRadiusM, surfaceGravityMps2, type PlanetBody } from '../src/world/planet/PlanetBody.ts';
import { buildPlanetTileMesh } from '../src/world/planet/PlanetGlobe.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { MarsSurfaceGenerator } from '../src/world/planet/MarsSurface.ts';
import type { PlanetSurfaceGenerator } from '../src/world/planet/PlanetSurface.ts';
import { PlanetTerrainProvider } from '../src/world/planet/PlanetTerrainProvider.ts';
import { planetTile } from '../src/world/planet/PlanetTileAddress.ts';
import { geodetic } from '../src/world/spatial/Geodetic.ts';
import { referenceFrame } from '../src/world/spatial/ReferenceFrame.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import type { Vec3 } from '../src/world/spatial/units.ts';

function anchor(frames: ReferenceFrameGraph, body: PlanetBody, lat = 0, lon = 0): void {
  const point = bodyGeodeticToFixed(body, geodetic(lat, lon, 0));
  const east = new Vector3(-Math.sin(lon), Math.cos(lon), 0);
  const up = new Vector3(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
  const south = east.clone().cross(up);
  const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(east, up, south));
  frames.register(referenceFrame({ id: `${body.id}/fixed`, kind: 'body-fixed' }));
  frames.register(referenceFrame({
    id: `${body.id}/local-enu`, kind: 'surface-enu', parentId: `${body.id}/fixed`,
    originInParent: [point.xM, point.yM, point.zM], rotationToParent: rotation.toArray(),
  }));
}

for (const [body, surface] of [[MOON, MoonSurfaceGenerator], [MARS, MarsSurfaceGenerator]] as const) {
  test(`${body.id} ground follows the ellipsoid 250 km from the anchor and across re-anchoring`, () => {
    const frames = new ReferenceFrameGraph();
    anchor(frames, body);
    const flat: PlanetSurfaceGenerator = { ...surface, heightAt: () => 0 };
    const terrain = new PlanetTerrainProvider(frames, body, flat);
    const x = 250_000, z = 120_000, a = body.semiMajorAxisM, b = polarRadiusM(body);
    const expected = Math.sqrt(a * a - x * x - (a * z / b) ** 2) - a;
    assert.ok(Math.abs(terrain.heightAt(x, z) - expected) < 1e-6);
    assert.ok(expected < -10_000, 'a distant point must include the curvature below ENU y=0');
    anchor(frames, body, Math.PI / 2, 0.73);
    const polarExpected = Math.sqrt(b * b - (b * x / a) ** 2 - (b * z / a) ** 2) - b;
    assert.ok(Math.abs(terrain.heightAt(x, z) - polarExpected) < 1e-6, 'cached provider observes the new frame');
    PhysicsWorld.setTerrain(terrain);
    try { assert.equal(PhysicsWorld.terrainHeight(a * 2, 0), -Infinity, 'no invented ground beyond the tangent chart'); }
    finally { PhysicsWorld.setTerrain(null); }
  });

  test(`${body.id==='moon'?'T_MOON_SURFACE_COLLISION_USES_SAME_HEIGHT_AUTHORITY: ':''}${body.id} collision agrees with actual tile vertices at high latitude`, () => {
    const frames = new ReferenceFrameGraph();
    anchor(frames, body, 1.2, 0.5);
    const terrain = new PlanetTerrainProvider(frames, body, surface);
    const mesh = buildPlanetTileMesh(planetTile(body.id, 4, 9, 190, 284), surface);
    try {
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i += 7) {
        const fixed: Vec3 = [positions.getX(i) + mesh.centre[0], positions.getY(i) + mesh.centre[1], positions.getZ(i) + mesh.centre[2]];
        const local = frames.convertPosition(`${body.id}/fixed`, terrain.frameId, fixed);
        assert.ok(Math.abs(terrain.heightAt(local[0], local[2]) - local[1]) < 0.002,
          `collision diverged from tile vertex ${i}`);
      }
    } finally { mesh.geometry.dispose(); }
  });

  test(`${body.id} relief handles fast landings, camera rays and safe landing without a y=0 floor`, () => {
    const frames = new ReferenceFrameGraph();
    anchor(frames, body, 0.4, -1.1);
    const terrain = new PlanetTerrainProvider(frames, body, surface);
    PhysicsWorld.setTerrain(terrain);
    try {
      const x = 120_000, z = -80_000;
      const floor = PhysicsWorld.terrainHeight(x, z, 0.32);
      assert.ok(Math.abs(floor) > 50, 'the fixture must differ materially from Manaus ground');
      const position = new Vector3(x, floor + 2_000, z), velocity = new Vector3(0, -100_000, 0);
      const physics = new PhysicsWorld();
      assert.equal(physics.move(position, velocity, 0.06, 0.32, 2.1, []), true);
      assert.ok(Math.abs(position.y - floor) < 1e-8);
      assert.ok(Math.abs(velocity.dot(physics.lastTerrainContact!.normal)) < 1e-8,
        'contact removes inward velocity along the actual slope, preserving its tangent');
      const rayOrigin = new Vector3(x, terrain.heightAt(x, z) + 30, z);
      const vertical = PhysicsWorld.raycast(rayOrigin, new Vector3(0, -1, 0), [], 100, 0, true);
      assert.ok(vertical && Math.abs(vertical.distance - 30) < 0.001);
      const obliqueDirection = new Vector3(0.6, -1, 0.4).normalize();
      const oblique = PhysicsWorld.raycast(rayOrigin, obliqueDirection, [], 100, 0, true);
      assert.ok(oblique);
      assert.ok(Math.abs(oblique.point.y - terrain.heightAt(oblique.point.x, oblique.point.z)) < 0.001);
      assert.equal(terrain.raycast(rayOrigin, new Vector3(0, 1, 0), 100), null);
      const safe = PhysicsWorld.safeLanding(new Vector3(x, floor - 10, z), [], 0.32, 2.1);
      assert.ok(Math.abs(safe.y - floor - 0.05) < 1e-8);
    } finally { PhysicsWorld.setTerrain(null); }
  });
}

test('Earth, Mars and Moon preserve the jump impulse and use body gravity through landing', () => {
  const results = new Map<string, { peak: number; airtime: number }>();
  // A negative ENU floor catches the old absolute-y teleport/grounded assumption as well.
  PhysicsWorld.setTerrain({ heightAt: () => -800 });
  try {
    for (const body of [EARTH, MARS, MOON]) {
      const edges = new Set<string>();
      const input = { held: () => false, consume: (key: string) => edges.delete(key) } as unknown as InputController;
      const player = new PlayerController(new Group(), input);
      try {
        player.setSurfaceGravity(surfaceGravityMps2(body));
        player.teleport(new Vector3(0, -800, 0));
        assert.equal(player.state, 'Grounded');
        player.update(0.01, [], 0);
        assert.equal(player.isGrounded, true);
        edges.add('Space');
        player.update(0.01, [], 0);
        assert.ok(Math.abs(player.velocity.y + player.gravityMps2 * 0.01 - getJumpVelocity(1)) < 1e-9);
        if (body === EARTH) assert.equal(player.gravityMps2, getGravity(1));
        let peak = 0, frames = 1;
        while (!player.isGrounded && frames < 1_000) {
          peak = Math.max(peak, player.position.y + 800);
          player.update(0.01, [], 0);
          frames++;
        }
        assert.equal(player.isGrounded, true, `${body.id} jump must land`);
        assert.equal(player.position.y, -800);
        const idealHeight = getJumpVelocity(1) ** 2 / (2 * player.gravityMps2);
        assert.ok(Math.abs(peak - idealHeight) < 0.06);
        results.set(body.id, { peak, airtime: frames * 0.01 });
      } finally { player.character.dispose(); }
    }
    assert.ok(results.get('moon')!.peak > results.get('mars')!.peak * 2);
    assert.ok(results.get('mars')!.airtime > results.get('earth')!.airtime * 2);
  } finally { PhysicsWorld.setTerrain(null); }
});
