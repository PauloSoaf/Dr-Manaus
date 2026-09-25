import type { ActiveReferenceFrame } from '../spatial/ReferenceFrame';
import { finite, subVec3, type Vec3 } from '../spatial/units';
import type { StreamingContext, WorldProvider } from '../providers/WorldProvider';
import type { ProviderRegistry } from '../runtime/ProviderRegistry';
import { PrefetchPredictor } from './PrefetchPredictor';
import { StreamingLedger } from './StreamingBudget';
import { TileCache } from './TileCache';
import {
  type ActiveTile, type TileDemand, type TilePayload, type TileState, tileKeyToString,
  type WorldTileKey,
} from './TileDemand';

interface TrackedTile {
  readonly id: string;
  key: WorldTileKey;
  providerId: string;
  demand: TileDemand;
  state: TileState;
  /** The scheduler generation this work belongs to. Older results are dropped on arrival. */
  generation: number;
  controller?: AbortController;
  payload?: TilePayload;
  active?: ActiveTile;
  failures: number;
  lastSeenFrame: number;
}

export interface SchedulerOptions {
  cache?: TileCache;
  predictor?: PrefetchPredictor;
  ledger?: StreamingLedger;
  /** Attempts before a tile is left alone. A hole is better than a fetch storm. */
  maxFailures?: number;
}

/**
 * One queue for the whole universe.
 *
 * Providers say what they want; this decides what the frame can afford. Distance alone does not
 * rank tiles — a tile straight ahead at 4 km matters more than one behind at 1 km, and one the
 * player reaches in half a second matters more than either — so the ranking folds in visual
 * error, the view cone, time to contact, gameplay criticality and provider priority.
 *
 * Two properties are load-bearing:
 *
 *   - **Nothing is allowed to answer "load everything."** Every stage is capped by the ledger.
 *   - **Obsolete work is cancelled, not awaited.** Turning around or teleporting bumps the
 *     generation; fetches from an older one are aborted, and any that still land are dropped.
 */
export class GlobalStreamingScheduler {
  private readonly tiles = new Map<string, TrackedTile>();
  private readonly cache: TileCache;
  private readonly predictor: PrefetchPredictor;
  private readonly ledger: StreamingLedger;
  private readonly maxFailures: number;
  private generation = 0;
  private frame = 0;
  private activationsLastFrame = 0;

  constructor(private readonly registry: ProviderRegistry, options: SchedulerOptions = {}) {
    this.cache = options.cache ?? new TileCache();
    this.predictor = options.predictor ?? new PrefetchPredictor();
    this.ledger = options.ledger ?? new StreamingLedger();
    this.maxFailures = Math.max(1, finite(options.maxFailures, 3));
  }

  get stats() {
    let active = 0, fetching = 0, readyCpu = 0, failed = 0;
    for (const tile of this.tiles.values()) {
      if (tile.state === 'active') active++;
      else if (tile.state === 'fetching') fetching++;
      else if (tile.state === 'ready-cpu') readyCpu++;
      else if (tile.state === 'failed') failed++;
    }
    return {
      tracked: this.tiles.size, active, fetching, readyCpu, failed,
      activationsLastFrame: this.activationsLastFrame,
      generation: this.generation,
      cache: this.cache.stats,
      cpuBytes: this.ledger.cpuBytes,
      gpuBytes: this.ledger.gpuBytes,
    };
  }

  get tileCache(): TileCache { return this.cache; }
  get prefetch(): PrefetchPredictor { return this.predictor; }

  /**
   * Invalidates outstanding work. Called on teleport and on a reference frame change, where what
   * was being fetched is no longer anywhere near the player.
   */
  invalidate(): void {
    this.generation++;
    for (const tile of this.tiles.values()) {
      if (tile.state === 'fetching' || tile.state === 'queued') {
        tile.controller?.abort();
        tile.controller = undefined;
        tile.state = tile.payload ? 'ready-cpu' : 'unloaded';
      }
    }
    this.predictor.reset();
  }

