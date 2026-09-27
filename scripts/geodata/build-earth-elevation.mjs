/**
 * Builds the global elevation raster the planet's relief comes from.
 *
 * Source: NOAA NGDC ETOPO5, the 5-arc-minute global relief grid — 4320 x 2160 signed 16-bit
 * metres, little endian, row major from 90N to 90S and from 0E eastward. Produced by the United
 * States government, and therefore public domain. The download happens here, at build time, and
 * never during gameplay; the shipped file is a downsampled derivative, not the grid.
 *
 *   node scripts/geodata/build-earth-elevation.mjs [--width 512] [--source path.bin]
 *
 * Why a downsample rather than the original: the source is 18 MB, and the globe is never drawn
 * from closer than 15 km, where a tile spans tens of kilometres. At the default 512 x 256 a sample
 * is about 78 km, which is the same order as the finest tile the quadtree selects — finer data
 * would be averaged away by the geometry that reads it. Raise `--width` when the tiles get finer.
 *
 * Why the mean rather than the maximum when downsampling: a maximum turns every cell containing a
 * peak into a plateau at that peak's height, which is how a mountain range becomes a mesa. The
 * mean is what the surface actually does over 78 km.
 */
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_URL = 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO5/TOPO/ETOPO5/ETOPO5.DOS';
const SOURCE_WIDTH = 4320;
const SOURCE_HEIGHT = 2160;
const OUT = 'src/world/geodata/earth-elevation.json';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const WIDTH = Math.max(64, Number(flag('width', 512)) | 0);
const HEIGHT = WIDTH >> 1;
const sourcePath = flag('source', null);

async function readSource() {
  if (sourcePath) return { buffer: fs.readFileSync(sourcePath), origin: sourcePath };
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`NOAA returned ${response.status}`);
  return { buffer: Buffer.from(await response.arrayBuffer()), origin: SOURCE_URL };
}

const { buffer, origin } = await readSource();
const expected = SOURCE_WIDTH * SOURCE_HEIGHT * 2;
if (buffer.length !== expected) {
  throw new Error(`expected ${expected} bytes of ETOPO5, got ${buffer.length}`);
}
const source = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
const sourceAt = (row, column) => {
  const r = Math.min(SOURCE_HEIGHT - 1, Math.max(0, row));
  const c = ((column % SOURCE_WIDTH) + SOURCE_WIDTH) % SOURCE_WIDTH;
  return source.getInt16((r * SOURCE_WIDTH + c) * 2, true);
};

/**
 * The source runs from 0E; the output runs from 180W, like the land mask and like every other
 * equirectangular asset here. Rotating by half the width is the whole conversion.
 */
const out = new Int16Array(WIDTH * HEIGHT);
const xScale = SOURCE_WIDTH / WIDTH;
const yScale = SOURCE_HEIGHT / HEIGHT;
let minM = Infinity, maxM = -Infinity, landSamples = 0;

for (let row = 0; row < HEIGHT; row++) {
  const y0 = Math.floor(row * yScale), y1 = Math.max(y0 + 1, Math.floor((row + 1) * yScale));
  for (let column = 0; column < WIDTH; column++) {
    // Output column 0 is 180W, which is source column WIDTH/2 in a grid that starts at 0E.
    const shifted = column + WIDTH / 2;
    const x0 = Math.floor(shifted * xScale), x1 = Math.max(x0 + 1, Math.floor((shifted + 1) * xScale));
    let total = 0, count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) { total += sourceAt(y, x); count++; }
    }
    const mean = Math.round(total / Math.max(1, count));
    out[row * WIDTH + column] = mean;
    if (mean < minM) minM = mean;
    if (mean > maxM) maxM = mean;
    if (mean > 0) landSamples++;
  }
}

const bytes = Buffer.from(out.buffer, out.byteOffset, out.byteLength);
const payload = {
  source: 'NOAA NGDC ETOPO5 global relief, 5 arc-minute',
  licence: 'Public domain (work of the United States government)',
  url: 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO5/',
  origin,
  retrievedAt: new Date().toISOString().slice(0, 10),
  projection: 'equirectangular, -180..180 by 90..-90',
  encoding: 'int16 little-endian metres, row major, base64',
  width: WIDTH,
  height: HEIGHT,
  minM,
  maxM,
  samples: bytes.toString('base64'),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(payload)}\n`);

console.log(`raster: ${WIDTH}x${HEIGHT}, ${(SOURCE_WIDTH / WIDTH * 5).toFixed(0)} arc-minutes per sample`);
console.log(`relief: ${minM} m to ${maxM} m, ${(landSamples / (WIDTH * HEIGHT) * 100).toFixed(1)}% above sea level`);
console.log(`${OUT}  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
