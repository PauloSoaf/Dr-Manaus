# Manaus aerial presentation P0 — 2026-10-08

Baseline: `5b176f42fd6bf442a8cff130f077c2c6f79ee5cf`, branch `feat/universe-map`.
The local root previously disappeared at 15 km together with Manaus and the real river.
`ManausAerialPresentation` now prepares a separate curved Earth-fixed regional layer before
that same handoff. It is attached to the planetary presentation root, with no physics,
colliders, population, traffic or independent destruction system. The flat root still
retires; `curvedManaus=false` and the local surface/collider coordinate agreement remain.

## Transition and coordinates

Ground request/handoff/return/orbit remain 8/15/13/60 km. Earth coverage and regional readiness
both gate the ascent switch. During 8–12 km the aerial presentation fades in; during
8–15 km it overlaps the local view. Above 15 km the globe owns ground, with the curved
river/urban aggregates above it. Skyline masses fade at 25–40 km; the city imprint and
rivers persist until their apparent 40 km region shrinks below the 80–180 pixel fade range.
They remain recognizable at the tested 100/200 km views. Ground remains present underneath;
there is no regional globe hole or second ground collision surface.

Every source point uses `legacyLocalToGeodetic` then WGS84 ECEF. Chunk centres stay JS
doubles; only relative vertex offsets are Float32, in 16 km buckets. FrameGraph orientation
and RenderSpace centre conversion follow the current render origin. The existing legacy
projection's latitude scale differs from true ENU by ~0.67%; this does not change local
roads/buildings/colliders. Regional geodetic landmark alignment and rebasing are tested.
Presentation-only vertices follow existing Earth relief with a 16 m depth separation;
merged layers depth-test against Earth, use polygon offset, and order real water above
approximate urban rectangles. Live Earth solar direction and the shared light response apply.
Urban aggregate display colours are converted from sRGB to linear vertex albedo before lighting.

## Sources and coverage

Local water and aerial water use the same `water.json` object and rings. Islands are holes;
Rio Negro retains dark water, Solimões the existing compiled muddy-water classification,
and Encontro das Águas both classes. The city imprint uses the existing 7,734 skyline
aggregates across 645 tiles, with compiled trunk/primary/secondary roads. It is a coarse
regional view, not 647,085 separately streamed buildings or a second local simulation.

