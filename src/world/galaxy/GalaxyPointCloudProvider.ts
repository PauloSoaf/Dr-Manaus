import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu';
import {
  type ProceduralGalaxyDescriptor,
  DeterministicRNG,
  ProceduralGalaxyGenerator,
  GALAXY_GENERATOR_VERSION,
} from './ProceduralGalaxyGenerator';
import { LOCAL_GROUP_CATALOG, type GalaxyDefinition } from '../celestial/GalaxyDefinition';
import type { QualityPreset } from '../../core/config';

/** Particle counts allocated per visual quality tier. */
export const GALAXY_POINT_BUDGETS: Record<QualityPreset, number> = {
  Low: 10_000,
  Medium: 40_000,
  High: 80_000,
  Ultra: 160_000,
};

/** Maximum number of cached particle geometries before evicting unreferenced entries. */
export const MAX_POINT_CLOUD_CACHE_SIZE = 16;

/**
 * Builds a collision-resistant semantic cache key for procedural galaxy geometries.
 * Incorporates generator version, unique ID, BigInt seed hex, Hubble classification,
 * quality preset, particle count, and distinct structural morphology parameters.
 */
export function buildPointCloudCacheKey(
  descriptor: ProceduralGalaxyDescriptor,
  preset: QualityPreset,
  particleBudget: number,
): string {
  const seedHex = descriptor.seed.toString(16);
  const armsKey = descriptor.spiralArms?.active
    ? `arms:${descriptor.spiralArms.numArms}_${descriptor.spiralArms.pitchAngleRad.toFixed(4)}`
    : 'noarms';
  const barKey = descriptor.bar?.active
    ? `bar:${descriptor.bar.lengthLy.toFixed(0)}_${descriptor.bar.angleRad.toFixed(4)}`
    : 'nobar';

  return `v${GALAXY_GENERATOR_VERSION}|${descriptor.id}|${seedHex}|${descriptor.family}|${descriptor.morphology}|${preset}|${particleBudget}|diam:${descriptor.diameterLy.toFixed(0)}|thick:${descriptor.thicknessLy.toFixed(0)}|spec:${descriptor.dominantSpectralClass}|${armsKey}|${barKey}`;
}

/** Helper to resolve or generate a ProceduralGalaxyDescriptor from any GalaxyDefinition. */
export function resolveGalaxyDescriptor(
  galaxy: GalaxyDefinition,
  generator?: ProceduralGalaxyGenerator,
): ProceduralGalaxyDescriptor {
  if (galaxy.proceduralMorphology) {
    return galaxy.proceduralMorphology;
  }
  const gen = generator ?? new ProceduralGalaxyGenerator();
  if (galaxy.id === 'milky_way') {
    return gen.generateGalaxy(0n, { x: 0n, y: 0n, z: 0n }, 0);
  }
  if (galaxy.id === 'andromeda') {
    return gen.generateGalaxy(0n, { x: 0n, y: 0n, z: 0n }, 1);
  }
  const index = LOCAL_GROUP_CATALOG.findIndex((g) => g.id === galaxy.id);
  if (index >= 0) {
    return gen.generateGalaxy(0n, { x: 0n, y: 0n, z: 0n }, index);
  }
  // Deterministic seed fallback derived from string id
  let seed = 2166136261n;
  for (let i = 0; i < galaxy.id.length; i++) {
    seed = (seed ^ BigInt(galaxy.id.charCodeAt(i))) * 1099511628211n;
  }
  return gen.generateGalaxy(seed, { x: 1n, y: 0n, z: 0n }, 0);
}

/** Options for point cloud generation. */
export interface PointCloudGenerationOptions {
  preset?: QualityPreset;
  maxParticles?: number;
}

/**
 * Procedural point cloud provider for galactic stellar populations.
 *
 * Translates a mathematical ProceduralGalaxyDescriptor into a GPU BufferGeometry containing
 * normalized coordinates [-1, 1], RGB spectral colors, luminosity sizes, and dust extinction factors.
 * Preserves strict determinism and maintains a bounded LRU cache with reference counting
 * to avoid per-frame allocations and prevent premature disposal of active GPU buffers.
 */
