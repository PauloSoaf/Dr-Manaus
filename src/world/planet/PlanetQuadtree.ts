import { type EcefPosition } from '../spatial/ECEF';
import { finite, type Vec3 } from '../spatial/units';
import { CUBE_FACES, directionToFaceUv } from './CubeSphere';
import { meanRadiusM, type PlanetBody, surfacePosition } from './PlanetBody';
import {
  MAX_PLANET_LEVEL, type PlanetTileAddress, planetTile, tileCentreDirection, tileChildren,
  tileExtentM, tileGeometricErrorM,
} from './PlanetTileAddress';
import { type ScreenSpaceErrorContext, effectiveTargetPx, screenSpaceError } from './ScreenSpaceError';

export interface QuadtreeSelection {
  readonly groundRequired: boolean;
  readonly address: PlanetTileAddress;
  readonly distanceM: number;
  readonly screenSpaceErrorPx: number;
  readonly geometricErrorM: number;
  readonly extentM: number;
  readonly centre: EcefPosition;
}

export interface QuadtreeOptions {
  /** Hard cap on how many tiles one selection may return, whatever the error says. */
  maxTiles?: number;
  /** Deepest level to descend to. Lower for a distant body that will never be landed on. */
  maxLevel?: number;
  /** Tiles whose centre faces away from the camera are skipped below this dot product. */
  horizonCullDot?: number;
}

/**
 * Chooses which tiles of a body should exist right now.
 *
 * Descent is driven by screen-space error, not by distance rings: on a planet the same tile is a
 * horizon one moment and a continent the next, and a ring tuned for either is wrong for the
 * other. A node refines only when its own error is still visible; otherwise it is kept and its
 * children are never examined, which is what keeps the search cheap at every altitude.
 *
 * The result is a cut through the tree — the coarsest set of tiles that is good enough — and the
 * caller streams exactly that.
 */
export class PlanetQuadtree {
  private readonly options: Required<QuadtreeOptions>;

  constructor(private readonly body: PlanetBody, options: QuadtreeOptions = {}) {
    this.options = {
      maxTiles: Math.max(6, finite(options.maxTiles, 256)),
      maxLevel: Math.max(0, Math.min(MAX_PLANET_LEVEL, finite(options.maxLevel, MAX_PLANET_LEVEL))),
      // Slightly behind the geometric horizon, so tiles arrive before they rotate into view.
      horizonCullDot: finite(options.horizonCullDot, -0.35),
    };
  }

  /**
   * `cameraFixed` is the camera in the body's fixed frame — metres from the body centre, not from
   * the render origin. The whole point of the spatial core is that this can be a real number.
   */
  select(cameraFixed: EcefPosition, sse: ScreenSpaceErrorContext, minimumGroundLevel = 0): QuadtreeSelection[] {
    const selected: QuadtreeSelection[] = [];
    const target = effectiveTargetPx(sse);
    const cameraDistance = Math.hypot(cameraFixed.xM, cameraFixed.yM, cameraFixed.zM);
    const radius = meanRadiusM(this.body);
    // How far round the body the camera can possibly see. Beyond it, refining is wasted work.
    const horizonDot = cameraDistance > radius
      ? Math.max(this.options.horizonCullDot, -Math.sqrt(Math.max(0, 1 - (radius / cameraDistance) ** 2)))
      : this.options.horizonCullDot;
    const toCamera: Vec3 = cameraDistance > 0
      ? [cameraFixed.xM / cameraDistance, cameraFixed.yM / cameraDistance, cameraFixed.zM / cameraDistance]
      : [0, 0, 1];
    const groundLevel = Math.min(this.options.maxLevel, Math.max(0, minimumGroundLevel));
    const groundTiles: PlanetTileAddress[] = [];
    if (groundLevel > 0) {
      const horizontal = Math.hypot(toCamera[0], toCamera[1]);
      const east: Vec3 = horizontal > 1e-9 ? [-toCamera[1]/horizontal,toCamera[0]/horizontal,0] : [1,0,0];
      const north: Vec3 = [-toCamera[2]*east[1],toCamera[2]*east[0],horizontal];
      const side = 2 ** groundLevel;
      // Reserve a 100 m cross around the contact before any other branch spends the tile cap.
      // This also covers footprints straddling a tile or cube-face boundary.
      for (const [axis,offset] of [[east,0],[east,100],[east,-100],[north,100],[north,-100]] as const) {
        const uv = directionToFaceUv([toCamera[0]+axis[0]*offset/radius,
          toCamera[1]+axis[1]*offset/radius,toCamera[2]+axis[2]*offset/radius]);
        const tile = planetTile(this.body.id,uv.face,groundLevel,
          Math.min(side-1,Math.max(0,Math.floor((uv.u+1)/2*side))),
          Math.min(side-1,Math.max(0,Math.floor((uv.v+1)/2*side))));
        if (!groundTiles.some(other=>other.face===tile.face&&other.x===tile.x&&other.y===tile.y)) groundTiles.push(tile);
      }
    }
    const walk = {camera:cameraFixed,cameraDistance,toCamera,horizonDot,radius,sse,target,selected,groundTiles};
    for (const tile of groundTiles) this.descend(tile,walk);

    // Nearest face first. The tile cap is a hard stop, and descending in face order would let
    // the first face spend the whole budget while the one under the player got nothing.
    const roots = CUBE_FACES.map(face => {
      const address = planetTile(this.body.id, face, 0, 0, 0);
      const direction = tileCentreDirection(address, [0, 0, 0]);
      return { address, facing: direction[0] * toCamera[0] + direction[1] * toCamera[1] + direction[2] * toCamera[2] };
    }).sort((a, b) => b.facing - a.facing);

    for (const root of roots) {
      this.descend(root.address,walk);
    }
    return selected;
  }

