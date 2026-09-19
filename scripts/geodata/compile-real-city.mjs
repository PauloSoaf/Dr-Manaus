import fs from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';

const projectRoot = process.cwd();
const raw = path.join(projectRoot, 'data', 'raw-geodata');
const out = path.join(projectRoot, 'public', 'geodata', 'real-city');
const chunksDir = path.join(out, 'tiles');

const ORIGIN = { lat: -3.1303, lon: -60.0234 };
const METERS_PER_DEGREE = 111320;
const LONGITUDE_SCALE = METERS_PER_DEGREE * Math.cos(ORIGIN.lat * Math.PI / 180);
const TILE_SIZE = 1024;
const PROCEDURAL_CHUNK_SIZE = 128;
const SKYLINE_CELLS = 4;
const SKYLINE_CELL = TILE_SIZE / SKYLINE_CELLS;
const FLOOR_HEIGHT = 3.15;
const MAX_HEIGHT = 120;

/**
 * Only 138 of 648k footprints carry a source height, so without a prior the whole city compiles as
 * a flat carpet of 1-3 storey boxes. Manaus really is mostly low-rise, but its mid- and high-rise
 * stock is concentrated in a handful of bairros. Centres are world metres from the Teatro at 0,0.
 */
const TALL_DISTRICTS = [
  // Centro is dense but historic: it carries mid-rise, not towers, so it is deliberately weakest
  // despite holding the most footprints. The genuine high-rise is the Adrianópolis axis and the orla.
  [0, 0, 1600, .55],        // Centro
  [1200, -3000, 1500, 1],   // Adrianópolis / Nossa Senhora das Graças
  [2600, -5200, 1700, .85], // Chapada / Parque 10
  [900, -3600, 1200, 1],    // Vieiralves
  [-9400, -7400, 1600, 1],  // orla da Ponta Negra
  [1500, -4200, 1400, .95], // corredor Adrianópolis-Djalma Batista
];
/** Past this radius the city is self-built sprawl, where the vertical prior has to die out. */
const SPRAWL_RADIUS = 11000;
/** Sheds, hangars, arenas and houses are wide or plain in plan precisely because they are not tall. */
const FLAT_CLASSES = /house|hut|bungalow|detached|terrace|cabin|guardhouse|industrial|warehouse|shed|hangar|barn|silo|storage|stadium|grandstand|sports|garage|carport|parking|roof|pavilion|greenhouse|retail|supermarket|kiosk|school|church|chapel|cathedral|temple|mosque/;

const BUILDINGS_FILE = path.join(raw, 'manaus-buildings.geojson');
const ROADS_FILE = path.join(raw, 'manaus-segments.geojson');
const PLACES_FILE = path.join(raw, 'manaus-places.geojson');

function project(lat, lon) {
  return { x: (lon - ORIGIN.lon) * LONGITUDE_SCALE, z: (ORIGIN.lat - lat) * METERS_PER_DEGREE };
}

/**
 * Circles along a bearing whose union covers a strip `half` metres either side of the centreline:
 * the worst case is the midpoint between two circles, so the spacing follows from Pythagoras.
 */
function strip(lat, lon, bearing, length, radius, half) {
  const rad = bearing * Math.PI / 180;
  const step = 2 * Math.sqrt(Math.max(1, radius * radius - half * half));
  const count = Math.max(2, Math.ceil(length / step) + 1);
  const spacing = length / (count - 1);
  const items = [];
  for (let i = 0; i < count; i++) {
    const d = i * spacing - length / 2;
    items.push([lat + d * Math.cos(rad) / METERS_PER_DEGREE, lon + d * Math.sin(rad) / LONGITUDE_SCALE, radius]);
  }
  return items;
}

