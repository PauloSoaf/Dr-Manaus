# Render domains

Implements the render-domain half of `08-RENDER-DOMAINS-ATMOSPHERE-OCEAN.md`. Code:
`src/rendering/domains/RenderDomainComposer.ts`, plus the visibility rule in `src/game/Game.ts`.

**Status: the composer is built and drives two passes. The planet-aware atmosphere and the global
ocean are not built.** `FEATURES.newAtmosphere` is off.

## The problem

One camera cannot hold both ends of this game. A character on a pavement needs a near plane around
0.15 m. The horizon from orbit is 1 300 km away, and the Moon is 384 000 km. A single depth buffer
spanning that range has no precision anywhere in it, and the specification says explicitly that
raising `far` to astronomical units is not the answer.

## The answer: passes, furthest first

```
planet domain   near 1 km, far ≥ 50 000 km    the globe, the horizon, the limb
local domain    near 0.15 m, far 260 km       the city, the player, everything played with
```

Both passes use the same scene. Objects choose their domain with a **layer**, so nothing has to be
moved between scenes or duplicated:

```ts
export const LOCAL_LAYER = 0;   // what every existing object already uses
export const PLANET_LAYER = 1;
```

The depth buffer is cleared between the passes and the colour buffer is not. Local geometry
therefore always draws over the planet, which is correct by construction: anything in the local
domain is nearer than anything in the planetary one.

## Camera synchronisation

The planet camera copies the main camera's **world** transform, decomposed from `matrixWorld` —
not `position` and `quaternion`, which are relative to whatever the camera is parented to. The
planet camera has no parent, so copying the local values puts it somewhere else entirely and the
planet falls outside its frustum. This was a real bug; the measurement that caught it was a
position delta and a direction dot product between the two cameras.

Field of view and aspect are copied too, so the two images register exactly.

## The far plane moves

A fixed 50 000 km reaches low orbit and no further: from the Moon's distance the Earth would be
clipped away entirely, which is precisely the view the domain exists to make possible. So
`setRange(distanceToBodyM)` sets `far` to four times the body distance, with the near plane
following at `far / 1e6` — a depth buffer spanning a metre to a million kilometres has no
precision anywhere.

## Fog

Fog is cleared for the planetary pass and restored afterwards. It is calibrated for a 260 km far
plane, so a globe thousands of kilometres away comes out entirely the colour of the haze — purple
at dusk, black at night, which is exactly what the player reported seeing. Distance haze on a
planet seen from orbit is the atmosphere's job, and that is a limb, not a fog ramp.

## One ground, one sky

`Game` enforces a single rule so the two representations are never both present:

```ts
const localGround = !this.earth.globe.visible;
this.flatTerrain.visible = localGround;
this.atmosphere.sky.visible = localGround;
this.atmosphere.clouds.visible = localGround;
this.space.shell.visible = localGround;
this.space.disc.visible = localGround;
```

The flat terrain, the sky dome, the clouds and the old space shell stand down exactly when the
globe stands up. This is an interim measure, not the destination: the destination is one atmosphere
that is correct from the ground and from orbit.

## The ceiling — spec 08

`SPACE.maxAltitude` was 140 km because a flat world has no outside; there was nothing above it to
look at. With the planetary domain there is, so the ceiling moves to **500 000 km** — past the
Moon — while `FEATURES.earthGlobe` is on, and stays at 140 km otherwise.

It is still a ceiling rather than nothing. An unbounded coordinate is how a position stops being
representable, and the phase that removes the limit entirely is the one that hands the player into
another body's reference frame.

`SPACE.planetaryHandoff` (2 000 km) is where the globe stops being a place and starts being a body
in the sky.

## What does not work

The planetary pass issues its draw calls and produces no pixels. Everything measured and ruled out
is tabulated in [15-status.md](15-status.md). The leading untested suspect is the logarithmic depth
buffer shared between two cameras with very different near/far ranges.

## Not built

- A planet-aware atmosphere. `Atmosphere.sky` is still a 44 km dome drawn around the player.
- A global ocean surface. The sea is currently a vertex colour on the globe.
- Cloud handoff between the local cloud layer and a planetary one.
- A celestial render domain distinct from the planetary one.
