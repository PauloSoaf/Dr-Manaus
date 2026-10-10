import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three/webgpu';
import { knownGalaxyRuntime } from '../src/world/galaxy/GalaxyRuntime.ts';
import { GalaxyMaterializer, type GalaxyStage } from '../src/world/galaxy/GalaxyMaterializer.ts';
import { findAndromedaU2Fixture } from '../src/world/galaxy/AndromedaU2Fixture.ts';
import { galaxyLocalPositionM, orientGalaxyVector, addressSeparationM, observerGlobalPositionM } from '../src/world/galaxy/GalaxyCoordinates.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { ProceduralSystemMaterializer, type SystemResources } from '../src/world/runtime/ProceduralSystemMaterializer.ts';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog.ts';
import { UniversalTargetResolver, activeSystemTargetBodyId } from '../src/world/travel/UniversalTargetResolver.ts';
import { createUniversalTarget } from '../src/world/travel/UniversalNavigationTarget.ts';
import { sectorIndex, sectorSeed } from '../src/world/spatial/UniverseAddress.ts';
import { LIGHT_YEAR_M } from '../src/world/spatial/units.ts';
import { bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory.ts';
import { selectBodyDestination, bodyExclusionEnvelopes } from '../src/world/travel/BodyNavigation.ts';
import { celestialLockCandidates, cycleNavigationTarget } from '../src/world/travel/NavigationLock.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry.ts';
import { ProceduralSystemRuntime } from '../src/world/celestial/ProceduralSystemRuntime.ts';

const mw=knownGalaxyRuntime('milky_way')!,a=knownGalaxyRuntime('andromeda')!,zero=sectorIndex(0n,0n,0n);
const c=new UniversalTargetCatalog(),d=findAndromedaU2Fixture(c),t=c.proceduralTarget(a.id,d.address.sector,d.star.id,'star')!;
const rocky=d.system.bodies.find(b=>bodyProfile(b).bodyClass==='rocky')!;
const moon=d.system.bodies.find(b=>b.parentId&&b.parentId!==d.star.id&&bodyProfile(b).canLand)!;
const giant=d.system.bodies.find(b=>bodyProfile(b).bodyClass==='gas-giant')!;
const noop:SystemResources={install:()=>{},activate:()=>{},dispose:()=>{}};
function fixture(stage?:(s:GalaxyStage)=>void,systemResources:()=>SystemResources=()=>noop){
  const u=new UniverseRuntime({epochS:123456}),root=new Group(),g=new GalaxyMaterializer(u,root,stage);
  const initial=g.prepare(mw.id);initial.install();initial.activate();initial.complete?.();
  const m=new ProceduralSystemMaterializer(u,c,noop,systemResources,undefined,g);
  return {u,g,m,root,r:new UniversalTargetResolver(c,u)};
}
const installed=()=>{const f=fixture();f.m.testArrival(t);return f;};
test('T_U2_GALAXY_RUNTIME_MILKY_WAY',()=>assert.equal(mw.centralBlackHole?.id,'sgra'));
test('T_U2_GALAXY_RUNTIME_ANDROMEDA',()=>assert.equal(a.centralBlackHole?.id,'m31_smbh'));
test('T_U2_ACTIVE_GALAXY_MATCHES_ADDRESS',()=>{const f=installed();assert.equal(f.u.activeGalaxy.id,f.u.address.galaxyId);f.m.returnToSolar();assert.equal(f.u.activeGalaxy.id,f.u.address.galaxyId);});
test('T_U2_MW_SECTOR_ZERO_REMAINS_SOLAR_NEIGHBORHOOD',()=>assert.deepEqual(mw.galaxyLocalPosition(zero),[-26000*LIGHT_YEAR_M,0,0]));
test('T_U2_ANDROMEDA_SECTOR_ZERO_GALAXY_LOCAL',()=>assert.deepEqual(a.galaxyLocalPosition(zero),[0,0,0]));
test('T_U2_GALAXY_LOCAL_POSITION_SHARED_AUTHORITY',()=>{for(const g of [mw,a])assert.deepEqual(g.galaxyLocalPosition(d.address.sector,d.star.offsetM),galaxyLocalPositionM(g.definition,d.address.sector,d.star.offsetM));});
test('T_U2_MW_DENSITY_SOLAR_BASELINE',()=>{const density=mw.densityAtLocal(mw.galaxyLocalPosition(zero));assert.ok(density>.5&&density<2);assert.equal(mw.generateSector(sectorIndex(17n,-2n,4n)).stars[0].id,'milky_way/17,-2,4/0');});
test('T_U2_MW_DENSITY_CENTRE_HIGHER',()=>assert.ok(mw.densityAtLocal([0,0,0])>mw.densityAtLocal(mw.galaxyLocalPosition(zero))));
test('T_U2_ANDROMEDA_DENSITY_CENTRE_NONZERO',()=>assert.ok(a.densityAtLocal([0,0,0])>1));
test('T_U2_ANDROMEDA_DENSITY_DISC_NONZERO',()=>assert.ok(a.generateSector(d.address.sector).stars.length>0));
test('T_U2_ANDROMEDA_DENSITY_FAR_LOW',()=>{assert.ok(a.densityAtLocal([1e7*LIGHT_YEAR_M,0,0])<.001);assert.ok(a.densityAtLocal([0,0,1e6*LIGHT_YEAR_M])<a.densityAtLocal([0,0,0]));});
test('T_U2_NO_ANDROMEDA_2_5MLY_DENSITY_OFFSET',()=>{assert.ok(a.generateSector(zero).stars.length>0);assert.ok(a.generateSector(zero).stars.length<=2000);assert.ok(a.generateSector(zero,{maxStars:1e9}).stars.length<=2000);});
test('T_U2_SAME_SECTOR_DIFFERENT_GALAXY_DIFFERENT_SEED',()=>assert.notEqual(sectorSeed(mw.id,zero),sectorSeed(a.id,zero)));
test('T_U2_ANDROMEDA_SECTOR_DETERMINISTIC',()=>assert.deepEqual(a.generateSector(d.address.sector),a.generateSector(d.address.sector)));
test('T_U2_ANDROMEDA_SYSTEM_DETERMINISTIC',()=>{for(let i=0;i<10;i++)assert.deepEqual(findAndromedaU2Fixture(new UniversalTargetCatalog()),d);assert.equal(d.star.id,'andromeda/200,0,0/1');assert.equal(d.system.seed,4008873971866871987n);});
test('T_U2_ANDROMEDA_PLANET_DETERMINISTIC',()=>assert.deepEqual(new UniversalTargetCatalog().proceduralDescriptor(a.id,d.address.sector,d.star.id)?.system.bodies,d.system.bodies));
test('T_U2_MATERIALIZER_ACCEPTS_ANDROMEDA',()=>assert.equal(installed().m.current?.descriptor.star.id,d.star.id));
test('T_U2_MATERIALIZER_REJECTS_UNKNOWN_GALAXY',()=>{const f=fixture(),bad=createUniversalTarget({...t,galaxyId:'unknown',address:{...d.address,galaxyId:'unknown',bodyId:d.star.id}});assert.throws(()=>f.m.testArrival(bad));assert.equal(f.u.activeGalaxy,mw);});
test('T_U2_GALAXY_PREPARES_BEFORE_INSTALL',()=>{const f=fixture(),old=f.g.current,ids=f.u.frames.ids,count=f.u.providers.size,p=f.m.prepare(t);assert.equal(f.g.current,old);assert.equal(f.u.activeGalaxy,mw);assert.deepEqual(f.u.frames.ids,ids);assert.equal(f.u.providers.size,count);p.dispose();assert.equal(f.root.children.length,1);});
test('T_U2_ATOMIC_GALAXY_SYSTEM_INSTALL',()=>{
  const f=fixture();const install=f.u.installSystem.bind(f.u);let seen=false;
  f.u.installSystem=(...args)=>{install(...args);assert.equal(f.u.address.galaxyId,f.u.activeGalaxy.id);seen=true;};
  f.m.testArrival(t);assert.ok(seen);assert.equal(f.g.current?.galaxy,f.u.activeGalaxy);
});
test('T_U2_FAILED_GALAXY_INSTALL_PRESERVES_MILKY_WAY',()=>{
  for(const stage of ['galaxy','star-sectors','black-hole','install','activate'] as const){
    let armed=false;const f=fixture(s=>{if(armed&&s===stage)throw Error(stage);});armed=true;
    const old=f.g.current,pose=structuredClone(f.u.player),ids=f.u.frames.ids,count=f.u.providers.size;
    assert.throws(()=>f.m.testArrival(t));assert.equal(f.u.activeGalaxy,mw);assert.equal(f.u.activeSystem,f.u.solarSystem);
    assert.equal(f.g.current,old);assert.deepEqual(f.u.player,pose);assert.deepEqual(f.u.frames.ids,ids);assert.equal(f.u.providers.size,count);assert.equal(f.root.children.length,1);
  }
  for(const fail of ['install','activate']){
    const f=fixture(undefined,()=>({install:()=>{if(fail==='install')throw Error(fail);},activate:()=>{if(fail==='activate')throw Error(fail);},dispose:()=>{}}));
    const old=f.g.current;assert.throws(()=>f.m.testArrival(t));assert.equal(f.u.activeGalaxy,mw);assert.equal(f.g.current,old);assert.equal(f.u.providers.size,1);
  }
});
test('U2 system preparation and frame install failures dispose prepared galaxy resources',()=>{
  const f=fixture();const ids=f.u.frames.ids,old=f.g.current;
  const m=new ProceduralSystemMaterializer(f.u,c,noop,()=>{throw Error('system preparation');},undefined,f.g);
  assert.throws(()=>m.testArrival(t));assert.equal(f.g.current,old);assert.equal(f.u.providers.size,1);
  const register=f.u.frames.register.bind(f.u.frames);let count=0;f.u.frames.register=frame=>{if(++count===3)throw Error('frame');return register(frame);};
  assert.throws(()=>f.m.testArrival(t));assert.equal(f.g.current,old);assert.deepEqual(f.u.frames.ids,ids);assert.equal(f.u.providers.size,1);
});
test('T_U2_ACTIVE_SYSTEM_ANDROMEDA',()=>assert.ok(installed().u.activeSystem instanceof ProceduralSystemRuntime));
test('T_U2_PLAYER_ADDRESS_ANDROMEDA',()=>assert.equal(installed().u.address.galaxyId,a.id));
test('T_U2_PLAYER_FRAME_ANDROMEDA_SYSTEM',()=>assert.equal(installed().u.player.frame,'system/'+d.star.id));
test('T_U2_STAR_SECTOR_PROVIDER_SWITCHES_GALAXY',()=>assert.equal(installed().g.current?.starSectorProvider.galaxyId,a.id));
test('T_U2_MW_PROVIDER_RETIRES',()=>{const f=fixture(),old=f.g.current!;f.m.testArrival(t);assert.equal(old.ready,false);assert.equal(old.root.children.length,0);assert.equal(f.u.providers.get(old.starSectorProvider.id),undefined);});
test('T_U2_ANDROMEDA_PROVIDER_ACTIVATES',()=>{const f=installed(),p=f.g.current!.starSectorProvider;assert.equal(f.u.providers.get(p.id),p);assert.equal(p.covers({address:f.u.address,altitudeM:1e6} as any),true);});
test('T_U2_ACTIVE_GALAXY_NOT_RENDERED_AS_EXTERNAL',()=>assert.ok(installed().g.current?.externalGalaxies.every(g=>g.id!=='galaxy-macro/andromeda')));
test('T_U2_OTHER_GALAXY_RENDERED_EXTERNAL',()=>{const f=installed();f.g.update([0,0,0],1e6);assert.equal(f.g.current!.externalGalaxies[0].id,'galaxy-macro/milky_way');assert.equal(f.g.current!.externalGalaxies[0].stats.visible,true);});
test('T_U2_EXTERNAL_DIRECTION_REVERSES',()=>{
  const f=fixture();f.u.renderSpace.setOrigin({...f.u.renderSpace.currentOrigin,frame:f.u.activeSystem.systemFrameId,position:[0,0,0],orientation:[0,0,0,1]});f.g.update([0,0,0],1e6);const forward=f.g.current!.externalGalaxies[0].group.position.clone().normalize();
  f.m.testArrival(t);f.u.renderSpace.setOrigin({...f.u.renderSpace.currentOrigin,frame:f.u.activeSystem.systemFrameId,position:[0,0,0],orientation:[0,0,0,1]});f.g.update([0,0,0],1e6);const reverse=f.g.current!.externalGalaxies[0].group.position.clone().normalize();
  // Positions are in each observer's local axes; compare after the descriptor orientation transform.
  const world=orientGalaxyVector(a.definition,reverse.toArray());assert.ok(forward.dot({x:world[0],y:world[1],z:world[2]} as any)<-.99);
  const localNormal=new Vector3(0,0,1).applyQuaternion(f.g.current!.externalGalaxies[0].group.quaternion);
  const worldNormal=orientGalaxyVector(a.definition,localNormal.toArray());assert.ok(Math.abs(worldNormal[0])<1e-12&&Math.abs(worldNormal[1])<1e-12&&Math.abs(worldNormal[2]-1)<1e-12);
});
test('T_U2_M31_BLACK_HOLE_CURRENT_GALAXY',()=>{const f=installed();assert.equal(f.g.current!.centralBlackHole?.id,'blackhole/m31_smbh');assert.equal(f.r.resolve(c.target('m31_smbh')!).materialized,true);});
test('T_U2_SGRA_NOT_LOCAL_IN_ANDROMEDA',()=>{const f=installed();assert.equal(f.r.resolve(c.target('sgra')!).materialized,false);assert.notEqual(f.g.current!.centralBlackHole?.id,'blackhole/sgra');});
test('T_U2_M31_DISTANCE_GALACTOCENTRIC',()=>{const f=installed();const expected=Math.hypot(...a.galaxyLocalPosition(f.u.address.sector,f.u.location.sectorOffsetM));assert.ok(Math.abs(f.r.resolve(c.target('m31_smbh')!).distanceM!/expected-1)<1e-10);assert.ok(expected/LIGHT_YEAR_M>19000&&expected/LIGHT_YEAR_M<22000);});
test('T_U2_SGRA_DISTANCE_INTERGALACTIC_FROM_ANDROMEDA',()=>{const f=installed(),ly=f.r.resolve(c.target('sgra')!).distanceM!/LIGHT_YEAR_M;assert.ok(ly>2.4e6&&ly<2.6e6);});
test('T_U2_SGRA_DISTANCE_26KLY_FROM_SOLAR',()=>assert.ok(Math.abs(fixture().r.resolve(c.target('sgra')!).distanceM!/LIGHT_YEAR_M-26000)<.001));
test('T_U2_MW_ANDROMEDA_DISTANCE_SYMMETRIC',()=>{
  const sol={galaxyId:mw.id,sector:zero},and={galaxyId:a.id,sector:d.address.sector};
  assert.equal(addressSeparationM(sol,[0,0,0],and,d.star.offsetM),addressSeparationM(and,d.star.offsetM,sol,[0,0,0]));
  assert.ok(addressSeparationM(sol,[0,0,0],and,d.star.offsetM)!/LIGHT_YEAR_M>2.4e6);
});
test('T_U2_TARGET_KEYS_STABLE',()=>{assert.equal(c.target('andromeda')!.key,'galaxy/andromeda');assert.equal(c.target('m31_smbh')!.key,'universe/andromeda/0,0,0/black-hole/m31_smbh');});
test('T_U2_ANDROMEDA_GLOBAL_EPOCH',()=>{const f=installed(),p=f.u.activeSystem.positionOf(rocky.id);f.m.returnToSolar();f.u.update([0,0,0],[0,0,0],10);f.m.testArrival(t);assert.equal(f.u.activeSystem.time,f.u.time);assert.notDeepEqual(f.u.activeSystem.positionOf(rocky.id),p);});
test('T_U2_ANDROMEDA_UNLOAD',()=>{const f=installed(),old=f.g.current!;f.m.returnToSolar();assert.equal(old.ready,false);assert.ok(!f.u.frames.ids.some(id=>id.includes('andromeda/')));});
test('T_U2_ANDROMEDA_REVISIT_SAME_SYSTEM',()=>{const f=installed();f.m.returnToSolar();f.m.testArrival(t);assert.deepEqual(f.m.current!.descriptor,d);});
test('T_U2_RETURN_TO_MILKY_WAY',()=>{const f=installed();f.m.returnToSolar();assert.equal(f.u.activeGalaxy,mw);assert.equal(f.g.current!.galaxy,mw);assert.equal(f.u.activeSystem,f.u.solarSystem);assert.equal(f.u.address.systemId,'sol');});
test('T_U2_BIGINT_IDENTITY',()=>{const huge=9007199254740993n,s=sectorIndex(huge,0n,0n);assert.notEqual(a.generateSector(s).seed,a.generateSector(sectorIndex(huge+1n,0n,0n)).seed);assert.equal(a.generateSector(s).sector.x,huge);assert.equal(observerGlobalPositionM({...d.address,sector:s},[0,0,0]),undefined);});
test('T_U2_NO_ASTRONOMICAL_OBJECT3D_POSITION',()=>{const f=installed();f.g.update([0,0,0],1e6);f.root.traverse(node=>assert.ok(node.position.length()<100_000));assert.ok(Math.hypot(...f.u.player.position)<1e14);});
test('T_U2_NO_MATH_RANDOM',()=>{const old=Math.random;Math.random=()=>{throw Error('unseeded');};try{assert.deepEqual(findAndromedaU2Fixture(new UniversalTargetCatalog()),d);}finally{Math.random=old;}});
test('U2 five round trips retain bounded providers, frames and galaxy meshes',async()=>{
  const f=fixture(),frames=f.u.frames.size,providers=f.u.providers.size;
  for(let cycle=0;cycle<5;cycle++){
    f.m.testArrival(t);const s=f.g.current!,p=s.starSectorProvider;
    // Exercise real CPU/GPU payload ownership rather than only empty presentation roots.
    const context={spatial:{address:f.u.address,altitudeM:1e6}} as any;
    const demand=p.plan(context)[0],payload=await p.load(demand),tile=p.activate(payload);assert.ok(p.stats.stars>0);
    f.m.returnToSolar();assert.equal(s.ready,false);assert.equal(p.stats.sectors,0);assert.equal(f.u.providers.size,providers);
    assert.equal(f.u.frames.size,frames);assert.equal(f.root.children.length,1);assert.equal(f.g.current!.externalGalaxies.length,1);assert.ok(tile);
  }
});
test('U2 QA transports retain one Solar snapshot across U1 and U2 transitions',()=>{
  const f=fixture(),pose=structuredClone(f.u.player),star='milky_way/17,-2,4/0',target=c.proceduralTarget(mw.id,sectorIndex(17n,-2n,4n),star,'star')!;
  f.m.testArrival(target);f.m.testArrival(t);f.m.testArrival(target);f.m.testArrival(t);f.m.returnToSolar();assert.deepEqual(f.u.player,pose);
});
test('T_U2_U1_MILKY_WAY_PROCEDURAL_REGRESSION',()=>{const f=installed();f.m.returnToSolar();const target=c.proceduralTarget(mw.id,sectorIndex(17n,-2n,4n),'milky_way/17,-2,4/0','star')!;f.m.testArrival(target);assert.equal(f.u.activeGalaxy,mw);assert.equal(f.u.activeSystem.bodies.length,34);});
test('T_U2_SOLAR_PROVIDER_RESTORE',()=>{const f=installed();f.m.returnToSolar();assert.equal(f.u.providers.get('galaxy/star-sectors'),f.g.current!.starSectorProvider);assert.equal(f.u.providers.get('galaxy/star-sectors/andromeda'),undefined);});
test('T_U2_SOLAR_VISUAL_RESTORE',()=>{const f=installed();f.m.returnToSolar();assert.equal(f.g.current!.centralBlackHole?.id,'blackhole/sgra');assert.equal(f.g.current!.externalGalaxies[0].id,'galaxy-macro/andromeda');});
test('T_U2_ANDROMEDA_GIANT_NO_LANDING',()=>assert.equal(surfaceForBody(giant),undefined));
for(const [label,body] of [['ROCKY',rocky],['MOON',moon]] as const)test('T_U2_ANDROMEDA_'+label+'_LANDING',()=>{
  const f=installed();
  // Real landability authority + body provider, also exercised with F/ENU/contact in the browser.
  const pos=f.u.activeSystem.positionOf(body.id)!;
  f.u.updateSystemPose([pos[0]+body.equatorialRadiusM+100,pos[1],pos[2]],[...f.u.activeSystem.stateOf(body.id)!.velocityMps],0);
  const before=f.u.playerSystemPositionM();f.u.handoffTo(body.id);
  assert.equal(f.u.player.frame,body.id+'/local-enu');assert.equal(f.u.address.bodyId,body.id);
  assert.ok(Math.hypot(...f.u.playerSystemPositionM().map((v,i)=>v-before[i]))<.001);
  assert.ok(bodyProfile(body).canLand&&surfaceForBody(body));const providers=createPlanetProviders(new Group(),f.u);assert.ok(providers.has(body.id));for(const p of providers.values())p.dispose();
});
test('T_U2_ANDROMEDA_FLOATING_ORIGIN',()=>{const f=installed(),address=f.u.address,p=f.u.playerSystemPositionM(),orbits=f.u.activeSystem.positionOf(rocky.id);f.u.floatingOrigin.reset({...f.u.player,position:p.map(v=>v+10000) as any});f.u.updateSystemPose(p,[0,0,0],0);assert.equal(f.u.address.galaxyId,address.galaxyId);assert.equal(f.u.address.sector,address.sector);assert.deepEqual(f.u.activeSystem.positionOf(rocky.id),orbits);});
test('U2 generated profiles keep D1 frozen and dynamic visuals match the descriptor',()=>{const f=installed(),visuals=new CelestialBodyVisualLayer(undefined,f.u.activeSystem.bodies);assert.equal(visuals.stats.total,d.system.bodies.length);assert.ok(d.system.bodies.every(b=>!bodyProfile(b).supportsVolumeDestruction));visuals.dispose();});

test('U2 discards cached star geometry and rejects stale galaxy preparations',async()=>{
  const f=installed(),session=f.g.current!,provider=session.starSectorProvider;
  const demand=provider.plan({spatial:{address:f.u.address,altitudeM:1e6}} as any)[0];
  const payload=await provider.load(demand);let disposals=0;(payload.geometry as any).geometry.addEventListener('dispose',()=>disposals++);
  f.u.scheduler.tileCache.set(payload);f.m.returnToSolar();assert.equal(disposals,1);assert.equal(f.u.scheduler.tileCache.has(payload.key),false);
  const prepared=f.g.prepare('andromeda');prepared.dispose();assert.throws(()=>prepared.install());assert.equal(f.u.providers.size,1);
});
test('U2 failed Solar restoration retains the Andromeda session for retry',()=>{
  let fail=false;const f=fixture(stage=>{if(fail&&stage==='activate'){fail=false;throw Error('Solar activation');}});
  f.m.testArrival(t);const old=f.g.current,pose=structuredClone(f.u.player);fail=true;
  assert.throws(()=>f.m.returnToSolar());assert.equal(f.u.activeGalaxy,a);assert.equal(f.g.current,old);assert.deepEqual(f.u.player,pose);
  f.m.returnToSolar();assert.equal(f.u.activeGalaxy,mw);
});
