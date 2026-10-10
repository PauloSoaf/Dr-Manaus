# The galaxy and the observable universe

## U3 — Production hypercruise (2026-10-09)

P now travels to canonical systems/stars/bodies in MW or Andromeda. Galaxy targets resolve to
Sol or deterministic Andromeda disc entry. The runtime address is authoritative only while
anchored; UniversalTransitState is authoritative in transit. Source resources stay coherent
until a prepared destination commits atomically. No astronomical render motion or BH travel.
[U3 architecture and validation](29-status-U3-UNIVERSAL-HYPERCRUISE.md).


## U2 — Active galaxy runtime and Andromeda (2026-10-09)

`UniverseRuntime.activeGalaxy` corresponds to `address.galaxyId`; the address remains location
authority. MW sector zero stays Solar-relative (−26,000 ly from the MW centre); Andromeda sector
zero is its own centre. `GalaxyCoordinates` composes origins/sectors/offsets and descriptor
orientation for global distances. Density never subtracts the 2.5 Mly galaxy displacement.
`GalaxyMaterializer` prepares one StarSectorProvider, one external galaxy proxy and the owned
central BH, then coordinates activation/rollback with the existing system materializer.

Explicit U2 TEST visits `andromeda/200,0,0/1`: 7 planets, 12 moons, 16 landable bodies. System
physics stays local; its star, orbits and profiles use the U1 generator and global epoch.
M31 is ~20.03 kly from this fixture; Sgr A*/MW are ~2.51 Mly. Sol restoration returns Sgr A* to
26 kly. Historical U2: intergalactic P remained gated. Only catalogue MW/Andromeda runtimes exist; U3 is implemented, U4/BH0 remain next.
[Full evidence and limitations](28-status-U2-GALAXY-RUNTIME-ANDROMEDA.md).



Implements the addressing and generation parts of `11-GALAXY-AND-OBSERVABLE-UNIVERSE.md`. Code:
`src/world/celestial/StarSector.ts`, `src/world/spatial/UniverseAddress.ts`.

**Status updated 2026-10-09:** U0 target authority and U1 playable procedural systems are implemented. Addressing,
deterministic generators and a procedural system runtime
exist. Galaxy/star-sector/cosmic-structure presentation foundations are wired with
`FEATURES.galaxyTravel = true`. U2 QA galaxy arrival is implemented. U3 production hypercruise is implemented; black-hole
transit remains pending. The previous “nothing rendered / flag off” description was stale.
After final D1.1 hardening, the branch prioritizes the
[Universe Map completion epic](../../specs/UNIVERSE-MAP-COMPLETION-EPIC.md); D2–D5 are deferred.

## Universal target authority — U0

`NavigationTargetState.current` stores one immutable `UniversalNavigationTarget`, validated by
`UniversalTargetResolver` against logical descriptors, independently of the active system and
render/provider lifecycles. `UniverseRuntime.address` remains player location; selecting a galaxy
never changes it. Keys reuse BigInt sectors directly and versioned serialization writes decimal
integer wrappers. `navigationLock` / `navigationTarget` are read-only active-system adapter projections; strict Solar adapters remain available.

The catalog supports all 19 Solar bodies, deterministic generated stars/systems/planets, Milky
Way, Andromeda (approximately 2.50 Mly), Sgr A*, M31 SMBH under Andromeda, existing cosmic anchors
and the observer-relative horizon. The existing 26,000 ly Solar→MW-centre relationship is shared
with `StarSector`; galaxy descriptor distances never use a render proxy or camera. Map, HUD and
P gating use this authority; only body/root-star destinations inside the current active system can execute autopilot.

Implementation, key examples, exact BigInt wire format, seed convention, tests and manual gate:
[26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md](26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md).
## Playable procedural systems — U1

Canonical catalog descriptors now materialize GeneratedStar-consistent systems with explicit
solid/giant/stellar profiles. The MW fixture `milky_way/17,-2,4/0` has 9 planets and 24 moons.
Prepared session installation switches runtime/address/frame/resources together; moving frame
origins mirror orbital positions. Generated rocky bodies/moons have synthetic physical surfaces;
only the nearest solid streams detail. Current-system Tab/P/Warp/landing uses one target/runtime.
Unload disposes procedural providers/visuals/frames/jobs; revisit uses the same seed/descriptors
and current global epoch. U0 descriptor caches remain bounded, with no per-visited-system dumps.

Controlled U1 TEST arrival/return is development transport, explicitly opted into for previews.
Normal P cannot cross systems and Andromeda materialization is rejected in U1. BigInt identity
never converts to unsafe absolute Number coordinates; extreme density sampling uses a bounded
fallback. Budgets, tests, lifecycle limits and manual instructions:
[27-status-U1-PLAYABLE-PROCEDURAL-SYSTEMS.md](27-status-U1-PLAYABLE-PROCEDURAL-SYSTEMS.md).
Historical U1 gate accepted; U2 QA galaxy arrival is implemented. Production hypercruise is implemented by U3.

## Addressing — `UniverseAddress.ts`

A position beyond the solar system is an integer sector index plus a double offset inside it.
`SECTOR_SIZE_M` is 100 light years.

The indices are `bigint` because at cosmological range they genuinely exceed 2⁵³, and an integer
that silently drops its low bits is worse than one that is slow. The cost is paid when the player
crosses a sector boundary, not per frame.

| Function | What it is for |
| --- | --- |
| `normalizeSectorOffset` | carries an offset that outgrew its sector into the index, keeping the double small |
| `separationM` | differences the indices in `bigint` first, then converts — never the other way round |
| `sectorSeed` | FNV-1a over the galaxy id and the three indices, in `bigint` |
| `addressKey`, `sectorKey` | stable string keys for caches and saves |

## Stars are generated, never stored — `StarSector.ts`

Gaia DR3 catalogues 1.8 billion sources. Shipping that is neither possible nor the point: a game
does not need the real star at the real magnitude, it needs a sky that is dense in the right
places and identical every time you come back.

So a sector's contents come from its seed, through **xorshift64** — no `Math.random` anywhere in
the project, and a test asserts that the same seed regenerates the same sector exactly.

`milkyWayDensity()` is a real double-exponential disc plus a bulge, so flying toward the galactic
centre is denser than flying out of the plane, and the band of the Milky Way is a consequence of
the model rather than a texture. `STARS_PER_SECTOR_BASE` is 320, scaled by that density.

The mass function is weighted the way the real sky is: overwhelmingly M dwarfs, with O and B stars
rare enough to be worth flying to.

## The file-size rule

The specification's real constraint for this phase is that the universe must not grow in bytes
proportionally to the number of systems it can contain. A seeded generator satisfies it exactly:
the repository holds the generator, not the galaxy.

Real catalogues enter only as **subsets**, where a named star is worth having. None are ingested
yet.

## Remaining gameplay

- Extend the delivered MW/Andromeda runtimes to procedural galaxies in U4. U1–U3 already provide
  playable materialization, deterministic unload/return and separate logical hypercruise.
- Replace black-hole sphere/torus scaffolds with gravity/horizon/lensing/capture/transit runtimes.
- Make the map consume actual runtime descriptors across galaxy/cosmological scales. The observable
  horizon scaffold is presentation, not a physical boundary or completed cosmological travel.
