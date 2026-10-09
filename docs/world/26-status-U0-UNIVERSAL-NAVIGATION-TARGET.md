# U0 — Universal navigation target authority (2026-10-09)

Baseline: `9f7ac3e7a6a78d2944f32438ccdec9c1ebff8fef`, branch `feat/universe-map`.
The new user attachment authorizes U0 after reviewing the Manaus aerial hotfix. This checkpoint
implements logical targeting only. D1 remains frozen. U1/U2/U3 and BH0/BH1/BH2 remain future work.

## Authority and validation

Previously `NavigationTargetState` stored `{bodyId,source,lockedAtS,mode}` and validated against
`activeSystem.positionOf(bodyId)`. Leaving/unloading a system necessarily erased its destination.
Now the same state stores one immutable `UniversalNavigationTarget` and exposes `current`,
`select(target)`, `lock(target)`, `clear()` and `validate(resolver)`. No map, provider or HUD owns a
second selection. The historical `select(bodyId,source,time)` overload converts to universal Solar
data immediately; it does not store a body-only lock.

`UniversalTargetCatalog` owns curated/generated descriptors. `UniversalTargetResolver` resolves
validity, logical coordinates with an explicit frame, distance, materialization, domain and travel
capability. A missing mesh, provider or position in another active system is not descriptor
invalidation. Unknown bodies, unknown generated identities, malformed addresses, forged keys or
curated cosmological descriptors with forged coordinates are rejected. Explicit clearing and
known descriptor invalidation still clear the selection.

All target data is plain: no `Mesh`, `Object3D`, UUID, render `Vector3`, functions, `Map` or `Set`.
Snapshotting whitelists scalar fields and freezes copied addresses, integer axes and Mpc vectors.
Mutating the input descriptor cannot rewrite an existing lock.

## Identity, address and wire format

Kinds: `body`, `star`, `system`, `black-hole`, `galaxy`, `cluster`, `cosmic-anchor`,
`observable-horizon`. Selection metadata: source (`reticle/map/hud/search/portal`), simulation
`selectedAtS` and `selected/locked` mode. Display names and clocks never enter identity.

Reuse `UniverseAddress`, `CosmologicalAddress`, the existing 100 ly sectors, `sectorKey`,
`sectorSeed` and `separationM`. There is no competing coordinate model. A body address includes
galaxy/sector/system/body; black holes have their own semantic kind without a fake planet ID;
galaxies have a galaxy identity without a fake body or star system.

Canonical keys escape individual string identifiers with `encodeURIComponent`, and interpolate
BigInt axes directly as decimal text. Examples:

| Target | Key |
| --- | --- |
| Mars | `universe/milky_way/0,0,0/system/sol/body/mars` |
| Moon | `universe/milky_way/0,0,0/system/sol/body/moon` |
| Sgr A* | `universe/milky_way/0,0,0/black-hole/sgra` |
| Andromeda | `galaxy/andromeda` |
| M31 SMBH | `universe/andromeda/0,0,0/black-hole/m31_smbh` |
| Virgo | `cosmos/cluster/virgo_cluster` |
| Great Attractor | `cosmos/cosmic-anchor/norma_cluster` |
| Horizon | `cosmos/observable-horizon/observable-horizon` |

Procedural system keys append `/system/<escaped generated star ID>` to the galaxy/sector prefix;
star and body keys append `/star/<escaped star ID>` or `/body/<escaped body ID>`. A generated ID
already contains slashes; escaping preserves it as a single identity component, not render paths.

`9007199254740993n` and `9007199254740994n` produce distinct keys. Identity never converts axes to
Number. Distance converts only the *difference* of integer sector axes via existing `separationM`;
unrepresentable distances remain unknown rather than becoming navigation identities.

`serializeUniversalTarget` / `deserializeUniversalTarget` use schema version 1 and exact
`{"bigint":"9007199254740993"}` decimal-string wrappers. Parsing verifies integers, address/kind
consistency, metadata and the canonical key. Raw BigInt JSON is never used for saves. Selected
targets were not persisted in current saves, so U0 adds no save migration or automatic reload
selection. Round-trip helpers prepare that future contract.

**Player address is not target address.** `UniverseRuntime.address` remains the player location
authority. Selection never calls `setAddress`, handoff, teleport or active-system installation;
browser callbacks compare pose/address/system before and after the exact DOM click.

