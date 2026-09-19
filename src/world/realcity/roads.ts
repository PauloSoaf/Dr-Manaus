import { BufferGeometry, Float32BufferAttribute, Group, Mesh, type Material } from 'three/webgpu';

export interface RoadRecord {
  class: string;
  width: number;
  /** Flat `x,z` pairs in world metres. */
  p: number[];
  name?: string;
}

/** Arterials carry the city's shape and stay visible to the horizon; local streets stream. */
export const ARTERIAL_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary']);

const ROAD_COLOR: Record<string, readonly [number, number, number]> = {
  motorway: [.19, .21, .22], trunk: [.20, .22, .23], primary: [.22, .24, .25], secondary: [.24, .26, .26],
  tertiary: [.27, .28, .27], residential: [.30, .30, .29], living_street: [.31, .31, .29],
  service: [.28, .28, .27], unclassified: [.28, .28, .27],
};
/** A small stagger by class stops overlapping ribbons from fighting for depth at junctions. */
const ROAD_HEIGHT: Record<string, number> = {
  motorway: .34, trunk: .32, primary: .30, secondary: .28,
  tertiary: .26, residential: .24, living_street: .23, service: .22, unclassified: .22,
};
const MARKING = [.78, .72, .40] as const;

function colorOf(klass: string): readonly [number, number, number] { return ROAD_COLOR[klass] ?? ROAD_COLOR.residential; }
function heightOf(klass: string): number { return ROAD_HEIGHT[klass] ?? .24; }

interface Ribbon { position: number[]; normal: number[]; color: number[]; lit: number[] }

function ribbon(): Ribbon { return { position: [], normal: [], color: [], lit: [] }; }

function strip(
  out: Ribbon, ax: number, az: number, bx: number, bz: number,
  halfWidth: number, y: number, rgb: readonly [number, number, number], extend: number,
): void {
  const dx = bx - ax, dz = bz - az;
  const length = Math.hypot(dx, dz);
  if (length < .35) return;
  const ux = dx / length, uz = dz / length;
  // Overshooting each end by half a lane closes the wedge left at bends without mitre maths.
  const sx = ax - ux * extend, sz = az - uz * extend;
  const ex = bx + ux * extend, ez = bz + uz * extend;
  const nx = -uz * halfWidth, nz = ux * halfWidth;
  const corners = [
    [sx + nx, y, sz + nz], [ex + nx, y, ez + nz], [ex - nx, y, ez - nz], [sx - nx, y, sz - nz],
  ];
  for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]] as const) {
    for (const index of [a, b, c]) {
      const point = corners[index];
      out.position.push(point[0], point[1], point[2]);
      out.normal.push(0, 1, 0);
      out.color.push(rgb[0], rgb[1], rgb[2]);
      out.lit.push(0);
    }
  }
}

