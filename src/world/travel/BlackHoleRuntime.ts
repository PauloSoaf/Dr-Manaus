import type { Vec3 } from '../spatial/units';
import { SECTOR_SIZE_M, type SectorIndex } from '../spatial/UniverseAddress';
import {
  type BlackHoleDescriptor, SAGITTARIUS_A_STAR, M31_CENTRAL_BLACK_HOLE, SPEED_OF_LIGHT,
} from '../celestial/BlackHoleDescriptor';
import {
  applyBlackHoleDynamics, evaluateBlackHoleProximity, type BlackHoleProximityState,
} from '../celestial/BlackHoleGravity';
import type { BlackHoleTransitController, BlackHoleTransitDestination } from './BlackHoleTransitNetwork';

/** Galaxy-frame position of a player at `systemPositionM` inside the system of `sector`. */
export function galacticPositionM(sector: SectorIndex, systemPositionM: Vec3): Vec3 {
  return [
    Number(sector.x) * SECTOR_SIZE_M + systemPositionM[0],
    Number(sector.y) * SECTOR_SIZE_M + systemPositionM[1],
    Number(sector.z) * SECTOR_SIZE_M + systemPositionM[2],
  ];
}

/** Central black hole of a galaxy, or undefined. */
export function centralBlackHoleFor(galaxyId: string): BlackHoleDescriptor | undefined {
  if (galaxyId === 'milky_way') return SAGITTARIUS_A_STAR;
  if (galaxyId === 'andromeda') return M31_CENTRAL_BLACK_HOLE;
  return undefined;
}

export interface BlackHoleRuntimeStep {
  readonly proximity?: BlackHoleProximityState;
  /** Velocity delta to add (m/s) in the same frame as the input velocity; zero when unaffected. */
  readonly nextPositionM?: Vec3;
  readonly nextVelocityMps?: Vec3;
  /** Set on the frame the horizon is crossed and a transit has just been reserved. */
  readonly transitStarted?: BlackHoleTransitDestination;
}

/**
 * Live gameplay glue: evaluates the active galaxy's black hole while in cosmic space.
 * Never acts while local (Manaus ENU) physics is active or during a transit.
 */
export class BlackHoleRuntime {
  proximity?: BlackHoleProximityState;
  private source?: BlackHoleDescriptor;

  constructor(readonly transit: BlackHoleTransitController, readonly universeSeed: bigint) {}

  step(opts: {
    localPhysicsActive: boolean;
    galaxyId: string;
    sector: SectorIndex;
    systemPositionM: Vec3;
    systemVelocityMps: Vec3;
    dt: number;
    blackHole?: BlackHoleDescriptor;
  }): BlackHoleRuntimeStep {
    const bh = opts.blackHole ?? centralBlackHoleFor(opts.galaxyId);
    if (opts.localPhysicsActive || !bh || this.transit.active) {
      this.proximity = undefined;
      return {};
    }
    const galPos = galacticPositionM(opts.sector, opts.systemPositionM);
    const prox = evaluateBlackHoleProximity(galPos, bh);
    this.proximity = prox;
    if (prox.zone === 'distant') return { proximity: prox };
    if (prox.isCaptured) {
      this.source = bh;
      const transitStarted = this.transit.startTransit(this.universeSeed, bh);
      return { proximity: prox, transitStarted };
    }
    const dyn = applyBlackHoleDynamics(galPos, opts.systemVelocityMps, opts.dt, bh);
    const dv: Vec3 = [
      dyn.nextVelocityMps[0] - opts.systemVelocityMps[0],
      dyn.nextVelocityMps[1] - opts.systemVelocityMps[1],
      dyn.nextVelocityMps[2] - opts.systemVelocityMps[2],
    ];
    const speed = Math.hypot(...dyn.nextVelocityMps);
    const capped = speed > SPEED_OF_LIGHT * 0.999 ? SPEED_OF_LIGHT * 0.999 / speed : 1;
    return {
      proximity: prox,
      nextVelocityMps: [
        opts.systemVelocityMps[0] + dv[0] * capped, opts.systemVelocityMps[1] + dv[1] * capped,
        opts.systemVelocityMps[2] + dv[2] * capped,
      ],
    };
  }

  /** Called by the game after the destination was installed and the player is outside its horizon. */
  confirmEmergence(): number | undefined {
    const n = this.transit.commitTransit();
    this.transit.reset();
    this.source = undefined;
    return n;
  }

  /** Called when destination preparation fails: nothing persists, control returns. */
  failTransit(): void {
    this.transit.abortTransit();
    this.source = undefined;
  }
}

