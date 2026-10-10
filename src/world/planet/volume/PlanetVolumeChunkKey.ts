import type { BodyFixedPoint, PlanetVolumeBounds } from './PlanetVolumeEdit';

export interface PlanetVolumeLodConfig {
  readonly baseChunkSizeM: number;
  readonly samplesPerAxis: number;
  readonly maxLod: number;
}
export const DEFAULT_VOLUME_LOD: PlanetVolumeLodConfig = Object.freeze({
  baseChunkSizeM: 256, samplesPerAxis: 17, maxLod: 3,
});
export type PlanetVolumeSamplingProfile = 'standard' | 'impact-high';
export const IMPACT_HIGH_VOLUME_LOD: PlanetVolumeLodConfig = Object.freeze({...DEFAULT_VOLUME_LOD,samplesPerAxis:33});
export const samplingProfileOf = (key:PlanetVolumeChunkKey):PlanetVolumeSamplingProfile => key.samplingProfile??'standard';
/** Physical addressing is unchanged; only the bounded sample lattice is denser. */
export function samplingConfigForKey(key:PlanetVolumeChunkKey,config=DEFAULT_VOLUME_LOD):PlanetVolumeLodConfig {
  if(samplingProfileOf(key)==='standard'&&config.samplesPerAxis===33)
    throw new RangeError('33-sample lattice requires impact-high identity');
  return samplingProfileOf(key)==='impact-high'?{...config,samplesPerAxis:33}:config;
}
export function validateVolumeLod(config: PlanetVolumeLodConfig): void {
  if (!Number.isFinite(config.baseChunkSizeM) || config.baseChunkSizeM <= 0
    || !Number.isInteger(config.samplesPerAxis) || config.samplesPerAxis < 2 || config.samplesPerAxis > 33
    || !Number.isInteger(config.maxLod) || config.maxLod < 0 || config.maxLod > 16) {
    throw new RangeError('invalid bounded volume LOD configuration');
  }
}
export interface PlanetVolumeChunkKey {
  readonly bodyId: string;
  readonly lod: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly samplingProfile?: PlanetVolumeSamplingProfile;
}
export function volumeChunkKey(bodyId: string, lod: number, x: number, y: number, z: number,
  samplingProfile:PlanetVolumeSamplingProfile='standard'): PlanetVolumeChunkKey {
  if (!bodyId.trim() || !Number.isInteger(lod) || lod < 0 || lod > 16
    || ![x,y,z].every(Number.isSafeInteger)||!['standard','impact-high'].includes(samplingProfile)) throw new RangeError('invalid volume chunk key');
  return Object.freeze({ bodyId, lod, x: x || 0, y: y || 0, z: z || 0,
    ...(samplingProfile==='impact-high'?{samplingProfile}:{}) });
}
export function chunkKeyToString(key: PlanetVolumeChunkKey): string {
  return `${physicalChunkKeyToString(key)}${samplingProfileOf(key)==='impact-high'?'/impact-high':''}`;
}
export function physicalChunkKeyToString(key:PlanetVolumeChunkKey):string {
  return `volume/${encodeURIComponent(key.bodyId)}/${key.lod}/${key.x}/${key.y}/${key.z}`;
}
export function parseChunkKey(text: string): PlanetVolumeChunkKey | undefined {
  const parts = text.split('/');
  if ((parts.length !== 6 && !(parts.length===7&&parts[6]==='impact-high')) || parts[0] !== 'volume'
    || !parts.slice(2,6).every(p=>/^-?\d+$/.test(p))) return undefined;
  try {
    const key = volumeChunkKey(decodeURIComponent(parts[1]), Number(parts[2]), Number(parts[3]), Number(parts[4]), Number(parts[5]),
      parts.length===7?'impact-high':'standard');
    return chunkKeyToString(key) === text ? key : undefined;
  } catch { return undefined; }
}
export function chunkSizeM(lod: number, config = DEFAULT_VOLUME_LOD): number {
  validateVolumeLod(config);
  if (!Number.isInteger(lod) || lod < 0 || lod > config.maxLod) throw new RangeError('volume LOD out of range');
  return config.baseChunkSizeM * 2 ** lod;
}
export function chunkContainingPoint(bodyId: string, point: BodyFixedPoint, lod = 0, config = DEFAULT_VOLUME_LOD): PlanetVolumeChunkKey {
  if (!point.every(Number.isFinite)) throw new RangeError('body-fixed point must be finite');
  const size = chunkSizeM(lod, config);
  return volumeChunkKey(bodyId, lod, Math.floor(point[0]/size), Math.floor(point[1]/size), Math.floor(point[2]/size));
}
export function chunkBoundsBodyFixedM(key: PlanetVolumeChunkKey, config = DEFAULT_VOLUME_LOD): PlanetVolumeBounds {
  const size = chunkSizeM(key.lod, config);
  const min: BodyFixedPoint = Object.freeze([key.x*size, key.y*size, key.z*size]);
  const max: BodyFixedPoint = Object.freeze([(key.x+1)*size, (key.y+1)*size, (key.z+1)*size]);
  if (![...min,...max].every(n=>Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER)) throw new RangeError('volume bounds exceed safe logical lattice');
  return Object.freeze({ minBodyFixedM: min, maxBodyFixedM: max });
}
/** Integer lattice index first, then metres: adjacent faces use identical arithmetic. X is fastest. */
export function chunkSamplePosition(key: PlanetVolumeChunkKey, ix: number, iy: number, iz: number,
  config = DEFAULT_VOLUME_LOD, out: [number,number,number] = [0,0,0]): [number,number,number] {
  config=samplingConfigForKey(key,config);
  const cells = config.samplesPerAxis - 1, spacing = chunkSizeM(key.lod, config)/cells;
  if (![ix,iy,iz].every(n=>Number.isInteger(n) && n>=0 && n<=cells)) throw new RangeError('sample outside chunk');
  out[0] = (key.x*cells+ix)*spacing; out[1] = (key.y*cells+iy)*spacing; out[2] = (key.z*cells+iz)*spacing;
  return out;
}
