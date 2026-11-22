/**
 * Geometry pipeline for one Kenney car: normalise, classify (glass / paint / trim), measure the cabin,
 * place seats + steering wheel, cut the two front doors, and build the interior pieces.
 * Everything here works on triangle soups in the vehicle frame (metres, +Z forward, +X = car's left).
 */
import {
  appendSoup, boxSoup, clipPolygon, cylinderSoup, emitPolygon, emptySoup, getVertex, pushTriangle, scaleOffsetSoup,
  soupBounds, splitByRect, torusSoup, transformSoup, triCount, triangleCentroid, triangleNormal, triangleUvCentroid,
  triangleVertices,
} from './vehicle-geometry.mjs';
import { fromQuaternion, multiply, quaternionAxisAngle, rotationX, translation } from './mat4.mjs';
import { HERO, STRIPS } from './vehicle-config.mjs';

const DEG = Math.PI / 180;
const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;
export const roundVec = (v, n = 4) => v.map((x) => round(x, n));

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const hexToLinear = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255));
};
export const hexToSrgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const COLORS = {
  liner: hexToLinear('#2b2f33'),
  seat: hexToLinear('#3a3f46'),
  dash: hexToLinear('#22262a'),
  wheel: hexToLinear('#111111'),
};

// ---------------------------------------------------------------------------------------------
// Normalise
// ---------------------------------------------------------------------------------------------

export function normalise(cfg, src) {
  const S = cfg.scale;
  const rb = soupBounds(src.body);
  const cx = (rb.min[0] + rb.max[0]) / 2, cz = (rb.min[2] + rb.max[2]) / 2;
  let lowest = Infinity;
  for (const w of Object.values(src.wheels)) lowest = Math.min(lowest, w.pivot[1] + soupBounds(w.soup).min[1]);
  const off = [-cx * S, -lowest * S, -cz * S];
  const body = scaleOffsetSoup(src.body, S, off);
  const wheels = {};
  for (const [name, w] of Object.entries(src.wheels)) {
    const soup = scaleOffsetSoup(w.soup, S, [0, 0, 0]);
    const b = soupBounds(soup);
    wheels[name] = {
      pivot: [w.pivot[0] * S + off[0], w.pivot[1] * S + off[1], w.pivot[2] * S + off[2]],
      soup,
      radius: Math.max(Math.abs(b.min[1]), Math.abs(b.max[1]), Math.abs(b.min[2]), Math.abs(b.max[2])),
    };
  }
  return { body, wheels };
}

// ---------------------------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------------------------

export const stripOf = (soup, t) => {
  const [u, v] = triangleUvCentroid(soup, t);
  return Math.min(15, Math.max(0, Math.floor(u * 16))) + 16 * Math.min(3, Math.max(0, Math.floor(v * 4)));
};

export function samplePalette(palette, soup, t) {
  const [u, v] = triangleUvCentroid(soup, t);
  const x = Math.min(palette.width - 1, Math.max(0, Math.floor(u * palette.width)));
  const y = Math.min(palette.height - 1, Math.max(0, Math.floor(v * palette.height)));
  const i = (y * palette.width + x) * 4;
  return [palette.data[i], palette.data[i + 1], palette.data[i + 2]];
}

/** Returns per-triangle kinds ('glass'|'paint'|'trim') and the detected paint info. */
export function classify(cfg, body, palette) {
  const n = triCount(body);
  const strips = Array.from({ length: n }, (_, t) => stripOf(body, t));
  const areas = Array.from({ length: n }, (_, t) => triangleNormal(body, t).area);
  const glassStrips = cfg.openCockpit ? [] : STRIPS.glass;

  let paintSet = null;
  let paintable = false;
  if (!cfg.fixedLivery) {
    if (cfg.paintStrips) paintSet = new Set(cfg.paintStrips);
    else {
      const fam = new Map();
      for (let t = 0; t < n; t++) {
        const f = strips[t] & ~1;
        if (!STRIPS.paintFamilies.includes(f)) continue;
        fam.set(f, (fam.get(f) ?? 0) + areas[t]);
      }
      const best = [...fam].sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] > 0.8 * cfg.scale * cfg.scale) paintSet = new Set([best[0], best[0] + 1]);
    }
  }
  const kinds = new Array(n);
  let sum = [0, 0, 0], sumA = 0;
  for (let t = 0; t < n; t++) {
    if (glassStrips.includes(strips[t])) kinds[t] = 'glass';
    else if (paintSet && paintSet.has(strips[t])) {
      kinds[t] = 'paint';
      const c = samplePalette(palette, body, t);
      for (let k = 0; k < 3; k++) sum[k] += c[k] * areas[t];
      sumA += areas[t];
    } else kinds[t] = 'trim';
  }
  paintable = !!paintSet && sumA > 0;
  const paintColor = paintable
    ? '#' + sum.map((v) => Math.round(v / sumA).toString(16).padStart(2, '0')).join('')
    : null;
  return { kinds, paintable, paintColor, strips };
}

