import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Group, Vector3, Fog } from 'three/webgpu';
import { Atmosphere } from '../src/rendering/Atmosphere';
import { EarthGlobe } from '../src/world/planet/EarthGlobe';

test('T_ISSUE04_01_ATMOSPHERE_FOG_LIFT_IN_ORBIT', () => {
  const scene = new Scene();
  const atmosphere = new Atmosphere(scene);
  const fog = scene.fog as Fog;
  assert.ok(fog, 'Scene fog must be initialized by Atmosphere');

  const playerPos = new Vector3(0, 50, 0);

  // 1. Ground level: terrestrial fog range
  atmosphere.setAltitude(50);
  atmosphere.planetaryView = false;
  for (let i = 0; i < 20; i++) {
    atmosphere.update(0.1, playerPos);
  }
  const groundFogNear = fog.near;
  const groundFogFar = fog.far;
  assert.ok(groundFogNear >= 2000 && groundFogNear <= 4000, `Ground fog.near (${groundFogNear}) should be near 2800m`);
  assert.ok(groundFogFar >= 20000 && groundFogFar <= 35000, `Ground fog.far (${groundFogFar}) should be near 27000m`);

  // 2. High orbital climb: planetaryView = true, altitude = 150 km
  atmosphere.setAltitude(150_000);
  atmosphere.planetaryView = true;
  for (let i = 0; i < 60; i++) {
    atmosphere.update(0.1, playerPos);
  }
  const orbitFogNear = fog.near;
  const orbitFogFar = fog.far;
  assert.ok(orbitFogFar > groundFogFar * 10, `Orbital fog.far (${orbitFogFar}) must expand by orbitLift to avoid planetary truncation`);
  assert.ok(orbitFogNear > groundFogNear * 5, `Orbital fog.near (${orbitFogNear}) must expand beyond immediate ground view`);

  // 3. Re-entry descent: back to ground level
  atmosphere.setAltitude(50);
  atmosphere.planetaryView = false;
  for (let i = 0; i < 60; i++) {
    atmosphere.update(0.1, playerPos);
  }
  assert.ok(fog.far < orbitFogFar * 0.2, `Descent fog.far (${fog.far}) must contract back towards terrestrial range`);
});

test('T_ISSUE04_02_EARTH_GLOBE_ATMOSPHERE_SHELL_SMOOTH_FADE', () => {
  const parent = new Group();
  const globe = new EarthGlobe(parent);
  try {
    globe.visible = true;

    // 1. Below 15 km: atmospheric shell is completely inactive
    globe.setCenterM([0, 0, 0], undefined, 8_000);
    const uAtmo = (globe as any).uAtmosphereOpacity;
    assert.ok(uAtmo, 'uAtmosphereOpacity uniform must exist on EarthGlobe');
    assert.equal(uAtmo.value, 0, 'Atmosphere shell opacity must be 0 below 15 km');
    assert.equal((globe as any).atmosphereMesh.visible, false, 'Atmosphere shell must be hidden below 15 km');

    // 2. Intermediate altitude: 32.5 km (halfway between 15 km and 50 km)
    globe.setCenterM([0, 0, 0], undefined, 32_500);
    assert.ok(Math.abs(uAtmo.value - 0.5) < 0.05, `At 32.5 km, opacity (${uAtmo.value}) should be approximately 0.5 (smoothstep midpoint)`);
    assert.equal((globe as any).atmosphereMesh.visible, true, 'Atmosphere shell must be visible at 32.5 km');

    // 3. Above 50 km (stratopause / mesosphere): atmospheric shell at full opacity
    globe.setCenterM([0, 0, 0], undefined, 60_000);
    assert.equal(uAtmo.value, 1, 'Atmosphere shell opacity must be 1.0 above 50 km');
    assert.equal((globe as any).atmosphereMesh.visible, true, 'Atmosphere shell must be visible in orbit');

    // 4. Return to low altitude: smoothly fades back to 0
    globe.setCenterM([0, 0, 0], undefined, 10_000);
    assert.equal(uAtmo.value, 0, 'Atmosphere shell opacity must return to 0 on descent');
    assert.equal((globe as any).atmosphereMesh.visible, false);
  } finally {
    globe.dispose();
  }
});

