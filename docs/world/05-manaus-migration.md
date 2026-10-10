# Manaus: anchored, not moved

Implements `05-MANAUS-PRESERVATION-AND-MIGRATION.md`. Code:
`src/world/spatial/ManausFrameAdapter.ts`, `src/world/geodata/geodata.ts`.
Tests: `tests/wgs84.test.ts`, plus the browser smoke test.

The specification's first rule is that the existing city must not regress. Everything here follows
from that.

## The projection the city is built in

The 645 compiled tiles, the road network, the landmask and every landmark are expressed in one flat
projection anchored at the **Monumento à Abertura dos Portos** (−3.130333, −60.022528):

```
x = (lon − originLon) × 111 320 × cos(originLat)
z = (originLat − lat) × 111 320
```

That is an equirectangular projection on a sphere of fixed scale. It is **not** the true tangent
plane on the WGS84 ellipsoid.

## How wrong it is, exactly

A degree of latitude at Manaus is about 110 574 m, not 111 320. So the local north axis is
stretched by **0.67%** — about **135 m** at the edge of the compiled city. East is very nearly
right, because `cos(lat)` at 3° south is doing almost no work.

| | Legacy | True WGS84 |
| --- | --- | --- |
| Metres per degree north | 111 320 | ~110 574 |
| North scale factor | `LEGACY_NORTH_SCALE` ≈ 1.0067 | 1 |
| Divergence at 20 km north | ~135 m | — |

## Why it was kept

Because it is self-consistent. A building and the road outside it are wrong by the same amount, so
the city is correct *relative to itself* — which is the only thing gameplay can observe. Correcting
the projection would move all 645 tiles, every landmark, the spawn point and the road graph, and
the acceptance criteria say plainly that none of those may move.

So `ManausFrameAdapter` holds **both** definitions and publishes the gap as a number rather than
leaving it to be discovered later:

| Function | Frame |
| --- | --- |
| `geoToLegacyLocal` / `legacyLocalToGeo` | the shipped projection, bit for bit |
| `geodeticToTrueLocal` / `trueLocalToGeodetic` | the real WGS84 tangent plane |
| `legacyDivergenceM(x, z)` | how far apart they are at a point |
| `LEGACY_NORTH_SCALE`, `LEGACY_EAST_SCALE` | the scale factors themselves |

`latLonToWorld` and `worldToLatLon` in `geodata.ts` delegate to the legacy pair. The test freezes
the coordinates the shipped game produced before the migration — if the projection ever moves, the
city moves, and the test fails before anyone plays it.

## The frame

`MANAUS_FRAME_ID = 'earth/manaus/legacy-enu'`, a child of `earth/fixed`. Its origin is the
anchor's ECEF position and its rotation is the ENU basis there, so the city is a real place on a
real planet — it simply measures itself with a slightly stretched ruler.

The anchor's ECEF position and ENU basis are computed once at module load, because they are
constants.

## What closes the gap

Phase 6: give each 1 024 m tile its own frame and curve it onto the ellipsoid. Within one tile the
divergence is **sub-metre** rather than 135 m, because the error grows with distance from the
anchor and a tile is never more than 724 m from its own centre. That is the point at which the
legacy projection stops being a compromise and becomes a per-tile detail.

Until then the flat city and the round planet are kept apart by the altitude gate described in
[04-earth-and-planet-surface.md](04-earth-and-planet-surface.md).

## Verified not to have regressed

The browser smoke test still places the Monumento at `0, 0` and the Teatro at `-83, -6`. Spawn,
Teatro, Arena, Ponta Negra, the bridge and the airport exclusion are all unchanged — see
[17-acceptance.md](17-acceptance.md) for the full category A checklist.
