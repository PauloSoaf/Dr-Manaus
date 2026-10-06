import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { localImpactCheckpoint } from './local-impact-browser-checkpoint.mjs';

const host = '127.0.0.1';
const port = Number(process.env.DR_MANAUS_TEST_PORT ?? 4173);
const url = `http://${host}:${port}`;
let serverOutput = '';
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const checkpoints = {};
const errors = [];
const startedAt = new Date().toISOString();
let stage = 'boot';
let status = 'failed';
let failure;
await mkdir('artifacts', { recursive: true });
const saveJson = (name, value) => writeFile(`artifacts/${name}.json`, JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2));

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    if (!game) return { ready: false };
    return {
      ready: game.ready, universe: game.universe.telemetry,
      domain: game.travelDomain.kind, surface: game.surfacePhysicsState,
      position: game.player.position.toArray(), velocity: game.player.velocity.toArray(),
      state: game.player.state, localRootVisible: game.localRoot.visible,
      cameraInSpace: game.camera.inSpace,
      cityUpdates: window.__DR_BROWSER_TELEMETRY__?.cityUpdates ?? 0,
      transitions: window.__DR_BROWSER_TELEMETRY__?.transitions ?? [],
      city: game.realCity.stats, streaming: game.streamer.stats,
    };
  });
}

