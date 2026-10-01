import type { RealCityLayer } from '../realcity/RealCityLayer';
import type { StreamingContext } from './WorldProvider';
import type { ManagedDemand, ManagedStats, ManagedSubsystem } from '../streaming/ManagedSubsystem';
import { regionContains, type SpatialRegion } from './WorldProvider';
import { legacyLocalToGeodetic, MANAUS_FRAME_ID } from '../spatial/ManausFrameAdapter';
import { radToDeg } from '../spatial/units';

/**
 * Manaus, as a subsystem of the global budget.
 *
 * Deliberately not a `WorldProvider`. The specification says in as many words that a provider here
 * "should not pretend to load tiles if the one loading them is `RealCityLayer`" -- and it is. The
 * city has a streamer, a job queue and a geometry pipeline that all work; what it lacked was any
 * knowledge of what the rest of the world was spending, so it took a fixed 3.5 ms whatever the
 * planet was doing and both called themselves within budget.
 *
 * This is the phase 1 adapter from that document: the city reports what it wants, the scheduler
 * grants it milliseconds, and it advances by that much. Ownership of individual tiers -- shell
 * tiles, near cells, procedural chunks, HLOD, landmarks -- becomes explicit demands in phase 2,
 * one at a time, and none of that has to happen before the budgets stop double counting.
 */

/** The city's own footprint, with margin. Outside it the subsystem has nothing to ask for. */
const MANAUS_REGION: SpatialRegion = {
  bodyId: 'earth',
  minLatDeg: -3.55, maxLatDeg: -2.71,
  minLonDeg: -60.45, maxLonDeg: -59.61,
};

/** Above this there is no city to build, whatever the coordinates say. */
const CEILING_M = 40_000;

export class ManausSubsystem implements ManagedSubsystem {
  readonly id = 'manaus/city';

  constructor(private readonly city: RealCityLayer) {}

  covers(context: StreamingContext): boolean {
    if (context.spatial.bodyId !== 'earth' || context.spatial.player.frame !== MANAUS_FRAME_ID) return false;
    const local = context.spatial.player.position;
    const geodetic = legacyLocalToGeodetic(local[0], local[1], local[2]);
    if (geodetic.heightM > CEILING_M) return false;
    return regionContains(MANAUS_REGION, radToDeg(geodetic.latRad), radToDeg(geodetic.lonRad));
  }

  plan(): readonly ManagedDemand[] {
    const pending = this.city.pendingBuildings;
    if (pending === 0) return [];
    return [{
      id: 'manaus/buildings',
      pending,
      // Measured against the city's own pipeline: roughly a building every three microseconds.
      estimatedMs: pending * 0.003,
      // Ground the player is standing on is not optional, and the near tier is what carries
      // collision. Everything else can wait for a quieter frame.
      critical: this.city.awaitingNearGeometry,
    }];
  }

  /**
   * Spends the grant on the next update.
   *
   * The city builds inside its own `update`, which the game calls in its own order; handing it a
   * budget here rather than calling into it keeps that order intact and keeps this adapter from
   * becoming a second place the city is driven from.
   */
  advance(budgetMs: number): void {
    this.city.grantedBuildMs = budgetMs;
  }

  stats(): ManagedStats {
    return { id: this.id, pending: this.city.pendingBuildings, grantedMs: this.city.grantedBuildMs };
  }
}
