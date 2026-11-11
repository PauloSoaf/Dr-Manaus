import { Vector3 } from 'three/webgpu';
import {
  MANAUS_FRAME_ID,
  EARTH_FIXED_FRAME_ID,
  legacyLocalToEcef,
  ecefToLegacyLocal,
  geodeticToLegacyLocal,
  legacyLocalToGeodetic,
} from '../spatial/ManausFrameAdapter';
import { MANAUS_COVERAGE } from '../providers/EarthProvider';
import { regionContains } from '../providers/WorldProvider';
import { UniverseRuntime } from '../runtime/UniverseRuntime';
import { TravelDomain } from './TravelDomain';
import type { TeleportTarget, CosmologicalAddress } from '../spatial/UniverseLocation';
import { UniverseCoordinates } from '../spatial/UniverseCoordinates';
import {
  intersectEarthWGS84,
  intersectMoonSurface,
  intersectMarsSurface,
  MOON_RADIUS_M,
  MARS_RADIUS_EQUATORIAL_M,
} from '../spatial/AnalyticalSurfaceIntersection';
import { pickCelestialBodyFromRay } from './CelestialAngularPicker';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { referenceFrame } from '../spatial/ReferenceFrame';
import { enuBasis } from '../spatial/ENU';
import { geodeticToEcef } from '../spatial/ECEF';
import {
  quatFromBasis,
  degToRad,
  radToDeg,
  scaleVec3,
  cloneVec3,
  type Vec3,
} from '../spatial/units';
import { sectorIndex, type UniverseAddress } from '../spatial/UniverseAddress';
import {
  universalTargetKey,
  createUniversalTarget,
  type UniversalNavigationTarget,
  type UniversalTargetDescriptor,
} from './UniversalNavigationTarget';
import { UniversalTargetCatalog, SOLAR_TARGET_ADDRESS } from './UniversalTargetCatalog';
import { UniversalTargetResolver } from './UniversalTargetResolver';
import { resolveCosmologicalAnchorArrival } from '../cosmology/CosmologicalNavigation';
import { schwarzschildRadiusM } from '../celestial/BlackHoleDescriptor';
import type { Collider } from '../../core/types';

export const LOCAL_AIM_RAYCAST_M = 2500;
const MAX_DYNAMIC_SURFACE_FRAMES = 32;

export interface UniversalTeleportServiceContext {
  universe: UniverseRuntime;
  travelDomain: TravelDomain;
  player: {
    position: Vector3 | { x: number; y: number; z: number };
    velocity: Vector3 | { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
    teleport(position: { x: number; y: number; z: number }): void;
    size?: number;
    powerPose?(pose: string, duration?: number): void;
  };
  getColliders?: () => readonly Collider[];
  prepareManaus?: (destination: { x: number; y: number; z: number }) => Promise<void>;
  prepareSystem?: (target: UniversalNavigationTarget) => { commit: () => void };
  notify?: (message: string) => void;
  sound?: (name: string) => void;
  burstVfx?: (pos: { x: number; y: number; z: number }) => void;
  targetCatalog?: UniversalTargetCatalog;
  targetResolver?: UniversalTargetResolver;
}

export type TeleportResolutionKind =
  | 'local-collider'
  | 'surface-geodetic'
  | 'body-orbit'
  | 'system-position'
  | 'cosmic-sector'
  | 'cosmological'
  | 'catalog-object';

export interface TeleportResolution {
  readonly kind: TeleportResolutionKind;
  readonly displayName: string;
  readonly target?: TeleportTarget;
  readonly localDestination?: Vector3;
}

export interface TeleportResult {
  readonly success: boolean;
  readonly message: string;
  readonly target?: TeleportTarget;
  readonly transitionKind: 'local' | 'interplanetary' | 'cosmic';
}

export class UniversalTeleportService {
  private currentAbortController: AbortController | null = null;
  private armedTarget: TeleportTarget | null = null;
  private readonly dynamicFrames: string[] = [];
  public isTeleporting = false;

  constructor(private readonly context: UniversalTeleportServiceContext) {}

  armTarget(target: TeleportTarget | null): void {
    this.armedTarget = target;
  }

  getArmedTarget(): TeleportTarget | null {
    return this.armedTarget;
  }

