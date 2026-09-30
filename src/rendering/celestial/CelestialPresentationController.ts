import { Vector3, PerspectiveCamera } from 'three/webgpu';
import type { UniverseRuntime } from '../../world/runtime/UniverseRuntime';
import type { EarthProvider } from '../../world/providers/EarthProvider';
import type { MoonProvider } from '../../world/providers/MoonProvider';
import { CelestialBodyVisualLayer } from './CelestialBodyVisualLayer';
import type { CelestialRenderSample } from './types';
import { CELESTIAL_PROXY_DISTANCE_M, angularRadiusRad } from './math';

export interface CelestialPresentationContext {
  universe: UniverseRuntime;
  earth?: EarthProvider;
  moon?: MoonProvider;
}

export interface CelestialRenderContext {
  camera: PerspectiveCamera;
}

export class CelestialPresentationController {
  private readonly visualLayer: CelestialBodyVisualLayer;
  private samples: CelestialRenderSample[] = [];
  
  constructor(visualLayer: CelestialBodyVisualLayer) {
    this.visualLayer = visualLayer;
  }

  prepare(ctx: CelestialPresentationContext): void {
    const { universe, earth, moon } = ctx;
    const system = universe.activeSystem;
    const telemetry = universe.telemetry;
    const observerFrame = universe.player.frame;
    const observerPos = universe.player.position;

    const observerBary = universe.frames.convertPosition(observerFrame, 'solar-system/barycentric', observerPos);
    const earthBary = system.positionOf('earth');
    const sunBary = system.positionOf('sun');
    const moonBary = system.positionOf('moon');

    this.samples = [];

    // --- SUN ---
    if (sunBary) {
      const sunDef = system.bodies.find(b => b.id === 'sun');
      if (sunDef) {
        const dx = sunBary[0] - observerBary[0];
        const dy = sunBary[1] - observerBary[1];
        const dz = sunBary[2] - observerBary[2];
        const dist = Math.hypot(dx, dy, dz);
        
        const sunDirRender = universe.frames.convertDirection(
          'solar-system/barycentric', 
          telemetry.frame, 
          [dx, dy, dz]
        );
        const sunDirRenderVec = new Vector3(sunDirRender[0], sunDirRender[1], sunDirRender[2]).normalize();
        const angRad = angularRadiusRad(sunDef.equatorialRadiusM, dist);

        this.samples.push({
          bodyId: 'sun',
          logicalDistanceM: dist,
          physicalRadiusM: sunDef.equatorialRadiusM,
          angularRadiusRad: angRad,
          directionRender: [sunDirRenderVec.x, sunDirRenderVec.y, sunDirRenderVec.z],
          proxyDistanceM: CELESTIAL_PROXY_DISTANCE_M,
          proxyRadiusM: Math.tan(angRad) * CELESTIAL_PROXY_DISTANCE_M,
          visible: true,
          opacity: 1
        });

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
        
        moon.setCentre(moonBary, 'solar-system/barycentric', telemetry.frame);
        const angRad = angularRadiusRad(moonDef.equatorialRadiusM, dist);
        
        let visible = true;
        let opacity = 1;
        let streamingMode: 'off' | 'coarse' | 'surface' = 'off';

        const presentation = system.handoff('moon', observerBary);
        if (presentation) {
          const ready = moon.readiness();
          const targetMode = presentation.mode;

          // State machine mapping:
          if (targetMode === 'celestial') {
            streamingMode = 'off';
            visible = true;
            opacity = 1;
            moon.setVisible(false);
          } else if (targetMode === 'planet') {
            streamingMode = 'coarse';
            if (!ready.coarseCoverageReady) {
              // REQUESTING_PLANET
              visible = true;
              opacity = 1;
              moon.setVisible(false);
            } else {
              // CELESTIAL_PLANET_OVERLAP or PLANET_ONLY
              visible = presentation.blend < 1; // still show if crossfading
              opacity = 1 - presentation.blend;
              moon.setVisible(true);
            }
          } else if (targetMode === 'surface') {
            streamingMode = 'surface';
            if (!ready.surfaceCoverageReady && !ready.coarseCoverageReady) {
              // Fallback to celestial if completely unready
              visible = true;
              opacity = 1;
              moon.setVisible(false);
            } else {
              // We have some physical representation
              visible = false;
              opacity = 0;
              moon.setVisible(true);
            }
          }
        }
        
        moon.setStreamingMode(streamingMode);

        let phaseLightDirRenderVec = undefined;
        if (sunBary) {
          const m2s_x = sunBary[0] - moonBary[0];
          const m2s_y = sunBary[1] - moonBary[1];
          const m2s_z = sunBary[2] - moonBary[2];
          const m2sRender = universe.frames.convertDirection('solar-system/barycentric', telemetry.frame, [m2s_x, m2s_y, m2s_z]);
          phaseLightDirRenderVec = new Vector3(m2sRender[0], m2sRender[1], m2sRender[2]).normalize();
        }

        this.samples.push({
          bodyId: 'moon',
          logicalDistanceM: dist,
          physicalRadiusM: moonDef.equatorialRadiusM,
          angularRadiusRad: presentation ? presentation.apparentAngularRadiusRad : angRad,
          directionRender: [moonDirRenderVec.x, moonDirRenderVec.y, moonDirRenderVec.z],
          proxyDistanceM: CELESTIAL_PROXY_DISTANCE_M,
          proxyRadiusM: Math.tan(presentation ? presentation.apparentAngularRadiusRad : angRad) * CELESTIAL_PROXY_DISTANCE_M,
          visible,
          opacity,
          phaseLightDirection: phaseLightDirRenderVec ? [phaseLightDirRenderVec.x, phaseLightDirRenderVec.y, phaseLightDirRenderVec.z] : undefined
        });
      }
    }
  }

  render(ctx: CelestialRenderContext): void {
    this.visualLayer.update(this.samples, ctx.camera);
  }
}
