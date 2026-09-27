export type FlightSpeedMode = 'ground' | 'normal' | 'fast' | 'super' | 'mega' | 'interplanetary';

/**
 * Metres per second. Mega and interplanetary both require an arm action before holding boost.
 *
 * Interplanetary is 800 000 km/h, which is 222 222 m/s — roughly twenty times what a spacecraft
 * needs to leave Earth, and half an hour to the Moon rather than three days. It is a superhero's
 * cruise, not a rocket's.
 *
 * It is also the ceiling of what may touch the local physics. Anything beyond this belongs to a
 * travel domain that does not exist yet (spec P0-04, Sprint H5): a speed that reaches another star
 * cannot share a `Vector3` with collision sweeps, streaming and the camera.
 */
export const FLIGHT = {
  speeds: { normal: 120, fast: 500, super: 2000, mega: 8000, interplanetary: 222_222 },
  maxSpeed: 260_000,
  response: {
    normal: 8.5, fast: 8.5, super: 4.5, mega: 1.7,
    /**
     * Heavier than mega, deliberately. At two hundred kilometres a second a turn that settles in a
     * second has carried the player thirty-five times the width of the planet, so the response has
     * to be slow enough that a heading is a decision rather than a twitch.
     */
    interplanetary: 0.85,
    braking: 6,
  },
  /**
   * Interplanetary only engages above the top of the atmosphere; below it, boost gives mega.
   *
   * Two reasons, and both are about the world rather than the fiction. A frame at 222 km/s covers
   * thirteen kilometres, so nothing on the ground can be collided with — the player would pass
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
