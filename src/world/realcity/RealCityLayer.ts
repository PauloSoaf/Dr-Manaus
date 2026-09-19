import {
  BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedMesh,
  Matrix4, Mesh, MeshStandardMaterial, Vector3,
} from 'three/webgpu';
import type { Collider } from '../../core/types';
import { REAL_CITY } from '../../core/config';
import { RealCityMaterials } from './materials';
import { RoadNetwork, type RoadRecord } from './roads';
import {
  appendNearBuilding, appendShellBuilding, buildingExtent, createBuffers,
  type MeshBuffers, type RealBuilding,
} from './buildingGeometry';

interface PackedTile { key: string; tx: number; tz: number; buildings: RealBuilding[] }

export interface RealCityManifest {
  version: number;
  generatedAt: string;
  source: string;
  origin: { lat: number; lon: number };
  tileSize: number;
  proceduralChunkSize: number;
  tiles: Record<string, string>;
  roads?: string;
  pois?: string;
  skyline?: string;
  stats?: Record<string, number>;
}

/** `cells` is a fixed grid over the tile; the near tier promotes individual cells, not tiles. */
interface Tile {
  key: string;
  tx: number; tz: number;
  originX: number; originZ: number;
  cells: RealBuilding[][];
  /** Per-cell near flag; changing it schedules a rebuild of both meshes. */
  near: boolean[];
  nearCount: number;
  group: Group;
  shell?: Mesh;
  detail?: Mesh;
  colliders: Collider[];
  touched: number;
}

interface BuildJob {
  tile: Tile;
  kind: 'shell' | 'detail';
  list: RealBuilding[];
  index: number;
  buffers: MeshBuffers;
  colliders: Collider[];
}

const CELLS_PER_SIDE = 4;

function baseUrl(): string {
  try {
    const url = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
    return typeof url === 'string' ? url : '/';
  } catch { return '/'; }
}

function disposeMesh(mesh: Mesh | undefined): void {
  if (!mesh) return;
  mesh.removeFromParent();
  mesh.geometry.dispose();
}

