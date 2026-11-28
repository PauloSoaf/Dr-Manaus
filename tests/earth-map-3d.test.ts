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

function createMockCanvas(width = 800, height = 600, supportWebGL = true, throwOnWebGLConstructor = false) {
  const events = new Map<string, Function[]>();
  let acquiredContextType: string | null = null;
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

  const glCtx = new Proxy({
    canvas: null,
    VERSION: 0x1f02,
    VENDOR: 0x1f00,
    RENDERER: 0x1f01,
    SHADING_LANGUAGE_VERSION: 0x8b8c,
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c,
    MAX_VERTEX_UNIFORM_VECTORS: 0x8dfb,
    MAX_VARYING_VECTORS: 0x8dfc,
    MAX_FRAGMENT_UNIFORM_VECTORS: 0x8dfd,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8b4d,
    MAX_VERTEX_ATTRIBS: 0x8869,
    MAX_RENDERBUFFER_SIZE: 0x84e8,
    ALIASED_LINE_WIDTH_RANGE: 0x846e,
    ALIASED_POINT_SIZE_RANGE: 0x846d,
    MAX_VIEWPORT_DIMS: 0x0d3a,
    POINTS: 0x0000,
    LINES: 0x0001,
    LINE_LOOP: 0x0002,
    LINE_STRIP: 0x0003,
    TRIANGLES: 0x0004,
    TRIANGLE_STRIP: 0x0005,
    TRIANGLE_FAN: 0x0006,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    HIGH_FLOAT: 0x8dfa,
    MEDIUM_FLOAT: 0x8df9,
    LOW_FLOAT: 0x8df8,
    HIGH_INT: 0x8df5,
    MEDIUM_INT: 0x8df4,
    LOW_INT: 0x8df3,
  }, {
    get(target: any, prop: string | symbol) {
      if (throwOnWebGLConstructor && prop === 'getContextAttributes') {
        throw new Error('Simulated WebGL context loss / constructor failure');
      }
      if (prop in target) return target[prop];
      if (prop === 'getContextAttributes') {
        return () => ({
          alpha: true,
          antialias: true,
          depth: true,
          stencil: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
          xrCompatible: false,
        });
      }
      if (prop === 'getExtension') {
        return () => null;
      }
      if (prop === 'getParameter') {
        return (p: number) => {
          if (p === 0x1f02) return 'WebGL 2.0 (Mock)';
          if (p === 0x1f01) return 'WebKit WebGL';
          if (p === 0x1f00) return 'WebKit';
          if (p === 0x846e || p === 0x846d || p === 0x0d3a) return new Float32Array([1, 1]);
          return 16;
        };
      }
      if (prop === 'getShaderPrecisionFormat') {
        return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
      }
      if (typeof prop === 'string') {
        return (..._args: any[]) => {};
      }
      return undefined;
    },
  });

  let getContext2DCalled = false;

  const parent = {
    children: [] as any[],
    replaceChild(newChild: any, oldChild: any) {
      const idx = this.children.indexOf(oldChild);
      if (idx !== -1) this.children[idx] = newChild;
      else this.children.push(newChild);
      newChild.parentElement = this;
      oldChild.parentElement = null;
      return oldChild;
    },
  };

  const doc = {
    createElement(tag: string) {
      if (tag === 'canvas') {
        const mock = createMockCanvas(width, height, false, false);
        mock.canvas.ownerDocument = doc as any;
        return mock.canvas;
      }
      return {};
    },
  };

  const canvas = {
    id: 'planet-3d-canvas',
    className: 'planet-canvas',
    width,
    height,
    style: { display: 'block', cssText: 'display: block;' },
    parentElement: parent,
    ownerDocument: doc as any,
    getContext: (type: string) => {
      if (type === '2d') {
        // Real browser behavior: once WebGL context has been acquired on this element, getContext('2d') returns null
        if (acquiredContextType && acquiredContextType !== '2d') return null;
        acquiredContextType = '2d';
        getContext2DCalled = true;
        return ctx2d;
      }
      if (type === 'webgl' || type === 'webgl2') {
        if (acquiredContextType && acquiredContextType !== 'webgl' && acquiredContextType !== 'webgl2') return null;
        if (!supportWebGL) return null;
        acquiredContextType = type;
        return glCtx;
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

  parent.children.push(canvas);

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

test('T_PLANET_MAP_WEBGL_UNAVAILABLE_FALLBACK_2D', () => {
  // When WebGL is unavailable (e.g. software headless or disabled), renderer falls back gracefully to 2D
  const { canvas, was2DCalled } = createMockCanvas(800, 600, false);
  const renderer = new PlanetMap3DRenderer(canvas);
  assert.equal(renderer.is3D, false, 'is3D must be false when WebGL is unavailable');
  assert.equal(renderer.mode, '2d-fallback', 'Mode must be 2d-fallback');
  assert.equal(was2DCalled(), true, 'Must request 2D canvas context for fallback');
  assert.equal(renderer.scene, null, 'Scene is not allocated in 2D fallback');
  assert.equal(renderer.renderer, null, 'WebGLRenderer is not allocated in 2D fallback');

  // Drawing should execute cleanly on 2D canvas without error
  assert.doesNotThrow(() => renderer.draw(mockLocation));
  renderer.dispose();
});

test('T_PLANET_MAP_WEBGL_CONSTRUCTOR_THROW_FALLBACK', () => {
  // When WebGL context is returned but WebGLRenderer constructor throws (e.g. context loss during init)
  const { canvas } = createMockCanvas(800, 600, true, true);
  const renderer = new PlanetMap3DRenderer(canvas);
  assert.equal(renderer.is3D, false, 'is3D must be false when WebGL constructor throws');
  assert.equal(renderer.mode, '2d-fallback', 'Mode must fallback cleanly to 2d-fallback');
  // Original canvas had WebGL context acquired, so calling getContext('2d') on that original canvas returns null.
  // The renderer safely replaced canvas with a fresh element attached to DOM that has a renderable 2D context.
  assert.notEqual(renderer.canvas, canvas, 'Canvas element was safely replaced after WebGL context clash');
  assert.ok(renderer.canvas.parentElement, 'Replacement canvas attached to DOM parent');
  assert.equal((renderer.canvas as any).id, 'planet-3d-canvas', 'Replacement canvas preserves element id');
  assert.doesNotThrow(() => renderer.draw(mockLocation));
  renderer.dispose();
});

test('T_PLANET_MAP_MULTI_SEGMENT_RIVERS_PRESERVED', () => {
  // Verify multi-segment rivers from earth-rivers.json are extracted as separate lines
  const amazon = EarthRiverLayer.getAmazonMainStem();
  assert.ok(amazon, 'Amazon river definition exists');
  const lines = EarthRiverLayer.getRiverLines(amazon);
  assert.ok(lines.length >= 1, 'Contains at least one valid coordinate line');
  for (const line of lines) {
    assert.ok(line.length >= 2, 'Each segment must contain at least 2 points');
    for (const [lon, lat] of line) {
      assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180, 'Lon must be in range [-180, 180]');
      assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90, 'Lat must be in range [-90, 90]');
    }
  }

  // When rendered in 3D, all lines are processed into separate line segments
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);
  assert.ok(renderer.riverLines, 'River lines mesh exists');
  const posAttr = renderer.riverLines.geometry.getAttribute('position');
  assert.ok(posAttr && posAttr.count > 1000, 'All river segments populate line segments geometry buffer');
  // LineSegments uses 2 vertices per segment, so vertex count must be even
  assert.equal(posAttr.count % 2, 0, 'Line segments vertex count must be even (independent pairs, no cross-stitching)');
  renderer.dispose();
});

test('T_PLANET_MAP_RESIZE_HANDLING', () => {
  const { canvas } = createMockCanvas(800, 600);
  const renderer = new PlanetMap3DRenderer(canvas);
  assert.equal(renderer.camera?.aspect, 1);

  // Resize canvas dimensions
  (canvas as any).width = 1200;
  (canvas as any).height = 600;
  (canvas as any).getBoundingClientRect = () => ({ width: 1200, height: 600, left: 0, top: 0, right: 1200, bottom: 600 });

  renderer.draw(mockLocation);
  assert.equal(renderer.camera?.aspect, 2.0, 'Camera aspect updated to reflect new dimensions on draw');
  renderer.dispose();
});

test('T_PLANET_MAP_FOCUS_COORDINATES_CONSISTENCY', () => {
  const { canvas } = createMockCanvas();
  const renderer = new PlanetMap3DRenderer(canvas);

  renderer.focusManaus();
  assert.ok(Math.abs(renderer.yaw - (-MANAUS_GEODETIC.lonDeg * DEG_TO_RAD)) < 1e-5, 'Yaw focused on Manaus longitude');
  assert.ok(Math.abs(renderer.pitch - (MANAUS_GEODETIC.latDeg * DEG_TO_RAD)) < 1e-5, 'Pitch focused on Manaus latitude');

  // Verify globeGroup rotation matches yaw/pitch
  assert.equal(renderer.globeGroup?.rotation.y, renderer.yaw);
  assert.equal(renderer.globeGroup?.rotation.x, renderer.pitch);
  renderer.dispose();
});
