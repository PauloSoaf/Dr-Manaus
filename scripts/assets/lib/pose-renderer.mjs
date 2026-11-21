/**
 * Offline pose renderer: skins a glTF character on the CPU and rasterises flat-shaded front, side
 * and top views into a PNG contact sheet. It exists so animation work can be judged by looking at
 * the authored motion itself, frame by frame, without a browser or GPU.
 *
 * Vertex colour encodes the dominant bone: anatomical LEFT limbs are orange, RIGHT limbs are blue,
 * torso grey, head pale. A kick or a punch is therefore unambiguous about which side moved.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { encodePng } from './png.mjs';

export async function loadGltf(path) {
  const data = readFileSync(path);
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
}

const plain = name => name.replace(/[.\s_-]/g, '').toLowerCase();
const LIMB = /(thigh|calf|foot|ball|toe|leg|upperarm|lowerarm|hand|clavicle|shoulder|arm|wrist|index|middle|ring|pinky|thumb)/;
const LEG = /(thigh|calf|foot|ball|toe|leg)/;
function boneColour(name) {
  const n = plain(name);
  const left = /(l|left)$/.test(n) && LIMB.test(n);
  const right = /(r|right)$/.test(n) && LIMB.test(n);
  if (left) return LEG.test(n) ? [235, 130, 40] : [250, 175, 70];
  if (right) return LEG.test(n) ? [40, 110, 230] : [80, 165, 250];
  if (/head|neck/.test(n)) return [225, 215, 200];
  return [150, 150, 158];
}

/** Collects the skinned meshes of a scene with per-vertex colours from the dominant bone. */
export function prepareSkinned(scene) {
  const meshes = [];
  scene.traverse(object => {
    if (!object.isSkinnedMesh) return;
    const geometry = object.geometry;
    const position = geometry.attributes.position, skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
    const colours = new Uint8Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      let best = 0, bestWeight = -1;
      for (let k = 0; k < 4; k++) {
        const w = skinWeight.getComponent(i, k);
        if (w > bestWeight) { bestWeight = w; best = skinIndex.getComponent(i, k); }
      }
      const c = boneColour(object.skeleton.bones[best]?.name ?? '');
      colours[i * 3] = c[0]; colours[i * 3 + 1] = c[1]; colours[i * 3 + 2] = c[2];
    }
    const index = geometry.index ? geometry.index.array : Uint32Array.from({ length: position.count }, (_, i) => i);
    meshes.push({ mesh: object, colours, index, world: new Float32Array(position.count * 3) });
  });
  return meshes;
}

const tmp = new Vector3();
/** Skins every vertex into world space using the current bone matrices. */
export function skinToWorld(prepared) {
  for (const entry of prepared) {
    const { mesh, world } = entry;
    const position = mesh.geometry.attributes.position;
    mesh.updateMatrixWorld(true);
    for (let i = 0; i < position.count; i++) {
      tmp.fromBufferAttribute(position, i);
      mesh.applyBoneTransform(i, tmp);
      tmp.applyMatrix4(mesh.matrixWorld);
      world[i * 3] = tmp.x; world[i * 3 + 1] = tmp.y; world[i * 3 + 2] = tmp.z;
    }
  }
}

export const VIEWS = {
  // Camera in front of a +Z-facing character, looking back along -Z.
  front: { right: [1, 0, 0], up: [0, 1, 0], dir: [0, 0, -1] },
  // Camera on the character's right side (-X), so the character faces screen right.
  side: { right: [0, 0, 1], up: [0, 1, 0], dir: [1, 0, 0] },
  // Camera above, the character's forward (+Z) pointing screen up.
  top: { right: [1, 0, 0], up: [0, 0, 1], dir: [0, -1, 0] },
};

