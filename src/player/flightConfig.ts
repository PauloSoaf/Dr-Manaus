export type FlightSpeedMode = 'ground' | 'normal' | 'fast' | 'super' | 'mega';

/** Metres per second. Mega requires a separate arm action before holding boost. */
export const FLIGHT = {
  speeds: { normal: 120, fast: 500, super: 2000, mega: 8000 },
  maxSpeed: 10000,
  response: { normal: 8.5, fast: 8.5, super: 4.5, mega: 1.7, braking: 6 },
  walkSpeed: 6.5,
  runSpeed: 16,
  groundResponse: 16,
  /**
   * Air control, weaker than ground control on purpose: a jump that can be steered as hard as a
   * walk carries no momentum, and the somersault's forward throw would be erased in two frames.
   */
  airControl: 3.4,
  /** While a dash burst is live, steering is damped further so the burst survives its own clip. */
  dashControl: 0.25,
} as const;