// ---------------------------------------------------------------------------------------------
// Ray helpers
// ---------------------------------------------------------------------------------------------

/** y values where a vertical ray at (x,z) crosses the soup. */
export function verticalHits(soup, x, z) {
  const hits = [];
  const n = triCount(soup);
  for (let t = 0; t < n; t++) {
    const [a, b, c] = triangleVertices(soup, t);
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    hits.push(l1 * a[1] + l2 * b[1] + l3 * c[1]);
  }
  return hits.sort((p, q) => p - q);
}

/** x values where a ray along X at (y,z) crosses the soup. */
export function lateralHits(soup, y, z) {
  const hits = [];
  const n = triCount(soup);
  for (let t = 0; t < n; t++) {
    const [a, b, c] = triangleVertices(soup, t);
    const d = (b[2] - c[2]) * (a[1] - c[1]) + (c[1] - b[1]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((b[2] - c[2]) * (y - c[1]) + (c[1] - b[1]) * (z - c[2])) / d;
    const l2 = ((c[2] - a[2]) * (y - c[1]) + (a[1] - c[1]) * (z - c[2])) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    hits.push(l1 * a[0] + l2 * b[0] + l3 * c[0]);
  }
  return hits.sort((p, q) => p - q);
}

// ---------------------------------------------------------------------------------------------
// Cabin analysis
// ---------------------------------------------------------------------------------------------

const grow = (o, v) => {
  for (let k = 0; k < 3; k++) { o.min[k] = Math.min(o.min[k], v[k]); o.max[k] = Math.max(o.max[k], v[k]); }
  o.n++;
};
const newBox = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], n: 0 });

export function analyseCabin(cfg, body, kinds, wheels) {
  const n = triCount(body);
  const side = newBox(), front = newBox(), rear = newBox();
  let sideAbsX = 0, sideCount = 0;
  for (let t = 0; t < n; t++) {
    if (!STRIPS.glass.includes(stripOf(body, t))) continue;
    const { n: nn } = triangleNormal(body, t);
    const tgt = Math.abs(nn[0]) > 0.55 ? side : nn[2] > 0.25 ? front : nn[2] < -0.25 ? rear : side;
    for (const v of triangleVertices(body, t)) {
      grow(tgt, v);
      if (tgt === side) { sideAbsX += Math.abs(v[0]); sideCount++; }
    }
  }
  const bb = soupBounds(body);
  const out = {
    bodyMinY: bb.min[1], bodyMaxY: bb.max[1], halfWidth: Math.max(Math.abs(bb.min[0]), Math.abs(bb.max[0])),
    zMin: bb.min[2], zMax: bb.max[2],
    side: side.n ? { z0: side.min[2], z1: side.max[2], y0: side.min[1], y1: side.max[1], wx: sideAbsX / sideCount } : null,
    front: front.n ? { zBase: front.max[2], yBase: front.min[1], zTop: front.min[2], yTop: front.max[1], wx: Math.max(front.max[0], -front.min[0]) } : null,
    rear: rear.n ? { zBase: rear.min[2], yBase: rear.min[1], zTop: rear.max[2], yTop: rear.max[1] } : null,
  };

  // Wheel arches: dark arch lining triangles (strip 37) clustered around each left wheel.
  const arches = {};
  for (const name of ['wheel-front-left', 'wheel-back-left']) {
    const w = wheels[name];
    const box = newBox();
    for (let t = 0; t < n; t++) {
      if (stripOf(body, t) !== 37) continue;
      const c = triangleCentroid(body, t);
      if (c[0] < 0 || Math.abs(c[2] - w.pivot[2]) > w.radius + 0.12 || c[1] > w.pivot[1] + w.radius + 0.5) continue;
      for (const v of triangleVertices(body, t)) grow(box, v);
    }
    arches[name] = box.n ? { z0: Math.max(box.min[2], w.pivot[2] - w.radius - 0.12), z1: Math.min(box.max[2], w.pivot[2] + w.radius + 0.12), top: box.max[1] } : { z0: w.pivot[2] - w.radius, z1: w.pivot[2] + w.radius, top: w.pivot[1] + w.radius };
  }
  out.frontArchRear = arches['wheel-front-left'].z0; // rear (smaller z) edge of the front arch
  out.rearArchFront = arches['wheel-back-left'].z1; // front (larger z) edge of the rear arch
  out.frontArchTop = arches['wheel-front-left'].top;
  return out;
}

