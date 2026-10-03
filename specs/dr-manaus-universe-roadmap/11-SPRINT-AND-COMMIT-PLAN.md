# Sprint and commit plan

## Rules

Every sprint has:

1. baseline HEAD
2. narrow scope
3. failing regression or measurable gap
4. implementation
5. focused tests
6. full tests
7. build
8. browser smoke where appropriate
9. manual validation list
10. stop

Do not chain the next sprint automatically.

---

# Sprint C0 — CELESTIAL-CCD-P0

Priority: P0

Goal:

- stop Moon high-speed tunnelling
- make local terrain contact continuous
- preserve high-speed broad sweep for all 19 current bodies

Suggested commits:

1. `fix(physics): add swept planetary terrain contact`
2. `fix(travel): gate local handoff by safe inward speed`
3. `test(travel): cover high-speed celestial and lunar contact`

Gate:

User manually fails to cross Moon at slow, fast and absurd speed.

---

# Sprint C1 — TARGET-LOCK

Priority: P1

Goal:

- Tab acquires celestial body under reticle
- HUD persistent lock
- no autopilot yet

Suggested commits:

1. `feat(travel): rank celestial lock candidates from live system state`
2. `feat(ui): add persistent celestial target lock HUD`
3. `test(travel): cover target acquisition and cycling`

Gate:

User can reliably lock Moon, Mars, Jupiter and Sun by looking at them.

---

# Sprint C2 — AUTOPILOT-CAPTURE

Priority: P1

Goal:

- engage assisted travel to locked target
- accelerate, brake, drop warp, stop safely

Suggested commits:

1. `feat(travel): add target capture phases and warp dropout`
2. `feat(travel): add body-class terminal approach policies`
3. `test(travel): cover assisted arrival across body classes`

Gate:

Locked target cannot be hit catastrophically by autopilot.

---

# Sprint C3 — MAP-LOCK

Priority: P1

Goal:

- map selection uses same lock authority
- map can engage autopilot

Suggested commits:

1. `feat(ui): unify map selection with navigation lock`
2. `test(ui): verify map lock identity and no teleport`

Gate:

Select Mars in map, close map, HUD remains locked on live Mars.

---

# Sprint C4 — IMPACT-POLICY

Priority: P1/P2

Goal:

- unlocked impacts emit deterministic event
- body-relative speed classification
- no planet destruction yet

Suggested commits:

1. `feat(travel): emit celestial impact events from CCD contacts`
2. `feat(world): classify celestial impact severity by body capability`
3. `test(world): cover unlocked relativistic impact classification`

Gate:

At >= configured catastrophic threshold the event is emitted exactly once and no body is numerically crossed.

---

# Sprint D0 — VOLUME-COLLISION

Priority: P1 for destruction roadmap

Goal:

- collision on Phase 3 meshes
- floors/walls/ceilings
- no powers yet

Suggested commits:

1. `feat(volume): build local collision acceleration for resident meshes`
2. `feat(physics): add volume collision field contract`
3. `test(volume): walk floor wall and ceiling in isolated volume fixture`

Gate:

Player can stand inside a test cavity and cannot pass through its wall.

---

# Sprint D1 — LOCAL-IMPACT-DESTRUCTION

Goal:

- low/major rocky impact creates sparse volume edit
- async chunk + mesh + collider rebuild

Suggested commits:

1. `feat(destruction): map rocky impact event to volume edit`
2. `feat(volume): atomically swap remeshed collision coverage`
3. `test(destruction): verify crater edit render and collision`

Gate:

Impact crater is visible and walkable with no ghost intact ground.

---

# Sprint D2 — PENETRATING-IMPACTS

Goal:

- high-energy local impact can create capsule channel
- still sparse

Gate:

One long impact/tunnel remains one logical edit and finite local residency.

---

# Sprint D3 — CELESTIAL-INTEGRITY

Goal:

- runtime body integrity overlay
- fractured/disrupting/debris states

Gate:

Catalog remains immutable; destruction state persists separately.

---

# Sprint D4 — CATASTROPHIC-ROCKY-BODY

Goal:

- direct catastrophic impact can transition a rocky body into fractured/debris representation

Gate:

No whole-planet voxelization; bounded macro fragments and local detail only.

---

# Sprint D5 — GIANT/STELLAR-DESTRUCTION

Goal:

- separate non-rocky catastrophic models

Gate:

No rocky volume chunks allocated for Jupiter or Sun.

---

# Sprint S0 — SOLAR-COLLISION-AUDIT

Goal:

- confirm all current system bodies visible and collidable by class
- verify map + labels + target lock

Gate:

Automated body matrix covers every current body.

---

# Sprint U0 — UNIVERSAL-NAVIGATION-ADDRESS

Goal:

- hierarchical target identity outside Solar System

Suggested commits:

1. `feat(universe): add hierarchical navigation addresses`
2. `feat(travel): adapt Solar targets to universal addresses`
3. `test(universe): cover cross-domain target identity`

---

# Sprint U1 — PROCEDURAL-STAR-SYSTEMS

Goal:

- deterministic generated systems in Milky Way sectors

Gate:

Same sector seed produces same system set after unload/reload.

---

# Sprint U2 — GALAXY-RUNTIME

Goal:

- make galaxy descriptors logical authorities
- existing GalaxyProvider becomes presentation consumer

Gate:

Andromeda and procedural galaxy share the same address/runtime interface.

---

# Sprint U3 — INTERGALACTIC-HYPERCRUISE

Goal:

- target-based cross-galaxy travel in seconds, not millennia

Gate:

Milky Way -> Andromeda continuous progress, bounded renderer, deterministic arrival.

---

# Sprint U4 — PROCEDURAL-GALAXIES

Goal:

- generated galaxies far beyond curated Local Group

Gate:

Same cosmic sector regenerates same galaxies; no global list required.

---

# Sprint U5 — COSMOLOGICAL-MAP

Goal:

- clusters, large-scale structure and observer-relative horizon

Gate:

No feature labels a physical “center of universe” as scientific fact.

---

# Sprint U6 — OBSERVABLE-HORIZON-TRAVEL

Goal:

- navigate toward CMB / observable horizon visualization

Gate:

No invisible wall presented as literal end of all space.

---

# Sprint P0 — PERSISTENCE

Goal:

- persist body mutation, universe discoveries, destruction edits

Gate:

Generated caches are never serialized as authoritative content.

---

# Sprint Q0 — CI

Goal:

Publish:

- typecheck
- full unit suite
- targeted volume/travel tests
- production build
- browser space smoke
- browser volume smoke
- deterministic generation smoke

The repository currently has no GitHub commit statuses/workflow runs on the audited branch.
This sprint makes verification visible remotely.
