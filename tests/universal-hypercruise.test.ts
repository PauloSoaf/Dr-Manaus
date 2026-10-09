import { MANAUS_FRAME_ID } from '../src/world/spatial/ManausFrameAdapter.ts';
import { Game } from '../src/game/Game.ts';
import { Vector3 } from 'three/webgpu';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from '../src/world/travel/UniversalTargetCatalog.ts';
import { UniversalTravelController, type PreparedTravelDestination } from '../src/world/travel/UniversalTravelController.ts';
import { createTravelPlan, hypercruiseDuration, travelProfile } from '../src/world/travel/UniversalTravelPlan.ts';
import { GalaxyEntryResolver, andromedaEntryDescriptor } from '../src/world/travel/GalaxyEntryResolver.ts';
import { ProceduralSystemMaterializer, safeSystemArrivalM } from '../src/world/runtime/ProceduralSystemMaterializer.ts';
import { GalaxyMaterializer } from '../src/world/galaxy/GalaxyMaterializer.ts';
import { sectorIndex } from '../src/world/spatial/UniverseAddress.ts';
import { addressSeparationM } from '../src/world/galaxy/GalaxyCoordinates.ts';
import { LIGHT_YEAR_M } from '../src/world/spatial/units.ts';
import { intraSystemNavigationTarget } from '../src/world/travel/UniversalTargetResolver.ts';
import { HypercruisePresentation } from '../src/rendering/HypercruisePresentation.ts';
import { hypercruiseTelemetry } from '../src/ui/HypercruiseTelemetry.ts';
import { TravelDomain } from '../src/world/travel/TravelDomain.ts';

const catalog=new UniversalTargetCatalog(),entry=andromedaEntryDescriptor(catalog);
const safety={grounded:false,localPhysics:false,landing:false,collision:false};
const fixtures:Array<ReturnType<typeof fixture>>=[];
function fixture(prepare?:(p:any)=>PreparedTravelDestination|Promise<PreparedTravelDestination>) {
  const u=new UniverseRuntime(),root=new Group(),g=new GalaxyMaterializer(u,root);
  const initial=g.prepare('milky_way');initial.install();initial.activate();initial.complete?.();
  const noop={install:()=>{},activate:()=>{},dispose:()=>{}};
  const m=new ProceduralSystemMaterializer(u,catalog,noop,()=>noop,undefined,g);
  u.installSystem(u.solarSystem,SOLAR_TARGET_ADDRESS,safeSystemArrivalM(u.solarSystem));
  let calls=0;const arrived:any[]=[];
  const c=new UniversalTravelController(u,catalog,{prepare:p=>{calls++;return prepare?prepare(p):m.prepareTravel(p.resolvedDestination);},arrived:p=>arrived.push(p)});
  const f={u,g,m,c,root,arrived,get calls(){return calls;}};fixtures.push(f);return f;
}
test.afterEach(()=>{for(const f of fixtures.splice(0)){f.c.dispose();f.m.current?.dispose();f.g.current?.dispose();f.u.dispose();}});
const target=(q:string)=>catalog.target(q)!;
const mw=(x=17n)=>catalog.proceduralTarget('milky_way',sectorIndex(x,-2n,4n),`milky_way/${x},-2,4/0`,'system')!;
const start=(f:ReturnType<typeof fixture>,t=target('andromeda'))=>f.c.start(t,safety);
function until(f:ReturnType<typeof fixture>,predicate:()=>boolean,dt=1/60){for(let i=0;i<10000&&!predicate();i++)f.c.update(dt);assert.ok(predicate());}
const finish=(f:ReturnType<typeof fixture>,dt=1/60)=>until(f,()=>!f.c.active,dt);
const check=(id:string,fn:()=>void|Promise<void>)=>test(`T_U3_${id}`,fn);

