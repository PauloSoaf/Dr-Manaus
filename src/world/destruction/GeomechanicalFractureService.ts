import type { BodyFixedPoint, SubtractCapsuleEdit } from '../planet/volume/PlanetVolumeEdit';
import { PlanetVolumeEditStore } from '../planet/volume/PlanetVolumeEditStore';
import type { PlanetSurfaceGenerator } from '../planet/PlanetSurface';
import { planetSurfaceRadius } from '../planet/PlanetSurface';

/**
 * Physical constants for planetary crust geomechanics (SI units)
 */
export const ROCK_YIELD_STRESS_PA = 1.2e8; // ~120 MPa typical compressive/shear strength of basalt/granite
export const P_WAVE_VELOCITY_MPS = 6000;   // Primary seismic wave speed in planetary crust (~6 km/s)
export const S_WAVE_VELOCITY_MPS = 3500;   // Secondary shear wave speed (~3.5 km/s)

export interface SeismicWaveFront {
  readonly epicenterBodyFixedM: BodyFixedPoint;
  readonly energyJoules: number;
  readonly radiusM: number;
  readonly peakStressPa: number;
  readonly elapsedS: number;
}

export interface PlanetaryFaultSegment {
  readonly id: string;
  readonly startBodyFixedM: BodyFixedPoint;
  readonly endBodyFixedM: BodyFixedPoint;
  readonly widthM: number;
  readonly depthM: number;
  readonly slipOffsetM: number;
}

export interface GeomechanicalFracturePlan {
  readonly planId: string;
  readonly bodyId: string;
  readonly epicenterBodyFixedM: BodyFixedPoint;
  readonly energyJoules: number;
  readonly maxRadiusM: number;
  readonly faultSegments: readonly PlanetaryFaultSegment[];
  readonly crustIntegrity01: number;
}

export interface GeomechanicalFractureServiceOptions {
  readonly edits: PlanetVolumeEditStore;
  readonly surfaceForBody: (bodyId: string) => PlanetSurfaceGenerator | undefined;
  readonly onFractureCreated?: (plan: GeomechanicalFracturePlan) => void;
}

/**
 * 32-bit deterministic integer hash for procedural fracture branch patterns.
 */
