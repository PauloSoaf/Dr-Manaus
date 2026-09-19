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

/**
 * Free-flow speed in m/s per class, used only where Overture carries no `speed_limits`. Manaus
 * signs 60 on its avenues and 30 in the bairros, so these are the posted values, not design speeds.
 */
const DRIVABLE_SPEED = {
  motorway: 27.8, trunk: 22.2, primary: 16.7, secondary: 13.9, tertiary: 11.1,
  residential: 8.3, living_street: 5.6, unclassified: 8.3, service: 5.6,
};

/**
 * Overture spells a one-way street as an access restriction that denies one heading. A restriction
 * that is conditional on time, vehicle or transport mode is a bus lane or a delivery window, not a
 * one-way, so only the unconditional ones count.
 */
function onewayOf(props) {
  for (const rule of props.access_restrictions ?? []) {
    const when = rule.when;
    if (rule.access_type !== 'denied' || !when?.heading) continue;
    if (when.during || when.using || when.vehicle || when.mode || when.recognized) continue;
    return true;
  }
  return false;
}

function flaggedOf(props, flag) {
  for (const rule of props.road_flags ?? []) if ((rule.values ?? []).includes(flag)) return true;
  return false;
}

function speedOf(props, klass) {
  for (const rule of props.speed_limits ?? []) {
    const max = rule.max_speed;
    if (!max || !Number.isFinite(max.value) || max.value <= 0) continue;
    return max.unit === 'mph' ? max.value * .44704 : max.value / 3.6;
  }
  return DRIVABLE_SPEED[klass];
}

/**
 * Douglas-Peucker on top of the chord filter. The chord filter keeps a vertex every 2.4 m even down
 * a dead straight avenue; dropping the ones that lie within 35 cm of their own chord removes those
 * without moving the centreline anywhere a car could notice against a 7 m ribbon.
 */
function simplifyDP(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const stack = [0, points.length - 1];
  while (stack.length) {
    const end = stack.pop(), start = stack.pop();
    if (end - start < 2) continue;
    const ax = points[start][0], az = points[start][1];
    const dx = points[end][0] - ax, dz = points[end][1] - az;
    const span = Math.hypot(dx, dz) || 1;
    let worst = -1, at = -1;
    for (let i = start + 1; i < end; i++) {
      const d = Math.abs((points[i][0] - ax) * dz - (points[i][1] - az) * dx) / span;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tolerance) { keep[at] = 1; stack.push(start, at, at, end); }
  }
  const result = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) result.push(points[i]);
  return result;
}

const roads = [];
let namedRoads = 0;
/** Raw drivable geometry held back for the graph pass, which needs connectors and full precision. */
const graphRaw = [];
const connectorRefs = new Map();
let onewayFound = 0, widthRuleFound = 0, speedLimitFound = 0;
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
    // A connector's `at` is a fraction of the whole feature, so only a single line can carry them.
    if (geometries.length !== 1 || geometries[0].length < 2) continue;
    const connectors = (props.connectors ?? [])
      .filter(c => c?.connector_id && Number.isFinite(Number(c.at)))
      .map(c => ({ id: String(c.connector_id), at: clamp(Number(c.at), 0, 1) }))
      .sort((a, b) => a.at - b.at);
    for (const connector of connectors) connectorRefs.set(connector.id, (connectorRefs.get(connector.id) ?? 0) + 1);
    const ruleWidth = (props.width_rules ?? []).find(rule => Number.isFinite(rule?.value) && rule.value > 0);
    if (ruleWidth) widthRuleFound++;
    if ((props.speed_limits ?? []).some(rule => Number.isFinite(rule?.max_speed?.value))) speedLimitFound++;
    const oneway = onewayOf(props);
    if (oneway) onewayFound++;
    const points = new Float64Array(geometries[0].length * 2);
    for (let i = 0; i < geometries[0].length; i++) {
      const p = project(geometries[0][i][1], geometries[0][i][0]);
      points[i * 2] = p.x; points[i * 2 + 1] = p.z;
    }
    graphRaw.push({
      // 40 bits of the Overture uuid: still traceable back to the source row, a tenth of the bytes.
      id: String(feature.id ?? `r${graphRaw.length}`).replace(/-/g, '').slice(0, 10),
      name: name || null, klass, oneway,
      width: ruleWidth ? Number(ruleWidth.value) : width,
      bridge: flaggedOf(props, 'is_bridge'),
      speed: speedOf(props, klass),
      points, connectors,
    });
  }
}
fs.writeFileSync(path.join(out, 'roads.json'), JSON.stringify(roads));

