/**
 * Keeps the local Earth frame under a player who flies or walks far.
 *
 * Local physics runs in a flat tangent frame. Its gravity points along the anchor's vertical, and
 * the authored Manaus frame only draws ground for about 120 km around the city. Flying far
 * without a teleport therefore left an empty world and, past that, a slanted "down". Here the
 * frame follows: the player keeps the same geographic position, height above the ground, velocity
 * and view, and only the coordinates change. Streaming, the horizon and the forests follow the new
 * anchor on their own.
 *
 * - Leaving the Manaus frame happens beyond `leaveManausM` from its anchor.
 * - Away from the city, a new anchor is placed under the player once they are `spanM` from the
 *   current one, so gravity leans at most about 0.2°. Fast flight stretches the span, up to
 *   0.7°; slowing down to land brings the anchor back under the player.
 * - Within `returnManausM` of the city, the authored Manaus frame takes over again.
 */
import { Vector3 } from 'three/webgpu';
import type { CameraController } from '../../player/CameraController';
import type { PlayerController } from '../../player/PlayerController';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { bodyFixedToGeodetic, bodyGeodeticToFixed, EARTH } from '../planet/PlanetBody';
import { earthSurfaceChart, localSeaLevelY } from '../planet/LocalSurface';
import type { UniverseRuntime } from '../runtime/UniverseRuntime';
import { BuildingGeneratorContext } from './ActiveSurfaceOrigin';
import { enuBasis } from './ENU';
import { geodetic } from './Geodetic';
import { EARTH_FIXED_FRAME_ID, geodeticToLegacyLocal, legacyLocalToGeodetic, MANAUS_ANCHOR, MANAUS_FRAME_ID } from './ManausFrameAdapter';
import { referenceFrame } from './ReferenceFrame';
import { cloneVec3, degToRad, quatFromBasis, radToDeg, scaleVec3, type Vec3 } from './units';

export const SURFACE_FOLLOW = Object.freeze({
  /** Beyond this distance from the city anchor, the authored Manaus frame is left. */
  leaveManausM: 80_000,
  /** Within this distance, the Manaus frame takes over again. */
  returnManausM: 60_000,
  /** A followed anchor moves under the player once they are this far from it... */
  spanM: 20_000,
  /** ...or, when fast, this many seconds of flight, up to `maxSpanM`, so moves stay rare. */
  spanSeconds: 10,
  maxSpanM: 80_000,
});
/** The follow alternates between two frames, so the graph never accumulates old anchors. */
export const FOLLOW_FRAMES = ['earth/surface/follow-a', 'earth/surface/follow-b'] as const;

export interface GeoDeg { readonly latDeg: number; readonly lonDeg: number }