  /**
   * Resolves target from camera ray according to the strict 4-stage hierarchy:
   * 1. loaded local collider (LOCAL_AIM_RAYCAST_M = 2500 m)
   * 2. active-body analytical surface (Earth WGS84, Moon sphere, Mars)
   * 3. celestial angular target (from celestial runtime)
   * 4. armed map/coordinate target
   */
  resolveFromAim(
    rayOrigin: Vector3,
    rayDirection: Vector3,
    colliders: readonly Collider[] = this.context.getColliders?.() ?? [],
  ): TeleportResolution | null {
    // Stage 1: Loaded local collider
    const localHit = PhysicsWorld.raycast(rayOrigin, rayDirection, colliders, LOCAL_AIM_RAYCAST_M, 0, true);
    if (localHit) {
      const dest = new Vector3().copy(localHit.point);
      if (localHit.collider) {
        dest.y = localHit.collider.y + localHit.collider.height / 2 + 0.08;
      } else {
        dest.y = localHit.point.y + 0.08;
      }
      return {
        kind: 'local-collider',
        displayName: 'Superfície local',
        localDestination: dest,
      };
    }

    const { universe } = this.context;
    const currentFrame = universe.player.frame;

    // Stage 2: Active-body analytical surface
    const dominantBody = universe.telemetry.dominantBody;
    const isEarthActive = dominantBody === 'earth' || currentFrame === MANAUS_FRAME_ID || currentFrame.startsWith('earth/');

    if (isEarthActive && universe.frames.has(currentFrame) && universe.frames.has(EARTH_FIXED_FRAME_ID)) {
      const originVec: Vec3 = [rayOrigin.x, rayOrigin.y, rayOrigin.z];
      const dirVec: Vec3 = [rayDirection.x, rayDirection.y, rayDirection.z];

      const originEcef = universe.frames.convertPosition(currentFrame, EARTH_FIXED_FRAME_ID, originVec);
      const dirEcef = universe.frames.convertDirection(currentFrame, EARTH_FIXED_FRAME_ID, dirVec);

      const earthHit = intersectEarthWGS84(originEcef, dirEcef);
      if (earthHit) {
        const latDeg = radToDeg(earthHit.geodetic.latRad);
        const lonDeg = radToDeg(earthHit.geodetic.lonRad);

        // Check if falls in Manaus coverage
        if (regionContains(MANAUS_COVERAGE, latDeg, lonDeg)) {
          const legacyPoint = ecefToLegacyLocal({
            xM: earthHit.pointEcef[0],
            yM: earthHit.pointEcef[1],
            zM: earthHit.pointEcef[2],
          });
          return {
            kind: 'local-collider',
            displayName: `Manaus (${latDeg.toFixed(3)}°, ${lonDeg.toFixed(3)}°)`,
            localDestination: new Vector3(legacyPoint[0], legacyPoint[1] + 2.0, legacyPoint[2]),
          };
        }

        return {
          kind: 'surface-geodetic',
          displayName: `Terra (${latDeg.toFixed(3)}°, ${lonDeg.toFixed(3)}°)`,
          target: {
            kind: 'surface-geodetic',
            galaxyId: 'milky_way',
            systemId: 'sol',
            bodyId: 'earth',
            latDeg,
            lonDeg,
            altitudeM: 2.0,
          },
        };
      }
    } else if (dominantBody === 'moon' && universe.frames.has(currentFrame) && universe.frames.has('moon/fixed')) {
      const originVec: Vec3 = [rayOrigin.x, rayOrigin.y, rayOrigin.z];
      const dirVec: Vec3 = [rayDirection.x, rayDirection.y, rayDirection.z];
      const originMoon = universe.frames.convertPosition(currentFrame, 'moon/fixed', originVec);
      const dirMoon = universe.frames.convertDirection(currentFrame, 'moon/fixed', dirVec);
      const moonHit = intersectMoonSurface(originMoon, dirMoon);
      if (moonHit) {
        const r = Math.hypot(...moonHit.point);
        const latDeg = radToDeg(Math.asin(moonHit.point[1] / Math.max(1, r)));
        const lonDeg = radToDeg(Math.atan2(moonHit.point[0], moonHit.point[2]));
        return {
          kind: 'surface-geodetic',
          displayName: `Lua (${latDeg.toFixed(2)}°, ${lonDeg.toFixed(2)}°)`,
          target: {
            kind: 'surface-geodetic',
            galaxyId: 'milky_way',
            systemId: 'sol',
            bodyId: 'moon',
            latDeg,
            lonDeg,
            altitudeM: 2.0,
          },
        };
      }
    }

    // Stage 3: Celestial angular target from celestial runtime
    if (universe.frames.has(currentFrame) && universe.frames.has(universe.activeSystem.systemFrameId)) {
      const originVec: Vec3 = [rayOrigin.x, rayOrigin.y, rayOrigin.z];
      const dirVec: Vec3 = [rayDirection.x, rayDirection.y, rayDirection.z];
      const obsSys = universe.frames.convertPosition(currentFrame, universe.activeSystem.systemFrameId, originVec);
      const dirSys = universe.frames.convertDirection(currentFrame, universe.activeSystem.systemFrameId, dirVec);

      const celestialPick = pickCelestialBodyFromRay(
        universe.activeSystem,
        obsSys,
        dirSys,
        15 * Math.PI / 180,
        dominantBody,
      );

      if (celestialPick) {
        if (celestialPick.bodyId === 'moon') {
          return {
            kind: 'surface-geodetic',
            displayName: `Lua (Superfície)`,
            target: {
              kind: 'surface-geodetic',
              galaxyId: 'milky_way',
              systemId: 'sol',
              bodyId: 'moon',
              latDeg: 0,
              lonDeg: 0,
              altitudeM: 2.0,
            },
          };
        }
        if (celestialPick.bodyId === 'mars') {
          return {
            kind: 'body-orbit',
            displayName: `Marte (Órbita Segura 250 km)`,
            target: {
              kind: 'body-orbit',
              galaxyId: 'milky_way',
              systemId: 'sol',
              bodyId: 'mars',
              altitudeM: 250_000,
            },
          };
        }
        if (celestialPick.bodyId === 'sun') {
          return {
            kind: 'body-orbit',
            displayName: `Sol (Fotosfera Segura)`,
            target: {
              kind: 'body-orbit',
              galaxyId: 'milky_way',
              systemId: 'sol',
              bodyId: 'sun',
              altitudeM: 50_000_000,
            },
          };
        }
        return {
          kind: 'body-orbit',
          displayName: `${celestialPick.name} (Órbita)`,
          target: {
            kind: 'body-orbit',
            galaxyId: 'milky_way',
            systemId: 'sol',
            bodyId: celestialPick.bodyId,
            altitudeM: 100_000,
          },
        };
      }
    }

    // Stage 4: Armed map / coordinate target
    if (this.armedTarget) {
      return {
        kind: this.armedTarget.kind,
        displayName: 'Destino armado',
        target: this.armedTarget,
      };
    }

    return null;
  }

