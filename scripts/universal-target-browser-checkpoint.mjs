import assert from 'node:assert/strict';

/** Existing Playwright session, production map callbacks and keyboard controls. No new framework. */
export async function universalTargetCheckpoint(page) {
  const results={};
  const identity=()=>page.evaluate(()=>{
    const g=window.__DR_MANAUS__,t=g.universalNavigationTarget,r=t&&g.universalTargetResolver.resolve(t);
    return {key:t?.key,kind:t?.kind,name:t?.displayName,galaxyId:t?.galaxyId,bodyId:t?.bodyId,
      source:t?.source,materialized:r?.materialized,capability:r?.travelCapability,distanceM:r?.distanceM,
      solarTarget:g.navigationTarget?.bodyId,autopilot:g.interplanetary.autopilot.active};
  });
  const select=async selector=>{
    const picked=await page.locator(selector).evaluate(button=>{
      const g=window.__DR_MANAUS__,before=g.universe.playerSystemPositionM(),address=g.universe.address,system=g.universe.activeSystem;
      const key=a=>`${a.galaxyId}/${a.sector.x},${a.sector.y},${a.sector.z}/${a.systemId}/${a.bodyId}/${a.childFrame}`;
      const addressBefore=key(address);
      button.click();
      return {before,after:g.universe.playerSystemPositionM(),addressBefore,addressAfter:key(g.universe.address),
        sameAddress:address===g.universe.address,sameSystem:system===g.universe.activeSystem,targetKey:g.universalNavigationTarget?.key};
    });
    assert.deepEqual(picked.before,picked.after,'selection cannot write player pose');
    assert.equal(picked.addressBefore,picked.addressAfter);assert.equal(picked.sameAddress,true);assert.equal(picked.sameSystem,true);
    await page.waitForFunction(key=>window.__DR_MANAUS__.hud.universalMap.flight?.universalTarget?.target.key===key,picked.targetKey,{timeout:15000});
    return {...picked,target:await identity()};
  };
  const close=()=>page.locator('#map-panel .close-panel').click();
  const open=()=>page.keyboard.press('m');
  for(const [label,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]) {
    await page.setViewportSize(viewport);await open();
    await page.locator('[data-map-level="system"]').click();
    const mars=await select('[data-body-target="mars"]');assert.equal(mars.target.kind,'body');assert.equal(mars.target.solarTarget,'mars');
    await close();
    await page.keyboard.press('p');await page.waitForFunction(()=>window.__DR_MANAUS__.interplanetary.autopilot.active,null,{timeout:15000});
    await page.keyboard.press('p');await page.waitForFunction(()=>!window.__DR_MANAUS__.interplanetary.autopilot.active,null,{timeout:15000});
    await open();await page.locator('[data-map-level="galaxy"]').click();
    const sgra=await select('[data-universal-target$="black-hole/sgra"]');
    assert.equal(sgra.target.kind,'black-hole');assert.equal(sgra.target.galaxyId,'milky_way');assert.equal(sgra.target.solarTarget,undefined);
    await close();const afterClose=await identity();assert.equal(afterClose.key,sgra.target.key);
    await page.keyboard.press('p');
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('buracos negros'),null,{timeout:15000});
    assert.equal((await identity()).autopilot,false);
    assert.match(await page.locator('#cruise-block').textContent(),/Sagittarius A\*/);
    await open();
    // Use the real canvas listener for Andromeda, on both viewport sizes.
    const andromedaMarker=await page.evaluate(()=>{
      const g=window.__DR_MANAUS__,canvas=document.querySelector('#universal-canvas'),rect=canvas.getBoundingClientRect();
      const h=g.hud.universalMap.renderers.galaxy.markers.hits.find(h=>h.key==='galaxy/andromeda');
      return {x:rect.left+h.x,y:rect.top+h.y};
    });
    await page.mouse.click(andromedaMarker.x,andromedaMarker.y);
    await page.waitForFunction(()=>window.__DR_MANAUS__.universalNavigationTarget?.key==='galaxy/andromeda',null,{timeout:15000});
    await page.waitForFunction(()=>document.querySelector('#universal-target-card').textContent.includes('2.50 Mly'),null,{timeout:15000});
    const andromeda=await identity();assert.equal(andromeda.kind,'galaxy');assert.equal(andromeda.materialized,false);
    assert.ok(Math.abs(andromeda.distanceM/9.4607304725808e15-2.5e6)<2000);
    await close();await page.keyboard.press('p');
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('intergaláctica'),null,{timeout:15000});
    assert.equal((await identity()).autopilot,false);await open();
    await page.waitForFunction(()=>document.querySelector('[data-universal-target="galaxy/andromeda"]').getAttribute('aria-pressed')==='true',null,{timeout:15000});
    const persisted=await identity();assert.equal(persisted.key,andromeda.key);
    await close();await page.keyboard.press('F3');
    await page.waitForFunction(()=>document.querySelector('#debug-metrics').textContent.includes('Universal Target · Keygalaxy/andromeda'),null,{timeout:15000});
    const diagnostics=await page.evaluate(()=>{const g=window.__DR_MANAUS__;return g.universeDebug(g.hudFlight());});
    assert.equal(diagnostics['Universal Target · Name'],'Andromeda');assert.equal(diagnostics['Universal Target · Kind'],'galaxy');
    assert.equal(diagnostics['Universal Target · Galaxy'],'andromeda');assert.equal(diagnostics['Universal Target · Distance'],'2.50 Mly');
    assert.equal(diagnostics['Universal Target · Materialized'],'não');assert.equal(diagnostics['Universal Target · Capability'],'intergalactic-future');
    await page.keyboard.press('F3');await open();
    const rebase=await page.evaluate(()=>{
      const g=window.__DR_MANAUS__,t=g.universalNavigationTarget,r=g.universalTargetResolver.resolve(t),u=g.universe,
        origin=u.renderSpace.currentOrigin,frame=origin.frame,before=t.key;
      // Call the production origin setter with a copied origin; no logical movement/setup mutation.
      u.renderSpace.setOrigin({...origin,position:origin.position.map((v,i)=>v+[4096,-2048,1024][i])});
      const distance=u.playerSystemPositionM(),after=g.universalTargetResolver.resolve(t);
      u.renderSpace.setOrigin(origin);
      return {before,after:g.universalNavigationTarget.key,distanceBefore:r.distanceM,distanceAfter:after.distanceM,frame,playerPosition:distance};
    });
    assert.equal(rebase.before,rebase.after);assert.equal(rebase.distanceBefore,rebase.distanceAfter);
    const m31=await select('[data-universal-target$="black-hole/m31_smbh"]');
    assert.equal(m31.target.kind,'black-hole');assert.equal(m31.target.galaxyId,'andromeda');assert.equal(m31.target.capability,'black-hole-future');
    await page.locator('[data-map-level="cosmology"]').click();
    const virgo=await select('[data-universal-target="cosmos/cluster/virgo_cluster"]');
    assert.equal(virgo.target.kind,'cluster');assert.equal(virgo.target.capability,'cosmological-future');
    await page.waitForFunction(()=>document.querySelector('#universal-target-card').textContent.includes('Virgo Cluster'),null,{timeout:15000});
    const layout=await page.evaluate(()=>{
      const rect=document.querySelector('#map-panel').getBoundingClientRect(),canvas=document.querySelector('#universal-canvas').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,panel:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},canvas:{width:canvas.width,height:canvas.height}};
    });
    assert.ok(layout.panel.left>=0&&layout.panel.right<=viewport.width+1&&layout.panel.bottom<=viewport.height+1);
    assert.ok(layout.canvas.width>150&&layout.canvas.height>=180);
    await page.screenshot({path:`artifacts/u0-map-${label}.png`,timeout:90000});
    await close();await page.keyboard.press('Backspace');
    await page.waitForFunction(()=>!window.__DR_MANAUS__.universalNavigationTarget,null,{timeout:15000});
    results[label]={mars,sgra,andromeda,m31,virgo,persisted,rebase,layout,diagnostics};
    console.log(`U0 ${label}: Solar P/cancel, galaxy/BH/cosmos selection, one target, no teleport, persistence and rebase passed.`);
  }
  await page.setViewportSize({width:1440,height:900});
  return results;
}
