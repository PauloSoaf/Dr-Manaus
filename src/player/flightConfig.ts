export type FlightSpeedMode = 'ground' | 'normal' | 'fast' | 'super' | 'mega' | 'interplanetary' | 'cosmic';

/**
 * Metres per second. Mega and interplanetary both require an arm action before holding boost.
 *
 * Interplanetary is 200 000 km/h, which is 55 556 m/s — about twice the speed a spacecraft needs
 * to leave Earth, and the difference between two and a half hours to the Moon and a week. It is a
 * superhero's cruise, not a rocket's.
 * 
 * Cosmic mode is Faster-Than-Light (FTL). 1000 light years per second for interstellar traversal.
 */
export const FLIGHT = {
  speeds: { normal: 120, fast: 500, super: 2000, mega: 8000, interplanetary: 1155_556, cosmic: 9.4607e18 },
  maxSpeed: 1e20, // Huge max speed
  response: {
    normal: 8.5, fast: 8.5, super: 4.5, mega: 1.7,
    /**
     * Heavier than mega, deliberately. At fifty-five kilometres a second a turn that settles in a
     * second has already carried the player further than the planet is wide, so the response has
     * to be slow enough that a heading is a decision rather than a twitch.
     */
    interplanetary: 0.85,
    cosmic: 0.1, // extremely slow response for FTL
    braking: 6,
  },
  /**
   * Interplanetary only engages above the top of the atmosphere; below it, boost gives mega.
   *
   * Two reasons, and both are about the world rather than the fiction. A frame at 55 km/s covers
   * three kilometres, so nothing on the ground can be collided with — the player would pass
   * through the city rather than over it. And the speed exists to leave the planet, which is a
   * thing you do from the sky.
   */
  interplanetaryFloorM: 9000,
  /** How quickly the arm key has to be struck twice for the second tap to mean the next tier. */
  armDoubleTapS: 0.45,
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
