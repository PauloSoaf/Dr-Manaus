# Render domains

Implements the render-domain half of `08-RENDER-DOMAINS-ATMOSPHERE-OCEAN.md`. Code:
`src/rendering/domains/RenderDomains.ts`, plus the stand-down rule in `src/game/Game.ts`.

**Status: working.** The planet and the city are drawn in one frame, from the ground to the Moon's
distance. The planet-aware atmosphere and the global ocean are not built.

## The problem

One camera has to cover both ends of this game. A character on a pavement needs a near plane around
0.15 m. The horizon from orbit is 1 300 km away and the Moon is 384 000 km. A **linear** depth
buffer cannot hold that range, and the specification says plainly that raising `far` is not the
answer.

## What was tried first, and why it is not what ships

Two cameras, two passes, furthest first, with the depth buffer cleared between them and the colour
buffer kept. It is the textbook answer and it does not work here: **two successive `render()` calls
to the screen do not composite in `WebGPURenderer`.** Each call resolves through its own
frame-buffer target and the second replaces the first, whatever `autoClearColor` says.

That was measured rather than reasoned about, because the symptom pointed the wrong way — the pass
reported eighty draw calls and put nothing on the screen:

| Experiment | Result |
| --- | --- |
| far pass alone | the planet, drawn correctly |
| local pass alone | the local world, drawn correctly |
| far pass, then local pass with an empty layer | the planet survives |
| far pass, then the real local pass | only the local pass |

## What ships: one camera, logarithmic depth

The project already enables `logarithmicDepthBuffer`. Its precision is **relative** rather than
absolute, so one camera spans 0.15 m to 50 000 km with depth to spare at both ends — 24 bits over
roughly 28 doublings is about half a million values per doubling.

So there is one camera and one pass. `RenderDomains` is the policy that decides how far it sees:

```ts
export const LOCAL_LAYER = 0;        // what every existing object already uses
export const PLANET_LAYER = 1;
export const LOCAL_FAR_M = 260_000;
export const PLANET_FAR_FLOOR_M = 50_000_000;
```

- `active = false` — the camera is exactly the one the flat-world game had: layer 0, far 260 km.
  The feature flag really does mean "as before".
- `active = true` — the camera also sees `PLANET_LAYER`, and `setRange(distanceToBodyM)` grows the
  far plane to four times the distance to the body, floored at 50 000 km. A fixed 50 000 km reaches
  low orbit and no further; from the Moon the Earth would be clipped away entirely, which is
  precisely the view the domain exists to make possible.

The near plane does not move with it. Under a logarithmic buffer it does not need to, and moving it
would clip the player's own hands.

Layers still separate the two domains, because the planet has to be able to stand down without
touching anything else.

## One ground, one sky

Above 15 km the flat world and the round one cannot both be on screen. `Game` tells each layer to
stand down; it does not set `visible` on their objects:

```ts
const localGround = !this.earth.globe.visible;
this.flatTerrain.visible = localGround;
this.atmosphere.planetaryView = !localGround;
this.space.planetaryView = !localGround;
```

**Told, not overwritten.** `Atmosphere.update` and `SpaceLayer.update` run later in the frame and
set their own visibility, so a `visible` flag written earlier is gone before anything is drawn.
That is not hypothetical: it is why the planet was drawn and then painted over by the old
Earth-from-space shell for an afternoon.

What stands down:

| Object | Why |
| --- | --- |
| `flatTerrain` | the other ground |
| `Atmosphere.sky` | a 44 km dome drawn around the player; from orbit it covers the planet |
| `Atmosphere.clouds` | local weather, drawn around the player |
| `SpaceLayer.shell` | the old stand-in Earth-from-space, and opaque |
| `SpaceLayer.disc` | the Sun at a fixed local distance |
| `SpaceLayer.stars` | the star sphere carries the sky gradient, and the camera is inside it |

Losing the stars is a real loss and a temporary one: the star sectors already exist as a model
(see [11-galaxy-and-universe.md](11-galaxy-and-universe.md)) and belong in the planetary domain.

## Fog

The globe's material sets `fog: false`. The scene's fog is calibrated for a 260 km far plane and
would paint a planet thousands of kilometres away entirely the colour of the haze — purple at dusk,
black at night.

Clearing `scene.fog` around the pass looks equivalent and is not: **a material compiled with fog
keeps a node that reads `scene.fog.color`, so the first fogged draw throws on null and everything
after it in that pass is lost.** The pass reports its draw calls and puts nothing on the screen. Per
material is the switch three provides for this, and it is the one to use.

## The ceiling — spec 08

`SPACE.maxAltitude` was 140 km because a flat world has no outside. With the planetary domain it is
**500 000 km**, past the Moon, while `FEATURES.earthGlobe` is on, and 140 km otherwise. It is still
a ceiling rather than nothing: an unbounded coordinate is how a position stops being representable,
and the phase that removes the limit entirely is the one that hands the player into another body's
reference frame.

`SPACE.planetaryHandoff` (2 000 km) is where the globe stops being a place and becomes a body in
the sky.

## Not built

- A planet-aware atmosphere: a limb seen from outside, a sky seen from inside, one model for both.
- A global ocean surface. The sea is currently a vertex colour on the globe.
- A starfield in the planetary domain, to replace the one that stands down.
- Per-domain lighting. One camera means one light list, so the city's sun and hemisphere light the
  globe as well as its own solar light does, and the planet reads paler than it should. The fix is
  a material that computes its own sun term rather than more lights.
