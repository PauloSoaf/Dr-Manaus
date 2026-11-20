import { GRAVITATIONAL_CONSTANT } from '../celestial/BlackHoleDescriptor';
import type { CelestialBody } from '../celestial/CelestialBody';
import type { BodyFixedPoint, SubtractSphereEdit } from '../planet/volume/PlanetVolumeEdit';
import { PlanetVolumeEditStore } from '../planet/volume/PlanetVolumeEditStore';
import type { PlanetSurfaceGenerator } from '../planet/PlanetSurface';
import { planetSurfaceRadius } from '../planet/PlanetSurface';
import { GeomechanicalFractureService } from './GeomechanicalFractureService';

export const CRUST_DENSITY_KG_M3 = 2800; // ~2,800 kg/m^3 basaltic crust density
export const CRITICAL_CRUST_INTEGRITY_THRESHOLD = 0.35; // Crust ruptures macroscopically below 35% integrity

export interface KeplerianOrbitalElements {
  readonly semiMajorAxisM: number;
  readonly eccentricity: number;
  readonly inclinationRad: number;
  readonly periapsisM: number;
  readonly apoapsisM: number;
  readonly orbitalPeriodS?: number;
  readonly isBound: boolean;
}

export type DebrisOrbitTrajectoryType =
  | 'BOUND_ORBITAL_RING'
  | 'SUB_ORBITAL_REENTRY'
  | 'HYPERBOLIC_ESCAPE';

export interface OrbitalDebrisFragment {
  readonly id: string;
  readonly massKg: number;
  readonly radiusM: number;
  readonly positionBodyFixedM: BodyFixedPoint;
  readonly velocityBodyFixedMps: [number, number, number];
  readonly trajectoryType: DebrisOrbitTrajectoryType;
  readonly orbitalElements: KeplerianOrbitalElements;
}

export interface CelestialDebrisRing {
  readonly ringId: string;
  readonly parentBodyId: string;
  readonly innerRadiusM: number;
  readonly outerRadiusM: number;
  readonly meanInclinationRad: number;
  readonly totalMassKg: number;
  readonly fragments: readonly OrbitalDebrisFragment[];
}

export interface MacroBodyFracturePlan {
  readonly planId: string;
  readonly bodyId: string;
  readonly epicenterBodyFixedM: BodyFixedPoint;
  readonly capRadiusM: number;
  readonly capDepthM: number;
  readonly detachedMassKg: number;
  readonly remainingMassKg: number;
  readonly debrisRing: CelestialDebrisRing;
  readonly state: 'PARTIALLY_FRACTURED' | 'RUPTURED';
}

export interface MacroBodyFractureServiceOptions {
  readonly edits: PlanetVolumeEditStore;
  readonly geomechanics?: GeomechanicalFractureService;
  readonly surfaceForBody: (bodyId: string) => PlanetSurfaceGenerator | undefined;
  readonly bodyById: (bodyId: string) => CelestialBody | undefined;
  readonly onFractureCreated?: (plan: MacroBodyFracturePlan) => void;
}

/**
 * Deterministic pseudo-random number generator for macro fracture fragment dispersion.
 */
