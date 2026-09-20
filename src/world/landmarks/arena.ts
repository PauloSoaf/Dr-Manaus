import { BoxGeometry, CylinderGeometry, Group, TorusGeometry } from 'three/webgpu';
import { GeometryBatch, palm, type PaletteKey } from './GeometryBatch';

/**
 * Arena da Amazônia at the surveyed Overture footprint: an ellipse with the pitch on the long
 * axis, wrapped in the woven steel basket that gives the building its name and capped by a roof
 * ring left open over the grass. Every constant below is metres of the real structure.
 */
const SHELL_X = 99, SHELL_Z = 126, BOWL_X = 93, BOWL_Z = 116, BOWL_TOP = 31, ROOF_Y = 45;
const PODIUM_X = 148, PODIUM_Z = 178, PODIUM_Y = 3;
/** Roof opening: wide enough to leave the pitch uncovered, tight enough to shelter every seat. */
const ROOF_IN_X = 59, ROOF_IN_Z = 83, ROOF_DEPTH = 46;
const RIBS = 46, LEAN = Math.PI * 2 / RIBS * 3, TIERS = 7;

export interface LandmarkBox { x: number; y: number; z: number; width: number; height: number; depth: number; id?: string }

/** Boxes laid tangent to the ellipse: `depth` runs radially, so a ring reads as one solid band. */
function band(b: GeometryBatch, mat: PaletteKey, ax: number, bz: number, y: number, height: number, depth: number, count: number, overlap = 1.12): void {
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count * Math.PI * 2;
    const tx = -Math.sin(t) * ax, tz = Math.cos(t) * bz;
    const span = Math.hypot(tx, tz) * Math.PI * 2 / count * overlap;
    b.box(mat, Math.cos(t) * ax, y, Math.sin(t) * bz, span, height, depth, Math.atan2(-tz, tx));
  }
}

/** One flat steel member. The real ribs are welded plates, so a tilted box beats a cylinder here. */
function member(b: GeometryBatch, mat: PaletteKey, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, thickness: number, depth: number): void {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, flat = Math.hypot(dx, dz);
  // Pre-tilting the geometry lets `add` apply the yaw after it, which its X-Y-Z order cannot.
  const geometry = new BoxGeometry(Math.hypot(flat, dy), thickness, depth).rotateZ(Math.atan2(dy, flat));
  b.add(geometry, mat, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, 0, Math.atan2(-dz, dx));
}

/** The basket is not a straight cone: it swells at mid height and tucks back in under the roof. */
function bulge(v: number): number { return 1 + Math.sin(v * Math.PI) * .055; }

/** Two mirrored families of leaning ribs cross at mid height; that crossing is the whole building. */
function basket(b: GeometryBatch): void {
  for (let i = 0; i < RIBS; i++) {
    const base = i / RIBS * Math.PI * 2;
    for (const rise of [0, 1]) for (let s = 0; s < 3; s++) {
      const v0 = s / 3, v1 = (s + 1) / 3;
      const a0 = base + LEAN * (rise ? v0 : 1 - v0), a1 = base + LEAN * (rise ? v1 : 1 - v1);
      const r0 = bulge(v0), r1 = bulge(v1);
      member(b, rise ? 'white' : 'cream',
        Math.cos(a0) * SHELL_X * r0, 2.4 + v0 * (ROOF_Y - 2.4), Math.sin(a0) * SHELL_Z * r0,
        Math.cos(a1) * SHELL_X * r1, 2.4 + v1 * (ROOF_Y - 2.4), Math.sin(a1) * SHELL_Z * r1, 1.5, 3.4);
    }
  }
  for (const v of [.34, .67]) band(b, 'white', SHELL_X * bulge(v) + .4, SHELL_Z * bulge(v) + .4, 2.4 + v * (ROOF_Y - 2.4), .9, 2.2, RIBS);
}

/** Cardinal entrance, built in a local frame where +Z points out of the bowl. */
function portal(b: GeometryBatch, yaw: number, reach: number): void {
  const ux = Math.cos(yaw), uz = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
  const put = (mat: PaletteKey, lx: number, y: number, lz: number, w: number, h: number, d: number) =>
    b.box(mat, ux * lx + nx * lz, y, uz * lx + nz * lz, w, h, d, yaw);
  put('dark', 0, 9.5, reach - 4, 26, 19, 12);
  put('white', 0, 20, reach - 1, 36, 3, 18);
  for (const lx of [-16, 16]) put('white', lx, 10.5, reach - 1, 4.5, 21, 16);
  put('light', 0, 18.4, reach + 6.5, 24, .5, .7);
  // The concourse outside the portal is already the podium deck, so these steps only lift the door.
  put('stone', 0, PODIUM_Y + .18, reach + 9, 34, .36, 22);
  for (let step = 0; step < 3; step++) put('cream', 0, PODIUM_Y + .25 + step * .35, reach + 4.4 - step * 1.4, 28, .5, 1.6);
}

