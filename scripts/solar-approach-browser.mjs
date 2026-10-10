import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

async function skyPixelBrightness(page) {
  // A 1x1 PNG has zero predictor neighbours for every filter. Read the actual resolved image,
  // not WebGL's default framebuffer (WebGPURenderer resolves an internal render target).
  const png=await page.screenshot({clip:{x:250,y:250,width:1,height:1},type:'png'}),parts=[];
  let palette,colorType;
  for(let offset=8;offset<png.length;) {
    const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8);
    if(type==='IHDR'){assert.equal(png[offset+16],8);colorType=png[offset+17];}
    if(type==='PLTE')palette=png.subarray(offset+8,offset+8+length);
    if(type==='IDAT')parts.push(png.subarray(offset+8,offset+8+length));offset+=12+length;
  }
  const raw=inflateSync(Buffer.concat(parts));
  if(colorType===3)return palette[raw[1]*3]+palette[raw[1]*3+1]+palette[raw[1]*3+2];
  if(colorType===0||colorType===4)return raw[1]*3;
  assert.ok(colorType===2||colorType===6);return raw[1]+raw[2]+raw[3];
}

/** Explicit 1 AU approach fixture; every flight step uses Game, catalog, CCD and C4. */
export async function solarApproachChecks(page, results) {
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__;g.rendering.renderer.setAnimationLoop(null);
    g.clearNavigationTarget();g.landingIntent.cancel();g.warpStep=0;
    window.__DR_PLACE_SUN__=(distance,speed=0)=>{
      const u=g.universe,b=u.activeSystem.bodies.find(b=>b.id==='sun'),centre=u.activeSystem.positionOf('sun');
      const position=u.frames.convertPosition(b.frameId,'solar-system/barycentric',[0,0,-distance]);
      const direction=centre.map((v,i)=>(v-position[i])/distance),orbital=u.activeSystem.stateOf('sun').velocityMps;
      const velocity=orbital.map((v,i)=>v+direction[i]*speed);
      g.travelDomain.update({requested:true,altitudeM:distance-b.equatorialRadiusM,speedMps:speed,
        nearestColliderM:Infinity,bodyId:'sun',bodyRadiusM:b.equatorialRadiusM,
        entryPositionM:position,entryVelocityMps:velocity},0);
      g.travelDomain.setState({systemId:'sol',positionM:position,velocityMps:velocity,referenceBodyId:'sun'});
      u.updateSystemPose(position,velocity,0);g.player.position.set(0,0,0);g.player.velocity.set(0,0,0);
      g.rendering.domains.active=true;g.bindSurfacePhysics();
      const render=u.frames.convertDirection('solar-system/barycentric',u.renderSpace.currentOrigin.frame,direction);
      const c=g.rendering.camera,V=c.position.constructor;c.position.set(0,0,0);
      c.lookAt(new V(...render));c.updateMatrixWorld();g.camera.inSpace=true;g.camera.wasInSpace=true;
      g.camera.spaceOrientation.copy(c.quaternion);g.camera.lookPrepared=false;
      Object.assign(g.input.mouseDelta,{x:0,y:0});g.camera.prepareLook();
      g.celestialController.prepare({universe:u,earth:g.earth,planetProviders:g.planetProviders,
        fovRad:c.fov*Math.PI/180,viewportHeightPx:innerHeight,cameraFarM:c.far});
      g.celestialController.render({camera:c});
      g.space.setSolarPresentation(g.celestialController.renderSamples.find(s=>s.bodyId==='sun'));
    };
    window.__DR_PLACE_SUN__(149597870700);
  });
  await page.keyboard.press('Tab');
  const lock=await page.evaluate(()=>{const g=window.__DR_MANAUS__;g.updateInterplanetaryFlight(0);g.input.endFrame();return g.navigationLock;});
  assert.equal(lock?.bodyId,'sun','real Tab locks Sun');
  await page.keyboard.press('p');
  const trip=await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,phases=new Set();g.warpStep=9;let contacts=0,minimum=Infinity;
    for(let i=0;i<14400;i++) {
      g.updateInterplanetaryFlight(1/60);g.input.endFrame();phases.add(g.interplanetary.autopilot.phase);
      if(g.interplanetary.lastCelestialContact)contacts++;
      minimum=Math.min(minimum,g.solarApproachState.distanceM);
      if(g.interplanetary.autopilot.phase==='arrived'&&g.flightTelemetry.relativeSpeedMps<.01)break;
    }
    for(let i=0;i<4;i++)g.tick(performance.now()+16*(i+1));
    return {phases:[...phases],contacts,minimum,solar:g.solarApproachState,phase:g.interplanetary.autopilot.phase,
      speed:g.flightTelemetry.relativeSpeedMps,physics:g.surfacePhysicsState};
  });
  assert.equal(trip.phase,'arrived');assert.ok(trip.phases.includes('braking'));assert.equal(trip.contacts,0);
  assert.ok(Math.abs(trip.solar.photosphereClearanceM-20871000)<4);assert.ok(trip.solar.angularDiameterDeg>150);
  assert.equal(trip.physics.domain,'space');results.solarAutopilot=trip;
  assert.equal(trip.solar.visual.mode,'IMMERSIVE');
  await page.screenshot({path:'artifacts/sun-autopilot.png',timeout:90000});
  await page.keyboard.press('p');await page.keyboard.down('w');
  const override=await page.evaluate(()=>{const g=window.__DR_MANAUS__,before=g.solarApproachState.distanceM;
    g.warpStep=0;for(let i=0;i<60;i++){g.updateInterplanetaryFlight(1/60);g.input.endFrame();}
    return {before,after:g.solarApproachState.distanceM,active:g.interplanetary.autopilot.active,contact:g.interplanetary.lastCelestialContact};});
  await page.keyboard.up('w');assert.equal(override.active,false);assert.ok(override.after<override.before);assert.equal(override.contact,undefined);
  results.solarOverride=override;
  results.solarViews=[];
  for(const [name,distance] of [['earth',149597870700],['10r',6957000000],['5r',3478500000],['2r',1391400000],
    ['1_5r',1043550000],['1_1r',765270000],['near',695800001]]) {
    const state=await page.evaluate(distance=>{const g=window.__DR_MANAUS__;window.__DR_PLACE_SUN__(distance);
      // One normal Game frame drives all presentation owners, labels, HUD and renderer.
      for(let i=0;i<4;i++)g.tick(performance.now()+16*(i+1));return {solar:g.solarApproachState,
        finite:g.celestialVisuals.root.children[0].position.toArray().every(Number.isFinite),
        label:document.querySelector('[data-body-id="sun"]')?.style.opacity,hud:document.querySelector('#cruise-block').textContent};},distance);
    assert.ok(state.finite&&Number.isFinite(state.solar.projectedDiameterPx));
    if(distance<=1391400000)assert.ok(state.solar.projectedDiameterPx>800);
    await page.screenshot({path:`artifacts/sun-${name}.png`,timeout:90000});results.solarViews.push({name,...state});
  }
  results.solarQuality=[];
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__;window.__DR_PLACE_SUN__(695800001);g.tick(performance.now()+16);
  });
  const nearBrightness=await skyPixelBrightness(page);
  await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,c=g.rendering.camera;c.rotateY(Math.PI);c.updateMatrixWorld();
    g.camera.spaceOrientation.copy(c.quaternion);g.camera.lookPrepared=false;g.tick(performance.now()+32);
  });
  results.solarLookAway={before:nearBrightness,after:await skyPixelBrightness(page)};
  assert.ok(results.solarLookAway.before>100&&results.solarLookAway.after<results.solarLookAway.before*.3,
    'looking away from the near Sun restores a dark sky');
  await page.screenshot({path:'artifacts/sun-look-away.png',timeout:90000});
  for(const quality of ['Low','Medium','High','Ultra']) {
    const visual=await page.evaluate(quality=>{const g=window.__DR_MANAUS__;g.celestialVisuals.setQuality(quality);
      window.__DR_PLACE_SUN__(3478500000);g.tick(performance.now()+16);return g.celestialVisuals.solarDiagnostics;},quality);
    assert.equal(visual.materials,1);assert.equal(visual.drawCalls,1);assert.equal(visual.triangles,2);results.solarQuality.push(visual);
  }
  await page.evaluate(()=>window.__DR_MANAUS__.celestialVisuals.setQuality('High'));
  const boundaries=await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,cases=[];g.clearNavigationTarget();g.celestialImpacts.clear();
    for(const [name,distance] of [['old-2r',1391401000],['corona',1043550000],['photosphere',695801000]]) {
      window.__DR_PLACE_SUN__(distance,1000000);g.updateInterplanetaryFlight(1/60);g.input.endFrame();
      cases.push({name,solar:g.solarApproachState,contact:g.interplanetary.lastCelestialContact,
        debug:g.solarDebug(),
        speed:Math.hypot(...g.travelDomain.state.velocityMps.map((v,i)=>v-g.universe.activeSystem.stateOf('sun').velocityMps[i]))});
    }return cases;
  });
  assert.equal(boundaries[0].contact,undefined);assert.ok(boundaries[0].solar.distanceM<1391400000);
  assert.equal(boundaries[1].contact,undefined);assert.ok(boundaries[2].contact);
  assert.ok(Math.abs(boundaries[2].solar.photosphereClearanceM-100001)<1);
  assert.ok(boundaries[2].speed<.01);results.solarBoundaries=boundaries;
  assert.equal(boundaries[0].debug['SOL · Contato CCD'],'NÃO');
  assert.equal(boundaries[2].debug['SOL · Contato CCD'],'SIM');
  assert.equal(boundaries[2].debug['SOL · CCD radius'],695800000);
  const catastrophic=await page.evaluate(()=>{
    const g=window.__DR_MANAUS__,u=g.universe;g.clearNavigationTarget();g.celestialImpacts.clear();g.lastCelestialImpact=undefined;g.warpStep=0;
    const catalog=JSON.stringify(u.activeSystem.bodies),before={...u.volume.metrics},count=g.celestialImpacts.emittedCount;
    window.__DR_PLACE_SUN__(695801000,299792458*1.001);g.updateInterplanetaryFlight(1/120);
    const event=g.lastCelestialImpact,contact=g.interplanetary.lastCelestialContact;
    for(let i=0;i<120;i++)g.updateInterplanetaryFlight(1/120);
    return {event,contact,count:g.celestialImpacts.emittedCount-count,before,after:{...u.volume.metrics},
      intact:JSON.stringify(u.activeSystem.bodies)===catalog,physics:g.surfacePhysicsState,solar:g.solarApproachState};
  });
  assert.equal(catastrophic.event.classification,'CATASTROPHIC_IMPACT');assert.equal(catastrophic.count,1);
  assert.equal(catastrophic.contact.envelopeRadiusM,695800000);assert.deepEqual(catastrophic.after,catastrophic.before);
  assert.ok(catastrophic.intact);assert.equal(catastrophic.physics.domain,'space');results.solarCatastrophic=catastrophic;
  await page.evaluate(()=>{const g=window.__DR_MANAUS__;g.rendering.renderer.setAnimationLoop(g.tick);});
  console.log('SUN-APPROACH-P0: real Tab/P arrival, manual 2R/corona crossing, photosphere CCD, C4, quality and screenshots passed.');
}
