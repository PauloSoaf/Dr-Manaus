import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const server=await preview({preview:{host:'127.0.0.1',port:5187,strictPort:true}});
let browser,page;const errors=[],result={routes:[],checks:[],samples:[],maxRenderPositionM:0};
const snapshot=()=>page.evaluate(()=>{
  const g=window.__DR_MANAUS__,s=g.universalTravel.state;
  return {galaxy:g.universe.activeGalaxy.id,system:g.universe.address.systemId,frame:g.universe.player.frame,systemFrame:g.universe.activeSystem.systemFrameId,
    mode:g.universe.locationMode,phase:s?.phase,progress:s?.progress,speed:s?.effectiveSpeedMps,
    plan:s?{id:s.plan.id,distanceM:s.plan.logicalDistanceM,durationS:s.plan.durationS,domain:s.plan.domain}:undefined,
    prepared:s?.prepared,warp:g.warpStep,autopilot:g.interplanetary.autopilot.active,
    error:s?.preparationError,providers:g.universe.providers.size,frames:g.universe.frames.size,
    visuals:g.celestialVisuals.stats.total,geometries:g.rendering.renderer.info.memory.geometries,
    textures:g.rendering.renderer.info.memory.textures};
});
const select=async query=>page.evaluate(q=>{
  const g=window.__DR_MANAUS__,t=g.universalTargetCatalog.target(q);if(!t)throw Error('Unknown target '+q);g.selectNavigationTarget(t);
},query);
async function journey(query,expected,cancel=false){
  console.log(`U3 route: ${query} → ${expected}`);
  await select(query);const before=await snapshot();await page.keyboard.press('p');
  await page.waitForFunction(()=>window.__DR_MANAUS__.universalTravel.active,null,{timeout:5000});
  const first=await snapshot(),started=Date.now();let cancelled=false,maxC=0,phases=[];
  assert.equal(first.mode,'transit');assert.equal(first.system,before.system);
  while(Date.now()-started<65000){
    const s=await snapshot();if(s.mode!=='transit')break;
    if(s.error)throw Error(s.error);
    maxC=Math.max(maxC,(s.speed??0)/299792458);
    if(phases.at(-1)!==s.phase)phases.push(s.phase);
    assert.equal(s.galaxy,before.galaxy,'Galaxy changes only at final commit');
    assert.equal(s.system,before.system,'Address is retained source metadata during transit');
    result.samples.push(s);
    if(cancel&&!cancelled&&s.progress>=.4){
      cancelled=true;await page.keyboard.press('x');
      await page.waitForFunction(()=>window.__DR_MANAUS__.universalTravel.state?.phase==='coasting',null,{timeout:5000});
      const coast=await snapshot();assert.ok(coast.progress>=s.progress&&coast.progress<s.progress+.1);
      await page.waitForTimeout(200);assert.equal((await snapshot()).progress,coast.progress);
      result.cancel={at:s.progress,stopped:coast.progress,mode:coast.mode};
      await page.keyboard.press('p');
    }
    await page.waitForTimeout(120);
  }
  const after=await snapshot();assert.equal(after.mode,'anchored');assert.equal(after.system,expected);
  assert.equal(after.frame,after.systemFrame);
  result.routes.push({query,before,after,distanceM:first.plan.distanceM,durationS:first.plan.durationS,
    domain:first.plan.domain,peakEffectiveC:maxC,elapsedS:(Date.now()-started)/1000,phases,cancelled});
  await writeFile('artifacts/u3-browser-progress.json',JSON.stringify({routes:result.routes,cancel:result.cancel},null,2));
  console.log(`U3 arrived: ${after.system}, ${((Date.now()-started)/1000).toFixed(2)} s`);
}
try{
  await mkdir('artifacts',{recursive:true});
  browser=await chromium.launch({headless:true,args:[...(process.env.DR_BROWSER_GPU?
    (process.platform==='win32'?['--use-angle=d3d11']:[]):['--use-angle=swiftshader']),'--ignore-gpu-blocklist','--enable-webgl']});
  page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5187/?webgl=1');
  await page.waitForFunction(()=>window.__DR_MANAUS__?.ready,null,{timeout:60000});
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__;
    for(const method of ['debugEnterAndromeda','debugMaterializeSystem','debugReturnToSolar','debugReturnFromAndromeda'])
      g[method]=()=>{throw Error('Production called QA '+method);};
    const m=g.systemMaterializer;m.testArrival=()=>{throw Error('Production used testArrival');};
    g.camera.skipIntro();g.camera.pitch=-1.1;
    window.__U3_PROBES__={physics:0,cosmic:0,streaming:0,positions:0};
    const update=g.player.update.bind(g.player);g.player.update=(...args)=>{
      if(g.universalTravel.active)window.__U3_PROBES__.physics++;return update(...args);
    };
    const cosmic=g.interplanetary.update.bind(g.interplanetary);g.interplanetary.update=(...args)=>{
      if(g.universalTravel.active)window.__U3_PROBES__.cosmic++;return cosmic(...args);
    };
    const stream=g.universe.scheduler.update.bind(g.universe.scheduler);g.universe.scheduler.update=(...args)=>{
      if(g.universalTravel.active)window.__U3_PROBES__.streaming++;return stream(...args);
    };
    const render=g.rendering.renderer.render.bind(g.rendering.renderer);g.rendering.renderer.render=(...args)=>{
      if(g.universalTravel.active){
        if(g.localRoot.visible||g.planetRoot.visible||g.celestialVisuals.root.visible||g.galaxyMaterializer.current.root.visible)
          throw Error('Source world follows transit');
        g.rendering.scene.traverse(n=>{if(n.visible&&n.position.length()>1e9)throw Error('Astronomical render position');
          window.__U3_PROBES__.positions=Math.max(window.__U3_PROBES__.positions,n.position.length());});
      }return render(...args);
    };
  });
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.manausSimulationActive),true);
  await select('andromeda');await page.keyboard.press('p');assert.equal((await snapshot()).mode,'anchored');
  // Real production takeoff and tiers: no injected observer pose or debug arrival.
  await page.keyboard.press('f');await page.keyboard.down('Space');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.position.y>100,null,{timeout:60000});
  await page.keyboard.up('Space');await page.keyboard.down('w');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(500);
  await page.keyboard.up('ShiftLeft');await page.keyboard.down('b');await page.waitForTimeout(500);
  await page.keyboard.press('v');await page.keyboard.up('b');await page.waitForTimeout(150);await page.keyboard.down('b');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.position.y>10000,null,{timeout:90000});
  await page.keyboard.up('b');await page.keyboard.up('w');
  for(const key of ['v','v','v']){await page.keyboard.press(key);await page.waitForTimeout(100);}
  await page.keyboard.down('w');await page.keyboard.down('b');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.travelDomain.localPhysicsActive,null,{timeout:30000});
  await page.keyboard.up('b');await page.keyboard.up('w');
  await page.keyboard.press('x');await page.waitForTimeout(250);
  result.checks.push('REAL_MANAUS_DEPARTURE','GROUNDED_REMOTE_P_REJECTED');
  const mwKey=await page.evaluate(()=>window.__DR_MANAUS__.universalTargetCatalog.descriptors.find(t=>t.kind==='system'&&t.systemId==='milky_way/17,-2,4/0').key);
  await journey(mwKey,'milky_way/17,-2,4/0');
  await journey('sol','sol');
  await select('andromeda');await page.keyboard.press('p');await page.waitForFunction(()=>window.__DR_MANAUS__.universalTravel.active);
  await page.keyboard.press('b');await page.keyboard.press('f');assert.equal((await snapshot()).warp,0);
  await page.keyboard.press('m');await page.waitForFunction(()=>document.querySelector('#where-am-i-card').textContent.includes('EM TRÂNSITO'));
  await page.screenshot({path:'artifacts/u3-transit-map.png'});await page.keyboard.press('m');await page.keyboard.press('x');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.universalTravel.active||window.__DR_MANAUS__.universalTravel.state?.phase==='coasting',null,{timeout:5000});
  // If opening the map passed spool, coast and resume this route before the measured cancel run.
  if((await snapshot()).mode==='transit'){
    await page.keyboard.press('p');
    await page.waitForFunction(()=>!window.__DR_MANAUS__.universalTravel.active,null,{timeout:45000});
    await journey('milky_way','sol');
  }
  await journey('andromeda','andromeda/200,0,0/1',true);
  assert.equal((await snapshot()).galaxy,'andromeda');
  await page.screenshot({path:'artifacts/u3-andromeda-arrival.png'});
  await journey('earth','sol');assert.equal((await snapshot()).autopilot,true);
  await page.keyboard.press('p');await page.keyboard.press('b');
  await page.waitForFunction(()=>window.__DR_MANAUS__.warpStep>0);await page.keyboard.down('x');
  await page.waitForFunction(()=>window.__DR_MANAUS__.warpStep===0,null,{timeout:5000});
  await page.keyboard.up('x');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.input.pressed('KeyX'),null,{timeout:5000});
  // Five full production cycles, with real providers/visuals rather than lifecycle mocks.
  result.cycles=[];
  const baseline=await snapshot();
  for(let i=0;i<5;i++){
    await journey(mwKey,'milky_way/17,-2,4/0');await journey('sol','sol');
    await journey('andromeda','andromeda/200,0,0/1');await journey('milky_way','sol');
    const returned=await snapshot();
    assert.equal(returned.providers,baseline.providers);assert.equal(returned.frames,baseline.frames);
    assert.equal(returned.visuals,baseline.visuals);
    assert.ok(returned.geometries<=baseline.geometries+2,`Geometry growth: ${baseline.geometries} → ${returned.geometries}`);
    result.cycles.push(returned);
  }
  result.probes=await page.evaluate(()=>window.__U3_PROBES__);
  assert.equal(result.probes.physics,0);assert.equal(result.probes.cosmic,0);assert.equal(result.probes.streaming,0);
  result.maxRenderPositionM=result.probes.positions;assert.ok(result.maxRenderPositionM<1e9);
  assert.equal(errors.length,0,errors.join('\n'));
  await writeFile('artifacts/u3-browser.json',JSON.stringify({result,errors},null,2));
  console.log('U3 production hypercruise, cancel/resume, atomic arrival and multi-leg browser checks passed.');
}catch(e){
  result.last=page?await snapshot().catch(()=>undefined):undefined;
  await page?.screenshot({path:'artifacts/u3-failure.png'}).catch(()=>{});
  await writeFile('artifacts/u3-browser-failure.json',JSON.stringify({result,errors,error:String(e)},null,2));throw e;
}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));}
