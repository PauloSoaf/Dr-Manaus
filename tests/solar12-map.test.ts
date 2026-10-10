import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SystemMapRenderer } from '../src/ui/map/MapRenderers.ts';
import { SolarSystem } from '../src/world/celestial/SolarSystem.ts';
import { selectBodyDestination } from '../src/world/travel/BodyNavigation.ts';
import { sectorIndex } from '../src/world/spatial/UniverseAddress.ts';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation.ts';

const location: UniverseLocation = { address: { galaxyId: 'milky_way', sector: sectorIndex(0n,0n,0n), systemId: 'sol', bodyId: 'earth' },
  frameId: 'solar-system/barycentric', systemPositionM: [1e12,0,0] };
function fixture() {
  const paths: number[][] = [], labels: string[] = [];
  const ctx = { setTransform(){}, clearRect(){}, fillRect(){}, beginPath(){}, stroke(){}, fill(){}, arc(){},
    moveTo(x:number,y:number){paths.push([x,y]);}, lineTo(x:number,y:number){paths.push([x,y]);},
    fillText(label:string){labels.push(label);}, measureText:(label:string)=>({width:label.length*7}) };
  const canvas = { width: 1000, height: 700, style: {}, getContext:()=>ctx,
    getBoundingClientRect:()=>({width:1000,height:700}) } as unknown as HTMLCanvasElement;
  const renderer = new SystemMapRenderer(canvas), system = new SolarSystem();
  const feed = (selected?:string) => renderer.setBodies(system.bodies.map(b => ({ id:b.id, name:b.name, parentId:b.parentId,
    selected:b.id===selected, distanceFromPlayerM:0, systemPositionM:system.positionOf(b.id)! })));
  feed(); return { renderer, system, feed, paths, labels };
}

test('T_SYSTEM_MAP_MAJOR_MOONS_AVAILABLE: catalog hierarchy uses live data, overview omits satellite piles', () => {
  const f = fixture(); f.renderer.draw(location);
  assert.equal(f.renderer.markers.length, 9);
  assert.deepEqual(new Set(f.system.bodies.filter(b=>b.satelliteOrbit).map(b=>b.id)),
    new Set(['moon','io','europa','ganymede','callisto','titan','enceladus','titania','oberon','triton']));
  const code = readFileSync('src/ui/map/MapRenderers.ts','utf8');
  assert.doesNotMatch(code, /OfflineEphemeris/);
  const empty = fixture(); empty.renderer.setBodies([]); empty.renderer.draw(location);
  assert.equal(empty.renderer.markers.length, 0, 'no second epoch-zero simulation');
});

for (const [parent, ids] of Object.entries({ earth:['moon'], jupiter:['io','europa','ganymede','callisto'],
  saturn:['titan','enceladus'], uranus:['titania','oberon'], neptune:['triton'] })) {
  test(`T_MAP_${parent.toUpperCase()}_FOCUS: parent-relative scale, orbits, labels and live positions`, () => {
    const f = fixture(); f.feed(ids[0]); f.renderer.setFocus(parent); f.renderer.draw(location);
    assert.deepEqual(new Set(f.renderer.markers.map(m=>m.id)),new Set([parent,...ids]));
    const centre = f.renderer.markers.find(m=>m.id===parent)!;
    assert.equal(centre.x,500); assert.equal(centre.y,350);
    assert.ok(f.renderer.markers.every(m=>m.x>25&&m.x<975&&m.y>25&&m.y<675));
    for (const id of ids) {
      const marker = f.renderer.markers.find(m=>m.id===id)!;
      assert.ok(Math.hypot(marker.x-centre.x, marker.y-centre.y) > 25);
      assert.ok(f.labels.some(l=>l.startsWith(marker.name)));
      assert.equal(f.renderer.hitTest(marker.x, marker.y),id);
    }
    assert.ok(f.paths.length >= ids.length * 97);
    assert.ok(f.paths.every(p=>p.every(Number.isFinite)));
    assert.match(f.renderer.scaleText,/km/); assert.doesNotMatch(f.renderer.scaleText,/AU/);
    const before = f.renderer.markers.map(m=>[m.x,m.y]);
    f.system.update(86400); f.feed(ids[0]); f.renderer.draw(location);
    assert.notDeepEqual(f.renderer.markers.map(m=>[m.x,m.y]),before);
    assert.equal(f.renderer.markers.find(m=>m.id===parent)!.x,500);
    f.renderer.changeZoom(-500); f.renderer.setFocus(); f.renderer.draw(location);
    assert.equal(f.renderer.zoom,1); assert.match(f.renderer.scaleText,/AU/);
  });
}

test('T_MAP_MOON_CLICK_SELECTS_TARGET / T_MAP_SELECTION_DOES_NOT_TELEPORT', () => {
  const f = fixture(); f.renderer.setFocus('jupiter'); f.renderer.draw(location);
  const before = structuredClone(location), states = f.system.bodies.map(b=>[...f.system.positionOf(b.id)!]);
  const moon = f.renderer.markers.find(m=>m.id==='europa')!;
  const id = f.renderer.hitTest(moon.x,moon.y)!;
  assert.deepEqual(selectBodyDestination(f.system,id),{bodyId:'europa',arrivalMarginM:50000});
  assert.deepEqual(location,before); assert.deepEqual(f.system.bodies.map(b=>f.system.positionOf(b.id)),states);
});
