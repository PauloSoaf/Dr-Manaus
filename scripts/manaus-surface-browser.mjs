import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

// Source fixtures deliberately exercise the shipped mesh builders, tile loader and collider
// builder. They are not substitutes for the separate screenshots of the streamed real city.
const host = '127.0.0.1', port = Number(process.env.DR_MANAUS_SURFACE_PORT ?? 4183);
const auditOnly = process.env.DR_MANAUS_SURFACE_AUDIT === '1';
const suffix = auditOnly ? '-audit' : '';
const results = { status: 'failed', fixture: 'deterministic source geometry + real streamed city', errors: [] };
let server, browser, page;
await mkdir('artifacts', { recursive: true });
try {
  server = await createServer({ server: { host, port, strictPort: true, hmr: false, watch: null } });
  await server.listen();
  browser = await chromium.launch({ headless: true, args: [
    ...(process.env.DR_BROWSER_GPU ? (process.platform === 'win32' ? ['--use-angle=d3d11'] : []) : ['--use-angle=swiftshader']), '--ignore-gpu-blocklist', '--enable-webgl',
  ] });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => results.errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') results.errors.push(`console: ${message.text()}`); });
  await page.route('**/geodata/real-city/__surface-fixture-*.json', async route => {
    const distance = Number(/__surface-fixture-(\d+)\.json/.exec(route.request().url())[1]);
    await route.fulfill({ json: { key: `${distance / 1000},0`, tx: distance / 1000, tz: 0,
      buildings: [{ id: `surface-fixture-${distance}`, h: 12, p: [20, 20, 40, 20, 40, 40, 20, 40] }] } });
  });
  await page.goto(`http://${host}:${port}/?webgl=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DR_MANAUS__?.ready, null, { timeout: 90_000 });
  // Software GPU rasterization uses the shipped Low preset; simulation, CSS viewport,
  // geometry, camera and readiness contracts are unchanged. Native GPU runs keep High.
  if (!process.env.DR_BROWSER_GPU) await page.evaluate(() => window.__DR_MANAUS__.rendering.setQuality('Low'));
  await page.waitForFunction(() => window.__DR_MANAUS__.realCity.stats.shellTriangles > 0,
    null, { timeout: 90_000 });

  results.samples = await page.evaluate(async () => {
    const [{ Group, Vector3, Matrix4 }, { RealCityLayer }, { RealCityMaterials },
      { RoadNetwork, ROAD_HEIGHT, ROAD_MARKING_LIFT }, { FEATURES }] = await Promise.all([
      import('/node_modules/three/build/three.webgpu.js'),
      import('/src/world/realcity/RealCityLayer.ts'), import('/src/world/realcity/materials.ts'),
      import('/src/world/realcity/roads.ts'), import('/src/core/config.ts'),
    ]);
    const g = window.__DR_MANAUS__;
    if (FEATURES.curvedManaus) throw new Error('Fixture requires the shipped curvedManaus=false policy.');
    const ground = g.worldRoot.getObjectByName('ground-cover').geometry.getAttribute('position');
    let groundMinY = Infinity, groundMaxY = -Infinity;
    for (let i = 0; i < ground.count; i++) {
      groundMinY = Math.min(groundMinY, ground.getY(i)); groundMaxY = Math.max(groundMaxY, ground.getY(i));
    }
    const samples = [];
    for (const distanceM of [0, 5000, 10000, 15000, 20000]) {
      const root = new Group(), materials = new RealCityMaterials(), city = new RealCityLayer(root);
      const key = `${distanceM / 1000},0`;
      city.materials = materials;
      city.manifest = { tileSize: 1000, tiles: {} };
      await city.loadTile(key, `__surface-fixture-${distanceM}.json`);
      const tile = city.tiles.get(key);
      if (!tile) throw new Error(`RealCityLayer did not load radial fixture ${key}`);
      city.classifyCells(new Vector3(distanceM + 30, 0, 30), 0);
      city.runJobs(1000);
      root.updateMatrixWorld(true);
      const collider = tile.colliders.find(item => item.id === `real:surface-fixture-${distanceM}`);
      if (!collider || !tile.detail) throw new Error(`No detail/collider in radial fixture ${key}`);
      const geometry = tile.detail.geometry.getAttribute('position');
      let buildingBaseY = Infinity;
      for (let i = 0; i < geometry.count; i++) {
        if (Math.abs(geometry.getY(i)) > .001) continue;
        buildingBaseY = Math.min(buildingBaseY,
          new Vector3().fromBufferAttribute(geometry, i).applyMatrix4(tile.group.matrix).y);
      }
      const visualBase = new Vector3(collider.x - tile.originX, 0, collider.z - tile.originZ)
        .applyMatrix4(tile.group.matrix);
      const road = new RoadNetwork([
        { class: 'primary', width: 12, p: [distanceM - 60, 0, distanceM + 60, 0] },
        { class: 'service', width: 6, p: [distanceM - 60, 60, distanceM + 60, 60] },
      ], materials.road, materials.lamp);
      for (let frame = 0; frame < 3; frame++) road.update(distanceM, 0, 0);
      const heights = {}, normals = {};
      for (const name of ['real-roads-arterial', 'real-roads-local', 'real-roads-markings']) {
        const mesh = road.group.getObjectByName(name), positions = mesh?.geometry.getAttribute('position');
        if (!positions) throw new Error(`Road builder omitted ${name} at ${distanceM}m`);
        const up = mesh.geometry.getAttribute('normal');
        heights[name] = [Infinity, -Infinity]; normals[name] = 0;
        for (let i = 0; i < positions.count; i++) {
          heights[name][0] = Math.min(heights[name][0], positions.getY(i));
          heights[name][1] = Math.max(heights[name][1], positions.getY(i));
          normals[name] = Math.max(normals[name], Math.hypot(up.getX(i), up.getY(i) - 1, up.getZ(i)));
        }
      }
      // An unloaded tile takes the actual skyline path, separate from the resident detail path.
      const skylineCity = new RealCityLayer(root);
      skylineCity.manifest = { tileSize: 1000, tiles: {} };
      skylineCity.skylineData.set(key, [30, 30, 30, 30, 12, .6, 0, 0]);
      skylineCity.createSkyline(); skylineCity.rebuildSkyline();
      const skylineBases = [], matrix = new Matrix4();
      for (let i = 0; i < skylineCity.skyline.count; i++) {
        skylineCity.skyline.getMatrixAt(i, matrix); skylineBases.push(matrix.elements[13]);
      }
      samples.push({ distanceM, groundY: groundMaxY, groundMinY,
        roadY: heights['real-roads-local'][0], arterialY: heights['real-roads-arterial'][0],
        markingY: heights['real-roads-markings'][0], roadHeights: heights, normalError: normals,
        expectedRoadY: ROAD_HEIGHT.service, expectedArterialY: ROAD_HEIGHT.primary,
        expectedMarkingY: ROAD_HEIGHT.primary + ROAD_MARKING_LIFT,
        buildingBaseY, colliderBaseY: collider.y - collider.height / 2,
        visualBase: visualBase.toArray(), colliderBase: [collider.x, collider.y - collider.height / 2, collider.z],
        tileMatrix: tile.group.matrix.toArray(), skylineBases });
      road.dispose();
      for (const layer of [city, skylineCity]) layer.group.traverse(object => object.geometry?.dispose());
      skylineCity.skyline.material.dispose(); materials.dispose();
    }
    return samples;
  });
  console.log('Manaus radial geometry:', JSON.stringify(results.samples));
  if (!auditOnly) for (const sample of results.samples) {
    const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .001,
      `${label} at ${sample.distanceM}m: ${actual}, expected ${expected}`);
    near(sample.groundY, 0, 'ground'); near(sample.groundMinY, 0, 'ground minimum');
    near(sample.roadY, sample.expectedRoadY, 'road'); near(sample.arterialY, sample.expectedArterialY, 'arterial');
    near(sample.markingY, sample.expectedMarkingY, 'marking');
    near(sample.buildingBaseY, sample.colliderBaseY, 'building/collider base');
    for (let axis = 0; axis < 3; axis++) near(sample.visualBase[axis], sample.colliderBase[axis], `building/collider axis ${axis}`);
    assert.ok(sample.roadY - sample.groundY >= .02, `road/ground separation at ${sample.distanceM}m`);
    for (const error of Object.values(sample.normalError)) near(error, 0, 'road normal');
    assert.ok(sample.skylineBases.length > 0);
    for (const y of sample.skylineBases) near(y, 0, 'skyline base');
  }

  // Explicit local view fixtures: these screenshots do not claim a continuous 20km flight.
  results.views = [];
  for (const view of [
    { name: 'high-aerial', x: 0, y: 2800, z: -2000 },
    { name: 'medium-aerial', x: 2000, y: 650, z: -4500 },
    { name: '20km-aerial', x: 0, y: 800, z: -20000 },
  ]) {
    await page.evaluate(view => {
      const g = window.__DR_MANAUS__;
      g.player.teleport(g.player.position.clone().set(view.x, view.y, view.z));
      g.player.state = 'Hover'; g.camera.skipIntro(); g.camera.pitch = 1.05; g.camera.yaw = .35;
      g.atmosphere.time = 'Noon'; g.atmosphere.weather = 'clear';
    }, view);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `artifacts/manaus-${view.name}${suffix}.png` });
    results.views.push(await page.evaluate(name => {
      const g = window.__DR_MANAUS__;
      return { name, position: g.player.position.toArray(), city: g.realCity.stats,
        rootMatrix: g.worldRoot.matrixWorld.toArray(), renderOrigin: g.renderOriginVec.toArray() };
    }, view.name));
  }

  // A crater on an actual compiled road, with nearby real buildings, exercises Game.watchGround.
  results.crater = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    const point = g.player.position.clone().set(1600, 0, -2800);
    const hit = g.realCity.roads_graph.nearest(point.x, point.z, 2000);
    if (hit) { point.x = hit.segment.p[0]; point.z = hit.segment.p[1]; }
    window.__DR_MANAUS_CRATER_POINT__ = point.toArray();
    g.player.teleport(point.clone().add(g.player.position.clone().set(0, 420, 120)));
    g.player.state = 'Hover'; g.camera.pitch = 1.12; g.camera.yaw = 0;
    g.terrain.damageAt(point, 180, 26000);
    g.terrain.update(g.player.position, g.renderOriginVec);
    return { point: point.toArray(), roadName: hit?.segment.name ?? null, radiusM: 180 };
  });
  await page.waitForTimeout(4000);
  results.crater.coverage = await page.evaluate(() => {
    const g = window.__DR_MANAUS__, terrain = g.terrain, bowl = terrain.bowl;
    g.worldRoot.updateMatrixWorld(true);
    const point = g.player.position.clone().fromArray(window.__DR_MANAUS_CRATER_POINT__);
    const geometry = bowl.geometry, position = geometry.getAttribute('position'), index = geometry.index;
    let coveredCells = 0, maxHeightError = 0, maxSpaceError = 0;
    const samples = [], inverse = g.worldRoot.matrixWorld.clone().invert();
    for (let at = 0; at < geometry.drawRange.count; at += 3) {
      const vertex = [index.getX(at), index.getX(at + 1), index.getX(at + 2)];
      const center = point.clone().set(0, 0, 0);
      for (const i of vertex) center.add(point.clone().fromBufferAttribute(position, i));
      center.multiplyScalar(1 / 3).add(bowl.position);
      const physical = terrain.heightAt(center.x, center.z);
      maxHeightError = Math.max(maxHeightError, Math.abs(physical - center.y)); coveredCells++;
      if (samples.length < 12 && physical < -1) samples.push({ x: center.x, z: center.z, visibleY: center.y, collisionY: physical });
      // The mask reconstructs gameplay coordinates from GPU world position plus the render origin.
      const world = center.clone().applyMatrix4(g.worldRoot.matrixWorld);
      const reconstructed = world.clone().add(terrain.uOrigin.value);
      maxSpaceError = Math.max(maxSpaceError, reconstructed.distanceTo(center));
      if (world.clone().applyMatrix4(inverse).distanceTo(center) > .001) throw new Error('Invalid local world transform');
    }
    const sheets = [], forbidden = [];
    for (const mesh of terrain.bindings.keys()) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (mesh.name === 'ground-cover' || mesh.name === 'terrain-backdrop' || mesh.name.startsWith('real-roads'))
        sheets.push({ name: mesh.name, materials: materials.map(material => material.name), registered: true });
      if (/^real-(detail|shell):|^earth-|^moon-/.test(mesh.name)) forbidden.push(mesh.name);
    }
    return { stats: terrain.stats, centerHeight: terrain.heightAt(point.x, point.z), coveredTriangles: coveredCells,
      maxHeightError, maxSpaceError, samples, sheets, forbidden,
      rootMatrix: g.worldRoot.matrixWorld.toArray(), origin: terrain.uOrigin.value.toArray(),
      bowlPosition: bowl.position.toArray() };
  });
  await page.screenshot({ path: `artifacts/manaus-large-crater${suffix}.png` });
  if (!auditOnly) {
    const coverage = results.crater.coverage;
    assert.ok(coverage.centerHeight < -10); assert.ok(coverage.coveredTriangles > 0);
    assert.ok(coverage.maxHeightError < .001, `crater collision/render error: ${coverage.maxHeightError}`);
    assert.ok(coverage.maxSpaceError < .001, `mask origin/world mismatch: ${coverage.maxSpaceError}`);
    assert.equal(coverage.forbidden.length, 0, 'building/celestial meshes registered as ground');
    for (const name of ['ground-cover', 'terrain-backdrop', 'real-roads-arterial'])
      assert.ok(coverage.sheets.some(surface => surface.name === name), `${name} crater registration`);
  }
  // One setup teleport, then real Space/B/V input drives the complete vertical flight.
  // Observe the published end-of-frame state and actual GPU submissions without changing it.
  await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    // The actual spawn is on the square, clear of the monument's collision volume at zero.
    g.player.teleport(g.player.position.clone().set(38, 2.2, 12));
    g.player.state = 'Grounded'; g.player.armed = 'none';
    g.camera.skipIntro(); g.camera.pitch = 1.27; g.camera.yaw = 0;
    window.__DR_AERIAL_TRACE__ = []; window.__DR_AERIAL_DRAWS__ = {};
    const aerial = g.manausAerial, update = aerial.update.bind(aerial);
    aerial.update = (...args) => {
      const value = update(...args), stats = aerial.stats;
      window.__DR_AERIAL_DRAWS__ = {};
      window.__DR_AERIAL_TRACE__.push({ altitudeM: args[0], local: g.localWorldRoot.visible,
        ready: stats.ready, aerial: stats.visible, opacity: stats.opacity,
        groundOwner: g.earthTransition.groundOwner, origin: g.renderOriginVec.toArray() });
      return value;
    };
    aerial.root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const render = mesh.onBeforeRender.bind(mesh);
      mesh.onBeforeRender = (...args) => {
        render(...args); const draws = window.__DR_AERIAL_DRAWS__;
        draws[mesh.name] = (draws[mesh.name] ?? 0) + 1;
      };
    });
  });
  await page.waitForTimeout(1500);
  results.ascent = [];
  const captureAscent = async targetM => {
    const sample = await page.evaluate(targetM => {
      const g = window.__DR_MANAUS__;
      return { targetM, altitudeM: g.universe.telemetry.altitudeM, position: g.player.position.toArray(),
        localVisible: g.localWorldRoot.visible, groundOwner: g.earthTransition.groundOwner,
        presentation: g.presentationDomain, aerial: g.manausAerial.stats,
        submittedDraws: { ...window.__DR_AERIAL_DRAWS__ }, renderOrigin: g.renderOriginVec.toArray(),
        body: g.universe.telemetry.dominantBody, domain: g.travelDomain.kind,
        city: g.realCity.stats, waterTriangles: g.water.triangles };
    }, targetM);
    results.ascent.push(sample);
    await page.screenshot({ path: `artifacts/manaus-ascent-${targetM / 1000}km${suffix}.png`, timeout: 90_000 });
    assert.equal(sample.body, 'earth'); assert.equal(sample.aerial.ready, true);
    assert.equal(sample.aerial.physics, false);
    if (targetM >= 12000) {
      assert.ok(sample.aerial.visible && sample.aerial.opacity > .05, `Aerial absent at ${targetM}m`);
      assert.ok(sample.submittedDraws['manaus-aerial-river'] > 0, `River not submitted at ${targetM}m`);
      assert.ok(sample.submittedDraws['manaus-aerial-urban'] > 0, `City not submitted at ${targetM}m`);
    }
    if (targetM >= 20000) {
      assert.equal(sample.localVisible, false, `Flat root retained at ${targetM}m`);
      assert.equal(sample.groundOwner, 'planet');
    }
  };
  await captureAscent(0);
  await page.keyboard.down('Space');
  await page.keyboard.press('f');
  await page.waitForFunction(() => window.__DR_MANAUS__.player.position.y > 50);
  await page.keyboard.press('v');
  await page.waitForFunction(() => window.__DR_MANAUS__.player.armed === 'mega');
  await page.keyboard.down('b');
  for (const altitudeM of [5000, 8000, 12000, 15000, 20000, 40000, 60000, 100000, 200000]) {
    await page.waitForFunction(altitudeM => window.__DR_MANAUS__.universe.telemetry.altitudeM >= altitudeM,
      altitudeM, { timeout: 300_000 });
    // Brake with ordinary input so the screenshot and its recorded pose describe the same view.
    await page.keyboard.up('Space'); await page.keyboard.up('b');
    await page.waitForFunction(() => window.__DR_MANAUS__.player.velocity.length() < 1,
      null, { timeout: 90_000 });
    await captureAscent(altitudeM);
    console.log(`Manaus ascent capture ${altitudeM}m:`, JSON.stringify(results.ascent.at(-1)));
    await page.keyboard.down('b'); await page.keyboard.down('Space');
  }
  await page.keyboard.up('Space'); await page.keyboard.up('b');
  results.ascentTrace = await page.evaluate(() => window.__DR_AERIAL_TRACE__);
  assert.ok(results.ascentTrace.length > 100, 'Actual flight was not observed');
  assert.ok(results.ascentTrace.every(t => t.local || t.aerial), 'Visibility gap during ascent');
  assert.ok(results.ascentTrace.some(t => t.local && t.aerial), 'No presentation overlap');
  assert.ok(results.ascentTrace.some(t => !t.local && t.groundOwner === 'planet'), 'No planetary handoff');
  console.log('Manaus continuous Space/B/V ascent and ten altitude captures:', JSON.stringify(results.ascent));
  assert.equal(results.errors.length, 0, results.errors.join('\n'));
  results.status = auditOnly ? 'audit-only' : 'passed';
  console.log(`Manaus surface browser ${results.status}: five radial samples, three aerial views, actual-road crater, zero browser errors.`);
} catch (error) {
  results.failure = error.stack ?? String(error);
  if (results.ascent) results.ascentFailureState = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    return { position: g.player.position.toArray(), velocity: g.player.velocity.toArray(), state: g.player.state,
      tier: g.player.speedMode, armed: g.player.armed, input: ['Space', 'KeyB'].map(k => g.input.held(k)),
      trace: window.__DR_AERIAL_TRACE__?.slice(-10) };
  }).catch(() => null);
  await page?.screenshot({ path: `artifacts/manaus-surface-failure${suffix}.png`, timeout: 5000 }).catch(() => {});
  throw error;
} finally {
  await writeFile(`artifacts/manaus-surface-browser${suffix}.json`, JSON.stringify(results, null, 2));
  await browser?.close(); await server?.close();
}
