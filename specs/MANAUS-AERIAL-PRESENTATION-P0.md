# MANAUS-AERIAL-PRESENTATION-P0

Authorized hotfix, 2026-10-08. Baseline: `5b176f42fd6bf442a8cff130f077c2c6f79ee5cf`.
This checkpoint precedes Universe Map U0. Destruction remains frozen at D1.

The flat local Manaus root retires at the existing 15 km Earth ground handoff. A separate
Earth-fixed, curved regional presentation must already be ready: real river banks/islands,
the existing skyline aggregates and major compiled roads. It has no colliders, physics,
traffic, population or destruction authority. `FEATURES.curvedManaus` stays false.

Use the existing legacy coordinate → geodetic → WGS84 ECEF path, double-precision chunk
centres and Float32 offsets, transformed through FrameGraph/RenderSpace. Keep Earth tiles
under the region. Shared live Earth solar lighting applies. Preparation precedes retirement;
failed regional preparation keeps the existing local fallback. Preserve 8/15/13/60 km
request/handoff/return/orbit thresholds and the sole ground-owner switch.

Aerial fade-in: 8–12 km. Skyline masses fade out at 25–40 km; urban footprint, major roads
and real water remain. Distant fade uses apparent region size, 80–180 pixels, rather than
a hard altitude cutoff. Maximum 256 merged meshes/32 MiB geometry/120,000 river triangles/
8,000 skyline aggregates/20,000 road segments. Offscreen geometry uses frustum culling.

The water compiler window grows to ±80 km. Reuse available whole cached Overture polygons,
retain dark Rio Negro/muddy Solimões separation and island holes, and record release/query/
retrieval/hash/license. A fresh free Overture acquisition has a corresponding larger bbox.
Do not invent banks or claim the cache is a complete survey outside its original query.

Bake 128 m masks over actual compiled bounds plus a 256 m margin. Preserve centre-point
classification; a second conservative bitset includes every cell touched by water edges.
Reject vegetation if its entire crown disk intersects this coverage. Forest crown radius
is 155 m; procedural crown size is calculated before placement, including palm overhang.
Use the existing generalized fallback only outside authoritative coverage.

Acceptance: 25 named `T_*` checks plus budget, readiness-failure and thin-channel regressions;
unchanged Earth/provider/globe/local-city tests; full unit/types/build; real Game continuous
vertical flight with captures near 0/5/8/12/15/20/40/60/100/200 km; local and full space browsers;
zero browser errors; document measured geometry, submissions, data extents and memory.
Capture altitudes are observations after normal braking, not exact pose fixtures. Software
GPU runs use the shipped Low raster preset; native Manaus runs keep High. Gameplay is unchanged.

**STOP after documentation, commit, push and exact-SHA CI.** The supplied next U0 task is
deferred until the user accepts this hotfix in a native GPU session. Validate local shoreline,
canopies, overlap, city/river recognition, rebasing, distant fade and return flight manually.
The Universe Map epic order remains unchanged.
