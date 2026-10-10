# IMPACT-DESTRUCTION-P0 — local Manaus — 2026-10-06

Baseline: `267caf5d0a8c6ce435e16270c165965bec7c2445`, branch `feat/universe-map`.
The latest user attachment authorizes this local checkpoint before D1, including documentation,
commit and push. C4 celestial events remain diagnostic; D0 remains an isolated volume lab.
No `CelestialImpactEvent` reaches `PlanetVolumeEditStore`, and no planetary destruction is added.

## Contact and footprint authority

`PlayerController` snapshots velocity before `PhysicsWorld.move()` responds. Landing resolution
uses `lastTerrainContact.normal` and its swept position, rather than world-Y descent or the
post-response endpoint. Only the transition into grounded state produces the consumable impact.
`MeteorImpact.ts` resolves one immutable-by-contract, pure `ImpactFootprint`; derived aliases
retain compatibility with existing animation/power consumers.

For normalized contact normal n and pre-response velocity v:

```
normal = max(0, -dot(v,n))
tangent = length(v - n*dot(v,n))
impactSpeed = normal + 0.6*tangent
energy = impactSpeed * max(1,size)^0.75 * (slam ? 2.2 : 1)
envelope = 1200 * (1 - exp(-0.0013 * energy^0.65))
excavationGain = min(1, sqrt(normal/12))
craterRadius = envelope * excavationGain
craterDepth = min(600, envelope*(0.45 + 0.05*envelope/1200)*excavationGain)
core = 1.05*craterRadius
blast = 1.5*envelope
impulseRadius = 2*envelope
reactionRadius = 2.3*envelope
```

The swept-contact minimum inward speed is 0.05 m/s. A fallback without a swept contact retains
the 12 m/s normal gate. Tiers below energy 70 have no excavation, destructive blast or impulse:
size-1 walking, kerbs, ordinary jump (9.5 m/s), double jump (17.4 m/s) and heavy falls remain safe.
The pure `resolveImpact(speed)` table below represents direct incidence, with excavationGain=1.
Soft/heavy animation and bounded sound/VFX remain available.

| Direct speed, size 1 | Old crater radius/depth m | New crater radius/depth m | New blast m | New impulse radius m |
| --- | --- | --- | --- | --- |
| 260 m/s | 19.16 / 8.62 | 56.55 / 25.58 | 84.82 | 113.10 |
| 800 m/s | 35.56 / 15.99 | 114.43 / 52.04 | 171.65 | 228.87 |
| 8,000 m/s | 126.17 / 56.72 | 433.06 / 202.69 | 649.58 | 866.11 |
| 50,000 m/s | 345.68 / 155.42 | 924.98 / 451.89 | 1,387.47 | 1,849.96 |
| Extreme finite speed | caps 640 / 180 | caps 1,200 / 600 | cap 1,800 | cap 2,400 |

Old radius was `min(640, 0.9*energy^0.55)` and depth was the actual terrain formula,
`min(180, radius*(0.36 + 0.28*0.32))`.
Old blast/impulse both used the crater radius. New structural damage retains the established
`900*energy^0.85*tier.damageGain` curve; its blast falloff is squared remaining normalized distance.
The zones are gameplay policy, not a claim of energy conservation or a planetary impact model.

`(8000,-20,0)` against upward ground normal now transfers 4,820 m/s, with substantial excavation;
direct 8,000 m/s remains stronger. `(8000,-0.1,0)` transfers lateral blast while excavation gain
is about 0.091: depth stays below 20 m. Perfect tangency produces no landing crater. A tilted
normal yields the same result when velocity/normal are rotated together.

## Terrain and visual agreement

`Game.applyLocalImpact()` is the local authority used by the PowerSystem impact hook. It sends
explicit crater radius/depth to `DestructionSystem.impactAt()` and the existing TerrainDestruction,
then applies the footprint's actor response/impulse. The crater alias never controls blast damage.
The non-Manaus `canDeformSurface=false` path retains only its bounded stylized effect.

Terrain remains one 257×257 grid, 4,479,020 bytes, with at most 4,096 m span. Height, indexed bowl
triangles, quantization, road/sheet mask, normals, bounds and raycast use the same sampled field.
Only the excavated ground/road pixels are clipped. The surrounding road retains its geometry.
No dark flat decal substitutes for the floor. Centre and 25/50/75%-radius physics/rays are compared
against actual rendered mesh intersections, including 50 km/s and the 1,200/600 m capped case.

Equivalent repeated impacts add bounded cubic excavation capacity:
`Rnew=min(1200,cbrt(Rold³+Rhit³))`, `Dnew=min(600,cbrt(Dold³+Dhit³))`.
The existing nearby-crater association retains its anchor. This widens/deepens repeated strikes
without summing radii linearly. Existing beam/plough callers keep the legacy depth derivation.

## Entity routing, categories and budgets

