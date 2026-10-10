import { Matrix4 } from 'three/webgpu';
import { FEATURES } from '../../core/config';
import { createSurfaceTileFrame } from './SurfaceTileFrame';

/**
 * One switch for local city presentation; logical ECEF/planet frames are independent.
 *
 * Every local Manaus system reads this and nothing else. The regression it exists to prevent was
 * not a wrong answer but a split one: terrain honoured `curvedManaus` and stayed flat while the
 * real roads, the real building tiles and the procedural chunks had been migrated to WGS84 tile
 * frames unconditionally. Flat and curved diverge as the square of the distance from the anchor --
 * about 2 m at 5 km, 8 m at 10 km, 31 m at 20 km -- so the further from the centre, the deeper the
 * city sank into a ground sheet that had stayed put. Half a world cannot be curved.
 */
export function localManausPresentationMode(): 'flat' | 'curved' {
  return FEATURES.curvedManaus ? 'curved' : 'flat';
}

/** Intact local physics/building bases are Y=0; asphalt remains 22–34 mm above this sheet. */
export const MANAUS_GROUND_COVER_Y = 0;

/** Authored geometry is tile-local in both modes. Curved frames stay dormant in flat Manaus. */
export function manausTileSceneMatrix(tileId: string, originX: number, originZ: number,
  out = new Matrix4()): Matrix4 {
  return localManausPresentationMode() === 'curved'
    ? out.copy(createSurfaceTileFrame('earth', tileId, originX, originZ).getSceneMatrix())
    : out.makeTranslation(originX, 0, originZ);
}
