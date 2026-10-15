import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanetMap3DRenderer, MANAUS_GEODETIC } from '../src/ui/map/PlanetMap3DRenderer.ts';
import { isLandAt } from '../src/world/planet/EarthLandMask.ts';
import { EarthRiverLayer } from '../src/world/planet/EarthRiverLayer.ts';
import { sectorIndex } from '../src/world/spatial/UniverseAddress.ts';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation.ts';
import { DEG_TO_RAD } from '../src/world/spatial/units.ts';

function createMockCanvas(width = 800, height = 600) {
  const events = new Map<string, Function[]>();
  const ctx = {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    stroke() {},
    fill() {},
    arc() {},
    ellipse() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    save() {},
    restore() {},
    clip() {},
    fillText() {},
    strokeText() {},
    measureText: (s: string) => ({ width: s.length * 8 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData() {},
  };
  const canvas = {
    width,
    height,
    style: { display: 'block' },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0, right: width, bottom: height }),
    addEventListener: (type: string, handler: Function) => {
      const list = events.get(type) ?? [];
      list.push(handler);
      events.set(type, list);
    },
    removeEventListener: (type: string, handler: Function) => {
      const list = events.get(type);
      if (!list) return;
      events.set(type, list.filter(h => h !== handler));
    },
    dispatchEvent: (event: { type: string }) => {
      const list = events.get(event.type);
      if (list) for (const h of list) h(event);
      return true;
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, ctx, events };
}

const mockLocation: UniverseLocation = {
  address: { galaxyId: 'milky_way', sector: sectorIndex(0n, 0n, 0n), systemId: 'sol', bodyId: 'earth' },
  frameId: 'earth/wgs84',
  systemPositionM: [1.496e11, 0, 0],
};

test('T_EARTH_MAP_3D_EXISTS', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  assert.ok(renderer);
  assert.equal(renderer.is3D, true);
  assert.equal(typeof renderer.rotate, 'function');
  assert.equal(typeof renderer.changeZoom, 'function');
  renderer.dispose();
});

test('T_EARTH_MAP_NOT_2D_CIRCLE_ONLY', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  // 3D projection has depth: front hemisphere has z > 0, back hemisphere has z < 0
  const front = renderer.project3D(0, 0, 200, 400, 300);
  const back = renderer.project3D(0, Math.PI, 200, 400, 300);
  assert.notEqual(front.z, back.z);
  // Rotate by 90 degrees yaw: front moves to side, side moves to front
  const yawBefore = renderer.yaw;
  renderer.rotate(Math.PI / 2, 0);
  assert.notEqual(renderer.yaw, yawBefore);
  const rotated = renderer.project3D(0, 0, 200, 400, 300);
  assert.notEqual(front.screenX, rotated.screenX);
  renderer.dispose();
});

test('T_EARTH_MAP_CONTINENTS_VISIBLE', () => {
  // Manaus is on land in South America
  const manausIsLand = isLandAt(MANAUS_GEODETIC.latRad, MANAUS_GEODETIC.lonRad);
  assert.equal(manausIsLand, true, 'Manaus is on land');

  // Open Pacific Ocean (0°, -140°) is water
  const pacificIsLand = isLandAt(0, -140 * DEG_TO_RAD);
  assert.equal(pacificIsLand, false, 'Pacific ocean is water');

  // Open Atlantic Ocean (0°, -25°) is water
  const atlanticIsLand = isLandAt(0, -25 * DEG_TO_RAD);
  assert.equal(atlanticIsLand, false, 'Atlantic ocean is water');
});

test('T_EARTH_MAP_PLAYER_LATLON', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  // Focus on Manaus coordinates
  renderer.focusCoordinates(MANAUS_GEODETIC.latDeg, MANAUS_GEODETIC.lonDeg);
  const proj = renderer.project3D(MANAUS_GEODETIC.latRad, MANAUS_GEODETIC.lonRad, 200, 400, 300);
  // When focused on Manaus, Manaus should be on the front hemisphere and near screen center
  assert.ok(proj.visible, 'Manaus is on visible front hemisphere when focused');
  assert.ok(proj.z > 0.8, 'Manaus has high positive z when facing camera');
  assert.ok(Math.abs(proj.screenX - 400) < 30, 'screenX is centered');
  assert.ok(Math.abs(proj.screenY - 300) < 30, 'screenY is centered');
  renderer.dispose();
});