  /** One frame. Plan, rank, fetch, activate, retire — each inside its own budget. */
  update(context: StreamingContext, dtS: number): void {
    this.frame++;
    this.ledger.setBudget(context.budget);
    this.ledger.beginFrame();
    this.cache.tick(dtS);
    this.activationsLastFrame = 0;

    const player = context.spatial.player.position;
    this.predictor.update(player, context.spatial.localVelocityMps, dtS);

    const demands = this.collectDemands(context);
    this.rank(demands, context, player);
    this.startFetches(demands);
    this.activateReady(context.spatial.frame);
    this.retireUnwanted(demands);
  }

  /** Gathers every provider's plan, deduplicating by key and keeping the highest priority claim. */
  private collectDemands(context: StreamingContext): TileDemand[] {
    const byKey = new Map<string, TileDemand>();
    for (const provider of this.registry.active(context.spatial)) {
      let planned: readonly TileDemand[] = [];
      try {
        planned = provider.plan(context);
      } catch (error) {
        console.error(`Provider "${provider.id}" failed to plan`, error);
        continue;
      }
      for (const demand of planned) {
        const id = tileKeyToString(demand.key);
        const existing = byKey.get(id);
        // Providers are visited highest priority first, so the first claim on a key wins.
        if (!existing) byKey.set(id, demand);
      }
    }
    return [...byKey.values()];
  }

  /**
   * Scores and sorts. The weights are deliberately plain numbers rather than a tuned black box:
   * every term is something a person can reason about when a tile arrives late.
   */
  private rank(demands: TileDemand[], context: StreamingContext, player: Vec3): void {
    const offset: Vec3 = [0, 0, 0];
    for (const demand of demands) {
      const provider = this.registry.get(demand.providerId);
      // Visual error against the target: a tile twice over budget is worth twice as much.
      const errorTerm = Math.min(8, demand.screenSpaceError / Math.max(1, context.quality.sseTargetPx));
      // Where it is relative to travel. Tiles behind the player are worth a fraction.
      const relevance = this.relevanceOf(demand, player, offset);
      // Arriving before the player does is the whole point of prefetching.
      const contactTerm = Number.isFinite(demand.timeToContactS)
        ? Math.max(0, 3 - demand.timeToContactS)
        : 0;
      const criticality = demand.gameplayCritical ? 10 : 0;
      const providerTerm = (provider?.priority ?? 0) / 100;
      const cachedTerm = this.cache.has(demand.key) ? 2 : 0;

      demand.priority = errorTerm * 3 + relevance * 4 + contactTerm * 2 + criticality + providerTerm + cachedTerm;
    }
    demands.sort((a, b) => b.priority - a.priority);
  }

  /** A tile with no known centre is treated as neutrally placed rather than guessed at. */
  private relevanceOf(demand: TileDemand, player: Vec3, scratch: Vec3): number {
    if (!demand.centreM) return 0.5;
    subVec3([demand.centreM[0], demand.centreM[1], demand.centreM[2]], player, scratch);
    return this.predictor.relevance(scratch);
  }

  /** Starts as many fetches as the budget allows, best first. Cached tiles skip straight ahead. */
  private startFetches(demands: readonly TileDemand[]): void {
    for (const demand of demands) {
      const id = tileKeyToString(demand.key);
      let tile = this.tiles.get(id);
      if (!tile) {
        tile = {
          id, key: demand.key, providerId: demand.providerId, demand,
          state: 'unloaded', generation: this.generation, failures: 0, lastSeenFrame: this.frame,
        };
        this.tiles.set(id, tile);
      }
      tile.demand = demand;
      tile.lastSeenFrame = this.frame;

      if (tile.state === 'active' || tile.state === 'fetching' || tile.state === 'activating') continue;
      if (tile.state === 'failed' && tile.failures >= this.maxFailures) continue;

      // A cached payload needs no network and no worker; it only needs to be put back in.
      const cached = this.cache.get(demand.key);
      if (cached) {
        tile.payload = cached;
        tile.state = 'ready-cpu';
        tile.generation = this.generation;
        continue;
      }
      if (tile.state === 'ready-cpu') continue;
      if (!this.ledger.canFetch) break;

      const provider = this.registry.get(demand.providerId);
      if (!provider) { tile.state = 'failed'; tile.failures++; continue; }
      this.beginFetch(tile, provider, demand);
    }
  }

