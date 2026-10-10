import {
  type CoverageChannel, type CoverageClaim, regionContains, type SpatialContext, type WorldProvider,
} from '../providers/WorldProvider';

/**
 * Every source of world, and the rule for what happens where two of them overlap.
 *
 * The game already has this rule, spread across `RealCityLayer.replacesChunk`,
 * `replacesCollider` and `HLOD.setRealCoverage`: the authored Largo beats the compiled city,
 * which beats the procedural filler. This formalises it so a planet-scale provider can obey the
 * same ordering without every pair of systems having to know about each other.
 *
 * The consequence that matters: exactly one provider owns a channel at a point. That is what
 * stops a second Manaus appearing under the real one.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, WorldProvider>();
  /** Sorted high to low. Rebuilt on change, which is rare, rather than per query. */
  private ordered: WorldProvider[] = [];

  get size(): number { return this.providers.size; }
  get all(): readonly WorldProvider[] { return this.ordered; }

  register(provider: WorldProvider): this {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider "${provider.id}" is already registered`);
    }
    this.providers.set(provider.id, provider);
    this.reorder();
    return this;
  }

  unregister(id: string): boolean {
    const removed = this.providers.delete(id);
    if (removed) this.reorder();
    return removed;
  }

  get(id: string): WorldProvider | undefined { return this.providers.get(id); }

  /** Providers relevant right now, highest priority first. */
  active(context: SpatialContext): readonly WorldProvider[] {
    return this.ordered.filter(provider => {
      try {
        return provider.covers(context);
      } catch (error) {
        console.error(`Provider "${provider.id}" failed its coverage test`, error);
        return false;
      }
    });
  }

  /** Every claim currently declared, highest priority first. */
  claims(): readonly CoverageClaim[] {
    const claims: CoverageClaim[] = [];
    for (const provider of this.ordered) {
      try {
        claims.push(...(provider.coverage?.() ?? []));
      } catch (error) {
        console.error(`Provider "${provider.id}" failed to declare coverage`, error);
      }
    }
    return claims.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Who owns a channel at a point — the highest-priority claimant, or undefined when nobody has
   * claimed it and a generic provider may fill in.
   */
  ownerOf(bodyId: string, latDeg: number, lonDeg: number, channel: CoverageChannel): string | undefined {
    for (const claim of this.claims()) {
      if (claim.region.bodyId !== bodyId) continue;
      if (!claim.channels.includes(channel)) continue;
      if (regionContains(claim.region, latDeg, lonDeg)) return claim.providerId;
    }
    return undefined;
  }

  /**
   * Whether a provider may draw a channel at a point, or must stand down because something with
   * more fidelity already covers it. This is the planetary generalisation of `replacesChunk`.
   */
  maySupply(providerId: string, bodyId: string, latDeg: number, lonDeg: number, channel: CoverageChannel): boolean {
    const owner = this.ownerOf(bodyId, latDeg, lonDeg, channel);
    return owner === undefined || owner === providerId;
  }

  private reorder(): void {
    // Ties broken by id so the order is deterministic run to run, which keeps the streaming
    // sequence reproducible and therefore debuggable.
    this.ordered = [...this.providers.values()].sort(
      (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
    );
  }
}