## Resolution, descriptors and distances

| Target | Identity / data source | Current capability |
| --- | --- | --- |
| All 19 Solar bodies, including Sun | Solar catalog, `milky_way/0,0,0/sol` | `solar`, while that Solar runtime/address is active |
| Milky Way | `LOCAL_GROUP_CATALOG` galaxy | `interstellar-future` |
| Andromeda | Existing `andromeda`, existing `2.365e22 m` catalogue position | `intergalactic-future`, approximately **2.50 Mly** from Solar |
| Sagittarius A* | Milky Way `centralBlackHole`, `sgra` | `black-hole-future` |
| M31 SMBH | Andromeda `centralBlackHole`, `m31_smbh` | `black-hole-future`; intergalactic domain when in Milky Way |
| Generated star/system/planet | `generateStarSector` / `generateSystem` | `interstellar-future` or `intergalactic-future`; selectable unloaded |
| Local Group, Virgo, Norma/Great Attractor, Shapley | Existing curated Mpc offsets, now shared through `CosmicAnchorCatalog` | `cosmological-future` |
| Observable Horizon | Existing observer-relative 14,200 Mpc radius shared with CMB presentation | `cosmological-future`; reference horizon, no point destination/wall |

Solar distances follow live ephemerides. Generated targets use the same BigInt sector grid and
star offset; body orbits are evaluated by a descriptor-only `ProceduralSystemRuntime`, or the live
matching system when present. Creating this ephemeral ephemeris installs no frames, providers,
scene, player location or playable destination.

The existing `StarSector` grid is Solar relative, whereas curated galaxy/SMBH positions are MW
centred. Its existing +X, 26,000 ly relationship is extracted as `GALACTIC_CENTRE_FROM_SOL_M` and
shared by generation and resolution, without changing generation results. Sgr A*/MW centre now
resolve around **26.00 kly**, rather than treating the Solar origin as the galactic centre. Both
Andromeda and M31 resolve from their existing MW-relative catalogue positions. Future U2 must
make runtime/frame handoffs agree with this relationship; U0 does not perform those handoffs.

Cosmic anchors use existing Local Group-relative Mpc offsets. In a different cosmic cell without
an existing cell-to-distance scale, the resolver keeps the target valid but distance unknown;
it does not invent a cosmological conversion. Horizon distance remains observer relative.

Distance presentation preserves current Solar m/km/M km/UA formatting, adding ly/kly/Mly/Mpc/Gpc
at readable thresholds. Andromeda appears as 2.50 Mly instead of huge absolute metres.

## Procedural identity contract

`proceduralDescriptor(galaxy,sector,starId)` regenerates the actual sector, finds the stable generated
star and calls `generateSystem(star.id, sectorSeed(galaxy,sector) ^ BigInt(starIndex+1), star.massSolar)`.
This exact system-seed convention is shared by the star/system/body target factory; U1 should
consume the same descriptor instead of inventing a second seed derivation. The target contains
the resulting stable system/body IDs, not the provider's array index or a mesh ID.

Example tested: Milky Way sector `17,-2,4`, its first real generated star, its system and its first
generated planet. A fresh catalog reproduces all three keys and resolves them while Solar stays
active. The catalog bounds regeneration caches to **8 sectors / 64 systems**; eviction does not
invalidate identities or grow repository data with universe size. These are descriptor caches,
not playable U1 runtimes.

## Solar adapter and map/HUD

`solarTargetBodyId` / `solarNavigationTarget` require kind `body`, address `milky_way/0,0,0/sol`,
matching player system/address, the active Solar runtime and an existing body. Coincident IDs in
another system/sector do not pass. `Game.navigationLock` and `navigationTarget` are read-only
compatibility projections; the historical body-target setter also routes through universal state.
`CosmicFlight`, Solar acceleration/braking/arrival policy, landing and CCD are unchanged.

Tab/Shift+Tab discover existing Solar reticle candidates and convert selection before storage.
Solar map buttons/canvas clicks use the same authority. The old uppercase Solar HUD names remain
unchanged. The P input gate permits only the adapter's implemented Solar destinations; selecting
a future target cancels a previous pilot command, and P shows its unavailable travel capability.
It never synthesizes a Solar body or changes player location.

