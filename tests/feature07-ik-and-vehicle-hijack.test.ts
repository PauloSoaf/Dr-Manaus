import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Object3D, Vector3 } from 'three';
import { TwoBoneIKSolver } from '../src/player/animations/TwoBoneIKSolver';
import { AnimationController } from '../src/player/animations/AnimationController';
import { FluvialVesselSystem } from '../src/world/traffic/FluvialVesselSystem';
import { TrafficSystem } from '../src/world/traffic/TrafficSystem';
import { RoadGraph } from '../src/world/traffic/RoadGraph';

test('CT-07-01: TwoBoneIKSolver solves leg kinematics via Law of Cosines and bypasses when airborne', () => {
  const hip = new Object3D();
  const knee = new Object3D();
  const foot = new Object3D();
  const pelvis = new Object3D();

  hip.position.set(0, 1.0, 0);
  knee.position.set(0, 0.5, 0);
  foot.position.set(0, 0.08, 0);

  const ik = new TwoBoneIKSolver(
    hip, knee, foot,
    hip.clone(), knee.clone(), foot.clone()
  );

  // 1. Solve when grounded on flat ground
  ik.solve(0.016, true, false, pelvis);
  assert.ok(isFinite(knee.rotation.x), 'Knee angle must be finite');
  assert.ok(isFinite(pelvis.position.y), 'Pelvis height must be finite');

  // 2. Solve when airborne (flying)
  knee.rotation.x = 0;
  ik.solve(0.016, false, true, pelvis);
  assert.strictEqual(knee.rotation.x, 0, 'Knee should not be modified by IK when airborne');
  assert.ok(Math.abs(ik.pelvisOffset) < 0.01, 'Pelvis offset must smoothly reset to 0 in air');

  // 3. Terrain contact sampling
  const contact = ik.sampleTerrainContact(100, 200);
  assert.ok(isFinite(contact.height), 'Terrain height must be finite');
  assert.ok(contact.normal.y > 0.6, 'Terrain normal must point predominantly upwards');
});

// CT-07-02 (procedural spine aim) was removed with the feature: bone poses come only from
// authored clips, and the aim rotation replaced the animated spine instead of adding to it.
test('CT-07-03: Traffic and River Vessel search locates nearby vehicles for instant player jacking', () => {
  const root = new Object3D();
  const vessels = new FluvialVesselSystem(root as any);

  try {
    // Run 1 frame so vessels are initialized and active
    vessels.update(0.016, 0.016, 0, 0);

    const activeList = vessels.activeVessels.filter(v => v.active);
    assert.ok(activeList.length > 0, 'Active vessels must exist');

    const firstVessel = activeList[0];
    const foundBoat = vessels.findNearestBoat(new Vector3(firstVessel.x + 2, firstVessel.y, firstVessel.z + 2), 20.0);

    assert.ok(foundBoat !== null, 'Should find nearby vessel within 20m');
    assert.strictEqual(foundBoat!.index, firstVessel.index);
    assert.strictEqual(foundBoat!.vClass, firstVessel.vesselClass);
  } finally {
    vessels.dispose();
  }
});

