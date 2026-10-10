# Coordinates and reference frames

Implements `03-COORDINATES-AND-REFERENCE-FRAMES.md`. Code: `src/world/spatial/`.
Tests: `tests/wgs84.test.ts` (14), `tests/reference-frames.test.ts` (11),
`tests/floating-origin-3d.test.ts` (9).

None of this imports Three.js. It is arithmetic, and it is tested as arithmetic.

## Why position is not a `Vector3`

A double carries 53 bits of mantissa. That is millimetres on a building *or* light years between
stars, never both: adding one metre to 10²⁶ metres changes nothing at all. And whatever the CPU
holds, vertex positions reach the GPU as float32, which runs out at about seven digits.

So a position here is a **frame plus a number**, and the number stays small inside its frame.

```
universe                logical, hierarchical, high precision
   │
   ▼
active reference frame  what the player currently belongs to
   │
   ▼
render-local            small metres, near zero, safe for float32
   │
   ▼
Three.js scene          never large
```

## Units and guards — `units.ts`

`Vec3` and `Quat` are tuples, not classes, so they cost nothing to pass and can be pooled by the
caller. Every entry point runs `finite()`: one `NaN` reaching a transform propagates into every
position derived from it, and it is far cheaper to reject it where it enters.

Constants are exact where the definition is exact: `AU_M = 149 597 870 700` and
`LIGHT_YEAR_M = 9 460 730 472 580 800` are definitions, not measurements, so they are written out
rather than computed. `PARSEC_M` is derived from the AU, because that is how it is defined.

`quatFromBasis` builds a quaternion from three orthonormal axes by Shepperd's method — pick the
largest diagonal term first — because the naive trace formula divides by something near zero for
half of all rotations, and a planet tile is exactly the case that hits it.

## WGS84 — `WGS84.ts`

The **defining** constants, not derived approximations:

```
a  = 6 378 137 m        semi-major axis, exact by definition
1/f = 298.257 223 563   inverse flattening, exact by definition
```

Everything else follows: `b`, `e²`, `e'²`, the prime-vertical radius `N(φ)`, the meridional radius
`M(φ)`, and the geocentric radius. Keeping them derived means there is one place to be wrong.

The ellipsoid is not a detail. A degree of latitude is about 110 574 m at the equator and
111 694 m at the pole — a 1% spread — and treating the planet as a sphere puts a tile kilometres
from where it belongs.

## ECEF — `ECEF.ts`

Geodetic to Earth-Centred Earth-Fixed is closed form. The inverse is not: latitude appears on both
sides. The implementation seeds with Bowring's formula and runs four Newton iterations, which is
enough to converge to sub-millimetre from the surface out to geostationary altitude — the test
asserts exactly that, over a set of points including both poles and the antimeridian.

The pole is guarded explicitly. At `x = y = 0` the longitude is undefined and the usual `atan2`
answer is whatever the sign of a zero happens to be.

## ENU — `ENU.ts`

A local tangent plane at an anchor: east, north, up. This is the bridge between a planet-sized
frame and a game that thinks in metres — the city lives in one of these.

## Frames — `ReferenceFrame.ts`, `ReferenceFrameGraph.ts`

Frames form a tree. Each knows where its origin sits inside its parent and how its axes are rotated
relative to it. Converting between two frames walks up to their lowest common ancestor and back
down, so a position in Manaus converted to Earth-fixed never touches the galactic numbers and never
loses precision to them.

```
solar-system/barycentric
└── solar-system/earth-inertial
    └── earth/fixed
        └── earth/manaus/legacy-enu      ← the compiled city
```

`ReferenceFrameGraph` refuses, loudly, the four mistakes that would otherwise corrupt a position in
silence: an unknown frame, two frames in unconnected trees, a cycle, and a frame parented to
itself. It exposes `convertPosition`, `convertDirection` and `convertOrientation` — directions skip
the translation, orientations compose only the rotation.

## Floating origin — `FloatingOrigin3D.ts`

The game already rebased X and Z every 2 048 m. That is enough while the sky is a ceiling. Flying
off the planet makes Y just as large, and reaching another body changes the frame itself.

`FloatingOrigin3D` quantises to a grid on all three axes and carries the frame with the origin.
The invariant, asserted directly by the tests:

> **A rebase never moves anything logically.**

It changes only the numbers the renderer and the local physics see. Distances between objects are
unchanged; the origin carries no rotation, so nothing can be tilted by one; the camera does not
move; velocity does not change. Listeners receive a `RebaseEvent` carrying `localDeltaM`, the
offset to add to any render-local position they had stored.

Across a **frame change** the delta is reported as zero rather than as a difference. The axes
themselves moved, so a delta would be meaningless and applying it would scatter everything;
listeners must rebuild from logical positions instead.

## Universe addressing — `UniverseAddress.ts`

Beyond the solar system a position is an integer sector index plus a double offset inside it.
`SECTOR_SIZE_M` is 100 light years.

The indices are `bigint`. They genuinely exceed 2⁵³ at cosmological range, and an integer that
silently drops its low bits is worse than one that is slow — this arithmetic runs when the player
crosses a sector, not per frame.

`normalizeSectorOffset` carries an offset that has grown past a sector boundary into the index, so
the double stays small; `separationM` measures between two addresses by differencing the indices
first, in `bigint`, and only then converting. `sectorSeed` is FNV-1a over the galaxy id and the
three indices, in `bigint`, so the same sector yields the same seed on every machine forever.

## What this does not do yet

- The frame tree is built and queried, but nothing outside the runtime facade holds a
  `SpatialPose` yet — gameplay still works in city metres.
- Body-to-body frame handoff is modelled (`SolarSystem.handoff`) but not driven by the player.