const windshieldZAt = (c, y) => {
  if (!c.front) return c.side ? c.side.z1 : 0;
  const f = c.front;
  const t = Math.min(1, Math.max(0, (y - f.yBase) / Math.max(1e-6, f.yTop - f.yBase)));
  return f.zBase + (f.zTop - f.zBase) * t;
};

/** Lowest surface above the head (cylinder r~0.12 around the head centre, 0.05 ahead of the pelvis). */
function roofHeight(body, c, x, zp) {
  const sill = c.side ? c.side.y0 : c.bodyMinY + 0.9;
  let roof = Infinity;
  for (const dx of [-0.12, 0, 0.12]) {
    for (const dz of [-0.07, 0.05, 0.17]) {
      const hits = verticalHits(body, x + dx, zp + dz).filter((y) => y > sill + 0.15);
      if (hits.length) roof = Math.min(roof, hits[0]);
    }
  }
  return roof;
}

/** Outermost shell half-width on the left side at height y, near z (minimum over a small z spread). */
function shellHalfWidth(body, y, z, cabin) {
  let best = Infinity;
  for (const dz of [-0.15, 0, 0.15]) {
    const hits = lateralHits(body, y, z + dz).filter((x) => x > 0);
    if (hits.length) best = Math.min(best, Math.max(...hits));
  }
  return Number.isFinite(best) ? best : cabin.halfWidth;
}

/**
 * Seat lateral rule (coordinator, from the headless hero-in-car test): |x| = max(0.42, interiorHalfWidth - 0.48),
 * interiorHalfWidth = outer shell half-width at elbow height minus 0.06, so the pelvis keeps >= 0.48 m from the
 * inner side wall (the seated Driving_Loop elbows reach ~0.40 m sideways, the knees ~0.25 m).
 */
export const SEAT_WALL_GAP = 0.48;
export const SEAT_MIN_X = 0.42;
export const WALL_THICKNESS = 0.06;

function seatLateral(body, cabin, pelvisY, z) {
  const outer = shellHalfWidth(body, pelvisY + 0.25, z, cabin);
  const x = Math.max(SEAT_MIN_X, outer - WALL_THICKNESS - SEAT_WALL_GAP);
  return { x, outer, rule: x === SEAT_MIN_X ? 'min' : 'wall' };
}

