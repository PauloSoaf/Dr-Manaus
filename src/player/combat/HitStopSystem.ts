export class HitStopSystem {
  private remaining = 0;
  private duration = 0;

  /**
   * Trigger a hit stop pause for local combat perception.
   * @param durationMs Duration in milliseconds (e.g. 20ms light, 40ms heavy, 80ms kinetic).
   */
  trigger(durationMs: number): void {
    const s = Math.max(0, durationMs / 1000);
    this.duration = Math.max(this.duration, s);
    this.remaining = Math.max(this.remaining, s);
  }

  /**
   * Advance hit stop timer.
   * Returns effective combat delta-time factor: 0 during freeze, 1 during normal time.
   */
  update(dt: number): number {
    if (this.remaining <= 0) {
      this.duration = 0;
      this.remaining = 0;
      return 1;
    }
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.remaining = 0;
      this.duration = 0;
      return 1;
    }
    // During hit stop, animation/local combat perception is frozen
    return 0;
  }

  get isFrozen(): boolean {
    return this.remaining > 0;
  }

  get remainingSeconds(): number {
    return this.remaining;
  }

  get remainingMs(): number {
    return Math.round(this.remaining * 1000);
  }

  reset(): void {
    this.remaining = 0;
    this.duration = 0;
  }
}
