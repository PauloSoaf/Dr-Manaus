import type { Vec3 } from '../spatial/units';
import type { ContactResponseMode } from './PlanetaryLanding';

/** Logical CCD facts. C4 classifies the pre-response motion; CCD still resolves it safely. */
export interface CelestialContact {
  readonly bodyId: string;
  readonly fraction: number;
  readonly contactPositionM: Vec3;
  readonly impactNormalSystem: Vec3;
  /** Barycentric velocities at the swept contact, BEFORE the inelastic response. */
  readonly playerVelocityMps: Vec3;
  readonly bodyVelocityMps: Vec3;
  readonly envelopeRadiusM: number;
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
