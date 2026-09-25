import type { AnimationClip } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from './libraryManifest.json';

/**
 * An optional catalogue of extra clips the character can borrow.
 *
 * The library rig is the same 65-bone skeleton the player uses — same bone names, one for one —
 * so its clips play on the hero with no retargeting. It is never fetched at boot: the game only
 * pulls it when something actually asks for a clip that is not in the character itself, so the
 * catalogue costs nothing until it is used.
 *
 * Built by `scripts/assets/build-animation-library.mjs`, which strips the meshes and the clips the
 * character already owns and rebuilds the binary buffer around what is left.
 */
export const ANIMATION_LIBRARY = {
  url: `${import.meta.env?.BASE_URL ?? '/'}assets/player/animation-library.glb`,
  source: manifest.source,
  licence: manifest.licence,
  credit: manifest.url,
  /** Every clip name in the library, available without downloading anything. */
  clips: manifest.clips as readonly string[],
} as const;

let pending: Promise<readonly AnimationClip[]> | undefined;
let loaded: readonly AnimationClip[] | undefined;

export function isAnimationLibraryLoaded(): boolean { return loaded !== undefined; }
export function animationLibraryClips(): readonly AnimationClip[] { return loaded ?? []; }
export function hasLibraryClip(name: string): boolean { return ANIMATION_LIBRARY.clips.includes(name); }

/** Fetches the catalogue once. Concurrent callers share the same request. */
export function loadAnimationLibrary(): Promise<readonly AnimationClip[]> {
  pending ??= new GLTFLoader().loadAsync(ANIMATION_LIBRARY.url).then(gltf => {
    loaded = gltf.animations.map(clip => clip.clone());
    return loaded;
  }).catch(error => {
    // A missing catalogue must never take the game down with it; the character's own clips stand
    // on their own, and this is an extra.
    pending = undefined;
    console.warn('Animation library could not be loaded', error);
    loaded = [];
    return loaded;
  });
  return pending;
}
