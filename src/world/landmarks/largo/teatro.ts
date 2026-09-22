import { Group, Shape, ShapeGeometry, SphereGeometry, TorusGeometry } from 'three/webgpu';
import { GeometryBatch, type PaletteKey } from '../GeometryBatch';

export interface LandmarkBox { x: number; y: number; z: number; width: number; height: number; depth: number }

/**
 * Teatro Amazonas on its surveyed Overture ring. That ring is an L: a 62.6 × 30.4 m block running
 * from x −132.7 to −69.3 on azimuth 93°, plus a 17.3 m porch projecting east to x −63. Everything
 * below is authored in BUILDING space — origin at the block centre, +X the east front that faces
 * the monument — and `oriented` carries the 3° yaw plus the offset out to the anchor the caller
 * places the group at. That anchor is the ring's vertex MEAN (−83.5, −6.3), which the six eastern
 * vertices drag 17.3 m east of the block centre, so the offset is not zero.
 */
const YAW = -.0524, COS = Math.cos(YAW), SIN = -Math.sin(YAW);
const OFFSET_X = -17.3, OFFSET_Z = -1.1;
const HALF_L = 31.3, HALF_W = 15.2, FRONT = HALF_L;

/** Storey heights, metres above the street. ROOF is the compiled Overture height of the ring. */
export const TEATRO_PLINTH = 3.6;
const GROUND_TOP = 13.4, BALCONY = 14.05, UPPER_TOP = 25.8, CORNICE = 27.6, ROOF = 29.26;
const STAGE_X = -11, STAGE_TOP = 33.4, STAGE_W = 14;
const DOME_X = 12, DOME_Y = 29.8, DOME_R = 8, DOME_CAP = 38.45;
const TERRACE_X = 33.1, TERRACE_Z = 17, PORCH_X = 34.8, PORCH_Z = 8.65;
const STAIR_STEPS = 13, STAIR_FOOT = 41.6;
const STAIR_RISE = TEATRO_PLINTH / STAIR_STEPS, STAIR_RUN = (STAIR_FOOT - PORCH_X) / STAIR_STEPS;
const SIDE_STEPS = 9, SIDE_X = 26.5, SIDE_WIDTH = 5, SIDE_FOOT = 23.3;
const SIDE_RISE = TEATRO_PLINTH / SIDE_STEPS, SIDE_RUN = (SIDE_FOOT - TERRACE_Z) / SIDE_STEPS;

const GROUND_BAYS = [-11.6, -6.84, -3.42, 0, 3.42, 6.84, 11.6];
const UPPER_BAYS = [-11.6, -5.5, 0, 5.5, 11.6];
const FRONT_PIERS = [-14.9, -9.2, -5.13, -1.71, 1.71, 5.13, 9.2, 14.9];
const COLUMNS = [-8.25, -2.75, 2.75, 8.25];
const SIDE_BAYS = [28, 23, 18, 13, 8, 3, -2, -7];

/** Building space → anchor space. The model is yawed 3°; colliders stay axis aligned boxes. */
function anchor(px: number, pz: number): [number, number] {
  return [px * COS - pz * SIN + OFFSET_X, px * SIN + pz * COS + OFFSET_Z];
}

/**
 * `fit` keeps a stair tread exactly one run deep: grown to the yawed AABB it would overlap the
 * tread below it, the character would never cross a face, and the step-up would never fire.
 */
function collide(out: LandmarkBox[], px: number, y: number, pz: number, w: number, h: number, d: number, fit = false): void {
  const [x, z] = anchor(px, pz);
  out.push({ x, y, z, width: fit ? w : w * COS + d * SIN, height: h, depth: fit ? d : w * SIN + d * COS });
}

