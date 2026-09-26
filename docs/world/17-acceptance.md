# Acceptance criteria, checked

`17-ACCEPTANCE-CRITERIA.md`, item by item, against the working tree on `feat/universe-map`.

Legend: **pass** — verified, and how is stated. **no** — not implemented.

## A. No regression of Manaus

The task is not complete if any of these regress. All verified by `npm test`, `npm run build` and
`npm run test:browser`.

| Criterion | State |
| --- | --- |
| spawn still correct at the Largo | pass — browser test |
| Teatro still separate from the monument and to its west | pass — at `-83, -6` |
| Arena still at its geographic position | pass |
| Ponta Negra still on the correct bank | pass |
| Bridge still connects the two banks | pass |
| Airport still free of procedural buildings | pass |
| 645 compiled tiles still usable | pass |
| real roads still rendered | pass |
| traffic still uses the road graph | pass |
| neighbourhoods still available | pass |
| near buildings still have roofs and facades | pass |
| no procedural building duplicated onto a real one | pass |
| destruction still coherent across near/shell/skyline | pass |
| reconstruction still works | pass |

Nothing in this phase touched the city's rendering path. `latLonToWorld` delegates to the adapter,
which reproduces the old projection bit for bit, and the test freezes the old coordinates. The
ground-level view was also checked by eye at 400 m and 12 km after the globe was switched on.

One caveat, stated rather than buried: `npm run test:browser` fails on `shellTriangles === 0` under
the software renderer, and fails the same way on the commit this branch started from. Category A is
verified by the unit tests and by eye, not by that script.

## B. A real Earth

| Criterion | State |
| --- | --- |
| WGS84 uses `a = 6378137 m` | pass — defining constant, asserted |
| flattening uses `1/f = 298.257223563` | pass — defining constant, asserted |
| Manaus anchored at correct latitude/longitude | pass — `-3.130333, -60.022528` |
| the world no longer depends on an infinite plane as its global representation | pass — above 15 km the ellipsoid is what is drawn |
| the globe covers the poles | pass — cube sphere; a pole is an ordinary tile |
| continents and oceans in coherent global positions | pass — South America is recognisably itself from orbit |
| major global rivers at an appropriate LOD | **no** |
| global relief streamed, not loaded whole | **no** — no DEM |
| no mandatory loading screen from ground to orbit | pass — the globe streams in; nothing blocks |

## C. Precision

| Criterion | State |
| --- | --- |
| player stays near the render-local origin | pass — `renderLocalM` in telemetry |
| no relevant local object gets astronomical coordinates on the GPU | pass — tile vertices are offsets from the tile centre |
| a 3D rebase does not change a logical position | pass — asserted |
| a rebase does not change the camera | pass — asserted |
| a rebase does not change velocity | pass — asserted |
| a body/frame change causes no visual jump | **no** — handoff is computed, not driven |
| no transform produces NaN or Infinity | pass — `finite()` guards at every entry, asserted |

## D. Streaming

| Criterion | State |
| --- | --- |
| the parent stays visible while the child loads | pass |
| an obsolete request is cancelled or ignored | pass — generation counter plus `AbortController` |
| a global budget limits work per frame | pass — `StreamingLedger` |
| high speed reduces fine detail | pass — `budgetForSpeed` |
| high speed increases macro prefetch | pass — `PrefetchPredictor` |
| the cache evicts | pass — LRU, asserted |
| the current tile and a critical destination can be pinned | pass — asserted |
| a failed tile does not leave a permanent hole | pass — the parent remains |

## E. Space

| Criterion | State |
| --- | --- |
| altitude not stuck at 140 km | pass — 500 000 km with the globe flag on |
| the Earth can be seen whole | pass — measured at 6 000 km and beyond |
| the Sun is no longer only a quad at a fixed local distance | **no** — the model exists; nothing is drawn |
| the Moon is a logically real body | pass — real radius, μ, tidal lock |
| at least the Moon is approachable and landable | **no** |
| the solar system uses coherent logical sizes and distances | pass — asserted against J2000 |
| distant representation preserves angular size | pass — the model returns angles; no renderer consumes them yet |

## F. Universe

| Criterion | State |
| --- | --- |
| sectors generate deterministically | pass — xorshift64, asserted |
| the same seed recreates the same system | pass — asserted |
| the universe does not grow in file size with the number of possible systems | pass — generated, never stored |
| real catalogues are subsets, not a raw Gaia download | pass — none ingested |
| the Milky Way has LOD | **no** |
| distant galaxies have LOD | **no** |
| cosmic coordinates do not depend on a single absolute float | pass — `bigint` sector index plus offset |

## G. Persistence

Nothing in this category is implemented. Phase 12 has not been started.

| Criterion | State |
| --- | --- |
| a destroyed building persists across unload/reload | **no** |
| destruction persists after leaving and returning to the planet | **no** |
| craters serialisable as deltas | **no** |
| current ids have a migration | **no** |
| clearing the cache does not clear the save | **no** |
| generator version is recorded | **no** |

## H. Performance

| Criterion | State |
| --- | --- |
| the game still streams incrementally | pass — including the planet, through one budget |
| no stage fetches from a cartographic service per frame | pass — nothing fetches at all |
| no ingestion script runs during gameplay | pass — hand-run only |
| the main thread does not wait on heavy synchronous generation | pass |
| F3 metrics include planetary state | pass — `universeDebug()` |
| `npm run profile` still works | pass |
| new planetary profiles exist | **no** |
| the WebGL2 fallback is still tested | pass — every planetary measurement in this work was taken under WebGL2 |

## Final demonstration flow

Achievable as far as the Earth: spawn at the Largo, fly over the Teatro, cross Manaus, climb, watch
the flat ground hand over to the ellipsoid, see the curvature, see South America, see the whole
planet. No reload, no visible teleport, no second Manaus.

Not achievable beyond it. The Moon is a logical body with no surface provider and no driven frame
handoff, so following it out, landing and returning needs phase 9 and a Moon provider. And the
hand-over at 15 km is a stand-down rather than a blend: the sky dome and the stars disappear
instead of becoming the planet's own atmosphere. Both are in [15-status.md](15-status.md).
