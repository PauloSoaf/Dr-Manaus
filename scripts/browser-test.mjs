import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = Number(process.env.DR_MANAUS_TEST_PORT ?? 4173);
const url = `http://${host}:${port}`;
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

const server = spawn(process.execPath, [viteBin, '--host', host, '--port', String(port), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite encerrou antes do teste.\n${serverOutput}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server may still be binding to the port.
    }
    await sleep(150);
  }
  throw new Error(`Vite não respondeu em ${url}.\n${serverOutput}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];

  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('crash', () => errors.push('crash: a aba do navegador caiu'));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${url}/?webgl=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DR_MANAUS__?.ready === true, null, { timeout: 25_000 });

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
  await page.waitForFunction(() => window.__DR_MANAUS__.player.state !== 'Grounded', null, { timeout: 3_000 });
  const flightState = await page.evaluate(() => window.__DR_MANAUS__.player.state);

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
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill();
}
