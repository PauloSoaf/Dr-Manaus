import { Vector3 } from 'three/webgpu';
import type { TerrainProvider } from './PhysicsWorld';

export const TERRAIN_SWEEP_SUBDIVISIONS = 16;
export const TERRAIN_SWEEP_REFINEMENTS = 12;

export interface TerrainContact {
  fraction: number;
  readonly position: Vector3;
  heightM: number;
  readonly normal: Vector3;
}

/** The same five-point foot support used by the character, without temporary arrays. */
export function terrainFootHeight(terrain: TerrainProvider, x: number, z: number, radius = 0): number {
  let floor = terrain.heightAt(x, z);
  if (!Number.isFinite(floor) && floor !== -Infinity) floor = 0;
  for (let i = 0; radius > 0 && i < 4; i++) {
    const h = terrain.heightAt(x + (i === 0 ? radius : i === 1 ? -radius : 0),
      z + (i === 2 ? radius : i === 3 ? -radius : 0));
    if (Number.isFinite(h)) floor = Math.max(floor, h);
  }
  return floor;
}

/** Bounded first-contact search in ENU. No allocations during sampling or refinement.
 * Vertical segments are exact; diagonal relief uses 16 brackets then 12 binary steps.
 * This heightfield contract covers intact terrain, not future volume walls/ceilings.
 */
export function sweepTerrain(terrain: TerrainProvider, from: Vector3, to: Vector3, radius: number,
  out: TerrainContact = { fraction: 0, position: new Vector3(), heightM: 0, normal: new Vector3() }): TerrainContact | null {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const initialHeight = terrainFootHeight(terrain, from.x, from.z, radius);
  const initial = from.y - initialHeight;
  let low = 0, high = 0, found = false;
  if (initial < -1e-6) found = true;
  else if (dx === 0 && dz === 0) {
    if (dy >= 0 || to.y > initialHeight || !Number.isFinite(initialHeight)) return null;
    high = Math.max(0, initial / -dy); found = true;
  } else {
    let previousClearance = initial;
    for (let i = 1; i <= TERRAIN_SWEEP_SUBDIVISIONS; i++) {
      high = i / TERRAIN_SWEEP_SUBDIVISIONS;
      const h = terrainFootHeight(terrain, from.x + dx * high, from.z + dz * high, radius);
      const clearance = from.y + dy * high - h;
      if (clearance < -1e-6 || (previousClearance > 1e-6 && clearance <= 0)) { found = true; break; }
      previousClearance = clearance;
      low = high;
    }
    if (found) for (let i = 0; i < TERRAIN_SWEEP_REFINEMENTS; i++) {
      const middle = (low + high) / 2;
      const h = terrainFootHeight(terrain, from.x + dx * middle, from.z + dz * middle, radius);
      if (from.y + dy * middle > h) low = middle; else high = middle;
    }
  }
  if (!found) return null;
  out.fraction = high;
  out.position.set(from.x + dx * high, from.y + dy * high, from.z + dz * high);
  out.heightM = terrainFootHeight(terrain, out.position.x, out.position.z, radius);
  out.position.y = out.heightM;
  const spacing = Math.max(.5, radius);
  const left = terrainFootHeight(terrain, out.position.x - spacing, out.position.z, radius);
  const right = terrainFootHeight(terrain, out.position.x + spacing, out.position.z, radius);
  const back = terrainFootHeight(terrain, out.position.x, out.position.z - spacing, radius);
  const front = terrainFootHeight(terrain, out.position.x, out.position.z + spacing, radius);
  out.normal.set(Number.isFinite(left - right) ? (left - right) / (2 * spacing) : 0, 1,
    Number.isFinite(back - front) ? (back - front) / (2 * spacing) : 0).normalize();
  return out;
}

export function removeInwardTerrainVelocity(velocity: Vector3, normal: Vector3): void {
  const inward = velocity.dot(normal);
  if (inward < 0) velocity.addScaledVector(normal, -inward);
}