/**
 * The drivable graph. Overture gives every segment a `connectors` list, so two streets that meet
 * share a connector id and therefore a node index: that, and not proximity, is what turns 52k loose
 * polylines into a network a car can be routed along. A connector that lands mid-way through a
 * segment is a T-junction, so the segment is cut there — otherwise the stem of every T in the city
 * would terminate against a road it never joins and traffic would pile into false dead ends.
 */
const graphNodes = [];
const nodeByConnector = new Map();
const nodeCells = new Map();
/** Endpoints with no connector at all snap to anything within this radius; 4 m is a kerb, not a block. */
const SNAP_RADIUS = 4;

function nodeIndexOf(connectorId, x, z) {
  if (connectorId) {
    const hit = nodeByConnector.get(connectorId);
    if (hit !== undefined) return hit;
  } else {
    const gx = Math.round(x / SNAP_RADIUS), gz = Math.round(z / SNAP_RADIUS);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const index of nodeCells.get(`${gx + dx},${gz + dz}`) ?? []) {
        const node = graphNodes[index];
        if ((node[0] - x) ** 2 + (node[1] - z) ** 2 <= SNAP_RADIUS * SNAP_RADIUS) return index;
      }
    }
  }
  const index = graphNodes.length;
  graphNodes.push([x, z]);
  if (connectorId) nodeByConnector.set(connectorId, index);
  const key = `${Math.round(x / SNAP_RADIUS)},${Math.round(z / SNAP_RADIUS)}`;
  const cell = nodeCells.get(key);
  if (cell) cell.push(index); else nodeCells.set(key, [index]);
  return index;
}

