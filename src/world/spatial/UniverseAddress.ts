/**
 * Addressing at cosmic scale.
 *
 * A double has 53 bits of mantissa, which is about 9 petametres of resolution at one metre — fine
 * for a solar system and useless for a universe. Adding one metre to 10^26 metres does nothing at
 * all. So beyond the solar system, position stops being a single number and becomes a pair: an
 * integer sector index, and a double offset *within* that sector.
 *
 * The sector indices are `bigint` because they genuinely exceed 2^53 at the scales involved, and
 * because an integer that silently loses its low bits is worse than one that is slow.
 */

import { finite, LIGHT_YEAR_M, type Vec3 } from './units';

/** Integer sector coordinates. */
export interface SectorIndex {
  readonly x: bigint;
  readonly y: bigint;
  readonly z: bigint;
}

/**
 * Where something is in the universe.
 *
 * The fields narrow from coarse to fine. A star has a galaxy and a sector; a planet adds a system
 * and a body; a place on that body adds a child frame. Everything below the sector is expressed
 * in ordinary metres relative to the sector, which keeps the numbers small enough to be exact.
 */
export interface UniverseAddress {
  readonly galaxyId: string;
  readonly sector: SectorIndex;
  readonly systemId?: string;
  readonly bodyId?: string;
  readonly childFrame?: string;
}

/** Sector edge length. One hundred light years keeps a sector's interior well inside a double. */
export const SECTOR_SIZE_M = 100 * LIGHT_YEAR_M;

export function sectorIndex(x: bigint | number, y: bigint | number, z: bigint | number): SectorIndex {
  return { x: BigInt(Math.trunc(Number(x))), y: BigInt(Math.trunc(Number(y))), z: BigInt(Math.trunc(Number(z))) };
}

export function universeAddress(
  galaxyId: string,
  sector: SectorIndex,
  extra: { systemId?: string; bodyId?: string; childFrame?: string } = {},
): UniverseAddress {
  return { galaxyId, sector, ...extra };
}

/**
 * A stable, sortable string for an address. Used as a cache key, a save key and a seed source, so
 * it has to be deterministic across runs and platforms — no object key ordering, no locale.
 */
export function addressKey(address: UniverseAddress): string {
  const parts = [
    address.galaxyId,
    `${address.sector.x},${address.sector.y},${address.sector.z}`,
  ];
  if (address.systemId !== undefined) parts.push(address.systemId);
  if (address.bodyId !== undefined) parts.push(address.bodyId);
  if (address.childFrame !== undefined) parts.push(address.childFrame);
  return parts.join('/');
}

export function sectorKey(galaxyId: string, sector: SectorIndex): string {
  return `${galaxyId}/${sector.x},${sector.y},${sector.z}`;
}

export function sectorsEqual(a: SectorIndex, b: SectorIndex): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function addressesEqual(a: UniverseAddress, b: UniverseAddress): boolean {
  return a.galaxyId === b.galaxyId
    && sectorsEqual(a.sector, b.sector)
    && a.systemId === b.systemId
    && a.bodyId === b.bodyId
    && a.childFrame === b.childFrame;
}

/**
 * Splits a metre offset from a sector origin into whole sectors plus a remainder, so an address
 * always stays in canonical form. Positions handed in from gameplay drift across sector edges and
 * must be renormalised rather than allowed to grow.
 */
export function normalizeSectorOffset(
  sector: SectorIndex,
  offsetM: Vec3,
): { sector: SectorIndex; offsetM: Vec3 } {
  const axis = (index: bigint, value: number): [bigint, number] => {
    const metres = finite(value);
    const whole = Math.floor(metres / SECTOR_SIZE_M);
    return [index + BigInt(whole), metres - whole * SECTOR_SIZE_M];
  };
  const [x, ox] = axis(sector.x, offsetM[0]);
  const [y, oy] = axis(sector.y, offsetM[1]);
  const [z, oz] = axis(sector.z, offsetM[2]);
  return { sector: { x, y, z }, offsetM: [ox, oy, oz] };
}

/**
 * Separation between two sector-relative positions, in metres.
 *
 * The sector difference is taken in `bigint` and only then converted, so the subtraction that
 * could overflow happens exactly and the conversion happens on a small number. Returns `Infinity`
 * when the two are far enough apart that metres stop being meaningful.
 */
export function separationM(
  a: { sector: SectorIndex; offsetM: Vec3 },
  b: { sector: SectorIndex; offsetM: Vec3 },
): number {
  const delta = (ai: bigint, bi: bigint, ao: number, bo: number): number => {
    const sectors = Number(bi - ai);
    if (!Number.isFinite(sectors)) return Number.POSITIVE_INFINITY;
    return sectors * SECTOR_SIZE_M + (finite(bo) - finite(ao));
  };
  const dx = delta(a.sector.x, b.sector.x, a.offsetM[0], b.offsetM[0]);
  const dy = delta(a.sector.y, b.sector.y, a.offsetM[1], b.offsetM[1]);
  const dz = delta(a.sector.z, b.sector.z, a.offsetM[2], b.offsetM[2]);
  return Math.hypot(dx, dy, dz);
}

/**
 * A 64-bit deterministic seed for a sector, from its galaxy and indices.
 *
 * Determinism is the whole contract of the procedural universe: the same address must produce the
 * same system on every machine, every run, forever. FNV-1a over the canonical key gives that, and
 * `Math.random` is banned from this project precisely because it does not.
 */
export function sectorSeed(galaxyId: string, sector: SectorIndex): bigint {
  const key = sectorKey(galaxyId, sector);
  let hash = 0xcbf2_9ce4_8422_2325n;
  const prime = 0x0000_0100_0000_01b3n;
  const mask = 0xffff_ffff_ffff_ffffn;
  for (let i = 0; i < key.length; i++) {
    hash = (hash ^ BigInt(key.charCodeAt(i) & 0xff)) & mask;
    hash = (hash * prime) & mask;
  }
  return hash;
}
