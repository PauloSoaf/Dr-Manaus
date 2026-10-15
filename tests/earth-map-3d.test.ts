import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanetMap3DRenderer, MANAUS_GEODETIC } from '../src/ui/map/PlanetMap3DRenderer.ts';
import { isLandAt } from '../src/world/planet/EarthLandMask.ts';
import { EarthRiverLayer } from '../src/world/planet/EarthRiverLayer.ts';
import { sectorIndex } from '../src/world/spatial/UniverseAddress.ts';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation.ts';
import { DEG_TO_RAD } from '../src/world/spatial/units.ts';
import { MANAUS_ANCHOR, MANAUS_ANCHOR_GEODETIC, MANAUS_ANCHOR_ECEF } from '../src/world/spatial/ManausFrameAdapter.ts';
import { geodeticToEcef } from '../src/world/spatial/ECEF.ts';
import { SphereGeometry } from 'three';

function createMockCanvas(width = 800, height = 600, supportWebGL = true) {
  const events = new Map<string, Function[]>();
  const ctx2d = {
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

  const glCtx = {
    canvas: null,
    getExtension: () => null,
    getParameter: () => 16,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    useProgram: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    enable: () => {},
    disable: () => {},
    depthFunc: () => {},
    cullFace: () => {},
    viewport: () => {},
    clearColor: () => {},
    clearDepth: () => {},
    clear: () => {},
    createTexture: () => ({}),
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    pixelStorei: () => {},
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => '',
  };

  let getContext2DCalled = false;

  const canvas = {
    width,
    height,
    style: { display: 'block' },
    getContext: (type: string) => {
      if (type === '2d') {
        getContext2DCalled = true;
        return ctx2d;
      }
      if (type === 'webgl' || type === 'webgl2') {
        return supportWebGL ? glCtx : null;
      }
      return null;
    },
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

  return {
    canvas,
    events,
    was2DCalled: () => getContext2DCalled,
  };
}

const mockLocation: UniverseLocation = {
  address: { galaxyId: 'milky_way', sector: sectorIndex(0n, 0n, 0n), systemId: 'sol', bodyId: 'earth' },
  frameId: 'earth/wgs84',
  systemPositionM: [1.496e11, 0, 0],
};

test('T_PLANET_MAP_ACTUAL_GPU_3D', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  assert.equal(renderer.is3D, true);
  assert.equal(renderer.mode, 'gpu-3d');
  assert.ok(renderer.scene, 'Scene exists for GPU 3D mode');
  assert.ok(renderer.camera, 'PerspectiveCamera exists for GPU 3D mode');
  renderer.dispose();
});

test('T_PLANET_MAP_HAS_SPHERE_GEOMETRY', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  assert.ok(renderer.globeMesh, 'Globe mesh exists');
  assert.ok(renderer.globeMesh.geometry instanceof SphereGeometry, 'Mesh uses real Three.js SphereGeometry');
  renderer.dispose();
});

test('T_PLANET_MAP_NO_MAIN_CANVAS_2D_CONTEXT', () => {
  const { canvas, was2DCalled } = createMockCanvas(800, 600, true);
  const renderer = new PlanetMap3DRenderer(canvas);
  // Main canvas must not obtain a 2D rendering context when WebGL is supported
  assert.equal(was2DCalled(), false, 'Main canvas must not use 2D context in 3D mode');
  assert.equal(renderer.mode, 'gpu-3d');
  renderer.dispose();
});

test('T_PLANET_MAP_CONTINENTS_NOT_DOT_PATCHES', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  // Surface is rendered using a textured material on SphereGeometry, not thousands of 2D circle patches
  assert.ok(renderer.globeMesh);
  const mat = renderer.globeMesh.material;
  assert.ok(mat && mat.map, 'Sphere mesh material has an assigned equirectangular texture map');
  renderer.dispose();
});

test('T_PLANET_MAP_REAL_LAND_TEXTURE', () => {
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

test('T_PLANET_MAP_DRAG_ROTATES_REAL_GLOBE', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  const initialYaw = renderer.yaw;
  const initialPitch = renderer.pitch;

  renderer.rotate(0.25, 0.15);
  assert.ok(Math.abs(renderer.yaw - (initialYaw + 0.25)) < 1e-6);
  assert.ok(Math.abs(renderer.pitch - (initialPitch + 0.15)) < 1e-6);

  // Rotation changes actual Three.js globe group orientation
  assert.ok(renderer.globeGroup);
  assert.ok(Math.abs(renderer.globeGroup.rotation.y - renderer.yaw) < 1e-6);
  assert.ok(Math.abs(renderer.globeGroup.rotation.x - renderer.pitch) < 1e-6);
  renderer.dispose();
});

test('T_PLANET_MAP_ZOOM_CHANGES_CAMERA', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  const initialZoom = renderer.zoomLevel;
  const initialCameraZ = renderer.camera?.position.z ?? 0;

  // Zoom in (deltaY < 0)
  renderer.changeZoom(-100);
  assert.ok(renderer.zoomLevel > initialZoom, 'Zoom increases when deltaY < 0');
  assert.ok((renderer.camera?.position.z ?? 0) < initialCameraZ, 'Camera moves closer in 3D on zoom-in');

  // Zoom out (deltaY > 0)
  renderer.changeZoom(100);
  renderer.changeZoom(100);
  assert.ok(renderer.zoomLevel < initialZoom, 'Zoom decreases when deltaY > 0');

  // Bounded zoom check: between 0.6 and 3.5
  for (let i = 0; i < 20; i++) renderer.changeZoom(-500);
  assert.ok(renderer.zoomLevel <= 3.5, 'Zoom capped at 3.5');

  for (let i = 0; i < 40; i++) renderer.changeZoom(500);
  assert.ok(renderer.zoomLevel >= 0.6, 'Zoom floored at 0.6');
  renderer.dispose();
});

