import { ShapeUtils, Vector2 } from 'three/webgpu';
import type { Collider } from '../../core/types';

/** A footprint as compiled offline from Overture/OpenStreetMap, in tile-local metres. */
export interface RealBuilding {
  id: string;
  /** Height above `minH`, in metres. */
  h: number;
  minH?: number;
  /** Overture `num_floors` when the source provides it. */
  f?: number;
  /** Overture `roof_shape` when the source provides it. */
  rs?: string;
  /** Overture `roof_height` when the source provides it. */
  rh?: number;
  facade?: string;
  roof?: string;
  klass?: string;
  /** Flat `x,z` pairs relative to the tile origin. */
  p: number[];
}

export interface MeshBuffers {
  position: number[];
  normal: number[];
  color: number[];
  /** Per-vertex emissive mask: 1 marks a window pane that can light up after dark. */
  lit: number[];
}

export function createBuffers(): MeshBuffers {
  return { position: [], normal: [], color: [], lit: [] };
}

type RGB = readonly [number, number, number];
type Point = { x: number; z: number };

/** Warm renders of the painted render, tile and exposed-concrete facades common in Manaus. */
const FACADE_PALETTE: readonly RGB[] = [
  [.84, .76, .66], [.79, .70, .62], [.86, .81, .71], [.72, .70, .66], [.80, .66, .56],
  [.66, .71, .70], [.74, .78, .76], [.85, .72, .58], [.69, .65, .61], [.78, .74, .68],
  [.62, .68, .72], [.83, .78, .74], [.76, .63, .58], [.70, .74, .68], [.88, .84, .77],
];
const TERRACOTTA: readonly RGB[] = [[.60, .33, .24], [.55, .31, .23], [.64, .38, .27], [.50, .29, .24], [.58, .36, .30]];
const DECK: readonly RGB[] = [[.40, .40, .39], [.36, .36, .36], [.44, .43, .40], [.33, .34, .35]];
const GLASS: readonly RGB[] = [[.14, .18, .21], [.11, .15, .19], [.17, .21, .22], [.09, .12, .15]];

const GLASS_LIT: RGB = [.95, .74, .44];