  /**
   * Main entry point for universal teleport.
   * Can be invoked with a TeleportTarget, a URI string, or plain coordinates.
   */
  async teleport(
    targetOrUri: TeleportTarget | string | Vector3,
    signal?: AbortSignal,
  ): Promise<TeleportResult> {
    // Cancel previous in-flight teleport
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();
    const effectiveSignal = signal ?? this.currentAbortController.signal;

    this.isTeleporting = true;
    try {
      let resolvedTarget: TeleportTarget | Vector3;

      if (targetOrUri instanceof Vector3) {
        resolvedTarget = targetOrUri;
      } else if (typeof targetOrUri === 'string') {
        const parsed = this.parseTargetString(targetOrUri);
        if (!parsed) {
          throw new Error(`Destino inválido: "${targetOrUri}"`);
        }
        resolvedTarget = parsed;
      } else {
        resolvedTarget = targetOrUri;
      }

      if (effectiveSignal.aborted) {
        return { success: false, message: 'Teleporte cancelado.', transitionKind: 'local' };
      }

      // Pre-teleport VFX / Sound
      const playerPos = this.context.player.position;
      this.context.sound?.('teleport');
      this.context.burstVfx?.(playerPos);
      this.context.player.powerPose?.('teleport', 0.8);

      let result: TeleportResult;
      if (resolvedTarget instanceof Vector3) {
        result = await this.executeLocalTeleport(resolvedTarget, effectiveSignal);
      } else {
        result = await this.executeUniversalTarget(resolvedTarget, effectiveSignal);
      }

      if (result.success) {
        this.context.sound?.('teleport');
        this.context.burstVfx?.(this.context.player.position);
        this.context.notify?.(result.message);
      }

      return result;
    } catch (error) {
      if (effectiveSignal.aborted) {
        return { success: false, message: 'Teleporte anterior abortado.', transitionKind: 'local' };
      }
      const message = error instanceof Error ? error.message : String(error);
      this.context.notify?.(`Falha no teleporte: ${message}`);
      return { success: false, message, transitionKind: 'local' };
    } finally {
      this.isTeleporting = false;
    }
  }

