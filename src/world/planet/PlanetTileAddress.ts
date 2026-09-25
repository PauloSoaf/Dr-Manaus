import { type CubeFace, CUBE_FACES, directionToGeodetic, faceUvToDirection, geodeticToFaceUv } from './CubeSphere';
import type { GeodeticPosition } from '../spatial/Geodetic';
import { finite, type Vec3 } from '../spatial/units';

/**
 * A node of one face's quadtree.
 *
 * At level `L` a face is divided into `2^L` by `2^L` tiles, with `x` running along `u` and `y`
 * along `v`, both from zero. Level 0 is the whole face.
 */
export interface PlanetTileAddress {
  readonly bodyId: string;
  readonly face: CubeFace;
  readonly level: number;
  readonly x: number;
  readonly y: number;
}

/** The deepest subdivision allowed. At level 20 an Earth tile is about 10 m across. */
export const MAX_PLANET_LEVEL = 20;

export function planetTile(bodyId: string, face: CubeFace, level: number, x: number, y: number): PlanetTileAddress {
  return { bodyId, face, level, x, y };
}

export function tilesPerSide(level: number): number {
  return 2 ** Math.max(0, Math.min(MAX_PLANET_LEVEL, Math.floor(finite(level))));
}

export function isValidTile(address: PlanetTileAddress): boolean {
  const side = tilesPerSide(address.level);
  return Number.isInteger(address.x) && Number.isInteger(address.y)
    && address.x >= 0 && address.x < side
    && address.y >= 0 && address.y < side
    && address.level >= 0 && address.level <= MAX_PLANET_LEVEL
    && CUBE_FACES.includes(address.face);
}

/** The face-space bounds of a tile, each in [-1, 1]. */
export function tileBounds(address: PlanetTileAddress): { minU: number; maxU: number; minV: number; maxV: number } {
  const side = tilesPerSide(address.level);
  const step = 2 / side;
  const minU = -1 + address.x * step;
  const minV = -1 + address.y * step;
  return { minU, maxU: minU + step, minV, maxV: minV + step };
}

/** The direction from the planet centre through a point inside the tile, `s`/`t` in [0, 1]. */
export function tileDirection(address: PlanetTileAddress, s: number, t: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const { minU, maxU, minV, maxV } = tileBounds(address);
  return faceUvToDirection(address.face, minU + (maxU - minU) * s, minV + (maxV - minV) * t, out);
}

export function tileCentreDirection(address: PlanetTileAddress, out: Vec3 = [0, 0, 0]): Vec3 {
  return tileDirection(address, 0.5, 0.5, out);
}

export function tileCentreGeodetic(address: PlanetTileAddress, heightM = 0): GeodeticPosition {
  return directionToGeodetic(tileCentreDirection(address), heightM);
}

/** The four children of a tile, in `x`-then-`y` order. Empty at the deepest level. */
export function tileChildren(address: PlanetTileAddress): readonly PlanetTileAddress[] {
  if (address.level >= MAX_PLANET_LEVEL) return [];
  const level = address.level + 1, x = address.x * 2, y = address.y * 2;
  return [
    planetTile(address.bodyId, address.face, level, x, y),
    planetTile(address.bodyId, address.face, level, x + 1, y),
    planetTile(address.bodyId, address.face, level, x, y + 1),
    planetTile(address.bodyId, address.face, level, x + 1, y + 1),
  ];
}

export function tileParent(address: PlanetTileAddress): PlanetTileAddress | undefined {
  if (address.level <= 0) return undefined;
  return planetTile(address.bodyId, address.face, address.level - 1, address.x >> 1, address.y >> 1);
}

/** Which tile a geodetic position falls in, at a level. */
export function tileContaining(bodyId: string, position: GeodeticPosition, level: number): PlanetTileAddress {
  const { face, u, v } = geodeticToFaceUv(position);
  const side = tilesPerSide(level);
  const clamp = (value: number): number => Math.min(side - 1, Math.max(0, Math.floor((value + 1) / 2 * side)));
  return planetTile(bodyId, face, level, clamp(u), clamp(v));
}

/**
 * Roughly how wide a tile is on the ground, in metres.
 *
 * A face spans a quarter of the way round the body, so level 0 is about `pi/2 * radius` across and
 * each level halves it. Approximate by construction — the cube-sphere warp evens the variation out
 * to within about ten per cent, which is what the LOD needs it for.
 */
export function tileExtentM(address: PlanetTileAddress, bodyRadiusM: number): number {
  return (Math.PI / 2) * bodyRadiusM / tilesPerSide(address.level);
}

/**
 * The geometric error a tile still carries, in metres: how far its flat approximation departs
 * from the true curved surface. The sagitta of the arc it spans, which is what a screen-space
 * error test needs as its input.
 */
export function tileGeometricErrorM(address: PlanetTileAddress, bodyRadiusM: number): number {
  const halfAngle = (Math.PI / 4) / tilesPerSide(address.level);
  return bodyRadiusM * (1 - Math.cos(halfAngle));
}
