/**
 * Small CPU rasteriser used to produce QA contact sheets of the vehicle GLBs. Orthographic camera,
 * z-buffer, flat shading, 2x2 supersampling, translucent pass for glass, 2D overlay helpers.
 */
import { transformDir, transformPoint } from './mat4.mjs';
import { triCount, triangleUvCentroid } from './vehicle-geometry.mjs';

export class SheetImage {
  constructor(width, height, background = [24, 27, 33]) {
    this.width = width;
    this.height = height;
    this.rgb = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) { this.rgb[i * 3] = background[0]; this.rgb[i * 3 + 1] = background[1]; this.rgb[i * 3 + 2] = background[2]; }
  }

  fillRect(x, y, w, h, c) {
    for (let j = Math.max(0, y); j < Math.min(this.height, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(this.width, x + w); i++) {
        const o = (j * this.width + i) * 3;
        this.rgb[o] = c[0]; this.rgb[o + 1] = c[1]; this.rgb[o + 2] = c[2];
      }
    }
  }

  pixel(x, y, c, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const o = (y * this.width + x) * 3;
    this.rgb[o] = this.rgb[o] * (1 - a) + c[0] * a;
    this.rgb[o + 1] = this.rgb[o + 1] * (1 - a) + c[1] * a;
    this.rgb[o + 2] = this.rgb[o + 2] * (1 - a) + c[2] * a;
  }

  line(x0, y0, x1, y1, c, thickness = 1) {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
      for (let a = 0; a < thickness; a++) for (let b = 0; b < thickness; b++) this.pixel(x + a - (thickness - 1) / 2, y + b - (thickness - 1) / 2, c);
    }
  }

  cross(x, y, r, c, thickness = 2) {
    this.line(x - r, y, x + r, y, c, thickness);
    this.line(x, y - r, x, y + r, c, thickness);
  }

  rectOutline(x, y, w, h, c) {
    this.line(x, y, x + w, y, c); this.line(x + w, y, x + w, y + h, c);
    this.line(x + w, y + h, x, y + h, c); this.line(x, y + h, x, y, c);
  }

  text(str, x, y, c, scale = 2) {
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const g = FONT[ch] ?? FONT['?'];
      for (let r = 0; r < 5; r++) {
        for (let k = 0; k < 3; k++) {
          if (g[r][k] === '#') this.fillRect(cx + k * scale, y + r * scale, scale, scale, c);
        }
      }
      cx += 4 * scale;
    }
  }
}

