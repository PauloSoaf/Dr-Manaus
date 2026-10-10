import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,Matrix4,Mesh,Vector3} from 'three/webgpu';
import {ManausAerialPresentation,MANAUS_AERIAL,aerialBodyPoint,manausAerialWeights} from '../src/rendering/ManausAerialPresentation.ts';
import type {WaterFile} from '../src/rendering/WaterSystem.ts';
import {UniverseRuntime} from '../src/world/runtime/UniverseRuntime.ts';
import {EARTH_FIXED_FRAME_ID,MANAUS_FRAME_ID,legacyLocalToGeodetic} from '../src/world/spatial/ManausFrameAdapter.ts';
import {ecefToGeodetic} from '../src/world/spatial/ECEF.ts';
import {createRenderOrigin} from '../src/world/spatial/RenderOrigin.ts';
import {EarthTransitionController} from '../src/world/providers/EarthTransitionController.ts';
import type {EarthProvider} from '../src/world/providers/EarthProvider.ts';
import {LandMask,LAND_MASK} from '../src/world/geodata/landmask.ts';
import {LANDMARKS,isLand,isLandFootprint,latLonToWorld,shoreZ,riverWidth} from '../src/world/geodata/geodata.ts';
import {ForestBackdrop} from '../src/world/ForestBackdrop.ts';
import {generateChunk,treeFootprintRadius} from '../src/world/chunks/BuildingGenerator.ts';
import {bakeRegionalWaterMask} from '../scripts/geodata/regional-water-mask.mjs';
const read=(name:string)=>JSON.parse(readFileSync(`public/geodata/real-city/${name}.json`,'utf8'));
const water=read('water') as WaterFile,data=read('aerial'),maskPayload=read('landmask');
const universe=new UniverseRuntime({streaming:false}),parent=new Group(),aerial=new ManausAerialPresentation(parent,universe.frames,universe.renderSpace);
parent.name='planetary';aerial.build(water,data);
test.after(()=>{aerial.dispose();universe.dispose();});
const named=(name:string)=>`T_${name}`;
const earth={readiness:()=>({viewCoverageReady:true})} as unknown as EarthProvider;
const update=(alt:number)=>{universe.renderSpace.setOrigin(createRenderOrigin(MANAUS_FRAME_ID,[0,0,0]));
  aerial.update(alt,true,[0,alt,0],Math.PI/3,900,[0,1,0]);};
test(named('MANAUS_AERIAL_EXISTS'),()=>{assert.ok(aerial.ready);assert.ok(aerial.stats.triangles.urban>0);});
test(named('MANAUS_AERIAL_BODY_FIXED'),()=>{assert.equal(aerial.root.parent,parent);assert.equal(aerial.waterSource,water);
  const p=aerialBodyPoint(0,0),geo=ecefToGeodetic({xM:p[0],yM:p[1],zM:p[2]}),anchor=legacyLocalToGeodetic(0,0,0);
  assert.ok(Math.abs(geo.latRad-anchor.latRad)<1e-12&&Math.abs(geo.lonRad-anchor.lonRad)<1e-12);});
test(named('MANAUS_AERIAL_NOT_PHYSICS'),()=>{assert.equal(aerial.presentationOnly,true);assert.equal(aerial.stats.physics,false);
  assert.equal('colliders' in aerial,false);assert.equal('traffic' in aerial,false);});
test(named('MANAUS_AERIAL_READY_BEFORE_LOCAL_RETIRE'),()=>{const c=new EarthTransitionController();
  assert.equal(c.update(15000,earth,false).localGroundVisible,true);
  assert.equal(c.update(15000,earth,aerial.ready).localGroundVisible,false);});
for(const alt of [15000,20000,60000,100000])test(named(`MANAUS_VISIBLE_AT_${alt/1000}KM`),()=>{update(alt);
  assert.ok(aerial.stats.visible);assert.ok(aerial.stats.opacity>.99);assert.ok(aerial.stats.triangles.river>0);});
test(named('MANAUS_VERTICAL_ASCENT_NO_VISIBILITY_GAP'),()=>{const c=new EarthTransitionController();
  for(let alt=0;alt<=300000;alt+=500){update(alt);const state=c.update(alt,earth,aerial.ready);
    if(alt<=200000)assert.ok(state.localGroundVisible||aerial.stats.visible,`gap at ${alt}`);}
  assert.ok(aerial.stats.opacity<1&&aerial.stats.opacity>0,'300km fades by apparent city size');});
