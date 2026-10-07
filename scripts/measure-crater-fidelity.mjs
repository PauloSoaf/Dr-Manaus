import {mkdir,writeFile} from 'node:fs/promises';
import {measureCraterFidelity,craterFidelityAccepted,CRATER_FIDELITY_TOLERANCE} from '../tests/helpers/crater-fidelity.ts';
const rows=[];
for(const body of ['moon','mars','earth'])for(const speed of [260,800])rows.push(measureCraterFidelity(body,speed));
await mkdir('artifacts',{recursive:true});
const accepted=rows.every(craterFidelityAccepted);
await writeFile('artifacts/d11-crater-fidelity.json',JSON.stringify({accepted,tolerance:CRATER_FIDELITY_TOLERANCE,rows},null,2));
console.table(rows.map(({body,requestedRadiusM,requestedDepthM,cellsAcrossDiameter,cellsAcrossDepth,depthErrorM,maxOpeningRadiusErrorM,depthToleranceM})=>
  ({body,R:requestedRadiusM,D:requestedDepthM,cellsAcrossDiameter,cellsAcrossDepth,depthErrorM,maxOpeningRadiusErrorM,depthToleranceM})));
if(!accepted){
  console.error('D1.2 HIGH-RES IMPACT CORE required before D2: declared fidelity tolerance exceeded.');process.exitCode=1;
}
