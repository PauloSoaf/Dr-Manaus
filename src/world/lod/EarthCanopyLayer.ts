/**
 * Forest beyond the detailed chunks on the Earth outside Manaus.
 *
 * Instanced canopy clumps, each standing for a few trees, placed on a fixed geodetic grid: the same
 * coordinate always grows the same clump, whatever frame anchor or camera is looking, so the forest
 * never slides or reshuffles. Density follows the shared terrain biome, nothing grows under water,
 * clumps stand on the collision ground and a felled tree takes the clump above it away. Tiles are
 * built one per frame, nearest first, and released with distance. Inside the chunk radius the
 * shader collapses the clumps, where the real trees are drawn.
 */
import {
  Color, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4,
  MeshStandardNodeMaterial, Quaternion, Vector2, Vector3,
} from 'three/webgpu';
import { attribute, distance, mix, positionLocal, step, uniform } from 'three/tsl';
import { earthSurfaceChart, fixedToChart, localGeodetic, localSeaLevelY, type LocalSurfaceChart } from '../planet/LocalSurface';
import { EARTH, polarRadiusM } from '../planet/PlanetBody';
import { EARTH_VEGETATION_MIN_M, earthSolidGroundAt } from '../planet/EarthElevation';
import { earthTerrainBiome, type EarthTerrainBiome } from '../planet/EarthGroundPalette';
import type { Vec3 } from '../spatial/units';

export const EARTH_CANOPY = {
  cellM: 40,
  tileCells: 24,
  radiusM: 2_800,
  /** No clump ever stands this close to the player: crowns reach 20 m and would swallow the camera. */
  clearanceM: 64,
  /** Above this height over the ground the clumps are too small to matter; the ring colours remain. */
  maxAltitudeM: 3_000,
  tilesPerUpdate: 1,
} as const;

interface Habit { density: number; crown: readonly [number, number]; height: readonly [number, number]; colours: readonly number[] }
const HABITS: Record<EarthTerrainBiome, Habit> = {
  rainforest: { density: .82, crown: [13, 20], height: [20, 30], colours: [0x2f5a2a, 0x3d6b30, 0x2a4f25] },
  woodland: { density: .32, crown: [8, 14], height: [12, 20], colours: [0x537449, 0x68864b, 0x55683c] },
  urban: { density: .08, crown: [5, 9], height: [8, 14], colours: [0x4d6b45] },
  desert: { density: .012, crown: [3, 5], height: [3, 5], colours: [0x6f7447] },
  ice: { density: 0, crown: [1, 1], height: [1, 1], colours: [0xffffff] },
};

const MEAN_RADIUS_M = 6_371_000;
const LAT_CELL = EARTH_CANOPY.cellM / MEAN_RADIUS_M;
const ROW_SPAN = LAT_CELL * EARTH_CANOPY.tileCells;
const FLATTENING = EARTH.flattening;
const E2 = FLATTENING * (2 - FLATTENING);
const IDENTITY = new Quaternion();

