import { GRAVITATIONAL_CONSTANT } from '../celestial/BlackHoleDescriptor';
import type { CelestialBody } from '../celestial/CelestialBody';
import { PlanetVolumeEditStore } from '../planet/volume/PlanetVolumeEditStore';
import type { KeplerianOrbitalElements } from './MacroBodyFractureService';
import { calculateKeplerianElements } from './MacroBodyFractureService';

/** Maximum radius in metres for a celestial object to be eligible for minor body disruption (500 km). */
export const MINOR_BODY_MAX_RADIUS_M = 500_000;

/** Specific disruption energy baseline balancing tensile and shear rock strength (100 kJ/kg). */
export const SPECIFIC_DISRUPTION_STRENGTH_J_KG = 1e5;

export interface AsteroidSwarmFragment {
  readonly id: string;
  readonly massKg: number;
  readonly radiusM: number;
  readonly relativePositionM: [number, number, number];
  readonly relativeVelocityMps: [number, number, number];
  readonly orbitalElements: KeplerianOrbitalElements;
}

export interface AsteroidFieldCluster {
  readonly clusterId: string;
  readonly originalBodyId: string;
  readonly totalMassKg: number;
  readonly dispersionSpeedMps: number;
  readonly fragments: readonly AsteroidSwarmFragment[];
}

export interface DisruptedMinorBodyPlan {
  readonly planId: string;
  readonly bodyId: string;
  readonly deliveredEnergyJoules: number;
  readonly disruptionThresholdJoules: number;
  readonly bindingEnergyJoules: number;
  readonly asteroidField: AsteroidFieldCluster;
  readonly state: 'DISRUPTED';
}

export interface MinorBodyDisruptionServiceOptions {
  readonly edits: PlanetVolumeEditStore;
  readonly bodyById: (bodyId: string) => CelestialBody | undefined;
  readonly onBodyDisrupted?: (plan: DisruptedMinorBodyPlan) => void;
}

/**
 * Deterministic pseudo-random number generator for minor body debris field dispersion.
 */
