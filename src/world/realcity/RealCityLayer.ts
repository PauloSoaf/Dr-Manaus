import {
  BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedMesh,
  Matrix4, Mesh, MeshStandardMaterial, Vector3,
} from 'three/webgpu';
import type { Collider } from '../../core/types';
import { REAL_CITY } from '../../core/config';
import { RealCityMaterials } from './materials';
import { RoadNetwork, type RoadRecord } from './roads';
import { DistrictIndex } from './districts';
import { RoadGraph } from '../traffic/RoadGraph';
import {
  appendNearBuilding, appendShellBuilding, buildingExtent, createBuffers, districtCharacter, setDistrictSampler,
  type MeshBuffers, type RealBuilding,
} from './buildingGeometry';

interface PackedTile { key: string; tx: number; tz: number; buildings: RealBuilding[] }
interface RuinedBuilding { bounds: Collider; tile: string; blocks: number[] }

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
  districts?: string;
  roadgraph?: string;
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
  /** Vertex span of each building inside the merged buffers, so one can be collapsed in place. */
  detailRanges: Map<string, number>;
  shellRanges: Map<string, number>;
  touched: number;
}

interface BuildJob {
  tile: Tile;
  kind: 'shell' | 'detail';
  /** Near cells always exist for collision; `rich` decides whether they also get facades. */
  rich: boolean;
  list: RealBuilding[];
  index: number;
  buffers: MeshBuffers;
  colliders: Collider[];
  ranges: Map<string, number>;
}

