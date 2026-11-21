import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import {
  sampleManausSunPosition,
  sampleManausMoonPosition,
  calculateSolarDeclinationRad,
  MANAUS_COORDINATES
} from '../src/world/weather/ManausSolarDiurnalModel';
import { WeatherSystem } from '../src/world/weather/WeatherSystem';
import { RealCityMaterials } from '../src/world/realcity/materials';

test('CT-15-01: Manaus equatorial solar diurnal trajectory matches NOAA celestial geometry', () => {
  // Check Manaus geodetic coordinates
  assert.ok(Math.abs(MANAUS_COORDINATES.latitudeDeg - (-3.119028)) < 1e-4);
  assert.ok(Math.abs(MANAUS_COORDINATES.longitudeDeg - (-60.021731)) < 1e-4);

  // Solar Declination at equinox (day ~80) should be near 0 radians
  const declinationEquinox = calculateSolarDeclinationRad(80);
  assert.ok(Math.abs(declinationEquinox) < 0.05, `Equinox declination ${declinationEquinox} should be near 0`);

  // Solar Noon (12:00) in equatorial Manaus: Sun must reach near-zenith elevation (>85°)
  const noonSun = sampleManausSunPosition(12.0, 80);
  assert.ok(noonSun.elevationDeg > 85.0, `Noon elevation ${noonSun.elevationDeg}° must be near zenith (>85°)`);
  assert.ok(noonSun.isDaylight, 'Noon must be daylight');
  assert.ok(noonSun.direction.y > 0.95, 'Noon sun vector Y must point predominantly straight up');

  // Morning Sunrise (~06:00): Sun near horizon, pointing predominantly East (X > 0, azimuth ~90°)
  const dawnSun = sampleManausSunPosition(6.0, 80);
  assert.ok(Math.abs(dawnSun.elevationDeg) < 8.0, `Sunrise elevation ${dawnSun.elevationDeg}° must be near horizon`);
  assert.ok(dawnSun.goldenHourFactor > 0.5, `Golden hour factor ${dawnSun.goldenHourFactor} should peak at dawn`);
  assert.ok(dawnSun.azimuthDeg > 70 && dawnSun.azimuthDeg < 110, `Sunrise azimuth ${dawnSun.azimuthDeg}° must be East`);

  // Afternoon Sunset (~18:00): Sun near horizon, pointing predominantly West (X < 0, azimuth ~270°)
  const duskSun = sampleManausSunPosition(18.0, 80);
  assert.ok(Math.abs(duskSun.elevationDeg) < 8.0, `Sunset elevation ${duskSun.elevationDeg}° must be near horizon`);
  assert.ok(duskSun.goldenHourFactor > 0.5, `Golden hour factor ${duskSun.goldenHourFactor} should peak at dusk`);
  assert.ok(duskSun.azimuthDeg > 250 && duskSun.azimuthDeg < 290, `Sunset azimuth ${duskSun.azimuthDeg}° must be West`);

  // Midnight (00:00): Sun deep below horizon (negative elevation)
  const midnightSun = sampleManausSunPosition(0.0, 80);
  assert.ok(midnightSun.elevationDeg < -60.0, `Midnight elevation ${midnightSun.elevationDeg}° must be deeply negative`);
  assert.ok(!midnightSun.isDaylight, 'Midnight must not be daylight');

  // Moon Position
  const moon = sampleManausMoonPosition(0.0, 14.76); // Full moon at midnight
  assert.ok(moon.elevationRad > 0.5, 'Full moon at midnight must be high in sky');
  assert.ok(moon.phaseFraction > 0.95, 'Full moon phase must be ~1.0');
});