Source: cached Overture `base/water` release **2026-08-19.0**, retrieved
**2026-09-19T02:16:36.862156+00:00**, original query bbox
`[-60.45,-3.45,-59.60,-2.75]`. The cache contains 1,319 features/185,204 vertices;
whole source polygons extend to lon −62.2709025..−51.9402212, lat −6.2542984..−1.3469725.
This patch recompiles those available polygons; it does not claim a new acquisition or
complete coverage of minor water features beyond the old query. Fresh downloads in
`prepare-real-city.ps1` now query `[-60.75,-3.85,-59.29,-2.40]`; an existing cache is retained.
Source SHA-256: `759271b59bbe761c14db5d245878fa1bee21a82b6b4d9f0a9b4925d4d5859c3a`.
Release, retrieval, original bbox, SHA-256, origin, clipping and license are embedded in
`water.json`. [Overture base/water schema](https://docs.overturemaps.org/schema/reference/base/water/)
identifies the source theme; [Overture attribution](https://docs.overturemaps.org/attribution/)
documents the base ODbL license. Existing OSM/Overture attribution is preserved.

| Representation | Before | After |
| --- | --- | --- |
| Water X, metres | −38,000..38,000 | −80,000..80,000 |
| Water Z, metres | −28,764.8..34,000 | −60,473.2..58,667.7 |
| Real water polygons | 241 | 279 |
| Mask origin X/Z | −32,768/−32,768 | −80,256/−60,800 |
| Mask dimensions/cell | 512×512 / 128 m | 1,254×936 / 128 m |
| Decoded mask storage | 32,768 B | 293,904 B, two bitsets |

The expanded mask covers actual water bounds plus at least 256 m. Centre-point bits preserve
terrain/landmark semantics. Conservative footprint bits include edge/cell intersections as
well as interiors, detecting thin channels missed by cell-centre samples. A disk-to-cell
query rejects any whole-crown intersection. Shoreline vegetation may retreat conservatively
by up to a cell diagonal; banks themselves retain the real polygon geometry. Real mask
coverage takes precedence; generalized shoreline is only the outside-coverage fallback.
Forest backdrop uses its actual 155 m crown radius; procedural trees calculate size first,
including palm lobes (`1.6 + hypot(1.15*crown, 0.85)`). Dry land still generates vegetation.
The Ponta Negra promenade/beach regression remains unchanged and passes.

## Budgets and evidence

| Prepared layer | Triangles |
| --- | ---: |
| River | 81,567 |
| Urban imprint | 15,468 |
| Skyline masses | 77,340 |
| Major roads | 29,808 |
| Total | 204,183 |

76 merged meshes; 22,051,764 B of CPU geometry buffers, with the same estimated GPU buffer
payload (excluding driver overhead, source JSON, materials and temporary build arrays).
Checked-in JSON payloads: aerial 870,503 B; shared water 945,133 B; two-bitset mask 391,973 B.
Bounds: 256 meshes/32 MiB; river 120,000 triangles; urban 8,000 cells; road 20,000 segments.
Mass geometry remains prepared but is hidden by 40 km. Bounding boxes/spheres enable real
frustum culling. F3 reports readiness, visibility, opacity, per-layer triangles, eligible
mesh count, geometry bytes and apparent size. Eligible meshes are not measured GPU calls;
the browser fixture separately records actual `onBeforeRender` submissions.
The expanded local water mesh is 298,304 triangles / 28,637,184 B of position, normal,
shore and muddy Float32 attributes; its existing subdivision/shader remain unchanged.

`npm test`: **1,108/1,108 PASS** (28 new). Focused Manaus/real-city/forest/transition/globe/
surface/crater/procedural/Earth-integration set: **109/109 PASS**. `npm run build` includes typecheck. Browser evidence
and exact-SHA CI are recorded after final verification below.

The Manaus browser retains five radial geometry/collider checks, three local views and an
actual-road crater. It adds one initial ground setup followed by continuous real Space/B/V
flight to 200 km, braking through ordinary key release between samples; ten captures record actual altitudes, readiness/ownership, root
visibility, opacity, origin and actual river/urban submissions. End-frame trace must have
no visibility gap and a real overlap before the local root retires. SwiftShader uses the
shipped Low raster preset (0.7 pixel ratio, shadows off), without changing simulation,
geometry, CSS viewport or readiness. Native-GPU runs retain High; Windows explicitly uses
ANGLE Direct3D11. A renderer probe confirmed **Intel Arc Graphics / D3D11**; the default
headless path otherwise selected SwiftShader. A concurrent High software space run timed
out in the Moon autopilot approach with no console errors; final browsers run serially on
the native adapter. Shader/capture delays in software required 90 s capture/braking limits.
Artifacts are ignored
local screenshots/JSON, not regenerated production assets.

Final native Manaus browser: **PASS, zero browser errors**, five radial samples, three local
views, actual-road crater, ten flight captures and **2,175 observed end-of-frame states**.
One setup at the actual square spawn avoids the monument collider at map zero. Subsequent
movement uses F/Space/V/B and ordinary braking, with no altitude teleports. All states retain
local or aerial visibility, including real overlap; multiple render-origin changes occur.
The nominal labels are flight thresholds; the actual stopped altitudes below include braking.

| Threshold km | Actual km | Local root | Aerial opacity | River / urban / mass / roads GPU submissions |
| ---: | ---: | --- | ---: | --- |
| 0 | 0.001 | visible | 0 | 0 / 0 / 0 / 0 |
| 5 | 6.313 | visible | 0 | 0 / 0 / 0 / 0 |
| 8 | 8.801 | visible | 0.104 | 5 / 7 / 7 / 4 |
| 12 | 13.204 | visible | 1 | 9 / 7 / 7 / 4 |
| 15 | 15.916 | retired | 1 | 11 / 8 / 8 / 6 |
| 20 | 20.998 | retired | 1 | 12 / 9 / 9 / 7 |
| 40 | 41.464 | retired | 1 | 21 / 9 / 0 / 8 |
| 60 | 61.382 | retired | 1 | 34 / 9 / 0 / 8 |
| 100 | 101.521 | retired | 1 | 40 / 9 / 0 / 10 |
| 200 | 201.368 | retired | 0.908 | 45 / 9 / 0 / 10 |

The city/real banks and black/muddy confluence are visible in the 15/100/200 km images.
At 200 km the apparent region measures 161 px, activating the size-based fade. Ground
coverage still gates the exact retirement frame; 15 km remains the requested threshold.
Reproduce final native checks in PowerShell with `$env:DR_BROWSER_GPU='1'`, followed by
`npm run test:browser:manaus`, `npm run test:browser:space`, `npm run test:browser` serially.
Default software tests remain available without the variable. JSON:
`artifacts/manaus-surface-browser.json`; images: `artifacts/manaus-ascent-{0,5,8,12,15,20,40,60,100,200}km.png`.

Full native space browser: **PASS, zero browser errors**, including desktop/mobile map,
keyboard tiers/quaternion controls, Tab/map lock and Moon/Mars autopilot handoff, Jupiter
capture, all C4 impact-policy cases, Sun photosphere/exclusion checks, Moon/Mars/Earth D1
publication and real crater walking, and the D1.2 HIGH minor-impact floor. No short/fresh
mode replaces this full regression. The earlier software timeout was at 7,085 m with
96 m/s relative speed and a ready patch, just above the unchanged 7,000 m handoff gate;
native execution completes it without modifying navigation or physics.

## Manual gate and next work

Native GPU acceptance remains manual: inspect local trees on both shores/islands/Ponta
Negra, dark/muddy Encontro, local→curved overlap, recognition at 15/20/60/100/200 km,
no visible depth flicker or floating flat sheet, origin changes, distant apparent-size fade,
and descent back to local ground. SwiftShader tests cannot certify native GPU appearance.

**STOP at this hotfix.** D1 stays frozen; the supplied U0 universal target/address sprint
waits for manual acceptance. [Universe Map epic](../../specs/UNIVERSE-MAP-COMPLETION-EPIC.md)
remains U0→U1→U2→U3→U4→BH0→BH1→BH2→U5→U6.
