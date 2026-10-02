import test from 'node:test';
import assert from 'node:assert/strict';
import { SystemMapRenderer } from '../src/ui/map/MapRenderers.ts';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation.ts';
import { sectorIndex } from '../src/world/spatial/UniverseAddress.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';

const location:UniverseLocation={address:{galaxyId:'milky_way',sector:sectorIndex(0n,0n,0n),systemId:'sol',bodyId:'earth'},frameId:'solar-system/barycentric'};
function fixture(width=1000,height=650) {
  const labels:string[]=[],circles:number[][]=[];
  const context={clearRect(){},fillRect(){},setTransform(){},beginPath(){},stroke(){},fill(){},moveTo(){},lineTo(){},
    arc(...args:number[]){circles.push(args);},fillText(label:string){labels.push(label);},measureText:(label:string)=>({width:label.length*7})};
  const canvas={width:300,height:150,style:{},getContext:()=>context,getBoundingClientRect:()=>({width,height})} as unknown as HTMLCanvasElement;
  const renderer=new SystemMapRenderer(canvas);
  const u=new UniverseRuntime({epochS:0});
  renderer.setBodies(u.activeSystem.bodies.map(body=>({id:body.id,name:body.name,
    parentId:body.parentId,systemPositionM:u.activeSystem.positionOf(body.id)!,selected:body.id==='neptune',distanceFromPlayerM:0})));
  return {canvas,renderer,labels,circles,dispose:()=>u.dispose()};
}
test('T_SYSTEM_MAP_CANVAS_RESIZES_TO_DISPLAY_SIZE',()=>{
  const f=fixture();try{ f.renderer.draw(location);assert.equal(f.canvas.width,1000);assert.equal(f.canvas.height,650); }finally{f.dispose();}
});
test('T_SYSTEM_MAP_DPR_BOUNDED',()=>{
  const f=fixture();const previous=globalThis.devicePixelRatio;
  try{globalThis.devicePixelRatio=4;f.renderer.draw(location);assert.equal(f.canvas.width,2000);assert.equal(f.canvas.height,1300);}
  finally{globalThis.devicePixelRatio=previous;f.dispose();}
});
test('T_SYSTEM_MAP_NEPTUNE_FITS_VIEW',()=>{
  const f=fixture();try{f.renderer.draw(location);const n=f.renderer.markers.find(m=>m.id==='neptune')!;
    assert.ok(n.x>=20&&n.x<=980&&n.y>=20&&n.y<=630);}finally{f.dispose();}
});
test('T_SYSTEM_MAP_BODY_LABELS_PRESENT',()=>{
  const f=fixture();try{f.renderer.draw(location);assert.equal(f.labels.length,9);
    for(const m of f.renderer.markers)assert.ok(f.labels.some(label=>label.startsWith(m.name)));}finally{f.dispose();}
});
test('T_SYSTEM_MAP_SELECTED_TARGET_HIGHLIGHT',()=>{
  const f=fixture();try{f.renderer.draw(location);const n=f.renderer.markers.find(m=>m.id==='neptune')!;
    assert.ok(n.selected);assert.ok(f.labels.some(l=>l.includes('ALVO')));
    assert.ok(f.circles.some(c=>c[0]===n.x&&c[1]===n.y&&c[2]===12));}finally{f.dispose();}
});
test('T_SYSTEM_MAP_SCALE_USES_AU',()=>{const f=fixture();try{assert.match(f.renderer.scaleText,/AU/);assert.doesNotMatch(f.renderer.scaleText,/5 km/);}finally{f.dispose();}});
test('T_SYSTEM_MAP_ZOOM_FINITE',()=>{
  const f=fixture();try{for(const delta of [NaN,Infinity,-Infinity,1e300,-1e300,0,400,-400]) {
    f.renderer.changeZoom(delta);f.renderer.draw(location);assert.ok(f.renderer.zoom>=.5&&f.renderer.zoom<=16);
    assert.ok(f.renderer.markers.every(m=>Number.isFinite(m.x+m.y)));}}finally{f.dispose();}
});
test('T_SYSTEM_MAP_ZOOM_PRESERVES_BODY_ORDER',()=>{
  const f=fixture();try{f.renderer.draw(location);
    const order=()=>[...f.renderer.markers].sort((a,b)=>Math.hypot(a.x-500,a.y-325)-Math.hypot(b.x-500,b.y-325)).map(m=>m.id);
    const before=order();f.renderer.changeZoom(-700);f.renderer.draw(location);assert.deepEqual(order(),before);}finally{f.dispose();}
});
test('system map body click hit test selects the matching target',()=>{
  const f=fixture();try{f.renderer.draw(location);const n=f.renderer.markers.find(m=>m.id==='neptune')!;
    assert.equal(f.renderer.hitTest(n.x,n.y),'neptune');assert.equal(f.renderer.hitTest(-100,-100),undefined);}finally{f.dispose();}
});
