# The world: specification to code

This folder documents the implementation of `dr-manaus-cosmic-world-specs`. Files are numbered to
match the specification they implement.

Baseline the specification was written against: `d2e03428b1d9ba90fdc7b2a5112c280e6686fead`
(PR #2 merged to `main`). Work happens on `feat/universe-map`.

Progress by phase, including the things that do not work, is in [15-status.md](15-status.md).
That file is the one to read first when picking the work back up.

## Specification coverage

| Spec | Subject | State | Documented in |
| --- | --- | --- | --- |
| 01 | Current main audit | read, acted on | — (`docs/geodata.md` corrections) |
| 02 | Target architecture | implemented | [02-architecture.md](02-architecture.md) |
| 03 | Coordinates and reference frames | implemented | [03-coordinates-and-frames.md](03-coordinates-and-frames.md) |
| 04 | Earth WGS84 and planet surface | built, not yet drawn | [04-earth-and-planet-surface.md](04-earth-and-planet-surface.md) |
| 05 | Manaus preservation and migration | implemented | [05-manaus-migration.md](05-manaus-migration.md) |
| 06 | Geodata pipeline | global land mask done; DEM not started | [06-geodata-pipeline.md](06-geodata-pipeline.md) |
| 07 | Streaming, HLOD and cache | implemented, not yet driving the city | [07-streaming.md](07-streaming.md) |
| 08 | Render domains, atmosphere, ocean | domains done; atmosphere and ocean not | [08-render-domains.md](08-render-domains.md) |
| 09 | Physics, destruction, high speed | pre-existing; unchanged by this work | `docs/humanoid-destruction.md` |
| 10 | Solar system | implemented as a logical model | [10-solar-system.md](10-solar-system.md) |
| 11 | Galaxy and observable universe | addressing and generation only | [11-galaxy-and-universe.md](11-galaxy-and-universe.md) |
| 12 | Persistence and stable ids | not started | — |
| 13 | Performance budgets | implemented | [13-performance-and-tests.md](13-performance-and-tests.md) |
| 14 | Test strategy | implemented | [13-performance-and-tests.md](13-performance-and-tests.md) |
| 15 | Implementation roadmap | tracked | [15-status.md](15-status.md) |
| 16 | File-by-file plan | followed | this table |
| 17 | Acceptance criteria | checked | [17-acceptance.md](17-acceptance.md) |
| 18 | Risks and guardrails | observed | [02-architecture.md](02-architecture.md), [06-geodata-pipeline.md](06-geodata-pipeline.md) |
| 19 | Source research | used | [06-geodata-pipeline.md](06-geodata-pipeline.md), [10-solar-system.md](10-solar-system.md) |
| 20 | Agent execution contract | observed | — |
| 21 | Data contracts and APIs | implemented | [21-contracts.md](21-contracts.md) |

## Where the code lives

| Directory | Responsibility | Imports Three.js |
| --- | --- | --- |
| `src/world/spatial/` | Coordinates, frames, floating origin, universe addressing | no |
| `src/world/planet/` | Bodies, cube-sphere tiling, screen-space error, the globe mesh | only `EarthGlobe.ts` |
| `src/world/celestial/` | Solar system, ephemerides, star sectors | no |
| `src/world/streaming/` | Demand, priority, budget, cache, cancellation | no |
| `src/world/providers/` | Sources of world, and who owns which channel where | only `EarthProvider.ts` |
| `src/world/runtime/` | `UniverseRuntime`, the facade `Game` talks to | no |
| `src/world/geodata/` | Bundled datasets and the city projection | no |
| `src/rendering/domains/` | The two-pass composer | yes |
| `scripts/geodata/` | Offline ingestion. Never runs during gameplay | no |

Keeping the model free of Three.js is deliberate, not stylistic: it runs in a worker and in a test
without a browser. The renderer is a projection of the model, never its source.

## Feature flags

`FEATURES` in `src/core/config.ts` gates each phase, so a phase can ship without two complete
architectures living side by side. Each flag is temporary and comes out once its phase stabilises.

| Flag | State | Meaning |
| --- | --- | --- |
| `spatialCore` | **on** | Frames, floating origin and the solar system model. Observes; draws nothing |
| `planetStreaming` | off | Global tile streaming through the new scheduler |
| `earthGlobe` | off | The WGS84 globe as visible geometry — see [15-status.md](15-status.md) |
| `planetTerrain` | off | Global terrain from a DEM |
| `curvedManaus` | off | Manaus curved onto the ellipsoid |
| `newAtmosphere` | off | Planet-aware atmosphere and the render-domain composer |
| `solarSystem` | off | Leaving the atmosphere, and the bodies beyond it |
| `galaxyTravel` | off | Star sectors as somewhere to go |

## Working rules for this area

1. **Measure, do not assume.** Every number in these documents came from running something. Where
   something is believed rather than measured, it says so.
2. **No `Math.random`.** Generation is seeded and reproducible; a test asserts a sector regenerates
   identically.
3. **No map service at runtime.** No Google, no Mapbox, no public OSM tile server as a backend.
   Ingestion is offline and its output is committed.
4. **Datasets carry their provenance** — `source`, `licence`, `retrievedAt` — inside the file.
5. **State what is not built.** The "what does not work" sections are load-bearing.
