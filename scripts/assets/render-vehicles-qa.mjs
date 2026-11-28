#!/usr/bin/env node
/**
 * CPU contact sheets for the generated vehicle GLBs (reads the real output files back, so the
 * images validate the shipped assets, not the in-memory build).
 *
 *   artifacts/qa/vehicles-overview.png    side + 3/4 view, doors closed
 *   artifacts/qa/vehicles-doors-open.png  driver door open: side, 3/4 and roof-less plan view with
 *                                         markers (green = driver seat socket, cyan = passenger seat,
 *                                         magenta = steering-wheel centre)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO } from '@gltf-transform/core';
import { decodePng } from './lib/png-decode.mjs';
import { encodePng } from './lib/png.mjs';
import { SheetImage, makeCamera, project, renderPanel } from './lib/raster.mjs';
import { identity, fromQuaternion, multiply, rotationY, transformPoint, translation } from './lib/mat4.mjs';
import { emptySoup, soupBounds, transformSoup } from './lib/vehicle-geometry.mjs';
import { hexToSrgb } from './lib/vehicle-pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ascii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

function primitiveToSoup(prim) {
  const pos = prim.getAttribute('POSITION'), nrm = prim.getAttribute('NORMAL');
  const uv = prim.getAttribute('TEXCOORD_0'), col = prim.getAttribute('COLOR_0');
  const idx = prim.getIndices();
  const soup = emptySoup(!!col);
  const a = [0, 0, 0], b = [0, 0];
  const count = idx ? idx.getCount() : pos.getCount();
  for (let i = 0; i < count; i++) {
    const v = idx ? idx.getScalar(i) : i;
    pos.getElement(v, a); soup.pos.push(a[0], a[1], a[2]);
    nrm.getElement(v, a); soup.nrm.push(a[0], a[1], a[2]);
    if (uv) { uv.getElement(v, b); soup.uv.push(b[0], b[1]); } else soup.uv.push(0, 0);
    if (col) { col.getElement(v, a); soup.col.push(a[0], a[1], a[2]); }
  }
  return soup;
}

function collectItems(doc, manifestVehicle, overrides) {
  const items = [];
  const walk = (node, parent) => {
    const t = node.getTranslation();
    let rot = fromQuaternion(node.getRotation());
    if (overrides[node.getName()] !== undefined) rot = rotationY(overrides[node.getName()]);
    const world = multiply(parent, multiply(translation(t[0], t[1], t[2]), rot));
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial().getName();
        const soup = primitiveToSoup(prim);
        let item = { soup, matrix: world, mat, node: node.getName() };
        if (mat === 'colormap') item.color = 'palette';
        else if (mat === 'paint') item.color = manifestVehicle.paintColor ? hexToSrgb(manifestVehicle.paintColor) : [235, 235, 235];
        else if (mat === 'glass') { item.color = [159, 184, 200]; item.alpha = 0.35; } else item.color = 'vertex';
        items.push(item);
      }
    }
    for (const c of node.listChildren()) walk(c, world);
  };
  for (const n of doc.getRoot().listScenes()[0].listChildren()) walk(n, identity());
  return items;
}

function itemsBounds(items) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const it of items) {
    const b = soupBounds(transformSoup(it.soup, it.matrix));
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); }
  }
  return { min, max };
}

function fitCamera(az, el, bounds, vp, margin = 0.9) {
  const centre = bounds.min.map((v, k) => (v + bounds.max[k]) / 2);
  const cam0 = makeCamera({ azimuth: az, elevation: el, target: centre, scale: 1 });
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const p = project(cam0, { x: 0, y: 0, w: 0, h: 0 }, [x, y, z]);
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, -p[1]); maxY = Math.max(maxY, -p[1]);
  }
  const scale = Math.min((vp.w * margin) / (maxX - minX), (vp.h * 0.8) / (maxY - minY));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const target = centre.map((v, k) => v + cam0.right[k] * cx + cam0.up[k] * cy);
  return makeCamera({ azimuth: az, elevation: el, target, scale });
}

const DEG = Math.PI / 180;

export async function renderVehicleSheets({ outDir, qaDir }) {
  const io = new NodeIO();
  io.setLogger(new Logger(Logger.Verbosity.ERROR));
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'vehicles.json'), 'utf8'));
  fs.mkdirSync(qaDir, { recursive: true });
  const loaded = [];
  let palette = null;
  for (const v of manifest.vehicles) {
    const doc = await io.read(path.join(outDir, v.file));
    if (!palette) palette = decodePng(Buffer.from(doc.getRoot().listTextures()[0].getImage()));
    loaded.push({ v, doc });
  }

  const sheet = (name, panelsPerVehicle, pw, ph, specs) => {
    const perRow = 2;
    const rows = Math.ceil(loaded.length / perRow);
    const img = new SheetImage(pw * panelsPerVehicle * perRow, ph * rows);
    loaded.forEach(({ v, doc }, i) => {
      const col = i % perRow, row = Math.floor(i / perRow);
      const open = specs.open ? { 'door-front-left': v.doors[0].openAngle } : {};
      const items = collectItems(doc, v, open);
      const closedBounds = itemsBounds(collectItems(doc, v, {}));
      specs.views.forEach((view, k) => {
        const vp = { x: (col * panelsPerVehicle + k) * pw, y: row * ph, w: pw, h: ph };
        const bounds = view.plan ? { min: [closedBounds.min[0], 0, closedBounds.min[2]], max: [closedBounds.max[0], 0.2, closedBounds.max[2]] } : specs.open ? itemsBounds(items) : closedBounds;
        const cam = fitCamera(view.az * DEG, view.el * DEG, bounds, vp);
        const pelvisY = v.seats[0].position[1];
        const skip = view.plan ? (item, t, c) => c[1] > pelvisY + 0.75 : null;
        renderPanel(img, vp, cam, items, { palette, skip });
        img.rectOutline(vp.x, vp.y, vp.w - 1, vp.h - 1, [20, 22, 26]);
        if (specs.open) {
          const mark = (p, c) => { const q = project(cam, vp, p); img.cross(q[0], q[1], 7, c, 2); };
          mark(v.seats[0].position, [0, 255, 0]);
          if (v.seats[1]) mark(v.seats[1].position, [0, 230, 255]);
          mark(v.steeringWheel.position, [255, 0, 255]);
        }
        if (k === 0) {
          img.text(`${v.id} ${ascii(v.label)}`, vp.x + 6, vp.y + 6, [255, 255, 255], 2);
          img.text(`${v.dimensions[2].toFixed(2)}L ${v.dimensions[0].toFixed(2)}W ${v.dimensions[1].toFixed(2)}H S${v.scale}`, vp.x + 6, vp.y + 20, [190, 200, 215], 2);
        } else if (view.tag) img.text(view.tag, vp.x + 6, vp.y + 6, [190, 200, 215], 2);
      });
    });
    fs.writeFileSync(path.join(qaDir, name), encodePng(img.width, img.height, img.rgb));
    return path.join(qaDir, name);
  };

  const a = sheet('vehicles-overview.png', 2, 360, 250, { open: false, views: [{ az: 90, el: 5 }, { az: 38, el: 24, tag: '3/4' }] });
  const b = sheet('vehicles-doors-open.png', 3, 300, 250, { open: true, views: [{ az: 90, el: 14 }, { az: 58, el: 36, tag: '3/4' }, { az: 90, el: 84, plan: true, tag: 'PLAN NO ROOF' }] });
  console.log(`QA sheets: ${a}\n           ${b}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await renderVehicleSheets({ outDir: path.join(ROOT, 'public', 'assets', 'vehicles'), qaDir: path.join(ROOT, 'artifacts', 'qa') });
}
