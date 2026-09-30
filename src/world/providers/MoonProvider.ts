import type { Object3D } from 'three/webgpu';
import { MoonGlobe, buildMoonTileMesh } from '../planet/MoonGlobe';
import { MOON_RADIUS_M } from '../planet/MoonSurface';
import { MOON } from '../planet/PlanetBody';
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

/**
 * The Moon, as somewhere to go.
 *
 * The spec's vertical slice for this sprint is Teatro to orbit to the Moon and back, and the piece
 * that was missing is a surface for it to be a place rather than a point of light. It is built the
 * same way the Earth is -- cube-sphere quadtree, screen-space error, streamed through the global
 * scheduler -- and differs in what it is made of: a sphere rather than an ellipsoid, and a
 * generated surface rather than a measured one. Both of those are stated where they live.
 *
 * Its position comes from the ephemeris, converted into the scene's frame, so the Moon is where
 * the Moon is rather than where a level designer put it.
 */

export interface MoonProviderOptions {
  /** Below this altitude above the Earth the Moon is a light in the sky, not a surface. */
  minAltitudeM?: number;
  /** Beyond this distance from the Moon there is nothing worth streaming. */
  maxRangeM?: number;
  maxTiles?: number;
  maxLevel?: number;
  replanIntervalS?: number;
  renderSpace?: RenderSpaceService;
}

export class MoonProvider implements WorldProvider {
  readonly id = 'moon/surface';
  /** Generic terrain on another body: it loses to anything authored, as the Earth's does. */
  readonly priority = 10;

  readonly globe: MoonGlobe;
  private readonly quadtree: PlanetQuadtree;
  private readonly options: Required<Omit<MoonProviderOptions, 'renderSpace'>> & { renderSpace?: RenderSpaceService };
  /** The Moon's centre in scene metres, refreshed from the ephemeris each frame. */
  private centreM: Vec3 = [0, 0, 0];
  private distanceM = Number.POSITIVE_INFINITY;
  private presentationMode: 'celestial' | 'planet' | 'surface' = 'surface';
  private cachedPlan?: { demands: readonly TileDemand[]; observer: Vec3; radiusM: number; timeS: number };

