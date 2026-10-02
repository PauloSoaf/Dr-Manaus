import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {preview} from 'vite';
import {chromium} from '@playwright/test';

// Production preview, installed browser only. Explicit lab fixtures, not claimed gameplay destruction.
const server=await preview({preview:{host:'127.0.0.1',port:5188,strictPort:true}});
const results={cases:[],errors:[]};let browser,page;
try {
  await mkdir('artifacts',{recursive:true});
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
  page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>results.errors.push(e.message));page.on('console',m=>{if(m.type()==='error') results.errors.push(m.text());});
  await page.goto('http://127.0.0.1:5188/?volumeLab=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__DR_VOLUME_LAB__?.ready,null,{timeout:30_000});
  for(const body of ['earth','moon','mars']) {
    await page.selectOption('[data-body]',body);
    for(const scenario of ['intact','sphere','capsule']) {
      await page.selectOption('[data-scenario]',scenario);
      await page.waitForFunction(({body,scenario})=>{
        const snapshot=window.__DR_VOLUME_LAB__.snapshot();
        return snapshot.body===body&&snapshot.scenario===scenario&&snapshot.triangles>0
          &&snapshot.displayedRevision===snapshot.metrics.revision;
      },{body,scenario},{timeout:30_000});
      const snapshot=await page.evaluate(()=>window.__DR_VOLUME_LAB__.snapshot());
      assert.equal(snapshot.metrics.bodyId,body);assert.ok(snapshot.vertices>0&&snapshot.maxLocalCoordinate<=256);
      assert.ok(snapshot.metrics.resident<=64&&snapshot.metrics.residentMeshes<=8);
      assert.ok(snapshot.metrics.meshBytes<=8*1048576);assert.ok(snapshot.metrics.generatedThisFrame<=1&&snapshot.metrics.meshedThisFrame<=1);
      assert.ok(await page.evaluate(()=>!window.__DR_MANAUS__),'lab must not instantiate or replace Game terrain');
      results.cases.push(snapshot);
      await page.screenshot({path:`artifacts/volume-${body}-${scenario}.png`,timeout:30_000});
    }
    const bodyCases=results.cases.filter(row=>row.body===body);
    assert.notEqual(bodyCases[0].triangles,bodyCases[1].triangles,'sphere must change the extracted surface');
    assert.notEqual(bodyCases[0].triangles,bodyCases[2].triangles,'capsule must change the extracted surface');
    console.log(`${body}: intact, sphere cavity and capsule tunnel rendered with bounded local mesh buffers.`);
  }
  await page.locator('[data-view="inside"]').click();await page.screenshot({path:'artifacts/volume-mars-capsule-inside.png',timeout:30_000});
  await page.locator('[data-wireframe]').check();await page.screenshot({path:'artifacts/volume-mars-wireframe.png',timeout:30_000});
  await page.setViewportSize({width:480,height:800});
  assert.ok(await page.locator('[data-body]').isVisible());await page.screenshot({path:'artifacts/volume-mobile.png',timeout:30_000});
  results.dispose=await page.evaluate(()=>{
    const lab=window.__DR_VOLUME_LAB__,u=lab.universe;lab.dispose();return {metrics:u.volume.metrics,canvasCount:document.querySelectorAll('canvas').length};
  });
  assert.equal(results.dispose.metrics.bytes,0);assert.equal(results.dispose.metrics.meshBytes,0);
  assert.equal(results.dispose.metrics.pendingBytes,0);assert.equal(results.dispose.metrics.meshJobBytes,0);assert.equal(results.dispose.canvasCount,0);
  assert.equal(results.errors.length,0,results.errors.join('\n'));
  console.log('PHASE-3 volume lab production browser checks passed.');
} catch(error) {results.failure=String(error);throw error;}
finally {
  await writeFile('artifacts/volume-meshing-browser.json',JSON.stringify(results,null,2));
  await browser?.close();await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));
}