test(named('MANAUS_LOCAL_ROOT_CAN_RETIRE'),()=>{const c=new EarthTransitionController();c.update(12000,earth,aerial.ready);
  assert.equal(c.update(15000,earth,aerial.ready).localGroundVisible,false);update(15000);assert.ok(aerial.root.visible);});
test(named('MANAUS_AERIAL_CURVED_NOT_FLAT'),()=>{const points=[aerialBodyPoint(-60000,0),aerialBodyPoint(0,0),aerialBodyPoint(60000,0)];
  const render=points.map(p=>universe.frames.convertPosition(EARTH_FIXED_FRAME_ID,MANAUS_FRAME_ID,p));
  assert.ok(render[1][1]-(render[0][1]+render[2][1])/2>200);
  for(const object of aerial.root.children){const mesh=object as Mesh,positions=mesh.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i+=31)assert.ok(Math.max(Math.abs(positions.getX(i)),Math.abs(positions.getY(i)),Math.abs(positions.getZ(i)))<20000);}});
test(named('RIO_NEGRO_AERIAL_REAL_GEOMETRY'),()=>{assert.ok(water.polygons.some(p=>!p.muddy));assert.ok(aerial.stats.triangles.river>1000);});
test(named('SOLIMOES_AERIAL_REAL_GEOMETRY'),()=>{assert.ok(water.polygons.some(p=>p.muddy));
  const colours=new Set<string>();for(const child of aerial.root.children)if(child.name==='manaus-aerial-river'){
    const c=(child as Mesh).geometry.getAttribute('color');for(let i=0;i<c.count;i+=3)colours.add(`${c.getX(i).toFixed(3)}/${c.getY(i).toFixed(3)}/${c.getZ(i).toFixed(3)}`);}
  assert.equal(colours.size,2,'black and muddy source classes retained');});
test(named('ENCONTRO_DAS_AGUAS_VISIBLE'),()=>{const site=LANDMARKS.find(p=>p.id==='encontro')!;
  for(const muddy of [true,false])assert.ok(water.polygons.some(p=>p.muddy===muddy&&p.rings.some(r=>{
    for(let i=0;i<r.length;i+=2)if(Math.hypot(r[i]-site.x,r[i+1]-site.z)<15000)return true;return false;})));});
test(named('REAL_WATER_EXTENT_GREATER_THAN_OLD'),()=>{assert.equal(water.bounds.minX,-80000);assert.equal(water.bounds.maxX,80000);
  assert.ok(water.bounds.minZ<-58000&&water.bounds.maxZ>58000);});
test(named('LANDMASK_COVERS_REAL_WATER_BOUNDS'),()=>{for(const x of [water.bounds.minX,water.bounds.maxX])for(const z of [water.bounds.minZ,water.bounds.maxZ])assert.ok(LAND_MASK.covers(x,z));
  assert.ok(Buffer.from(maskPayload.bits,'base64').length+Buffer.from(maskPayload.footprintBits,'base64').length<400000);});
test(named('REAL_WATER_OVERRIDES_GENERALIZED_SHORELINE'),()=>{let found=false;
  for(let x=-75000;x<75000&&!found;x+=1000)for(let z=-55000;z<55000;z+=1000){const shore=shoreZ(x);
    if((z<=shore||z>=shore+riverWidth(x))&&LAND_MASK.isWater(x,z)){assert.equal(isLand(x,z),false);found=true;break;}}
  assert.ok(found);});
const forestPoints:{x:number;z:number}[]=[];
for(const [lat,lon] of [[-3.15,-60.07],[-3.25,-60.1],[-3.143,-59.904],[-3.06375,-60.1083]]) {
  const point=latLonToWorld(lat,lon),root=new Group(),forest=new ForestBackdrop(root);forest.update(new Vector3(point.x,0,point.z));
  const mesh=root.children[0] as any,matrix=new Matrix4();
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);forestPoints.push({x:matrix.elements[12],z:matrix.elements[14]});}forest.dispose();
}
test(named('FOREST_BACKDROP_NO_WATER_CENTRE'),()=>{assert.ok(forestPoints.length>100);for(const p of forestPoints)assert.ok(isLand(p.x,p.z));});
test(named('FOREST_BACKDROP_NO_CANOPY_OVER_WATER'),()=>{for(const p of forestPoints)assert.equal(LAND_MASK.hasWaterWithin(p.x,p.z,155),false);});
const trees:number[][]=[];
for(const site of LANDMARKS.filter(l=>['encontro','ponta','ponte','iranduba','musa'].includes(l.id))) {
  const cx=Math.floor(site.x/128),cz=Math.floor(site.z/128);
  for(let z=cz-4;z<=cz+4;z++)for(let x=cx-4;x<=cx+4;x++){const values=generateChunk(x,z).trees;for(let i=0;i<values.length;i+=5)trees.push(Array.from(values.slice(i,i+5)));}
}
test(named('PROCEDURAL_TREE_NO_WATER'),()=>{assert.ok(trees.length>100);for(const t of trees)assert.ok(isLand(t[0],t[1]));});
test(named('TREE_FOOTPRINT_SHORELINE_SAFE'),()=>{for(const t of trees)assert.equal(LAND_MASK.hasWaterWithin(t[0],t[1],treeFootprintRadius(t[3],t[4])),false);});
test(named('TREE_ISLAND_SAFE'),()=>{const narrow={rings:[[0,0,512,0,512,512,0,512],[180,180,330,180,330,330,180,330]]};
  const m=new LandMask();m.load(bakeRegionalWaterMask([narrow],{minX:0,minZ:0,maxX:512,maxZ:512},16,32));
  assert.equal(m.hasWaterWithin(256,256,155),true);assert.equal(m.hasWaterWithin(256,256,6),false);});
