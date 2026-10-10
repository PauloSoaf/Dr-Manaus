# DR Manaus - Universal Map & Infinite Teleport Specs v2

Audited repository state:

```text
repo: PauloSoaf/Dr-Manaus
branch: feat/universe-map
HEAD: 40758f1ec22676c6ede429457aa7a24a93d37430
previous baseline used by v1: f5afb4d148b8040ce367ea2463bdcbb4695f1ea5
```

This v2 supersedes the previous Universal Map / Infinite Teleport package.

The branch changed significantly after v1. Current foundations include:

```text
InterplanetaryController
EarthTransitionController
SurfaceFrameService
MoonProvider
GalaxyProvider
BlackHoleProvider
LargeScaleStructureProvider
ManausSubsystem
StarSectorProvider
```

Some are useful foundations. Some are not correct enough yet to become navigation truth.

Rule:

```text
Do not build universal navigation on top of incorrect spatial authority.
```

Reading order:

```text
01-CURRENT-HEAD-AUDIT.md
02-P0-PREFLIGHT-FIXES.md
03-UNIVERSAL-MAP-UX.md
04-COORDINATE-MODEL.md
05-INFINITE-TELEPORT.md
06-DESTINATION-PREPARATION-HANDOFF.md
07-COSMIC-TARGET-HARDENING.md
08-TESTS-ACCEPTANCE.md
09-CLAUDE-MASTER-PROMPT.md
```
