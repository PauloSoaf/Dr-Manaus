import type { Vec3 } from '../spatial/units';
import { SPEED_OF_LIGHT } from '../celestial/BlackHoleDescriptor';
import {
  type BlackHoleDescriptor,
  SAGITTARIUS_A_STAR,
  M31_CENTRAL_BLACK_HOLE,
  getCanonicalBlackHole,
  generateStellarBlackHole,
} from '../celestial/BlackHoleDescriptor';
import {
  createUniversalTarget,
  universalTargetKey,
  type UniversalNavigationTarget,
} from './UniversalNavigationTarget';
import { sectorIndex } from '../spatial/UniverseAddress';
import type { UniversalTargetCatalog } from './UniversalTargetCatalog';
import type { SaveManager } from '../../core/SaveManager';

/**
 * Phase of black hole interior wormhole transit.
 */
export type BlackHoleTransitPhase =
  | 'idle'
  | 'event-horizon-entry'
  | 'wormhole-tunnel'
  | 'destination-emergence'
  | 'completed';

/**
 * Resolved emergence destination through a black hole wormhole throat.
 */
export interface BlackHoleTransitDestination {
  readonly sourceBlackHoleId: string;
  readonly traversalIndex: number;
  readonly exitTarget: UniversalNavigationTarget;
  readonly exitBlackHole?: BlackHoleDescriptor;
  readonly emergencePositionM: Vec3;
  readonly emergenceVelocityMps: Vec3;
  readonly safeClearanceDistanceM: number;
  readonly transitDurationS: number;
  readonly description: string;
}

/**
 * 32-bit deterministic integer hash for network destination routing.
 */