export class Sheet {
  constructor(columns, rows, panelWidth, panelHeight) {
    Object.assign(this, { columns, rows, panelWidth, panelHeight });
    this.width = columns * panelWidth; this.height = rows * panelHeight;
    this.rgb = Buffer.alloc(this.width * this.height * 3);
    this.depth = new Float32Array(this.width * this.height).fill(Infinity);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const o = (y * this.width + x) * 3, checker = (Math.floor(x / this.panelWidth) + Math.floor(y / this.panelHeight)) % 2;
      this.rgb[o] = this.rgb[o + 1] = this.rgb[o + 2] = checker ? 34 : 28;
    }
  }
  pixel(x, y, r, g, b) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const o = (y * this.width + x) * 3; this.rgb[o] = r; this.rgb[o + 1] = g; this.rgb[o + 2] = b;
  }
  /** Ground line and a panel border, drawn before the figure. */
  decorate(column, row, view, scale, centre) {
    const ox = column * this.panelWidth, oy = row * this.panelHeight;
    for (let x = 0; x < this.panelWidth; x++) this.pixel(ox + x, oy, 70, 70, 80);
    for (let y = 0; y < this.panelHeight; y++) this.pixel(ox, oy + y, 70, 70, 80);
    if (view !== 'top') {
      const groundY = Math.round(oy + this.panelHeight / 2 - (0 - centre[1]) * scale);
      for (let x = 0; x < this.panelWidth; x++) this.pixel(ox + x, groundY, 90, 140, 90);
    }
  }
  /** Rasterises the skinned triangles of every prepared mesh into one panel. */
  drawPanel(column, row, prepared, view, scale, centre) {
    const v = VIEWS[view];
    const ox = column * this.panelWidth, oy = row * this.panelHeight, w = this.panelWidth, h = this.panelHeight;
    const light = [0.35, 0.8, 0.5]; const ll = Math.hypot(...light); light[0] /= ll; light[1] /= ll; light[2] /= ll;
    const sx = new Float32Array(3), sy = new Float32Array(3), sz = new Float32Array(3), ids = [0, 0, 0];
    for (const { world, index, colours } of prepared) {
      for (let t = 0; t < index.length; t += 3) {
        const ia = index[t], ib = index[t + 1], ic = index[t + 2];
        ids[0] = ia; ids[1] = ib; ids[2] = ic;
        for (let k = 0; k < 3; k++) {
          const i = ids[k] * 3, px = world[i] - centre[0], py = world[i + 1] - centre[1], pz = world[i + 2] - centre[2];
          sx[k] = ox + w / 2 + (px * v.right[0] + py * v.right[1] + pz * v.right[2]) * scale;
          sy[k] = oy + h / 2 - (px * v.up[0] + py * v.up[1] + pz * v.up[2]) * scale;
          sz[k] = px * v.dir[0] + py * v.dir[1] + pz * v.dir[2];
        }
        const ax = world[ib * 3] - world[ia * 3], ay = world[ib * 3 + 1] - world[ia * 3 + 1], az = world[ib * 3 + 2] - world[ia * 3 + 2];
        const bx = world[ic * 3] - world[ia * 3], by = world[ic * 3 + 1] - world[ia * 3 + 1], bz = world[ic * 3 + 2] - world[ia * 3 + 2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const shade = 0.32 + 0.68 * Math.abs(nx * light[0] + ny * light[1] + nz * light[2]);
        const r = colours[ia * 3] * shade, g = colours[ia * 3 + 1] * shade, b = colours[ia * 3 + 2] * shade;
        const minX = Math.max(ox, Math.floor(Math.min(sx[0], sx[1], sx[2]))), maxX = Math.min(ox + w - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
        const minY = Math.max(oy, Math.floor(Math.min(sy[0], sy[1], sy[2]))), maxY = Math.min(oy + h - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
        const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
        if (Math.abs(area) < 1e-9) continue;
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((sx[1] - px) * (sy[2] - py) - (sx[2] - px) * (sy[1] - py)) / area;
          const w1 = ((sx[2] - px) * (sy[0] - py) - (sx[0] - px) * (sy[2] - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const depth = w0 * sz[0] + w1 * sz[1] + w2 * sz[2], o = y * this.width + x;
          if (depth >= this.depth[o]) continue;
          this.depth[o] = depth;
          const p = o * 3; this.rgb[p] = r; this.rgb[p + 1] = g; this.rgb[p + 2] = b;
        }
      }
    }
  }
  /** Small marker (e.g. a contact point) projected into a panel, drawn on top. */
  mark(column, row, point, view, scale, centre, colour = [255, 60, 60], size = 2) {
    const v = VIEWS[view], ox = column * this.panelWidth, oy = row * this.panelHeight;
    const px = point.x - centre[0], py = point.y - centre[1], pz = point.z - centre[2];
    const x = Math.round(ox + this.panelWidth / 2 + (px * v.right[0] + py * v.right[1] + pz * v.right[2]) * scale);
    const y = Math.round(oy + this.panelHeight / 2 - (px * v.up[0] + py * v.up[1] + pz * v.up[2]) * scale);
    for (let dy = -size; dy <= size; dy++) for (let dx = -size; dx <= size; dx++) this.pixel(x + dx, y + dy, ...colour);
  }
  save(path) { writeFileSync(path, encodePng(this.width, this.height, this.rgb)); }
}

/**
 * Renders `clip` on `scene` at the given clip times. Each time is a column; each view is a row.
 * `onFrame(time, column)` may move the scene (e.g. apply root motion) or return markers to draw.
 */
export function renderClipSheet(scene, clip, { times, views = ['front', 'side'], panelWidth = 180, panelHeight = 240, heightMeters = 2.6, centre = [0, 1.05, 0], onFrame } = {}) {
  const prepared = prepareSkinned(scene);
  const mixer = new AnimationMixer(scene);
  const action = clip ? mixer.clipAction(clip) : null;
  action?.play();
  const sheet = new Sheet(times.length, views.length, panelWidth, panelHeight);
  const scale = panelHeight / heightMeters;
  times.forEach((time, column) => {
    if (action) mixer.setTime(Math.min(time, Math.max(0, clip.duration - 1e-4)));
    scene.updateMatrixWorld(true);
    const markers = onFrame?.(time, column) ?? [];
    scene.updateMatrixWorld(true);
    skinToWorld(prepared);
    views.forEach((view, row) => {
      sheet.decorate(column, row, view, scale, centre);
      sheet.drawPanel(column, row, prepared, view, scale, centre);
      for (const m of markers) sheet.mark(column, row, m.point, view, scale, centre, m.colour, m.size);
    });
  });
  mixer.stopAllAction(); mixer.uncacheRoot(scene);
  return sheet;
}
