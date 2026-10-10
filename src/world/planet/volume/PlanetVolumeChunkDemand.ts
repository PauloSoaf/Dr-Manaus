import type { BodyFixedPoint, PlanetVolumeBounds } from './PlanetVolumeEdit';
import { distanceToVolumeBoundsSquared } from './PlanetVolumeChunkCache';
import { chunkBoundsBodyFixedM, chunkContainingPoint, chunkKeyToString, chunkSizeM, volumeChunkKey,
  DEFAULT_VOLUME_LOD, type PlanetVolumeChunkKey, type PlanetVolumeLodConfig } from './PlanetVolumeChunkKey';

export interface PlanetVolumeDemandConfig {
  readonly radiusM: number;
  readonly radialHalfBandM: number;
  readonly maxDemands: number;
  readonly maxVisited: number;
}
export const DEFAULT_VOLUME_DEMAND: PlanetVolumeDemandConfig = Object.freeze({
  radiusM: 1024, radialHalfBandM: 256, maxDemands: 32, maxVisited: 1024,
});
export interface PlanetVolumeChunkDemand { readonly key: PlanetVolumeChunkKey; readonly distanceSquared: number; }
export function volumeBoundsInObserverBand(bounds: PlanetVolumeBounds, observer: BodyFixedPoint, halfBandM: number): boolean {
  const radius = Math.hypot(...observer);
  const up = radius > 0 ? observer.map(v=>v/radius) : [1,0,0];
  let centre = 0, extent = 0;
  for (let axis = 0; axis < 3; axis++) {
    centre += ((bounds.minBodyFixedM[axis]+bounds.maxBodyFixedM[axis])/2-observer[axis])*up[axis];
    extent += (bounds.maxBodyFixedM[axis]-bounds.minBodyFixedM[axis])/2*Math.abs(up[axis]);
  }
  return Math.abs(centre) <= halfBandM + extent;
}

/** Finite dyadic leaf selection, no tree residency or edit-AABB enumeration. Nearest nodes expand first. */
export function selectVolumeChunkDemand(bodyId: string, observer: BodyFixedPoint, lod: PlanetVolumeLodConfig = DEFAULT_VOLUME_LOD,
  demand: PlanetVolumeDemandConfig = DEFAULT_VOLUME_DEMAND, surfaceBand = true): readonly PlanetVolumeChunkDemand[] {
  if (!observer.every(Number.isFinite) || !Number.isFinite(demand.radiusM) || demand.radiusM <= 0
    || !Number.isFinite(demand.radialHalfBandM) || demand.radialHalfBandM < 0
    || !Number.isInteger(demand.maxDemands) || demand.maxDemands < 1 || demand.maxDemands > 256
    || !Number.isInteger(demand.maxVisited) || demand.maxVisited < 1 || demand.maxVisited > 8192) throw new RangeError('invalid bounded volume demand');
  const rootSize = chunkSizeM(lod.maxLod,lod);
  if (demand.radiusM > rootSize*2) throw new RangeError('volume interest radius exceeds bounded root neighbourhood');
  const low = chunkContainingPoint(bodyId,observer.map(v=>v-demand.radiusM) as [number,number,number],lod.maxLod,lod);
  const high = chunkContainingPoint(bodyId,observer.map(v=>v+demand.radiusM) as [number,number,number],lod.maxLod,lod);
  const queue: PlanetVolumeChunkDemand[] = [], result: PlanetVolumeChunkDemand[] = [];
  const own = chunkKeyToString(chunkContainingPoint(bodyId,observer,0,lod));
  const add = (key: PlanetVolumeChunkKey) => {
    const bounds = chunkBoundsBodyFixedM(key,lod), distanceSquared = distanceToVolumeBoundsSquared(observer,bounds);
    if (distanceSquared > demand.radiusM**2 || (surfaceBand && !volumeBoundsInObserverBand(bounds,observer,demand.radialHalfBandM))) return;
    queue.push({key,distanceSquared});
  };
  for (let x=low.x;x<=high.x;x++) for (let y=low.y;y<=high.y;y++) for (let z=low.z;z<=high.z;z++) add(volumeChunkKey(bodyId,lod.maxLod,x,y,z));
  const compare = (a: PlanetVolumeChunkDemand,b: PlanetVolumeChunkDemand) => a.distanceSquared-b.distanceSquared
    || Number(chunkKeyToString(b.key)===own)-Number(chunkKeyToString(a.key)===own)
    || a.key.lod-b.key.lod || chunkKeyToString(a.key).localeCompare(chunkKeyToString(b.key));
  for (let visited=0;queue.length && visited<demand.maxVisited && result.length<demand.maxDemands;visited++) {
    queue.sort(compare);
    const candidate = queue.shift()!, key = candidate.key;
    if (key.lod > 0 && candidate.distanceSquared < (chunkSizeM(key.lod-1,lod)*0.5)**2) {
      for (let dx=0;dx<2;dx++) for (let dy=0;dy<2;dy++) for (let dz=0;dz<2;dz++) {
        add(volumeChunkKey(bodyId,key.lod-1,key.x*2+dx,key.y*2+dy,key.z*2+dz));
      }
    } else result.push(candidate);
  }
  return result.sort(compare);
}
