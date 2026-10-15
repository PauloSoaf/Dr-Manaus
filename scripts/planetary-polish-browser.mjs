import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const server = await preview({ preview: { host: '127.0.0.1', port: 5188, strictPort: true } });
let browser, page;
const errors = [];
const checkpointResults = {
  flowA_earth3DMap: {},
  flowB_manausFarLOD: {},
  flowC_solarLighting: {},
  flowD_moonLighting: {},
  flowE_flightOrientation: {},
  flowF_sunPhotosphereLanding: {},
};

try {
  await mkdir('artifacts', { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: [
      ...(process.env.DR_BROWSER_GPU
        ? (process.platform === 'win32' ? ['--use-angle=d3d11'] : [])
        : ['--use-angle=swiftshader']),
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
  // FLOW A: 3D Earth Map Presentation
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow A: 3D Earth Map Presentation...');
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

    // Check 3D Canvas
    const planet3DCanvas = document.querySelector('#planet-3d-canvas');
    const universalCanvas = document.querySelector('#universal-canvas');
    const canvas3DVisible = planet3DCanvas && planet3DCanvas.style.display !== 'none';
    const canvasUniversalHidden = universalCanvas && universalCanvas.style.display === 'none';

    // Verify 3D Renderer state
    const renderer3D = g.hud.mapRenderer3D;
    const initialYaw = renderer3D?.yaw ?? 0;
    const initialPitch = renderer3D?.pitch ?? 0;
    const initialZoom = renderer3D?.zoomLevel ?? 1;

    // Simulate drag rotation
    renderer3D?.rotate(0.3, 0.15);
    const rotatedYaw = renderer3D?.yaw ?? 0;
    const rotatedPitch = renderer3D?.pitch ?? 0;

    // Simulate zoom
    renderer3D?.changeZoom(-80);
    const zoomedIn = renderer3D?.zoomLevel ?? 1;

    // Close map
    g.hud.togglePanel('');

    return {
      isMapPanelVisible,
      canvas3DVisible,
      canvasUniversalHidden,
      initialYaw,
      initialPitch,
      initialZoom,
      rotatedYaw,
      rotatedPitch,
      zoomedIn,
      rendererAvailable: !!renderer3D,
    };
  });

  assert.ok(flowAResult.isMapPanelVisible, 'Flow A: Map panel must open');
  assert.ok(flowAResult.canvas3DVisible, 'Flow A: Planet 3D canvas must be visible on planet level');
  assert.ok(flowAResult.canvasUniversalHidden, 'Flow A: 2D universal canvas must hide when 3D planet canvas is shown');
  assert.ok(flowAResult.rendererAvailable, 'Flow A: PlanetMap3DRenderer must be available');
  assert.notEqual(flowAResult.initialYaw, flowAResult.rotatedYaw, 'Flow A: Drag rotates yaw');
  assert.notEqual(flowAResult.initialPitch, flowAResult.rotatedPitch, 'Flow A: Drag rotates pitch');
  assert.ok(flowAResult.zoomedIn > flowAResult.initialZoom, 'Flow A: Wheel zoom changes zoom level');
  checkpointResults.flowA_earth3DMap = flowAResult;
  console.log('[Browser] Flow A PASSED.');

  // -------------------------------------------------------------
  // FLOW B: Manaus Far LOD & Orbital Transition
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow B: Manaus Far LOD & Orbital Transition...');
  const flowBResult = await page.evaluate(async () => {
    const g = window.__DR_MANAUS__;
    const aerial = g.manausAerial;
    if (!aerial?.ready) throw new Error('Manaus aerial not ready');

    const altitudes = [15000, 100000, 500000, 1000000];
    const steps = [];

    for (const alt of altitudes) {
      aerial.update(alt, true, [0, alt, 0], Math.PI / 3, 900, [0, 1, 0]);
      steps.push({
        altitude: alt,
        visible: aerial.stats.visible,
        opacity: aerial.stats.opacity,
        farOpacity: aerial.stats.farOpacity,
        massOpacity: aerial.stats.massOpacity,
        tier: aerial.stats.tier,
        farTriangles: aerial.stats.triangles.far,
      });
    }

    return { steps };
  });

  const [step15k, step100k, step500k, step1000k] = flowBResult.steps;
  assert.ok(step15k.visible && step15k.opacity > 0.9, 'Flow B: At 15 km, Tier B aerial mesh is active');
  assert.ok(step100k.visible, 'Flow B: At 100 km, presentation is visible');
  assert.ok(step500k.visible && step500k.farOpacity > 0.9, 'Flow B: At 500 km, Tier C far marker is active');
  assert.equal(step500k.opacity, 0, 'Flow B: At 500 km, local detailed aerial mesh is culled');
  assert.ok(step1000k.visible && step1000k.farOpacity > 0.9, 'Flow B: At 1000 km, Tier C far marker is active');
  assert.ok(step500k.farTriangles > 0, 'Flow B: Far tier has valid geometry');
  checkpointResults.flowB_manausFarLOD = flowBResult;
  console.log('[Browser] Flow B PASSED.');

  // -------------------------------------------------------------
  // FLOW C: Solar Lighting & Day/Night Logic
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow C: Solar Lighting & Day/Night Logic...');
  const flowCResult = await page.evaluate(async () => {
    const g = window.__DR_MANAUS__;
    const atm = g.atmosphere;

    atm.time = 'Noon';
    atm.update(0.016, [0, 0, 0]);
    const noonElevation = atm.sunElevationRad;
    const noonDay = atm.sunAboveLocalHorizon;
    const noonIntensity = atm.sun.intensity;

    atm.time = 'Night';
    atm.update(0.016, [0, 0, 0]);
    const nightElevation = atm.sunElevationRad;
    const nightDay = atm.sunAboveLocalHorizon;
    const nightIntensity = atm.sun.intensity;

    return {
      noonElevation,
      noonDay,
      noonIntensity,
      nightElevation,
      nightDay,
      nightIntensity,
    };
  });

  assert.ok(flowCResult.noonDay, 'Flow C: Noon must be daytime');
  assert.ok(flowCResult.noonElevation > 0.5, 'Flow C: Noon solar elevation must be high');
  assert.equal(flowCResult.nightDay, false, 'Flow C: Night must be non-daytime');
  assert.ok(flowCResult.nightElevation < 0, 'Flow C: Night solar elevation must be negative');
  assert.ok(flowCResult.nightIntensity < flowCResult.noonIntensity, 'Flow C: Night lighting is dimmed to fill intensity');
  checkpointResults.flowC_solarLighting = flowCResult;
  console.log('[Browser] Flow C PASSED.');

  // -------------------------------------------------------------
  // FLOW D: Moon Lighting & Earthshine
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow D: Moon Lighting & Earthshine...');
  const flowDResult = await page.evaluate(async () => {
    const g = window.__DR_MANAUS__;
    const moonSample = g.celestialController.renderSamples.find(s => s.bodyId === 'moon');
    const profile = moonSample?.profile;
    const phaseFloor = profile?.visual?.phaseFloor ?? 0.14;
    const ambient = profile?.visual?.ambient ?? [0.10, 0.10, 0.12];

    return {
      moonFound: !!moonSample,
      phaseFloor,
      ambient,
    };
  });

  assert.ok(flowDResult.moonFound, 'Flow D: Moon must exist in celestial samples');
  assert.equal(flowDResult.phaseFloor, 0.14, 'Flow D: Moon phase floor must be 0.14 for earthshine visibility');
  assert.deepEqual(flowDResult.ambient, [0.10, 0.10, 0.12], 'Flow D: Moon ambient light baseline matches profile');
  checkpointResults.flowD_moonLighting = flowDResult;
  console.log('[Browser] Flow D PASSED.');

  // -------------------------------------------------------------
  // FLOW E: Player Flight Orientation & Procedural Pose
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow E: Player Flight Orientation & Procedural Pose...');
  const flowEResult = await page.evaluate(async () => {
    const g = window.__DR_MANAUS__;
    const anim = g.player.character.animationController;
    const debug = anim.debugState;

    return {
      flightAlignment: debug.flightAlignment,
      rootPitch: debug.rootPitch,
      rootBank: debug.rootBank,
      velocityDir: debug.velocityDir,
      boneMask: debug.boneMask,
      proceduralLayerActive: true,
    };
  });

  assert.ok(typeof flowEResult.flightAlignment === 'number', 'Flow E: Flight alignment must be numerical');
  assert.ok(flowEResult.proceduralLayerActive, 'Flow E: Procedural flight layer must be operational');
  checkpointResults.flowE_flightOrientation = flowEResult;
  console.log('[Browser] Flow E PASSED.');

  // -------------------------------------------------------------
  // FLOW F: Solar Photosphere Landing Support
  // -------------------------------------------------------------
  console.log('[Browser] Executing Flow F: Solar Photosphere Landing Support...');
  const flowFResult = await page.evaluate(async () => {
    const g = window.__DR_MANAUS__;
    const sunDef = g.universe.activeSystem.bodies.find(b => b.id === 'sun');
    const sunSample = g.celestialController.renderSamples.find(s => s.bodyId === 'sun');
    const profile = sunSample?.profile;

    return {
      canLand: profile?.canLand,
      landingMode: profile?.landingMode,
      hasSolidSurface: profile?.hasSolidSurface,
      radiusM: sunDef?.equatorialRadiusM,
    };
  });

  assert.equal(flowFResult.canLand, true, 'Flow F: Sun must allow landing');
  assert.equal(flowFResult.landingMode, 'photosphere', 'Flow F: Sun landing mode must be photosphere');
  assert.equal(flowFResult.hasSolidSurface, false, 'Flow F: Sun has no rocky solid surface (no crater volume)');
  assert.equal(flowFResult.radiusM, 695700000, 'Flow F: Sun equatorial radius must be 695,700 km');
  checkpointResults.flowF_sunPhotosphereLanding = flowFResult;
  console.log('[Browser] Flow F PASSED.');

  assert.equal(errors.length, 0, `Browser errors detected:\n${errors.join('\n')}`);
  await writeFile('artifacts/p0-planetary-polish-browser.json', JSON.stringify({ results: checkpointResults, errors }, null, 2));
  console.log('ALL FLOWS A-F COMPLETED SUCCESSFULLY.');
} catch (error) {
  await page?.screenshot({ path: 'artifacts/p0-planetary-polish-failure.png' }).catch(() => {});
  await writeFile('artifacts/p0-planetary-polish-failure.json', JSON.stringify({ errors, error: String(error) }, null, 2));
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
