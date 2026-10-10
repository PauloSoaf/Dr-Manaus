# Data contracts and APIs

Implements `21-DATA-CONTRACTS-AND-APIS.md`. This is the surface to write against when adding a
body, a provider or a new kind of tile. Details of *why* each piece exists are in the
per-subject documents; this one is the reference.

## `UniverseRuntime` — `src/world/runtime/UniverseRuntime.ts`

The only thing `Game` talks to. It owns the spatial model, the provider registry, the streaming
scheduler and the solar system, and exposes high-level operations. **Nothing here draws.** It
converts, it schedules, and it reports.

```ts
class UniverseRuntime {
  readonly frames: ReferenceFrameGraph;

  get time(): number;
  get player(): SpatialPose;
  get streamingEnabled(): boolean;
  set streamingEnabled(enabled: boolean);

  update(localPosition: Vec3, localVelocity: Vec3, dtS: number): void;

  playerEcef(): { xM: number; yM: number; zM: number };
  playerEcefViaFrames(): { xM: number; yM: number; zM: number };  // the same answer, the long way
  playerGeodetic(): GeodeticPosition;

  prepare(): void;
  get telemetry(): UniverseTelemetry;
  dispose(): void;
}
```

`playerEcef` and `playerEcefViaFrames` exist as a pair on purpose: one computes directly, the other
walks the frame graph, and a test asserts they agree. If the frame tree is ever wired up wrongly,
that assertion is what says so.

```ts
interface UniverseTelemetry {
  frame: string;  latDeg: number;  lonDeg: number;  altitudeM: number;
  renderLocalM: number;  rebases: number;  dominantBody: string;
  planetTiles: number;  streaming: GlobalStreamingScheduler['stats'];
}
```

## `WorldProvider` — `src/world/providers/WorldProvider.ts`

```ts
interface WorldProvider {
  readonly id: string;
  readonly priority: number;           // authored > real city > procedural > generic terrain
  claims(): readonly CoverageClaim[];  // which channels, where, how authoritatively
  covers(context: SpatialContext): boolean;
  plan(context: StreamingContext): readonly TileDemand[];
  load(demand: TileDemand, signal: AbortSignal): Promise<TilePayload>;
  activate(payload: TilePayload, frame: ActiveReferenceFrame): ActiveTile;
  deactivate(tile: ActiveTile): void;
}
```

Obligations, in order of how much trouble ignoring them causes:

1. **`load` must honour the signal.** A provider that ignores the abort will keep working through a
   teleport and hand back tiles for a place the player has left.
2. **`plan` must not act.** It states demand. The scheduler decides what happens and when; a
   provider that loads inside `plan` has no budget.
3. **`activate` returns something disposable.** `ActiveTile.dispose()` must release geometry,
   materials and colliders — the scheduler calls it and does not check.
4. **`claims()` must be honest.** Claiming a channel you do not supply leaves a hole that the
   provider below you would have filled.

### Contexts

```ts
interface SpatialContext {
  timeS: number; player: SpatialPose; frame: ActiveReferenceFrame;
  localVelocityMps: Vec3; altitudeM?: number; bodyId?: string;
}

interface StreamingContext {
  spatial: SpatialContext;
  camera:  { fovRad: number; viewportHeightPx: number; forward: Vec3 };
  quality: { sseTargetPx: number; detailFactor: number };
  budget:  StreamingBudget;
}
```

### Coverage

```ts
type CoverageChannel = 'terrain' | 'water' | 'roads' | 'buildings'
                     | 'vegetation' | 'landmarks' | 'physics';
```

`ProviderRegistry.ownerOf(bodyId, latDeg, lonDeg, channel)` answers who owns a channel at a point;
`maySupply(...)` is the question a provider should ask before building anything. `regionContains`
handles the antimeridian, which a naive `min <= x <= max` does not.

## `TileDemand` — `src/world/streaming/TileDemand.ts`

```ts
type WorldTileKey =
  | { kind: 'manaus';      tx: number; tz: number }
  | { kind: 'planet';      bodyId: string; face: number; level: number; x: number; y: number }
  | { kind: 'star-sector'; galaxyId: string; level: number; sector: SectorIndex };

interface TileDemand {
  key: WorldTileKey;  providerId: string;
  priority: number;            // written by the scheduler, not the provider
  geometricErrorM: number;     // the error this tile removes
  screenSpaceError: number;    // written by the scheduler
  distanceM: number;
  timeToContactS: number;      // Infinity when never
  gameplayCritical: boolean;   // physics, spawn, teleport destination — jumps the queue
  representation: TileRepresentation;   // 'active' | 'near' | 'mid' | 'far' | 'planet'
  centreM?: readonly [number, number, number];
}
```

Build one with `tileDemand(init)`; it fills the scheduler-owned fields.

`tileKeyToString` prefixes the kind. All three kinds share one cache, and without the prefix a
collision puts a city block in a galaxy.

## `SpatialPose` — `src/world/spatial/SpatialPose.ts`

```ts
interface SpatialPose { frame: ReferenceFrameId; position: Vec3; orientation: Quat }
```

A position without its frame is not a position. `distanceInFrame(a, b)` refuses to measure between
two poses in different frames rather than returning a plausible wrong number.

## Adding a body

1. Add it to `SOLAR_SYSTEM_BODIES` with published physics, and its elements to `OfflineEphemeris`.
2. Add a `PlanetBody` if it has a surface.
3. Register its frame under `solar-system/…` in the graph.
4. Write a provider that plans from `PlanetQuadtree` — `EarthProvider` is the worked example.

## Datasets

Every dataset file carries, inside itself:

```json
{ "source": "…", "licence": "…", "url": "…", "origin": "…", "retrievedAt": "YYYY-MM-DD" }
```

plus the parameters it was generated with. See [06-geodata-pipeline.md](06-geodata-pipeline.md).