/** Deterministic speckle for the dome mosaic; the same call must rebuild the same tiles. */
function hash(n: number): number { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

/** Round headed opening: reveal, jambs, archivolt and keystone, on whichever face `look` points at. */
function bay(b: GeometryBatch, px: number, py: number, pz: number, width: number, height: number, look: number, fill: PaletteKey, rich = true): void {
  const r = width / 2, ux = Math.cos(look), uz = -Math.sin(look), nx = Math.sin(look) * .14, nz = Math.cos(look) * .14;
  const shape = new Shape();
  shape.moveTo(-r, 0); shape.lineTo(r, 0); shape.lineTo(r, height - r); shape.absarc(0, height - r, r, 0, Math.PI, false); shape.lineTo(-r, 0);
  b.add(new ShapeGeometry(shape), fill, px, py, pz, 0, look);
  for (const side of [-1, 1]) b.box('cream', px + side * ux * (r + .32) + nx, py + (height - r) / 2, pz + side * uz * (r + .32) + nz, .64, height - r, .64, look);
  if (!rich) return;
  b.add(new TorusGeometry(r + .32, .26, 4, 12, Math.PI), 'cream', px + nx, py + height - r, pz + nz, 0, look);
  b.box('cream', px + nx * 2.2, py + height - .1, pz + nz * 2.2, .58, .9, .58, look);
  b.box('gold', px + nx * 1.5, py + (height - r) / 2, pz + nz * 1.5, .12, height - r - .5, .14, look);
}

/** Dwarf wall, turned balusters and a moulded coping, laid along an arbitrary run. */
function balustrade(b: GeometryBatch, x0: number, z0: number, x1: number, z1: number, y: number, pitch = 1.3): void {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), angle = Math.atan2(-dz, dx);
  const count = Math.max(2, Math.round(len / pitch));
  b.box('cream', (x0 + x1) / 2, y + .17, (z0 + z1) / 2, len, .34, .66, angle);
  b.box('cream', (x0 + x1) / 2, y + 1.21, (z0 + z1) / 2, len, .28, .78, angle);
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count;
    b.cylinder('cream', x0 + dx * t, y + .69, z0 + dz * t, .12, .17, .74, 6);
  }
}

/** Marble urn on a pedestal: the ornament that punctuates every balustrade corner on the real roof. */
function urn(b: GeometryBatch, px: number, py: number, pz: number, scale = 1): void {
  b.box('stone', px, py + .45 * scale, pz, 1.5 * scale, .9 * scale, 1.5 * scale);
  b.box('cream', px, py + .98 * scale, pz, 1.7 * scale, .22 * scale, 1.7 * scale);
  b.cylinder('white', px, py + 1.5 * scale, pz, .52 * scale, .26 * scale, .9 * scale, 8);
  b.sphere('white', px, py + 2.1 * scale, pz, .5 * scale, 1, .95, 1);
  b.cylinder('cream', px, py + 2.6 * scale, pz, .12 * scale, .3 * scale, .34 * scale, 8);
}

/** Giant order column. A blocked capital with corner volutes stands in for the Corinthian one. */
function column(b: GeometryBatch, px: number, pz: number, base: number, height: number, radius: number, rich = true): void {
  b.box('cream', px, base + .3, pz, radius * 3.2, .6, radius * 3.2);
  b.box('white', px, base + .78, pz, radius * 2.6, .36, radius * 2.6);
  b.cylinder('white', px, base + .96 + height / 2, pz, radius * .84, radius, height, rich ? 14 : 8);
  b.cylinder('cream', px, base + 1.08 + height, pz, radius * .98, radius * .88, .24, rich ? 14 : 8);
  b.box('cream', px, base + height + 1.65, pz, radius * 2.8, .8, radius * 2.8);
  b.box('white', px, base + height + 2.16, pz, radius * 3.3, .26, radius * 3.3);
  if (!rich) return;
  for (let i = 0; i < 4; i++) {
    const a = (i + .5) * Math.PI / 2;
    b.sphere('cream', px + Math.cos(a) * radius * 1.25, base + height + 1.5, pz + Math.sin(a) * radius * 1.25, radius * .44, 1, .85, 1);
  }
}

/** Stone embasamento, the walkable terrace ledge and the projecting porch the flight arrives at. */
function base(b: GeometryBatch): void {
  b.box('stone', 0, .4, 0, TERRACE_X * 2 + 1.6, .8, TERRACE_Z * 2 + 1.6);
  b.box('stone', 0, TEATRO_PLINTH * .5, 0, TERRACE_X * 2, TEATRO_PLINTH, TERRACE_Z * 2);
  b.box('stone', (TERRACE_X + PORCH_X) / 2, TEATRO_PLINTH * .5, 0, PORCH_X - TERRACE_X, TEATRO_PLINTH, PORCH_Z * 2);
  // Moulded top edge and the paving it carries, so the terrace reads as a surface, not a lid.
  b.box('cream', 0, TEATRO_PLINTH - .28, 0, TERRACE_X * 2 + .8, .56, TERRACE_Z * 2 + .8);
  b.box('cream', (TERRACE_X + PORCH_X) / 2, TEATRO_PLINTH - .28, 0, PORCH_X - TERRACE_X + .8, .56, PORCH_Z * 2 + .8);
  b.box('cream', 0, TEATRO_PLINTH - .05, 0, TERRACE_X * 2 - .7, .1, TERRACE_Z * 2 - .7);
  b.box('cream', (TERRACE_X + PORCH_X) / 2, TEATRO_PLINTH - .05, 0, PORCH_X - TERRACE_X, .1, PORCH_Z * 2 - .7);
  // Rusticated courses on the exposed stone face, three per side.
  for (let i = 0; i < 3; i++) {
    const y = 1.1 + i * .82;
    b.box('stone', 0, y, 0, TERRACE_X * 2 + .3, .16, TERRACE_Z * 2 + .3);
  }
}

