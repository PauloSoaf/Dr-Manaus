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

  await page.keyboard.press('f');
  await page.waitForFunction(() => window.__DR_MANAUS__.player.state !== 'Grounded', null, { timeout: 3_000 });
  const flightState = await page.evaluate(() => window.__DR_MANAUS__.player.state);

  if (errors.length) throw new Error(`Erros no navegador:\n${errors.join('\n')}`);
  console.log(`DR Manaus browser smoke OK | ${boot.backend} | chunks=${boot.activeChunks} | ${boot.state} -> ${flightState}`);
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill();
}
