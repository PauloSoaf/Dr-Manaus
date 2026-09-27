/** Temporary: does the character stay near the render origin at altitude? Delete when answered. */
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const host = '127.0.0.1';
const port = Number(process.env.DR_MANAUS_TEST_PORT ?? 4185);
const url = `http://${host}:${port}`;
const outDir = process.argv[2];
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
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.setDefaultTimeout(180_000);
  page.on('pageerror', e => console.error('pageerror:', e.message));
  await page.goto(`${url}/?webgl=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DR_MANAUS__?.ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => { window.__DR_MANAUS__.player.megaMode = true; });

  for (const alt of [60_000]) {
    await page.evaluate(a => {
      const g = window.__DR_MANAUS__;
      const V = Object.getPrototypeOf(g.player.position).constructor;
      g.player.teleport(new V(0, a, 0));
      g.player.state = 'Hover';
      g.player.velocity.set(0, 0, 0);
    }, alt);
    await sleep(4000);
    const stats = await page.evaluate(() => {
      const g = window.__DR_MANAUS__;
      const V = Object.getPrototypeOf(g.player.position).constructor;
      g.rendering.scene.updateMatrixWorld(true);
      const body = g.player.character.model ?? g.player.model;
      const renderPos = body ? body.getWorldPosition(new V()) : null;
      return {
        altitudeM: Math.round(g.player.position.y),
        originY: g.origin.y,
        worldRootY: g.worldRoot.position.y,
        // What the GPU actually sees for the character: this is what float32 has to carry.
        renderDistanceM: renderPos ? Math.round(renderPos.length()) : null,
        cameraRenderY: Math.round(g.rendering.camera.position.y),
        visible: (() => {
          const cam = g.rendering.camera;
          const rows = [];
          g.rendering.scene.traverse(o => {
            if (!o.visible) return;
            if (!(o.isMesh || o.isPoints || o.isSprite || o.isInstancedMesh)) return;
            let p = o, ok = true;
            while (p) { if (!p.visible) { ok = false; break; } p = p.parent; }
            if (!ok || !cam.layers.test(o.layers)) return;
            const count = o.isInstancedMesh ? o.count : (o.geometry?.getAttribute('position')?.count ?? 0);
            const path = (() => { const n = []; let q = o; while (q && q.parent) { n.unshift(q.name || q.type); q = q.parent; } return n.join('/'); })();
            rows.push({ path, count, type: o.type });
          });
          return rows.sort((a, b) => b.count - a.count).slice(0, 8);
        })(),
      };
    });
    console.log(JSON.stringify(stats));
    if (outDir) fs.writeFileSync(`${outDir}/skin-${String(alt).padStart(9, '0')}.png`, await page.screenshot({ animations: 'allow', timeout: 180_000 }));
  }
} finally {
  await browser?.close();
  server.kill();
}