/** Grand frontal flight, its ramping cheek walls and the lamp pedestals that book-end it. */
function grandStair(b: GeometryBatch): void {
  for (let step = 0; step < STAIR_STEPS; step++) {
    const px = STAIR_FOOT - step * STAIR_RUN - STAIR_RUN * .5, top = STAIR_RISE * (step + 1);
    // One box per tread: the character's 0.55 m step-up climbs these, a single ramp would not.
    b.box('cream', px, top - STAIR_RISE * .5, 0, STAIR_RUN + .04, STAIR_RISE, PORCH_Z * 2);
    b.box('stone', px, (top - STAIR_RISE) * .5, 0, STAIR_RUN + .04, Math.max(.02, top - STAIR_RISE), PORCH_Z * 2 - .5);
    for (const side of [-1, 1]) {
      const pz = side * (PORCH_Z + 1.05);
      b.box('stone', px, top * .5, pz, STAIR_RUN + .04, top + .1, 2.1);
      b.box('cream', px, top + .62, pz, STAIR_RUN + .04, 1, 2.35);
    }
  }
  for (const side of [-1, 1]) {
    const pz = side * (PORCH_Z + 1.05);
    urn(b, STAIR_FOOT + 1.5, 0, pz, 1.35);
    b.cylinder('steel', STAIR_FOOT + 1.5, 4.6, pz, .13, .19, 2.6, 8);
    b.sphere('light', STAIR_FOOT + 1.5, 6.2, pz, .48);
    urn(b, PORCH_X - .9, TEATRO_PLINTH, pz, 1.2);
    b.cylinder('steel', PORCH_X - .9, TEATRO_PLINTH + 4.3, pz, .13, .19, 2.6, 8);
    b.sphere('light', PORCH_X - .9, TEATRO_PLINTH + 5.9, pz, .48);
  }
}

/** Side flights down off the terrace, the everyday way onto the platform when the grand one is shut. */
function sideStairs(b: GeometryBatch): void {
  for (const side of [-1, 1]) for (let step = 0; step < SIDE_STEPS; step++) {
    const pz = side * (SIDE_FOOT - step * SIDE_RUN - SIDE_RUN * .5), top = SIDE_RISE * (step + 1);
    b.box('cream', SIDE_X, top - SIDE_RISE * .5, pz, SIDE_WIDTH, SIDE_RISE, SIDE_RUN + .04);
    b.box('stone', SIDE_X, (top - SIDE_RISE) * .5, pz, SIDE_WIDTH - .5, Math.max(.02, top - SIDE_RISE), SIDE_RUN + .04);
    for (const edge of [-1, 1]) b.box('stone', SIDE_X + edge * (SIDE_WIDTH * .5 + .55), top * .5 + .3, pz, 1.1, top + .6, SIDE_RUN + .04);
  }
}

/** East front: arcaded ground storey, giant order over a balcony, entablature and curved pediment. */
function front(b: GeometryBatch): void {
  b.box('stone', FRONT + .12, TEATRO_PLINTH + .45, 0, .5, .9, HALF_W * 2 + .3);
  for (let i = 0; i < 6; i++) b.box('cream', FRONT + .14, 5.1 + i * 1.34, 0, .28, .2, HALF_W * 2 + .2);
  for (let i = 0; i < GROUND_BAYS.length; i++) {
    const pz = GROUND_BAYS[i], door = i > 0 && i < 6;
    bay(b, FRONT + .04, 4.5, pz, door ? 2.9 : 2.6, door ? 7.6 : 7, Math.PI / 2, door ? 'dark' : 'glass');
    if (door) for (let j = -2; j <= 2; j++) b.box('gold', FRONT + .22, 6.4, pz + j * .58, .1, 3.6, .1);
  }
  for (const pz of FRONT_PIERS) {
    b.box('cream', FRONT + .2, 8.6, pz, .5, 9.6, 1.25);
    b.box('cream', FRONT + .34, 12.9, pz, .8, .44, 1.6);
    // Masks of the composers sit over every ground storey capital, as on the real front.
    b.sphere('gold', FRONT + .5, 12.3, pz, .38, 1, 1.15, .55);
  }
  // Balcony slab, its balustrade and the string course that carries them round the building.
  b.box('cream', FRONT + .75, GROUND_TOP + .35, 0, 2.4, .7, HALF_W * 2 + .8);
  b.box('cream', FRONT + .5, BALCONY - .02, 0, 1.9, .16, HALF_W * 2 + .3);
  balustrade(b, FRONT + 1.5, -PORCH_Z - 1.6, FRONT + 1.5, PORCH_Z + 1.6, BALCONY, 1.05);
  for (const side of [-1, 1]) balustrade(b, FRONT + 1.5, side * (PORCH_Z + 2.4), FRONT + 1.5, side * (HALF_W - .5), BALCONY, 1.05);
  for (let i = 0; i < UPPER_BAYS.length; i++) {
    const pz = UPPER_BAYS[i], wing = i === 0 || i === 4;
    bay(b, FRONT + .04, BALCONY + .3, pz, wing ? 2.6 : 3.1, wing ? 9 : 9.8, Math.PI / 2, wing ? 'glass' : 'dark');
    if (!wing) for (let j = -2; j <= 2; j++) b.box('gold', FRONT + .22, BALCONY + 2.6, pz + j * .62, .1, 3.8, .1);
  }
  for (const pz of COLUMNS) column(b, FRONT + 1.55, pz, BALCONY, 9.2, .66);
  for (const pz of [-HALF_W + .45, HALF_W - .45]) b.box('cream', FRONT + .22, (BALCONY + UPPER_TOP) / 2, pz, .5, UPPER_TOP - BALCONY, 1.4);
  entablature(b, FRONT + .3, 1, HALF_W * 2);
  pediment(b, FRONT + .18);
}

