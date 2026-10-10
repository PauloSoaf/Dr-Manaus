import type { CelestialBodyProfile } from '../celestial/CelestialBodyProfile';
import type { Vec3 } from '../spatial/units';

export type CelestialBodyClass = CelestialBodyProfile['bodyClass'];
export type CelestialImpactClassification =
  | 'SAFE_CAPTURE' | 'GRAZE' | 'MINOR_IMPACT' | 'MAJOR_IMPACT' | 'CATASTROPHIC_IMPACT';

/** Transient logical facts, never rendered geometry or a destruction command. */
export interface CelestialImpactEvent {
  readonly eventId: string;
  readonly bodyId: string;
  readonly bodyClass: CelestialBodyClass;
  readonly contactSystemPositionM: Vec3;
  readonly contactBodyFixedM?: Vec3;
  readonly impactNormalSystem: Vec3;
  readonly relativeVelocityMps: Vec3;
  readonly relativeSpeedMps: number;
  readonly inwardRadialSpeedMps: number;
  readonly tangentialSpeedMps: number;
  readonly radialFraction: number;
  /** Angle from the inward normal: zero is direct, pi/2 is tangent/separating. */
  readonly incidenceAngleRad: number;
  readonly lockedTarget: boolean;
  readonly autopilotActive: boolean;
  readonly landingIntentActive: boolean;
  readonly warpStep: number;
  readonly effectiveC: number;
  readonly classification: CelestialImpactClassification;
  readonly simulationTimeS: number;
}
