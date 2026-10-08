import { MARCHING_CUBES_TRIANGLES } from './MarchingCubesTable';
import type { PlanetVolumeChunk } from './PlanetVolumeChunk';
import { maximumVolumeMeshBytes, type PlanetVolumeMesh } from './PlanetVolumeMesh';
import { samplingProfileOf } from './PlanetVolumeChunkKey';

const CORNERS = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]] as const;
const EDGES = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]] as const;
const FACES = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[3,2,6,7],[0,3,7,4],[1,2,6,5]] as const;
export const MAX_VOLUME_MESH_JOB_BYTES = 2 * 1024 * 1024;
// 33^3 scratch (1,006,332 B) + worst-case output/copy (8,950,272 B) = 9,956,604 B.
export const MAX_HIGH_VOLUME_MESH_JOB_BYTES = 10 * 1024 * 1024;
export function volumeMeshJobByteLimit(chunk:Pick<PlanetVolumeChunk,'key'>):number {
  return samplingProfileOf(chunk.key)==='impact-high'?MAX_HIGH_VOLUME_MESH_JOB_BYTES:MAX_VOLUME_MESH_JOB_BYTES;
}

/** Pure classic Marching Cubes at iso=0. Negative solid; winding and gradients point toward empty. */
export class PlanetVolumeMeshingJob {
  readonly sourceRevision: number;
  private readonly n: number;
  private readonly cells: number;
  private readonly sampleCount: number;
  private readonly cellCount: number;
  private phase: 'validate' | 'count' | 'emit' | 'done' = 'validate';
  private cursor = 0;
  private readonly gradients: Float32Array;
  private readonly edgeVertices: Int32Array;
  private readonly zeroVertices: Int32Array;
  private readonly cornerIndices = new Int32Array(8);
  private readonly values = new Float64Array(8);
  private positions = new Float32Array(0);
  private normals = new Float32Array(0);
  private indices = new Uint32Array(0);
  private vertexCount = 0;
  private indexCount = 0;
  private candidateTriangles = 0;
  private dropped = 0;
  private ambiguousFaces = 0;
  private result?: PlanetVolumeMesh;

