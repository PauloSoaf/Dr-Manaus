import {
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Object3D,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
} from 'three/webgpu';
import { LOCAL_GROUP_CATALOG, isCanonicalGalaxyId } from '../world/celestial/GalaxyDefinition';
import {
  boundedGalaxySector,
  galaxyCosmologicalAddress,
  galaxyDefinition,
  galaxyLocalPositionM,
  orientGalaxyVector,
} from '../world/galaxy/GalaxyCoordinates';
import { DEFAULT_UNIVERSE_SEED } from '../world/galaxy/ProceduralGalaxyDiscovery';
import { cosmologicalSeparationVectorM } from '../world/galaxy/ProceduralGalaxyGenerator';
import { GalaxyPointCloudProvider, resolveGalaxyDescriptor } from '../world/galaxy/GalaxyPointCloudProvider';
import { LIGHT_YEAR_M, type Vec3 } from '../world/spatial/units';
import type { HypercruisePhase, UniversalTransitState } from '../world/travel/UniversalTravelController';
import type { TravelAnchor } from '../world/travel/UniversalTravelPlan';

export interface HypercruisePresentationOptions {
  readonly reducedMotion?: boolean;
}

export interface LocalSuperluminalEffectState {
  readonly kind: 'local-superluminal';
  readonly effectiveSpeedMps: number;
  readonly phase?: HypercruisePhase;
}

export type HypercruisePresentationInput =
  | UniversalTransitState
  | LocalSuperluminalEffectState
  | undefined;

export interface HypercruisePhaseVisualProfile {
  readonly lengthScale: number;
  readonly radialScale: number;
  readonly opacity: number;
  readonly speedScale: number;
  readonly primaryColor: readonly [number, number, number];
  readonly secondaryColor: readonly [number, number, number];
}

export interface HypercruiseVisualSnapshot {
  readonly phase: HypercruisePhase | 'idle';
  readonly domain: 'interstellar' | 'intergalactic' | 'local-superluminal' | 'none';
  readonly lengthScale: number;
  readonly radialScale: number;
  readonly opacity: number;
  readonly speedScale: number;
  readonly color: readonly [number, number, number];
  readonly direction: readonly [number, number, number];
  readonly reducedMotion: boolean;
}

const STREAK_COUNT = 384;
const PROXY_PARTICLE_COUNT = 1024;
const MAX_PROCEDURAL_PROXIES = 8;
const PROXY_SPHERE_DISTANCE_M = 20000;

export function proxyCacheKey(galaxyId: string, universeSeed?: bigint): string {
  if (isCanonicalGalaxyId(galaxyId)) return galaxyId;
  const seed = universeSeed ?? DEFAULT_UNIVERSE_SEED;
  return `${galaxyId}@${seed.toString(16)}`;
}

function isFullTransitState(input: HypercruisePresentationInput): input is UniversalTransitState {
  if (!input || ('kind' in input && input.kind === 'local-superluminal')) return false;
  const candidate = input as Partial<UniversalTransitState>;
  return Boolean(
    candidate.plan &&
      candidate.plan.origin?.address &&
      candidate.plan.destination?.address &&
      Array.isArray(candidate.plan.origin.offsetM) &&
      Array.isArray(candidate.plan.destination.offsetM),
  );
}

