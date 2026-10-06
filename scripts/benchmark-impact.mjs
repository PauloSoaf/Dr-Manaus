import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { localImpactFixture } from '../tests/helpers/local-impact-fixture.ts';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){}})})};
const rows=[];
for(const radius of [50,200,500,1000]){
  const fixture=localImpactFixture();
  try{
    const r=radius/1.5,footprint={...fixture.footprint,craterRadiusM:r,craterDepthM:r*.45,
      radius:r,coreDestructionRadiusM:r*1.05,blastDamageRadiusM:radius,impulseRadiusM:r*2,reactionRadiusM:r*2.3};
    const started=performance.now(),candidates=fixture.query(fixture.zero,radius).length,queryMs=performance.now()-started;
    fixture.impact(undefined,footprint);const pending=fixture.destruction.pendingCount,immediate=fixture.destruction.stats.destroyed;
    fixture.drain();assert.equal(fixture.destruction.pendingCount,0);assert.ok(fixture.terrain.stats.triangles>0);
    rows.push({blastRadiusM:radius,candidates,eligibleEntities:fixture.destruction.lastImpact.queried,
      queryMs:+queryMs.toFixed(3),solverQueryMs:+fixture.destruction.lastImpact.queryMs.toFixed(3),
      immediate,pending,retired:fixture.destruction.stats.destroyed,pendingFinal:fixture.destruction.pendingCount,
      terrainBuildMs:+fixture.terrain.stats.buildMs.toFixed(3),terrainBytes:fixture.terrain.stats.bytes});
  }finally{fixture.dispose();}
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/benchmark-impact.json',JSON.stringify({fixture:'production owners, fixed resident inventory; controlled blast radii',rows},null,2));
console.table(rows);
