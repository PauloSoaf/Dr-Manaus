import { AnimationClip, AnimationMixer, LoopRepeat, NumberKeyframeTrack, QuaternionKeyframeTrack, VectorKeyframeTrack, type AnimationAction, type Object3D } from 'three/webgpu';
import { clipInfo, plantPhase, rootYawAt } from '../ClipCatalog';

/**
 * DR Manaus animation graph: layered, phase-synchronised playback of authored clips on one
 * AnimationMixer, shared by the hero and the pedestrians.
 *
 * Layers, from the bottom:
 *   1. Base: locomotion blend spaces (speed 1D, direction 2D) or a looping pose (sit, drive,
 *      hover, talk). States cross-fade; a state that comes back reuses its clock, so a small speed
 *      change never restarts a clip.
 *   2. Upper overlay: a strike, a cast or a gesture on spine, arms and head while the legs keep
 *      the base (run and punch at once).
 *   3. Full-body action: a one-shot with a priority (vehicle entry, kick, roll, landing).
 *
 * The graph owns every action's weight and clock: weights are set so that each bone's weights sum
 * to exactly one (three.js would otherwise renormalise or blend toward the bind pose), and clocks
 * advance at rates derived from the clip catalogue, which is how the feet stop sliding — a loop
 * plays at the speed the body actually moves divided by the speed its stride was measured at.
 *
 * Nothing here writes a bone. Poses come from clips; the graph only chooses, times and weighs them.
 */

/** Lower-number wins. Mirrors the gameplay contract: recovery > vehicle > interaction > combat > evade > flight > locomotion > gesture. */
export enum Priority { Critical = 1, Vehicle = 2, Interaction = 3, Combat = 4, Evade = 5, Flight = 6, Locomotion = 7, Gesture = 8 }

const UPPER_BONES = /^(spine|neck|head|clavicle|upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)/;
const plain = (name: string) => name.replace(/[.\s_-]/g, '').toLowerCase();
const trackNode = (trackName: string) => trackName.slice(0, trackName.lastIndexOf('.'));
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export type BodyPart = 'full' | 'upper' | 'lower';

/** Root X/Z is neutralised; only root/pelvis keep translation; optional upper/lower bone mask. */
export function prepareClip(source: AnimationClip, part: BodyPart): AnimationClip {
  const tracks = source.tracks.flatMap(track => {
    const property = track.name.slice(track.name.lastIndexOf('.') + 1);
    const node = trackNode(track.name);
    const key = plain(node);
    const upper = UPPER_BONES.test(key);
    if (part === 'upper' && !upper) return [];
    if (part === 'lower' && upper) return [];
    if (property === 'scale') return [];
    if (property === 'position' && key !== 'root' && key !== 'pelvis') return [];
    const copy = track.clone();
    if (property === 'position' && key === 'root' && copy instanceof VectorKeyframeTrack) {
      const values = copy.values, x = values[0], z = values[2];
      for (let i = 0; i < values.length; i += 3) { values[i] = x; values[i + 2] = z; }
    }
    return [copy as VectorKeyframeTrack | QuaternionKeyframeTrack | NumberKeyframeTrack];
  });
  return new AnimationClip(`${source.name}::${part}`, source.duration, tracks);
}

interface Variant { clip: AnimationClip; action?: AnimationAction }
interface ClipEntry { name: string; duration: number; variants: Partial<Record<BodyPart, Variant>> }

/** One weighted source inside a base state, with its own clock (seconds) or phase-locked. */
interface BaseClip { name: string; weight: number; time: number; synced: boolean; offset: number; rate: number }
interface BaseState {
  key: string;
  weight: number;
  clips: BaseClip[];
  /** Shared normalised phase for synced (gait) clips. */
  phase: number;
  /** Per-frame update of the clip weights and clocks. */
  tick: (state: BaseState, dt: number) => void;
}

