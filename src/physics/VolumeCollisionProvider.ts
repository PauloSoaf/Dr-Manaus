import type { Vec3 } from '../world/spatial/units';
import type { PlanetVolumeChunkKey } from '../world/planet/volume/PlanetVolumeChunkKey';

export const VOLUME_CONTACT_POLICY = Object.freeze({ floorNormalY: .65, skinM: .001,
  toleranceM: .00001, maxIterations: 4, sweepIterations: 48, refinements: 8 });
export type VolumeContactKind = 'floor' | 'wall' | 'ceiling';
export function volumeContactKind(normal: Vec3): VolumeContactKind {
  return normal[1] >= VOLUME_CONTACT_POLICY.floorNormalY ? 'floor'
    : normal[1] <= -VOLUME_CONTACT_POLICY.floorNormalY ? 'ceiling' : 'wall';
}
export interface VolumeContact {
  fraction: number;
  point: Vec3;
  normal: Vec3;
  bodyId: string;
  key: PlanetVolumeChunkKey;
  kind: VolumeContactKind;
}
export interface VolumeRayHit extends Omit<VolumeContact, 'fraction'> { distance: number; }
/** All queries/results use the active local physics frame. Position is character feet. */
export interface VolumeCollisionProvider {
  sweepCapsule(feet: Vec3, displacement: Vec3, radius: number, height: number): VolumeContact | null;
  raycast(origin: Vec3, direction: Vec3, maxDistance: number): VolumeRayHit | null;
}