export class GalaxyPointCloudProvider {
  private readonly cache = new Map<string, BufferGeometry>();
  private readonly refCounts = new Map<BufferGeometry, number>();
  readonly maxCacheSize: number;

  constructor(maxCacheSize: number = MAX_POINT_CLOUD_CACHE_SIZE) {
    this.maxCacheSize = Math.max(1, maxCacheSize);
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  /** Increments active consumer reference count for this geometry. */
  retain(geom: BufferGeometry): void {
    const current = this.refCounts.get(geom) ?? 0;
    this.refCounts.set(geom, current + 1);
  }

  /** Decrements consumer reference count. If count reaches zero and geom was evicted, disposes it. */
  release(geom: BufferGeometry): void {
    const current = this.refCounts.get(geom) ?? 0;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      this.refCounts.delete(geom);
      // If geometry is no longer retained and is not resident in cache, dispose it
      let isResident = false;
      for (const resident of this.cache.values()) {
        if (resident === geom) {
          isResident = true;
          break;
        }
      }
      if (!isResident) {
        geom.dispose();
      }
    } else {
      this.refCounts.set(geom, next);
    }
  }

  /** Returns active consumer reference count for this geometry. */
  getRefCount(geom: BufferGeometry): number {
    return this.refCounts.get(geom) ?? 0;
  }

  /** Checks if a specific descriptor and quality geometry is currently resident in cache. */
  hasCached(
    descriptor: ProceduralGalaxyDescriptor,
    preset: QualityPreset = 'High',
    customMaxParticles?: number,
  ): boolean {
    const budget = customMaxParticles ?? GALAXY_POINT_BUDGETS[preset] ?? GALAXY_POINT_BUDGETS.Medium;
    const cacheKey = buildPointCloudCacheKey(descriptor, preset, budget);
    return this.cache.has(cacheKey);
  }

  /**
   * Retrieves or builds a cached BufferGeometry for the requested descriptor and quality.
   */
  getGeometry(
    descriptor: ProceduralGalaxyDescriptor,
    preset: QualityPreset = 'High',
    customMaxParticles?: number,
  ): BufferGeometry {
    const budget = customMaxParticles ?? GALAXY_POINT_BUDGETS[preset] ?? GALAXY_POINT_BUDGETS.Medium;
    const cacheKey = buildPointCloudCacheKey(descriptor, preset, budget);

    let geom = this.cache.get(cacheKey);
    if (geom) {
      // Refresh position in LRU order
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, geom);
      return geom;
    }

    geom = this.generateGeometry(descriptor, budget);

    // Enforce memory bounds via LRU eviction (never disposing buffers with active references)
    if (this.cache.size >= this.maxCacheSize) {
      let evictKey: string | undefined;
      for (const [key, candidate] of this.cache.entries()) {
        if ((this.refCounts.get(candidate) ?? 0) === 0) {
          evictKey = key;
          break;
        }
      }
      if (!evictKey) {
        evictKey = this.cache.keys().next().value;
      }

      if (evictKey !== undefined) {
        const evicted = this.cache.get(evictKey);
        this.cache.delete(evictKey);
        if (evicted && (this.refCounts.get(evicted) ?? 0) === 0) {
          evicted.dispose();
        }
      }
    }