function computeAnchorDistancesM(
  origin: TravelAnchor,
  destination: TravelAnchor,
  progress: number,
  distanceTravelledM: number,
  distanceRemainingM: number,
): { originDistM: number; destDistM: number } {
  const safeTravelled = Number.isFinite(distanceTravelledM) && distanceTravelledM >= 0 ? distanceTravelledM : 0;
  const safeRemaining = Number.isFinite(distanceRemainingM) && distanceRemainingM >= 0 ? distanceRemainingM : 0;
  const clampedProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));

  const cosmoA = galaxyCosmologicalAddress(origin.address.galaxyId, origin.universeSeed);
  const cosmoB = galaxyCosmologicalAddress(destination.address.galaxyId, destination.universeSeed);
  if (cosmoA && cosmoB) {
    const sepVec = cosmologicalSeparationVectorM(cosmoA, cosmoB);
    if (sepVec) {
      const defA = galaxyDefinition(origin.address.galaxyId, origin.universeSeed);
      const defB = galaxyDefinition(destination.address.galaxyId, destination.universeSeed);
      const localA: Vec3 =
        defA && boundedGalaxySector(origin.address.sector)
          ? orientGalaxyVector(defA, galaxyLocalPositionM(defA, origin.address.sector, origin.offsetM))
          : [0, 0, 0];
      const localB: Vec3 =
        defB && boundedGalaxySector(destination.address.sector)
          ? orientGalaxyVector(defB, galaxyLocalPositionM(defB, destination.address.sector, destination.offsetM))
          : [0, 0, 0];

      const travelVec: Vec3 = [
        sepVec[0] + localB[0] - localA[0],
        sepVec[1] + localB[1] - localA[1],
        sepVec[2] + localB[2] - localA[2],
      ];
      const obsFromOrigin: Vec3 = [
        travelVec[0] * clampedProgress,
        travelVec[1] * clampedProgress,
        travelVec[2] * clampedProgress,
      ];

      const toOriginCenter: Vec3 = [
        -localA[0] - obsFromOrigin[0],
        -localA[1] - obsFromOrigin[1],
        -localA[2] - obsFromOrigin[2],
      ];
      const toDestCenter: Vec3 = [
        sepVec[0] - localA[0] - obsFromOrigin[0],
        sepVec[1] - localA[1] - obsFromOrigin[1],
        sepVec[2] - localA[2] - obsFromOrigin[2],
      ];

      const dOrig = Math.hypot(toOriginCenter[0], toOriginCenter[1], toOriginCenter[2]);
      const dDest = Math.hypot(toDestCenter[0], toDestCenter[1], toDestCenter[2]);
      if (Number.isFinite(dOrig) && Number.isFinite(dDest)) {
        return {
          originDistM: Math.max(1, dOrig),
          destDistM: Math.max(1, dDest),
        };
      }
    }
  }

  return {
    originDistM: Math.max(1, safeTravelled),
    destDistM: Math.max(1, safeRemaining),
  };
}

function targetPhaseProfile(
  phase: HypercruisePhase,
  domain: 'interstellar' | 'intergalactic' | 'local-superluminal',
  progress: number,
  reducedMotion: boolean,
): HypercruisePhaseVisualProfile {
  const isIntergalactic = domain === 'intergalactic';
  const basePrimary: readonly [number, number, number] = isIntergalactic
    ? [0.68, 0.58, 1.0]
    : [0.52, 0.86, 1.0];
  const baseSecondary: readonly [number, number, number] = isIntergalactic
    ? [0.98, 0.82, 0.54]
    : [0.88, 0.96, 1.0];

  let profile: HypercruisePhaseVisualProfile;
  switch (phase) {
    case 'spool':
      profile = {
        lengthScale: 0.18,
        radialScale: 0.74,
        opacity: 0.48,
        speedScale: 0.16,
        primaryColor: [0.38, 0.88, 1.0],
        secondaryColor: basePrimary,
      };
      break;
    case 'acceleration': {
      const ramp = Math.min(1, Math.max(0, progress / 0.18));
      profile = {
        lengthScale: 0.28 + ramp * 0.82,
        radialScale: 0.76 + ramp * 0.24,
        opacity: 0.56 + ramp * 0.30,
        speedScale: 0.45 + ramp * 0.90,
        primaryColor: basePrimary,
        secondaryColor: baseSecondary,
      };
      break;
    }
    case 'cruise':
      profile = {
        lengthScale: isIntergalactic ? 1.18 : 1.0,
        radialScale: isIntergalactic ? 0.94 : 1.0,
        opacity: isIntergalactic ? 0.88 : 0.82,
        speedScale: isIntergalactic ? 1.25 : 1.0,
        primaryColor: basePrimary,
        secondaryColor: baseSecondary,
      };
      break;
    case 'deceleration':
    case 'emergency-deceleration': {
      const tail = Math.min(1, Math.max(0, (1 - progress) / 0.22));
      profile = {
        lengthScale: 0.22 + tail * 0.65,
        radialScale: 1.0 + (1 - tail) * 0.16,
        opacity: 0.44 + tail * 0.36,
        speedScale: 0.22 + tail * 0.68,
        primaryColor: phase === 'emergency-deceleration' ? [1.0, 0.58, 0.36] : [0.98, 0.82, 0.52],
        secondaryColor: basePrimary,
      };
      break;
    }
    case 'arrival-hold':
      profile = {
        lengthScale: 0.14,
        radialScale: 1.12,
        opacity: 0.42,
        speedScale: 0.08,
        primaryColor: [0.46, 0.94, 0.82],
        secondaryColor: baseSecondary,
      };
      break;
    case 'arrival':
    case 'complete': {
      const fade = Math.min(1, Math.max(0, (1 - progress) / 0.015));
      profile = {
        lengthScale: 0.06 + fade * 0.10,
        radialScale: 1.18,
        opacity: 0.16 + fade * 0.28,
        speedScale: 0.06 + fade * 0.10,
        primaryColor: [0.86, 0.96, 1.0],
        secondaryColor: baseSecondary,
      };
      break;
    }
    case 'coasting':
      profile = {
        lengthScale: 0.08,
        radialScale: 1.08,
        opacity: 0.22,
        speedScale: 0.10,
        primaryColor: [0.64, 0.78, 0.92],
        secondaryColor: [0.48, 0.62, 0.78],
      };
      break;
  }

  if (!reducedMotion) return profile;
  return {
    ...profile,
    lengthScale: Math.min(profile.lengthScale, 0.45),
    opacity: Math.min(profile.opacity, 0.45),
    speedScale: profile.speedScale * 0.25,
  };
}

