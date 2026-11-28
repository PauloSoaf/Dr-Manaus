#!/usr/bin/env node
/**
 * Vehicle asset pipeline: Kenney Car Kit (CC0) -> game-ready GLBs with real door panels, glass, a
 * simple interior and metadata sockets, plus a manifest and QA contact sheets.
 *
 *   node scripts/assets/build-vehicles.mjs [--no-qa]
 *   (override the source folder with KENNEY_CAR_KIT_GLB_DIR; exits 0 with "source pack absent" if missing)
 *
 * Input : artifacts/downloads/kenney-car-kit/Models/GLB format/*.glb (+ Textures/colormap.png)
 * Output: public/assets/vehicles/<id>.glb, <id>-lod1.glb, vehicles.json, docs/assets/CREDITS.md section,
 *         artifacts/qa/vehicles-overview.png and vehicles-doors-open.png
 *
 * Conventions (vehicle frame, metres): +Z forward, +Y up, +X is the car's LEFT (driver side, Brazil).
 * Door nodes sit at the hinge (front edge); `node.rotation.y = door.openAngle` opens the door outward.
 * The `steering-wheel` node's local +Z is the spin axis and points at the driver.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Logger } from '@gltf-transform/core';
import { decodePng } from './lib/png-decode.mjs';
import { readKenneyVehicle } from './lib/kenney-source.mjs';
import { writeVehicleGlb } from './lib/vehicle-gltf.mjs';
import { DERIVATION, HERO, MISSING_CATEGORIES, PACK, VEHICLES } from './lib/vehicle-config.mjs';
import {
  analyseCabin, buildInterior, buildSteeringWheel, classify, cutDoors, doorRect, doorToLocal, doorTrim, findLights,
  lateralHits, normalise, placeSeats, roundVec, steeringWheelPose,
} from './lib/vehicle-pipeline.mjs';
import { emptySoup, soupBounds, transformSoup, triCount, appendSoup, filterSoup, soupArea, windingMismatches } from './lib/vehicle-geometry.mjs';
import { translation } from './lib/mat4.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_DIR = process.env.KENNEY_CAR_KIT_GLB_DIR
  ? path.resolve(process.env.KENNEY_CAR_KIT_GLB_DIR)
  : path.join(ROOT, 'artifacts', 'downloads', 'kenney-car-kit', 'Models', 'GLB format');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'vehicles');
const CREDITS = path.join(ROOT, 'docs', 'assets', 'CREDITS.md');
const QA_DIR = path.join(ROOT, 'artifacts', 'qa');

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const rv = (v) => v.map(r4);

function wheelFlags(drive, name) {
  const front = name.includes('front');
  const driven = drive === 'all' || (drive === 'front' ? front : !front);
  return { steer: front, drive: driven };
}

async function buildVehicle(cfg, palette, paletteBytes) {
  const src = await readKenneyVehicle(path.join(SRC_DIR, `${cfg.src}.glb`));
  const { body, wheels } = normalise(cfg, src);
  const { kinds, paintable, paintColor } = classify(cfg, body, palette);
  const cabin = analyseCabin(cfg, body, kinds, wheels);
  const seat = placeSeats(cfg, body, cabin);
  const doorDef = doorRect(cfg, cabin, seat);
  const rect = doorDef ? doorDef.bound : null;
  const driverX = seat.sx;
  const seatsX = cfg.openCockpit ? [driverX] : [driverX, -driverX];
  const notes = [...seat.notes];

  // --- door cutting -----------------------------------------------------------------------
  const rects = doorDef ? { left: doorDef.rects, right: doorDef.rects } : { left: null, right: null };
  const { bodyParts, doors } = cutDoors(body, kinds, rects, cabin.halfWidth);
  const doorInfo = {};
  for (const [sideName, side] of [['left', 1], ['right', -1]]) {
    const parts = doors[sideName];
    const all = emptySoup();
    for (const k of ['trim', 'paint', 'glass']) appendSoup(all, parts[k]);
    let hinge, handle, innerHalfWidth = cabin.halfWidth * 0.85;
    if (rect && triCount(all) > 0) {
      let sum = 0, cnt = 0, minInner = Infinity;
      for (let i = 0; i < all.pos.length; i += 3) {
        if (all.pos[i + 2] > rect.z1 - 0.12) { sum += Math.abs(all.pos[i]); cnt++; }
      }
      for (const k of ['trim', 'paint']) {
        const s = parts[k];
        for (let i = 0; i < s.pos.length; i += 3) {
          if (s.pos[i + 1] < (cabin.side ? cabin.side.y0 : 1)) minInner = Math.min(minInner, Math.abs(s.pos[i]));
        }
      }
      if (Number.isFinite(minInner)) innerHalfWidth = minInner;
      hinge = [side * (cnt ? sum / cnt : cabin.halfWidth), (rect.y0 + rect.y1) / 2, rect.z1];
      const lowRect = doorDef.rects.reduce((a, b) => (b.y0 < a.y0 ? b : a));
      const hy = Math.max(seat.floorY + 0.55, lowRect.y0 + 0.1), hz = lowRect.z0 + 0.12;
      const hits = lateralHits(all, hy, hz).filter((x) => Math.sign(x) === side);
      const hx = hits.length ? side * Math.max(...hits.map(Math.abs)) : hinge[0];
      handle = [hx, hy, hz];
    } else {
      // Open cockpit / no panel: empty door node at the cockpit side.
      hinge = [side * cabin.halfWidth * 0.55, seat.floorY + 0.4, seat.zp + 0.2];
      handle = [side * cabin.halfWidth * 0.55, seat.floorY + 0.55, seat.zp - 0.2];
      if (!rect) notes.push('open cockpit: door nodes are empty (no panel to open)');
    }
    const entry = [handle[0] + side * 0.75, 0, handle[2] - 0.2];
    // Outermost door-panel extent at or below elbow height (what a standing hero must stay outside of).
    let outer = seat.halfWidth;
    for (const k of ['trim', 'paint', 'glass']) {
      const sp = parts[k];
      for (let i = 0; i < sp.pos.length; i += 3) if (sp.pos[i + 1] <= seat.pelvisY + 0.25) outer = Math.max(outer, Math.abs(sp.pos[i]));
    }
    doorInfo[sideName] = { parts, hinge, handle, entry, innerHalfWidth, side, outer };
  }

  // --- interior -----------------------------------------------------------------------------
  const interior = buildInterior(cfg, cabin, seat, { innerHalfWidth: doorInfo.left.innerHalfWidth }, seatsX, body);
  const wheelPose = steeringWheelPose(seat, driverX);
  const wheelSoup = buildSteeringWheel();

  // --- integrity: the cut must conserve the shell area exactly (no holes, no overlaps) ----------------
  let cutArea = 0;
  for (const k of ['trim', 'paint', 'glass']) cutArea += soupArea(bodyParts[k]) + soupArea(doors.left[k]) + soupArea(doors.right[k]);
  const origArea = soupArea(body);
  if (Math.abs(cutArea - origArea) > 1e-4 * origArea) throw new Error(`${cfg.id}: door cut changed the shell area (${origArea} -> ${cutArea})`);
  for (const [label, soup] of [['interior', interior], ['steering wheel', wheelSoup]]) {
    const bad = windingMismatches(soup);
    if (bad) throw new Error(`${cfg.id}: ${label} has ${bad} triangles whose winding disagrees with the normals`);
  }

  // --- nodes ----------------------------------------------------------------------------------
  const nodes = [];
  nodes.push({ name: 'body', prims: [{ soup: bodyParts.trim, mat: 'colormap' }] });
  if (paintable) nodes.push({ name: 'paint', prims: [{ soup: bodyParts.paint, mat: 'paint' }] });
  nodes.push({ name: 'glass', prims: [{ soup: bodyParts.glass, mat: 'glass', uv: false }] });
  nodes.push({ name: 'interior', prims: [{ soup: interior, mat: 'interior', uv: false, color: true }] });
  nodes.push({ name: 'steering-wheel', translation: wheelPose.position, rotation: wheelPose.quaternion, prims: [{ soup: wheelSoup, mat: 'interior', uv: false, color: true }] });
  const doorTris = {};
  for (const [sideName, id] of [['left', 'front-left'], ['right', 'front-right']]) {
    const info = doorInfo[sideName];
    const local = {};
    for (const k of ['trim', 'paint', 'glass']) local[k] = doorToLocal(info.parts[k], info.hinge);
    const opaque = emptySoup();
    appendSoup(opaque, local.trim); appendSoup(opaque, local.paint);
    const trim = triCount(opaque) ? doorTrim(opaque, info.side) : emptySoup(true);
    if (windingMismatches(trim)) throw new Error(`${cfg.id}: door trim winding`);
    const name = `door-${id}`;
    doorTris[sideName] = triCount(local.trim) + triCount(local.paint) + triCount(local.glass) + triCount(trim);
    nodes.push({
      name, translation: info.hinge,
      children: [
        { name: `${name}-panel`, prims: [{ soup: local.trim, mat: 'colormap' }] },
        ...(paintable ? [{ name: `${name}-paint`, prims: [{ soup: local.paint, mat: 'paint' }] }] : []),
        { name: `${name}-glass`, prims: [{ soup: local.glass, mat: 'glass', uv: false }] },
        { name: `${name}-trim`, prims: [{ soup: trim, mat: 'interior', uv: false, color: true }] },
      ],
    });
  }
  const wheelNames = ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right'];
  for (const name of wheelNames) nodes.push({ name, translation: wheels[name].pivot, prims: [{ soup: wheels[name].soup, mat: 'colormap' }] });

  const glb = await writeVehicleGlb({ name: cfg.id, paletteBytes, nodes });

  // --- LOD1: whole shell with the doors closed (uncut), no interior / steering wheel ---------------
  const part = (kind) => filterSoup(body, (t) => kinds[t] === kind);
  const lodNodes = [
    { name: 'body', prims: [{ soup: part('trim'), mat: 'colormap' }] },
    ...(paintable ? [{ name: 'paint', prims: [{ soup: part('paint'), mat: 'paint' }] }] : []),
    { name: 'glass', prims: [{ soup: part('glass'), mat: 'glass', uv: false }] },
    ...wheelNames.map((name) => ({ name, translation: wheels[name].pivot, prims: [{ soup: wheels[name].soup, mat: 'colormap' }] })),
  ];
  const lod = await writeVehicleGlb({ name: `${cfg.id}-lod1`, paletteBytes, nodes: lodNodes });
  fs.writeFileSync(path.join(OUT_DIR, `${cfg.id}.glb`), glb);
  fs.writeFileSync(path.join(OUT_DIR, `${cfg.id}-lod1.glb`), lod);

  // --- manifest record --------------------------------------------------------------------------------
  const all = soupBounds(body);
  const min = [...all.min], max = [...all.max];
  for (const w of Object.values(wheels)) {
    const b = soupBounds(transformSoup(w.soup, translation(...w.pivot)));
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); }
  }
  min[1] = Math.min(min[1], 0);
  const size = max.map((v, k) => v - min[k]);
  const lights = findLights(body, cabin);
  const w2 = cabin.halfWidth * 2;
  const doorEntries = [['front-left', 'left', 'door-front-left', -HERO.doorOpenAngle], ['front-right', 'right', 'door-front-right', HERO.doorOpenAngle]].map(([id, sideName, node, angle]) => {
    const info = doorInfo[sideName];
    const rr = rect ?? { z0: info.hinge[2], z1: info.hinge[2], y0: info.hinge[1], y1: info.hinge[1] };
    return {
      id, node, side: sideName, hinge: rv(info.hinge),
      rect: { z0: r4(rr.z0), z1: r4(rr.z1), y0: r4(rr.y0), y1: r4(rr.y1) },
      openAngle: rect ? angle : 0,
      handle: rv(info.handle), entry: rv(info.entry),
    };
  });
  const seats = [{ id: 'driver', position: rv([driverX, seat.pelvisY, seat.zp]), door: 'front-left' }];
  if (!cfg.openCockpit) seats.push({ id: 'passenger', position: rv([-driverX, seat.pelvisY, seat.zp]), door: 'front-right' });
  const record = {
    id: cfg.id, label: cfg.label, category: cfg.category, file: `${cfg.id}.glb`,
    source: { ...PACK, file: `${cfg.src}.glb` },
    derivation: DERIVATION.replace('{scale}', String(cfg.scale)) + (cfg.openCockpit ? '; open-wheel single-seater (no roof or door panels, centred driver seat)' : '') + (cfg.fixedLivery ? '; fixed livery (not tintable)' : ''),
    scale: cfg.scale, dimensions: rv([size[0], size[1], size[2]]), mass: cfg.mass,
    collider: { center: rv(min.map((v, k) => (v + max[k]) / 2)), size: rv(size) },
    floorY: r4(seat.floorY),
    halfWidth: r4(Math.max(doorInfo.left.outer, doorInfo.right.outer)),
    paintable, paintColor,
    wheels: wheelNames.map((name) => ({ node: name, position: rv(wheels[name].pivot), radius: r4(wheels[name].radius), ...wheelFlags(cfg.drive, name) })),
    doors: doorEntries,
    seats,
    steeringWheel: { node: 'steering-wheel', position: rv(wheelPose.position), radius: HERO.wheelRadius, spinAxis: '+Z' },
    lights: { head: lights.head.map(rv), tail: lights.tail.map(rv) },
    exhaust: [rv([-0.25 * w2, Math.max(0.12, cabin.bodyMinY + 0.05), cabin.zMin + 0.02])],
    lods: [{ file: `${cfg.id}.glb`, maxDistance: 80 }, { file: `${cfg.id}-lod1.glb`, maxDistance: 1200 }],
    traffic: { weight: cfg.traffic },
  };
  const report = {
    id: cfg.id, scale: cfg.scale, dimensions: record.dimensions, paintable, notes,
    rect: rect ? Object.fromEntries(Object.entries(rect).map(([k, v]) => [k, r4(v)])) : null,
    subRects: doorDef ? doorDef.rects.map((q) => Object.fromEntries(Object.entries(q).map(([k, v]) => [k, r4(v)]))) : [],
    seat: { pelvisY: r4(seat.pelvisY), zp: r4(seat.zp), roofY: seat.roofY == null ? null : r4(seat.roofY), drop: r4(seat.seatDrop) },
    lightsFound: lights.found, bytes: glb.length + lod.length,
  };
  return { record, report };
}

function creditsSection(records) {
  const rows = records.map((r) => `| ${r.id} | ${r.source.file} | ${r.label} | ${r.derivation} |`);
  return [
    '<!-- vehicles:begin -->',
    '## Vehicles',
    '',
    'Source: **Kenney Car Kit 3.1** by Kenney (www.kenney.nl) - https://kenney.nl/assets/car-kit - licence CC0 1.0.',
    'Built by `scripts/assets/build-vehicles.mjs` into `public/assets/vehicles/` (GLB + `vehicles.json`).',
    '',
    '| id | Kenney source file | category | derivation applied |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    `No antique car exists in the pack; the category${MISSING_CATEGORIES.length > 1 ? 'ies' : ''} ${MISSING_CATEGORIES.map((c) => `"${c}"`).join(', ')} ${MISSING_CATEGORIES.length > 1 ? 'are' : 'is'} listed as \`missingCategories\` in the manifest.`,
    '<!-- vehicles:end -->',
    '',
  ].join('\n');
}

function updateCredits(records) {
  const section = creditsSection(records);
  let text = fs.existsSync(CREDITS) ? fs.readFileSync(CREDITS, 'utf8') : '# Credits\n\n';
  const begin = text.indexOf('<!-- vehicles:begin -->');
  const end = text.indexOf('<!-- vehicles:end -->');
  if (begin >= 0 && end > begin) text = text.slice(0, begin) + section + text.slice(end + '<!-- vehicles:end -->'.length).replace(/^\r?\n/, '');
  else text = text.replace(/\s*$/, '\n\n') + section;
  fs.writeFileSync(CREDITS, text);
}

async function verify(records) {
  const io = new NodeIO();
  io.setLogger(new Logger(Logger.Verbosity.ERROR));
  const required = ['body', 'glass', 'interior', 'steering-wheel', 'door-front-left', 'door-front-right', 'wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right'];
  const rows = [];
  let bad = 0;
  const triOf = (node) => {
    let n = 0;
    const walk = (nd) => {
      const m = nd.getMesh();
      if (m) for (const p of m.listPrimitives()) n += p.getIndices().getCount() / 3;
      for (const c of nd.listChildren()) walk(c);
    };
    walk(node);
    return n;
  };
  for (const rec of records) {
    const doc = await io.read(path.join(OUT_DIR, rec.file));
    const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
    for (const name of required) if (!nodes.has(name)) { console.error(`FAIL ${rec.id}: missing node ${name}`); bad++; }
    if (rec.paintable && !nodes.has('paint')) { console.error(`FAIL ${rec.id}: paintable but no paint node`); bad++; }
    for (const d of rec.doors) {
      const t = nodes.get(d.node)?.getTranslation() ?? [NaN, NaN, NaN];
      if (t.some((v, i) => Math.abs(v - d.hinge[i]) > 1e-3)) { console.error(`FAIL ${rec.id}: ${d.node} not at hinge`); bad++; }
    }
    for (const acc of doc.getRoot().listAccessors()) {
      const arr = acc.getArray();
      for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) { console.error(`FAIL ${rec.id}: non-finite value`); bad++; break; }
    }
    const lod = await io.read(path.join(OUT_DIR, rec.lods[1].file));
    const lodTris = lod.getRoot().listNodes().reduce((n, nd) => n + (nd.getMesh() ? nd.getMesh().listPrimitives().reduce((a, p) => a + p.getIndices().getCount() / 3, 0) : 0), 0);
    rows.push({
      id: rec.id, body: triOf(nodes.get('body')), paint: nodes.has('paint') ? triOf(nodes.get('paint')) : 0,
      glass: triOf(nodes.get('glass')), doors: triOf(nodes.get('door-front-left')) + triOf(nodes.get('door-front-right')),
      interior: triOf(nodes.get('interior')), steer: triOf(nodes.get('steering-wheel')), lod1: lodTris,
    });
  }
  return { rows, bad };
}

async function main() {
  const skipQa = process.argv.includes('--no-qa');
  if (!fs.existsSync(SRC_DIR) || !fs.existsSync(path.join(SRC_DIR, 'Textures', 'colormap.png'))) {
    console.log(`source pack absent: ${path.relative(ROOT, SRC_DIR)} (download Kenney Car Kit 3.1, CC0, to build vehicles)`);
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  const paletteBytes = fs.readFileSync(path.join(SRC_DIR, 'Textures', 'colormap.png'));
  const palette = decodePng(paletteBytes);

  const records = [], reports = [];
  for (const cfg of VEHICLES) {
    const { record, report } = await buildVehicle(cfg, palette, paletteBytes);
    records.push(record); reports.push(report);
  }
  const manifest = {
    version: 1, units: 'metres', forward: '+Z', up: '+Y', driverSide: 'left',
    generatedBy: 'scripts/assets/build-vehicles.mjs',
    missingCategories: MISSING_CATEGORIES,
    vehicles: records,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'vehicles.json'), JSON.stringify(manifest, null, 2) + '\n');
  updateCredits(records);

  const { rows, bad } = await verify(records);
  let total = 0;
  for (const f of fs.readdirSync(OUT_DIR)) total += fs.statSync(path.join(OUT_DIR, f)).size;
  console.log('id          scale  dims(w,h,l)          body paint glass doors interior steer lod1  paintable  door rect z0..z1 / y0..y1');
  for (const row of rows) {
    const rep = reports.find((r) => r.id === row.id);
    console.log(`${row.id.padEnd(11)} ${String(rep.scale).padEnd(6)} ${rep.dimensions.map((v) => v.toFixed(2)).join('x').padEnd(20)} ${String(row.body).padStart(4)} ${String(row.paint).padStart(5)} ${String(row.glass).padStart(5)} ${String(row.doors).padStart(5)} ${String(row.interior).padStart(8)} ${String(row.steer).padStart(5)} ${String(row.lod1).padStart(4)}  ${String(rep.paintable).padEnd(9)}  ${rep.rect ? `${rep.rect.z0}..${rep.rect.z1} / ${rep.rect.y0}..${rep.rect.y1}` : 'none'}`);
    for (const note of rep.notes) console.log(`            note: ${note}`);
  }
  console.log(`vehicles written: ${records.length}; output size ${(total / 1048576).toFixed(2)} MB`);
  if (bad) { console.error(`${bad} verification failure(s)`); process.exitCode = 1; return; }

  if (!skipQa) {
    const { renderVehicleSheets } = await import('./render-vehicles-qa.mjs');
    await renderVehicleSheets({ outDir: OUT_DIR, qaDir: QA_DIR });
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
