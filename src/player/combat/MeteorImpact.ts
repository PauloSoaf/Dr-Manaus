/**
 * What happens when the hero meets the ground.
 *
 * A single scalar — impact energy — orders every landing in the game, from stepping off a kerb
 * to a 1 km titan arriving at eight thousand metres a second. Everything the impact does is a
 * continuous function of that scalar; the named tiers exist so the HUD, the sound and the hit
 * stop have something discrete to key off, not because the numbers step.
 */

export type ImpactProfile = 'soft' | 'heavy' | 'shock' | 'meteor' | 'titan';

export interface ImpactTier {
  readonly profile: ImpactProfile;
  /** Lower bound of the tier, in impact-energy units. */
  readonly energy: number;
  /** Fraction of the computed structural damage this tier is allowed to deal. */
  readonly damageGain: number;
  readonly hitStopMs: number;
  readonly label: string;
}

/**
 * Thresholds are read in metres per second for a size-1 hero, because that is the only case
 * anyone can check by eye. A stock jump lands at 9.5 m/s and a double jump at 17.4, so `heavy`
 * starts above both — landing from your own jump must never scar the street.
 */
export const IMPACT_TIERS: readonly ImpactTier[] = [
  { profile: 'soft',   energy: 0,    damageGain: 0,    hitStopMs: 0,   label: 'Aterrissagem' },
  { profile: 'heavy',  energy: 26,   damageGain: 0.12, hitStopMs: 18,  label: 'Aterrissagem pesada' },
  { profile: 'shock',  energy: 70,   damageGain: 0.55, hitStopMs: 45,  label: 'Impacto sísmico' },
  { profile: 'meteor', energy: 260,  damageGain: 1,    hitStopMs: 95,  label: 'Impacto meteórico' },
  { profile: 'titan',  energy: 1600, damageGain: 1,    hitStopMs: 150, label: 'Impacto titânico' },
];

export const IMPACT = {
  /** Size enters the energy, not the radius: a titan's mass is already in how hard it arrives. */
  sizeExponent: 0.75,
  /** A committed downward strike is worth far more than the same speed arrived at by falling. */
  slamGain: 2.2,
  maxRadius: 640,
  maxShake: 3.2,
  maxImpulse: 4200,
  maxDebris: 90,
} as const;

export interface ImpactResult {
  readonly profile: ImpactProfile;
  readonly tier: ImpactTier;
  readonly energy: number;
  /** Blast radius in metres. Zero for `soft`, which must leave the world untouched. */
  readonly radius: number;
  readonly damage: number;
  readonly shake: number;
  readonly hitStopMs: number;
  readonly impulse: number;
  readonly debris: number;
  readonly slam: boolean;
}

const finite = (value: number, fallback = 0): number => (Number.isFinite(value) ? value : fallback);

/** Downward speed and size collapsed into one ordering scalar. */
export function impactEnergy(speed: number, size = 1, slam = false): number {
  const v = Math.max(0, finite(speed));
  const s = Math.max(1, finite(size, 1));
  return v * Math.pow(s, IMPACT.sizeExponent) * (slam ? IMPACT.slamGain : 1);
}

export function profileFor(energy: number): ImpactTier {
  const value = Math.max(0, finite(energy));
  let tier = IMPACT_TIERS[0];
  for (const candidate of IMPACT_TIERS) if (value >= candidate.energy) tier = candidate;
  return tier;
}

/**
 * The whole impact, resolved. `radius` and `damage` are fed straight to the destruction system,
 * which digs the crater itself from them — the bowl depth is already `r·0.36 + sqrt(damage)·0.32`
 * over there, so passing a depth as well would only let the two disagree.
 */
export function resolveImpact(speed: number, size = 1, slam = false): ImpactResult {
  const energy = impactEnergy(speed, size, slam);
  const tier = profileFor(energy);
  if (tier.profile === 'soft') {
    return { profile: 'soft', tier, energy, radius: 0, damage: 0, shake: Math.min(0.08, energy * 0.004), hitStopMs: 0, impulse: 0, debris: 0, slam };
  }
  const radius = Math.min(IMPACT.maxRadius, 0.055 * Math.pow(energy, 0.92));
  const damage = 900 * Math.pow(energy, 0.85) * tier.damageGain;
  return {
    profile: tier.profile,
    tier,
    energy,
    radius,
    damage,
    shake: Math.min(IMPACT.maxShake, 0.06 + Math.pow(energy, 0.45) * 0.055),
    hitStopMs: tier.hitStopMs,
    impulse: Math.min(IMPACT.maxImpulse, 30 + Math.pow(energy, 0.6) * 6),
    debris: Math.round(Math.min(IMPACT.maxDebris, 6 + Math.pow(energy, 0.5) * 1.4)),
    slam,
  };
}