/** Deterministic value in [0, 1) for a global cell and channel. */
function cellHash(i: number, j: number, channel: number): number {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(channel + 1, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const lonCellFor = (row: number) => LAT_CELL / Math.max(.05, Math.cos((row + .5) * ROW_SPAN));

export interface CanopyClump {
  readonly latRad: number;
  readonly lonRad: number;
  /** Surface-frame centre of the clump. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly crown: number;
  readonly height: number;
  readonly groundAboveSeaM: number;
  readonly colour: number;
}

/** The clumps of one geodetic tile expressed in a surface frame. Pure and deterministic. */
export function canopyTile(chart: LocalSurfaceChart, row: number, column: number): CanopyClump[] {
  const n = EARTH_CANOPY.tileCells, lonCell = lonCellFor(row);
  const clumps: CanopyClump[] = [];
  const a2 = EARTH.semiMajorAxisM ** 2, b2 = polarRadiusM(EARTH) ** 2;
  const fixed: Vec3 = [0, 0, 0], local: Vec3 = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const gi = row * n + i, gj = column * n + j;
    const latRad = (gi + .5 + (cellHash(gi, gj, 0) - .5) * .7) * LAT_CELL;
    const lonRad = (gj + .5 + (cellHash(gi, gj, 1) - .5) * .7) * lonCell;
    if (Math.abs(latRad) >= Math.PI / 2) continue;
    const ground = earthSolidGroundAt(latRad, lonRad);
    // The same line the chunk trees use: nothing grows in the water or on the beach strip.
    if (ground < EARTH_VEGETATION_MIN_M) continue;
    const habit = HABITS[earthTerrainBiome(latRad, lonRad, ground)];
    if (cellHash(gi, gj, 2) >= habit.density) continue;
    const size = cellHash(gi, gj, 3);
    const crown = habit.crown[0] + (habit.crown[1] - habit.crown[0]) * size;
    const height = habit.height[0] + (habit.height[1] - habit.height[0]) * cellHash(gi, gj, 4);
    // The radial convention of the ground field: the direction whose geodetic latitude is latRad.
    const geocentric = Math.atan((1 - E2) * Math.tan(latRad));
    const cos = Math.cos(geocentric);
    const dx = cos * Math.cos(lonRad), dy = cos * Math.sin(lonRad), dz = Math.sin(geocentric);
    const radius = 1 / Math.sqrt((dx * dx + dy * dy) / a2 + dz * dz / b2) + ground + height * .62;
    fixed[0] = dx * radius; fixed[1] = dy * radius; fixed[2] = dz * radius;
    fixedToChart(chart, fixed, local);
    clumps.push({
      latRad, lonRad, x: local[0], y: local[1], z: local[2], crown, height, groundAboveSeaM: ground,
      colour: habit.colours[Math.floor(cellHash(gi, gj, 5) * habit.colours.length)],
    });
  }
  return clumps;
}

interface Tile { mesh: InstancedMesh | null; clumps: CanopyClump[]; row: number; column: number }

export class EarthCanopyLayer {
  readonly group = new Group();
  private readonly base = new IcosahedronGeometry(1, 0);
  private readonly material = new MeshStandardNodeMaterial({ roughness: 1 });
  private readonly focus = uniform(new Vector2());
  private readonly hideRadius = uniform(0);
  private readonly tiles = new Map<string, Tile>();
  private chart: LocalSurfaceChart | null = null;
  private felled = new Map<string, { x: number; z: number }[]>();
  private felledRevision = -1;
  private instances = 0;
  private lastTileMs = 0;
  private readonly matrix = new Matrix4();
  private readonly colour = new Color();

  constructor() {
    this.group.name = 'Earth Canopy (distant forest clumps)';
    this.group.visible = false;
    // Instance transforms are applied before positionNode, so collapsing to the centre hides one.
    const centre = attribute('canopyCentre', 'vec3');
    this.material.positionNode = mix(centre, positionLocal, step(this.hideRadius, distance(centre.xz, this.focus)));
  }

  get stats() { return { visible: this.group.visible, tiles: this.tiles.size, instances: this.instances, lastTileMs: this.lastTileMs }; }
  get hiddenWithin(): { x: number; z: number; radiusM: number } {
    return { x: this.focus.value.x, z: this.focus.value.y, radiusM: this.hideRadius.value as number };
  }

  update(position: { x: number; z: number }, anchor: { latDeg: number; lonDeg: number },
    options: { altitudeAboveGroundM: number; hideRadiusM: number; tileBudget?: number }): void {
    if (!Number.isFinite(position.x + position.z + anchor.latDeg + anchor.lonDeg)) return;
    if (!this.chart || this.chart.latDeg !== anchor.latDeg || this.chart.lonDeg !== anchor.lonDeg) {
      this.clear();
      this.chart = earthSurfaceChart(anchor.latDeg, anchor.lonDeg);
    }
    this.focus.value.set(position.x, position.z);
    this.hideRadius.value = Math.max(EARTH_CANOPY.clearanceM, Number.isFinite(options.hideRadiusM) ? options.hideRadiusM : 0);
    this.group.visible = options.altitudeAboveGroundM < EARTH_CANOPY.maxAltitudeM;
    if (!this.group.visible) return;

    const wanted = this.wantedTiles(this.chart, position.x, position.z);
    const keep = new Set(wanted.map(tile => tile.key));
    for (const [key, tile] of this.tiles) {
      // A tile of hysteresis, so hovering on a boundary neither thrashes nor draws a spare ring.
      if (!keep.has(key) && this.tileDistance(tile.row, tile.column, wanted.focus) > EARTH_CANOPY.radiusM + this.tileSizeM) this.release(key);
    }
    let budget = options.tileBudget ?? EARTH_CANOPY.tilesPerUpdate;
    for (const request of wanted) {
      if (budget <= 0) break;
      if (this.tiles.has(request.key)) continue;
      this.build(this.chart, request.key, request.row, request.column);
      budget--;
    }
  }

  /** Surface-frame footprints of felled trees; clumps over them are removed. */
  setFelled(revision: number, trees: Iterable<{ x: number; z: number }>): void {
    if (revision === this.felledRevision) return;
    this.felledRevision = revision;
    this.felled = new Map();
    for (const tree of trees) {
      const key = `${Math.floor(tree.x / 64)},${Math.floor(tree.z / 64)}`;
      (this.felled.get(key) ?? this.felled.set(key, []).get(key)!).push({ x: tree.x, z: tree.z });
    }
    for (const tile of this.tiles.values()) this.writeInstances(tile);
  }

  hide(): void { this.group.visible = false; }

  clear(): void {
    for (const key of [...this.tiles.keys()]) this.release(key);
    this.felledRevision = -1;
    this.felled = new Map();
  }

  dispose(): void {
    this.clear();
    this.base.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }

  private get tileSizeM(): number { return EARTH_CANOPY.cellM * EARTH_CANOPY.tileCells; }

  private tileDistance(row: number, column: number, focus: { latRad: number; lonRad: number }): number {
    const latitude = (row + .5) * ROW_SPAN, longitude = (column + .5) * lonCellFor(row) * EARTH_CANOPY.tileCells;
    let east = longitude - focus.lonRad;
    east -= Math.round(east / (2 * Math.PI)) * 2 * Math.PI;
    return Math.hypot((latitude - focus.latRad) * MEAN_RADIUS_M, east * Math.cos(focus.latRad) * MEAN_RADIUS_M);
  }

  private wantedTiles(chart: LocalSurfaceChart, x: number, z: number) {
    const seaY = localSeaLevelY(chart, EARTH, x, z);
    const geo = localGeodetic(chart, x, Number.isFinite(seaY) ? seaY : 0, z);
    const focus = { latRad: geo.latRad, lonRad: geo.lonRad };
    const reach = EARTH_CANOPY.radiusM + this.tileSizeM * Math.SQRT1_2;
    const wanted: { key: string; row: number; column: number; distance: number }[] = [];
    const rows = Math.ceil(reach / MEAN_RADIUS_M / ROW_SPAN);
    const centreRow = Math.floor(focus.latRad / ROW_SPAN);
    for (let row = centreRow - rows; row <= centreRow + rows; row++) {
      const span = lonCellFor(row) * EARTH_CANOPY.tileCells;
      const centreColumn = Math.floor(focus.lonRad / span);
      const columns = Math.ceil(reach / (MEAN_RADIUS_M * Math.max(.05, Math.cos(focus.latRad))) / span);
      for (let column = centreColumn - columns; column <= centreColumn + columns; column++) {
        const distance = this.tileDistance(row, column, focus);
        if (distance <= reach) wanted.push({ key: `${row}:${column}`, row, column, distance });
      }
    }
    wanted.sort((a, b) => a.distance - b.distance);
    return Object.assign(wanted, { focus });
  }

  private build(chart: LocalSurfaceChart, key: string, row: number, column: number): void {
    const started = performance.now();
    const clumps = canopyTile(chart, row, column);
    const tile: Tile = { mesh: null, clumps, row, column };
    if (clumps.length) {
      const geometry = this.base.clone();
      const centres = new Float32Array(clumps.length * 3);
      clumps.forEach((clump, n) => centres.set([clump.x, clump.y, clump.z], n * 3));
      geometry.setAttribute('canopyCentre', new InstancedBufferAttribute(centres, 3));
      const mesh = new InstancedMesh(geometry, this.material, clumps.length);
      mesh.name = `canopy:${key}`;
      mesh.castShadow = false; mesh.receiveShadow = false;
      clumps.forEach((clump, n) => mesh.setColorAt(n, this.colour.setHex(clump.colour)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      tile.mesh = mesh;
      this.writeInstances(tile);
      this.group.add(mesh);
      this.instances += clumps.length;
    }
    this.tiles.set(key, tile);
    this.lastTileMs = performance.now() - started;
  }

  private writeInstances(tile: Tile): void {
    const mesh = tile.mesh;
    if (!mesh) return;
    tile.clumps.forEach((clump, n) => {
      const gone = this.isFelledUnder(clump);
      this.matrix.compose(new Vector3(clump.x, clump.y, clump.z), IDENTITY,
        gone ? new Vector3(0, 0, 0) : new Vector3(clump.crown, clump.crown * .55, clump.crown));
      mesh.setMatrixAt(n, this.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  private isFelledUnder(clump: CanopyClump): boolean {
    if (!this.felled.size) return false;
    const cx = Math.floor(clump.x / 64), cz = Math.floor(clump.z / 64);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const tree of this.felled.get(`${cx + dx},${cz + dz}`) ?? []) {
        if (Math.hypot(tree.x - clump.x, tree.z - clump.z) < clump.crown) return true;
      }
    }
    return false;
  }

  private release(key: string): void {
    const tile = this.tiles.get(key);
    if (!tile) return;
    if (tile.mesh) {
      this.group.remove(tile.mesh);
      tile.mesh.geometry.dispose();
      tile.mesh.dispose();
      this.instances -= tile.clumps.length;
    }
    this.tiles.delete(key);
  }
}
