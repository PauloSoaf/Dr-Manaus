import type { Object3D } from 'three/webgpu';
import { PlanetGlobe, buildPlanetTileMesh } from '../planet/PlanetGlobe';
import type { PlanetSurfaceGenerator } from '../planet/PlanetSurface';
import type { PlanetBody } from '../planet/PlanetBody';
import { PlanetQuadtree } from '../planet/PlanetQuadtree';
import { DEFAULT_SSE } from '../planet/ScreenSpaceError';
import { tileExtentM } from '../planet/PlanetTileAddress';
import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import type { RenderSpaceService } from '../spatial/RenderSpaceService';
import { cloneQuat, finite, IDENTITY_QUAT, type Quat, type Vec3 } from '../spatial/units';
import {
  type ActiveTile, type TileDemand, type TilePayload, type PlanetTileKey,
  tileDemand, tileKeyToString,
} from '../streaming/TileDemand';
import type { CoverageClaim, SpatialContext, StreamingContext, WorldProvider } from './WorldProvider';
import type { EcefPosition } from '../spatial/ECEF';

export interface PlanetCoverageReadiness {
  readonly activeTiles: number;
  readonly coarseCoverageReady: boolean;
  readonly surfaceCoverageReady: boolean;
}

export interface RockyPlanetProviderOptions {
  minAltitudeM?: number;
  maxRangeM?: number;
  maxTiles?: number;
  maxLevel?: number;
  replanIntervalS?: number;
  renderSpace?: RenderSpaceService;
}

export class RockyPlanetProvider implements WorldProvider {
  readonly id: string;
  readonly priority = 10;

  readonly globe: PlanetGlobe;
  private readonly quadtree: PlanetQuadtree;
  private readonly options: Required<Omit<RockyPlanetProviderOptions, 'renderSpace'>> & { renderSpace?: RenderSpaceService };
  private centreM: Vec3 = [0, 0, 0];
  private distanceM = Number.POSITIVE_INFINITY;
  private streamingMode: 'off' | 'coarse' | 'surface' = 'off';
  private cachedPlan?: { demands: readonly TileDemand[]; observer: EcefPosition; radiusM: number; timeS: number };
  private playerFrameId = 'solar-system/barycentric';