The core tests closest XZ footprint distance, so tall buildings and any intersecting tree/furniture
part are guaranteed removal. This is a ground shockwave, not an isotropic aerial blast. Multipart
IDs select their nearest intersecting bound and are damaged once. Fragile/vegetation health is at
most 80; vehicle health at most 240; building/landmark health retains bounded volume scaling.
Categories are fragile, vegetation, vehicle, light-structure, building and landmark. ID family
classification belongs to owner adapters; the structural solver uses category/kind metadata.

| Owner | Local impact behavior | Reconstruction |
| --- | --- | --- |
| RealCity/WorldStreamer buildings | core force-removal; blast falloff; owner removes geometry/collider | existing per-owner restore |
| Procedural trees | resident detailed chunk query; trunk and associated canopy instances removed together | existing chunk restore |
| RoadNetwork trees/lamps | existing vertex spans remove trunk/canopy or complete post/arm/head; explicit category/count | existing staged road rebuild |
| Largo trees | trunk, canopy and planter share ID; actual part bounds | registry restores all bindings |
| Largo lamps/furniture | post/head, seat/legs, table/leg, chair/back, parasol/pole, stall/body/roof/posts and bins registered | registry restores all parts |
| Population props | stable prop IDs routed to `PopulationManager.destroy`; matrix and collider removed | reset base pose and velocity |
| Population NPCs | core disables; heavy blast knocks out with bounded velocity; outer impulse/reaction flees | explicit reset/reactivation |
| Traffic | core/blast wreck plus outer impulse in existing visible car pool; falls onto current terrain | no car reconstruction |

Cheap authored bounds used only for blast do not expand the ordinary movement broadphase;
the existing Largo trunk movement collider is preserved. RoadNetwork already owned destructive
lamp/tree spans; this patch classifies them and includes their complete blast accounting.
The procedural query visits bounded resident chunk records, including detailed collider lists
outside the movement selection; it never generates an unloaded Manaus neighborhood. RealCity
continues its indexed query and authored inventories query their resident bindings.
ForestBackdrop is distant presentation and intentionally has no local destruction authority.

Heavy structures share the existing 16-collapse frame budget. Local impacts retire vegetation,
fragile props and vehicles on a separate cheap path, capped at 1,024 per frame with at most four
debris pieces each and no per-prop scar. Core candidates precede the outer wave. Ordinary beam/
plough callers retain their original structural budget. Separate heavy/light queues avoid making
an immediately removable lamp wait behind a thousand buildings. Both retain all surplus IDs.
Regressions cover immediate complete core furniture removal, overflow of the cheap budget,
and eventual retirement of 65,600 heavy entities beyond the former silent 65,536-entry cutoff.
Queue entries retain captured resident IDs until processed, even if streaming later evicts their
geometry. There is no independent hard queue-memory ceiling that discards hits; resident query
limits constrain each event, and ID deduplication prevents repeated hits duplicating pending work.
Debris/scar pools remain bounded. Reconstruction cancels both queues and accumulated damage
before restoring intersecting owners.

Game opens this budget before player movement; the later destruction update does not reset it.
Movement/plough, queue draining and new impacts therefore share the same animation-frame cap.
A dedicated regression consumes the budget across all three phases and checks the next frame.

NPC render capacity remains 40 bodies + 40 heads, with one shared render dummy. Records use
`npc:cell:slot` identities and fixed position/velocity/state data; no per-person Object3D/rigid body.
Knocked bodies remain visible briefly (8 s), then hide; NPCs explicitly reconstruct. Surviving
props/NPCs fall toward `PhysicsWorld.terrainHeight`, rather than standing on the former street.
Local destruction history is in memory, capped at 4,096 IDs; eviction permits eventual recycling.
Traffic capacity stays 256 slots, velocity is capped at 110 m/s, and wrecks retain the existing
25 s/cull-radius lifecycle. Impulse changes velocity, not position. Cars are recycled, not restored.
Their event count includes new wrecks created by impulse before structural queue retirement.
Returning NPCs absorb their walking-cycle offset into the base pose, avoiding a position jump
when a fleeing/knocked response expires; continuity is covered by a dedicated regression.

Wave, flash, dust, shake and sound consume the same footprint. Existing effect pools remain;
flash ≤360 m, actual dust launch speed ≤180 m/s, debris request ≤90, shake ≤5 and impulse
strength ≤4,200. Dust origins cover 85% of the crater radius, with scale capped at 50. Structural
entulho samples the current terrain floor rather than bouncing at the former street level.
The fixture registers ground scars/sidewalks with the same mask attachment used in Game.
F3 exposes contact normal/tangent/speed, energy, R/D, all four zones, queried entities, buildings,
trees, props, lamp subset, vehicle wrecks, affected NPCs and the current pending queue.

## Automated evidence

Typecheck PASS; focused 145/145 (55 new impact cases); full 886/886; production build PASS.
All 37 required `T_IMPACT_*` cases are present, plus low-speed/shallow grazing, reconstruction,
resident-only queries, all instance ownership, power dispatch/protected planetary effects,
extreme finite values, capped geometry and queue-overflow regressions.
Browser local PASS (real city, production impact fixture, departure and reentry); Manaus PASS
(five radial samples, three aerial views, actual-road crater); space PASS after the fixture
correction below (controls, Moon/Mars F/local CCD, navigation lock and all five C4 cases).
All three report zero browser page/console errors. Staged/working diff checks PASS. The CI
checks for implementation and fixture correction are linked under Delivery below.