/** Pitch, mowing stripes and the markings that make the bowl read as a stadium from the air. */
function pitch(b: GeometryBatch): void {
  b.box('leaf', 0, .55, 0, 78, .3, 118);
  for (let i = -5; i <= 5; i += 2) b.box('leafLight', 0, .68, i * 10.5, 68, .04, 10.5);
  const line = (x: number, z: number, w: number, d: number) => b.box('white', x, .72, z, w, .05, d);
  line(0, 0, 68, .3);
  for (const x of [-34, 34]) line(x, 0, .3, 105);
  for (const side of [-1, 1]) {
    line(0, side * 52.5, 68, .3);
    line(0, side * 36, 40.3, .3);
    for (const x of [-20.15, 20.15]) line(x, side * 44.25, .3, 16.5);
    line(0, side * 47, 18.32, .3);
    for (const x of [-9.16, 9.16]) line(x, side * 49.75, .3, 5.5);
    line(0, side * 41.5, .7, .7);
    b.box('white', 0, 2.5, side * 53.4, 7.6, .25, .25);
    for (const x of [-3.66, 3.66]) b.box('white', x, 1.3, side * 53.4, .25, 2.5, .25);
    b.box('glass', 0, 1.3, side * 54.4, 7.6, 2.5, 2);
  }
  b.add(new TorusGeometry(9.15, .14, 4, 28).rotateX(Math.PI / 2), 'white', 0, .72, 0);
}

export function createArena(): Group {
  const b = new GeometryBatch();
  b.box('stone', 0, .2, 0, 320, .4, 390);
  b.add(new CylinderGeometry(1, 1.03, 1, 56).scale(PODIUM_X, PODIUM_Y, PODIUM_Z), 'cream', 0, PODIUM_Y / 2, 0);
  band(b, 'stone', PODIUM_X - 2, PODIUM_Z - 2, PODIUM_Y + .18, .36, 9, 56);
  // Access ramps climb from the plaza to the podium deck on the two axes that face the avenues.
  for (const side of [-1, 1]) for (let step = 0; step < 7; step++) {
    b.box('cream', side * (PODIUM_X + 30 - step * 4.6), .25 + step * .42, 0, 4.8, .5, 34);
    b.box('cream', 0, .25 + step * .42, side * (PODIUM_Z + 30 - step * 4.6), 34, .5, 4.8);
  }
  pitch(b);
  // Stepped bowl: each ring reaches down to the concourse, so the mass is solid from both sides.
  for (let tier = 0; tier < TIERS; tier++) {
    const f = (tier + .5) / TIERS, top = 4 + f * (BOWL_TOP - 4);
    band(b, tier % 3 === 1 ? 'steel' : 'stone', 58 + f * (BOWL_X - 58), 74 + f * (BOWL_Z - 74), (top + 1) / 2, top - 1, 7, 44);
  }
  band(b, 'dark', 55, 71, 2.6, 2.4, 1.6, 44);
  band(b, 'dark', BOWL_X + 1, BOWL_Z + 1, BOWL_TOP + 1.4, 2.8, 5, 44);
  band(b, 'stone', SHELL_X - 7, SHELL_Z - 7, 10, 20, 5, 44);
  basket(b);
  // Roof ring: the deck covers every seat and stops short of the pitch, which stays open to the sky.
  band(b, 'white', ROOF_IN_X + ROOF_DEPTH / 2, ROOF_IN_Z + ROOF_DEPTH / 2, ROOF_Y, 2.2, ROOF_DEPTH, 56);
  band(b, 'cream', ROOF_IN_X + ROOF_DEPTH, ROOF_IN_Z + ROOF_DEPTH, ROOF_Y - .6, 3.6, 4, 56);
  band(b, 'glass', ROOF_IN_X, ROOF_IN_Z, ROOF_Y - 1.6, 3, 3.4, 48);
  for (let i = 0; i < 32; i++) {
    const t = i / 32 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    member(b, 'steel', c * ROOF_IN_X, ROOF_Y - 2.6, s * ROOF_IN_Z, c * (ROOF_IN_X + ROOF_DEPTH), ROOF_Y - 1.4, s * (ROOF_IN_Z + ROOF_DEPTH), .8, .8);
  }
  // Masts stand on the roof corners, where the real arena hides its lighting rig.
  for (let i = 0; i < 4; i++) {
    const t = (i + .5) * Math.PI / 2, x = Math.cos(t) * (SHELL_X - 9), z = Math.sin(t) * (SHELL_Z - 9);
    const yaw = Math.atan2(-Math.cos(t) * SHELL_Z, -Math.sin(t) * SHELL_X);
    b.cylinder('steel', x, ROOF_Y + 8, z, .7, 1.2, 16, 8);
    b.box('dark', x, ROOF_Y + 16.4, z, 11, 1.4, 3, yaw);
    for (const lx of [-3.6, 0, 3.6]) b.box('light', x + Math.cos(yaw) * lx, ROOF_Y + 15.4, z - Math.sin(yaw) * lx, 3, 1.2, 2.6, yaw);
  }
  for (let i = 0; i < 4; i++) portal(b, i * Math.PI / 2, i % 2 ? SHELL_Z : SHELL_X);
  for (const x of [-132, 132]) for (const z of [-150, -50, 50, 150]) palm(b, x, z, 11 + (z % 3));
  return b.build('Arena da Amazônia — woven steel basket');
}

