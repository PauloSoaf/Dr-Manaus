# Geographic data and art boundaries

The checked-in `public/geodata/manaus.json` is a compact OpenStreetMap extract, downloaded during implementation on 2026-09-18. Its metadata records the precise Overpass query, source timestamp, attribution, projection origin and retrieval timestamp. It contains **264 road ways / 2,150 projected vertices** from selected arterial corridors and **12 named OSM features**. The smaller `src/world/geodata/osm-roads.json` is the build-time road dataset used by terrain rendering and the worker's building exclusion index. Gameplay performs no requests to OSM/Overpass.

Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/). The bundled extracted database retains this license. Architectural models, generated city buildings and the manually generalized shoreline are original game assets, not OSM building geometry.

Run `node scripts/geodata.mjs` to download a fresh, bounded extract and replace both compact files. Set `OVERPASS_URL` to an alternative compatible endpoint if necessary. Run `node scripts/geodata.mjs --source path/to/overpass.json` for deterministic offline conversion of an already downloaded `out geom` response. Node 20+ is required. A failed request leaves the previous data intact. The script never runs during dev-server startup or gameplay.

The initial public endpoint timed out; the successful extract used `https://overpass-api.de/api/interpreter`. The default endpoint can be overridden as documented. Keep public endpoint usage occasional; preprocessed files are meant to be committed and distributed with the application.

## What is geographically grounded

The local equirectangular projection is anchored at the **Monumento à Abertura dos Portos**, at the centre of the Largo de São Sebastião: latitude −3.130333, longitude −60.022528. That point is world zero. One unit is approximately one metre, east is +X and south is +Z.

The origin was previously described here as the Teatro Amazonas at −3.1303, −60.0234. That conflated two separate places: the Teatro is its own landmark about 98 m **west** of the monument. Every compiled asset has been regenerated against the monument anchor, and `src/world/geodata/geodata.ts` is the authority — this document follows it, not the other way round.

The projection itself assumes a fixed 111 320 m per degree on both axes. On the WGS84 ellipsoid a degree of latitude at Manaus is about 110 574 m, so the local north axis is stretched by roughly 0.67%: a point 20 km north sits about 135 m from where the ellipsoid would put it. That is consistent across every compiled tile, road vertex and landmark, which is why the projection is kept rather than corrected. `src/world/spatial/ManausFrameAdapter.ts` holds both this projection and the true WGS84 tangent plane, and states the gap between them as a number. Landmark locations for the market, palace, arena, bridge, MUSA and Bosque use named OSM feature centers from the committed extract. The theater origin is a few meters from its OSM polygon center. The remaining landmark coordinates are manually selected approximate points; they are not cadastral surveys. Ponta Negra is over 12 km from the theater, and MUSA is about 16 km away.

The preserved roads include Avenida Djalma Batista, Constantino Nery, Torquato Tapajós, Coronel Teixeira, Eduardo Ribeiro, Sete de Setembro and Avenida Brasil. Rendered polyline ribbons and indexed building clearance both use the same projected vertices. Secondary streets and building footprints are deterministic procedural content, not actual property boundaries. Procedural streets follow the chunk grid between these preserved arterial corridors.

## Explicit approximations

- The river coastline, opposite bank, forest extent and urban envelope are hand-generalized for meter-scale play. They are **not** extracted shorelines or a DEM. Small igarapés and the real terrain elevations remain unmodeled.
- Every landmark is an original, simplified procedural architectural model. No photogrammetry or measured facade reconstruction is claimed. The Teatro retains its salmon facade, white arcades, portico, balustrades and multicolor domed roof; the square includes wave-pattern paving and a modeled monument/church.
- The bridge is 3,595 meters long in the game, with an authored cable-stayed silhouette. Its deck profile, towers, collisions and azimuth are simplified. The river width has been generalized to allow an actual crossing between two banks.
- The Encontro das Águas is represented by contrasting water regions plus a river observation boat. It is not a fluid simulation.
- Landmark collision uses a small set of boxes. The theater's dome is approximated by stepped collision volumes and a stable summit platform at y=38.5.
- Detail loads only within 1.4 km, uses a 1.75 km exit threshold, and is evicted beyond 4.8 km. Distant authored silhouettes remain visible to 22 km (bridge 28 km). There are no per-window or per-palm scene objects; static geometry merges into shared material batches.

The source extract is intentionally small. This is a geographic foundation for a playable prototype, not a complete digital twin of Manaus.
