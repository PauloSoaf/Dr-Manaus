/**
 * Triangle-soup helpers for the vehicle asset pipeline.
 *
 * A soup is `{ pos:number[], nrm:number[], uv:number[], col?:number[] }` where every three vertices
 * form one triangle (pos/nrm: 3 numbers per vertex, uv: 2, col: 3 linear-RGB). Winding is CCW
 * front-facing, matching glTF.
 */
import { transformDir, transformPoint } from './mat4.mjs';

export const f32 = (v) => Math.fround(v);
export const emptySoup = (withColor = false) => ({ pos: [], nrm: [], uv: [], ...(withColor ? { col: [] } : {}) });
export const triCount = (s) => s.pos.length / 9;

/** A vertex tuple is [px,py,pz, nx,ny,nz, u,v]. */
export function getVertex(s, tri, k) {
  const i = tri * 3 + k;
  return [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2], s.nrm[i * 3], s.nrm[i * 3 + 1], s.nrm[i * 3 + 2], s.uv[i * 2], s.uv[i * 2 + 1]];
}

export function pushVertex(s, v, color) {
  s.pos.push(v[0], v[1], v[2]);
  s.nrm.push(v[3], v[4], v[5]);
  s.uv.push(v[6], v[7]);
  if (s.col) s.col.push(color[0], color[1], color[2]);
}

export function pushTriangle(s, a, b, c, color) {
  pushVertex(s, a, color); pushVertex(s, b, color); pushVertex(s, c, color);
}

export function appendSoup(dst, src) {
  for (let i = 0; i < src.pos.length; i++) dst.pos.push(src.pos[i]);
  for (let i = 0; i < src.nrm.length; i++) dst.nrm.push(src.nrm[i]);
  for (let i = 0; i < src.uv.length; i++) dst.uv.push(src.uv[i]);
  if (dst.col) {
    const n = src.pos.length / 3;
    for (let i = 0; i < n; i++) {
      if (src.col) dst.col.push(src.col[i * 3], src.col[i * 3 + 1], src.col[i * 3 + 2]);
      else dst.col.push(1, 1, 1);
    }
  }
}

/** Apply a column-major matrix (uniform scale + rotation + translation only). */
export function transformSoup(src, m) {
  const out = emptySoup(!!src.col);
  const n = src.pos.length / 3;
  for (let i = 0; i < n; i++) {
    const p = transformPoint(m, [src.pos[i * 3], src.pos[i * 3 + 1], src.pos[i * 3 + 2]]);
    const d = transformDir(m, [src.nrm[i * 3], src.nrm[i * 3 + 1], src.nrm[i * 3 + 2]]);
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    out.pos.push(p[0], p[1], p[2]);
    out.nrm.push(d[0] / l, d[1] / l, d[2] / l);
    out.uv.push(src.uv[i * 2], src.uv[i * 2 + 1]);
    if (src.col) out.col.push(src.col[i * 3], src.col[i * 3 + 1], src.col[i * 3 + 2]);
  }
  return out;
}

/** p' = p * s + t (uniform scale and translation only; normals untouched). */
export function scaleOffsetSoup(src, s, t) {
  const out = emptySoup(!!src.col);
  for (let i = 0; i < src.pos.length; i += 3) out.pos.push(src.pos[i] * s + t[0], src.pos[i + 1] * s + t[1], src.pos[i + 2] * s + t[2]);
  out.nrm = src.nrm.slice();
  out.uv = src.uv.slice();
  if (src.col) out.col = src.col.slice();
  return out;
}

export function soupBounds(s) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < s.pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = s.pos[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}

export function triangleVertices(s, t) {
  const o = t * 9;
  return [[s.pos[o], s.pos[o + 1], s.pos[o + 2]], [s.pos[o + 3], s.pos[o + 4], s.pos[o + 5]], [s.pos[o + 6], s.pos[o + 7], s.pos[o + 8]]];
}

/** Unit geometric normal and area of triangle `t`. */
export function triangleNormal(s, t) {
  const [a, b, c] = triangleVertices(s, t);
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz);
  return { n: l > 0 ? [nx / l, ny / l, nz / l] : [0, 0, 0], area: l / 2 };
}

export function triangleCentroid(s, t) {
  const [a, b, c] = triangleVertices(s, t);
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
}

export function triangleUvCentroid(s, t) {
  const o = t * 6;
  return [(s.uv[o] + s.uv[o + 2] + s.uv[o + 4]) / 3, (s.uv[o + 1] + s.uv[o + 3] + s.uv[o + 5]) / 3];
}

/** Sum of triangle areas. */
export function soupArea(s) {
  let a = 0;
  const n = triCount(s);
  for (let t = 0; t < n; t++) a += triangleNormal(s, t).area;
  return a;
}