export function placeSeats(cfg, body, cabin) {
  const notes = [];
  // Tall cabs (fire truck, garbage truck): raise the floor so the driver's shoulders sit at window height.
  const sillY = cabin.side ? cabin.side.y0 : 0;
  const floorHi = Math.max(cabin.bodyMinY + 0.07, sillY - 0.4 - HERO.pelvisUp);
  const floorLo = Math.max(0.08, cabin.bodyMinY - 0.04);
  let floorY = floorHi, pelvisY = floorY + HERO.pelvisUp, zp = 0, roof = Infinity;

  if (cfg.openCockpit) {
    const s = cabin.side;
    zp = s ? (s.z0 + s.z1) / 2 - 0.05 : 0;
    // The Kenney racers have a solid monocoque with a decorative cockpit ring: the cushion rests on the deck.
    const hits = verticalHits(body, 0, zp).filter((y) => y <= (s ? s.y1 : cabin.bodyMaxY));
    const deck = hits.length ? hits[hits.length - 1] : cabin.bodyMinY + 0.3;
    pelvisY = deck + 0.22;
    floorY = pelvisY - HERO.pelvisUp;
    notes.push('open cockpit single-seater: driver centred, cushion on the monocoque deck, head and torso above the car');
    return { sx: 0, floorY, pelvisY, zp, roofY: null, seatDrop: 0, notes, xRule: 'centre', deckY: deck, halfWidth: shellHalfWidth(body, deck, zp, cabin) };
  }

  const tilt = HERO.wheelTiltDeg * DEG;
  const nominalPelvis = floorHi + HERO.pelvisUp;
  const wheelY0 = nominalPelvis + HERO.wheelUp;
  const zTopRim = windshieldZAt(cabin, wheelY0 + HERO.wheelRadius * Math.cos(tilt)) - 0.12 - HERO.wheelRadius * Math.sin(tilt);
  const zBase = cabin.front ? cabin.front.zBase : cabin.side.z1;
  const zpMax = Math.min(zTopRim, zBase - 0.3) - HERO.wheelForward;
  const zRearLimit = (cabin.rear ? cabin.rear.zBase : cabin.side.z0 - 0.1) + 0.4;
  let best = null;
  for (let k = 0; k <= 16; k++) {
    const z = zpMax - k * 0.04;
    if (k > 0 && z < zRearLimit) break;
    // Two passes: the lateral rule depends on the pelvis height, which depends on the roof above the head.
    let lat = seatLateral(body, cabin, nominalPelvis, z);
    let cand = null;
    for (let pass = 0; pass < 2; pass++) {
      const roofZ = roofHeight(body, cabin, lat.x, z);
      const maxPelvis = roofZ - 0.03 - HERO.roofClearance - HERO.headTopAbovePelvis;
      const fl = Math.min(floorHi, Math.max(floorLo, maxPelvis - HERO.pelvisUp));
      const pel = Math.min(fl + HERO.pelvisUp, maxPelvis);
      cand = { z, x: lat.x, outer: lat.outer, rule: lat.rule, roofZ, fl, pel, drop: fl + HERO.pelvisUp - pel };
      lat = seatLateral(body, cabin, pel, z);
    }
    if (!best || cand.drop < best.drop - 1e-6) best = cand;
    if (cand.drop <= 0.004) { best = cand; break; }
  }
  const zpFinal = best.z, pelFinal = best.pel;
  const lat = seatLateral(body, cabin, pelFinal, zpFinal);
  zp = zpFinal; pelvisY = pelFinal; floorY = best.fl; roof = best.roofZ;
  const sx = lat.x;
  const seatDrop = floorY + HERO.pelvisUp - pelvisY;
  if (seatDrop > 0.005) notes.push(`hero does not fit: roof allows pelvis at ${round(pelvisY, 3)} m; seat lowered by ${round(seatDrop, 3)} m (feet ${round(seatDrop, 2)} m below floor)`);
  notes.push(`seat x ${round(sx, 3)} m (${lat.rule === 'min' ? `minimum 0.42; wall rule would give ${round(lat.outer - WALL_THICKNESS - SEAT_WALL_GAP, 3)}` : 'outer half-width ' + round(lat.outer, 3) + ' - 0.06 - 0.48'})`);
  return { sx, floorY, pelvisY, zp, roofY: roof, seatDrop, notes, xRule: lat.rule, halfWidth: lat.outer };
}

// ---------------------------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------------------------

/**
 * Door region: the spec rectangle R1 (seat z -0.55..+0.75, clamped between the wheel arches, from 0.25 m
 * above the body bottom to the roof line), plus an upper extension R2 above the front wheel arch up to
 * the front edge of the side window, so the whole window belongs to the door even when the cab sits
 * over the front axle (L-shaped panel). Returns `{ rects, bound }`.
 */
