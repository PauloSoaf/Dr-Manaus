/** Temporary: is the Moon where the Moon is, and does it have a surface? Delete when answered. */
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const host = '127.0.0.1';
const port = Number(process.env.DR_MANAUS_TEST_PORT ?? 4181);
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
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`${url}/?webgl=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DR_MANAUS__?.ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => { window.__DR_MANAUS__.player.megaMode = true; });

  // Where the ephemeris puts the Moon, in scene metres.
  console.log('ephemeris', JSON.stringify(await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    const s = g.universe.activeSystem;
    const moon = s.positionOf('moon'), earth = s.positionOf('earth');
    const rel = moon && earth ? [moon[0] - earth[0], moon[1] - earth[1], moon[2] - earth[2]] : null;
    return {
      earthMoonKm: rel ? Math.round(Math.hypot(...rel) / 1000) : null,
      moonStats: g.moon?.stats ?? null,
    };
  })));

  // Park the player just off the Moon and keep the camera aimed at it every frame, using world
  // matrices so a floating-origin rebase cannot leave the camera behind.
  const shot = await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    const V = Object.getPrototypeOf(g.player.position).constructor;
    const moonGroup = g.worldRoot.children.find(c => c.name === 'moon');
    const p = moonGroup.position;
    g.player.teleport(new V(p.x, p.y - 6_000_000, p.z));
    g.player.state = 'Hover';
    g.camera.update = () => {
      const cam = g.rendering.camera;
      g.rendering.scene.updateMatrixWorld(true);
      const centre = moonGroup.getWorldPosition(new V());
      cam.position.copy(centre).add(new V(0, -6_000_000, 0));
      cam.up.set(0, 0, -1);
      cam.lookAt(centre);
      cam.updateMatrixWorld(true);
    };
    return { moonAt: [Math.round(p.x), Math.round(p.y), Math.round(p.z)] };
  });
  console.log('placed', JSON.stringify(shot));
  await sleep(20000);
  // Light it from behind the camera, to separate "not lit" from "not drawn".
  await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    g.moon.setSunDirection = () => {};
    // Side-lit, so the terminator is visible rather than a fully lit disc.
    g.moon.globe.setSunDirection([0.85, -0.5, 0.15]);
  });
  await sleep(4000);
  console.log('after', JSON.stringify(await page.evaluate(() => {
    const g = window.__DR_MANAUS__;
    const t = g.universe.telemetry;
    const opts = g.moon.options ?? null;
    return {
      moon: g.moon.stats,
      earth: g.earth?.stats ?? null,
      telemetryAlt: Math.round(t.altitudeM),
      streamingEnabled: g.universe.streamingEnabled,
      activeProviders: g.universe.providers.active({
        timeS: 0, player: g.universe.player, frame: null,
        localVelocityMps: [0,0,0], altitudeM: t.altitudeM, bodyId: 'earth',
      }).map(p => p.id),
      moonOptions: opts,
      clip: (() => {
        const cam = g.rendering.camera;
        g.rendering.scene.updateMatrixWorld(true);
        cam.updateMatrixWorld(true);
        const V = Object.getPrototypeOf(cam.position).constructor;
        const v = new V();
        const group = g.worldRoot.children.find(c => c.name === 'moon');
        const meshes = group.children.filter(c => c.isMesh);
        let on = 0, nearest = Infinity, sample = null;
        for (const m of meshes) {
          const pos = m.geometry.attributes.position;
          const wp = m.getWorldPosition(new V());
          nearest = Math.min(nearest, wp.distanceTo(cam.position));
          for (let i = 0; i < pos.count; i += 29) {
            v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld).project(cam);
            if (!sample) sample = [v.x, v.y, v.z].map(x => +x.toFixed(3));
            if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z >= -1 && v.z <= 1) { on++; break; }
          }
        }
        return {
          meshes: meshes.length, onScreen: on,
          nearestKm: Math.round(nearest / 1000),
          sampleNdc: sample,
          camNearFar: [cam.near, cam.far],
          camMask: cam.layers.mask, meshMask: meshes[0]?.layers.mask,
          groupVisible: group.visible, parentVisible: group.parent.visible,
        };
      })(),
    };
  })));
  fs.writeFileSync(`${outDir}/moon.png`, await page.screenshot({ animations: 'allow', timeout: 180_000 }));
} finally {
  await browser?.close();
  server.kill();
}