  constructor(
    parent: Object3D,
    private readonly frames: ReferenceFrameGraph,
    public readonly bodyDef: PlanetBody,
    public readonly surface: PlanetSurfaceGenerator,
    options: RockyPlanetProviderOptions = {},
  ) {
    this.id = `${bodyDef.id}/surface`;
    this.globe = new PlanetGlobe(bodyDef.id);
    this.globe.visible = false;
    parent.add(this.globe.root);

    this.options = {
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 400_000)),
      maxRangeM: Math.max(1, finite(options.maxRangeM, 20_000_000)),
      maxTiles: Math.max(6, finite(options.maxTiles, 96)),
      maxLevel: Math.max(0, finite(options.maxLevel, 9)),
      replanIntervalS: Math.max(0, finite(options.replanIntervalS, 0.25)),
      renderSpace: options.renderSpace,
    };
    this.quadtree = new PlanetQuadtree(bodyDef, {
      maxTiles: this.options.maxTiles, maxLevel: this.options.maxLevel,
    });
  }

  get stats(): { tiles: number; triangles: number; visible: boolean; distanceM: number } {
    return { ...this.globe.stats, distanceM: this.distanceM };
  }

  get presentationMode(): 'off' | 'coarse' | 'surface' { return this.streamingMode; }

  readiness(): PlanetCoverageReadiness {
    const activeTiles = this.globe.stats.tiles;
    if (!this.cachedPlan || this.cachedPlan.demands.length === 0) {
      return { activeTiles, coarseCoverageReady: false, surfaceCoverageReady: false };
    }

    let allRequiredReady = true;
    for (const demand of this.cachedPlan.demands) {
      if (!this.globe.has(tileKeyToString(demand.key))) {
        allRequiredReady = false;
        break;
      }
    }

    return {
      activeTiles,
      coarseCoverageReady: allRequiredReady,
      surfaceCoverageReady: allRequiredReady && this.streamingMode === 'surface',
    };
  }

  coverage(): readonly CoverageClaim[] { return []; }

  covers(context: SpatialContext): boolean {
    this.playerFrameId = context.frame.id;

    if (this.streamingMode === 'off') {
      this.globe.visible = false;
      return false;
    }

    if (this.options.renderSpace) {
      const candidate = this.planetCenterRender(context);
      if (!this.options.renderSpace.isRenderSafe(candidate)) {
        // Body is too far for physical rendering — keep globe hidden and let
        // CelestialBodyVisualLayer handle the analytic proxy.
        this.globe.visible = false;
        this.distanceM = Number.POSITIVE_INFINITY;
        return false;
      }
      this.centreM = candidate;
      this.globe.setCentre(this.centreM);
      this.globe.setOrientation(this.bodyToScene());
      this.distanceM = Math.hypot(...this.centreM);
    } else {
      const player = context.player.position;
      this.distanceM = Math.hypot(
        this.centreM[0] - player[0], this.centreM[1] - player[1], this.centreM[2] - player[2],
      );
    }

    return true;
  }

  setStreamingMode(mode: 'off' | 'coarse' | 'surface'): void {
    if (this.streamingMode !== mode) {
      this.streamingMode = mode;
      this.cachedPlan = undefined;
    }
  }

  setVisible(visible: boolean): void {
    this.globe.visible = visible;
  }

  setOpacity(opacity: number): void {
    this.globe.opacity = opacity;
  }

  setCentre(planetRelativeM: Vec3, systemFrameId: string, targetFrameId: string, observerPosition?: Vec3): void {
    const planetFrame = this.resolveBodyFrame();
    if (this.options.renderSpace && planetFrame) {
      const candidate = this.options.renderSpace.logicalToRender(planetFrame, [0, 0, 0]);
      if (!this.options.renderSpace.isRenderSafe(candidate)) {
        // Body is too far to be represented as a physical globe in this frame.
        // The controller must have already set streamingMode 'off'; keep globe hidden.
        this.globe.visible = false;
        return;
      }
      this.centreM = candidate;
    } else if (targetFrameId === 'solar-system/barycentric' && observerPosition) {
      const planetBary = this.frames.convertPosition(systemFrameId, 'solar-system/barycentric', planetRelativeM);
      this.centreM = [planetBary[0] - observerPosition[0], planetBary[1] - observerPosition[1], planetBary[2] - observerPosition[2]];
    } else {
      this.centreM = this.frames.convertPosition(systemFrameId, targetFrameId, planetRelativeM);
    }
    this.globe.setCentre(this.centreM);
    this.globe.setOrientation(this.bodyToScene());
  }

  setSunDirection(planetToSunInSystem: Vec3, systemFrameId: string, targetFrameId: string): void {
    this.globe.setSunDirection(this.frames.convertDirection(systemFrameId, targetFrameId, planetToSunInSystem));
  }

  plan(context: StreamingContext): readonly TileDemand[] {
    if (this.streamingMode === 'off') return [];
    // Observer in the planet's own body-fixed frame — what the quadtree needs.
    const planetFrame = this.resolveBodyFrame();
    let observerFixed: EcefPosition;

    if (planetFrame && this.frames.has(context.spatial.player.frame)) {
      const v = this.frames.convertPosition(
        context.spatial.player.frame,
        planetFrame,
        context.spatial.player.position,
      );
      observerFixed = { xM: v[0], yM: v[1], zM: v[2] };
    } else if (this.options.renderSpace) {
      observerFixed = { xM: -this.centreM[0], yM: -this.centreM[1], zM: -this.centreM[2] };
    } else {
      const pp = context.spatial.player.position;
      observerFixed = {
        xM: pp[0] - this.centreM[0],
        yM: pp[1] - this.centreM[1],
        zM: pp[2] - this.centreM[2],
      };
    }

    const cached = this.cachedPlan;
    const ecefDist = cached
      ? Math.hypot(
          observerFixed.xM - cached.observer.xM,
          observerFixed.yM - cached.observer.yM,
          observerFixed.zM - cached.observer.zM,
        )
      : Infinity;
    if (cached
      && context.spatial.timeS - cached.timeS < this.options.replanIntervalS
      && ecefDist < cached.radiusM) {
      return cached.demands;
    }

    const isCoarse = this.streamingMode === 'coarse';
    const selection = this.quadtree.select(observerFixed, {
      ...DEFAULT_SSE,
      fovRad: context.camera.fovRad,
      viewportHeightPx: context.camera.viewportHeightPx,
      targetPx: isCoarse ? 500 : context.quality.sseTargetPx,
      detailFactor: isCoarse ? 0.1 : context.quality.detailFactor,
    });

    const demands: TileDemand[] = [];
    let finestM = Number.POSITIVE_INFINITY;
    for (const tile of selection) {
      finestM = Math.min(finestM, tileExtentM(tile.address, this.surface.radiusM));
      const key: PlanetTileKey = {
        kind: 'planet',
        bodyId: this.bodyDef.id,
        face: tile.address.face,
        level: tile.address.level,
        x: tile.address.x,
        y: tile.address.y,
      };
      demands.push(tileDemand({
        key,
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

    this.cachedPlan = {
      demands,
      observer: observerFixed,
      radiusM: Number.isFinite(finestM) ? Math.max(25, finestM * 0.25) : 25,
      timeS: context.spatial.timeS,
    };
    return demands;
  }

  load(demand: TileDemand): Promise<TilePayload> {
    const k = demand.key as PlanetTileKey;
    if (k.kind !== 'planet' || k.bodyId !== this.bodyDef.id) {
      return Promise.reject(new Error(`${tileKeyToString(demand.key)} is not a ${this.bodyDef.id} tile`));
    }
    const address = { bodyId: k.bodyId, face: k.face as import('../planet/CubeSphere').CubeFace, level: k.level, x: k.x, y: k.y };
    const mesh = buildPlanetTileMesh(address, this.surface);
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
    const mesh = payload.geometry as ReturnType<typeof buildPlanetTileMesh>;
    const key = tileKeyToString(payload.key);
    this.globe.add(key, mesh);
    return {
      key: payload.key, providerId: this.id, payload, representation: 'planet',
      dispose: () => this.globe.remove(key),
    };
  }

  deactivate(tile: ActiveTile): void {
    tile.dispose();
  }

  private resolveBodyFrame(): string | null {
    const primary = `${this.bodyDef.id}/fixed`;
    const fallback = `solar-system/${this.bodyDef.id}-fixed`;
    if (this.frames.has(primary)) return primary;
    if (this.frames.has(fallback)) return fallback;
    return null;
  }

  private planetCenterRender(context?: SpatialContext): Vec3 {
    const planetFrame = this.resolveBodyFrame();
    if (this.options.renderSpace && planetFrame) {
      return this.options.renderSpace.logicalToRender(planetFrame, [0, 0, 0]);
    }
    if (planetFrame) {
      if (this.playerFrameId === 'solar-system/barycentric') {
        const bary = this.frames.convertPosition(planetFrame, 'solar-system/barycentric', [0, 0, 0]);
        const playerPos = context?.player.position ?? [0, 0, 0];
        return [bary[0] - playerPos[0], bary[1] - playerPos[1], bary[2] - playerPos[2]];
      }
      return this.frames.convertPosition(planetFrame, this.playerFrameId, [0, 0, 0]);
    }
    return this.centreM;
  }

  private bodyToScene(): Quat {
    const planetFrame = this.resolveBodyFrame();
    const targetFrame = this.options.renderSpace
      ? this.options.renderSpace.currentOrigin.frame
      : this.playerFrameId;
    if (planetFrame && this.frames.has(targetFrame)) {
      return this.frames.convertOrientation(planetFrame, targetFrame, cloneQuat(IDENTITY_QUAT));
    }
    return IDENTITY_QUAT;
  }
}