/** FNV-1a keeps facades identical across unload, reload and worker boundaries. */
export function buildingSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A stable integer hash so a given pane keeps its state regardless of build order. */
function mix32(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function unit(seed: number, salt: number): number { return mix32(seed, salt) / 4294967296; }

function pick<T>(list: readonly T[], seed: number, salt: number): T { return list[mix32(seed, salt) % list.length]; }

function shade(rgb: RGB, factor: number): RGB { return [rgb[0] * factor, rgb[1] * factor, rgb[2] * factor]; }

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function parseHex(value: string | undefined): RGB | null {
  if (!value || !/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return null;
  const hex = value.length === 4 ? value[1] + value[1] + value[2] + value[2] + value[3] + value[3] : value.slice(1);
  const n = parseInt(hex, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

/** Winding-agnostic emit: the geometric normal is measured, then oriented against `ref`. */
function pushTri(
  buf: MeshBuffers,
  a: readonly number[], b: readonly number[], c: readonly number[],
  color: RGB, lit: number, ref: readonly number[],
): void {
  let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz);
  if (length < 1e-9) return;
  let p = b, q = c;
  if (nx * ref[0] + ny * ref[1] + nz * ref[2] < 0) { p = c; q = b; nx = -nx; ny = -ny; nz = -nz; }
  nx /= length; ny /= length; nz /= length;
  for (const point of [a, p, q]) {
    buf.position.push(point[0], point[1], point[2]);
    buf.normal.push(nx, ny, nz);
    buf.color.push(color[0], color[1], color[2]);
    buf.lit.push(lit);
  }
}

function pushQuad(
  buf: MeshBuffers,
  a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
  color: RGB, lit: number, ref: readonly number[],
): void {
  pushTri(buf, a, b, c, color, lit, ref);
  pushTri(buf, a, c, d, color, lit, ref);
}

interface Edge { ax: number; az: number; ex: number; ez: number; nx: number; nz: number; length: number }

interface Footprint {
  points: Point[];
  edges: Edge[];
  minX: number; maxX: number; minZ: number; maxZ: number;
  area: number;
  cx: number; cz: number;
}

/** Oriented bounding box: rotating calipers over the hull edges, exact enough for roofs. */
export interface OBB { cx: number; cz: number; ux: number; uz: number; halfLong: number; halfShort: number; area: number }

function orientedBox(points: readonly Point[]): OBB {
  let best: OBB | null = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const ux = dx / length, uz = dz / length;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const point of points) {
      const u = point.x * ux + point.z * uz, v = -point.x * uz + point.z * ux;
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const spanU = maxU - minU, spanV = maxV - minV, area = spanU * spanV;
    if (best && area >= best.area) continue;
    const midU = (minU + maxU) * .5, midV = (minV + maxV) * .5;
    const box = {
      cx: midU * ux - midV * uz, cz: midU * uz + midV * ux,
      ux, uz, halfLong: spanU * .5, halfShort: spanV * .5, area,
    };
    // `ux` always names the longer side so gable ridges run the length of the building.
    best = box.halfLong >= box.halfShort ? box
      : { cx: box.cx, cz: box.cz, ux: -uz, uz: ux, halfLong: box.halfShort, halfShort: box.halfLong, area };
  }
  return best ?? { cx: 0, cz: 0, ux: 1, uz: 0, halfLong: .5, halfShort: .5, area: 1 };
}

/** Rings arrive clockwise from the projection; every consumer here works from one orientation. */
function readFootprint(flat: readonly number[]): Footprint | null {
  if (flat.length < 6) return null;
  const points: Point[] = [];
  for (let i = 0; i < flat.length; i += 2) points.push({ x: flat[i], z: flat[i + 1] });
  const last = points[points.length - 1];
  if (points.length > 3 && Math.hypot(last.x - points[0].x, last.z - points[0].z) < .01) points.pop();
  if (points.length < 3) return null;

  let signed = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    signed += a.x * b.z - b.x * a.z;
    if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
    if (a.z < minZ) minZ = a.z; if (a.z > maxZ) maxZ = a.z;
  }
  if (signed < 0) points.reverse();
  const area = Math.abs(signed) * .5;
  if (area < 1) return null;

  // Counter-clockwise from here, so the outward normal of edge a→b is (dz, -dx).
  const edges: Edge[] = [];
  let cx = 0, cz = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < .05) continue;
    edges.push({ ax: a.x, az: a.z, ex: dx / length, ez: dz / length, nx: dz / length, nz: -dx / length, length });
    cx += a.x; cz += a.z;
  }
  if (edges.length < 3) return null;
  return { points, edges, minX, maxX, minZ, maxZ, area, cx: cx / edges.length, cz: cz / edges.length };
}

export type RoofShape = 'flat' | 'hipped' | 'gabled' | 'pyramidal' | 'terrace';

const EXPLICIT_ROOF: Record<string, RoofShape> = {
  flat: 'flat', hipped: 'hipped', gabled: 'gabled', gambrel: 'gabled', half_hipped: 'hipped',
  pyramidal: 'pyramidal', skillion: 'gabled', mansard: 'hipped', dome: 'pyramidal', round: 'hipped',
  onion: 'pyramidal', spherical: 'pyramidal', cone: 'pyramidal', sawtooth: 'flat', terrace: 'terrace',
};

/**
 * Overture publishes `roof_shape` for a vanishing fraction of Manaus, so the shape is chosen
 * deterministically from footprint size, slenderness and height. Nothing is ever left open.
 */
export function roofShapeFor(building: RealBuilding, footprint: Footprint, obb: OBB, seed: number): RoofShape {
  const explicit = building.rs ? EXPLICIT_ROOF[building.rs.toLowerCase()] : undefined;
  if (explicit) return explicit;
  const klass = (building.klass ?? '').toLowerCase();
  if (klass.includes('church') || klass.includes('chapel') || klass.includes('temple')) return 'pyramidal';
  if (klass.includes('industrial') || klass.includes('warehouse') || klass.includes('retail')) return 'flat';
  const height = building.h, area = footprint.area;
  if (height > 22 || area > 2600) return area > 5000 ? 'flat' : 'terrace';
  // A rectangular plan can carry a ridge; anything notched or L-shaped gets a hip that follows it.
  const rectangular = area / Math.max(1, obb.area) > .82;
  const slender = obb.halfLong / Math.max(.5, obb.halfShort);
  if (height < 6.5 && area < 320) return rectangular && slender > 1.25 ? 'gabled' : 'hipped';
  if (height < 12 && area < 900) {
    const roll = unit(seed, 11);
    if (roll < .42 && rectangular && slender > 1.2) return 'gabled';
    return roll < .78 ? 'hipped' : 'flat';
  }
  return unit(seed, 12) < .22 ? 'terrace' : 'flat';
}