export interface ActionOptions {
  priority: Priority;
  /** `upper` plays over the base on spine/arms/head; `full` replaces it. */
  part?: 'full' | 'upper';
  /** Seconds the clip should take (stretched); defaults to its own duration / rate. */
  duration?: number;
  rate?: number;
  fadeIn?: number;
  fadeOut?: number;
  /** Loop until stopped (sustained cast, phone call). */
  loop?: boolean;
  /** Hold the last frame until stopped (sat down, slumped). */
  hold?: boolean;
  /** Normalised start time. */
  from?: number;
  /** Normalised end time (crop). */
  to?: number;
  /** Play backwards (e.g. sitting down reversed into standing). */
  reverse?: boolean;
  /** Notifies at normalised times. */
  events?: readonly { readonly time: number; readonly name: string }[];
  onEvent?: (name: string) => void;
  onEnd?: (completed: boolean) => void;
  /** Apply the catalogue's extracted root yaw to the owner while this plays. */
  rootYaw?: boolean;
  tag?: string;
}

export interface ActionHandle {
  readonly name: string;
  readonly tag?: string;
  readonly priority: Priority;
  /** Normalised progress 0..1 of the playable range. */
  readonly progress: number;
  readonly active: boolean;
}

class RunningAction implements ActionHandle {
  weight = 0;
  time = 0;
  fadingOut = false;
  finished = false;
  private fired = new Set<string>();
  private lastYaw = 0;
  constructor(readonly name: string, readonly duration: number, readonly options: ActionOptions, readonly rate: number) {
    const from = options.from ?? 0;
    this.time = (options.reverse ? (options.to ?? 1) : from) * duration;
    this.lastYaw = options.rootYaw ? rootYawAt(name, this.normalized) : 0;
  }
  get tag(): string | undefined { return this.options.tag; }
  get priority(): Priority { return this.options.priority; }
  get normalized(): number { return this.duration > 0 ? this.time / this.duration : 1; }
  get progress(): number {
    const from = this.options.from ?? 0, to = this.options.to ?? 1, u = this.normalized;
    const p = (u - from) / Math.max(1e-6, to - from);
    return clamp(this.options.reverse ? 1 - p : p, 0, 1);
  }
  get active(): boolean { return !this.finished && !this.fadingOut; }
  advance(dt: number): number {
    const from = (this.options.from ?? 0) * this.duration, to = (this.options.to ?? 1) * this.duration;
    const before = this.normalized;
    if (!this.finished) {
      this.time += (this.options.reverse ? -1 : 1) * dt * this.rate;
      if (this.options.loop) {
        const span = Math.max(1e-6, to - from);
        while (this.time > to) this.time -= span;
        while (this.time < from) this.time += span;
      } else if (!this.options.reverse && this.time >= to) { this.time = to; if (!this.options.hold) this.finished = true; }
      else if (this.options.reverse && this.time <= from) { this.time = from; if (!this.options.hold) this.finished = true; }
    }
    const after = this.normalized;
    for (const event of this.options.events ?? []) {
      const key = `${event.time}:${event.name}`;
      if (this.fired.has(key)) continue;
      const crossed = this.options.reverse ? event.time <= before && event.time >= after : event.time >= before && event.time <= after;
      if (crossed || (this.finished && !this.options.reverse && event.time <= after)) { this.fired.add(key); this.options.onEvent?.(event.name); }
    }
    let yawDelta = 0;
    if (this.options.rootYaw) {
      const yaw = rootYawAt(this.name, after);
      yawDelta = yaw - this.lastYaw;
      this.lastYaw = yaw;
    }
    return yawDelta;
  }
}

export interface LocomotionInput {
  /** Horizontal speed in metres per second, world scale. */
  speed: number;
  /** Direction of travel relative to facing, radians: 0 forward, +pi/2 right. */
  direction?: number;
  /** Gait set to use. */
  set?: 'normal' | 'crouch' | 'strafe';
}

/** A locomotion set: idle plus moving gaits with the speed band in which each is pure. */
export interface GaitSet {
  idle: string;
  /** Moving gaits in ascending speed; `pure` is the rig-speed band where the gait plays alone. */
  gaits: readonly { name: string; pure: readonly [number, number] }[];
  minRate?: number;
  maxRate?: number;
}

