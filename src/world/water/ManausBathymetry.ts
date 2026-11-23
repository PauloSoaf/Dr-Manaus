/**
 * ManausBathymetry.ts
 *
 * Single authoritative service for Manaus river geography, 3D riverbed bathymetry,
 * shoreline distance fields, water column thickness, and surface elevation.
 *
 * Adapted concepts from:
 * - AskAliceAI/threejs-worldgen (Apache-2.0): riverModifiers channel excavation & shared waterAt queries.
 * - skywalkerqqq/water-three-js (MIT): submerged floor geometry, bathymetric depth & buoyancy coupling.
 *
 * All heights are in meters in the Manaus local ENU reference frame (Y=0 is the coastal land datum).
 * Note: Where real hydrographic sonar surveys are not bundled, bathymetry is marked as a
 * deterministic procedural river channel estimate derived from the real Overture water polygons.
 */

import { Vector3 } from 'three/webgpu';
import { isLand, riverWidth, shoreZ } from '../geodata/geodata';
import { LAND_MASK } from '../geodata/landmask';
import { sampleManausWater, type WaterSurfaceSample } from './ManausHydrology';
import type { WaterFile } from '../../rendering/WaterSystem';

export const MANAUS_RIVER_SURFACE_Y = 0.12;
export const MANAUS_FALLBACK_SURFACE_Y = -0.2;
export const MANAUS_MAX_CHANNEL_DEPTH_M = 52.0;

export type ManausRiverZoneType = 'rio-negro' | 'solimoes' | 'confluence' | 'land';

export interface BathymetryCrossSectionPoint {
  readonly x: number;
  readonly z: number;
  readonly isWater: boolean;
  readonly riverType: ManausRiverZoneType;
  readonly signedShoreDistanceM: number;
  readonly surfaceY: number;
  readonly riverbedY: number;
  readonly depthM: number;
}

export interface PlayerSubmersionState {
  readonly inWater: boolean;
  readonly riverType: ManausRiverZoneType;
  readonly surfaceY: number;
  readonly riverbedY: number;
  readonly totalWaterDepthM: number;
  readonly signedShoreDistanceM: number;
  readonly submergeDepthM: number;
  readonly distanceToBedM: number;
  readonly feetSubmerged: boolean;
  readonly waistSubmerged: boolean;
  readonly chestSubmerged: boolean;
  readonly headSubmerged: boolean;
  readonly completelySubmerged: boolean;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

const _scratchSurfaceSample: WaterSurfaceSample = {
  height: MANAUS_RIVER_SURFACE_Y,
  displacementX: 0,
  displacementZ: 0,
  normal: new Vector3(0, 1, 0),
};

const SHORE_GRID_CELL_M = 150;
const SHORE_BAND_MAX_M = 180;

/**
 * Spatial hash grid indexing polygon bank segments from `water.json` for fast O(1) near-shore queries.
 */
class PolygonShoreIndex {
  private readonly cells = new Map<number, number[]>();
  private readonly segments: number[] = [];
  private loaded = false;

  get isLoaded(): boolean {
    return this.loaded;
  }

  clear(): void {
    this.cells.clear();
    this.segments.length = 0;
    this.loaded = false;
  }

  loadFromWaterFile(file: WaterFile): void {
    this.clear();
    if (!file?.polygons?.length) return;
    for (const poly of file.polygons) {
      for (const ring of poly.rings) {
        for (let i = 0; i < ring.length; i += 2) {
          const ax = ring[i], az = ring[i + 1];
          const bx = ring[(i + 2) % ring.length], bz = ring[(i + 3) % ring.length];
          this.addSegment(ax, az, bx, bz);
        }
      }
    }
    this.loaded = this.segments.length > 0;
  }