/** Number of triangles whose winding disagrees with their vertex normals (single-sided materials need 0). */
export function windingMismatches(s) {
  let bad = 0;
  const n = triCount(s);
  for (let t = 0; t < n; t++) {
    const { n: g, area } = triangleNormal(s, t);
    if (area < 1e-10) continue;
    const o = t * 9;
    const vx = s.nrm[o] + s.nrm[o + 3] + s.nrm[o + 6], vy = s.nrm[o + 1] + s.nrm[o + 4] + s.nrm[o + 7], vz = s.nrm[o + 2] + s.nrm[o + 5] + s.nrm[o + 8];
    if (g[0] * vx + g[1] * vy + g[2] * vz <= 0) bad++;
  }
  return bad;
}

/** Copy the triangles whose index satisfies `pred(t)` into a new soup. */
export function filterSoup(s, pred) {
  const out = emptySoup(!!s.col);
  const n = triCount(s);
  for (let t = 0; t < n; t++) {
    if (!pred(t)) continue;
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k;
      pushVertex(out, getVertex(s, t, k), s.col ? [s.col[i * 3], s.col[i * 3 + 1], s.col[i * 3 + 2]] : undefined);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Polygon clipping (Sutherland-Hodgman against one axis-aligned half-space at a time)
// ---------------------------------------------------------------------------------------------

function lerpVertex(a, b, t) {
  const o = new Array(8);
  for (let i = 0; i < 8; i++) o[i] = a[i] + (b[i] - a[i]) * t;
  const l = Math.hypot(o[3], o[4], o[5]);
  if (l > 1e-9) { o[3] /= l; o[4] /= l; o[5] /= l; }
  return o;
}

function cmpPos(a, b) {
  for (let k = 0; k < 3; k++) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  return 0;
}

/**
 * Keep the part of convex `poly` where `sign * (v[axis] - bound) >= 0`. Intersections are always
 * interpolated from the lexicographically smaller endpoint so neighbouring triangles that share an
 * edge produce bit-identical cut vertices (no cracks along the door outline).
 */
export function clipPolygon(poly, axis, bound, sign) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const da = sign * (a[axis] - bound), db = sign * (b[axis] - bound);
    const aIn = da >= 0, bIn = db >= 0;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      let p = a, q = b, dp = da, dq = db;
      if (cmpPos(b, a) < 0) { p = b; q = a; dp = db; dq = da; }
      const t = dp / (dp - dq);
      const v = lerpVertex(p, q, t);
      v[axis] = bound; // exact on the cut line
      out.push(v);
    }
  }
  return out;
}

export function polygonArea(poly) {
  let ax = 0, ay = 0, az = 0;
  for (let i = 1; i + 1 < poly.length; i++) {
    const a = poly[0], b = poly[i], c = poly[i + 1];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    ax += uy * vz - uz * vy; ay += uz * vx - ux * vz; az += ux * vy - uy * vx;
  }
  return Math.hypot(ax, ay, az) / 2;
}

/** Fan-triangulate a convex polygon into `soup`, skipping slivers. Returns triangles emitted. */
export function emitPolygon(soup, poly, color, minArea = 1e-10) {
  if (poly.length < 3) return 0;
  let n = 0;
  for (let i = 1; i + 1 < poly.length; i++) {
    if (polygonArea([poly[0], poly[i], poly[i + 1]]) < minArea) continue;
    pushTriangle(soup, poly[0], poly[i], poly[i + 1], color);
    n++;
  }
  return n;
}

/**
 * Split a convex polygon against the rectangle z in [z0,z1], y in [y0,y1] (Z-Y plane).
 * Returns `{ inside: polygon|null, outside: polygon[] }`; outside pieces are convex.
 */
export function splitByRect(poly, z0, z1, y0, y1) {
  const outside = [];
  const keep = (p) => { if (p.length >= 3) outside.push(p); };
  keep(clipPolygon(poly, 2, z0, -1)); // A: z < z0
  let rest = clipPolygon(poly, 2, z0, +1);
  keep(clipPolygon(rest, 2, z1, +1)); // B: z > z1
  rest = clipPolygon(rest, 2, z1, -1);
  keep(clipPolygon(rest, 1, y0, -1)); // C: y < y0
  rest = clipPolygon(rest, 1, y0, +1);
  keep(clipPolygon(rest, 1, y1, +1)); // D: y > y1
  rest = clipPolygon(rest, 1, y1, -1);
  return { inside: rest.length >= 3 ? rest : null, outside };
}

// ---------------------------------------------------------------------------------------------
// Primitive builders (vertex colours are linear RGB)
// ---------------------------------------------------------------------------------------------

function quad(soup, p0, p1, p2, p3, n, color) {
  const v = (p, u, w) => [p[0], p[1], p[2], n[0], n[1], n[2], u, w];
  pushTriangle(soup, v(p0, 0, 0), v(p1, 1, 0), v(p2, 1, 1), color);
  pushTriangle(soup, v(p0, 0, 0), v(p2, 1, 1), v(p3, 0, 1), color);
}

