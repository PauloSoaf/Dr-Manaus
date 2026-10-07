import { Mesh, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu';
import { bool, Fn, Loop, positionLocal, uniform, uniformArray } from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';
import type { Vec3 } from '../world/spatial/units';
import type { PlanetVolumeReplacement } from '../world/planet/volume/PlanetVolumeReplacementCoverage';

/** Bounded body-fixed replacement windows. Coordinates are tile-local shader offsets. */
export class PlanetVolumeSurfaceMask {
  private readonly low=uniformArray<'vec3'>(Array.from({length:128},()=>new Vector3()),'vec3');
  private readonly high=uniformArray<'vec3'>(Array.from({length:128},()=>new Vector3()),'vec3');
  private readonly count=uniform(0,'int');
  private anchor:Vec3=[0,0,0];
  private readonly tiles=new Map<Mesh,{centre:Vec3;offset:{value:Vector3};material:MeshBasicNodeMaterial}>();
  constructor(readonly bodyId:string) {}
  attach(mesh:Mesh,centre:Vec3):void {
    const original=mesh.material;
    if(!(original instanceof MeshBasicNodeMaterial))throw new Error('planet mask requires the existing node material');
    const material=original.clone(),offset=uniform(new Vector3(...centre.map((v,i)=>v-this.anchor[i]) as Vec3));
    const mask=Fn(()=>{
      const p=positionLocal.add(offset),intact=bool(true).toVar();
      Loop({start:0,end:this.count,type:'int'},({i})=>{
        const inside=p.greaterThanEqual(this.low.element(i)).all().and(p.lessThan(this.high.element(i)).all());
        intact.assign(intact.and(inside.not()));
      });
      return intact;
    })();
    material.maskNode=material.maskNode?bool(material.maskNode as Node<'bool'>).and(mask):mask;
    material.maskShadowNode=material.maskNode;material.name=`${this.bodyId}:published-volume-mask`;
    mesh.material=material;this.tiles.set(mesh,{centre:[...centre] as Vec3,offset,material});
    mesh.userData.volumeReplacementMask=this;
  }
  detach(mesh:Mesh):void {this.tiles.get(mesh)?.material.dispose();this.tiles.delete(mesh);}
  update(entries:readonly PlanetVolumeReplacement[]):void {
    const selected=entries.filter(e=>e.source.key.bodyId===this.bodyId);
    if(selected.length>128)throw new Error('published mask exceeds bounded replacement capacity');
    this.count.value=selected.length;
    this.anchor=selected.length?[...selected[0].source.originBodyFixedM] as Vec3:[0,0,0];
    for(let i=0;i<selected.length;i++){
      const bounds=selected[i].source.boundsBodyFixedM;
      (this.low.array[i] as Vector3).set(...bounds.minBodyFixedM.map((v,a)=>v-this.anchor[a]) as Vec3);
      (this.high.array[i] as Vector3).set(...bounds.maxBodyFixedM.map((v,a)=>v-this.anchor[a]) as Vec3);
    }
    for(const tile of this.tiles.values())tile.offset.value.set(...tile.centre.map((v,i)=>v-this.anchor[i]) as Vec3);
  }
  get publishedCount(){return this.count.value;}
  dispose():void {for(const mesh of [...this.tiles.keys()])this.detach(mesh);}
}
