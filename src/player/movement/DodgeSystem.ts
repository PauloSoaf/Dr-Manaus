import { Vector3 } from 'three/webgpu';

export type DodgeKind = 'roll' | 'airDash';

/**
 * One button, two moves. On the ground it is a soulslike roll: a committed, steerable-at-entry
 * burst that outruns nothing but reads as a real evade. In the air it is a dash: shorter, much
 * faster, and it keeps whatever the flight system was already doing underneath it.
 */
export const DODGE = {
  roll: { duration: 0.52, speed: 11.5, cooldown: 0.6, iFrameStart: 0.09, iFrameEnd: 0.36 },
  dash: { duration: 0.26, speed: 175, cooldown: 0.44, iFrameStart: 0.02, iFrameEnd: 0.2 },
  /** The dash burst is a fraction of cruise speed, so it still reads at 8000 m/s. */
  dashSpeedFraction: 0.34,
  maxDashSpeed: 1400,
} as const;

const clamp01 = (value: number): number => (value > 1 ? 1 : value < 0 ? 0 : value);

/**
 * Speed along the dodge direction over normalised time. The roll launches hard and bleeds off
 * into the recovery so the character settles rather than skating; the dash is flatter and ends
 * abruptly, which is what makes it feel like a dash and not a glide.
 */
export function dodgeProfile(kind: DodgeKind, progress: number): number {
  const t = clamp01(progress);
  if (kind === 'roll') {
    // Rises over the first 12% (the plant), holds, then decays through the get-up.
    const rise = Math.min(1, t / 0.12);
    return rise * Math.pow(1 - Math.max(0, (t - 0.32) / 0.68), 1.6);
  }
  // Dash: near-instant, held flat, cut at the end.
  return Math.min(1, t / 0.05) * (1 - Math.pow(clamp01((t - 0.55) / 0.45), 2.2));
}

export class DodgeSystem {
  readonly direction = new Vector3(0, 0, -1);
  private current: DodgeKind | null = null;
  private timer = 0;
  private duration: number = DODGE.roll.duration;
  private cooldown = 0;

  get kind(): DodgeKind | null { return this.current; }
  get active(): boolean { return this.current !== null; }
  get cooling(): boolean { return this.cooldown > 0; }
  get ready(): boolean { return this.current === null && this.cooldown <= 0; }
  get progress(): number { return this.current === null ? 0 : clamp01(this.timer / Math.max(0.0001, this.duration)); }

  /**
   * True during the evade window. Nothing damages the player yet, so this is the hook a damage
   * system would read rather than a behaviour that is already observable in play.
   */
  get invulnerable(): boolean {
    if (!this.current) return false;
    const window = this.current === 'roll' ? DODGE.roll : DODGE.dash;
    const t = this.progress;
    return t >= window.iFrameStart && t <= window.iFrameEnd;
  }

  /** Metres per second the dodge wants along `direction` this frame, already size-scaled. */
  speed(size = 1): number {
    if (!this.current) return 0;
    const base = this.current === 'roll'
      ? DODGE.roll.speed * Math.sqrt(Math.max(1, size))
      : DODGE.dash.speed * Math.sqrt(Math.max(1, size));
    return base * dodgeProfile(this.current, this.progress);
  }

  /** A dash on top of fast flight has to scale with the cruise speed or it is invisible. */
  static dashBurst(cruiseSpeed: number, size = 1): number {
    const scaled = DODGE.dash.speed * Math.sqrt(Math.max(1, size));
    const proportional = Math.max(0, cruiseSpeed) * DODGE.dashSpeedFraction;
    return Math.min(DODGE.maxDashSpeed * Math.sqrt(Math.max(1, size)), Math.max(scaled, proportional));
  }

  tryStart(kind: DodgeKind, direction: Vector3): boolean {
    if (!this.ready) return false;
    if (!Number.isFinite(direction.x + direction.y + direction.z) || direction.lengthSq() < 1e-8) return false;
    this.current = kind;
    this.timer = 0;
    this.duration = kind === 'roll' ? DODGE.roll.duration : DODGE.dash.duration;
    this.direction.copy(direction).normalize();
    return true;
  }

  update(dt: number): void {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - step);
    if (!this.current) return;
    this.timer += step;
    if (this.timer < this.duration) return;
    this.cooldown = this.current === 'roll' ? DODGE.roll.cooldown : DODGE.dash.cooldown;
    this.current = null;
    this.timer = 0;
  }

  cancel(): void {
    if (!this.current) return;
    this.cooldown = Math.max(this.cooldown, 0.18);
    this.current = null;
    this.timer = 0;
  }

  reset(): void { this.current = null; this.timer = 0; this.cooldown = 0; }
}
