export interface District {
  name: string;
  kind: string;
  x: number;
  z: number;
  /** Outer ring first, as flat `x,z` pairs in world metres. */
  rings: number[][];
}

interface DistrictPayload { districts: District[] }

interface Indexed extends District {
  minX: number; maxX: number; minZ: number; maxZ: number;
}

const CELL = 1024;

function boundsOf(district: District): Indexed {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const ring of district.rings) {
    for (let i = 0; i < ring.length; i += 2) {
      if (ring[i] < minX) minX = ring[i]; if (ring[i] > maxX) maxX = ring[i];
      if (ring[i + 1] < minZ) minZ = ring[i + 1]; if (ring[i + 1] > maxZ) maxZ = ring[i + 1];
    }
  }
  return { ...district, minX, maxX, minZ, maxZ };
}

/** Ray casting on a flat ring; the rings are already projected to metres. */
function inRing(ring: number[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], zi = ring[i + 1], xj = ring[j], zj = ring[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Real Manaus bairro boundaries, compiled offline from Overture divisions.
 *
 * Lookups happen per frame for the HUD and per building while a tile is built, so the polygons
 * are bucketed on a coarse grid: a query touches only the handful of bairros whose bounding box
 * overlaps that cell, instead of all of them.
 */
export class DistrictIndex {
  private readonly cells = new Map<string, Indexed[]>();
  private readonly all: Indexed[] = [];
  private lastX = NaN;
  private lastZ = NaN;
  private lastHit: District | null = null;

  get size(): number { return this.all.length; }
  get names(): string[] { return this.all.map(district => district.name); }

  load(payload: DistrictPayload | null | undefined): boolean {
    this.cells.clear(); this.all.length = 0;
    this.lastX = this.lastZ = NaN; this.lastHit = null;
    if (!payload?.districts?.length) return false;
    for (const district of payload.districts) {
      if (!district?.rings?.length || !district.name) continue;
      const indexed = boundsOf(district);
      if (!Number.isFinite(indexed.minX) || !Number.isFinite(indexed.minZ)) continue;
      this.all.push(indexed);
      for (let cz = Math.floor(indexed.minZ / CELL); cz <= Math.floor(indexed.maxZ / CELL); cz++) {
        for (let cx = Math.floor(indexed.minX / CELL); cx <= Math.floor(indexed.maxX / CELL); cx++) {
          const key = `${cx},${cz}`;
          const bucket = this.cells.get(key);
          if (bucket) bucket.push(indexed); else this.cells.set(key, [indexed]);
        }
      }
    }
    return this.all.length > 0;
  }

  /** The bairro containing the point, or null when it falls outside every compiled boundary. */
  at(x: number, z: number): District | null {
    if (!this.all.length) return null;
    // Consecutive queries cluster tightly, so one cached answer removes most of the work.
    if (x === this.lastX && z === this.lastZ) return this.lastHit;
    this.lastX = x; this.lastZ = z;
    this.lastHit = null;
    const bucket = this.cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (bucket) {
      for (const district of bucket) {
        if (x < district.minX || x > district.maxX || z < district.minZ || z > district.maxZ) continue;
        if (!inRing(district.rings[0], x, z)) continue;
        let holed = false;
        for (let i = 1; i < district.rings.length && !holed; i++) holed = inRing(district.rings[i], x, z);
        if (!holed) { this.lastHit = district; return district; }
      }
    }
    return null;
  }

  /** Falls back to the closest centroid, so the HUD can still name where the player is over water. */
  nearest(x: number, z: number, maxDistance = 4000): District | null {
    const hit = this.at(x, z);
    if (hit) return hit;
    let best: District | null = null, bestDistance = maxDistance * maxDistance;
    for (const district of this.all) {
      const dx = district.x - x, dz = district.z - z;
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) { bestDistance = distance; best = district; }
    }
    return best;
  }
}
