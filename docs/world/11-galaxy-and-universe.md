# The galaxy and the observable universe

Implements the addressing and generation parts of `11-GALAXY-AND-OBSERVABLE-UNIVERSE.md`. Code:
`src/world/celestial/StarSector.ts`, `src/world/spatial/UniverseAddress.ts`.

**Status updated 2026-10-08:** addressing, deterministic generators and a procedural system runtime
exist. Galaxy/star-sector/cosmic-structure presentation foundations are wired with
`FEATURES.galaxyTravel = true`. Playable galaxy arrival, universal targets, hypercruise and black-hole
transit remain pending. The previous “nothing rendered / flag off” description was stale.
After final D1.1 hardening, the branch prioritizes the
[Universe Map completion epic](../../specs/UNIVERSE-MAP-COMPLETION-EPIC.md); D2–D5 are deferred.

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

- Promote existing macro/star-sector presentation and procedural system foundations to streamed,
  playable materialization and deterministic unload/return.
- Replace the active-system `bodyId`-only lock with universal target/address identity.
- Implement galaxy runtime/Andromeda arrival and separate interstellar/intergalactic hypercruise.
- Replace black-hole sphere/torus scaffolds with gravity/horizon/lensing/capture/transit runtimes.
- Make the map consume actual runtime descriptors across galaxy/cosmological scales. The observable
  horizon scaffold is presentation, not a physical boundary or completed cosmological travel.
