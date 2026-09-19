import type { Vector3 } from 'three/webgpu';
import type { RoadGraph, RoadSegment } from './RoadGraph';

/** A lane is never narrower than this, so a 5 m service road still holds one car clear of the kerb. */
const LANE_WIDTH = 3.4;
/** Blend from the junction geometry to the driver's whim; 1 would send every car straight forever. */
const TURN_BIAS = .62;
/** A frame that crosses several short service stubs still terminates. */
const MAX_HOPS = 6;
/** Junction scratch, shared by every driver: only one navigator is ever mid-turn at a time. */
const arriving = new Float64Array(2);
const leaving = new Float64Array(2);

/** Deterministic 32-bit mix: two drivers with the same seed make the same journey, frame rate aside. */
export function hash32(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function unit(seed: number, salt: number): number { return hash32(seed, salt) / 4294967296; }

/**
 * Signed lateral offset from the centreline, positive to the driver's right — Brazil drives on the
 * right. The half-width is the one `src/world/realcity/roads.ts` actually renders (`max(3, width)/2`,
 * already applied when the graph loaded), so a lane always lands on asphalt and never on the paint.
 */
export function laneOffset(segment: RoadSegment, seed: number): number {
  const half = segment.width * .5;
  if (segment.oneway) {
    // A one-way owns the whole ribbon, so its lanes straddle the middle. The count is forced even:
    // an odd one puts the middle lane exactly on the centre line, which is where the paint goes.
    const lanes = Math.max(2, Math.min(4, Math.round(segment.width / (LANE_WIDTH * 2)) * 2));
    return ((hash32(seed, 0x1a7e) % lanes) + .5) * (segment.width / lanes) - half;
  }
  // A two-way owns the right half only; lane 0 sits against the centre line, the rest toward the kerb.
  const lanes = Math.max(1, Math.min(2, Math.floor(half / LANE_WIDTH)));
  return ((hash32(seed, 0x1a7e) % lanes) + .5) * (half / lanes);
}

/**
 * One driver's state on the graph. It only ever moves along arc length on a real segment, so a
 * vehicle cannot be anywhere a car could not be; at a connector it takes a legal exit, preferring
 * the one that continues roughly straight the way a driver on an avenue does.
 */
export class VehicleNavigator {
  segment: RoadSegment | null = null;
  /** Arc length from the segment's `a` end, regardless of which way this driver is going. */
  distance = 0;
  /** True when travelling `a` to `b`, which is the only legal direction on a one-way. */
  forward = true;
  lane = 0;
  speed = 0;
  targetSpeed = 0;
  seed = 0;
  /** Junctions taken, so the exit choice varies down a journey instead of repeating one turn. */
  turns = 0;

  get active(): boolean { return this.segment !== null; }

  /** Places the driver at parametric `t` on `segment`, heading whichever way the road allows. */
  place(segment: RoadSegment, t: number, seed: number): void {
    this.segment = segment;
    this.seed = seed >>> 0;
    this.turns = 0;
    this.forward = segment.oneway || unit(this.seed, 0x51ed) < .5;
    this.distance = Math.min(segment.length, Math.max(0, t * segment.length));
    this.lane = laneOffset(segment, this.seed);
    // A spread of driver temperaments keeps a convoy from moving as one rigid block.
    this.targetSpeed = segment.speed * (.72 + unit(this.seed, 0x2d19) * .4);
    this.speed = this.targetSpeed;
  }

  clear(): void { this.segment = null; this.speed = 0; }

  /** Advances by `dt`, crossing junctions as needed. Returns false when the road simply runs out. */
  advance(graph: RoadGraph, dt: number): boolean {
    const segment = this.segment;
    if (!segment) return false;
    this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 1.8);
    let remaining = this.speed * dt;
    for (let hop = 0; hop < MAX_HOPS && remaining > 0; hop++) {
      const current = this.segment;
      if (!current) return false;
      const room = this.forward ? current.length - this.distance : this.distance;
      if (remaining < room) {
        this.distance += this.forward ? remaining : -remaining;
        return true;
      }
      remaining -= room;
      if (!this.cross(graph, current)) { this.clear(); return false; }
    }
    return this.segment !== null;
  }

  /** Takes an exit at the node this driver has just reached. */
  private cross(graph: RoadGraph, current: RoadSegment): boolean {
    const node = this.forward ? current.b : current.a;
    if (node < 0) return false;
    const exits = graph.exits(node, current);
    if (!exits.length) return false;
    VehicleNavigator.tangentAt(current, node, true, arriving);
    let best: RoadSegment | null = null, bestScore = -Infinity;
    for (let i = 0; i < exits.length; i++) {
      const exit = exits[i];
      VehicleNavigator.tangentAt(exit, node, false, leaving);
      // Straight on scores 1, a right angle 0, a U-turn -1; the jitter breaks ties at crossroads.
      const straight = arriving[0] * leaving[0] + arriving[1] * leaving[1];
      const score = straight * TURN_BIAS + unit(hash32(this.seed, this.turns), i) * (1 - TURN_BIAS);
      if (score > bestScore) { bestScore = score; best = exit; }
    }
    if (!best) return false;
    this.turns++;
    this.forward = best.a === node;
    this.distance = this.forward ? 0 : best.length;
    this.segment = best;
    this.lane = laneOffset(best, hash32(this.seed, best.a));
    this.targetSpeed = best.speed * (.72 + unit(this.seed, 0x2d19) * .4);
    return true;
  }

  /**
   * Unit tangent of `segment` at `node`, read straight off the polyline into `out`. Leaving points
   * away from the node; arriving points into it, which is how the driver is already facing.
   */
  private static tangentAt(segment: RoadSegment, node: number, into: boolean, out: Float64Array): void {
    const p = segment.p, last = p.length;
    const atA = segment.a === node;
    const ax = atA ? p[0] : p[last - 2], az = atA ? p[1] : p[last - 1];
    const bx = atA ? p[2] : p[last - 4], bz = atA ? p[3] : p[last - 3];
    let dx = bx - ax, dz = bz - az;
    if (into) { dx = -dx; dz = -dz; }
    const inverse = 1 / (Math.hypot(dx, dz) || 1);
    out[0] = dx * inverse; out[1] = dz * inverse;
  }

  /** Lane position and heading. `outTangent` is the direction of travel, already lane-corrected. */
  pose(graph: RoadGraph, outPosition: Vector3, outTangent: Vector3): void {
    const segment = this.segment;
    if (!segment) return;
    graph.sample(segment, this.distance, outPosition, outTangent);
    if (!this.forward) outTangent.set(-outTangent.x, 0, -outTangent.z);
    // Right of the direction of travel, matching the ribbon normal in roads.ts.
    outPosition.x += -outTangent.z * this.lane;
    outPosition.z += outTangent.x * this.lane;
  }
}
