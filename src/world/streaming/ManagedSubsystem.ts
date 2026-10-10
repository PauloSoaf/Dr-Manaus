import type { StreamingContext } from '../providers/WorldProvider';

/**
 * A subsystem that loads its own content but spends the global budget.
 *
 * The specification is blunt about why this exists rather than a provider: `ManausProvider` "should
 * not pretend to load tiles if the one loading them is `RealCityLayer`". The city has its own
 * streamer, its own job queue and its own geometry pipeline, all of which work; what it does not
 * have is any knowledge of what the rest of the world is spending. Two budgets that never meet do
 * not add up to one budget, they add up to twice one.
 *
 * So the city is not converted into a provider. It is *managed*: it says what it wants, it is
 * granted milliseconds, and it advances by that much. Ownership of individual tiles moves to
 * explicit demands later, one tier at a time, which is phase 2 of the same document.
 */

export interface ManagedDemand {
  /** What the subsystem would like to do, for the scheduler's telemetry and ranking. */
  readonly id: string;
  /** How much work is outstanding, in whatever unit the subsystem counts in. */
  readonly pending: number;
  /** Rough milliseconds it would take to drain it, for a scheduler deciding who to favour. */
  readonly estimatedMs: number;
  /** Physics, a spawn point, ground under the player: served before anything optional. */
  readonly critical: boolean;
}

export interface ManagedStats {
  readonly id: string;
  readonly pending: number;
  readonly grantedMs: number;
}

export interface ManagedSubsystem {
  readonly id: string;
  /** Whether this subsystem is relevant at all right now. */
  covers(context: StreamingContext): boolean;
  plan(context: StreamingContext): readonly ManagedDemand[];
  /** Do up to `budgetMs` of work. The subsystem is trusted to stop; the scheduler cannot stop it. */
  advance(budgetMs: number): void;
  stats(): ManagedStats;
}
