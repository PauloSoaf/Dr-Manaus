import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

/** Extends the existing local browser run with real owners and an explicit isolated scene. */
export async function localImpactCheckpoint(page) {
  const results=await page.evaluate(async()=>{
    const game=window.__DR_MANAUS__;
    const {localImpactFixture,Group,Vector3,HemisphereLight,DirectionalLight,Raycaster}=await import('/tests/helpers/local-impact-fixture.ts');
    const {PhysicsWorld}=await import('/src/physics/PhysicsWorld.ts');
    const {PlayerController}=await import('/src/player/PlayerController.ts');
    await game.rendering.renderer.setAnimationLoop(null);
    const fixture=localImpactFixture();
    const saved={worldVisible:game.worldRoot.visible,actorVisible:game.actorRoot.visible,fog:game.rendering.scene.fog,
      position:game.rendering.camera.position.clone(),quaternion:game.rendering.camera.quaternion.clone()};
    window.__DR_LOCAL_IMPACT_FIXTURE__={fixture,saved};
    const initial=fixture.query(new Vector3(),2000).length;
    fixture.impact(game);fixture.drain();
    const parts=fixture.matrices('largo:');
    const stats=fixture.destruction.lastImpact;
    const maskedScars=Boolean(fixture.root.getObjectByName('destruction-scars')?.material.maskNode);
    const small=fixture.streamer.isDestroyed('0,0/building/0'),large=fixture.streamer.isDestroyed('0,0/building/1'),outside=fixture.streamer.isDestroyed('0,0/building/2');
    game.worldRoot.visible=false;game.actorRoot.visible=false;game.rendering.scene.fog=null;
    fixture.root.add(new HemisphereLight(0xfff0d6,0x75604d,2));const light=new DirectionalLight(0xffffff,3);light.position.set(-500,900,200);fixture.root.add(light);game.rendering.scene.add(fixture.root);
    fixture.root.updateMatrixWorld(true);
    const samples=[0,.25,.5,.75].map(ratio=>{
      const x=ratio*fixture.footprint.craterRadiusM,origin=new Vector3(x,100,0),direction=new Vector3(0,-1,0);
      const ray=new Raycaster(origin,direction,0,1000),hit=ray.intersectObject(fixture.terrain.bowl)[0];
      return {ratio,physics:fixture.terrain.heightAt(x,0),visual:hit?.point.y};
    });
    PhysicsWorld.setTerrain({heightAt:()=>0,heightfieldOnly:true});
    const player=new PlayerController(new Group(),{enabled:true,held:()=>false,consume:()=>false,pressed:()=>false,mouseDelta:{x:0,y:0}});
    player.teleport(new Vector3(0,.1,0));player.state='Falling';player.grounded=false;player.velocity.set(8000,-20,0);player.update(1/60,[],0);
    const contact=player.lastTerrainContact,landing=player.consumeImpact();
    const swept={contact:contact?.position.toArray(),point:landing?.position.toArray(),impact:landing?.impact,postVelocity:player.velocity.toArray()};player.character.dispose();PhysicsWorld.setTerrain(game.terrain);
    game.rendering.camera.position.set(850,650,1000);game.rendering.camera.lookAt(0,-100,0);game.rendering.camera.updateMatrixWorld();
    await game.rendering.renderer.renderAsync(game.rendering.scene,game.rendering.camera);
    return {initial,parts:parts.length,partsRemoved:parts.filter(p=>p.determinant===0).length,small,large,outside,
      terrain:fixture.terrain.stats,samples,stats,maskedScars,pending:fixture.destruction.pendingCount,peakPending:fixture.peakPending,
      npcs:fixture.population.npcs.slice(0,5).map(n=>({id:n.id,state:n.state,active:n.active,velocity:n.velocity.toArray()})),
      coreCarWreck:fixture.traffic.pool[0].wreck,swept};
  });
  try {
    assert.equal(results.partsRemoved,results.parts);assert.ok(results.parts>100);
    assert.ok(results.small&&results.large&&!results.outside);assert.ok(results.coreCarWreck);
    assert.equal(results.pending,0);assert.ok(results.peakPending>16);
    assert.ok(results.maskedScars,'ground scars use the excavation mask');
    assert.ok(results.stats.trees>0&&results.stats.props>0&&results.stats.lamps>0&&results.stats.vehicles>0);
    assert.deepEqual(results.npcs.map(n=>n.state),['disabled','knocked','fleeing','fleeing','walking']);
    for(const sample of results.samples)assert.ok(Math.abs(sample.visual-sample.physics)<.01);
    assert.deepEqual(results.swept.point,results.swept.contact);assert.ok(results.swept.impact.craterRadiusM>250);
    await page.screenshot({path:'artifacts/impact-local-overview.png'});
    await page.evaluate(async()=>{
      const game=window.__DR_MANAUS__;game.rendering.camera.position.set(320,100,570);game.rendering.camera.lookAt(0,-150,0);game.rendering.camera.updateMatrixWorld();
      await game.rendering.renderer.renderAsync(game.rendering.scene,game.rendering.camera);
    });
    await page.screenshot({path:'artifacts/impact-local-bowl.png'});
    await writeFile('artifacts/impact-local-browser.json',JSON.stringify({status:'passed',...results},null,2));
    console.log(`  local impact P0: ${results.partsRemoved} furniture parts removed, peak queue ${results.peakPending}, crater ${results.stats.footprint.craterRadiusM.toFixed(1)}/${results.stats.footprint.craterDepthM.toFixed(1)}m`);
    return results;
  } finally {
    await page.evaluate(()=>{
      const game=window.__DR_MANAUS__,state=window.__DR_LOCAL_IMPACT_FIXTURE__;
      if(!state)return;state.fixture.dispose();game.worldRoot.visible=state.saved.worldVisible;game.actorRoot.visible=state.saved.actorVisible;game.rendering.scene.fog=state.saved.fog;
      game.rendering.camera.position.copy(state.saved.position);game.rendering.camera.quaternion.copy(state.saved.quaternion);
      game.rendering.renderer.setAnimationLoop(game.tick);delete window.__DR_LOCAL_IMPACT_FIXTURE__;
    });
    // Fixture disposal clears its physics provider; bind the city's provider again before flight.
    await page.evaluate(async()=>{const {PhysicsWorld}=await import('/src/physics/PhysicsWorld.ts');PhysicsWorld.setTerrain(window.__DR_MANAUS__.terrain);});
  }
}
