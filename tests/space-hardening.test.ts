import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, PerspectiveCamera, Quaternion, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import { CameraController, cameraFlightAxes } from '../src/player/CameraController.ts';
import { PlayerController } from '../src/player/PlayerController.ts';
import type { InputController } from '../src/player/InputController.ts';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { AudioManager, earthAtmosphericDensity01, environmentalAudioMix } from '../src/audio/AudioManager.ts';
import { GeographicBodyVisual } from '../src/rendering/celestial/GeographicBodyVisual.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';
import type { CelestialRenderSample } from '../src/rendering/celestial/types.ts';
import { bodyPresentation } from '../src/rendering/celestial/presentation.ts';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile.ts';
import { surfaceColour } from '../src/world/planet/EarthLandMask.ts';
import { lunarElevationM, lunarAlbedo01, MOON_SURFACE_DATA } from '../src/world/planet/MoonSurfaceData.ts';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import { PlanetGlobe, buildPlanetTileMesh } from '../src/world/planet/PlanetGlobe.ts';
import { planetTile } from '../src/world/planet/PlanetTileAddress.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry.ts';
import { EarthProvider } from '../src/world/providers/EarthProvider.ts';
import { PowerSystem } from '../src/player/powers/PowerSystem.ts';
import { resolveImpact } from '../src/player/combat/MeteorImpact.ts';

function cameraRig() {
  const input = { enabled: true, mouseDelta: new Vector2(), held: () => false, consume: () => false } as unknown as InputController;
  const player = new PlayerController(new Group(), input);
  const camera = new PerspectiveCamera(57, 1.5, .1, 100_000);
  const rig = new CameraController(camera, input);
  rig.skipIntro(); rig.inSpace = true;
  const rotate = (angle: number) => {
    input.mouseDelta.y = angle / .00195;
    rig.prepareLook();
    rig.update(player, new Vector3(), .016, []);
    input.mouseDelta.set(0, 0);
  };
  return { input, player, camera, rig, rotate };
}

test('T_SPACE_CAMERA_NO_LOCAL_PITCH_CLAMP', () => {
  const r = cameraRig();
  try { r.rotate(2.1); assert.ok(cameraFlightAxes(r.camera).forward.z > 0); }
  finally { r.player.character.dispose(); }
});
test('T_SPACE_CAMERA_FULL_VERTICAL_ROTATION', () => {
  const r = cameraRig();
  try { for (let i=0;i<128;i++) r.rotate(Math.PI/64); assert.ok(r.camera.quaternion.angleTo(new Quaternion())<1e-6); }
  finally { r.player.character.dispose(); }
});
for (const name of ['T_SPACE_CAMERA_CONTINUOUS_POLE_CROSSING', 'T_SPACE_FLIGHT_VERTICAL_NO_RIGHT_AXIS_SNAP']) {
  test(name, () => {
    const r=cameraRig();
    try {
      let previous=cameraFlightAxes(r.camera);
      for (let i=0;i<100;i++) {
        r.rotate(.04); const next=cameraFlightAxes(r.camera);
        assert.ok(previous.forward.dot(next.forward)>.999);
        assert.ok(previous.right.dot(next.right)>.999);
        previous=next;
      }
    } finally { r.player.character.dispose(); }
  });
}
test('T_SPACE_CAMERA_AXES_ORTHONORMAL', () => {
  const r=cameraRig();
  try {
    r.input.mouseDelta.x=730; r.rotate(2.4);
    const {forward,right,up}=cameraFlightAxes(r.camera);
    for (const v of [forward,right,up]) assert.ok(Math.abs(v.length()-1)<1e-12);
    for (const dot of [forward.dot(right),forward.dot(up),right.dot(up)]) assert.ok(Math.abs(dot)<1e-12);
  } finally { r.player.character.dispose(); }
});
test('T_SPACE_FLIGHT_FORWARD_EQUALS_CROSSHAIR', () => {
  const r=cameraRig();
  try {
    r.rotate(2.3); r.camera.updateProjectionMatrix();
    const ray=new Raycaster(); ray.setFromCamera(new Vector2(0,0),r.camera);
    assert.ok(ray.ray.direction.distanceTo(cameraFlightAxes(r.camera).forward)<1e-12);
  } finally { r.player.character.dispose(); }
});
test('T_LOCAL_CAMERA_LIMITS_PRESERVED', () => {
  const r=cameraRig();
  try {
    r.rig.inSpace=false; r.rotate(10); assert.equal(r.rig.pitch,1.27);
    r.rotate(-20); assert.equal(r.rig.pitch,-1.15);
  } finally { r.player.character.dispose(); }
});
test('space camera never queries local terrain or collision', () => {
  const r=cameraRig();
  PhysicsWorld.setTerrain({ heightAt:()=>{throw new Error('space queried ground');} });
  try { r.rotate(2); } finally { PhysicsWorld.setTerrain(null); r.player.character.dispose(); }
});

