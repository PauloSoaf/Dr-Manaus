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
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:5188/?volumeLab=1&volumeCollision=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__DR_VOLUME_LAB__?.snapshot().collision?.resident>0,null,{timeout:30_000});
  results.collision=[];
  for(const body of ['earth','moon','mars']) {
    await page.selectOption('[data-body]',body);
    await page.waitForFunction(body=>{const s=window.__DR_VOLUME_LAB__.snapshot();return s.body===body&&s.collision.resident>0&&s.displayedRevision===s.metrics.revision;},body,{timeout:30_000});
    await page.evaluate(()=>{const lab=window.__DR_VOLUME_LAB__;lab.pause();lab.reset();lab.runFrames(120);});
    const floor=await page.evaluate(()=>window.__DR_VOLUME_LAB__.snapshot());assert.equal(floor.player.state,'Grounded');
    await page.keyboard.down('KeyW');await page.evaluate(()=>window.__DR_VOLUME_LAB__.runFrames(5));await page.keyboard.up('KeyW');
    const walk=await page.evaluate(()=>window.__DR_VOLUME_LAB__.snapshot());assert.ok(Math.abs(walk.player.position[2]-floor.player.position[2])>.05);
    await page.evaluate(()=>{const lab=window.__DR_VOLUME_LAB__;lab.reset();lab.runFrames(120);});
    await page.keyboard.down('Space');
    const jump=await page.evaluate(()=>{const lab=window.__DR_VOLUME_LAB__;let ceiling=false,raised=false;
      const before=lab.snapshot().player.position[1];for(let i=0;i<180;i++){lab.runFrames(1);const s=lab.snapshot();ceiling ||= s.player.contact?.kind==='ceiling';raised ||= s.player.position[1]>before+.1;}
      return {ceiling,raised,state:lab.snapshot().player.state};});await page.keyboard.up('Space');
    assert.ok(jump.raised&&jump.ceiling);assert.equal(jump.state,'Grounded');
    const fast=await page.evaluate(()=>[30,60,120].map(fps=>window.__DR_VOLUME_LAB__.probe([0,-1,0],[3000,0,0],1/fps)));
    for(const hit of fast){assert.ok(hit.position[0]<1.9);assert.ok(hit.contact);assert.ok(hit.velocity.every(Number.isFinite));}
    const ray=await page.evaluate(()=>window.__DR_VOLUME_LAB__.raycast([0,0,0],[0,-1,0]));assert.equal(ray.bodyId,body);assert.equal(ray.kind,'floor');
    const rebuild=await page.evaluate(()=>{const lab=window.__DR_VOLUME_LAB__,before=lab.snapshot(),revision=lab.rebuild();
      return {old:before.displayedRevision,immediate:lab.snapshot().displayedRevision,revision};});assert.equal(rebuild.old,rebuild.immediate);
    await page.waitForFunction(revision=>window.__DR_VOLUME_LAB__.snapshot().displayedRevision===revision,rebuild.revision,{timeout:30_000});
    const next=await page.evaluate(()=>window.__DR_VOLUME_LAB__.snapshot());assert.ok(next.collision.resident<=8&&next.collision.bytes<=8*1048576);
    assert.equal(next.displayedRevision,next.metrics.revision);assert.ok(await page.evaluate(()=>!window.__DR_MANAUS__));
    results.collision.push({body,floor,walk,jump,fast,ray,rebuild,next});
    await page.locator('[data-view="inside"]').click();await page.screenshot({path:`artifacts/volume-collision-${body}.png`,timeout:30_000});
    console.log(`${body}: D0 real player floor/walk/jump/ceiling/fall, fast sweep, raycast and revision swap passed.`);
  }
  results.collisionDispose=await page.evaluate(()=>{const lab=window.__DR_VOLUME_LAB__,u=lab.universe;lab.dispose();return u.volume.collisionMetrics;});
  assert.equal(results.collisionDispose.bytes,0);assert.equal(results.collisionDispose.pendingBytes,0);
  assert.equal(results.errors.length,0,results.errors.join('\n'));
  console.log('PHASE-3 + D0 volume lab production browser checks passed.');
} catch(error) {results.failure=String(error);throw error;}
finally {
  await writeFile('artifacts/volume-meshing-browser.json',JSON.stringify(results,null,2));
  await browser?.close();await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));
}
