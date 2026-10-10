import test from 'node:test';
import assert from 'node:assert/strict';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { surfaceForBody } from '../src/world/planet/BodySurfaceFactory.ts';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface.ts';
import { planRockyImpact } from '../src/world/destruction/RockyImpactDestructionPolicy.ts';
import { resolveImpact } from '../src/world/destruction/ImpactFootprintPolicy.ts';
import { rockyEvent } from './helpers/rocky-impact.ts';

const universe=new UniverseRuntime(),body=universe.activeSystem.bodies.find(b=>b.id==='moon')!,surface=surfaceForBody(body)!;
const plan=(kind='MAJOR_IMPACT',speed=8000)=>planRockyImpact(rockyEvent(body,speed,'policy',kind as any),body,bodyProfile(body),surface);
for(const kind of ['SAFE_CAPTURE','GRAZE','CATASTROPHIC_IMPACT'])test(`T_D1_${kind==='CATASTROPHIC_IMPACT'?'CATASTROPHIC_NO_LOCAL_EDIT_PLAN':kind+'_NO_EDIT_PLAN'}`,()=>assert.equal(plan(kind),null));
for(const kind of ['MINOR','MAJOR'])test(`T_D1_${kind}_CREATES_PLAN`,()=>assert.ok(plan(`${kind}_IMPACT`,kind==='MINOR'?260:8000)));
for(const id of ['jupiter','sun','europa'])test(`T_D1_${id==='europa'?'NON_VOLUME_MOON':id.toUpperCase()}_NO_EDIT`,()=>{
  const b=universe.activeSystem.bodies.find(b=>b.id===id)!,e=rockyEvent(b,8000),fallback=surfaceForBody(body)!;
  assert.equal(planRockyImpact(e,b,bodyProfile(b),{...fallback,body:{...fallback.body,id}}),null);
});
for(const id of ['moon','mars','earth'])test(`T_D1_${id.toUpperCase()}_CAPABLE`,()=>{
  const b=universe.activeSystem.bodies.find(b=>b.id===id)!;assert.ok(planRockyImpact(rockyEvent(b),b,bodyProfile(b),surfaceForBody(b)!));
});
test('T_D1_BODY_FIXED_CONTACT_PROJECTS_TO_SURFACE',()=>{const p=plan()!;assert.ok(Math.abs(Math.hypot(...p.surfaceContactBodyFixedM)-planetSurfaceRadius(surface,[1,0,0]))<1e-7);});
test('T_D1_EXCLUSION_SHELL_NOT_USED_AS_CRATER_SURFACE',()=>{const e=rockyEvent(body);assert.ok(Math.abs(e.contactBodyFixedM![0]-plan()!.surfaceContactBodyFixedM[0]-1000)<1e-7);});
test('T_D1_SURFACE_NORMAL_FINITE',()=>{const p=plan()!;assert.ok(p.surfaceNormalBodyFixed.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...p.surfaceNormalBodyFixed)-1)<1e-10);});
test('T_D1_CRATER_SPHERE_OPENING_RADIUS',()=>{const p=plan()!;assert.ok(Math.abs(Math.sqrt(p.sphereRadiusM**2-p.sphereDepthOffsetM**2)-p.craterRadiusM)<1e-8);});
test('T_D1_CRATER_SPHERE_DEPTH',()=>{const p=plan()!;const offset=p.sphereCenterBodyFixedM.reduce((sum,v,i)=>sum+(v-p.surfaceContactBodyFixedM[i])*p.surfaceNormalBodyFixed[i],0);
  assert.ok(offset>0,'a shallow cap centre is above the outward surface');assert.ok(Math.abs(p.sphereRadiusM-offset-p.craterDepthM)<1e-7);});
for(const speed of [260,800,8000,50000])test(`T_D1_${speed}MPS_SCALE`,()=>{const p=plan(speed<8000?'MINOR_IMPACT':'MAJOR_IMPACT',speed)!,f=resolveImpact(speed);
  assert.equal(p.craterRadiusM,f.craterRadiusM);assert.equal(p.craterDepthM,f.craterDepthM);});
test('T_D1_NO_NAN_EXTREME_FINITE_INPUT',()=>{const p=plan('MAJOR_IMPACT',1e300)!;assert.ok(p);for(const v of Object.values(p))if(typeof v==='number')assert.ok(Number.isFinite(v));assert.equal(p.craterRadiusM,1200);assert.equal(p.craterDepthM,600);});
test('Mercury and Venus eligibility comes from their volume-capable profiles',()=>{for(const id of ['mercury','venus']){const b=universe.activeSystem.bodies.find(b=>b.id===id)!;assert.ok(planRockyImpact(rockyEvent(b),b,bodyProfile(b),surfaceForBody(b)!));}});
test('invalid contacts and zero inward excavation produce no sphere',()=>{const e=rockyEvent(body);for(const invalid of [undefined,[0,0,0],[NaN,0,0]])assert.equal(planRockyImpact({...e,contactBodyFixedM:invalid as any},body,bodyProfile(body),surface),null);
  assert.equal(planRockyImpact({...e,inwardRadialSpeedMps:0},body,bodyProfile(body),surface),null);});
test('shallow major transfers lateral energy without using render velocity',()=>{const e=rockyEvent(body),p=planRockyImpact({...e,inwardRadialSpeedMps:.1,tangentialSpeedMps:8000},body,bodyProfile(body),surface)!;
  assert.ok(p.craterDepthM<20&&p.craterRadiusM<50);assert.equal(p.tangentialSpeedMps,8000);});
