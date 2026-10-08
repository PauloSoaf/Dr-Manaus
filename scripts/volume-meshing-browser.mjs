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
  await page.goto('http://127.0.0.1:5188/?impactDestruction=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__DR_IMPACT_LAB__?.ready,null,{timeout:30_000});
  results.destruction=[];
  for(const body of ['moon','mars','earth']) {
    await page.selectOption('[data-body]',body);
    const before=await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot());
    assert.equal(before.body,body);assert.equal(before.mask,0);assert.ok(Number.isFinite(before.intactHeight));
    if(body==='moon')await page.screenshot({path:'artifacts/d1-moon-before.png'});
    const pending=await page.evaluate(()=>{const lab=window.__DR_IMPACT_LAB__;lab.impact();return lab.snapshot();});
    assert.equal(pending.mask,0);assert.equal(pending.editCount,results.destruction.length+1);
    assert.ok(Number.isFinite(pending.intactHeight),'intact terrain retained until complete publication');
    if(body==='moon')await page.screenshot({path:'artifacts/d1-moon-pending.png'});
    await page.waitForFunction(()=>{const s=window.__DR_IMPACT_LAB__.snapshot();
      return s.metrics.publishedReplacements>0&&s.mask===s.metrics.publishedReplacements&&s.collision.resident>0;},null,{timeout:120_000});
    const after=await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot());
    assert.equal(after.intactHeight,-Infinity);assert.ok(after.presentation.meshes>0);
    assert.ok(after.metrics.resident<=128&&after.metrics.bytes<=4*1048576);
    assert.ok(after.metrics.residentMeshes<=128&&after.metrics.meshBytes<=16*1048576);
    assert.ok(after.collision.resident<=128&&after.collision.bytes<=32*1048576);
    await page.screenshot({path:`artifacts/d1-${body}-after.png`});
    // Interior samples avoid an exactly-on-seam CPU Three ray at a six-million-metre body centre.
    const rays=await page.evaluate(()=>[.125,100.125,200.125,300.125].map(x=>({physical:window.__DR_IMPACT_LAB__.ray(x,.125),visual:window.__DR_IMPACT_LAB__.visualRay(x,.125)})));
    for(const ray of rays){assert.ok(ray.physical&&ray.visual);assert.ok(Math.abs(ray.physical.point[1]-ray.visual[1])<.15,'production visual/physical floor must agree');}
    await page.evaluate(()=>{const lab=window.__DR_IMPACT_LAB__;lab.reset();lab.runFrames(960);});
    const floor=await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot());
    assert.equal(floor.player.state,'Grounded');assert.ok(floor.player.position[1]<-180&&floor.player.position[1]>-230);
    await page.keyboard.down('KeyW');await page.evaluate(()=>window.__DR_IMPACT_LAB__.runFrames(60));await page.keyboard.up('KeyW');
    const walk=await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot());
    assert.ok(Math.abs(walk.player.position[2]-floor.player.position[2])>1);assert.equal(walk.player.state,'Grounded');
    await page.keyboard.down('Space');await page.evaluate(()=>window.__DR_IMPACT_LAB__.runFrames(1));await page.keyboard.up('Space');
    const jump=await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot());assert.ok(jump.player.velocity[1]>0);
    await page.evaluate(()=>window.__DR_IMPACT_LAB__.runFrames(960));assert.equal((await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot())).player.state,'Grounded');
    const wall=await page.evaluate(()=>[30,60,120].map(fps=>window.__DR_IMPACT_LAB__.probe([400,-10,0],[3000,0,0],1/fps)));
    for(const hit of wall){assert.ok(hit.firstContact);assert.ok(hit.firstContact.normal[0]<-.5);
      assert.ok(hit.position[1]>=hit.floor-.15,'wall response must keep capsule outside solid terrain');assert.ok(hit.velocity.every(Number.isFinite));}
    await page.evaluate(()=>window.__DR_IMPACT_LAB__.view(true));await page.screenshot({path:`artifacts/d1-${body}-inside.png`});
    await page.evaluate(()=>window.__DR_IMPACT_LAB__.view());await page.screenshot({path:`artifacts/d1-${body}-above.png`});
    results.destruction.push({body,before,pending,after,rays,floor,walk,jump,wall});
    console.log(`${body}: D1 production mask/mesh/collider publication, real player floor/walk/jump, wall CCD and visual/physical rays passed.`);
  }
  await page.selectOption('[data-body]','moon');
  await page.waitForFunction(()=>{const s=window.__DR_IMPACT_LAB__.snapshot();return s.body==='moon'&&s.mask>0&&s.collision.resident>0;},null,{timeout:120_000});
  const returned=await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot());assert.equal(returned.editCount,3);assert.equal(returned.intactHeight,-Infinity);
  const rebuilding=await page.evaluate(()=>{const lab=window.__DR_IMPACT_LAB__,before=lab.snapshot();lab.impact(10_000);
    return {before,immediate:lab.snapshot()};});
  assert.equal(rebuilding.before.metrics.replacementGeneration,rebuilding.immediate.metrics.replacementGeneration);
  assert.equal(rebuilding.before.mask,rebuilding.immediate.mask);assert.equal(rebuilding.immediate.editCount,4);
  await page.waitForFunction(generation=>window.__DR_IMPACT_LAB__.snapshot().metrics.replacementGeneration>generation,
    rebuilding.before.metrics.replacementGeneration,{timeout:120_000});
  results.destructionReturn={returned,rebuilding,after:await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot())};
  const d1Dispose=await page.evaluate(()=>{const lab=window.__DR_IMPACT_LAB__,u=lab.universe;lab.dispose();return {samples:u.volume.metrics.bytes,colliders:u.volume.collisionMetrics.bytes};});
  assert.equal(d1Dispose.samples,0);assert.equal(d1Dispose.colliders,0);
  // Fresh real production impact path: the earlier large edits must not determine a small
  // crater's geometry. No debug sampling/meshing flags are enabled for this acceptance.
  await page.goto('http://127.0.0.1:5188/?impactDestruction=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__DR_IMPACT_LAB__?.ready,null,{timeout:30_000});
  const highPending=await page.evaluate(()=>{const lab=window.__DR_IMPACT_LAB__;lab.pause();lab.impact(260);return lab.snapshot();});
  assert.equal(highPending.editCount,1);assert.equal(highPending.mask,0);assert.ok(Number.isFinite(highPending.intactHeight));
  await page.waitForFunction(()=>{const s=window.__DR_IMPACT_LAB__.snapshot();return s.metrics.samplingProfile==='impact-high'
    &&s.metrics.samplesPerAxis===33&&s.mask===4&&s.collision.resident>0;},null,{timeout:180_000});
  const highReady=await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot());
  assert.equal(highReady.metrics.spacingM,8);assert.equal(highReady.metrics.highChunks,4);assert.equal(highReady.intactHeight,-Infinity);
  assert.ok(highReady.metrics.bytes<=4*1048576&&highReady.metrics.meshBytes<=16*1048576&&highReady.collision.bytes<=32*1048576);
  const highRays=await page.evaluate(()=>[.125,20.125,40.125,70.125].map(x=>({physical:window.__DR_IMPACT_LAB__.ray(x,.125),
    visual:window.__DR_IMPACT_LAB__.visualRay(x,.125)})));
  for(const r of highRays){assert.ok(r.physical&&r.visual);assert.equal(r.physical.key.samplingProfile,'impact-high');assert.ok(Math.abs(r.physical.point[1]-r.visual[1])<.15);}
  await page.evaluate(()=>window.__DR_IMPACT_LAB__.viewCrater());await page.screenshot({path:'artifacts/d12-moon-high-crater.png'});
  await page.evaluate(()=>{const l=window.__DR_IMPACT_LAB__;l.reset([68,1,0]);l.runFrames(120);});
  await page.keyboard.down('KeyA');await page.evaluate(()=>window.__DR_IMPACT_LAB__.runFrames(400));await page.keyboard.up('KeyA');
  const highWalk=await page.evaluate(()=>{const l=window.__DR_IMPACT_LAB__,entered=l.snapshot();l.reset();l.runFrames(960);
    return {entered,floor:l.snapshot(),walls:[30,60,120].map(fps=>l.probe([35,-10,0],[3000,0,0],1/fps)),
      outer:[255.875,256.125].map(x=>l.surfaceProbe(x,.125))};});
  assert.ok(highWalk.entered.player.position[0]<56&&highWalk.entered.player.position[1]<-.5);
  assert.equal(highWalk.floor.player.state,'Grounded');assert.ok(Math.abs(highWalk.floor.player.position[1]+25.58)<.1);
  for(const wall of highWalk.walls){assert.ok(wall.firstContact&&wall.firstContact.normal[0]<-.3);assert.ok(wall.velocity.every(Number.isFinite));}
  assert.ok(Math.abs(highWalk.outer[0].floor-highWalk.outer[0].intact)<.03);
  assert.ok(Math.abs(highWalk.outer[0].floor-highWalk.outer[1].floor)<.03,'HIGH meets intact surface without a physical height jump');
  await page.evaluate(()=>window.__DR_IMPACT_LAB__.reset([0,100000,0]));
  await page.waitForFunction(()=>window.__DR_IMPACT_LAB__.snapshot().metrics.bytes===0,null,{timeout:30_000});
  const highEvicted=await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot());assert.equal(highEvicted.editCount,1);assert.equal(highEvicted.mask,0);
  await page.evaluate(()=>window.__DR_IMPACT_LAB__.reset());
  await page.waitForFunction(()=>{const s=window.__DR_IMPACT_LAB__.snapshot();return s.metrics.samplingProfile==='impact-high'&&s.mask===4;},null,{timeout:180_000});
  const highReturned=await page.evaluate(()=>window.__DR_IMPACT_LAB__.snapshot());assert.equal(highReturned.editCount,1);assert.equal(highReturned.metrics.spacingM,8);
  results.highResolution={pending:highPending,ready:highReady,rays:highRays,walking:highWalk,evicted:highEvicted,returned:highReturned};
  console.log('D1.2: real HIGH 33^3 crater, rim walk/floor/wall/rays/outer boundary and eviction/regeneration passed.');
  assert.equal(results.errors.length,0,results.errors.join('\n'));
  console.log('PHASE-3 + D0 + D1 production browser checks passed.');
} catch(error) {results.failure=String(error);results.d1FailureState=await page?.evaluate(()=>window.__DR_IMPACT_LAB__?.snapshot()).catch(()=>undefined);throw error;}
finally {
  await writeFile('artifacts/volume-meshing-browser.json',JSON.stringify(results,null,2));
  await browser?.close();await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));
}