check('REMOTE_TARGET_STARTS_HYPERCRUISE',()=>{const f=fixture();assert.equal(start(f,mw()),'started');assert.ok(f.c.active);});
check('SAME_SYSTEM_USES_COSMIC_FLIGHT',()=>{const f=fixture();assert.equal(start(f,target('earth')),'same-system');assert.ok(intraSystemNavigationTarget(target('earth'),f.u));});
check('INTERSTELLAR_DOMAIN',()=>{const f=fixture();start(f,mw());assert.equal(f.c.state!.plan.domain,'interstellar');});
check('INTERGALACTIC_DOMAIN',()=>{const f=fixture();start(f);assert.equal(f.c.state!.plan.domain,'intergalactic');});
for(const [id,q] of [['COSMOLOGICAL_REJECTED','observable-horizon'],['BLACK_HOLE_REJECTED','m31_smbh']])check(id,()=>{const f=fixture();assert.throws(()=>start(f,target(q)));assert.equal(f.c.active,false);});
check('GROUNDED_START_REJECTED',()=>{const f=fixture();assert.throws(()=>f.c.start(mw(),{...safety,grounded:true}));assert.equal(f.u.locationMode,'anchored');});
check('SAFE_DEPARTURE',()=>{for(const key of ['localPhysics','landing','collision','materializing']){const f=fixture();assert.throws(()=>f.c.start(mw(),{...safety,[key]:true}));assert.equal(f.c.active,false);}});
check('REAL_LOGICAL_DISTANCE',()=>{const f=fixture(),p=createTravelPlan(f.u,catalog,target('andromeda'),'x');assert.ok(p.logicalDistanceM/LIGHT_YEAR_M>2.4e6);assert.ok(p.logicalDistanceM/LIGHT_YEAR_M<2.6e6);});
check('NO_RENDER_DISTANCE_AUTHORITY',()=>{const f=fixture(),a=createTravelPlan(f.u,catalog,mw(),'x');f.u.renderSpace.setOrigin({...f.u.renderSpace.currentOrigin,position:[1e8,-2e8,3e8]});const b=createTravelPlan(f.u,catalog,mw(),'x');assert.equal(a.logicalDistanceM,b.logicalDistanceM);});
check('DURATION_NEAR_STAR_RANGE',()=>{const s=hypercruiseDuration(10*LIGHT_YEAR_M,'interstellar');assert.ok(s>=5&&s<=12);});
check('DURATION_ACROSS_MW_RANGE',()=>{const s=hypercruiseDuration(100000*LIGHT_YEAR_M,'interstellar');assert.ok(s>=10&&s<=25);});
check('DURATION_ANDROMEDA_RANGE',()=>{const s=hypercruiseDuration(2.5e6*LIGHT_YEAR_M,'intergalactic');assert.ok(s>=18&&s<=22);});
check('PROGRESS_MONOTONIC',()=>{const f=fixture();start(f);let last=0;for(let i=0;i<1200&&f.c.active;i++){f.c.update(1/30);const p=f.c.state?.progress??1;assert.ok(p>=last);last=p;}assert.equal(last,1);});
check('PROGRESS_30_60_120_FPS',()=>{const states=[30,60,120].map(fps=>{const f=fixture();start(f);for(let i=0;i<fps*7;i++)f.c.update(1/fps);return f.c.state!.progress;});assert.ok(Math.max(...states)-Math.min(...states)<1e-12);});
check('PHASE_ORDER',()=>{const f=fixture();start(f);const phases:string[]=[];while(f.c.active){const p=f.c.state!.phase;if(phases.at(-1)!==p)phases.push(p);f.c.update(1/60);}assert.deepEqual(phases,['spool','acceleration','cruise','deceleration','arrival']);});
check('EFFECTIVE_SPEED_FINITE',()=>{const f=fixture();start(f);for(let i=0;i<1000&&f.c.active;i++){f.c.update(1/30);assert.ok(Number.isFinite(f.c.state?.effectiveSpeedMps??0));}});
check('EFFECTIVE_SPEED_CAN_EXCEED_C',()=>{const f=fixture();start(f);f.c.update(10);assert.ok(f.c.state!.effectiveSpeedMps>299792458);});
check('EFFECTIVE_SPEED_NOT_LOCAL_VELOCITY',()=>{const f=fixture();start(f);const pose=structuredClone(f.u.player);f.c.update(10);assert.deepEqual(f.u.player,pose);assert.deepEqual(f.u.localVelocityMps,[0,0,0]);});
check('X_CANCEL_SPOOL',()=>{const f=fixture();start(f);f.c.update(.2);f.c.cancel();assert.equal(f.c.active,false);assert.equal(f.u.locationMode,'anchored');});
check('X_CANCEL_CRUISE',()=>{const f=fixture();start(f);f.c.update(9);const v=f.c.state!.effectiveSpeedMps;f.c.cancel();f.c.update(.2);assert.ok(f.c.state!.effectiveSpeedMps<v);f.c.update(.6);assert.equal(f.c.state!.phase,'coasting');});
check('CANCEL_DOES_NOT_TELEPORT',()=>{const f=fixture();start(f);f.c.update(9);const p=f.c.state!.progress,pose=structuredClone(f.u.player);f.c.cancel();f.c.update(1);assert.ok(f.c.state!.progress>=p&&f.c.state!.progress<p+.06);assert.deepEqual(f.u.player,pose);assert.equal(f.u.activeGalaxy.id,'milky_way');});
check('COAST_STATE',()=>{const f=fixture();start(f);f.c.update(9);f.c.cancel();f.c.update(1);const p=f.c.state!.progress;f.c.update(100);assert.equal(f.c.state!.progress,p);assert.equal(f.u.locationMode,'transit');});
check('RESUME',()=>{const f=fixture();start(f);f.c.update(9);f.c.cancel();f.c.update(1);const p=f.c.state!.progress;assert.equal(start(f),'resumed');assert.equal(f.c.state!.progress,p);finish(f);assert.equal(f.u.activeGalaxy.id,'andromeda');});
check('DESTINATION_PREFETCH',()=>{const f=fixture();start(f);f.c.update(4);assert.equal(f.calls,0);until(f,()=>f.c.state!.prepared);assert.equal(f.calls,1);assert.equal(f.u.activeGalaxy.id,'milky_way');finish(f);assert.equal(f.calls,1);});
check('ARRIVAL_HOLD',async()=>{let resolve!:(p:PreparedTravelDestination)=>void;const f=fixture(p=>new Promise(r=>{resolve=r;}));start(f);f.c.update(100);assert.equal(f.c.state!.phase,'arrival-hold');assert.equal(f.c.state!.progress,.985);assert.equal(f.u.activeGalaxy.id,'milky_way');resolve(f.m.prepareTravel(f.c.state!.plan.resolvedDestination));await Promise.resolve();finish(f);assert.equal(f.u.activeGalaxy.id,'andromeda');});
check('PREFETCH_FAILURE_NO_PARTIAL_COMMIT',()=>{const f=fixture(()=>{throw Error('disk');});const ids=f.u.frames.ids;start(f);f.c.update(100);assert.match(f.c.state!.preparationError!,/disk/);assert.equal(f.u.activeGalaxy.id,'milky_way');assert.deepEqual(f.u.frames.ids,ids);});
check('ATOMIC_ARRIVAL',()=>{const f=fixture();start(f);until(f,()=>f.c.state!.prepared);assert.equal(f.g.current!.galaxy.id,'milky_way');finish(f);assert.equal(f.g.current!.galaxy.id,'andromeda');assert.equal(f.u.address.galaxyId,f.u.activeGalaxy.id);assert.equal(f.u.player.frame,f.u.activeSystem.systemFrameId);});
check('ACTIVE_GALAXY_UNCHANGED_MID_TRANSIT',()=>{const f=fixture(),old=f.u.activeGalaxy;start(f);f.c.update(15);assert.equal(f.u.activeGalaxy,old);});
check('ADDRESS_NOT_INCREMENTALLY_MUTATED',()=>{const f=fixture(),a=f.u.address;start(f);for(let i=0;i<200;i++){f.c.update(1/30);assert.equal(f.u.address,a);}});
check('LOCATION_MODE_TRANSIT',()=>{const f=fixture();start(f);assert.equal(f.u.location.mode,'transit');assert.equal(f.u.location.systemPositionM,undefined);assert.equal(f.u.location.transit,f.c.state);});
check('MAP_TRANSIT_PROGRESS',()=>{const f=fixture();start(f);f.c.update(9);const html=hypercruiseTelemetry(f.u.location.transit!);assert.match(html,/TRANSIT/);assert.match(html,/progress/);assert.match(html,/DESTINO DA VIAGEM/);});
for(const id of ['SOURCE_VISUAL_RETIRE','NO_SOURCE_PLANET_FOLLOWING','DESTINATION_NOT_VISIBLE_TOO_EARLY'])check(id,()=>{const f=fixture();start(f);f.c.update(8);assert.equal(f.m.current,undefined);assert.equal(f.g.current!.galaxy.id,'milky_way');assert.equal(f.u.location.surface,undefined);assert.equal(f.u.location.systemPositionM,undefined);});
check('ANDROMEDA_PRODUCTION_TRAVEL',()=>{const f=fixture();start(f);finish(f);assert.equal(f.m.qaArrivalMode,false);});
check('ANDROMEDA_NO_TEST_ARRIVAL',()=>{const f=fixture();f.m.testArrival=()=>{throw Error('QA called');};start(f);finish(f);assert.equal(f.u.activeGalaxy.id,'andromeda');});
check('ANDROMEDA_TARGET_DURATION',()=>{const f=fixture();start(f);assert.ok(f.c.state!.plan.durationS>=18&&f.c.state!.plan.durationS<=22);});
check('ANDROMEDA_FINAL_ACTIVE_GALAXY',()=>{const f=fixture();start(f);finish(f);assert.equal(f.u.activeGalaxy.id,'andromeda');});
check('ANDROMEDA_FINAL_SYSTEM',()=>{const f=fixture();start(f);finish(f);assert.equal(f.u.address.systemId,entry.star.id);});
check('MILKY_WAY_PRODUCTION_RETURN',()=>{const f=fixture();start(f);finish(f);start(f,target('milky_way'));finish(f);assert.equal(f.u.activeGalaxy.id,'milky_way');assert.equal(f.u.activeSystem,f.u.solarSystem);});
check('RETURN_SAFE_SOLAR_SPACE',()=>{const f=fixture();start(f);finish(f);start(f,target('milky_way'));finish(f);assert.equal(f.u.player.frame,f.u.solarSystem.systemFrameId);assert.ok(Math.hypot(...f.u.player.position)>1e12);assert.deepEqual(f.u.localVelocityMps,[0,0,0]);});
check('EARTH_REMOTE_MULTILEG',()=>{const f=fixture();start(f);finish(f);start(f,target('earth'));assert.equal(f.c.state!.plan.finalBodyTarget!.bodyId,'earth');finish(f);assert.ok(intraSystemNavigationTarget(f.arrived.at(-1).finalBodyTarget,f.u));});
check('BODY_TARGET_FINAL_COSMIC_FLIGHT',()=>{const f=fixture();const d=catalog.proceduralDescriptor('milky_way',mw().address!.sector,mw().systemId!)!,b=d.system.bodies.find(b=>b.parentId)!;const t=catalog.proceduralTarget('milky_way',d.address.sector,d.star.id,'body',b.id)!;start(f,t);finish(f);assert.equal(f.arrived[0].finalBodyTarget.key,t.key);assert.ok(intraSystemNavigationTarget(t,f.u));});
check('MW_PROCEDURAL_INTERSTELLAR',()=>{const f=fixture();start(f,mw());finish(f);assert.equal(f.u.address.systemId,mw().systemId);});
check('PROCEDURAL_TO_SOL',()=>{const f=fixture();start(f,mw());finish(f);start(f,target('sol'));finish(f);assert.equal(f.u.address.systemId,'sol');});
check('PROCEDURAL_A_TO_B',()=>{const f=fixture();start(f,mw());finish(f);start(f,mw(18n));finish(f);assert.equal(f.u.address.systemId,mw(18n).systemId);});
check('ANDROMEDA_INTERSTELLAR',()=>{const f=fixture();start(f);finish(f);const t=catalog.proceduralTarget('andromeda',entry.address.sector,'andromeda/200,0,0/0','system')!;start(f,t);assert.equal(f.c.state!.plan.domain,'interstellar');finish(f);assert.equal(f.u.address.systemId,t.systemId);});
check('NO_CROSS_SYSTEM_LOCAL_WARP',()=>{const f=fixture();assert.equal(intraSystemNavigationTarget(mw(),f.u),undefined);start(f,mw());assert.ok(f.c.state);});
function controls(f:ReturnType<typeof fixture>){
  const game=Object.create(Game.prototype) as any,edges=new Set<string>(),consumed:string[]=[];
  const d=new TravelDomain();d.enterSystem({systemId:f.u.address.systemId!,positionM:f.u.player.position,velocityMps:[0,0,0]});
  Object.assign(game,{universalTravelController:f.c,universe:f.u,travelDomain:d,curvedColliders:[],colliders:[],
    player:{position:new Vector3(),velocity:new Vector3(),state:'Flight',interplanetaryMode:true},warpStep:0,
    input:{held:()=>false,consume:(key:string)=>{consumed.push(key);return edges.delete(key);}},
    landingIntent:{active:false,cancel:()=>{}},hud:{notify:()=>{}},navigation:{current:undefined},
    landingMotion:()=>({radialSpeedMps:0,tangentialSpeedMps:0}),surfaceClearanceM:()=>1e12,
    currentGameplaySpeedMps:()=>0,surfaceReadyForLanding:()=>false,maintainLandingIntent:()=>{},
    requestLanding:()=>{throw Error('Landing must be blocked');}});
  return {game,edges,consumed,d};
}
check('B_WARP_DISABLED_IN_HYPERCRUISE',()=>{const f=fixture(),g=controls(f);start(f);g.edges.add('KeyB');g.edges.add('KeyF');g.game.updateTravelDomain(1/60);assert.equal(g.game.warpStep,0);assert.ok(g.consumed.includes('KeyB')&&g.consumed.includes('KeyF'));assert.equal(g.edges.size,0);});
check('B_WARP_RESTORED_AFTER_ARRIVAL',()=>{const f=fixture();start(f,mw());finish(f);const g=controls(f);g.edges.add('KeyB');g.game.updateTravelDomain(1/60);assert.equal(g.game.warpStep,1);});
check('NO_LOCAL_PHYSICS_IN_TRANSIT',()=>{const f=fixture();start(f);f.u.streamingEnabled=true;f.u.scheduler.update=()=>{throw Error('Streaming in transit');};assert.doesNotThrow(()=>f.u.updateStreaming(1/60));const g=controls(f);assert.equal(g.game.manausSimulationActive,false);const pose=structuredClone(f.u.player);f.c.update(8);assert.deepEqual(f.u.player,pose);});
check('LOCAL_PHYSICS_RESTORED',()=>{const f=fixture();start(f);finish(f);start(f,target('sol'));finish(f);const g=controls(f);f.u.setPlayerPose(MANAUS_FRAME_ID,[38,2.2,12]);g.d.reset();assert.equal(g.game.manausSimulationActive,true);});
check('GLOBAL_EPOCH_CONTINUES',()=>{const f=fixture(),time=f.u.time;start(f);f.c.update(20);assert.equal(f.u.time,time+20);assert.equal(f.u.solarSystem.time,f.u.time);});
check('RENDER_COORDS_BOUNDED',()=>{const f=fixture(),root=new Group(),v=new HypercruisePresentation(root),camera=new PerspectiveCamera();start(f);for(let i=0;i<200;i++){f.c.update(.05);v.update(f.c.state,camera,.05);root.traverse(n=>assert.ok(n.position.length()<50000));}v.dispose();});
check('BIGINT_SECTOR_DIFFERENCE',()=>{const x=9007199254740993n,a={galaxyId:'milky_way',sector:sectorIndex(x,0n,0n)},b={galaxyId:'milky_way',sector:sectorIndex(x+1n,0n,0n)};assert.equal(addressSeparationM(a,[0,0,0],b,[0,0,0]),100*LIGHT_YEAR_M);});
check('NO_MATH_RANDOM',()=>{const f=fixture(()=>({ready:true,commit:()=>{},dispose:()=>{}})),old=Math.random;Math.random=()=>{throw Error('random');};try{start(f);finish(f);}finally{Math.random=old;}});
check('REPEAT_TRAVEL_NO_LEAK',()=>{const f=fixture(),frames=f.u.frames.size,providers=f.u.providers.size;for(let i=0;i<5;i++){for(const t of [mw(),target('sol'),target('andromeda'),target('sol')]){start(f,t);finish(f);}assert.equal(f.u.frames.size,frames);assert.equal(f.u.providers.size,providers);assert.equal(f.root.children.length,1);}});
test('U3 coasting can return to the source without a position jump',()=>{const f=fixture();start(f);f.c.update(9);f.c.cancel();f.c.update(1);const p=f.c.state!.progress;start(f,target('sol'));assert.equal(f.c.state!.progress,1-p);assert.equal(f.u.locationMode,'transit');finish(f);assert.equal(f.u.address.systemId,'sol');});
test('U3 target snapshot is immutable and P cannot restart an active plan',()=>{const f=fixture();start(f);f.c.update(7);const plan=f.c.state!.plan,p=f.c.state!.progress;assert.ok(Object.isFrozen(plan));assert.ok(Object.isFrozen(plan.requestedTarget));assert.equal(start(f,mw()),'already-active');assert.equal(f.c.state!.plan,plan);assert.equal(f.c.state!.progress,p);});
test('U3 setAddress rejects inconsistent runtime ownership',()=>{const f=fixture();assert.throws(()=>f.u.setAddress({...f.u.address,galaxyId:'andromeda'}));assert.throws(()=>f.u.setAddress({...f.u.address,systemId:'other'}));assert.equal(f.u.activeGalaxy.id,f.u.address.galaxyId);});
test('U3 entry resolution is deterministic and does not target the black hole',()=>{const r=new GalaxyEntryResolver(catalog);assert.equal(r.resolve(target('andromeda')).systemId,entry.star.id);assert.equal(r.resolve(target('milky_way')).systemId,'sol');});
test('U3 analytical profile has continuous speed and acceleration at phase boundaries',()=>{for(const q of [.2,.8]){const a=travelProfile(q-1e-7),b=travelProfile(q+1e-7);assert.ok(Math.abs(a.progress-b.progress)<1e-6);assert.ok(Math.abs(a.derivative-b.derivative)<1e-10);}});

