import { Group, Vector3 } from 'three/webgpu';
import bridgeData from '../geodata/bridge.json';
import { LANDMARKS } from '../geodata/geodata';
import { GeometryBatch } from './GeometryBatch';

export interface LandmarkBox { x: number; y: number; z: number; width: number; height: number; depth: number }

/**
 * The Ponte Jornalista Phelippe Daou, laid out on the centreline that actually exists in the
 * Overture transportation data rather than on a guessed heading and length.
 *
 * The crossing is a curve: it bows west to about x = -7100 at midspan before running north-east,
 * which is why the old straight deck ended up a kilometre off its own road and the player saw two
 * bridges. Both carriageways are averaged at matched arc length to give one deck centreline, and
 * everything — deck, piers, towers, stays, collision — is sampled from it.
 */
export interface BridgePath {
  /** World-space `x,z` pairs. */
  readonly points: Float32Array;
  /** Cumulative arc length at each point. */
  readonly distances: Float32Array;
  readonly length: number;
  /** Half-deck width at each sample: the carriageways fan out into the interchange ramps. */
  readonly halfWidth: Float32Array;
  readonly maxWidth: number;
}

function buildPath(): BridgePath {
  const source = bridgeData.centerline as number[];
  const points = Float32Array.from(source);
  const count = points.length / 2;
  const distances = new Float32Array(count);
  for (let i = 1; i < count; i++) {
    distances[i] = distances[i - 1] + Math.hypot(points[i * 2] - points[i * 2 - 2], points[i * 2 + 1] - points[i * 2 - 1]);
  }
  const halfWidth = Float32Array.from(bridgeData.halfWidth as number[]);
  let maxWidth = 0;
  for (const value of halfWidth) maxWidth = Math.max(maxWidth, value * 2);
  return { points, distances, length: distances[count - 1], halfWidth, maxWidth };
}

export const BRIDGE_PATH = buildPath();

/** Arc length of the navigable water crossing, measured off the compiled river polygons. */
const WATER_FROM = 331, WATER_TO = 5847;
const MAIN_SPAN_CENTRE = (WATER_FROM + WATER_TO) * .5;
const MAIN_SPAN_HALF = 200;
const DECK_LOW = 11, DECK_HIGH = 53;
const TOWER_HEIGHT = 96;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

/** Low at the abutments, level across the navigation span, so shipping clears it. */
export function deckHeight(s: number): number {
  const rise = Math.min(
    smoothstep(0, WATER_FROM + 700, s),
    smoothstep(BRIDGE_PATH.length, WATER_TO - 700, s),
  );
  return DECK_LOW + (DECK_HIGH - DECK_LOW) * rise;
}

/** Half-deck width at arc length `s`, interpolated between samples. */
export function halfWidthAt(s: number): number {
  const { distances, halfWidth } = BRIDGE_PATH;
  const count = distances.length;
  const clamped = Math.min(BRIDGE_PATH.length, Math.max(0, s));
  let i = 1;
  while (i < count - 1 && distances[i] < clamped) i++;
  const span = distances[i] - distances[i - 1] || 1;
  const f = (clamped - distances[i - 1]) / span;
  return halfWidth[i - 1] + (halfWidth[i] - halfWidth[i - 1]) * f;
}

/** Position and unit tangent at arc length `s`, written into the supplied vectors. */
export function sampleBridge(s: number, position: Vector3, tangent: Vector3): void {
  const { points, distances } = BRIDGE_PATH;
  const count = distances.length;
  const clamped = Math.min(BRIDGE_PATH.length, Math.max(0, s));
  let i = 1;
  while (i < count - 1 && distances[i] < clamped) i++;
  const span = distances[i] - distances[i - 1] || 1;
  const f = (clamped - distances[i - 1]) / span;
  const ax = points[i * 2 - 2], az = points[i * 2 - 1], bx = points[i * 2], bz = points[i * 2 + 1];
  position.set(ax + (bx - ax) * f, deckHeight(clamped), az + (bz - az) * f);
  const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1;
  tangent.set(dx / length, 0, dz / length);
}

/** Heading of the deck at arc length `s`, in the rotation convention GeometryBatch expects. */
function headingAt(s: number, position: Vector3, tangent: Vector3): number {
  sampleBridge(s, position, tangent);
  return Math.atan2(tangent.x, tangent.z);
}

interface Anchor { x: number; z: number }

/**
 * Detailed crossing. Deck sections follow the real polyline, piers step along accumulated arc
 * length, and the cable-stayed towers straddle the navigation span rather than the geometric
 * middle of the road, which includes long approach viaducts on both banks.
 */
