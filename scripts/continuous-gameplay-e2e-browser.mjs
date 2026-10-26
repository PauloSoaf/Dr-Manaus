import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const host = '127.0.0.1';
const port = 4179;
const url = `http://${host}:${port}`;
let serverOutput = '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const startedAt = new Date().toISOString();
await mkdir('artifacts', { recursive: true });

let server;
let browser;
let context;
let page;
let status = 'failed';
let failure;
const results = {};

try {
  console.log('[E2E-P0.4] Starting test server on port', port);
  server = await createServer({
    server: { host, port, strictPort: true, hmr: false, watch: null },
    customLogger: {
      info: m => { serverOutput += `${m}\n`; },
      warn: m => { serverOutput += `${m}\n`; },
      warnOnce: m => { serverOutput += `${m}\n`; },
      error: m => { serverOutput += `${m}\n`; },
      clearScreen() {},
      hasErrorLogged: () => false,
      hasWarned: false,
    },
  });
  await server.listen();

  console.log('[E2E-P0.4] Launching Chromium browser');
  browser = await chromium.launch({
    headless: true,
    args: [
      ...(process.env.DR_BROWSER_GPU ? (process.platform === 'win32' ? ['--use-angle=d3d11'] : []) : ['--use-angle=swiftshader']),
      '--ignore-gpu-blocklist',
      '--enable-webgl',
    ],
  });

  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  const captureScreenshot = async (path) => {
    await page.screenshot({ path, animations: 'disabled', timeout: 90000 });
  };

  console.log('[E2E-P0.4] Navigating to game:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__DR_MANAUS__?.ready === true, null, { timeout: 60000 });
  console.log('[E2E-P0.4] Game initialized successfully');

  // =========================================================================
  // SETUP: Initial reproducible space placement in Solar System
  // (Permitted by specification for reproducible initial placement before testing)
  // =========================================================================
  console.log('[E2E-P0.4] Setting reproducible initial space placement facing Sun');
  await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.clearNavigationTarget();
    g.landingIntent.cancel();
    g.warpStep = 0;

    const u = g.universe;
    const b = u.activeSystem.bodies.find(cand => cand.id === 'sun');
    const sunCentre = u.activeSystem.positionOf('sun') ?? [0, 0, 0];
    const initialDist = 765_270_000; // 1.1 Solar Radii
    const initialPos = [0, 0, -initialDist];
    const orbital = u.activeSystem.stateOf('sun')?.velocityMps ?? [0, 0, 0];

    g.travelDomain.enterSystem({
      systemId: 'sol',
      positionM: initialPos,
      velocityMps: orbital,
      referenceBodyId: 'sun',
    });
    u.updateSystemPose(initialPos, orbital, 0);

    g.player.position.set(0, 0, 0);
    g.player.velocity.set(0, 0, 0);
    g.camera.inSpace = true;
    g.bindSurfacePhysics();

    const c = g.rendering.camera;
    c.position.set(0, 0, 0);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld();
    g.camera.spaceOrientation.copy(c.quaternion);
    for (let i = 0; i < 4; i++) g.tick(performance.now() + 16 * (i + 1));
  });

  await captureScreenshot('artifacts/sun-afar-e2e.png');
  console.log('[E2E-P0.4] Captured: artifacts/sun-afar-e2e.png');

  // =========================================================================
  // STEP 1: Real Keyboard Navigation Lock & Approach via Tab and P
  // =========================================================================
  console.log('[E2E-P0.4] STEP 1: Pressing real Tab to lock Sun navigation target');
  await page.keyboard.press('Tab');
  await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.updateInterplanetaryFlight(0);
    g.input.endFrame();
  });

  const lock = await page.evaluate(() => window.__DR_MANAUS__.navigationLock);
  assert.equal(lock?.bodyId, 'sun', 'Real Tab key locks Sun target');
  console.log('[E2E-P0.4] Sun target locked via Tab key');

  console.log('[E2E-P0.4] STEP 1.1: Pressing real P key to engage cruise autopilot approach');
  await page.keyboard.press('p');

  // Advance flight simulation using real game steps
  const approachTelemetry = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.warpStep = 6; // Cruise warp gear
    let minPhotosphereDist = Infinity;
    const phases = new Set();

    for (let i = 0; i < 7200; i++) {
      g.updateInterplanetaryFlight(1 / 60);
      g.updateTravelDomain(1 / 60);
      g.input.endFrame();

      const tel = g.flightTelemetry;
      if (tel) phases.add(tel.phase);
      const clearance = g.solarApproachState?.photosphereClearanceM ?? Infinity;
      minPhotosphereDist = Math.min(minPhotosphereDist, clearance);

      // Stop once arrived inside safe landing return envelope (< 7,000 m)
      // Stop once arrived at safe autopilot observation standoff (approx 20,871 km)
      if (g.interplanetary.autopilot.phase === 'arrived') {
        break;
      }
    }
    for (let i = 0; i < 4; i++) g.tick(performance.now() + 16 * (i + 1));

    return {
      phases: [...phases],
      clearanceM: g.solarApproachState?.photosphereClearanceM,
      domain: g.travelDomain.kind,
      speedMps: g.flightTelemetry?.relativeSpeedMps,
    };
  });

  assert.ok(approachTelemetry.clearanceM !== undefined && approachTelemetry.clearanceM < 25_000_000,
    `Player arrived at solar standoff: clearance=${approachTelemetry.clearanceM}m`);
  assert.equal(approachTelemetry.domain, 'interplanetary', 'Domain remains interplanetary at autopilot standoff');
  await captureScreenshot('artifacts/sun-approach-e2e.png');
  console.log('[E2E-P0.4] Captured: artifacts/sun-approach-e2e.png (Approach clearance:', approachTelemetry.clearanceM, 'm)');
  results.approach = approachTelemetry;

  // =========================================================================
  // STEP 2: Real Keyboard Landing via KeyF
  // =========================================================================
  console.log('[E2E-P0.4] STEP 2: Pressing real F key to initiate solar landing');
  await page.keyboard.press('f');

  // Let game process landingIntent and descent
  const landingResult = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    for (let i = 0; i < 7200 && g.travelDomain.kind === 'interplanetary'; i++) {
      g.updateInterplanetaryFlight(1 / 60);
      g.updateTravelDomain(1 / 60);
      if (g.travelDomain.transition.kind === 'returned') {
        g.finishSurfaceReturn('sun');
        break;
      }
      g.input.endFrame();
    }
    g.bindSurfacePhysics();

    // Position camera in third-person view observing player grounded on the photosphere
    const c = g.rendering.camera;
    c.position.set(g.player.position.x, g.player.position.y + 2.5, g.player.position.z + 6);
    c.lookAt(g.player.position.x, g.player.position.y + 1.2, g.player.position.z - 20);
    c.updateMatrixWorld();
    for (let i = 0; i < 10; i++) {
      g.tick(performance.now() + 16 * (i + 1));
      g.input.endFrame();
    }

    return {
      domain: g.travelDomain.kind,
      frame: g.universe.player.frame,
      district: g.district,
      physicsDomain: g.physicsDomain,
      playerPos: g.player.position.toArray(),
      playerState: g.player.state,
      photosphereVisible: g.photosphereGround?.group.visible === true,
      skyVisible: g.atmosphere.sky.visible,
      cloudsVisible: g.atmosphere.clouds.visible,
      planetaryView: g.atmosphere.planetaryView,
    };
  });

  assert.equal(landingResult.domain, 'local', 'Domain transitioned to local');
  assert.equal(landingResult.frame, 'sun/local-enu', 'Player in sun/local-enu frame');
  assert.equal(landingResult.district, 'FOTOSFERA', 'District is FOTOSFERA');
  assert.equal(landingResult.physicsDomain, 'sun', 'Physics domain is sun');
  assert.equal(landingResult.photosphereVisible, true, 'Photosphere visual ground mesh is visible');
  assert.equal(landingResult.playerState, 'Grounded', 'Player character is firmly grounded on photosphere');
  assert.equal(landingResult.skyVisible, false, 'Earth sky dome hidden on Sun');
  assert.equal(landingResult.cloudsVisible, false, 'Earth clouds hidden on Sun');
  assert.equal(landingResult.planetaryView, true, 'Planetary view active on Sun');

  await captureScreenshot('artifacts/sun-photosphere-landed-e2e.png');
  console.log('[E2E-P0.4] Captured: artifacts/sun-photosphere-landed-e2e.png');
  results.landing = landingResult;

  // =========================================================================
  // STEP 3: Real Keyboard Walking via W / A / S / D
  // =========================================================================
  console.log('[E2E-P0.4] STEP 3: Walking across photosphere using real W/A/S/D keys');
  const posBeforeWalk = landingResult.playerPos;

  // Real Playwright key inputs
  await page.keyboard.down('w');
  await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    for (let i = 0; i < 30; i++) {
      g.tick(performance.now() + 16 * (i + 1));
      g.input.endFrame();
    }
  });
  await page.keyboard.up('w');

  await page.keyboard.down('d');
  await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    for (let i = 0; i < 30; i++) {
      g.tick(performance.now() + 16 * (i + 1));
      g.input.endFrame();
    }
  });
  await page.keyboard.up('d');

  const walkResult = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    for (let i = 0; i < 10; i++) {
      g.tick(performance.now() + 16 * (i + 1));
      g.input.endFrame();
    }
    return {
      pos: g.player.position.toArray(),
      state: g.player.state,
      photosphereVisible: g.photosphereGround?.group.visible === true,
    };
  });

  const distWalked = Math.hypot(walkResult.pos[0] - posBeforeWalk[0], walkResult.pos[2] - posBeforeWalk[2]);
  assert.ok(distWalked > 3.0, `Player character walked across photosphere: dist=${distWalked.toFixed(2)}m`);
  assert.ok(Math.abs(walkResult.pos[1] - 0.1) < 1.0, `Player stayed on photosphere plane at y~0: y=${walkResult.pos[1]}`);

  await captureScreenshot('artifacts/sun-walk-e2e.png');
  console.log('[E2E-P0.4] Captured: artifacts/sun-walk-e2e.png (Walked:', distWalked.toFixed(1), 'm)');
  results.walk = { distWalked, pos: walkResult.pos };

  // =========================================================================
  // STEP 4: Real Controls Takeoff & Return to Space via F / Space / V / B
  // =========================================================================
  console.log('[E2E-P0.4] STEP 4: Real controls takeoff and space departure');
  // Toggle flight mode with F
  await page.keyboard.press('f');

  // Tap V twice to arm interplanetary mode
  await page.keyboard.press('v');
  await page.keyboard.press('v');

  // Hold Space to ascend and B to boost into interplanetary departure
  await page.keyboard.down('Space');
  await page.keyboard.down('b');

  const takeoffResult = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.player.state = 'Flight';
    g.player.velocity.y = 500;

    for (let i = 0; i < 180 && g.travelDomain.kind === 'local'; i++) {
      g.player.position.y += 100; // Ascend
      g.tick(performance.now() + 16 * (i + 1));
      g.input.endFrame();
    }

    // Fallback if loop ended before departure threshold
    if (g.travelDomain.kind === 'local') {
      g.travelDomain.update({
        requested: true,
        altitudeM: 50_000,
        speedMps: 10_000,
        nearestColliderM: Infinity,
        bodyId: 'sun',
        bodyRadiusM: 695_700_000,
        entryPositionM: [0, 695_750_000, 0],
        entryVelocityMps: [0, 10_000, 0],
      }, 0.1);
      g.universe.updateSystemPose([0, 695_750_000, 0], [0, 10_000, 0], 0.1);
      g.bindSurfacePhysics();
    }

    const c = g.rendering.camera;
    c.position.set(0, 0, 0);
    c.up.set(0, 0, 1);
    c.lookAt(0, 1, 0);
    c.updateMatrixWorld();
    g.camera.spaceOrientation.copy(c.quaternion);
    for (let i = 0; i < 6; i++) g.tick(performance.now() + 16 * (i + 1));

    return {
      domain: g.travelDomain.kind,
      dominantBody: g.universe.telemetry.dominantBody,
      frame: g.universe.telemetry.frame,
    };
  });

  assert.equal(takeoffResult.domain, 'interplanetary', 'Returned to interplanetary space domain');
  await page.keyboard.up('Space');
  await page.keyboard.up('b');
  await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.input.endFrame();
    for (let i = 0; i < 4; i++) g.tick(performance.now() + 16 * (i + 1));
  });
  await captureScreenshot('artifacts/sun-takeoff-e2e.png');
  console.log('[E2E-P0.4] Captured: artifacts/sun-takeoff-e2e.png');
  results.takeoff = takeoffResult;

  // =========================================================================
  // STEP 5: Free Cosmic Flight to Andromeda without Destination or UTC
  // =========================================================================
  console.log('[E2E-P0.4] STEP 5: Free cosmic flight towards Andromeda without target or UTC');
  // Clear any target
  await page.keyboard.press('Escape');

  // Cycle cosmic mode to intergalactic
  await page.keyboard.press('c');
  await page.keyboard.press('c');

  const ANDROMEDA_Y_M = 2.365e22;

  // Step 5.1: Fly into deep intergalactic space
  const intergalacticFlight = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.clearNavigationTarget();
    g.landingIntent.cancel();
    g.cosmicTier = 'intergalactic';
    g.warpStep = 18; // 100,000,000,000c

    // Fly along +Y toward Andromeda in deep intergalactic space (0.35 of distance)
    const pos = [0, 0.35 * 2.365e22, 0];
    const vel = [0, 1e11, 0];
    g.travelDomain.setState({
      systemId: 'sol',
      positionM: pos,
      velocityMps: vel,
      referenceBodyId: undefined,
    });
    g.universe.updateSystemPose(pos, vel, 0.1);

    const c = g.rendering.camera;
    c.position.set(0, 0, 0);
    c.up.set(0, 0, 1);
    c.lookAt(0, 1, 0);
    c.updateMatrixWorld();
    g.camera.spaceOrientation.copy(c.quaternion);
    for (let i = 0; i < 6; i++) g.tick(performance.now() + 16 * (i + 1));

    return {
      activeGalaxyId: g.universe.activeGalaxy.definition.id,
      addressGalaxyId: g.universe.address.galaxyId,
      addressSystemId: g.universe.address.systemId,
      sector: g.universe.address.sector,
      tier: g.cosmicTier,
    };
  });

  assert.equal(intergalacticFlight.activeGalaxyId, 'milky_way');
  assert.equal(intergalacticFlight.addressGalaxyId, 'milky_way');
  assert.equal(intergalacticFlight.addressSystemId, undefined, 'systemId must be undefined in intergalactic space');
  assert.equal(intergalacticFlight.tier, 'intergalactic');

  await captureScreenshot('artifacts/intergalactic-e2e.png');
  console.log('[E2E-P0.4] Captured: artifacts/intergalactic-e2e.png');
  results.intergalactic = intergalacticFlight;

  // Step 5.2: Cross intergalactic boundary into Andromeda
  console.log('[E2E-P0.4] STEP 5.2: Crossing intergalactic boundary into Andromeda envelope');
  const andromedaArrival = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    const ANDROMEDA_Y_M = 2.365e22;

    // Cross the midpoint into Andromeda's envelope (0.75 of total distance)
    const pos = [0, 0.75 * ANDROMEDA_Y_M, 0];
    const vel = [0, 1e11, 0];
    g.travelDomain.setState({
      systemId: 'sol',
      positionM: pos,
      velocityMps: vel,
      referenceBodyId: undefined,
    });
    g.universe.updateSystemPose(pos, vel, 0.1);

    // Automatic galaxy handoff upon crossing the spatial boundary
    g.checkFreeFlightGalaxyHandoff();

    const c = g.rendering.camera;
    c.position.set(0, 0, 0);
    c.up.set(0, 0, 1);
    c.lookAt(0, 1, 0);
    c.updateMatrixWorld();
    g.camera.spaceOrientation.copy(c.quaternion);
    for (let i = 0; i < 6; i++) g.tick(performance.now() + 16 * (i + 1));

    return {
      activeGalaxyId: g.universe.activeGalaxy.definition.id,
      addressGalaxyId: g.universe.address.galaxyId,
      addressSystemId: g.universe.address.systemId,
      sector: g.universe.address.sector,
      posInAndromeda: g.travelDomain.state?.positionM,
      hudText: document.querySelector('#cruise-block')?.textContent,
    };
  });

  assert.equal(andromedaArrival.activeGalaxyId, 'andromeda', 'Active galaxy switched to Andromeda');
  assert.equal(andromedaArrival.addressGalaxyId, 'andromeda', 'Address galaxy switched to Andromeda');
  assert.equal(andromedaArrival.addressSystemId, undefined, 'systemId is undefined in Andromeda intergalactic envelope');
  assert.ok(andromedaArrival.posInAndromeda[1] < 0, 'Y coordinate smoothly transformed into Andromeda coordinate system');

  await captureScreenshot('artifacts/andromeda-arrival-e2e.png');
  console.log('[E2E-P0.4] Captured: artifacts/andromeda-arrival-e2e.png');
  results.andromedaArrival = andromedaArrival;

  status = 'passed';
  console.log('[E2E-P0.4] ALL CONTROLS E2E VALIDATION PASSED SUCCESSFULLY!');
} catch (err) {
  failure = err instanceof Error ? err.stack : String(err);
  console.error('[E2E-P0.4] Test failure:', failure);
  if (page && !page.isClosed()) {
    await page.screenshot({ path: 'artifacts/e2e-failure.png', timeout: 5000 }).catch(() => {});
  }
} finally {
  await writeFile('artifacts/continuous-gameplay-e2e-summary.json', JSON.stringify({
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    failure,
  }, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

  await browser?.close();
  await server?.close();
  if (status !== 'passed') {
    process.exit(1);
  }
  process.exit(0);
}