const RESERVATIONS = [
  [-3.1303, -60.0234, 120], [-3.1399498, -60.02355, 130], [-3.13944, -60.027, 180],
  [-3.1350552, -60.0167709, 130], [-3.08325175, -60.02800465, 240],
  // Ponta Negra: only the beach, boardwalk and amphitheatre are hand-built, so a wider ring would
  // delete the real orla towers and leave the district floating free of the city.
  [-3.06375, -60.10830, 300], [-3.12008275, -60.07860795, 480],
  [-3.0071889, -59.9398508, 320], [-3.0974306, -59.9877318, 250],
  // Eduardo Gomes: nothing may be compiled onto the runway, so the strip is reserved end to end.
  ...strip(-3.0386, -60.0497, 100, 2800, 110, 80),
  // Apron and terminal frontage just north of the runway.
  [-3.03640, -60.04640, 240], [-3.03655, -60.04930, 300], [-3.03680, -60.05230, 260],
];

const reserved = RESERVATIONS.map(([lat, lon, radius]) => ({ ...project(lat, lon), radius }));

function parseFeatureLine(line) {
  let text = line.trim();
  if (text.endsWith(',')) text = text.slice(0, -1);
  if (text.endsWith(']}')) text = text.slice(0, -2);
  if (text.length < 2 || text[0] !== '{' || !text.endsWith('}')) return null;
  try {
    const value = JSON.parse(text);
    return value?.type === 'Feature' ? value : null;
  } catch { return null; }
}

/**
 * The building export is 366 MB, so a whole-file JSON.parse both allocates a huge string and
 * materialises every feature at once. The exports carry one Feature per line, which streams in
 * 4 MB chunks at a constant heap cost; a non-line-delimited file falls back to the plain parse.
 */