export function createArenaSilhouette(): Group {
  const b = new GeometryBatch();
  b.add(new CylinderGeometry(1, 1.03, 1, 28).scale(PODIUM_X, PODIUM_Y, PODIUM_Z), 'cream', 0, PODIUM_Y / 2, 0);
  b.box('leaf', 0, .6, 0, 78, .3, 118);
  // Open cylinders are one-sided, which is free and invisible from outside the shell.
  b.add(new CylinderGeometry(1, .64, 1, 28, 1, true).scale(BOWL_X, BOWL_TOP, BOWL_Z), 'stone', 0, BOWL_TOP / 2 + 1, 0);
  b.add(new CylinderGeometry(1, 1, 1, 32, 1, true).scale(SHELL_X * 1.03, ROOF_Y - 2, SHELL_Z * 1.03), 'white', 0, ROOF_Y / 2 + 1, 0);
  band(b, 'white', ROOF_IN_X + ROOF_DEPTH / 2, ROOF_IN_Z + ROOF_DEPTH / 2, ROOF_Y, 2.4, ROOF_DEPTH, 24);
  for (let i = 0; i < 12; i++) {
    const base = i / 12 * Math.PI * 2, lean = Math.PI * 2 / 12;
    for (const rise of [0, 1]) {
      const a0 = base + (rise ? 0 : lean), a1 = base + (rise ? lean : 0);
      member(b, rise ? 'white' : 'cream',
        Math.cos(a0) * SHELL_X * 1.05, 3, Math.sin(a0) * SHELL_Z * 1.05,
        Math.cos(a1) * SHELL_X * 1.05, ROOF_Y, Math.sin(a1) * SHELL_Z * 1.05, 2.4, 4);
    }
  }
  return b.build('Arena distant silhouette');
}

function colliders(): LandmarkBox[] {
  const out: LandmarkBox[] = [];
  const ring = (ax: number, bz: number, y: number, height: number, pad: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const t0 = i / count * Math.PI * 2, t1 = (i + 1) / count * Math.PI * 2;
      const x0 = Math.cos(t0) * ax, z0 = Math.sin(t0) * bz, x1 = Math.cos(t1) * ax, z1 = Math.sin(t1) * bz;
      out.push({ x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, width: Math.abs(x1 - x0) + pad, height, depth: Math.abs(z1 - z0) + pad });
    }
  };
  ring(SHELL_X, SHELL_Z, ROOF_Y / 2, ROOF_Y, 9, 36);
  ring(ROOF_IN_X + ROOF_DEPTH / 2, ROOF_IN_Z + ROOF_DEPTH / 2, ROOF_Y - 1, 3, ROOF_DEPTH - 6, 40);
  ring(BOWL_X - 3, BOWL_Z - 3, BOWL_TOP - 1, 3.5, 9, 28);
  out.push({ x: 0, y: .25, z: 0, width: 320, height: .5, depth: 390 });
  // Seven inscribed slabs fill the podium ellipse; the plaza slab below catches the two tips.
  for (let i = 0; i < 7; i++) {
    const zc = (i - 3) * PODIUM_Z * 2 / 7, edge = Math.abs(zc) + PODIUM_Z / 7;
    const half = PODIUM_X * Math.sqrt(Math.max(0, 1 - (edge / PODIUM_Z) ** 2));
    if (half > 4) out.push({ x: 0, y: PODIUM_Y / 2, z: zc, width: half * 2, height: PODIUM_Y, depth: PODIUM_Z * 2 / 7 });
  }
  return out;
}

export const ARENA_COLLIDERS: readonly LandmarkBox[] = colliders();