  private parseTargetString(input: string): TeleportTarget | Vector3 | null {
    const trimmed = input.trim();
    if (trimmed.startsWith('drm:v1://')) {
      return UniverseCoordinates.parse(trimmed);
    }

    // Try parsing as "lat, lon" or "lat, lon, alt"
    const coordParts = trimmed.split(/[\s,]+/).map(Number);
    if (coordParts.length >= 2 && coordParts.every(Number.isFinite)) {
      const [lat, lon, alt] = coordParts;
      if (lat >= -90 && lat <= 90 && lon >= -360 && lon <= 360) {
        return {
          kind: 'surface-geodetic',
          galaxyId: 'milky_way',
          systemId: 'sol',
          bodyId: 'earth',
          latDeg: lat,
          lonDeg: lon,
          altitudeM: Number.isFinite(alt) ? alt : 2.0,
        };
      }
    }

    // Sgr A* alias support
    if (trimmed === 'sgr_a_star' || trimmed === 'sgra') {
      return { kind: 'catalog-object', id: 'sgra' };
    }

    // Check catalog lookup
    if (this.context.targetCatalog) {
      const desc = this.context.targetCatalog.target(trimmed);
      if (desc) {
        return UniverseCoordinates.fromTargetDescriptor(desc);
      }
    }

    return null;
  }

  private async executeLocalTeleport(destination: Vector3, signal: AbortSignal): Promise<TeleportResult> {
    if (signal.aborted) throw new Error('Teleporte abortado');

    await this.context.prepareManaus?.(destination);
    if (signal.aborted) throw new Error('Teleporte abortado');

    const colliders = this.context.getColliders?.() ?? [];
    const playerSize = this.context.player.size ?? 1.0;
    const safe = PhysicsWorld.safeLanding(destination, colliders, 0.34 * playerSize, 2.1 * playerSize);

    // Atomic commit
    this.context.travelDomain.reset();
    this.context.universe.setPlayerPose(MANAUS_FRAME_ID, [safe.x, safe.y, safe.z]);
    this.context.player.teleport(safe);
    this.context.player.velocity.set(0, 0, 0);

    return {
      success: true,
      message: 'Salto local concluído.',
      transitionKind: 'local',
    };
  }