test('U3 cancellation during final synchronization never moves progress backwards',()=>{const f=fixture();start(f);until(f,()=>f.c.state!.phase==='arrival');f.c.update(.25);const p=f.c.state!.progress;f.c.cancel();f.c.update(1);assert.ok(f.c.state!.progress>=p&&f.c.state!.progress<1);f.c.resume();finish(f);assert.equal(f.u.activeGalaxy.id,'andromeda');});
test('U3 stale asynchronous preparations are discarded after returning from coast',async()=>{let resolve!:(p:PreparedTravelDestination)=>void;let discarded=0;const f=fixture(()=>new Promise(r=>{resolve=r;}));start(f);f.c.update(16);f.c.cancel();f.c.update(1);start(f,target('sol'));resolve({ready:true,commit:()=>{throw Error('stale commit');},dispose:()=>{discarded++;}});await Promise.resolve();assert.equal(discarded,1);assert.equal(f.u.activeGalaxy.id,'milky_way');});
test('U3 destination failure can be retried with P without changing source address',()=>{let failing=true;const f=fixture(p=>{if(failing)throw Error('temporary');return f.m.prepareTravel(p.resolvedDestination);});start(f);f.c.update(100);assert.equal(f.c.state!.phase,'arrival-hold');failing=false;assert.equal(start(f),'resumed');finish(f);assert.equal(f.u.activeGalaxy.id,'andromeda');});
test('U3 rejects a local ENU pose even if a caller supplies permissive departure flags',()=>{const f=fixture();f.u.setPlayerPose(MANAUS_FRAME_ID,[38,2.2,12]);assert.throws(()=>start(f));assert.equal(f.u.locationMode,'anchored');});
test('U3 commit activation failure rolls back resources and allows a production retry',()=>{
  const f=fixture(),u=f.u,original=u.installSystem.bind(u),frames=u.frames.ids,source=u.activeSystem;
  let armed=true;u.installSystem=(...args)=>{original(...args);if(armed)throw Error('post-commit failure');};
  start(f);until(f,()=>f.c.state!.phase==='arrival');f.c.update(.25);
  const progressBeforeFailure=f.c.state!.progress;
  until(f,()=>!!f.c.state!.preparationError);
  assert.ok(f.c.state!.progress>=progressBeforeFailure,'Failed activation must preserve the transit position');
  assert.equal(u.activeSystem,source);assert.equal(u.activeGalaxy.id,'milky_way');assert.deepEqual(u.frames.ids,frames);
  assert.equal(f.g.current!.galaxy.id,'milky_way');assert.equal(f.root.children.length,1);
  armed=false;start(f);finish(f);assert.equal(u.activeGalaxy.id,'andromeda');
});
test('U3 resuming while destination preparation is pending does not allocate a second session',async()=>{
  let resolve!:(p:PreparedTravelDestination)=>void;
  const f=fixture(()=>new Promise(r=>{resolve=r;}));start(f);f.c.update(16);assert.equal(f.calls,1);
  f.c.cancel();f.c.update(1);f.c.resume();f.c.update(2);assert.equal(f.calls,1);
  resolve(f.m.prepareTravel(f.c.state!.plan.resolvedDestination));await Promise.resolve();finish(f);assert.equal(f.calls,1);
});
