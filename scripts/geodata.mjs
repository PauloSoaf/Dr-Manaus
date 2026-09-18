/** Offline OSM preprocessing. Never called by gameplay. Node >= 20. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = { lat: -3.1303, lon: -60.0234 };
const meters = 111320;
const project = ({ lat, lon }) => [Math.round((lon - origin.lon) * meters * Math.cos(origin.lat * Math.PI / 180)), Math.round((origin.lat - lat) * meters)];
const query = `[out:json][timeout:45];(way[highway][name~"Constantino|Djalma|Torquato|Coronel Teixeira|Eduardo Ribeiro|Sete de Setembro|Avenida Brasil"](-3.17,-60.13,-3.01,-59.92);nwr[name~"Teatro Amazonas|Arena da Amazônia|Bosque da Ciência|Museu da Amazônia|Mercado Municipal Adolpho|Palácio Rio Negro|Phelippe Daou|Largo de São Sebastião"](-3.20,-60.16,-2.98,-59.86););out geom;`;
await mkdir('public/geodata', { recursive: true });
let raw;
if (process.argv.includes('--source')) {
  raw = JSON.parse(await readFile(process.argv[process.argv.indexOf('--source') + 1], 'utf8'));
} else {
  const endpoint = process.env.OVERPASS_URL || 'https://overpass.kumi.systems/api/interpreter';
  console.log(`Fetching one bounded OSM extract from ${endpoint}`);
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'DR-Manaus-development-offline-geodata/0.1' }, body: `data=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(65000) });
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}. Existing committed data has not been changed.`);
  raw = await response.json();
}
const roads = raw.elements.filter(e => e.type === 'way' && e.tags?.highway && e.geometry?.length > 1).map(e => {
  const projected = e.geometry.map(project);
  // Remove sub-meter duplicate vertices and short collinear details, retaining endpoints.
  const points = projected.filter((point, i) => i === 0 || i === projected.length - 1 || Math.hypot(point[0] - projected[i - 1][0], point[1] - projected[i - 1][1]) > 8);
  return { id: e.id, name: e.tags.name || '', kind: e.tags.highway, points };
});
const landmarks = raw.elements.filter(e => !e.tags?.highway).map(e => ({ id: e.id, type: e.type, name: e.tags?.name || '', lat: e.lat ?? e.center?.lat ?? ((e.bounds?.minlat + e.bounds?.maxlat) / 2), lon: e.lon ?? e.center?.lon ?? ((e.bounds?.minlon + e.bounds?.maxlon) / 2) }));
const output = { version: 1, origin, source: 'OpenStreetMap contributors', license: 'ODbL-1.0', attribution: 'https://www.openstreetmap.org/copyright', retrievedAt: new Date().toISOString(), osmTimestamp: raw.osm3s?.timestamp_osm_base, query, roads, landmarks };
await writeFile('public/geodata/manaus.json', JSON.stringify(output));
await mkdir('src/world/geodata', { recursive: true });
await writeFile('src/world/geodata/osm-roads.json', JSON.stringify(roads));
console.log(`Wrote ${roads.length} road ways and ${landmarks.length} named places to ${path.resolve('public/geodata/manaus.json')}`);