  private async executeUniversalTarget(target: TeleportTarget, signal: AbortSignal): Promise<TeleportResult> {
    const { universe, travelDomain } = this.context;

    switch (target.kind) {
      case 'surface-geodetic': {
        const bodyId = target.bodyId;

        if (bodyId === 'earth') {
          // Check if in compiled Manaus coverage
          if (regionContains(MANAUS_COVERAGE, target.latDeg, target.lonDeg)) {
            const legacyPoint = geodeticToLegacyLocal({
              latRad: degToRad(target.latDeg),
              lonRad: degToRad(target.lonDeg),
              heightM: target.altitudeM,
            });
            const dest = new Vector3(legacyPoint[0], legacyPoint[1] + 2.0, legacyPoint[2]);
            return this.executeLocalTeleport(dest, signal);
          }

          // Earth outside Manaus: generate local ENU surface frame
          const frameId = this.ensureDynamicSurfaceFrame(target.latDeg, target.lonDeg);

          // Atomic commit for arbitrary Earth coordinates
          travelDomain.reset();
          const targetPos: Vec3 = [0, target.altitudeM, 0];
          universe.setPlayerPose(frameId, targetPos);
          universe.address = {
            galaxyId: 'milky_way',
            sector: sectorIndex(0n, 0n, 0n),
            systemId: 'sol',
            bodyId: 'earth',
            childFrame: frameId,
          };
          universe.floatingOrigin.reset(universe.player);
          this.context.player.teleport({ x: 0, y: target.altitudeM, z: 0 });
          this.context.player.velocity.set(0, 0, 0);

          return {
            success: true,
            message: `Chegada à Terra (${target.latDeg.toFixed(2)}°, ${target.lonDeg.toFixed(2)}°)`,
            target,
            transitionKind: 'local',
          };
        }

        if (bodyId === 'moon') {
          if (!universe.frames.has('moon/fixed')) {
            throw new Error('Frame lunar indisponível.');
          }

          travelDomain.reset();
          const moonRadius = MOON_RADIUS_M;
          const targetPos: Vec3 = [0, moonRadius + target.altitudeM, 0];
          universe.setPlayerPose('moon/fixed', targetPos);
          universe.address = {
            galaxyId: 'milky_way',
            sector: sectorIndex(0n, 0n, 0n),
            systemId: 'sol',
            bodyId: 'moon',
            childFrame: 'moon/fixed',
          };
          universe.floatingOrigin.reset(universe.player);
          this.context.player.teleport({ x: 0, y: target.altitudeM, z: 0 });
          this.context.player.velocity.set(0, 0, 0);

          return {
            success: true,
            message: `Chegada à superfície da Lua`,
            target,
            transitionKind: 'local',
          };
        }

        throw new Error(`Superfície não suportada para o corpo "${bodyId}"`);
      }

      case 'body-orbit': {
        const bodyId = target.bodyId;
        const body = universe.activeSystem.bodies.find(b => b.id === bodyId);
        if (!body) {
          throw new Error(`Corpo celeste "${bodyId}" não encontrado no sistema ativo.`);
        }

        const bodyPos = universe.activeSystem.positionOf(bodyId) ?? [0, 0, 0];
        const orbitRadius = body.equatorialRadiusM + target.altitudeM;
        const barycentricPos: Vec3 = [bodyPos[0], bodyPos[1] + orbitRadius, bodyPos[2]];

        // Atomic commit
        universe.updateSystemPose(barycentricPos, [0, 0, 0], 0);
        universe.address = {
          galaxyId: universe.address.galaxyId,
          sector: universe.address.sector,
          systemId: universe.address.systemId,
          bodyId,
        };
        travelDomain.enterSystem({
          systemId: universe.address.systemId!,
          positionM: barycentricPos,
          velocityMps: [0, 0, 0],
          referenceBodyId: bodyId,
        });
        this.context.player.teleport({ x: 0, y: 0, z: 0 });
        this.context.player.velocity.set(0, 0, 0);

        return {
          success: true,
          message: `Órbita estabelecida em ${body.name ?? bodyId} (+${Math.round(target.altitudeM / 1000)} km)`,
          target,
          transitionKind: 'interplanetary',
        };
      }

      case 'system-position': {
        const pos = target.positionM;
        universe.updateSystemPose(pos, [0, 0, 0], 0);
        universe.address = {
          galaxyId: target.galaxyId ?? universe.address.galaxyId,
          sector: universe.address.sector,
          systemId: target.systemId,
        };
        travelDomain.enterSystem({
          systemId: target.systemId,
          positionM: pos,
          velocityMps: [0, 0, 0],
        });
        this.context.player.teleport({ x: 0, y: 0, z: 0 });
        this.context.player.velocity.set(0, 0, 0);

        return {
          success: true,
          message: `Salto concluído no sistema ${target.systemId}`,
          target,
          transitionKind: 'interplanetary',
        };
      }

      case 'cosmic-sector': {
        universe.address = {
          galaxyId: target.galaxyId,
          sector: target.sector,
          systemId: undefined,
        };
        universe.updateSystemPose(target.offsetM, [0, 0, 0], 0);
        universe.address = {
          galaxyId: target.galaxyId,
          sector: target.sector,
          systemId: undefined,
        };
        travelDomain.enterSystem({
          systemId: 'interstellar',
          positionM: target.offsetM,
          velocityMps: [0, 0, 0],
        });
        this.context.player.teleport({ x: 0, y: 0, z: 0 });
        this.context.player.velocity.set(0, 0, 0);

        return {
          success: true,
          message: `Salto interestelar para setor [${target.sector.x}, ${target.sector.y}, ${target.sector.z}]`,
          target,
          transitionKind: 'cosmic',
        };
      }

      case 'cosmological': {
        const distMpc = target.address.comovingDistanceM
          ? (target.address.comovingDistanceM / 3.085677581491367e22).toFixed(1)
          : '—';
        universe.address = {
          galaxyId: 'milky_way',
          sector: sectorIndex(0n, 0n, 0n),
        };
        universe.updateSystemPose([0, 0, 0], [0, 0, 0], 0);
        travelDomain.enterSystem({
          systemId: 'cosmological',
          positionM: [0, 0, 0],
          velocityMps: [0, 0, 0],
        });
        this.context.player.teleport({ x: 0, y: 0, z: 0 });
        this.context.player.velocity.set(0, 0, 0);

        return {
          success: true,
          message: `Chegada cosmológica: distância comóvel ${distMpc} Mpc`,
          target,
          transitionKind: 'cosmic',
        };
      }

      case 'catalog-object': {
        if (!this.context.targetCatalog) {
          throw new Error('Catálogo de alvos não disponível.');
        }
        const queryId = target.id === 'sgr_a_star' ? 'sgra' : target.id;
        const desc = this.context.targetCatalog.target(queryId) ?? this.context.targetCatalog.target(target.id);
        if (!desc) {
          throw new Error(`Objeto "${target.id}" não encontrado no catálogo.`);
        }

        // Black-hole default policy: safe observation distance (6 * r_s)
        if (desc.kind === 'black-hole') {
          const massSolar = (desc.objectId === 'sgr_a_star' || desc.objectId === 'sgra') ? 4.154e6 : 10;
          const massKg = massSolar * 1.98847e30;
          const rs = schwarzschildRadiusM(massKg);
          const safeObservationDistanceM = Math.max(6 * rs, 100_000);

          universe.address = {
            galaxyId: desc.galaxyId ?? 'milky_way',
            sector: desc.address && 'sector' in desc.address ? desc.address.sector : sectorIndex(0n, 0n, 0n),
          };
          const obsPos: Vec3 = [0, 0, safeObservationDistanceM];
          universe.updateSystemPose(obsPos, [0, 0, 0], 0);
          travelDomain.enterSystem({
            systemId: 'black-hole-orbit',
            positionM: obsPos,
            velocityMps: [0, 0, 0],
          });
          this.context.player.teleport({ x: 0, y: 0, z: 0 });
          this.context.player.velocity.set(0, 0, 0);

          return {
            success: true,
            message: `Aproximação segura a buraco negro (${desc.displayName}) a 6 rs`,
            target,
            transitionKind: 'cosmic',
          };
        }

        const converted = UniverseCoordinates.fromTargetDescriptor(desc);
        return this.executeUniversalTarget(converted, signal);
      }
    }
  }

