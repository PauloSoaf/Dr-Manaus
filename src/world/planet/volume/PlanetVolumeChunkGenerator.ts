import { PlanetVolumeField } from './PlanetVolumeField';
import type { PlanetVolumeBounds, PlanetVolumeEdit } from './PlanetVolumeEdit';
import { chunkBoundsBodyFixedM, chunkSizeM, volumeChunkKey, DEFAULT_VOLUME_LOD,
  samplingConfigForKey,samplingProfileOf,chunkKeyToString,type PlanetVolumeChunkKey, type PlanetVolumeLodConfig } from './PlanetVolumeChunkKey';
import type { PlanetVolumeChunk } from './PlanetVolumeChunk';

/** Pure resumable CPU job. The global scheduler decides when it may advance. */
export class PlanetVolumeChunkGenerationJob {
  readonly key: PlanetVolumeChunkKey;
  readonly sourceRevision: number;
  private readonly bounds: PlanetVolumeBounds;
  private queryBounds: PlanetVolumeBounds;
  private readonly bases: Float64Array;
  private readonly distances: Float32Array;
  private readonly point: [number,number,number] = [0,0,0];
  private readonly direction: [number,number,number] = [0,0,0];
  private readonly batch: { baseDistanceM: number; candidates: readonly PlanetVolumeEdit[] } = { baseDistanceM: 0, candidates: [] };
  private index = 0;
  private phase: 'base' | 'edited' | 'done' = 'base';
  private minimumBase = 0;
  private positive = false;
  private negative = false;
  private boundary = false;
  private result?: PlanetVolumeChunk;
  private readonly spacingM: number;
  private readonly sampleCount:number;

  readonly config: PlanetVolumeLodConfig;
  constructor(readonly field: PlanetVolumeField, key: PlanetVolumeChunkKey, config = DEFAULT_VOLUME_LOD) {
    config=samplingConfigForKey(key,config);
    this.config = Object.freeze({ ...config });
    if (key.bodyId !== field.bodyId) throw new RangeError('chunk and field body mismatch');
    this.key = volumeChunkKey(key.bodyId,key.lod,key.x,key.y,key.z,samplingProfileOf(key));
    this.spacingM = chunkSizeM(key.lod,config)/(config.samplesPerAxis-1);
    this.bounds = chunkBoundsBodyFixedM(this.key,config);
    const halo=samplingProfileOf(this.key)==='impact-high'?this.spacingM:0;
    this.queryBounds = {minBodyFixedM:this.bounds.minBodyFixedM.map(v=>v-halo) as [number,number,number],
      maxBodyFixedM:this.bounds.maxBodyFixedM.map(v=>v+halo) as [number,number,number]};
    this.sourceRevision = field.edits.revision(field.bodyId);
    this.sampleCount=config.samplesPerAxis**3;
    this.bases = new Float64Array(this.sampleCount+(halo?6*config.samplesPerAxis**2:0));
    this.distances = new Float32Array(this.bases.length);
  }
  get pendingBytes(): number { return this.bases.byteLength + this.distances.byteLength; }
  get chunk(): PlanetVolumeChunk | undefined { return this.result; }
  get obsolete(): boolean { return this.field.edits.revision(this.field.bodyId) !== this.sourceRevision; }

  /** Every batch has bounded work; callers check their deadline between batches. */
  advance(maxSamples = 128): boolean {
    if (!Number.isInteger(maxSamples) || maxSamples < 1 || maxSamples > 4096) throw new RangeError('invalid volume sample batch');
    if (this.obsolete) throw new Error('volume generation revision changed');
    const n = this.config.samplesPerAxis, cells = n - 1;
    let processed = 0;
    while (this.phase !== 'done' && processed < maxSamples) {
      const i = this.index;
      let ix=i%n,iy=Math.floor(i/n)%n,iz=Math.floor(i/(n*n));
      if(i>=this.sampleCount){const extra=i-this.sampleCount,face=Math.floor(extra/(n*n)),axis=Math.floor(face/2),
        uv=extra%(n*n),u=uv%n,v=Math.floor(uv/n),side=face%2===0?-1:n;
        ix=axis===0?side:u;iy=axis===1?side:axis===0?u:v;iz=axis===2?side:v;}
      this.point[0] = (this.key.x*cells+ix)*this.spacingM;
      this.point[1] = (this.key.y*cells+iy)*this.spacingM;
      this.point[2] = (this.key.z*cells+iz)*this.spacingM;
      if (this.phase === 'base') {
        const d = this.field.baseSignedDistance(this.point,this.direction);
        if (!Number.isFinite(d)) throw new RangeError('volume base sample must be finite');
        this.bases[i] = d; this.minimumBase = Math.min(this.minimumBase,d);
      } else {
        this.batch.baseDistanceM = this.bases[i];
        const value = this.field.sampleBodyFixed(this.point, this.sample, this.batch).distanceM;
        this.distances[i] = value;
        if (!Number.isFinite(this.distances[i])) throw new RangeError('volume sample exceeds Float32 range');
        const stored = this.distances[i];
        if(i<this.sampleCount){if (stored > 0) this.positive = true; else if (stored < 0) this.negative = true; else this.boundary = true;}
      }
      this.index++; processed++;
      if (this.index !== this.distances.length) continue;
      if (this.phase === 'base') {
        // Any cut that improves a negative distance is within -dBase. Use the largest sampled
        // depth as one conservative broad-phase halo, preserving the Phase 1 numerical field.
        const halo = -this.minimumBase;
        this.queryBounds = { minBodyFixedM: this.queryBounds.minBodyFixedM.map(v=>v-halo) as [number,number,number],
          maxBodyFixedM: this.queryBounds.maxBodyFixedM.map(v=>v+halo) as [number,number,number] };
        this.batch.candidates = this.field.edits.queryBounds(this.field.bodyId,this.queryBounds);
        this.phase = 'edited'; this.index = 0;
      } else {
        this.phase = 'done';
        this.result = { key: this.key, boundsBodyFixedM: this.bounds, editQueryBoundsBodyFixedM: this.queryBounds,
          originBodyFixedM: this.bounds.minBodyFixedM, samplesPerAxis: n, cellsPerAxis: cells,
          spacingM: this.spacingM, distances: this.distances.subarray(0,this.sampleCount),
          ...(this.distances.length>this.sampleCount?{boundaryDistances:this.distances.subarray(this.sampleCount)}:{}),intactMaterial: this.field.intactMaterial,
          generationSignature:`${chunkKeyToString(this.key)}/grid:${this.config.baseChunkSizeM}:${n}`,
          sourceRevision: this.sourceRevision, overlappingEditCount: this.batch.candidates.length,
          classification: this.boundary || (this.positive && this.negative) ? 'MIXED' : this.positive ? 'EMPTY' : 'SOLID', state: 'ready' };
      }
    }
    return this.phase === 'done';
  }
  private readonly sample = { distanceM: 0, material: '' };
}

export function generateVolumeChunk(field: PlanetVolumeField, key: PlanetVolumeChunkKey,
  config: PlanetVolumeLodConfig = DEFAULT_VOLUME_LOD): PlanetVolumeChunk {
  const job = new PlanetVolumeChunkGenerationJob(field,key,config);
  while (!job.advance(128)) { /* pure synchronous facade for tests/workers/benchmarks */ }
  return job.chunk!;
}