    this.cache.set(cacheKey, geom);
    return geom;
  }

  /**
   * Generates a new BufferGeometry with normalized coordinates [-1, 1] for unit radius R_gal.
   * Disk plane is aligned with the X-Z plane, with polar normal axis along +Y.
   */
  generateGeometry(descriptor: ProceduralGalaxyDescriptor, particleCount: number): BufferGeometry {
    const count = Math.max(100, Math.floor(particleCount));
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const dust = new Float32Array(count);

    // Seeded deterministic RNG ensuring invariant output for identical descriptor
    const rng = new DeterministicRNG(descriptor.seed ^ 0xa5a5_5a5a_3c3c_c3c3n);

    const R_gal = Math.max(1_000, descriptor.diameterLy * 0.5);
    const thinHeightU = (descriptor.disk?.thinScaleHeightLy || (descriptor.thicknessLy * 0.25)) / R_gal;
    const thickHeightU = (descriptor.disk?.thickScaleHeightLy || (descriptor.thicknessLy * 0.75)) / R_gal;
    const bulgeRadiusU = (descriptor.bulge?.effectiveRadiusLy || (R_gal * 0.2)) / R_gal;

    const barActive = descriptor.bar?.active ?? false;
    const barLengthU = barActive ? (descriptor.bar.lengthLy || R_gal * 0.3) / R_gal : 0;
    const barWidthU = barActive ? (descriptor.bar.widthLy || R_gal * 0.15) / R_gal : 0;
    const barHeightU = barActive ? (descriptor.bar.heightLy || R_gal * 0.08) / R_gal : 0;
    const barAngle = barActive ? descriptor.bar.angleRad : 0;

    const spiralActive = descriptor.spiralArms?.active ?? false;
    const numArms = spiralActive ? Math.max(1, descriptor.spiralArms.numArms) : 0;
    const pitchRad = spiralActive ? descriptor.spiralArms.pitchAngleRad : 0.2;
    const tanPitch = Math.tan(Math.max(0.05, pitchRad));
    const armAngularWidth = spiralActive ? descriptor.spiralArms.angularWidthRad : 0.2;
    const armPhases = spiralActive && descriptor.spiralArms.initialPhasesRad.length > 0
      ? descriptor.spiralArms.initialPhasesRad
      : Array.from({ length: numArms }, (_, k) => (2 * Math.PI * k) / numArms);

    const isElliptical = descriptor.family === 'elliptical';
    const isLenticular = descriptor.family === 'lenticular';
    const isIrregular = descriptor.family === 'irregular';

    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      let z = 0;
      let r = 0.9;
      let g = 0.9;
      let b = 0.9;
      let size = 1.0;
      let dustFactor = 1.0;

      const roll = rng.unit();

      if (isElliptical) {
        // Elliptical galaxy: pure smooth spheroidal / triaxial distribution (E0 - E7)
        const qz = descriptor.bulge.axisRatio ? descriptor.bulge.axisRatio[2] : 0.7;
        const u = rng.unit();
        // Hernquist-like radial falloff clamped within unit radius
        const radius = Math.min(0.98, bulgeRadiusU * (u / (1.0 - u * 0.85 + 1e-5)));
        const phi = rng.range(0, 2 * Math.PI);
        const cosTheta = rng.range(-1, 1);
        const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));

        x = radius * sinTheta * Math.cos(phi);
        y = radius * sinTheta * Math.sin(phi);
        z = radius * cosTheta * qz;

        // Old, mature stellar population: warm amber and orange-red K/M giants
        const tempRoll = rng.unit();
        r = 1.0;
        g = 0.72 + tempRoll * 0.16;
        b = 0.48 + tempRoll * 0.20;
        size = 1.0 + (rng.unit() ** 3) * 1.5;
        dustFactor = 1.0;
      } else if (isIrregular) {
        // Irregular galaxy: asymmetric stochastic star-forming clumps
        const clumpIndex = Math.floor(rng.unit() * 3);
        const clumpCenters = [
          [-0.22, 0.15, 0.04],
          [0.35, -0.18, -0.06],
          [0.08, 0.32, 0.02],
        ];
        const center = clumpCenters[clumpIndex];
        const spread = 0.28 * Math.sqrt(rng.unit());
        const theta = rng.range(0, 2 * Math.PI);
        const phi = rng.range(-Math.PI * 0.4, Math.PI * 0.4);

        x = center[0] + spread * Math.cos(theta) * Math.cos(phi);
        y = center[1] + spread * Math.sin(theta) * Math.cos(phi);
        z = center[2] + spread * Math.sin(phi) * 0.5;

        // Vigorous young starburst: intensely blue with violent ionized regions
        r = 0.65 + rng.unit() * 0.25;
        g = 0.78 + rng.unit() * 0.20;
        b = 1.0;
        size = 1.1 + (rng.unit() ** 2) * 2.0;
        dustFactor = 0.85 + rng.unit() * 0.15;
      } else if (isLenticular) {
        // Lenticular (S0): prominent central bulge surrounded by smooth, featureless stellar disk
        if (roll < 0.45) {
          // Central bulge
          const u = rng.unit();
          const rad = bulgeRadiusU * (u / (1.0 - u * 0.8 + 1e-5));
          const theta = rng.range(0, 2 * Math.PI);
          const phi = rng.range(-Math.PI * 0.5, Math.PI * 0.5);
          x = rad * Math.cos(theta) * Math.cos(phi);
          y = rad * Math.sin(theta) * Math.cos(phi);
          z = rad * Math.sin(phi) * 0.65;

          r = 0.98;
          g = 0.82;
          b = 0.58;
          size = 1.2;
          dustFactor = 1.0;
        } else {
          // Featureless exponential disk
          const rad = Math.min(0.95, -0.28 * Math.log(Math.max(1e-5, 1 - rng.unit())));
          const theta = rng.range(0, 2 * Math.PI);
          x = rad * Math.cos(theta);
          y = rad * Math.sin(theta);
          z = thinHeightU * (rng.unit() - 0.5) * 2.0;

          r = 0.94;
          g = 0.85;
          b = 0.68;
          size = 0.95;
          dustFactor = 0.95;
        }
      } else {
        // Spiral and Barred Spiral galaxies (Sa, Sb, Sc, SBa, SBb, SBc)
        if (roll < 0.22) {
          // 1. Central Bulge (Hernquist-like distribution)
          const u = rng.unit();
          const rad = Math.min(0.45, bulgeRadiusU * (u / (1.0 - u * 0.75 + 1e-5)));
          const theta = rng.range(0, 2 * Math.PI);
          const phi = rng.range(-Math.PI * 0.5, Math.PI * 0.5);
          const qz = descriptor.bulge.axisRatio ? descriptor.bulge.axisRatio[2] : 0.75;

          x = rad * Math.cos(theta) * Math.cos(phi);
          y = rad * Math.sin(theta) * Math.cos(phi);
          z = rad * Math.sin(phi) * qz;

          // Warm core population: K and M giants (golden-yellow to warm amber)
          const hue = rng.unit();
          r = 1.0;
          g = 0.80 + hue * 0.12;
          b = 0.52 + hue * 0.18;
          size = 1.1 + (rng.unit() ** 2) * 1.2;
          dustFactor = 1.0;
        } else if (barActive && roll < 0.36) {
          // 2. Triaxial Central Bar
          // Sample inside Gaussian-like triaxial bar aligned with barAngle
          const u1 = rng.range(-1, 1);
          const u2 = rng.range(-1, 1);
          const u3 = rng.range(-1, 1);

          const barX = u1 * barLengthU * 0.5;
          const barY = u2 * barWidthU * 0.5;
          z = u3 * barHeightU * 0.5;

          // Rotate by bar angle
          const cosA = Math.cos(barAngle);
          const sinA = Math.sin(barAngle);
          x = barX * cosA - barY * sinA;
          y = barX * sinA + barY * cosA;

          // Intermediate population: G and K dwarfs
          r = 0.98;
          g = 0.86;
          b = 0.62;
          size = 1.0;
          dustFactor = 0.92;
        } else if (spiralActive && roll < 0.82) {
          // 3. Logarithmic Spiral Arms
          const armIdx = Math.floor(rng.unit() * numArms);
          const armPhase = armPhases[armIdx];

          // Sample radius r in [r_min, 1.0] with exponential density weighting
          const r0 = Math.max(0.12, bulgeRadiusU * 0.9);
          const uRad = rng.unit();
          // Exponential falloff along arm length
          const rad = r0 + (1.0 - r0) * (1.0 - Math.exp(-2.5 * uRad)) / (1.0 - Math.exp(-2.5));

          // Logarithmic spiral ridge: theta(r) = theta_0 + ln(r/r_0) / tan(pitch)
          const thetaRidge = armPhase + Math.log(Math.max(1e-4, rad / r0)) / tanPitch;

          // Gaussian dispersion around arm ridge
          const gaussianDispersion = (rng.unit() + rng.unit() + rng.unit() - 1.5) * armAngularWidth * 0.6;
          const theta = thetaRidge + gaussianDispersion;

          x = rad * Math.cos(theta);
          y = rad * Math.sin(theta);

          // Vertical Laplace distribution
          const zSign = rng.unit() > 0.5 ? 1 : -1;
          z = -thinHeightU * Math.log(Math.max(1e-5, 1 - rng.unit())) * zSign;

          // Population split:
          // Negative dispersion = inner/trailing edge -> higher probability of dust extinction lane
          const isDustLane = gaussianDispersion < -armAngularWidth * 0.25 && rng.unit() < 0.65;
          const isHII = rng.unit() < 0.18;

          if (isDustLane) {
            // Dark dust extinction: reddened color and suppressed opacity
            r = 0.82 + rng.unit() * 0.12;
            g = 0.58 + rng.unit() * 0.10;
            b = 0.36 + rng.unit() * 0.12;
            dustFactor = 0.35 + rng.unit() * 0.35;
            size = 0.85;
          } else if (isHII) {
            // Ionized hydrogen emission nebulae (H II regions)
            r = 0.98;
            g = 0.58 + rng.unit() * 0.18;
            b = 0.88 + rng.unit() * 0.12;
            size = 1.8 + (rng.unit() ** 2) * 1.5;
            dustFactor = 0.9;
          } else {
            // Young hot OB associations on spiral crests: brilliant blue-white
            r = 0.68 + rng.unit() * 0.16;
            g = 0.82 + rng.unit() * 0.14;
            b = 1.0;
            size = 1.0 + (rng.unit() ** 2.5) * 2.2;
            dustFactor = 1.0;
          }
        } else {
          // 4. Diffuse Exponential Disk and Stellar Halo
          const isHalo = rng.unit() < 0.10;

          if (isHalo) {
            // Outer spheroidal halo
            const rHalo = rng.range(0.2, 1.25);
            const theta = rng.range(0, 2 * Math.PI);
            const cosT = rng.range(-1, 1);
            const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));

            x = rHalo * sinT * Math.cos(theta);
            y = rHalo * sinT * Math.sin(theta);
            z = rHalo * cosT * 0.82;

            // Halo stars: old metal-poor population
            r = 0.92;
            g = 0.90;
            b = 0.78;
            size = 0.8;
            dustFactor = 1.0;
          } else {
            // Diffuse disk
            const rad = Math.min(0.98, -0.32 * Math.log(Math.max(1e-5, 1 - rng.unit())));
            const theta = rng.range(0, 2 * Math.PI);

            x = rad * Math.cos(theta);
            y = rad * Math.sin(theta);

            const isThick = rng.unit() < (descriptor.disk?.thickDiskFraction || 0.1);
            const hScale = isThick ? thickHeightU : thinHeightU;
            const sign = rng.unit() > 0.5 ? 1 : -1;
            z = -hScale * Math.log(Math.max(1e-5, 1 - rng.unit())) * sign;

            // Disk stars: mixed F, G, K dwarfs
            const t = Math.min(1.0, rad);
            r = 0.96 - t * 0.18;
            g = 0.88 - t * 0.05;
            b = 0.72 + t * 0.24;
            size = 0.9 + rng.unit() * 0.6;
            dustFactor = 0.85;
          }
        }
      }

      const idx3 = i * 3;
      positions[idx3] = x;
      positions[idx3 + 1] = z; // Y-up: Galactic polar normal axis in Three.js coordinates
      positions[idx3 + 2] = y;

      colors[idx3] = Math.max(0, Math.min(1, r));
      colors[idx3 + 1] = Math.max(0, Math.min(1, g));
      colors[idx3 + 2] = Math.max(0, Math.min(1, b));

      sizes[i] = size;
      dust[i] = dustFactor;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('dust', new Float32BufferAttribute(dust, 1));

    return geometry;
  }

  /** Clears cached BufferGeometries and releases GPU resources for unreferenced buffers. */
  dispose(): void {
    for (const geom of this.cache.values()) {
      if ((this.refCounts.get(geom) ?? 0) === 0) {
        geom.dispose();
      }
    }
    this.cache.clear();
  }
}