test('T_EARTH_MAP_DRAG_ROTATES', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  const initialYaw = renderer.yaw;
  const initialPitch = renderer.pitch;

  renderer.rotate(0.25, 0.15);
  assert.ok(Math.abs(renderer.yaw - (initialYaw + 0.25)) < 1e-6);
  assert.ok(Math.abs(renderer.pitch - (initialPitch + 0.15)) < 1e-6);
  renderer.dispose();
});

test('T_EARTH_MAP_WHEEL_ZOOM', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  const initialZoom = renderer.zoomLevel;

  // Zoom in (deltaY < 0)
  renderer.changeZoom(-100);
  assert.ok(renderer.zoomLevel > initialZoom, 'Zoom increases when deltaY < 0');

  // Zoom out (deltaY > 0)
  renderer.changeZoom(100);
  renderer.changeZoom(100);
  assert.ok(renderer.zoomLevel < initialZoom, 'Zoom decreases when deltaY > 0');

  // Bounded zoom check: cannot zoom past 3.5 or below 0.6
  for (let i = 0; i < 20; i++) renderer.changeZoom(-500);
  assert.ok(renderer.zoomLevel <= 3.5, 'Zoom capped at 3.5');

  for (let i = 0; i < 40; i++) renderer.changeZoom(500);
  assert.ok(renderer.zoomLevel >= 0.6, 'Zoom floored at 0.6');
  renderer.dispose();
});

test('T_EARTH_MAP_ROTATION_BOUNDED', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  const maxPitch = Math.PI / 2.2;

  // Try to push pitch way past 90 degrees
  renderer.rotate(0, 10.0);
  assert.ok(renderer.pitch <= maxPitch, `Pitch clamped at maxPitch (${maxPitch}), got ${renderer.pitch}`);

  // Try to push pitch way below -90 degrees
  renderer.rotate(0, -20.0);
  assert.ok(renderer.pitch >= -maxPitch, `Pitch clamped at -maxPitch (-${maxPitch}), got ${renderer.pitch}`);
  renderer.dispose();
});

test('T_EARTH_MAP_AMAZON_VISIBLE', () => {
  const amazon = EarthRiverLayer.getAmazonMainStem();
  assert.ok(amazon, 'Amazon main stem exists');
  assert.ok(amazon.coordinates.length > 20, 'Amazon has high-resolution control points');

  // Amazon river coordinates span longitude from roughly -73° (Peru/Andes) to -49° (Atlantic mouth)
  const lons = amazon.coordinates.map(c => c[0]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  assert.ok(minLon < -70, `Amazon starts in Andes west of -70°, got ${minLon}`);
  assert.ok(maxLon > -52, `Amazon empties into Atlantic east of -52°, got ${maxLon}`);
});

test('T_EARTH_MAP_MANAUS_MARKER_ALIGNED', () => {
  // Manaus marker authority check
  assert.ok(Math.abs(MANAUS_GEODETIC.latDeg - (-3.119028)) < 1e-5);
  assert.ok(Math.abs(MANAUS_GEODETIC.lonDeg - (-60.021731)) < 1e-5);

  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  renderer.focusCoordinates(MANAUS_GEODETIC.latDeg, MANAUS_GEODETIC.lonDeg);
  const proj = renderer.project3D(MANAUS_GEODETIC.latRad, MANAUS_GEODETIC.lonRad, 180, 400, 300);
  assert.equal(proj.visible, true);
  renderer.dispose();
});

test('T_EARTH_LANDMASK_CONTINENT_SANITY', () => {
  // South America (Brasília: -15.79°, -47.88°)
  assert.equal(isLandAt(-15.79 * DEG_TO_RAD, -47.88 * DEG_TO_RAD), true, 'Brasília is land');
  // Africa (Cairo: 30.04°, 31.23°)
  assert.equal(isLandAt(30.04 * DEG_TO_RAD, 31.23 * DEG_TO_RAD), true, 'Cairo is land');
  // Europe (Paris: 48.85°, 2.35°)
  assert.equal(isLandAt(48.85 * DEG_TO_RAD, 2.35 * DEG_TO_RAD), true, 'Paris is land');
  // Asia (Tokyo: 35.67°, 139.65°)
  assert.equal(isLandAt(35.67 * DEG_TO_RAD, 139.65 * DEG_TO_RAD), true, 'Tokyo is land');
  // North America (Chicago / Midwest: 41.88°, -87.63°)
  assert.equal(isLandAt(41.88 * DEG_TO_RAD, -87.63 * DEG_TO_RAD), true, 'Midwest North America is land');
  // Australia (Inland / Outback: -25.0°, 134.0°)
  assert.equal(isLandAt(-25.0 * DEG_TO_RAD, 134.0 * DEG_TO_RAD), true, 'Australia is land');
});