/**
 * Axis-aligned box [min,max] transformed by `m` (column-major). `inward` flips winding and normals
 * so the box is visible from inside (used for liners). `omit` lists box-local faces to skip:
 * '+x','-x','+y','-y','+z','-z'.
 */
export function boxSoup(soup, min, max, color, m, { inward = false, omit = [] } = {}) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const faces = [
    ['+x', [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]],
    ['-x', [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]],
    ['+y', [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]],
    ['-y', [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]],
    ['+z', [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]],
    ['-z', [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]],
  ];
  for (const [name, ps, n0] of faces) {
    if (omit.includes(name)) continue;
    let pts = ps.map((p) => transformPoint(m, p));
    let n = transformDir(m, n0);
    const l = Math.hypot(n[0], n[1], n[2]);
    n = [n[0] / l, n[1] / l, n[2] / l];
    if (inward) { pts = [pts[3], pts[2], pts[1], pts[0]]; n = [-n[0], -n[1], -n[2]]; }
    quad(soup, pts[0], pts[1], pts[2], pts[3], n, color);
  }
}

/** Torus around local Z (axis +Z), transformed by m. */
export function torusSoup(soup, radius, tube, radial, tubular, color, m) {
  const pt = (i, j) => {
    const u = (i / radial) * Math.PI * 2, v = (j / tubular) * Math.PI * 2;
    const cx = Math.cos(u), sx = Math.sin(u);
    const r = radius + tube * Math.cos(v);
    const p = transformPoint(m, [r * cx, r * sx, tube * Math.sin(v)]);
    const n = transformDir(m, [Math.cos(v) * cx, Math.cos(v) * sx, Math.sin(v)]);
    const l = Math.hypot(n[0], n[1], n[2]);
    return [p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l, i / radial, j / tubular];
  };
  for (let i = 0; i < radial; i++) {
    for (let j = 0; j < tubular; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      pushTriangle(soup, a, b, c, color); // CCW seen from outside the tube
      pushTriangle(soup, a, c, d, color);
    }
  }
}

/** Closed cylinder along local Z from z=zA to z=zB, transformed by m. */
export function cylinderSoup(soup, radius, zA, zB, segments, color, m) {
  const ring = (k, z) => {
    const a = (k / segments) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const p = transformPoint(m, [radius * c, radius * s, z]);
    const n = transformDir(m, [c, s, 0]);
    const l = Math.hypot(n[0], n[1], n[2]);
    return [p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l, k / segments, z > zA ? 1 : 0];
  };
  for (let k = 0; k < segments; k++) {
    const a = ring(k, zA), b = ring(k + 1, zA), c = ring(k + 1, zB), d = ring(k, zB);
    pushTriangle(soup, a, b, c, color);
    pushTriangle(soup, a, c, d, color);
  }
  const axisN = transformDir(m, [0, 0, 1]);
  const al = Math.hypot(axisN[0], axisN[1], axisN[2]);
  for (const [z, sign] of [[zB, 1], [zA, -1]]) {
    const centre = transformPoint(m, [0, 0, z]);
    const nrm = [sign * axisN[0] / al, sign * axisN[1] / al, sign * axisN[2] / al];
    const cv = [centre[0], centre[1], centre[2], ...nrm, 0.5, 0.5];
    for (let k = 0; k < segments; k++) {
      const a = ring(k, z), b = ring(k + 1, z);
      const va = [a[0], a[1], a[2], ...nrm, 0, 0], vb = [b[0], b[1], b[2], ...nrm, 0, 0];
      if (sign > 0) pushTriangle(soup, cv, va, vb, color); else pushTriangle(soup, cv, vb, va, color);
    }
  }
}

/** Weld exact duplicate vertices and return typed arrays for glTF output. */
export function weldSoup(s, { withColor = false } = {}) {
  const map = new Map();
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  const n = s.pos.length / 3;
  for (let i = 0; i < n; i++) {
    const p = [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]].map(f32);
    const nn = [s.nrm[i * 3], s.nrm[i * 3 + 1], s.nrm[i * 3 + 2]].map(f32);
    const t = [s.uv[i * 2], s.uv[i * 2 + 1]].map(f32);
    const c = withColor && s.col ? [s.col[i * 3], s.col[i * 3 + 1], s.col[i * 3 + 2]].map(f32) : null;
    const key = p.join(',') + '|' + nn.join(',') + '|' + t.join(',') + (c ? '|' + c.join(',') : '');
    let id = map.get(key);
    if (id === undefined) {
      id = pos.length / 3;
      map.set(key, id);
      pos.push(...p); nrm.push(...nn); uv.push(...t);
      if (c) col.push(...c);
    }
    idx.push(id);
  }
  return {
    positions: new Float32Array(pos), normals: new Float32Array(nrm), uvs: new Float32Array(uv),
    colors: withColor && s.col ? new Float32Array(col) : null,
    indices: new Uint32Array(idx),
  };
}