  private addSegment(ax: number, az: number, bx: number, bz: number): void {
    const index = this.segments.length;
    this.segments.push(ax, az, bx, bz);
    const fromX = Math.floor(Math.min(ax, bx) / SHORE_GRID_CELL_M);
    const toX = Math.floor(Math.max(ax, bx) / SHORE_GRID_CELL_M);
    const fromZ = Math.floor(Math.min(az, bz) / SHORE_GRID_CELL_M);
    const toZ = Math.floor(Math.max(az, bz) / SHORE_GRID_CELL_M);
    for (let cx = fromX; cx <= toX; cx++) {
      for (let cz = fromZ; cz <= toZ; cz++) {
        const key = (cx + 512) * 4096 + (cz + 512);
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(index);
        else this.cells.set(key, [index]);
      }
    }
  }

  distanceToSegmentBank(x: number, z: number): number {
    if (!this.loaded) return SHORE_BAND_MAX_M;
    const cx = Math.floor(x / SHORE_GRID_CELL_M);
    const cz = Math.floor(z / SHORE_GRID_CELL_M);
    let bestSq = SHORE_BAND_MAX_M * SHORE_BAND_MAX_M;
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iz = cz - 1; iz <= cz + 1; iz++) {
        const bucket = this.cells.get((ix + 512) * 4096 + (iz + 512));
        if (!bucket) continue;
        for (const index of bucket) {
          const ax = this.segments[index], az = this.segments[index + 1];
          const dx = this.segments[index + 2] - ax, dz = this.segments[index + 3] - az;
          const span = dx * dx + dz * dz;
          const t = span > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / span, 0, 1) : 0;
          const ox = ax + dx * t - x, oz = az + dz * t - z;
          const dSq = ox * ox + oz * oz;
          if (dSq < bestSq) bestSq = dSq;
        }
      }
    }
    return Math.sqrt(bestSq);
  }
}

export class ManausBathymetryService {
  private baseSurfaceY = MANAUS_RIVER_SURFACE_Y;
  private readonly polygonIndex = new PolygonShoreIndex();

  /** Sets the active base water surface elevation (e.g. 0.12m when real water is active). */
  setBaseSurfaceY(y: number): void {
    if (Number.isFinite(y)) this.baseSurfaceY = y;
  }

  getBaseSurfaceY(): number {
    return this.baseSurfaceY;
  }

  /** Registers the loaded `water.json` polygons so near-shore bathymetry uses exact bank segments. */
  registerWaterFile(file: WaterFile | null | undefined): void {
    if (file) {
      this.polygonIndex.loadFromWaterFile(file);
    } else {
      this.polygonIndex.clear();
    }
  }

  /**
   * Authoritative water presence predicate.
   * Uses the exact inverse of `isLand(x, z)` so there is zero contradiction with city generation or landmask.
   */
  isWater(x: number, z: number): boolean {
    if (!Number.isFinite(x + z)) return false;
    return !isLand(x, z);
  }

  /**
   * Computes the confluence silt factor in [0, 1]:
   * 0.0 = pure Rio Negro humic blackwater; 1.0 = pure Rio Solimões suspended clay water.
   */
  sampleSiltFactor(x: number, z: number): number {
    return clamp((x - z * 0.21 - 8700) / 700, 0, 1);
  }

  /**
   * Classifies the hydrographic domain at (x, z).
   */
  sampleRiverType(x: number, z: number): ManausRiverZoneType {
    if (!this.isWater(x, z)) return 'land';
    const silt = this.sampleSiltFactor(x, z);
    if (silt <= 0.05) return 'rio-negro';
    if (silt >= 0.95) return 'solimoes';
    return 'confluence';
  }

