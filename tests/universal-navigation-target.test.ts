import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { Game } from '../src/game/Game.ts';
import { NavigationTargetState, cycleNavigationTarget } from '../src/world/travel/NavigationLock.ts';
import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from '../src/world/travel/UniversalTargetCatalog.ts';
import { UniversalTargetResolver, solarTargetBodyId, solarNavigationTarget } from '../src/world/travel/UniversalTargetResolver.ts';
import { createUniversalTarget, universalTargetKey, serializeUniversalTarget, deserializeUniversalTarget } from '../src/world/travel/UniversalNavigationTarget.ts';
import { sectorIndex, addressKey } from '../src/world/spatial/UniverseAddress.ts';
import { LIGHT_YEAR_M, PARSEC_M, AU_M } from '../src/world/spatial/units.ts';
import { createRenderOrigin } from '../src/world/spatial/RenderOrigin.ts';
import { generateStarSector } from '../src/world/celestial/StarSector.ts';
import { ProceduralSystemRuntime } from '../src/world/celestial/ProceduralSystemRuntime.ts';
import { SolarSystem } from '../src/world/celestial/SolarSystem.ts';
import { StarSectorProvider } from '../src/world/providers/StarSectorProvider.ts';
import { UniversalMapPanel } from '../src/ui/map/UniversalMapPanel.ts';
import { CosmicCruiseController } from '../src/world/travel/CosmicFlight.ts';
import { formatDistance } from '../src/ui/format.ts';
import { CatalogMapMarkers } from '../src/ui/map/MapRenderers.ts';
import { OBSERVABLE_HORIZON_MPC } from '../src/world/celestial/CosmicAnchorCatalog.ts';

const catalog=new UniversalTargetCatalog();
const target=(id:string)=>catalog.target(id,'map',42)!;
function fixture(){
  const universe=new UniverseRuntime(),resolver=new UniversalTargetResolver(catalog,universe),state=new NavigationTargetState();
  const game=Object.create(Game.prototype) as any;
  Object.assign(game,{universe,navigation:state,travelDomain:{state:undefined},interplanetary:new CosmicCruiseController(),hud:{notify:()=>{}}});
  const panel=()=>{
    const p=Object.create(UniversalMapPanel.prototype) as any;
    Object.assign(p,{onSelectTarget:(id:string)=>game.selectNavigationTarget(id,'map'),bodies:[],
      renderers:{system:{setBodies:()=>{}}},updateCard:()=>{},drawMap:()=>{}});
    return p;
  };
  return {universe,resolver,state,game,panel};
}
const huge=(x:bigint)=>createUniversalTarget({kind:'body',displayName:'Remote',objectId:'planet-3',bodyId:'planet-3',galaxyId:'milky_way',systemId:'remote',
  address:{galaxyId:'milky_way',sector:sectorIndex(x,-2n,4n),systemId:'remote',bodyId:'planet-3'}});
