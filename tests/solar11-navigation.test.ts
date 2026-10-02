import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three/webgpu';
import { SolarSystem } from '../src/world/celestial/SolarSystem.ts';
import { SOLAR_SYSTEM_BODIES } from '../src/world/celestial/CelestialBody.ts';
import { bodyArrivalPolicy, bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { bodyExclusionEnvelopes, resolveBodyDestination, selectBodyDestination } from '../src/world/travel/BodyNavigation.ts';
import { CosmicCruiseController, type CosmicCruiseContext } from '../src/world/travel/CosmicFlight.ts';
import { TravelDomain } from '../src/world/travel/TravelDomain.ts';

test('T_DESTINATION_ALL_PLANETS / T_LIVE_EPHEMERIS_ALL_PLANETS: identity selection resolves live positions', () => {
  const system = new SolarSystem({ epochS: 0 });
  const targets = system.bodies.map(body => selectBodyDestination(system, body.id)!);
  assert.equal(targets.length, 10);
  const before = targets.map(target => [...resolveBodyDestination(system, target)!.positionM]);
  system.update(86_400 * 30);
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const body = system.bodies[i];
    assert.ok(!('positionM' in target), 'selection cannot capture ephemeris or teleport');
    const resolved = resolveBodyDestination(system, target)!;
    assert.deepEqual(resolved.positionM, system.positionOf(target.bodyId));
    assert.equal(resolved.arrivalMarginM, bodyArrivalPolicy(body).arrivalMarginM);
    if (body.parentId) assert.notDeepEqual(resolved.positionM, before[i]);
  }
  assert.equal(selectBodyDestination(system, 'missing'), undefined);
});

for (const bodyId of ['mercury', 'mars', 'jupiter', 'neptune']) {
  test(`T_COSMIC_CRUISE_GENERIC_TARGET: ${bodyId} engages using the same live target policy`, () => {
    const system = new SolarSystem();
    const target = resolveBodyDestination(system, selectBodyDestination(system, bodyId))!;
    const controller = new CosmicCruiseController();
    const initial: [number, number, number] = [target.positionM[0], target.positionM[1] - target.radiusM * 100, target.positionM[2]];
    const result = controller.update({ systemId: 'sol', positionM: initial, velocityMps: [0, 0, 0] },
      1 / 60, new Vector3(), { altitudeM: 1e10, speedMps: 0, requested: true,
        nearestColliderM: Infinity, bodyRadiusM: 0, bodyId: 'none', target,
        cameraForwardBary: new Vector3(0, 1, 0), inputBoost: true, inputBrake: false,
        exclusionEnvelopes: bodyExclusionEnvelopes(system) });
    assert.ok(result.positionM[1] > initial[1]);
    assert.equal(controller.getTelemetry().targetBodyId, bodyId);
    assert.equal(controller.getTelemetry().phase, 'acceleration');
    assert.ok(Number.isFinite(controller.getTelemetry().timeToTargetS));
  });
}

for (const body of SOLAR_SYSTEM_BODIES.filter(body => !bodyProfile(body).hasSolidSurface)) {
  test(`safe sweep excludes ${body.id} even when unselected and another body is dominant`, () => {
    const system = new SolarSystem();
    const envelope = bodyExclusionEnvelopes(system).find(envelope => envelope.bodyId === body.id)!;
    const [x, y, z] = envelope.centreM;
    const initial: [number, number, number] = [x, y - envelope.radiusM * 3, z];
    const context: CosmicCruiseContext = {
      altitudeM: 1e11, speedMps: 1e12, requested: false, nearestColliderM: Infinity,
      bodyRadiusM: 0, bodyId: 'none', cameraForwardBary: new Vector3(0, 1, 0),
      inputBoost: false, inputBrake: false, maxRelativeSpeedMps: 1e12,
      exclusionEnvelopes: bodyExclusionEnvelopes(system),
    };
    const result = new CosmicCruiseController().update({ systemId: 'sol', positionM: initial,
      velocityMps: [0, envelope.radiusM * 30, 0] }, 0.25, new Vector3(), context);
    assert.ok(result.positionM[1] < y - envelope.radiusM, 'high-speed step must stop on the entry side');
    assert.ok(Math.hypot(result.positionM[0] - x, result.positionM[1] - y, result.positionM[2] - z) >= envelope.radiusM);
    const domain = new TravelDomain();
    domain.update({ ...context, altitudeM: 20_000, requested: true }, 1 / 60);
    domain.update({ ...context, altitudeM: 0, speedMps: 0, surfaceReady: bodyProfile(body).canLand }, 1 / 60);
    assert.equal(domain.kind, 'interplanetary');
  });
}

test('arrival clearances scale by capabilities and dominant-body telemetry remains gravitational', () => {
  const system = new SolarSystem();
  for (const body of system.bodies) {
    const policy = bodyArrivalPolicy(body);
    const position = system.positionOf(body.id)!;
    if (bodyProfile(body).hasSolidSurface) assert.ok(policy.arrivalMarginM >= 50_000);
    else assert.ok(policy.arrivalMarginM >= body.equatorialRadiusM * 0.25);
    const near: [number, number, number] = [position[0], position[1] + body.equatorialRadiusM * 1.5, position[2]];
    assert.equal(system.dominantBody(near).id, body.id);
  }
});

test('a selected solid destination permits manual descent once it is the dominant body', () => {
  const system = new SolarSystem();
  const target = resolveBodyDestination(system, selectBodyDestination(system, 'moon'))!;
  const [x, y, z] = target.positionM;
  const initial: [number, number, number] = [x, y + target.radiusM + 60_000, z];
  const result = new CosmicCruiseController().update({ systemId: 'sol', positionM: initial,
    velocityMps: [0, -200_000, 0] }, 0.25, new Vector3(), {
      altitudeM: 60_000, speedMps: 200_000, requested: false, nearestColliderM: Infinity,
      bodyRadiusM: target.radiusM, bodyPositionM: target.positionM, bodyId: 'moon',
      cameraForwardBary: new Vector3(0, -1, 0), inputBoost: false, inputBrake: false,
      exclusionEnvelopes: bodyExclusionEnvelopes(system), target,
    });
  assert.ok(result.positionM[1] < y + target.radiusM + target.arrivalMarginM,
    'arrival assistance must not become an impassable 50 km floor for a landable destination');
  assert.ok(result.positionM[1] >= y + target.radiusM + 1000);
});