/** Architrave, frieze and dentilled cornice; `span` and `look` let it wrap any elevation. */
function entablature(b: GeometryBatch, px: number, look: number, span: number): void {
  const nx = look === 1 ? 1 : 0, along = look === 1 ? 0 : 1;
  const w = nx ? .9 : span, d = nx ? span : .9;
  b.box('cream', px + nx * .3, UPPER_TOP + .28, along ? px : 0, nx ? .9 : span + .2, .56, nx ? span + .2 : .9);
  b.box('salmon', px, UPPER_TOP + .95, along ? px : 0, w * .78, .78, d * .78);
  for (let t = -span / 2 + 1.1; t < span / 2; t += 2.2) {
    b.box('gold', nx ? px + .3 : t, UPPER_TOP + .95, nx ? t : px + .3, nx ? .22 : .7, .5, nx ? .7 : .22);
  }
  for (let t = -span / 2 + .45; t < span / 2; t += .9) {
    b.box('cream', nx ? px + .5 : t, UPPER_TOP + 1.62, nx ? t : px + .5, nx ? .5 : .4, .4, nx ? .4 : .5);
  }
  b.box('cream', px + nx * .62, CORNICE - .28, along ? px : 0, nx ? 1.7 : span + .9, .56, nx ? span + .9 : 1.7);
  b.box('salmon', px + nx * .12, (CORNICE + ROOF) / 2, along ? px : 0, nx ? .5 : span + .2, ROOF - CORNICE, nx ? span + .2 : .5);
  b.box('cream', px + nx * .28, ROOF - .18, along ? px : 0, nx ? .9 : span + .5, .36, nx ? span + .5 : .9);
}

/** Curved baroque pediment over the centre bays, with a gilded relief in the tympanum. */
function pediment(b: GeometryBatch, px: number): void {
  const half = 7.9, rise = 3.4, r = (half * half + rise * rise) / (2 * rise), cy = ROOF - (r - rise);
  const a0 = Math.atan2(ROOF - cy, half), a1 = Math.PI - a0;
  const shape = new Shape();
  shape.moveTo(-half, 0); shape.lineTo(half, 0); shape.absarc(0, cy - ROOF, r, a0, a1, false);
  b.add(new ShapeGeometry(shape), 'salmon', px + .1, ROOF, 0, 0, Math.PI / 2);
  b.add(new TorusGeometry(r + .34, .34, 4, 20, a1 - a0).rotateZ(a0), 'cream', px + .3, cy, 0, 0, Math.PI / 2);
  b.box('cream', px + .3, ROOF - .12, 0, .8, .46, half * 2 + 1.4);
  // Simplified relief: a central cartouche with radiating figures, the way the real tympanum reads.
  b.sphere('gold', px + .55, ROOF + 1.5, 0, 1.15, 1, 1.15, .45);
  b.cylinder('cream', px + .48, ROOF + 1.5, 0, 1.5, 1.5, .3, 16);
  for (const side of [-1, 1]) {
    b.sphere('cream', px + .5, ROOF + 1.1, side * 3.1, .7, 1, 1.3, .38);
    b.sphere('cream', px + .5, ROOF + .7, side * 5.3, .55, 1, 1.25, .34);
  }
  urn(b, px - .2, ROOF + rise, 0, .9);
  for (const side of [-1, 1]) urn(b, px - .2, ROOF, side * (half + 1), 1);
}

