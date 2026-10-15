import payload from '../geodata/earth-rivers.json';
import { DEG_TO_RAD } from '../spatial/units';

export interface RiverDefinition {
  readonly id: string;
  readonly name: string;
  readonly basin: string;
  readonly tier: 'main' | 'tributary';
  readonly continent: string;
  readonly coordinates: readonly (readonly [number, number])[];
}

export interface EarthRiverDataset {
  readonly source: string;
  readonly licence: string;
  readonly retrievedAt: string;
  readonly homepage: string;
  readonly notes: string;
  readonly rivers: readonly RiverDefinition[];
}

const data = payload as unknown as EarthRiverDataset;

export const EARTH_RIVER_METADATA = {
  source: data.source,
  licence: data.licence,
  retrievedAt: data.retrievedAt,
  homepage: data.homepage,
  notes: data.notes,
} as const;

export const EARTH_RIVERS: readonly RiverDefinition[] = data.rivers;

/**
 * Continental river presentation layer.
 *
 * Explicit contract:
 * - presentationOnly: true (never provides local collision or character physics).
 * - Shared geographic authority with Natural Earth data.
 */
export const EarthRiverLayer = {
  presentationOnly: true,
  metadata: EARTH_RIVER_METADATA,
  allRivers: EARTH_RIVERS,

  /**
   * Filter rivers by viewing LOD.
   * - 'far': main continental trunks only (Amazon, Nile, Mississippi, etc.).
   * - 'medium': main trunks + major tributaries (Rio Negro, Madeira, Tapajós, Xingu).
   * - 'near': local view where regional Overture water takes precedence.
   */
  getRiversForLOD(lod: 'far' | 'medium' | 'near'): readonly RiverDefinition[] {
    if (lod === 'far') {
      return EARTH_RIVERS.filter(r => r.tier === 'main');
    }
    if (lod === 'medium') {
      return EARTH_RIVERS;
    }
    // Near Manaus: regional Overture water takes precedence
    return EARTH_RIVERS.filter(r => r.basin === 'Amazon');
  },

  /** Finds the main stem of the Amazon river. */
  getAmazonMainStem(): RiverDefinition | undefined {
    return EARTH_RIVERS.find(r => r.id === 'amazon_main');
  },

  /** Finds the Rio Negro tributary. */
  getRioNegro(): RiverDefinition | undefined {
    return EARTH_RIVERS.find(r => r.id === 'rio_negro');
  },

  /**
   * Converts a [lonDeg, latDeg] point to a 3D point on a sphere of radius R.
   * X = R * cos(lat) * sin(lon)
   * Y = R * sin(lat)
   * Z = R * cos(lat) * cos(lon)
   */
  latLonToSpherePoint(lonDeg: number, latDeg: number, radius = 1): [number, number, number] {
    const phi = (90 - latDeg) * DEG_TO_RAD;
    const theta = (lonDeg + 180) * DEG_TO_RAD;
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return [x, y, z];
  },
} as const;