function hashMacro(seed: number, index: number, salt: number): number {
  let h = (seed ^ (index * 0x7feb352d) ^ (salt * 0x846ca68b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 13;
  h = Math.imul(h, 0x9b2e1335);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

/**
 * Calculates 2-body Keplerian orbital elements from state vector relative to parent body.
 */
export function calculateKeplerianElements(
  positionM: readonly [number, number, number],
  velocityMps: readonly [number, number, number],
  parentMassKg: number,
  parentRadiusM: number
): { elements: KeplerianOrbitalElements; trajectoryType: DebrisOrbitTrajectoryType } {
  const mu = GRAVITATIONAL_CONSTANT * Math.max(1e15, parentMassKg);
  const r = Math.hypot(...positionM);
  const v = Math.hypot(...velocityMps);
  if (r <= 0) {
    return {
      elements: {
        semiMajorAxisM: 0,
        eccentricity: 1,
        inclinationRad: 0,
        periapsisM: 0,
        apoapsisM: 0,
        isBound: false,
      },
      trajectoryType: 'SUB_ORBITAL_REENTRY',
    };
  }

  // Specific orbital energy: epsilon = v^2 / 2 - mu / r
  const energy = 0.5 * v * v - mu / r;

  // Specific angular momentum: h = r x v
  const hx = positionM[1] * velocityMps[2] - positionM[2] * velocityMps[1];
  const hy = positionM[2] * velocityMps[0] - positionM[0] * velocityMps[2];
  const hz = positionM[0] * velocityMps[1] - positionM[1] * velocityMps[0];
  const hMag = Math.hypot(hx, hy, hz);

  // Eccentricity vector: e = (v x h) / mu - r / |r|
  const vxhX = velocityMps[1] * hz - velocityMps[2] * hy;
  const vxhY = velocityMps[2] * hx - velocityMps[0] * hz;
  const vxhZ = velocityMps[0] * hy - velocityMps[1] * hx;

  const ex = vxhX / mu - positionM[0] / r;
  const ey = vxhY / mu - positionM[1] / r;
  const ez = vxhZ / mu - positionM[2] / r;
  const eccentricity = Math.hypot(ex, ey, ez);

  const inclinationRad = hMag > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, hz / hMag))) : 0;

  let semiMajorAxisM: number;
  let periapsisM: number;
  let apoapsisM: number;
  let orbitalPeriodS: number | undefined;

  const isBound = energy < 0 && eccentricity < 1.0;

  if (Math.abs(energy) > 1e-12) {
    semiMajorAxisM = -mu / (2 * energy);
  } else {
    semiMajorAxisM = Infinity;
  }

  if (isBound) {
    periapsisM = semiMajorAxisM * (1.0 - eccentricity);
    apoapsisM = semiMajorAxisM * (1.0 + eccentricity);
    orbitalPeriodS = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxisM, 3) / mu);
  } else {
    periapsisM = (hMag * hMag) / (mu * (1.0 + eccentricity));
    apoapsisM = Infinity;
  }

  let trajectoryType: DebrisOrbitTrajectoryType;
  if (!isBound) {
    trajectoryType = 'HYPERBOLIC_ESCAPE';
  } else if (periapsisM < parentRadiusM) {
    trajectoryType = 'SUB_ORBITAL_REENTRY';
  } else {
    trajectoryType = 'BOUND_ORBITAL_RING';
  }

  return {
    elements: {
      semiMajorAxisM,
      eccentricity,
      inclinationRad,
      periapsisM,
      apoapsisM,
      orbitalPeriodS,
      isBound,
    },
    trajectoryType,
  };
}

/**
 * Service managing Milestone D4: Partial Planetary Fracture, Crustal Plate Detachment,
 * and Orbital Debris Ring Dispersion.
 */
export class MacroBodyFractureService {
  readonly options: MacroBodyFractureServiceOptions;
  private readonly plans = new Map<string, MacroBodyFracturePlan>();
  private readonly remainingMasses = new Map<string, number>();
  private planCounter = 0;

  constructor(options: MacroBodyFractureServiceOptions) {
    this.options = options;
  }

  getFracturePlan(bodyId: string): MacroBodyFracturePlan | undefined {
    return this.plans.get(bodyId);
  }

  isBodyFractured(bodyId: string): boolean {
    return this.plans.has(bodyId);
  }

  getRemainingMassKg(bodyId: string): number | undefined {
    return this.remainingMasses.get(bodyId);
  }