const environment = { medium:'earth-atmosphere' as const, atmosphericDensity01:1, speedMps:100, altitudeM:0, rain:false, river:false };
for (const [name,medium] of [['T_VACUUM_HAS_ZERO_WIND_GAIN','vacuum'],['T_AIRLESS_MOON_HAS_ZERO_WIND_GAIN','airless-surface']] as const) {
  test(name,()=>{
    for (const speedMps of [0,100,1e12]) {
      const mix=environmentalAudioMix({...environment,medium,speedMps,rain:true,river:true});
      assert.equal(mix.windGain,0); assert.equal(mix.ambienceGain,0);
    }
  });
}
test('T_EARTH_ATMOSPHERE_WIND_RESPONDS_TO_SPEED',()=>{
  assert.ok(environmentalAudioMix(environment).windGain>environmentalAudioMix({...environment,speedMps:0}).windGain);
});
test('T_ATMOSPHERIC_WIND_FADES_TO_VACUUM',()=>{
  let last=1;
  for(let altitudeM=0;altitudeM<=120_000;altitudeM+=1000) {
    const density=earthAtmosphericDensity01(altitudeM); assert.ok(density<=last); last=density;
  }
  assert.equal(last,0);
});
test('T_EFFECTS_BUS_STILL_WORKS_IN_VACUUM',()=>{
  const audio=new AudioManager();
  let starts=0,connected=false;
  const parameter={setValueAtTime(){},exponentialRampToValueAtTime(){}};
  const effects={};
  Object.assign(audio, { effects, context: { currentTime:0,
    createOscillator:()=>({frequency:parameter,connect(){},start(){starts++;},stop(){},disconnect(){}}),
    createGain:()=>({gain:parameter,connect(bus:unknown){connected=bus===effects;},disconnect(){}}),
  } });
  audio.update({...environment,medium:'vacuum'}); audio.play('impact');
  assert.equal(starts,1); assert.ok(connected); assert.equal(audio.mix.effects,.8);
});
test('airless landings keep impact audio without city debris or fictitious crater notices',()=>{
  const power=Object.create(PowerSystem.prototype) as any;
  let sounds=0,waves=0;
  Object.assign(power,{player:{size:1},hooks:{canDeformSurface:()=>false,sound(){sounds++;},
    damage(){throw new Error('airless surface attempted city damage');},notify(){throw new Error('fictitious crater notice');}},
    effects:{wave(_position:unknown,radius:number){assert.ok(radius<=8);waves++;},
      burst(){throw new Error('city debris leaked into Moon');},flash(){throw new Error('city flash leaked into Moon');}}});
  power.applyImpact({impact:resolveImpact(5000,1,false),position:new Vector3()});
  assert.equal(sounds,1);assert.equal(waves,1);
});

