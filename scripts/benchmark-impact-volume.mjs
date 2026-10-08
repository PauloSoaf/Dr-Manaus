import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {impactFixture} from '../tests/helpers/rocky-impact.ts';
import {logicalImpactChunkCount} from '../src/world/planet/volume/PlanetVolumeImpactDemand.ts';

// Real D1 scalar/MC/BVH/presentation path. Timings are observations, never CI thresholds.
const rows=[];
for(const body of ['moon','mars','earth'])for(const speed of [260,800,8000,50000]) {
  const f=impactFixture(body,speed),editId=f.consume(),plan=f.service.last.plan,edit=f.runtime.edits.get(editId);
  let frames=0,samplingMs=0,meshingMs=0,colliderMs=0,renderPreparationMs=0,peakSampleJob=0,peakMeshJob=0,peakColliderJob=0;
  const start=performance.now();
  while(!f.runtime.replacement.entries.length&&frames<2400) {
    f.frame(2);const m=f.runtime.metrics,c=f.runtime.collisionMetrics;
    samplingMs+=m.generationMs;meshingMs+=m.meshingMs;colliderMs+=c.buildMs;
    renderPreparationMs+=m.renderPreparationMs;
    peakSampleJob=Math.max(peakSampleJob,m.pendingBytes);peakMeshJob=Math.max(peakMeshJob,m.meshJobBytes);peakColliderJob=Math.max(peakColliderJob,c.pendingBytes);frames++;
  }
  assert.ok(f.runtime.replacement.entries.length,`${body}/${speed}: coherent replacement required`);
  const m=f.runtime.metrics,c=f.runtime.collisionMetrics;
  assert.ok(m.resident<=128&&m.bytes<=4*1048576&&m.meshBytes<=16*1048576&&c.bytes<=32*1048576);
  assert.equal(plan.craterRadiusM,edit.impact.craterRadiusM,'residency must not shrink the logical crater');
  const row={body,speedMps:speed,logicalEditCount:f.runtime.edits.editCount,grantedBudgetMs:2,
    craterRadiusM:plan.craterRadiusM,craterDepthM:plan.craterDepthM,
    samplingProfile:m.samplingProfile,samplesPerAxis:m.samplesPerAxis,spacingM:m.spacingM,impactCapacity:m.impactCapacity,
    sphereRadiusM:plan.sphereRadiusM,logicalChunks:logicalImpactChunkCount(edit,f.runtime.lod),
    activeChunks:m.publishedReplacements,sampleBytes:m.bytes,meshes:m.residentMeshes,meshBytes:m.meshBytes,
    vertices:m.meshVertices,triangles:m.meshTriangles,colliders:c.resident,colliderBytes:c.bytes,
    frames,elapsedMs:performance.now()-start,samplingMs,meshingMs,colliderMs,renderPreparationMs,publicationMs:m.publicationMs,
    peakSampleJob,peakMeshJob,peakColliderJob,presentation:f.renderer.stats,floor:f.ray()?.point};
  rows.push(row);f.dispose();
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/benchmark-impact-volume.json',JSON.stringify(rows,null,2));
console.table(rows.map(({body,speedMps,craterRadiusM,craterDepthM,logicalChunks,activeChunks,sampleBytes,meshBytes,colliderBytes,elapsedMs,publicationMs})=>
  ({body,speedMps,R:craterRadiusM.toFixed(2),D:craterDepthM.toFixed(2),logicalChunks,activeChunks,sampleBytes,meshBytes,colliderBytes,
    elapsedMs:elapsedMs.toFixed(2),publicationMs:publicationMs.toFixed(3)})));
