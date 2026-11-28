import { PhysicsWorld } from '../../src/physics/PhysicsWorld';
import { PlanetTerrainProvider } from '../../src/world/planet/PlanetTerrainProvider';
import { EARTH } from '../../src/world/planet/PlanetBody';
import { EarthGroundSurface } from '../../src/world/planet/EarthSurface';
import { earthSolidGroundAt } from '../../src/world/planet/EarthElevation';
import { ReferenceFrameGraph } from '../../src/world/spatial/ReferenceFrameGraph';
import { referenceFrame } from '../../src/world/spatial/ReferenceFrame';
import { BuildingGeneratorContext } from '../../src/world/spatial/ActiveSurfaceOrigin';
import { enuBasis } from '../../src/world/spatial/ENU';
import { geodeticToEcef } from '../../src/world/spatial/ECEF';
import { degToRad, quatFromBasis } from '../../src/world/spatial/units';

/** Registers an Earth surface frame exactly as `UniverseRuntime.handoffTo` does. */
export function earthSurfaceFrames(latDeg: number, lonDeg: number, frameId = 'earth/local-enu'): ReferenceFrameGraph {
  const frames = new ReferenceFrameGraph();
  const anchor = { latRad: degToRad(latDeg), lonRad: degToRad(lonDeg), heightM: 0 };
  const ecef = geodeticToEcef(anchor), basis = enuBasis(anchor);
  frames.register(referenceFrame({ id: 'earth/fixed', kind: 'body-fixed' }));
  frames.register(referenceFrame({
    id: frameId, parentId: 'earth/fixed', kind: 'surface-enu',
    originInParent: [ecef.xM, ecef.yM, ecef.zM],
    rotationToParent: quatFromBasis(basis.east, basis.up, [-basis.north[0], -basis.north[1], -basis.north[2]]),
  }));
  return frames;
}

/** Binds production Earth physics and water context at an anchor outside Manaus. */
export function bindEarthSite(latDeg: number, lonDeg: number): { terrain: PlanetTerrainProvider; restore(): void } {
  const previous = BuildingGeneratorContext.activeOrigin;
  BuildingGeneratorContext.activeOrigin = { latDeg, lonDeg, isManaus: false, bodyId: 'earth' };
  const terrain = new PlanetTerrainProvider(earthSurfaceFrames(latDeg, lonDeg), EARTH, EarthGroundSurface);
  PhysicsWorld.setTerrain(terrain);
  return {
    terrain,
    restore() {
      PhysicsWorld.setTerrain(null);
      BuildingGeneratorContext.activeOrigin = previous;
    },
  };
}

/** First longitude, walking east along a parallel, where the solid ground drops below the sea. */
export function findEastCoast(latDeg: number, fromLonDeg: number, toLonDeg: number, stepDeg = 0.0005): number {
  let previous = earthSolidGroundAt(degToRad(latDeg), degToRad(fromLonDeg));
  for (let lon = fromLonDeg + stepDeg; lon <= toLonDeg; lon += stepDeg) {
    const current = earthSolidGroundAt(degToRad(latDeg), degToRad(lon));
    if (previous >= 0 && current < 0) return lon;
    previous = current;
  }
  throw new Error(`no coast between ${fromLonDeg} and ${toLonDeg} at ${latDeg}`);
}