  /**
   * Signed distance to the shoreline in meters:
   * - Positive (> 0) inside water: distance to nearest land bank/island.
   * - Zero (0) on the shoreline boundary.
   * - Negative (< 0) on land: negative distance to nearest water cell.
   *
   * Guaranteed C0 continuous across the `isLand(x, z)` boundary so the riverbed never forms
   * an artificial vertical cliff at the water's edge.
   */
  sampleSignedShoreDistance(x: number, z: number): number {
    if (!Number.isFinite(x + z)) return -1000;
    const inWater = this.isWater(x, z);

    // Far-field planetary surface outside greater Manaus corridor: open ocean vs inland continent
    if (Math.abs(x) > 45000 || Math.abs(z) > 35000) {
      return inWater ? 10000 : -10000;
    }

    // 1. Generalized analytical channel distance (always available, covers macro channel up to 1500m+)
    const northBankZ = shoreZ(x);
    const southBankZ = northBankZ + riverWidth(x);
    const macroWaterDist = Math.min(z - northBankZ, southBankZ - z);

    // 2. High-consistency LAND_MASK distance to nearest opposite-type cell bounding box
    if (LAND_MASK.ready && LAND_MASK.covers(x, z)) {
      const maxCells = 6; // 6 * 128m = 768m search radius
      let dist = LAND_MASK.distanceToOpposite(x, z, maxCells);

      if (inWater && this.polygonIndex.isLoaded && dist < SHORE_BAND_MAX_M) {
        const polyDist = this.polygonIndex.distanceToSegmentBank(x, z);
        // Blend polygon distance near shore while keeping C0 boundary zero at LAND_MASK edge
        dist = Math.min(dist, polyDist);
      }

      // Beyond the local search window inside the wide Rio Negro, blend smoothly with macro channel distance
      if (inWater && macroWaterDist > dist) {
        const blend = smoothstep((maxCells - 1) * 128, maxCells * 128, dist);
        dist = dist + (macroWaterDist - dist) * blend;
      }

      return inWater ? dist : -dist;
    }

    // Fallback outside LAND_MASK coverage uses the analytical channel distance
    if (inWater) {
      return Math.max(0, macroWaterDist);
    }
    return -Math.abs(macroWaterDist);
  }

  /**
   * Excavated physical 3D riverbed elevation `bedY(x, z)` in meters.
   * - On dry land (`!isWater(x, z)`): returns `0.0 m` (matches `MANAUS_GROUND_COVER_Y`).
   * - At the shoreline (`d = 0 m`): starts continuously at `0.0 m`.
   * - Shallow wading zone (`0..24 m`, extended to ~75m at Praia da Ponta Negra): gentle slope `0.0 m -> -1.85 m`.
   * - Near-shore sandbar shelf (`24..85 m`): slopes `-1.85 m -> -7.5 m`.
   * - Intermediate channel (`85..240 m`): slopes `-7.5 m -> -18.5 m`.
   * - Main thalweg fairway (`240..640 m`): descends `-18.5 m -> -33.0 m`.
   * - Deep authentic Amazon thalweg (`> 640m`): reaches `-42 m -> -50 m` in the central Rio Negro.
   *
   * Procedural bathymetric model calibrated to authentic Amazonian hydrography.
   */
  sampleRiverbedHeight(x: number, z: number): number {
    if (!Number.isFinite(x + z)) return 0;
    if (!this.isWater(x, z)) return 0;

    const d = Math.max(0, this.sampleSignedShoreDistance(x, z));

    // Ponta Negra Beach detection (x ~ -9400, z ~ -7400)
    // The famous Praia da Ponta Negra has a gentle, wide sandy shoal where bathers wade out into the Rio Negro
    const dxPonta = x - (-9400);
    const dzPonta = z - (-7400);
    const distPontaSq = dxPonta * dxPonta + dzPonta * dzPonta;
    const pontaFactor = distPontaSq < 9000000 ? (1.0 - smoothstep(400.0, 3000.0, Math.sqrt(distPontaSq))) : 0.0;

    // Zone 1: Shallow wading bank (0m to 24m, extended up to 74m at Praia da Ponta Negra)
    const wadingWidth = 24.0 + 50.0 * pontaFactor;
    const t1 = clamp(d / wadingWidth, 0, 1);
    const maxWadingDepth = 1.85 - 0.70 * pontaFactor;
    const depth1 = maxWadingDepth * (0.65 * t1 + 0.35 * t1 * t1);

    // Zone 2: Near-shore shelf (24m..wadingWidth to 85m..120m) -> adds up to 5.65m
    const shelfStart = wadingWidth;
    const shelfEnd = 85.0 + 35.0 * pontaFactor;
    const depth2 = 5.65 * smoothstep(shelfStart, shelfEnd, d);

    // Zone 3: Intermediate channel slope (85m to 240m) -> adds up to 11.0m (total ~-18.5m)
    const depth3 = 11.0 * smoothstep(shelfEnd, 240.0, d);

    // Zone 4: Main shipping channel / thalweg (240m to 640m) -> adds up to 14.5m (total -33.0m)
    const depth4 = 14.5 * smoothstep(240.0, 640.0, d);

    // Zone 5: Deep Rio Negro thalweg fairway (> 640m to 1200m) -> authentic Amazon abyss down to -46.0m!
    const silt = this.sampleSiltFactor(x, z);
    const deepAbyssTarget = (1.0 - silt) * 16.0 + silt * 8.0;
    const depth5 = deepAbyssTarget * smoothstep(640.0, 1200.0, d);

    // Deterministic sub-aquatic geomorphology (submerged sandwaves, ridges & thalweg troughs)
    // Attenuated to 0 near the shoreline (d < 12m) so the shoreline seam stays strictly at Y = 0.0m
    const reliefAmp = smoothstep(12.0, 95.0, d);
    const duneWave1 = Math.sin(x * 0.0042 + z * 0.0031) * Math.cos(x * 0.0027 - z * 0.0048) * 1.65;
    const duneWave2 = Math.sin(x * 0.0135 - z * 0.0112) * 0.75;
    const relief = (duneWave1 + duneWave2) * reliefAmp;

    const bedY = -(depth1 + depth2 + depth3 + depth4 + depth5) + relief;
    return Math.min(0, bedY);
  }

