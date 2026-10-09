# Universe Map completion epic — 2026-10-08

## U2 delivered — 2026-10-09

U1 accepted at `9909091`. Catalogue MW/Andromeda runtimes, local origins, atomic galaxy/system
sessions, active-sector/external/BH presentation, correct cross-galaxy distances and QA roundtrip
are implemented. [U2 evidence](../docs/world/28-status-U2-GALAXY-RUNTIME-ANDROMEDA.md).
**STOP for U2 manual acceptance; production hypercruise remains U3, generated galaxies U4, BH physics BH0+.**



User decision after D1.2 (`c92249bc221c9f4ec16c6840f0823d77ffb9454f`): finish D1.1 hardening,
then freeze destruction at functional D1 and prioritize the playable universe. This order supersedes
the old automatic D2→D5 progression. Each checkpoint still requires its own implementation,
validation, documentation, commit/push and manual gate. U0 and U1 are now implemented; U0 used the audited
`9f7ac3e` baseline (2026-10-09), U1 uses delivered `c651abb`. Later rows remain the future plan. Delivery/evidence:
[26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md](../docs/world/26-status-U0-UNIVERSAL-NAVIGATION-TARGET.md),
[27-status-U1-PLAYABLE-PROCEDURAL-SYSTEMS.md](../docs/world/27-status-U1-PLAYABLE-PROCEDURAL-SYSTEMS.md).

## Starting point, audited locally

`UniverseAddress` already uses BigInt 100 ly sectors and bounded local offsets. `StarSector`,
`SystemGenerator` and `ProceduralSystemRuntime` exist. `GalaxyDefinition` contains Milky Way
and Andromeda, including `sgra` and `m31_smbh` definitions. `GalaxyProvider`, `StarSectorProvider`
and `LargeScaleStructureProvider` supply presentation foundations; `FEATURES.galaxyTravel` is
true. A flag and macro visuals do not establish playable galaxy arrival or universal navigation.

U0 replaces the old `bodyId`/`activeSystem`-only state with one immutable universal descriptor
target, BigInt-safe canonical keys/serialization, catalog/resolver and a strict Solar adapter.
Galaxies/BHs/cosmic anchors and deterministic procedural identities survive unloaded runtimes;
selection never changes player location. The existing Solar flight tiers remain Solar/interplanetary
travel. `BlackHoleProvider` computes a visual
Schwarzschild radius and draws a black sphere/orange torus; its update now follows the owned active galaxy through U2. It does not implement gravity, capture, lensing, traversals or destination preparation.

## Checkpoint order and acceptance

| Checkpoint | Deliverable | Gate |
| --- | --- | --- |
| D1.1-FINAL | Multiple coherent crater regions, retention, real solar lighting, volume culling, per-tile masks, prepared publication | Craters A/B about 500 m apart remain physical and masked; constrained three-region eviction is whole and deterministic; D1.2 fidelity stays green |
| U0 | Implemented: universal target/catalog/resolver shared by HUD, map and Solar travel adapter, including non-body targets | Accepted by the latest U1 request; historical gate superseded |
| U1 | Implemented: deterministic GeneratedStar-consistent systems, profiles, dynamic visuals/providers and intra-system flight/landing | Explicit TEST arrival/return, 34-body MW fixture, coherent frames, unload/revisit; 48 mandatory IDs covered. U1 accepted by the U2 request; normal cross-system P remains unavailable |
| U2 | Implemented: GalaxyRuntime, local origins and prepared GalaxySession for catalogue MW/Andromeda, map/HUD/F3 and owned BH/external presentation | Explicit U2 TEST arrival, rocky/moon landing and Solar return; 59 mandatory IDs covered. STOP for manual U2 validation; no production transport |
| U3 | Separate interstellar/intergalactic hypercruise domain | Spool, acceleration, continuous progress, cruise, braking, prepared destination and safe handoff; no instantaneous teleport |
| U4 | Seeded galaxies from `universeSeed + cosmic cell` | Query spiral/barred/elliptical/irregular descriptors on demand, unload/regenerate; no repository growth proportional to galaxy count |
| BH0 | `BlackHoleDescriptor`/runtime with mass, spin, horizon scale, accretion disk, photon ring and lensing presentation | Sgr A* first, M31 next, procedural descriptors afterward; no ordinary rocky sphere/bounce authority |
| BH1 | Gravity, trajectory bending, capture/horizon state and inspired interior transit presentation | Increasing attraction; escape/cancel with X before crossing if physically/gameplay feasible; capture after crossing |
| BH2 | Deterministic black-hole destination network and emergence | `universeSeed + sourceBlackHoleId + traversalCounter` gives a persistent exit address; prepare galaxy/sector/destination before safe emergence |
| U5 | Runtime-backed searchable/clickable Universal Map | System → stellar sector → galaxy → Local Group → cluster → cosmic web → observable universe; every actionable marker resolves to the same target/address authority |
| U6 | Cosmological travel and exploration | Hierarchical addresses remain precise at distant structures; observer-relative observable horizon, never a physical wall or universal centre |

The requested U3 pacing is a **gameplay design target**, not an implemented feature: another star
in seconds, a Milky Way crossing in roughly 10–25 s, Milky Way→Andromeda in roughly 15–30 s.
Physical target distances remain authoritative. Do not simulate this by multiplying the existing
256c Solar control indefinitely or converting cosmological absolute metres into a `Vector3`.

## Shared contracts to establish before black-hole transit

Universal identity precedes streamed materialization. Providers draw/query the descriptor/runtime;
they do not own independent destinations. Readiness controls address/frame/runtime handoff.
There is one target authority, one travel-domain authority and one destination preparation path.

`GalaxyDescriptor.centralBlackHole?: BlackHoleDescriptor` supports SMBHs. A stellar sector may
also contain rare seeded stellar-mass black holes. Save the traversal counter and selected exit
identity; save/reload must not reroll the same traversal. A prepared exit has its gravity/horizon
runtime, nearby presentation and an emergence pose outside the destination horizon with safe motion.
The interior transition is fictional gameplay inspired by higher-dimensional travel, rather than
a claim about physical transit through an astrophysical event horizon.

## Deferred destruction roadmap

D2 penetration/tunnels, D3 integrity/fracture, D4 disruption/debris and D5 body-class destruction
remain preserved in [06-PLANET-VOLUME-NEXT-PHASES.md](dr-manaus-universe-roadmap/06-PLANET-VOLUME-NEXT-PHASES.md)
and the historical [sprint plan](dr-manaus-universe-roadmap/11-SPRINT-AND-COMMIT-PLAN.md).
They are deferred features, not part of the Universe completion gate. Preserve D0/D1/D1.2,
Sun approach, C4, Manaus, navigation and landing throughout U0–U6/BH0–BH2.

Historical U0/U1 gates accepted by subsequent requests. The current stop is manual U2 acceptance.
