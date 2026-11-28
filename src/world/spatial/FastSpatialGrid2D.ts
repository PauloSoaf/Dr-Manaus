/**
 * FastSpatialGrid2D.ts
 *
 * Contiguous typed-array 2D Spatial Hash Grid for O(1) proximity and neighbor queries.
 * Based on references/boids-js/common/Grid.js and Matthias Teschner's spatial hashing algorithm.
 * 
 * Performance & Architecture:
 * - Zero GC allocations per frame: pre-allocated Int32Array linked lists.
 * - Cell-based hashing transforms O(N^2) crowd/traffic interactions into O(N) amortized checks.
 * - Handles up to maxEntities (vehicles, pedestrians, boats, creatures).
 */

export class FastSpatialGrid2D {
  private readonly cellSize: number;
  private readonly invCellSize: number;
  private readonly cellsX: number;
  private readonly cellsZ: number;
  private readonly halfExtent: number;
  private readonly grid: Int32Array; // Heads of cell linked lists
  private readonly next: Int32Array; // Links to next entity in list
  private readonly inserted: Uint8Array;
  private readonly posX: Float32Array;
  private readonly posZ: Float32Array;
  private readonly maxEntities: number;
  private count = 0;

  constructor(worldExtentM: number = 8000, cellSizeM: number = 32, maxEntities: number = 2048) {
    this.cellSize = Math.max(8, cellSizeM);
    this.invCellSize = 1.0 / this.cellSize;
    this.halfExtent = worldExtentM * 0.5;
    this.cellsX = Math.ceil(worldExtentM / this.cellSize);
    this.cellsZ = this.cellsX;
    this.maxEntities = maxEntities;

    this.grid = new Int32Array(this.cellsX * this.cellsZ).fill(-1);
    this.next = new Int32Array(maxEntities).fill(-1);
    this.inserted = new Uint8Array(maxEntities);
    this.posX = new Float32Array(maxEntities);
    this.posZ = new Float32Array(maxEntities);
  }

  /**
   * Resets the preallocated cell buckets before the next population pass.
   */
  public clear(): void {
    this.grid.fill(-1);
    this.inserted.fill(0);
    this.count = 0;
  }

  /**
   * Inserts an entity into the grid. O(1) operation.
   */
  public insert(entityId: number, x: number, z: number): void {
    if (!Number.isInteger(entityId) || entityId < 0 || entityId >= this.maxEntities ||
        this.inserted[entityId] || !Number.isFinite(Math.fround(x) + Math.fround(z))) return;

    // Shift coordinates so [-halfExtent, +halfExtent] maps to [0, worldExtent]
    const localX = x + this.halfExtent;
    const localZ = z + this.halfExtent;

    const cx = Math.max(0, Math.min(this.cellsX - 1, Math.floor(localX * this.invCellSize)));
    const cz = Math.max(0, Math.min(this.cellsZ - 1, Math.floor(localZ * this.invCellSize)));
    const cellIdx = cx + cz * this.cellsX;

    this.posX[entityId] = x;
    this.posZ[entityId] = z;

    // Prepend to cell linked list
    this.next[entityId] = this.grid[cellIdx];
    this.grid[cellIdx] = entityId;
    this.inserted[entityId] = 1;
    this.count++;
  }

  /**
   * Queries all entities within radius of (x, z).
   * Runs with zero allocation via inline callback.
   */
  public forEachNeighbor(
    x: number,
    z: number,
    radiusM: number,
    callback: (neighborId: number, nx: number, nz: number, distSq: number) => void
  ): void {
    if (!Number.isFinite(x + z + radiusM) || radiusM <= 0) return;

    const localX = x + this.halfExtent;
    const localZ = z + this.halfExtent;

    const radCells = Math.ceil(radiusM * this.invCellSize);
    const centerCx = Math.floor(localX * this.invCellSize);
    const centerCz = Math.floor(localZ * this.invCellSize);

    // Insertions outside the grid share an edge bucket. Distance still filters its candidates.
    const minCx = Math.max(0, Math.min(this.cellsX - 1, centerCx - radCells));
    const maxCx = Math.max(0, Math.min(this.cellsX - 1, centerCx + radCells));
    const minCz = Math.max(0, Math.min(this.cellsZ - 1, centerCz - radCells));
    const maxCz = Math.max(0, Math.min(this.cellsZ - 1, centerCz + radCells));

    const radSq = radiusM * radiusM;

    for (let cz = minCz; cz <= maxCz; cz++) {
      const rowOffset = cz * this.cellsX;
      for (let cx = minCx; cx <= maxCx; cx++) {
        let curr = this.grid[cx + rowOffset];
        while (curr !== -1) {
          const nx = this.posX[curr];
          const nz = this.posZ[curr];
          const dx = nx - x;
          const dz = nz - z;
          const distSq = dx * dx + dz * dz;

          if (distSq <= radSq) {
            callback(curr, nx, nz, distSq);
          }
          curr = this.next[curr];
        }
      }
    }
  }

  /**
   * Finds the nearest neighbor to (x, z) within maxRadiusM.
   */
  public findNearest(
    x: number,
    z: number,
    maxRadiusM: number,
    excludeId: number = -1
  ): { neighborId: number; distM: number } | null {
    if (!Number.isFinite(x + z + maxRadiusM) || maxRadiusM <= 0) return null;

    let nearestId = -1;
    let minDistanceSq = maxRadiusM * maxRadiusM;

    this.forEachNeighbor(x, z, maxRadiusM, (id, _nx, _nz, distSq) => {
      if (id !== excludeId && (nearestId === -1 || distSq < minDistanceSq)) {
        minDistanceSq = distSq;
        nearestId = id;
      }
    });

    if (nearestId === -1) return null;
    return { neighborId: nearestId, distM: Math.sqrt(minDistanceSq) };
  }

  public get size(): number {
    return this.count;
  }
}