  /**
   * Refines where the error is, depth first.
   *
   * Breadth first spends the tile budget on the shallow levels before it ever reaches the ground
   * under the camera — the cut comes out uniformly coarse, which is the opposite of the point.
   * Descending instead lets the error test itself decide where to stop, so detail lands where the
   * player is looking and the far side of the body costs almost nothing.
   */
  private descend(address: PlanetTileAddress, walk: {
    camera: EcefPosition; cameraDistance: number; toCamera: Vec3; horizonDot: number;
    radius: number; sse: ScreenSpaceErrorContext; target: number; selected: QuadtreeSelection[];
    groundTiles: readonly PlanetTileAddress[];
  }): void {
    if (walk.selected.length >= this.options.maxTiles) return;
    if (walk.groundTiles.some(tile=>tile.face===address.face&&tile.level===address.level
      &&tile.x===address.x&&tile.y===address.y)
      &&walk.selected.some(tile=>tile.address.face===address.face&&tile.address.level===address.level
        &&tile.address.x===address.x&&tile.address.y===address.y)) return;

    const direction: Vec3 = [0, 0, 0];
    tileCentreDirection(address, direction);
    const centre = surfacePosition(this.body, direction, 0);

    // Facing away from the camera: a tile on the far side of the body cannot be seen.
    if (walk.cameraDistance > walk.radius * 1.001) {
      const facing = direction[0] * walk.toCamera[0] + direction[1] * walk.toCamera[1] + direction[2] * walk.toCamera[2];
      if (facing < walk.horizonDot) return;
    }

    // Distance to the nearest part of the tile, not to its centre. For the tile the camera is
    // standing on, the centre can be tens of kilometres away across the tile while the ground is
    // two kilometres below — measuring to the centre makes that tile look distant and leaves the
    // surface underfoot refined several levels too coarse.
    const extentM = tileExtentM(address, walk.radius);
    const boundingRadiusM = extentM * 0.75;
    const centreDistanceM = Math.hypot(
      walk.camera.xM - centre.xM, walk.camera.yM - centre.yM, walk.camera.zM - centre.zM,
    );
    const distanceM = Math.max(1, centreDistanceM - boundingRadiusM);
    const geometricErrorM = tileGeometricErrorM(address, walk.radius);
    const errorPx = screenSpaceError(geometricErrorM, distanceM, walk.sse);

    const underGround = walk.groundTiles.some(tile=>this.containsGround(address,tile));
    const groundRequired = walk.groundTiles.some(tile=>tile.face===address.face&&tile.level===address.level
      &&tile.x===address.x&&tile.y===address.y);
    if (!groundRequired && address.level < this.options.maxLevel && (errorPx > walk.target
      || underGround && address.level < walk.groundTiles[0].level)) {
      // Nearest child first, for the same reason as the faces: under a tile cap, whichever
      // branch is visited first spends the budget, and it must be the one under the camera.
      const children = tileChildren(address).map(child => {
        const childCentre = surfacePosition(this.body, tileCentreDirection(child, [0, 0, 0]), 0);
        return {
          child,
          distance: Math.hypot(
            walk.camera.xM - childCentre.xM, walk.camera.yM - childCentre.yM, walk.camera.zM - childCentre.zM,
          ),
        };
      }).sort((a, b) => Number(walk.groundTiles.some(tile=>this.containsGround(b.child,tile)))
        - Number(walk.groundTiles.some(tile=>this.containsGround(a.child,tile))) || a.distance - b.distance);
      for (const entry of children) this.descend(entry.child, walk);
      return;
    }

    walk.selected.push({ address, distanceM, screenSpaceErrorPx: errorPx, geometricErrorM, extentM, centre, groundRequired });
  }

  private containsGround(address: PlanetTileAddress, ground: PlanetTileAddress): boolean {
    if (address.face !== ground.face) return false;
    if (address.level <= ground.level) {
      const divisor = 2 ** (ground.level - address.level);
      return address.x === Math.floor(ground.x / divisor) && address.y === Math.floor(ground.y / divisor);
    }
    const divisor = 2 ** (address.level - ground.level);
    return ground.x === Math.floor(address.x / divisor) && ground.y === Math.floor(address.y / divisor);
  }

  /** The level a tile at a distance would need to be, without walking the tree. */
  levelForDistance(distanceM: number, sse: ScreenSpaceErrorContext): number {
    const radius = meanRadiusM(this.body);
    const target = effectiveTargetPx(sse);
    for (let level = 0; level < this.options.maxLevel; level++) {
      const error = tileGeometricErrorM(planetTile(this.body.id, 0, level, 0, 0), radius);
      if (screenSpaceError(error, distanceM, sse) <= target) return level;
    }
    return this.options.maxLevel;
  }
}