export function surfaceDistanceM(a: GeoDeg, b: GeoDeg): number {
  const lat1 = degToRad(a.latDeg), lat2 = degToRad(b.latDeg);
  const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(degToRad(b.lonDeg - a.lonDeg) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type FollowDecision = 'manaus' | 'follow' | null;

/** Which frame the player should be in, given where they are and the current anchor. */
export function followDecision(player: GeoDeg, anchor: GeoDeg, inManausFrame: boolean, speedMps = 0): FollowDecision {
  const fromCity = surfaceDistanceM(player, MANAUS_ANCHOR);
  if (inManausFrame) return fromCity > SURFACE_FOLLOW.leaveManausM ? 'follow' : null;
  if (fromCity < SURFACE_FOLLOW.returnManausM) return 'manaus';
  const speed = Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0;
  const span = Math.min(SURFACE_FOLLOW.maxSpanM, Math.max(SURFACE_FOLLOW.spanM, speed * SURFACE_FOLLOW.spanSeconds));
  return surfaceDistanceM(player, anchor) > span ? 'follow' : null;
}

export interface SurfaceFollowContext {
  readonly universe: UniverseRuntime;
  readonly player: PlayerController;
  readonly camera: CameraController;
  /** Binds collision to the universe's current surface frame. */
  readonly bindPhysics: () => void;
}

export interface SurfaceFollowMove {
  readonly from: string;
  readonly to: string;
  readonly latDeg: number;
  readonly lonDeg: number;
}

/** True for the frames this follows: the Manaus frame and Earth surface frames. */
function isEarthSurfaceFrame(universe: UniverseRuntime, frameId: string): boolean {
  if (frameId === MANAUS_FRAME_ID) return true;
  if (!universe.frames.has(frameId)) return false;
  const frame = universe.frames.get(frameId);
  return frame.kind === 'surface-enu' && frame.parentId === EARTH_FIXED_FRAME_ID;
}

/** Height of what the player stands on or floats in: the bound ground, or the sea above it. */
function supportHeight(frameId: string, anchor: GeoDeg, x: number, z: number): number {
  const ground = PhysicsWorld.terrainHeight(x, z);
  if (frameId === MANAUS_FRAME_ID) return ground;
  const sea = localSeaLevelY(earthSurfaceChart(anchor.latDeg, anchor.lonDeg), EARTH, x, z);
  return Number.isFinite(sea) ? Math.max(ground, sea) : ground;
}

function frameAnchor(universe: UniverseRuntime, frameId: string): GeoDeg {
  if (frameId === MANAUS_FRAME_ID) return MANAUS_ANCHOR;
  const [xM, yM, zM] = universe.frames.get(frameId).originInParent;
  const anchor = bodyFixedToGeodetic(EARTH, { xM, yM, zM });
  return { latDeg: radToDeg(anchor.latRad), lonDeg: radToDeg(anchor.lonRad) };
}

/** Registers a follow frame exactly as teleports and landings anchor surface frames. */
function registerFollowFrame(universe: UniverseRuntime, frameId: string, at: GeoDeg): void {
  const anchor = geodetic(degToRad(at.latDeg), degToRad(at.lonDeg), 0);
  const fixed = bodyGeodeticToFixed(EARTH, anchor);
  const basis = enuBasis(anchor);
  universe.frames.register(referenceFrame({
    id: frameId, parentId: EARTH_FIXED_FRAME_ID, kind: 'surface-enu',
    originInParent: [fixed.xM, fixed.yM, fixed.zM],
    rotationToParent: quatFromBasis(cloneVec3(basis.east), cloneVec3(basis.up), scaleVec3(cloneVec3(basis.north), -1, [0, 0, 0])),
    label: `Terra (${at.latDeg.toFixed(2)}°, ${at.lonDeg.toFixed(2)}°)`,
  }));
}

/**
 * Moves the local frame under the player when needed. Call once per frame in local Earth physics,
 * with collision bound to the current frame. Returns the move made, or null.
 */
export function followSurface(ctx: SurfaceFollowContext): SurfaceFollowMove | null {
  const { universe, player, camera } = ctx;
  const from = universe.player.frame;
  if (!isEarthSurfaceFrame(universe, from)) return null;
  const inManaus = from === MANAUS_FRAME_ID;
  const { x, y, z } = player.position;
  let here;
  if (inManaus) {
    here = legacyLocalToGeodetic(x, y, z);
  } else {
    const fixed = universe.frames.convertPosition(from, EARTH_FIXED_FRAME_ID, [x, y, z]);
    here = bodyFixedToGeodetic(EARTH, { xM: fixed[0], yM: fixed[1], zM: fixed[2] });
  }
  const at: GeoDeg = { latDeg: radToDeg(here.latRad), lonDeg: radToDeg(here.lonRad) };
  if (!Number.isFinite(at.latDeg + at.lonDeg)) return null;
  const oldAnchor = frameAnchor(universe, from);
  const decision = followDecision(at, oldAnchor, inManaus, player.velocity.length());
  if (!decision) return null;

  const heightAboveSupport = y - supportHeight(from, oldAnchor, x, z);
  const to = decision === 'manaus' ? MANAUS_FRAME_ID : from === FOLLOW_FRAMES[0] ? FOLLOW_FRAMES[1] : FOLLOW_FRAMES[0];
  if (decision === 'follow') registerFollowFrame(universe, to, at);

  // The authored city maps its flat axes onto the local east, up and south wherever the player is,
  // so velocity and view keep their components across it. Between followed frames they rotate.
  const keepAxes = inManaus || to === MANAUS_FRAME_ID;
  const camForward = camera.camera.getWorldDirection(new Vector3()).toArray() as Vec3;
  const velocity: Vec3 = keepAxes ? player.velocity.toArray() as Vec3
    : universe.frames.convertDirection(from, to, player.velocity.toArray() as Vec3);
  const forward: Vec3 = keepAxes ? camForward : universe.frames.convertDirection(from, to, camForward);

  const horizontal: Vec3 = to === MANAUS_FRAME_ID
    ? geodeticToLegacyLocal(here)
    : [0, 0, 0];
  universe.rebaseSurfaceFrame(to, [horizontal[0], 0, horizontal[2]], velocity, forward);
  BuildingGeneratorContext.activeOrigin = {
    latDeg: at.latDeg, lonDeg: at.lonDeg, isManaus: to === MANAUS_FRAME_ID, bodyId: 'earth',
  };
  ctx.bindPhysics();

  const newAnchor = frameAnchor(universe, to);
  const height = supportHeight(to, newAnchor, horizontal[0], horizontal[2]) + heightAboveSupport;
  player.rebaseSurface(new Vector3(horizontal[0], height, horizontal[2]), new Vector3(...velocity));
  universe.setPlayerPose(to, [horizontal[0], height, horizontal[2]]);
  camera.setLocalView(forward);

  // The previous follow frame has no owner left.
  if ((FOLLOW_FRAMES as readonly string[]).includes(from) && from !== to) universe.frames.remove(from);
  return { from, to, ...at };
}