function roofRise(shape: RoofShape, building: RealBuilding, obb: OBB): number {
  if (building.rh && building.rh > 0) return Math.min(12, building.rh);
  if (shape === 'pyramidal') return Math.min(9, Math.max(2.4, obb.halfShort * 1.15));
  if (shape === 'gabled' || shape === 'hipped') return Math.min(4.8, Math.max(1.5, obb.halfShort * .58));
  return 0;
}

function colliderFor(building: RealBuilding, footprint: Footprint, minH: number, height: number): Collider {
  return {
    x: (footprint.minX + footprint.maxX) * .5,
    y: minH + height * .5,
    z: (footprint.minZ + footprint.maxZ) * .5,
    width: Math.max(.6, footprint.maxX - footprint.minX),
    height,
    depth: Math.max(.6, footprint.maxZ - footprint.minZ),
    id: `real:${building.id}`,
  };
}

function appendRoof(
  buf: MeshBuffers, footprint: Footprint, obb: OBB, top: number,
  shape: RoofShape, deckColor: RGB, pitchedColor: RGB, trim: RGB, seed: number, rise: number,
): void {
  // The deck is emitted for every shape, so a pitched roof can never reveal an open interior.
  const triangles = ShapeUtils.triangulateShape(footprint.points.map(p => new Vector2(p.x, p.z)), []);
  const deck = shape === 'flat' || shape === 'terrace' ? deckColor : shade(pitchedColor, .55);
  for (const [ia, ib, ic] of triangles) {
    const a = footprint.points[ia], b = footprint.points[ib], c = footprint.points[ic];
    pushTri(buf, [a.x, top, a.z], [b.x, top, b.z], [c.x, top, c.z], deck, 0, [0, 1, 0]);
  }

  if (shape === 'flat' || shape === 'terrace') {
    const parapet = .55 + unit(seed, 21) * .65;
    for (const edge of footprint.edges) {
      const bx = edge.ax + edge.ex * edge.length, bz = edge.az + edge.ez * edge.length;
      const ox = edge.nx * .10, oz = edge.nz * .10;
      const ix = -edge.nx * .16, iz = -edge.nz * .16;
      const ref = [edge.nx, 0, edge.nz];
      pushQuad(buf,
        [edge.ax + ox, top, edge.az + oz], [edge.ax + ox, top + parapet, edge.az + oz],
        [bx + ox, top + parapet, bz + oz], [bx + ox, top, bz + oz], trim, 0, ref);
      pushQuad(buf,
        [edge.ax + ix, top, edge.az + iz], [edge.ax + ix, top + parapet, edge.az + iz],
        [bx + ix, top + parapet, bz + iz], [bx + ix, top, bz + iz], shade(trim, .74), 0, [-edge.nx, 0, -edge.nz]);
      pushQuad(buf,
        [edge.ax + ox, top + parapet, edge.az + oz], [bx + ox, top + parapet, bz + oz],
        [bx + ix, top + parapet, bz + iz], [edge.ax + ix, top + parapet, edge.az + iz], shade(trim, 1.06), 0, [0, 1, 0]);
    }
    if (shape === 'terrace') {
      // A stair head and water tank read as the rooftop clutter of Manaus slab blocks.
      const w = Math.min(7, Math.max(2.4, obb.halfShort * .7)), d = Math.min(7, Math.max(2.4, obb.halfLong * .32));
      const hutHeight = 2.5 + unit(seed, 22) * 1.3;
      appendBox(buf, obb.cx, top, obb.cz, w, hutHeight, d, obb.ux, obb.uz, shade(deckColor, 1.18), trim);
    }
    return;
  }

  if (shape === 'hipped' || shape === 'pyramidal') {
    const apex = [footprint.cx, top + rise, footprint.cz];
    for (const edge of footprint.edges) {
      const bx = edge.ax + edge.ex * edge.length, bz = edge.az + edge.ez * edge.length;
      pushTri(buf, [edge.ax, top, edge.az], [bx, top, bz], apex, pitchedColor, 0, [edge.nx * .5, .8, edge.nz * .5]);
    }
    return;
  }

  // Gabled: the ridge runs along the oriented box's long axis, matching how the block is built.
  const { cx, cz, ux, uz, halfLong, halfShort } = obb;
  const vx = -uz, vz = ux;
  const corner = (su: number, sv: number, y: number) => [cx + ux * halfLong * su + vx * halfShort * sv, y, cz + uz * halfLong * su + vz * halfShort * sv];
  const r1 = [cx - ux * halfLong, top + rise, cz - uz * halfLong];
  const r2 = [cx + ux * halfLong, top + rise, cz + uz * halfLong];
  pushQuad(buf, corner(-1, -1, top), corner(1, -1, top), r2, r1, pitchedColor, 0, [-vx * .6, .8, -vz * .6]);
  pushQuad(buf, corner(-1, 1, top), corner(1, 1, top), r2, r1, pitchedColor, 0, [vx * .6, .8, vz * .6]);
  pushTri(buf, corner(-1, -1, top), corner(-1, 1, top), r1, shade(pitchedColor, .86), 0, [-ux, .2, -uz]);
  pushTri(buf, corner(1, -1, top), corner(1, 1, top), r2, shade(pitchedColor, .86), 0, [ux, .2, uz]);
}

