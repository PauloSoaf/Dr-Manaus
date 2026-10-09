import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { generateStarSector } from '../src/world/celestial/StarSector.ts';
import { generateSystem, generatedStarRadiusM } from '../src/world/celestial/SystemGenerator.ts';
import { ProceduralSystemRuntime } from '../src/world/celestial/ProceduralSystemRuntime.ts';
import { bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { ProceduralSystemMaterializer, systemDomainLimitM, type SystemResources } from '../src/world/runtime/ProceduralSystemMaterializer.ts';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog.ts';
import { UniversalTargetResolver, activeSystemTargetBodyId } from '../src/world/travel/UniversalTargetResolver.ts';
import { sectorIndex } from '../src/world/spatial/UniverseAddress.ts';
import { ReferenceFrameGraph } from '../src/world/spatial/ReferenceFrameGraph.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry.ts';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory.ts';
import { celestialLockCandidates, cycleNavigationTarget } from '../src/world/travel/NavigationLock.ts';
import { CosmicCruiseController } from '../src/world/travel/CosmicFlight.ts';
import { resolveBodyDestination, selectBodyDestination, bodyExclusionEnvelopes } from '../src/world/travel/BodyNavigation.ts';
import { serializeUniversalTarget, deserializeUniversalTarget, createUniversalTarget } from '../src/world/travel/UniversalNavigationTarget.ts';

const catalog=new UniversalTargetCatalog(),sector=sectorIndex(17n,-2n,4n);
const stars=generateStarSector('milky_way',sector).stars;
const star=stars.find(s=>s.planetCount>0)!;
const descriptor=catalog.proceduralDescriptor('milky_way',sector,star.id)!;
const target=catalog.proceduralTarget('milky_way',sector,star.id,'star')!;
const rocky=descriptor.system.bodies.find(b=>bodyProfile(b).bodyClass==='rocky')!;
const giant=descriptor.system.bodies.find(b=>bodyProfile(b).bodyClass==='gas-giant')!;
const moon=descriptor.system.bodies.find(b=>bodyProfile(b).bodyClass==='rocky-moon')!;
const bodyTarget=(id=rocky.id)=>catalog.proceduralTarget('milky_way',sector,star.id,'body',id)!;
const noop:SystemResources={install:()=>{},activate:()=>{},dispose:()=>{}};
function fixture(checkpoint?:(stage:'profiles'|'frames'|'providers')=>void) {
  const u=new UniverseRuntime({epochS:123456});
  const m=new ProceduralSystemMaterializer(u,catalog,noop,()=>noop,checkpoint);
  return {u,m,r:new UniversalTargetResolver(catalog,u)};
}
const installed=()=>{const f=fixture();f.m.testArrival(target);return f;};

test('T_U1_GENERATED_STAR_SYSTEM_DESCRIPTOR_STABLE',()=>{
  for(let i=0;i<100;i++)assert.deepEqual(new UniversalTargetCatalog().proceduralDescriptor('milky_way',sector,star.id),descriptor);
  const next=catalog.proceduralDescriptor('milky_way',sector,stars[1].id)!;
  assert.notEqual(next.system.seed,descriptor.system.seed);assert.notDeepEqual(next.system.bodies,descriptor.system.bodies);
});
test('T_U1_GENERATED_PLANET_COUNT_MATCHES_STAR_DESCRIPTOR',()=>{
  for(const s of stars.slice(0,20)) {const p=catalog.proceduralDescriptor('milky_way',sector,s.id)!;
    assert.equal(p.system.bodies.filter(b=>b.parentId===s.id).length,s.planetCount);}
});
test('T_U1_ZERO_PLANET_STAR_SUPPORTED',()=>assert.equal(generateSystem(star.id,99n,{...star,planetCount:0}).bodies.length,1));
test('T_U1_STAR_RADIUS_FROM_GENERATED_STAR_PROPERTIES',()=>{
  assert.equal(descriptor.system.bodies[0].equatorialRadiusM,generatedStarRadiusM(star));
  assert.equal(descriptor.system.bodies[0].massKg,star.massSolar*1.989e30);
  assert.deepEqual(descriptor.system.bodies[0].stellar,{temperatureK:star.temperatureK,luminositySolar:star.luminositySolar,spectralClass:star.spectralClass});
});
test('T_U1_PROCEDURAL_BODY_PROFILE_DETERMINISTIC',()=>{
  for(let i=0;i<100;i++)assert.deepEqual(generateSystem(star.id,descriptor.system.seed,star).bodies.map(bodyProfile),descriptor.system.bodies.map(bodyProfile));
});
test('T_U1_ROCKY_PLANET_LANDABLE',()=>assert.ok(bodyProfile(rocky).canLand&&surfaceForBody(rocky)));
test('T_U1_GAS_GIANT_NOT_LANDABLE',()=>{assert.equal(bodyProfile(giant).canLand,false);assert.equal(surfaceForBody(giant),undefined);});
test('T_U1_SOLID_MOON_PROFILE',()=>assert.ok(bodyProfile(moon).hasSolidSurface&&bodyProfile(moon).canLand));
test('T_U1_SYSTEM_FRAME_ID_SOLAR',()=>assert.equal(new UniverseRuntime().activeSystem.systemFrameId,'solar-system/barycentric'));
test('T_U1_SYSTEM_FRAME_ID_PROCEDURAL',()=>assert.equal(new ProceduralSystemRuntime(descriptor.system).systemFrameId,'system/'+star.id));
test('T_U1_PROCEDURAL_FRAME_ORIGIN_UPDATES_WITH_ORBIT',()=>{
  const runtime=new ProceduralSystemRuntime(descriptor.system),g=new ReferenceFrameGraph();runtime.registerFrames(g);
  const before=[...g.get(rocky.frameId).originInParent];runtime.update(1e6);
  assert.notDeepEqual(g.get(rocky.frameId).originInParent,before);
  assert.deepEqual(g.get(rocky.frameId).originInParent,runtime.positionOf(rocky.id));
});
test('T_U1_FRAME_POSITION_EQUALS_RUNTIME_POSITION',()=>{
  const runtime=new ProceduralSystemRuntime(descriptor.system),g=new ReferenceFrameGraph();runtime.registerFrames(g);
  for(const epoch of [0,99,1e6,1e10]){runtime.update(epoch);for(const b of runtime.bodies)
    assert.deepEqual(g.convertPosition(b.frameId,runtime.systemFrameId,[0,0,0]),runtime.positionOf(b.id));}
});
test('T_U1_MATERIALIZER_PREPARES_BEFORE_INSTALL',()=>{
  const {u,m}=fixture(),old=u.activeSystem,ids=u.frames.ids,p=m.prepare(target);
  assert.equal(u.activeSystem,old);assert.deepEqual(u.frames.ids,ids);assert.equal(u.address.systemId,'sol');assert.equal(p.ready,true);
});
test('U1 disposed preparations and consumed sessions cannot be installed again',()=>{
  const {m}=fixture(),p=m.prepare(target);p.dispose();assert.equal(p.ready,false);assert.throws(()=>m.install(p));
  const active=m.testArrival(target);assert.throws(()=>m.install(active));assert.equal(m.testArrival(target),active);
});
test('U1 failed resource install keeps the original render view and frame tree',()=>{
  const u=new UniverseRuntime();u.updateSystemPose(u.playerSystemPositionM(),[0,0,0],0);
  const origin=u.renderSpace.currentOrigin,pose=structuredClone(u.player),view=structuredClone(u.frames.get('travel/view'));
  const m=new ProceduralSystemMaterializer(u,catalog,noop,()=>({install:()=>{throw Error('provider install failed');},activate:()=>{},dispose:()=>{}}));
  assert.throws(()=>m.testArrival(target));assert.equal(u.activeSystem,u.solarSystem);assert.deepEqual(u.player,pose);
  assert.deepEqual(u.renderSpace.currentOrigin,origin);assert.deepEqual(u.frames.get('travel/view'),view);
});
test('T_U1_FAILED_INSTALL_PRESERVES_OLD_SYSTEM',()=>{
  for(const stage of ['profiles','frames','providers'] as const){const {u,m}=fixture(s=>{if(s===stage)throw Error(stage);});
    const old=u.activeSystem,pose=structuredClone(u.player),a=u.address,ids=u.frames.ids;
    assert.throws(()=>m.testArrival(target));assert.equal(u.activeSystem,old);assert.equal(u.address,a);assert.deepEqual(u.player,pose);assert.deepEqual(u.frames.ids,ids);}
  const {u,m}=fixture(),old=u.activeSystem,pose=structuredClone(u.player),p=m.prepare(target),ids=u.frames.ids;
  const register=u.frames.register.bind(u.frames);let count=0;
  u.frames.register=frame=>{if(++count===3)throw Error('register failed');return register(frame);};
  assert.throws(()=>m.install(p));assert.equal(u.activeSystem,old);assert.deepEqual(u.player,pose);assert.deepEqual(u.frames.ids,ids);
});
test('U1 commit failure rolls back runtime/address/pose/providers after the commit begins',()=>{
  const {u,m}=fixture(),old=u.activeSystem,pose=structuredClone(u.player),address=u.address,ids=u.frames.ids;
  const install=u.installSystem.bind(u);
  u.installSystem=(...args)=>{install(...args);throw Error('commit failure');};
  assert.throws(()=>m.testArrival(target));assert.equal(u.activeSystem,old);assert.equal(u.address,address);
  assert.deepEqual(u.player,pose);assert.deepEqual(u.frames.ids,ids);
});
test('T_U1_ACTIVE_SYSTEM_SWITCH',()=>assert.ok(installed().u.activeSystem instanceof ProceduralSystemRuntime));
test('T_U1_PLAYER_ADDRESS_SWITCH',()=>assert.deepEqual(installed().u.address,descriptor.address));
test('T_U1_PLAYER_FRAME_SWITCH',()=>{const {u}=installed();assert.equal(u.player.frame,u.activeSystem.systemFrameId);assert.equal(u.renderSpace.currentOrigin.frame,'travel/view');});

for(const [name,b] of [['STAR',descriptor.system.bodies[0]],['PLANET',rocky],['MOON',moon]] as const)
  test('T_U1_DYNAMIC_'+name+'_VISUAL',()=>{
    const v=new CelestialBodyVisualLayer(undefined,[b]);
    v.update([{bodyId:b.id,profile:bodyProfile(b),stellar:b.stellar,visible:true,opacity:1,logicalDistanceM:b.equatorialRadiusM*100,
      physicalRadiusM:b.equatorialRadiusM,angularRadiusRad:.01,directionRender:[0,0,-1],proxyDistanceM:10000,proxyRadiusM:100}],new PerspectiveCamera(60,1,.1,1e5));
    assert.ok(v.root.children.some(c=>c.visible));assert.equal(v.stats.planets,b.parentId?1:0);v.dispose();
  });
test('T_U1_VISUAL_DISPOSE_ON_UNLOAD',()=>{const parent=new Group(),v=new CelestialBodyVisualLayer(parent,descriptor.system.bodies);assert.ok(v.stats.planets>0);v.dispose();assert.equal(parent.children.length,0);assert.equal(v.root.children.length,0);});
test('T_U1_DYNAMIC_PROVIDER_INSTALL',()=>{
  const {u}=installed(),providers=createPlanetProviders(new Group(),u);
  assert.ok(providers.has(rocky.id));assert.ok(providers.has(moon.id));assert.equal(providers.has(giant.id),false);
  for(const p of providers.values())assert.equal(p.stats.tiles,0);
  for(const p of providers.values())p.dispose();
});
test('T_U1_PROVIDER_DISPOSE_ON_UNLOAD',()=>{
  const u=new UniverseRuntime(),root=new Group();let providers:ReturnType<typeof createPlanetProviders>;
  const m=new ProceduralSystemMaterializer(u,catalog,noop,r=>{
    providers=createPlanetProviders(root,u,r.bodies,false);
    return {install:()=>{for(const p of providers.values())u.providers.register(p);},activate:()=>{},dispose:()=>{
      for(const p of providers.values()){u.scheduler.retireProvider(p.id,p.bodyDef.id);u.providers.unregister(p.id);p.dispose();}}};
  });
  m.testArrival(target);assert.ok(u.providers.size>0);m.returnToSolar();assert.equal(u.providers.size,0);assert.equal(root.children.length,0);
});
test('T_U1_ONLY_NEAR_SOLID_BODY_STREAMS_SURFACE',()=>{
  const {u}=installed(),providers=createPlanetProviders(new Group(),u),v=new CelestialBodyVisualLayer(undefined,descriptor.system.bodies),c=new CelestialPresentationController(v);
  const pos=u.activeSystem.positionOf(rocky.id)!;u.updateSystemPose([pos[0]+rocky.equatorialRadiusM+5000,pos[1],pos[2]],[0,0,0],0);
  c.prepare({universe:u,planetProviders:providers,fovRad:1,viewportHeightPx:900});assert.equal(c.physicalBodyId,rocky.id);
  for(const [id,p] of providers)if(id!==rocky.id)assert.equal(p.readiness().fallbackReady,false);
  for(const p of providers.values())p.dispose();v.dispose();
});
test('T_U1_GENERATED_STAR_PHASE_LIGHT_SOURCE',()=>{
  const {u}=installed(),v=new CelestialBodyVisualLayer(undefined,descriptor.system.bodies),c=new CelestialPresentationController(v);
  c.prepare({universe:u,fovRad:1,viewportHeightPx:900});const s=c.renderSamples.find(s=>s.bodyId===rocky.id)!;
  const expected=u.frames.convertDirection(u.activeSystem.systemFrameId,u.renderSpace.currentOrigin.frame,u.activeSystem.positionOf(rocky.id)!.map(v=>-v) as [number,number,number]);
  const length=Math.hypot(...expected);for(let i=0;i<3;i++)assert.ok(Math.abs(s.phaseLightDirection![i]-expected[i]/length)<1e-12);v.dispose();
});
for(const reverse of [false,true])test(reverse?'T_U1_SHIFT_TAB_CYCLES_GENERATED_BODIES':'T_U1_TAB_CYCLES_GENERATED_BODIES',()=>{
  const runtime=new ProceduralSystemRuntime(descriptor.system),pos=runtime.positionOf(rocky.id)!,observer:[number,number,number]=[pos[0]+1e8,pos[1],pos[2]];
  const candidates=celestialLockCandidates(runtime,observer,[-1,0,0],runtime.bodies.map(b=>({bodyId:b.id,proxyDistanceM:10000})));assert.ok(candidates.includes(rocky.id));
  const id=cycleNavigationTarget(candidates,undefined,reverse);assert.ok(runtime.bodies.some(b=>b.id===id));
});
test('T_U1_ACTIVE_SYSTEM_BODY_TARGET_AVAILABLE',()=>{const {u,r}=installed();assert.equal(activeSystemTargetBodyId(bodyTarget(),u),rocky.id);assert.equal(r.resolve(bodyTarget()).travelCapability,'intra-system');});
test('T_U1_REMOTE_SYSTEM_BODY_TARGET_NOT_INTRA_SYSTEM',()=>{const {u,r}=fixture();assert.equal(activeSystemTargetBodyId(bodyTarget(),u),undefined);assert.equal(r.resolve(bodyTarget()).travelCapability,'interstellar-future');});
test('T_U1_COSMIC_FLIGHT_GENERATED_SYSTEM',()=>{
  const {u}=installed(),flight=new CosmicCruiseController(),state={systemId:star.id,positionM:[...u.player.position] as [number,number,number],velocityMps:[0,0,0] as [number,number,number]};
  const next=flight.update(state,.05,new Vector3(1,0,0),{altitudeM:1e11,speedMps:0,requested:true,nearestColliderM:Infinity,bodyRadiusM:rocky.equatorialRadiusM,
    systemId:star.id,cameraForwardBary:new Vector3(1,0,0),inputBoost:false,inputBrake:false,exclusionEnvelopes:bodyExclusionEnvelopes(u.activeSystem)});
  assert.equal(next.systemId,star.id);assert.ok(next.velocityMps[0]>0);assert.ok(next.positionM.every(Number.isFinite));
});
test('T_U1_NO_CROSS_SYSTEM_COSMIC_FLIGHT',()=>{
  const {u}=installed();const remote=catalog.proceduralTarget('milky_way',sector,stars[1].id,'star')!;
  assert.equal(activeSystemTargetBodyId(remote,u),undefined);assert.equal(new UniversalTargetResolver(catalog,u).resolve(remote).travelCapability,'interstellar-future');
  assert.ok(Number.isFinite(systemDomainLimitM(u.activeSystem)));
});
for(const b of [rocky,moon])test(b===rocky?'T_U1_GENERATED_ROCKY_LANDING':'T_U1_GENERATED_MOON_LANDING',()=>{
  const {u}=installed(),c=u.activeSystem.positionOf(b.id)!;
  u.updateSystemPose([c[0]+b.equatorialRadiusM+100,c[1],c[2]],[...u.activeSystem.stateOf(b.id)!.velocityMps],0);
  const before=u.playerSystemPositionM();u.handoffTo(b.id);assert.equal(u.player.frame,b.id+'/local-enu');assert.equal(u.address.bodyId,b.id);
  assert.ok(Math.hypot(...u.playerSystemPositionM().map((v,i)=>v-before[i]))<.001);
});
test('T_U1_GENERATED_GAS_GIANT_NO_LANDING',()=>{const {u}=installed();u.handoffTo(giant.id);assert.equal(u.player.frame,u.activeSystem.systemFrameId);});
test('T_U1_FLOATING_ORIGIN_GENERATED_SYSTEM',()=>{const {u,r}=installed(),key=bodyTarget().key,p=[...u.activeSystem.positionOf(rocky.id)!];u.floatingOrigin.reset(u.player);u.updateSystemPose([...u.player.position],[0,0,0],0);assert.deepEqual(u.activeSystem.positionOf(rocky.id),p);assert.equal(r.resolve(bodyTarget()).target.key,key);});
test('T_U1_TARGET_SURVIVES_UNLOAD',()=>{const {m,r}=installed();m.returnToSolar();const t=r.resolve(bodyTarget());assert.equal(t.valid,true);assert.equal(t.materialized,false);assert.equal(t.travelCapability,'interstellar-future');});
test('T_U1_TARGET_REMATERIALIZES_SAME_KEY',()=>{const {m,r}=installed(),key=bodyTarget().key;m.returnToSolar();m.testArrival(target);assert.equal(r.resolve(bodyTarget()).materialized,true);assert.equal(r.resolve(bodyTarget()).target.key,key);});
test('T_U1_REVISIT_SAME_DESCRIPTOR',()=>{const {m}=installed(),b=m.current!.runtime.bodies;m.returnToSolar();m.testArrival(target);assert.deepEqual(m.current!.runtime.bodies,b);});
test('T_U1_GLOBAL_EPOCH_PRESERVED',()=>{const {u,m}=installed();m.returnToSolar();u.update([0,0,0],[0,0,0],.25);const t=u.time;m.testArrival(target);assert.equal(u.activeSystem.time,t);assert.equal(u.time,t);});
test('T_U1_NO_MATH_RANDOM',()=>{const original=Math.random;Math.random=()=>{throw Error('unseeded generation');};try{generateSystem(star.id,descriptor.system.seed,star);fixture().m.testArrival(target);}finally{Math.random=original;}});
test('T_U1_NO_RENDER_POSITION_AUTHORITY',()=>{const {u}=installed(),p=[...u.playerSystemPositionM()];u.renderSpace.setOrigin({...u.renderSpace.currentOrigin,position:[999,888,777]});assert.deepEqual(u.playerSystemPositionM(),p);assert.equal(catalog.resolve(bodyTarget())?.descriptor.objectId,rocky.id);});
test('T_U1_BIGINT_TARGET_IDENTITY_PRESERVED',()=>{
  const s=sectorIndex(9007199254740993n,-2n,4n),stars=generateStarSector('milky_way',s).stars;
  const t=catalog.proceduralTarget('milky_way',s,stars[0].id,'star')!;
  assert.equal(deserializeUniversalTarget(serializeUniversalTarget(t))?.key,t.key);
  assert.notDeepEqual(stars,generateStarSector('milky_way',sectorIndex(s.x+1n,-2n,4n)).stars);
});
test('T_U1_SOLAR_RETURN',()=>{const {u,m}=fixture(),ids=u.frames.ids,pose=structuredClone(u.player);m.testArrival(target);u.handoffTo(rocky.id);m.returnToSolar();assert.equal(u.activeSystem,u.solarSystem);assert.deepEqual(u.player,pose);assert.deepEqual(u.frames.ids,ids);});
test('T_U1_SOLAR_AUTOPILOT_REGRESSION',()=>{const {u,m}=installed();m.returnToSolar();const t=catalog.target('mars')!;assert.equal(activeSystemTargetBodyId(t,u),'mars');assert.ok(resolveBodyDestination(u.activeSystem,selectBodyDestination(u.activeSystem,'mars')));});
test('U1 rejects Andromeda materialization without changing Solar',()=>{const {u,m}=fixture(),t=createUniversalTarget({...target,galaxyId:'andromeda',address:{...target.address as any,galaxyId:'andromeda'}});assert.throws(()=>m.testArrival(t));assert.equal(u.address.systemId,'sol');});