/** Long elevations: the same two storey rhythm, plainer, running back past the stage house. */
function flank(b: GeometryBatch, side: number): void {
  const pz = side * HALF_W, look = side > 0 ? 0 : Math.PI, nz = side * .04;
  b.box('stone', 0, TEATRO_PLINTH + .45, pz + nz * 3, HALF_L * 2 + .3, .9, .5);
  for (const px of SIDE_BAYS) {
    bay(b, px, 4.5, pz + nz, 2.5, 6.9, look, 'glass', false);
    bay(b, px, BALCONY + .3, pz + nz, 2.5, 8.6, look, 'glass');
    b.box('cream', px + 2.5, 8.5, pz + side * .2, 1.15, 9.4, .5);
    b.box('cream', px + 2.5, (BALCONY + UPPER_TOP) / 2, pz + side * .2, 1.15, UPPER_TOP - BALCONY, .5);
    b.box('cream', px + 2.5, 12.9, pz + side * .32, 1.5, .44, .8);
    b.sphere('gold', px + 2.5, 12.3, pz + side * .5, .34, .95, 1.15, .5);
  }
  b.box('cream', -9.5, 8.5, pz + side * .2, 1.15, 9.4, .5);
  b.box('cream', -9.5, (BALCONY + UPPER_TOP) / 2, pz + side * .2, 1.15, UPPER_TOP - BALCONY, .5);
  entablature(b, pz, 0, HALF_L * 2);
  // Stage house flank: pilaster strips and high slit windows, deliberately plainer than the front.
  for (let px = -13.5; px > -HALF_L; px -= 4.5) {
    b.box('cream', px, (TEATRO_PLINTH + STAGE_TOP) / 2, side * (STAGE_W - .1), .9, STAGE_TOP - TEATRO_PLINTH, .5);
    b.box('glass', px - 2.2, 22, side * (STAGE_W - .15), 1.5, 4.6, .3);
    b.box('glass', px - 2.2, 10, side * (STAGE_W - .15), 1.5, 3.4, .3);
  }
}

/** Rear stage house: one tall plain volume, heavier cornice, low hipped roof. */
function stageHouse(b: GeometryBatch): void {
  b.box('salmon', 0, (TEATRO_PLINTH + ROOF) / 2, 0, HALF_L * 2, ROOF - TEATRO_PLINTH, HALF_W * 2);
  const cx = (STAGE_X - HALF_L) / 2, len = HALF_L + STAGE_X;
  b.box('salmon', cx, (ROOF + STAGE_TOP) / 2, 0, len, STAGE_TOP - ROOF, STAGE_W * 2);
  b.box('cream', cx, STAGE_TOP - .55, 0, len + .7, .5, STAGE_W * 2 + .7);
  b.box('cream', cx, STAGE_TOP + .05, 0, len + 1.4, .7, STAGE_W * 2 + 1.4);
  b.box('dark', cx, STAGE_TOP + .95, 0, len + .4, 1.1, STAGE_W * 2 + .4);
  b.box('dark', cx, STAGE_TOP + 1.8, 0, len - 3.4, .7, STAGE_W * 2 - 3.4);
  for (const px of [-HALF_L + .7, STAGE_X]) b.box('cream', px, (ROOF + STAGE_TOP) / 2, 0, .8, STAGE_TOP - ROOF, STAGE_W * 2 + .3);
  // West wall: service doors and a blind arcade, seen only from the back streets.
  for (const pz of [-9, -3, 3, 9]) bay(b, -HALF_L - .04, 4.5, pz, 2.4, 6.6, -Math.PI / 2, 'dark', false);
  for (const pz of [-9, -3, 3, 9]) b.box('glass', -HALF_L - .16, 18, pz, .3, 6.5, 2);
  for (const pz of [-12.6, -6, 0, 6, 12.6]) b.box('cream', -HALF_L - .2, (TEATRO_PLINTH + ROOF) / 2, pz, .5, ROOF - TEATRO_PLINTH, 1.1);
  entablature(b, -HALF_L, 1, HALF_W * 2);
}