/** A five-sided box aligned to an arbitrary axis; the base is never visible. */
function appendBox(
  buf: MeshBuffers, x: number, y: number, z: number, width: number, height: number, depth: number,
  ux: number, uz: number, side: RGB, top: RGB,
): void {
  const vx = -uz, vz = ux;
  const point = (su: number, sv: number, sy: number) => [
    x + ux * width * .5 * su + vx * depth * .5 * sv, y + height * sy, z + uz * width * .5 * su + vz * depth * .5 * sv,
  ];
  pushQuad(buf, point(-1, -1, 0), point(-1, -1, 1), point(1, -1, 1), point(1, -1, 0), side, 0, [-vx, 0, -vz]);
  pushQuad(buf, point(-1, 1, 0), point(-1, 1, 1), point(1, 1, 1), point(1, 1, 0), side, 0, [vx, 0, vz]);
  pushQuad(buf, point(-1, -1, 0), point(-1, -1, 1), point(-1, 1, 1), point(-1, 1, 0), shade(side, .9), 0, [-ux, 0, -uz]);
  pushQuad(buf, point(1, -1, 0), point(1, -1, 1), point(1, 1, 1), point(1, 1, 0), shade(side, .9), 0, [ux, 0, uz]);
  pushQuad(buf, point(-1, -1, 1), point(1, -1, 1), point(1, 1, 1), point(-1, 1, 1), top, 0, [0, 1, 0]);
}

export interface NearOptions {
  /** Windows, balconies and air-conditioning units are skipped below this height budget. */
  detail?: boolean;
}

/**
 * Near LOD: plinth, storey-divided facade, recessed window panes that light at night,
 * cornice, optional balconies and air-conditioning units, and a closed roof.
 */
