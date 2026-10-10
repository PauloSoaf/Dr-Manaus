# Procedural galaxies and star systems

## Goal

Generate a universe that feels unbounded while keeping known astronomical landmarks and the Solar System authoritative.

The player should be able to:

- leave the Milky Way
- visit Andromeda and other known Local Group objects
- travel farther into generated galaxies
- enter generated galaxies
- see generated star systems
- target generated stars and planets
- collide with generated celestial bodies
- return later and get exactly the same generated content

## Principle — deterministic generation by address

Do not save every generated galaxy or star system.
Generate it deterministically from a stable address and seed.

```text
universeSeed
+ cosmic sector
-> galaxy descriptors

galaxy seed
+ galactic sector
-> star-system descriptors

system seed
-> stars / planets / moons
```

Same address must generate same content on every run and machine within supported deterministic constraints.

## Preserve real landmarks

Known objects should override procedural generation where data is bundled.

Examples:

- Milky Way
- Andromeda
- Triangulum
- Local Group members
- Sagittarius A*
- selected nearby stars
- Solar System
- major large-scale anchors already represented

Procedural generation fills the gaps.

## Galaxy descriptor

Suggested immutable descriptor:

```ts
interface GalaxyDescriptor {
  id: string;
  seed: bigint;
  cosmicSector: CosmicSectorIndex;
  localOffset: Vec3;
  morphology: 'spiral' | 'barred-spiral' | 'elliptical' | 'irregular';
  diameterLy: number;
  thicknessLy: number;
  stellarMassSolar: number;
  orientation: Quat;
  coreProfile: GalaxyCoreProfile;
  armProfile?: SpiralArmProfile;
}
```

## Galaxy generation

Generate only descriptors for galaxies near the current cosmic sector / map query.
Do not instantiate 100 billion stars.

Galaxy macro representation may use:

- deterministic point cloud
- sprite / impostor
- density volume
- procedural arms
- core glow
- dust lanes

The existing `GalaxyProvider` can evolve into a presentation provider consuming `GalaxyDescriptor`.
It should stop being the authority for where a galaxy logically exists.

## Galactic sectors

Keep the existing sector idea but make the galaxy runtime explicit.

Suggested hierarchy:

```text
GalaxyRuntime
  galaxy descriptor
  sector address
  StarSystemCatalogProvider
  StarSectorPresentationProvider
```

The current `StarSectorProvider` already demonstrates bounded scheduler-driven sector streaming.
Retain that pattern.

## Star system generation

A generated sector should not make every star a full system immediately.

Two levels:

1. star descriptor / backdrop
2. full system descriptor when selected or approached

System seed can produce:

- stellar type / mass / radius / luminosity
- multiplicity
- planets
- orbital elements
- moons
- belts
- atmosphere classes
- landability

Use bounded distributions rather than uniform random values.

## Scientific plausibility level

The game does not need full stellar-evolution simulation.
It should avoid obviously impossible combinations where cheap constraints exist.

Examples:

- hotter/more massive stars generally more luminous
- orbital ordering stable
- planet radius/mass class consistent
- giant planets not given rocky walkable surfaces
- moon orbits lie outside parent body

Document which relations are approximations.

## Generated body IDs

Stable IDs should derive from deterministic address, not array index alone.

Example:

```text
galaxy/proc-a12/sector/-10,4,7/system/92/body/planet-3
```

Human display name can be generated separately.

## Generated system runtime

Do not copy the Solar System hardcoded class for every generated system.
Generalize the existing celestial runtime interface.

Solar remains a curated `CelestialSystemRuntime` implementation.
Procedural systems emit the same interface:

- `bodies`
- `positionOf`
- `stateOf`
- `dominantBody`
- frame registration

Navigation then works generically.

## Body collision metadata

Generated system creation must output physical collision data before rendering:

- radius
- mass
- body class
- parent id
- landability
- atmosphere
- collision envelope profile

Thus a generated planet is collidable even while represented by a distant proxy.

## Generated surface strategy

Do not generate high-detail terrain for every procedural planet in the galaxy.

Stages:

```text
distant proxy
-> coarse globe
-> procedural surface quadtree on approach
-> local terrain only near landing
-> volume field only when destruction/underground interaction requires it
```

## Procedural terrain

Future generated rocky surfaces can use deterministic multi-scale functions, but maintain the same surface contract used by `PlanetSurfaceGenerator`.

Needed methods:

- directional radius
- surface color/material profile
- coarse detail generation

Then the existing rocky provider architecture can be reused.

## Procedural galaxies far away

At universe-map scale, generate galaxies in cosmic cells using a density field.

A simple first approach:

- seeded low-frequency noise / hash field
- sample number of galaxies per cell
- bias density into filaments / clusters
- morphology based on environment and mass

A more advanced approach can generate a cosmic web skeleton, but do not block basic exploration on it.

## Large-scale structure

The existing `LargeScaleStructureProvider` already names Local Group / Virgo / Great Attractor / Shapley anchors.
Treat these as curated anchors over the procedural density background.

Do not position the full universe in one Float32 scene.

## Inspiration from public/open-source projects

### Pioneer Space Simulator

Useful concept:

- enormous explorable galaxy
- procedural star systems
- deterministic content
- landable planets

Study architecture and algorithms, but review its license before copying code.

### Celestia

Useful concept:

- catalog separation between Solar System bodies, stars and deep-sky objects
- high-precision universe coordinates
- observer-centric rendering architecture

### OpenSpace

Useful concept:

- visualization across astronomical scales
- separation of data and visual representation
- entire-known-universe navigation / rendering ideas

### Space Nerds In Space

Useful concept:

- open source space-game approaches to generated space environments

Use these as design references, not drop-in code.

## Persistence

Persist only mutations and player discoveries.

Generated static content is regenerated from seed.

Persist:

- renamed/discovered objects
- destroyed body state
- volume edits
- mission state
- player bases / constructions

Do not persist untouched generated systems.

## Tests

- same seed/address -> same galaxy descriptor
- neighboring sector generation independent of traversal order
- known galaxy override stable
- same galaxy/system seed -> same bodies
- generated orbital states finite
- generated bodies have collision metadata
- generated system navigation works through generic target path
- generated distant galaxy uses bounded render coordinates
- leaving and returning regenerates identical descriptors