/** Roof deck, the balustrade that rings it and the urns that stand on every corner pedestal. */
function roof(b: GeometryBatch): void {
  b.box('dark', (STAGE_X + FRONT) / 2, ROOF + .55, 0, FRONT - STAGE_X, 1.1, HALF_W * 2 - 1.8);
  b.box('dark', (STAGE_X + FRONT) / 2, ROOF + 1.35, 0, FRONT - STAGE_X - 4, .6, HALF_W * 2 - 5.4);
  for (const side of [-1, 1]) {
    balustrade(b, FRONT - .5, side * (PORCH_Z + 2.2), FRONT - .5, side * (HALF_W - .6), ROOF);
    balustrade(b, FRONT - .9, side * (HALF_W - .6), STAGE_X, side * (HALF_W - .6), ROOF);
    balustrade(b, STAGE_X - .6, side * (STAGE_W - .6), -HALF_L + .8, side * (STAGE_W - .6), STAGE_TOP + .4);
    for (const px of [FRONT - .9, STAGE_X]) urn(b, px, ROOF, side * (HALF_W - .6), 1);
    urn(b, -HALF_L + .8, STAGE_TOP + .4, side * (STAGE_W - .6), .9);
  }
  balustrade(b, -HALF_L + .8, -STAGE_W + .6, -HALF_L + .8, STAGE_W - .6, STAGE_TOP + .4);
}

/**
 * The cupola: 36,000 glazed tiles in the flag's green, yellow and blue. Each tile is a one segment
 * sphere patch batched into three shared materials, with a dark shell behind it standing in for the
 * grout, so the mosaic costs geometry rather than one object per tile.
 */
function cupola(b: GeometryBatch, rows: number, cols: number): void {
  b.cylinder('cream', DOME_X, 28.4, 0, 9.3, 9.6, 3, 36);
  b.cylinder('stone', DOME_X, 26.95, 0, 10.1, 10.1, .8, 36);
  b.cylinder('gold', DOME_X, 29.88, 0, 9.05, 9.3, .5, 36);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, r = 9.45;
    b.box('cream', DOME_X + Math.cos(a) * r, 28.5, Math.sin(a) * r, .45, 2.6, .45, -a);
  }
  b.add(new SphereGeometry(DOME_R - .16, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), 'dark', DOME_X, DOME_Y, 0);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const geometry = new SphereGeometry(DOME_R, 1, 1, col / cols * Math.PI * 2, Math.PI * 2 / cols * .93, row / rows * Math.PI / 2, Math.PI / 2 / rows * .93);
    b.add(geometry, tile(row, col, rows, cols), DOME_X, DOME_Y, 0);
  }
  // Lantern collar and the flat cap the character lands on when it spawns above the theatre.
  b.cylinder('gold', DOME_X, DOME_Y + DOME_R + .2, 0, 1.5, 2.1, .8, 16);
  b.cylinder('cream', DOME_X, DOME_CAP - .16, 0, 1.7, 1.7, .32, 20);
}

/** Flag colours laid as the chevron lozenges the real mosaic uses, keyed off row and column only. */
function tile(row: number, col: number, rows: number, cols: number): PaletteKey {
  const v = (row + .5) / rows, wave = Math.abs(((col / cols * 9 + v * 2.6) % 1) - .5) * 2;
  if (hash(row * cols + col) < .05) return 'gold';
  if (v < .16) return 'gold';
  if (v < .3) return 'blue';
  if (v > .84) return wave < .46 ? 'gold' : 'green';
  return wave < .3 ? 'blue' : wave < .62 ? 'gold' : 'green';
}

/** Anchors the finished batch: the 3° yaw of the real long axis, then the offset to the ring mean. */
function oriented(inner: Group): Group {
  inner.position.set(OFFSET_X, 0, OFFSET_Z);
  inner.rotation.y = YAW;
  return inner;
}

export function createTeatroNear(): Group {
  const group = new Group(); group.name = 'Teatro Amazonas';
  const b = new GeometryBatch();
  base(b); grandStair(b); sideStairs(b);
  stageHouse(b);
  front(b);
  for (const side of [-1, 1]) flank(b, side);
  roof(b); cupola(b, 10, 56);
  // Terrace balustrade, broken where the grand flight and the two side flights arrive.
  for (const side of [-1, 1]) {
    balustrade(b, TERRACE_X - .5, side * (PORCH_Z + 2.6), TERRACE_X - .5, side * (TERRACE_Z - .5), TEATRO_PLINTH);
    balustrade(b, PORCH_X - .5, side * (PORCH_Z - .5), TERRACE_X, side * (PORCH_Z - .5), TEATRO_PLINTH);
    balustrade(b, TERRACE_X - .5, side * (TERRACE_Z - .5), SIDE_X + SIDE_WIDTH * .5 + 1.2, side * (TERRACE_Z - .5), TEATRO_PLINTH);
    balustrade(b, SIDE_X - SIDE_WIDTH * .5 - 1.2, side * (TERRACE_Z - .5), -TERRACE_X + .5, side * (TERRACE_Z - .5), TEATRO_PLINTH);
    balustrade(b, -TERRACE_X + .5, side * (TERRACE_Z - .5), -TERRACE_X + .5, 0, TEATRO_PLINTH);
  }
  group.add(oriented(b.build('Teatro Amazonas — fachada, escadaria e cúpula')));
  return group;
}