export function doorRect(cfg, cabin, seat) {
  if (cfg.openCockpit) return null;
  const y0 = cabin.bodyMinY + 0.25;
  const y1 = cabin.side ? cabin.side.y1 : cabin.bodyMaxY;
  const zRear = Math.max(seat.zp - 0.55, cabin.rearArchFront + 0.05);
  const zFrontArch = Math.min(seat.zp + 0.75, cabin.frontArchRear - 0.05);
  const rects = [];
  let z0 = zRear, zEnd = zFrontArch;
  if (zFrontArch - zRear >= 0.35) rects.push({ z0: zRear, z1: zFrontArch, y0, y1 });
  const zExt = cabin.side ? cabin.side.z1 + 0.03 : zFrontArch;
  const yUpper = cabin.frontArchTop + 0.04;
  const sill = cabin.side ? cabin.side.y0 : y1;
  if (zExt - (rects.length ? zFrontArch : zRear) > 0.08 && yUpper < sill) {
    const zs = rects.length ? zFrontArch : Math.max(zRear, zExt - 1.35);
    rects.push({ z0: zs, z1: zExt, y0: rects.length ? yUpper : Math.min(yUpper, y0 > yUpper ? y0 : yUpper), y1 });
    zEnd = zExt;
    if (!rects.length) z0 = zs;
  }
  if (!rects.length) rects.push({ z0: zRear, z1: Math.max(zRear + 0.4, zFrontArch), y0, y1 });
  const bound = {
    z0: Math.min(...rects.map((r) => r.z0)), z1: Math.max(...rects.map((r) => r.z1)),
    y0: Math.min(...rects.map((r) => r.y0)), y1: Math.max(...rects.map((r) => r.y1)),
  };
  void z0; void zEnd;
  return { rects, bound };
}

export function isSideShell(soup, t, side, halfWidth) {
  const { n } = triangleNormal(soup, t);
  if (Math.abs(n[0]) <= 0.55) return false;
  const c = triangleCentroid(soup, t);
  return Math.sign(c[0]) === side && Math.abs(c[0]) > 0.3 * halfWidth;
}

/**
 * Cut the door rectangles out of the side shell. Returns the remaining body parts and the door parts
 * (still in vehicle coordinates). `rects` = { left: rect|null, right: rect|null }.
 */
export function cutDoors(body, kinds, rects, halfWidth) {
  const empty = () => ({ trim: emptySoup(), paint: emptySoup(), glass: emptySoup() });
  const bodyParts = empty();
  const doors = { left: empty(), right: empty() };
  const n = triCount(body);
  for (let t = 0; t < n; t++) {
    const kind = kinds[t];
    let handled = false;
    for (const [sideName, side] of [['left', 1], ['right', -1]]) {
      const list = rects[sideName];
      if (!list || !list.length || !isSideShell(body, t, side, halfWidth)) continue;
      let pieces = [[getVertex(body, t, 0), getVertex(body, t, 1), getVertex(body, t, 2)]];
      for (const rect of list) {
        const next = [];
        for (const poly of pieces) {
          const { inside, outside } = splitByRect(poly, rect.z0, rect.z1, rect.y0, rect.y1);
          if (inside) emitPolygon(doors[sideName][kind], inside);
          next.push(...outside);
        }
        pieces = next;
      }
      for (const piece of pieces) emitPolygon(bodyParts[kind], piece);
      handled = true;
      break;
    }
    if (!handled) pushTriangle(bodyParts[kind], getVertex(body, t, 0), getVertex(body, t, 1), getVertex(body, t, 2));
  }
  return { bodyParts, doors };
}

/** Express a door soup relative to its hinge (node-local space). */
export const doorToLocal = (soup, hinge) => scaleOffsetSoup(soup, 1, [-hinge[0], -hinge[1], -hinge[2]]);