const graphSegments = [];
let splitCount = 0;
for (const record of graphRaw) {
  const count = record.points.length / 2;
  const cumulative = new Float64Array(count);
  for (let i = 1; i < count; i++) {
    cumulative[i] = cumulative[i - 1]
      + Math.hypot(record.points[i * 2] - record.points[i * 2 - 2], record.points[i * 2 + 1] - record.points[i * 2 - 1]);
  }
  const total = cumulative[count - 1];
  if (!(total > .5)) continue;
  const pointAt = (distance) => {
    let i = 1;
    while (i < count - 1 && cumulative[i] < distance) i++;
    const span = cumulative[i] - cumulative[i - 1] || 1;
    const t = (distance - cumulative[i - 1]) / span;
    return [
      record.points[i * 2 - 2] + (record.points[i * 2] - record.points[i * 2 - 2]) * t,
      record.points[i * 2 - 1] + (record.points[i * 2 + 1] - record.points[i * 2 - 1]) * t,
    ];
  };
  // A cut is only worth making where a second drivable segment actually ends on that connector.
  const marks = [{ at: 0, id: record.connectors.find(c => c.at <= 1e-6)?.id ?? null }];
  for (const connector of record.connectors) {
    if (connector.at <= 1e-6 || connector.at >= 1 - 1e-6) continue;
    if ((connectorRefs.get(connector.id) ?? 0) < 2) continue;
    if (connector.at * total < 3 || (1 - connector.at) * total < 3) continue;
    marks.push(connector);
    splitCount++;
  }
  const tail = record.connectors[record.connectors.length - 1];
  marks.push({ at: 1, id: tail && tail.at >= 1 - 1e-6 ? tail.id : null });
  for (let m = 0; m + 1 < marks.length; m++) {
    const from = marks[m].at * total, to = marks[m + 1].at * total;
    const piece = [m === 0 ? [record.points[0], record.points[1]] : pointAt(from)];
    for (let i = 1; i < count - 1; i++) {
      if (cumulative[i] > from + .05 && cumulative[i] < to - .05) piece.push([record.points[i * 2], record.points[i * 2 + 1]]);
    }
    piece.push(m + 2 === marks.length ? [record.points[count * 2 - 2], record.points[count * 2 - 1]] : pointAt(to));
    const line = simplifyDP(simplifyLine(piece), .35);
    if (line.length < 2) continue;
    let length = 0;
    for (let i = 1; i < line.length; i++) length += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    if (length < .5) continue;
    graphSegments.push({
      id: marks.length > 2 ? `${record.id}~${m}` : record.id,
      ...(record.name ? { name: record.name } : {}),
      class: record.klass,
      width: Number(record.width.toFixed(2)),
      p: line.flatMap(([x, z]) => [Number(x.toFixed(1)), Number(z.toFixed(1))]),
      ...(record.oneway ? { oneway: true } : {}),
      ...(record.bridge ? { bridge: true } : {}),
      speed: Number(record.speed.toFixed(2)),
      a: nodeIndexOf(marks[m].id, line[0][0], line[0][1]),
      b: nodeIndexOf(marks[m + 1].id, line[line.length - 1][0], line[line.length - 1][1]),
    });
  }
}
const graphRawCount = graphRaw.length;
graphRaw.length = 0;
fs.writeFileSync(path.join(out, 'roadgraph.json'), JSON.stringify({
  segments: graphSegments,
  nodes: graphNodes.map(([x, z]) => [Number(x.toFixed(1)), Number(z.toFixed(1))]),
}));

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

const WATER_FILE = path.join(raw, 'manaus-water.geojson');
const DIVISIONS_FILE = path.join(raw, 'manaus-divisions.geojson');

/** Past this box we would be shipping the whole Amazon basin; the player never reaches its edge. */
const WATER_CLIP_X = 38000, WATER_CLIP_Z = 34000;
/** Pools, sewage and springs are not navigable water and would only speckle the city with blue. */
const WATER_CLASSES = new Set([
  'river', 'water', 'stream', 'lake', 'lagoon', 'oxbow', 'pond', 'fishpond',
  'reservoir', 'basin', 'canal', 'drain', 'ditch', 'moat',
]);
/** The confluence is the whole point of Manaus, so the two waters must be told apart by data. */
const MUDDY_RIVER = /solim[oõ]es|amazon/i;
const CLEAR_RIVER = /r[ií]o\s+negro/i;

function extractRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function extractLines(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

function featureName(props) {
  const names = props.names;
  const primary = typeof names?.primary === 'string' ? names.primary : props.name;
  return typeof primary === 'string' && primary.trim() ? primary.trim() : '';
}

/** Sutherland-Hodgman against one axis-aligned half plane; `axis` is 0 for x and 1 for z. */
function clipHalf(points, axis, limit, keepBelow) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const b = points[i], a = points[(i + points.length - 1) % points.length];
    const bIn = keepBelow ? b[axis] <= limit : b[axis] >= limit;
    const aIn = keepBelow ? a[axis] <= limit : a[axis] >= limit;
    // Only a crossing divides, so the denominator is never zero.
    if (bIn !== aIn) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      out.push(axis === 0 ? [limit, a[1] + (b[1] - a[1]) * t] : [a[0] + (b[0] - a[0]) * t, limit]);
    }
    if (bIn) out.push(b);
  }
  return out;
}