export function createTeatroMedium(): Group {
  const group = new Group(); group.name = 'Teatro Amazonas médio';
  const b = new GeometryBatch();
  b.box('stone', 0, TEATRO_PLINTH * .5, 0, TERRACE_X * 2, TEATRO_PLINTH, TERRACE_Z * 2);
  b.box('stone', (TERRACE_X + PORCH_X) / 2, TEATRO_PLINTH * .5, 0, PORCH_X - TERRACE_X, TEATRO_PLINTH, PORCH_Z * 2);
  b.box('cream', 0, TEATRO_PLINTH - .25, 0, TERRACE_X * 2 + .8, .5, TERRACE_Z * 2 + .8);
  for (let step = 0; step < STAIR_STEPS; step++) {
    const px = STAIR_FOOT - step * STAIR_RUN - STAIR_RUN * .5, top = STAIR_RISE * (step + 1);
    b.box('cream', px, top * .5, 0, STAIR_RUN + .04, top, PORCH_Z * 2);
    for (const side of [-1, 1]) b.box('stone', px, top * .5 + .4, side * (PORCH_Z + 1.05), STAIR_RUN + .04, top + .8, 2.1);
  }
  for (const side of [-1, 1]) for (let step = 0; step < SIDE_STEPS; step++) {
    b.box('cream', SIDE_X, SIDE_RISE * (step + 1) * .5, side * (SIDE_FOOT - step * SIDE_RUN - SIDE_RUN * .5), SIDE_WIDTH, SIDE_RISE * (step + 1), SIDE_RUN + .04);
  }
  b.box('salmon', 0, (TEATRO_PLINTH + ROOF) / 2, 0, HALF_L * 2, ROOF - TEATRO_PLINTH, HALF_W * 2);
  b.box('salmon', (STAGE_X - HALF_L) / 2, (ROOF + STAGE_TOP) / 2, 0, HALF_L + STAGE_X, STAGE_TOP - ROOF, STAGE_W * 2);
  b.box('cream', (STAGE_X - HALF_L) / 2, STAGE_TOP + .05, 0, HALF_L + STAGE_X + 1.4, .7, STAGE_W * 2 + 1.4);
  b.box('dark', (STAGE_X - HALF_L) / 2, STAGE_TOP + .95, 0, HALF_L + STAGE_X, 1.1, STAGE_W * 2);
  // Bands, not mouldings: four courses carry the storey rhythm at the distance this model is used.
  for (const [y, h] of [[GROUND_TOP + .3, .8], [BALCONY, .3], [UPPER_TOP + .4, .8], [CORNICE - .3, .7], [ROOF - .25, .5]] as const) {
    b.box('cream', 0, y, 0, HALF_L * 2 + .9, h, HALF_W * 2 + .9);
  }
  b.box('cream', FRONT + .7, GROUND_TOP + .35, 0, 2.2, .7, HALF_W * 2 + .8);
  for (const pz of GROUND_BAYS) b.box('dark', FRONT + .08, 8.2, pz, .3, 7.2, 2.6);
  for (const pz of UPPER_BAYS) b.box('dark', FRONT + .08, 19.2, pz, .3, 9, 2.8);
  for (const pz of COLUMNS) column(b, FRONT + 1.5, pz, BALCONY, 9.2, .66, false);
  for (const side of [-1, 1]) for (const px of SIDE_BAYS) {
    b.box('glass', px, 8.2, side * (HALF_W + .06), 2.4, 6.6, .3);
    b.box('glass', px, 19.4, side * (HALF_W + .06), 2.4, 8.2, .3);
  }
  b.box('salmon', FRONT + .2, ROOF + 1.8, 0, .5, 3.6, 16);
  b.box('cream', FRONT + .35, ROOF + 3.7, 0, .8, .5, 12);
  for (const side of [-1, 1]) {
    b.box('cream', (STAGE_X + FRONT) / 2, ROOF + .7, side * (HALF_W - .6), FRONT - STAGE_X, 1.4, .6);
    b.box('cream', FRONT - .7, ROOF + .7, side * (PORCH_Z + 5), 1, 1.4, 6, 0);
  }
  b.box('dark', (STAGE_X + FRONT) / 2, ROOF + .55, 0, FRONT - STAGE_X, 1.1, HALF_W * 2 - 1.8);
  cupolaCoarse(b, 20, 10);
  group.add(oriented(b.build('Teatro Amazonas — volume médio')));
  return group;
}

