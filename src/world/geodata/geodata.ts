import type { Landmark } from '../../core/types';
import osmRoads from './osm-roads.json';

export const GEO_ORIGIN = { lat: -3.1303, lon: -60.0234 } as const;
const METERS_PER_DEGREE = 111320;
const LONGITUDE_SCALE = METERS_PER_DEGREE * Math.cos(GEO_ORIGIN.lat * Math.PI / 180);
export function latLonToWorld(lat: number, lon: number): { x: number; z: number } {
  return { x: (lon - GEO_ORIGIN.lon) * LONGITUDE_SCALE, z: (GEO_ORIGIN.lat - lat) * METERS_PER_DEGREE };
}
export function worldToLatLon(x: number, z: number): { lat: number; lon: number } {
  return { lat: GEO_ORIGIN.lat - z / METERS_PER_DEGREE, lon: GEO_ORIGIN.lon + x / LONGITUDE_SCALE };
}
function place(id: string, name: string, shortName: string, lat: number, lon: number, radius: number, spawnHeight: number, description: string): Landmark {
  return { id, name, shortName, lat, lon, radius, spawnHeight, description, ...latLonToWorld(lat, lon) };
}
export const IRANDUBA_CENTER = latLonToWorld(-3.1294, -60.0990);

/** Approximate survey positions; a meter scale local projection, not a navigation map. */
export const LANDMARKS: Landmark[] = [
  place('teatro', 'Teatro Amazonas', 'Teatro Amazonas', -3.1303, -60.0234, 92, 38.5, 'A cúpula do coração de Manaus. Arquitetura estilizada, criada para este mundo.'),
  place('largo', 'Largo de São Sebastião', 'Largo S. Sebastião', -3.13120, -60.02328, 85, 0.3, 'Ondas em pedra portuguesa, palmeiras e o Monumento à Abertura dos Portos.'),
  place('mercado', 'Mercado Municipal Adolpho Lisboa', 'Mercado Adolpho Lisboa', -3.1399498, -60.02355, 100, 18, 'Pavilhões de ferro e vitrais à beira do Rio Negro.'),
  place('porto', 'Porto de Manaus', 'Porto de Manaus', -3.13944, -60.02700, 150, 12, 'Cais flutuantes e barcos regionais conectam a cidade aos rios.'),
  place('relogio', 'Relógio Municipal', 'Relógio Municipal', -3.13809, -60.02490, 45, 17, 'O relógio histórico da avenida Eduardo Ribeiro.'),
  place('palacio', 'Palácio Rio Negro', 'Palácio Rio Negro', -3.1350552, -60.0167709, 100, 19, 'Fachada dourada e jardins no centro histórico.'),
  place('arena', 'Arena da Amazônia', 'Arena da Amazônia', -3.08325175, -60.02800465, 210, 46, 'A trama branca da arena inspirada nas cestas amazônicas.'),
  place('ponta', 'Praia da Ponta Negra', 'Ponta Negra', -3.06375, -60.10830, 1050, 3, 'Grande orla da Ponta Negra, com praia, calçadão, anfiteatro e skyline residencial.'),
  place('ponte', 'Ponte Jornalista Phelippe Daou', 'Ponte Rio Negro', -3.12008275, -60.07860795, 420, 56, 'Travessia estaiada do Rio Negro, representada em escala de quilômetros.'),
  place('iranduba', 'Iranduba · Cacau Pirêra', 'Iranduba', -3.1294, -60.0990, 520, 18, 'Margem de Cacau Pirêra, porta de entrada de Iranduba após a travessia do Rio Negro.'),
  place('encontro', 'Encontro das Águas', 'Encontro das Águas', -3.1430, -59.9040, 450, 9, 'As águas escuras do Negro encontram as águas barrentas do Solimões.'),
  place('musa', 'MUSA — Museu da Amazônia', 'MUSA', -3.0071889, -59.9398508, 280, 45, 'Torre de observação acima da floresta da Reserva Ducke.'),
  place('bosque', 'Bosque da Ciência', 'Bosque da Ciência', -3.0974306, -59.9877318, 210, 3, 'Trilhas, árvores amazônicas e os espaços de ciência do INPA.'),
];

