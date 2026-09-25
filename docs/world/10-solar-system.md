# The solar system

Implements `10-SOLAR-SYSTEM.md`. Code: `src/world/celestial/`.
Tests: `tests/solar-system.test.ts` (12).

**Status: the logical model is complete and tested. Nothing of it is drawn yet** — the Sun's
direction is used to light the globe, and that is the only place it reaches the screen.
`FEATURES.solarSystem` is off.

## Bodies — `CelestialBody.ts`

Ten bodies: the Sun, the eight planets and the Moon. Real radii, real masses, published physics.

Venus and Uranus carry **negative** rotation periods, because they genuinely turn the other way.
That is a fact about the solar system, not a sign convention, and encoding it as data rather than
as a special case means nothing downstream has to know.

Derived rather than stored, so there is one place to be wrong: `gravitationalParameter`,
`surfaceGravityMps2`, `escapeVelocityMps`, `sphereOfInfluenceM`.

## Ephemerides — `EphemerisProvider.ts`, `OfflineEphemeris.ts`

Positions come from **published Keplerian elements with secular rates** — JPL's approximate
positions of the major planets — evaluated at the requested epoch.

Why not a downloaded dataset:

- A few hundred numbers, embedded as constants. No network at any point, which the project rules
  require and which also means no failure mode.
- Bit-identical on every machine and every run, which is the determinism rule.
- Accuracy in arcminutes over a span of centuries, which is what the specification asks for: the
  order, the distances and the motion — not navigation precision.

Kepler's equation is solved by Newton iteration to 1e-12, with the standard seed. `elementsAt`
applies the secular rates; `positionFromElements` builds the heliocentric position;
`velocityFromElements` differentiates it.

## Which body you belong to — `SolarSystem.ts`

`dominantBody()` decides by **gravitational acceleration at the player's position**, not by a
distance threshold someone picked.

Standing on the Moon, the Moon wins — though the Earth is 81 times its mass, it is 60 Earth radii
away and the inverse square settles it. That makes the frame handoff physical: it happens where
physics says it happens, which is also where it looks right.

`handoff()` reports the transition state, including `directionalRadiusM` — the distance at which a
body stops being a place and becomes a direction in the sky.

## Distant bodies reach the renderer as an angle

Never as a scaled position. A body far away is drawn at its **angular size**, so the Sun sits at a
genuine astronomical unit without one astronomical number ever reaching a vertex buffer. The tests
assert the Moon and the Sun both come out at about half a degree across, which is the check anyone
can make by looking up.

The planets are asserted to sit at their real J2000 distances, in the right order.

## What it is used for today

`SolarSystem.sunDirection()` points the globe's `DirectionalLight`. The terminator on the Earth is
therefore where the Sun actually is at the simulated epoch, rather than where a local time-of-day
slider puts it.

## Not built

- No celestial body is drawn — no Sun disc, no Moon, no planets in the sky.
- No frame handoff is driven by the player; `handoff()` is computed and reported, not acted on.
- Landing on the Moon (the phase's stated first target) needs a Moon provider, which needs the
  globe to draw first.
