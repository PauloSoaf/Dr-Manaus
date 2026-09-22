import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const base = process.env.DR_COSMIC_URL ?? 'http://127.0.0.1:5273';
const label = process.argv[2] ?? 'current';
await fs.mkdir('artifacts/cosmic', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: `import '/src/debug/CosmicLab.ts';` }));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/?webgl=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__COSMIC_LAB__,null,{timeout:45000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:`artifacts/cosmic/${label}-front.png`});
  console.log(JSON.stringify(await page.evaluate(()=>({backend:'isWebGPUBackend' in window.__COSMIC_LAB__.renderer.backend?'WebGPU':'WebGL2',draws:window.__COSMIC_LAB__.renderer.info.render.drawCalls,triangles:window.__COSMIC_LAB__.renderer.info.render.triangles,textures:window.__COSMIC_LAB__.renderer.info.memory.textures,cosmic:window.__COSMIC_LAB__.character.cosmicDiagnostics})),null,2));
  if(errors.length)throw new Error(errors.join('\n'));
} finally { await browser.close(); }