function clipRing(points) {
  let ring = points;
  for (const [axis, limit, keepBelow] of [[0, -WATER_CLIP_X, false], [0, WATER_CLIP_X, true], [1, -WATER_CLIP_Z, false], [1, WATER_CLIP_Z, true]]) {
    if (ring.length < 3) return [];
    ring = clipHalf(ring, axis, limit, keepBelow);
  }
  return ring;
}

/** Rings close on themselves, so the first and last points must not collapse into each other. */
function simplifyRing(points, threshold) {
  if (points.length < 4) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = result[result.length - 1], p = points[i];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= threshold) result.push(p);
  }
  while (result.length > 3 && Math.hypot(result[0][0] - result[result.length - 1][0], result[0][1] - result[result.length - 1][1]) < threshold) result.pop();
  return result;
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Signed-area centroid: a bairro's label belongs at its middle, not at its densest stretch of border. */
function ringCentroid(points) {
  let twice = 0, x = 0, z = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    twice += cross;
    x += (a[0] + b[0]) * cross;
    z += (a[1] + b[1]) * cross;
  }
  if (Math.abs(twice) < 1e-6) return centroid(points);
  return { x: x / (3 * twice), z: z / (3 * twice) };
}

function projectRing(ring) {
  return ring.map(([lon, lat]) => {
    const p = project(lat, lon);
    return [p.x, p.z];
  });
}

function packRing(ring) { return ring.flatMap(([x, z]) => [Number(x.toFixed(1)), Number(z.toFixed(1))]); }

/**
 * Overture names the Negro, the Solimões and the Amazon only on their waterway centrelines; the
 * surface polygons themselves are anonymous. Counting which centreline runs through a polygon is
 * what tells black water from muddy, so the tint follows the real rivers instead of a fake diagonal.
 */
const muddyCentre = [], clearCentre = [];
if (fs.existsSync(WATER_FILE)) {
  for (const feature of readGeoJSON(WATER_FILE)) {
    const name = featureName(feature.properties ?? {});
    if (!name) continue;
    const target = MUDDY_RIVER.test(name) ? muddyCentre : CLEAR_RIVER.test(name) ? clearCentre : null;
    if (!target) continue;
    for (const line of extractLines(feature.geometry)) for (const point of projectRing(line)) target.push(point);
  }
}

function centreHits(points, ring, minX, maxX, minZ, maxZ) {
  let hits = 0;
  for (const [x, z] of points) {
    if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
    if (pointInRing(x, z, ring)) hits++;
  }
  return hits;
}

