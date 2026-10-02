import payload from '../geodata/moon-surface.json';
import type { Vec3 } from '../spatial/units';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decode(value: string): Uint8Array {
  const clean = value.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let bits = 0, buffer = 0, cursor = 0;
  for (const char of clean) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('Invalid bundled lunar data');
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes[cursor++] = (buffer >> bits) & 255; }
  }
  return bytes;
}

const elevationBytes = decode(payload.elevation.values);
const elevationView = new DataView(elevationBytes.buffer);
const heights = new Float32Array(payload.elevation.width * payload.elevation.height);
const albedo = decode(payload.albedo.values);
if (elevationBytes.length !== heights.length * 2 || albedo.length !== payload.albedo.width * payload.albedo.height) {
  throw new Error('Bundled lunar grid size mismatch');
}
for (let i = 0; i < heights.length; i++) heights[i] = elevationView.getInt16(i * 2, true) * payload.elevation.unitM;

export const MOON_SURFACE_DATA = {
  source: payload.source, sourcePage: payload.sourcePage, usageBasis: payload.usageBasis, usageUrl: payload.usageUrl,
  licence: payload.licence, retrievedAt: payload.retrievedAt,
  credit: payload.credit, sources: payload.sources, referenceRadiusM: payload.referenceRadiusM,
  elevationWidth: payload.elevation.width, elevationHeight: payload.elevation.height,
  minElevationM: payload.elevation.minM, maxElevationM: payload.elevation.maxM,
  albedoWidth: payload.albedo.width, albedoHeight: payload.albedo.height,
  decodedBytes: elevationBytes.byteLength + albedo.byteLength,
} as const;

function polarMean(grid: ArrayLike<number>, width: number, row: number): number {
  let sum = 0;
  for (let x = 0; x < width; x++) sum += grid[row * width + x];
  return sum / width;
}
const heightPoles = [polarMean(heights, payload.elevation.width, 0), polarMean(heights, payload.elevation.width, payload.elevation.height - 1)];
const albedoPoles = [polarMean(albedo, payload.albedo.width, 0), polarMean(albedo, payload.albedo.width, payload.albedo.height - 1)];

/** Pixel-centre sampling, east-positive longitude, seamless antimeridian and longitude-free poles. */
function sample(grid: ArrayLike<number>, width: number, height: number, poles: number[], direction: Vec3): number {
  const lat = Math.atan2(direction[2], Math.hypot(direction[0], direction[1]));
  const lon = Math.atan2(direction[1], direction[0]);
  const x = (lon / (Math.PI * 2) + 0.5) * width - 0.5;
  const y = (0.5 - lat / Math.PI) * height - 0.5;
  if (!Number.isFinite(x + y)) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  const get = (cx: number, cy: number) => grid[Math.max(0, Math.min(height - 1, cy)) * width + ((cx % width + width) % width)];
  const a = get(x0, y0) * (1 - tx) + get(x0 + 1, y0) * tx;
  const b = get(x0, y0 + 1) * (1 - tx) + get(x0 + 1, y0 + 1) * tx;
  const value = a * (1 - ty) + b * ty;
  const polarMix = Math.max(0, Math.min(1, y < 0 ? -y * 2 : (y - height + 1) * 2));
  return value * (1 - polarMix) + poles[y < 0 ? 0 : 1] * polarMix;
}

export function lunarElevationM(direction: Vec3): number {
  return sample(heights, payload.elevation.width, payload.elevation.height, heightPoles, direction);
}
export function lunarAlbedo01(direction: Vec3): number {
  return sample(albedo, payload.albedo.width, payload.albedo.height, albedoPoles, direction) / 255;
}

/** Lower bound over all bilinear cells in a spherical neighbourhood, including pole blends. */
export function lunarMinimumElevationM(direction: Vec3, radiusRad: number): number {
  const width = payload.elevation.width, height = payload.elevation.height;
  const lat = Math.atan2(direction[2], Math.hypot(direction[0], direction[1]));
  const lon = Math.atan2(direction[1], direction[0]);
  const radius = Math.max(0, Math.min(Math.PI, radiusRad));
  const polar = Math.abs(lat) + radius >= Math.PI / 2;
  const longitudeRadius = polar ? Math.PI : Math.min(Math.PI, radius / Math.cos(Math.abs(lat) + radius));
  const cx = (lon / (2 * Math.PI) + .5) * width - .5;
  const halfWidth = longitudeRadius / (2 * Math.PI) * width;
  const minX = polar ? 0 : Math.floor(cx - halfWidth) - 1;
  const maxX = polar ? width - 1 : Math.ceil(cx + halfWidth) + 1;
  const minY = Math.max(0, Math.floor((.5 - (lat + radius) / Math.PI) * height - .5) - 1);
  const maxY = Math.min(height - 1, Math.ceil((.5 - (lat - radius) / Math.PI) * height - .5) + 1);
  let minimum = Infinity;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    minimum = Math.min(minimum, heights[y * width + ((x % width + width) % width)]);
  }
  return minimum;
}
