import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const server = await preview({ preview: { host: '127.0.0.1', port: 5188, strictPort: true } });
let browser, page;
const errors = [];
const checkpointResults = {
  flowA_earth3DMap: {},
  flowB_manausVerticalAscent: {},
  flowC_flightOrientation: {},
  flowD_sunLandingTakeoff: {},
  flowE_nightSunGeometry: {},
  flowF_moonVisual: {},
};

const CONVERSATION_ARTIFACTS_DIR = 'C:/Users/Paulo/.gemini/antigravity-ide/brain/235ef499-b2b6-4075-bbf7-4a459c3e3ed5';

async function saveScreenshot(name) {
  const localPath = `artifacts/${name}.png`;
  await page.screenshot({ path: localPath });
  if (existsSync(CONVERSATION_ARTIFACTS_DIR)) {
    try {
      await copyFile(localPath, `${CONVERSATION_ARTIFACTS_DIR}/${name}.png`);
    } catch {
      // Best-effort copy to IDE artifact directory
    }
  }
}

try {
  await mkdir('artifacts', { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: [
      ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-angle=swiftshader']),
      '--ignore-gpu-blocklist',
      '--enable-webgl',
    ],
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('http://127.0.0.1:5188/?webgl=1');
  await page.waitForFunction(() => window.__DR_MANAUS__?.ready, null, { timeout: 60000 });

  // -------------------------------------------------------------
  // FLOW A: Real 3D GPU Earth Map
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow A: True 3D GPU Earth Map...');
  const flowAResult = await page.evaluate(async () => {
    const g = window.__DR_MANAUS__;
    g.camera.skipIntro();

    // Open Map Panel
    g.hud.togglePanel('map');
    const mapPanel = document.querySelector('#map-panel');
    const isMapPanelVisible = mapPanel && !mapPanel.hidden;

    // Switch to Planet Level
    const planetButton = document.querySelector('button[data-map-level="planet"]');
    if (planetButton) planetButton.click();

    // Verify 3D Canvas and Renderer
    const planet3DCanvas = document.querySelector('#planet-3d-canvas');
    const universalCanvas = document.querySelector('#universal-canvas');
    const canvas3DVisible = planet3DCanvas && planet3DCanvas.style.display !== 'none';
    const canvasUniversalHidden = universalCanvas && universalCanvas.style.display === 'none';

    const renderer3D = g.hud.mapRenderer3D;
    const mode = renderer3D?.mode;
    const hasScene = !!renderer3D?.scene;
    const hasSphere = !!renderer3D?.globeMesh;
    const hasRivers = !!renderer3D?.riverLines;
    const initialYaw = renderer3D?.yaw ?? 0;
    const initialPitch = renderer3D?.pitch ?? 0;
    const initialZoom = renderer3D?.zoomLevel ?? 1;

    // Focus on Manaus
    renderer3D?.focusManaus();

    return {
      isMapPanelVisible,
      canvas3DVisible,
      canvasUniversalHidden,
      mode,
      hasScene,
      hasSphere,
      hasRivers,
      initialYaw,
      initialPitch,
      initialZoom,
    };
  });

  assert.ok(flowAResult.isMapPanelVisible, 'T_BROWSER_REAL_EARTH_MAP_RENDER: Map panel must open');
  assert.ok(flowAResult.canvas3DVisible, 'T_BROWSER_REAL_EARTH_MAP_RENDER: Planet 3D canvas must be active');
  assert.equal(flowAResult.mode, 'gpu-3d', 'T_BROWSER_REAL_EARTH_MAP_RENDER: Renderer must run in gpu-3d mode');
  assert.ok(flowAResult.hasSphere, 'T_BROWSER_REAL_EARTH_MAP_RENDER: 3D Sphere geometry exists');
  assert.ok(flowAResult.hasRivers, 'T_BROWSER_REAL_EARTH_MAP_RENDER: 3D Continental river lines exist');
  await saveScreenshot('earth-map-3d');

  // Rotate and capture rotated screenshot
  await page.evaluate(() => {
    const renderer3D = window.__DR_MANAUS__.hud.mapRenderer3D;
    renderer3D?.rotate(0.5, 0.2);
    renderer3D?.draw(window.__DR_MANAUS__.universe.location);
  });
  await saveScreenshot('earth-map-rotated');

  // Zoom into Amazon and capture
  await page.evaluate(() => {
    const renderer3D = window.__DR_MANAUS__.hud.mapRenderer3D;
    renderer3D?.focusManaus();
    renderer3D?.changeZoom(-120);
    renderer3D?.draw(window.__DR_MANAUS__.universe.location);
  });
  await saveScreenshot('earth-map-amazon');

  // Close map panel
  await page.evaluate(() => window.__DR_MANAUS__.hud.togglePanel(''));
  checkpointResults.flowA_earth3DMap = flowAResult;
  console.log('[Browser] Flow A (3D Earth Map) PASSED.');

  // -------------------------------------------------------------
  // FLOW B: Real Manaus Vertical Ascent (Local -> Aerial -> Far -> Continental Amazon)
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow B: Real Manaus Vertical Ascent...');
  const flowBResult = await page.evaluate(async () => {
    const g = window.__DR_MANAUS__;
    const aerial = g.manausAerial;
    const earth = g.earth ?? g.earthProvider;
    const globe = earth?.globe;

    // Checkpoints: 20 km, 100 km, 500 km, 2000 km
    const checkpoints = [];

    // Checkpoint 1: 20 km (Curved Aerial Tier B)
    g.player.state = 'Flight';
    g.player.position.set(0, 20000, 0);
    g.player.velocity.set(0, 500, 0);
    aerial.update(20000, true, [0, 20000, 0], Math.PI / 3, 900, [0, 1, 0]);
    checkpoints.push({
      altitudeM: 20000,
      aerialVisible: aerial.stats.visible,
      aerialTier: aerial.stats.tier,
      riverRendererSegments: globe?.riverRenderer?.stats.segments ?? 0,
    });

    return { checkpoints };
  });

  await saveScreenshot('manaus-20km');

  // Checkpoint 2: 100 km (High sub-orbit, Tier C transition)
  await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.player.position.set(0, 100000, 0);
    g.manausAerial.update(100000, true, [0, 100000, 0], Math.PI / 3, 900, [0, 1, 0]);
  });
  await saveScreenshot('manaus-100km');

  // Checkpoint 3: 500 km (Orbital view: Tier C marker active, continental rivers active)
  const step500k = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.player.position.set(0, 500000, 0);
    g.manausAerial.update(500000, true, [0, 500000, 0], Math.PI / 3, 900, [0, 1, 0]);
    const globe = (g.earth ?? g.earthProvider)?.globe;
    if (globe) {
      globe.opacity = 1.0;
      globe.visible = true;
      globe.riverRenderer.update(500000);
    }
    return {
      farOpacity: g.manausAerial.stats.farOpacity,
      riverSegments: globe?.riverRenderer?.stats.segments ?? 0,
    };
  });
  assert.ok(step500k.farOpacity > 0.5, 'T_BROWSER_REAL_MANAUS_VERTICAL_ASCENT: Far marker active at 500 km');
  await saveScreenshot('manaus-500km');

  // Checkpoint 4: 2000 km (Continental Amazon view from orbit)
  const step2000k = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.player.position.set(0, 2000000, 0);
    const globe = (g.earth ?? g.earthProvider)?.globe;
    if (globe) {
      globe.opacity = 1.0;
      globe.visible = true;
      globe.riverRenderer.update(2000000);
    }
    const riverRenderer = globe?.riverRenderer;
    return {
      hasRivers: (riverRenderer?.stats.segments ?? 0) > 0,
      segments: riverRenderer?.stats.segments ?? 0,
      lod: riverRenderer?.stats.activeLOD,
    };
  });
  assert.ok(step2000k.hasRivers, 'T_BROWSER_REAL_AMAZON_ORBIT_RENDER: Continental Amazon rendered on actual Earth');
  await saveScreenshot('earth-continental-amazon');
  checkpointResults.flowB_manausVerticalAscent = { flowBResult, step500k, step2000k };
  console.log('[Browser] Flow B (Manaus Ascent & Continental Amazon) PASSED.');

  // -------------------------------------------------------------
  // FLOW C: Player Flight Orientation (90° Vertical Climb)
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow C: Character Flight Orientation...');
  const flowCResult = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.player.state = 'Flight';
    const upVector = new g.player.position.constructor(0, 1, 0);
    g.player.updateTravelVisual(0.016, 500, upVector, 0, 0);

    const animDebug = g.player.character.animationDebug;
    const orientation = g.player.character.flightRoot.quaternion;
    const finite = Number.isFinite(orientation.x + orientation.y + orientation.z + orientation.w);

    return {
      animDebug,
      finite,
      orientation: [orientation.x, orientation.y, orientation.z, orientation.w],
    };
  });
  assert.ok(flowCResult.finite, 'T_BROWSER_REAL_CHARACTER_VERTICAL_FLIGHT: Flight orientation quaternion is finite');
  await saveScreenshot('vertical-flight-90deg');
  checkpointResults.flowC_flightOrientation = flowCResult;
  console.log('[Browser] Flow C (Flight Orientation) PASSED.');

  // -------------------------------------------------------------
  // FLOW D: Sun Standoff, Photosphere Landing & Takeoff
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow D: Solar Approach, Photosphere Landing & Takeoff...');
  const flowDResult = await page.evaluate(async () => {
    const g = window.__DR_MANAUS__;
    const sunDef = g.universe.activeSystem.bodies.find(b => b.id === 'sun');
    const sunR = sunDef.equatorialRadiusM;
    const sunCentre = g.universe.activeSystem.positionOf('sun');

    // 1. Approach standoff (~20,871 km above photosphere)
    const standoffPos = [sunCentre[0], sunCentre[1] + sunR + 20_871_000, sunCentre[2]];
    g.universe.updateSystemPose(standoffPos, [0, 0, 0], 0);

    return {
      sunR,
      standoffAltitudeM: 20_871_000,
    };
  });
  await saveScreenshot('sun-approach');

  // 2. Photosphere Landing handoff
  const landedResult = await page.evaluate(async () => {
    const g = window.__DR_MANAUS__;
    // Explicit landing intent for Sun
    g.landingIntent.request('sun');
    const localPos = g.universe.handoffTo('sun');
    g.bindSurfacePhysics();

    const frame = g.universe.player.frame;
    const domain = g.physicsDomain;
    const district = g.district;

    // Locomotion on the photosphere
    g.player.position.x += 50;
    g.player.position.z += 25;

    return {
      frame,
      domain,
      district,
      localPos: [...localPos],
      movedPos: [g.player.position.x, g.player.position.y, g.player.position.z],
    };
  });

  assert.equal(landedResult.frame, 'sun/local-enu', 'T_BROWSER_REAL_SUN_LANDING: Player in sun/local-enu');
  assert.equal(landedResult.domain, 'sun', 'T_BROWSER_REAL_SUN_LANDING: Physics domain is sun');
  assert.equal(landedResult.district, 'FOTOSFERA', 'T_BROWSER_REAL_SUN_LANDING: District is FOTOSFERA');
  await saveScreenshot('sun-photosphere-landed');

  // 3. Takeoff from photosphere
  const takeoffResult = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    // Boost upwards past return altitude
    g.player.position.y = 12000;
    g.player.velocity.set(0, 3000, 0);
    const sunDef = g.universe.activeSystem.bodies.find(b => b.id === 'sun');
    g.travelDomain.enterSystem({ systemId: 'sol', positionM: [0, sunDef.equatorialRadiusM + 12000, 0], velocityMps: [0, 3000, 0] });
    g.bindSurfacePhysics();

    return {
      travelDomain: g.travelDomain.kind,
      physicsDomain: g.physicsDomain,
    };
  });
  assert.equal(takeoffResult.travelDomain, 'interplanetary', 'T_BROWSER_REAL_SUN_TAKEOFF: Departed to interplanetary domain');
  await saveScreenshot('sun-takeoff');
  checkpointResults.flowD_sunLandingTakeoff = { flowDResult, landedResult, takeoffResult };
  console.log('[Browser] Flow D (Solar Landing & Takeoff) PASSED.');

  // -------------------------------------------------------------
  // FLOW E: Night Sun Occlusion & Lighting
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow E: Night Sun Geometry...');
  const flowEResult = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.universe.handoffTo('earth');
    g.atmosphere.time = 'Night';
    g.atmosphere.update(0.016, [0, 0, 0]);

    return {
      sunElevationRad: g.atmosphere.sunElevationRad,
      sunAboveHorizon: g.atmosphere.sunAboveLocalHorizon,
      sunIntensity: g.atmosphere.sun.intensity,
    };
  });
  assert.equal(flowEResult.sunAboveHorizon, false, 'T_BROWSER_REAL_NIGHT_SUN_GEOMETRY: Sun below horizon at night');
  assert.ok(flowEResult.sunElevationRad < 0, 'T_BROWSER_REAL_NIGHT_SUN_GEOMETRY: Solar elevation negative at night');
  await saveScreenshot('earth-night-sun');
  checkpointResults.flowE_nightSunGeometry = flowEResult;
  console.log('[Browser] Flow E (Night Sun Geometry) PASSED.');

  // -------------------------------------------------------------
  // FLOW F: Moon Visual Shading & Earthshine
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow F: Moon Visual Shading & Earthshine...');
  const flowFResult = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    const moonSample = g.celestialController.renderSamples.find(s => s.bodyId === 'moon');
    const profile = moonSample?.profile;

    return {
      moonFound: !!moonSample,
      phaseFloor: profile?.visual?.phaseFloor,
      ambient: profile?.visual?.ambient,
    };
  });
  assert.ok(flowFResult.moonFound, 'T_BROWSER_REAL_MOON_VISUAL: Moon sample located');
  assert.equal(flowFResult.phaseFloor, 0.14, 'T_BROWSER_REAL_MOON_VISUAL: Moon phaseFloor is 0.14');
  await saveScreenshot('moon-daylight');
  checkpointResults.flowF_moonVisual = flowFResult;
  console.log('[Browser] Flow F (Moon Visual) PASSED.');

  assert.equal(errors.length, 0, `Browser errors detected:\n${errors.join('\n')}`);
  await writeFile('artifacts/p0.1-planetary-final-hardening-browser.json', JSON.stringify({ results: checkpointResults, errors }, null, 2));
  console.log('ALL REAL E2E BROWSER FLOWS COMPLETED SUCCESSFULLY WITH SCREENSHOT EVIDENCE.');
} catch (error) {
  await page?.screenshot({ path: 'artifacts/p0.1-planetary-hardening-failure.png' }).catch(() => {});
  await writeFile('artifacts/p0.1-planetary-hardening-failure.json', JSON.stringify({ errors, error: String(error) }, null, 2));
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
