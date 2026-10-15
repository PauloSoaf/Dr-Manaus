# Natural Earth Continental Rivers Compilation Pipeline

## 1. Overview
This pipeline compiles authentic continental river vector centerlines for Dr-Manaus planetary and 3D globe presentation.

All river coordinates are compiled directly from official, public-domain **Natural Earth** vector datasets. No river centerlines are handcrafted or synthetic.

## 2. Upstream Sources & Provenance
- **Dataset**: Natural Earth Rivers & Lake Centerlines
- **Upstream Repository**: [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector)
- **License**: Public Domain
- **Official Portal**: [naturalearthdata.com](https://www.naturalearthdata.com/)

| File | Scale | SHA-256 Checksum | Purpose |
|---|---|---|---|
| `scripts/geodata/sources/ne_10m_rivers_lake_centerlines.geojson` | 1:10m | `bb854a900ecbd3b408df46d5e16e3e0f974ba55993f9d8b5c26e855273c0905a` | Amazon basin high-resolution centerlines (Amazonas, Negro, Madeira, Tapajós, Xingu, Purús, Juruá, Tocantins, Orinoco, Paraná) |
| `scripts/geodata/sources/ne_50m_rivers_lake_centerlines.geojson` | 1:50m | `f286e0ce978fde999ca2d7a78c764be08542e19b63cded52b05c12d5173ccc51` | Major global waterways (Nile, Congo, Mississippi, Missouri, Yangtze, Danube, Volga, Mekong) |

## 3. Compilation Workflow
Run the offline compiler:
```bash
node scripts/geodata/build-earth-rivers.mjs
```

The compiler:
1. Validates the SHA-256 checksums of the raw GeoJSON sources.
2. Parses `LineString` and `MultiLineString` features, preserving original coordinate order.
3. Normalizes coordinate precision to 5 decimal places (~1.1 metre resolution).
4. Deterministically generates scale-aware LODs (e.g. `lod0Coordinates` via Ramer-Douglas-Peucker with $\epsilon = 0.08^\circ$).
5. Outputs the project compact artifact to `src/world/geodata/earth-rivers.json`.

## 4. Known Natural Earth Inaccuracies in the Amazon Basin
Natural Earth 1:10m and 1:50m cartographic centerlines contain known alignment compromises, particularly in highly dynamic tropical meander zones of the Amazon, Solimões, and Rio Negro. Near Manaus ($< 15$ km altitude), the game transitions from these continental presentation centerlines to authoritative local Overture water polygons to ensure perfect local alignment with the city and bridges.
