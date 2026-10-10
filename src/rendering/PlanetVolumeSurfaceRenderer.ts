import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, Vector3, type Object3D } from 'three/webgpu';
import { attribute,normalWorld, uniform } from 'three/tsl';
import type { ReferenceFrameGraph } from '../world/spatial/ReferenceFrameGraph';
import type { RenderSpaceService } from '../world/spatial/RenderSpaceService';
import { IDENTITY_QUAT, type Vec3 } from '../world/spatial/units';
import type { PlanetVolumePublication, PlanetVolumeReplacement } from '../world/planet/volume/PlanetVolumeReplacementCoverage';
import { volumeMeshByteLength, type PlanetVolumeMesh } from '../world/planet/volume/PlanetVolumeMesh';
import { PLANET_LAYER } from './domains/RenderDomains';
import type { CelestialBodyProfile } from '../world/celestial/CelestialBodyProfile';
import { chunkKeyToString } from '../world/planet/volume/PlanetVolumeChunkKey';
import { planetDirectLightNode,earthDirectLightNode,earthNightAmbientNode } from './PlanetVolumeLighting';
import type {PlanetSurfaceGenerator} from '../world/planet/PlanetSurface';

export interface PlanetVolumePresentationOptions {
  readonly solarDirection?:(bodyId:string)=>Vec3|undefined;
  readonly surface?:(bodyId:string)=>PlanetSurfaceGenerator|undefined;
  readonly prepareMasks?:(entries:readonly PlanetVolumeReplacement[])=>()=>void;
  readonly maskStats?:()=>{averageBounds:number;maxBounds:number;zeroTiles:number;maskedTiles:number};
}

