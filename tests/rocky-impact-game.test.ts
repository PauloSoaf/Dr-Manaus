import test from 'node:test';
import assert from 'node:assert/strict';
import { impactFixture } from './helpers/celestial-impact.ts';
import { LIGHT_SPEED_MPS } from '../src/world/travel/TravelConstants.ts';
function placeAtProductionEnvelope(f:ReturnType<typeof impactFixture>,speed:number) {
  const original=f.controller.update;let envelopes:any;
  f.controller.update=function(...args:any[]){envelopes=args[3].exclusionEnvelopes;return original.apply(this,args as any);};
  try{f.step(0);}finally{f.controller.update=original;}
  const envelope=envelopes.find((e:any)=>e.bodyId===f.body.id);
  f.place((speed>8000?envelope.radiusM:envelope.captureRadiusM??envelope.radiusM)+1,speed);
}

for(const id of ['earth','moon','mars','mercury','venus'])test(`Game CCD/C4 consumes one major rocky edit for ${id}`,()=>{
  const f=impactFixture(id,8001);try {
    placeAtProductionEnvelope(f,8001);
    for(let i=0;i<30&&!f.event();i++)f.step();
    assert.equal(f.event().classification,'MAJOR_IMPACT');assert.equal(f.universe.volume.edits.editCount,1);
    const edit=f.universe.volume.edits.allEdits()[0];assert.equal(edit.bodyId,id);assert.equal(edit.type,'subtract-sphere');
    assert.equal(edit.id,`${id}:impact:${f.event().eventId}`);assert.ok(edit.impact);
    for(let i=0;i<120;i++)f.step();assert.equal(f.universe.volume.edits.editCount,1);assert.equal(f.universe.volume.edits.revision(id),1);
  }finally{f.dispose();}
});
test('Game CCD/C4 minor contact creates the unchanged 56 m footprint',()=>{
  const f=impactFixture('moon',260);try{
    placeAtProductionEnvelope(f,260);
    for(let i=0;i<300&&!f.event();i++)f.step();assert.equal(f.event().classification,'MINOR_IMPACT');
    assert.equal(f.universe.volume.edits.editCount,1);
    assert.ok(Math.abs(f.universe.volume.edits.allEdits()[0].impact!.craterRadiusM-56.548)<.01);
  }finally{f.dispose();}
});
test('Game CCD/C4 diagnostic catastrophic contact creates no planetary edit',()=>{
  for(const id of ['earth','moon','mars','jupiter','sun']){const f=impactFixture(id,LIGHT_SPEED_MPS);try{
    f.step();assert.equal(f.event().classification,'CATASTROPHIC_IMPACT');assert.equal(f.universe.volume.edits.editCount,0);
  }finally{f.dispose();}}
});
