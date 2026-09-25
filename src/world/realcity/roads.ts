import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Group, Mesh, type Material, type Vector3 } from 'three/webgpu';
import type { Collider } from '../../core/types';
import { REAL_CITY } from '../../core/config';
import { drawnByLandmark } from './ownership';

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
/**
 * Asphalt thickness, not a kerb. The ribbons only need enough separation from the ground and from
 * each other to keep junctions from fighting for depth; at the 22-34 cm this used to be, the road
 * stood knee-high on the player, who walked at ground level and appeared to wade through it.
 *
 * Exported because the traffic system has to put its cars on the same surface, and a second copy
 * of these numbers is a second thing to forget to change.
 */
export const ROAD_HEIGHT: Record<string, number> = {
  motorway: .034, trunk: .032, primary: .030, secondary: .028,
  tertiary: .026, residential: .024, living_street: .023, service: .022, unclassified: .022,
};
/** Lane paint sits this far above its own ribbon. */
export const ROAD_MARKING_LIFT = .004;
/** The highest anything road-related reaches, for whatever has to be drawn clear of it. */
export const ROAD_MAX_HEIGHT = .034 + ROAD_MARKING_LIFT;
export function roadHeightOf(klass: string): number { return ROAD_HEIGHT[klass] ?? .024; }
const MARKING = [.78, .72, .40] as const;
const TRUNK = [.30, .24, .18] as const;

function colorOf(klass: string): readonly [number, number, number] { return ROAD_COLOR[klass] ?? ROAD_COLOR.residential; }
function heightOf(klass: string): number { return roadHeightOf(klass); }

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

/** A five-sided upright box; street furniture is never seen from below. */
function post(
  out: Ribbon, x: number, y: number, z: number, width: number, height: number, depth: number,
  rgb: readonly [number, number, number], lit: number,
): void {
  const hw = width * .5, hd = depth * .5;
  const corner = (sx: number, sy: number, sz: number) => [x + hw * sx, y + height * sy, z + hd * sz];
  const faces: readonly (readonly [number[], number[], number[], number[], number[]])[] = [
    [corner(-1, 0, 1), corner(1, 0, 1), corner(1, 1, 1), corner(-1, 1, 1), [0, 0, 1]],
    [corner(1, 0, -1), corner(-1, 0, -1), corner(-1, 1, -1), corner(1, 1, -1), [0, 0, -1]],
    [corner(-1, 0, -1), corner(-1, 0, 1), corner(-1, 1, 1), corner(-1, 1, -1), [-1, 0, 0]],
    [corner(1, 0, 1), corner(1, 0, -1), corner(1, 1, -1), corner(1, 1, 1), [1, 0, 0]],
    [corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1), corner(-1, 1, -1), [0, 1, 0]],
  ];
  for (const [a, b, c, d, n] of faces) {
    for (const point of [a, b, c, a, c, d]) {
      out.position.push(point[0], point[1], point[2]);
      out.normal.push(n[0], n[1], n[2]);
      out.color.push(rgb[0], rgb[1], rgb[2]);
      out.lit.push(lit);
    }
  }
}