  private beginFetch(tile: TrackedTile, provider: WorldProvider, demand: TileDemand): void {
    const controller = new AbortController();
    const generation = this.generation;
    tile.controller = controller;
    tile.state = 'fetching';
    tile.generation = generation;
    this.ledger.fetchStarted();

    provider.load(demand, controller.signal).then(payload => {
      this.ledger.fetchFinished();
      // Dropped rather than applied: the world moved on while this was in flight.
      if (generation !== this.generation || controller.signal.aborted) {
        tile.state = 'unloaded';
        tile.controller = undefined;
        return;
      }
      tile.payload = payload;
      tile.state = 'ready-cpu';
      tile.controller = undefined;
      this.cache.set(payload);
    }).catch(error => {
      this.ledger.fetchFinished();
      tile.controller = undefined;
      if (generation !== this.generation || controller.signal.aborted) {
        tile.state = 'unloaded';
        return;
      }
      tile.failures++;
      tile.state = 'failed';
      // A failed tile is a gap, not a crash. It is retried until `maxFailures`, then left alone
      // so one bad tile cannot turn into a fetch storm.
      console.warn(`Tile ${tile.id} failed to load (attempt ${tile.failures})`, error);
    });
  }

  /** Puts decoded tiles into the world, strictly within the frame's activation budget. */
  private activateReady(frame: ActiveReferenceFrame): void {
    const ready = [...this.tiles.values()]
      .filter(tile => tile.state === 'ready-cpu' && tile.payload)
      .sort((a, b) => b.demand.priority - a.demand.priority);

    for (const tile of ready) {
      const payload = tile.payload!;
      if (!this.ledger.canActivate(payload.estimatedGpuBytes)) break;
      const provider = this.registry.get(tile.providerId);
      if (!provider) { tile.state = 'failed'; continue; }
      tile.state = 'activating';
      try {
        tile.active = provider.activate(payload, frame);
        tile.state = 'active';
        this.ledger.activated(payload.cpuBytes, payload.estimatedGpuBytes);
        this.activationsLastFrame++;
      } catch (error) {
        tile.state = 'failed';
        tile.failures++;
        console.error(`Tile ${tile.id} failed to activate`, error);
      }
    }
  }

  /**
   * Removes tiles nobody asked for this frame.
   *
   * The parent-stays-visible rule lives in the providers, not here: this only retires what fell
   * out of every plan, and a provider that still wants its coarse parent keeps asking for it.
   */
  private retireUnwanted(demands: readonly TileDemand[]): void {
    const wanted = new Set(demands.map(demand => tileKeyToString(demand.key)));
    for (const tile of this.tiles.values()) {
      if (wanted.has(tile.id)) continue;
      if (tile.state === 'fetching') {
        tile.controller?.abort();
        tile.controller = undefined;
        tile.state = 'unloaded';
        continue;
      }
      if (tile.state === 'active' && tile.active) {
        const provider = this.registry.get(tile.providerId);
        try {
          provider?.deactivate(tile.active);
        } catch (error) {
          console.error(`Tile ${tile.id} failed to deactivate`, error);
        }
        this.ledger.deactivated(tile.payload?.cpuBytes ?? 0, tile.payload?.estimatedGpuBytes ?? 0);
        tile.active = undefined;
        tile.state = tile.payload ? 'dormant' : 'unloaded';
      }
      // The payload stays in the cache so flying back does not refetch; the tracker itself goes.
      if (tile.state === 'dormant' || tile.state === 'unloaded') this.tiles.delete(tile.id);
    }
  }

  /** Tears everything down. Used on shutdown and when switching worlds entirely. */
  dispose(): void {
    for (const tile of this.tiles.values()) {
      tile.controller?.abort();
      if (tile.active) {
        try {
          this.registry.get(tile.providerId)?.deactivate(tile.active);
        } catch (error) {
          console.error(`Tile ${tile.id} failed to deactivate during dispose`, error);
        }
      }
    }
    this.tiles.clear();
    this.cache.clear();
    this.ledger.reset();
  }
}