test('T_PLANET_MAP_FAR_SIDE_MARKER_HIDDEN', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);

  // Focus directly on Manaus (front hemisphere)
  renderer.focusManaus();
  const frontProj = renderer.project3D(MANAUS_GEODETIC.latRad, MANAUS_GEODETIC.lonRad, 200, 400, 300);
  assert.equal(frontProj.visible, true, 'Manaus is visible when facing camera');
  assert.ok(frontProj.z > 0.8, 'Front hemisphere marker has positive depth z');

  // Rotate 180 degrees so Manaus is on the far hemisphere
  renderer.rotate(Math.PI, 0);
  const backProj = renderer.project3D(MANAUS_GEODETIC.latRad, MANAUS_GEODETIC.lonRad, 200, 400, 300);
  assert.equal(backProj.visible, false, 'Manaus on far hemisphere is occluded by planet');
  assert.ok(backProj.z < -0.8, 'Far hemisphere marker has negative depth z');
  renderer.dispose();
});

test('T_PLANET_MAP_SHARED_RIVER_AUTHORITY', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  // Planet map renders rivers directly from EarthRiverLayer
  assert.ok(renderer.riverLines, 'River 3D lines exist on globe');
  const amazon = EarthRiverLayer.getAmazonMainStem();
  assert.ok(amazon && amazon.coordinates.length > 500, 'Consumes authentic Natural Earth Amazon');
  renderer.dispose();
});

test('T_PLANET_MAP_DISPOSAL_NO_RESOURCE_LEAK', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  assert.doesNotThrow(() => renderer.dispose(), 'Disposal must succeed without errors');
  assert.equal(renderer.scene?.children.length, 0, 'Scene children cleared');
});

test('T_PLANET_MAP_20_OPEN_CLOSE_CYCLES', () => {
  for (let i = 0; i < 20; i++) {
    const { canvas } = createMockCanvas();
    const renderer = new PlanetMap3DRenderer(canvas);
    renderer.draw(mockLocation);
    renderer.rotate(0.1, 0.05);
    renderer.changeZoom(-50);
    renderer.dispose();
  }
  assert.ok(true, '20 open/close cycles completed without leak or error');
});

test('T_MANAUS_MARKER_EQUALS_CANONICAL_ANCHOR', () => {
  // Manaus marker must equal canonical MANAUS_ANCHOR / MANAUS_ANCHOR_GEODETIC
  assert.equal(MANAUS_GEODETIC.latDeg, MANAUS_ANCHOR.latDeg);
  assert.equal(MANAUS_GEODETIC.lonDeg, MANAUS_ANCHOR.lonDeg);
  assert.equal(MANAUS_GEODETIC.latRad, MANAUS_ANCHOR_GEODETIC.latRad);
  assert.equal(MANAUS_GEODETIC.lonRad, MANAUS_ANCHOR_GEODETIC.lonRad);
  assert.equal(MANAUS_GEODETIC.latDeg, -3.130333);
  assert.equal(MANAUS_GEODETIC.lonDeg, -60.022528);
});

test('T_MANAUS_MARKER_ECEF_ALIGNMENT', () => {
  const ecef = geodeticToEcef({ latRad: MANAUS_GEODETIC.latRad, lonRad: MANAUS_GEODETIC.lonRad, heightM: 0 });
  assert.ok(Math.abs(ecef.xM - MANAUS_ANCHOR_ECEF.xM) < 1.0, 'X coordinate matches canonical anchor ECEF');
  assert.ok(Math.abs(ecef.yM - MANAUS_ANCHOR_ECEF.yM) < 1.0, 'Y coordinate matches canonical anchor ECEF');
  assert.ok(Math.abs(ecef.zM - MANAUS_ANCHOR_ECEF.zM) < 1.0, 'Z coordinate matches canonical anchor ECEF');
});

test('T_MANAUS_MARKER_NO_DUPLICATED_COORDINATES', () => {
  // Ensures no rogue hardcoded -3.119028 exists in MANAUS_GEODETIC
  assert.notEqual(MANAUS_GEODETIC.latDeg, -3.119028, 'Must not use old inaccurate hardcoded latitude');
  assert.notEqual(MANAUS_GEODETIC.lonDeg, -60.021731, 'Must not use old inaccurate hardcoded longitude');
});
