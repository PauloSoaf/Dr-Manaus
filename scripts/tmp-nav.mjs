/** Temporary: after departure, is the player near Earth or near the Sun? Delete after. */
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = Number(process.env.DR_MANAUS_TEST_PORT ?? 4177);
const url = `http://${host}:${port}`;
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [viteBin, '--host', host, '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
server.stdout.on('data', c => { out += c; });
server.stderr.on('data', c => { out += c; });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`vite exited\n${out}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await sleep(150);
  }
  throw new Error(`no server\n${out}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  page.setDefaultTimeout(180_000);
  page.on('pageerror', e => console.error('pageerror:', e.message));
  await page.goto(`${url}/?webgl=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DR_MANAUS__?.ready === true, null, { timeout: 60_000 });

  // Low orbit, then fly the way a player does until the domain takes over.
  await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    const V = Object.getPrototypeOf(g.player.position).constructor;
    g.player.teleport(new V(0, 300_000, 0));
    g.player.state = 'Hover';
  });
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await sleep(14000);

  console.log(JSON.stringify(await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    const sys = g.universe.activeSystem;
    const player = g.travelDomain.state?.positionM;
    const near = (id) => {
      const p = sys.positionOf(id);
      if (!p || !player) return null;
      const d = Math.hypot(p[0] - player[0], p[1] - player[1], p[2] - player[2]);
      const body = sys.bodies.find(b => b.id === id);
      return {
        km: Math.round(d / 1000),
        angularDeg: body ? +(2 * Math.asin(Math.min(1, body.equatorialRadiusM / d)) * 180 / Math.PI).toFixed(3) : null,
      };
    };
    return {
      domain: g.travelDomain.kind,
      hasState: !!player,
      sun: near('sun'),
      earth: near('earth'),
      moon: near('moon'),
    };
  }), null, 2));

  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
} finally {
  await browser?.close();
  server.kill();
}
