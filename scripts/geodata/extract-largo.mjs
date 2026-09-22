import fs from 'node:fs';
import path from 'node:path';

/**
 * Compiles the Largo de São Sebastião from the data already on disk.
 *
 * Nothing here is placed by address or by eye. Each venue is located by its own Overture place
 * record, then matched to a real building footprint by containment first and proximity second, so
 * a shop ends up on the building it actually occupies. The plaza surface is derived the same way:
 * it is whatever ground near the monument is neither a building nor a carriageway.
 *
 * Re-run after any change to the projection origin — everything below is in world metres.
 */
const root = process.cwd();
const data = path.join(root, 'public', 'geodata', 'real-city');
const outFile = path.join(root, 'src', 'world', 'landmarks', 'largo', 'largo.json');

const REACH = 150;        // How far from the monument the square is compiled.
const CELL = 2;           // Plaza mask resolution, metres.
const SIDEWALK = 1.6;     // Extra clearance either side of a carriageway.

/** The venues of the Largo, each found by name in the compiled place records. */
const VENUES = [
  { id: 'juma', name: 'Juma Ópera', match: /^juma ópera hotel$/i, kind: 'hotel', floors: 4 },
  { id: 'valer', name: 'Valer Teatro · Roseiral', match: /^valer teatro$/i, kind: 'culture', floors: 2 },
  { id: 'tambaqui', name: 'Tambaqui de Banda', match: /^tambaqui de banda$/i, kind: 'restaurant', floors: 2 },
  { id: 'casa-artes', name: 'Casa das Artes', match: /^casa das artes$/i, kind: 'culture', floors: 2 },
  { id: 'splash', name: 'Splash Pizza', match: /^splash pizza$/i, kind: 'restaurant', floors: 2 },
  { id: 'gisela', name: 'Tacacá da Gisela', match: /^tacacá da gisela$/i, kind: 'stall', floors: 1 },
  { id: 'galeria', name: 'Galeria do Largo', match: /galeria do largo/i, kind: 'culture', floors: 2 },
  { id: 'cafeteria', name: 'Cafeteria do Largo', match: /^cafeteria do largo$/i, kind: 'cafe', floors: 2 },
  { id: 'armando', name: 'Bar do Armando', match: /^bar do armando$/i, kind: 'bar', floors: 1 },
  { id: 'ivete', name: 'Tacacá da Ivete', match: /^tacaca da ivete$/i, kind: 'stall', floors: 1 },
];

const pois = JSON.parse(fs.readFileSync(path.join(data, 'pois.json'), 'utf8'));
const roads = JSON.parse(fs.readFileSync(path.join(data, 'roads.json'), 'utf8'));
const reserved = JSON.parse(fs.readFileSync(path.join(data, 'landmarks.json'), 'utf8')).features;
const manifest = JSON.parse(fs.readFileSync(path.join(data, 'manifest.json'), 'utf8'));

/** Reserved footprints are world-space already; tile footprints are local and need their origin. */
function nearbyFootprints() {
  const found = [];
  for (const feature of reserved) {
    if (Math.hypot(feature.x, feature.z) > REACH + 60) continue;
    found.push({ id: feature.id, klass: feature.klass ?? '', x: feature.x, z: feature.z, h: feature.h, ring: feature.p });
  }
  const size = manifest.tileSize;
  for (let tz = -1; tz <= 1; tz++) for (let tx = -1; tx <= 1; tx++) {
    const file = manifest.tiles[`${tx},${tz}`];
    if (!file) continue;
    const tile = JSON.parse(fs.readFileSync(path.join(data, file), 'utf8'));
    const ox = tile.tx * size, oz = tile.tz * size;
    for (const building of tile.buildings) {
      const ring = [];
      let cx = 0, cz = 0;
      for (let i = 0; i < building.p.length; i += 2) {
        const x = building.p[i] + ox, z = building.p[i + 1] + oz;
        ring.push(x, z); cx += x; cz += z;
      }
      const n = ring.length / 2;
      cx /= n; cz /= n;
      if (Math.hypot(cx, cz) > REACH + 60) continue;
      found.push({ id: building.id, klass: building.klass ?? '', x: cx, z: cz, h: building.h, ring });
    }
  }
  return found;
}

function inRing(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], zi = ring[i + 1], xj = ring[j], zj = ring[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/** Smallest-area oriented box, which gives a facade a width, a depth and a heading to face by. */
function orientedBox(ring) {
  const n = ring.length / 2;
  let best = null;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = ring[j * 2] - ring[i * 2], dz = ring[j * 2 + 1] - ring[i * 2 + 1];
    const length = Math.hypot(dx, dz);
    if (length < .01) continue;
    const ux = dx / length, uz = dz / length;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let k = 0; k < n; k++) {
      const u = ring[k * 2] * ux + ring[k * 2 + 1] * uz, v = -ring[k * 2] * uz + ring[k * 2 + 1] * ux;
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const w = maxU - minU, d = maxV - minV;
    if (best && w * d >= best.area) continue;
    const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
    best = { x: midU * ux - midV * uz, z: midU * uz + midV * ux, w, d, angle: Math.atan2(uz, ux), area: w * d };
  }
  return best;
}