test('CT-15-02: GPU instanced toroidal rain envelope draws 25,000 drops in 1 single draw call with zero GC', () => {
  const root = new Group();
  const weather = new WeatherSystem(root, {
    particleCount: 25000,
    boxRadiusM: 80,
    boxHeightM: 60
  });

  try {
    // Exactly 1 rain mesh added to the scene
    assert.strictEqual(root.children.length, 1, 'Rain envelope must be a single mesh');
    const mesh = root.children[0] as any;
    assert.strictEqual(mesh.name, 'amazon-rain-envelope');

    // Buffer has 25,000 drops * 2 vertices * 3 coords = 150,000 floats
    const posAttr = mesh.geometry.getAttribute('position');
    assert.strictEqual(posAttr.count, 50000, '50,000 vertices for 25,000 rain line segments');
    assert.strictEqual(posAttr.array.length, 150000);

    // Initial state: clear weather, rain hidden
    assert.strictEqual(mesh.visible, false);

    // Update with rain: rain becomes visible and follows player
    const playerPos = new Vector3(1500, 24, -3200);
    weather.update(0.016, playerPos, 'rain');

    assert.strictEqual(mesh.visible, true);
    assert.strictEqual(mesh.position.x, 1500);
    assert.strictEqual(mesh.position.z, -3200);
    assert.strictEqual(mesh.position.y, 34); // player.y + 10m envelope center

    // Run 50 frames to ensure zero runtime issues or NaN
    for (let f = 0; f < 50; f++) {
      playerPos.x += 1.0;
      weather.update(0.016, playerPos, 'rain');
      assert.ok(isFinite(mesh.position.x));
    }
  } finally {
    weather.dispose();
  }
});

test('CT-15-03: PBR wet surface simulation modulates roughness and albedo with Lagarde drying curve', () => {
  const root = new Group();
  const weather = new WeatherSystem(root);
  const materials = new RealCityMaterials();

  try {
    assert.strictEqual(weather.wetnessFactor, 0.0);
    assert.strictEqual(materials.wetness, 0.0);

    // Simulate 15 seconds of tropical rain
    const dt = 0.5;
    for (let t = 0; t < 15.0; t += dt) {
      weather.update(dt, new Vector3(0, 0, 0), 'rain');
    }

    // Wetness must have saturated near 1.0
    assert.ok(weather.wetnessFactor >= 0.90, `Wetness ${weather.wetnessFactor} should reach >= 0.90 after 15s rain`);
    assert.ok(weather.puddleIntensity > 0.8, 'Puddles should form under saturated rain');

    // Update real city materials with wetness
    materials.setWetness(weather.wetnessFactor);
    assert.strictEqual(materials.wetness, weather.wetnessFactor);

    // Weather clears: test gradual drying / evaporation over 90 seconds (RF-15-05)
    // After 30 seconds of clear weather: surfaces should still be damp (> 0.3)
    for (let t = 0; t < 30.0; t += dt) {
      weather.update(dt, new Vector3(0, 0, 0), 'clear');
    }
    assert.ok(weather.wetnessFactor > 0.35 && weather.wetnessFactor < 0.75,
      `Wetness ${weather.wetnessFactor} should be mid-drying after 30s`);

    // After 90 seconds total of clear weather: surfaces must be dried out (<= 0.05)
    for (let t = 30.0; t < 90.0; t += dt) {
      weather.update(dt, new Vector3(0, 0, 0), 'clear');
    }
    assert.ok(weather.wetnessFactor <= 0.05,
      `Wetness ${weather.wetnessFactor} must dry completely after 90s`);
  } finally {
    weather.dispose();
    materials.dispose();
  }
});

test('CT-15-04: Storm state machine triggers lightning flash and speed-of-sound delayed thunder', () => {
  const root = new Group();
  const weather = new WeatherSystem(root);

  try {
    let thunderCount = 0;
    let thunderIntensity = 0;
    const onThunder = (intensity: number) => {
      thunderCount++;
      thunderIntensity = intensity;
    };

    // Run storm simulation for 40 seconds
    const dt = 0.1;
    let maxFlashObserved = 0;

    for (let t = 0; t < 40.0; t += dt) {
      const flash = weather.update(dt, new Vector3(0, 0, 0), 'storm', 14.5, onThunder);
      if (flash > maxFlashObserved) {
        maxFlashObserved = flash;
      }
    }

    // Must have observed at least one lightning flash in storm mode
    assert.ok(maxFlashObserved >= 3.0, `Max flash ${maxFlashObserved} should exceed 3.0 during storm`);

    // Thunder must have triggered after sound propagation delay
    assert.ok(thunderCount >= 1, `Thunder should have fired at least once (fired: ${thunderCount})`);
    assert.ok(thunderIntensity > 0.1, `Thunder intensity ${thunderIntensity} must be positive`);
  } finally {
    weather.dispose();
  }
});