const earthSample:CelestialRenderSample={bodyId:'earth',angularRadiusRad:.02,physicalRadiusM:6_378_137,
  logicalDistanceM:3e8,directionRender:[0,0,-1],proxyDistanceM:20_000,proxyRadiusM:400,pointMix:0,
  visible:true,opacity:1,phaseLightDirection:[1,0,0],bodyFixedOrientationRender:[0,0,0,1]};
test('T_EARTH_POINT_VISIBILITY_FLOOR',()=>{
  const p=bodyPresentation(1e-9,SOLAR_BODY_PROFILES.earth.visual,1,1080);
  assert.equal(p.presentationDiameterPx,3.5); assert.ok(p.glowTangent>p.presentationTangent);
});
test('T_EARTH_POINT_DOES_NOT_CHANGE_PHYSICAL_RADIUS',()=>{
  const p=bodyPresentation(1e-9,SOLAR_BODY_PROFILES.earth.visual,1,1080);
  assert.equal(p.physicalTangent,Math.tan(1e-9));
  const v=new GeographicBodyVisual('earth');
  try { v.update(earthSample); assert.ok(Math.abs(Math.asin(v.mesh.scale.x/earthSample.proxyDistanceM)-.02)<1e-12); }
  finally {v.dispose();}
});
test('T_EARTH_PROXY_USES_REAL_LAND_MASK',()=>{
  const v=new GeographicBodyVisual('earth');
  try {
    const positions=v.mesh.geometry.getAttribute('position'),colours=v.mesh.geometry.getAttribute('color');
    const palette=new Set<string>();
    for(let i=0;i<positions.count;i+=29) {
      const d=new Vector3().fromBufferAttribute(positions,i).normalize();
      const expected=surfaceColour(Math.asin(d.z),Math.atan2(d.y,d.x),[0,0,0]);
      const actual=[colours.getX(i),colours.getY(i),colours.getZ(i)];
      actual.forEach((n,j)=>assert.ok(Math.abs(n-expected[j])<1e-6));palette.add(actual.map(n=>n.toFixed(2)).join(','));
    }
    assert.ok(palette.size>4);
  } finally {v.dispose();}
});
test('T_EARTH_PROXY_ORIENTATION_BODY_FIXED',()=>{
  const v=new GeographicBodyVisual('earth');
  try {
    const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),1.2);
    v.update({...earthSample,bodyFixedOrientationRender:q.toArray(),bodyOrientationRender:[1,0,0,0]});
    assert.ok(v.group.quaternion.angleTo(q)<1e-7);
  } finally {v.dispose();}
});
test('T_EARTH_PROXY_RENDER_COORDINATES_BOUNDED',()=>{
  const u=new UniverseRuntime({epochS:0}),layer=new CelestialBodyVisualLayer(),c=new CelestialPresentationController(layer);
  try {
    u.updateSystemPose([3e13,-2e13,1e13],[0,0,0],0); c.prepare({universe:u,fovRad:1,viewportHeightPx:1080,cameraFarM:100_000});
    c.render({camera:new PerspectiveCamera(57,1,.1,100_000)});
    layer.root.traverse(node=>assert.ok(node.position.length()<100_000));
  } finally {layer.dispose();u.dispose();}
});
test('T_EARTH_PROXY_TO_GLOBE_HANDOFF_CONTINUOUS',()=>{
  const u=new UniverseRuntime({epochS:0}),layer=new CelestialBodyVisualLayer(),c=new CelestialPresentationController(layer);
  const earth=new EarthProvider(new Group(),u.frames,{renderSpace:u.renderSpace});
  const centre=u.activeSystem.positionOf('earth')!;
  try {
    for(const distance of [1e8,5e7,2e7,1e7,7e6]) {
      u.updateSystemPose([centre[0]+distance,centre[1],centre[2]],u.activeSystem.stateOf('earth')!.velocityMps,0);
      c.prepare({universe:u,earth,fovRad:1,viewportHeightPx:1080});
      const sample=c.renderSamples.find(s=>s.bodyId==='earth')!;
      assert.ok(Math.abs(Math.sin(sample.angularRadiusRad)*distance-6_378_137)<.001);
      const expected=u.frames.convertOrientation('earth/fixed',u.renderSpace.currentOrigin.frame,[0,0,0,1]);
      assert.ok(new Quaternion(...expected).angleTo(new Quaternion(...sample.bodyFixedOrientationRender!))<1e-7);
      if(c.physicalBodyId==='earth') {
        assert.ok(earth.readiness().coarseFallbackReady);assert.equal(sample.visible,false);assert.equal(sample.opacity,0);
      } else assert.ok(sample.visible);
    }
  } finally {layer.dispose();earth.globe.dispose();u.dispose();}
});

