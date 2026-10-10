/**
 * Builds the global land mask the planet is coloured with.
 *
 * Source: Natural Earth 1:110m "land" polygons. Natural Earth is public domain — its terms state
 * that no permission is needed and that crediting the authors is appreciated but not required.
 * The download happens here, at build time, and never during gameplay; the shipped file is a
 * derived raster, not the vector download.
 *
 *   node scripts/geodata/build-earth-vectors.mjs [--width 1024] [--source path.geojson]
 *
 * Why a raster and not the polygons: the globe asks "is this vertex land?" once per vertex per
 * tile, thousands of times a frame while streaming. A point-in-polygon test against four thousand
 * edges would be far too slow, and a bitmask answers in one lookup. 1024x512 puts a pixel at
 * about 39 km, which is finer than the coastline detail 1:110m data carries anyway.
 */
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';
const OUT = 'src/world/geodata/earth-landmask.json';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const WIDTH = Math.max(256, Number(flag('width', 1024)) | 0);
const HEIGHT = WIDTH >> 1;
const sourcePath = flag('source', null);

async function readSource() {
  if (sourcePath) {
    return { json: JSON.parse(fs.readFileSync(sourcePath, 'utf8')), origin: sourcePath };
  }
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Natural Earth returned ${response.status}`);
  return { json: await response.json(), origin: SOURCE_URL };
}

/** Every ring of every polygon, flattened. Holes come through as their own rings. */
function collectRings(geojson) {
  const rings = [];
  for (const feature of geojson.features ?? []) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === 'Polygon') rings.push(...geometry.coordinates);
    else if (geometry.type === 'MultiPolygon') for (const polygon of geometry.coordinates) rings.push(...polygon);
  }
  return rings;
}

/**
 * Scanline fill in equirectangular pixel space.
 *
 * One row at a time: find where every edge crosses that row, sort the crossings, and fill between
 * alternate pairs. Even-odd rather than winding, which is what makes holes — the Caspian Sea, the
 * Great Lakes — come out as water without needing to know which ring is which.
 *
 * Testing each pixel against every edge instead would be half a million pixels times four
 * thousand edges, which is two billion tests for a picture 87 KB in size.
 */
function rasterise(rings, width, height) {
  const mask = new Uint8Array((width * height) >> 3);
  const toPixelX = lon => ((lon + 180) / 360) * width;
  const toPixelY = lat => ((90 - lat) / 180) * height;

  const edges = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i], [lon2, lat2] = ring[i + 1];
      const y1 = toPixelY(lat1), y2 = toPixelY(lat2);
      if (y1 === y2) continue;   // horizontal edges contribute no crossings
      edges.push({ y1, y2, x1: toPixelX(lon1), x2: toPixelX(lon2) });
    }
  }

  const crossings = [];
  for (let row = 0; row < height; row++) {
    const y = row + 0.5;
    crossings.length = 0;
    for (const edge of edges) {
      const low = Math.min(edge.y1, edge.y2), high = Math.max(edge.y1, edge.y2);
      if (y < low || y >= high) continue;
      const t = (y - edge.y1) / (edge.y2 - edge.y1);
      crossings.push(edge.x1 + (edge.x2 - edge.x1) * t);
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(0, Math.ceil(crossings[i] - 0.5));
      const to = Math.min(width - 1, Math.floor(crossings[i + 1] - 0.5));
      for (let column = from; column <= to; column++) {
        const index = row * width + column;
        mask[index >> 3] |= 1 << (index & 7);
      }
    }
  }
  return mask;
}

const { json, origin } = await readSource();
const rings = collectRings(json);
if (rings.length < 50) throw new Error(`Only ${rings.length} rings found — is this the land dataset?`);

const mask = rasterise(rings, WIDTH, HEIGHT);
let land = 0;
for (const byte of mask) land += ((byte * 0x08040201) >> 3 & 0x11111111) % 15;

const payload = {
  source: 'Natural Earth 1:110m Physical Vectors — land',
  licence: 'Public domain (Natural Earth: no permission needed, credit appreciated)',
  url: 'https://www.naturalearthdata.com/',
  origin,
  retrievedAt: new Date().toISOString().slice(0, 10),
  projection: 'equirectangular, -180..180 by 90..-90',
  width: WIDTH,
  height: HEIGHT,
  landFraction: Number((land / (WIDTH * HEIGHT)).toFixed(4)),
  bits: Buffer.from(mask).toString('base64'),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(payload)}\n`);

console.log(`rings: ${rings.length}`);
console.log(`raster: ${WIDTH}x${HEIGHT}, land ${(payload.landFraction * 100).toFixed(1)}% of the sphere's rectangle`);
console.log(`${OUT}  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