  /**
   * Generates or retrieves an ENU surface reference frame at arbitrary Earth geodetic coordinates.
   * Enforces bounded memory by evicting older dynamic frames from the ReferenceFrameGraph.
   */
  private ensureDynamicSurfaceFrame(latDeg: number, lonDeg: number): string {
    const frameId = `earth/surface/${latDeg.toFixed(4)}_${lonDeg.toFixed(4)}`;
    const { frames } = this.context.universe;

    if (frames.has(frameId)) {
      return frameId;
    }

    // Bounded memory enforcement
    if (this.dynamicFrames.length >= MAX_DYNAMIC_SURFACE_FRAMES) {
      const oldest = this.dynamicFrames.shift()!;
      frames.remove(oldest);
    }

    const anchorEcef = geodeticToEcef({
      latRad: degToRad(latDeg),
      lonRad: degToRad(lonDeg),
      heightM: 0,
    });

    const basis = enuBasis({
      latRad: degToRad(latDeg),
      lonRad: degToRad(lonDeg),
      heightM: 0,
    });

    const south = scaleVec3(cloneVec3(basis.north), -1, [0, 0, 0]);
    const rotationToParent = quatFromBasis(cloneVec3(basis.east), cloneVec3(basis.up), south);

    frames.register(
      referenceFrame({
        id: frameId,
        parentId: EARTH_FIXED_FRAME_ID,
        kind: 'surface-enu',
        originInParent: [anchorEcef.xM, anchorEcef.yM, anchorEcef.zM],
        rotationToParent,
        label: `Terra (${latDeg.toFixed(2)}°, ${lonDeg.toFixed(2)}°)`,
      }),
    );

    this.dynamicFrames.push(frameId);
    return frameId;
  }
}