  constructor(
    parent: Object3D,
    private readonly frames: ReferenceFrameGraph,
    options: MoonProviderOptions = {},
  ) {
    this.globe = new MoonGlobe(parent);
    this.options = {
      // Above the Earth's own handover: two surfaces at once is the one thing this must not do.
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 400_000)),
      // Twenty thousand kilometres: far enough that the Moon is already a disc when its surface
      // starts streaming, rather than appearing when the player is nearly on top of it.
      maxRangeM: Math.max(1, finite(options.maxRangeM, 20_000_000)),
      maxTiles: Math.max(6, finite(options.maxTiles, 96)),
      maxLevel: Math.max(0, finite(options.maxLevel, 9)),
      replanIntervalS: Math.max(0, finite(options.replanIntervalS, 0.25)),
      renderSpace: options.renderSpace,
    };
    this.quadtree = new PlanetQuadtree(MOON, {
      maxTiles: this.options.maxTiles, maxLevel: this.options.maxLevel,
    });
  }

  get stats(): { tiles: number; triangles: number; visible: boolean; distanceM: number } {
    return { ...this.globe.stats, distanceM: this.distanceM };
  }

  /** Claims nothing on Earth. Another body's ground is not this body's ground. */
  coverage(): readonly CoverageClaim[] { return []; }

  /**
   * Places the Moon and decides whether its surface is worth drawing.
   *
   * Two gates. Below `minAltitudeM` the player is somewhere near the Earth and the Moon is a light
   * in the sky; beyond `maxRangeM` the Moon is too far for a surface to resolve. In between it is
   * a place.
   */
  covers(context: SpatialContext): boolean {
    this.playerFrameId = context.frame.id;

    if (this.options.renderSpace) {
      this.centreM = this.moonCenterRender(context);
      this.globe.setCentre(this.centreM);
      this.globe.setOrientation(this.bodyToScene());
      this.distanceM = Math.hypot(...this.centreM);
    } else {
      const player = context.player.position;
      this.distanceM = Math.hypot(
        this.centreM[0] - player[0], this.centreM[1] - player[1], this.centreM[2] - player[2],
      );
    }

    // Only visible when representation is planet or surface
    const active = this.presentationMode !== 'celestial';
    this.globe.visible = active;
    return active;
  }

  setPresentationMode(mode: 'celestial' | 'planet' | 'surface'): void {
    this.presentationMode = mode;
  }

  /** Where the Moon is, from the ephemeris, in the scene's metres. Called by whoever has one. */
  setCentre(moonRelativeToEarthM: Vec3, systemFrameId: string, targetFrameId: string, observerPosition?: Vec3): void {
    const moonFrame = this.frames.has('moon/fixed')
      ? 'moon/fixed'
      : (this.frames.has('solar-system/moon-fixed') ? 'solar-system/moon-fixed' : null);
    if (this.options.renderSpace && moonFrame) {
      this.centreM = this.options.renderSpace.logicalToRender(moonFrame, [0, 0, 0]);
    } else if (targetFrameId === 'solar-system/barycentric' && observerPosition) {
      const moonBary = this.frames.convertPosition(systemFrameId, 'solar-system/barycentric', moonRelativeToEarthM);
      this.centreM = [moonBary[0] - observerPosition[0], moonBary[1] - observerPosition[1], moonBary[2] - observerPosition[2]];
    } else {
      this.centreM = this.frames.convertPosition(systemFrameId, targetFrameId, moonRelativeToEarthM);
    }
    this.globe.setCentre(this.centreM);
    this.globe.setOrientation(this.bodyToScene());
  }

  private moonCenterRender(context?: SpatialContext): Vec3 {
    const moonFrame = this.frames.has('moon/fixed')
      ? 'moon/fixed'
      : (this.frames.has('solar-system/moon-fixed') ? 'solar-system/moon-fixed' : null);
    if (this.options.renderSpace && moonFrame) {
      return this.options.renderSpace.logicalToRender(moonFrame, [0, 0, 0]);
    }
    if (moonFrame) {
      if (this.playerFrameId === 'solar-system/barycentric') {
        const moonBary = this.frames.convertPosition(moonFrame, 'solar-system/barycentric', [0, 0, 0]);
        const playerPos = context?.player.position ?? [0, 0, 0];
        return [moonBary[0] - playerPos[0], moonBary[1] - playerPos[1], moonBary[2] - playerPos[2]];
      }
      return this.frames.convertPosition(moonFrame, this.playerFrameId, [0, 0, 0]);
    }
    return this.centreM;
  }

  setSunDirection(moonToSunInSystem: Vec3, systemFrameId: string, targetFrameId: string): void {
    this.globe.setSunDirection(this.frames.convertDirection(systemFrameId, targetFrameId, moonToSunInSystem));
  }

  plan(context: StreamingContext): readonly TileDemand[] {
    // The observer, expressed in the Moon's own fixed frame: the quadtree knows nothing else.
    const observer: Vec3 = this.options.renderSpace
      ? [-this.centreM[0], -this.centreM[1], -this.centreM[2]]
      : [
          context.spatial.player.position[0] - this.centreM[0],
          context.spatial.player.position[1] - this.centreM[1],
          context.spatial.player.position[2] - this.centreM[2],
        ];
    const cached = this.cachedPlan;
    if (cached
      && context.spatial.timeS - cached.timeS < this.options.replanIntervalS
      && Math.hypot(
        observer[0] - cached.observer[0], observer[1] - cached.observer[1], observer[2] - cached.observer[2],
      ) < cached.radiusM) {
      return cached.demands;
    }

    const selection = this.quadtree.select(this.toMoonEcef(observer), {
      ...DEFAULT_SSE,
      fovRad: context.camera.fovRad,
      viewportHeightPx: context.camera.viewportHeightPx,
      targetPx: context.quality.sseTargetPx,
      detailFactor: context.quality.detailFactor,
    });

    const demands: TileDemand[] = [];
    let finestM = Number.POSITIVE_INFINITY;
    for (const tile of selection) {
      finestM = Math.min(finestM, tileExtentM(tile.address, MOON_RADIUS_M));
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
      observer,
      radiusM: Number.isFinite(finestM) ? Math.max(25, finestM * 0.25) : 25,
      timeS: context.spatial.timeS,
    };
    return demands;
  }

  load(demand: TileDemand): Promise<TilePayload> {
    const address = this.addressFor(demand.key);
    if (!address) return Promise.reject(new Error(`${tileKeyToString(demand.key)} is not a Moon tile`));
    const mesh = buildMoonTileMesh(address);
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
    const mesh = payload.geometry as ReturnType<typeof buildMoonTileMesh>;
    const key = tileKeyToString(payload.key);
    this.globe.add(key, mesh);
    return {
      key: payload.key, providerId: this.id, payload, representation: 'planet',
      dispose: () => this.globe.remove(key),
    };
  }

  deactivate(tile: ActiveTile): void { this.globe.remove(tileKeyToString(tile.key)); }

  dispose(): void { this.globe.dispose(); }

  private playerFrameId = MANAUS_FRAME_ID;

  /**
   * The rotation carrying the Moon's fixed axes into the scene's.
   *
   * Measured from Earth-fixed rather than from the Moon's own declared parent, because that is
   * the frame the graph actually has: the solar system registers each body's own fixed frame
   * under the barycentre, and the Earth-to-Manaus relationship is the one that is defined. The
   * two differ by the Moon's orbital orientation, which this does not model.
   *
   * The rotation is not optional. The scene runs in the city's tangent plane, so a tile placed
   * without it lies flat at an arbitrary angle -- the same failure the Earth's tiles had.
   */
  private bodyToScene(): Quat {
    if (!this.sceneRotation || this.sceneRotationFrame !== this.playerFrameId) {
      this.sceneRotation = this.frames.convertOrientation(
        EARTH_FIXED_FRAME_ID, this.playerFrameId, cloneQuat(IDENTITY_QUAT),
      );
      this.sceneRotationFrame = this.playerFrameId;
    }
    return this.sceneRotation;
  }

  private sceneRotation?: Quat;
  private sceneRotationFrame?: string;

  /** The observer relative to the Moon's centre, as the quadtree's ECEF-shaped input. */
  private toMoonEcef(observer: Vec3): EcefPosition {
    const inverse = this.frames.convertDirection(this.playerFrameId, EARTH_FIXED_FRAME_ID, observer);
    return ecef(inverse[0], inverse[1], inverse[2]);
  }

  private keyFor(address: PlanetTileAddress): WorldTileKey {
    return { kind: 'planet', bodyId: 'moon', face: address.face, level: address.level, x: address.x, y: address.y };
  }

  private addressFor(key: WorldTileKey): PlanetTileAddress | undefined {
    return key.kind === 'planet' && key.bodyId === 'moon'
      ? { bodyId: 'moon', face: key.face as PlanetTileAddress['face'], level: key.level, x: key.x, y: key.y }
      : undefined;
  }
}