const directions:Array<[number,number,number]>=[];
for(let lat=-90;lat<=90;lat+=5)for(let lon=-180;lon<=180;lon+=7) {
  const a=lat*Math.PI/180,b=lon*Math.PI/180;directions.push([Math.cos(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.sin(a)]);
}
test('T_MOON_REAL_DATA_DETERMINISTIC',()=>{
  for (const d of directions) assert.equal(lunarElevationM(d),lunarElevationM([...d]));
  assert.equal(MOON_SURFACE_DATA.elevationWidth,720); assert.equal(MOON_SURFACE_DATA.albedoWidth,1024);
  assert.ok(MOON_SURFACE_DATA.sources.every(source=>source.sha256.length===64));
});
test('T_MOON_REAL_ELEVATION_FINITE',()=>{
  for(const d of directions) {
    const h=lunarElevationM(d);assert.ok(Number.isFinite(h));
    assert.ok(h>=MOON_SURFACE_DATA.minElevationM && h<=MOON_SURFACE_DATA.maxElevationM);
    assert.ok(Math.abs(planetSurfaceRadius(MoonSurfaceGenerator,d)-MOON_SURFACE_DATA.referenceRadiusM-h)<1e-8);
  }
});
test('T_MOON_REAL_ALBEDO_FINITE',()=>{
  const samples=directions.map(lunarAlbedo01);
  assert.ok(samples.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
  assert.ok(Math.max(...samples)-Math.min(...samples)>.3);
});
test('lunar data has continuous antimeridian and longitude-independent poles',()=>{
  for(const sample of [lunarElevationM,lunarAlbedo01]) {
    assert.ok(Math.abs(sample([-1,1e-12,0])-sample([-1,-1e-12,0]))<1e-5);
    assert.ok(Math.abs(sample([1e-14,0,1])-sample([0,-1e-14,1]))<1e-6);
  }
});
test('T_MOON_COMPLETE_COARSE_COVERAGE',()=>{
  const globe=new PlanetGlobe('moon');
  try {
    globe.ensureFallback(MoonSurfaceGenerator); assert.ok(globe.fallbackReady);assert.equal(globe.fallbackGroup.children.length,6);
    for(const mesh of globe.fallbackGroup.children as Mesh[]) assert.equal((mesh.material as any).fog,false);
  } finally {globe.dispose();}
});
test('T_MOON_REFINED_TILES_KEEP_FALLBACK_UNDERNEATH',()=>{
  const globe=new PlanetGlobe('moon');globe.ensureFallback(MoonSurfaceGenerator);
  const address=planetTile('moon',0,0,0,0), fine=buildPlanetTileMesh(address,MoonSurfaceGenerator,false,0,65);
  try {
    const fallback=globe.fallbackGroup.children[0] as Mesh;
    const p=fine.geometry.getAttribute('position'), q=fallback.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++) {
      const a=new Vector3().fromBufferAttribute(p,i).add(new Vector3(...fine.centre));
      const b=new Vector3().fromBufferAttribute(q,i).add(fallback.position);
      assert.ok(a.length()-b.length()>3.8);
    }
    globe.add('fine',fine);globe.remove('fine');assert.ok(globe.fallbackReady);
  } finally {globe.dispose();}
});
test('lunar fallback facets stay below authoritative terrain between vertices',()=>{
  const globe=new PlanetGlobe('moon');globe.ensureFallback(MoonSurfaceGenerator);
  try {
    for(const mesh of globe.fallbackGroup.children as Mesh[]) {
      const positions=mesh.geometry.getAttribute('position'),indices=mesh.geometry.index!;
      const centre=mesh.position;
      for(let i=0;i<indices.count;i+=93) {
        const a=new Vector3().fromBufferAttribute(positions,indices.getX(i)).add(centre);
        const b=new Vector3().fromBufferAttribute(positions,indices.getX(i+1)).add(centre);
        const c=new Vector3().fromBufferAttribute(positions,indices.getX(i+2)).add(centre);
        for(const weights of [[.2,.3,.5],[.8,.1,.1]]) {
          const p=a.clone().multiplyScalar(weights[0]).addScaledVector(b,weights[1]).addScaledVector(c,weights[2]);
          const r=p.length(),direction=p.clone().normalize().toArray();
          assert.ok(r<planetSurfaceRadius(MoonSurfaceGenerator,direction)-3.5);
        }
      }
    }
  } finally {globe.dispose();}
});
test('T_MOON_NO_PROXY_GLOBE_DOUBLE_OWNERSHIP',()=>{
  const u=new UniverseRuntime({epochS:0}),root=new Group(),providers=createPlanetProviders(root,u);
  const layer=new CelestialBodyVisualLayer(),c=new CelestialPresentationController(layer);
  try {
    const m=u.activeSystem.positionOf('moon')!;
    u.updateSystemPose([m[0]+2e6,m[1],m[2]],u.activeSystem.stateOf('moon')!.velocityMps,0);
    c.prepare({universe:u,planetProviders:providers,fovRad:1,viewportHeightPx:1080});
    assert.ok(providers.get('moon')!.globe.visible);const sample=c.renderSamples.find(s=>s.bodyId==='moon')!;
    assert.equal(sample.visible,false);assert.equal(sample.opacity,0);assert.equal(providers.get('moon')!.globe.opacity,1);
  } finally {layer.dispose();u.dispose();for(const p of providers.values())p.globe.dispose();}
});
test('T_MOON_RENDER_COORDINATES_BOUNDED',()=>{
  const u=new UniverseRuntime({epochS:0}),root=new Group(),providers=createPlanetProviders(root,u);
  const layer=new CelestialBodyVisualLayer(),c=new CelestialPresentationController(layer);
  try {
    const m=u.activeSystem.positionOf('moon')!;
    u.updateSystemPose([m[0]+2e6,m[1],m[2]],u.activeSystem.stateOf('moon')!.velocityMps,0);
    c.prepare({universe:u,planetProviders:providers,fovRad:1,viewportHeightPx:1080});
    root.updateMatrixWorld(true);
    root.traverse(node=>{
      assert.ok(node.position.length()<20_000_000);
      if(node instanceof Mesh)assert.ok(node.getWorldPosition(new Vector3()).length()+node.geometry.boundingSphere!.radius<20_000_000);
    });
  } finally {layer.dispose();u.dispose();for(const p of providers.values())p.globe.dispose();}
});
test('T_MOON_TILE_EDGES_CONTINUOUS',()=>{
  const a=buildPlanetTileMesh(planetTile('moon',0,8,100,100),MoonSurfaceGenerator);
  const b=buildPlanetTileMesh(planetTile('moon',0,8,101,100),MoonSurfaceGenerator);
  try {
    const pa=a.geometry.getAttribute('position'),pb=b.geometry.getAttribute('position');
    for(let row=0;row<17;row++) {
      const x=new Vector3().fromBufferAttribute(pa,row*17+16).add(new Vector3(...a.centre));
      const y=new Vector3().fromBufferAttribute(pb,row*17).add(new Vector3(...b.centre));assert.ok(x.distanceTo(y)<.002);
    }
  } finally {a.geometry.dispose();b.geometry.dispose();}
});
