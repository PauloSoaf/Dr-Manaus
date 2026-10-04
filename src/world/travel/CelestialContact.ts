import type { Vec3 } from '../spatial/units';
import type { ContactResponseMode } from './PlanetaryLanding';

/** Logical CCD result; response stays safe in C0. Future impact policy can consume it. */
export interface CelestialContact {
  readonly bodyId: string;
  readonly fraction: number;
  readonly contactPositionM: Vec3;
  readonly relativeSpeedMps: number;
  readonly radialSpeedMps: number;
  readonly assisted: boolean;
  /** How the contact was resolved. Graze unless the player asked to land. */
  readonly responseMode: ContactResponseMode;
  /** Body-relative radial speed after the response. Never meaningfully positive: no bounce. */
  readonly responseRadialSpeedMps: number;
  /** Body-relative tangential speed after the response, already bounded by the mode's policy. */
  readonly responseTangentialSpeedMps: number;
}
