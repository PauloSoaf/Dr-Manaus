/**
 * Deterministic offline compiler for continental river centerlines.
 *
 * Source: Natural Earth 1:10m and 1:50m Rivers & Lake Centerlines (Public Domain).
 * Upstream: https://github.com/nvkelso/natural-earth-vector
 *
 * This compiler strictly reads authentic GeoJSON source files from
 * scripts/geodata/sources/ and never uses handwritten or synthetic coordinate paths.
 *
 * Usage:
 *   node scripts/geodata/build-earth-rivers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SOURCES = {
  ne10m: {
    path: path.join(__dirname, 'sources', 'ne_10m_rivers_lake_centerlines.geojson'),
    scale: '1:10m',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson',
    sha256: 'bb854a900ecbd3b408df46d5e16e3e0f974ba55993f9d8b5c26e855273c0905a',
  },
  ne50m: {
    path: path.join(__dirname, 'sources', 'ne_50m_rivers_lake_centerlines.geojson'),
    scale: '1:50m',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson',
    sha256: 'f286e0ce978fde999ca2d7a78c764be08542e19b63cded52b05c12d5173ccc51',
  },
};

export const OUTPUT_PATH = path.join(__dirname, '..', '..', 'src', 'world', 'geodata', 'earth-rivers.json');

/** Computes the SHA-256 hash of a file or buffer. */
export function computeSha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Verifies that source files exist and match their expected SHA-256 checksums. */
export function verifySourceChecksums() {
  for (const [key, source] of Object.entries(SOURCES)) {
    if (!fs.existsSync(source.path)) {
      throw new Error(`Source file missing: ${source.path}`);
    }
    const buf = fs.readFileSync(source.path);
    const hash = computeSha256(buf);
    if (hash !== source.sha256) {
      throw new Error(`Checksum mismatch for ${key}: expected ${source.sha256}, got ${hash}`);
    }
  }
}

/**
 * Extracts coordinate lines from a GeoJSON feature (LineString or MultiLineString).
 * Preserves original coordinate order exactly.
 */
export function extractFeatureLines(feature) {
  const geom = feature.geometry;
  if (!geom) return [];
  if (geom.type === 'LineString') {
    return [geom.coordinates.map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))])];
  }
  if (geom.type === 'MultiLineString') {
    return geom.coordinates.map(line =>
      line.map(([lon, lat]) => [Number(lon.toFixed(5)), Number(lat.toFixed(5))])
    );
  }
  return [];
}

/**
 * Ramer-Douglas-Peucker line simplification for deterministic LOD generation.
 */
