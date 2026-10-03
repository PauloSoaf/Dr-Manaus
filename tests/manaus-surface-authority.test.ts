import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { FEATURES } from '../src/core/config.ts';
import { createTerrain } from '../src/world/geodata/terrain.ts';
import { RoadNetwork, ROAD_HEIGHT, ROAD_MARKING_LIFT, roadHeightOf } from '../src/world/realcity/roads.ts';
import { RealCityLayer } from '../src/world/realcity/RealCityLayer.ts';
import { RealCityMaterials } from '../src/world/realcity/materials.ts';
import { createSurfaceTileFrame } from '../src/world/spatial/SurfaceTileFrame.ts';
import { SurfaceFrameService } from '../src/world/spatial/SurfaceFrameService.ts';
import { localManausPresentationMode, manausTileSceneMatrix, MANAUS_GROUND_COVER_Y } from '../src/world/spatial/ManausSurfacePresentation.ts';

const distances=[0,5000,10000,15000,20000];
function disposeGroup(root:Group) {
  root.traverse(object=>{
    if(object instanceof Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}
  });
}
function roadsAt(x:number,z=-500) {
  const material=new MeshStandardMaterial();
  const roads=new RoadNetwork([{class:'primary',width:12,p:[x-90,z,x+90,z]},
    {class:'service',width:6,p:[x-90,z-25,x+90,z-25]}],material,material);
  // update(x, z, speed): staged one piece per call, so five calls drain local, markings and lamps.
  for(let i=0;i<5;i++)roads.update(x,z,0);
  const mesh=(name:string)=>roads.group.getObjectByName(name) as Mesh;
  return {roads,mesh,dispose:()=>{roads.dispose();material.dispose();}};
}
async function buildingsAt(x:number,z=-500) {
  const size=1024,tx=Math.floor(x/size),tz=Math.floor(z/size),key=`${tx},${tz}`;
  const lx=x-tx*size,lz=z-tz*size;
  const building={id:'surface-fixture',h:12,rs:'flat',p:[lx-8,lz-6,lx-8,lz+6,lx+8,lz+6,lx+8,lz-6]};
  const layer=new RealCityLayer(new Group()), internal=layer as any;
  internal.manifest={tileSize:size,tiles:{[key]:'fixture.json'}};
  internal.materials=new RealCityMaterials();
  const fetchBefore=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify({tx,tz,key,buildings:[building]}));
    await internal.loadTile(key,'fixture.json');
  } finally {globalThis.fetch=fetchBefore;}
  internal.classifyCells(new Vector3(x,0,z),0);
  internal.pumpJobs(performance.now(),Infinity);
  layer.group.updateMatrixWorld(true);
  const tile=internal.tiles.get(key);
  assert.ok(tile?.detail && tile.colliders.length,'fixture must build the production detail mesh and collider');
  return {layer,tile,building,dispose:()=>layer.dispose()};
}
function visualBase(mesh:Mesh) {
  const position=mesh.geometry.getAttribute('position'),point=new Vector3();let min=Infinity;
  for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);min=Math.min(min,point.y);}
  return min;
}

