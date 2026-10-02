import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { SOLAR_SYSTEM_BODIES, flattening, gravitationalParameter } from '../src/world/celestial/CelestialBody.ts';
import { bodyProfile, SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile.ts';
import { planetBodyFromCelestial } from '../src/world/planet/PlanetBodyAdapter.ts';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory.ts';
import { MARS, MOON } from '../src/world/planet/PlanetBody.ts';
import { PlanetVolumeField } from '../src/world/planet/volume/PlanetVolumeField.ts';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';

test('T_BODY_PROFILE_COMPLETE / T_BODY_PHYSICS_NOT_DUPLICATED: all ten profiles contain capabilities only', () => {
  assert.equal(SOLAR_SYSTEM_BODIES.length, 10);
  for (const body of SOLAR_SYSTEM_BODIES) {
    assert.ok(Object.hasOwn(SOLAR_BODY_PROFILES, body.id));
    const profile = bodyProfile(body);
    assert.equal(typeof profile.canLand, 'boolean');
    assert.ok(profile.visual.albedo.every(Number.isFinite));
    for (const field of ['radiusM', 'massKg', 'rotationPeriodS', 'frameId', 'positionM', 'orbit']) {
      assert.ok(!(field in profile), `${body.id} duplicates ${field}`);
    }
    assert.equal(profile.supportsVolumeDestruction, profile.hasSolidSurface);
  }
});

test('T_PLANET_BODY_ADAPTER: catalog-derived Moon/Mars models preserve baseline physics within published rounding', () => {
  const baselines = [
    { body: MOON, radius: 1_738_100, flattening: 1 / 1130, mu: 4.902800e12 },
    { body: MARS, radius: 3_396_200, flattening: 1 / 169.81, mu: 4.282837e13 },
  ];
  for (const old of baselines) {
    const catalog = SOLAR_SYSTEM_BODIES.find(body => body.id === old.body.id)!;
    const derived = planetBodyFromCelestial(catalog);
    assert.deepEqual(derived, old.body);
    assert.equal(derived.semiMajorAxisM, old.radius);
    assert.equal(derived.flattening, flattening(catalog));
    assert.equal(derived.gravitationalParameter, gravitationalParameter(catalog));
    assert.equal(derived.rotationPeriodS, catalog.rotationPeriodS);
    // The old Moon ellipsoid used 1/1130; catalog polar radius differs by 562 m (<0.04%).
    assert.ok(Math.abs(derived.flattening - old.flattening) < 0.0004);
    assert.ok(Math.abs(derived.gravitationalParameter! / old.mu - 1) < 0.001);
  }
  assert.ok(planetBodyFromCelestial(SOLAR_SYSTEM_BODIES.find(body => body.id === 'venus')!).rotationPeriodS < 0);
});

test('T_PROVIDER_REGISTRY_DATA_DRIVEN / T_NO_GAS_GIANT_SURFACE_PROVIDER: only non-Earth solid bodies get terrain', () => {
  const universe = new UniverseRuntime();
  const providers = createPlanetProviders(new Group(), universe);
  assert.deepEqual([...providers.keys()], ['mercury', 'venus', 'moon', 'mars']);
  assert.equal(universe.providers.size, 4);
  for (const [id, provider] of providers) {
    assert.equal(provider.bodyDef.id, id);
    assert.equal(universe.providers.get(provider.id), provider);
    assert.equal(provider.stats.tiles, 0);
    assert.equal(provider.stats.visible, false);
    assert.equal(provider.presentationMode, 'off');
    assert.deepEqual(provider.plan({} as never), []);
    provider.globe.dispose();
  }
  for (const body of SOLAR_SYSTEM_BODIES.filter(body => !bodyProfile(body).hasSolidSurface)) {
    assert.equal(providers.has(body.id), false);
    assert.equal(surfaceForBody(body), undefined);
  }
});

test('T_VOLUME_CAPABILITY_BODY_SCOPED: every solid profile supplies the same volume field contract', () => {
  for (const body of SOLAR_SYSTEM_BODIES) {
    const surface = surfaceForBody(body);
    if (!bodyProfile(body).supportsVolumeDestruction) { assert.equal(surface, undefined); continue; }
    assert.ok(surface);
    const volume = new PlanetVolumeField(surface);
    assert.equal(volume.body.id, body.id);
    assert.ok(volume.signedDistanceBodyFixed([0, 0, 0]) < 0);
    assert.ok(volume.signedDistanceBodyFixed([body.equatorialRadiusM + 100_000, 0, 0]) > 0);
    if (bodyProfile(body).surfaceKind === 'synthetic-base') assert.equal(surface.heightAt([1, 0, 0]), 0);
  }
});

for (const bodyId of ['mercury', 'venus', 'moon', 'mars']) {
  test(`${bodyId} generic handoff preserves logical pose and supplies a body-specific ENU`, () => {
    const universe = new UniverseRuntime({ epochS: 0 });
    const body = universe.activeSystem.bodies.find(body => body.id === bodyId)!;
    const position = universe.activeSystem.positionOf(bodyId)!;
    const before: [number, number, number] = [position[0] + body.equatorialRadiusM + 1500, position[1], position[2]];
    universe.updateSystemPose(before, universe.activeSystem.stateOf(bodyId)!.velocityMps, 0);
    const local = universe.handoffTo(bodyId);
    assert.equal(universe.player.frame, `${bodyId}/local-enu`);
    assert.ok(Math.abs(local[1] - 1500) < 0.001);
    assert.equal(universe.location.address.bodyId, bodyId);
    assert.ok(Math.abs(universe.location.surface!.altitudeM - 1500) < 0.001);
    const after = universe.playerSystemPositionM();
    assert.ok(Math.hypot(...after.map((value, axis) => value - before[axis])) < 0.001);
  });
}

test('non-landable bodies cannot create a surface handoff frame', () => {
  const universe = new UniverseRuntime();
  for (const body of universe.activeSystem.bodies.filter(body => !bodyProfile(body).canLand)) {
    const before = universe.player.frame;
    universe.handoffTo(body.id);
    assert.equal(universe.player.frame, before);
    assert.equal(universe.frames.has(`${body.id}/local-enu`), false);
  }
});