const waterPolygons = [];
const muddyIndices = [];
const waterBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
if (fs.existsSync(WATER_FILE)) {
  for (const feature of readGeoJSON(WATER_FILE)) {
    const props = feature.properties ?? {};
    const klass = String(props.class ?? props.subtype ?? '').toLowerCase();
    if (!WATER_CLASSES.has(klass)) continue;
    const name = featureName(props);
    for (const polygon of extractRings(feature.geometry)) {
      if (!polygon.length) continue;
      const outer = projectRing(polygon[0]);
      if (outer.length < 3) continue;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of outer) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      if (minX > WATER_CLIP_X || maxX < -WATER_CLIP_X || minZ > WATER_CLIP_Z || maxZ < -WATER_CLIP_Z) continue;
      const clippedOuter = simplifyRing(clipRing(outer), 5);
      if (clippedOuter.length < 3 || polygonArea(clippedOuter) < 400) continue;

      const rings = [packRing(clippedOuter)];
      for (let i = 1; i < polygon.length; i++) {
        const hole = simplifyRing(clipRing(projectRing(polygon[i])), 5);
        // A river island smaller than a city block is not worth a hole in the surface.
        if (hole.length >= 3 && polygonArea(hole) > 2500) rings.push(packRing(hole));
      }

      const muddyHits = centreHits(muddyCentre, outer, minX, maxX, minZ, maxZ);
      const clearHits = centreHits(clearCentre, outer, minX, maxX, minZ, maxZ);
      const centre = ringCentroid(clippedOuter);
      // Lakes and igarapés carry no centreline, so the várzea south-east of the confluence decides.
      const muddy = muddyHits || clearHits ? muddyHits > clearHits : centre.x > 8000 || centre.z > 6000;
      if (muddy) muddyIndices.push(waterPolygons.length);
      waterPolygons.push({ class: klass, name: name || null, muddy, rings });
      for (const ring of rings) for (let i = 0; i < ring.length; i += 2) {
        if (ring[i] < waterBounds.minX) waterBounds.minX = ring[i];
        if (ring[i] > waterBounds.maxX) waterBounds.maxX = ring[i];
        if (ring[i + 1] < waterBounds.minZ) waterBounds.minZ = ring[i + 1];
        if (ring[i + 1] > waterBounds.maxZ) waterBounds.maxZ = ring[i + 1];
      }
    }
  }
}
if (!waterPolygons.length) Object.assign(waterBounds, { minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
fs.writeFileSync(path.join(out, 'water.json'), JSON.stringify({
  bounds: waterBounds, solimoes: muddyIndices, polygons: waterPolygons,
}));

/**
 * The chunk worker decides land from water synchronously and cannot fetch water.json, so the same
 * polygons are frozen into a 512x512 bitmask at 128 m. A cell is water when its centre is inside a
 * polygon, resolved by scanline: every ring of a polygon feeds one crossing list and the even-odd
 * rule subtracts the islands for free.
 */
const MASK_HALF = 32768, MASK_CELL = 128;
const MASK_SIZE = (MASK_HALF * 2) / MASK_CELL;
const MASK_STRIDE = MASK_SIZE / 8;
const maskBits = new Uint8Array(MASK_STRIDE * MASK_SIZE);

/** Index of the first cell whose centre is at or past `value`, on either axis. */
function cellAtOrAfter(value) { return Math.ceil((value + MASK_HALF) / MASK_CELL - .5); }

function rasterizeWater(polygons) {
  const rows = new Map();
  for (const polygon of polygons) {
    rows.clear();
    for (const ring of polygon.rings) {
      const count = ring.length / 2;
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % count;
        const az = ring[i * 2 + 1], bz = ring[j * 2 + 1];
        if (az === bz) continue;
        const ax = ring[i * 2], bx = ring[j * 2];
        // Half-open in z so a vertex shared by two edges is counted once and spans stay paired.
        const from = Math.max(0, cellAtOrAfter(Math.min(az, bz)));
        const to = Math.min(MASK_SIZE - 1, cellAtOrAfter(Math.max(az, bz)) - 1);
        for (let row = from; row <= to; row++) {
          const z = row * MASK_CELL + MASK_CELL / 2 - MASK_HALF;
          let list = rows.get(row);
          if (!list) { list = []; rows.set(row, list); }
          list.push(ax + (bx - ax) * (z - az) / (bz - az));
        }
      }
    }
    for (const [row, list] of rows) {
      list.sort((a, b) => a - b);
      const base = row * MASK_STRIDE;
      for (let i = 0; i + 1 < list.length; i += 2) {
        const from = Math.max(0, cellAtOrAfter(list[i]));
        const to = Math.min(MASK_SIZE - 1, cellAtOrAfter(list[i + 1]) - 1);
        for (let col = from; col <= to; col++) maskBits[base + (col >> 3)] |= 1 << (col & 7);
      }
    }
  }
}
rasterizeWater(waterPolygons);

let landmaskWaterCells = 0;
for (const byte of maskBits) for (let bit = 0; bit < 8; bit++) if (byte & (1 << bit)) landmaskWaterCells++;
fs.writeFileSync(path.join(out, 'landmask.json'), JSON.stringify({
  originX: -MASK_HALF, originZ: -MASK_HALF, cell: MASK_CELL,
  width: MASK_SIZE, height: MASK_SIZE, bits: Buffer.from(maskBits).toString('base64'),
}));

/** Overture calls a Manaus bairro a macrohood; the other three appear a handful of times each. */
const DISTRICT_SUBTYPES = new Set(['macrohood', 'microhood', 'neighborhood', 'locality']);
const DISTRICT_RADIUS = 30000;

const districts = [];
if (fs.existsSync(DIVISIONS_FILE)) {
  for (const feature of readGeoJSON(DIVISIONS_FILE)) {
    const props = feature.properties ?? {};
    const kind = String(props.subtype ?? '').toLowerCase();
    if (!DISTRICT_SUBTYPES.has(kind)) continue;
    const name = featureName(props);
    if (!name) continue;
    for (const polygon of extractRings(feature.geometry)) {
      if (!polygon.length) continue;
      const outer = simplifyRing(projectRing(polygon[0]), 15);
      if (outer.length < 3) continue;
      const centre = ringCentroid(outer);
      if (Math.hypot(centre.x, centre.z) > DISTRICT_RADIUS) continue;
      const rings = [packRing(outer)];
      for (let i = 1; i < polygon.length; i++) {
        const hole = simplifyRing(projectRing(polygon[i]), 15);
        if (hole.length >= 3) rings.push(packRing(hole));
      }
      districts.push({ name, kind, x: Number(centre.x.toFixed(1)), z: Number(centre.z.toFixed(1)), rings });
    }
  }
}
fs.writeFileSync(path.join(out, 'districts.json'), JSON.stringify({ districts }));

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'Overture Maps + OpenStreetMap derived transportation, compiled offline for DR Manaus',
  origin: ORIGIN,
  tileSize: TILE_SIZE,
  proceduralChunkSize: PROCEDURAL_CHUNK_SIZE,
  tiles: tileFiles,
  roads: 'roads.json',
  roadgraph: 'roadgraph.json',
  pois: 'pois.json',
  skyline: 'skyline.json',
  landmarks: 'landmarks.json',
  water: 'water.json',
  landmask: 'landmask.json',
  districts: 'districts.json',
  stats: {
    buildings: buildingCount, tiles: tiles.size, roads: roads.length, pois: pois.length,
    reservedSkipped: skipped, skylineBlocks, landmarkFeatures: landmarks.length, namedRoads,
    waterPolygons: waterPolygons.length, districtCount: districts.length, landmaskWaterCells,
    roadSegments: graphSegments.length, roadNodes: graphNodes.length,
  },
};
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));

