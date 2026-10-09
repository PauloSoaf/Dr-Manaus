import assert from 'node:assert/strict';

/** Reuses the repository's Playwright session; near-body poses are explicit QA fixtures. */
export async function proceduralSystemCheckpoint(page,options={}) {
  const u2=options.galaxy==='andromeda',prefix=u2?'u2':'u1',arrival=`[data-${prefix}-test="arrival"]`,back=`[data-${prefix}-test="solar"]`;
  const results={checks:[]};
  await page.goto('http://127.0.0.1:5187/?webgl=1&u1test=1'+(u2?'&u2test=1':''),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__DR_MANAUS__?.ready,null,{timeout:60_000});
  const snapshot=()=>page.evaluate(()=>{
    const g=window.__DR_MANAUS__,u=g.universe,star=u.activeSystem.bodies.find(b=>!b.parentId);
    const geometries=new Set();let meshBufferBytes=0,galaxyBufferBytes=0,galaxyMeshes=0;
    g.galaxyMaterializer.current.root.traverse(n=>{if(n.geometry){galaxyMeshes++;for(const a of Object.values(n.geometry.attributes))galaxyBufferBytes+=(a.array??a.data?.array)?.byteLength??0;galaxyBufferBytes+=n.geometry.index?.array.byteLength??0;}});
    for(const root of [g.celestialVisuals.root,...Array.from(g.planetProviders.values(),p=>p.globe.root)])root.traverse(node=>{
      const geometry=node.geometry;if(!geometry || geometries.has(geometry))return;geometries.add(geometry);
      for(const attribute of Object.values(geometry.attributes))meshBufferBytes+=(attribute.array??attribute.data?.array)?.byteLength??0;
      meshBufferBytes+=geometry.index?.array.byteLength??0;
    });
    return {galaxy:u.activeGalaxy.id,galaxySession:{provider:g.galaxy?.galaxyId,sectors:g.galaxy?.stats.sectors,
      external:g.localGroup.map(p=>({id:p.id,visible:p.stats.visible,position:p.group.position.toArray()})),blackHole:g.sgra?.id,
      generation:g.galaxyMaterializer?.generation,timings:g.galaxyMaterializer?.timings},address:{...u.address,sector:Object.values(u.address.sector).map(String)},frame:u.player.frame,
      position:[...u.player.position],time:u.time,bodies:u.activeSystem.bodies.map(b=>({id:b.id,name:b.name,radius:b.equatorialRadiusM,
        mass:b.massKg,orbit:b.orbit,profile:b.profile,stellar:b.stellar})),providers:g.planetProviders.size,
      visuals:g.celestialVisuals.stats,allProviders:u.providers.size,frames:u.frames.size,
      meshBufferBytes,galaxyBufferBytes,galaxyMeshes,heapBytes:performance.memory?.usedJSHeapSize,physicalBody:g.celestialController.physicalBodyId,streamedBodies:Array.from(g.planetProviders.values()).filter(p=>p.stats.tiles>0).map(p=>p.bodyDef.id),
      geometry:g.rendering.renderer.info.memory.geometries,texture:g.rendering.renderer.info.memory.textures,
      target:g.universalNavigationTarget?.key,materialized:g.universalNavigationTarget&&g.universalTargetResolver.resolve(g.universalNavigationTarget).materialized,
      capability:g.universalNavigationTarget&&g.universalTargetResolver.resolve(g.universalNavigationTarget).travelCapability,
      timings:{...g.systemMaterializer.timings},star:star?.id,domain:g.travelDomain.kind};
  });
  results.before=await snapshot();
  await page.keyboard.press('m');
  if(u2){await page.locator('[data-map-level="galaxy"]').click();await page.locator('[data-universal-target="galaxy/andromeda"]').evaluate(b=>b.click());}
  else await page.locator('[data-u1-test="select"]').click();
  const selected=await snapshot();
  assert.equal(selected.address.systemId,'sol');assert.equal(selected.capability,u2?'intergalactic':'interstellar');
  await page.keyboard.press('m');await page.keyboard.press('p');
  assert.equal((await snapshot()).address.systemId,'sol','T_U1_NO_NORMAL_P_INTERSTELLAR_TELEPORT');
  results.checks.push('T_U1_NO_NORMAL_P_INTERSTELLAR_TELEPORT');
  await page.keyboard.press('m');
  await page.locator(arrival).click();
  await page.waitForFunction(()=>window.__DR_MANAUS__.universe.address.systemId!=='sol',null,{timeout:10_000});
  await page.locator('[data-map-level="system"]').click();
  results.active=await snapshot();
  assert.equal(results.active.address.systemId,u2?'andromeda/200,0,0/1':'milky_way/17,-2,4/0');
  assert.equal(results.active.galaxy,u2?'andromeda':'milky_way');assert.equal(results.active.galaxySession.provider,results.active.galaxy);
  assert.equal(results.active.frame,'system/'+results.active.address.systemId);
  assert.ok(results.active.visuals.total===results.active.bodies.length);
  const rocky=results.active.bodies.find(b=>b.profile?.bodyClass==='rocky'),giant=results.active.bodies.find(b=>b.profile?.bodyClass==='gas-giant'),
    moon=results.active.bodies.find(b=>b.profile?.bodyClass==='rocky-moon');
  assert.ok(rocky&&giant&&moon);
  await page.waitForFunction(()=>document.querySelectorAll('[data-body-target]').length===window.__DR_MANAUS__.universe.activeSystem.bodies.length);
  await page.screenshot({path:`artifacts/${prefix}-system.png`});
  if(u2){
    await page.locator('[data-map-level="galaxy"]').click();
    await page.waitForFunction(()=>document.querySelector('#map-panel').textContent.includes('GALÁXIA ATUAL · Andromeda'));
    await page.screenshot({path:'artifacts/u2-galaxy-map.png'});
    const beforeTargets=await snapshot();
    results.blackHoles=await page.evaluate(()=>{
      const g=window.__DR_MANAUS__,r=g.universalTargetResolver,c=g.universalTargetCatalog,before=JSON.stringify(g.universe.player.position),address=g.universe.address;
      g.selectNavigationTarget(c.target('m31_smbh'),'map');const m31=r.resolve(g.universalNavigationTarget);
      g.selectNavigationTarget(c.target('sgra'),'map');const sgra=r.resolve(g.universalNavigationTarget);
      g.selectNavigationTarget(c.target('milky_way'),'map');const mw=r.resolve(g.universalNavigationTarget);
      if(JSON.stringify(g.universe.player.position)!==before||g.universe.address!==address)throw Error('Target selection moved observer');
      return {m31:{distance:m31.distanceM,materialized:m31.materialized},sgra:{distance:sgra.distanceM,materialized:sgra.materialized},mw:{distance:mw.distanceM,capability:mw.travelCapability}};
    });
    const afterTargets=await snapshot();assert.equal(afterTargets.frame,beforeTargets.frame);assert.deepEqual(afterTargets.address,beforeTargets.address);
    assert.ok(results.blackHoles.m31.distance/9.4607304725808e15<22000);assert.equal(results.blackHoles.m31.materialized,true);
    assert.ok(results.blackHoles.sgra.distance/9.4607304725808e15>2.4e6);assert.equal(results.blackHoles.sgra.materialized,false);
    await page.keyboard.press('m');await page.keyboard.press('p');await page.waitForTimeout(200);
    assert.equal((await snapshot()).galaxy,'andromeda');
    assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.universalTravel.state?.phase),'spool');
    await page.keyboard.press('x');
    await page.waitForFunction(()=>!window.__DR_MANAUS__.universalTravel.active,null,{timeout:3000});assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.interplanetary.autopilot.active),false);
    results.checks.push('T_U2_NORMAL_P_DOES_NOT_INTERGALACTIC_TELEPORT','T_U2_TARGET_SELECTION_DOES_NOT_MOVE_PLAYER','T_U2_TEST_ARRIVAL_ANDROMEDA');
    await page.evaluate(()=>{const g=window.__DR_MANAUS__,delta=g.localGroup[0].group.position.clone().sub(g.rendering.camera.position).normalize();g.camera.setLocalView(delta.toArray());g.camera.inSpace=true;});
    await page.waitForTimeout(300);await page.screenshot({path:'artifacts/u2-milky-way-external.png'});
    await page.evaluate(()=>{const g=window.__DR_MANAUS__;g.selectNavigationTarget('m31_smbh','hud');const delta=g.sgra.group.position.clone().sub(g.rendering.camera.position).normalize();delta.x+=.15;delta.normalize();g.camera.setLocalView(delta.toArray());g.camera.inSpace=true;});
    await page.waitForTimeout(300);await page.screenshot({path:'artifacts/u2-m31-presentation.png'});
    await page.keyboard.press('m');await page.locator('[data-map-level="system"]').click();
  }
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,c=g.universalTargetCatalog,a=g.universe.address,
      prefix=`${a.galaxyId}/${a.sector.x},${a.sector.y},${a.sector.z}/`,
      star=Array.from(c.sectors.values()).flat().find(s=>s.id.startsWith(prefix)&&s.id!==a.systemId);
    const t=c.proceduralTarget(a.galaxyId,a.sector,star.id,'star');g.selectNavigationTarget(t,'map');
  });
  await page.keyboard.press('m');await page.keyboard.press('p');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.universalTravel.state?.phase),'spool');
  await page.keyboard.press('x');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.universalTravel.active,null,{timeout:3000});
  const rejected=await snapshot();assert.equal(rejected.address.systemId,results.active.address.systemId);
  assert.equal(rejected.frame,results.active.frame);assert.equal(rejected.capability,'interstellar');
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.interplanetary.autopilot.active),false);
  await page.keyboard.press('m');
  await page.locator(`[data-body-target="${rocky.id}"]`).evaluate(b=>b.click());
  await page.keyboard.press('m');await page.keyboard.press('p');
  await page.waitForFunction(()=>window.__DR_MANAUS__.interplanetary.autopilot.active);
  await page.keyboard.press('p');
  results.checks.push(u2?'T_U2_ANDROMEDA_P_AUTOPILOT':'T_U1_P_AUTOPILOT_GENERATED_PLANET');
  await page.keyboard.press('b');
  await page.waitForFunction(()=>window.__DR_MANAUS__.warpStep>0,null,{timeout:5000});
  results.checks.push(u2?'T_U2_ANDROMEDA_WARP':'T_U1_WARP_B_GENERATED_SYSTEM');
  await page.keyboard.press('x');
  results.navigation=await snapshot();assert.equal(results.navigation.capability,'intra-system');
  // Explicit near-body setup. F, capture, terrain preparation and handoff remain gameplay.
  const near=async(id,clearance,day=false)=>page.evaluate(({id,clearance,day})=>{
    const g=window.__DR_MANAUS__,u=g.universe,b=u.activeSystem.bodies.find(b=>b.id===id),c=u.activeSystem.positionOf(id),
      v=u.activeSystem.stateOf(id).velocityMps;
    const light=c.map(v=>-v),length=Math.hypot(...light),direction=day&&length>0?light.map(v=>v/length):[1,0,0],
      p=c.map((v,i)=>v+direction[i]*(b.equatorialRadiusM+clearance));
    g.interplanetary.autopilot.cancel();g.landingIntent.cancel();g.warpStep=0;
    g.travelDomain.testArrival({systemId:u.address.systemId,positionM:p,velocityMps:[...v],referenceBodyId:id});
    u.updateSystemPose(p,[...v],0);g.player.position.set(0,0,0);g.player.velocity.set(0,0,0);
    g.selectNavigationTarget(id,'hud');g.camera.skipIntro();g.camera.inSpace=true;
    const delta=u.frames.convertDirection(u.activeSystem.systemFrameId,u.renderSpace.currentOrigin.frame,direction.map(v=>-v));
    g.camera.setLocalView(delta);g.camera.inSpace=true;
    g.renderOriginVec.set(0,0,0);g.actorRoot.position.set(0,0,0);
  },{id,clearance,day});
  const rootStar=results.active.bodies.find(b=>!b.orbit);
  await near(rootStar.id,rootStar.radius*100);await page.waitForTimeout(500);
  await page.screenshot({path:`artifacts/${prefix}-star-far.png`});
  await near(rootStar.id,rootStar.radius*4);await page.waitForTimeout(500);
  await page.screenshot({path:`artifacts/${prefix}-star-close.png`});
  await near(rocky.id,1e9);await page.waitForTimeout(500);
  await page.keyboard.press('Backspace');await page.waitForTimeout(100);await page.keyboard.press('Tab');
  await page.waitForFunction(()=>window.__DR_MANAUS__.universalNavigationTarget?.source==='reticle');
  results.tab=await snapshot();assert.ok(results.active.bodies.some(b=>b.id===results.tab.address.systemId || results.tab.target?.includes(encodeURIComponent(b.id))));
  await page.keyboard.press('Shift+Tab');await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.universalNavigationTarget?.source),'reticle');
  if(u2)results.checks.push('T_U2_ANDROMEDA_TAB','T_U2_ANDROMEDA_SHIFT_TAB');
  await near(giant.id,giant.radius*4,true);await page.waitForTimeout(500);
  await page.screenshot({path:`artifacts/${prefix}-gas-disc.png`});
  await near(giant.id,giant.radius*.4,true);await page.waitForTimeout(500);
  await page.screenshot({path:`artifacts/${prefix}-gas-approach.png`});
  await page.keyboard.press('f');await page.waitForTimeout(300);
  assert.equal((await snapshot()).domain,'interplanetary');
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.landingIntent.bodyId),undefined);
  for(const [body,label] of [[rocky,'rocky'],[moon,'moon']]) {
    await near(body.id,12000);await page.waitForTimeout(500);
    await page.screenshot({path:`artifacts/${prefix}-${label}-approach.png`});
    await page.keyboard.press('f');
    await page.waitForFunction(id=>{
      const g=window.__DR_MANAUS__;return g.universe.player.frame===id+'/local-enu'&&g.travelDomain.localPhysicsActive;
    },body.id,{timeout:60_000});
    // Shorten only the already-completed ENU descent; real terrain physics resolves contact.
    await page.evaluate(()=>{const g=window.__DR_MANAUS__;g.player.position.y=g.surfacePhysicsState.terrainHeightM+2;
      g.player.velocity.set(0,-20,0);g.camera.pitch=-.25;});
    await page.waitForFunction(()=>window.__DR_MANAUS__.player.state==='Grounded',null,{timeout:45_000});
    const landed=await snapshot();assert.equal(landed.address.bodyId,body.id);
    const before=landed.position;
    await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');
    const walked=await snapshot();assert.ok(Math.hypot(walked.position[0]-before[0],walked.position[2]-before[2])>1);
    results[label]={landed,walked};await page.screenshot({path:`artifacts/${prefix}-${label}-surface.png`});
    await page.keyboard.press('f');await page.waitForTimeout(250);
    assert.notEqual(await page.evaluate(()=>window.__DR_MANAUS__.player.state),'Grounded');
  }
  // Target identity and logical orbital state survive render rebasing and unload/revisit.
  await near(rocky.id,1e8);
  const key=(await snapshot()).target;
  await page.keyboard.press('F3');await page.waitForTimeout(200);
  if(u2){results.f3=await page.evaluate(()=>window.__DR_MANAUS__.universeDebug());assert.equal(results.f3['ACTIVE GALAXY · ID'],'andromeda');assert.equal(results.f3['ACTIVE GALAXY · Central black hole'],'m31_smbh');assert.equal(results.f3['ACTIVE SYSTEM · System frame'],'system/andromeda/200,0,0/1');await page.screenshot({path:'artifacts/u2-f3.png'});}
  assert.ok(await page.evaluate(()=>document.querySelector('#debug-panel')?.textContent.includes('ACTIVE SYSTEM · System frame')));
  await page.keyboard.press('F3');
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,u=g.universe,pos=[...u.player.position],before=u.floatingOrigin.rebaseCount;
    u.floatingOrigin.reset({...u.player,position:pos.map(v=>v+10000)});u.updateSystemPose(pos,[0,0,0],0);
    if(u.floatingOrigin.rebaseCount<=before)throw Error('U1 rebase did not execute');
  });
  assert.equal((await snapshot()).target,key);
  await page.keyboard.press('m');await page.locator(back).click();
  await page.waitForTimeout(500);results.after=await snapshot();assert.equal(results.after.address.systemId,'sol');assert.equal(results.after.materialized,false);
  assert.equal(results.after.target,key);assert.equal(results.after.frames,results.before.frames);
  assert.equal(results.after.providers,results.before.providers);
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.manausSimulationActive),true,'T_U1_MANAUS_REGRESSION');
  results.checks.push(u2?'T_U2_MANAUS_REGRESSION':'T_U1_MANAUS_REGRESSION');
  if(u2){assert.equal(results.after.galaxy,'milky_way');const distance=await page.evaluate(()=>{const g=window.__DR_MANAUS__;return g.universalTargetResolver.resolve(g.universalTargetCatalog.target('sgra')).distanceM;});assert.ok(Math.abs(distance/9.4607304725808e15-26000)<.001);await page.screenshot({path:'artifacts/u2-return-solar.png'});}
  await page.locator(arrival).click();
  results.revisited=await snapshot();assert.deepEqual(results.revisited.bodies,results.active.bodies);
  assert.equal(results.revisited.target,key);assert.equal(results.revisited.materialized,true);
  assert.ok(results.revisited.time>=results.active.time);
  await page.locator(back).click();await page.waitForTimeout(500);results.finalSolar=await snapshot();await page.keyboard.press('m');
  return results;
}
