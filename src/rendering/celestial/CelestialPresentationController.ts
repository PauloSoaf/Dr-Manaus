import { Vector3, PerspectiveCamera } from 'three/webgpu';
import type { UniverseRuntime } from '../../world/runtime/UniverseRuntime';
import type { EarthProvider } from '../../world/providers/EarthProvider';
import type { RockyPlanetProvider } from '../../world/providers/RockyPlanetProvider';
import { CelestialBodyVisualLayer } from './CelestialBodyVisualLayer';
import type { CelestialRenderSample } from './types';
import { CELESTIAL_PROXY_DISTANCE_M, angularRadiusRad, celestialProxyGeometry, projectedDiameterPx } from './math';

export interface CelestialPresentationContext {
  universe: UniverseRuntime;
  earth?: EarthProvider;
  moon?: RockyPlanetProvider;
  mars?: RockyPlanetProvider;
  fovRad: number;
  viewportHeightPx: number;
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
    // The renderer may use observer-centred axes captured at departure (travel/view). Logical
    // telemetry remains barycentric, so render-facing directions must target the render frame.
    const renderFrame = universe.renderSpace.currentOrigin.frame;

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
          renderFrame,
          [dx, dy, dz]
        );
        const sunDirRenderVec = new Vector3(sunDirRender[0], sunDirRender[1], sunDirRender[2]).normalize();
        const angRad = angularRadiusRad(sunDef.equatorialRadiusM, dist);
        const proxyGeo = celestialProxyGeometry(angRad);

        this.samples.push({
          bodyId: 'sun',
          logicalDistanceM: dist,
          physicalRadiusM: sunDef.equatorialRadiusM,
          angularRadiusRad: angRad,
          directionRender: [sunDirRenderVec.x, sunDirRenderVec.y, sunDirRenderVec.z],
          proxyDistanceM: proxyGeo.distanceM,
          proxyRadiusM: proxyGeo.radiusM,
          visible: proxyGeo.safe,
          opacity: 1
        });

        if (earth && earthBary) {
          earth.setSunDirection([sunBary[0] - earthBary[0], sunBary[1] - earthBary[1], sunBary[2] - earthBary[2]], 'solar-system/barycentric', renderFrame);
        }
        if (moon && moonBary) {
          moon.setSunDirection([sunBary[0] - moonBary[0], sunBary[1] - moonBary[1], sunBary[2] - moonBary[2]], 'solar-system/barycentric', renderFrame);
        }
      }
    }

    // --- MARS ---
    const marsBary = system.positionOf('mars');
    if (ctx.mars && marsBary) {
      const marsDef = system.bodies.find(b => b.id === 'mars');
      if (marsDef) {
        const dx = marsBary[0] - observerBary[0];
        const dy = marsBary[1] - observerBary[1];
        const dz = marsBary[2] - observerBary[2];
        const dist = Math.hypot(dx, dy, dz);

        const marsDirRender = universe.frames.convertDirection(
          'solar-system/barycentric',
          renderFrame,
          [dx, dy, dz]
        );
        const marsDirRenderVec = new Vector3(marsDirRender[0], marsDirRender[1], marsDirRender[2]).normalize();
        
        // NOTE: ctx.mars.setCentre is called AFTER representation selection below.
        // Calling it here would send astronomical coordinates to PlanetGlobe before
        // deciding whether the physical globe is even needed.
        const angRad = angularRadiusRad(marsDef.equatorialRadiusM, dist);
        const presentation = system.handoff('mars', observerBary);
        const apparentAngRad = presentation ? presentation.apparentAngularRadiusRad : angRad;
        const proxyGeo = celestialProxyGeometry(apparentAngRad);
        const projectedPx = projectedDiameterPx(apparentAngRad, ctx.fovRad, ctx.viewportHeightPx);
        
        let visible = proxyGeo.safe;
        let opacity = 1;
        let streamingMode: 'off' | 'coarse' | 'surface' = 'off';

        if (presentation) {
          const ready = ctx.mars.readiness();
          const targetMode = presentation.mode;

          if (targetMode === 'celestial') {
            streamingMode = 'off';
            visible = proxyGeo.safe;
            opacity = 1;
            ctx.mars.setVisible(false);
          } else if (targetMode === 'planet') {
            if (projectedPx < 64) {
              streamingMode = 'off';
              visible = proxyGeo.safe;
              opacity = 1;
              ctx.mars.setVisible(false);
            } else {
              streamingMode = 'coarse';
              if (!ready.coarseCoverageReady) {
                visible = proxyGeo.safe;
                opacity = 1;
                ctx.mars.setVisible(false);
              } else {
                visible = proxyGeo.safe && presentation.blend < 1;
                opacity = 1 - presentation.blend;
                ctx.mars.setVisible(true);
                ctx.mars.setOpacity(presentation.blend);
              }
            }
          } else if (targetMode === 'surface') {
            streamingMode = 'surface';
            if (!ready.surfaceCoverageReady && !ready.coarseCoverageReady) {
              visible = proxyGeo.safe;
              opacity = 1;
              ctx.mars.setVisible(false);
            } else {
              visible = false;
              opacity = 0;
              ctx.mars.setVisible(true);
              ctx.mars.setOpacity(1);
            }
          }
        }

        // Only position the physical globe when it will actually be used.
        // For 'off' mode, the render coordinate may be astronomical — do not set it.
        if (streamingMode !== 'off') {
          ctx.mars.setCentre(marsBary, 'solar-system/barycentric', renderFrame, observerBary);
        }
        ctx.mars.setStreamingMode(streamingMode);

        let phaseLightDirRenderVec = undefined;
        if (sunBary) {
          const m2s_x = sunBary[0] - marsBary[0];
          const m2s_y = sunBary[1] - marsBary[1];
          const m2s_z = sunBary[2] - marsBary[2];
          const m2sRender = universe.frames.convertDirection('solar-system/barycentric', renderFrame, [m2s_x, m2s_y, m2s_z]);
          phaseLightDirRenderVec = new Vector3(m2sRender[0], m2sRender[1], m2sRender[2]).normalize();
        }

        this.samples.push({
          bodyId: 'mars',
          logicalDistanceM: dist,
          physicalRadiusM: marsDef.equatorialRadiusM,
          angularRadiusRad: apparentAngRad,
          directionRender: [marsDirRenderVec.x, marsDirRenderVec.y, marsDirRenderVec.z],
          proxyDistanceM: proxyGeo.distanceM,
          proxyRadiusM: proxyGeo.radiusM,
          visible,
          opacity,
          phaseLightDirection: phaseLightDirRenderVec ? [phaseLightDirRenderVec.x, phaseLightDirRenderVec.y, phaseLightDirRenderVec.z] : undefined
        });
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
          renderFrame,
          [dx, dy, dz]
        );
        const moonDirRenderVec = new Vector3(moonDirRender[0], moonDirRender[1], moonDirRender[2]).normalize();
        
        // NOTE: moon.setCentre is called AFTER representation selection below.
        // Calling it here would send astronomical coordinates to PlanetGlobe before
        // deciding whether the physical globe is even needed.
        const angRad = angularRadiusRad(moonDef.equatorialRadiusM, dist);
        const presentation = system.handoff('moon', observerBary);
        const apparentAngRad = presentation ? presentation.apparentAngularRadiusRad : angRad;
        const proxyGeo = celestialProxyGeometry(apparentAngRad);
        const projectedPx = projectedDiameterPx(apparentAngRad, ctx.fovRad, ctx.viewportHeightPx);
        
        let visible = proxyGeo.safe;
        let opacity = 1;
        let streamingMode: 'off' | 'coarse' | 'surface' = 'off';

        if (presentation) {
          const ready = moon.readiness();
          const targetMode = presentation.mode;

          // State machine mapping:
          if (targetMode === 'celestial') {
            streamingMode = 'off';
            visible = proxyGeo.safe;
            opacity = 1;
            moon.setVisible(false);
          } else if (targetMode === 'planet') {
            if (projectedPx < 64) {
              streamingMode = 'off';
              visible = proxyGeo.safe;
              opacity = 1;
              moon.setVisible(false);
            } else {
              streamingMode = 'coarse';
              if (!ready.coarseCoverageReady) {
                // REQUESTING_PLANET
                visible = proxyGeo.safe;
                opacity = 1;
                moon.setVisible(false);
              } else {
                // CELESTIAL_PLANET_OVERLAP or PLANET_ONLY
                visible = proxyGeo.safe && presentation.blend < 1; // still show if crossfading
                opacity = 1 - presentation.blend;
                moon.setVisible(true);
                moon.setOpacity(presentation.blend);
              }
            }
          } else if (targetMode === 'surface') {
            streamingMode = 'surface';
            if (!ready.surfaceCoverageReady && !ready.coarseCoverageReady) {
              // Fallback to celestial if completely unready
              visible = proxyGeo.safe;
              opacity = 1;
              moon.setVisible(false);
            } else {
              // We have some physical representation
              visible = false;
              opacity = 0;
              moon.setVisible(true);
              moon.setOpacity(1);
            }
          }
        }

        // Only position the physical globe when it will actually be used.
        if (streamingMode !== 'off') {
          moon.setCentre(moonBary, 'solar-system/barycentric', renderFrame);
        }
        moon.setStreamingMode(streamingMode);

        let phaseLightDirRenderVec = undefined;
        if (sunBary) {
          const m2s_x = sunBary[0] - moonBary[0];
          const m2s_y = sunBary[1] - moonBary[1];
          const m2s_z = sunBary[2] - moonBary[2];
          const m2sRender = universe.frames.convertDirection('solar-system/barycentric', renderFrame, [m2s_x, m2s_y, m2s_z]);
          phaseLightDirRenderVec = new Vector3(m2sRender[0], m2sRender[1], m2sRender[2]).normalize();
        }

        this.samples.push({
          bodyId: 'moon',
          logicalDistanceM: dist,
          physicalRadiusM: moonDef.equatorialRadiusM,
          angularRadiusRad: apparentAngRad,
          directionRender: [moonDirRenderVec.x, moonDirRenderVec.y, moonDirRenderVec.z],
          proxyDistanceM: proxyGeo.distanceM,
          proxyRadiusM: proxyGeo.radiusM,
          visible,
          opacity,
          phaseLightDirection: phaseLightDirRenderVec ? [phaseLightDirRenderVec.x, phaseLightDirRenderVec.y, phaseLightDirRenderVec.z] : undefined
        });
      }
    }

    // --- EARTH ---
    if (earth && earthBary) {
      const earthDef = system.bodies.find(b => b.id === 'earth');
      if (earthDef) {
        const dx = earthBary[0] - observerBary[0];
        const dy = earthBary[1] - observerBary[1];
        const dz = earthBary[2] - observerBary[2];
        const dist = Math.hypot(dx, dy, dz);

        const earthDirRender = universe.frames.convertDirection(
          'solar-system/barycentric',
          renderFrame,
          [dx, dy, dz]
        );
        const earthDirRenderVec = new Vector3(earthDirRender[0], earthDirRender[1], earthDirRender[2]).normalize();
        
        const angRad = angularRadiusRad(earthDef.equatorialRadiusM, dist);
        const presentation = system.handoff('earth', observerBary);
        const apparentAngRad = presentation ? presentation.apparentAngularRadiusRad : angRad;
        const proxyGeo = celestialProxyGeometry(apparentAngRad);
        const projectedPx = projectedDiameterPx(apparentAngRad, ctx.fovRad, ctx.viewportHeightPx);
        
        let visible = proxyGeo.safe;
        let opacity = 1;
        let streamingMode: 'off' | 'coarse' | 'surface' = 'off';

        if (presentation) {
          const ready = earth.readiness();
          const targetMode = presentation.mode;

          if (targetMode === 'celestial') {
            streamingMode = 'off';
            visible = proxyGeo.safe;
            opacity = 1;
          } else if (targetMode === 'planet') {
            if (projectedPx < 16) {
              streamingMode = 'off';
              visible = proxyGeo.safe;
              opacity = 1;
            } else {
              streamingMode = 'coarse';
              if (ready.coarseFallbackReady) {
                // Earth has synchronous coarse fallback with continents,
                // so we don't need the blue analytic proxy once the fallback is ready.
                visible = false;
                opacity = 0;
              } else if (!ready.viewCoverageReady) {
                visible = proxyGeo.safe;
                opacity = 1;
              } else {
                visible = proxyGeo.safe && presentation.blend < 1;
                opacity = 1 - presentation.blend;
              }
            }
          } else if (targetMode === 'surface') {
            streamingMode = 'surface';
            if (!ready.viewCoverageReady) {
              visible = proxyGeo.safe;
              opacity = 1;
            } else {
              visible = false;
              opacity = 0;
            }
          }
        }
        
        earth.setStreamingMode(streamingMode);

        let phaseLightDirRenderVec = undefined;
        if (sunBary) {
          const e2s_x = sunBary[0] - earthBary[0];
          const e2s_y = sunBary[1] - earthBary[1];
          const e2s_z = sunBary[2] - earthBary[2];
          const e2sRender = universe.frames.convertDirection('solar-system/barycentric', renderFrame, [e2s_x, e2s_y, e2s_z]);
          phaseLightDirRenderVec = new Vector3(e2sRender[0], e2sRender[1], e2sRender[2]).normalize();
        }

        this.samples.push({
          bodyId: 'earth',
          logicalDistanceM: dist,
          physicalRadiusM: earthDef.equatorialRadiusM,
          angularRadiusRad: apparentAngRad,
          directionRender: [earthDirRenderVec.x, earthDirRenderVec.y, earthDirRenderVec.z],
          proxyDistanceM: proxyGeo.distanceM,
          proxyRadiusM: proxyGeo.radiusM,
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
