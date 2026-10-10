# Streaming: one queue for the universe

Implements `07-STREAMING-HLOD-AND-CACHE.md`. Code: `src/world/streaming/`,
`src/world/runtime/ProviderRegistry.ts`, `src/world/providers/WorldProvider.ts`.
Tests: `tests/streaming.test.ts` (9), `tests/universe-runtime.test.ts` (6).

**Status: implemented, under test, and driving the globe.** `FEATURES.planetStreaming` is off, so
the city still streams through its own `WorldStreamer`; the new scheduler runs with the Earth
provider only.

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

## The order of the stages

```
plan → rank → track → activate → fetch → retire
```

**Activation comes before fetching**, and that is load-bearing rather than tidy. The other order
looks natural and starves the world: planning and fetching run first, spend the frame's
milliseconds, and activation is then asked for permission it can never get. Measured, with a
provider that generates its tiles synchronously: ninety-six tiles decoded, cached, reported ready
— and zero of them in the scene, frame after frame.

Frame time is also a soft limit for the first activation of a frame only. A machine slow enough
never to have a spare millisecond would otherwise never populate its world at all: one small tile
is a hitch, an empty planet is a bug. The hard limits — the per-frame cap and the memory ceiling —
are never crossed.

## Priority

Distance alone is not enough: a tile 4 km ahead matters more than one 1 km behind, and a tile
behind the camera matters less than either. Demands are ranked by

- screen-space error — how wrong the screen is without it,
- **the view cone** — the angle between the tile and where the camera is actually looking,
- travel relevance — `PrefetchPredictor` tracks a smoothed direction of movement,
- time to contact — seconds until the player arrives at current velocity,
- gameplay criticality — physics, spawn points, a teleport destination,
- provider priority — the ownership order above.

Criticality is weighted at 100, large enough that nothing else can add up to it. Critical does not
mean "important"; it means physics the player is about to touch. It is not weighed against detail.

The view term needs the camera, and for a while it did not have one: `StreamingContext.camera
.forward` was derived from **velocity**. A player hovering and looking straight down has no
velocity at all, so the priorities pointed at the horizon while the player stared at the ground.
`UniverseRuntime.update` now takes the camera's own direction and falls back to travel.

## Budget

`StreamingLedger` caps every stage, because nothing in the system is allowed to answer "load
everything":

| Budget | Default |
| --- | --- |
| Main-thread time per frame | 4 ms |
| Concurrent fetches | 6 |
| Worker jobs | 4 |
| Heavy activations per frame | 2 |
| Light activations per frame | 12 |
| Light activation threshold | 64 KB |
| GPU upload per frame | 8 MB |
| GPU memory, soft / hard | 512 MB / 768 MB |

**Two activation classes, because two kinds of work.** A city block is hundreds of kilobytes of
merged geometry with colliders behind it; an ellipsoid patch is a 17×17 grid of about thirteen
kilobytes and nothing else. Holding both to two per frame left the planet arriving a couple of
tiles at a time with the budget unspent. The specification anticipates this exactly: *"tiles
planetários muito leves podem ter classe diferente."*

At speed the light allowance is **not** scaled down. Light tiles are the coarse ground ahead of the
player, which is what speed needs more of; it is the heavy city work that gives way.

These match the budgets the city already ran to, so the new scheduler cannot be a regression by
construction.

`budgetForSpeed` scales them with travel speed. At high speed fine detail is wasted work — it
arrives after the player has passed it — so concurrency rises and fine detail falls.

> **Two bugs worth remembering, both the same shape: a system that reported healthy and loaded
> nothing.**
>
> `beginFrame()` originally took a timestamp from the caller while the ledger measured elapsed time
> from its own clock. The two disagreed, every frame looked over-budget, nothing activated.
>
> And planning was never budgeted. `EarthProvider.plan` measured **2.34 ms** at orbital altitude —
> more than half the streaming budget for the whole world — re-derived sixty times a second for a
> camera that had not moved. It is now memoised against camera movement, the quality context and a
> replan interval: **0.01 ms**. A selection changes when the camera moves a quarter of the finest
> tile it chose, not when the clock ticks.

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

## Cancellation and bookkeeping

Tracking what was asked for is separate from starting fetches, because starting fetches is allowed
to stop early when the budget runs out. A tile that was wanted but not reached must still count as
wanted, or `retireUnwanted` throws away the far half of the plan every frame and re-plans it the
next one.

Fetching also respects the frame clock, not just the concurrency cap. A provider that generates
rather than downloads returns an already-resolved promise, so its whole cost lands on this thread
inside that loop.

## What is not wired

- `ManausProvider` does not exist. Wrapping `RealCityLayer`, `WorldStreamer`, `HLODManager` and
  the landmarks into one provider is the next piece of this phase, and it is what lets the two
  budgets stop being independent.
- The scheduler has no worker pool of its own; `GenerationPool` is still the city's.
