import { SolarSystem, SOLAR_SYSTEM_FRAME } from '../celestial/SolarSystem';
import { EARTH } from '../planet/PlanetBody';
import { PlanetQuadtree } from '../planet/PlanetQuadtree';
import { DEFAULT_SSE, type ScreenSpaceErrorContext } from '../planet/ScreenSpaceError';
import type { SpatialContext, StreamingContext } from '../providers/WorldProvider';
import { geodeticToEcef } from '../spatial/ECEF';
import { FloatingOrigin3D } from '../spatial/FloatingOrigin3D';
import {
  EARTH_FIXED_FRAME_ID, MANAUS_BASIS, MANAUS_FRAME_ID, legacyLocalToEcef, legacyLocalToGeodetic,
} from '../spatial/ManausFrameAdapter';
import { activeFrame, referenceFrame } from '../spatial/ReferenceFrame';
import { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import { pose, type SpatialPose } from '../spatial/SpatialPose';
import { cloneVec3, finite, quatFromBasis, radToDeg, scaleVec3, type Vec3 } from '../spatial/units';
import { GlobalStreamingScheduler } from '../streaming/GlobalStreamingScheduler';
import { budgetForSpeed, DEFAULT_STREAMING_BUDGET } from '../streaming/StreamingBudget';
import { ProviderRegistry } from './ProviderRegistry';

export interface UniverseRuntimeOptions {
  /**
   * When false the runtime tracks the world and reports on it but streams nothing and touches no
   * scene. That is the default, and it is what lets this ship alongside the existing systems
   * without changing a frame of gameplay until a provider is deliberately registered.
   */
  streaming?: boolean;
  /** Seconds from J2000 the game clock starts at. */
  epochS?: number;
  sse?: ScreenSpaceErrorContext;
}

export interface UniverseTelemetry {
  readonly frame: string;
  readonly latDeg: number;
  readonly lonDeg: number;
  readonly altitudeM: number;
  readonly renderLocalM: number;
  readonly rebases: number;
  readonly dominantBody: string;
  readonly planetTiles: number;
  readonly streaming: GlobalStreamingScheduler['stats'];
}

/**
 * The facade `Game` talks to instead of knowing about frames, providers and bodies.
 *
 * It owns the spatial model, the provider registry, the streaming scheduler and the solar system,
 * and exposes only high-level operations. `Game` keeps the loop, the input and gameplay; it does
 * not keep knowledge of how the universe is addressed.
 *
 * Nothing here draws. It converts, it schedules, and it reports.
 */
export class UniverseRuntime {
  readonly frames = new ReferenceFrameGraph();
  readonly providers = new ProviderRegistry();
  readonly scheduler: GlobalStreamingScheduler;
  readonly solarSystem: SolarSystem;
  readonly earthQuadtree: PlanetQuadtree;
  readonly floatingOrigin: FloatingOrigin3D;

  private readonly options: Required<Omit<UniverseRuntimeOptions, 'sse'>> & { sse: ScreenSpaceErrorContext };
  private readonly playerPose: SpatialPose;
  private readonly velocity: Vec3 = [0, 0, 0];
  private planetTiles = 0;
  private timeS: number;

  constructor(options: UniverseRuntimeOptions = {}) {
    this.options = {
      streaming: options.streaming ?? false,
      epochS: finite(options.epochS),
      sse: options.sse ?? DEFAULT_SSE,
    };
    this.timeS = this.options.epochS;

    this.solarSystem = new SolarSystem({ epochS: this.timeS });
    this.solarSystem.registerFrames(this.frames);
    this.registerEarthFrames();

    this.scheduler = new GlobalStreamingScheduler(this.providers);
    this.earthQuadtree = new PlanetQuadtree(EARTH, { maxTiles: 192, maxLevel: 16 });
    this.playerPose = pose(MANAUS_FRAME_ID, [0, 0, 0]);
    this.floatingOrigin = new FloatingOrigin3D(pose(MANAUS_FRAME_ID, [0, 0, 0]), {
      thresholdM: 2048, gridM: 1024,
    });
  }

  /**
   * Earth's fixed frame, and Manaus hanging off it.
   *
   * The Manaus frame's origin inside Earth-fixed is the anchor's own ECEF position, so the city's
   * legacy metres and the planet's metres meet at exactly one point — the Monumento. Everything
   * the city already contains keeps working in the frame it was compiled in.
   */
  private registerEarthFrames(): void {
    const earthBody = this.solarSystem.bodies.find(body => body.id === 'earth');
    this.frames.register(referenceFrame({
      id: EARTH_FIXED_FRAME_ID,
      parentId: earthBody?.frameId ?? SOLAR_SYSTEM_FRAME,
      kind: 'body-fixed',
      label: 'Terra (fixo)',
    }));
    const anchor = geodeticToEcef(legacyLocalToGeodetic(0, 0, 0));
    // The city's axes are +X east, +Y up, +Z south, so the rotation that carries them into
    // Earth-fixed has the ENU basis as its columns with north negated. Without this the frame
    // would be a translation only, and every conversion out of Manaus would be wrong by the
    // orientation of the tangent plane — which at this latitude is most of the answer.
    const south = scaleVec3(cloneVec3(MANAUS_BASIS.north), -1, [0, 0, 0]);
    this.frames.register(referenceFrame({
      id: MANAUS_FRAME_ID,
      parentId: EARTH_FIXED_FRAME_ID,
      kind: 'surface-enu',
      originInParent: [anchor.xM, anchor.yM, anchor.zM],
      rotationToParent: quatFromBasis(cloneVec3(MANAUS_BASIS.east), cloneVec3(MANAUS_BASIS.up), south),
      label: 'Manaus (projeção compilada)',
    }));
  }

  get time(): number { return this.timeS; }
  get streamingEnabled(): boolean { return this.options.streaming; }
  set streamingEnabled(enabled: boolean) { this.options.streaming = enabled; }

  /** The player's logical pose. Read-only to callers; `update` is what moves it. */
  get player(): SpatialPose { return this.playerPose; }

  /**
   * One frame.
   *
   * `localPosition` is the game's existing world position in Manaus metres — the same numbers the
   * city has always used. Nothing about this call asks the rest of the game to change coordinates.
   */
  update(localPosition: Vec3, localVelocity: Vec3, dtS: number): void {
    const dt = Math.max(0, Math.min(0.25, finite(dtS)));
    this.timeS += dt;

    this.playerPose.position[0] = finite(localPosition[0]);
    this.playerPose.position[1] = finite(localPosition[1]);
    this.playerPose.position[2] = finite(localPosition[2]);
    this.velocity[0] = finite(localVelocity[0]);
    this.velocity[1] = finite(localVelocity[1]);
    this.velocity[2] = finite(localVelocity[2]);

    this.floatingOrigin.update(this.playerPose);
    // A minute of simulated time per second keeps the sky moving without the planets racing.
    this.solarSystem.update(this.timeS);

    if (!this.options.streaming) { this.planetTiles = 0; return; }

    const speed = Math.hypot(this.velocity[0], this.velocity[1], this.velocity[2]);
    const context: StreamingContext = {
      spatial: this.spatialContext(),
      camera: {
        fovRad: this.options.sse.fovRad,
        viewportHeightPx: this.options.sse.viewportHeightPx,
        forward: speed > 1e-3
          ? [this.velocity[0] / speed, this.velocity[1] / speed, this.velocity[2] / speed]
          : [0, 0, -1],
      },
      quality: { sseTargetPx: this.options.sse.targetPx, detailFactor: this.options.sse.detailFactor },
      budget: budgetForSpeed(DEFAULT_STREAMING_BUDGET, speed),
    };
    this.scheduler.update(context, dt);
    this.planetTiles = this.earthQuadtree.select(this.playerEcef(), this.options.sse).length;
  }

  private spatialContext(): SpatialContext {
    const frame = this.frames.has(this.playerPose.frame) ? this.frames.get(this.playerPose.frame) : undefined;
    return {
      timeS: this.timeS,
      player: this.playerPose,
      frame: frame
        ? activeFrame(frame, this.floatingOrigin.logicalOrigin)
        : activeFrame(referenceFrame({ id: this.playerPose.frame, kind: 'render-local' }), this.floatingOrigin.logicalOrigin),
      localVelocityMps: this.velocity,
      bodyId: 'earth',
    };
  }

  /**
   * The player's position in Earth-fixed metres. Real numbers, and never sent to the GPU.
   *
   * This goes through the city's own projection rather than through the frame graph's rigid
   * tangent plane. The two agree exactly at the Monumento and drift apart with distance by the
   * documented 0.67% north stretch — about 135 m at the edge of the compiled city. Using the
   * city's own answer keeps the planet layer agreeing with where the city thinks its buildings
   * are. Giving each 1 024 m tile its own frame is what bounds that to metres instead.
   */
  playerEcef(): { xM: number; yM: number; zM: number } {
    return legacyLocalToEcef(
      this.playerPose.position[0], this.playerPose.position[1], this.playerPose.position[2],
    );
  }

  /** The same position through the frame graph, as a rigid tangent plane on the ellipsoid. */
  playerEcefViaFrames(): { xM: number; yM: number; zM: number } {
    const converted = this.frames.convertPosition(MANAUS_FRAME_ID, EARTH_FIXED_FRAME_ID, this.playerPose.position);
    return { xM: converted[0], yM: converted[1], zM: converted[2] };
  }

  /** Where the player is on the planet, for the HUD and for provider coverage tests. */
  playerGeodetic() {
    return legacyLocalToGeodetic(
      this.playerPose.position[0], this.playerPose.position[1], this.playerPose.position[2],
    );
  }

  /** Called on teleport: everything in flight was for somewhere the player no longer is. */
  prepare(): void {
    this.scheduler.invalidate();
  }

  get telemetry(): UniverseTelemetry {
    const geodetic = this.playerGeodetic();
    const local = this.floatingOrigin.localDistance(this.playerPose.position);
    return {
      frame: this.playerPose.frame,
      latDeg: radToDeg(geodetic.latRad),
      lonDeg: radToDeg(geodetic.lonRad),
      altitudeM: geodetic.heightM,
      renderLocalM: local,
      rebases: this.floatingOrigin.rebaseCount,
      dominantBody: this.solarSystem.dominantBody(
        this.solarSystem.positionOf('earth') ?? [0, 0, 0],
      ).id,
      planetTiles: this.planetTiles,
      streaming: this.scheduler.stats,
    };
  }

  dispose(): void {
    this.scheduler.dispose();
    this.frames.clear();
  }
}
