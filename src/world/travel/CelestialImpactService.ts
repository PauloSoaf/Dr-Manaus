import type { BodyExclusionEnvelope } from './BodyNavigation';
import type { CelestialBodyProfile } from '../celestial/CelestialBodyProfile';
import type { Vec3 } from '../spatial/units';
import type { CelestialContact } from './CelestialContact';
import type { CelestialImpactEvent } from './CelestialImpactEvent';
import { classifyCelestialImpact, type CelestialImpactContext } from './CelestialImpactPolicy';

export const IMPACT_RELEASE_POLICY = Object.freeze({ minimumSeparationM: 10, radiusFraction: 1e-6 });

/** One consumer drains each simulation step. No persistent log or destruction dependencies. */
export class CelestialImpactService {
  private readonly episodes = new Map<string, number>();
  private readonly pending: CelestialImpactEvent[] = [];
  private sequence = 0;
  get emittedCount(): number { return this.sequence; }
  get activeEpisodeCount(): number { return this.episodes.size; }

  /** Call at the START of a flight step, before CCD can clamp a re-entry back onto the shell. */
  updateSeparation(positionM: Vec3, envelopes: readonly BodyExclusionEnvelope[]): void {
    for (const [id, contactRadiusM] of this.episodes) {
      const envelope = envelopes.find(e => e.bodyId === id);
      if (!envelope) { this.episodes.delete(id); continue; }
      // Switching from a broad envelope to measured relief cannot manufacture a new crossing.
      const radius = Math.max(contactRadiusM, envelope.radiusM);
      const releaseRadius = radius + Math.max(IMPACT_RELEASE_POLICY.minimumSeparationM,
        radius * IMPACT_RELEASE_POLICY.radiusFraction);
      if (Math.hypot(positionM[0] - envelope.centreM[0], positionM[1] - envelope.centreM[1],
        positionM[2] - envelope.centreM[2]) > releaseRadius) this.episodes.delete(id);
    }
  }

  emit(contact: CelestialContact, profile: CelestialBodyProfile, context: CelestialImpactContext,
    contactBodyFixedM?: Vec3): CelestialImpactEvent | undefined {
    if (this.episodes.has(contact.bodyId)) return undefined;
    const diagnostics = classifyCelestialImpact(contact, profile, context);
    const event: CelestialImpactEvent = { ...diagnostics,
      eventId: `impact-${++this.sequence}-${contact.bodyId}`, bodyId: contact.bodyId,
      contactSystemPositionM: [...contact.contactPositionM],
      ...(contactBodyFixedM ? { contactBodyFixedM: [...contactBodyFixedM] as Vec3 } : {}),
      simulationTimeS: context.simulationTimeS };
    for (const vector of [event.contactSystemPositionM, event.contactBodyFixedM,
      event.impactNormalSystem, event.relativeVelocityMps]) if (vector) Object.freeze(vector);
    Object.freeze(event);
    this.episodes.set(contact.bodyId, contact.envelopeRadiusM);
    this.pending.push(event);
    return event;
  }

  peek(): readonly CelestialImpactEvent[] { return this.pending.slice(); }
  drain(): CelestialImpactEvent[] { return this.pending.splice(0); }
  /** Clear transient state on an explicit world reset, preserving run-unique IDs. */
  clear(): void { this.pending.length = 0; this.episodes.clear(); }
}
