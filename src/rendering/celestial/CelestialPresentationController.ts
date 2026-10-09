import type { PerspectiveCamera } from 'three/webgpu';
import type { UniverseRuntime } from '../../world/runtime/UniverseRuntime';
import type { EarthProvider } from '../../world/providers/EarthProvider';
import type { RockyPlanetProvider } from '../../world/providers/RockyPlanetProvider';
import { bodyProfile } from '../../world/celestial/CelestialBodyProfile';
import { normalizeVec3, quatFromAxisAngle, multiplyQuat, type Vec3 } from '../../world/spatial/units';
import { CelestialBodyVisualLayer } from './CelestialBodyVisualLayer';
import type { CelestialRenderSample } from './types';
import { angularRadiusRad, boundedCelestialProxy, projectedDiameterPx } from './math';
import { bodyPresentation } from './presentation';

export interface CelestialPresentationContext {
  universe: UniverseRuntime;
  earth?: EarthProvider;
  planetProviders?: ReadonlyMap<string, RockyPlanetProvider>;
  fovRad: number;
  viewportHeightPx: number;
  cameraFarM?: number;
}

export interface CelestialRenderContext { camera: PerspectiveCamera; }

/** Shared observer-relative mathematics for every body; Earth retains its local handoff. */
export class CelestialPresentationController {
  private samples: CelestialRenderSample[] = [];
  private activePhysicalBody?: string;
  private activePhysicalMode: 'off' | 'coarse' | 'surface' = 'off';

  constructor(private readonly visualLayer: CelestialBodyVisualLayer) {}

  get renderSamples(): readonly CelestialRenderSample[] { return this.samples; }
  get physicalBodyId(): string | undefined { return this.activePhysicalBody; }
  get physicalMode(): 'off' | 'coarse' | 'surface' { return this.activePhysicalMode; }