function geometryFrom(buffers: MeshBuffers, includeLit: boolean): BufferGeometry | null {
  if (!buffers.position.length) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(buffers.position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(buffers.normal, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(buffers.color, 3));
  if (includeLit) geometry.setAttribute('lit', new Float32BufferAttribute(buffers.lit, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export interface RealCityStats {
  tiles: number; near: number; colliders: number; queued: number;
  detailTriangles: number; shellTriangles: number; skyline: number; roadTriangles: number;
  enabled: boolean;
}

/**
 * Real Manaus in three representations that never overlap:
 *
 *   near   — 256 m cells around the player: facades, windows, roofs, collision
 *   shell  — whole tiles out to a couple of kilometres: real footprints, flat colour, no fittings
 *   skyline— the rest of the compiled city as one instanced draw of block masses
 *
 * Tiles that are resident suppress their skyline blocks, and every compiled tile suppresses the
 * procedural city underneath it, so a generated building is never drawn on top of a surveyed one.
 */
export class RealCityLayer {
  readonly group = new Group();
  private manifest?: RealCityManifest;
  private materials?: RealCityMaterials;
  private roads?: RoadNetwork;
  private readonly tiles = new Map<string, Tile>();
  private readonly loading = new Set<string>();
  private readonly jobs: BuildJob[] = [];
  private readonly colliderList: Collider[] = [];
  private readonly realTiles = new Set<string>();
  /** Colliders are stable objects per chunk load, so the verdict is cached without string work. */
  private readonly suppressed = new WeakMap<Collider, boolean>();
  private readonly focus = new Vector3();
  private skyline?: InstancedMesh;
  private skylineData = new Map<string, number[]>();
  private skylineDirty = true;
  private enabled = false;
  private night = false;
  private detailEnabled = true;
  private lastPlanX = Infinity;
  private lastPlanZ = Infinity;
  private planTimer = 0;
  private readonly metrics: RealCityStats = {
    tiles: 0, near: 0, colliders: 0, queued: 0,
    detailTriangles: 0, shellTriangles: 0, skyline: 0, roadTriangles: 0, enabled: false,
  };

  constructor(private readonly root: Group) {
    this.group.name = 'real-city-overture';
    root.add(this.group);
  }

  get colliders(): readonly Collider[] { return this.colliderList; }
  get active(): boolean { return this.enabled; }
  get stats(): Readonly<RealCityStats> { return this.metrics; }
  /** True once the compiled block masses that stand in for unloaded tiles are resident. */
  get hasSkyline(): boolean { return this.skylineData.size > 0; }
  /** Every compiled tile, so the hierarchical LOD can stand down where real data exists. */
  get coveredTiles(): ReadonlySet<string> { return this.realTiles; }
  get tileSize(): number { return this.manifest?.tileSize ?? REAL_CITY.tileSize; }

  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${baseUrl()}geodata/real-city/manifest.json`, { cache: 'no-cache' });
      if (!response.ok) return;
      const manifest = await response.json() as RealCityManifest;
      if (!manifest?.tiles || !Object.keys(manifest.tiles).length) return;
      this.manifest = manifest;
      this.enabled = true;
      this.metrics.enabled = true;
      for (const key of Object.keys(manifest.tiles)) this.realTiles.add(key);
      this.materials = new RealCityMaterials();
      this.materials.setNight(this.night);
      this.hideLegacyRoads();
      await Promise.all([this.loadRoads(), this.loadSkyline()]);
    } catch {
      this.enabled = false;
    }
  }

  private async loadRoads(): Promise<void> {
    if (!this.manifest?.roads || !this.materials) return;
    try {
      const response = await fetch(`${baseUrl()}geodata/real-city/${this.manifest.roads}`);
      if (!response.ok) return;
      const records = await response.json() as RoadRecord[];
      if (!Array.isArray(records) || !records.length) return;
      this.roads = new RoadNetwork(records, this.materials.road);
      this.group.add(this.roads.group);
      this.metrics.roadTriangles = this.roads.triangleCount;
    } catch { /* The procedural road ribbons stay visible when the real network is missing. */ }
  }

  private async loadSkyline(): Promise<void> {
    if (!this.manifest?.skyline) return;
    try {
      const response = await fetch(`${baseUrl()}geodata/real-city/${this.manifest.skyline}`);
      if (!response.ok) return;
      const payload = await response.json() as { stride: number; tiles: Record<string, number[]> };
      if (!payload?.tiles) return;
      for (const [key, blocks] of Object.entries(payload.tiles)) this.skylineData.set(key, blocks);
      this.createSkyline();
    } catch { /* Without a skyline the hierarchical LOD keeps covering the horizon. */ }
  }

  private createSkyline(): void {
    let total = 0;
    for (const blocks of this.skylineData.values()) total += blocks.length / 8;
    if (!total) return;
    const geometry = new BufferGeometry();
    // A unit box with its base at y=0 so an instance scale is exactly the block's mass.
    const box = new Float32Array([
      -.5, 0, .5, .5, 0, .5, .5, 1, .5, -.5, 0, .5, .5, 1, .5, -.5, 1, .5,
      .5, 0, -.5, -.5, 0, -.5, -.5, 1, -.5, .5, 0, -.5, -.5, 1, -.5, .5, 1, -.5,
      -.5, 0, -.5, -.5, 0, .5, -.5, 1, .5, -.5, 0, -.5, -.5, 1, .5, -.5, 1, -.5,
      .5, 0, .5, .5, 0, -.5, .5, 1, -.5, .5, 0, .5, .5, 1, -.5, .5, 1, .5,
      -.5, 1, .5, .5, 1, .5, .5, 1, -.5, -.5, 1, .5, .5, 1, -.5, -.5, 1, -.5,
    ]);
    const normals = new Float32Array(box.length);
    for (let face = 0; face < 5; face++) {
      const n = [[0, 0, 1], [0, 0, -1], [-1, 0, 0], [1, 0, 0], [0, 1, 0]][face];
      for (let v = 0; v < 6; v++) {
        const at = (face * 6 + v) * 3;
        normals[at] = n[0]; normals[at + 1] = n[1]; normals[at + 2] = n[2];
      }
    }
    geometry.setAttribute('position', new Float32BufferAttribute(box, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    material.name = 'real-city-skyline';
    const mesh = new InstancedMesh(geometry, material, total);
    mesh.name = 'real-city-skyline';
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.skyline = mesh;
    this.group.add(mesh);
    this.skylineDirty = true;
  }

  private rebuildSkyline(): void {
    const mesh = this.skyline;
    if (!mesh || !this.manifest) return;
    const size = this.manifest.tileSize;
    const matrix = new Matrix4(), color = new Color();
    let index = 0;
    for (const [key, blocks] of this.skylineData) {
      // A resident tile draws its real footprints; its block mass would only double the silhouette.
      if (this.tiles.has(key)) continue;
      const [tx, tz] = key.split(',').map(Number);
      const originX = tx * size, originZ = tz * size;
      for (let p = 0; p + 7 < blocks.length; p += 8) {
        if (index >= mesh.instanceMatrix.count) break;
        matrix.makeScale(blocks[p + 2], blocks[p + 4], blocks[p + 3]);
        matrix.setPosition(originX + blocks[p], 0, originZ + blocks[p + 1]);
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index++, color.setRGB(blocks[p + 5], blocks[p + 6], blocks[p + 7]));
      }
    }
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.metrics.skyline = index;
    this.skylineDirty = false;
  }

  setNight(night: boolean): void {
    this.night = night;
    this.materials?.setNight(night);
  }

  /** Quality presets trade near-tier detail for frame time without changing the streamed set. */
  setDetail(enabled: boolean): void {
    if (enabled === this.detailEnabled) return;
    this.detailEnabled = enabled;
    for (const tile of this.tiles.values()) if (tile.nearCount) this.schedule(tile);
  }

  update(position: Vector3, velocity: Vector3, dt: number): void {
    if (!this.enabled || !this.manifest) return;
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    // At speed the ring moves ahead of the player and narrows: what is behind can no longer be seen.
    const lead = Math.min(REAL_CITY.maxLead, speed * REAL_CITY.leadSeconds);
    if (lead > 1 && speed > 1) {
      this.focus.set(position.x + velocity.x / speed * lead, 0, position.z + velocity.z / speed * lead);
    } else {
      this.focus.set(position.x, 0, position.z);
    }
    const radius = speed > REAL_CITY.megaSpeed ? REAL_CITY.shellRadiusFast
      : speed > REAL_CITY.fastSpeed ? REAL_CITY.shellRadiusCruise : REAL_CITY.shellRadius;

    // `maxConcurrentLoads` throttles each pass, so standing still must still re-plan: otherwise the
    // ring stops at the first handful of tiles and never fills in around a stationary player.
    this.planTimer -= dt;
    const moved = Math.hypot(this.focus.x - this.lastPlanX, this.focus.z - this.lastPlanZ) > REAL_CITY.planStep;
    if (moved || (this.planTimer <= 0 && !this.loading.size)) {
      this.lastPlanX = this.focus.x; this.lastPlanZ = this.focus.z;
      this.planTimer = REAL_CITY.planInterval;
      this.plan(radius);
    }
    this.classifyCells(position, speed);
    this.runJobs();
    this.roads?.update(position.x, position.z);
    if (this.roads) this.metrics.roadTriangles = this.roads.triangleCount;
    if (this.skylineDirty) this.rebuildSkyline();
    this.metrics.tiles = this.tiles.size;
    this.metrics.queued = this.jobs.length + this.loading.size;
  }

  /** Requests the shell ring around the focus point and evicts tiles past the hysteresis band. */
  private plan(radius: number): void {
    if (!this.manifest) return;
    const size = this.manifest.tileSize;
    const reach = Math.ceil(radius / size) + 1;
    const cx = Math.floor(this.focus.x / size), cz = Math.floor(this.focus.z / size);
    const requests: { key: string; file: string; distance: number }[] = [];
    for (let z = -reach; z <= reach; z++) for (let x = -reach; x <= reach; x++) {
      const key = `${cx + x},${cz + z}`;
      const file = this.manifest.tiles[key];
      if (!file) continue;
      const distance = this.tileDistance(cx + x, cz + z, size);
      if (distance > radius) continue;
      if (this.tiles.has(key)) { this.tiles.get(key)!.touched = performance.now(); continue; }
      if (this.loading.has(key)) continue;
      requests.push({ key, file, distance });
    }
    requests.sort((a, b) => a.distance - b.distance);
    for (const request of requests.slice(0, REAL_CITY.maxConcurrentLoads)) void this.loadTile(request.key, request.file);

    const evict = radius + REAL_CITY.evictMargin;
    for (const [key, tile] of this.tiles) {
      if (this.tileDistance(tile.tx, tile.tz, size) <= evict) continue;
      this.releaseTile(tile);
      this.tiles.delete(key);
      this.skylineDirty = true;
    }
    if (this.tiles.size > REAL_CITY.maxTiles) {
      const ordered = [...this.tiles.values()].sort((a, b) => this.tileDistance(b.tx, b.tz, size) - this.tileDistance(a.tx, a.tz, size));
      for (const tile of ordered.slice(0, this.tiles.size - REAL_CITY.maxTiles)) {
        this.releaseTile(tile);
        this.tiles.delete(tile.key);
        this.skylineDirty = true;
      }
    }
  }

  /** Distance from the focus point to the tile's footprint, not to its centre. */
  private tileDistance(tx: number, tz: number, size: number): number {
    const dx = Math.max(tx * size - this.focus.x, 0, this.focus.x - (tx + 1) * size);
    const dz = Math.max(tz * size - this.focus.z, 0, this.focus.z - (tz + 1) * size);
    return Math.hypot(dx, dz);
  }

  private async loadTile(key: string, file: string): Promise<void> {
    if (!this.manifest) return;
    this.loading.add(key);
    try {
      const response = await fetch(`${baseUrl()}geodata/real-city/${file}`);
      if (!response.ok) return;
      const packed = await response.json() as PackedTile;
      if (!packed?.buildings?.length || this.tiles.has(key)) return;
      const size = this.manifest.tileSize, cellSize = size / CELLS_PER_SIDE;
      const cells: RealBuilding[][] = Array.from({ length: CELLS_PER_SIDE * CELLS_PER_SIDE }, () => []);
      for (const building of packed.buildings) {
        const extent = buildingExtent(building);
        if (!extent) continue;
        const ix = Math.min(CELLS_PER_SIDE - 1, Math.max(0, Math.floor(extent.x / cellSize)));
        const iz = Math.min(CELLS_PER_SIDE - 1, Math.max(0, Math.floor(extent.z / cellSize)));
        cells[iz * CELLS_PER_SIDE + ix].push(building);
      }
      const group = new Group();
      group.name = `real-city-tile:${key}`;
      group.position.set(packed.tx * size, 0, packed.tz * size);
      const tile: Tile = {
        key, tx: packed.tx, tz: packed.tz, originX: group.position.x, originZ: group.position.z,
        cells, near: new Array(cells.length).fill(false), nearCount: 0,
        group, colliders: [], touched: performance.now(),
      };
      this.group.add(group);
      this.tiles.set(key, tile);
      this.schedule(tile);
      this.skylineDirty = true;
    } catch {
      // A tile that fails to load simply keeps its skyline block mass.
    } finally {
      this.loading.delete(key);
    }
  }

  /** Cells within the detail radius carry facades and collision; the rest stay as shells. */
  private classifyCells(position: Vector3, speed: number): void {
    if (!this.manifest) return;
    const size = this.manifest.tileSize, cellSize = size / CELLS_PER_SIDE;
    // Windows and balconies are invisible above cruise speed and cost the most to build.
    const allowDetail = this.detailEnabled && speed < REAL_CITY.detailSpeedLimit;
    for (const tile of this.tiles.values()) {
      let changed = false, count = 0;
      for (let index = 0; index < tile.cells.length; index++) {
        if (!tile.cells[index].length) continue;
        const ix = index % CELLS_PER_SIDE, iz = (index / CELLS_PER_SIDE) | 0;
        const minX = tile.originX + ix * cellSize, minZ = tile.originZ + iz * cellSize;
        const dx = Math.max(minX - position.x, 0, position.x - (minX + cellSize));
        const dz = Math.max(minZ - position.z, 0, position.z - (minZ + cellSize));
        const distance = Math.hypot(dx, dz);
        const was = tile.near[index];
        // Hysteresis: a cell already showing facades holds them a little longer.
        const now = allowDetail && distance < (was ? REAL_CITY.detailExit : REAL_CITY.detailEnter);
        if (now !== was) { tile.near[index] = now; changed = true; }
        if (now) count++;
      }
      if (!changed) continue;
      tile.nearCount = count;
      this.schedule(tile);
    }
  }

  /** Replaces any pending work for the tile so a fast traversal cannot queue stale rebuilds. */
  private schedule(tile: Tile): void {
    for (let i = this.jobs.length - 1; i >= 0; i--) if (this.jobs[i].tile === tile) this.jobs.splice(i, 1);
    const shell: RealBuilding[] = [], detail: RealBuilding[] = [];
    for (let index = 0; index < tile.cells.length; index++) {
      const target = tile.near[index] ? detail : shell;
      for (const building of tile.cells[index]) target.push(building);
    }
    // The near job runs first so facades appear before the surrounding shell is refreshed.
    if (detail.length) this.jobs.unshift({ tile, kind: 'detail', list: detail, index: 0, buffers: createBuffers(), colliders: [] });
    else { disposeMesh(tile.detail); tile.detail = undefined; tile.colliders = []; this.refreshColliders(); }
    this.jobs.push({ tile, kind: 'shell', list: shell, index: 0, buffers: createBuffers(), colliders: [] });
  }

  /** A fixed millisecond budget per frame; a 2 600-building tile spreads over several frames. */
  private runJobs(): void {
    const start = performance.now();
    while (this.jobs.length) {
      const job = this.jobs[0];
      if (!this.tiles.has(job.tile.key)) { this.jobs.shift(); continue; }
      while (job.index < job.list.length) {
        const building = job.list[job.index++];
        const collider = job.kind === 'detail'
          ? appendNearBuilding(job.buffers, building)
          : appendShellBuilding(job.buffers, building);
        if (collider && job.kind === 'detail') {
          collider.x += job.tile.originX; collider.z += job.tile.originZ;
          job.colliders.push(collider);
        }
        if ((job.index & 31) === 0 && performance.now() - start > REAL_CITY.buildBudgetMs) return;
      }
      this.finish(job);
      this.jobs.shift();
      if (performance.now() - start > REAL_CITY.buildBudgetMs) return;
    }
  }

  private finish(job: BuildJob): void {
    const tile = job.tile;
    const material = job.kind === 'detail' ? this.materials?.near : this.materials?.shell;
    if (!material) return;
    const geometry = geometryFrom(job.buffers, job.kind === 'detail');
    if (job.kind === 'detail') {
      disposeMesh(tile.detail); tile.detail = undefined;
      tile.colliders = job.colliders;
      if (geometry) {
        const mesh = new Mesh(geometry, material);
        mesh.name = `real-detail:${tile.key}`;
        mesh.castShadow = true; mesh.receiveShadow = true;
        tile.group.add(mesh); tile.detail = mesh;
      }
      this.refreshColliders();
    } else {
      disposeMesh(tile.shell); tile.shell = undefined;
      if (geometry) {
        const mesh = new Mesh(geometry, material);
        mesh.name = `real-shell:${tile.key}`;
        // Shells never cast shadows: they exist precisely where per-object shadows stop paying off.
        mesh.receiveShadow = true;
        tile.group.add(mesh); tile.shell = mesh;
      }
    }
    this.recount();
  }

  private recount(): void {
    let detail = 0, shell = 0, near = 0;
    for (const tile of this.tiles.values()) {
      if (tile.detail) detail += tile.detail.geometry.getAttribute('position').count / 3;
      if (tile.shell) shell += tile.shell.geometry.getAttribute('position').count / 3;
      near += tile.nearCount;
    }
    this.metrics.detailTriangles = detail;
    this.metrics.shellTriangles = shell;
    this.metrics.near = near;
  }

  /**
   * The physical region is deliberately smaller than the visible one: only buildings whose
   * facades are drawn can be hit, which bounds the per-frame broadphase at any flight speed.
   */
  private refreshColliders(): void {
    this.colliderList.length = 0;
    for (const tile of this.tiles.values()) {
      for (const collider of tile.colliders) {
        if (this.colliderList.length >= REAL_CITY.maxColliders) break;
        this.colliderList.push(collider);
      }
    }
    this.metrics.colliders = this.colliderList.length;
  }

  private releaseTile(tile: Tile): void {
    for (let i = this.jobs.length - 1; i >= 0; i--) if (this.jobs[i].tile === tile) this.jobs.splice(i, 1);
    disposeMesh(tile.shell); disposeMesh(tile.detail);
    tile.group.removeFromParent();
    tile.colliders = [];
    this.refreshColliders();
    this.recount();
  }

  /**
   * True when a procedural collider or chunk sits under compiled real data. This is answered
   * from the manifest rather than from what happens to be resident, so the procedural city is
   * suppressed consistently across every tier instead of flickering as tiles stream.
   */
  replacesCollider(collider: Collider): boolean {
    if (!this.enabled) return false;
    let verdict = this.suppressed.get(collider);
    if (verdict === undefined) { verdict = this.replaces(collider.id); this.suppressed.set(collider, verdict); }
    return verdict;
  }

  replaces(colliderId?: string): boolean {
    if (!this.enabled || !colliderId || colliderId.startsWith('real:')) return false;
    const marker = colliderId.indexOf('/building/');
    if (marker <= 0) return false;
    const key = colliderId.slice(0, marker);
    const start = key.startsWith('hlod:') ? 5 : 0;
    const comma = key.indexOf(',', start);
    if (comma < 0) return false;
    return this.coversChunk(Number(key.slice(start, comma)), Number(key.slice(comma + 1)));
  }

  /** Arithmetic rather than a 41 000-entry key set: chunk → tile is a plain integer division. */
  coversChunk(cx: number, cz: number): boolean {
    if (!this.enabled || !this.manifest) return false;
    const ratio = this.manifest.tileSize / this.manifest.proceduralChunkSize;
    return this.realTiles.has(`${Math.floor(cx / ratio)},${Math.floor(cz / ratio)}`);
  }

  /** Called on the streamer's chunk groups so generated blocks never stack on real footprints. */
  syncProceduralVisibility(): void {
    if (!this.enabled) return;
    for (const child of this.root.children) {
      if (!child.name.startsWith('chunk:')) continue;
      const key = child.name.slice(6);
      const comma = key.indexOf(',');
      if (comma < 0) continue;
      const replaced = this.coversChunk(Number(key.slice(0, comma)), Number(key.slice(comma + 1)));
      for (const object of child.children) {
        if (object.name === 'facades' || object.name === 'terracotta-roofs' || object.name === 'sidewalks') object.visible = !replaced;
      }
    }
  }

  private hideLegacyRoads(): void {
    this.root.traverse(object => {
      if (object.name === 'legacy-osm-roads' || object.name === 'legacy-osm-road-markings') object.visible = false;
    });
  }

  dispose(): void {
    for (const tile of this.tiles.values()) this.releaseTile(tile);
    this.tiles.clear();
    this.loading.clear();
    this.jobs.length = 0;
    this.roads?.dispose();
    if (this.skyline) {
      this.skyline.removeFromParent();
      this.skyline.geometry.dispose();
      (this.skyline.material as MeshStandardMaterial).dispose();
      this.skyline.dispose();
      this.skyline = undefined;
    }
    this.skylineData.clear();
    this.materials?.dispose();
    this.colliderList.length = 0;
    this.realTiles.clear();
    this.group.removeFromParent();
  }
}