export function createBridge(anchor: Anchor): Group {
  const b = new GeometryBatch();
  const position = new Vector3(), tangent = new Vector3();

  // Deck, one box per section, each oriented to the local tangent so the curve reads as a curve
  // and widened to whatever the two carriageways are actually doing at that point.
  const step = 26;
  for (let s = 0; s < BRIDGE_PATH.length; s += step) {
    const angle = headingAt(s + step * .5, position, tangent);
    const half = halfWidthAt(s + step * .5), width = half * 2;
    const x = position.x - anchor.x, z = position.z - anchor.z, y = position.y;
    b.box('stone', x, y, z, width, 1.9, step + 1.2, angle);
    b.box('white', x, y + 1.5, z, width + .8, .5, step + 1.2, angle);
    // Parapets either side, offset along the local normal.
    const nx = tangent.z, nz = -tangent.x;
    for (const side of [-1, 1]) {
      b.box('steel', x + nx * half * side, y + 2.3, z + nz * half * side, .5, 1.5, step + 1.2, angle);
    }
  }

  // Piers, closer together over the approaches and absent across the navigation span.
  for (let s = 90; s < BRIDGE_PATH.length - 90; s += 96) {
    if (Math.abs(s - MAIN_SPAN_CENTRE) < MAIN_SPAN_HALF + 40) continue;
    const angle = headingAt(s, position, tangent);
    const half = halfWidthAt(s);
    const x = position.x - anchor.x, z = position.z - anchor.z, top = position.y;
    const nx = tangent.z, nz = -tangent.x;
    for (const side of [-1, 1]) {
      const px = x + nx * half * .52 * side, pz = z + nz * half * .52 * side;
      b.box('stone', px, top * .5 - 1, pz, 3.4, top + 2, 4.2, angle);
    }
    b.box('stone', x, top - 2.6, z, half * 1.84, 2, 5, angle);
  }

  // Two towers and their stay cables: the shape that makes this bridge recognisable.
  for (const side of [-1, 1]) {
    const s = MAIN_SPAN_CENTRE + side * MAIN_SPAN_HALF;
    const angle = headingAt(s, position, tangent);
    const x = position.x - anchor.x, z = position.z - anchor.z, deck = position.y;
    const nx = tangent.z, nz = -tangent.x;
    const half = halfWidthAt(s), legOffset = half * .78;
    for (const leg of [-1, 1]) {
      const lx = x + nx * legOffset * leg, lz = z + nz * legOffset * leg;
      b.box('white', lx, deck * .5, lz, 4.4, deck + 4, 5, angle);
      b.box('white', lx + nx * -legOffset * leg * .22, deck + TOWER_HEIGHT * .5, lz + nz * -legOffset * leg * .22,
        3.6, TOWER_HEIGHT, 4.2, angle);
    }
    // Cross beams tie the legs together above the roadway.
    for (const height of [deck + TOWER_HEIGHT * .42, deck + TOWER_HEIGHT * .86]) {
      b.box('white', x, height, z, half * 2.1, 2.4, 3, angle);
    }
    // Stays fan from the tower head down the deck on both sides of the tower.
    for (let n = 1; n <= 9; n++) {
      const reach = n * (MAIN_SPAN_HALF * .96) / 9;
      for (const along of [-1, 1]) {
        const at = s + reach * along;
        if (at < 40 || at > BRIDGE_PATH.length - 40) continue;
        sampleBridge(at, position, tangent);
        const dx = position.x - anchor.x, dz = position.z - anchor.z, dy = position.y + 2.6;
        for (const leg of [-1, 1]) {
          const topX = x + nx * legOffset * leg * .78, topZ = z + nz * legOffset * leg * .78;
          b.beam('steel', new Vector3(topX, deck + TOWER_HEIGHT * .94, topZ),
            new Vector3(dx + nx * half * .82 * leg, dy, dz + nz * half * .82 * leg), .34, 4);
        }
      }
    }
  }

  return b.build('Ponte Jornalista Phelippe Daou — real Overture centreline');
}

/** Cheap distant crossing: the deck line and the two towers, nothing else. */
export function createBridgeSilhouette(anchor: Anchor): Group {
  const b = new GeometryBatch();
  const position = new Vector3(), tangent = new Vector3();
  const step = 120;
  for (let s = 0; s < BRIDGE_PATH.length; s += step) {
    const angle = headingAt(s + step * .5, position, tangent);
    b.box('stone', position.x - anchor.x, position.y, position.z - anchor.z, halfWidthAt(s) * 2, 2.4, step + 2, angle);
  }
  for (const side of [-1, 1]) {
    const angle = headingAt(MAIN_SPAN_CENTRE + side * MAIN_SPAN_HALF, position, tangent);
    b.box('white', position.x - anchor.x, position.y + TOWER_HEIGHT * .5, position.z - anchor.z,
      halfWidthAt(MAIN_SPAN_CENTRE + side * MAIN_SPAN_HALF) * 1.8, TOWER_HEIGHT, 4, angle);
  }
  return b.build('Ponte Rio Negro distant');
}

/**
 * Collision deck, local to the anchor. Sampled from the same path as the geometry, so the surface
 * the player lands on cannot drift away from the surface they can see.
 */
export function bridgeColliders(anchor: Anchor): LandmarkBox[] {
  const boxes: LandmarkBox[] = [];
  const position = new Vector3(), tangent = new Vector3();
  const step = 24;
  for (let s = 0; s < BRIDGE_PATH.length; s += step) {
    sampleBridge(s + step * .5, position, tangent);
    // Axis-aligned boxes are generous on a diagonal run, which is what keeps the deck landable.
    const width = halfWidthAt(s + step * .5) * 2;
    const across = Math.abs(tangent.z) * width + Math.abs(tangent.x) * step;
    const along = Math.abs(tangent.x) * width + Math.abs(tangent.z) * step;
    boxes.push({
      x: position.x - anchor.x, y: position.y, z: position.z - anchor.z,
      width: across + 2, height: 3.4, depth: along + 2,
    });
  }
  return boxes;
}

/** The anchor the landmark system positions the crossing at: the midpoint of the real centreline. */
function bridgeAnchor(): Anchor {
  const landmark = LANDMARKS.find(item => item.id === 'ponte');
  return landmark ? { x: landmark.x, z: landmark.z } : { x: 0, z: 0 };
}
export function createBridgeModel(): Group { return createBridge(bridgeAnchor()); }
export function createBridgeDistant(): Group { return createBridgeSilhouette(bridgeAnchor()); }
export function bridgeDeckColliders(): LandmarkBox[] { return bridgeColliders(bridgeAnchor()); }
