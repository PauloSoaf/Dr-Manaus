import {BufferGeometry,Color,DoubleSide,FrontSide,Float32BufferAttribute,Group,Mesh,MeshBasicNodeMaterial,ShapeUtils,Vector2,Vector3} from 'three/webgpu';
import {attribute,normalWorld,uniform} from 'three/tsl';
import type {WaterFile} from './WaterSystem';
import {earthDirectLightNode,earthNightAmbientNode} from './PlanetVolumeLighting';
import {PLANET_LAYER} from './domains/RenderDomains';
import {EARTH_FIXED_FRAME_ID,legacyLocalToGeodetic,MANAUS_ANCHOR_ECEF} from '../world/spatial/ManausFrameAdapter';
import {geodeticToEcef} from '../world/spatial/ECEF';
import type {ReferenceFrameGraph} from '../world/spatial/ReferenceFrameGraph';
import type {RenderSpaceService} from '../world/spatial/RenderSpaceService';
import type {Vec3} from '../world/spatial/units';
import {surfaceHeightAt} from '../world/planet/EarthElevation';

export const MANAUS_AERIAL=Object.freeze({startM:8000,fullM:12000,massFadeStartM:25000,massFadeEndM:40000,
  regionSizeM:40000,fadePixels:80,fullPixels:180,chunkM:16000,maxMeshes:256,maxBytes:32*1048576,
  maxRiverTriangles:120000,maxUrbanCells:8000,maxRoadSegments:20000,maxEdgeM:2000,renderLimitM:20000000});
export interface ManausAerialData {version:number;tileSize:number;skyline:Record<string,number[]>;
  roads:readonly {class:string;width:number;p:number[]}[];}
