# Documentation

## The world

`docs/world/` documents the planetary and cosmic architecture. Its files are numbered to match the
`dr-manaus-cosmic-world-specs` package, so spec `07-STREAMING-HLOD-AND-CACHE.md` is documented in
`docs/world/07-streaming.md`. Start at [world/README.md](world/README.md).

| Document | What it covers |
| --- | --- |
| [world/README.md](world/README.md) | Specification-to-code map, and where everything lives |
| [world/02-architecture.md](world/02-architecture.md) | The architecture and the reasoning behind it |
| [world/03-coordinates-and-frames.md](world/03-coordinates-and-frames.md) | WGS84, ECEF, ENU, frames, floating origin |
| [world/04-earth-and-planet-surface.md](world/04-earth-and-planet-surface.md) | Cube-sphere tiling, LOD, the globe mesh |
| [world/05-manaus-migration.md](world/05-manaus-migration.md) | How the compiled city was anchored without moving it |
| [world/06-geodata-pipeline.md](world/06-geodata-pipeline.md) | The global land mask: sources, licences, build |
| [world/07-streaming.md](world/07-streaming.md) | One queue for the universe: budget, cancellation, cache |
| [world/08-render-domains.md](world/08-render-domains.md) | Metres and megametres in the same frame |
| [world/10-solar-system.md](world/10-solar-system.md) | Bodies, ephemerides, frame handoff |
| [world/11-galaxy-and-universe.md](world/11-galaxy-and-universe.md) | Sector addressing and generated stars |
| [world/13-performance-and-tests.md](world/13-performance-and-tests.md) | Budgets, telemetry, what the tests prove |
| [world/15-status.md](world/15-status.md) | Phase-by-phase progress, including what does not work |
| [world/17-acceptance.md](world/17-acceptance.md) | The acceptance criteria, checked against the build |
| [world/21-contracts.md](world/21-contracts.md) | The interfaces to implement against |

## The city and the character

| Document | What it covers |
| --- | --- |
| [geodata.md](geodata.md) | The Manaus geodata pipeline: OSM extract, tiles, licence |
| [animation-credits.md](animation-credits.md) | Every animation clip, its source and its licence |
| [humanoid-destruction.md](humanoid-destruction.md) | Damage, craters, debris and reconstruction |

## Conventions

- Every dataset records `source`, `licence`, `retrievedAt` and a version, in the file itself.
- Nothing is fetched from a map service during gameplay. Ingestion scripts run by hand, never in
  the game loop.
- Documentation states what is *not* built as plainly as what is. A specification half implemented
  and described as finished is worse than one not started.