/**
 * Bounded visual layer for U3/U4 Hypercruise and local superluminal flight.
 * Never mutates physics or canonical UniverseAddress; renders phase-coherent
 * relativistic field streaks and morphologically accurate galaxy proxies (both
 * canonical Local Group and procedural galaxies) within a 20 km camera-relative sphere.
 */
export class HypercruisePresentation {
  readonly root = new Group();
  readonly lines: LineSegments;
  private readonly lineMaterial: LineBasicMaterial;
  private readonly positions = new Float32Array(STREAK_COUNT * 6);
  private readonly colors = new Float32Array(STREAK_COUNT * 6);
  private readonly seeds = new Float32Array(STREAK_COUNT * 4);
  private readonly direction = new Vector3(0, 0, -1);
  private readonly forward = new Vector3(0, 0, -1);
  private readonly targetQuaternion = new Quaternion();
  private readonly galaxies = new Map<string, Points>();
  private readonly proceduralLru: string[] = [];
  private readonly pointCloudProvider = new GalaxyPointCloudProvider();

  reducedMotion: boolean;
  proxyBuildsCount = 0;

  private activePhase: HypercruisePhase | 'idle' = 'idle';
  private activeDomain: 'interstellar' | 'intergalactic' | 'local-superluminal' | 'none' = 'none';
  private smoothedLengthScale = 0.18;
  private smoothedRadialScale = 0.74;
  private smoothedOpacity = 0.0;
  private smoothedSpeedScale = 0.16;
  private smoothedColor: [number, number, number] = [0.52, 0.86, 1.0];
  private smoothedSecondaryColor: [number, number, number] = [0.88, 0.96, 1.0];
  private wasVisible = false;

