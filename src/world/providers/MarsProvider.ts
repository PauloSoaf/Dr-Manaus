import type { Object3D } from 'three/webgpu';
import { MarsGlobe, buildMarsTileMesh } from '../planet/MarsGlobe';
import { MARS_RADIUS_M } from '../planet/MarsSurface';
import { MARS } from '../planet/PlanetBody';
import { PlanetQuadtree } from '../planet/PlanetQuadtree';
import { DEFAULT_SSE } from '../planet/ScreenSpaceError';
import type { PlanetTileAddress } from '../planet/PlanetTileAddress';
import { tileExtentM } from '../planet/PlanetTileAddress';
import { ecef, type EcefPosition } from '../spatial/ECEF';
import { EARTH_FIXED_FRAME_ID, MANAUS_FRAME_ID } from '../spatial/ManausFrameAdapter';
import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import type { RenderSpaceService } from '../spatial/RenderSpaceService';
import { cloneQuat, finite, IDENTITY_QUAT, type Quat, type Vec3 } from '../spatial/units';
import {
  type ActiveTile, type TileDemand, type TilePayload, type WorldTileKey,
  tileDemand, tileKeyToString,
} from '../streaming/TileDemand';
import type { CoverageClaim, SpatialContext, StreamingContext, WorldProvider } from './WorldProvider';

export interface MarsCoverageReadiness {
  readonly activeTiles: number;
  readonly coarseCoverageReady: boolean;
  readonly surfaceCoverageReady: boolean;
}

export interface MarsProviderOptions {
  minAltitudeM?: number;
  maxRangeM?: number;
  maxTiles?: number;
  maxLevel?: number;
  replanIntervalS?: number;
  renderSpace?: RenderSpaceService;
}

export class MarsProvider implements WorldProvider {
  readonly id = 'mars/surface';
  readonly priority = 10;

  readonly globe: MarsGlobe;
  private readonly quadtree: PlanetQuadtree;
  private readonly options: Required<Omit<MarsProviderOptions, 'renderSpace'>> & { renderSpace?: RenderSpaceService };
  private centreM: Vec3 = [0, 0, 0];
  private distanceM = Number.POSITIVE_INFINITY;
  private streamingMode: 'off' | 'coarse' | 'surface' = 'off';
  private cachedPlan?: { demands: readonly TileDemand[]; observer: Vec3; radiusM: number; timeS: number };
  private playerFrameId: string = MANAUS_FRAME_ID;