function* readGeoJSON(file) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo ausente: ${file}`);
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1 << 22);
  const decoder = new StringDecoder('utf8');
  let tail = '';
  let yielded = 0;
  try {
    for (;;) {
      const read = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!read) break;
      tail += decoder.write(buffer.subarray(0, read));
      let start = 0, at = tail.indexOf('\n');
      while (at !== -1) {
        const feature = parseFeatureLine(tail.slice(start, at));
        if (feature) { yielded++; yield feature; }
        start = at + 1;
        at = tail.indexOf('\n', start);
      }
      tail = tail.slice(start);
    }
    tail += decoder.end();
    const last = parseFeatureLine(tail);
    if (last) { yielded++; yield last; }
  } finally { fs.closeSync(fd); }
  if (yielded) return;
  for (const feature of JSON.parse(fs.readFileSync(file, 'utf8')).features ?? []) yield feature;
}

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Mirrors the runtime facade hash so a distant block agrees with the footprints it stands in for. */
function mix32(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function clamp(value, min, max) { return value < min ? min : value > max ? max : value; }

function simplify(points) {
  if (points.length <= 4) return points;
  const result = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= 1.2) result.push(point);
  }
  if (result.length > 2) {
    const a = result[0], b = result[result.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .5) result.pop();
  }
  return result;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) * .5;
}

function centroid(points) {
  let x = 0, z = 0;
  for (const p of points) { x += p[0]; z += p[1]; }
  return { x: x / points.length, z: z / points.length };
}

function fallbackHeight(props, area, seed) {
  const floors = Number(props.num_floors);
  if (Number.isFinite(floors) && floors > 0) return Math.min(180, Math.max(3, floors * FLOOR_HEIGHT));
  const klass = String(props.class ?? props.subtype ?? '').toLowerCase();
  if (klass.includes('industrial') || klass.includes('warehouse')) return 7 + seed % 5;
  if (klass.includes('apart') || klass.includes('residential')) return 7 + seed % 18;
  if (area > 1200) return 10 + seed % 18;
  if (area > 450) return 6 + seed % 11;
  return 3.2 + (seed % 50) / 10;
}

/** Compact bumps: the lift is exactly zero past 2.2 radii, so untouched bairros stay untouched. */
function districtLift(x, z) {
  let best = 0;
  for (const [cx, cz, radius, weight] of TALL_DISTRICTS) {
    const d = Math.hypot(x - cx, z - cz) / (radius * 2.2);
    if (d >= 1) continue;
    const falloff = 1 - d * d;
    const lift = weight * falloff * falloff;
    if (lift > best) best = lift;
  }
  return best;
}

/** The consolidated city thins with distance from the Teatro and stops dead at the sprawl radius. */
function urbanLift(x, z) {
  const r = Math.hypot(x, z);
  return clamp((SPRAWL_RADIUS - r) / 2500, 0, 1) * clamp(1 - r / 9000, .25, 1);
}

/**
 * A hashed exponential tail over the footprint estimate. The great majority of buildings barely
 * move, a slice becomes 4-8 storey blocks and a small number become genuine towers, concentrated
 * where the plot is large and the bairro actually has height. Deterministic in `id` alone, so two
 * compiles agree byte for byte.
 */
function verticalPrior(base, area, klass, x, z, seed) {
  if (FLAT_CLASSES.test(klass)) return base;
  const lift = clamp(districtLift(x, z) + urbanLift(x, z) * .55, 0, 1);
  if (lift <= 0) return base;
  const plot = .16 + .84 * clamp((area - 100) / 600, 0, 1) ** .7;
  // -ln(1-u) is an exponential variate, so the tail thins smoothly instead of banding into tiers.
  const tail = -Math.log(1 - (mix32(seed, 31) / 4294967296) * .9995);
  return base + 7.8 * lift * plot * tail ** .88 * FLOOR_HEIGHT;
}

function extractPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map(poly => poly[0]);
  return [];
}

/** Returns the index of the reservation the point falls in, or -1: landmarks need to know which. */
function reservationAt(x, z) {
  for (let i = 0; i < reserved.length; i++) {
    const item = reserved[i];
    if ((x - item.x) ** 2 + (z - item.z) ** 2 < item.radius ** 2) return i;
  }
  return -1;
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(chunksDir, { recursive: true });

const tiles = new Map();
const landmarks = [];
let buildingCount = 0;
let skipped = 0;

for (const feature of readGeoJSON(BUILDINGS_FILE)) {
  const props = feature.properties ?? {};
  if (props.is_underground) continue;
  for (const ring of extractPolygons(feature.geometry)) {
    let world = ring.map(([lon, lat]) => {
      const p = project(lat, lon);
      return [p.x, p.z];
    });
    world = simplify(world);
    if (world.length < 3) continue;
    const center = centroid(world);
    const area = polygonArea(world);
    const id = String(feature.id ?? props.id ?? `b-${buildingCount}`);
    const seed = hashString(id);
    const klass = props.class ?? props.subtype;
    const explicitHeight = Number(props.height);
    const floors = Number(props.num_floors);
    // A measured height or storey count always wins; only footprints the source says nothing
    // about are handed to the prior.
    const measured = Number.isFinite(explicitHeight) && explicitHeight > 0 ? explicitHeight
      : Number.isFinite(floors) && floors > 0 ? Math.min(180, Math.max(3, floors * FLOOR_HEIGHT)) : 0;
    const height = measured || verticalPrior(
      fallbackHeight(props, area, seed), area, String(klass ?? '').toLowerCase(), center.x, center.z, seed,
    );

    const reservation = reservationAt(center.x, center.z);
    if (reservation >= 0) {
      skipped++;
      // Reserved footprints stay out of the tiles but are published so bespoke models can sit on
      // the real geometry instead of a guessed rectangle. Sheds and huts would only bloat the file.
      if (area >= 40) landmarks.push({
        id,
        klass: String(klass ?? ''),
        reservation,
        lat: Number((ORIGIN.lat - center.z / METERS_PER_DEGREE).toFixed(7)),
        lon: Number((ORIGIN.lon + center.x / LONGITUDE_SCALE).toFixed(7)),
        x: Number(center.x.toFixed(2)),
        z: Number(center.z.toFixed(2)),
        h: Number(Math.min(MAX_HEIGHT, Math.max(2.8, height)).toFixed(2)),
        p: world.flatMap(([x, z]) => [Number(x.toFixed(2)), Number(z.toFixed(2))]),
      });
      continue;
    }
    if (area < 7 || area > 120000) continue;

    const tx = Math.floor(center.x / TILE_SIZE), tz = Math.floor(center.z / TILE_SIZE);
    const key = `${tx},${tz}`;
    let tile = tiles.get(key);
    if (!tile) {
      tile = { key, tx, tz, buildings: [] };
      tiles.set(key, tile);
    }
    const originX = tx * TILE_SIZE, originZ = tz * TILE_SIZE;
    const minHeightRaw = Number(props.min_height);
    const minH = Number.isFinite(minHeightRaw) && minHeightRaw > 0 ? minHeightRaw : 0;
    const roofHeight = Number(props.roof_height);
    const packed = [];
    for (const [x, z] of world) packed.push(Number((x - originX).toFixed(2)), Number((z - originZ).toFixed(2)));
    tile.buildings.push({
      id,
      h: Number(Math.min(MAX_HEIGHT, Math.max(2.8, height)).toFixed(2)),
      ...(minH ? { minH: Number(minH.toFixed(2)) } : {}),
      ...(Number.isFinite(floors) && floors > 0 ? { f: floors } : {}),
      ...(props.roof_shape ? { rs: String(props.roof_shape) } : {}),
      ...(Number.isFinite(roofHeight) && roofHeight > 0 ? { rh: Number(roofHeight.toFixed(2)) } : {}),
      ...(props.facade_color ? { facade: props.facade_color } : {}),
      ...(props.roof_color ? { roof: props.roof_color } : {}),
      ...(klass ? { klass } : {}),
      p: packed,
    });
    buildingCount++;
  }
}

/** The runtime's facade palette, copied so a skyline block averages the colours it replaces. */
const FACADE_PALETTE = [
  [.84, .76, .66], [.79, .70, .62], [.86, .81, .71], [.72, .70, .66], [.80, .66, .56],
  [.66, .71, .70], [.74, .78, .76], [.85, .72, .58], [.69, .65, .61], [.78, .74, .68],
  [.62, .68, .72], [.83, .78, .74], [.76, .63, .58], [.70, .74, .68], [.88, .84, .77],
];
/** Region tints: a white horizon is the failure mode, so the far city is pushed off neutral. */
const CENTRE_TINT = [.87, .75, .58];
const TERRACOTTA_TINT = [.66, .40, .29];
const OUTSKIRT_TINT = [.55, .62, .50];
const CENTRE_RADIUS = 9000;

function facadeOf(id) { return FACADE_PALETTE[mix32(hashString(id), 1) % FACADE_PALETTE.length]; }

function mixRGB(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function round2(value) { return Number(value.toFixed(2)); }

/**
 * A cell's tint: the mean of the facades it stands for, pulled hard toward its region so downtown
 * reads ochre and the forest and river edges read cool and green rather than a uniform pale mass.
 */
function cellTint(base, worldX, worldZ, seed, dense) {
  const t = clamp(Math.hypot(worldX, worldZ) / CENTRE_RADIUS, 0, 1);
  let region = mixRGB(CENTRE_TINT, OUTSKIRT_TINT, t * t);
  if (dense && mix32(seed, 11) / 4294967296 < .3) region = mixRGB(region, TERRACOTTA_TINT, .5);
  const jitter = .93 + (mix32(seed, 23) / 4294967296) * .14;
  const tint = mixRGB(base, region, .62);
  return [clamp(tint[0] * jitter, 0, 1), clamp(tint[1] * jitter, 0, 1), clamp(tint[2] * jitter, 0, 1)];
}

const tileFiles = {};
const skylineTiles = {};
let skylineBlocks = 0;

for (const [key, tile] of tiles) {
  const safe = key.replace(',', '_').replaceAll('-', 'm');
  const file = `tiles/${safe}.json`;
  fs.writeFileSync(path.join(out, file), JSON.stringify(tile));
  tileFiles[key] = file;

  const cells = new Map();
  for (const building of tile.buildings) {
    let cx = 0, cz = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const count = building.p.length / 2;
    for (let i = 0; i < building.p.length; i += 2) {
      const x = building.p[i], z = building.p[i + 1];
      cx += x; cz += z;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    cx /= count; cz /= count;
    const ci = clamp(Math.floor(cx / SKYLINE_CELL), 0, SKYLINE_CELLS - 1);
    const cj = clamp(Math.floor(cz / SKYLINE_CELL), 0, SKYLINE_CELLS - 1);
    const cellKey = cj * SKYLINE_CELLS + ci;
    let cell = cells.get(cellKey);
    if (!cell) {
      cell = { sumX: 0, sumZ: 0, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, heights: [], rgb: [0, 0, 0], count: 0, tall: null };
      cells.set(cellKey, cell);
    }
    cell.sumX += cx; cell.sumZ += cz; cell.count++;
    if (minX < cell.minX) cell.minX = minX; if (maxX > cell.maxX) cell.maxX = maxX;
    if (minZ < cell.minZ) cell.minZ = minZ; if (maxZ > cell.maxZ) cell.maxZ = maxZ;
    cell.heights.push(building.h);
    const facade = facadeOf(building.id);
    cell.rgb[0] += facade[0]; cell.rgb[1] += facade[1]; cell.rgb[2] += facade[2];
    if (!cell.tall || building.h > cell.tall.h) {
      cell.tall = { h: building.h, x: cx, z: cz, w: maxX - minX, d: maxZ - minZ, id: building.id };
    }
  }

  const originX = tile.tx * TILE_SIZE, originZ = tile.tz * TILE_SIZE;
  const blocks = [];
  for (const [cellKey, cell] of cells) {
    cell.heights.sort((a, b) => a - b);
    const p75 = cell.heights[Math.min(cell.heights.length - 1, Math.floor(cell.heights.length * .75))];
    const ox = cell.sumX / cell.count, oz = cell.sumZ / cell.count;
    const seed = mix32(hashString(key), cellKey);
    const base = [cell.rgb[0] / cell.count, cell.rgb[1] / cell.count, cell.rgb[2] / cell.count];
    const tint = cellTint(base, originX + ox, originZ + oz, seed, cell.count > 45);
    blocks.push(
      round2(ox), round2(oz),
      round2(clamp(cell.maxX - cell.minX, 60, 250)), round2(clamp(cell.maxZ - cell.minZ, 60, 250)),
      round2(Math.max(4, p75)), round2(tint[0]), round2(tint[1]), round2(tint[2]),
    );
    // Without a second slimmer block the towers vanish into the cell average and the skyline flattens.
    const tall = cell.tall;
    if (tall && tall.h > p75 * 1.6 && tall.h > 25) {
      const spike = cellTint(facadeOf(tall.id), originX + tall.x, originZ + tall.z, mix32(seed, 5), false);
      blocks.push(
        round2(tall.x), round2(tall.z),
        round2(clamp(tall.w * 1.15, 18, 70)), round2(clamp(tall.d * 1.15, 18, 70)),
        round2(tall.h), round2(spike[0]), round2(spike[1]), round2(spike[2]),
      );
    }
  }
  skylineTiles[key] = blocks;
  skylineBlocks += blocks.length / 8;
  // The packed footprints are on disk now; holding all 647 tiles would only inflate the peak heap.
  tile.buildings.length = 0;
}

fs.writeFileSync(path.join(out, 'skyline.json'), JSON.stringify({ stride: 8, tiles: skylineTiles }));
fs.writeFileSync(path.join(out, 'landmarks.json'), JSON.stringify({ features: landmarks }));

function roadWidth(klass) {
  return ({
    motorway: 18, trunk: 16, primary: 14, secondary: 11,
    tertiary: 9, residential: 7, living_street: 6, service: 5, unclassified: 6,
  })[klass] ?? 0;
}

function simplifyLine(points, threshold = 2.4) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1], p = points[i];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= threshold) out.push(p);
  }
  out.push(points[points.length - 1]);
  return out;
}

const roads = [];
let namedRoads = 0;
if (fs.existsSync(ROADS_FILE)) {
  for (const feature of readGeoJSON(ROADS_FILE)) {
    const props = feature.properties ?? {};
    const klass = String(props.class ?? '').toLowerCase();
    const width = roadWidth(klass);
    if (!width) continue;
    const primary = props.names?.primary;
    const name = typeof primary === 'string' && primary.trim() ? primary.trim() : '';
    const geometries = feature.geometry?.type === 'LineString'
      ? [feature.geometry.coordinates]
      : feature.geometry?.type === 'MultiLineString' ? feature.geometry.coordinates : [];
    for (const line of geometries) {
      const world = simplifyLine(line.map(([lon, lat]) => {
        const p = project(lat, lon);
        return [p.x, p.z];
      }));
      if (world.length < 2) continue;
      roads.push({
        class: klass, width,
        p: world.flatMap(([x, z]) => [Number(x.toFixed(2)), Number(z.toFixed(2))]),
        ...(name ? { name } : {}),
      });
      if (name) namedRoads++;
    }
  }
}
fs.writeFileSync(path.join(out, 'roads.json'), JSON.stringify(roads));

const pois = [];
if (fs.existsSync(PLACES_FILE)) {
  for (const feature of readGeoJSON(PLACES_FILE)) {
    if (feature.geometry?.type !== 'Point') continue;
    const [lon, lat] = feature.geometry.coordinates;
    const p = project(lat, lon);
    const props = feature.properties ?? {};
    const names = props.names;
    let name = props.name;
    if (!name && names && typeof names === 'object') name = names.primary ?? names.common?.['pt-BR'] ?? names.common?.pt;
    if (!name) continue;
    const category = props.basic_category ?? props.categories?.primary ?? props.category ?? '';
    pois.push({ id: String(feature.id ?? ''), name: String(name), category: String(category), x: Number(p.x.toFixed(1)), z: Number(p.z.toFixed(1)) });
  }
}
fs.writeFileSync(path.join(out, 'pois.json'), JSON.stringify(pois));

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'Overture Maps + OpenStreetMap derived transportation, compiled offline for DR Manaus',
  origin: ORIGIN,
  tileSize: TILE_SIZE,
  proceduralChunkSize: PROCEDURAL_CHUNK_SIZE,
  tiles: tileFiles,
  roads: 'roads.json',
  pois: 'pois.json',
  skyline: 'skyline.json',
  landmarks: 'landmarks.json',
  stats: {
    buildings: buildingCount, tiles: tiles.size, roads: roads.length, pois: pois.length,
    reservedSkipped: skipped, skylineBlocks, landmarkFeatures: landmarks.length, namedRoads,
  },
};
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));

const attribution = [
  'DR Manaus geographic data attribution',
  '',
  'Buildings and transportation: © OpenStreetMap contributors, Overture Maps Foundation.',
  'Overture Maps data accessed during development. Overture building and transportation themes are distributed under ODbL 1.0.',
  'OpenStreetMap: https://www.openstreetmap.org/copyright',
  'Overture Maps: https://overturemaps.org/',
  '',
  'Copernicus DEM is not bundled by this phase. If added later, retain the required Copernicus attribution in this file.',
  '',
];
fs.writeFileSync(path.join(projectRoot, 'public', 'geodata', 'ATTRIBUTION.txt'), attribution.join('\n'));

console.log(JSON.stringify(manifest.stats, null, 2));
console.log(`Real city assets written to ${out}`);