/** Hand-generalized northern shoreline, in meters. Detailed river survey is not claimed. */
export const SHORELINE: readonly (readonly [number, number])[] = [
  [-50000, -32000], [-24000, -18700], [-17000, -12700], [-12500, -10000], [-10800, -8450], [-9850, -7850],
  [-9300, -6800], [-8600, -5300], [-7600, -3300], [-7150, -2500], [-6500, -2250], [-5700, -2100],
  [-4600, -1300], [-3500, 820], [-2250, 1120], [-900, 1380], [400, 1490], [1350, 1770],
  [2300, 1650], [3350, 1180], [4050, 1490], [5200, 2070], [7000, 2250], [8800, 1400],
  [11000, 900], [13000, 500], [15300, -650], [17800, -750], [21000, 1400], [29000, 3000], [50000, 6000],
];
export function shoreZ(x: number): number {
  for (let i = 1; i < SHORELINE.length; i++) {
    const a = SHORELINE[i - 1], b = SHORELINE[i];
    if (x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  }
  return 6000;
}
export function riverWidth(x: number): number { return 2900 + Math.max(0, x + 5000) * 0.25; }
export function isLand(x: number, z: number): boolean {
  const shore = shoreZ(x);
  return z <= shore || z >= shore + riverWidth(x);
}
export function isUrban(x: number, z: number): boolean {
  const manaus = z < shoreZ(x) - 25 && x > -12800 && x < 19500 && z > -17100;
  const oppositeShore = shoreZ(x) + riverWidth(x);
  const ix = (x - IRANDUBA_CENTER.x) / 3100;
  const iz = (z - IRANDUBA_CENTER.z) / 2600;
  const iranduba = z > oppositeShore + 25 && ix * ix + iz * iz < 1;
  return manaus || iranduba;
}

export interface GeoRoad { id: number; name: string; kind: string; points: number[][] }
export const OSM_ROADS: GeoRoad[] = osmRoads;
type RoadSegment = { ax: number; az: number; bx: number; bz: number; width: number };
const roadIndex = new Map<string, RoadSegment[]>();
const CELL = 256;
for (const road of OSM_ROADS) for (let i = 1; i < road.points.length; i++) {
  const a = road.points[i - 1], b = road.points[i];
  const segment = { ax: a[0], az: a[1], bx: b[0], bz: b[1], width: road.kind === 'secondary' ? 10 : 15 };
  for (let cx = Math.floor((Math.min(a[0], b[0]) - 36) / CELL); cx <= Math.floor((Math.max(a[0], b[0]) + 36) / CELL); cx++) {
    for (let cz = Math.floor((Math.min(a[1], b[1]) - 36) / CELL); cz <= Math.floor((Math.max(a[1], b[1]) + 36) / CELL); cz++) {
      const key = `${cx},${cz}`;
      const list = roadIndex.get(key);
      if (list) list.push(segment); else roadIndex.set(key, [segment]);
    }
  }
}
export function buildingAllowed(x: number, z: number, padding = 0): boolean {
  if (!isUrban(x, z) || !isLand(x - padding, z + padding) || !isLand(x + padding, z + padding)) return false;
  for (const landmark of LANDMARKS) if ((x - landmark.x) ** 2 + (z - landmark.z) ** 2 < (landmark.radius + padding) ** 2) return false;
  for (const segment of roadIndex.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
    const dx = segment.bx - segment.ax, dz = segment.bz - segment.az;
    const t = Math.max(0, Math.min(1, ((x - segment.ax) * dx + (z - segment.az) * dz) / (dx * dx + dz * dz || 1)));
    if ((x - segment.ax - dx * t) ** 2 + (z - segment.az - dz * t) ** 2 < (segment.width + padding) ** 2) return false;
  }
  return true;
}

/** One immutable checked-in data request, shared with optional map/tools consumers. */
export class GeodataLoader {
  private pending?: Promise<unknown>;
  load(): Promise<unknown> {
    return this.pending ??= fetch(`${import.meta.env.BASE_URL}geodata/manaus.json`).then(response => {
      if (!response.ok) throw new Error(`Geodata ${response.status}`);
      return response.json() as Promise<unknown>;
    });
  }
}