export function appendNearBuilding(buf: MeshBuffers, building: RealBuilding, options: NearOptions = {}): Collider | null {
  const footprint = readFootprint(building.p);
  if (!footprint) return null;
  const seed = buildingSeed(building.id);
  const minH = Math.max(0, building.minH ?? 0);
  const height = Math.max(2.6, building.h);
  const top = minH + height;
  const obb = orientedBox(footprint.points);

  const klass = (building.klass ?? '').toLowerCase();
  const residential = klass.includes('residential') || klass.includes('apart') || klass.includes('house') || !klass;
  const base = parseHex(building.facade) ?? pick(FACADE_PALETTE, seed, 1);
  // Weathering keeps neighbouring blocks from reading as a single painted wall.
  const facade = shade(base, .86 + unit(seed, 2) * .26);
  const plinth = mixRGB(shade(facade, .62), [.38, .37, .36], .45);
  const trim = mixRGB(facade, [1, 1, 1], .30);
  const glass = pick(GLASS, seed, 3);
  const pitched = parseHex(building.roof) ?? pick(TERRACOTTA, seed, 4);
  const deckColor = parseHex(building.roof) ?? pick(DECK, seed, 5);

  const shape = roofShapeFor(building, footprint, obb, seed);
  const floorHeight = 2.95 + unit(seed, 6) * .75;
  const floors = Math.max(1, Math.min(60, building.f && building.f > 0 ? Math.round(building.f) : Math.round(height / floorHeight)));
  const storey = height / floors;
  const plinthTop = Math.min(minH + height * .45, minH + (floors > 1 ? Math.min(3.4, storey * .95) : height * .34));
  const corniceHeight = Math.min(.85, height * .07);
  const detail = options.detail !== false && height > 3.2;
  const longest = footprint.edges.reduce((best, edge) => edge.length > best ? edge.length : best, 0);

  for (let index = 0; index < footprint.edges.length; index++) {
    const edge = footprint.edges[index];
    const ref = [edge.nx, 0, edge.nz];
    const bx = edge.ax + edge.ex * edge.length, bz = edge.az + edge.ez * edge.length;
    const at = (t: number, y: number, offset: number) => [
      edge.ax + edge.ex * t + edge.nx * offset, y, edge.az + edge.ez * t + edge.nz * offset,
    ];

    // Backing wall, then the plinth and cornice sit proud of it so they never z-fight.
    pushQuad(buf, [edge.ax, minH, edge.az], [edge.ax, top, edge.az], [bx, top, bz], [bx, minH, bz], facade, 0, ref);
    pushQuad(buf, at(0, minH, .09), at(0, plinthTop, .09), at(edge.length, plinthTop, .09), at(edge.length, minH, .09), plinth, 0, ref);
    pushQuad(buf, at(0, plinthTop, .09), at(edge.length, plinthTop, .09), at(edge.length, plinthTop, -.01), at(0, plinthTop, -.01), shade(plinth, 1.12), 0, [0, 1, 0]);
    if (corniceHeight > .2) {
      pushQuad(buf, at(0, top - corniceHeight, .14), at(0, top, .14), at(edge.length, top, .14), at(edge.length, top - corniceHeight, .14), trim, 0, ref);
      pushQuad(buf, at(0, top, .14), at(edge.length, top, .14), at(edge.length, top, -.01), at(0, top, -.01), shade(trim, 1.05), 0, [0, 1, 0]);
    }

    if (!detail || edge.length < 2.2) continue;

    const bayWidth = 2.5 + unit(seed, 7) * 1.2;
    const bays = Math.max(1, Math.min(14, Math.floor(edge.length / bayWidth)));
    const pitch = edge.length / bays;
    const paneWidth = Math.min(pitch * .62, 2.1);
    const firstFloor = plinthTop > minH + storey * .6 ? 1 : 0;
    // A door breaks the plinth on the longest street-facing wall.
    if (edge.length === longest && plinthTop > minH + 1.9) {
      const doorWidth = Math.min(2.3, pitch * .5), doorTop = Math.min(plinthTop - .2, minH + 2.25);
      const start = edge.length * .5 - doorWidth * .5;
      pushQuad(buf, at(start, minH, .11), at(start, doorTop, .11), at(start + doorWidth, doorTop, .11), at(start + doorWidth, minH, .11), shade(glass, 1.25), 0, ref);
    }

    for (let floor = firstFloor; floor < floors; floor++) {
      const sill = minH + floor * storey + storey * .30;
      const head = minH + floor * storey + storey * .82;
      if (head > top - corniceHeight - .12 || head - sill < .5) continue;
      for (let bay = 0; bay < bays; bay++) {
        const start = bay * pitch + (pitch - paneWidth) * .5;
        const lit = unit(mix32(seed, index * 977 + bay * 31), floor * 7 + 3) < .34 ? 1 : 0;
        const pane = lit ? mixRGB(glass, GLASS_LIT, .35) : glass;
        pushQuad(buf, at(start, sill, .05), at(start, head, .05), at(start + paneWidth, head, .05), at(start + paneWidth, sill, .05), pane, lit, ref);
        // A shallow reveal gives the pane a shadow line instead of a painted-on rectangle.
        pushQuad(buf, at(start, head, .05), at(start + paneWidth, head, .05), at(start + paneWidth, head, .13), at(start, head, .13), shade(trim, .72), 0, [0, 1, 0]);
      }
    }

    // Balconies belong to slender residential slabs and only face the two widest walls.
    if (residential && floors > 3 && edge.length > longest * .6 && edge.length > 7 && unit(seed, 8 + index) < .55) {
      const inset = Math.min(1.6, edge.length * .12), slabWidth = edge.length - inset * 2;
      for (let floor = Math.max(1, firstFloor); floor < floors; floor++) {
        const y = minH + floor * storey + storey * .06;
        if (y > top - corniceHeight - .5) break;
        pushQuad(buf, at(inset, y, 1.05), at(inset + slabWidth, y, 1.05), at(inset + slabWidth, y, .02), at(inset, y, .02), shade(trim, .94), 0, [0, 1, 0]);
        pushQuad(buf, at(inset, y, 1.05), at(inset, y + .95, 1.05), at(inset + slabWidth, y + .95, 1.05), at(inset + slabWidth, y, 1.05), shade(trim, .88), 0, ref);
      }
    }

    if (residential && detail && floors > 1 && edge.length > 5 && unit(seed, 40 + index) < .45) {
      const units = Math.min(3, Math.max(1, Math.floor(floors / 3)));
      for (let n = 0; n < units; n++) {
        const floor = 1 + (mix32(seed, 50 + index * 13 + n) % Math.max(1, floors - 1));
        const t = edge.length * ((mix32(seed, 60 + n) % 100) / 100 * .7 + .15);
        const y = minH + floor * storey + storey * .34;
        if (y > top - corniceHeight - 1) continue;
        pushQuad(buf, at(t - .45, y, .55), at(t - .45, y + .55, .55), at(t + .45, y + .55, .55), at(t + .45, y, .55), [.62, .63, .61], 0, ref);
        pushQuad(buf, at(t - .45, y + .55, .55), at(t + .45, y + .55, .55), at(t + .45, y + .55, .06), at(t - .45, y + .55, .06), [.70, .71, .69], 0, [0, 1, 0]);
      }
    }
  }

  appendRoof(buf, footprint, obb, top, shape, deckColor, pitched, trim, seed, roofRise(shape, building, obb));
  return colliderFor(building, footprint, minH, height);
}

