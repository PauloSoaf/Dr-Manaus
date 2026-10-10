/**
 * What the streaming layer asks for, and what comes back.
 *
 * A tile key has to be unambiguous across every provider in the game at once: a 1 024 m city tile,
 * a quadtree face on a planet and a hundred-light-year star sector all flow through the same
 * cache and the same scheduler. Collide two of those keys and a city block ends up in a galaxy.
 */

import type { SectorIndex } from '../spatial/UniverseAddress';

/** The compiled Manaus grid, in its own legacy metre projection. */
export interface ManausTileKey { kind: 'manaus'; tx: number; tz: number }
/** A quadtree node on a cubed sphere: which body, which face, and where in that face. */
export interface PlanetTileKey { kind: 'planet'; bodyId: string; face: number; level: number; x: number; y: number }
/** A volume of a galaxy, addressed by integer sector because metres stop working out there. */
export interface StarSectorKey { kind: 'star-sector'; galaxyId: string; level: number; sector: SectorIndex }

export type WorldTileKey = ManausTileKey | PlanetTileKey | StarSectorKey;

/**
 * A stable string for a key. Deterministic across runs and platforms: it is a cache key, a save
 * key and a dedupe key, so two equal tiles must always produce the same string and two different
 * tiles must never collide. The `kind` prefix is what guarantees the second half.
 */
export function tileKeyToString(key: WorldTileKey): string {
  switch (key.kind) {
    case 'manaus':
      return `manaus:${key.tx},${key.tz}`;
    case 'planet':
      return `planet:${key.bodyId}:${key.face}:${key.level}:${key.x},${key.y}`;
    case 'star-sector':
      return `star-sector:${key.galaxyId}:${key.level}:${key.sector.x},${key.sector.y},${key.sector.z}`;
  }
}

export function tileKeysEqual(a: WorldTileKey, b: WorldTileKey): boolean {
  return tileKeyToString(a) === tileKeyToString(b);
}

/**
 * How much of a thing a tile is, from the player's point of view. The names are the HLOD bands the
 * specification uses, and each one implies what the tile is allowed to cost.
 */
export type TileRepresentation = 'active' | 'near' | 'mid' | 'far' | 'planet';

/** The lifecycle of a tile. A tile only ever moves forward through these, or to FAILED. */
export type TileState =
  | 'unloaded' | 'queued' | 'fetching' | 'decoding'
  | 'ready-cpu' | 'activating' | 'active' | 'dormant' | 'evicting' | 'failed';

/**
 * A request for one tile, with everything the scheduler needs to rank it.
 *
 * Distance alone is not enough, which is the whole reason this carries so many fields: a tile
 * straight ahead at 4 km matters more than one behind the player at 1 km, and one the player will
 * reach in half a second matters more than either.
 */
export interface TileDemand {
  readonly key: WorldTileKey;
  readonly providerId: string;
  /** Resolved by the scheduler. Higher wins. */
  priority: number;
  /** The geometric error this tile removes, in metres. */
  readonly geometricErrorM: number;
  /** That error projected onto the screen, in pixels. The planetary LOD's actual driver. */
  screenSpaceError: number;
  readonly distanceM: number;
  /** Seconds until the player reaches it at the current velocity. Infinity when never. */
  readonly timeToContactS: number;
  /** Physics, spawn points, a teleport destination. These jump the queue. */
  readonly gameplayCritical: boolean;
  readonly representation: TileRepresentation;
  /**
   * The tile's centre in the player's current frame, when the provider knows it. Lets the
   * scheduler weigh a tile by where it sits relative to travel instead of by distance alone.
   */
  readonly centreM?: readonly [number, number, number];
}

export interface TileDemandInit extends Omit<TileDemand, 'priority' | 'screenSpaceError'> {
  priority?: number;
  screenSpaceError?: number;
}

export function tileDemand(init: TileDemandInit): TileDemand {
  return { priority: 0, screenSpaceError: 0, ...init };
}

/**
 * What a provider hands back. `cpuBytes` and `estimatedGpuBytes` are not optional in practice —
 * the cache evicts on them, and a provider that reports zero will be trusted and will blow the
 * memory budget.
 */
export interface TilePayload {
  readonly key: WorldTileKey;
  /** Bumped when a provider's output format changes, so stale cache entries are recognisable. */
  readonly version: number;
  readonly cpuBytes: number;
  readonly estimatedGpuBytes: number;
  readonly geometricErrorM?: number;
  readonly geometry?: unknown;
  readonly imagery?: unknown;
  readonly collision?: unknown;
  readonly metadata?: unknown;
}

/** A tile that is live in the world and can be taken back out again. */
export interface ActiveTile {
  readonly key: WorldTileKey;
  readonly providerId: string;
  readonly payload: TilePayload;
  readonly representation: TileRepresentation;
  /** Called by the provider when the tile leaves. Must release GPU resources. */
  dispose(): void;
}