/** Production presentation only. Mesh arrays and logical edits remain owned by the volume domain. */
export class PlanetVolumeSurfaceRenderer implements PlanetVolumePublication {
  readonly root=new Group();
  private active=new Map<PlanetVolumeMesh,Mesh>();
  private staged=new Map<PlanetVolumeMesh,Mesh>();
  private readonly materials=new Map<string,MeshBasicNodeMaterial>();
  private readonly lights=new Map<string,ReturnType<typeof uniform<'vec3'>>>();
  private retired:Mesh[]=[];
  private prepared?:{entries:readonly PlanetVolumeReplacement[];active:Map<PlanetVolumeMesh,Mesh>;add:Mesh[];remove:Mesh[];mask:()=>void};
  constructor(parent:Object3D,readonly frames:ReferenceFrameGraph,readonly renderSpace:RenderSpaceService,
    private readonly profile:(id:string)=>CelestialBodyProfile,
    private readonly publishMask:(entries:readonly PlanetVolumeReplacement[])=>void,
    private readonly options:PlanetVolumePresentationOptions={}) {
    this.root.name='Published planetary volume surfaces';this.root.layers.set(PLANET_LAYER);parent.add(this.root);
  }
  prepare(entries:readonly PlanetVolumeReplacement[]):boolean {
    const payloads=entries.flatMap(e=>e.mesh?[e.mesh]:[]);
    if(entries.length>128||payloads.reduce((sum,m)=>sum+this.presentationBytes(m),0)>16*1048576)return false;
    const wanted=new Set(payloads);
    for(const [source,mesh] of this.staged)if(!wanted.has(source)){mesh.geometry.dispose();this.staged.delete(source);}
    for(const entry of entries)if(!this.prepareOne(entry))return false;
    const active=new Map<PlanetVolumeMesh,Mesh>();const add:Mesh[]=[],remove:Mesh[]=[];
    for(const source of payloads){const mesh=this.active.get(source)??this.staged.get(source)!;active.set(source,mesh);
      this.place(source,mesh);if(!this.active.has(source))add.push(mesh);}
    for(const [source,mesh] of this.active)if(!active.has(source))remove.push(mesh);
    this.prepared={entries,active,add,remove,mask:this.options.prepareMasks?.(entries)??(()=>this.publishMask(entries))};
    return true;
  }
  retainStaged(keys:ReadonlySet<string>):void {
    for(const [source,mesh] of this.staged)if(!keys.has(chunkKeyToString(source.key))){mesh.geometry.dispose();this.staged.delete(source);}
  }
  prepareOne(entry:PlanetVolumeReplacement):boolean {
    const source=entry.mesh;if(!source)return true;
    if(this.active.has(source)||this.staged.has(source))return true;
    for(const [prior,mesh] of this.staged)if(prior!==source&&chunkKeyToString(prior.key)===chunkKeyToString(source.key)){
      mesh.geometry.dispose();this.staged.delete(prior);
    }
    if(this.staged.size>=128||this.stats.bytes+this.presentationBytes(source)>32*1048576)return false;
    {
      const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(source.positions,3));
      geometry.setAttribute('normal',new BufferAttribute(source.normals,3));geometry.setIndex(new BufferAttribute(source.indices,1));
      geometry.computeBoundingSphere();geometry.computeBoundingBox();
      const surface=this.options.surface?.(source.key.bodyId);
      if(surface){const colours=new Float32Array(source.vertexCount*3),direction:Vec3=[0,0,0],colour:Vec3=[0,0,0];
        for(let i=0;i<source.vertexCount;i++){for(let a=0;a<3;a++)direction[a]=source.originBodyFixedM[a]+source.positions[i*3+a];
          const length=Math.hypot(...direction);for(let a=0;a<3;a++)direction[a]/=length;surface.colourAt(direction,colour);colours.set(colour,i*3);}
        geometry.setAttribute('color',new BufferAttribute(colours,3));}
      let material=this.materials.get(source.key.bodyId);
      if(!material){const p=this.profile(source.key.bodyId),color=p.surfaceKind==='earth'?0x765b3e:
        p.surfaceKind==='moon'?0x9a9ca1:p.surfaceKind==='mars'?0xa65331:new Vector3(...p.visual.albedo);
        material=new MeshBasicNodeMaterial({color:color instanceof Vector3?undefined:color,side:DoubleSide,fog:false});
        if(color instanceof Vector3)material.color.setRGB(color.x,color.y,color.z);
        const sun=uniform(new Vector3());this.lights.set(source.key.bodyId,sun);
        const dot=normalWorld.dot(sun);
        const albedo=surface?attribute('color','vec3'):uniform(material.color);
        material.colorNode=p.surfaceKind==='earth'?albedo.mul(earthDirectLightNode(dot)).add(earthNightAmbientNode())
          :albedo.mul(planetDirectLightNode(dot));
        this.materials.set(source.key.bodyId,material);}
      const mesh=new Mesh(geometry,material);mesh.name=`impact-volume:${source.key.bodyId}:${source.key.x},${source.key.y},${source.key.z}`;
      mesh.layers.set(PLANET_LAYER);mesh.frustumCulled=true;mesh.userData.volumeSource=source;this.staged.set(source,mesh);
    }
    return true;
  }
  private presentationBytes(source:PlanetVolumeMesh):number {return volumeMeshByteLength(source)+(this.options.surface?.(source.key.bodyId)?source.vertexCount*12:0);}
  commit(entries:readonly PlanetVolumeReplacement[]):void {
    const plan=this.prepared;if(!plan||plan.entries!==entries)throw new Error('volume presentation was not prepared');
    for(const mesh of plan.remove){this.root.remove(mesh);this.retired.push(mesh);}
    for(const mesh of plan.add)this.root.add(mesh);
    this.active=plan.active;for(const source of this.active.keys())this.staged.delete(source);
    plan.mask();this.prepared=undefined;
  }
  isPrepared(entries:readonly PlanetVolumeReplacement[]):boolean {return this.prepared?.entries===entries;}
  private place(source:PlanetVolumeMesh,mesh:Mesh):void {const alias=`${source.key.bodyId}/fixed`,
      fixed=this.frames.has(alias)?alias:`solar-system/${source.key.bodyId}-fixed`;
      if(!this.frames.has(fixed) || !this.frames.lowestCommonAncestor(fixed,this.renderSpace.currentOrigin.frame)){
        mesh.visible=false;return;
      }
      const position=this.renderSpace.logicalToRender(fixed,[...source.originBodyFixedM] as Vec3);
      mesh.visible=this.renderSpace.isRenderSafe(position);
      if(mesh.visible){mesh.position.set(...position);mesh.quaternion.set(...this.frames.convertOrientation(fixed,this.renderSpace.currentOrigin.frame,IDENTITY_QUAT));}}
  update():void {
    for(const [id,node] of this.lights){const direction=this.options.solarDirection?.(id);
      node.value.set(...(direction?.every(Number.isFinite)?direction:[0,0,0]) as Vec3);if(node.value.lengthSq()>0)node.value.normalize();}
    for(const [source,mesh] of this.active)this.place(source,mesh);
    for(let i=0;i<2&&this.retired.length;i++)this.retired.shift()!.geometry.dispose();
  }
  clear():void {for(const mesh of [...this.active.values(),...this.staged.values(),...this.retired]){this.root.remove(mesh);mesh.geometry.dispose();}
    this.active.clear();this.staged.clear();this.retired=[];this.prepared=undefined;this.publishMask([]);}
  get stats(){return {meshes:this.active.size,staged:this.staged.size,
    bytes:[...this.active.keys(),...this.staged.keys(),...this.retired.map(m=>m.userData.volumeSource as PlanetVolumeMesh)].reduce((sum,m)=>sum+this.presentationBytes(m),0),
    retired:this.retired.length,lights:Object.fromEntries([...this.lights].map(([id,n])=>[id,n.value.toArray()])),
    masks:this.options.maskStats?.()};}
  dispose():void {this.clear();for(const material of this.materials.values())material.dispose();this.root.removeFromParent();}
}