  prepare(ctx: CelestialPresentationContext): void {
    const { universe, earth } = ctx;
    const system = universe.activeSystem;
    const observer = universe.playerSystemPositionM();
    const renderFrame = universe.renderSpace.currentOrigin.frame;
    const sun = system.bodies.find(body => bodyProfile(body).bodyClass === 'star');
    const sunPosition = sun && system.positionOf(sun.id);
    const providers = ctx.planetProviders;
    const candidates = system.bodies.flatMap(body => {
      const position = system.positionOf(body.id);
      if (!position) return [];
      const delta: Vec3 = [position[0] - observer[0], position[1] - observer[1], position[2] - observer[2]];
      const distance = Math.hypot(...delta);
      const handoff = system.handoff(body.id, observer);
      const angle = handoff?.apparentAngularRadiusRad ?? angularRadiusRad(body.equatorialRadiusM, distance);
      const provider = providers?.get(body.id);
      const profile = bodyProfile(body);
      const hasProvider = profile.hasSolidSurface && (profile.surfaceKind === 'earth' ? !!earth : !!provider);
      const centre = hasProvider ? universe.renderSpace.logicalToRender(body.frameId, [0, 0, 0]) : undefined;
      const eligible = hasProvider && !!centre && universe.renderSpace.isRenderSafe(centre)
        && projectedDiameterPx(angle, ctx.fovRad, ctx.viewportHeightPx) >= 16
        && handoff?.mode !== 'celestial';
      return [{ body, position, delta, distance, handoff, angle, provider, profile, eligible }];
    });

    // Only the largest nearby solid body streams terrain. Distant registered providers stay off.
    const physical = candidates.filter(candidate => candidate.eligible)
      .sort((a, b) => b.angle - a.angle)[0];
    this.activePhysicalBody = physical?.body.id;
    this.activePhysicalMode = physical ? physical.handoff?.mode === 'surface' ? 'surface' : 'coarse' : 'off';
    earth?.setStreamingMode(physical?.profile.surfaceKind === 'earth' ? this.activePhysicalMode : 'off');
    for (const [id, provider] of providers ?? []) {
      provider.setStreamingMode(id === physical?.body.id ? this.activePhysicalMode : 'off');
      if (id !== physical?.body.id) provider.setVisible(false);
    }

    this.samples = candidates.map(candidate => {
      const { body, position, delta, distance, handoff, angle, provider, profile } = candidate;
      const direction = normalizeVec3(universe.frames.convertDirection(
        system.systemFrameId, renderFrame, delta));
      const phaseLightDirection = sunPosition ? normalizeVec3(universe.frames.convertDirection(
        system.systemFrameId, renderFrame,
        [sunPosition[0] - position[0], sunPosition[1] - position[1], sunPosition[2] - position[2]])) : undefined;
      // Fixed frames currently omit axial obliquity. Apply the catalog tilt to the visual pole
      // only, preserving the existing Earth/Manaus frame contract.
      const bodyOrientationRender = universe.frames.convertOrientation(body.frameId, renderFrame,
        multiplyQuat(quatFromAxisAngle([1, 0, 0], body.axialTiltRad ?? 0),
          profile.bodyClass === 'star' && body.rotationPeriodS
            ? quatFromAxisAngle([0, 1, 0], (system.time % body.rotationPeriodS) * 2 * Math.PI / body.rotationPeriodS)
            : [0, 0, 0, 1]));
      const bodyFixedOrientationRender = universe.frames.convertOrientation(body.frameId, renderFrame, [0, 0, 0, 1]);
      const presentation = bodyPresentation(angle, profile.visual, ctx.fovRad, ctx.viewportHeightPx);
      const proxy = boundedCelestialProxy(presentation.physicalTangent, presentation.extentTangent, ctx.cameraFarM ?? 100_000);
      const physicalProxyRadiusM = presentation.physicalTangent * proxy.distanceM;
      const presentationProxyRadiusM = presentation.presentationTangent * proxy.distanceM;
      const glowProxyRadiusM = presentation.glowTangent * proxy.distanceM;
      let visible = proxy.safe && distance > 0;
      let opacity = 1;
      if (body.id === physical?.body.id) {
        if (profile.surfaceKind === 'earth' && earth) {
          const ready = earth.readiness();
          if (ready.coarseFallbackReady || ready.viewCoverageReady) { visible = false; opacity = 0; }
        } else if (provider) {
          provider.setCentre(position, system.systemFrameId, renderFrame, observer);
          if (phaseLightDirection) provider.setSunDirection(phaseLightDirection, renderFrame, renderFrame);
          const ready = provider.readiness();
          const readyToDraw = ready.coarseCoverageReady || ready.surfaceCoverageReady;
          provider.setVisible(readyToDraw);
          provider.setOpacity(readyToDraw ? 1 : 0);
          if (readyToDraw) { opacity = 0; visible = false; }
        }
      }
      if (profile.surfaceKind === 'earth' && earth && phaseLightDirection) {
        earth.setSunDirection(phaseLightDirection, renderFrame, renderFrame);
      }
      return { solarTimeS: system.time, bodyId: body.id, displayName: body.name, stellar: body.stellar, parentId: body.parentId, profile, logicalDistanceM: distance, physicalRadiusM: body.equatorialRadiusM,
        angularRadiusRad: angle, directionRender: direction, proxyDistanceM: proxy.distanceM,
        proxyRadiusM: physicalProxyRadiusM, presentationProxyRadiusM, glowProxyRadiusM,
        physicalProjectedDiameterPx: presentation.physicalProjectedDiameterPx,
        presentationDiameterPx: presentation.presentationDiameterPx,
        pointMix: presentation.pointMix, ringsOpacity: presentation.ringsOpacity,
        visible, opacity, phaseLightDirection, bodyOrientationRender, bodyFixedOrientationRender };
    });
  }

  render(ctx: CelestialRenderContext): void { this.visualLayer.update(this.samples, ctx.camera); }
}