test(named('TREE_LAND_STILL_GENERATES'),()=>{assert.ok(trees.length>100);assert.ok(forestPoints.length>100);});
test(named('MANAUS_AERIAL_REBASE_INVARIANT'),()=>{update(60000);aerial.root.updateMatrixWorld(true);
  const mesh=aerial.root.children[0] as Mesh,vertex=new Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),0).applyMatrix4(mesh.matrixWorld);
  const logical=universe.renderSpace.renderToLogical(vertex.toArray(),EARTH_FIXED_FRAME_ID);
  universe.renderSpace.setOrigin(createRenderOrigin(MANAUS_FRAME_ID,[10000,40000,-5000]));
  aerial.update(60000,true,[-10000,20000,5000],Math.PI/3,900);aerial.root.updateMatrixWorld(true);
  vertex.fromBufferAttribute(mesh.geometry.getAttribute('position'),0).applyMatrix4(mesh.matrixWorld);
  const next=universe.renderSpace.renderToLogical(vertex.toArray(),EARTH_FIXED_FRAME_ID);
  assert.ok(Math.hypot(...next.map((v,i)=>v-logical[i]))<1e-6);});
test(named('MANAUS_AERIAL_CITY_RIVER_ALIGNMENT'),()=>{for(const id of ['teatro','porto','ponta','ponte','encontro']){
  const l=LANDMARKS.find(l=>l.id===id)!,p=aerialBodyPoint(l.x,l.z),geo=ecefToGeodetic({xM:p[0],yM:p[1],zM:p[2]});
  assert.ok(Math.abs(geo.latRad-l.lat*Math.PI/180)<1e-11);assert.ok(Math.abs(geo.lonRad-l.lon*Math.PI/180)<1e-11);}});
test('Aerial geometry stays bounded and retires sky masses while retaining city imprint and river',()=>{update(100000);
  assert.equal(aerial.stats.massOpacity,0);assert.ok(aerial.stats.drawCalls<aerial.stats.meshes);
  assert.ok(aerial.stats.cpuGeometryBytes<MANAUS_AERIAL.maxBytes);assert.ok(aerial.stats.meshes<MANAUS_AERIAL.maxMeshes);});
test('Aerial readiness failure cannot retire local ground or publish partial geometry',()=>{assert.equal(manausAerialWeights(20000,20000,1,900,false).opacity,0);
  const separate=new ManausAerialPresentation(parent,universe.frames,universe.renderSpace);
  assert.throws(()=>separate.build(water,{...data,skyline:Object.fromEntries(Array.from({length:2000},(_,i)=>[`${i},0`,Array(80).fill(20)]))}));
  assert.equal(separate.ready,false);assert.equal(separate.root.children.length,0);
  assert.throws(()=>separate.build({...water,polygons:[]},data),/requires real water/);
  assert.equal(separate.root.children.length,0);separate.dispose();});
test('Conservative footprint mask detects a thin channel without changing centre-point land classification',()=>{
  const p=bakeRegionalWaterMask([{rings:[[60,0,62,0,62,256,60,256]]}],{minX:0,minZ:0,maxX:256,maxZ:256},128,128),mask=new LandMask();
  assert.ok(mask.load(p));assert.equal(mask.isWater(20,20),false);assert.equal(mask.hasWaterWithin(20,20,1),true);
  assert.equal(mask.hasWaterWithin(220,20,1),false);});