const CELLS_PER_SIDE = 4;
/** Packing base for a building's vertex span; a sixty-storey tower stays well under it. */
const VERTEX_SPAN = 65536;

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
  /** Buildings the player has levelled. Bounded, because a long flight would otherwise grow it forever. */
  private readonly destroyed = new Set<string>();
  private readonly destroyedOrder: string[] = [];
  private readonly destroyedRecords = new Map<string, RuinedBuilding>();
  private readonly ruinedSkyline = new Map<string, Map<number, number>>();
  private readonly touchedGeometry = new Set<Mesh>();
  private collidersDirty = false;
  private readonly focus = new Vector3();
  private readonly colliderFocus = new Vector3();
  private readonly colliderCandidates: Collider[] = [];
  /** Real Manaus bairro boundaries, used for naming places and for tinting facades by district. */
  readonly districts = new DistrictIndex();
  /** The drivable network: traffic and the rendered ribbons come from the same compiled data. */
  readonly roads_graph = new RoadGraph();
  private skyline?: InstancedMesh;
  private skylineData = new Map<string, number[]>();
  private skylineDirty = true;
  private enabled = false;
  private night = false;
  private detailEnabled = true;
  private lastPlanX = Infinity;
  private lastPlanZ = Infinity;
  private speed = 0;
  private rich = true;
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
      await Promise.all([this.loadRoads(), this.loadSkyline(), this.loadDistricts(), this.loadRoadGraph()]);
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
      this.roads = new RoadNetwork(records, this.materials.road, this.materials.lamp);
      this.group.add(this.roads.group);
      this.metrics.roadTriangles = this.roads.triangleCount;
    } catch { /* The procedural road ribbons stay visible when the real network is missing. */ }
  }

  private async loadRoadGraph(): Promise<void> {
    if (!this.manifest?.roadgraph) return;
    try {
      const response = await fetch(`${baseUrl()}geodata/real-city/${this.manifest.roadgraph}`);
      if (!response.ok) return;
      this.roads_graph.load(await response.json());
    } catch { /* Without the graph there is simply no traffic; the city still renders. */ }
  }

  private async loadDistricts(): Promise<void> {
    if (!this.manifest?.districts) return;
    try {
      const response = await fetch(`${baseUrl()}geodata/real-city/${this.manifest.districts}`);
      if (!response.ok) return;
      if (!this.districts.load(await response.json())) return;
      // Real boundaries, built-in character: a bairro reads as one place across its true extent,
      // with a crisp edge against its neighbour rather than a smooth coordinate blend.
      setDistrictSampler((x, z) => {
        const bairro = this.districts.at(x, z);
        return bairro ? districtCharacter(bairro.name, bairro.x, bairro.z) : null;
      });
    } catch { /* Without bairro boundaries the HUD falls back to the nearest landmark. */ }
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
        if (this.ruinedSkyline.get(key)?.has(p)) continue;
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

  /**
   * Levels a real building. The merged tile geometry is not rebuilt — the building's own vertex
   * span is collapsed to a point in place and uploaded as a partial range, so razing a block at
   * mega speed costs a few hundred bytes of transfer instead of a seven-megabyte re-upload.
   */
  destroy(colliderId: string): boolean {
    if (colliderId.startsWith('road:')) { const result = this.roads?.destroy(colliderId) ?? false; if (result) this.refreshColliders(); return result; }
    if (!this.enabled || !colliderId.startsWith('real:')) return false;
    const id = colliderId.slice(5);
    if (this.destroyed.has(id)) return false;
    this.destroyed.add(id);
    this.destroyedOrder.push(id);
    if (this.destroyedOrder.length > REAL_CITY.maxDestroyed) {
      const evicted = this.destroyedOrder.shift();
      if (evicted !== undefined) {
        this.destroyed.delete(evicted); this.releaseRuin(evicted);
      }
    }
    for (const tile of this.tiles.values()) {
      this.collapse(tile.detail, tile.detailRanges.get(id));
      this.collapse(tile.shell, tile.shellRanges.get(id));
      for (let i = tile.colliders.length - 1; i >= 0; i--) {
        if (tile.colliders[i].id === colliderId) {
          this.recordRuin(id, tile.key, tile.colliders[i]);
          tile.colliders.splice(i, 1); this.collidersDirty = true;
        }
      }
    }
    // True once the building is gone from the world, whether or not a mesh happened to be
    // resident to collapse: a rebuilt tier skips it either way, so the caller must not retry.
    return true;
  }

  private recordRuin(id: string, key: string, bounds: Collider): void {
    if (this.destroyedRecords.has(id)) return;
    const blocks = this.skylineData.get(key), affected: number[] = [];
    const tile = this.tiles.get(key);
    if (blocks && tile) {
      let nearest = -1, distance = Infinity;
      for (let p = 0; p + 7 < blocks.length; p += 8) {
        const dx = Math.abs(tile.originX + blocks[p] - bounds.x), dz = Math.abs(tile.originZ + blocks[p + 1] - bounds.z);
        if (dx <= (blocks[p + 2] + bounds.width) / 2 && dz <= (blocks[p + 3] + bounds.depth) / 2) affected.push(p);
        if (dx * dx + dz * dz < distance) { distance = dx * dx + dz * dz; nearest = p; }
      }
      // A skyline mass summarizes several footprints; suppress its nearest mass when a footprint
      // lies between boxes, rather than resurrecting that mass when the detailed tile is evicted.
      if (!affected.length && nearest >= 0) affected.push(nearest);
    }
    const counts = this.ruinedSkyline.get(key) ?? new Map<number, number>();
    for (const p of affected) counts.set(p, (counts.get(p) ?? 0) + 1);
    this.ruinedSkyline.set(key, counts); this.destroyedRecords.set(id, { bounds, tile: key, blocks: affected }); this.skylineDirty = true;
  }

  private releaseRuin(id: string, rebuild = true): void {
    const record = this.destroyedRecords.get(id); if (!record) return;
    const counts = this.ruinedSkyline.get(record.tile);
    if (counts) {
      for (const block of record.blocks) { const remaining = (counts.get(block) ?? 1) - 1; if (remaining > 0) counts.set(block, remaining); else counts.delete(block); }
      if (!counts.size) this.ruinedSkyline.delete(record.tile);
    }
    this.destroyedRecords.delete(id); this.skylineDirty = true;
    const tile = this.tiles.get(record.tile); if (tile && rebuild) this.schedule(tile);
  }

  restore(position: Vector3, radius: number): number {
    if (!Number.isFinite(radius) || radius < 0) return 0;
    let count = this.roads?.restore(position, radius) ?? 0;
    const affected = new Set<string>();
    for (const [id, record] of this.destroyedRecords) {
      const box = record.bounds;
      const dx = Math.max(0, Math.abs(position.x - box.x) - box.width / 2), dy = Math.max(0, Math.abs(position.y - box.y) - box.height / 2), dz = Math.max(0, Math.abs(position.z - box.z) - box.depth / 2);
      if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
      this.destroyed.delete(id); affected.add(record.tile); this.releaseRuin(id, false);
      const order = this.destroyedOrder.indexOf(id); if (order >= 0) this.destroyedOrder.splice(order, 1);
      count++;
    }
    for (const key of affected) { const tile = this.tiles.get(key); if (tile) this.schedule(tile); }
    if (count) this.collidersDirty = true;
    return count;
  }

  private collapse(mesh: Mesh | undefined, packed: number | undefined): boolean {
    if (!mesh || packed === undefined) return false;
    const attribute = mesh.geometry.getAttribute('position');
    if (!(attribute instanceof BufferAttribute)) return false;
    const first = Math.floor(packed / VERTEX_SPAN), count = packed % VERTEX_SPAN;
    const array = attribute.array as Float32Array;
    if ((first + count) * 3 > array.length) return false;
    // Degenerate triangles are discarded before rasterisation, which is cheaper than an index rebuild.
    array.fill(0, first * 3, (first + count) * 3);
    attribute.addUpdateRange(first * 3, count * 3);
    attribute.needsUpdate = true;
    this.touchedGeometry.add(mesh);
    return true;
  }

  /** True once the player has levelled this building, so nothing re-creates it. */
  isDestroyed(buildingId: string): boolean { return this.destroyed.has(buildingId); }
  get destroyedCount(): number { return this.destroyed.size; }

  setNight(night: boolean): void {
    this.night = night;
    this.materials?.setNight(night);
  }

  /** Quality presets trade near-tier detail for frame time without changing the streamed set. */
  setDetail(enabled: boolean): void {
    if (enabled === this.detailEnabled) return;
    this.detailEnabled = enabled;
    this.refreshRichness();
  }

  /**
   * Dropping facade detail must never drop collision with it. Near cells stay promoted whatever
   * the quality preset or the flight speed says; only the geometry built for them gets cheaper.
   */
  private refreshRichness(): void {
    const rich = this.detailEnabled && this.speed < REAL_CITY.detailSpeedLimit;
    if (rich === this.rich) return;
    this.rich = rich;
    for (const tile of this.tiles.values()) if (tile.nearCount) this.schedule(tile);
  }

  update(position: Vector3, velocity: Vector3, dt: number): void {
    if (!this.enabled || !this.manifest) return;
    if (this.colliderFocus.distanceToSquared(position) > 32 * 32) { this.colliderFocus.copy(position); this.collidersDirty = true; }
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    this.speed = speed;
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
    this.refreshRichness();
    this.classifyCells(position, speed);
    this.runJobs();
    this.roads?.update(position.x, position.z, speed);
    if (this.roads) this.metrics.roadTriangles = this.roads.triangleCount;
    if (this.collidersDirty || this.roads?.collidersChanged) { this.collidersDirty = false; this.refreshColliders(); }
    // One flush per frame: a rampage collapses many buildings but uploads their ranges together.
    if (this.touchedGeometry.size) {
      for (const mesh of this.touchedGeometry) {
        const attribute = mesh.geometry.getAttribute('position');
        if (attribute instanceof BufferAttribute) attribute.clearUpdateRanges();
      }
      this.touchedGeometry.clear();
    }
    if (this.skylineDirty) this.rebuildSkyline();
    this.metrics.tiles = this.tiles.size;
    this.metrics.queued = this.jobs.length + this.loading.size;
  }

  /** Requests the shell ring around the focus point and evicts tiles past the hysteresis band. */
  private plan(radius: number): void {
    if (!this.manifest) return;
    // Detail jobs jump the queue so facades appear first; without back-pressure a steady stream of
    // new tiles would keep doing that and the shell tier would never get built at all.
    const saturated = this.jobs.length > REAL_CITY.maxQueuedJobs;
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
    if (!saturated) {
      for (const request of requests.slice(0, REAL_CITY.maxConcurrentLoads)) void this.loadTile(request.key, request.file);
    }

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
        group, colliders: [], detailRanges: new Map(), shellRanges: new Map(), touched: performance.now(),
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
        const now = distance < (was ? REAL_CITY.detailExit : REAL_CITY.detailEnter);
        if (now !== was) { tile.near[index] = now; changed = true; }
        if (now) count++;
      }
      if (!changed) continue;
      tile.nearCount = count;
      this.schedule(tile);
    }
    void speed;
  }

  /** Replaces any pending work for the tile so a fast traversal cannot queue stale rebuilds. */
  private schedule(tile: Tile): void {
    for (let i = this.jobs.length - 1; i >= 0; i--) if (this.jobs[i].tile === tile) this.jobs.splice(i, 1);
    const shell: RealBuilding[] = [], detail: RealBuilding[] = [];
    for (let index = 0; index < tile.cells.length; index++) {
      const target = tile.near[index] ? detail : shell;
      // A collapsed building is gone for good: it must not come back when the tier is rebuilt.
      for (const building of tile.cells[index]) if (!this.destroyed.has(building.id)) target.push(building);
    }
    if (detail.length) this.jobs.push({ tile, kind: 'detail', rich: this.rich, list: detail, index: 0, buffers: createBuffers(), colliders: [], ranges: new Map() });
    else { disposeMesh(tile.detail); tile.detail = undefined; tile.colliders = []; this.refreshColliders(); }
    this.jobs.push({ tile, kind: 'shell', rich: false, list: shell, index: 0, buffers: createBuffers(), colliders: [], ranges: new Map() });
    this.prioritise();
  }

  /**
   * Facades first, then the nearest shells. Without this a steady stream of arriving tiles keeps
   * pushing shells to the back of the queue and the ground around the player never solidifies.
   * A job already under way keeps its place, so nothing loses the work it has done.
   */
  private prioritise(): void {
    const size = this.manifest?.tileSize ?? REAL_CITY.tileSize;
    this.jobs.sort((a, b) => {
      if (a.index > 0 !== b.index > 0) return a.index > 0 ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === 'detail' ? -1 : 1;
      return this.tileDistance(a.tile.tx, a.tile.tz, size) - this.tileDistance(b.tile.tx, b.tile.tz, size);
    });
  }

  /** A fixed millisecond budget per frame; a 2 600-building tile spreads over several frames. */
  private runJobs(): void {
    const start = performance.now();
    while (this.jobs.length) {
      const job = this.jobs[0];
      if (!this.tiles.has(job.tile.key)) { this.jobs.shift(); continue; }
      while (job.index < job.list.length) {
        const building = job.list[job.index++];
        if (this.destroyed.has(building.id)) continue;
        const first = job.buffers.position.length / 3;
        const collider = job.rich
          ? appendNearBuilding(job.buffers, building)
          : appendShellBuilding(job.buffers, building);
        const vertices = job.buffers.position.length / 3 - first;
        // Packed into one double so a collapse is two integer reads, not an object per building.
        if (vertices > 0 && vertices < VERTEX_SPAN) job.ranges.set(building.id, first * VERTEX_SPAN + vertices);
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
    const material = job.rich ? this.materials?.near : this.materials?.shell;
    if (!material) return;
    const geometry = geometryFrom(job.buffers, job.rich);
    if (job.kind === 'detail') {
      disposeMesh(tile.detail); tile.detail = undefined;
      tile.colliders = job.colliders.filter(collider => !this.destroyed.has(collider.id?.slice(5) ?? ''));
      tile.detailRanges = job.ranges;
      if (geometry) {
        const mesh = new Mesh(geometry, material);
        mesh.name = `real-detail:${tile.key}`;
        mesh.castShadow = true; mesh.receiveShadow = true;
        tile.group.add(mesh); tile.detail = mesh;
        for (const [id, packed] of job.ranges) if (this.destroyed.has(id)) this.collapse(mesh, packed);
      }
      this.refreshColliders();
    } else {
      disposeMesh(tile.shell); tile.shell = undefined;
      tile.shellRanges = job.ranges;
      if (geometry) {
        const mesh = new Mesh(geometry, material);
        mesh.name = `real-shell:${tile.key}`;
        // Shells never cast shadows: they exist precisely where per-object shadows stop paying off.
        mesh.receiveShadow = true;
        tile.group.add(mesh); tile.shell = mesh;
        for (const [id, packed] of job.ranges) if (this.destroyed.has(id)) this.collapse(mesh, packed);
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
    this.colliderCandidates.length = 0;
    for (const tile of this.tiles.values()) {
      for (const collider of tile.colliders) {
        if (!this.destroyed.has(collider.id?.slice(5) ?? '')) this.colliderCandidates.push(collider);
      }
    }
    if (this.roads) this.colliderCandidates.push(...this.roads.colliders);
    const position = this.colliderFocus;
    this.colliderCandidates.sort((a, b) => (a.x - position.x) ** 2 + (a.z - position.z) ** 2 - ((b.x - position.x) ** 2 + (b.z - position.z) ** 2));
    for (let i = 0; i < Math.min(REAL_CITY.maxColliders, this.colliderCandidates.length); i++) this.colliderList.push(this.colliderCandidates[i]);
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
    const marker = colliderId.includes('/building/') ? colliderId.indexOf('/building/') : colliderId.indexOf('/tree/');
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
        // Vegetation is suppressed too: a generated tree has no idea a surveyed building stands there.
        if (object.name === 'facades' || object.name === 'terracotta-roofs' || object.name === 'sidewalks'
          || object.name === 'tree-trunks' || object.name === 'tropical-canopy') object.visible = !replaced;
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
    setDistrictSampler(null);
    this.materials?.dispose();
    this.colliderList.length = 0;
    this.destroyed.clear(); this.destroyedOrder.length = 0; this.touchedGeometry.clear();
    this.destroyedRecords.clear(); this.ruinedSkyline.clear(); this.colliderCandidates.length = 0;
    this.realTiles.clear();
    this.group.removeFromParent();
  }
}
