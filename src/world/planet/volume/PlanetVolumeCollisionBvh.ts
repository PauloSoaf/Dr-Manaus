import type { Vec3 } from '../../spatial/units';
import type { PlanetVolumeMesh } from './PlanetVolumeMesh';

export interface PlanetVolumeCollisionBvh {
  readonly bounds: Float32Array; // six chunk-local components per node: min XYZ, max XYZ
  readonly nodes: Int32Array; // left, right, first triangle reference, leaf count
  readonly triangles: Uint32Array;
  readonly nodeCount: number;
}
export const COLLISION_LEAF_TRIANGLES=8;
export const MAX_COLLISION_BUILD_BYTES=4*1024*1024;
export function requiredVolumeCollisionBuildBytes(mesh:PlanetVolumeMesh):number {
  const n=mesh.triangleCount,leaves=2**Math.ceil(Math.log2(Math.max(1,Math.ceil(n/COLLISION_LEAF_TRIANGLES)))),capacity=2*leaves-1;
  return n*36+capacity*40+1024+mesh.positions.byteLength+mesh.indices.byteLength+mesh.normals.byteLength;
}
const spread=(v: number)=>{v=(v|(v<<16))&0x030000ff;v=(v|(v<<8))&0x0300f00f;v=(v|(v<<4))&0x030c30c3;v=(v|(v<<2))&0x09249249;return v;};

/** Bounded radix/Morton ordering then balanced median tree. Each advance unit handles one
 * triangle/reference. No sort, recursion, synchronous whole-mesh scan or object-per-node. */