let server;
let browser;
let context;
let page;
try {
  server = await createServer({
    // A test run must not reload halfway through while another developer edits the workspace.
    server: { host, port, strictPort: true, hmr: false, watch: null },
    customLogger: {
      info: message => { serverOutput += `${message}\n`; },
      warn: message => { serverOutput += `${message}\n`; },
      warnOnce: message => { serverOutput += `${message}\n`; },
      error: message => { serverOutput += `${message}\n`; },
      clearScreen() {}, hasErrorLogged: () => false, hasWarned: false,
    },
  });
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    args: [...(process.env.DR_BROWSER_GPU?[]:['--use-angle=swiftshader']), '--ignore-gpu-blocklist', '--enable-webgl'],
  });

  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  page = await context.newPage();

  page.on('pageerror', error => {errors.push(`pageerror: ${error.message}`);console.error(error.message);});
  page.on('crash', () => errors.push('crash: a aba do navegador caiu'));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${url}/?webgl=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DR_MANAUS__?.ready === true, null, { timeout: 25_000 });

  await page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    const samples = window.__DR_BROWSER_TELEMETRY__ = { transitions: [], cityUpdates: 0 };
    const update = game.travelDomain.update.bind(game.travelDomain);
    game.travelDomain.update = (travelContext, dt) => {
      const transition = update(travelContext, dt);
      if (transition.kind === 'departed' || transition.kind === 'returned') {
        samples.transitions.push({ ...transition, body: travelContext.bodyId, altitudeM: travelContext.altitudeM, speedMps: travelContext.speedMps, frame: game.universe.telemetry.frame });
      }
      return transition;
    };
    const cityUpdate = game.realCity.update.bind(game.realCity);
    game.realCity.update = (...args) => { samples.cityUpdates++; return cityUpdate(...args); };
  });

  const fatal = await page.locator('.fatal').count();
  if (fatal) throw new Error(`A tela fatal apareceu: ${await page.locator('.fatal').innerText()}`);

  const boot = await page.evaluate(() => ({
    ready: window.__DR_MANAUS__.ready,
    backend: window.__DR_MANAUS__.rendering.backend,
    state: window.__DR_MANAUS__.player.state,
    activeChunks: window.__DR_MANAUS__.streamer.stats.active,
    x: window.__DR_MANAUS__.player.position.x,
    y: window.__DR_MANAUS__.player.position.y,
    z: window.__DR_MANAUS__.player.position.z,
  }));

  if (!boot.ready) throw new Error('Game.ready permaneceu false após o boot.');
  if (boot.activeChunks < 9) throw new Error(`Streaming iniciou com apenas ${boot.activeChunks} chunks ativos.`);
  if (![boot.x, boot.y, boot.z].every(Number.isFinite)) throw new Error('Posição inicial do jogador contém valor inválido.');
  checkpoints.boot = boot;
  stage = 'city-and-input';

  // The compiled city streams asynchronously; give it a moment before measuring the real tiers.
  // Software rasterisation runs at a few frames a second, and the geometry budget is per frame,
  // so wait for the build queue to drain rather than for a wall-clock guess.
  await page.waitForFunction(
    () => window.__DR_MANAUS__.realCity.stats.shellTriangles > 0 && window.__DR_MANAUS__.realCity.stats.queued === 0,
    null, { timeout: 90_000 },
  ).catch(() => undefined);
  const city = await page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    return {
      enabled: game.realCity.stats.enabled,
      ...game.realCity.stats,
      drawCalls: game.rendering.renderer.info.render.drawCalls,
      triangles: game.rendering.renderer.info.render.triangles,
      hlod: game.hlod.stats,
      colliders: game.realCity.stats.colliders,
    };
  });

  if (city.enabled) {
    if (!city.tiles) throw new Error('A cidade real esta habilitada mas nenhum tile ficou residente.');
    if (!city.shellTriangles) throw new Error('Nenhuma geometria de footprint real foi construida.');
    if (!city.skyline) throw new Error('O horizonte real nao colocou nenhum bloco distante.');
    // The physical region must stay far smaller than the visible one at every speed.
    if (city.colliders > 900) throw new Error(`Colisores reais estouraram o orcamento: ${city.colliders}.`);
  }

  // Levelling a real building must remove it from the world, not merely from the collider list.
  const demolition = await page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    const victim = game.realCity.colliders.find(collider => collider.id && collider.id.startsWith('real:'));
    if (!victim) return { attempted: false };
    const before = game.realCity.colliders.length;
    const ok = game.destructible.destroy(victim.id);
    game.realCity.update(game.player.position, game.player.velocity, 1 / 60);
    return {
      attempted: true, ok, before,
      gone: !game.realCity.colliders.some(collider => collider.id === victim.id),
      destroyed: game.realCity.destroyedCount,
    };
  });
  if (demolition.attempted) {
    if (!demolition.ok) throw new Error('Nao foi possivel derrubar um predio real residente.');
    if (!demolition.gone) throw new Error('O predio derrubado continuou na lista de colisores.');
  }

  const places = await page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    return { districts: game.realCity.districts.size, here: game.realCity.districts.nearest(0, 0)?.name ?? null };
  });

  // The square is world zero and the theatre is a separate place ~98 m west of it.
  const geo = await page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    return {
      spawn: { x: game.player.position.x, z: game.player.position.z },
      district: document.querySelector('#district').textContent,
      marks: game.geoDebug.report().slice(0, 5),
    };
  });
  if (Math.hypot(geo.spawn.x, geo.spawn.z) > 200) {
    throw new Error(`O jogador nao nasceu no Largo: ${geo.spawn.x.toFixed(0)}, ${geo.spawn.z.toFixed(0)}.`);
  }

  // Every car must be ON a mapped drivable road, not merely near one.
  const traffic = await page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    if (!game.traffic) return { enabled: false };
    const graph = game.realCity.roads_graph;
    const mesh = game.worldRoot.getObjectByName('traffic-bodies');
    const offenders = [];
    let checked = 0;
    if (mesh) {
      const m = mesh.instanceMatrix.array;
      for (let i = 0; i < mesh.count; i++) {
        const x = m[i * 16 + 12], z = m[i * 16 + 14];
        if (!Number.isFinite(x) || (x === 0 && z === 0)) continue;
        checked++;
        const hit = graph.nearest(x, z, 60);
        const off = hit ? (() => {
          const s = hit.segment, p = s.p;
          let best = Infinity;
          for (let k = 2; k < p.length; k += 2) {
            const ax = p[k-2], az = p[k-1], bx = p[k], bz = p[k+1];
            const dx = bx-ax, dz = bz-az, L2 = dx*dx+dz*dz || 1;
            const u = Math.max(0, Math.min(1, ((x-ax)*dx + (z-az)*dz)/L2));
            best = Math.min(best, Math.hypot(x-ax-dx*u, z-az-dz*u));
          }
          return best - s.width / 2;
        })() : Infinity;
        if (off > 3) offenders.push(Math.round(off));
      }
    }
    return { enabled: true, active: game.traffic.stats.active, segments: game.traffic.stats.segments,
             nodes: game.traffic.stats.nodes, checked, offenders: offenders.slice(0, 6), offCount: offenders.length };
  });
  if (traffic.enabled) {
    if (!traffic.active) throw new Error('A malha viaria carregou mas nenhum carro apareceu.');
    if (traffic.offCount) throw new Error(`${traffic.offCount} de ${traffic.checked} carros fora da faixa: ${traffic.offenders.join(', ')} m.`);
  }
  checkpoints.city = city;

  // The pause menu has to open on Esc, stop the world taking input, and actually apply a change.
  await page.keyboard.press('Escape');
  await sleep(250);
  const paused = await page.evaluate(() => ({
    open: !document.querySelector('#pause-panel').hidden,
    inputEnabled: window.__DR_MANAUS__.input.enabled,
    tabs: document.querySelectorAll('.pause-tab[data-tab]').length,
  }));
  if (!paused.open) throw new Error('Esc nao abriu o menu de pausa.');
  if (paused.inputEnabled) throw new Error('O menu de pausa nao suspendeu a entrada do jogo.');
  if (paused.tabs < 5) throw new Error(`O menu tem apenas ${paused.tabs} secoes.`);

  await page.click('.pause-tab[data-tab="video"]');
  await page.click('.pause-tab[data-tab="audio"]');
  const applied = await page.evaluate(async () => {
    const game = window.__DR_MANAUS__;
    const master = document.querySelector('#vol-master');
    master.value = '35';
    master.dispatchEvent(new Event('input', { bubbles: true }));
    const fov = document.querySelector('#fov');
    fov.value = '74';
    fov.dispatchEvent(new Event('input', { bubbles: true }));
    const sens = document.querySelector('#sensitivity');
    sens.value = '210';
    sens.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      saved: game.save.data.settings.masterVolume,
      mix: game.audio.mix.master,
      readout: document.querySelector('#vol-master-value').textContent,
      fov: game.camera.baseFov,
      sensitivity: game.camera.sensitivity,
      audioSection: !document.querySelector('.pause-section[data-section="audio"]').hidden,
    };
  });
  if (Math.abs(applied.saved - .35) > 1e-6) throw new Error(`O volume nao foi salvo: ${applied.saved}`);
  if (Math.abs(applied.mix - .35) > 1e-6) throw new Error(`O mixer nao recebeu o volume: ${applied.mix}`);
  if (applied.readout !== '35%') throw new Error(`O indicador do slider mostra "${applied.readout}".`);
  if (applied.fov !== 74) throw new Error(`O campo de visao nao foi aplicado: ${applied.fov}`);
  if (Math.abs(applied.sensitivity - 2.1) > 1e-6) throw new Error(`A sensibilidade nao foi aplicada: ${applied.sensitivity}`);
  if (!applied.audioSection) throw new Error('A aba de audio nao ficou visivel.');

  await page.keyboard.press('Escape');
  await sleep(200);
  const resumed = await page.evaluate(() => ({
    open: !document.querySelector('#pause-panel').hidden,
    inputEnabled: window.__DR_MANAUS__.input.enabled,
  }));
  if (resumed.open || !resumed.inputEnabled) throw new Error('Esc nao retomou o jogo.');

  await page.keyboard.press('f');
  stage = 'takeoff-and-destruction';
  // Generous: the showcase square builds during the first frames, and software rasterisation
  // runs at a few frames a second, so a keypress can take a moment to be consumed.
  await page.waitForFunction(() => window.__DR_MANAUS__.player.state !== 'Grounded', null, { timeout: 20_000 });
  const flightState = await page.evaluate(() => window.__DR_MANAUS__.player.state);

  const destructionCoverage = await page.evaluate(() => {
    const game=window.__DR_MANAUS__, point=game.player.position.clone();point.y=0;
    game.terrain.damageAt(point,22,2600);game.terrain.update(point,game.renderOriginVec);
    const depth=game.terrain.heightAt(point.x,point.z), surfaces=game.terrain.stats.surfaces;
    const victim=game.largo.colliders.find(c=>c.id?.startsWith('largo:venue:'))??game.largo.colliders.find(c=>c.id==='largo:monumento');
    const removed=victim&&game.destructible.destroy(victim.id)&&!game.largo.colliders.some(c=>c.id===victim.id);
    const restored=game.largo.restore(point,1000);
    return {depth,surfaces,removed,restored,terrain:game.terrain.stats};
  });
  await page.waitForTimeout(1200);
  await page.screenshot({path:'artifacts/destruction-browser.png'});
  if(destructionCoverage.depth>=-3||destructionCoverage.surfaces<3||!destructionCoverage.removed||!destructionCoverage.restored)throw new Error(`Destruction coverage failed: ${JSON.stringify(destructionCoverage)}`);
  console.log(`  authored destruction + crater: ${JSON.stringify(destructionCoverage)}`);
  checkpoints.destruction = destructionCoverage;
  stage = 'local-impact-p0';
  checkpoints.localImpact = await localImpactCheckpoint(page);

  // Visual validation: Scenario 1 - Ground Golden Hour (climb to ~100m, clear weather, horizon view)
  console.log('  taking off and climbing to 100m for Golden Hour visual validation...');
  // F toggles local flight; inspect state before pressing it a second time.
  const ensureFlying = async () => {
    if (await page.evaluate(() => ['Hover', 'Flight'].includes(window.__DR_MANAUS__.player.state))) return;
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => ['Hover', 'Flight'].includes(window.__DR_MANAUS__.player.state),
      null, { timeout: 5_000 });
  };
  await ensureFlying();
  await page.keyboard.down('Space');
  // Polled with a trace, like the ascent below: a software rasteriser running the whole city
  // simulates far less than wall-clock, and a bare timeout reports nothing about why.
  const climbStart = Date.now();
  let climb;
  while (Date.now() - climbStart < 60_000) {
    climb = await page.evaluate(() => {
      const g = window.__DR_MANAUS__;
      return { y: g.player.position.y, vy: g.player.velocity.y, state: g.player.state, fps: g.frame?.fps };
    });
    if (climb.y >= 90) break;
    console.log(`    [climb] y=${climb.y.toFixed(1)}m vy=${climb.vy.toFixed(1)} ${climb.state} fps=${climb.fps}`);
    await sleep(2000);
  }
  await page.keyboard.up('Space');
  if (!climb || climb.y < 90) throw new Error(`Climb to 90 m failed: ${JSON.stringify(climb)}`);

  const goldenHourTelemetry = await page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    game.atmosphere.time = 'Golden Hour';
    game.atmosphere.weather = 'clear';
    game.camera.pitch = 0;
    const y = game.player.position.y;
    game.atmosphere.setAltitude(y);
    game.atmosphere.update(0.016, game.player.position);
    game.space.update(y, game.atmosphere.time === 'Night', 0.016, game.atmosphere.weather);
    return {
      altitudeM: y,
      time: game.atmosphere.time,
      weather: game.atmosphere.weather,
      cloudsVisible: game.atmosphere.clouds.visible,
      starsVisible: game.space.starsVisible,
      skyVisible: game.atmosphere.sky.visible,
      cameraForward: [0, 0, -1],
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/earth-100m-clear-golden-horizon.png' });
  await saveJson('earth-100m-clear-golden-horizon', goldenHourTelemetry);
  console.log(`  visual validation 100m GoldenHour: clouds=${goldenHourTelemetry.cloudsVisible}, stars=${goldenHourTelemetry.starsVisible}, sky=${goldenHourTelemetry.skyVisible}`);
  if (goldenHourTelemetry.cloudsVisible) throw new Error('Clouds must be hidden in clear weather at 100m');
  if (goldenHourTelemetry.starsVisible) throw new Error('Stars must not leak onto daytime sky at 100m');

  // Scenario 2: Authentic interplanetary flight pipeline from Manaus to deep space and reentry
  console.log('  starting authentic interplanetary flight scenario...');
  stage = 'authentic-ascent';

  // Step 1: Ensure clean input state before arming
  await page.keyboard.up('Space');
  await sleep(150);

  // Step 2: Pitch camera up to zenith
  await page.evaluate(() => {
    window.__DR_MANAUS__.camera.pitch = -1.15;
  });

  // Local tiers are explicit: B boosts, double V arms interplanetary. Below the altitude
  // floor the same arm is capped at Mega; holding Shift never advances through tiers.
  await ensureFlying();
  await page.keyboard.down('KeyB');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__DR_MANAUS__.player.speedMode === 'super');
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => window.__DR_MANAUS__.player.armed === 'mega');
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => window.__DR_MANAUS__.player.armed === 'interplanetary');
  await page.keyboard.up('KeyB');
  await page.waitForFunction(() => !window.__DR_MANAUS__.player.armWaitingForBoostRelease);
  await page.keyboard.down('KeyB');
  await page.waitForFunction(() => ['mega','interplanetary'].includes(window.__DR_MANAUS__.player.speedMode));

  // Poll with diagnostic trace if timeout approaches
  const startTime = Date.now();
  while (Date.now() - startTime < 35_000) {
    const status = await page.evaluate(() => {
      const g = window.__DR_MANAUS__;
      return {
        y: g.player.position.y,
        vy: g.player.velocity.y,
        altitudeM: g.universe.telemetry.altitudeM,
        state: g.player.state,
        speedMode: g.player.speedMode,
        armed: g.player.armed,
        heldB: g.input.held('KeyB'),
        heldSpace: g.input.held('Space'),
        local: g.travelDomain.localPhysicsActive,
        domainKind: g.travelDomain.kind,
      };
    });
    if (status.y >= 9000 || status.altitudeM >= 9000) {
      console.log(`  climbed to threshold: y=${status.y.toFixed(0)}m, alt=${status.altitudeM.toFixed(0)}m, vy=${status.vy.toFixed(0)}m/s, mode=${status.speedMode}`);
      break;
    }
    await sleep(500);
    if ((Date.now() - startTime) % 2000 < 600) {
      console.log(`    [climb trace] y=${status.y.toFixed(0)}m, alt=${status.altitudeM.toFixed(0)}m, vy=${status.vy.toFixed(0)}m/s, mode=${status.speedMode}, armed=${status.armed}, heldB=${status.heldB}`);
    }
  }

  const reached9k = await page.evaluate(() => window.__DR_MANAUS__.player.position.y >= 9000 || window.__DR_MANAUS__.universe.telemetry.altitudeM >= 9000);
  if (!reached9k) throw new Error('Timeout waiting to climb past 9 km');
  console.log('  crossed 9 km threshold, entering space...');

  // Wait for space domain handoff (localPhysicsActive becomes false)
  await page.waitForFunction(
    () => window.__DR_MANAUS__.travelDomain.localPhysicsActive === false,
    null, { timeout: 20_000 }
  );

  // Release local B after handoff. Space B only advances Warp; Shift is the boost modifier.
  await page.keyboard.up('KeyB');
  await page.keyboard.down('ShiftLeft');

  // Step 4: Continue vertical thrust to climb through 100 km
  await page.waitForFunction(
    () => window.__DR_MANAUS__.universe.telemetry.altitudeM >= 100_000,
    null, { timeout: 35_000 }
  );
  const alt100k = await page.evaluate(() => window.__DR_MANAUS__.universe.telemetry.altitudeM);
  console.log(`  reached 100 km orbit: altitude = ${(alt100k / 1000).toFixed(1)} km`);

  // Step 5: Continue ascent to 1,000 km
  const climb1000kStart = Date.now();
  while (Date.now() - climb1000kStart < 60_000) {
    const curAlt = await page.evaluate(() => window.__DR_MANAUS__.universe.telemetry.altitudeM);
    if (curAlt >= 1_000_000) break;
    await sleep(1000);
    console.log(`    [orbit ascent] altitude = ${(curAlt / 1000).toFixed(1)} km`);
  }
  const alt1000k = await page.evaluate(() => window.__DR_MANAUS__.universe.telemetry.altitudeM);
  if (alt1000k < 1_000_000) throw new Error(`Timeout reaching 1,000 km orbit: currently at ${(alt1000k / 1000).toFixed(1)} km`);
  console.log(`  reached 1,000 km deep orbit: altitude = ${(alt1000k / 1000).toFixed(1)} km`);

  // Step 6: Release boost and coast for ten seconds; every domain transition is recorded.
  await page.keyboard.up('Space');
  await page.keyboard.up('ShiftLeft');
  stage = 'coasting';
  const coastStarted = await snapshot(page);
  await sleep(10_000);

  // Verify coasting stability: no domain oscillation
  const coastTelemetry = await page.evaluate(() => ({
    altitudeM: window.__DR_MANAUS__.universe.telemetry.altitudeM,
    localPhysicsActive: window.__DR_MANAUS__.travelDomain.localPhysicsActive,
    speedMode: window.__DR_MANAUS__.player.speedMode,
    dominantBody: window.__DR_MANAUS__.universe.telemetry.dominantBody,
    frame: window.__DR_MANAUS__.universe.telemetry.frame,
  }));
  if (coastTelemetry.localPhysicsActive !== false) throw new Error('Domain oscillated back to local during space coasting');
  const coastEnded = await snapshot(page);
  if (coastEnded.transitions.length !== coastStarted.transitions.length) throw new Error(`Domain changed during coasting: ${JSON.stringify(coastEnded.transitions)}`);
  if (coastEnded.localRootVisible) throw new Error('Manaus remained visible while coasting in space');
  if (coastEnded.cityUpdates !== coastStarted.cityUpdates) throw new Error('RealCity simulation advanced outside Earth local space');
  checkpoints.coasting = { started: coastStarted, ended: coastEnded, durationMs: 10_000 };

  // Step 7: Camera rotate to nadir (looking down at Earth)
  await page.evaluate(() => {
    window.__DR_MANAUS__.camera.pitch = 1.15;
  });
  await sleep(500);

  // Step 8: Assert Earth Globe visible, coarse fallback ready, and render coordinates strictly bounded
  const orbitTelemetry = await page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    const earthGlobe = game.earth?.globe;
    const earthGroup = earthGlobe?.group;
    const renderPos = earthGroup ? [earthGroup.position.x, earthGroup.position.y, earthGroup.position.z] : [0, 0, 0];
    const maxRenderCoord = Math.max(Math.abs(renderPos[0]), Math.abs(renderPos[1]), Math.abs(renderPos[2]));

    let maxTileCoord = 0;
    if (earthGroup) {
      earthGroup.traverse(child => {
        if (child.isMesh && child.name.startsWith('earth-')) {
          maxTileCoord = Math.max(
            maxTileCoord,
            Math.abs(child.position.x),
            Math.abs(child.position.y),
            Math.abs(child.position.z)
          );
        }
      });
    }

    return {
      altitudeM: game.universe.telemetry.altitudeM,
      dominantBody: game.universe.telemetry.dominantBody,
      frame: game.universe.telemetry.frame,
      speedMode: game.player.speedMode,
      earthGlobeVisible: earthGlobe?.visible ?? false,
      coarseFallbackReady: earthGlobe?.stats?.coarseFallback ?? false,
      earthGroupRenderPosition: renderPos,
      maxRenderCoord,
      maxTileCoord,
      renderSafe: maxRenderCoord <= 20_000_000,
      tilesLocalSafe: maxTileCoord <= 6_400_000,
      starsVisible: game.space.starsVisible,
      cloudsVisible: game.atmosphere.clouds.visible,
    };
  });

  await page.screenshot({ path: 'artifacts/earth-orbit-nadir.png' });
  await saveJson('earth-orbit-nadir', orbitTelemetry);
  checkpoints.orbit = orbitTelemetry;
  console.log(`  visual validation Orbit: earthVisible=${orbitTelemetry.earthGlobeVisible}, fallbackReady=${orbitTelemetry.coarseFallbackReady}, maxRenderCoord=${orbitTelemetry.maxRenderCoord.toFixed(0)}m, renderSafe=${orbitTelemetry.renderSafe}`);
  if (orbitTelemetry.earthGlobeVisible !== true) throw new Error('Earth globe must be visible in orbit');
  if (!orbitTelemetry.coarseFallbackReady) throw new Error('Earth coarse fallback must be ready in orbit');
  if (!orbitTelemetry.renderSafe) throw new Error(`Earth render position exceeds safe bound: ${orbitTelemetry.maxRenderCoord}m`);
  if (!orbitTelemetry.tilesLocalSafe) throw new Error(`Earth tile mesh coordinate exceeds body-local bound: ${orbitTelemetry.maxTileCoord}m`);

  /*
   * Step 9: reentry.
   *
   * Out here X is the space brake and Shift modifies forward thrust; this harness held Shift to "brake" and so
   * accelerated away, climbing from 14 000 km to 17 300 km while waiting to be captured. The
   * outward velocity has to be killed first, then the nose put on the planet, and only then is
   * there anything for the capture to catch.
   */
  console.log('  initiating reentry descent...');
  stage = 'authentic-reentry';
  await ensureFlying();
  const altitudeNow = () => page.evaluate(() => window.__DR_MANAUS__.universe.telemetry.altitudeM);

  await page.keyboard.down('KeyX');
  let relativeSpeed = Infinity;
  const brakeStart = Date.now();
  while (Date.now() - brakeStart < 120_000) {
    await sleep(2000);
    relativeSpeed = await page.evaluate(() => window.__DR_MANAUS__.currentGameplaySpeedMps());
    console.log(`    [outward brake] relative speed = ${relativeSpeed.toFixed(1)} m/s`);
    if (relativeSpeed <= 120) break;
  }
  await page.keyboard.up('KeyX');
  if (relativeSpeed > 120) throw new Error(`Space X failed to arrest outward motion: ${relativeSpeed} m/s`);
  console.log('  outward velocity arrested; pointing at Earth');

  /*
   * Lock Earth and let the autopilot fly home.
   *
   * Pitching the camera down does not point at anything from here: the camera is oriented to the
   * player, not to the planet, and at a hundred thousand kilometres Earth is in whatever direction
   * it happens to be. Thrusting "down" only climbed further out. The navigation lock is what knows
   * where the target actually is.
   */
  await page.evaluate(() => window.__DR_MANAUS__.selectNavigationTarget('earth', 'hud'));
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__DR_MANAUS__.interplanetary.autopilot.active,
    null, { timeout: 15_000 });
  const descentStart = Date.now();
  while (Date.now() - descentStart < 180_000) {
    const curAlt = await altitudeNow();
    if (curAlt <= 25_000) break;
    await sleep(1500);
    const phase = await page.evaluate(() => window.__DR_MANAUS__.interplanetary.autopilot.phase);
    console.log(`    [reentry descent] altitude = ${(curAlt / 1000).toFixed(1)} km, autopilot ${phase}`);
  }

  // Let the real autopilot complete its safe approach. X would cancel that command and
  // leave the observer coasting above the return altitude rather than testing the handoff.
  // Wait for reentry handoff to local domain
  await page.waitForFunction(
    () => window.__DR_MANAUS__.travelDomain.localPhysicsActive === true,
    null, { timeout: 120_000 }
  );

  const reentryTelemetry = await page.evaluate(() => {
    const game = window.__DR_MANAUS__;
    return {
      altitudeM: game.universe.telemetry.altitudeM,
      localPhysicsActive: game.travelDomain.localPhysicsActive,
      dominantBody: game.universe.telemetry.dominantBody,
      frame: game.universe.telemetry.frame,
      activeChunks: game.streamer.stats.active,
      realCityTiles: game.realCity.stats.tiles,
    };
  });

  await page.screenshot({ path: 'artifacts/earth-reentry.png' });
  await saveJson('earth-reentry', reentryTelemetry);
  console.log(`  reentry complete: localPhysicsActive=${reentryTelemetry.localPhysicsActive}, altitude=${reentryTelemetry.altitudeM.toFixed(0)}m, streamerChunks=${reentryTelemetry.activeChunks}`);
  if (!reentryTelemetry.localPhysicsActive) throw new Error('Failed to handoff back to local domain on reentry');
  await sleep(2000);
  const earthReturned = await snapshot(page);
  const earthTransitions = earthReturned.transitions.map(transition => transition.kind);
  if (earthTransitions.join(',') !== 'departed,returned') throw new Error(`Expected one departure and one return: ${JSON.stringify(earthReturned.transitions)}`);
  if (!earthReturned.localRootVisible || !earthReturned.surface.manausSimulationActive) throw new Error('Manaus simulation did not resume after Earth reentry');
  checkpoints.reentry = earthReturned;

  if (errors.length) throw new Error(`Erros no navegador:\n${errors.join('\n')}`);
  console.log(`DR Manaus browser smoke OK | ${boot.backend} | chunks=${boot.activeChunks} | ${boot.state} -> ${flightState}`);
  console.log(city.enabled
    ? `  cidade real: ${city.tiles} tiles, ${city.near} celulas proximas, ${city.detailTriangles.toLocaleString()} tri perto + ${city.shellTriangles.toLocaleString()} tri casca, ${city.skyline} blocos de horizonte, ${city.colliders} colisores`
    : '  cidade real: desabilitada (manifesto ausente) — fallback procedural ativo');
  console.log(`  quadro inicial: ${city.drawCalls} draw calls, ${city.triangles.toLocaleString()} triangulos | HLOD ${city.hlod.medium}/${city.hlod.aggregate}/${city.hlod.horizon}`);
  console.log(places.districts
    ? `  bairros reais: ${places.districts} compilados, origem = ${places.here ?? 'sem correspondencia'}`
    : '  bairros reais: nao compilados ainda');
  console.log(`  geografia: spawn ${geo.spawn.x.toFixed(0)},${geo.spawn.z.toFixed(0)} em ${geo.district} | ${geo.marks.join(' | ')}`);
  console.log(traffic.enabled
    ? `  transito: ${traffic.active} carros sobre ${traffic.segments} vias e ${traffic.nodes} cruzamentos, ${traffic.checked} verificados na faixa`
    : '  transito: sem malha viaria compilada');
  console.log(`  menu de pausa: ${paused.tabs} secoes, volume/fov/sensibilidade aplicados e salvos`);
  console.log(demolition.attempted
    ? `  destruicao: predio real derrubado e removido do mundo (${demolition.destroyed} registrado)`
    : '  destruicao: nenhum predio real ao alcance para testar');
  status = 'passed';
} catch (error) {
  failure = error instanceof Error ? error.stack : String(error);
  if (page && !page.isClosed()) {
    checkpoints.failure = await snapshot(page).catch(error => ({ captureError: String(error) }));
    await page.screenshot({ path: 'artifacts/browser-failure.png', timeout: 5000 }).catch(() => undefined);
  }
  throw error;
} finally {
  await saveJson('browser-summary', { status, stage, startedAt, finishedAt: new Date().toISOString(), failure, errors, checkpoints });
  await writeFile('artifacts/browser-server.log', serverOutput);
  await context?.tracing.stop({ path: 'artifacts/browser-trace.zip' }).catch(() => undefined);
  await browser?.close();
  await server?.close();
}
