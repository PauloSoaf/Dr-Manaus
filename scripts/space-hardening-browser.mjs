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
    await page.locator(`[data-system-focus="${parent}"]`).click();
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
    await page.locator('[data-system-overview]').click();
    assert.match(await page.locator('.map-scale').textContent(),/AU/);
  }
  assert.equal(await page.evaluate(()=>window.__DR_MANAUS__.universe.activeSystem.bodies.length),19);
  assert.deepEqual(await page.evaluate(()=>[...window.__DR_MANAUS__.planetProviders.keys()]),['mercury','venus','moon','mars']);
  await page.locator('#map-panel .close-panel').click();
  results.desktopMap=map;
  console.log('Desktop map layout, canvas and DPR passed.');
  console.log('SOLAR-12 live map focus, all nine moon targets, canvas selection and unchanged provider count passed.');

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

  // Put the incoming state over the measured terrain, stream through the existing scheduler,
  // and let Game.tick decide the return. No direct handoff or alternate Moon physics.
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,u=g.universe,m=g.moon;
    const direction=window.__DR_MOON_LANDING_DIRECTION__;
    const height=m.surface.heightAt(direction),a=m.bodyDef.semiMajorAxisM,b=a*(1-m.bodyDef.flattening);
    const radius=1/Math.sqrt((direction[0]**2+direction[1]**2)/(a*a)+direction[2]**2/(b*b));
    const fixed=direction.map(v=>v*(radius+height+400));
    const position=u.frames.convertPosition('moon/fixed','solar-system/barycentric',fixed);
    const orbital=u.activeSystem.stateOf('moon').velocityMps;
    const inward=u.frames.convertDirection('moon/fixed','solar-system/barycentric',direction.map(v=>v*-800));
    const velocity=orbital.map((v,i)=>v+inward[i]);
    g.travelDomain.setState({systemId:'sol',positionM:position,velocityMps:velocity,referenceBodyId:'moon'});
    u.updateSystemPose(position,velocity,0);g.player.position.set(0,0,0);g.player.velocity.set(0,0,0);
  });
  await page.waitForFunction(()=>window.__DR_MANAUS__.surfacePhysicsState.domain==='moon',null,{timeout:60_000});
  console.log('Game.tick returned into moon/local-enu through streamed landing readiness.');
  // Descend with the public flight controls; lunar gravity alone takes much longer in a
  // software-rendered browser because simulation dt is bounded to 60 ms per rendered frame.
  await page.keyboard.press('f');
  await page.keyboard.down('ControlLeft');
  await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>window.__DR_MANAUS__.player.state==='Grounded',null,{timeout:60_000});
  await page.keyboard.up('ControlLeft');
  await page.keyboard.up('ShiftLeft');
  const landed=await page.evaluate(()=>({physics:window.__DR_MANAUS__.surfacePhysicsState,
    landing:window.__DR_MANAUS__.moonLandingState,state:window.__DR_MANAUS__.player.state,
    position:window.__DR_MANAUS__.player.position.toArray()}));
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
  console.log('Moon ground contact, keyboard walking, jumping and takeoff passed.');
  assert.equal(errors.length,0,errors.join('\n'));
  results.errors=errors;
  await writeFile('artifacts/space-hardening-browser.json',JSON.stringify(results,null,2));
  console.log('SPACE-HARDENING browser checks passed.');
} catch(error) {
  results.failureState=await page?.evaluate(()=>{
    const g=window.__DR_MANAUS__;
    return g?{state:g.player.state,position:g.player.position.toArray(),velocity:g.player.velocity.toArray(),
      physics:g.surfacePhysicsState,landing:g.moonLandingState}:undefined;
  }).catch(()=>undefined);
  await writeFile('artifacts/space-hardening-browser.json',JSON.stringify({...results,errors,failure:String(error)},null,2));
  throw error;
} finally {await browser?.close();await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));}