const sector=sectorIndex(17n,-2n,4n);
const star=generateStarSector('milky_way',sector).stars[0];
assert.ok(star,'real seeded sector must contain stars');
const proc=(kind:'star'|'system'|'body',c=catalog)=>{
  const descriptor=c.proceduralDescriptor('milky_way',sector,star.id)!;
  const body=descriptor.system.bodies.find(b=>b.parentId===star.id)!;
  return c.proceduralTarget('milky_way',sector,star.id,kind,body.id)!;
};
test('T_U0_TARGET_KEY_SOLAR_BODY_STABLE',()=>{
  assert.equal(target('mars').key,'universe/milky_way/0,0,0/system/sol/body/mars');
  assert.equal(universalTargetKey({...target('mars'),displayName:'Translated'}),target('mars').key);
});
test('T_U0_TARGET_KEY_BIGINT_SAFE',()=>assert.ok(huge(9007199254740993n).key.includes('9007199254740993,-2,4')));
test('T_U0_BIGINT_NEIGHBOR_SECTORS_DISTINCT',()=>assert.notEqual(huge(9007199254740993n).key,huge(9007199254740994n).key));
for(const [label,id] of [['MOON','moon'],['MARS','mars'],['SUN','sun']])test(`T_U0_${label}_TARGET`,()=>{
  const t=target(id);assert.equal(t.kind,'body');assert.equal(t.bodyId,id);assert.equal(t.systemId,'sol');
});
test('T_U0_SOLAR_TAB_ADAPTER',()=>{
  const f=fixture(),id=cycleNavigationTarget(['moon','mars']);f.game.selectNavigationTarget(id,'reticle');
  assert.equal(f.state.current?.bodyId,'moon');assert.equal(f.state.current?.source,'reticle');assert.equal(f.game.navigationTarget.bodyId,'moon');
});
test('T_U0_SOLAR_SHIFT_TAB_ADAPTER',()=>{
  const f=fixture();f.game.selectNavigationTarget(cycleNavigationTarget(['moon','mars'],'moon',true),'reticle');
  assert.equal(f.state.current?.bodyId,'mars');assert.equal(f.state.current?.kind,'body');
});
test('T_U0_SOLAR_MAP_TARGET',()=>{
  const f=fixture();f.panel().selectTarget('mars');assert.equal(f.state.current?.key,target('mars').key);assert.equal(f.game.navigationLock.source,'map');
});
test('T_U0_SOLAR_AUTOPILOT_TARGET_ADAPTER',()=>{
  const f=fixture();f.game.selectNavigationTarget('mars');assert.equal(solarNavigationTarget(f.state.current,f.universe)?.bodyId,'mars');
  f.game.interplanetary.autopilot.engage();f.game.selectNavigationTarget('andromeda');
  assert.equal(f.game.interplanetary.autopilot.active,false);assert.equal(f.game.navigationTarget,undefined);assert.equal(f.game.resolveNavigationTarget(),undefined);
});
test('T_U0_ANDROMEDA_TARGET',()=>assert.equal(target('andromeda').key,'galaxy/andromeda'));
test('T_U0_ANDROMEDA_KIND_GALAXY',()=>{assert.equal(target('andromeda').kind,'galaxy');assert.equal(target('andromeda').bodyId,undefined);});
test('T_U0_ANDROMEDA_DISTANCE_APPROX_2_5_MLY',()=>{
  const r=fixture().resolver.resolve(target('andromeda'));assert.ok(Math.abs(r.distanceM!/LIGHT_YEAR_M-2.5e6)<2000);
  assert.equal(formatDistance(r.distanceM!),'2.50 Mly');assert.equal(r.travelCapability,'intergalactic-future');assert.equal(r.materialized,false);
});
test('T_U0_MILKY_WAY_TARGET',()=>{assert.equal(target('milky_way').kind,'galaxy');assert.equal(target('milky_way').key,'galaxy/milky_way');});
test('T_U0_SGRA_TARGET',()=>{assert.equal(target('sgra').objectId,'sgra');assert.equal(target('sgra').galaxyId,'milky_way');assert.equal(target('sgra').bodyId,undefined);});
test('T_U0_SGRA_KIND_BLACK_HOLE',()=>assert.equal(target('sgra').kind,'black-hole'));
test('T_U0_M31_SMBH_TARGET',()=>assert.equal(target('m31_smbh').kind,'black-hole'));
test('T_U0_M31_GALAXY_IS_ANDROMEDA',()=>{assert.equal(target('m31_smbh').galaxyId,'andromeda');assert.equal(fixture().resolver.resolve(target('m31_smbh')).domain,'intergalactic');});
test('T_U0_BLACK_HOLE_TARGETS_DISTINCT',()=>assert.notEqual(target('sgra').key,target('m31_smbh').key));
for(const kind of ['star','system','body'] as const)test(`T_U0_PROCEDURAL_${kind==='body'?'PLANET':kind.toUpperCase()}_TARGET_DETERMINISTIC`,()=>{
  const t=proc(kind), regenerated=proc(kind,new UniversalTargetCatalog());assert.equal(t.key,regenerated.key);
  const r=fixture().resolver.resolve(regenerated);assert.equal(r.valid,true);assert.equal(r.materialized,false);assert.ok(r.distanceM!>0);
});
test('T_U0_TARGET_NOT_CLEARED_WHEN_NOT_ACTIVE_SYSTEM',()=>{
  const f=fixture();f.state.select(target('andromeda'));f.state.validate(f.resolver);assert.equal(f.state.current?.key,target('andromeda').key);
});
test('T_U0_TARGET_SURVIVES_ACTIVE_SYSTEM_CHANGE',()=>{
  const f=fixture();f.state.select(target('moon'));const p=catalog.proceduralDescriptor('milky_way',sector,star.id)!;
  f.universe.activeSystem=new ProceduralSystemRuntime(p.system);f.universe.address=p.address;
  f.state.validate(f.resolver);assert.equal(f.state.current?.bodyId,'moon');assert.equal(f.resolver.resolve(f.state.current!).materialized,false);
  assert.equal(solarNavigationTarget(f.state.current,f.universe),undefined);
});
test('T_U0_TARGET_SURVIVES_FLOATING_ORIGIN_REBASE',()=>{
  const f=fixture();for(const id of ['mars','andromeda']){
    f.state.select(target(id));const before=serializeUniversalTarget(f.state.current!),r=f.resolver.resolve(f.state.current!);
    f.universe.renderSpace.setOrigin(createRenderOrigin('solar-system/barycentric',[1e12,-1e12,2e12]));
    f.state.validate(f.resolver);assert.equal(serializeUniversalTarget(f.state.current!),before);assert.equal(f.resolver.resolve(f.state.current!).distanceM,r.distanceM);
  }
});
test('T_U0_MAP_CLOSE_REOPEN_TARGET_PERSISTS',()=>{
  const f=fixture();let p=f.panel();p.selectTarget('andromeda');const before=f.state.current;
  p=undefined;p=f.panel();assert.equal(f.state.current,before);assert.equal(p.bodies.length,0);
});
test('T_U0_MAP_SELECTION_DOES_NOT_MOVE_PLAYER',()=>{
  const f=fixture(),before=f.universe.playerSystemPositionM();for(const id of ['mars','sgra','andromeda','m31_smbh','virgo_cluster'])f.panel().selectTarget(id);
  assert.deepEqual(f.universe.playerSystemPositionM(),before);assert.equal(f.universe.activeSystem,f.universe.solarSystem);
});
test('T_U0_MAP_SELECTION_DOES_NOT_CHANGE_ADDRESS',()=>{
  const f=fixture(),before=addressKey(f.universe.address),reference=f.universe.address;f.panel().selectTarget('andromeda');
  assert.equal(addressKey(f.universe.address),before);assert.equal(f.universe.address,reference);
});
test('T_U0_PROVIDER_UNLOAD_DOES_NOT_CLEAR_TARGET',()=>{
  const f=fixture(),provider=new StarSectorProvider(new Group());f.state.select(proc('star'));
  provider.dispose();f.state.validate(f.resolver);assert.equal(f.state.current?.key,proc('star').key);
});
test('T_U0_RENDER_OBJECT_NOT_TARGET_AUTHORITY',()=>{
  const f=fixture(),mesh=new Group();f.state.select(target('mars'));mesh.position.set(1e20,-1e20,9e20);mesh.clear();
  assert.equal(f.state.current?.key,target('mars').key);assert.ok(!('uuid' in f.state.current!));assert.ok(!('position' in f.state.current!));
  assert.ok(Object.isFrozen(f.state.current));assert.throws(()=>createUniversalTarget(mesh as any));
});
test('T_U0_TARGET_SERIALIZATION_BIGINT_SAFE',()=>{
  const t=huge(9007199254740993n),json=serializeUniversalTarget(t),roundtrip=deserializeUniversalTarget(json);
  assert.ok(json.includes('9007199254740993'));assert.deepEqual(roundtrip,t);assert.equal(roundtrip.key,t.key);
  assert.throws(()=>deserializeUniversalTarget(json.replace('9007199254740993','9007199254740994')));
});
test('T_U0_INVALID_DESCRIPTOR_REJECTED',()=>{
  const f=fixture(),bad=createUniversalTarget({...target('mars'),objectId:'no-planet',bodyId:'no-planet',address:{...SOLAR_TARGET_ADDRESS,bodyId:'no-planet'}});
  assert.equal(f.resolver.resolve(bad).valid,false);f.state.select(bad);f.state.validate(f.resolver);assert.equal(f.state.current,undefined);
  assert.throws(()=>createUniversalTarget({...target('mars'),address:{...SOLAR_TARGET_ADDRESS,bodyId:'moon'}}));
  assert.equal(f.game.selectNavigationTarget('no-planet'),undefined);
});
test('T_U0_SOLAR_LABEL_SELECTED_BODY_COMPAT',()=>{
  const f=fixture();assert.equal(solarTargetBodyId(target('mars'),f.universe),'mars');
  for(const id of ['sgra','andromeda','m31_smbh','milky_way'])assert.equal(solarTargetBodyId(target(id),f.universe),undefined);
  f.game.selectNavigationTarget('andromeda');assert.ok(f.game.hudBodies().every((b:any)=>!b.selected));
});
test('Universal distance formatter spans astronomical and cosmological units',()=>{
  for(const [m,unit] of [[20,'m'],[5000,'km'],[AU_M,'UA'],[LIGHT_YEAR_M,'ly'],[5e3*LIGHT_YEAR_M,'kly'],[2.5e6*LIGHT_YEAR_M,'Mly'],[20e6*PARSEC_M,'Mpc'],[2e9*PARSEC_M,'Gpc']] as const)
    assert.ok(formatDistance(m).endsWith(` ${unit}`));
});
test('Resolver follows live Solar ephemeris without storing positions in the target',()=>{
  const f=fixture(),t=target('moon'),before=f.resolver.resolve(t).logicalPosition?.positionM;
  f.universe.solarSystem.update(86400);assert.notDeepEqual(f.resolver.resolve(t).logicalPosition?.positionM,before);assert.equal('positionM' in t,false);
});
test('All 19 current Solar bodies use the universal compatibility adapter',()=>{
  const f=fixture();assert.equal(f.universe.solarSystem.bodies.length,19);
  for(const b of f.universe.solarSystem.bodies)assert.equal(solarTargetBodyId(target(b.id),f.universe),b.id);
});
test('BH selection and resolution have no Milky Way-only assumption',()=>{
  const f=fixture();f.universe.address={galaxyId:'andromeda',sector:sectorIndex(0n,0n,0n)};
  const r=f.resolver.resolve(target('m31_smbh'));assert.equal(r.valid,true);assert.equal(r.domain,'interstellar');assert.equal(r.travelCapability,'black-hole-future');
});
test('Curated cosmological descriptors reject a forged address with the same key',()=>{
  const f=fixture(),t=target('virgo_cluster');assert.equal(f.resolver.resolve(t).valid,true);
  const bad=createUniversalTarget({...t,address:{cell:sectorIndex(0n,0n,0n),localMpc:[999,0,0]}});
  assert.equal(bad.key,t.key);assert.equal(f.resolver.resolve(bad).valid,false);
});
test('Selection snapshots identity; external descriptor mutation cannot change the lock',()=>{
  const d={...target('mars'),address:{...SOLAR_TARGET_ADDRESS,sector:sectorIndex(0n,0n,0n),bodyId:'mars'}};
  const s=new NavigationTargetState();s.select(d);(d.address.sector as any).x=99n;
  assert.equal(s.current?.key,target('mars').key);assert.equal(addressKey(s.current!.address as any),'milky_way/0,0,0/sol/mars');
});
test('Malformed wire formats and forged canonical keys are rejected',()=>{
  const json=serializeUniversalTarget(target('mars'));
  assert.throws(()=>deserializeUniversalTarget(json.replace('"version":1','"version":2')));
  assert.throws(()=>deserializeUniversalTarget(json.replace('"bigint":"0"','"bigint":"0.5"')));
  assert.throws(()=>deserializeUniversalTarget(json.replace('"bigint":"0"','"bigint":0')));
  assert.equal(fixture().resolver.resolve({...target('mars'),key:'render/uuid'}).valid,false);
});
test('Catalog markers emit logical keys and discard obsolete hit areas when presentation changes',()=>{
  const layer=new CatalogMapMarkers(),ctx=new Proxy({},{get:()=>()=>{}}) as CanvasRenderingContext2D;
  layer.setTargets(catalog.descriptors);layer.draw(ctx,600,300);assert.equal(layer.hitTest(28,35),'galaxy/milky_way');
  layer.setTargets([]);layer.draw(ctx,600,300);assert.equal(layer.hitTest(28,35),undefined);
});
test('Observable Horizon uses the existing observer-relative reference radius and has no point destination',()=>{
  const f=fixture(),t=target('observable-horizon'),before=f.resolver.resolve(t);
  assert.equal(before.distanceM,OBSERVABLE_HORIZON_MPC*1e6*PARSEC_M);assert.equal(before.logicalPosition,undefined);
  assert.equal(before.travelCapability,'cosmological-future');
  f.universe.updateSystemPose([1e20,-1e20,9e20],[0,0,0],0);assert.equal(f.resolver.resolve(t).distanceM,before.distanceM);
});
test('No render instances or functions survive address snapshotting',()=>{
  const input={...target('virgo_cluster'),address:{cell:{x:0n,y:0n,z:0n,render:new Group()},localMpc:[16.5,0,0],callback:()=>{},render:new Group()}};
  const t=createUniversalTarget(input as any);
  assert.equal('render' in t.address!,false);assert.equal('callback' in t.address!,false);
  assert.equal('render' in (t.address as any).cell,false);assert.deepEqual(deserializeUniversalTarget(serializeUniversalTarget(t)),t);
});
test('A forged precomputed target key is rejected by the state instead of silently rewritten',()=>{
  const state=new NavigationTargetState();assert.throws(()=>state.select({...target('mars'),key:'render/object-id'}));
  assert.equal(state.current,undefined);
});
test('Solar adapter rejects a coincident body name in another sector or system',()=>{
  const f=fixture();for(const address of [{...SOLAR_TARGET_ADDRESS,sector:sectorIndex(1n,0n,0n),bodyId:'mars'},
    {...SOLAR_TARGET_ADDRESS,systemId:'other',bodyId:'mars'}]){
    const t=createUniversalTarget({...target('mars'),systemId:address.systemId,address});assert.equal(solarNavigationTarget(t,f.universe),undefined);
  }
});
test('Materialized procedural target resolves live system coordinates; its future travel stays gated',()=>{
  const f=fixture(),p=catalog.proceduralDescriptor('milky_way',sector,star.id)!,t=proc('body');
  f.universe.activeSystem=new ProceduralSystemRuntime(p.system,9000);f.universe.address=p.address;
  f.universe.playerSystemPositionM=()=>[10,20,30];
  const r=f.resolver.resolve(t),position=f.universe.activeSystem.positionOf(t.bodyId!)!;
  assert.equal(r.materialized,true);assert.equal(r.distanceM,Math.hypot(position[0]-10,position[1]-20,position[2]-30));
  assert.equal(r.travelCapability,'interstellar-future');assert.equal(solarNavigationTarget(t,f.universe),undefined);
});
test('Malformed or nonexistent generated bodies never resolve through a valid star descriptor',()=>{
  const f=fixture(),t=proc('body'),bad=createUniversalTarget({...t,objectId:'imaginary',bodyId:'imaginary',address:{...(t.address as any),bodyId:'imaginary'}});
  assert.equal(f.resolver.resolve(bad).valid,false);
});
test('MW and Sgr A* distances reuse the existing Solar-to-galactic-centre relationship',()=>{
  const f=fixture();for(const id of ['milky_way','sgra']){
    const r=f.resolver.resolve(target(id));assert.ok(Math.abs(r.distanceM!/LIGHT_YEAR_M-26000)<.001);
    assert.equal(formatDistance(r.distanceM!),'26.00 kly');assert.equal(r.logicalPosition?.frame,'milky-way-centred');
  }
});
test('Curated descriptor validation ignores wire object property order',()=>{
  const t=target('virgo_cluster'),a=t.address as any;
  const reordered=createUniversalTarget({...t,address:{localMpc:a.localMpc,cell:{z:a.cell.z,y:a.cell.y,x:a.cell.x}}});
  assert.equal(fixture().resolver.resolve(reordered).valid,true);
});
