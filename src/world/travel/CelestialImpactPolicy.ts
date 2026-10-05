import type { CelestialBodyProfile } from '../celestial/CelestialBodyProfile';
import type { CelestialContact } from './CelestialContact';
import type { CelestialImpactEvent } from './CelestialImpactEvent';
import { LIGHT_SPEED_MPS } from './TravelConstants';
import type { Vec3 } from '../spatial/units';

/** Fictional gameplay thresholds, not relativistic energy or a prediction of destruction. */
export const CELESTIAL_IMPACT_POLICY = Object.freeze({
  minorImpactSpeedMps: 120, // normal local flight / handoff tier
  majorImpactSpeedMps: 8_000, // maximum certified local terrain sweep tier
  catastrophicSpeedMps: LIGHT_SPEED_MPS,
  directImpactMinRadialFraction: .5,
  grazeMaxRadialFraction: .1,
});

export interface CelestialImpactContext {
  readonly lockedBodyId?: string;
  readonly autopilotActive: boolean;
  readonly landingIntentBodyId?: string;
  readonly warpStep: number;
  readonly simulationTimeS: number;
}
type ImpactDiagnostics = Pick<CelestialImpactEvent, 'bodyClass' | 'relativeVelocityMps' | 'relativeSpeedMps'
  | 'inwardRadialSpeedMps' | 'tangentialSpeedMps' | 'radialFraction' | 'incidenceAngleRad'
  | 'impactNormalSystem' | 'lockedTarget' | 'autopilotActive' | 'landingIntentActive'
  | 'classification' | 'effectiveC' | 'warpStep'>;

/** Pure scalar policy, invoked only for an actual swept contact with a known profile. */
export function classifyCelestialImpact(contact: CelestialContact, profile: CelestialBodyProfile,
  context: CelestialImpactContext, thresholds = CELESTIAL_IMPACT_POLICY): ImpactDiagnostics {
  const relativeVelocityMps: Vec3 = [contact.playerVelocityMps[0] - contact.bodyVelocityMps[0],
    contact.playerVelocityMps[1] - contact.bodyVelocityMps[1],
    contact.playerVelocityMps[2] - contact.bodyVelocityMps[2]];
  const length = Math.hypot(...contact.impactNormalSystem);
  const impactNormalSystem: Vec3 = length > 0 ? [contact.impactNormalSystem[0] / length,
    contact.impactNormalSystem[1] / length, contact.impactNormalSystem[2] / length] : [0, 1, 0];
  const radialSigned = relativeVelocityMps[0] * impactNormalSystem[0]
    + relativeVelocityMps[1] * impactNormalSystem[1] + relativeVelocityMps[2] * impactNormalSystem[2];
  const relativeSpeedMps = Math.hypot(...relativeVelocityMps);
  const inwardRadialSpeedMps = Math.max(0, -radialSigned);
  const tangentialSpeedMps = Math.hypot(relativeVelocityMps[0] - radialSigned * impactNormalSystem[0],
    relativeVelocityMps[1] - radialSigned * impactNormalSystem[1],
    relativeVelocityMps[2] - radialSigned * impactNormalSystem[2]);
  const radialFraction = relativeSpeedMps > 0 ? Math.min(1, inwardRadialSpeedMps / relativeSpeedMps) : 0;
  const lockedTarget = context.lockedBodyId === contact.bodyId;
  const landingIntentActive = context.landingIntentBodyId === contact.bodyId;
  let classification: CelestialImpactEvent['classification'];
  if (landingIntentActive || (lockedTarget && context.autopilotActive)) classification = 'SAFE_CAPTURE';
  else if (radialFraction <= thresholds.grazeMaxRadialFraction) classification = 'GRAZE';
  else if (relativeSpeedMps >= thresholds.catastrophicSpeedMps
    && radialFraction >= thresholds.directImpactMinRadialFraction) classification = 'CATASTROPHIC_IMPACT';
  else if (relativeSpeedMps >= thresholds.majorImpactSpeedMps) classification = 'MAJOR_IMPACT';
  else if (relativeSpeedMps >= thresholds.minorImpactSpeedMps) classification = 'MINOR_IMPACT';
  else classification = 'GRAZE';
  return { bodyClass: profile.bodyClass, relativeVelocityMps, relativeSpeedMps, inwardRadialSpeedMps,
    tangentialSpeedMps, radialFraction, incidenceAngleRad: Math.acos(radialFraction), impactNormalSystem,
    lockedTarget, autopilotActive: context.autopilotActive, landingIntentActive, classification,
    effectiveC: relativeSpeedMps / LIGHT_SPEED_MPS, warpStep: context.warpStep };
}