  constructor(readonly chunk: PlanetVolumeChunk) {
    this.n = chunk.samplesPerAxis; this.cells = this.n-1;
    this.sampleCount = this.n**3; this.cellCount = this.cells**3;
    this.sourceRevision = chunk.sourceRevision;
    if (chunk.state !== 'ready' || !Number.isInteger(this.n) || this.n<2 || this.n>33
      ||(samplingProfileOf(chunk.key)==='impact-high'&&(this.n!==33||chunk.boundaryDistances?.length!==6*this.n**2))
      || chunk.cellsPerAxis !== this.cells || chunk.distances.length !== this.sampleCount
      || !Number.isFinite(chunk.spacingM) || chunk.spacingM<=0 || !chunk.originBodyFixedM.every(Number.isFinite)) {
      throw new RangeError('invalid ready volume grid');
    }
    const scratch = this.sampleCount*28 + 8*12;
    // Include compact result copies in the worst-case live-array bound, not just retained output.
    if (chunk.classification === 'MIXED' && scratch + maximumVolumeMeshBytes(this.n)*2 > volumeMeshJobByteLimit(chunk)) {
      throw new RangeError('volume meshing job exceeds typed-array budget');
    }
    const count = chunk.classification === 'MIXED' ? this.sampleCount : 0;
    this.gradients = new Float32Array(count*3);
    this.edgeVertices = new Int32Array(count*3); this.edgeVertices.fill(-1);
    this.zeroVertices = new Int32Array(count); this.zeroVertices.fill(-1);
    if (!count) this.finish();
  }
  get mesh(): PlanetVolumeMesh | undefined { return this.result; }
  get obsolete(): boolean { return this.chunk.state !== 'ready'; }
  get pendingBytes(): number {
    return this.gradients.byteLength + this.edgeVertices.byteLength + this.zeroVertices.byteLength
      + this.cornerIndices.byteLength + this.values.byteLength + this.positions.byteLength
      + this.normals.byteLength + this.indices.byteLength;
  }
  /** A work unit is one grid sample or one cell; no field/BVH queries occur during meshing. */
  advance(maxWorkUnits = 64): boolean {
    if (!Number.isInteger(maxWorkUnits) || maxWorkUnits<1 || maxWorkUnits>256) throw new RangeError('invalid meshing batch');
    if (this.obsolete) throw new Error('volume mesh source is stale');
    for (let work=0;work<maxWorkUnits && this.phase!=='done';work++) {
      if (this.phase === 'validate') {
        this.validateSample(this.cursor++);
        if (this.cursor===this.sampleCount) { this.phase='count';this.cursor=0; }
      } else {
        const x=this.cursor%this.cells,y=Math.floor(this.cursor/this.cells)%this.cells,z=Math.floor(this.cursor/(this.cells*this.cells));
        const code=this.readCell(x,y,z), row=code*16;
        if (this.phase === 'count') {
          for(let i=0;i<15&&MARCHING_CUBES_TRIANGLES[row+i]!==-1;i+=3) this.candidateTriangles++;
          for(const face of FACES) {
            const a=this.values[face[0]]<0,b=this.values[face[1]]<0,c=this.values[face[2]]<0,d=this.values[face[3]]<0;
            if(a===c&&b===d&&a!==b) this.ambiguousFaces++;
          }
        } else if (code!==0&&code!==255) {
          for(let i=0;i<15&&MARCHING_CUBES_TRIANGLES[row+i]!==-1;i+=3) {
            // The classic table points toward its '< iso' side. Reverse it for negative-solid fields.
            const a=this.vertex(MARCHING_CUBES_TRIANGLES[row+i],x,y,z);
            const b=this.vertex(MARCHING_CUBES_TRIANGLES[row+i+2],x,y,z);
            const c=this.vertex(MARCHING_CUBES_TRIANGLES[row+i+1],x,y,z);
            this.triangle(a,b,c);
          }
        }
        this.cursor++;
        if(this.cursor===this.cellCount) {
          if(this.phase==='count'&&this.candidateTriangles) {
            const vertices=Math.min(3*this.n*this.n*this.cells,this.candidateTriangles*3);
            this.positions=new Float32Array(vertices*3);this.normals=new Float32Array(vertices*3);
            this.indices=new Uint32Array(this.candidateTriangles*3);this.phase='emit';this.cursor=0;
          } else this.finish();
        }
      }
    }
    return this.phase==='done';
  }
  private validateSample(i: number): void {
    const n=this.n, values=this.chunk.distances, x=i%n,y=Math.floor(i/n)%n,z=Math.floor(i/(n*n));
    if(!Number.isFinite(values[i])) throw new RangeError('non-finite volume mesh sample');
    for(let axis=0;axis<3;axis++) {
      const stride=axis===0?1:axis===1?n:n*n, coordinate=axis===0?x:axis===1?y:z;
      const lo=coordinate>0?i-stride:i,hi=coordinate<n-1?i+stride:i;
      const halo=this.chunk.boundaryDistances,faceIndex=axis===0?y+n*z:axis===1?x+n*z:x+n*y;
      const a=coordinate===0&&halo?halo[(axis*2)*n*n+faceIndex]:values[lo],
        b=coordinate===n-1&&halo?halo[(axis*2+1)*n*n+faceIndex]:values[hi];
      const value=(b-a)/((halo||coordinate>0&&coordinate<n-1?2:1)*this.chunk.spacingM);
      if(!Number.isFinite(value)) throw new RangeError('non-finite volume mesh gradient');
      this.gradients[i*3+axis]=value;
      if(!Number.isFinite(this.gradients[i*3+axis])) throw new RangeError('volume mesh gradient exceeds Float32');
    }
  }
  private readCell(x: number,y: number,z: number): number {
    let code=0;
    for(let i=0;i<8;i++) {
      const corner=CORNERS[i],index=x+corner[0]+this.n*(y+corner[1]+this.n*(z+corner[2]));
      this.cornerIndices[i]=index;this.values[i]=this.chunk.distances[index];
      if(this.values[i]<0) code|=1<<i; // Zero consistently belongs to the empty side.
    }
    return code;
  }
  private vertex(edge: number,x: number,y: number,z: number): number {
    let [a,b]=EDGES[edge];
    let ca=CORNERS[a],cb=CORNERS[b];
    const axis=ca[0]!==cb[0]?0:ca[1]!==cb[1]?1:2;
    if(ca[axis]>cb[axis]) { const swap=a;a=b;b=swap;ca=CORNERS[a];cb=CORNERS[b]; }
    const ia=this.cornerIndices[a],ib=this.cornerIndices[b],cacheIndex=ia*3+axis;
    if(this.edgeVertices[cacheIndex]>=0) return this.edgeVertices[cacheIndex];
    const va=this.values[a],vb=this.values[b],t=va===0?0:vb===0?1:Math.max(0,Math.min(1,va/(va-vb)));
    const zero=t===0?ia:t===1?ib:-1;
    if(zero>=0&&this.zeroVertices[zero]>=0) {
      const existing=this.zeroVertices[zero];this.edgeVertices[cacheIndex]=existing;return existing;
    }
    const index=this.vertexCount++,offset=index*3,spacing=this.chunk.spacingM;
    this.positions[offset]=(x+ca[0]+(cb[0]-ca[0])*t)*spacing;
    this.positions[offset+1]=(y+ca[1]+(cb[1]-ca[1])*t)*spacing;
    this.positions[offset+2]=(z+ca[2]+(cb[2]-ca[2])*t)*spacing;
    let length=0;
    for(let k=0;k<3;k++) {const g=this.gradients[ia*3+k]*(1-t)+this.gradients[ib*3+k]*t;this.normals[offset+k]=g;length+=g*g;}
    length=Math.sqrt(length);
    if(length>1e-20) for(let k=0;k<3;k++) this.normals[offset+k]/=length;
    this.edgeVertices[cacheIndex]=index;if(zero>=0) this.zeroVertices[zero]=index;
    return index;
  }
  private triangle(a: number,b: number,c: number): void {
    const p=this.positions,ia=a*3,ib=b*3,ic=c*3;
    const ux=p[ib]-p[ia],uy=p[ib+1]-p[ia+1],uz=p[ib+2]-p[ia+2];
    const vx=p[ic]-p[ia],vy=p[ic+1]-p[ia+1],vz=p[ic+2]-p[ia+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const length=Math.hypot(nx,ny,nz);
    if(a===b||b===c||a===c||length<=this.chunk.spacingM**2*1e-10) {this.dropped++;return;}
    this.indices[this.indexCount++]=a;this.indices[this.indexCount++]=b;this.indices[this.indexCount++]=c;
    // A zero field gradient at an interpolated vertex uses the first incident nondegenerate face.
    for(const index of [a,b,c]) {
      const offset=index*3;
      if(this.normals[offset]===0&&this.normals[offset+1]===0&&this.normals[offset+2]===0) {
        this.normals[offset]=nx/length;this.normals[offset+1]=ny/length;this.normals[offset+2]=nz/length;
      }
    }
  }
  private finish(): void {
    if(!this.indexCount) this.vertexCount=0;
    this.result={key:this.chunk.key,originBodyFixedM:this.chunk.originBodyFixedM,sourceRevision:this.sourceRevision,
      generationSignature:this.chunk.generationSignature,
      positions:this.positions.slice(0,this.vertexCount*3),normals:this.normals.slice(0,this.vertexCount*3),
      indices:this.indices.slice(0,this.indexCount),triangleCount:this.indexCount/3,vertexCount:this.vertexCount,
      droppedDegenerateTriangles:this.dropped,ambiguousFaceCount:this.ambiguousFaces};
    this.phase='done';
  }
}
/** Synchronous facade for tests/benchmarks; the runtime advances the job through its scheduler. */
export function meshVolumeChunk(chunk: PlanetVolumeChunk): PlanetVolumeMesh {
  const job=new PlanetVolumeMeshingJob(chunk);while(!job.advance(64)) {}
  return job.mesh!;
}
