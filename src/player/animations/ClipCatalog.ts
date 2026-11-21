import catalogJson from './clipCatalog.json';

/**
 * Typed access to the measured clip catalogue written by
 * `scripts/assets/build-character-animations.mjs`: loop flags, stride-measured ground speeds,
 * foot plants, strike timing and root yaw, all in rig units (the 1.81 m source skeleton).
 */
export interface ClipInfo {
  readonly kind: 'loop' | 'strike' | 'action';
  readonly core: boolean;
  readonly loop: boolean;
  readonly duration: number;
  readonly source?: string;
  readonly licence?: string;
  readonly url?: string;
  readonly from?: string;
  /** Metres per second the loop travels at playback rate 1, rig scale. */
  readonly groundSpeed?: number;
  /** Normalised times at which each foot plants. */
  readonly plants?: { readonly l: readonly number[]; readonly r: readonly number[] };
  /** Normalised time of the strike's maximum extension: where damage must land. */
  readonly hit?: number;
  readonly reach?: number;
  readonly hitHeight?: number;
  readonly effector?: string;
  /** Body yaw the clip turns through, extracted from the pelvis: degrees at `fps`. */
  readonly rootYaw?: { readonly fps: number; readonly yawDeg: readonly number[] };
}

const clips = (catalogJson as { clips: Record<string, ClipInfo> }).clips;

/** Height of the source rig the speeds were measured on. */
export const RIG_HEIGHT_M = (catalogJson as { rigHeightMeters?: number }).rigHeightMeters ?? 1.81;

export function clipInfo(name: string): ClipInfo | undefined { return clips[name]; }
export function hasClipInfo(name: string): boolean { return name in clips; }
export const CLIP_CATALOG: Readonly<Record<string, ClipInfo>> = clips;

/**
 * Phase offset that lines a loop's left-foot plant up with phase 0, so gaits blended on a shared
 * normalised clock put the same foot down at the same moment.
 */
export function plantPhase(name: string): number {
  const info = clips[name];
  const l = info?.plants?.l?.[0];
  if (l !== undefined) return l;
  const r = info?.plants?.r?.[0];
  return r !== undefined ? (r + 0.5) % 1 : 0;
}

/** Root yaw (radians) the clip has turned through at normalised time `u`. */
export function rootYawAt(name: string, u: number): number {
  const root = clips[name]?.rootYaw;
  if (!root || !root.yawDeg.length) return 0;
  const frames = root.yawDeg.length;
  const f = Math.max(0, Math.min(frames - 1, u * (frames - 1)));
  const i = Math.floor(f), k = f - i;
  const a = root.yawDeg[i], b = root.yawDeg[Math.min(frames - 1, i + 1)];
  return (a + (b - a) * k) * Math.PI / 180;
}