const attribution = [
  'DR Manaus geographic data attribution',
  '',
  'Buildings, transportation, water and divisions: © OpenStreetMap contributors, Overture Maps Foundation.',
  'Overture Maps data accessed during development. Overture building, transportation, base (water) and divisions themes are distributed under ODbL 1.0.',
  'OpenStreetMap: https://www.openstreetmap.org/copyright',
  'Overture Maps: https://overturemaps.org/',
  '',
  'Copernicus DEM is not bundled by this phase. If added later, retain the required Copernicus attribution in this file.',
  '',
];
fs.writeFileSync(path.join(projectRoot, 'public', 'geodata', 'ATTRIBUTION.txt'), attribution.join('\n'));

console.log(JSON.stringify(manifest.stats, null, 2));
const graphBytes = fs.statSync(path.join(out, 'roadgraph.json')).size;
console.log(`roadgraph: ${graphSegments.length} segments (${splitCount} cut at T-junctions), ${graphNodes.length} nodes, `
  + `${(graphBytes / 1048576).toFixed(2)} MB · oneway ${(onewayFound / graphRawCount * 100).toFixed(1)}% `
  + `· speed_limits ${(speedLimitFound / graphRawCount * 100).toFixed(1)}% · width_rules ${(widthRuleFound / graphRawCount * 100).toFixed(2)}%`);
console.log(`Real city assets written to ${out}`);