type Kind='river'|'urban'|'mass'|'roads';
type Point=[number,number,number];
const smooth=(lo:number,hi:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return t*t*(3-2*t);};
export function manausAerialWeights(altitudeM:number,distanceM:number,fovRad:number,viewportHeightPx:number,ready:boolean) {
  const pixels=MANAUS_AERIAL.regionSizeM*Math.max(1,viewportHeightPx)/(2*Math.tan(fovRad/2)*Math.max(1,distanceM));
  const altFade=ready?smooth(MANAUS_AERIAL.startM,MANAUS_AERIAL.fullM,altitudeM):0;
  const pixelFadeB=smooth(MANAUS_AERIAL.fadePixels,MANAUS_AERIAL.fullPixels,pixels);
  const opacity=altFade*pixelFadeB;
  const mass=opacity*(1-smooth(MANAUS_AERIAL.massFadeStartM,MANAUS_AERIAL.massFadeEndM,altitudeM));
  const farPixelFade=1-pixelFadeB;
  const farDistanceLimit=distanceM<MANAUS_AERIAL.renderLimitM?1:0;
  const farOpacity=altFade*farPixelFade*farDistanceLimit;
  return {opacity,mass,farOpacity,pixels};
}
/** All source coordinates take the existing legacy -> geodetic -> WGS84 path. */
export function aerialBodyPoint(x:number,z:number,heightM=0):Vec3 {
  const geo=legacyLocalToGeodetic(x,0,z);
  geo.heightM=surfaceHeightAt(geo.latRad,geo.lonRad)+16+heightM;
  const p=geodeticToEcef(geo);return [p.xM,p.yM,p.zM];
}
interface Part {kind:Kind;centre:Vec3;geometry:BufferGeometry;triangles:number;bytes:number;}
/** Bounded merged chunks. Float32 stores offsets only; ECEF centres remain JS doubles. */
export function buildManausAerial(water:WaterFile,data:ManausAerialData):Part[] {
  const buckets=new Map<string,{kind:Kind;centre:Vec3;p:number[];n:number[];c:number[]}>();
  const counts={river:0,urban:0,mass:0,roads:0};
  const emit=(kind:Kind,points:readonly Point[],colour:Color)=>{
    counts[kind]++;if(kind==='river'&&counts.river>MANAUS_AERIAL.maxRiverTriangles)throw new Error('Aerial river triangle budget');
    const x=points.reduce((s,p)=>s+p[0],0)/3,z=points.reduce((s,p)=>s+p[2],0)/3;
    const cx=Math.floor(x/MANAUS_AERIAL.chunkM),cz=Math.floor(z/MANAUS_AERIAL.chunkM),key=`${kind}/${cx}/${cz}`;
    let b=buckets.get(key);if(!b){if(buckets.size>=MANAUS_AERIAL.maxMeshes)throw new Error('Aerial mesh budget');
      b={kind,centre:aerialBodyPoint((cx+.5)*MANAUS_AERIAL.chunkM,(cz+.5)*MANAUS_AERIAL.chunkM),p:[],n:[],c:[]};buckets.set(key,b);}
    const vertices=points.map(p=>new Vector3(...aerialBodyPoint(p[0],p[2],p[1])));
    const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
    if(kind!=='mass'&&normal.dot(vertices[0])<0){[vertices[1],vertices[2]]=[vertices[2],vertices[1]];normal.negate();}
    for(const v of vertices){b.p.push(v.x-b.centre[0],v.y-b.centre[1],v.z-b.centre[2]);b.n.push(normal.x,normal.y,normal.z);b.c.push(colour.r,colour.g,colour.b);}
    const triangles=counts.river+counts.urban+counts.mass+counts.roads;
    if(triangles*3*36>MANAUS_AERIAL.maxBytes)throw new Error('Aerial geometry byte budget');
  };
  const quad=(kind:Kind,a:Point,b:Point,c:Point,d:Point,colour:Color)=>{emit(kind,[a,b,c],colour);emit(kind,[a,c,d],colour);};
  const dark=new Color('#102c30'),muddy=new Color('#92774d');
  for(const polygon of water.polygons) {
    if(!polygon.rings[0]?.length)continue;
    const rings=polygon.rings.map(r=>{const p:Vector2[]=[];for(let i=0;i<r.length;i+=2)p.push(new Vector2(r[i],r[i+1]));return p;});
    const faces=ShapeUtils.triangulateShape(rings[0],rings.slice(1)),points=rings.flat();
    const colour=polygon.muddy?muddy:dark;
    for(const face of faces) {
      const stack:Point[][]=[face.map(i=>[points[i].x,0,points[i].y] as Point)];
      while(stack.length){const tri=stack.pop()!,lengths=tri.map((p,i)=>(p[0]-tri[(i+1)%3][0])**2+(p[2]-tri[(i+1)%3][2])**2);
        const edge=lengths.indexOf(Math.max(...lengths));
        if(lengths[edge]>MANAUS_AERIAL.maxEdgeM**2){const a=tri[edge],b=tri[(edge+1)%3],c=tri[(edge+2)%3],m:Point=[(a[0]+b[0])/2,0,(a[2]+b[2])/2];
          stack.push([a,m,c],[m,b,c]);}else emit('river',tri,colour);
      }
    }
  }
  let cells=0;
  for(const [key,blocks] of Object.entries(data.skyline)) {
    const [tx,tz]=key.split(',').map(Number);
    for(let i=0;i+7<blocks.length;i+=8){if(++cells>MANAUS_AERIAL.maxUrbanCells)throw new Error('Aerial urban cell budget');
      const x=tx*data.tileSize+blocks[i],z=tz*data.tileSize+blocks[i+1],w=blocks[i+2]/2,d=blocks[i+3]/2,h=blocks[i+4];
      const colour=new Color().setRGB(.42+blocks[i+5]*.25,.40+blocks[i+6]*.25,.36+blocks[i+7]*.25).convertSRGBToLinear();
      const base:Point[]=[[x-w,4,z-d],[x-w,4,z+d],[x+w,4,z+d],[x+w,4,z-d]],roof=base.map(p=>[p[0],p[1]+h,p[2]] as Point);
      quad('urban',...base as [Point,Point,Point,Point],colour);quad('mass',...roof as [Point,Point,Point,Point],colour);
      for(let j=0;j<4;j++)quad('mass',base[j],base[(j+1)%4],roof[(j+1)%4],roof[j],colour);
    }
  }
  let segments=0;const roadColour=new Color('#a9ac9e');
  for(const road of data.roads)for(let i=2;i<road.p.length;i+=2) {
    if(++segments>MANAUS_AERIAL.maxRoadSegments)throw new Error('Aerial road segment budget');
    const ax=road.p[i-2],az=road.p[i-1],bx=road.p[i],bz=road.p[i+1],len=Math.hypot(bx-ax,bz-az);if(len<1)continue;
    const ox=-(bz-az)/len*road.width/2,oz=(bx-ax)/len*road.width/2;
    quad('roads',[ax+ox,8,az+oz],[bx+ox,8,bz+oz],[bx-ox,8,bz-oz],[ax-ox,8,az-oz],roadColour);
  }
  return [...buckets.values()].map(b=>{
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(b.p,3));
    geometry.setAttribute('normal',new Float32BufferAttribute(b.n,3));geometry.setAttribute('color',new Float32BufferAttribute(b.c,3));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return {kind:b.kind,centre:b.centre,geometry,triangles:b.p.length/9,bytes:(b.p.length+b.n.length+b.c.length)*4};
  });
}
export class ManausAerialPresentation {
  readonly root=new Group();readonly presentationOnly=true;
  ready=false;failure='';waterSource?:WaterFile;
  private readonly parts:{part:Part;mesh:Mesh}[]=[];
  private readonly sun=uniform(new Vector3(0,1,0));
  private readonly materials=new Map<Kind,MeshBasicNodeMaterial>();
  private readonly opacity=uniform(0);private readonly massOpacity=uniform(0);
  private readonly farOpacity=uniform(0);
  private farMesh?:Mesh;
  private farTriangles=0;
  private farBytes=0;
  private pixels=0;
  constructor(parent:Group,private readonly frames:ReferenceFrameGraph,private readonly renderSpace:RenderSpaceService) {
    this.root.name='Manaus · curved aerial presentation';this.root.visible=false;parent.add(this.root);
  }
  private buildFarMarker():void {
    const segments=32,radiusM=14000,positions:number[]=[],normals:number[]=[],colors:number[]=[];
    const norm=new Vector3(MANAUS_ANCHOR_ECEF.xM,MANAUS_ANCHOR_ECEF.yM,MANAUS_ANCHOR_ECEF.zM).normalize();
    const up=norm,east=new Vector3(-up.y,up.x,0).normalize(),north=new Vector3().crossVectors(up,east).normalize();
    const rEarth=6378137,heightOffset=30;
    const centerPos=up.clone().multiplyScalar(heightOffset);
    for(let i=0;i<segments;i++){
      const a0=(i/segments)*Math.PI*2,a1=((i+1)/segments)*Math.PI*2;
      const p0=new Vector3().addScaledVector(east,Math.cos(a0)*radiusM).addScaledVector(north,Math.sin(a0)*radiusM).addScaledVector(up,heightOffset-(radiusM*radiusM)/(2*rEarth));
      const p1=new Vector3().addScaledVector(east,Math.cos(a1)*radiusM).addScaledVector(north,Math.sin(a1)*radiusM).addScaledVector(up,heightOffset-(radiusM*radiusM)/(2*rEarth));
      positions.push(centerPos.x,centerPos.y,centerPos.z);normals.push(up.x,up.y,up.z);colors.push(0.72,0.68,0.62,1.0);
      positions.push(p0.x,p0.y,p0.z);normals.push(up.x,up.y,up.z);colors.push(0.55,0.52,0.48,0.0);
      positions.push(p1.x,p1.y,p1.z);normals.push(up.x,up.y,up.z);colors.push(0.55,0.52,0.48,0.0);
    }
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
    geometry.setAttribute('color',new Float32BufferAttribute(colors,4));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=new MeshBasicNodeMaterial({transparent:true,depthWrite:false,fog:false,side:FrontSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
    const dayLight=earthDirectLightNode(normalWorld.dot(this.sun));
    const nightFactor=normalWorld.dot(this.sun).negate().clamp(0,1);
    const nightGlow=uniform(new Color('#ffaa44')).mul(nightFactor).mul(1.5);
    material.colorNode=attribute('color','vec4').xyz.mul(dayLight).add(earthNightAmbientNode()).add(nightGlow);
    material.opacityNode=this.farOpacity.mul(attribute('color','vec4').w);
    this.farMesh=new Mesh(geometry,material);
    this.farMesh.name='manaus-far-marker';
    this.farMesh.layers.set(PLANET_LAYER);
    this.farMesh.renderOrder=4;
    this.farMesh.frustumCulled=true;
    this.root.add(this.farMesh);
    this.farTriangles=segments;
    this.farBytes=(positions.length+normals.length+colors.length)*4;
  }
  build(water:WaterFile,data:ManausAerialData):void {
    if(this.ready)throw new Error('Aerial already prepared');
    const parts=buildManausAerial(water,data);
    if(!parts.some(p=>p.kind==='river')||!parts.some(p=>p.kind==='urban')) {
      for(const part of parts)part.geometry.dispose();
      throw new Error('Aerial requires real water and urban coverage');
    }
    for(const part of parts) {
      let material=this.materials.get(part.kind);if(!material){
        material=new MeshBasicNodeMaterial({transparent:true,depthWrite:false,fog:false,side:part.kind==='mass'?DoubleSide:FrontSide,
          polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
        material.colorNode=attribute('color','vec3').mul(earthDirectLightNode(normalWorld.dot(this.sun))).add(earthNightAmbientNode());
        material.opacityNode=part.kind==='mass'?this.massOpacity:this.opacity;this.materials.set(part.kind,material);
      }
      const mesh=new Mesh(part.geometry,material);mesh.name=`manaus-aerial-${part.kind}`;mesh.layers.set(PLANET_LAYER);mesh.frustumCulled=true;
      // Real banks win over approximate urban aggregate rectangles; bridges/corridors
      // may cross the river. Earth still depth-tests below every aerial layer.
      mesh.renderOrder=part.kind==='river'?5:part.kind==='roads'?6:part.kind==='mass'?4:3;this.root.add(mesh);this.parts.push({part,mesh});
    }
    this.buildFarMarker();
    this.waterSource=water;this.ready=true;
  }
  async initialize(water?:WaterFile):Promise<void> {
    try{
      const base=import.meta.env.BASE_URL;
      const dataResponse=await fetch(`${base}geodata/real-city/aerial.json`);if(!dataResponse.ok)throw new Error(`Aerial data ${dataResponse.status}`);
      if(!water){const response=await fetch(`${base}geodata/real-city/water.json`);if(!response.ok)throw new Error(`Water ${response.status}`);water=await response.json() as WaterFile;}
      this.build(water,await dataResponse.json() as ManausAerialData);
    }catch(error){this.failure=String(error);this.root.visible=false;}
  }
  update(altitudeM:number,isEarth:boolean,cameraPosition:Vec3,fovRad:number,viewportHeightPx:number,solarDirection?:Vec3):void {
    if(!isEarth){this.root.visible=false;this.opacity.value=0;this.massOpacity.value=0;this.farOpacity.value=0;this.pixels=0;return;}
    const anchor=this.renderSpace.logicalToRender(EARTH_FIXED_FRAME_ID,[MANAUS_ANCHOR_ECEF.xM,MANAUS_ANCHOR_ECEF.yM,MANAUS_ANCHOR_ECEF.zM]);
    const distance=Math.hypot(...anchor.map((v,i)=>v-cameraPosition[i]));
    const weights=manausAerialWeights(altitudeM,distance,fovRad,viewportHeightPx,this.ready&&isEarth&&distance<MANAUS_AERIAL.renderLimitM);
    this.opacity.value=weights.opacity;this.massOpacity.value=weights.mass;this.farOpacity.value=weights.farOpacity;this.pixels=weights.pixels;
    this.root.visible=weights.opacity>.001||weights.farOpacity>.001;
    if(!this.root.visible)return;
    if(solarDirection)this.sun.value.set(...solarDirection);
    const orientation=this.frames.convertOrientation(EARTH_FIXED_FRAME_ID,this.renderSpace.currentOrigin.frame,[0,0,0,1]);
    for(const {part,mesh} of this.parts){const pos=this.renderSpace.logicalToRender(EARTH_FIXED_FRAME_ID,part.centre);
      mesh.position.set(...pos);mesh.quaternion.set(...orientation);mesh.visible=part.kind!=='mass'?weights.opacity>.001:weights.mass>.001;}
    if(this.farMesh){
      this.farMesh.position.set(...anchor);
      this.farMesh.quaternion.set(...orientation);
      this.farMesh.visible=weights.farOpacity>.001;
    }
  }
  get stats(){const triangles={river:0,urban:0,mass:0,roads:0,far:this.farTriangles};let bytes=this.farBytes,drawCalls=0;
    for(const {part,mesh} of this.parts){triangles[part.kind]+=part.triangles;bytes+=part.bytes;if(this.root.visible&&mesh.visible)drawCalls++;}
    if(this.root.visible&&this.farMesh?.visible)drawCalls++;
    const tier=this.opacity.value>.5?'aerial':this.farOpacity.value>.001?'far':'none';
    return {ready:this.ready,visible:this.root.visible,opacity:this.opacity.value,massOpacity:this.massOpacity.value,farOpacity:this.farOpacity.value,tier,projectedPx:this.pixels,
      triangles,drawCalls,meshes:this.parts.length+(this.farMesh?1:0),cpuGeometryBytes:bytes,gpuBufferBytes:bytes,physics:false,failure:this.failure};
  }
  dispose():void {for(const {part} of this.parts)part.geometry.dispose();for(const material of this.materials.values())material.dispose();
    if(this.farMesh){this.farMesh.geometry.dispose();(this.farMesh.material as MeshBasicNodeMaterial).dispose();this.farMesh=undefined;}
    this.parts.length=0;this.materials.clear();this.root.clear();this.root.removeFromParent();this.ready=false;}
}