/** An octahedron canopy: eight triangles read as a tree crown at street distance. */
function canopy(
  out: Ribbon, x: number, y: number, z: number, radius: number, height: number,
  rgb: readonly [number, number, number],
): void {
  const top = [x, y + height, z], bottom = [x, y - height * .35, z];
  const ring = [[x + radius, y, z], [x, y, z + radius], [x - radius, y, z], [x, y, z - radius]];
  for (let i = 0; i < 4; i++) {
    const a = ring[i], b = ring[(i + 1) % 4];
    for (const [p, q, r] of [[a, b, top], [b, a, bottom]] as const) {
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2];
      const vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length; ny /= length; nz /= length;
      for (const point of [p, q, r]) {
        out.position.push(point[0], point[1], point[2]);
        out.normal.push(nx, ny, nz);
        out.color.push(rgb[0], rgb[1], rgb[2]);
        out.lit.push(0);
      }
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
  readonly colliders: Collider[] = [];
  collidersChanged = false;
  private readonly destroyed = new Map<string, Collider>();
  private readonly spans = new Map<string, { first: number; count: number }>();
  private lastDetailed = true;
  private readonly buckets = new Map<string, number[]>();
  private arterial?: Mesh;
  private local?: Mesh;
  private markings?: Mesh;
  private lamps?: Mesh;
  private lastX = Infinity;
  private lastZ = Infinity;
  /** Street furniture and markings live on their own index; scanning all 52 000 roads cost 7.8 ms. */
  private readonly furniture = new Map<string, number[]>();
  /** One rebuild stage per frame: doing all three at once cost 58 ms, a four-frame stall. */
  private pending: ('local' | 'markings' | 'lamps' | 'clear')[] = [];
  private readonly stats: RoadStats = { arterialTriangles: 0, localTriangles: 0, markingTriangles: 0 };

  /** Local streets are indexed on this grid so a rebuild touches only nearby records. */
  static readonly CELL = 512;
  static readonly LOCAL_RADIUS = 1500;
  static readonly MARKING_RADIUS = 620;
  /** Above this, lane paint and lamp posts are invisible and not worth a millisecond. */
  static readonly DETAIL_SPEED = 450;

  constructor(
    private readonly records: readonly RoadRecord[],
    private readonly material: Material,
    private readonly lampMaterial?: Material,
  ) {
    this.group.name = 'real-city-road-network';
    for (let index = 0; index < records.length; index++) {
      const road = records[index];
      const marked = ARTERIAL_CLASSES.has(road.class) || road.class === 'tertiary';
      if (marked && !drawnByLandmark(road)) this.index(this.furniture, road, index);
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

  /** Buckets a record on the uniform grid used by both the local and the furniture indexes. */
  private index(into: Map<string, number[]>, road: RoadRecord, at: number): void {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < road.p.length; i += 2) {
      const x = road.p[i], z = road.p[i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    for (let cz = Math.floor(minZ / RoadNetwork.CELL); cz <= Math.floor(maxZ / RoadNetwork.CELL); cz++) {
      for (let cx = Math.floor(minX / RoadNetwork.CELL); cx <= Math.floor(maxX / RoadNetwork.CELL); cx++) {
        const key = `${cx},${cz}`;
        const list = into.get(key);
        if (list) list.push(at); else into.set(key, [at]);
      }
    }
  }

  /** Record indices whose bounding box overlaps the query radius, without touching the rest. */
  private gather(into: Map<string, number[]>, x: number, z: number, radius: number): number[] {
    const found: number[] = [], seen = new Set<number>();
    for (let cz = Math.floor((z - radius) / RoadNetwork.CELL); cz <= Math.floor((z + radius) / RoadNetwork.CELL); cz++) {
      for (let cx = Math.floor((x - radius) / RoadNetwork.CELL); cx <= Math.floor((x + radius) / RoadNetwork.CELL); cx++) {
        const list = into.get(`${cx},${cz}`);
        if (!list) continue;
        for (const at of list) if (!seen.has(at)) { seen.add(at); found.push(at); }
      }
    }
    return found;
  }

  get triangleCount(): number { return this.stats.arterialTriangles + this.stats.localTriangles + this.stats.markingTriangles; }
  get statistics(): Readonly<RoadStats> { return this.stats; }

  private buildArterial(): void {
    const out = ribbon();
    for (const road of this.records) {
      if (!ARTERIAL_CLASSES.has(road.class) || drawnByLandmark(road)) continue;
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

  /**
   * Local streets, lane markings and street furniture are what the player can only see from close
   * up, so above cruise speed they are dropped outright rather than rebuilt every few frames. What
   * survives is staged one piece per call: the three together cost 58 ms, which is a visible stall.
   */
  update(x: number, z: number, speed = 0): void {
    this.collidersChanged = false;
    const detailed = speed < RoadNetwork.DETAIL_SPEED;
    // The dead band grows with speed: at 5 000 m/s a 320 m band fires every four frames.
    const band = detailed ? 320 : 4000;
    if (detailed !== this.lastDetailed || Math.hypot(x - this.lastX, z - this.lastZ) >= band) {
      this.lastX = x; this.lastZ = z;
      this.lastDetailed = detailed;
      this.pending = detailed ? ['local', 'markings', 'lamps'] : ['clear'];
    }
    const stage = this.pending.shift();
    if (!stage) return;
    if (stage === 'clear') {
      disposeMesh(this.local); disposeMesh(this.markings); disposeMesh(this.lamps);
      this.local = this.markings = this.lamps = undefined;
      this.stats.localTriangles = this.stats.markingTriangles = 0;
      this.colliders.length = 0; this.spans.clear(); this.collidersChanged = true;
      return;
    }
    if (stage === 'local') this.buildLocal(x, z);
    else if (stage === 'markings') this.buildMarkings(x, z);
    else this.buildLamps(x, z);
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
        if (drawnByLandmark(road)) continue;
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
    for (const at of this.gather(this.furniture, x, z, radius)) {
      const road = this.records[at];
      const y = heightOf(road.class) + ROAD_MARKING_LIFT;
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

  /** Street lighting along the real avenues, close enough that a single draw covers it. */
  private buildLamps(x: number, z: number): void {
    if (!this.lampMaterial) return;
    this.colliders.length = 0; this.spans.clear(); this.collidersChanged = true;
    const out = ribbon();
    const radius = RoadNetwork.MARKING_RADIUS, radiusSq = radius * radius;
    const mast: readonly [number, number, number] = [.24, .25, .26];
    const head: readonly [number, number, number] = [.95, .88, .70];
    for (const at of this.gather(this.furniture, x, z, radius)) {
      const road = this.records[at];
      const offset = Math.max(3, road.width) * .5 + 1.4;
      for (let i = 2; i < road.p.length; i += 2) {
        const ax = road.p[i - 2], az = road.p[i - 1], bx = road.p[i], bz = road.p[i + 1];
        const mx = (ax + bx) * .5 - x, mz = (az + bz) * .5 - z;
        if (mx * mx + mz * mz > radiusSq) continue;
        const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
        if (length < 12) continue;
        const ux = dx / length, uz = dz / length, nx = -uz, nz = ux;
        // Alternating sides every 38 m, the way an arterial is actually lit.
        for (let t = 10, side = 1; t < length - 6; t += 38, side = -side) {
          const px = ax + ux * t + nx * offset * side, pz = az + uz * t + nz * offset * side;
          const lampId = `road:lamp:${at}:${i}:${t}`, treeId = `road:tree:${at}:${i}:${t}`;
          if (!this.destroyed.has(lampId)) {
            const first = out.position.length;
            post(out, px, 0, pz, .34, 8.4, .34, mast, 0);
            post(out, px - nx * side * 1.1, 8, pz - nz * side * 1.1, 2.6, .34, .42, mast, 0);
            post(out, px - nx * side * 2, 7.55, pz - nz * side * 2, 1.15, .5, .62, head, 1);
            this.spans.set(lampId, { first, count: out.position.length - first });
            this.colliders.push({ id: lampId, x: px, y: 4.2, z: pz, width: 3, depth: 3, height: 8.4 });
          }
          // A street tree between every pair of lamps: never inside a footprint, because a road is not.
          const tx = ax + ux * (t + 19) + nx * (offset + 1.6) * -side;
          const tz = az + uz * (t + 19) + nz * (offset + 1.6) * -side;
          const tint = ((Math.abs(Math.round(tx) * 31 + Math.round(tz) * 17)) % 5) / 5;
          if (!this.destroyed.has(treeId)) {
            const first = out.position.length, height = 7 + tint * 2.5, width = 5 + tint * 2.6;
            post(out, tx, 0, tz, .42, 3.6 + tint * 1.4, .42, TRUNK, 0);
            canopy(out, tx, 4.6 + tint * 1.4, tz, 2.5 + tint * 1.3, 2.4 + tint * 1.1,
              [.20 + tint * .10, .38 + tint * .12, .19 + tint * .07]);
            this.spans.set(treeId, { first, count: out.position.length - first });
            this.colliders.push({ id: treeId, x: tx, y: height * .5, z: tz, width, depth: width, height });
          }
        }
      }
    }
    disposeMesh(this.lamps);
    this.lamps = undefined;
    const geometry = toGeometry(out);
    if (!geometry) return;
    this.lamps = new Mesh(geometry, this.lampMaterial);
    this.lamps.name = 'real-roads-lamps';
    this.lamps.castShadow = true;
    this.group.add(this.lamps);
  }

  destroy(id: string): boolean {
    if (this.destroyed.has(id)) return false;
    const index = this.colliders.findIndex(collider => collider.id === id), span = this.spans.get(id);
    if (index < 0 || !span || !this.lamps) return false;
    const attribute = this.lamps.geometry.getAttribute('position');
    if (!(attribute instanceof BufferAttribute)) return false;
    (attribute.array as Float32Array).fill(0, span.first, span.first + span.count);
    attribute.addUpdateRange(span.first, span.count); attribute.needsUpdate = true;
    this.destroyed.set(id, this.colliders[index]); this.colliders.splice(index, 1); this.collidersChanged = true;
    return true;
  }

  restore(position: Vector3, radius: number): number {
    let count = 0;
    for (const [id, box] of this.destroyed) {
      const dx = Math.max(0, Math.abs(position.x - box.x) - box.width / 2), dy = Math.max(0, Math.abs(position.y - box.y) - box.height / 2), dz = Math.max(0, Math.abs(position.z - box.z) - box.depth / 2);
      if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
      this.destroyed.delete(id); count++;
    }
    if (count && !this.pending.includes('lamps') && this.lastDetailed) this.pending.push('lamps');
    return count;
  }

  dispose(): void {
    disposeMesh(this.arterial); disposeMesh(this.local); disposeMesh(this.markings); disposeMesh(this.lamps);
    this.arterial = this.local = this.markings = this.lamps = undefined;
    this.buckets.clear();
    this.furniture.clear();
    this.pending.length = 0;
    this.colliders.length = 0; this.destroyed.clear(); this.spans.clear();
    this.group.removeFromParent();
  }
}