export function simplifyLineRDP(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    let dist = 0;
    if (lenSq === 0) {
      dist = Math.hypot(x - x1, y - y1);
    } else {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
      dist = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    }
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyLineRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyLineRDP(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

/**
 * Main compilation function reading authentic source files and producing earth-rivers.json.
 */
export function compileRivers() {
  verifySourceChecksums();

  const raw10m = JSON.parse(fs.readFileSync(SOURCES.ne10m.path, 'utf8'));
  const raw50m = JSON.parse(fs.readFileSync(SOURCES.ne50m.path, 'utf8'));

  const compiledRivers = [];

  // Helper to extract feature by filter
  function extractFrom10m(filterFn, id, name, basin, tier, continent) {
    const matching = raw10m.features.filter(filterFn);
    if (!matching.length) {
      console.warn(`No 10m feature found for ${id} (${name})`);
      return null;
    }
    // Sort matching by line length descending to pick principal channel
    const allLines = [];
    let bestFeature = matching[0];
    let maxPoints = 0;
    for (const f of matching) {
      const lines = extractFeatureLines(f);
      for (const line of lines) {
        if (line.length > maxPoints) {
          maxPoints = line.length;
          bestFeature = f;
        }
        allLines.push(line);
      }
    }

    // Pick principal line as primary coordinates
    const primaryLine = allLines.reduce((prev, cur) => cur.length > prev.length ? cur : prev, allLines[0]);

    return {
      id,
      name,
      name_en: bestFeature.properties?.name_en ?? name,
      basin,
      tier,
      continent,
      scalerank: bestFeature.properties?.scalerank ?? 1,
      featurecla: bestFeature.properties?.featurecla ?? 'River',
      sourceScale: '1:10m',
      sourceFeatureCount: matching.length,
      pointCount: primaryLine.length,
      coordinates: primaryLine,
      segments: allLines,
      lod0Coordinates: simplifyLineRDP(primaryLine, 0.08),
    };
  }

  function extractFrom50m(filterFn, id, name, basin, tier, continent) {
    const matching = raw50m.features.filter(filterFn);
    if (!matching.length) {
      console.warn(`No 50m feature found for ${id} (${name})`);
      return null;
    }
    const allLines = [];
    let bestFeature = matching[0];
    for (const f of matching) {
      const lines = extractFeatureLines(f);
      for (const line of lines) allLines.push(line);
    }
    const primaryLine = allLines.reduce((prev, cur) => cur.length > prev.length ? cur : prev, allLines[0]);

    return {
      id,
      name,
      name_en: bestFeature.properties?.name_en ?? name,
      basin,
      tier,
      continent,
      scalerank: bestFeature.properties?.scalerank ?? 2,
      featurecla: bestFeature.properties?.featurecla ?? 'River',
      sourceScale: '1:50m',
      sourceFeatureCount: matching.length,
      pointCount: primaryLine.length,
      coordinates: primaryLine,
      segments: allLines,
      lod0Coordinates: simplifyLineRDP(primaryLine, 0.08),
    };
  }

  // 1. Amazon Main Stem (Rio Amazonas / Solimões) from 10m
  const amazonMain = extractFrom10m(
    f => (f.properties?.name === 'Amazonas' || f.properties?.name_en === 'Amazonas') && f.properties?.featurecla === 'River',
    'amazon_main',
    'Rio Amazonas / Solimões',
    'Amazon',
    'main',
    'South America'
  );
  if (amazonMain) compiledRivers.push(amazonMain);

  // 2. Rio Negro (major northern tributary meeting at Manaus) from 10m
  const rioNegro = extractFrom10m(
    f => (f.properties?.name === 'Negro' || f.properties?.name_en === 'Negro') && f.properties?.scalerank <= 4,
    'rio_negro',
    'Rio Negro',
    'Amazon',
    'tributary',
    'South America'
  );
  if (rioNegro) compiledRivers.push(rioNegro);

  // 3. Rio Madeira (major southern tributary) from 10m
  const rioMadeira = extractFrom10m(
    f => (f.properties?.name === 'Madeira' || f.properties?.name_en === 'Madeira') && f.properties?.scalerank <= 4,
    'rio_madeira',
    'Rio Madeira',
    'Amazon',
    'tributary',
    'South America'
  );
  if (rioMadeira) compiledRivers.push(rioMadeira);

  // 4. Rio Tapajós from 10m
  const rioTapajos = extractFrom10m(
    f => (f.properties?.name === 'Tapajós' || f.properties?.name === 'Tapajos'),
    'rio_tapajos',
    'Rio Tapajós',
    'Amazon',
    'tributary',
    'South America'
  );
  if (rioTapajos) compiledRivers.push(rioTapajos);

  // 5. Rio Xingu from 10m
  const rioXingu = extractFrom10m(
    f => (f.properties?.name === 'Xingu' || f.properties?.name_en === 'Xingu'),
    'rio_xingu',
    'Rio Xingu',
    'Amazon',
    'tributary',
    'South America'
  );
  if (rioXingu) compiledRivers.push(rioXingu);

  // 6. Rio Purús from 10m
  const rioPurus = extractFrom10m(
    f => (f.properties?.name === 'Purús' || f.properties?.name === 'Purus'),
    'rio_purus',
    'Rio Purús',
    'Amazon',
    'tributary',
    'South America'
  );
  if (rioPurus) compiledRivers.push(rioPurus);

  // 7. Rio Juruá from 10m
  const rioJurua = extractFrom10m(
    f => (f.properties?.name === 'Juruá' || f.properties?.name === 'Jurua'),
    'rio_jurua',
    'Rio Juruá',
    'Amazon',
    'tributary',
    'South America'
  );
  if (rioJurua) compiledRivers.push(rioJurua);

  // 8. Rio Tocantins from 10m
  const rioTocantins = extractFrom10m(
    f => (f.properties?.name === 'Tocantins' || f.properties?.name_en === 'Tocantins') && f.properties?.scalerank <= 4,
    'rio_tocantins',
    'Rio Tocantins',
    'Tocantins',
    'tributary',
    'South America'
  );
  if (rioTocantins) compiledRivers.push(rioTocantins);

  // 9. Rio Orinoco from 10m
  const rioOrinoco = extractFrom10m(
    f => (f.properties?.name === 'Orinoco' || f.properties?.name_en === 'Orinoco'),
    'rio_orinoco',
    'Rio Orinoco',
    'Orinoco',
    'main',
    'South America'
  );
  if (rioOrinoco) compiledRivers.push(rioOrinoco);

  // 10. Rio Paraná from 10m
  const rioParana = extractFrom10m(
    f => (f.properties?.name === 'Paraná' || f.properties?.name_en === 'Parana'),
    'rio_parana',
    'Rio Paraná',
    'Parana',
    'main',
    'South America'
  );
  if (rioParana) compiledRivers.push(rioParana);

  // 11. Major Global Rivers (from 50m / 10m authentic data)
  const globalRiverDefs = [
    { id: 'nile', name: 'Nile', basin: 'Nile', continent: 'Africa', filter: f => f.properties?.name === 'Nile' || f.properties?.name_en === 'Nile' },
    { id: 'congo', name: 'Congo', basin: 'Congo', continent: 'Africa', filter: f => f.properties?.name === 'Congo' || f.properties?.name_en === 'Congo' },
    { id: 'mississippi', name: 'Mississippi', basin: 'Mississippi', continent: 'North America', filter: f => f.properties?.name === 'Mississippi' },
    { id: 'missouri', name: 'Missouri', basin: 'Mississippi', continent: 'North America', filter: f => f.properties?.name === 'Missouri' },
    { id: 'yangtze', name: 'Yangtze', basin: 'Yangtze', continent: 'Asia', filter: f => f.properties?.name === 'Yangtze' || f.properties?.name === 'Chang Jiang' },
    { id: 'danube', name: 'Danube', basin: 'Danube', continent: 'Europe', filter: f => f.properties?.name === 'Danube' || f.properties?.name === 'Donau' },
    { id: 'volga', name: 'Volga', basin: 'Volga', continent: 'Europe', filter: f => f.properties?.name === 'Volga' },
    { id: 'mekong', name: 'Mekong', basin: 'Mekong', continent: 'Asia', filter: f => f.properties?.name === 'Mekong' },
  ];

  for (const def of globalRiverDefs) {
    const extracted = extractFrom50m(def.filter, def.id, def.name, def.basin, 'main', def.continent);
    if (extracted) compiledRivers.push(extracted);
  }

  const dataset = {
    source: 'Natural Earth 1:10m and 1:50m Rivers & Lake Centerlines',
    licence: 'Public Domain',
    retrievedAt: '2026-10-15',
    homepage: 'https://www.naturalearthdata.com/',
    upstreamSources: [
      {
        name: 'ne_10m_rivers_lake_centerlines.geojson',
        scale: '1:10m',
        url: SOURCES.ne10m.url,
        sha256: SOURCES.ne10m.sha256,
      },
      {
        name: 'ne_50m_rivers_lake_centerlines.geojson',
        scale: '1:50m',
        url: SOURCES.ne50m.url,
        sha256: SOURCES.ne50m.sha256,
      },
    ],
    notes: 'Authentic vector centerlines compiled from Natural Earth. Covers the complete Amazon basin (Solimões/Amazonas, Negro, Madeira, Tapajós, Xingu, Purús, Juruá) and global major rivers. Presentation only.',
    rivers: compiledRivers,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`Successfully compiled ${compiledRivers.length} authentic rivers to ${OUTPUT_PATH}`);
  return dataset;
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compileRivers();
}