  constructor(parent: Object3D, options: HypercruisePresentationOptions = {}) {
    this.reducedMotion = Boolean(options.reducedMotion);
    this.root.name = 'universal-hypercruise';
    this.root.visible = false;
    parent.add(this.root);

    for (let i = 0; i < STREAK_COUNT; i++) {
      const a = ((i * 73) % 360) * (Math.PI / 180);
      const r = 160 + ((i * 41) % 1400);
      this.seeds[i * 4] = Math.cos(a) * r;
      this.seeds[i * 4 + 1] = Math.sin(a) * r;
      this.seeds[i * 4 + 2] = -((i * 197) % 16000);
      // Layer weight in [0, 1]: inner fast filaments vs outer deep parallax markers
      this.seeds[i * 4 + 3] = ((i * 29) % 100) / 100;
    }

    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.positions, 3));
    g.setAttribute('color', new BufferAttribute(this.colors, 3));
    this.lineMaterial = new LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.lines = new LineSegments(g, this.lineMaterial);
    this.lines.frustumCulled = false;
    this.root.add(this.lines);

    for (const def of LOCAL_GROUP_CATALOG) {
      this.ensureGalaxyProxy(def.id);
    }
  }

  /**
   * Aligns the hypercruise corridor with the normalized travel direction in render space.
   * Accepts either a Vec3 tuple ([x, y, z]) or a THREE.Vector3-compatible object ({ x, y, z }).
   * Ignores non-finite or zero-length inputs, preserving the current valid orientation.
   */
  setDirection(
    direction: readonly number[] | { readonly x: number; readonly y: number; readonly z: number },
  ): void {
    if (!direction) return;
    let dx: number;
    let dy: number;
    let dz: number;
    if (Array.isArray(direction)) {
      if (direction.length < 3) return;
      dx = direction[0];
      dy = direction[1];
      dz = direction[2];
    } else if ('x' in direction && 'y' in direction && 'z' in direction) {
      dx = direction.x;
      dy = direction.y;
      dz = direction.z;
    } else {
      return;
    }
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz)) {
      return;
    }
    const lenSq = dx * dx + dy * dy + dz * dz;
    if (lenSq < 1e-12) {
      this.direction.copy(this.forward);
    } else {
      const invLen = 1 / Math.sqrt(lenSq);
      this.direction.set(dx * invLen, dy * invLen, dz * invLen);
    }
    this.targetQuaternion.setFromUnitVectors(this.forward, this.direction);
    this.root.quaternion.copy(this.targetQuaternion);
  }

  getDirection(): readonly [number, number, number] {
    return [this.direction.x, this.direction.y, this.direction.z];
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = Boolean(enabled);
  }

  getPhaseVisualState(): HypercruiseVisualSnapshot {
    return {
      phase: this.activePhase,
      domain: this.activeDomain,
      lengthScale: this.smoothedLengthScale,
      radialScale: this.smoothedRadialScale,
      opacity: this.smoothedOpacity,
      speedScale: this.smoothedSpeedScale,
      color: [...this.smoothedColor],
      direction: [this.direction.x, this.direction.y, this.direction.z],
      reducedMotion: this.reducedMotion,
    };
  }

  getGalaxyProxy(galaxyId: string, universeSeed?: bigint): Points | undefined {
    return this.galaxies.get(proxyCacheKey(galaxyId, universeSeed));
  }

  getActiveProxyKeys(): string[] {
    const keys: string[] = [];
    for (const [k, cloud] of this.galaxies) {
      if (cloud.visible) keys.push(k);
    }
    return keys;
  }

  /**
   * Resolves and caches a lightweight morphological galaxy proxy.
   * Returns undefined if the galaxy identity does not resolve to a valid definition,
   * never substituting a fake Milky Way proxy for an unknown galaxy ID.
   */
  ensureGalaxyProxy(galaxyId: string, universeSeed?: bigint): Points | undefined {
    if (!galaxyId) return undefined;
    const key = proxyCacheKey(galaxyId, universeSeed);
    const existing = this.galaxies.get(key);
    if (existing) {
      if (!isCanonicalGalaxyId(galaxyId)) {
        const idx = this.proceduralLru.indexOf(key);
        if (idx >= 0) this.proceduralLru.splice(idx, 1);
        this.proceduralLru.push(key);
      }
      return existing;
    }

    const effectiveSeed = isCanonicalGalaxyId(galaxyId)
      ? undefined
      : (universeSeed ?? DEFAULT_UNIVERSE_SEED);
    const def = galaxyDefinition(galaxyId, effectiveSeed);
    if (!def) {
      return undefined;
    }

    const descriptor = resolveGalaxyDescriptor(def);
    const geo = this.pointCloudProvider.getGeometry(descriptor, 'Low', PROXY_PARTICLE_COUNT);
    this.pointCloudProvider.retain(geo);
    const mat = new PointsMaterial({
      color: 0xffffff,
      vertexColors: true,
      size: descriptor.family === 'elliptical' ? 76 : 68,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });

    const orient: readonly [number, number, number] =
      def.orientationEuler ?? descriptor.orientationEulerRad ?? [0, 0, 0];
    const radiusM = Math.max(1, def.diameterLy * 0.5 * LIGHT_YEAR_M);

    const cloud = new Points(geo, mat);
    cloud.name = `hypercruise-proxy/${key}`;
    cloud.frustumCulled = false;
    cloud.rotation.set(orient[0], orient[1], orient[2], 'XYZ');
    cloud.userData = {
      def,
      descriptor,
      orient,
      radiusM,
      cacheKey: key,
      universeSeed: effectiveSeed,
    };

    if (!isCanonicalGalaxyId(galaxyId)) {
      while (this.proceduralLru.length >= MAX_PROCEDURAL_PROXIES) {
        const oldestKey = this.proceduralLru.shift();
        if (!oldestKey) break;
        const oldCloud = this.galaxies.get(oldestKey);
        if (oldCloud) {
          this.pointCloudProvider.release(oldCloud.geometry);
          (oldCloud.material as PointsMaterial).dispose();
          oldCloud.removeFromParent();
          this.galaxies.delete(oldestKey);
        }
      }
      this.proceduralLru.push(key);
    }

    this.galaxies.set(key, cloud);
    this.root.add(cloud);
    this.proxyBuildsCount++;
    return cloud;
  }

  private hideAllProxies(): void {
    for (const cloud of this.galaxies.values()) {
      cloud.visible = false;
    }
  }

  update(input: HypercruisePresentationInput, camera: Camera, dtS: number): void {
    this.root.visible = Boolean(input);
    if (!input) {
      this.wasVisible = false;
      this.activePhase = 'idle';
      this.activeDomain = 'none';
      this.hideAllProxies();
      return;
    }

    const dt = Math.max(0, Number.isFinite(dtS) ? dtS : 0);
    this.root.position.copy(camera.position);

    const fullTransit = isFullTransitState(input) ? input : undefined;
    const phase: HypercruisePhase = fullTransit ? fullTransit.phase : (input.phase ?? 'cruise');
    const domain: 'interstellar' | 'intergalactic' | 'local-superluminal' = fullTransit
      ? fullTransit.plan.domain
      : 'local-superluminal';
    const progress = fullTransit && Number.isFinite(fullTransit.progress) ? fullTransit.progress : 0.5;

    const target = targetPhaseProfile(phase, domain, progress, this.reducedMotion);

    const blend = !this.wasVisible || dt <= 0 ? 1 : Math.min(1, 1 - Math.exp(-dt * 9.5));
    this.wasVisible = true;
    this.activePhase = phase;
    this.activeDomain = domain;

    this.root.quaternion.slerp(this.targetQuaternion, blend);

    this.smoothedLengthScale += (target.lengthScale - this.smoothedLengthScale) * blend;
    this.smoothedRadialScale += (target.radialScale - this.smoothedRadialScale) * blend;
    this.smoothedOpacity += (target.opacity - this.smoothedOpacity) * blend;
    this.smoothedSpeedScale += (target.speedScale - this.smoothedSpeedScale) * blend;
    for (let c = 0; c < 3; c++) {
      this.smoothedColor[c] += (target.primaryColor[c] - this.smoothedColor[c]) * blend;
      this.smoothedSecondaryColor[c] +=
        (target.secondaryColor[c] - this.smoothedSecondaryColor[c]) * blend;
    }

    this.lineMaterial.opacity = this.smoothedOpacity;

    const baseLen = domain === 'intergalactic' ? 1950 : 1200;
    const len = Math.max(70, baseLen * this.smoothedLengthScale);
    const step = (1500 + len * 5) * this.smoothedSpeedScale * Math.max(0.008, dt);

    for (let i = 0; i < STREAK_COUNT; i++) {
      const layerWeight = this.seeds[i * 4 + 3];
      const layerSpeed = 0.55 + layerWeight * 0.75;
      let z = this.seeds[i * 4 + 2] + step * layerSpeed;
      if (z > -220) z -= 16000;
      this.seeds[i * 4 + 2] = z;

      const radialFactor = this.smoothedRadialScale * (0.82 + layerWeight * 0.36);
      const x = this.seeds[i * 4] * radialFactor;
      const y = this.seeds[i * 4 + 1] * radialFactor;
      const streakLen = len * (0.65 + layerWeight * 0.6);
      const o = i * 6;

      this.positions[o] = x;
      this.positions[o + 1] = y;
      this.positions[o + 2] = z;
      this.positions[o + 3] = x;
      this.positions[o + 4] = y;
      this.positions[o + 5] = Math.max(-19500, z - streakLen);

      const headMix = 0.25 * layerWeight;
      this.colors[o] =
        this.smoothedColor[0] * (1 - headMix) + this.smoothedSecondaryColor[0] * headMix;
      this.colors[o + 1] =
        this.smoothedColor[1] * (1 - headMix) + this.smoothedSecondaryColor[1] * headMix;
      this.colors[o + 2] =
        this.smoothedColor[2] * (1 - headMix) + this.smoothedSecondaryColor[2] * headMix;

      this.colors[o + 3] = this.smoothedSecondaryColor[0] * 0.65;
      this.colors[o + 4] = this.smoothedSecondaryColor[1] * 0.65;
      this.colors[o + 5] = this.smoothedSecondaryColor[2] * 0.65;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;

    // Only intergalactic transit with a full plan renders galaxy proxies
    if (!fullTransit || fullTransit.plan.domain !== 'intergalactic') {
      this.hideAllProxies();
      return;
    }

    const o = fullTransit.plan.origin;
    const d = fullTransit.plan.destination;
    const originKey = proxyCacheKey(o.address.galaxyId, o.universeSeed);
    const destKey = proxyCacheKey(d.address.galaxyId, d.universeSeed);

    this.ensureGalaxyProxy(o.address.galaxyId, o.universeSeed);
    this.ensureGalaxyProxy(d.address.galaxyId, d.universeSeed);

    const { originDistM, destDistM } = computeAnchorDistancesM(
      o,
      d,
      progress,
      fullTransit.distanceTravelledM,
      fullTransit.distanceRemainingM,
    );

    for (const [key, cloud] of this.galaxies) {
      const isOrigin = key === originKey;
      const isDest = key === destKey;

      if (!isOrigin && !isDest) {
        cloud.visible = false;
        continue;
      }
      cloud.visible = true;

      const radiusM = cloud.userData.radiusM as number;
      const orient = cloud.userData.orient as readonly [number, number, number];
      const dist = isDest ? destDistM : originDistM;
      const angular = Math.min(2.4, Math.max(0.05, (radiusM / Math.max(radiusM, dist)) * 14));

      // In root space aligned with setDirection(), destination sits ahead (-Z) and origin recedes behind (+Z)
      cloud.position.set(0, 0, isDest ? -PROXY_SPHERE_DISTANCE_M : PROXY_SPHERE_DISTANCE_M);
      cloud.scale.setScalar(angular * 900);
      cloud.rotation.set(orient[0], orient[1], orient[2], 'XYZ');

      const mat = cloud.material as PointsMaterial;
      if (isDest) {
        const approachBoost = 0.58 + 0.36 * progress;
        const arrivalCrossfade =
          phase === 'arrival'
            ? Math.max(0.28, 1 - ((progress - 0.985) / 0.015) * 0.65)
            : 1.0;
        mat.opacity = Math.min(0.95, approachBoost * arrivalCrossfade);
      } else {
        mat.opacity = Math.max(0.28, 0.85 - 0.45 * progress);
      }
    }
  }

  dispose(): void {
    this.lines.geometry.dispose();
    this.lineMaterial.dispose();
    for (const cloud of this.galaxies.values()) {
      this.pointCloudProvider.release(cloud.geometry);
      (cloud.material as PointsMaterial).dispose();
    }
    this.galaxies.clear();
    this.proceduralLru.length = 0;
    this.pointCloudProvider.dispose();
    this.root.removeFromParent();
  }
}
export type { ProceduralGalaxyDescriptor };
