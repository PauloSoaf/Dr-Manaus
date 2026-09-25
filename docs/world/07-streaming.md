# Streaming: one queue for the universe

Implements `07-STREAMING-HLOD-AND-CACHE.md`. Code: `src/world/streaming/`,
`src/world/runtime/ProviderRegistry.ts`, `src/world/providers/WorldProvider.ts`.
Tests: `tests/streaming.test.ts` (9), `tests/universe-runtime.test.ts` (6).

**Status: implemented and under test. `FEATURES.planetStreaming` is off**, so the city still
streams through its own `WorldStreamer` and the new scheduler runs with the Earth provider only
(and only when the globe flag is on).

## Providers and ownership

Exactly one provider owns a channel — terrain, water, roads, buildings, vegetation, landmarks,
physics — at any point, and the highest fidelity wins:

```
authored landmark  >  compiled real city  >  procedural filler  >  generic planet terrain
```

This formalises a rule the game already followed in three separate places
(`RealCityLayer.replacesChunk`, `replacesCollider`, `HLOD.setRealCoverage`). Writing it down once
is what stops a second Manaus appearing underneath the real one now that a planet provider exists.

A provider implements five methods and nothing else:

| Method | Contract |
| --- | --- |
| `covers(context)` | is this provider relevant here at all |
| `plan(context)` | what it would like loaded, as `TileDemand[]` — it does not decide when |
| `load(demand, signal)` | fetch or generate; **must honour the `AbortSignal`** |
| `activate(payload, frame)` | put it in the world, returning a disposable `ActiveTile` |
| `deactivate(tile)` | take it out |

Planning is separated from scheduling on purpose: a provider that could both ask and act would
have no budget.

## Tile keys

One union across all three kinds, each with a `kind` prefix in its string form:

```ts
{ kind: 'manaus',      tx, tz }
{ kind: 'planet',      bodyId, face, level, x, y }
{ kind: 'star-sector', galaxyId, level, sector }
```

They share a cache. Without the prefix, a collision would put a city block in a galaxy — and the
first symptom would be a missing building somewhere else entirely.

## Priority

Distance alone is not enough: a tile 4 km ahead matters more than one 1 km behind. Demands are
ranked by

- screen-space error — how wrong the screen is without it,
- view-cone relevance — `PrefetchPredictor` tracks a smoothed travel direction,
- time to contact — seconds until the player arrives at current velocity,
- gameplay criticality — physics, spawn points, a teleport destination jump the queue,
- provider priority — the ownership order above.

## Budget

`StreamingLedger` caps every stage, because nothing in the system is allowed to answer "load
everything":

| Budget | Default |
| --- | --- |
| Main-thread time per frame | 4 ms |
| Concurrent fetches | 6 |
| Worker jobs | 4 |
| Heavy activations per frame | 2 |
| GPU upload per frame | 8 MB |
| GPU memory, soft / hard | 512 MB / 768 MB |

These match the budgets the city already ran to, so the new scheduler cannot be a regression by
construction.

`budgetForSpeed` scales them with travel speed. At high speed fine detail is wasted work — it
arrives after the player has passed it — so concurrency rises and fine detail falls.

> **Bug worth remembering.** `beginFrame()` originally took a timestamp from the caller while the
> ledger measured elapsed time from its own clock. The two disagreed, every frame looked
> over-budget, and nothing ever activated — a system that was "working" and loading nothing. It now
> reads one clock.

## Cancellation

A teleport, a frame change or `invalidate()` bumps a **generation**. In-flight fetches are aborted
through their `AbortController`, and any result that still lands is dropped rather than put into
the world — arriving late is not the same as being wanted.

This is what makes a fast flight survivable: without it, every tile requested along a path is still
queued behind the player minutes later.

## Cache

`TileCache` is LRU with **pinning**. The tile under the player and a critical destination are
pinned and cannot be evicted, because evicting the ground you are standing on is a visible hole
rather than a cache miss. Everything else ages out by byte budget and by entry count.

The rule the specification insists on, and the implementation keeps: **the parent stays visible
until the child is ready.** A failed tile leaves the parent in place rather than a hole.

## What is not wired

- `ManausProvider` does not exist. Wrapping `RealCityLayer`, `WorldStreamer`, `HLODManager` and
  the landmarks into one provider is the next piece of this phase, and it is what lets the two
  budgets stop being independent.
- The scheduler has no worker pool of its own; `GenerationPool` is still the city's.
