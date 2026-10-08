import {smoothstep,vec3} from 'three/tsl';
import type {CelestialSystemRuntime} from '../world/celestial/CelestialSystemRuntime';
import type {ReferenceFrameGraph} from '../world/spatial/ReferenceFrameGraph';
import {normalizeVec3,type Vec3} from '../world/spatial/units';
import {bodyProfile} from '../world/celestial/CelestialBodyProfile';
import type Node from 'three/src/nodes/core/Node.js';
/** Same direct-light terminator and 5% night fill used by PlanetGlobe. */
export const planetDirectLightNode=(sunDotNormal:Node<'float'>)=>smoothstep(-.1,.1,sunDotNormal).mix(.05,1);
export function planetDirectLight(dot:number):number {const t=Math.max(0,Math.min(1,(dot+.1)/.2));return .05+.95*t*t*(3-2*t);}
export const earthDirectLightNode=(dot:Node<'float'>)=>smoothstep(-.10,.25,dot).mul(dot.max(0).add(.12)).mul(1.45);
export const earthNightAmbientNode=()=>vec3(.004,.008,.018);
export function bodySolarDirection(system:CelestialSystemRuntime,frames:ReferenceFrameGraph,bodyId:string,renderFrame:string):Vec3|undefined {
  const star=system.bodies.find(b=>bodyProfile(b).bodyClass==='star'),sun=star&&system.positionOf(star.id),body=system.positionOf(bodyId);
  return sun&&body?normalizeVec3(frames.convertDirection('solar-system/barycentric',renderFrame,
    [sun[0]-body[0],sun[1]-body[1],sun[2]-body[2]])):undefined;
}
