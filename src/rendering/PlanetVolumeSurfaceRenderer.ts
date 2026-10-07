import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, Vector3, type Object3D } from 'three/webgpu';
import { normalWorld, uniform } from 'three/tsl';
import type { ReferenceFrameGraph } from '../world/spatial/ReferenceFrameGraph';
import type { RenderSpaceService } from '../world/spatial/RenderSpaceService';
import { IDENTITY_QUAT, type Vec3 } from '../world/spatial/units';
import type { PlanetVolumePublication, PlanetVolumeReplacement } from '../world/planet/volume/PlanetVolumeReplacementCoverage';
import { volumeMeshByteLength, type PlanetVolumeMesh } from '../world/planet/volume/PlanetVolumeMesh';
import { PLANET_LAYER } from './domains/RenderDomains';
import type { CelestialBodyProfile } from '../world/celestial/CelestialBodyProfile';
import { chunkKeyToString } from '../world/planet/volume/PlanetVolumeChunkKey';

/** Production presentation only. Mesh arrays and logical edits remain owned by the volume domain. */
export class PlanetVolumeSurfaceRenderer implements PlanetVolumePublication {
  readonly root=new Group();
  private active=new Map<PlanetVolumeMesh,Mesh>();
  private staged=new Map<PlanetVolumeMesh,Mesh>();
  private readonly materials=new Map<string,MeshBasicNodeMaterial>();
  constructor(parent:Object3D,readonly frames:ReferenceFrameGraph,readonly renderSpace:RenderSpaceService,
    private readonly profile:(id:string)=>CelestialBodyProfile,
    private readonly publishMask:(entries:readonly PlanetVolumeReplacement[])=>void) {
    this.root.name='Published planetary volume surfaces';this.root.layers.set(PLANET_LAYER);parent.add(this.root);
  }
  prepare(entries:readonly PlanetVolumeReplacement[]):boolean {
    const payloads=entries.flatMap(e=>e.mesh?[e.mesh]:[]);
    if(entries.length>128||payloads.reduce((sum,m)=>sum+volumeMeshByteLength(m),0)>16*1048576)return false;
    const wanted=new Set(payloads);
    for(const [source,mesh] of this.staged)if(!wanted.has(source)){mesh.geometry.dispose();this.staged.delete(source);}
    for(const entry of entries)if(!this.prepareOne(entry))return false;
    return true;
  }
  retainStaged(keys:ReadonlySet<string>):void {
    for(const [source,mesh] of this.staged)if(!keys.has(chunkKeyToString(source.key))){mesh.geometry.dispose();this.staged.delete(source);}
  }
  prepareOne(entry:PlanetVolumeReplacement):boolean {
    const source=entry.mesh;if(!source)return true;
    for(const [prior,mesh] of this.staged)if(prior!==source&&chunkKeyToString(prior.key)===chunkKeyToString(source.key)){
      mesh.geometry.dispose();this.staged.delete(prior);
    }
    if(this.active.has(source)||this.staged.has(source))return true;
    if(this.staged.size>=128||this.stats.bytes+volumeMeshByteLength(source)>32*1048576)return false;
    {
      const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(source.positions,3));
      geometry.setAttribute('normal',new BufferAttribute(source.normals,3));geometry.setIndex(new BufferAttribute(source.indices,1));
      geometry.computeBoundingSphere();geometry.computeBoundingBox();
      let material=this.materials.get(source.key.bodyId);
      if(!material){const p=this.profile(source.key.bodyId),color=p.surfaceKind==='earth'?0x765b3e:
        p.surfaceKind==='moon'?0x9a9ca1:p.surfaceKind==='mars'?0xa65331:new Vector3(...p.visual.albedo);
        material=new MeshBasicNodeMaterial({color:color instanceof Vector3?undefined:color,side:DoubleSide,fog:false});
        if(color instanceof Vector3)material.color.setRGB(color.x,color.y,color.z);
        material.colorNode=uniform(material.color).mul(normalWorld.dot(uniform(new Vector3(.3,.8,.5).normalize())).mul(.35).add(.65).max(.3));
        this.materials.set(source.key.bodyId,material);}
      const mesh=new Mesh(geometry,material);mesh.name=`impact-volume:${source.key.bodyId}:${source.key.x},${source.key.y},${source.key.z}`;
      mesh.layers.set(PLANET_LAYER);mesh.frustumCulled=false;mesh.userData.volumeSource=source;this.staged.set(source,mesh);
    }
    return true;
  }
  commit(entries:readonly PlanetVolumeReplacement[]):void {
    const wanted=new Set(entries.flatMap(e=>e.mesh?[e.mesh]:[]));
    for(const [source,mesh] of this.active)if(!wanted.has(source)){this.root.remove(mesh);mesh.geometry.dispose();this.active.delete(source);}
    for(const source of wanted)if(!this.active.has(source)){
      const mesh=this.staged.get(source)!;this.staged.delete(source);this.active.set(source,mesh);this.root.add(mesh);
    }
    this.publishMask(entries);this.update();
  }
  update():void {
    for(const [source,mesh] of this.active){const alias=`${source.key.bodyId}/fixed`,
      fixed=this.frames.has(alias)?alias:`solar-system/${source.key.bodyId}-fixed`;
      const position=this.renderSpace.logicalToRender(fixed,[...source.originBodyFixedM] as Vec3);
      mesh.visible=this.renderSpace.isRenderSafe(position);
      if(mesh.visible){mesh.position.set(...position);mesh.quaternion.set(...this.frames.convertOrientation(fixed,this.renderSpace.currentOrigin.frame,IDENTITY_QUAT));}
    }
  }
  clear():void {for(const mesh of [...this.active.values(),...this.staged.values()]){this.root.remove(mesh);mesh.geometry.dispose();}
    this.active.clear();this.staged.clear();this.publishMask([]);}
  get stats(){return {meshes:this.active.size,staged:this.staged.size,
    bytes:[...this.active.keys(),...this.staged.keys()].reduce((sum,m)=>sum+volumeMeshByteLength(m),0)};}
  dispose():void {this.clear();for(const material of this.materials.values())material.dispose();this.root.removeFromParent();}
}
