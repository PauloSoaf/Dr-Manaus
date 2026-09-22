import type { Vector3 } from 'three/webgpu';

export interface RoadSegment {
  id: string;
  name: string | null;
  class: string;
  width: number;
  /** Flat `x,z` pairs in world metres, running from node `a` to node `b`. */
  p: Float32Array;
  length: number;
  oneway: boolean;
  bridge: boolean;
  /** Free-flow speed in metres per second. */
  speed: number;
  a: number;
  b: number;
}

/**
 * Arc length at every vertex and the segment's own slot in the graph, carried on the record itself
 * so `sample` costs a property read instead of a search through 59k segments.
 */
interface IndexedSegment extends RoadSegment { readonly index: number; readonly arc: Float32Array }

/** As compiled by scripts/geodata/compile-real-city.mjs; `name`, `oneway` and `bridge` default away. */
interface PackedSegment {
  id?: unknown; name?: unknown; class?: unknown; width?: unknown; p?: unknown;
  oneway?: unknown; bridge?: unknown; speed?: unknown; a?: unknown; b?: unknown;
}
interface PackedGraph { segments?: unknown; nodes?: unknown }

/** One bucket per 256 m: a spawn query of a few hundred metres touches a handful of cells. */
const CELL = 256;
/** Cell coordinates are packed into one int; Manaus spans a few hundred cells, not 32768. */
const KEY_BIAS = 32768;

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * The drivable road network of Manaus as a navigable graph: real Overture geometry joined at the
 * connector nodes the source publishes, so a car that reaches the end of a street finds the streets
 * that actually meet it there. Every per-frame query is answered from precomputed arrays.
 */
export class RoadGraph {
  private readonly all: IndexedSegment[] = [];
  /** minX, minZ, maxX, maxZ per segment, four floats apart, for box rejection without allocation. */
  private boxes = new Float32Array(0);
  private readonly byNode = new Map<number, number[]>();
  private readonly cells = new Map<number, number[]>();
  private nodes = new Float32Array(0);
  /** Query stamps: `near` dedupes segments spanning several cells without clearing a set. */
  private stamps = new Int32Array(0);
  private stamp = 0;
  private readonly exitBuffer: RoadSegment[] = [];
  private readonly nearBuffer: RoadSegment[] = [];

  get size(): number { return this.all.length; }
  get segments(): readonly RoadSegment[] { return this.all; }
  get nodeCount(): number { return this.nodes.length >> 1; }

