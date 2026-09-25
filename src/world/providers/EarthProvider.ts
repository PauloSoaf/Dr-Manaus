import type { Object3D } from 'three/webgpu';
import { EarthGlobe, buildTileMesh } from '../planet/EarthGlobe';
import { EARTH } from '../planet/PlanetBody';
import { PlanetQuadtree } from '../planet/PlanetQuadtree';
import { DEFAULT_SSE } from '../planet/ScreenSpaceError';
import { type PlanetTileAddress, tileCentreGeodetic } from '../planet/PlanetTileAddress';
import type { EcefPosition } from '../spatial/ECEF';
import { geodeticToEcef } from '../spatial/ECEF';
import {
  EARTH_FIXED_FRAME_ID, MANAUS_FRAME_ID, legacyLocalToGeodetic,
} from '../spatial/ManausFrameAdapter';
import type { ReferenceFrameGraph } from '../spatial/ReferenceFrameGraph';
import { cloneQuat, finite, IDENTITY_QUAT, radToDeg, type Quat, type Vec3 } from '../spatial/units';
import {
  type ActiveTile, type TileDemand, type TilePayload, type WorldTileKey,
  tileDemand, tileKeyToString,
} from '../streaming/TileDemand';
import {
  type CoverageClaim, type SpatialContext, type StreamingContext, type WorldProvider,
  regionContains,
} from './WorldProvider';

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
  private readonly options: Required<EarthProviderOptions>;
  private altitudeM = 0;
  private opacity = 0;

  constructor(
    parent: Object3D,
    private readonly frames: ReferenceFrameGraph,
    options: EarthProviderOptions = {},
  ) {
    this.globe = new EarthGlobe(parent);
    this.options = {
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 15_000)),
      fadeM: Math.max(1, finite(options.fadeM, 10_000)),
      maxTiles: Math.max(6, finite(options.maxTiles, 160)),
      maxLevel: Math.max(0, finite(options.maxLevel, 10)),
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
  setSunDirection(earthToSunInSystem: Vec3, systemFrameId: string): void {
    const inScene = this.frames.convertDirection(systemFrameId, MANAUS_FRAME_ID, earthToSunInSystem);
    this.globe.setSunDirection(inScene);
  }

  covers(context: SpatialContext): boolean {
    const geodetic = legacyLocalToGeodetic(
      context.player.position[0], context.player.position[1], context.player.position[2],
    );
    this.altitudeM = geodetic.heightM;
    const above = this.altitudeM - this.options.minAltitudeM;
    this.opacity = Math.min(1, Math.max(0, above / this.options.fadeM));
    this.globe.visible = this.opacity > 0.01;
    return this.globe.visible;
  }

  plan(context: StreamingContext): readonly TileDemand[] {
    const camera = this.playerEcef(context.spatial.player.position);
    const selection = this.quadtree.select(camera, {
      ...DEFAULT_SSE,
      fovRad: context.camera.fovRad,
      viewportHeightPx: context.camera.viewportHeightPx,
      targetPx: context.quality.sseTargetPx,
      detailFactor: context.quality.detailFactor,
    });

    const demands: TileDemand[] = [];
    for (const tile of selection) {
      // Where the city is, the city draws. A coarse globe patch under it would be a second Manaus.
      if (this.coveredByCity(tile.address)) continue;
      demands.push(tileDemand({
        key: this.keyFor(tile.address),
        providerId: this.id,
        geometricErrorM: tile.geometricErrorM,
        screenSpaceError: tile.screenSpaceErrorPx,
        distanceM: tile.distanceM,
        timeToContactS: Number.POSITIVE_INFINITY,
        gameplayCritical: false,
        representation: 'planet',
        centreM: this.toSceneMetres(tile.centre),
      }));
    }
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
    this.globe.add(key, mesh, this.toSceneMetres(mesh.centre), this.bodyToScene());
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

  private addressFor(key: WorldTileKey): PlanetTileAddress | undefined {
    return key.kind === 'planet'
      ? { bodyId: key.bodyId, face: key.face as PlanetTileAddress['face'], level: key.level, x: key.x, y: key.y }
      : undefined;
  }

  private playerEcef(local: Vec3): EcefPosition {
    return geodeticToEcef(legacyLocalToGeodetic(local[0], local[1], local[2]));
  }

  /** Earth-fixed metres into the scene's own Manaus metres, through the frame graph. */
  private toSceneMetres(position: EcefPosition): Vec3 {
    return this.frames.convertPosition(
      EARTH_FIXED_FRAME_ID, MANAUS_FRAME_ID, [position.xM, position.yM, position.zM],
    );
  }

  /**
   * The rotation carrying Earth-fixed axes into the scene's. Constant while the city is the
   * active frame, and cached because every tile needs the same one.
   */
  private bodyToScene(): Quat {
    this.sceneRotation ??= this.frames.convertOrientation(
      EARTH_FIXED_FRAME_ID, MANAUS_FRAME_ID, cloneQuat(IDENTITY_QUAT),
    );
    return this.sceneRotation;
  }

  private sceneRotation?: Quat;
}
