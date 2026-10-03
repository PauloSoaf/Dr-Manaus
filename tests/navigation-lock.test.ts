import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { SolarSystem } from '../src/world/celestial/SolarSystem.ts';
import { celestialLockCandidates, cycleNavigationTarget, NavigationTargetState } from '../src/world/travel/NavigationLock.ts';
import { resolveBodyDestination, selectBodyDestination } from '../src/world/travel/BodyNavigation.ts';
import { Game } from '../src/game/Game.ts';
import { UniversalMapPanel } from '../src/ui/map/UniversalMapPanel.ts';
import { CosmicCruiseController } from '../src/world/travel/CosmicFlight.ts';
import { projectNavigationMarker } from '../src/rendering/celestial/CelestialLabelLayer.ts';
import type { CelestialRenderSample } from '../src/rendering/celestial/types.ts';

function sky(items: { id: string; angle: number; radius?: number; distance?: number }[]) {
  const system = new SolarSystem();
  const bodies = items.map(i => ({ id: i.id, name: i.id, equatorialRadiusM: i.radius ?? 1,
    frameId: i.id }));
  const positions = new Map(items.map(i => [i.id, [Math.sin(i.angle) * (i.distance ?? 1000), 0,
    -Math.cos(i.angle) * (i.distance ?? 1000)] as [number, number, number]]));
  Object.defineProperty(system, 'bodies', { value: bodies });
  system.positionOf = id => positions.get(id);
  const samples = items.map(i => ({ bodyId: i.id, proxyDistanceM: 100 }));
  return { system, positions, samples, pick: () => celestialLockCandidates(system, [0,0,0], [0,0,-1], samples) };
}
test('T_TARGET_LOCK_FRONT_BODY', () => {
  assert.deepEqual(sky([{ id:'moon',angle:0 }]).pick(), ['moon']);
});
test('T_TARGET_LOCK_REJECTS_BEHIND_CAMERA', () => {
  assert.deepEqual(sky([{ id:'moon',angle:Math.PI },{id:'mars',angle:20*Math.PI/180}]).pick(), []);
});
test('T_TARGET_LOCK_RETICLE_PRIORITY', () => {
  assert.equal(sky([{id:'far',angle:0,distance:1e8},{id:'near',angle:.15,distance:10}]).pick()[0],'far');
});
test('T_TARGET_LOCK_LARGE_APPARENT_BODY_PRIORITY', () => {
  assert.equal(sky([{id:'small',angle:.1,radius:1},{id:'large',angle:.1,radius:100}]).pick()[0],'large');
});
test('Fully hidden discs cannot lock; repeated cycles reach every overlapping candidate', () => {
  assert.deepEqual(sky([{id:'front',angle:0,radius:100,distance:1000},
    {id:'behind',angle:0,radius:1,distance:2000}]).pick(),['front']);
  const f=sky([{id:'a',angle:0},{id:'b',angle:0},{id:'c',angle:0}]);
  let current:string|undefined;
  const visited=[];
  for(let i=0;i<3;i++){current=cycleNavigationTarget(f.pick(),current);visited.push(current);}
  assert.deepEqual(visited,['a','b','c']);
});
test('T_TARGET_LOCK_USES_LIVE_POSITION', () => {
  const system = new SolarSystem(), selected = selectBodyDestination(system,'moon')!;
  const before = [...resolveBodyDestination(system,selected)!.positionM];
  system.update(86400);
  assert.notDeepEqual(resolveBodyDestination(system,selected)!.positionM,before);
  assert.equal('positionM' in selected,false);
});
test('T_TARGET_LOCK_SURVIVES_LOD_CHANGE', () => {
  const f=sky([{id:'moon',angle:0}]), authority=new NavigationTargetState();
  authority.select(f.pick()[0],'reticle',0);
  // Proxy visibility goes away after its physical globe takes over; bounded metadata remains.
  const samples=f.samples.map(s=>({...s,visible:false,opacity:0}));
  assert.deepEqual(celestialLockCandidates(f.system,[0,0,0],[0,0,-1],samples),['moon']);
  authority.validate(f.system);assert.equal(authority.lock?.bodyId,'moon');
});
test('T_TARGET_LOCK_CLEAR', () => {
  const authority=new NavigationTargetState();authority.select('moon','reticle',42);authority.clear();
  assert.equal(authority.lock,undefined);
  assert.equal(cycleNavigationTarget([], 'moon'),undefined);
});
test('Tab cycles deterministically and Shift+Tab reverses; invalid coordinates cannot lock', () => {
  assert.equal(cycleNavigationTarget(['a','b','c'],'a'),'b');
  assert.equal(cycleNavigationTarget(['a','b','c'],'a',true),'c');
  const f=sky([{id:'moon',angle:0}]);f.positions.set('moon',[NaN,0,0]);assert.deepEqual(f.pick(),[]);
});
function mapFixture() {
  const g=Object.create(Game.prototype) as any;
  g.navigation=new NavigationTargetState();g.universe={activeSystem:new SolarSystem()};
  g.interplanetary=new CosmicCruiseController();g.hud={notify:()=>{}};
  const position=[10,20,30], velocity=[100,200,300];
  g.universe.playerSystemPositionM=()=>position;g.travelDomain={state:{positionM:position,velocityMps:velocity}};
  const panel=Object.create(UniversalMapPanel.prototype) as any;
  panel.onSelectTarget=(id:string)=>g.selectNavigationTarget(id,'map');
  panel.bodies=[];panel.renderers={system:{setBodies:()=>{}}};panel.updateCard=panel.drawMap=()=>{};
  return {g,panel,position,velocity};
}
test('T_TARGET_LOCK_MAP_USES_SAME_AUTHORITY', () => {
  const f=mapFixture();f.panel.selectTarget('mars');
  assert.equal(f.g.navigationLock?.bodyId,'mars');assert.equal(f.g.navigationLock?.source,'map');
  assert.equal(f.g.navigationTarget?.bodyId,'mars');
  assert.equal(f.g.resolveNavigationTarget()?.bodyId,'mars');
  assert.equal(f.g.hudBodies().find((b:any)=>b.id==='mars').selected,true);
  assert.equal(f.g.hudFlight().targetBodyId,'mars');
});
test('T_MAP_SELECT_DOES_NOT_TELEPORT', () => {
  const f=mapFixture(), before=structuredClone(f.g.travelDomain.state);
  f.g.interplanetary.autopilot.engage();
  f.g.navigationTarget=selectBodyDestination(f.g.universe.activeSystem,'moon');
  assert.equal(f.g.interplanetary.autopilot.active,false,'compatibility setter cancels old command, without another authority');
  for(const body of f.g.universe.activeSystem.bodies) f.panel.selectTarget(body.id);
  assert.deepEqual(f.g.travelDomain.state,before);assert.deepEqual(f.position,[10,20,30]);
});
test('Target removal clears lock; closing or focusing a map has no authority over it', () => {
  const authority=new NavigationTargetState(), system=new SolarSystem();authority.select('moon','map',0);
  authority.validate(system);assert.equal(authority.lock?.bodyId,'moon');
  system.positionOf=()=>undefined;authority.validate(system);assert.equal(authority.lock,undefined);
});
test('Lock marker projects bounded render direction and shows a finite edge arrow behind camera', () => {
  const camera=new PerspectiveCamera(60,2,.1,100000);camera.updateMatrixWorld();
  const sample={directionRender:[0,0,-1],proxyDistanceM:100} as unknown as CelestialRenderSample;
  assert.deepEqual(projectNavigationMarker(sample,camera),{x:0,y:0,offscreen:false});
  sample.directionRender=[0,0,1];
  const edge=projectNavigationMarker(sample,camera)!;
  assert.equal(edge.offscreen,true);assert.ok(Number.isFinite(edge.x+edge.y));
  sample.directionRender=[2/Math.sqrt(5),0,-1/Math.sqrt(5)];assert.equal(projectNavigationMarker(sample,camera)?.offscreen,true);
  sample.proxyDistanceM=1e20;assert.equal(projectNavigationMarker(sample,camera),undefined);
});