  /** Returns false rather than throwing: a missing or malformed roadgraph.json must not kill boot. */
  load(payload: unknown): boolean {
    const graph = payload as PackedGraph | null;
    const packed = Array.isArray(graph?.segments) ? graph.segments as PackedSegment[] : null;
    if (!packed?.length) return false;
    const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes as unknown[] : [];
    this.nodes = new Float32Array(rawNodes.length * 2);
    for (let i = 0; i < rawNodes.length; i++) {
      const node = rawNodes[i];
      if (!Array.isArray(node)) continue;
      this.nodes[i * 2] = toNumber(node[0], 0);
      this.nodes[i * 2 + 1] = toNumber(node[1], 0);
    }
    const boxes: number[] = [];
    for (const entry of packed) {
      const flat = Array.isArray(entry.p) ? entry.p as unknown[] : null;
      if (!flat || flat.length < 4) continue;
      const count = flat.length >> 1;
      const p = new Float32Array(count * 2);
      for (let i = 0; i < count * 2; i++) p[i] = toNumber(flat[i], 0);
      const arc = new Float32Array(count);
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < count; i++) {
        const x = p[i * 2], z = p[i * 2 + 1];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        if (i) arc[i] = arc[i - 1] + Math.hypot(x - p[i * 2 - 2], z - p[i * 2 - 1]);
      }
      const length = arc[count - 1];
      if (!(length > .5)) continue;
      const index = this.all.length;
      this.all.push({
        index, arc,
        id: typeof entry.id === 'string' && entry.id ? entry.id : `s${index}`,
        name: typeof entry.name === 'string' && entry.name ? entry.name : null,
        class: typeof entry.class === 'string' ? entry.class : 'residential',
        // The renderer draws every ribbon at least 3 m wide, so a narrower lane would sit off asphalt.
        width: Math.max(3, toNumber(entry.width, 7)),
        p, length,
        oneway: entry.oneway === true,
        bridge: entry.bridge === true,
        speed: Math.max(2, toNumber(entry.speed, 8.3)),
        a: toNumber(entry.a, -1) | 0,
        b: toNumber(entry.b, -1) | 0,
      });
      boxes.push(minX, minZ, maxX, maxZ);
      const segment = this.all[index];
      for (const node of [segment.a, segment.b]) {
        if (node < 0) continue;
        const list = this.byNode.get(node);
        if (list) list.push(index); else this.byNode.set(node, [index]);
      }
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
          const key = RoadGraph.key(cx, cz);
          const bucket = this.cells.get(key);
          if (bucket) bucket.push(index); else this.cells.set(key, [index]);
        }
      }
    }
    this.boxes = new Float32Array(boxes);
    this.stamps = new Int32Array(this.all.length);
    return this.all.length > 0;
  }

  private static key(cx: number, cz: number): number { return ((cx + KEY_BIAS) << 16) | (cz + KEY_BIAS); }

  /**
   * Segments leaving `node`. The one arrived on is dropped so a driver does not turn round in the
   * middle of a junction; at a true dead end it comes back as the only move, which is what a car
   * does at the end of a cul-de-sac.
   */
  exits(node: number, from?: RoadSegment): readonly RoadSegment[] {
    const out = this.exitBuffer;
    out.length = 0;
    const list = this.byNode.get(node);
    if (!list) return out;
    for (const index of list) {
      const segment = this.all[index];
      if (segment === from) continue;
      // A one-way is only ever entered at its `a` end: `b` is where its own traffic comes out.
      if (segment.oneway && segment.a !== node) continue;
      out.push(segment);
    }
    if (!out.length && from && !from.oneway) out.push(from);
    return out;
  }

  /** `t` is parametric in 0..1, so the arc length of the hit is `t * segment.length`. */
  nearest(x: number, z: number, maxDistance = 60): { segment: RoadSegment; t: number } | null {
    let best = maxDistance * maxDistance, bestIndex = -1, bestT = 0;
    const rings = Math.max(1, Math.ceil(maxDistance / CELL));
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let ring = 0; ring <= rings; ring++) {
      for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
        // Only the new perimeter: the interior was covered by an earlier ring.
        if (ring && Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
        const bucket = this.cells.get(RoadGraph.key(cx + dx, cz + dz));
        if (!bucket) continue;
        for (const index of bucket) {
          const box = index * 4;
          const gapX = x < this.boxes[box] ? this.boxes[box] - x : x > this.boxes[box + 2] ? x - this.boxes[box + 2] : 0;
          const gapZ = z < this.boxes[box + 1] ? this.boxes[box + 1] - z : z > this.boxes[box + 3] ? z - this.boxes[box + 3] : 0;
          if (gapX * gapX + gapZ * gapZ >= best) continue;
          const segment = this.all[index], p = segment.p, arc = segment.arc;
          for (let i = 2; i < p.length; i += 2) {
            const ax = p[i - 2], az = p[i - 1];
            const ux = p[i] - ax, uz = p[i + 1] - az;
            const span = ux * ux + uz * uz;
            const t = span > 0 ? Math.min(1, Math.max(0, ((x - ax) * ux + (z - az) * uz) / span)) : 0;
            const px = ax + ux * t - x, pz = az + uz * t - z;
            const distance = px * px + pz * pz;
            if (distance >= best) continue;
            best = distance; bestIndex = index;
            const vertex = (i >> 1) - 1;
            bestT = (arc[vertex] + (arc[vertex + 1] - arc[vertex]) * t) / segment.length;
          }
        }
      }
      // Nothing outside this ring can be closer than its inner edge, so a hit inside it is final.
      if (bestIndex >= 0 && best < (ring * CELL) ** 2) break;
    }
    return bestIndex < 0 ? null : { segment: this.all[bestIndex], t: bestT };
  }

  /** Bounding-box overlap, not true distance: this feeds spawning and culling, which tolerate slop. */
  near(x: number, z: number, radius: number): readonly RoadSegment[] {
    const out = this.nearBuffer;
    out.length = 0;
    this.stamp++;
    const minX = Math.floor((x - radius) / CELL), maxX = Math.floor((x + radius) / CELL);
    const minZ = Math.floor((z - radius) / CELL), maxZ = Math.floor((z + radius) / CELL);
    for (let cz = minZ; cz <= maxZ; cz++) for (let cx = minX; cx <= maxX; cx++) {
      const bucket = this.cells.get(RoadGraph.key(cx, cz));
      if (!bucket) continue;
      for (const index of bucket) {
        if (this.stamps[index] === this.stamp) continue;
        this.stamps[index] = this.stamp;
        const box = index * 4;
        if (this.boxes[box] > x + radius || this.boxes[box + 2] < x - radius) continue;
        if (this.boxes[box + 1] > z + radius || this.boxes[box + 3] < z - radius) continue;
        out.push(this.all[index]);
      }
    }
    return out;
  }

  /** World position of a connector node, for a driver that has just arrived at one. */
  nodePosition(node: number, out: Vector3): boolean {
    if (node < 0 || node * 2 + 1 >= this.nodes.length) return false;
    out.set(this.nodes[node * 2], 0, this.nodes[node * 2 + 1]);
    return true;
  }

  /** World position and unit tangent at arc length `s`; `s` is clamped to the segment. */
  sample(segment: RoadSegment, s: number, outPosition: Vector3, outTangent: Vector3): void {
    const arc = (segment as IndexedSegment).arc;
    const p = segment.p;
    const distance = s < 0 ? 0 : s > segment.length ? segment.length : s;
    let i = 1;
    while (i < arc.length - 1 && arc[i] < distance) i++;
    const from = arc[i - 1], span = arc[i] - from || 1;
    const t = (distance - from) / span;
    const ax = p[i * 2 - 2], az = p[i * 2 - 1];
    const ux = p[i * 2] - ax, uz = p[i * 2 + 1] - az;
    const inverse = 1 / (Math.hypot(ux, uz) || 1);
    outPosition.set(ax + ux * t, 0, az + uz * t);
    outTangent.set(ux * inverse, 0, uz * inverse);
  }

  dispose(): void {
    this.all.length = 0;
    this.byNode.clear();
    this.cells.clear();
    this.boxes = new Float32Array(0);
    this.nodes = new Float32Array(0);
    this.stamps = new Int32Array(0);
  }
}
