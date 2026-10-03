# Test matrix

This matrix is a planning contract. Each sprint implements only the tests relevant to its scope.

## Celestial CCD

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T001 | Every Solar body emits a finite exclusion envelope | required | when integration-facing | targeted |
| T002 | Segment crossing catches Earth | required | when integration-facing | targeted |
| T003 | Segment crossing catches Moon | required | when integration-facing | targeted |
| T004 | Segment crossing catches Mars | required | when integration-facing | targeted |
| T005 | Segment crossing catches Jupiter | required | when integration-facing | targeted |
| T006 | Segment crossing catches Saturn | required | when integration-facing | targeted |
| T007 | Segment crossing catches Uranus | required | when integration-facing | targeted |
| T008 | Segment crossing catches Neptune | required | when integration-facing | targeted |
| T009 | Segment crossing catches Sun | required | when integration-facing | targeted |
| T010 | Tangent pass does not false-positive | required | when integration-facing | targeted |
| T011 | Earliest of multiple bodies wins | required | when integration-facing | targeted |
| T012 | Body-relative speed is used | required | when integration-facing | targeted |
| T013 | Locked target uses safe response | required | when integration-facing | targeted |
| T014 | Unlocked target emits impact event later | required | when integration-facing | targeted |

## Local terrain CCD

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T015 | Moon 120 FPS descent | required | when integration-facing | targeted |
| T016 | Moon 60 FPS descent | required | when integration-facing | targeted |
| T017 | Moon 30 FPS descent | required | when integration-facing | targeted |
| T018 | Mars fast descent | required | when integration-facing | targeted |
| T019 | Diagonal terrain sweep | required | when integration-facing | targeted |
| T020 | No false contact above surface | required | when integration-facing | targeted |
| T021 | Tangential velocity preserved | required | when integration-facing | targeted |
| T022 | Inward velocity removed | required | when integration-facing | targeted |
| T023 | Grounded state after contact | required | when integration-facing | targeted |
| T024 | No Manaus collider dependency | required | when integration-facing | targeted |
| T025 | Surface provider body id matches active body | required | when integration-facing | targeted |
| T026 | Terrain height finite at contact | required | when integration-facing | targeted |

## Target lock

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T027 | Tab selects object under reticle | required | when integration-facing | targeted |
| T028 | Tab ignores object outside cone | required | when integration-facing | targeted |
| T029 | Tab cycles overlapping candidates | required | when integration-facing | targeted |
| T030 | Shift+Tab reverse cycles | required | when integration-facing | targeted |
| T031 | Occluded candidate loses | required | when integration-facing | targeted |
| T032 | Lock survives ephemeris movement | required | when integration-facing | targeted |
| T033 | Clearing lock returns manual control | required | when integration-facing | targeted |
| T034 | HUD target matches Game target | required | when integration-facing | targeted |
| T035 | Map target matches HUD target | required | when integration-facing | targeted |
| T036 | Map selection never teleports | required | when integration-facing | targeted |

## Autopilot

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T037 | Alignment phase | required | when integration-facing | targeted |
| T038 | Acceleration phase | required | when integration-facing | targeted |
| T039 | Warp cruise | required | when integration-facing | targeted |
| T040 | Braking phase | required | when integration-facing | targeted |
| T041 | Warp dropout | required | when integration-facing | targeted |
| T042 | Terminal approach | required | when integration-facing | targeted |
| T043 | Capture rocky body | required | when integration-facing | targeted |
| T044 | Capture gas giant standoff | required | when integration-facing | targeted |
| T045 | Capture star safe radius | required | when integration-facing | targeted |
| T046 | Moon handoff only at local-safe speed | required | when integration-facing | targeted |
| T047 | Moving target live resolution | required | when integration-facing | targeted |
| T048 | X cancels safely | required | when integration-facing | targeted |

## Impact

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T049 | Low-speed impact | required | when integration-facing | targeted |
| T050 | High-speed impact | required | when integration-facing | targeted |
| T051 | Catastrophic threshold | required | when integration-facing | targeted |
| T052 | Locked target cannot accidental-catastrophe | required | when integration-facing | targeted |
| T053 | Unlocked >=1c gameplay catastrophe policy | required | when integration-facing | targeted |
| T054 | Grazing impact classification | required | when integration-facing | targeted |
| T055 | Direct radial impact classification | required | when integration-facing | targeted |
| T056 | One event per crossing | required | when integration-facing | targeted |
| T057 | Catalog immutability | required | when integration-facing | targeted |
| T058 | Runtime integrity state mutation | required | when integration-facing | targeted |