export class PlanetVolumeCollisionBvhJob {
  private phase: 'validate'|'codes'|'histogram'|'scatter'|'tree'|'done'='validate';
  private cursor=0;
  private pass=0;
  private readonly triangleBounds: Float32Array;
  private readonly codes: Uint32Array;
  private order: Uint32Array;
  private scratch: Uint32Array;
  private readonly histogram=new Uint32Array(256);
  private readonly bounds: Float32Array;
  private readonly nodes: Int32Array;
  private count=0;
  private readonly globalMin: Vec3=[Infinity,Infinity,Infinity];
  private readonly globalMax: Vec3=[-Infinity,-Infinity,-Infinity];
  private tasks:{node:number;first:number;count:number;cursor:number}[]=[];
  result?: PlanetVolumeCollisionBvh;
  constructor(readonly mesh: PlanetVolumeMesh) {
    const n=mesh.triangleCount,leaves=2**Math.ceil(Math.log2(Math.max(1,Math.ceil(n/COLLISION_LEAF_TRIANGLES)))),capacity=2*leaves-1;
    if(!Number.isSafeInteger(n)||n<0||mesh.indices.length!==n*3||mesh.positions.length!==mesh.vertexCount*3
      ||mesh.normals.length!==mesh.positions.length||!mesh.originBodyFixedM.every(Number.isFinite)
      ||requiredVolumeCollisionBuildBytes(mesh)>MAX_COLLISION_BUILD_BYTES)
      throw new RangeError('invalid or over-budget volume collision source');
    this.triangleBounds=new Float32Array(n*6);this.codes=new Uint32Array(n);this.order=new Uint32Array(n);this.scratch=new Uint32Array(n);
    this.bounds=new Float32Array(n?capacity*6:0);this.nodes=new Int32Array(n?capacity*4:0);this.nodes.fill(-1);
    if(!n)this.finish();
  }
  get pendingBytes(){return this.triangleBounds.byteLength+this.codes.byteLength+this.order.byteLength+this.scratch.byteLength
    +this.histogram.byteLength+this.bounds.byteLength+this.nodes.byteLength;}
  advance(units=64): boolean {
    if(!Number.isInteger(units)||units<1||units>256)throw new RangeError('invalid collision batch');
    const n=this.mesh.triangleCount;
    for(let work=0;work<units&&this.phase!=='done';work++) {
      const i=this.cursor;
      if(this.phase==='validate') {
        const off=i*6;
        for(let axis=0;axis<3;axis++) {
          let min=Infinity,max=-Infinity;
          for(let v=0;v<3;v++) {const index=this.mesh.indices[i*3+v];if(index>=this.mesh.vertexCount)throw new RangeError('collision index outside mesh');
            const p=this.mesh.positions[index*3+axis];if(!Number.isFinite(p)||!Number.isFinite(this.mesh.normals[index*3+axis]))throw new RangeError('nonfinite collision geometry');
            min=Math.min(min,p);max=Math.max(max,p);}
          this.triangleBounds[off+axis]=min;this.triangleBounds[off+axis+3]=max;
          this.globalMin[axis]=Math.min(this.globalMin[axis],min);this.globalMax[axis]=Math.max(this.globalMax[axis],max);
        }
        if(++this.cursor===n){this.phase='codes';this.cursor=0;}
      } else if(this.phase==='codes') {
        const xyz=[0,0,0];for(let axis=0;axis<3;axis++)xyz[axis]=Math.max(0,Math.min(1023,Math.floor(
          ((this.triangleBounds[i*6+axis]+this.triangleBounds[i*6+axis+3])*.5-this.globalMin[axis])/(this.globalMax[axis]-this.globalMin[axis]||1)*1023)));
        this.codes[i]=(spread(xyz[0])|(spread(xyz[1])<<1)|(spread(xyz[2])<<2))>>>0;this.order[i]=i;
        if(++this.cursor===n){this.phase='histogram';this.cursor=0;}
      } else if(this.phase==='histogram') {
        this.histogram[(this.codes[this.order[i]]>>>(this.pass*8))&255]++;
        if(++this.cursor===n){let sum=0;for(let b=0;b<256;b++){const count=this.histogram[b];this.histogram[b]=sum;sum+=count;}
          this.phase='scatter';this.cursor=0;}
      } else if(this.phase==='scatter') {
        const triangle=this.order[i],bucket=(this.codes[triangle]>>>(this.pass*8))&255;this.scratch[this.histogram[bucket]++]=triangle;
        if(++this.cursor===n){[this.order,this.scratch]=[this.scratch,this.order];this.histogram.fill(0);this.cursor=0;
          if(++this.pass===4){this.phase='tree';this.tasks=[{node:this.allocate(),first:0,count:n,cursor:0}];}else this.phase='histogram';}
      } else if(this.phase==='tree') {
        const task=this.tasks[this.tasks.length-1],node=task.node,triangle=this.order[task.first+task.cursor];
        for(let axis=0;axis<3;axis++) {this.bounds[node*6+axis]=Math.min(this.bounds[node*6+axis],this.triangleBounds[triangle*6+axis]);
          this.bounds[node*6+axis+3]=Math.max(this.bounds[node*6+axis+3],this.triangleBounds[triangle*6+axis+3]);}
        if(++task.cursor===task.count) {
          this.tasks.pop();
          if(task.count<=COLLISION_LEAF_TRIANGLES){this.nodes[node*4+2]=task.first;this.nodes[node*4+3]=task.count;}
          else {const half=Math.floor(task.count/2),left=this.allocate(),right=this.allocate();this.nodes[node*4]=left;this.nodes[node*4+1]=right;
            this.tasks.push({node:right,first:task.first+half,count:task.count-half,cursor:0},{node:left,first:task.first,count:half,cursor:0});}
          if(!this.tasks.length)this.finish();
        }
      }
    }
    return this.phase==='done';
  }
  private allocate(){const index=this.count++;for(let axis=0;axis<3;axis++){this.bounds[index*6+axis]=Infinity;this.bounds[index*6+axis+3]=-Infinity;}return index;}
  private finish(){this.phase='done';this.result=Object.freeze({bounds:this.bounds,nodes:this.nodes,triangles:this.order,nodeCount:this.count});}
}
export function bvhCandidates(bvh: PlanetVolumeCollisionBvh,min: Vec3,max: Vec3,visit: (triangle:number)=>void): number {
  if(!bvh.nodeCount)return 0;
  const stack=[0];let candidates=0;
  while(stack.length) {const node=stack.pop()!;let overlaps=true;
    for(let axis=0;axis<3;axis++)if(max[axis]<bvh.bounds[node*6+axis]||min[axis]>bvh.bounds[node*6+axis+3]){overlaps=false;break;}
    if(!overlaps)continue;
    const count=bvh.nodes[node*4+3];if(count>=0){for(let i=0;i<count;i++){visit(bvh.triangles[bvh.nodes[node*4+2]+i]);candidates++;}}
    else stack.push(bvh.nodes[node*4+1],bvh.nodes[node*4]);
  }
  return candidates;
}
