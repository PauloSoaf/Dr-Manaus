import type { Object3D } from 'three/webgpu';
import { EarthGlobe, buildTileMesh } from '../planet/EarthGlobe';
import { EARTH } from '../planet/PlanetBody';
import { PlanetQuadtree } from '../planet/PlanetQuadtree';
import { DEFAULT_SSE } from '../planet/ScreenSpaceError';
import { type PlanetTileAddress, tileCentreGeodetic, tileExtentM } from '../planet/PlanetTileAddress';
import type { EcefPosition } from '../spatial/ECEF';
import { ecefDistance, geodeticToEcef } from '../spatial/ECEF';
import {
  EARTH_FIXED_FRAME_ID, MANAUS_FRAME_ID, legacyLocalToGeodetic,
} from '../spatial/ManausFrameAdapter';
import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import type { RenderSpaceService } from '../spatial/RenderSpaceService';
import { cloneQuat, finite, IDENTITY_QUAT, radToDeg, type Quat, type Vec3 } from '../spatial/units';
import {
  type ActiveTile, type TileDemand, type TilePayload, type WorldTileKey,
  tileDemand, tileKeyToString,
} from '../streaming/TileDemand';
import {
  type CoverageClaim, type SpatialContext, type StreamingContext, type WorldProvider,
  regionContains,
} from './WorldProvider';
import { type EarthCoverageReadiness, createDefaultReadiness } from './EarthCoverageReadiness';

/**
 * How far Manaus reaches. Derived from the compiled tile grid — 645 tiles of 1 024 m, roughly
 * 26 km across — with margin, and expressed in degrees so a planetary provider can test it
 * without knowing anything about the city's projection.
 */
export const MANAUS_COVERAGE = {
  bodyId: 'earth',
  minLatDeg: -3.40, maxLatDeg: -2.86,
  minLonDeg: -60.30, maxLonDeg: -59.76,
} as const;

export interface EarthProviderOptions {
  /**
   * Below this altitude the globe stays hidden.
   *
   * The city is still a flat plane on a curved planet: at 20 km from the anchor the ellipsoid has
   * dropped 31 m below it, so drawing both near the ground would show the seam. Above this the
   * curvature is what you are looking at and the flat patch underneath is a pixel wide. Removing
   * this gate is what "curve Manaus onto the ellipsoid" buys.
   */
  minAltitudeM?: number;
  /** Fade band above `minAltitudeM`, metres. */
  fadeM?: number;
  maxTiles?: number;
  maxLevel?: number;
  /**
   * How long a selection may be reused before it is recomputed anyway, in seconds.
   *
   * The distance test below already catches a moving camera; this catches everything else --
   * a changed epoch, a body that rotated, a quality change that did not alter the signature.
   */
  replanIntervalS?: number;
  /**
   * Whether the compiled city owns the ground beneath it, so the globe must not draw there.
   *
   * True while Manaus is a flat plane on a curved planet. The two disagree by 31 m at 20 km from
   * the anchor, so a globe tile under the city is a second, coarser Manaus pushing up through the
   * real one. Curving the city onto the ellipsoid is what makes them agree, and only then can
   * this be turned off -- which is why the caller decides it from the feature flag rather than
   * this file deciding it from a comment.
   */
  cityOwnsGround?: boolean;
  renderSpace?: RenderSpaceService;
}

/**
 * The Earth, as a streamed provider.
 *
 * It plans from the quadtree, builds ellipsoid patches, and places them in the scene using the
 * frame graph — so a tile's position comes out of the spatial model rather than out of a guess.
 * It never draws where the city claims the ground: the ownership rule the registry enforces is
 * what stops a second, coarser Manaus appearing underneath the real one.
 */
export class EarthProvider implements WorldProvider {
  readonly id = 'earth/globe';
  /** Below the city and below the authored landmarks: generic terrain loses every tie. */
  readonly priority = 10;

  readonly globe: EarthGlobe;
  private readonly quadtree: PlanetQuadtree;
  private readonly options: Required<Omit<EarthProviderOptions, 'renderSpace'>> & { renderSpace?: RenderSpaceService };
  private altitudeM = 0;
  private opacity = 0;