function hashFracture(seed: number, index: number, salt: number): number {
  let h = (seed ^ (index * 0x9e3779b9) ^ (salt * 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

/**
 * Calculates peak dynamic stress at distance r from an energetic epicenter:
 * sigma(r) = sigma_0 * (r_0 / r)^1.1 * exp(-alpha * (r - r_0))
 * where sigma_0 scales with sqrt(E / 1e12).
 */
export function calculateDynamicStressPa(energyJoules: number, distanceM: number): number {
  if (energyJoules <= 0 || distanceM <= 0) return 0;
  const r0 = 50.0;
  const sigmaRef = 2.5e8; // 250 MPa at 1 TJ reference at 50m
  const energyScale = Math.sqrt(energyJoules / 1e12);
  const sigma0 = sigmaRef * energyScale;
  const clampedDist = Math.max(r0, distanceM);
  const geometricAttenuation = Math.pow(r0 / clampedDist, 1.1);
  const alpha = 1.2e-5; // seismic attenuation per metre
  const anelastic = Math.exp(-alpha * (clampedDist - r0));

  return sigma0 * geometricAttenuation * anelastic;
}

/**
 * Service managing large-scale geomechanical crust fractures, seismic fault propagation,
 * and structural collapse for Milestone D3.
 */
export class GeomechanicalFractureService {
  readonly options: GeomechanicalFractureServiceOptions;
  private readonly bodyIntegrity = new Map<string, number>();
  private lastPlan?: GeomechanicalFracturePlan;
  private fractureCounter = 0;

  constructor(options: GeomechanicalFractureServiceOptions) {
    this.options = options;
  }

  get lastFracture(): GeomechanicalFracturePlan | undefined {
    return this.lastPlan;
  }

  getCrustIntegrity(bodyId: string): number {
    return this.bodyIntegrity.get(bodyId) ?? 1.0;
  }

  setCrustIntegrity(bodyId: string, integrity01: number): void {
    this.bodyIntegrity.set(bodyId, Math.max(0, Math.min(1.0, integrity01)));
  }

  /**
   * Propagates a dynamic stress wave from an epicenter and carves geomechanical
   * fault lines wherever dynamic stress exceeds the planetary rock yield strength.
   */
  propagateStressAndFracture(
    bodyId: string,
    epicenterBodyFixedM: BodyFixedPoint,
    energyJoules: number,
    customPlanId?: string
  ): GeomechanicalFracturePlan | undefined {
    const surface = this.options.surfaceForBody(bodyId);
    if (!surface || energyJoules < 1e12) return undefined; // Minimum 1 Terajoule for tectonic faulting

    const body = surface.body;
    const epiDist = Math.hypot(...epicenterBodyFixedM);
    if (epiDist < 100) return undefined;

    // Normal at epicenter pointing outward
    const upNorm: BodyFixedPoint = [
      epicenterBodyFixedM[0] / epiDist,
      epicenterBodyFixedM[1] / epiDist,
      epicenterBodyFixedM[2] / epiDist,
    ];

    // Orthogonal tangent basis vectors on the surface
    const arbitrary: BodyFixedPoint = Math.abs(upNorm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1x = upNorm[1] * arbitrary[2] - upNorm[2] * arbitrary[1];
    const t1y = upNorm[2] * arbitrary[0] - upNorm[0] * arbitrary[2];
    const t1z = upNorm[0] * arbitrary[1] - upNorm[1] * arbitrary[0];
    const t1Len = Math.hypot(t1x, t1y, t1z) || 1;
    const tan1: BodyFixedPoint = [t1x / t1Len, t1y / t1Len, t1z / t1Len];

    const t2x = upNorm[1] * tan1[2] - upNorm[2] * tan1[1];
    const t2y = upNorm[2] * tan1[0] - upNorm[0] * tan1[2];
    const t2z = upNorm[0] * tan1[1] - upNorm[1] * tan1[0];
    const tan2: BodyFixedPoint = [t2x, t2y, t2z];

    // Calculate maximum fracture radius where dynamic stress equals rock yield strength
    // Binary search / estimate
    let rLow = 50.0;
    let rHigh = Math.min(body.semiMajorAxisM * 0.25, 2_000_000.0); // Up to 2,000 km
    for (let iter = 0; iter < 24; iter++) {
      const mid = 0.5 * (rLow + rHigh);
      const s = calculateDynamicStressPa(energyJoules, mid);
      if (s > ROCK_YIELD_STRESS_PA) {
        rLow = mid;
      } else {
        rHigh = mid;
      }
    }
    const maxRadiusM = rLow;
    if (maxRadiusM <= 200) return undefined; // Stress dissipated too close to epicenter

    const planId = customPlanId ?? `${bodyId}:fracture:${++this.fractureCounter}`;
    const faultSegments: PlanetaryFaultSegment[] = [];

    // Branching fracture pattern: 4 to 8 primary radial branches, with secondary bifurcations
    const seed = Math.floor(energyJoules % 1e9) ^ Math.floor(epiDist % 1e6);
    const primaryBranchCount = 4 + Math.floor(hashFracture(seed, 1, 7) * 4); // 4..7 branches

    for (let b = 0; b < primaryBranchCount; b++) {
      const baseAngle = (b / primaryBranchCount) * Math.PI * 2 + (hashFracture(seed, b, 13) - 0.5) * 0.4;
      const branchLength = maxRadiusM * (0.6 + hashFracture(seed, b, 23) * 0.4);

      // Generate segments along the jagged radial branch
      const segmentCount = 3 + Math.floor(branchLength / 400.0);
      const clampedSegs = Math.min(12, Math.max(3, segmentCount));
      let currentPoint = epicenterBodyFixedM;
      let currentAngle = baseAngle;

      for (let s = 0; s < clampedSegs; s++) {
        const segDist = branchLength / clampedSegs;
        currentAngle += (hashFracture(seed, b * 16 + s, 31) - 0.5) * 0.5; // Jagged angle meandering

        const cosA = Math.cos(currentAngle);
        const sinA = Math.sin(currentAngle);
        const dirTanX = tan1[0] * cosA + tan2[0] * sinA;
        const dirTanY = tan1[1] * cosA + tan2[1] * sinA;
        const dirTanZ = tan1[2] * cosA + tan2[2] * sinA;

        // Next point on surface
        const nextX = currentPoint[0] + dirTanX * segDist;
        const nextY = currentPoint[1] + dirTanY * segDist;
        const nextZ = currentPoint[2] + dirTanZ * segDist;
        const nextDist = Math.hypot(nextX, nextY, nextZ);

        // Project directly to planetary relief
        const normN: BodyFixedPoint = [nextX / nextDist, nextY / nextDist, nextZ / nextDist];
        const rSurf = planetSurfaceRadius(surface, [normN[0], normN[1], normN[2]]);
        const nextPoint: BodyFixedPoint = [normN[0] * rSurf, normN[1] * rSurf, normN[2] * rSurf];

        const segId = `${planId}:b${b}_s${s}`;
        const faultWidth = Math.max(4.0, (1.0 - s / clampedSegs) * (maxRadiusM * 0.04));
        const faultDepth = faultWidth * 2.5;

        // Carve CSG fissure capsule into PlanetVolumeEditStore
        const capsuleEdit: SubtractCapsuleEdit = {
          id: segId,
          bodyId,
          type: 'subtract-capsule',
          aBodyFixedM: currentPoint,
          bBodyFixedM: nextPoint,
          radiusM: faultWidth,
        };

        this.options.edits.subtractCapsule(capsuleEdit);

        faultSegments.push({
          id: segId,
          startBodyFixedM: currentPoint,
          endBodyFixedM: nextPoint,
          widthM: faultWidth,
          depthM: faultDepth,
          slipOffsetM: faultWidth * 0.3,
        });

        currentPoint = nextPoint;
      }
    }

    // Degrade planetary crust integrity proportional to energy & extent
    const previousIntegrity = this.getCrustIntegrity(bodyId);
    const integrityLoss = Math.min(0.25, (energyJoules / 1e18) * 0.1);
    const newIntegrity = Math.max(0, previousIntegrity - integrityLoss);
    this.setCrustIntegrity(bodyId, newIntegrity);

    const plan: GeomechanicalFracturePlan = {
      planId,
      bodyId,
      epicenterBodyFixedM,
      energyJoules,
      maxRadiusM,
      faultSegments,
      crustIntegrity01: newIntegrity,
    };

    this.lastPlan = plan;
    this.options.onFractureCreated?.(plan);
    return plan;
  }

  debugMetrics(): Record<string, string | number> {
    const last = this.lastPlan;
    return {
      'FRACTURE · Plan': last?.planId ?? '—',
      'FRACTURE · Body': last?.bodyId ?? '—',
      'FRACTURE · Fault segments': last ? last.faultSegments.length : 0,
      'FRACTURE · Extent radius': last ? `${(last.maxRadiusM / 1000).toFixed(1)} km` : '—',
      'FRACTURE · Crust integrity': last ? `${(last.crustIntegrity01 * 100).toFixed(1)}%` : '100%',
    };
  }
}
