import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three/webgpu';
import { Game } from '../src/game/Game';
import { RuntimeMotionTrace } from '../src/game/RuntimeMotionTrace';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { VehicleController } from '../src/player/vehicles/VehicleController';
import { MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter';
import { foundationLab } from './helpers/foundation-lab';

test('the production motion phase routes enter, pilot and dismount through one authority', t => {
  const lab = foundationLab(new Vector3(0, 75, 0));
  const vehicle = new VehicleController();
  t.after(() => { vehicle.dispose(); lab.player.character.dispose(); PhysicsWorld.setTerrain(null); });
  PhysicsWorld.setTerrain({ heightAt: () => 0 });
  vehicle.spawnAt(lab.player.position, 0, 'saucer');

  const game = Object.assign(Object.create(Game.prototype), {
    player: lab.player,
    vehicle,
    input: lab.player.input,
    camera: { yaw: 0, pitch: 0 },
    colliders: [],
    curvedColliders: [],
    stressRoute: [],
    playerStepStart: new Vector3(),
    vehicleStepStart: new Vector3(),
    hud: { notify: () => undefined },
    motionTrace: new RuntimeMotionTrace(),
    travelDomain: { localPhysicsActive: true },
    universe: { player: { frame: MANAUS_FRAME_ID } },
  });
  assert.equal(game.manausSimulationActive, true);
  lab.edges.add('KeyE');
  game.updateVehicleControls();
  assert.equal(vehicle.isOccupied, true);
  assert.equal(lab.edges.has('KeyE'), false);

  lab.held.add('Space');
  lab.edges.add('Space');
  game.stepLocalMotion(1 / 30, 1 / 30, 10, true);
  assert.ok(vehicle.velocity.y > 0);
  assert.equal(lab.edges.has('Space'), true, 'personal jump did not consume the edge');
  assert.deepEqual(lab.player.position.toArray(), vehicle.position.toArray());
  assert.deepEqual(lab.player.velocity.toArray(), vehicle.velocity.toArray());
  assert.equal(lab.player.isFlying, false);

  lab.held.clear();
  lab.edges.clear();
  lab.edges.add('KeyE');
  game.updateVehicleControls();
  assert.equal(vehicle.isOccupied, false);
  assert.equal(lab.player.position.y, vehicle.position.y);
  assert.equal(lab.player.state, 'Falling');
  assert.equal(lab.player.model.visible, true);
  game.updateVehicleControls();
  assert.equal(vehicle.isOccupied, false, 'one edge does not mount again');
  lab.player.position.set(500, 5, 500);
  lab.edges.add('KeyE');
  game.updateVehicleControls();
  assert.equal(lab.edges.has('KeyE'), true, 'leave the spatial power available outside vehicle reach');
});