  constructor(
    parent: Object3D,
    private readonly frames: ReferenceFrameGraph,
    options: MarsProviderOptions = {},
  ) {
    this.globe = new MarsGlobe(parent);
    this.options = {
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 400_000)),
      maxRangeM: Math.max(1, finite(options.maxRangeM, 50_000_000)),
      maxTiles: Math.max(6, finite(options.maxTiles, 128)),
      maxLevel: Math.max(0, finite(options.maxLevel, 10)),
      replanIntervalS: Math.max(0, finite(options.replanIntervalS, 0.25)),
      renderSpace: options.renderSpace,
    };
    this.quadtree = new PlanetQuadtree(MARS, {
      maxTiles: this.options.maxTiles, maxLevel: this.options.maxLevel,
    });
  }

  get stats(): { tiles: number; triangles: number; visible: boolean; distanceM: number } {
    return { ...this.globe.stats, distanceM: this.distanceM };
  }

  readiness(): MarsCoverageReadiness {
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

    if (this.options.renderSpace) {
      this.centreM = this.marsCenterRender(context);
      this.globe.setCentre(this.centreM);
      this.globe.setOrientation(this.bodyToScene());
      this.distanceM = Math.hypot(...this.centreM);
    } else {
      const player = context.player.position;
      this.distanceM = Math.hypot(
        this.centreM[0] - player[0], this.centreM[1] - player[1], this.centreM[2] - player[2],
      );
    }

    return this.streamingMode !== 'off';
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

  setCentre(marsRelativeToObserverM: Vec3, systemFrameId: string, targetFrameId: string, observerPosition?: Vec3): void {
    const marsFrame = this.frames.has('mars/fixed')
      ? 'mars/fixed'
      : (this.frames.has('solar-system/mars-fixed') ? 'solar-system/mars-fixed' : null);
    if (this.options.renderSpace && marsFrame) {
      this.centreM = this.options.renderSpace.logicalToRender(marsFrame, [0, 0, 0]);
    } else if (targetFrameId === 'solar-system/barycentric' && observerPosition) {
      const marsBary = this.frames.convertPosition(systemFrameId, 'solar-system/barycentric', marsRelativeToObserverM);
      this.centreM = [marsBary[0] - observerPosition[0], marsBary[1] - observerPosition[1], marsBary[2] - observerPosition[2]];
    } else {
      this.centreM = this.frames.convertPosition(systemFrameId, targetFrameId, marsRelativeToObserverM);
    }
    this.globe.setCentre(this.centreM);
    this.globe.setOrientation(this.bodyToScene());
  }

  private marsCenterRender(context?: SpatialContext): Vec3 {
    const marsFrame = this.frames.has('mars/fixed')
      ? 'mars/fixed'
      : (this.frames.has('solar-system/mars-fixed') ? 'solar-system/mars-fixed' : null);
    if (this.options.renderSpace && marsFrame) {
      return this.options.renderSpace.logicalToRender(marsFrame, [0, 0, 0]);
    }
    if (marsFrame) {
      if (this.playerFrameId === 'solar-system/barycentric') {
        const marsBary = this.frames.convertPosition(marsFrame, 'solar-system/barycentric', [0, 0, 0]);
        const playerPos = context?.player.position ?? [0, 0, 0];
        return [marsBary[0] - playerPos[0], marsBary[1] - playerPos[1], marsBary[2] - playerPos[2]];
      }
      return this.frames.convertPosition(marsFrame, this.playerFrameId, [0, 0, 0]);
    }
    return this.centreM;
  }

  setSunDirection(marsToSunInSystem: Vec3, systemFrameId: string, targetFrameId: string): void {
    this.globe.setSunDirection(this.frames.convertDirection(systemFrameId, targetFrameId, marsToSunInSystem));
  }

  plan(context: StreamingContext): readonly TileDemand[] {
    let observerMarsFixed: Vec3;
    const marsFrame = this.frames.has('mars/fixed') ? 'mars/fixed' : (this.frames.has('solar-system/mars-fixed') ? 'solar-system/mars-fixed' : null);
    
    if (marsFrame) {
      observerMarsFixed = this.frames.convertPosition(
        context.spatial.player.frame,
        marsFrame,
        context.spatial.player.position
      );
    } else {
      const observer: Vec3 = this.options.renderSpace
        ? [-this.centreM[0], -this.centreM[1], -this.centreM[2]]
        : [
            context.spatial.player.position[0] - this.centreM[0],
            context.spatial.player.position[1] - this.centreM[1],
            context.spatial.player.position[2] - this.centreM[2],
          ];
      observerMarsFixed = this.toMarsEcef(observer);
    }

    const cached = this.cachedPlan;
    if (cached
      && context.spatial.timeS - cached.timeS < this.options.replanIntervalS
      && Math.hypot(
        observerMarsFixed[0] - cached.observer[0], observerMarsFixed[1] - cached.observer[1], observerMarsFixed[2] - cached.observer[2],
      ) < cached.radiusM) {
      return cached.demands;
    }

    const isCoarse = this.streamingMode === 'coarse';
    
    const selection = this.quadtree.select(observerMarsFixed, {
      ...DEFAULT_SSE,
      fovRad: context.camera.fovRad,
      viewportHeightPx: context.camera.viewportHeightPx,
      targetPx: isCoarse ? 500 : context.quality.sseTargetPx,
      detailFactor: isCoarse ? 0.1 : context.quality.detailFactor,
    });

    const demands: TileDemand[] = [];
    let finestM = Number.POSITIVE_INFINITY;
    for (const tile of selection) {
      finestM = Math.min(finestM, tileExtentM(tile.address, MARS_RADIUS_M));
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

    this.cachedPlan = {
      demands,
      observer: observerMarsFixed,
      radiusM: Number.isFinite(finestM) ? Math.max(25, finestM * 0.25) : 25,
      timeS: context.spatial.timeS,
    };
    return demands;
  }

  load(demand: TileDemand): Promise<TilePayload> {
    const address = this.addressFor(demand.key);
    if (!address) return Promise.reject(new Error(`${tileKeyToString(demand.key)} is not a Mars tile`));
    const mesh = buildMarsTileMesh(address);
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
    const mesh = payload.geometry as ReturnType<typeof buildMarsTileMesh>;
    const key = tileKeyToString(payload.key);
    this.globe.add(key, mesh);
    return {
      key: payload.key, providerId: this.id, payload, representation: 'planet',
      dispose: () => this.globe.remove(key),
    };
  }

  deactivate(tile: ActiveTile): void {
    this.globe.remove(tileKeyToString(tile.key));
  }

  private keyFor(address: PlanetTileAddress): WorldTileKey {
    return { kind: 'planet', bodyId: 'mars', face: address.face, level: address.level, x: address.x, y: address.y };
  }

  private addressFor(key: WorldTileKey): PlanetTileAddress | undefined {
    return key.kind === 'planet' && key.bodyId === 'mars'
      ? { bodyId: 'mars', face: key.face as PlanetTileAddress['face'], level: key.level, x: key.x, y: key.y }
      : undefined;
  }

  private toMarsEcef(sceneM: Vec3): EcefPosition {
    const marsFrame = this.frames.has('mars/fixed')
      ? 'mars/fixed'
      : (this.frames.has('solar-system/mars-fixed') ? 'solar-system/mars-fixed' : null);
    if (!marsFrame) {
      return ecef(sceneM[0], sceneM[1], sceneM[2]);
    }
    const fixed = this.frames.convertPosition(this.playerFrameId, marsFrame, sceneM);
    return ecef(fixed[0], fixed[1], fixed[2]);
  }

  private bodyToScene(): Quat {
    const marsFrame = this.frames.has('mars/fixed')
      ? 'mars/fixed'
      : (this.frames.has('solar-system/mars-fixed') ? 'solar-system/mars-fixed' : null);
    if (this.options.renderSpace && marsFrame) {
      return this.options.renderSpace.toRenderPose(marsFrame, [0, 0, 0], IDENTITY_QUAT).orientation;
    }
    if (!marsFrame) return cloneQuat(IDENTITY_QUAT);
    return this.frames.convertOrientation(marsFrame, this.playerFrameId, IDENTITY_QUAT);
  }
}