## Volume destruction

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T059 | Sphere edit invalidates local chunks | required | when integration-facing | targeted |
| T060 | Capsule edit remains one operation | required | when integration-facing | targeted |
| T061 | Remesh affected chunk | required | when integration-facing | targeted |
| T062 | Mesh cache bounded | required | when integration-facing | targeted |
| T063 | Collision cache bounded | required | when integration-facing | targeted |
| T064 | No intact ghost floor in cavity | required | when integration-facing | targeted |
| T065 | Wall collision | required | when integration-facing | targeted |
| T066 | Ceiling collision | required | when integration-facing | targeted |
| T067 | Through-body sparse residency | required | when integration-facing | targeted |
| T068 | Persistence stores edits not meshes | required | when integration-facing | targeted |

## Procedural systems

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T069 | Seed repeatability | required | when integration-facing | targeted |
| T070 | Traversal-order independence | required | when integration-facing | targeted |
| T071 | Known star override | required | when integration-facing | targeted |
| T072 | Generated system finite orbits | required | when integration-facing | targeted |
| T073 | Generated body physical metadata | required | when integration-facing | targeted |
| T074 | Generated collision envelope | required | when integration-facing | targeted |
| T075 | System unload/reload identity | required | when integration-facing | targeted |
| T076 | Generated target lock | required | when integration-facing | targeted |
| T077 | Generated map entry | required | when integration-facing | targeted |
| T078 | Generated landing capability based on profile | required | when integration-facing | targeted |

## Procedural galaxies

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T079 | Cosmic-sector repeatability | required | when integration-facing | targeted |
| T080 | Known galaxy override | required | when integration-facing | targeted |
| T081 | Morphology deterministic | required | when integration-facing | targeted |
| T082 | Orientation deterministic | required | when integration-facing | targeted |
| T083 | Macro render bounded | required | when integration-facing | targeted |
| T084 | Galaxy unload/reload identity | required | when integration-facing | targeted |
| T085 | Cross-galaxy target address | required | when integration-facing | targeted |
| T086 | Target galaxy prefetch | required | when integration-facing | targeted |
| T087 | Galaxy arrival handoff | required | when integration-facing | targeted |
| T088 | No 50k point cloud authority for logical coordinates | required | when integration-facing | targeted |

## Cosmic coordinates

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T089 | Negative BigInt sectors | required | when integration-facing | targeted |
| T090 | Sector-boundary continuity | required | when integration-facing | targeted |
| T091 | Galaxy local offset precision | required | when integration-facing | targeted |
| T092 | System barycentric precision | required | when integration-facing | targeted |
| T093 | Render coordinates bounded | required | when integration-facing | targeted |
| T094 | No astronomical Object3D absolute position | required | when integration-facing | targeted |
| T095 | Observable horizon finite | required | when integration-facing | targeted |
| T096 | Reference origin not physical center | required | when integration-facing | targeted |
| T097 | Andromeda address stable | required | when integration-facing | targeted |
| T098 | Hypercruise cancel leaves valid address | required | when integration-facing | targeted |

## Performance

| ID | Test | Automated | Browser | Manual |
| --- | --- | --- | --- | --- |
| T099 | Global scheduler budget honored | required | when integration-facing | targeted |
| T100 | No second private scheduler | required | when integration-facing | targeted |
| T101 | High-speed route prefetch bounded | required | when integration-facing | targeted |
| T102 | Volume resident caps | required | when integration-facing | targeted |
| T103 | Volume mesh caps | required | when integration-facing | targeted |
| T104 | Galaxy sector caps | required | when integration-facing | targeted |
| T105 | Descriptor cache separate from render cache | required | when integration-facing | targeted |
| T106 | Target priority does not starve local critical work | required | when integration-facing | targeted |
| T107 | Soak travel does not leak geometries | required | when integration-facing | targeted |
| T108 | Dispose releases buffers | required | when integration-facing | targeted |

## Frame-rate matrix

All continuous-collision tests must be repeated at fixed dt values:

- 1/120 s
- 1/60 s
- 1/30 s

## Speed matrix

- ordinary local flight
- high-speed local descent
- sublight interplanetary
- 1c
- 16c
- 256c
- future hypercruise domain

## Body-class matrix

- star
- rocky
- rocky moon
- icy moon proxy
- atmospheric moon proxy
- gas giant
- ice giant
- black hole special domain

## Manual QA principle

Automated smoke can establish state transitions and collision invariants, but final presentation, control feel, apparent stopping distance, scale readability and explosion readability still require gameplay inspection.