/**
 * Medium LOD: real footprints with a flat facade colour and a closed roof, no panes or fittings.
 * One order of magnitude cheaper than the near tier and still recognisably the same block.
 */
export function appendShellBuilding(buf: MeshBuffers, building: RealBuilding): Collider | null {
  const footprint = readFootprint(building.p);
  if (!footprint) return null;
  const seed = buildingSeed(building.id);
  const minH = Math.max(0, building.minH ?? 0);
  const height = Math.max(2.6, building.h);
  const top = minH + height;
  const base = parseHex(building.facade) ?? pick(FACADE_PALETTE, seed, 1);
  const facade = shade(base, .86 + unit(seed, 2) * .26);
  const obb = orientedBox(footprint.points);
  const shape = roofShapeFor(building, footprint, obb, seed);
  const pitched = parseHex(building.roof) ?? pick(TERRACOTTA, seed, 4);
  const deckColor = parseHex(building.roof) ?? pick(DECK, seed, 5);

  for (const edge of footprint.edges) {
    const bx = edge.ax + edge.ex * edge.length, bz = edge.az + edge.ez * edge.length;
    // A darker band at street level keeps the shell from reading as a single flat prism.
    const plinthTop = Math.min(top, minH + Math.min(3, height * .3));
    pushQuad(buf, [edge.ax, plinthTop, edge.az], [edge.ax, top, edge.az], [bx, top, bz], [bx, plinthTop, bz], facade, 0, [edge.nx, 0, edge.nz]);
    pushQuad(buf, [edge.ax, minH, edge.az], [edge.ax, plinthTop, edge.az], [bx, plinthTop, bz], [bx, minH, bz], shade(facade, .74), 0, [edge.nx, 0, edge.nz]);
  }

  const simple: RoofShape = shape === 'terrace' ? 'flat' : shape === 'gabled' ? 'gabled' : shape === 'pyramidal' ? 'pyramidal' : shape === 'hipped' ? 'hipped' : 'flat';
  if (simple === 'flat') {
    const triangles = ShapeUtils.triangulateShape(footprint.points.map(p => new Vector2(p.x, p.z)), []);
    for (const [ia, ib, ic] of triangles) {
      const a = footprint.points[ia], b = footprint.points[ib], c = footprint.points[ic];
      pushTri(buf, [a.x, top, a.z], [b.x, top, b.z], [c.x, top, c.z], deckColor, 0, [0, 1, 0]);
    }
  } else {
    appendRoof(buf, footprint, obb, top, simple, deckColor, pitched, facade, seed, roofRise(simple, building, obb));
  }
  return colliderFor(building, footprint, minH, height);
}

/** Every representation shares one footprint reader, so extents agree across tiers. */
export function buildingExtent(building: RealBuilding): { x: number; z: number; radius: number; top: number } | null {
  const footprint = readFootprint(building.p);
  if (!footprint) return null;
  const x = (footprint.minX + footprint.maxX) * .5, z = (footprint.minZ + footprint.maxZ) * .5;
  return {
    x, z,
    radius: Math.hypot(footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ) * .5,
    top: Math.max(0, building.minH ?? 0) + Math.max(2.6, building.h),
  };
}

export const __testing = { readFootprint, orientedBox, parseHex };
