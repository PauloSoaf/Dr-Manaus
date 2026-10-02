# The global geodata pipeline

Implements `06-GEODATA-PIPELINE.md` for planetary data. The **city's** pipeline — the OSM extract,
the compiled tiles and their licensing — is documented separately in
[`docs/geodata.md`](../geodata.md) and is unchanged by this work.

## Rules, before anything else

These are project constraints, not preferences:

1. **No paid or proprietary map service.** No Google Maps, no Google Earth, no Mapbox — not as a
   backend, not as an asset, not as a texture source. Google Maps may be opened by a developer to
   check a position by eye; nothing from it enters the repository.
2. **No public OSM tile server as a game backend.** Their tile servers are not a CDN for a game.
3. **Zero map requests during gameplay.** Every ingestion script runs by hand, offline, and commits
   its output.
4. **Every dataset carries its provenance in the file**: `source`, `licence`, `url`, `origin`,
   `retrievedAt`, and the parameters it was built with.
5. **No proprietary asset is copied** — no character, model, texture, shader, logo or silhouette.

## What ships today

| Asset | Source | Licence | Size | Retrieved |
| --- | --- | --- | --- | --- |
| `src/world/geodata/earth-landmask.json` | Natural Earth 1:110m Physical Vectors — land | Public domain | 86 KB | 2026-09-25 |
| `src/world/geodata/earth-elevation.json` | NOAA NGDC ETOPO5 global relief, 5 arc-minute | Public domain (US Gov) | 341 KB | 2026-09-26 |
| `src/world/geodata/moon-surface.json` | NASA SVS CGI Moon Kit (2019 LRO/LOLA + LROC/LOLA) | Public domain per NASA SVS; no exception noted | 1,391,397 bytes | 2026-10-02 |

Natural Earth's terms state that no permission is needed to use it and that crediting the authors
is appreciated but not required. It is public domain.

## Lunar elevation and appearance

Source: [NASA Scientific Visualization Studio, CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/).
The kit's 2019 LOLA displacement map supplies measured relief; its LROC WAC colour map supplies
mapped maria, highlands and rays, with polar colour filled from LOLA albedo. The RGB source uses
643/566/415 nm channels adapted for visualization; it is not a radiometrically calibrated gameplay
reflectance model. Runtime appearance is neutral luminance with a documented readability floor.