function hashMinor(seed: number, index: number, salt: number): number {
  let h = (seed ^ (index * 0x65d63f7b) ^ (salt * 0x517cc1b7)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x517cc1b7);
  h ^= h >>> 13;
  h = Math.imul(h, 0xa5a7c293);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

/**
 * Calculates the total gravitational self-binding energy of a celestial sphere:
 * U = (3/5) * G * M^2 / R
 */
export function gravitationalBindingEnergyJoules(massKg: number, radiusM: number): number {
  if (massKg <= 0 || radiusM <= 0) return 0;
  return (0.6 * GRAVITATIONAL_CONSTANT * massKg * massKg) / radiusM;
}

/**
 * Calculates the catastrophic disruption threshold energy Q_D^* * M.
 */
export function calculateCatastrophicDisruptionThresholdJoules(massKg: number, radiusM: number): number {
  if (massKg <= 0 || radiusM <= 0) return Infinity;
  const bindingEnergy = gravitationalBindingEnergyJoules(massKg, radiusM);
  const materialEnergy = massKg * SPECIFIC_DISRUPTION_STRENGTH_J_KG;
  return bindingEnergy + materialEnergy;
}

/**
 * Service managing Milestone D5: Complete Catastrophic Disruption of Minor Bodies
 * (small moons, asteroids, planetoids) and Heliocentric Asteroid Field Dispersion.
 */
export class MinorBodyDisruptionService {
  readonly options: MinorBodyDisruptionServiceOptions;
  private readonly disruptedPlans = new Map<string, DisruptedMinorBodyPlan>();
  private planCounter = 0;

  constructor(options: MinorBodyDisruptionServiceOptions) {
    this.options = options;
  }

  isBodyDisrupted(bodyId: string): boolean {
    return this.disruptedPlans.has(bodyId);
  }

  getDisruptionPlan(bodyId: string): DisruptedMinorBodyPlan | undefined {
    return this.disruptedPlans.get(bodyId);
  }

  /**
   * Checks whether a celestial body qualifies as a minor body eligible for total disruption.
   */
  canDisruptBody(body: CelestialBody): boolean {
    if (this.isBodyDisrupted(body.id)) return false;
    const radius = body.equatorialRadiusM;
    return radius > 0 && radius <= MINOR_BODY_MAX_RADIUS_M;
  }

  /**
   * Catastrophically disrupts a minor celestial body if the impact/superpower energy
   * exceeds its total binding and material strength energy.
   */
  disruptMinorBody(
    bodyId: string,
    energyJoules: number,
    impactDirection?: [number, number, number],
    customPlanId?: string
  ): DisruptedMinorBodyPlan | undefined {
    const body = this.options.bodyById(bodyId);
    if (!body || !this.canDisruptBody(body)) return undefined;

    const massKg = body.massKg ?? 1e15;
    const radiusM = body.equatorialRadiusM;
    const bindingEnergy = gravitationalBindingEnergyJoules(massKg, radiusM);
    const thresholdEnergy = calculateCatastrophicDisruptionThresholdJoules(massKg, radiusM);

    if (energyJoules < thresholdEnergy) {
      return undefined; // Sub-disruption energy
    }

    const planId = customPlanId ?? `${bodyId}:disrupted:${++this.planCounter}`;

    // Excess kinetic energy converted into debris expansion velocity
    const excessEnergy = Math.max(1e12, energyJoules - thresholdEnergy);
    const meanDispersionSpeedMps = Math.min(25_000, Math.sqrt((2.0 * excessEnergy) / massKg) + 50.0);

    const dir: [number, number, number] = impactDirection
      ? [impactDirection[0], impactDirection[1], impactDirection[2]]
      : [0, 1, 0];
    const dirLen = Math.hypot(...dir) || 1;
    const normDir: [number, number, number] = [dir[0] / dirLen, dir[1] / dirLen, dir[2] / dirLen];

    // Orthogonal basis
    const arb: [number, number, number] = Math.abs(normDir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1x = normDir[1] * arb[2] - normDir[2] * arb[1];
    const t1y = normDir[2] * arb[0] - normDir[0] * arb[2];
    const t1z = normDir[0] * arb[1] - normDir[1] * arb[0];
    const t1Len = Math.hypot(t1x, t1y, t1z) || 1;
    const t1: [number, number, number] = [t1x / t1Len, t1y / t1Len, t1z / t1Len];

    const t2: [number, number, number] = [
      normDir[1] * t1[2] - normDir[2] * t1[1],
      normDir[2] * t1[0] - normDir[0] * t1[2],
      normDir[0] * t1[1] - normDir[1] * t1[0],
    ];

    // Parent orbital velocity / host mass
    const parentId = body.parentId;
    const parentBody = parentId ? this.options.bodyById(parentId) : undefined;
    const hostMassKg = parentBody?.massKg ?? 1.98847e30; // Defaults to solar mass
    const hostRadiusM = parentBody?.equatorialRadiusM ?? 6.9634e8;

    // Generate fragmented asteroid field cluster
    const fragmentCount = 32;
    const fragments: AsteroidSwarmFragment[] = [];
    const seed = Math.floor(massKg % 1e9) ^ Math.floor(energyJoules % 1e8);

    for (let i = 0; i < fragmentCount; i++) {
      const theta = hashMinor(seed, i, 7) * Math.PI * 2;
      const phi = (hashMinor(seed, i, 19) - 0.5) * Math.PI;
      const cosP = Math.cos(phi);
      const rx = cosP * Math.cos(theta);
      const ry = Math.sin(phi);
      const rz = cosP * Math.sin(theta);

      // Fragment relative position at explosion onset
      const dist = radiusM * (0.2 + hashMinor(seed, i, 29) * 0.9);
      const relPos: [number, number, number] = [rx * dist, ry * dist, rz * dist];

      // Ejection velocity vector
      const speed = meanDispersionSpeedMps * (0.5 + hashMinor(seed, i, 37) * 1.0);
      const forwardImpulse = (hashMinor(seed, i, 43) * 0.4 + 0.6);
      const relVel: [number, number, number] = [
        (rx * 0.6 + normDir[0] * forwardImpulse) * speed,
        (ry * 0.6 + normDir[1] * forwardImpulse) * speed,
        (rz * 0.6 + normDir[2] * forwardImpulse) * speed,
      ];

      // Fragment mass via power-law distribution
      const fragMassFraction = Math.pow(hashMinor(seed, i, 61), 2.8);
      const fragMassKg = Math.max(1e7, (massKg / fragmentCount) * (0.1 + fragMassFraction * 2.0));
      const fragRadiusM = Math.max(5.0, Math.cbrt((fragMassKg / 2600.0) * (3.0 / (4.0 * Math.PI))));

      const { elements } = calculateKeplerianElements(
        relPos,
        relVel,
        hostMassKg,
        hostRadiusM
      );

      fragments.push({
        id: `${planId}:frag_${i}`,
        massKg: fragMassKg,
        radiusM: fragRadiusM,
        relativePositionM: relPos,
        relativeVelocityMps: relVel,
        orbitalElements: elements,
      });
    }

    const asteroidField: AsteroidFieldCluster = {
      clusterId: `${planId}:cluster`,
      originalBodyId: bodyId,
      totalMassKg: massKg,
      dispersionSpeedMps: meanDispersionSpeedMps,
      fragments,
    };

    const plan: DisruptedMinorBodyPlan = {
      planId,
      bodyId,
      deliveredEnergyJoules: energyJoules,
      disruptionThresholdJoules: thresholdEnergy,
      bindingEnergyJoules: bindingEnergy,
      asteroidField,
      state: 'DISRUPTED',
    };

    this.disruptedPlans.set(bodyId, plan);
    this.options.onBodyDisrupted?.(plan);
    return plan;
  }

  debugMetrics(): Record<string, string | number> {
    return {
      'MINOR-DISRUPTION · Disrupted bodies': this.disruptedPlans.size,
      'MINOR-DISRUPTION · Last body': this.disruptedPlans.size > 0 ? Array.from(this.disruptedPlans.keys()).pop()! : '—',
    };
  }
}