export function createTeatroFar(): Group {
  const group = new Group(); group.name = 'Teatro Amazonas distante';
  const b = new GeometryBatch();
  b.box('stone', 0, TEATRO_PLINTH * .5, 0, TERRACE_X * 2, TEATRO_PLINTH, TERRACE_Z * 2);
  b.box('salmon', 0, (TEATRO_PLINTH + ROOF) / 2, 0, HALF_L * 2, ROOF - TEATRO_PLINTH, HALF_W * 2);
  b.box('cream', 0, CORNICE - .2, 0, HALF_L * 2 + 1, 1.2, HALF_W * 2 + 1);
  b.box('salmon', (STAGE_X - HALF_L) / 2, (ROOF + STAGE_TOP) / 2, 0, HALF_L + STAGE_X, STAGE_TOP - ROOF, STAGE_W * 2);
  b.box('dark', (STAGE_X + FRONT) / 2, ROOF + .55, 0, FRONT - STAGE_X, 1.1, HALF_W * 2 - 1.8);
  cupolaCoarse(b, 12, 6);
  group.add(oriented(b.build('Teatro Amazonas — silhueta')));
  return group;
}

/** One-piece cupola for the cheap models: the flag reads as three stacked bands, not as tiles. */
function cupolaCoarse(b: GeometryBatch, segments: number, rings: number): void {
  b.cylinder('cream', DOME_X, 28.4, 0, 9.3, 9.6, 3, segments);
  const bands: readonly (readonly [PaletteKey, number, number])[] = [['gold', 0, .22], ['blue', .22, .38], ['green', .38, 1]];
  for (const [material, from, to] of bands) {
    b.add(new SphereGeometry(DOME_R, segments, Math.max(2, Math.round(rings * (to - from))), 0, Math.PI * 2, from * Math.PI / 2, (to - from) * Math.PI / 2), material, DOME_X, DOME_Y, 0);
  }
  b.cylinder('gold', DOME_X, DOME_CAP - .3, 0, 1.6, 2.1, .9, 8);
}

/**
 * Collision: the flight climbs one tread at a time, the terrace and the porch are surfaces to stand
 * on, and the cupola is a stack of discs so a character dropped on the theatre lands rather than
 * falling through it. Treads are split along their length because a yawed tread cannot be one AABB.
 */
export const TEATRO_COLLIDERS: readonly LandmarkBox[] = (() => {
  const out: LandmarkBox[] = [];
  for (let step = 0; step < STAIR_STEPS; step++) {
    const px = STAIR_FOOT - step * STAIR_RUN - STAIR_RUN * .5, top = STAIR_RISE * (step + 1), seg = PORCH_Z * 2 / 4;
    for (let i = 0; i < 4; i++) collide(out, px, top * .5, (i - 1.5) * seg, STAIR_RUN, top, seg, true);
  }
  for (const side of [-1, 1]) for (let step = 0; step < SIDE_STEPS; step++) {
    const pz = side * (SIDE_FOOT - step * SIDE_RUN - SIDE_RUN * .5), top = SIDE_RISE * (step + 1);
    for (let i = 0; i < 2; i++) collide(out, SIDE_X + (i - .5) * SIDE_WIDTH * .5, top * .5, pz, SIDE_WIDTH * .5, top, SIDE_RUN, true);
  }
  collide(out, 0, TEATRO_PLINTH * .5, 0, TERRACE_X * 2, TEATRO_PLINTH, TERRACE_Z * 2);
  collide(out, (TERRACE_X + PORCH_X) / 2, TEATRO_PLINTH * .5, 0, PORCH_X - TERRACE_X, TEATRO_PLINTH, PORCH_Z * 2);
  collide(out, 0, (TEATRO_PLINTH + ROOF) / 2, 0, HALF_L * 2, ROOF - TEATRO_PLINTH, HALF_W * 2);
  collide(out, (STAGE_X - HALF_L) / 2, (ROOF + STAGE_TOP) / 2, 0, HALF_L + STAGE_X, STAGE_TOP - ROOF, STAGE_W * 2);
  collide(out, (STAGE_X + FRONT) / 2, ROOF + .8, 0, FRONT - STAGE_X, 1.6, HALF_W * 2 - 1.8);
  collide(out, DOME_X, 28.4, 0, 19.2, 3, 19.2);
  for (let layer = 0; layer < 7; layer++) {
    const top = DOME_Y + (layer + 1) / 7 * DOME_R;
    const radius = Math.sqrt(Math.max(1, DOME_R * DOME_R - (top - DOME_Y) ** 2));
    collide(out, DOME_X, top - .6, 0, radius * 2, 1.2, radius * 2);
  }
  collide(out, DOME_X, DOME_CAP - .25, 0, 3.4, .5, 3.4);
  return out;
})();