  /**
   * Dynamic water surface elevation `surfaceY(x, z, timeSec)` in meters.
   * Matches the TSL vertex displacement in `WaterSystem.ts` including shoreline wave damping.
   */
  sampleWaterSurface(x: number, z: number, timeSec = 0): number {
    if (!Number.isFinite(x + z)) return this.baseSurfaceY;
    const shoreDist = Math.max(0, this.sampleSignedShoreDistance(x, z));
    return sampleManausWater(x, z, timeSec, this.baseSurfaceY, _scratchSurfaceSample, shoreDist).height;
  }

  /**
   * Physical water column thickness `depth = max(0, surfaceY - bedY)` in meters.
   */
  sampleWaterDepth(x: number, z: number, timeSec = 0): number {
    if (!this.isWater(x, z)) return 0;
    const surfaceY = this.sampleWaterSurface(x, z, timeSec);
    const bedY = this.sampleRiverbedHeight(x, z);
    return Math.max(0, surfaceY - bedY);
  }

  /**
   * Analytical surface normal of the 3D riverbed via central differences.
   */
  sampleRiverbedNormal(x: number, z: number, out = new Vector3(0, 1, 0)): Vector3 {
    if (!this.isWater(x, z)) return out.set(0, 1, 0);
    const eps = 2.0;
    const hL = this.sampleRiverbedHeight(x - eps, z);
    const hR = this.sampleRiverbedHeight(x + eps, z);
    const hD = this.sampleRiverbedHeight(x, z - eps);
    const hU = this.sampleRiverbedHeight(x, z + eps);
    const dhdx = (hR - hL) / (2 * eps);
    const dhdz = (hU - hD) / (2 * eps);
    return out.set(-dhdx, 1.0, -dhdz).normalize();
  }