function hashRouting(str: string, seed: bigint, counter: number): number {
  let h = 0x811c9dc5;
  const s = `${str}:${seed.toString(16)}:${counter}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Resolves the deterministic cosmic exit destination for a traversal through a black hole.
 * Guarantees that the emergence position is strictly and safely outside the destination's horizon.
 */
export function resolveBlackHoleTransitExit(
  universeSeed: bigint,
  sourceBlackHole: BlackHoleDescriptor,
  traversalCounter: number,
  catalog: UniversalTargetCatalog
): BlackHoleTransitDestination {
  const isSgrA = sourceBlackHole.id === 'sgra' || sourceBlackHole.id === 'sagittarius-a-star';
  const isM31 = sourceBlackHole.id === 'm31_smbh';

  let exitTarget: UniversalNavigationTarget;
  let exitBh: BlackHoleDescriptor | undefined;
  let description = '';

  if (isSgrA) {
    // Sgr A* Routing Table
    const routeIndex = traversalCounter % 3;
    if (routeIndex === 0) {
      // Primary Einstein-Rosen Bridge: Milky Way Core -> Andromeda Core
      exitBh = M31_CENTRAL_BLACK_HOLE;
      const m31Desc = catalog.find('m31_smbh')!;
      exitTarget = createUniversalTarget(m31Desc);
      description = 'Ponte Einstein-Rosen: Travessia Intergaláctica Direta Via Láctea → Andrômeda';
    } else if (routeIndex === 1) {
      // Cosmological Wormhole Throat -> Norma Cluster Anchor
      const normaDesc = catalog.find('norma_cluster') ?? catalog.find('observable-horizon')!;
      exitTarget = createUniversalTarget(normaDesc);
      description = 'Fenda de Gravidade Extrema: Ejeção no Superaglomerado de Norma (Grande Atrator)';
    } else {
      // Ejection into remote outer stellar sector in Milky Way
      const sector = sectorIndex(500n, 12n, -8n);
      const star = catalog.proceduralTarget('milky_way', sector, 'milky_way/500,12,-8/0', 'star');
      exitTarget = star ?? createUniversalTarget(catalog.find('milky_way')!);
      description = 'Ruptura Espacial Secundária: Ejeção no Braço Externo da Via Láctea';
    }
  } else if (isM31) {
    // Andromeda SMBH Routing Table
    const routeIndex = traversalCounter % 2;
    if (routeIndex === 0) {
      // Return bridge: Andromeda -> Milky Way Core
      exitBh = SAGITTARIUS_A_STAR;
      const sgraDesc = catalog.find('sgra')!;
      exitTarget = createUniversalTarget(sgraDesc);
      description = 'Ponte Einstein-Rosen Retorno: Andrômeda → Sagittarius A*';
    } else {
      // Ejection into outer Andromeda disk
      const sector = sectorIndex(200n, 0n, 0n);
      const star = catalog.proceduralTarget('andromeda', sector, 'andromeda/200,0,0/0', 'star');
      exitTarget = star ?? createUniversalTarget(catalog.find('andromeda')!);
      description = 'Dobra Relativística: Ejeção no Disco Externo de Andrômeda';
    }
  } else {
    // Procedural Stellar Black Hole Routing
    const routingHash = hashRouting(sourceBlackHole.id, universeSeed, traversalCounter);
    const targetGalaxy = (routingHash % 2 === 0) ? 'milky_way' : 'andromeda';
    const secX = BigInt((routingHash % 800) - 400);
    const secY = BigInt(((routingHash >> 4) % 800) - 400);
    const secZ = BigInt(((routingHash >> 8) % 200) - 100);
    const sector = sectorIndex(secX, secY, secZ);

    const sbhCandidate = generateStellarBlackHole(targetGalaxy, sector);
    if (sbhCandidate) {
      exitBh = sbhCandidate;
      exitTarget = createUniversalTarget({
        kind: 'black-hole',
        displayName: sbhCandidate.name,
        objectId: sbhCandidate.id,
        galaxyId: targetGalaxy,
        address: { galaxyId: targetGalaxy, sector },
      });
      description = `Salto de Rede de Singularidades: ${sourceBlackHole.name} → ${sbhCandidate.name}`;
    } else {
      // Fallback: ejection near central galaxy SMBH
      exitBh = (targetGalaxy === 'milky_way') ? SAGITTARIUS_A_STAR : M31_CENTRAL_BLACK_HOLE;
      const desc = catalog.find(exitBh.id)!;
      exitTarget = createUniversalTarget(desc);
      description = `Trânsito Quântico Estelar: Reemissão no Campo Central de ${targetGalaxy === 'milky_way' ? 'Milky Way' : 'Andromeda'}`;
    }
  }

  // Safe emergence geometry:
  // Emergence point must be positioned safely outside the destination's horizon:
  // r_emergence = max(6 * rs, 50_000 m) along the +Z escape pole
  const rs = exitBh ? exitBh.schwarzschildRadiusM : 50_000;
  const safeClearance = Math.max(rs * 6.0, 50_000);

  const emergencePositionM: Vec3 = exitBh
    ? [exitBh.positionM[0], exitBh.positionM[1], exitBh.positionM[2] + safeClearance]
    : [0, 0, safeClearance];

  // Outward directed safe escape velocity vector (0.2 c) directed away from the black hole
  const safeSpeed = SPEED_OF_LIGHT * 0.2;
  const emergenceVelocityMps: Vec3 = [0, 0, safeSpeed];

  return {
    sourceBlackHoleId: sourceBlackHole.id,
    traversalIndex: traversalCounter,
    exitTarget,
    exitBlackHole: exitBh,
    emergencePositionM,
    emergenceVelocityMps,
    safeClearanceDistanceM: safeClearance,
    transitDurationS: 6.0, // 6 seconds of cinematic higher-dimensional spacetime transit
    description,
  };
}

/**
 * Controller managing black hole wormhole transit, higher-dimensional tunnel progress,
 * and safe emergence handoff.
 */
export class BlackHoleTransitController {
  phase: BlackHoleTransitPhase = 'idle';
  progress01 = 0;
  elapsedS = 0;
  currentDestination?: BlackHoleTransitDestination;

  constructor(
    readonly catalog: UniversalTargetCatalog,
    readonly saveManager?: SaveManager
  ) {}

  get active(): boolean {
    return this.phase !== 'idle' && this.phase !== 'completed';
  }

  /**
   * Initiates a black hole transit sequence upon event horizon crossing.
   */
  startTransit(
    universeSeed: bigint,
    sourceBlackHole: BlackHoleDescriptor
  ): BlackHoleTransitDestination {
    const traversalCount = this.saveManager
      ? this.saveManager.recordBlackHoleTraversal(sourceBlackHole.id)
      : 1;

    const destination = resolveBlackHoleTransitExit(
      universeSeed,
      sourceBlackHole,
      traversalCount,
      this.catalog
    );

    this.currentDestination = destination;
    this.phase = 'event-horizon-entry';
    this.progress01 = 0;
    this.elapsedS = 0;

    return destination;
  }

  /**
   * Advances transit simulation through entry, tunnel, and emergence phases.
   */
  update(dt: number): {
    phase: BlackHoleTransitPhase;
    progress01: number;
    completed: boolean;
    destination?: BlackHoleTransitDestination;
  } {
    if (!this.active || !this.currentDestination) {
      return { phase: this.phase, progress01: this.progress01, completed: false };
    }

    this.elapsedS += dt;
    const totalDuration = this.currentDestination.transitDurationS;
    this.progress01 = Math.min(1.0, this.elapsedS / totalDuration);

    // Phase schedule
    if (this.elapsedS < 1.5) {
      this.phase = 'event-horizon-entry';
    } else if (this.elapsedS < totalDuration - 1.5) {
      this.phase = 'wormhole-tunnel';
    } else if (this.elapsedS < totalDuration) {
      this.phase = 'destination-emergence';
    } else {
      this.phase = 'completed';
    }

    const isComplete = this.phase === 'completed';
    return {
      phase: this.phase,
      progress01: this.progress01,
      completed: isComplete,
      destination: this.currentDestination,
    };
  }

  /**
   * Resets controller to idle after emergence has committed to the destination runtime.
   */
  reset(): void {
    this.phase = 'idle';
    this.progress01 = 0;
    this.elapsedS = 0;
    this.currentDestination = undefined;
  }
}