  /**
   * Checks if crust integrity has degraded below critical threshold,
   * triggering macro-body fracture if critical.
   */
  triggerMacroFractureIfCritical(
    bodyId: string,
    epicenterOverride?: BodyFixedPoint,
    customPlanId?: string
  ): MacroBodyFracturePlan | undefined {
    const geomechanics = this.options.geomechanics;
    if (!geomechanics) return undefined;

    const integrity = geomechanics.getCrustIntegrity(bodyId);
    if (integrity > CRITICAL_CRUST_INTEGRITY_THRESHOLD) return undefined;

    // Use latest fracture epicenter or provide surface default
    const surface = this.options.surfaceForBody(bodyId);
    if (!surface) return undefined;

    let epicenter: BodyFixedPoint;
    if (epicenterOverride) {
      epicenter = epicenterOverride;
    } else if (geomechanics.lastFracture && geomechanics.lastFracture.bodyId === bodyId) {
      epicenter = geomechanics.lastFracture.epicenterBodyFixedM;
    } else {
      const r0 = planetSurfaceRadius(surface, [1, 0, 0]);
      epicenter = [r0, 0, 0];
    }

    const bodyRadius = surface.body.semiMajorAxisM;
    const capRadiusM = bodyRadius * 0.25; // 25% of planetary radius calotta
    const capDepthM = Math.min(60_000, bodyRadius * 0.04); // 40-60 km crustal depth
    const ejectionSpeedMps = 3500; // Sub-orbital to orbital velocity kick

    return this.detachPlate(bodyId, epicenter, capRadiusM, capDepthM, ejectionSpeedMps, customPlanId);
  }

