import {Mesh,MeshBasicNodeMaterial,Vector3} from 'three/webgpu';
import {bool,Fn,Loop,positionLocal,uniform,uniformArray} from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';
import type {Vec3} from '../world/spatial/units';
import type {PlanetVolumeReplacement} from '../world/planet/volume/PlanetVolumeReplacementCoverage';
import {planetVolumeBoundsIntersect,type PlanetVolumeBounds} from '../world/planet/volume/PlanetVolumeEdit';

const ZERO=new Vector3();
const emptyArray=()=>Array.from({length:128},()=>ZERO);
type MaskData={low:Vector3[];high:Vector3[];count:number};
type TileMask={centre:Vec3;bounds:PlanetVolumeBounds;material:MeshBasicNodeMaterial;original:MeshBasicNodeMaterial;
  low:ReturnType<typeof uniformArray<'vec3'>>;high:ReturnType<typeof uniformArray<'vec3'>>;count:ReturnType<typeof uniform<'int'>>};
type MaskPlan={entries:readonly PlanetVolumeReplacement[];tiles:Map<Mesh,MaskData>};

/** Float64 CPU intersection; each tile loops only over its own published chunk bounds. */
export class PlanetVolumeSurfaceMask {
  private readonly tiles=new Map<Mesh,TileMask>();
  private active:readonly PlanetVolumeReplacement[]=[];
  private prepared?:MaskPlan;
  constructor(readonly bodyId:string) {}
  attach(mesh:Mesh,centre:Vec3):void {
    const original=mesh.material;
    if(!(original instanceof MeshBasicNodeMaterial))throw new Error('planet mask requires the existing node material');
    mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox!;
    const low=uniformArray<'vec3'>(emptyArray(),'vec3'),high=uniformArray<'vec3'>(emptyArray(),'vec3'),count=uniform(0,'int'),material=original.clone();
    const mask=Fn(()=>{const intact=bool(true).toVar();
      Loop({start:0,end:count,type:'int'},({i})=>{const inside=positionLocal.greaterThanEqual(low.element(i)).all()
        .and(positionLocal.lessThan(high.element(i)).all());intact.assign(intact.and(inside.not()));});return intact;})();
    material.maskNode=material.maskNode?bool(material.maskNode as Node<'bool'>).and(mask):mask;
    material.maskShadowNode=material.maskNode;material.name=`${this.bodyId}:published-volume-mask`;mesh.material=material;
    const tile:TileMask={centre:[...centre] as Vec3,material,original,low,high,count,
      bounds:{minBodyFixedM:[box.min.x+centre[0],box.min.y+centre[1],box.min.z+centre[2]],
        maxBodyFixedM:[box.max.x+centre[0],box.max.y+centre[1],box.max.z+centre[2]]}};
    this.tiles.set(mesh,tile);this.apply(tile,this.data(tile,this.active));
    // Tiles streamed between prepare and commit receive both states before the boundary.
    if(this.prepared)this.prepared.tiles.set(mesh,this.data(tile,this.prepared.entries));
    mesh.userData.volumeReplacementMask=this;
  }
  detach(mesh:Mesh):void {const tile=this.tiles.get(mesh);if(tile){mesh.material=tile.original;tile.material.dispose();}
    this.tiles.delete(mesh);this.prepared?.tiles.delete(mesh);delete mesh.userData.volumeReplacementMask;}
  private data(tile:TileMask,entries:readonly PlanetVolumeReplacement[]):MaskData {
    const selected=entries.filter(e=>planetVolumeBoundsIntersect(tile.bounds,e.source.boundsBodyFixedM));
    const low=emptyArray(),high=emptyArray();
    for(let i=0;i<selected.length;i++){const b=selected[i].source.boundsBodyFixedM;
      low[i]=new Vector3(...b.minBodyFixedM.map((v,a)=>v-tile.centre[a]) as Vec3);
      high[i]=new Vector3(...b.maxBodyFixedM.map((v,a)=>v-tile.centre[a]) as Vec3);}
    return {low,high,count:selected.length};
  }
  private apply(tile:TileMask,data:MaskData):void {tile.low.array=data.low;tile.high.array=data.high;tile.count.value=data.count;}
  /** Filtering/array construction happens before publication; commit swaps uniform references. */
  prepareUpdate(entries:readonly PlanetVolumeReplacement[]):()=>void {
    const selected=entries.filter(e=>e.source.key.bodyId===this.bodyId);
    if(selected.length>128)throw new Error('published mask exceeds bounded replacement capacity');
    const plan:MaskPlan={entries:selected,tiles:new Map([...this.tiles].map(([mesh,tile])=>[mesh,this.data(tile,selected)]))};
    this.prepared=plan;
    return ()=>{if(this.prepared!==plan)throw new Error('obsolete prepared volume mask');
      for(const [mesh,data] of plan.tiles){const tile=this.tiles.get(mesh);if(tile)this.apply(tile,data);}
      this.active=plan.entries;this.prepared=undefined;};
  }
  update(entries:readonly PlanetVolumeReplacement[]):void {this.prepareUpdate(entries)();}
  get publishedCount(){return this.active.length;}
  get stats(){const counts=[...this.tiles.values()].map(t=>t.count.value),sum=counts.reduce((s,n)=>s+n,0);
    return {published:this.active.length,tiles:counts.length,averageBounds:counts.length?sum/counts.length:0,
      maxBounds:Math.max(0,...counts),zeroTiles:counts.filter(n=>!n).length,maskedTiles:counts.filter(n=>n>0).length};}
  dispose():void {for(const mesh of [...this.tiles.keys()])this.detach(mesh);this.active=[];this.prepared=undefined;}
}
