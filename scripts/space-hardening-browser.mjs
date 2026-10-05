import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

// Uses the repository's existing Playwright/Chromium. Near-arrival fixtures are explicit;
// this is automated coverage of the gameplay handoff, not a claimed manual Earth–Moon journey.
const server=await preview({preview:{host:'127.0.0.1',port:5187,strictPort:true}});
let browser;
let page;
const results={};
const errors=[];
try {
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
  page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5187/?webgl=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__DR_MANAUS__?.ready,null,{timeout:60_000});
  await mkdir('artifacts',{recursive:true});
  await page.keyboard.press('m');
  await page.locator('[data-map-level="system"]').click();
  const map=await page.evaluate(()=>{
    const panel=document.querySelector('#map-panel').getBoundingClientRect();
    const sidebar=document.querySelector('.map-sidebar').getBoundingClientRect();
    const visual=document.querySelector('.map-visual').getBoundingClientRect();
    const canvas=document.querySelector('#universal-canvas'),display=canvas.getBoundingClientRect();
    return {panel:{width:panel.width,height:panel.height},sidebar:{width:sidebar.width,right:sidebar.right},
      visual:{width:visual.width,left:visual.left},display:{width:display.width,height:display.height},
      backing:{width:canvas.width,height:canvas.height},scale:document.querySelector('.map-scale').textContent};
  });
  assert.ok(map.panel.width>=1440*.90 && map.panel.width<=1440*.96,'T_UNIVERSAL_MAP_DESKTOP_USES_LARGE_VIEWPORT');
  assert.ok(map.panel.height>=900*.82 && map.panel.height<=900*.92);
  assert.ok(map.sidebar.width>=280&&map.sidebar.width<=340&&map.visual.left>=map.sidebar.right);
  assert.ok(Math.abs(map.backing.width-map.display.width)<=1,'T_SYSTEM_MAP_CANVAS_RESIZES_TO_DISPLAY_SIZE');
  assert.match(map.scale,/AU/);
  await page.screenshot({path:'artifacts/space-hardening-map.png',timeout:90_000});
  await page.locator('[data-map-level="surface"]').click();
  assert.equal(await page.locator('#city-map').isVisible(),true);
  assert.equal(await page.locator('#universal-canvas').isVisible(),false);
  await page.locator('[data-map-level="system"]').click();
  assert.equal(await page.locator('#city-map').isVisible(),false);
  assert.equal(await page.locator('#universal-canvas').isVisible(),true);
  const lunarSystems={jupiter:['io','europa','ganymede','callisto'],saturn:['titan','enceladus'],
    uranus:['titania','oberon'],neptune:['triton']};
  results.majorMoonSystems={};
  assert.equal(await page.locator('[data-system-focus="sun"]').count(),0);
  for(const [parent,moons] of Object.entries(lunarSystems)) {
    // Live ephemeris updates replace card buttons each frame. Dispatch the real DOM
    // click synchronously, as the canvas fixture does, without bypassing its handler.
    await page.locator(`[data-system-focus="${parent}"]`).evaluate(button=>button.click());
    const focused=await page.evaluate(()=>{
      const g=window.__DR_MANAUS__,r=g.hud.universalMap.renderers.system;
      return {focus:r.focusedBodyId,markers:r.markers.map(m=>({...m})),scale:r.scaleText,
        breadcrumb:document.querySelector('#map-breadcrumb').textContent};
    });
    assert.equal(focused.focus,parent);
    assert.deepEqual(new Set(focused.markers.map(m=>m.id)),new Set([parent,...moons]));
    assert.match(focused.scale,/km/);
    assert.ok(!focused.breadcrumb.includes('MANAUS'),'planet-system breadcrumb is independent of player surface');
    for(const moon of moons) assert.ok(focused.markers.find(m=>m.id===moon));
    // Exercise the actual canvas listener and HUD target callback synchronously, without a game tick.
    const picks=[];
    for(const moon of moons) {
    const picked=await page.evaluate(id=>{
      const g=window.__DR_MANAUS__,r=g.hud.universalMap.renderers.system;
      const marker=r.markers.find(m=>m.id===id),canvas=document.querySelector('#universal-canvas');
      const rect=canvas.getBoundingClientRect(),before=g.universe.playerSystemPositionM();
      canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:rect.left+marker.x,clientY:rect.top+marker.y}));
      return {target:g.navigationTarget?.bodyId,before,after:g.universe.playerSystemPositionM(),
        highlighted:r.markers.find(m=>m.id===id)?.selected};
    },moon);
    assert.equal(picked.target,moon);assert.equal(picked.highlighted,true);
    assert.deepEqual(picked.after,picked.before,'map selection must not teleport');picks.push(picked);
    }
    if(parent==='jupiter') await page.screenshot({path:'artifacts/solar12-jupiter-map.png',timeout:90_000});
    results.majorMoonSystems[parent]={...focused,picks};
    await page.locator('[data-system-overview]').evaluate(button=>button.click());
    assert.match(await page.locator('.map-scale').textContent(),/AU/);
  }
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.universe.activeSystem.bodies.length),19);
  assert.deepEqual(await page.evaluate(()=>[...window.__DR_MANAUS__.planetProviders.keys()]),['mercury','venus','moon','mars']);
  await page.locator('#map-panel .close-panel').click();
  results.desktopMap=map;
  console.log('Desktop map layout, canvas and DPR passed.');
  console.log('SOLAR-12 live map focus, all nine moon targets, canvas selection and unchanged provider count passed.');

  // PLANET-FLIGHT-LANDING-1.1: depart from the actual Manaus spawn with real input.
  // Retain transient tiers between browser polls; this wrapper never changes the simulation.
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,update=g.player.update.bind(g.player);
    window.__DR_LOCAL_TIERS__=[];
    g.player.update=(...args)=>{
      const value=update(...args),trace=window.__DR_LOCAL_TIERS__;
      if(trace.at(-1)?.tier!==g.player.speedMode) trace.push({tier:g.player.speedMode,
        altitude:g.player.position.y,armed:g.player.armed,domain:g.travelDomain.kind});
      return value;
    };
    const cosmic=g.interplanetary.update.bind(g.interplanetary);
    window.__DR_COSMIC_INPUTS__=[];
    g.interplanetary.update=(...args)=>{
      const value=cosmic(...args),context=args[3],trace=window.__DR_COSMIC_INPUTS__;
      trace.push({boost:context.inputBoost,warp:context.warpStep,thrust:args[2].length(),
        w:g.input.held('KeyW'),shift:g.input.held('ShiftLeft')||g.input.held('ShiftRight'),b:g.input.held('KeyB'),
        velocity:[...value.velocityMps],phase:g.interplanetary.getTelemetry().phase,
        landing:context.landingIntent?{...g.landingState}:undefined});
      if(trace.length>4000)trace.shift();
      return value;
    };
    g.camera.pitch=-1.1;
  });
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.manausSimulationActive),true);
  await page.keyboard.press('f');
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.position.y>100,null,{timeout:60000});
  await page.keyboard.up('Space');
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.speedMode==='normal',null,{timeout:15000});
  await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.speedMode==='fast',null,{timeout:15000});
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.down('b');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.speedMode==='super',null,{timeout:15000});
  await page.keyboard.press('v');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.armWaitingForBoostRelease,null,{timeout:15000});
  await page.keyboard.up('b');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.player.armWaitingForBoostRelease,null,{timeout:15000});
  await page.keyboard.down('b');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.speedMode==='mega',null,{timeout:15000});
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.position.y>10000,null,{timeout:90000});
  await page.keyboard.up('b');
  await page.keyboard.up('w');
  // The first press disarms the existing Mega; the following two presses arm Interplanetary.
  await page.keyboard.press('v');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.armed==='none',null,{timeout:15000});
  await page.keyboard.press('v');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.armed==='mega',null,{timeout:15000});
  await page.keyboard.press('v');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.armed==='interplanetary',null,{timeout:15000});
  await page.keyboard.down('w');
  await page.keyboard.down('b');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.travelDomain.localPhysicsActive,null,{timeout:30000});
  await page.keyboard.up('b');
  await page.keyboard.up('w');
  results.localDeparture=await page.evaluate(()=>({tiers:window.__DR_LOCAL_TIERS__,domain:window.__DR_MANAUS__.travelDomain.kind,
    body:window.__DR_MANAUS__.universe.telemetry.dominantBody,armed:window.__DR_MANAUS__.player.armed}));
  for(const tier of ['normal','fast','super','mega'])assert.ok(results.localDeparture.tiers.some(t=>t.tier===tier),tier);
  assert.equal(results.localDeparture.armed,'interplanetary');
  assert.equal(results.localDeparture.domain,'interplanetary');
  assert.equal(results.localDeparture.body,'earth');
  console.log('PLANET-FLIGHT-LANDING-1.1 real Manaus F/W/Shift/B/V departure passed.');

  // A distant system pose exercises automatic level choice and real quaternion input.
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,u=g.universe,p=u.activeSystem.positionOf('earth');
    const position=[p[0]+50_000_000,p[1],p[2]],velocity=u.activeSystem.stateOf('earth').velocityMps;
    g.travelDomain.update({requested:true,altitudeM:50_000_000,speedMps:0,nearestColliderM:Infinity,
      bodyId:'earth',bodyRadiusM:6_378_137,entryPositionM:position,entryVelocityMps:velocity},0);
    g.travelDomain.setState({systemId:'sol',positionM:position,velocityMps:velocity,referenceBodyId:'earth'});
    u.updateSystemPose(position,velocity,0);g.player.position.set(0,0,0);g.player.velocity.set(0,0,0);
  });
  await page.waitForFunction(()=>window.__DR_MANAUS__.camera.inSpace,null,{timeout:15_000});
  await page.keyboard.press('m');
  await page.waitForFunction(()=>document.querySelector('[data-map-level="system"]').getAttribute('aria-pressed')==='true',null,{timeout:15_000});
  results.automaticSystemMap=true;
  await page.locator('#map-panel .close-panel').click();
  // Feed the same mouse accumulator as InputController, allowing deterministic pole crossing.
  const camera=await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,c=g.rendering.camera;
    const start=c.quaternion.clone();
    Object.assign(g.input.mouseDelta,{x:0,y:2.1/.00195});g.camera.prepareLook();
    const turned=start.angleTo(c.quaternion);
    const right=new c.position.constructor(1,0,0).applyQuaternion(c.quaternion);
    const up=new c.position.constructor(0,1,0).applyQuaternion(c.quaternion);
    const forward=c.getWorldDirection(new c.position.constructor());
    Object.assign(g.input.mouseDelta,{x:0,y:0});
    return {turned,rightDotUp:right.dot(up),forwardDotRight:forward.dot(right),finite:c.quaternion.toArray().every(Number.isFinite)};
  });
  assert.ok(camera.turned>2 && camera.finite && Math.abs(camera.rightDotUp)<1e-10 && Math.abs(camera.forwardDotRight)<1e-10);
  results.spaceCamera=camera;
  console.log('Space quaternion input and automatic System level passed.');

  // A distant observer keeps several real bodies in the 15-degree reticle cone. Cycling
  // assertions compare actual keyboard transitions, rather than replacing the candidate list.
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,u=g.universe,position=[0,0,30_000_000_000_000],velocity=[0,0,0];
    g.clearNavigationTarget();g.interplanetary.autopilot.cancel();
    g.travelDomain.setState({systemId:'sol',positionM:position,velocityMps:velocity,referenceBodyId:'sun'});
    u.updateSystemPose(position,velocity,0);
    const render=u.frames.convertDirection('solar-system/barycentric',u.renderSpace.currentOrigin.frame,[0,0,-1]);
    const c=g.rendering.camera,V=c.position.constructor;
    c.lookAt(c.position.clone().add(new V(...render).normalize()));c.updateMatrixWorld();
    g.camera.inSpace=true;g.camera.wasInSpace=true;g.camera.spaceOrientation.copy(c.quaternion);
    g.camera.lookPrepared=false;
    Object.assign(g.input.mouseDelta,{x:0,y:0});g.camera.prepareLook();
    window.__DR_COSMIC_INPUTS__=[];
  });
  await page.waitForFunction(()=>{
    const g=window.__DR_MANAUS__,view=g.rendering.camera.getWorldDirection(g.player.position.clone());
    const bary=g.universe.frames.convertDirection(g.universe.renderSpace.currentOrigin.frame,
      'solar-system/barycentric',view.toArray());
    return g.input.enabled&&g.celestialController.renderSamples.length>0&&bary[2]<-.99;
  },null,{timeout:15000});
  await page.keyboard.press('Tab');
  await page.waitForFunction(()=>!!window.__DR_MANAUS__.navigationLock,null,{timeout:15000});
  const firstTarget=await page.evaluate(()=>window.__DR_MANAUS__.navigationLock.bodyId);
  await page.keyboard.press('Tab');
  await page.waitForFunction(first=>window.__DR_MANAUS__.navigationLock?.bodyId!==first,firstTarget,{timeout:15000});
  const secondTarget=await page.evaluate(()=>window.__DR_MANAUS__.navigationLock.bodyId);
  // Keep the modifier held until Game consumes Tab. A combined press/release can finish
  // between two software-rendered frames, leaving a Tab edge with Shift already released.
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.press('Tab');
  await page.waitForFunction(first=>window.__DR_MANAUS__.navigationLock?.bodyId===first,firstTarget,{timeout:15000});
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.down('b');
  await page.waitForFunction(()=>window.__DR_MANAUS__.warpStep===1,null,{timeout:15000});
  await page.keyboard.press('Tab');
  await page.waitForFunction(second=>window.__DR_MANAUS__.navigationLock?.bodyId===second,secondTarget,{timeout:15000});
  await page.keyboard.up('b');
  await page.keyboard.press('Tab');
  await page.waitForFunction(second=>window.__DR_MANAUS__.navigationLock?.bodyId!==second,secondTarget,{timeout:15000});
  const thirdTarget=await page.evaluate(()=>window.__DR_MANAUS__.navigationLock.bodyId);
  assert.notEqual(thirdTarget,firstTarget,'at least three real candidates make reverse cycling distinguishable');
  results.spaceTargetCycle={firstTarget,secondTarget,thirdTarget,shiftTab:firstTarget,bTab:secondTarget};
  const bOnly=await page.evaluate(()=>window.__DR_COSMIC_INPUTS__.filter(t=>t.b&&!t.w&&!t.shift));
  assert.ok(bOnly.length>0&&bOnly.every(t=>!t.boost&&t.thrust===0),'B is only Warp without movement');
  assert.ok(bOnly.every(t=>Math.hypot(...t.velocity)<1e-8),'holding B cannot synthesize thrust');
  await page.keyboard.down('x');
  await page.waitForFunction(()=>window.__DR_MANAUS__.warpStep===0,null,{timeout:15000});
  await page.keyboard.up('x');
  await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>window.__DR_COSMIC_INPUTS__.some(t=>t.shift&&!t.w&&!t.b),null,{timeout:15000});
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__DR_COSMIC_INPUTS__.some(t=>t.shift&&t.w&&t.boost&&t.phase==='acceleration'),null,{timeout:15000});
  await page.keyboard.up('ShiftLeft');
  await page.waitForFunction(()=>window.__DR_COSMIC_INPUTS__.some(t=>t.w&&!t.shift&&!t.b&&!t.boost&&t.thrust>.99),null,{timeout:15000});
  await page.keyboard.up('w');
  const controls=await page.evaluate(()=>window.__DR_COSMIC_INPUTS__);
  const shiftOnly=controls.filter(t=>t.shift&&!t.w&&!t.b);
  assert.ok(shiftOnly.length>0&&shiftOnly.every(t=>!t.boost&&t.thrust===0),'Shift is a modifier, not W');
  results.spaceControlInputs={bOnly,shiftOnly,shiftW:controls.find(t=>t.shift&&t.w&&t.boost&&t.phase==='acceleration'),
    wOnly:controls.find(t=>t.w&&!t.shift&&!t.b&&!t.boost&&t.thrust>.99)};
  await page.keyboard.press('Backspace');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.navigationLock,null,{timeout:15000});
  console.log('SPACE Shift boost/W intent, B Warp only, X, Tab, Shift+Tab and B+Tab passed.');

  results.majorMoonApproaches={};
  for(const id of ['europa','titan','triton']) {
    await page.evaluate(id=>{
      const g=window.__DR_MANAUS__,u=g.universe,b=u.activeSystem.bodies.find(b=>b.id===id);
      const p=u.activeSystem.positionOf(id),velocity=u.activeSystem.stateOf(id).velocityMps;
      const position=[p[0]+b.equatorialRadiusM*8,p[1],p[2]];
      g.travelDomain.setState({systemId:'sol',positionM:position,velocityMps:velocity,referenceBodyId:id});
      u.updateSystemPose(position,velocity,0);g.navigationTarget={bodyId:id,arrivalMarginM:50000};
      const direction=u.frames.convertDirection('solar-system/barycentric',u.renderSpace.currentOrigin.frame,
        [p[0]-position[0],p[1]-position[1],p[2]-position[2]]);
      const V=g.rendering.camera.position.constructor;
      g.camera.spaceOrientation.setFromUnitVectors(new V(0,0,-1),new V(...direction).normalize());
      Object.assign(g.input.mouseDelta,{x:0,y:0});g.camera.prepareLook();
    },id);
    await page.waitForFunction(id=>{
      const g=window.__DR_MANAUS__,s=g.celestialController.renderSamples.find(s=>s.bodyId===id);
      return s?.visible && s.physicalProjectedDiameterPx>50 && g.celestialVisuals.root.getObjectByName(`${id}-proxy`).visible;
    },id,{timeout:15000});
    const approach=await page.evaluate(id=>{
      const g=window.__DR_MANAUS__,s=g.celestialController.renderSamples.find(s=>s.bodyId===id);
      const objects=[];g.celestialVisuals.root.traverse(o=>objects.push({position:o.position.toArray(),scale:o.scale.toArray()}));
      return {sample:s,physical:g.celestialController.physicalBodyId,providers:g.planetProviders.size,
        domain:g.travelDomain.kind,bounded:objects.every(o=>[...o.position,...o.scale].every(Number.isFinite)
          && Math.max(...o.position.map(Math.abs),...o.scale.map(Math.abs))<=10000000)};
    },id);
    assert.equal(approach.providers,4);assert.equal(approach.domain,'interplanetary');assert.ok(approach.bounded);
    assert.notEqual(approach.physical,id);assert.equal(approach.sample.profile.canLand,false);
    if(id==='titan') await page.screenshot({path:'artifacts/solar12-titan-proxy.png',timeout:90000});
    results.majorMoonApproaches[id]=approach;
  }
  console.log('SOLAR-12 Europa/Titan/Triton production-render approaches remained bounded without terrain providers.');

  // Delay real high-resolution tile promises, never readiness or the scheduler. The cold
  // touchdown patch must keep capture in space until its actual meshes are activated.
  async function delayLandingTiles(id) {
    await page.evaluate(id=>{
      const g=window.__DR_MANAUS__,provider=g.planetProviders.get(id),load=provider.load.bind(provider),
        readiness=provider.readiness.bind(provider);
      const fixture={released:false,pending:[],loads:[],readiness:[],capture:[]};
      window.__DR_LANDING_FIXTURES__??={};window.__DR_LANDING_FIXTURES__[id]=fixture;
      provider.load=demand=>{
        if(demand.key.level<8||fixture.released)return load(demand);
        fixture.loads.push({key:{...demand.key},critical:demand.gameplayCritical,eta:demand.timeToContactS});
        return new Promise(resolve=>fixture.pending.push(()=>resolve(load(demand))));
      };
      provider.readiness=()=>{
        const value=readiness();
        if(value.landingPrefetchKeys.length) {
          fixture.readiness.push({...value});
          if(fixture.readiness.length>2000)fixture.readiness.shift();
        }
        return value;
      };
      const update=g.interplanetary.update.bind(g.interplanetary);
      g.interplanetary.update=(...args)=>{
        const value=update(...args),landing=args[3].landingIntent;
        if(landing?.bodyId===id) {
          const offset=value.positionM.map((v,i)=>v-landing.centreM[i]),length=Math.hypot(...offset),
            relative=value.velocityMps.map((v,i)=>v-landing.velocityMps[i]);
          fixture.capture.push({phase:g.interplanetary.getTelemetry().phase,clearanceM:landing.clearanceM,
            speedMps:Math.hypot(...relative),radialMps:relative.reduce((sum,v,i)=>sum+v*offset[i]/length,0),
            ready:landing.surfaceReady,warp:g.warpStep,autopilot:g.interplanetary.autopilot.active});
        }
        return value;
      };
    },id);
  }
  await delayLandingTiles('moon');

  async function landWithF(id,direction) {
    await page.keyboard.press('m');
    await page.locator(`[data-body-target="${id}"]`).evaluate(button=>button.click());
    await page.locator('#map-panel .close-panel').click();
    await page.keyboard.press('b');
    await page.waitForFunction(()=>window.__DR_MANAUS__.warpStep>0,null,{timeout:15000});
    await page.keyboard.press('p');
    await page.waitForFunction(()=>window.__DR_MANAUS__.interplanetary.autopilot.active,null,{timeout:15000});
    const initial=await page.evaluate(({id,direction})=>{
      const g=window.__DR_MANAUS__,u=g.universe,provider=g.planetProviders.get(id),body=provider.bodyDef;
      const fixedFrame=u.activeSystem.bodies.find(candidate=>candidate.id===id).frameId;
      const a=body.semiMajorAxisM,b=a*(1-body.flattening),radius=1/Math.sqrt(
        (direction[0]**2+direction[1]**2)/(a*a)+direction[2]**2/(b*b));
      const position=u.frames.convertPosition(fixedFrame,'solar-system/barycentric',
        direction.map(v=>v*(radius+provider.surface.heightAt(direction)+1200)));
      const orbital=u.activeSystem.stateOf(id).velocityMps,
        incoming=u.frames.convertDirection(fixedFrame,'solar-system/barycentric',direction.map(v=>-8000*v)),
        velocity=orbital.map((v,i)=>v+incoming[i]);
      g.travelDomain.setState({systemId:'sol',positionM:position,velocityMps:velocity,referenceBodyId:id});
      u.updateSystemPose(position,velocity,0);g.player.position.set(0,0,0);g.player.velocity.set(0,0,0);
      g.surfaceReturnTrace=undefined;
      // The same-frame event avoids spending 8 km/s while waiting for a browser round trip.
      // It goes through InputController; the fixture never calls requestLanding or a handoff.
      const before={speedMps:Math.hypot(...incoming),warp:g.warpStep,autopilot:g.interplanetary.autopilot.active,
        lock:g.navigationLock?.bodyId,readiness:provider.readiness()};
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',key:'f',bubbles:true}));
      window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF',key:'f',bubbles:true}));
      return before;
    },{id,direction});
    assert.equal(initial.lock,id);assert.equal(initial.autopilot,true);assert.ok(initial.warp>0);
    assert.ok(Math.abs(initial.speedMps-8000)<1e-6);
    await page.waitForFunction(id=>{
      const g=window.__DR_MANAUS__,f=window.__DR_LANDING_FIXTURES__[id];
      return g.landingIntent.bodyId===id&&g.warpStep===0&&!g.interplanetary.autopilot.active
        &&f.pending.length>0&&f.capture.filter(t=>t.phase==='landing-hold'&&t.speedMps<1).length>=10;
    },id,{timeout:60000});
    await page.keyboard.press('F3');
    await page.waitForFunction(()=>document.querySelector('#debug-metrics').textContent.includes('Pouso'),null,{timeout:15000});
    const held=await page.evaluate(id=>{
      const g=window.__DR_MANAUS__,f=window.__DR_LANDING_FIXTURES__[id];
      return {domain:g.travelDomain.kind,landing:g.landingState,capture:[...f.capture],loads:[...f.loads]};
    },id);
    assert.equal(held.domain,'interplanetary');assert.equal(held.landing.surfaceReady,false);
    assert.ok(held.landing.missingLandingTiles>0);assert.ok(held.landing.fallbackReady);
    assert.ok(held.landing.clearanceM>=0&&held.landing.clearanceM<2000,'hold stays near the real surface');
    assert.ok(held.capture.every(t=>t.radialMps<=.001),'capture never reflects incoming motion outward');
    assert.ok(held.capture.every(t=>t.warp===0&&!t.autopilot));
    assert.ok(held.capture.at(-1).speedMps<1,'8 km/s is absorbed in the body frame');
    const critical=held.loads.filter(t=>t.critical);
    assert.ok(critical.length>0&&critical.every(t=>Number.isFinite(t.eta)));
    const stationary=held.capture.filter(t=>t.phase==='landing-hold'&&t.speedMps<1).slice(-10);
    assert.ok(Math.max(...stationary.map(t=>t.clearanceM))-Math.min(...stationary.map(t=>t.clearanceM))<1);
    await page.screenshot({path:`artifacts/space-hardening-${id}-landing-hold.png`,timeout:90000});
    await page.keyboard.press('F3');
    await page.evaluate(id=>{
      const f=window.__DR_LANDING_FIXTURES__[id];f.released=true;
      for(const release of f.pending.splice(0))release();
    },id);
    await page.waitForFunction(id=>window.__DR_MANAUS__.surfacePhysicsState.domain===id,id,{timeout:90000});
    const handoff=await page.evaluate(()=>window.__DR_MANAUS__.surfaceReturnTrace);
    assert.equal(handoff.frameBefore,'solar-system/barycentric');assert.equal(handoff.frameAfter,`${id}/local-enu`);
    assert.equal(handoff.firstLocalStep.state,'Falling');assert.ok(handoff.surfaceReady);
    assert.ok(handoff.relativeSpeedMps<=120);assert.ok(handoff.firstLocalStep.position[1]>=handoff.firstLocalStep.terrainHeightM);
    // No second F, injected local velocity, or direct terrain query moves the player here.
    // The production player update falls under this body's gravity and contacts its terrain.
    await page.waitForFunction(()=>window.__DR_MANAUS__.player.state==='Grounded',null,{timeout:240000});
    await page.waitForFunction(()=>document.querySelector('#cruise-block > b').textContent==='CHEGADA',null,{timeout:15000});
    const grounded=await page.evaluate(id=>{
      const g=window.__DR_MANAUS__,f=window.__DR_LANDING_FIXTURES__[id];
      return {physics:g.surfacePhysicsState,landing:g.moonLandingState,state:g.player.state,
        position:g.player.position.toArray(),contact:!!g.player.lastTerrainContact,
        readyPatch:f.readiness.find(r=>r.landingCoverageReady),hudPhase:g.hudFlight().phase,
        capturePhase:g.landingState.phase};
    },id);
    assert.equal(grounded.state,'Grounded');assert.equal(grounded.physics.frame,`${id}/local-enu`);
    assert.equal(grounded.hudPhase,'arrived');assert.equal(grounded.capturePhase,'idle');
    assert.ok(grounded.readyPatch?.fallbackReady);assert.ok(grounded.readyPatch.landingPrefetchKeys.length<=5);
    assert.equal(grounded.readyPatch.landingPrefetchMissingKeys.length,0);assert.ok(grounded.contact);
    results[`${id}FSpaceLanding`]={initial,held,handoff,grounded};
    console.log(`${id}: real F cancels Warp/autopilot, absorbs 8 km/s, holds missing patch, then Falling/terrain CCD/Grounded.`);
    return grounded;
  }

  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,u=g.universe,m=g.moon;
    const sun=u.frames.convertPosition('solar-system/barycentric','moon/fixed',u.activeSystem.positionOf('sun'));
    const direction=sun.map(v=>v/Math.hypot(...sun));
    const position=u.frames.convertPosition('moon/fixed','solar-system/barycentric',direction.map(v=>v*m.bodyDef.semiMajorAxisM*3));
    const velocity=u.activeSystem.stateOf('moon').velocityMps;
    g.travelDomain.setState({systemId:'sol',positionM:position,velocityMps:velocity,referenceBodyId:'moon'});
    u.updateSystemPose(position,velocity,0);
    window.__DR_MOON_LANDING_DIRECTION__=direction;
  });
  await page.waitForFunction(()=>window.__DR_MANAUS__.moon.globe.visible,null,{timeout:30_000});
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,c=g.rendering.camera;
    const target=g.moon.globe.root.position.clone().sub(c.position).normalize().applyQuaternion(c.quaternion.clone().invert());
    Object.assign(g.input.mouseDelta,{x:-Math.atan2(-target.x,-target.z)/.00215,y:-Math.asin(target.y)/.00195});
    g.camera.prepareLook();
    Object.assign(g.input.mouseDelta,{x:0,y:0});
  });
  await page.screenshot({path:'artifacts/space-hardening-moon-orbit.png',timeout:90_000});
  results.moonOrbitalOwnership=await page.evaluate(()=>{
    const g=window.__DR_MANAUS__;
    return {globeVisible:g.moon.globe.visible,fallback:g.moon.readiness().fallbackReady,
      proxyVisible:g.celestialController.renderSamples.find(s=>s.bodyId==='moon').visible};
  });
  assert.ok(results.moonOrbitalOwnership.globeVisible&&results.moonOrbitalOwnership.fallback&&!results.moonOrbitalOwnership.proxyVisible);
  console.log('One complete physical Moon owns orbital rendering.');

  const landed=await landWithF('moon',await page.evaluate(()=>window.__DR_MOON_LANDING_DIRECTION__));
  assert.equal(landed.physics.frame,'moon/local-enu');assert.equal(landed.state,'Grounded');
  assert.ok(Math.abs(landed.physics.gravityMps2-1.623)<.01);assert.ok(!landed.physics.manausSimulationActive);
  assert.equal(landed.landing.proxyOpacity,0);assert.ok(landed.landing.fallbackActive);
  // Face the local horizon for the inspection artifact after testing transported incoming aim.
  await page.evaluate(()=>{window.__DR_MANAUS__.camera.pitch=0;});
  await page.waitForFunction(()=>Math.abs(window.__DR_MANAUS__.rendering.camera.getWorldDirection(
    window.__DR_MANAUS__.player.position.clone()).y)<.3,null,{timeout:15_000});
  await page.screenshot({path:'artifacts/space-hardening-moon-ground.png',timeout:90_000});
  await page.keyboard.down('w');
  await page.waitForFunction(start=>{
    const p=window.__DR_MANAUS__.player.position;
    return Math.hypot(p.x-start[0],p.z-start[2])>.5;
  },landed.position,{timeout:20_000});
  await page.keyboard.up('w');
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.velocity.y>0,null,{timeout:15_000});
  await page.keyboard.press('f');
  await page.waitForFunction(()=>['Hover','Flight'].includes(window.__DR_MANAUS__.player.state),null,{timeout:15_000});
  results.moonLanding=landed;results.walkJumpTakeoff=true;
  results.handoffTrace=await page.evaluate(()=>window.__DR_MANAUS__.surfaceReturnTrace);
  assert.equal(results.handoffTrace.frameBefore,'solar-system/barycentric');
  assert.equal(results.handoffTrace.frameAfter,'moon/local-enu');
  assert.equal(results.handoffTrace.physicsDomain,'moon');
  assert.ok(results.handoffTrace.surfaceReady);
  assert.ok(results.handoffTrace.radialSpeedMps>=-120);
  assert.ok(results.handoffTrace.firstLocalStep.position[1]>=results.handoffTrace.firstLocalStep.terrainHeightM);
  results.fastLocalMoon=await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,p=g.player;
    const floor=g.surfacePhysicsState.terrainHeightM;
    p.position.y=floor+40;p.beginSurfaceApproach();p.velocity.set(200,-10000,50);
    const previous=p.position.toArray(),oldEndpoint=p.position.clone().addScaledVector(p.velocity,1/30).toArray();
    p.update(1/30,[],g.camera.yaw,g.camera.pitch);
    const contact=p.lastTerrainContact;
    return {previous,oldEndpoint,position:p.position.toArray(),physics:g.surfacePhysicsState,
      grounded:p.isGrounded,state:p.state,contact:contact?{fraction:contact.fraction,
        heightM:contact.heightM,normal:contact.normal.toArray(),outwardVelocity:p.velocity.dot(contact.normal)}:null};
  });
  assert.ok(results.fastLocalMoon.contact,'actual PlayerController reports a swept Moon contact');
  assert.ok(results.fastLocalMoon.oldEndpoint[1]<results.fastLocalMoon.contact.heightM);
  assert.ok(results.fastLocalMoon.position[1]>=results.fastLocalMoon.physics.terrainHeightM-.01);
  assert.equal(results.fastLocalMoon.state,'Grounded');assert.ok(results.fastLocalMoon.grounded);
  assert.ok(Math.abs(results.fastLocalMoon.contact.outwardVelocity)<1e-7);
  console.log('P0 first local frame trace and fast local Moon CCD passed.');
  console.log('Moon ground contact, keyboard walking, jumping and takeoff passed.');
  results.volumeInactive=await page.evaluate(()=>window.__DR_MANAUS__.universe.volume.metrics);
  assert.equal(results.volumeInactive.resident,0);assert.equal(results.volumeInactive.pendingBytes,0);
  await page.evaluate(()=>window.__DR_MANAUS__.universe.volume.setDebugDemand(true));
  await page.waitForFunction(()=>window.__DR_MANAUS__.universe.volume.metrics.resident>0,null,{timeout:30_000});
  results.volumeMoon=await page.evaluate(()=>window.__DR_MANAUS__.universe.volume.metrics);
  assert.equal(results.volumeMoon.bodyId,'moon');assert.ok(results.volumeMoon.resident<=64);
  assert.ok(results.volumeMoon.bytes<=2*1024*1024);assert.ok(results.volumeMoon.generatedThisFrame<=1);
  await page.evaluate(()=>window.__DR_MANAUS__.universe.volume.setDebugDemand(false));
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.universe.volume.metrics.bytes),0);
  console.log('Explicit Moon volume demand uses bounded resident data and releases it when disabled.');
  await delayLandingTiles('mars');
  const marsDirection=await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,u=g.universe,p=g.planetProviders.get('mars'),
      fixedFrame=u.activeSystem.bodies.find(body=>body.id==='mars').frameId,
      sun=u.frames.convertPosition('solar-system/barycentric',fixedFrame,u.activeSystem.positionOf('sun')),
      direction=sun.map(v=>v/Math.hypot(...sun)),velocity=u.activeSystem.stateOf('mars').velocityMps,
      position=u.frames.convertPosition(fixedFrame,'solar-system/barycentric',direction.map(v=>v*p.bodyDef.semiMajorAxisM*3));
    g.travelDomain.update({requested:true,altitudeM:1e9,speedMps:0,nearestColliderM:Infinity,
      bodyId:'mars',bodyRadiusM:p.bodyDef.semiMajorAxisM,entryPositionM:position,entryVelocityMps:velocity},0);
    g.travelDomain.setState({systemId:'sol',positionM:position,velocityMps:velocity,referenceBodyId:'mars'});
    u.updateSystemPose(position,velocity,0);g.player.position.set(0,0,0);g.player.velocity.set(0,0,0);
    return direction;
  });
  await page.waitForFunction(()=>window.__DR_MANAUS__.surfacePhysicsState.domain==='space',null,{timeout:30000});
  await landWithF('mars',marsDirection);
  await page.keyboard.press('f');
  await page.waitForFunction(()=>['Hover','Flight'].includes(window.__DR_MANAUS__.player.state),null,{timeout:15000});
  results.marsLocalTakeoff=true;
  // NAV-LOCK-1: explicit fixtures shorten the trip; every subsequent movement is Game.tick.
  // Instrument the production controller solely to retain phase changes between browser polls.
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,original=g.interplanetary.update.bind(g.interplanetary);
    window.__DR_NAV_PHASES__=[];
    g.interplanetary.update=(...args)=>{
      const state=original(...args),t=g.interplanetary.getTelemetry(),trace=window.__DR_NAV_PHASES__;
      if(trace.at(-1)?.phase!==t.phase) trace.push({...t});
      return state;
    };
  });
  async function navigationFixture(id,gap=100000,sideways=0) {
    await page.evaluate(({id,gap,sideways})=>{
      const g=window.__DR_MANAUS__,u=g.universe,body=u.activeSystem.bodies.find(b=>b.id===id);
      g.interplanetary.autopilot.cancel();window.__DR_NAV_PHASES__=[];
      const centre=u.activeSystem.positionOf(id),orbital=u.activeSystem.stateOf(id).velocityMps;
      const direction=id==='moon'?window.__DR_MOON_LANDING_DIRECTION__:[0,1,0];
      const frame=body.frameId;
      // Radius + shared policy margin; this setup never substitutes for autopilot motion.
      const margin=id==='jupiter'?body.equatorialRadiusM*.25:50000;
      const position=u.frames.convertPosition(frame,'solar-system/barycentric',direction.map(v=>v*(body.equatorialRadiusM+margin+gap)));
      const outward=position.map((v,i)=>v-centre[i]),length=Math.hypot(...outward);
      const radial=outward.map(v=>v/length),side=[-radial[1],radial[0],0],sideLength=Math.hypot(...side)||1;
      const velocity=orbital.map((v,i)=>v+side[i]/sideLength*sideways);
      g.travelDomain.update({requested:true,altitudeM:1e9,speedMps:0,nearestColliderM:Infinity,
        bodyId:id,bodyRadiusM:body.equatorialRadiusM,entryPositionM:position,entryVelocityMps:velocity},0);
      g.travelDomain.setState({systemId:'sol',positionM:position,velocityMps:velocity,referenceBodyId:id});
      u.updateSystemPose(position,velocity,0);g.player.position.set(0,0,0);g.player.velocity.set(0,0,0);
      const render=u.frames.convertDirection('solar-system/barycentric',u.renderSpace.currentOrigin.frame,radial.map(v=>-v));
      const c=g.rendering.camera,V=c.position.constructor;
      c.lookAt(c.position.clone().add(new V(...render)));c.updateMatrixWorld();
      g.camera.inSpace=true;g.camera.wasInSpace=true;g.camera.spaceOrientation.copy(c.quaternion);
      g.camera.lookPrepared=false;
    },{id,gap,sideways});
    await page.waitForFunction(()=>window.__DR_MANAUS__.surfacePhysicsState.domain==='space' && window.__DR_MANAUS__.camera.inSpace,null,{timeout:30000});
    await page.waitForFunction(id=>window.__DR_MANAUS__.celestialController.renderSamples.some(s=>s.bodyId===id),id,{timeout:30000});
  }
  await navigationFixture('moon',20000000,400000);
  await page.keyboard.press('Backspace');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.navigationLock,null,{timeout:15000});
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.navigationLock),undefined);
  await page.keyboard.press('Tab');
  await page.waitForFunction(()=>window.__DR_MANAUS__.navigationLock?.bodyId==='moon',null,{timeout:15000});
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.navigationLock?.bodyId),'moon');
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.navigationLock?.source),'reticle');
  await page.waitForFunction(()=>!document.querySelector('#navigation-lock-marker').hidden
    && document.querySelector('#navigation-lock-marker').dataset.bodyId==='moon'
    && document.querySelector('#cruise-block').textContent.includes('LUA'),null,{timeout:15000});
  assert.match(await page.locator('#cruise-block').innerText(),/LUA/);
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.interplanetary.autopilot.active),false);
  await page.keyboard.press('p');
  await page.waitForFunction(()=>window.__DR_NAV_PHASES__.some(t=>t.phase==='acceleration'),null,{timeout:30000});
  await page.keyboard.press('p');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.interplanetary.autopilot.active,null,{timeout:15000});
  const midFlightVelocity=await page.evaluate(()=>[...window.__DR_MANAUS__.travelDomain.state.velocityMps]);
  await page.waitForTimeout(100);
  const midFlightCoast=await page.evaluate(()=>window.__DR_MANAUS__.travelDomain.state.velocityMps);
  assert.ok(midFlightCoast.every((v,i)=>Math.abs(v-midFlightVelocity[i])<1e-6));
  results.navigationMidFlightCancel={velocity:midFlightVelocity,coast:midFlightCoast};
  await page.keyboard.press('p');
  await page.waitForFunction(()=>window.__DR_NAV_PHASES__.some(t=>t.phase==='braking'),null,{timeout:60000});
  await page.waitForFunction(()=>window.__DR_MANAUS__.surfacePhysicsState.domain==='moon',null,{timeout:180000});
  results.navigationMoon=await page.evaluate(()=>({lock:window.__DR_MANAUS__.navigationLock,
    phases:window.__DR_NAV_PHASES__,handoff:window.__DR_MANAUS__.surfaceReturnTrace,
    autopilot:window.__DR_MANAUS__.interplanetary.autopilot.active}));
  assert.ok(results.navigationMoon.phases.some(t=>t.phase==='align'));
  assert.ok(results.navigationMoon.phases.some(t=>t.phase==='acceleration'));
  assert.ok(results.navigationMoon.phases.some(t=>t.phase==='braking'));
  assert.ok(results.navigationMoon.phases.some(t=>t.phase==='approach'));
  assert.equal(results.navigationMoon.autopilot,false);
  assert.ok(results.navigationMoon.handoff.relativeSpeedMps<=120);
  assert.ok(results.navigationMoon.handoff.firstLocalStep.position[1]>=results.navigationMoon.handoff.firstLocalStep.terrainHeightM);
  console.log('NAV-LOCK-1 Moon: keyboard Tab/P, align, acceleration, braking and real local handoff passed.');

  await navigationFixture('mars',100000);
  await page.keyboard.press('m');
  const marsPick=await page.locator('[data-body-target="mars"]').evaluate(button=>{
    const g=window.__DR_MANAUS__,before=[...g.travelDomain.state.positionM];
    button.click();
    return {lock:g.navigationLock,position:[...g.travelDomain.state.positionM],before};
  });
  assert.equal(marsPick.lock.bodyId,'mars');assert.equal(marsPick.lock.source,'map');
  assert.deepEqual(marsPick.position,marsPick.before,'real map callback must not write the logical pose');
  await page.waitForFunction(()=>document.querySelector('[data-body-target="mars"]').textContent.includes('TRAVADO'),null,{timeout:15000});
  await page.locator('#map-panel .close-panel').click();
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.navigationLock.bodyId),'mars');
  await page.keyboard.press('p');
  await page.waitForFunction(()=>window.__DR_MANAUS__.surfacePhysicsState.domain==='mars',null,{timeout:180000});
  results.navigationMars=await page.evaluate(()=>({lock:window.__DR_MANAUS__.navigationLock,
    phases:window.__DR_NAV_PHASES__,handoff:window.__DR_MANAUS__.surfaceReturnTrace,physics:window.__DR_MANAUS__.surfacePhysicsState}));
  assert.ok(results.navigationMars.handoff.relativeSpeedMps<=120);
  assert.ok(results.navigationMars.handoff.surfaceReady);
  assert.equal(results.navigationMars.handoff.frameAfter,'mars/local-enu');
  console.log('NAV-LOCK-1 Mars: shared map/HUD lock persists after closing; real safe local handoff passed.');

  await navigationFixture('jupiter',100000);
  await page.keyboard.press('m');
  await page.locator('[data-body-target="jupiter"]').evaluate(button=>button.click());
  await page.locator('#map-panel .close-panel').click();
  await page.keyboard.press('p');
  await page.waitForFunction(()=>window.__DR_MANAUS__.interplanetary.autopilot.phase==='arrived',null,{timeout:60000});
  results.navigationJupiter=await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,body=g.universe.activeSystem.bodies.find(b=>b.id==='jupiter'),
      centre=g.universe.activeSystem.positionOf('jupiter'),state=g.travelDomain.state;
    return {domain:g.travelDomain.kind,physics:g.surfacePhysicsState,lock:g.navigationLock,
      distance:Math.hypot(...state.positionM.map((v,i)=>v-centre[i])),radius:body.equatorialRadiusM,
      relativeSpeed:g.interplanetary.getTelemetry().relativeSpeedMps,phases:window.__DR_NAV_PHASES__};
  });
  assert.equal(results.navigationJupiter.domain,'interplanetary');
  assert.equal(results.navigationJupiter.physics.domain,'space');
  assert.ok(results.navigationJupiter.distance>=results.navigationJupiter.radius*1.25-1);
  assert.ok(results.navigationJupiter.relativeSpeed<=3);
  // Actual keyboard cancellation followed by manual coast retains the velocity.
  await page.keyboard.press('p');
  await page.waitForFunction(()=>!window.__DR_MANAUS__.interplanetary.autopilot.active,null,{timeout:15000});
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.interplanetary.autopilot.active),false);
  const coast=await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,before=[...g.travelDomain.state.velocityMps];
    return {before,body:g.navigationLock.bodyId};
  });
  await page.waitForTimeout(250);
  const coastAfter=await page.evaluate(()=>window.__DR_MANAUS__.travelDomain.state.velocityMps);
  assert.deepEqual(coastAfter,coast.before);
  results.navigationCancel=coast;
  console.log('NAV-LOCK-1 Jupiter: outside exclusion, no local ground, keyboard cancellation preserves momentum.');
  assert.equal(errors.length,0,errors.join('\n'));
  results.errors=errors;
  await writeFile('artifacts/space-hardening-browser.json',JSON.stringify(results,null,2));
  console.log('SPACE-HARDENING browser checks passed.');
} catch(error) {
  results.failureState=await page?.evaluate(()=>{
    const g=window.__DR_MANAUS__;
    return g?{state:g.player.state,position:g.player.position.toArray(),velocity:g.player.velocity.toArray(),
      physics:g.surfacePhysicsState,landing:g.moonLandingState,inputEnabled:g.input.enabled,
      lock:g.navigationLock,warp:g.warpStep,view:g.rendering.camera.getWorldDirection(g.player.position.clone()).toArray(),
      viewFrame:g.universe.renderSpace.currentOrigin.frame,samples:g.celestialController.renderSamples,
      controls:window.__DR_COSMIC_INPUTS__?.slice(-4)}:undefined;
  }).catch(()=>undefined);
  await writeFile('artifacts/space-hardening-browser.json',JSON.stringify({...results,errors,failure:String(error)},null,2));
  throw error;
} finally {await browser?.close();await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));}