/** Directional set for strafing (combat stance): forward, right, back, left. */
export interface DirectionalSet { idle: string; forward: string; right: string; back: string; left: string; minRate?: number; maxRate?: number }

export class AnimationGraph {
  readonly mixer: AnimationMixer;
  /** Multiplies every clock: hit-stop freezes animation by setting this to 0. */
  timeScale = 1;
  /** Metres of world travel per rig metre: visual scale of the skeleton times character size. */
  worldScale = 1;
  /** Footstep notifies from locomotion (foot plants in the catalogue). */
  onFootstep?: (foot: 'l' | 'r', strength: number) => void;
  private readonly entries = new Map<string, ClipEntry>();
  private readonly states: BaseState[] = [];
  private stateFade = 0.2;
  private target?: BaseState;
  private readonly actions: RunningAction[] = [];
  private readonly overlays: RunningAction[] = [];
  private pendingYaw = 0;
  private lastPhase = 0;
  private locomotion: LocomotionInput = { speed: 0 };
  private readonly touched = new Set<AnimationAction>();

  constructor(readonly root: Object3D, clips: readonly AnimationClip[] = []) {
    this.mixer = new AnimationMixer(root);
    this.register(clips);
  }

  /** Adds clips; existing names are kept (the character's own clips win over a library). */
  register(clips: readonly AnimationClip[]): number {
    let added = 0;
    for (const clip of clips) {
      if (!clip.name || this.entries.has(clip.name)) continue;
      this.entries.set(clip.name, { name: clip.name, duration: clip.duration, variants: { full: { clip } } });
      added++;
    }
    return added;
  }

  has(name: string): boolean { return this.entries.has(name); }
  get clipNames(): readonly string[] { return [...this.entries.keys()].sort(); }
  duration(name: string): number { return this.entries.get(name)?.duration ?? 0; }