test('T_FLAT_MANAUS_GROUND_REMAINS_FLAT',()=>{
  assert.equal(FEATURES.curvedManaus,false);assert.equal(localManausPresentationMode(),'flat');
  const root=new Group();createTerrain(root);
  try {
    const ground=root.getObjectByName('ground-cover') as Mesh,backdrop=root.getObjectByName('terrain-backdrop') as Mesh;
    const positions=ground.geometry.getAttribute('position');
    assert.ok(positions.count>1000);
    for(let i=0;i<positions.count;i++)assert.equal(positions.getY(i),MANAUS_GROUND_COVER_Y);
    assert.equal(MANAUS_GROUND_COVER_Y,0);
    assert.ok(visualBase(backdrop)<MANAUS_GROUND_COVER_Y);
  } finally {disposeGroup(root);}
});
test('T_FLAT_MANAUS_REAL_ROADS_NOT_CURVED',()=>{
  for(const x of distances){const f=roadsAt(x);try{
    for(const [name,y] of [['real-roads-arterial',ROAD_HEIGHT.primary],['real-roads-local',ROAD_HEIGHT.service]] as const){
      const p=f.mesh(name).geometry.getAttribute('position');assert.ok(p.count>0);
      for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-y)<1e-8);
      assert.ok(Math.abs(p.getX(0)-(x-95.4))<.001 || name==='real-roads-local','authored horizontal coordinates survive');
    }
  }finally{f.dispose();}}
});
test('T_FLAT_MANAUS_ROAD_NORMALS_REMAIN_LOCAL_UP',()=>{
  const f=roadsAt(20000);try{
    const n=f.mesh('real-roads-arterial').geometry.getAttribute('normal');
    for(let i=0;i<n.count;i++)assert.deepEqual([n.getX(i),n.getY(i),n.getZ(i)],[0,1,0]);
  }finally{f.dispose();}
});
test('T_FLAT_MANAUS_REAL_BUILDING_TILE_NOT_CURVED',async()=>{
  const f=await buildingsAt(20000);try{
    assert.deepEqual(f.tile.group.matrix.elements,new Matrix4().makeTranslation(f.tile.originX,0,f.tile.originZ).elements);
    assert.ok(Math.abs(visualBase(f.tile.detail))<.001);
  }finally{f.dispose();}
});
test('T_FLAT_MANAUS_SKYLINE_NOT_CURVED',()=>{
  const layer=new RealCityLayer(new Group()),internal=layer as any;
  internal.manifest={tileSize:1000};
  for(const x of distances)internal.skylineData.set(`${x/1000},-1`,[100,200,20,30,15,0,0,0]);
  try {
    internal.createSkyline();internal.rebuildSkyline();
    const mesh=internal.skyline;assert.ok(mesh.count>=distances.length);
    const matrix=new Matrix4();
    for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);assert.equal(matrix.elements[13],0);assert.equal(matrix.elements[1],0);assert.equal(matrix.elements[9],0);}
  }finally{layer.dispose();}
});
test('T_FLAT_MANAUS_BUILDING_VISUAL_MATCHES_COLLIDER',async()=>{
  for(const x of distances){const f=await buildingsAt(x);try{
    const collider=f.tile.colliders[0];
    assert.ok(Math.abs(visualBase(f.tile.detail)-(collider.y-collider.height/2))<.001);
    assert.ok(Math.abs(collider.x-x)<.001 && Math.abs(collider.z+500)<.001);
    const base=new Vector3(x-f.tile.originX,0,-500-f.tile.originZ).applyMatrix4(f.tile.group.matrixWorld);
    assert.ok(Math.hypot(base.x-collider.x,base.z-collider.z)<.001);
  }finally{f.dispose();}}
});
test('T_FLAT_MANAUS_ROAD_ABOVE_GROUND_COVER',()=>{
  for(const [klass,y] of Object.entries(ROAD_HEIGHT)){
    assert.ok(y-MANAUS_GROUND_COVER_Y>=.02);assert.equal(roadHeightOf(klass),y,'traffic shares asphalt authority');
  }
});
test('T_FLAT_MANAUS_MARKING_ABOVE_ROAD',()=>{
  const f=roadsAt(20000);try{
    const p=f.mesh('real-roads-markings').geometry.getAttribute('position');assert.ok(p.count>0);
    for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-ROAD_HEIGHT.primary-ROAD_MARKING_LIFT)<1e-8);
  }finally{f.dispose();}
});
for(const km of [5,10,20])test(`T_FLAT_MANAUS_${km}KM_NO_SURFACE_SAG`,async()=>{
  const f=await buildingsAt(km*1000),r=roadsAt(km*1000);try{
    assert.ok(Math.abs(visualBase(f.tile.detail))<.001);
    assert.ok(Math.abs(visualBase(r.mesh('real-roads-arterial'))-ROAD_HEIGHT.primary)<1e-8);
    assert.ok(createSurfaceTileFrame('earth','baseline',km*1000,0).getSceneMatrix().elements[13]<-1,
      'the old unconditional WGS84 path has metre-scale sag at this distance');
  }finally{f.dispose();r.dispose();}
});
test('T_CURVED_MANAUS_FRAME_PATH_STILL_AVAILABLE',()=>{
  const previous=FEATURES.curvedManaus;
  Object.assign(FEATURES,{curvedManaus:true});
  try {
    assert.equal(localManausPresentationMode(),'curved');
    const expected=createSurfaceTileFrame('earth','test',20000,-500).getSceneMatrix();
    assert.deepEqual(manausTileSceneMatrix('test',20000,-500).elements,expected.elements);
    const f=roadsAt(20000);try{
      const position=f.mesh('real-roads-arterial').geometry.getAttribute('position');
      assert.ok(position.getY(0)<-20);
      const authored=new SurfaceFrameService('earth').legacyPointToRenderLocal(20000-95.4,ROAD_HEIGHT.primary,-494);
      assert.ok(new Vector3().fromBufferAttribute(position,0).distanceTo(authored)<.002);
    }finally{f.dispose();}
  }finally{Object.assign(FEATURES,{curvedManaus:previous});}
  assert.deepEqual(manausTileSceneMatrix('flat',20000,-500).elements,new Matrix4().makeTranslation(20000,0,-500).elements);
});

/**
 * The structural guard, not a numeric one: the regression was a split decision, not a wrong value.
 *
 * `SurfaceTileFrame` and `SurfaceFrameService` turn flat legacy Manaus coordinates into WGS84
 * tangent frames. A local system that reaches for one of them without consulting the presentation
 * authority curves its own geometry while everything else stays flat, which is how the roads and
 * the real buildings came to sink metres below the ground sheet. Whoever adds the next such call
 * fails here rather than in a screenshot.
 */
test('T_FLAT_MANAUS_ONE_SURFACE_AUTHORITY',()=>{
  const curving=/legacyPointToRenderLocal|legacyDirectionToRenderLocal|legacyColliderToRenderLocal|createSurfaceTileFrame|getSceneMatrix|legacyToLocal/;
  // The frame machinery itself, and the authority that gates it.
  const exempt='src/world/spatial/';
  const files:string[]=[];
  (function walk(dir:string){
    for(const entry of readdirSync(dir,{withFileTypes:true})){
      const path=`${dir}/${entry.name}`;
      if(entry.isDirectory())walk(path); else if(path.endsWith('.ts'))files.push(path);
    }
  })('src');
  const offenders:string[]=[], gated:string[]=[];
  for(const path of files){
    if(path.startsWith(exempt))continue;
    const source=readFileSync(path,'utf8');
    if(!curving.test(source))continue;
    if(source.includes('localManausPresentationMode')||source.includes('FEATURES.curvedManaus'))gated.push(path);
    else offenders.push(path);
  }
  assert.deepEqual(offenders,[],'these curve local geometry without consulting the presentation authority');
  assert.ok(gated.length>=6,`the guard must actually be watching the curvature call sites, saw ${gated.length}`);
});
