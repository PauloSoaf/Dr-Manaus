import type { PlanetVolumeChunk } from './PlanetVolumeChunk';
import type { PlanetVolumeChunkCache } from './PlanetVolumeChunkCache';
import { chunkKeyToString,type PlanetVolumeChunkKey } from './PlanetVolumeChunkKey';
import { volumeMeshByteLength,type PlanetVolumeMesh } from './PlanetVolumeMesh';

export const DEFAULT_VOLUME_MESH_LIMITS = Object.freeze({ maxMeshes: 8, maxBytes: 8*1024*1024 });
/** Derived mesh LRU. Source identity is required, since unaffected scalar chunks may have old revisions. */
export class PlanetVolumeMeshCache {
  private readonly entries=new Map<string,{source:PlanetVolumeChunk;mesh:PlanetVolumeMesh}>();
  private bytes=0;
  readonly limits: Readonly<{maxMeshes:number;maxBytes:number}>;
  constructor(limits:{maxMeshes:number;maxBytes:number}=DEFAULT_VOLUME_MESH_LIMITS) {
    if(!Number.isSafeInteger(limits.maxMeshes)||limits.maxMeshes<1||!Number.isSafeInteger(limits.maxBytes)||limits.maxBytes<1) {
      throw new RangeError('invalid volume mesh limits');
    }
    this.limits=Object.freeze({...limits});
  }
  get(source:PlanetVolumeChunk):PlanetVolumeMesh|undefined {
    const id=chunkKeyToString(source.key),entry=this.entries.get(id);
    if(!entry) return undefined;
    if(entry.source!==source||source.state!=='ready'||entry.mesh.sourceRevision!==source.sourceRevision
      ||entry.mesh.generationSignature!==source.generationSignature) {
      this.remove(source.key);return undefined;
    }
    this.entries.delete(id);this.entries.set(id,entry);return entry.mesh;
  }
  insert(source:PlanetVolumeChunk,mesh:PlanetVolumeMesh):boolean {
    const size=volumeMeshByteLength(mesh);
    if(source.state!=='ready'||source.sourceRevision!==mesh.sourceRevision
      ||source.generationSignature!==mesh.generationSignature
      ||chunkKeyToString(source.key)!==chunkKeyToString(mesh.key)||size>this.limits.maxBytes) return false;
    this.remove(source.key);
    while(this.entries.size>=this.limits.maxMeshes||this.bytes+size>this.limits.maxBytes) this.remove(this.entries.values().next().value!.source.key);
    this.entries.set(chunkKeyToString(source.key),{source,mesh});this.bytes+=size;return true;
  }
  remove(key:PlanetVolumeChunkKey):void {
    const id=chunkKeyToString(key),entry=this.entries.get(id);
    if(entry) {this.bytes-=volumeMeshByteLength(entry.mesh);this.entries.delete(id);}
  }
  prune(scalars:PlanetVolumeChunkCache,wanted?:ReadonlySet<string>):void {
    for(const [id,entry] of this.entries) {
      if(entry.source.state!=='ready'||scalars.peek(entry.source.key)!==entry.source||(wanted&&!wanted.has(id))) this.remove(entry.source.key);
    }
  }
  values():readonly PlanetVolumeMesh[] {return [...this.entries.values()].map(entry=>entry.mesh);}
  clearAll():void {this.entries.clear();this.bytes=0;}
  stats() {
    let vertices=0,triangles=0,ambiguousFaces=0;
    for(const {mesh} of this.entries.values()) {vertices+=mesh.vertexCount;triangles+=mesh.triangleCount;ambiguousFaces+=mesh.ambiguousFaceCount;}
    return {resident:this.entries.size,bytes:this.bytes,vertices,triangles,ambiguousFaces};
  }
}