  private action(name: string, part: BodyPart): AnimationAction | undefined {
    const entry = this.entries.get(name);
    if (!entry) return undefined;
    let variant = entry.variants[part];
    if (!variant) {
      const full = entry.variants.full!.clip;
      variant = { clip: prepareClip(full, part) };
      entry.variants[part] = variant;
    } else if (part === 'full' && !variant.action) {
      variant.clip = prepareClip(variant.clip, 'full');
    }
    if (!variant.action) {
      const action = this.mixer.clipAction(variant.clip);
      action.setLoop(LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.enabled = true;
      action.setEffectiveTimeScale(0);
      action.setEffectiveWeight(0);
      action.play();
      variant.action = action;
    }
    return variant.action;
  }

  private apply(name: string, part: BodyPart, time: number, weight: number): void {
    if (weight <= 1e-4) return;
    const action = this.action(name, part);
    if (!action) return;
    const duration = action.getClip().duration;
    action.time = clamp(time, 0, Math.max(0, duration - 1e-5));
    action.setEffectiveWeight(action.getEffectiveWeight() + weight);
    this.touched.add(action);
  }

  // ------------------------------------------------------------------ base layer

  /** Cross-fade time used by the next base state change. */
  setTransition(seconds: number): this { this.stateFade = Math.max(0.01, seconds); return this; }

  private enterState(key: string, build: () => Omit<BaseState, 'key' | 'weight'>): BaseState {
    if (this.target?.key === key) return this.target;
    let state = this.states.find(s => s.key === key);
    if (!state) {
      state = { key, weight: this.states.length ? 0 : 1, ...build() };
      this.states.push(state);
    }
    this.target = state;
    return state;
  }

  /** A single looping pose as the base (sit, drive, hover, talk, guard). Re-entry keeps its clock. */
  setPose(name: string, rate = 1): void {
    if (!this.entries.has(name)) return;
    const state = this.enterState(`pose:${name}`, () => ({
      clips: [{ name, weight: 1, time: 0, synced: false, offset: 0, rate }],
      phase: 0,
      tick: (s, dt) => { const c = s.clips[0]; c.time = (c.time + dt * c.rate) % Math.max(1e-6, this.duration(name)); },
    }));
    state.clips[0].rate = rate;
  }

  /** Speed-driven gait blending with stride matching and phase sync. */
  setLocomotion(set: GaitSet, input: LocomotionInput, key = 'loco'): void {
    this.locomotion = input;
    const names = [set.idle, ...set.gaits.map(g => g.name)].filter(n => this.entries.has(n));
    if (!names.length) return;
    this.enterState(`${key}:${set.idle}`, () => ({
      clips: names.map(name => ({ name, weight: name === set.idle ? 1 : 0, time: 0, synced: name !== set.idle, offset: plantPhase(name), rate: 1 })),
      phase: 0,
      tick: (s, dt) => this.tickGaits(s, set, dt),
    }));
  }

  /** Eight-way-ish strafing from four directional loops, blended by the direction of travel. */
  setDirectional(set: DirectionalSet, input: LocomotionInput, key = 'strafe'): void {
    this.locomotion = input;
    const names = [set.idle, set.forward, set.right, set.back, set.left].filter(n => this.entries.has(n));
    if (!names.length) return;
    this.enterState(`${key}:${set.idle}`, () => ({
      clips: names.map(name => ({ name, weight: name === set.idle ? 1 : 0, time: 0, synced: name !== set.idle, offset: plantPhase(name), rate: 1 })),
      phase: 0,
      tick: (s, dt) => this.tickDirectional(s, set, dt),
    }));
  }

  private rigSpeed(): number { return this.locomotion.speed / Math.max(1e-6, this.worldScale); }

  private tickGaits(state: BaseState, set: GaitSet, dt: number): void {
    const speed = this.rigSpeed();
    const gaits = set.gaits.filter(g => this.entries.has(g.name));
    // Moving weight: idle until the first gait's pure band starts.
    const first = gaits[0];
    const moving = first ? smooth((speed - 0.05) / Math.max(0.05, first.pure[0] - 0.05)) : 0;
    const weights = new Map<string, number>();
    weights.set(set.idle, 1 - moving);
    // Between consecutive gaits: blend across the gap between their pure bands.
    if (gaits.length) {
      let assigned = false;
      for (let i = 0; i < gaits.length && !assigned; i++) {
        const g = gaits[i], next = gaits[i + 1];
        if (!next || speed <= g.pure[1]) { weights.set(g.name, moving); assigned = true; break; }
        if (speed < next.pure[0]) {
          const u = smooth((speed - g.pure[1]) / Math.max(1e-3, next.pure[0] - g.pure[1]));
          weights.set(g.name, moving * (1 - u)); weights.set(next.name, moving * u); assigned = true; break;
        }
      }
    }
    let blendSpeed = 0, blendDuration = 0, movingSum = 0;
    for (const g of gaits) {
      const w = weights.get(g.name) ?? 0;
      if (w <= 0) continue;
      blendSpeed += w * (clipInfo(g.name)?.groundSpeed ?? 1);
      blendDuration += w * this.duration(g.name);
      movingSum += w;
    }
    if (movingSum > 0) { blendSpeed /= movingSum; blendDuration /= movingSum; }
    const rate = movingSum > 0 ? clamp(speed / Math.max(0.05, blendSpeed), set.minRate ?? 0.55, set.maxRate ?? 2.2) : 1;
    if (blendDuration > 0) state.phase = (state.phase + dt * rate / blendDuration) % 1;
    for (const c of state.clips) {
      c.weight = weights.get(c.name) ?? 0;
      if (c.synced) c.time = ((state.phase + c.offset) % 1) * this.duration(c.name);
      else c.time = (c.time + dt) % Math.max(1e-6, this.duration(c.name));
    }
    this.emitFootsteps(state, gaits.map(g => g.name), weights);
  }

  private tickDirectional(state: BaseState, set: DirectionalSet, dt: number): void {
    const speed = this.rigSpeed();
    const dir = this.locomotion.direction ?? 0;
    const ref = clipInfo(set.forward)?.groundSpeed ?? 2.9;
    const moving = smooth((speed - 0.05) / Math.max(0.1, ref * 0.35));
    // Cardinal weights from the direction of travel.
    const x = Math.sin(dir), z = Math.cos(dir);
    const raw: [string, number][] = [[set.forward, Math.max(0, z)], [set.back, Math.max(0, -z)], [set.right, Math.max(0, x)], [set.left, Math.max(0, -x)]];
    const total = raw.reduce((s, [, w]) => s + w * w, 0) || 1;
    const weights = new Map<string, number>([[set.idle, 1 - moving]]);
    let blendSpeed = 0, blendDuration = 0;
    for (const [name, w] of raw) {
      const ww = (w * w) / total;
      weights.set(name, (weights.get(name) ?? 0) + moving * ww);
      blendSpeed += ww * (clipInfo(name)?.groundSpeed ?? ref);
      blendDuration += ww * this.duration(name);
    }
    const rate = clamp(speed / Math.max(0.05, blendSpeed), set.minRate ?? 0.6, set.maxRate ?? 1.8);
    if (blendDuration > 0 && moving > 0) state.phase = (state.phase + dt * rate / blendDuration) % 1;
    for (const c of state.clips) {
      c.weight = weights.get(c.name) ?? 0;
      if (c.synced) c.time = ((state.phase + c.offset) % 1) * this.duration(c.name);
      else c.time = (c.time + dt) % Math.max(1e-6, this.duration(c.name));
    }
    this.emitFootsteps(state, [set.forward, set.right, set.back, set.left], weights);
  }

  private emitFootsteps(state: BaseState, gaitNames: readonly string[], weights: Map<string, number>): void {
    if (!this.onFootstep || state !== this.target) { this.lastPhase = state.phase; return; }
    const prev = this.lastPhase, now = state.phase;
    this.lastPhase = now;
    const movingWeight = gaitNames.reduce((s, n) => s + (weights.get(n) ?? 0), 0);
    if (movingWeight < 0.3) return;
    // Plants are expressed in clip time; with phase offsets aligned on the left plant, the left
    // foot lands at phase 0 and the right one half a cycle later.
    const crossed = (p: number) => (prev <= now ? p > prev && p <= now : p > prev || p <= now);
    if (crossed(0)) this.onFootstep('l', movingWeight);
    if (crossed(0.5)) this.onFootstep('r', movingWeight);
  }

  /** Animation Lab: scrub the looping pose `name` to a normalised time. */
  seekPose(name: string, normalized: number): void {
    const state = this.states.find(s => s.key === `pose:${name}`);
    if (state) state.clips[0].time = clamp(normalized, 0, 1) * this.duration(name);
  }

  /** Normalised clock of a base clip in the current state (debug and lab). */
  poseTime(name: string): number {
    const c = this.target?.clips.find(clip => clip.name === name);
    return c ? c.time / Math.max(1e-6, this.duration(name)) : 0;
  }

  /** Name of the dominant base clip (debug). */
  get baseClip(): string {
    const s = this.target;
    if (!s) return '';
    let best = s.clips[0];
    for (const c of s.clips) if (c.weight > best.weight) best = c;
    return best?.name ?? '';
  }

  // ------------------------------------------------------------------ actions and overlays

  /** Starts a one-shot (or looping) action. Returns null when a higher-priority action owns the body. */
  play(name: string, options: ActionOptions): ActionHandle | null {
    if (!this.entries.has(name)) return null;
    const list = options.part === 'upper' ? this.overlays : this.actions;
    const current = list.find(a => a.active);
    if (current && current.priority < options.priority) return null;
    for (const a of list) if (a.active) { a.fadingOut = true; a.options.onEnd?.(false); }
    const duration = this.duration(name);
    const span = ((options.to ?? 1) - (options.from ?? 0)) * duration;
    const rate = options.duration ? span / Math.max(0.05, options.duration) : (options.rate ?? 1);
    const running = new RunningAction(name, duration, options, rate);
    list.push(running);
    return running;
  }

  /** Stops a running action (fades out). */
  stop(handle: ActionHandle | null | undefined, fade?: number): void {
    if (!handle) return;
    for (const a of [...this.actions, ...this.overlays]) {
      if (a !== handle || a.fadingOut) continue;
      a.fadingOut = true;
      if (fade !== undefined) a.options.fadeOut = fade;
      a.options.onEnd?.(false);
    }
  }

  stopTag(tag: string, fade?: number): void {
    for (const a of [...this.actions, ...this.overlays]) if (a.options.tag === tag && !a.fadingOut) this.stop(a, fade);
  }

  /** The highest-priority running full-body action, if any. */
  get currentAction(): ActionHandle | null { return this.actions.find(a => a.active) ?? null; }
  get currentOverlay(): ActionHandle | null { return this.overlays.find(a => a.active) ?? null; }

  /** Yaw (radians) the running actions turned the body through since the last call. */
  consumeRootYaw(): number { const v = this.pendingYaw; this.pendingYaw = 0; return v; }

  private tickActions(list: RunningAction[], dt: number): number {
    let total = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      const yaw = a.advance(dt);
      if (a.weight > 0.5) this.pendingYaw += yaw;
      if (a.finished && !a.fadingOut) { a.fadingOut = true; a.options.onEnd?.(true); }
      const fadeIn = a.options.fadeIn ?? 0.12, fadeOut = a.options.fadeOut ?? 0.16;
      if (a.fadingOut) a.weight -= dt / Math.max(0.01, fadeOut);
      else a.weight += dt / Math.max(0.01, fadeIn);
      a.weight = clamp(a.weight, 0, 1);
      if (a.fadingOut && a.weight <= 0) { list.splice(i, 1); continue; }
    }
    // Newest on top: earlier entries are scaled down by what is above them.
    let remaining = 1;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      const w = Math.min(remaining, a.weight * remaining);
      (a as RunningAction & { applied: number }).applied = w;
      remaining -= w;
      total += w;
    }
    return clamp(total, 0, 1);
  }

  // ------------------------------------------------------------------ update

  update(dt: number): void {
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
    const t = dt * this.timeScale;

    // Base state weights cross-fade toward the target.
    const step = t / this.stateFade;
    for (let i = this.states.length - 1; i >= 0; i--) {
      const s = this.states[i];
      s.weight = clamp(s.weight + (s === this.target ? step : -step), 0, 1);
      if (s !== this.target && s.weight <= 0) this.states.splice(i, 1);
    }
    const stateSum = this.states.reduce((sum, s) => sum + s.weight, 0) || 1;
    for (const s of this.states) s.tick(s, t);

    // Per bone the weights sum to one: full action a, overlay o on the upper body, base the rest.
    const fullWeight = this.tickActions(this.actions, t);
    const overlayWeight = this.tickActions(this.overlays, t);

    for (const action of this.touched) action.setEffectiveWeight(0);
    this.touched.clear();

    const baseLower = 1 - fullWeight;
    const baseUpper = (1 - fullWeight) * (1 - overlayWeight);
    for (const s of this.states) {
      const sw = s.weight / stateSum;
      for (const c of s.clips) {
        if (c.weight <= 0) continue;
        this.apply(c.name, 'lower', c.time, baseLower * sw * c.weight);
        this.apply(c.name, 'upper', c.time, baseUpper * sw * c.weight);
      }
    }
    for (const a of this.overlays) {
      const w = (a as RunningAction & { applied?: number }).applied ?? 0;
      this.apply(a.name, 'upper', a.time, w * (1 - fullWeight));
    }
    for (const a of this.actions) {
      const w = (a as RunningAction & { applied?: number }).applied ?? 0;
      this.apply(a.name, 'full', a.time, w);
    }
    this.mixer.update(t > 0 ? 1e-6 : 0);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}
