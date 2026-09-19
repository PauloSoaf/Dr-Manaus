export type FlightSpeedMode = 'ground' | 'normal' | 'fast' | 'super' | 'mega';

/** Metres per second. Mega requires a separate arm action before holding boost. */
export const FLIGHT = {
  speeds: { normal: 120, fast: 500, super: 2000, mega: 8000 },
  maxSpeed: 10000,
  response: { normal: 8.5, fast: 8.5, super: 4.5, mega: 1.7, braking: 6 },
  walkSpeed: 6.5,
  runSpeed: 16,
  groundResponse: 16,
} as const;
