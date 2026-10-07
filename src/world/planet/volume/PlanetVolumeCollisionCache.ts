import type { PlanetVolumeCollider } from './PlanetVolumeCollider';
import { chunkKeyToString, type PlanetVolumeChunkKey } from './PlanetVolumeChunkKey';
import { planetVolumeBoundsIntersect, type PlanetVolumeBounds } from './PlanetVolumeEdit';
export const DEFAULT_VOLUME_COLLISION_LIMITS=Object.freeze({maxColliders:8,maxBytes:8*1024*1024});
type ChunkNode={bounds:PlanetVolumeBounds;left?:ChunkNode;right?:ChunkNode;collider?:PlanetVolumeCollider};

/** Single authority per chunk; old collider ownership survives scalar/visual invalidation.
 * Spatial chunk tree changes only on install/retirement, never scans all chunks per query. */
export class PlanetVolumeCollisionCache {
  private readonly entries=new Map<string,PlanetVolumeCollider>();
  private tree?: ChunkNode;
  private bytes=0;
  readonly limits:Readonly<{maxColliders:number;maxBytes:number}>;
  constructor(limits:{maxColliders:number;maxBytes:number}=DEFAULT_VOLUME_COLLISION_LIMITS){
    if(!Number.isSafeInteger(limits.maxColliders)||limits.maxColliders<1||limits.maxColliders>128
      ||!Number.isSafeInteger(limits.maxBytes)||limits.maxBytes<1)throw new RangeError('invalid collision cache limits');
    this.limits=Object.freeze({...limits});
  }
  peek(key:PlanetVolumeChunkKey){return this.entries.get(chunkKeyToString(key));}
  get(key:PlanetVolumeChunkKey){const id=chunkKeyToString(key),c=this.entries.get(id);if(c){this.entries.delete(id);this.entries.set(id,c);}return c;}
  insert(c:PlanetVolumeCollider):boolean {
    if(c.memory.bytes>this.limits.maxBytes)return false;
    const id=chunkKeyToString(c.key),old=this.entries.get(id),size=this.bytes-(old?.memory.bytes??0);
    let required=size+c.memory.bytes;
    // Validate first, then a synchronous atomic install; never clear the old source prematurely.
    for(const [other,entry] of this.entries) {
      if(other===id)continue;
      if(required<=this.limits.maxBytes&&this.entries.size-(old?1:0)<this.limits.maxColliders)break;
      this.entries.delete(other);this.bytes-=entry.memory.bytes;required-=entry.memory.bytes;
    }
    this.bytes-=old?.memory.bytes??0;this.entries.delete(id);this.entries.set(id,c);this.bytes+=c.memory.bytes;
    this.reindex();return true;
  }
  /** One synchronous validated window swap and one spatial-index rebuild. */
  replaceAll(colliders:readonly PlanetVolumeCollider[]):boolean {
    const ids=new Set(colliders.map(c=>chunkKeyToString(c.key))),bytes=colliders.reduce((sum,c)=>sum+c.memory.bytes,0);
    if(ids.size!==colliders.length||colliders.length>this.limits.maxColliders||bytes>this.limits.maxBytes)return false;
    this.entries.clear();for(const c of colliders)this.entries.set(chunkKeyToString(c.key),c);
    this.bytes=bytes;this.reindex();return true;
  }
  remove(key:PlanetVolumeChunkKey){const id=chunkKeyToString(key),old=this.entries.get(id);if(!old)return false;
    this.bytes-=old.memory.bytes;this.entries.delete(id);this.reindex();return true;}
  clearBody(bodyId:string){for(const c of this.values())if(c.bodyId===bodyId)this.remove(c.key);}
  clearAll(){this.entries.clear();this.bytes=0;this.tree=undefined;}
  prune(wanted:ReadonlySet<string>){for(const [id,c] of this.entries)if(!wanted.has(id))this.remove(c.key);}
  values(){return [...this.entries.values()];}
  query(bounds:PlanetVolumeBounds,lod:number,visit:(collider:PlanetVolumeCollider)=>void):number {
    const stack=this.tree?[this.tree]:[];let candidates=0;
    while(stack.length){const n=stack.pop()!;if(!planetVolumeBoundsIntersect(bounds,n.bounds))continue;
      if(n.collider){if(n.collider.key.lod===lod){this.get(n.collider.key);visit(n.collider);candidates++;}}
      else {if(n.right)stack.push(n.right);if(n.left)stack.push(n.left);}}
    return candidates;
  }
  stats(){let triangles=0,nodes=0,sharedBytes=0,nodeBytes=0,referenceBytes=0,metadataBytes=0;
    for(const c of this.entries.values()){triangles+=c.triangleCount;nodes+=c.bvh.nodeCount;sharedBytes+=c.memory.sharedBytes;
      nodeBytes+=c.memory.nodeBytes;referenceBytes+=c.memory.referenceBytes;metadataBytes+=c.memory.metadataBytes;}
    return {resident:this.entries.size,bytes:this.bytes,triangles,nodes,sharedBytes,nodeBytes,referenceBytes,metadataBytes};}
  private reindex(){
    const build=(colliders:PlanetVolumeCollider[]):ChunkNode=>{
      if(colliders.length===1)return {bounds:colliders[0].boundsBodyFixedM,collider:colliders[0]};
      const min:[number,number,number]=[Infinity,Infinity,Infinity],max:[number,number,number]=[-Infinity,-Infinity,-Infinity];
      for(const c of colliders)for(let a=0;a<3;a++){min[a]=Math.min(min[a],c.boundsBodyFixedM.minBodyFixedM[a]);max[a]=Math.max(max[a],c.boundsBodyFixedM.maxBodyFixedM[a]);}
      let axis=0;for(let a=1;a<3;a++)if(max[a]-min[a]>max[axis]-min[axis])axis=a;
      colliders.sort((a,b)=>a.boundsBodyFixedM.minBodyFixedM[axis]-b.boundsBodyFixedM.minBodyFixedM[axis]
        ||chunkKeyToString(a.key).localeCompare(chunkKeyToString(b.key)));
      const mid=Math.floor(colliders.length/2);return {bounds:{minBodyFixedM:min,maxBodyFixedM:max},left:build(colliders.slice(0,mid)),right:build(colliders.slice(mid))};
    };
    const colliders=this.values();this.tree=colliders.length?build(colliders):undefined;
  }
}