  /**
   * Detaches a macroscopic continental/polar plate or calotta, carving the planetary
   * volume and injecting orbital debris fragments.
   */
  detachPlate(
    bodyId: string,
    epicenterBodyFixedM: BodyFixedPoint,
    capRadiusM: number,
    capDepthM: number,
    ejectionSpeedMps: number,
    customPlanId?: string
  ): MacroBodyFracturePlan | undefined {
    const surface = this.options.surfaceForBody(bodyId);
    const body = this.options.bodyById(bodyId);
    if (!surface || !body) return undefined;

    const bodyMass = body.massKg ?? 5.972e24;
    const parentRadiusM = surface.body.semiMajorAxisM;

    // Direction vector at epicenter
    const distEpi = Math.hypot(...epicenterBodyFixedM);
    if (distEpi < 100) return undefined;
    const norm: BodyFixedPoint = [
      epicenterBodyFixedM[0] / distEpi,
      epicenterBodyFixedM[1] / distEpi,
      epicenterBodyFixedM[2] / distEpi,
    ];

    // Orthogonal basis on surface
    const arbitrary: BodyFixedPoint = Math.abs(norm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1x = norm[1] * arbitrary[2] - norm[2] * arbitrary[1];
    const t1y = norm[2] * arbitrary[0] - norm[0] * arbitrary[2];
    const t1z = norm[0] * arbitrary[1] - norm[1] * arbitrary[0];
    const t1Len = Math.hypot(t1x, t1y, t1z) || 1;
    const tan1: BodyFixedPoint = [t1x / t1Len, t1y / t1Len, t1z / t1Len];

    const tan2: BodyFixedPoint = [
      norm[1] * tan1[2] - norm[2] * tan1[1],
      norm[2] * tan1[0] - norm[0] * tan1[2],
      norm[0] * tan1[1] - norm[1] * tan1[0],
    ];

    // Spherical cap volume: V = (pi * H / 6) * (3 * R^2 + H^2)
    const capVolumeM3 = (Math.PI * capDepthM / 6.0) * (3.0 * capRadiusM * capRadiusM + capDepthM * capDepthM);
    const detachedMassKg = capVolumeM3 * CRUST_DENSITY_KG_M3;
    const previousMass = this.remainingMasses.get(bodyId) ?? bodyMass;
    const remainingMassKg = Math.max(previousMass * 0.5, previousMass - detachedMassKg);
    this.remainingMasses.set(bodyId, remainingMassKg);

    const planId = customPlanId ?? `${bodyId}:macro-fracture:${++this.planCounter}`;

    // 1. Carve the spherical cap detachment into the PlanetVolumeEditStore
    // CSG Sphere center positioned so that bottom touches capDepthM below surface:
    // R_sphere = (R_cap^2 + H^2) / (2 * H)
    const sphereRadiusM = (capRadiusM * capRadiusM + capDepthM * capDepthM) / (2.0 * capDepthM);
    const centerOffsetM = sphereRadiusM - capDepthM;
    const sphereCenter: BodyFixedPoint = [
      epicenterBodyFixedM[0] - norm[0] * centerOffsetM,
      epicenterBodyFixedM[1] - norm[1] * centerOffsetM,
      epicenterBodyFixedM[2] - norm[2] * centerOffsetM,
    ];

    const capSubtractEdit: SubtractSphereEdit = {
      id: `${planId}:cap_cavity`,
      bodyId,
      type: 'subtract-sphere',
      centerBodyFixedM: sphereCenter,
      radiusM: sphereRadiusM,
    };
    this.options.edits.subtractSphere(capSubtractEdit);

    // 2. Generate discrete orbital debris fragments
    const fragmentCount = 16;
    const fragments: OrbitalDebrisFragment[] = [];
    const seed = Math.floor(capRadiusM) ^ Math.floor(detachedMassKg % 1e8);

    for (let f = 0; f < fragmentCount; f++) {
      const angle = (f / fragmentCount) * Math.PI * 2 + (hashMacro(seed, f, 11) - 0.5) * 0.3;
      const radialFraction = Math.sqrt(hashMacro(seed, f, 23));
      const distFromCenter = capRadiusM * radialFraction;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const px = epicenterBodyFixedM[0] + (tan1[0] * cosA + tan2[0] * sinA) * distFromCenter;
      const py = epicenterBodyFixedM[1] + (tan1[1] * cosA + tan2[1] * sinA) * distFromCenter;
      const pz = epicenterBodyFixedM[2] + (tan1[2] * cosA + tan2[2] * sinA) * distFromCenter;

      // Lift fragment slightly above surface at t=0
      const initAltitudeM = 5000.0 + hashMacro(seed, f, 37) * 20000.0;
      const fragPos: BodyFixedPoint = [
        px + norm[0] * initAltitudeM,
        py + norm[1] * initAltitudeM,
        pz + norm[2] * initAltitudeM,
      ];

      // Ejection velocity: combination of outward radial burst + tangential impulse
      const speedScale = ejectionSpeedMps * (0.8 + hashMacro(seed, f, 41) * 0.8);
      const tanSpeedScale = speedScale * (0.5 + hashMacro(seed, f, 53) * 0.7);
      const radSpeedScale = speedScale * (0.3 + hashMacro(seed, f, 67) * 0.7);

      const vx = norm[0] * radSpeedScale + (tan1[0] * cosA + tan2[0] * sinA) * tanSpeedScale;
      const vy = norm[1] * radSpeedScale + (tan1[1] * cosA + tan2[1] * sinA) * tanSpeedScale;
      const vz = norm[2] * radSpeedScale + (tan1[2] * cosA + tan2[2] * sinA) * tanSpeedScale;
      const fragVel: [number, number, number] = [vx, vy, vz];

      // Power-law mass distribution
      const fragMassFraction = Math.pow(hashMacro(seed, f, 79), 2.5);
      const fragMassKg = Math.max(1e9, (detachedMassKg / fragmentCount) * (0.2 + fragMassFraction * 1.8));
      const fragRadiusM = Math.cbrt((fragMassKg / CRUST_DENSITY_KG_M3) * (3.0 / (4.0 * Math.PI)));

      const { elements, trajectoryType } = calculateKeplerianElements(
        fragPos,
        fragVel,
        remainingMassKg,
        parentRadiusM
      );

      fragments.push({
        id: `${planId}:frag_${f}`,
        massKg: fragMassKg,
        radiusM: fragRadiusM,
        positionBodyFixedM: fragPos,
        velocityBodyFixedMps: fragVel,
        trajectoryType,
        orbitalElements: elements,
      });
    }

    // 3. Assemble Celestial Debris Ring / Field aggregate
    let minA = Infinity;
    let maxA = -Infinity;
    let totalInc = 0;
    let boundCount = 0;

    for (const frag of fragments) {
      if (frag.orbitalElements.isBound) {
        minA = Math.min(minA, frag.orbitalElements.periapsisM);
        maxA = Math.max(maxA, frag.orbitalElements.apoapsisM);
        totalInc += frag.orbitalElements.inclinationRad;
        boundCount++;
      }
    }

    const debrisRing: CelestialDebrisRing = {
      ringId: `${planId}:ring`,
      parentBodyId: bodyId,
      innerRadiusM: boundCount > 0 ? minA : parentRadiusM * 1.05,
      outerRadiusM: boundCount > 0 ? maxA : parentRadiusM * 2.5,
      meanInclinationRad: boundCount > 0 ? totalInc / boundCount : 0,
      totalMassKg: detachedMassKg,
      fragments,
    };

    const plan: MacroBodyFracturePlan = {
      planId,
      bodyId,
      epicenterBodyFixedM,
      capRadiusM,
      capDepthM,
      detachedMassKg,
      remainingMassKg,
      debrisRing,
      state: 'PARTIALLY_FRACTURED',
    };

    this.plans.set(bodyId, plan);
    this.options.onFractureCreated?.(plan);
    return plan;
  }

  /**
   * Catastrophically ruptures a major planetary body, carving multiple orthogonal
   * fissure caps into the core and dispersing a dense Keplerian debris ring.
   */
  rupturePlanet(bodyId: string, energyJoules: number): MacroBodyFracturePlan | undefined {
    const surface = this.options.surfaceForBody(bodyId);
    const body = this.options.bodyById(bodyId);
    if (!surface || !body) return undefined;

    const r0 = planetSurfaceRadius(surface, [1, 0, 0]);
    const capRadiusM = r0 * 0.45;
    const capDepthM = r0 * 0.25;
    const ejectionSpeedMps = 7500;

    const plan = this.detachPlate(bodyId, [r0, 0, 0], capRadiusM, capDepthM, ejectionSpeedMps);
    if (!plan) return undefined;

    const antipodalAxes: readonly BodyFixedPoint[] = [
      [-r0, 0, 0],
      [0, r0, 0],
      [0, -r0, 0],
      [0, 0, r0],
      [0, 0, -r0],
    ];

    for (let i = 0; i < antipodalAxes.length; i++) {
      const axis = antipodalAxes[i];
      const editId = `${plan.planId}:rupture_cap_${i}`;
      this.options.edits.subtractSphere({
        id: editId,
        bodyId,
        centerBodyFixedM: axis,
        radiusM: capRadiusM,
      });
    }

    const rupturedPlan: MacroBodyFracturePlan = {
      ...plan,
      state: 'RUPTURED',
    };
    this.plans.set(bodyId, rupturedPlan);
    return rupturedPlan;
  }

  /**
   * Restores a fractured or ruptured planet, removing its subtractive CSG edits.
   */
  restorePlanet(bodyId: string): boolean {
    const hadPlan = this.plans.delete(bodyId);
    this.remainingMasses.delete(bodyId);

    const edits = this.options.edits.editsForBody(bodyId);
    let removedAny = false;
    for (const edit of edits) {
      if (edit.id.includes('macro-fracture') || edit.id.includes('rupture_cap') || edit.id.includes('cap_cavity')) {
        this.options.edits.remove(edit.id);
        removedAny = true;
      }
    }
    return hadPlan || removedAny;
  }

  isBodyFracturedOrRuptured(bodyId: string): boolean {
    return this.plans.has(bodyId);
  }

  getPlan(bodyId: string): MacroBodyFracturePlan | undefined {
    return this.plans.get(bodyId);
  }

  debugMetrics(): Record<string, string | number> {
    return {
      'MACRO-FRACTURE · Active bodies': this.plans.size,
      'MACRO-FRACTURE · Last plan': this.plans.size > 0 ? Array.from(this.plans.keys()).pop()! : '—',
    };
  }
}