const footprints = nearbyFootprints();
const venues = [];
for (const venue of VENUES) {
  const place = pois
    .filter(poi => venue.match.test(poi.name) && Math.hypot(poi.x, poi.z) < REACH + 60)
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  if (!place) { console.warn(`  ! ${venue.name}: sem registro de lugar`); continue; }
  // Containment first: a shop belongs to the building it is inside, whatever is nearest.
  let host = footprints.find(f => inRing(f.ring, place.x, place.z));
  let how = 'containment';
  if (!host) {
    host = footprints
      .filter(f => Math.hypot(f.x - place.x, f.z - place.z) < 45)
      .sort((a, b) => Math.hypot(a.x - place.x, a.z - place.z) - Math.hypot(b.x - place.x, b.z - place.z))[0];
    how = host ? 'nearest' : 'none';
  }
  const box = host ? orientedBox(host.ring) : null;
  venues.push({
    id: venue.id, name: venue.name, kind: venue.kind, floors: venue.floors,
    x: Number(place.x.toFixed(2)), z: Number(place.z.toFixed(2)),
    match: how,
    building: box ? {
      x: Number(box.x.toFixed(2)), z: Number(box.z.toFixed(2)),
      width: Number(box.w.toFixed(2)), depth: Number(box.d.toFixed(2)),
      angle: Number(box.angle.toFixed(4)), height: Number((host.h ?? 9).toFixed(2)),
      ring: host.ring.map(v => Number(v.toFixed(2))),
    } : null,
  });
}

/** The square itself: ground near the monument that is neither built on nor driven over. */
const span = Math.round(REACH / CELL);
const openBits = new Uint8Array(span * 2 * span * 2);
let open = 0;
for (let iz = 0; iz < span * 2; iz++) for (let ix = 0; ix < span * 2; ix++) {
  const x = (ix - span) * CELL + CELL / 2, z = (iz - span) * CELL + CELL / 2;
  if (Math.hypot(x, z) > REACH) continue;
  let blocked = false;
  for (const f of footprints) {
    if (Math.abs(f.x - x) > 90 || Math.abs(f.z - z) > 90) continue;
    if (inRing(f.ring, x, z)) { blocked = true; break; }
  }
  if (!blocked) for (const road of roads) {
    const half = Math.max(3, road.width) / 2 + SIDEWALK;
    for (let i = 2; i < road.p.length && !blocked; i += 2) {
      const ax = road.p[i - 2], az = road.p[i - 1], bx = road.p[i], bz = road.p[i + 1];
      if (Math.min(ax, bx) - half > x || Math.max(ax, bx) + half < x) continue;
      if (Math.min(az, bz) - half > z || Math.max(az, bz) + half < z) continue;
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < half) blocked = true;
    }
    if (blocked) break;
  }
  if (blocked) continue;
  openBits[iz * span * 2 + ix] = 1;
  open++;
}

const teatro = footprints.find(f => f.klass === 'entertainment' && Math.hypot(f.x, f.z) < 150);
const igreja = footprints.find(f => f.klass === 'cathedral');
const payload = {
  reach: REACH, cell: CELL, span: span * 2,
  open: Buffer.from(openBits).toString('base64'),
  venues,
  teatro: teatro ? { x: teatro.x, z: teatro.z, height: teatro.h, ring: teatro.ring.map(v => Number(v.toFixed(2))), box: orientedBox(teatro.ring) } : null,
  igreja: igreja ? { x: igreja.x, z: igreja.z, height: igreja.h, ring: igreja.ring.map(v => Number(v.toFixed(2))), box: orientedBox(igreja.ring) } : null,
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(payload));

console.log(`Largo: ${venues.length} estabelecimentos, ${footprints.length} footprints proximos`);
for (const v of venues) {
  console.log(`  ${v.id.padEnd(11)} ${v.x.toFixed(0).padStart(5)},${v.z.toFixed(0).padStart(5)}  ${v.match.padEnd(11)} ` +
    (v.building ? `${v.building.width.toFixed(0)}x${v.building.depth.toFixed(0)} m h=${v.building.height}` : 'sem footprint'));
}
console.log(`  praca: ${open} celulas livres de ${span * 2}x${span * 2} (${(open * CELL * CELL / 1000).toFixed(1)} mil m2)`);
console.log(`  teatro ${payload.teatro ? `${payload.teatro.box.w.toFixed(0)}x${payload.teatro.box.d.toFixed(0)} m` : 'ausente'} · igreja ${payload.igreja ? `${payload.igreja.box.w.toFixed(0)}x${payload.igreja.box.d.toFixed(0)} m` : 'ausente'}`);
console.log(`  ${(JSON.stringify(payload).length / 1024).toFixed(0)} KB em ${path.relative(root, outFile)}`);