/** Inner trim: the door's opaque triangles pushed inward, flipped, flat dark. */
export function doorTrim(local, side) {
  const out = emptySoup(true);
  const inward = -side * 0.06;
  const nTri = triCount(local);
  for (let t = 0; t < nTri; t++) {
    const a = getVertex(local, t, 0), b = getVertex(local, t, 1), c = getVertex(local, t, 2);
    const move = (v) => [v[0] + inward, v[1], v[2], -v[3], -v[4], -v[5], v[6], v[7]];
    pushTriangle(out, move(a), move(c), move(b), COLORS.liner);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Interior, seats, dashboard, steering wheel
// ---------------------------------------------------------------------------------------------

/** One visible face of a thin box (single-sided plate). */
function plate(soup, min, max, face, color) {
  const all = ['+x', '-x', '+y', '-y', '+z', '-z'];
  boxSoup(soup, min, max, color, translation(0, 0, 0), { omit: all.filter((f) => f !== face) });
}

export function buildInterior(cfg, cabin, seat, door, seatsX, body) {
  const soup = emptySoup(true);
  const I = translation(0, 0, 0);
  const { floorY, pelvisY, zp } = seat;
  const side = cabin.side;
  const wx = side ? side.wx : cabin.halfWidth * 0.75;
  // Door-card half width: inboard-most shell below the window sill.
  const wL = Math.max(0.3, (door?.innerHalfWidth ?? cabin.halfWidth * 0.85) - 0.04);
  const zFront = cabin.front ? cabin.front.zBase - 0.02 : (side ? side.z1 : 0.5) - 0.02;
  const zRear = cabin.rear ? cabin.rear.zBase + 0.03 : (side ? side.z0 - 0.15 : -0.8);
  const sill = side ? side.y0 : floorY + 0.9;
  const ceil = (seat.roofY ?? (cabin.side ? cabin.side.y1 : floorY + 1.7)) - 0.03;

  if (!cfg.openCockpit) {
    const zTop = cabin.front ? cabin.front.zTop : zFront;
    const zBack = cabin.rear ? cabin.rear.zTop : zRear;
    const yWall = cabin.front ? cabin.front.yBase : sill;
    plate(soup, [-wL, floorY - 0.02, zRear], [wL, floorY, zFront], '+y', COLORS.liner); // floor
    plate(soup, [wL, floorY, zRear], [wL + 0.02, sill, zFront], '-x', COLORS.liner); // left door card (faces the cabin)
    plate(soup, [-wL - 0.02, floorY, zRear], [-wL, sill, zFront], '+x', COLORS.liner); // right door card
    plate(soup, [-wx + 0.05, ceil, Math.min(zBack, zTop)], [wx - 0.05, ceil + 0.02, Math.max(zBack, zTop)], '-y', COLORS.liner); // headliner
    plate(soup, [-wL, floorY, zFront], [wL, yWall, zFront + 0.02], '-z', COLORS.liner); // front bulkhead
    plate(soup, [-wL, floorY, zRear - 0.02], [wL, cabin.rear ? cabin.rear.yBase : sill, zRear], '+z', COLORS.liner); // rear wall
  } else {
    // open cockpit: no liner; the cushion sits straight on the deck
  }

  // seats
  for (const sx of seatsX) {
    const tilt = rotationX(-12 * DEG);
    if (!cfg.openCockpit) boxSoup(soup, [sx - 0.18, floorY, zp - 0.12], [sx + 0.18, pelvisY - 0.22, zp + 0.2], COLORS.seat, I); // pedestal
    boxSoup(soup, [sx - 0.25, pelvisY - 0.22, zp - 0.22], [sx + 0.25, pelvisY - 0.08, zp + 0.3], COLORS.seat, I); // cushion
    boxSoup(soup, [-0.25, 0, -0.05], [0.25, 0.62, 0.05], COLORS.seat, multiply(translation(sx, pelvisY - 0.08, zp - 0.22), tilt)); // backrest
  }

  // dashboard
  const wheel = steeringWheelPose(seat, seatsX[0]);
  if (!cfg.openCockpit) {
    const dashTop = Math.max(wheel.position[1] - 0.12, seat.floorY + 0.6);
    const dz0 = wheel.position[2] + 0.17;
    const dz1 = zFront;
    if (dz1 - dz0 > 0.05) boxSoup(soup, [-wL, wheel.position[1] - 0.55, dz0], [wL, Math.min(dashTop, cabin.front ? cabin.front.yBase + 0.02 : dashTop), dz1], COLORS.dash, I);
  } else {
    // steering pod standing on the nose
    const dz = wheel.position[2] + 0.3;
    const noseHits = verticalHits(body, 0, dz).filter((y) => y < wheel.position[1] - 0.2);
    const base = noseHits.length ? noseHits[noseHits.length - 1] : seat.deckY;
    if (wheel.position[1] - 0.14 - base > 0.05) boxSoup(soup, [-0.2, base, wheel.position[2] + 0.17], [0.2, wheel.position[1] - 0.14, wheel.position[2] + 0.42], COLORS.dash, I);
  }
  return soup;
}

export function steeringWheelPose(seat, driverX) {
  const position = [driverX, seat.pelvisY + HERO.wheelUp, seat.zp + HERO.wheelForward];
  // Local +Z (the spin axis) points at the driver: back and slightly up (disc plane leans 25 deg from vertical).
  const tilt = HERO.wheelTiltDeg * DEG;
  const axis = [0, Math.sin(tilt), -Math.cos(tilt)];
  // rotation about X taking (0,0,1) -> axis
  const angle = Math.atan2(-axis[1], axis[2]); // rotationX(a): (0,0,1) -> (0,-sin a, cos a)
  const quaternion = quaternionAxisAngle([1, 0, 0], angle);
  return { position, quaternion, axis };
}

export function buildSteeringWheel() {
  const soup = emptySoup(true);
  const I = translation(0, 0, 0);
  torusSoup(soup, HERO.wheelRadius, 0.025, 16, 8, COLORS.wheel, I);
  cylinderSoup(soup, 0.05, -0.03, 0.03, 12, COLORS.wheel, I); // hub
  cylinderSoup(soup, 0.022, -0.32, -0.03, 8, COLORS.wheel, I); // column (towards the dashboard)
  for (const a of [90, 210, 330]) {
    const r = fromQuaternion(quaternionAxisAngle([0, 0, 1], a * DEG));
    boxSoup(soup, [-0.012, 0.03, -0.012], [0.012, HERO.wheelRadius - 0.01, 0.012], COLORS.wheel, r);
  }
  return soup;
}

// ---------------------------------------------------------------------------------------------
// Lamps and exhaust
// ---------------------------------------------------------------------------------------------

function meanOfTriangles(soup, list) {
  const sum = [0, 0, 0];
  let k = 0;
  for (const t of list) {
    for (const v of triangleVertices(soup, t)) { sum[0] += v[0]; sum[1] += v[1]; sum[2] += v[2]; k++; }
  }
  return k ? sum.map((v) => v / k) : null;
}

/** Head/tail lamp centres from the lamp-coloured palette strips; falls back to bbox-based guesses. */
export function findLights(body, cabin) {
  const n = triCount(body);
  const lists = { headL: [], headR: [], tailL: [], tailR: [] };
  const lowLimit = cabin.bodyMinY + (cabin.bodyMaxY - cabin.bodyMinY) * 0.62;
  for (let t = 0; t < n; t++) {
    const strip = stripOf(body, t);
    const { n: nn } = triangleNormal(body, t);
    const c = triangleCentroid(body, t);
    if (c[1] > lowLimit || Math.abs(c[0]) < 0.12) continue;
    const left = c[0] > 0;
    if (STRIPS.lights.head.includes(strip) && nn[2] > 0.3 && c[2] > 0) lists[left ? 'headL' : 'headR'].push(t);
    if (STRIPS.lights.tail.includes(strip) && nn[2] < -0.3 && c[2] < 0) lists[left ? 'tailL' : 'tailR'].push(t);
  }
  const W = cabin.halfWidth;
  const y = cabin.bodyMinY + (cabin.bodyMaxY - cabin.bodyMinY) * 0.28;
  const fb = { headL: [0.7 * W, y, cabin.zMax - 0.02], headR: [-0.7 * W, y, cabin.zMax - 0.02], tailL: [0.7 * W, y, cabin.zMin + 0.02], tailR: [-0.7 * W, y, cabin.zMin + 0.02] };
  // Lamp centre in X/Y, snapped to the outer (front-most / rear-most) face in Z.
  const pick = (k) => {
    const m = meanOfTriangles(body, lists[k]);
    if (!m) return fb[k];
    const zs = lists[k].flatMap((t) => triangleVertices(body, t).map((v) => v[2]));
    m[2] = k.startsWith('head') ? Math.max(...zs) : Math.min(...zs);
    return m;
  };
  return { head: [pick('headL'), pick('headR')], tail: [pick('tailL'), pick('tailR')], found: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])) };
}

export { appendSoup, clipPolygon, transformSoup };
