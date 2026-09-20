import { BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, Vector3 } from 'three/webgpu';
import { GEO_ORIGIN, latLonToWorld, worldToLatLon } from './geodata';

export interface GeoReference {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Where the coordinate came from, so a wrong marker can be traced back to its source. */
  source: string;
}

/**
 * Surveyed positions used to check the game against the map.
 *
 * These are reference points, NOT placement data — landmarks get their coordinates from
 * `LANDMARKS` and buildings from the compiled Overture tiles. A marker sitting away from the
 * thing it names means the projection or that landmark is wrong, which is exactly the failure
 * this exists to catch: the Largo was 128 m out, in the wrong direction, and nothing showed it.
 */
export const GEO_REFERENCES: readonly GeoReference[] = [
  { id: 'monumento', name: 'Monumento à Abertura dos Portos', lat: -3.130333, lon: -60.022528, source: 'Wikidata Q10332121' },
  { id: 'teatro', name: 'Teatro Amazonas', lat: -3.13027, lon: -60.02341, source: 'OSM way 794449274 footprint centre' },
  { id: 'igreja', name: 'Igreja de São Sebastião', lat: -3.13066, lon: -60.02205, source: 'OSM, east side of the Largo' },
  { id: 'juma', name: 'Juma Ópera', lat: -3.13003, lon: -60.02296, source: 'Rua 10 de Julho 481, facing the theatre' },
  { id: 'valer', name: 'Valer Teatro · Roseiral', lat: -3.13072, lon: -60.02299, source: 'Rua José Clemente 600' },
  { id: 'arena', name: 'Arena da Amazônia', lat: -3.08325175, lon: -60.02800465, source: 'Overture stadium footprint' },
  { id: 'ponte', name: 'Ponte Rio Negro', lat: -3.1266785, lon: -60.0843740, source: 'Overture carriageway midpoint' },
  { id: 'ponta', name: 'Ponta Negra', lat: -3.06375, lon: -60.10830, source: 'Orla' },
  { id: 'aeroporto', name: 'Aeroporto Eduardo Gomes', lat: -3.0386, lon: -60.0497, source: 'Runway 10/28 centre' },
];

export interface GeoProbe { lat: number; lon: number; x: number; z: number }

/** Both directions of the projection, for a console or a test to interrogate. */
export function probeLatLon(lat: number, lon: number): GeoProbe {
  const world = latLonToWorld(lat, lon);
  return { lat, lon, x: world.x, z: world.z };
}

export function probeWorld(x: number, z: number): GeoProbe {
  const geo = worldToLatLon(x, z);
  return { lat: geo.lat, lon: geo.lon, x, z };
}

/** Metres between two surveyed points, straight through the local projection. */
export function geoDistance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const pa = latLonToWorld(a.lat, a.lon), pb = latLonToWorld(b.lat, b.lon);
  return Math.hypot(pa.x - pb.x, pa.z - pb.z);
}

/**
 * A vertical pin at each reference, drawn only while the debug overlay is on.
 *
 * Lines rather than meshes: one draw call for every marker, nothing to light, and it reads
 * against any background from any distance.
 */
export class GeoDebug {
  readonly group = new Group();
  private readonly material = new LineBasicMaterial({ color: 0x8ce8ff, transparent: true, opacity: .9, depthTest: false });
  private line?: Line;

  constructor(root: Group) {
    this.group.name = 'geo-debug-markers';
    this.group.visible = false;
    this.group.renderOrder = 999;
    root.add(this.group);
  }

  get enabled(): boolean { return this.group.visible; }

  setEnabled(enabled: boolean): void {
    this.group.visible = enabled;
    if (enabled && !this.line) this.build();
  }

  private build(): void {
    const points: number[] = [];
    for (const reference of GEO_REFERENCES) {
      const { x, z } = latLonToWorld(reference.lat, reference.lon);
      // A tall pin plus a cross at its base: findable from the air, precise on the ground.
      points.push(x, 0, z, x, 260, z);
      for (const [dx, dz] of [[-12, 0], [12, 0], [0, -12], [0, 12]] as const) {
        points.push(x, .4, z, x + dx, .4, z + dz);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
    geometry.computeBoundingSphere();
    this.line = new Line(geometry, this.material);
    this.line.name = 'geo-debug-pins';
    this.line.frustumCulled = false;
    this.group.add(this.line);
  }

  /** The reference nearest a world position, for a readout that says what you are looking at. */
  nearest(x: number, z: number): { reference: GeoReference; distance: number } | null {
    let best: GeoReference | null = null, bestDistance = Infinity;
    for (const reference of GEO_REFERENCES) {
      const world = latLonToWorld(reference.lat, reference.lon);
      const distance = Math.hypot(world.x - x, world.z - z);
      if (distance < bestDistance) { bestDistance = distance; best = reference; }
    }
    return best ? { reference: best, distance: bestDistance } : null;
  }

  /** One line per reference: what the projection makes of it, for the debug panel. */
  report(): string[] {
    return GEO_REFERENCES.map(reference => {
      const { x, z } = latLonToWorld(reference.lat, reference.lon);
      return `${reference.name}: ${x.toFixed(0)}, ${z.toFixed(0)}`;
    });
  }

  dispose(): void {
    if (this.line) { this.line.geometry.dispose(); this.line.removeFromParent(); this.line = undefined; }
    this.material.dispose();
    this.group.removeFromParent();
  }
}

export const GEO_DEBUG_ORIGIN = GEO_ORIGIN;