function toGeometry(out: Ribbon): BufferGeometry | null {
  if (!out.position.length) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(out.position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(out.normal, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(out.color, 3));
  geometry.setAttribute('lit', new Float32BufferAttribute(out.lit, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function disposeMesh(mesh: Mesh | undefined): void {
  if (!mesh) return;
  mesh.removeFromParent();
  mesh.geometry.dispose();
}

export interface RoadStats { arterialTriangles: number; localTriangles: number; markingTriangles: number }

/**
 * Three draw calls hold every real street in Manaus: the arterial network in full, the local
 * streets around the player, and lane markings only where they can actually be read.
 */
export class RoadNetwork {
  readonly group = new Group();
  private readonly buckets = new Map<string, number[]>();
  private arterial?: Mesh;
  private local?: Mesh;
  private markings?: Mesh;
  private lastX = Infinity;
  private lastZ = Infinity;
  private readonly stats: RoadStats = { arterialTriangles: 0, localTriangles: 0, markingTriangles: 0 };

  /** Local streets are indexed on this grid so a rebuild touches only nearby records. */
  static readonly CELL = 512;
  static readonly LOCAL_RADIUS = 1500;
  static readonly MARKING_RADIUS = 620;

  constructor(private readonly records: readonly RoadRecord[], private readonly material: Material) {
    this.group.name = 'real-city-road-network';
    for (let index = 0; index < records.length; index++) {
      const road = records[index];
      if (ARTERIAL_CLASSES.has(road.class)) continue;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < road.p.length; i += 2) {
        const x = road.p[i], z = road.p[i + 1];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      for (let cz = Math.floor(minZ / RoadNetwork.CELL); cz <= Math.floor(maxZ / RoadNetwork.CELL); cz++) {
        for (let cx = Math.floor(minX / RoadNetwork.CELL); cx <= Math.floor(maxX / RoadNetwork.CELL); cx++) {
          const key = `${cx},${cz}`;
          const list = this.buckets.get(key);
          if (list) list.push(index); else this.buckets.set(key, [index]);
        }
      }
    }
    this.buildArterial();
  }

  get triangleCount(): number { return this.stats.arterialTriangles + this.stats.localTriangles + this.stats.markingTriangles; }
  get statistics(): Readonly<RoadStats> { return this.stats; }

  private buildArterial(): void {
    const out = ribbon();
    for (const road of this.records) {
      if (!ARTERIAL_CLASSES.has(road.class)) continue;
      const half = Math.max(3, road.width) * .5, y = heightOf(road.class), rgb = colorOf(road.class);
      for (let i = 2; i < road.p.length; i += 2) {
        strip(out, road.p[i - 2], road.p[i - 1], road.p[i], road.p[i + 1], half, y, rgb, half * .9);
      }
    }
    const geometry = toGeometry(out);
    if (!geometry) return;
    this.arterial = new Mesh(geometry, this.material);
    this.arterial.name = 'real-roads-arterial';
    this.arterial.receiveShadow = true;
    this.stats.arterialTriangles = out.position.length / 9;
    this.group.add(this.arterial);
  }

  update(x: number, z: number): void {
    // A 320 m dead band keeps a fast traversal from rebuilding the local network every frame.
    if (Math.hypot(x - this.lastX, z - this.lastZ) < 320) return;
    this.lastX = x; this.lastZ = z;
    this.buildLocal(x, z);
    this.buildMarkings(x, z);
  }

  private buildLocal(x: number, z: number): void {
    const out = ribbon();
    const radius = RoadNetwork.LOCAL_RADIUS, radiusSq = radius * radius;
    const seen = new Set<number>();
    const minCell = Math.floor((x - radius) / RoadNetwork.CELL), maxCell = Math.floor((x + radius) / RoadNetwork.CELL);
    const minCellZ = Math.floor((z - radius) / RoadNetwork.CELL), maxCellZ = Math.floor((z + radius) / RoadNetwork.CELL);
    for (let cz = minCellZ; cz <= maxCellZ; cz++) for (let cx = minCell; cx <= maxCell; cx++) {
      const list = this.buckets.get(`${cx},${cz}`);
      if (!list) continue;
      for (const index of list) {
        if (seen.has(index)) continue;
        seen.add(index);
        const road = this.records[index];
        const half = Math.max(3, road.width) * .5, y = heightOf(road.class), rgb = colorOf(road.class);
        for (let i = 2; i < road.p.length; i += 2) {
          const ax = road.p[i - 2], az = road.p[i - 1], bx = road.p[i], bz = road.p[i + 1];
          const mx = (ax + bx) * .5 - x, mz = (az + bz) * .5 - z;
          if (mx * mx + mz * mz > radiusSq) continue;
          strip(out, ax, az, bx, bz, half, y, rgb, half * .9);
        }
      }
    }
    disposeMesh(this.local);
    this.local = undefined;
    this.stats.localTriangles = out.position.length / 9;
    const geometry = toGeometry(out);
    if (!geometry) return;
    this.local = new Mesh(geometry, this.material);
    this.local.name = 'real-roads-local';
    this.local.receiveShadow = true;
    this.group.add(this.local);
  }

  private buildMarkings(x: number, z: number): void {
    const out = ribbon();
    const radius = RoadNetwork.MARKING_RADIUS, radiusSq = radius * radius;
    for (const road of this.records) {
      if (!ARTERIAL_CLASSES.has(road.class) && road.class !== 'tertiary') continue;
      const y = heightOf(road.class) + .012;
      for (let i = 2; i < road.p.length; i += 2) {
        const ax = road.p[i - 2], az = road.p[i - 1], bx = road.p[i], bz = road.p[i + 1];
        const mx = (ax + bx) * .5 - x, mz = (az + bz) * .5 - z;
        if (mx * mx + mz * mz > radiusSq) continue;
        const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
        if (length < 3) continue;
        const ux = dx / length, uz = dz / length;
        // Broken centre line: 3 m of paint every 9 m, the way an urban arterial is striped.
        for (let t = 0; t + 3 < length; t += 9) {
          strip(out, ax + ux * t, az + uz * t, ax + ux * (t + 3), az + uz * (t + 3), .16, y, MARKING, 0);
        }
      }
    }
    disposeMesh(this.markings);
    this.markings = undefined;
    this.stats.markingTriangles = out.position.length / 9;
    const geometry = toGeometry(out);
    if (!geometry) return;
    this.markings = new Mesh(geometry, this.material);
    this.markings.name = 'real-roads-markings';
    this.group.add(this.markings);
  }

  dispose(): void {
    disposeMesh(this.arterial); disposeMesh(this.local); disposeMesh(this.markings);
    this.arterial = this.local = this.markings = undefined;
    this.buckets.clear();
    this.group.removeFromParent();
  }
}