// 3x5 bitmap font (ASCII subset).
const FONT = (() => {
  const raw = {
    A: ['###', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['###', '#..', '#..', '#..', '###'],
    D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
    G: ['###', '#..', '#.#', '#.#', '###'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
    J: ['..#', '..#', '..#', '#.#', '###'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
    M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'],
    P: ['###', '#.#', '###', '#..', '#..'], Q: ['###', '#.#', '#.#', '###', '..#'], R: ['###', '#.#', '##.', '#.#', '#.#'],
    S: ['###', '#..', '###', '..#', '###'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
    V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
    3: ['###', '..#', '###', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
    6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '..#', '..#'], 8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '###'],
    '.': ['...', '...', '...', '...', '.#.'], ',': ['...', '...', '...', '.#.', '#..'], '-': ['...', '...', '###', '...', '...'],
    _: ['...', '...', '...', '...', '###'], ' ': ['...', '...', '...', '...', '...'], ':': ['...', '.#.', '...', '.#.', '...'],
    '/': ['..#', '..#', '.#.', '#..', '#..'], '+': ['...', '.#.', '###', '.#.', '...'], '=': ['...', '###', '...', '###', '...'],
    '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'], '?': ['###', '..#', '.#.', '...', '.#.'],
    '*': ['#.#', '.#.', '###', '.#.', '#.#'], '%': ['#.#', '..#', '.#.', '#..', '#.#'], '<': ['..#', '.#.', '#..', '.#.', '..#'],
    '>': ['#..', '.#.', '..#', '.#.', '#..'], '[': ['##.', '#..', '#..', '#..', '##.'], ']': ['.##', '..#', '..#', '..#', '.##'],
  };
  return raw;
})();

/** Orthographic camera from azimuth/elevation (radians). Azimuth 90deg looks at the car's left (+X) side. */
export function makeCamera({ azimuth, elevation, target, scale }) {
  const d = [Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth)];
  const up0 = [0, 1, 0];
  let right = [up0[1] * d[2] - up0[2] * d[1], up0[2] * d[0] - up0[0] * d[2], up0[0] * d[1] - up0[1] * d[0]];
  let l = Math.hypot(...right);
  if (l < 1e-6) { right = [1, 0, 0]; l = 1; }
  right = right.map((v) => v / l);
  const up = [d[1] * right[2] - d[2] * right[1], d[2] * right[0] - d[0] * right[2], d[0] * right[1] - d[1] * right[0]];
  return { d, right, up, target, scale };
}

/** Project a world point to panel pixels; returns [x, y, depth]. */
export function project(camera, vp, p) {
  const q = [p[0] - camera.target[0], p[1] - camera.target[1], p[2] - camera.target[2]];
  const x = q[0] * camera.right[0] + q[1] * camera.right[1] + q[2] * camera.right[2];
  const y = q[0] * camera.up[0] + q[1] * camera.up[1] + q[2] * camera.up[2];
  const z = q[0] * camera.d[0] + q[1] * camera.d[1] + q[2] * camera.d[2];
  return [vp.x + vp.w / 2 + x * camera.scale, vp.y + vp.h / 2 - y * camera.scale, z];
}

const paletteCache = new WeakMap();

/** Per-triangle sRGB colour (0..255) sampled from the palette at the UV centroid. */
export function paletteColors(soup, palette) {
  let cache = paletteCache.get(soup);
  if (cache && cache.n === triCount(soup)) return cache.colors;
  const n = triCount(soup);
  const colors = new Array(n);
  for (let t = 0; t < n; t++) {
    const [u, v] = triangleUvCentroid(soup, t);
    const x = Math.min(palette.width - 1, Math.max(0, Math.floor(u * palette.width)));
    const y = Math.min(palette.height - 1, Math.max(0, Math.floor(v * palette.height)));
    const i = (y * palette.width + x) * 4;
    colors[t] = [palette.data[i], palette.data[i + 1], palette.data[i + 2]];
  }
  paletteCache.set(soup, { n, colors });
  return colors;
}

const srgbOf = (lin) => 255 * (lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055);

/**
 * Items: `{ soup, matrix?, color: 'palette' | [r,g,b] (0..255) | 'vertex', alpha?, tint?: [r,g,b] }`.
 * `tint` multiplies palette colours (used to preview the paint mesh with a car colour).
 * Options: `skip(item, tri, centroid)` can hide triangles (cutaway views).
 */
export function renderPanel(img, vp, camera, items, { palette, background = [52, 58, 68], supersample = 2, skip = null, lightDir = [0.35, 0.8, 0.5] } = {}) {
  const W = vp.w * supersample, H = vp.h * supersample;
  const color = new Float32Array(W * H * 3);
  const depth = new Float32Array(W * H).fill(-Infinity);
  const bgTop = background, bgBot = background.map((v) => v * 0.7);
  for (let y = 0; y < H; y++) {
    const f = y / H;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      color[o] = bgTop[0] * (1 - f) + bgBot[0] * f; color[o + 1] = bgTop[1] * (1 - f) + bgBot[1] * f; color[o + 2] = bgTop[2] * (1 - f) + bgBot[2] * f;
    }
  }
  const L = (() => {
    const l = [lightDir[0] * camera.right[0] + lightDir[1] * camera.up[0] + lightDir[2] * camera.d[0], lightDir[0] * camera.right[1] + lightDir[1] * camera.up[1] + lightDir[2] * camera.d[1], lightDir[0] * camera.right[2] + lightDir[1] * camera.up[2] + lightDir[2] * camera.d[2]];
    const n = Math.hypot(...l);
    return l.map((v) => v / n);
  })();
  const toScreen = (p) => {
    const q = project(camera, { x: 0, y: 0, w: vp.w, h: vp.h }, p);
    return [q[0] * supersample, q[1] * supersample, q[2]];
  };

  const tris = [];
  for (const item of items) {
    const soup = item.soup;
    const n = triCount(soup);
    const base = item.color === 'palette' ? paletteColors(soup, palette) : null;
    for (let t = 0; t < n; t++) {
      const o = t * 9;
      let p0 = [soup.pos[o], soup.pos[o + 1], soup.pos[o + 2]], p1 = [soup.pos[o + 3], soup.pos[o + 4], soup.pos[o + 5]], p2 = [soup.pos[o + 6], soup.pos[o + 7], soup.pos[o + 8]];
      if (item.matrix) { p0 = transformPoint(item.matrix, p0); p1 = transformPoint(item.matrix, p1); p2 = transformPoint(item.matrix, p2); }
      if (skip) {
        const c = [(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3, (p0[2] + p1[2] + p2[2]) / 3];
        if (skip(item, t, c, [p0, p1, p2])) continue;
      }
      let c;
      if (item.color === 'palette') c = base[t].slice();
      else if (item.color === 'vertex') {
        const i = t * 9;
        c = [0, 1, 2].map((k) => srgbOf((soup.col[i + k] + soup.col[i + 3 + k] + soup.col[i + 6 + k]) / 3));
      } else c = item.color.slice();
      if (item.tint) c = c.map((v, k) => v * item.tint[k] / 255);
      tris.push({ p: [p0, p1, p2], c, alpha: item.alpha ?? 1 });
    }
  }

  const opaque = tris.filter((t) => t.alpha >= 1);
  const glass = tris.filter((t) => t.alpha < 1);
  const draw = (tr, write) => {
    const s0 = toScreen(tr.p[0]), s1 = toScreen(tr.p[1]), s2 = toScreen(tr.p[2]);
    const area = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
    if (Math.abs(area) < 1e-9) return;
    // World normal for shading, flipped to face the viewer.
    const ux = tr.p[1][0] - tr.p[0][0], uy = tr.p[1][1] - tr.p[0][1], uz = tr.p[1][2] - tr.p[0][2];
    const vx = tr.p[2][0] - tr.p[0][0], vy = tr.p[2][1] - tr.p[0][1], vz = tr.p[2][2] - tr.p[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const facing = nx * camera.d[0] + ny * camera.d[1] + nz * camera.d[2];
    if (facing < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const viewN = [nx * camera.right[0] + ny * camera.right[1] + nz * camera.right[2], nx * camera.up[0] + ny * camera.up[1] + nz * camera.up[2], nx * camera.d[0] + ny * camera.d[1] + nz * camera.d[2]];
    const lam = Math.max(0, viewN[0] * L[0] + viewN[1] * L[1] + viewN[2] * L[2]);
    const shade = 0.42 + 0.62 * lam;
    const r = Math.min(255, tr.c[0] * shade), g = Math.min(255, tr.c[1] * shade), b = Math.min(255, tr.c[2] * shade);
    const minX = Math.max(0, Math.floor(Math.min(s0[0], s1[0], s2[0]))), maxX = Math.min(W - 1, Math.ceil(Math.max(s0[0], s1[0], s2[0])));
    const minY = Math.max(0, Math.floor(Math.min(s0[1], s1[1], s2[1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(s0[1], s1[1], s2[1])));
    const inv = 1 / area;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((s1[0] - px) * (s2[1] - py) - (s2[0] - px) * (s1[1] - py)) * inv;
        const w1 = ((s2[0] - px) * (s0[1] - py) - (s0[0] - px) * (s2[1] - py)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * s0[2] + w1 * s1[2] + w2 * s2[2];
        const di = y * W + x;
        if (z <= depth[di]) continue;
        const o = di * 3;
        if (write) {
          depth[di] = z;
          color[o] = r; color[o + 1] = g; color[o + 2] = b;
        } else {
          const a = tr.alpha;
          color[o] = color[o] * (1 - a) + r * a; color[o + 1] = color[o + 1] * (1 - a) + g * a; color[o + 2] = color[o + 2] * (1 - a) + b * a;
        }
      }
    }
  };
  for (const tr of opaque) draw(tr, true);
  glass.sort((a, b) => {
    const da = (a.p[0][0] + a.p[1][0] + a.p[2][0]) * camera.d[0] + (a.p[0][1] + a.p[1][1] + a.p[2][1]) * camera.d[1] + (a.p[0][2] + a.p[1][2] + a.p[2][2]) * camera.d[2];
    const db = (b.p[0][0] + b.p[1][0] + b.p[2][0]) * camera.d[0] + (b.p[0][1] + b.p[1][1] + b.p[2][1]) * camera.d[1] + (b.p[0][2] + b.p[1][2] + b.p[2][2]) * camera.d[2];
    return da - db;
  });
  for (const tr of glass) draw(tr, false);

  // Downsample into the sheet.
  const ss = supersample;
  for (let y = 0; y < vp.h; y++) {
    for (let x = 0; x < vp.w; x++) {
      let r = 0, g = 0, b = 0;
      for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
        const o = ((y * ss + j) * W + x * ss + i) * 3;
        r += color[o]; g += color[o + 1]; b += color[o + 2];
      }
      const o = ((vp.y + y) * img.width + vp.x + x) * 3;
      img.rgb[o] = Math.round(r / (ss * ss)); img.rgb[o + 1] = Math.round(g / (ss * ss)); img.rgb[o + 2] = Math.round(b / (ss * ss));
    }
  }
}

/** Draw a ground line (y=0) across the panel for orientation. */
export function drawGround(img, camera, vp, halfExtent, c = [90, 96, 108]) {
  const a = project(camera, vp, [-halfExtent, 0, 0]), b = project(camera, vp, [halfExtent, 0, 0]);
  const e = project(camera, vp, [0, 0, -halfExtent]), f = project(camera, vp, [0, 0, halfExtent]);
  img.line(a[0], a[1], b[0], b[1], c);
  img.line(e[0], e[1], f[0], f[1], c);
}