Galaxy map catalog markers/buttons select MW, Sgr A*, Andromeda and M31. Cosmos markers/buttons
select existing anchors/horizon and expose galaxy catalog choices. Markers are clearly schematic;
their positions are hit areas, never astrophysical distance inputs. Provider unload cannot clear
the target. Closing/reopening the map preserves selection outside the DOM.

The HUD shows name, kind, human-readable galaxy, distance and capability even for a future target.
The map has one target card fed by resolved HUD data, plus current-location information. F3 adds
name/kind/key/galaxy/sector/system/body/object/materialized/distance/domain/capability. Labels derive
`selectedBodyId` only through the Solar adapter; galaxy/BH targets never select a Solar label.

## Validation and delivery

- Full unit suite: **1,163/1,163 PASS**, including 55 added cases, all 33 requested `T_U0_*` cases,
  actual production P-gate tests, legacy Solar selection/cycling, landing, D1 and Manaus regressions.
- Focused target/runtime/map/procedural/space suite: **137/137 PASS**.
- Typecheck and production build: **PASS**. Existing large-bundle advisory is unchanged.
- Browser local Manaus regression: **PASS, zero console/page errors** — pause/settings, traffic
  (40 cars checked on mapped drivable roads), real building demolition, local crater/powers,
  authentic ascent/coasting/orbit/Earth reentry, one local ground authority. WebGL 2, 32 boot chunks.
- Full-space browser on the final F3 build: **PASS, zero console/page errors** — U0 on both
  viewports and actual F3 DOM, Solar Tab/Shift+Tab/P, Moon/Mars safe landing, Jupiter exclusion,
  all current major-moon approaches, C4 safe/catastrophic policy, Sun photosphere/corona approach,
  D1 Moon/Mars/Earth impacts, coherent HIGH publication and real crater walking.
- U0 browser uses real keyboard Tab/Shift+Tab/P/cancel/Backspace, DOM target buttons and galaxy
  canvas click, checks exact pose/address/system immutability during selection, desktop
  **1440×900** and mobile viewport **390×844**. Both viewport flows and F3 universal diagnostics
  passed in the final run. Andromeda/M31 distance measured `2.3651279154934658e22 m` at the far-Solar
  fixture, formatted **2.50 Mly**; origin rebase preserves the exact key and resolved distance.
- Browsers run serially on Windows with `DR_BROWSER_GPU=1` / ANGLE D3D11; they exercise native
  WebGL rendering. Mobile means responsive viewport coverage, not a claim of physical-device testing.
- `git diff --check`: **PASS**.
- Browser artifacts/screenshots/logs remain ignored under `artifacts/`; none are delivery source.
- Initial implementation commit: `4ba2150` (`feat(navigation): unify universal map, HUD and Solar target authority`).
  Tests/browser commit `450b68e`; final F3 integration/projection and browser assertion `e2f5177`.
  Final commit list, final SHA and exact-SHA GitHub Actions status are reported after push in the
  delivery response, avoiding a self-referential final-SHA documentation commit.

The first full-space attempt passed both U0 viewport flows, but a legacy Moon HUD assertion caught
the new display name replacing the old uppercase name. Restoring Solar `targetName` precedence
fixed that regression; it was not a navigation lock or physics failure. The final browser run
uses the corrected build. Automated results are not a claim of user manual acceptance.

## Manual gate and remaining work

Manually check Tab/Shift+Tab and Mars map/P workflow, then Sgr A* (BLACK HOLE / Milky Way),
Andromeda (GALAXY / 2.50 Mly), close/reopen, and M31 (BLACK HOLE / Andromeda). Selection alone
must not move the player; P on non-Solar targets must stay inactive and explain capability.
Small-screen sidebar content scrolls; canvas and level buttons remain within the viewport.

**STOP after U0 delivery for this manual gate.** U1 owns streamed playable procedural systems;
U2 owns galaxy runtime/Andromeda arrival; U3 owns actual hypercruise; BH0/BH1/BH2 own black-hole
render/runtime/physics/transit. `BlackHoleProvider.update` remains a Milky Way presentation scaffold
with known runtime/render debt; U0 target/UI ownership now supports BHs in either catalog galaxy.
There is no new gravity, lensing, event-horizon gameplay, teleport, galactic warp or arrival here.