  constructor(
    parent: Object3D,
    private readonly frames: ReferenceFrameGraph,
    options: EarthProviderOptions = {},
  ) {
    this.globe = new EarthGlobe(parent);
    this.options = {
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 0)),
      fadeM: Math.max(1, finite(options.fadeM, 10_000)),
      maxTiles: Math.max(6, finite(options.maxTiles, 160)),
      maxLevel: Math.max(0, finite(options.maxLevel, 10)),
      replanIntervalS: Math.max(0, finite(options.replanIntervalS, 0.25)),
      cityOwnsGround: options.cityOwnsGround ?? true,
      renderSpace: options.renderSpace,
    };
    this.quadtree = new PlanetQuadtree(EARTH, {
      maxTiles: this.options.maxTiles, maxLevel: this.options.maxLevel,
    });
  }

  get stats(): { tiles: number; triangles: number; visible: boolean; altitudeM: number } {
    return { ...this.globe.stats, altitudeM: this.altitudeM };
  }

  /**
   * Manaus owns its own ground, water, roads and buildings. This provider declares nothing, which
   * is what makes it lose every overlap — it is the fallback, not a competitor.
   */
  coverage(): readonly CoverageClaim[] { return []; }

  /**
   * Aims the globe's sun. Takes the Earth-to-Sun direction in the solar system frame and turns it
   * into scene axes, so the lit hemisphere is the one genuinely facing the Sun.
   */
  setSunDirection(earthToSunInSystem: Vec3, systemFrameId: string, targetFrameId: string): void {
    const inScene = this.frames.convertDirection(systemFrameId, targetFrameId, earthToSunInSystem);
    this.globe.setSunDirection(inScene);
  }

  covers(context: SpatialContext): boolean {
    this.playerFrameId = context.frame.id;
    if (context.altitudeM !== undefined && Number.isFinite(context.altitudeM)) {
      this.altitudeM = context.altitudeM;
    } else {
      let local = context.player.position;
      if (context.frame.id !== MANAUS_FRAME_ID) {
        local = this.frames.convertPosition(context.frame.id, MANAUS_FRAME_ID, local);
      }
      const geodetic = legacyLocalToGeodetic(local[0], local[1], local[2]);
      this.altitudeM = geodetic.heightM;
    }
    const above = this.altitudeM - this.options.minAltitudeM;
    this.opacity = this.options.minAltitudeM > 0
      ? Math.min(1, Math.max(0, above / this.options.fadeM))
      : 1;
    this.globe.visible = this.opacity > 0.01;
    this.globe.setCenterM(this.earthCenterRender(context), this.bodyToScene(), this.altitudeM);
    return this.globe.visible;
  }

  /**
   * Computes structured readiness for the current view and target LOD.
   * Checks if required tiles are actually active in the globe or if coarse fallback is ready.
   */
  readiness(targetLod = 0): EarthCoverageReadiness {
    const cached = this.cachedPlan;
    const coarseFallbackReady = this.globe.stats.coarseFallback;
    if (!cached || cached.demands.length === 0) {
      return {
        requestedKeys: [],
        requiredKeys: [],
        activeRequiredKeys: [],
        missingRequiredKeys: [],
        coverageRatio: coarseFallbackReady ? 1 : 0,
        coarseFallbackReady,
        viewCoverageReady: coarseFallbackReady,
        targetLod,
      };
    }

    const requestedKeys = cached.demands.map(d => tileKeyToString(d.key));
    const requiredDemands = targetLod <= 0
      ? cached.demands.slice(0, 16)
      : cached.demands.filter(d => (d.key as any).level >= targetLod).slice(0, 16);
    const requiredKeys = requiredDemands.length > 0
      ? requiredDemands.map(d => tileKeyToString(d.key))
      : cached.demands.slice(0, 8).map(d => tileKeyToString(d.key));

    const activeRequiredKeys: string[] = [];
    const missingRequiredKeys: string[] = [];

    for (const key of requiredKeys) {
      if (this.globe.hasTile(key)) {
        activeRequiredKeys.push(key);
      } else {
        missingRequiredKeys.push(key);
      }
    }

    const coverageRatio = requiredKeys.length > 0
      ? activeRequiredKeys.length / requiredKeys.length
      : (coarseFallbackReady ? 1 : 0);

    const viewCoverageReady = coarseFallbackReady || coverageRatio >= 0.7;

    return {
      requestedKeys,
      requiredKeys,
      activeRequiredKeys,
      missingRequiredKeys,
      coverageRatio,
      coarseFallbackReady,
      viewCoverageReady,
      targetLod,
    };
  }

  /**
   * Checks if the required representation is already loaded and active.
   * A crossfader uses this to wait before retiring the local representation.
   */
  isCoverageReady(requiredLod: number): boolean {
    return this.readiness(requiredLod).viewCoverageReady;
  }

  /**
   * What the globe would like loaded.
   *
   * The selection is memoised. It is a function of where the camera is and how much error the
   * quality preset tolerates, and neither changes meaningfully in a sixtieth of a second -- but
   * deriving it costs about 2.3 ms at orbital altitude, which is more than half the streaming
   * budget for the whole world. Spending that every frame to arrive at the same answer left
   * nothing for fetching, so tiles were planned and never loaded.
   *
   * It is recomputed when the camera has moved a quarter of the finest tile it chose, when the
   * camera or quality context changes, or once `replanIntervalS` has passed.
   */
  plan(context: StreamingContext): readonly TileDemand[] {
    const camera = this.playerEcef(context.spatial.player.position);
    const signature = `${context.camera.fovRad}|${context.camera.viewportHeightPx}`
      + `|${context.quality.sseTargetPx}|${context.quality.detailFactor}`;
    const cached = this.cachedPlan;
    if (cached
      && cached.signature === signature
      && context.spatial.timeS - cached.timeS < this.options.replanIntervalS
      && ecefDistance(cached.cameraEcef, camera) < cached.radiusM) {
      return cached.demands;
    }

    const selection = this.quadtree.select(camera, {
      ...DEFAULT_SSE,
      fovRad: context.camera.fovRad,
      viewportHeightPx: context.camera.viewportHeightPx,
      targetPx: context.quality.sseTargetPx,
      detailFactor: context.quality.detailFactor,
    });

    const demands: TileDemand[] = [];
    for (const tile of selection) {
      // Where the city owns the ground at low altitude, the city draws it.
      // At high altitude (>= 20,000 m), Earth globe must draw all tiles so there is no hole under Manaus.
      if (this.options.cityOwnsGround && this.altitudeM < 20_000 && this.coveredByCity(tile.address)) continue;
      demands.push(tileDemand({
        key: this.keyFor(tile.address),
        providerId: this.id,
        geometricErrorM: tile.geometricErrorM,
        screenSpaceError: tile.screenSpaceErrorPx,
        distanceM: tile.distanceM,
        timeToContactS: Number.POSITIVE_INFINITY,
        gameplayCritical: false,
        representation: 'planet',
        centreM: [tile.centre.xM, tile.centre.yM, tile.centre.zM],
      }));
    }

    // How far the camera may move before this selection is worth deriving again: a quarter of the
    // smallest tile in it. Below that, nothing in the quadtree would choose differently.
    let finestM = Number.POSITIVE_INFINITY;
    for (const tile of selection) {
      finestM = Math.min(finestM, tileExtentM(tile.address, EARTH.semiMajorAxisM));
    }
    this.cachedPlan = {
      demands,
      cameraEcef: camera,
      radiusM: Number.isFinite(finestM) ? Math.max(25, finestM * 0.25) : 25,
      timeS: context.spatial.timeS,
      signature,
    };
    return demands;
  }

  /**
   * True when a tile lies wholly inside the compiled city. A tile that merely overlaps still
   * draws: the alternative is a hole in the planet beside the city, which is worse than an
   * overlap the city's own geometry covers anyway.
   */
  private coveredByCity(address: PlanetTileAddress): boolean {
    const centre = tileCentreGeodetic(address);
    const latDeg = radToDeg(centre.latRad), lonDeg = radToDeg(centre.lonRad);
    if (!regionContains(MANAUS_COVERAGE, latDeg, lonDeg)) return false;
    // Only fine tiles are small enough to be genuinely inside; a coarse one spans far more.
    return address.level >= 8;
  }

  load(demand: TileDemand): Promise<TilePayload> {
    const address = this.addressFor(demand.key);
    if (!address) return Promise.reject(new Error(`${tileKeyToString(demand.key)} is not an Earth tile`));
    // Generated, not fetched: there is no network call anywhere on this path.
    const mesh = buildTileMesh(address);
    return Promise.resolve({
      key: demand.key,
      version: 1,
      cpuBytes: mesh.bytes,
      estimatedGpuBytes: mesh.bytes,
      geometricErrorM: demand.geometricErrorM,
      geometry: mesh,
    });
  }

  activate(payload: TilePayload): ActiveTile {
    const mesh = payload.geometry as ReturnType<typeof buildTileMesh>;
    const key = tileKeyToString(payload.key);
    // Body-local placement: mesh sits at its ECEF coordinates inside the Earth body group.
    this.globe.add(key, mesh, [mesh.centre.xM, mesh.centre.yM, mesh.centre.zM]);
    return {
      key: payload.key, providerId: this.id, payload, representation: 'planet',
      dispose: () => this.globe.remove(key),
    };
  }

  deactivate(tile: ActiveTile): void {
    this.globe.remove(tileKeyToString(tile.key));
  }

  dispose(): void { this.globe.dispose(); }

  private keyFor(address: PlanetTileAddress): WorldTileKey {
    return { kind: 'planet', bodyId: address.bodyId, face: address.face, level: address.level, x: address.x, y: address.y };
  }

  private playerFrameId = MANAUS_FRAME_ID;

  private addressFor(key: WorldTileKey): PlanetTileAddress | undefined {
    return key.kind === 'planet'
      ? { bodyId: key.bodyId, face: key.face as PlanetTileAddress['face'], level: key.level, x: key.x, y: key.y }
      : undefined;
  }

  private playerEcef(local: Vec3): EcefPosition {
    if (this.playerFrameId === MANAUS_FRAME_ID) {
      return geodeticToEcef(legacyLocalToGeodetic(local[0], local[1], local[2]));
    }
    if (this.playerFrameId === EARTH_FIXED_FRAME_ID) {
      return { xM: local[0], yM: local[1], zM: local[2] };
    }
    if (this.frames.has(this.playerFrameId) && this.frames.has(EARTH_FIXED_FRAME_ID)) {
      const ecef = this.frames.convertPosition(this.playerFrameId, EARTH_FIXED_FRAME_ID, local);
      return { xM: ecef[0], yM: ecef[1], zM: ecef[2] };
    }
    return { xM: 0, yM: 0, zM: 0 };
  }

  /** Calculates the Earth's center in camera/origin-relative render space. */
  private earthCenterRender(context?: SpatialContext): Vec3 {
    if (this.options.renderSpace) {
      return this.options.renderSpace.logicalToRender(EARTH_FIXED_FRAME_ID, [0, 0, 0]);
    }
    if (this.playerFrameId === 'solar-system/barycentric') {
      const earthBary = this.frames.convertPosition(EARTH_FIXED_FRAME_ID, 'solar-system/barycentric', [0, 0, 0]);
      const playerPos = context?.player.position ?? [0, 0, 0];
      return [earthBary[0] - playerPos[0], earthBary[1] - playerPos[1], earthBary[2] - playerPos[2]];
    }
    return this.frames.convertPosition(EARTH_FIXED_FRAME_ID, this.playerFrameId, [0, 0, 0]);
  }

  /**
   * The rotation carrying Earth-fixed axes into the scene's. Cached per active frame.
   */
  private bodyToScene(): Quat {
    const targetFrame = this.options.renderSpace
      ? this.options.renderSpace.currentOrigin.frame
      : this.playerFrameId;
    if (!this.sceneRotation || this.sceneRotationFrame !== targetFrame) {
      this.sceneRotation = this.frames.convertOrientation(
        EARTH_FIXED_FRAME_ID, targetFrame, cloneQuat(IDENTITY_QUAT),
      );
      this.sceneRotationFrame = targetFrame;
    }
    return this.sceneRotation;
  }


  private sceneRotation?: Quat;
  private sceneRotationFrame?: string;

  private cachedPlan?: {
    readonly demands: readonly TileDemand[];
    readonly cameraEcef: EcefPosition;
    /** How far the camera may move before the selection is stale, in metres. */
    readonly radiusM: number;
    readonly timeS: number;
    readonly signature: string;
  };
}