[NASA SVS usage terms](https://svs.gsfc.nasa.gov/help/) identify their content as public domain
unless an exception is noted; none is noted for these selected maps. Attribution is embedded in
the artifact: NASA's Scientific Visualization Studio; Ernie Wright (USRA), Noah Petro (NASA/GSFC);
LRO/LOLA and LROC teams. No paid, proprietary or live map service is involved.

| Source TIFF | Source dimensions | SHA-256 |
| --- | --- | --- |
| [LOLA 4 px/degree unsigned elevation](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4_uint.tif) | 1440×720 | `e6668bec27fc9b8fbb02d198c7ddfb08eedeeb790167b494f95e6b34201da05e` |
| [2019 LROC/LOLA colour](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_2k.tif) | 2048×1024 | `13b797422e8c4b8607ff2b2623ac3a046a6da0132d567c2d272d92fad7052c4a` |

Run offline with Python and the pinned ingestion dependency:

```powershell
python -m pip install -r scripts/geodata/requirements-lunar.txt
python scripts/geodata/build-moon-surface.py
# Reuse audited sources already on disk:
python scripts/geodata/build-moon-surface.py --cache artifacts/lunar-source
```

Pillow 12.3.0 decodes the TIFFs. The script verifies exact source hashes and dimensions; a changed
source requires a provenance audit rather than silently refreshing the artifact. Default raw cache
is ignored `data/raw-geodata/moon`. It averages 2×2 DEM cells into a 720×360 signed int16 grid in
half-metre units and BOX-reduces neutral appearance to 1024×512 uint8 luminance. Packed samples are
base64 in a compact JSON carrying first retrieval date, source URLs/hashes, usage basis, credit,
projection, dimensions, encoding and datum. Re-ingestion with the pinned tool/source inputs was
verified against the same artifact hash:

`1696df0382263ac9aabc183d0f15e506099d982a66e9ad994852371e6910f628`

Runtime file size is **1,391,397 bytes**, with **1,042,688 packed decoded bytes** (518,400 elevation
plus 524,288 appearance). The elevation working array is Float32. The measured range after
reduction is −8,327.5 to +9,789.5 m relative to NASA's 1,737,400 m spherical datum. Pixel centres
span east-positive −180°…+180° longitude and +90°…−90° latitude. Sampling is bilinear, wraps longitude,
clamps rows and converges to a longitude-independent average at each pole. The unchanged catalog
ellipsoid receives the necessary datum correction; the physical surface radius then equals the
NASA datum plus measured elevation. Streamed vertices and local collision use this one authority.

The runtime grid has approximately **15.2 km elevation spacing** and **10.7 km appearance spacing**
at the equator. Half-metre quantization is not half-metre spatial detail. Major geographic relief
and appearance replace synthetic maria/craters as the primary source, but this does not resolve
pebbles, footprints or centimetre-scale regolith. No runtime TIFF decode/download occurs. Lunar
volume edits and crater deformation are outside SPACE-HARDENING-1.

## The land mask

`scripts/geodata/build-earth-vectors.mjs` downloads the Natural Earth 110m land polygons,
rasterises them, and writes a bitmask.

```
node scripts/geodata/build-earth-vectors.mjs [--width 1024] [--source path.geojson]
```

Output: 1024 × 512 equirectangular, one bit per pixel, 65 536 bytes of payload,
**land fraction 0.3318**. A pixel is about 39 km at the equator — finer than the coastline detail
1:110m data actually carries, so a larger raster would only store the same information twice.

### Why a raster and not the polygons

The globe asks "is this vertex land?" once per vertex per tile, thousands of times a frame while
streaming. A point-in-polygon test against roughly four thousand edges is far too slow in that
path. A bitmask answers in one array lookup and a bit shift.

### Why scanline, and why even-odd

The fill walks one row at a time: find where every edge crosses that row, sort the crossings, fill
between alternate pairs. The alternative — testing each pixel against each edge — is half a million
pixels times four thousand edges, two billion tests to produce an 87 KB file.

Even-odd rather than winding is what makes **holes** come out as water without needing to know
which ring is a hole: the Caspian Sea, the Great Lakes. Horizontal edges are skipped because they
contribute no crossing and would otherwise double-count a vertex.

### Why it is bundled rather than fetched

Tile meshes are built synchronously, sometimes off the main thread. An `await` in that path means
colouring the planet a frame late — a visible flash of the wrong colour on every tile that streams
in.

### Reading it — `EarthLandMask.ts`

`isLandAt(latRad, lonRad)` wraps longitude and clamps latitude, because there is no pixel past a
pole. `surfaceColour()` adds two latitude rules on top of the mask: the polar ice and the arid belt
around the horse latitudes. Both are stated in the code as rules rather than data — they are the
two places a flat green reads as obviously wrong, and both are real features of the planet. Any
more than that needs a land-cover dataset, not a guess.

The base64 decoder is hand-rolled, six bits at a time. `atob` is a browser global and `Buffer` is a
Node one; this module is imported by both the game and the tests, so it decodes the groups itself
rather than reaching for whichever happens to exist.

### Verification

The mask was rendered as ASCII art at 100 columns and read by eye: the continents are recognisably
themselves, in the right hemispheres, with the right gaps. The land fraction, 33.2% of the
equirectangular rectangle, is consistent with an equal-area land fraction of ~29% given how badly
equirectangular inflates the poles — and Antarctica is at the bottom.

## Not built

- **A finer DEM.** ETOPO5 at 512x256 is about 78 km per sample, which matches the tiles the globe
  is drawn with today. Copernicus GLO-90 is the specification's choice for when they get finer.
- **Global rivers and coastline vectors** at higher detail than 110m.
- **Bathymetry**, and therefore an ocean with depth.

The boot budget in the specification is 12 MB compressed of additional planetary bootstrap. The
land mask uses 86 KB of it.
