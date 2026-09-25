import { type EcefPosition } from '../spatial/ECEF';
import { finite, type Vec3 } from '../spatial/units';
import { CUBE_FACES } from './CubeSphere';
import { meanRadiusM, type PlanetBody, surfacePosition } from './PlanetBody';
import {
  MAX_PLANET_LEVEL, type PlanetTileAddress, planetTile, tileCentreDirection, tileChildren,
  tileExtentM, tileGeometricErrorM,
} from './PlanetTileAddress';
import { type ScreenSpaceErrorContext, effectiveTargetPx, screenSpaceError } from './ScreenSpaceError';

export interface QuadtreeSelection {
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
  select(cameraFixed: EcefPosition, sse: ScreenSpaceErrorContext): QuadtreeSelection[] {
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

    for (const face of CUBE_FACES) {
      this.descend(planetTile(this.body.id, face, 0, 0, 0), {
        camera: cameraFixed, cameraDistance, toCamera, horizonDot, radius, sse, target, selected,
      });
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
  }): void {
    if (walk.selected.length >= this.options.maxTiles) return;

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

    if (address.level < this.options.maxLevel && errorPx > walk.target) {
      for (const child of tileChildren(address)) this.descend(child, walk);
      return;
    }

    walk.selected.push({ address, distanceM, screenSpaceErrorPx: errorPx, geometricErrorM, extentM, centre });
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
