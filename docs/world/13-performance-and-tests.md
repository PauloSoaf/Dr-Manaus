# Performance budgets and test strategy

Implements `13-PERFORMANCE-BUDGETS.md` and `14-TEST-STRATEGY.md`.

## Budgets

Performance here is an architectural requirement, not a final optimisation pass. The budgets are
enforced by `StreamingLedger` (`src/world/streaming/StreamingBudget.ts`) rather than being advice
in a document:

| Budget | Default | Where it came from |
| --- | --- | --- |
| Frame target | 16.67 ms (60 FPS) | the specification's desktop target |
| Streaming main-thread time | 4 ms | the limit the city already ran to |
| Concurrent fetches | 6 | spec suggests 4 as an initial default; sized against the city's existing behaviour |
| Worker jobs | 4 | one per likely core after the main thread |
| Heavy activations per frame | 2 | the city's existing cap |
| Light activations per frame | 12 | the spec's separate class for light planetary tiles |
| Light activation threshold | 64 KB | a tile mesh is ~13 KB; a city block is hundreds |
| GPU upload per frame | 8 MB | keeps one activation from stalling a frame |
| GPU memory, soft / hard | 512 MB / 768 MB | spec telemetry targets, unvalidated on real hardware |
| Additional planetary bootstrap | ≤ 12 MB compressed | currently 86 KB — the land mask |

`budgetForSpeed()` scales concurrency up and fine detail down as speed rises: at 2 000 m/s, detail
that takes a second to arrive is detail the player has already flown past.

### Degradation order

When the budget is exceeded, in this order: detail richness, actor density, delay the child while
keeping the parent, dynamic resolution, shadows, atmosphere samples, cloud detail.

Never: block the main thread until generation finishes, remove a parent before its child is ready,
or load the whole planet.

### Measured cost of what is on

`FEATURES.spatialCore` is the only flag enabled. Across every speed band in `npm run profile` it
costs **below the profiler's 0.05 ms reporting threshold** — it converts, schedules and reports,
and it draws nothing.

## Telemetry

`UniverseRuntime.telemetry` feeds the F3 panel:

```
frame · latDeg · lonDeg · altitudeM · renderLocalM · rebases · dominantBody · planetTiles · streaming
```

`renderLocalM` is the load-bearing one: it is how far the player is from the render origin, and it
is the number that says whether the floating origin is doing its job. `streaming` carries the
scheduler's queue depth, active tiles and cache hit rate.

## Tests

```
npm test              246 tests, 0 failures
npm run build         tsc --noEmit && vite build
npm run test:browser  FAILING (pre-existing, see below)
npm run profile       flight profile across speed bands
```

`npm run test:browser` fails on `shellTriangles === 0`: the real-city footprint shell does not
finish streaming inside the test's 90 s window under the software renderer. It fails identically on
the commit this branch started from, so it is not a regression — but it is not passing, and this
document will not pretend otherwise.

### The world tests

| File | Tests | What it pins down |
| --- | --- | --- |
| `tests/wgs84.test.ts` | 14 | defining constants; ECEF round-trip sub-mm to geostationary; the frozen Manaus projection |
| `tests/reference-frames.test.ts` | 11 | LCA conversion, cycle and orphan rejection, orientation composition |
| `tests/floating-origin-3d.test.ts` | 9 | a rebase changes no logical position, distance or rotation; zero delta across a frame change |
| `tests/planet-tiles.test.ts` | 14 | children exactly tile the parent; poles are ordinary; geocentric ≠ geodetic; SSE monotonic |
| `tests/earth-globe.test.ts` | 9 | vertices land on the ellipsoid **through the scene transform**; land mask agrees with known coordinates |
| `tests/solar-system.test.ts` | 12 | real J2000 distances in order; Moon and Sun ≈ 0.5° across; dominant body by gravity |
| `tests/streaming.test.ts` | 9 | budget caps, generation cancellation, LRU eviction, pinning |
| `tests/world-streaming.test.ts` | — | the two activation classes, ranking, retirement, dispose |
| `tests/universe-runtime.test.ts` | 6 | the facade: player pose, ECEF two ways agree, dispose is complete |

### What a test here has to do

The rule this work follows, learned the expensive way: **a test must check the thing the player
sees, not the nearest convenient proxy.**

The globe test originally checked that a tile's *centre* landed on the ellipsoid. It passed
throughout the period when every tile was drawn at an arbitrary rotation, because a centre has no
orientation. It now takes sampled vertices out through the full scene transform and back to
geodetic. That version fails on the bug.

### Tolerances are derived, not guessed

Three tolerance mistakes were made and corrected while writing these, all the same shape —
asserting a precision the representation cannot carry:

- 1 mm on a value of 4.7×10¹⁷ m. A double's ulp there is about 16 m.
- 1 mm on vertex offsets that are stored as float32.
- An exact `0` where the value was `-0`; `assert.equal` distinguishes them.

Every tolerance in these tests now states which representation it comes from.

### And a test can be wrong about the world, not just about the code

`tests/player.test.ts` asserted that a hard climb *arrives* at `SPACE.maxAltitude` within sixty
seconds. That was true of a 140 km ceiling and false of a 500 000 km one, so the test failed the
moment the ceiling moved — correct behaviour, wrong assertion. It now checks the invariant (the
ceiling is never crossed) and tests the clamp from just below it, which is true at any height.

## Missing

- `npm run profile:planet`, `profile:orbit` and `profile:reference-frames` do not exist. The
  specification asks for them; only the existing flight profile is implemented.
- GPU memory telemetry is budgeted but not measured against real hardware.
- No test covers the WebGL2 fallback path for the planetary domain.