The final space smoke first stopped in the C4 fixture setup with no browser page/console errors:
the previous asynchronous scenario had returned to local mode, where `TravelDomain.setState`
correctly ignores a replacement. The fixture now enters via the existing production travel
gate and seeds its own observer state before sampling production envelopes. This only changes
test setup; it does not change C4 policy, the travel gate or gameplay collision.

`scripts/local-impact-browser-checkpoint.mjs` extends the existing local browser runner.
Its deterministic fixture uses production Largo props/registry, RoadNetwork, ChunkMeshes/
WorldStreamer, PopulationManager and TrafficSystem, including small/tall/wide/outside buildings.
It temporarily routes through the actual running Game adapter and drains the queue before
restoring the original owners. Browser snapshots/rays and a real PlayerController.update swept
landing are automatic evidence; they are not claimed as human gameplay acceptance.

The production fixture removes all 1,013 bound furniture mesh parts. Its one direct 8 km/s
event queries 600 entities and records 41 buildings, 118 trees, 439 props (including 135 lamps),
two vehicle wrecks and four affected NPCs (one disabled, one knocked, two fleeing). The outside
building survives. Peak pending work is 25 and drains to zero. Raycast/physics floor samples
agree at the centre and 25/50/75% radius; scar/sidewalk masking is attached as in Game.
The real player oblique test reaches contact at x=37.02585 m using pre-response normal
20.41667 m/s and tangential 7,559.27189 m/s; its crater is 320.27840 / 148.39937 m.
Both overview and bowl snapshots were visually inspected. Artifacts are local, ignored outputs:
`artifacts/impact-local-browser.json`, `impact-local-overview.png`, `impact-local-bowl.png`.

Benchmark: `npm run benchmark:impact`, controlled blast radii with the same fixed resident inventory.
Numbers below are one local run; timings are observational, with no wall-time CI assertion.

| Blast m | Raw candidates | Eligible IDs | Query ms | Immediate / queued | Retired / final queued | Terrain build ms |
| --- | --- | --- | --- | --- | --- | --- |
| 50 | 334 | 130 | 0.670 | 130 / 0 | 130 / 0 | 1.910 |
| 200 | 1,082 | 520 | 0.432 | 495 / 25 | 520 / 0 | 19.291 |
| 500 | 1,147 | 585 | 0.464 | 559 / 25 | 584 / 0 | 23.755 |
| 1,000 | 1,200 | 639 | 0.245 | 612 / 26 | 638 / 0 | 5.050 |

Raw candidates include multipart bounds; eligible IDs deduplicate. Immediate/retired totals include
the separate cheap path. They omit impulse-only cars and objects receiving only partial edge damage. Thus
eligible and retired counts need not match; all scheduled removals retire or acknowledge an
already removed owner. Terrain allocation is 4,479,020 bytes in every row.

## Delivery and remote validation

Implementation commits on `feat/universe-map`:

- `3db74b53cb02b400894bbf1611b0caebbeb80d52`: contact footprint, terrain curve and crater geometry.
- `b4cb453a3ca510ac6af66d74217bf53ed662b4cd`: shared blast routing, complete owner retirement,
  actor response, production fixture and browser/benchmark coverage.
- `c0e83704e7802339be5e24f09bf7e8660a8eb82d`: frame-wide budget and NPC response continuity.
- `c1ea11c7d3c6250d4e7373fb98b3c145ced1b2cc`: independent C4 browser fixture entry precondition.

GitHub Actions **PASS** on the exact implementation SHA `c0e83704e7802339be5e24f09bf7e8660a8eb82d`:
[Unit, types and build](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/37532614651/job/112505503892).
The browser fixture correction SHA `c1ea11c7d3c6250d4e7373fb98b3c145ced1b2cc` also has
[Unit, types and build PASS](https://github.com/PauloSoaf/Dr-Manaus/actions/runs/37534448624/job/112511730561).
The final documentation commit's exact HEAD/check run is verified after push and reported in
the delivery response.

## Manual acceptance and stop

Human acceptance remains pending. Test size-1 walking/jumps/kerbs; direct 260/800/8,000/50,000 m/s
and oblique 8,000 m/s impacts; shallow skimming; repeated strikes; F3 radii/counts; ground/road
edges and bowl floor; trees and complete street furniture; NPC/cars; and reconstruction after a
large queued blast. Check at 30/60/120 FPS where practical. Keep a reference object at the lip.
Confirm that Earth departure, Moon/Mars F landing, C4 events and the D0 lab still work.

**STOP after this checkpoint for manual acceptance. D1, planetary edits, breakup states,
gas-giant/star destruction and all other universe feature expansion remain unauthorized.**
