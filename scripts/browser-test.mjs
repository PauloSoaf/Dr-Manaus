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

  await page.keyboard.press('f');
  await page.waitForFunction(() => window.__DR_MANAUS__.player.state !== 'Grounded', null, { timeout: 3_000 });
  const flightState = await page.evaluate(() => window.__DR_MANAUS__.player.state);

  if (errors.length) throw new Error(`Erros no navegador:\n${errors.join('\n')}`);
  console.log(`DR Manaus browser smoke OK | ${boot.backend} | chunks=${boot.activeChunks} | ${boot.state} -> ${flightState}`);
  console.log(city.enabled
    ? `  cidade real: ${city.tiles} tiles, ${city.near} celulas proximas, ${city.detailTriangles.toLocaleString()} tri perto + ${city.shellTriangles.toLocaleString()} tri casca, ${city.skyline} blocos de horizonte, ${city.colliders} colisores`
    : '  cidade real: desabilitada (manifesto ausente) — fallback procedural ativo');
  console.log(`  quadro inicial: ${city.drawCalls} draw calls, ${city.triangles.toLocaleString()} triangulos | HLOD ${city.hlod.medium}/${city.hlod.aggregate}/${city.hlod.horizon}`);
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill();
}
