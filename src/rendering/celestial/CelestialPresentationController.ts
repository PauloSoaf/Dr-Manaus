import { Vector3, PerspectiveCamera } from 'three/webgpu';
import type { UniverseRuntime } from '../../world/runtime/UniverseRuntime';
import type { EarthProvider } from '../../world/providers/EarthProvider';
import type { MoonProvider } from '../../world/providers/MoonProvider';
import { CelestialBodyVisualLayer } from './CelestialBodyVisualLayer';
import type { CelestialRenderSample } from './types';
import { EARTH_FIXED_FRAME_ID } from '../../world/spatial/ManausFrameAdapter';

export interface CelestialPresentationContext {
  universe: UniverseRuntime;
  earth?: EarthProvider;
  moon?: MoonProvider;
  camera: PerspectiveCamera;
  dt: number;
}

/**
 * Coordinates between the logical astronomical simulation (SolarSystem) and the visual presentation.
 * Calculates directions, angular sizes, and decides which representation (celestial disc, planet globe, surface)
 * should be active.
 */
export class CelestialPresentationController {
  private readonly visualLayer: CelestialBodyVisualLayer;
  
  constructor(visualLayer: CelestialBodyVisualLayer) {
    this.visualLayer = visualLayer;
  }

  update(ctx: CelestialPresentationContext): void {
    const { universe, earth, moon, camera } = ctx;
    const system = universe.activeSystem;
    const telemetry = universe.telemetry;
    const observerFrame = universe.player.frame;
    const observerPos = universe.player.position;

    // We need everything in a common astronomical frame (barycentric) to compute accurate directions and distances.
    // However, since barycentric coordinates are large, we compute vectors locally when possible.
    const observerBary = universe.frames.convertPosition(observerFrame, 'solar-system/barycentric', observerPos);
    const earthBary = system.positionOf('earth');
    const sunBary = system.positionOf('sun');
    const moonBary = system.positionOf('moon');

    const samples: CelestialRenderSample[] = [];

    // --- SUN ---
    if (sunBary) {
      const sunDef = system.bodies.find(b => b.id === 'sun');
      if (sunDef) {
        const dx = sunBary[0] - observerBary[0];
        const dy = sunBary[1] - observerBary[1];
        const dz = sunBary[2] - observerBary[2];
        const dist = Math.hypot(dx, dy, dz);
        
        // Convert the direction into the render frame
        const sunDirRender = universe.frames.convertDirection(
          'solar-system/barycentric', 
          telemetry.frame, 
          [dx, dy, dz]
        );
        const sunDirRenderVec = new Vector3(sunDirRender[0], sunDirRender[1], sunDirRender[2]).normalize();

        const angularRadius = Math.asin(sunDef.equatorialRadiusM / dist);

        samples.push({
          bodyId: 'sun',
          logicalDistanceM: dist,
          physicalRadiusM: sunDef.equatorialRadiusM,
          angularRadiusRad: angularRadius,
          directionRender: [sunDirRenderVec.x, sunDirRenderVec.y, sunDirRenderVec.z],
          proxyDistanceM: camera.far * 0.85,
          proxyRadiusM: Math.tan(angularRadius) * (camera.far * 0.85),
          mode: 'celestial',
          blend: 1
        });

        // Update lighting on Earth and Moon
        if (earth && earthBary) {
          earth.setSunDirection([sunBary[0] - earthBary[0], sunBary[1] - earthBary[1], sunBary[2] - earthBary[2]], 'solar-system/barycentric', telemetry.frame);
        }
        if (moon && moonBary) {
          moon.setSunDirection([sunBary[0] - moonBary[0], sunBary[1] - moonBary[1], sunBary[2] - moonBary[2]], 'solar-system/barycentric', telemetry.frame);
        }
      }
    }

    // --- MOON ---
    if (moon && moonBary) {
      const moonDef = system.bodies.find(b => b.id === 'moon');
      if (moonDef) {
        const dx = moonBary[0] - observerBary[0];
        const dy = moonBary[1] - observerBary[1];
        const dz = moonBary[2] - observerBary[2];
        const dist = Math.hypot(dx, dy, dz);

        const moonDirRender = universe.frames.convertDirection(
          'solar-system/barycentric',
          telemetry.frame,
          [dx, dy, dz]
        );
        const moonDirRenderVec = new Vector3(moonDirRender[0], moonDirRender[1], moonDirRender[2]).normalize();
        
        // Fix Moon center logic: it belongs in MOON_FIXED_FRAME_ID at [0,0,0], 
        // we just translate it to the current render space.
        const moonCentreRender = universe.renderSpace.logicalToRender('moon/fixed', [0,0,0]);
        // But Game.ts was passing a vector to setCentre with 'earth/fixed' ? No, Game.ts used:
        // moon.setCentre([moonAt - earthCentre], 'earth/fixed', telemetry.frame). 
        // That was buggy because (moon - earth) barycentric is NOT earth/fixed!
        // So we fix it: set the Moon's center directly in render space, or rely on its own tracking.
        // The MoonGlobe already places itself at `this.universe.renderSpace.logicalToRender('moon/fixed', [0,0,0])` if we wire it right.
        // Actually, MoonProvider expects `setCentre(pos, fromFrame, toFrame)`. 
        // Let's pass the barycentric coordinate of the Moon directly.
        moon.setCentre(moonBary, 'solar-system/barycentric', telemetry.frame);

        const angularRadius = Math.asin(moonDef.equatorialRadiusM / dist);
        
        // Handoff decision
        let mode: 'celestial' | 'planet' | 'surface' = 'celestial';
        let blend = 1;

        // Use SolarSystem handoff logic if we want, but for Moon:
        // angular radius > 0.05 rad (~3 deg, much closer than Earth's view) might switch to planet.
        // Let's use simple angular rules to avoid popping.
        if (angularRadius > 0.1) {
          mode = 'surface';
        } else if (angularRadius > 0.01) {
          mode = 'planet';
        }

        moon.setPresentationMode(mode);

        // Phase light direction: direction from Moon to Sun in render space
        let phaseLightDirRenderVec = undefined;
        if (sunBary) {
          const m2s_x = sunBary[0] - moonBary[0];
          const m2s_y = sunBary[1] - moonBary[1];
          const m2s_z = sunBary[2] - moonBary[2];
          const m2sRender = universe.frames.convertDirection('solar-system/barycentric', telemetry.frame, [m2s_x, m2s_y, m2s_z]);
          phaseLightDirRenderVec = new Vector3(m2sRender[0], m2sRender[1], m2sRender[2]).normalize();
        }

        samples.push({
          bodyId: 'moon',
          logicalDistanceM: dist,
          physicalRadiusM: moonDef.equatorialRadiusM,
          angularRadiusRad: angularRadius,
          directionRender: [moonDirRenderVec.x, moonDirRenderVec.y, moonDirRenderVec.z],
          proxyDistanceM: camera.far * 0.80,
          proxyRadiusM: Math.tan(angularRadius) * (camera.far * 0.80),
          mode,
          blend,
          phaseLightDirection: phaseLightDirRenderVec ? [phaseLightDirRenderVec.x, phaseLightDirRenderVec.y, phaseLightDirRenderVec.z] : undefined
        });
      }
    }

    this.visualLayer.update(samples, camera);
  }
}
