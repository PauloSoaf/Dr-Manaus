import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/**
 * Flies the player across the city at a series of speeds and reports the per-system frame cost.
 *
 * Run `npm run build` first; this serves dist/. Note that it runs under SwiftShader, so the frame
 * TIMES are software-rasteriser times and mean little — what this is for is the CPU column, which
 * is where a streaming or rebuild stall would show up.
 */
const port = 4198, url = `http://127.0.0.1:${port}`;
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch {} await sleep(150); }
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  await page.goto(`${url}/?webgl=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DR_MANAUS__?.ready === true, null, { timeout: 60000 });
  await sleep(4000);
  for (const speed of [100, 500, 2000, 5000, 10000]) {
    const r = await page.evaluate(async (v) => {
      const g = window.__DR_MANAUS__;
      // Fly north-west across the city at a fixed speed, sampling the frame cost.
      g.player.teleport(new (g.player.position.constructor)(0, 300, 0));
      for (const k of Object.keys(g.profile)) g.profile[k] = 0;
      const frames = [];
      let last = performance.now();
      for (let i = 0; i < 90; i++) {
        g.player.velocity.set(-v * 0.7, 0, -v * 0.7);
        g.player.position.x += g.player.velocity.x / 60;
        g.player.position.z += g.player.velocity.z / 60;
        await new Promise(r => requestAnimationFrame(r));
        const now = performance.now(); frames.push(now - last); last = now;
      }
      frames.sort((a, b) => a - b);
      const prof = Object.entries(g.profile).filter(([, x]) => x > .05)
        .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, x]) => `${k} ${x.toFixed(1)}`).join(' ');
      return { median: frames[45], worst: frames[frames.length - 1], p90: frames[80], prof,
               tiles: g.realCity.stats.tiles, chunks: g.streamer.stats.active, queued: g.streamer.stats.queued,
               colliders: g.realCity.stats.colliders, cars: g.traffic ? g.traffic.stats.active : 0 };
    }, speed);
    console.log(`${String(speed).padStart(5)} m/s | frame med ${r.median.toFixed(0).padStart(4)} p90 ${r.p90.toFixed(0).padStart(4)} worst ${r.worst.toFixed(0).padStart(5)} ms | tiles ${r.tiles} chunks ${r.chunks} q${r.queued} col ${r.colliders} cars ${r.cars}`);
    console.log(`        | ${r.prof}`);
  }
} finally { await browser.close(); if (server.exitCode === null) server.kill(); }