  /**
   * Evaluates complete physical submersion state for a character at `feetPosition` with given `characterHeightM`.
   */
  evaluateSubmersion(feetPosition: Vector3, characterHeightM: number, timeSec = 0): PlayerSubmersionState {
    const x = feetPosition.x;
    const z = feetPosition.z;
    const inWater = this.isWater(x, z);
    const riverType = this.sampleRiverType(x, z);
    const signedShoreDistanceM = this.sampleSignedShoreDistance(x, z);
    const riverbedY = this.sampleRiverbedHeight(x, z);
    const surfaceY = this.sampleWaterSurface(x, z, timeSec);
    const totalWaterDepthM = inWater ? Math.max(0, surfaceY - riverbedY) : 0;

    // How far the character's feet are below the water surface
    const submergeDepthM = inWater ? Math.max(0, surfaceY - feetPosition.y) : 0;
    const distanceToBedM = feetPosition.y - riverbedY;
    const h = Math.max(0.5, characterHeightM);

    const feetSubmerged = inWater && submergeDepthM > 0.05;
    const waistSubmerged = inWater && submergeDepthM >= h * 0.45;
    const chestSubmerged = inWater && submergeDepthM >= h * 0.65;
    const headSubmerged = inWater && submergeDepthM >= h * 0.88;
    const completelySubmerged = inWater && submergeDepthM >= h * 1.02;

    return {
      inWater,
      riverType,
      surfaceY,
      riverbedY,
      totalWaterDepthM,
      signedShoreDistanceM,
      submergeDepthM,
      distanceToBedM,
      feetSubmerged,
      waistSubmerged,
      chestSubmerged,
      headSubmerged,
      completelySubmerged,
    };
  }

  /**
   * Locates the exact shoreline Z coordinate at a given X where `isWater(x, z)` transitions from false to true.
   */
  findShorelineZ(x: number, zMin = 800, zMax = 3000, stepM = 0.5): number {
    const step = Math.max(0.1, stepM);
    for (let z = zMin; z <= zMax; z += step) {
      if (this.isWater(x, z)) return z;
    }
    return shoreZ(x);
  }

  /**
   * High-resolution (0.5m..2m) shoreline profile sampler spanning from dry land across the shoreline
   * into the shallow wading zone and near-shore shelf.
   */
  sampleDenseShorelineProfile(
    x: number,
    landMarginM = 10,
    waterSpanM = 60,
    stepM = 1.0,
    timeSec = 0,
  ): BathymetryCrossSectionPoint[] {
    const bankZ = this.findShorelineZ(x, 800, 3200, 0.5);
    const zStart = bankZ - Math.max(1, landMarginM);
    const zEnd = bankZ + Math.max(2, waterSpanM);
    const steps = Math.max(4, Math.round((zEnd - zStart) / Math.max(0.25, stepM)) + 1);
    return this.sampleCrossSection(x, zStart, zEnd, steps, timeSec);
  }

  /**
   * Technical cross-section sampler across the river for diagnostics and automated tests.
   */
  sampleCrossSection(
    x: number,
    zStart: number,
    zEnd: number,
    steps = 16,
    timeSec = 0,
  ): BathymetryCrossSectionPoint[] {
    const count = Math.max(2, steps);
    const points: BathymetryCrossSectionPoint[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const z = zStart + (zEnd - zStart) * t;
      const inWater = this.isWater(x, z);
      const riverType = this.sampleRiverType(x, z);
      const signedShoreDistanceM = this.sampleSignedShoreDistance(x, z);
      const riverbedY = this.sampleRiverbedHeight(x, z);
      const surfaceY = inWater ? this.sampleWaterSurface(x, z, timeSec) : MANAUS_RIVER_SURFACE_Y;
      const depthM = inWater ? Math.max(0, surfaceY - riverbedY) : 0;
      points.push({
        x,
        z,
        isWater: inWater,
        riverType,
        signedShoreDistanceM,
        surfaceY,
        riverbedY,
        depthM,
      });
    }
    return points;
  }
}

/** Shared singleton authority for Manaus hydrology and riverbed bathymetry. */
export const manausBathymetry = new ManausBathymetryService();
