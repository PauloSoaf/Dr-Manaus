import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
} from 'three/webgpu';
import { geodeticToEcef } from '../spatial/ECEF';
import { DEG_TO_RAD } from '../spatial/units';
import { EarthRiverLayer, type RiverDefinition } from './EarthRiverLayer';
import { PLANET_LAYER } from '../../rendering/domains/RenderDomains';

/** Small normal elevation above WGS84 ellipsoid to eliminate coplanar z-fighting with terrain. */
export const RIVER_SURFACE_OFFSET_M = 40;

/** Max distance between vertices before inserting great-circle interpolation points (metres). */
const MAX_SEGMENT_LENGTH_M = 35_000;

export interface RiverRendererStats {
  readonly activeLOD: 'lod0' | 'lod1' | 'lod2';
  readonly vertices: number;
  readonly segments: number;
  readonly visible: boolean;
  readonly opacity: number;
}

export class EarthContinentalRiverRenderer {
  readonly group = new Group();
  private readonly material: LineBasicMaterial;
  private readonly geometries: Map<string, BufferGeometry> = new Map();
  private activeMesh: LineSegments | null = null;
  private currentLOD: 'lod0' | 'lod1' | 'lod2' = 'lod1';
  private masterOpacity = 1;
  private altitudeM = 100_000;

  constructor() {
    this.group.name = 'earth-continental-rivers';

    this.material = new LineBasicMaterial({
      color: new Color(0.22, 0.74, 0.97), // #38bdf8 river blue
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: false,
    });

    this.buildGeometries();
    this.setLOD('lod1');
  }

  /**
   * Subdivides long coordinate segments along great-circle arc on ellipsoid.
   */
  private subdividePoints(points: readonly (readonly [number, number])[]): [number, number][] {
    if (points.length < 2) return points.map(p => [p[0], p[1]]);
    const result: [number, number][] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const [lon1, lat1] = points[i];
      const [lon2, lat2] = points[i + 1];
      result.push([lon1, lat1]);

      // Calculate approximate spherical distance in metres
      const dLat = (lat2 - lat1) * DEG_TO_RAD;
      const dLon = (lon2 - lon1) * DEG_TO_RAD;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distM = 6_371_000 * c;

      if (distM > MAX_SEGMENT_LENGTH_M) {
        const steps = Math.min(8, Math.ceil(distM / MAX_SEGMENT_LENGTH_M));
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const interpLat = lat1 + (lat2 - lat1) * t;
          const interpLon = lon1 + (lon2 - lon1) * t;
          result.push([interpLon, interpLat]);
        }
      }
    }
    const last = points[points.length - 1];
    result.push([last[0], last[1]]);
    return result;
  }

  /**
   * Builds line segment geometry for a given list of rivers.
   */
  private buildMeshGeometry(rivers: readonly RiverDefinition[], useLOD0 = false): BufferGeometry {
    const coords: number[] = [];

    for (const river of rivers) {
      const linePoints = useLOD0 && river.lod0Coordinates && river.lod0Coordinates.length > 2
        ? river.lod0Coordinates
        : river.coordinates;

      if (linePoints.length < 2) continue;
      const arc = this.subdividePoints(linePoints);

      for (let i = 0; i < arc.length - 1; i++) {
        const [lon1, lat1] = arc[i];
        const [lon2, lat2] = arc[i + 1];

        const p1 = geodeticToEcef({
          latRad: lat1 * DEG_TO_RAD,
          lonRad: lon1 * DEG_TO_RAD,
          heightM: RIVER_SURFACE_OFFSET_M,
        });

        const p2 = geodeticToEcef({
          latRad: lat2 * DEG_TO_RAD,
          lonRad: lon2 * DEG_TO_RAD,
          heightM: RIVER_SURFACE_OFFSET_M,
        });

        coords.push(p1.xM, p1.yM, p1.zM);
        coords.push(p2.xM, p2.yM, p2.zM);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(coords), 3));
    return geometry;
  }

  private buildGeometries(): void {
    // LOD 0: Main stems only (simplified RDP points)
    const lod0Rivers = EarthRiverLayer.allRivers.filter(r => r.tier === 'main');
    this.geometries.set('lod0', this.buildMeshGeometry(lod0Rivers, true));

    // LOD 1: Main stems + major Amazon tributaries (Negro, Madeira, Tapajós, Xingu)
    const lod1Rivers = EarthRiverLayer.allRivers.filter(r => r.tier === 'main' || r.basin === 'Amazon');
    this.geometries.set('lod1', this.buildMeshGeometry(lod1Rivers, false));

    // LOD 2: All authentic centerlines in full resolution
    this.geometries.set('lod2', this.buildMeshGeometry(EarthRiverLayer.allRivers, false));
  }

  setLOD(lod: 'lod0' | 'lod1' | 'lod2'): void {
    if (this.activeMesh && this.currentLOD === lod) return;
    this.currentLOD = lod;

    if (this.activeMesh) {
      this.group.remove(this.activeMesh);
      this.activeMesh = null;
    }

    const geometry = this.geometries.get(lod);
    if (!geometry) return;

    this.activeMesh = new LineSegments(geometry, this.material);
    this.activeMesh.name = `continental-river-mesh-${lod}`;
    this.activeMesh.renderOrder = 2;
    this.activeMesh.frustumCulled = false;
    this.activeMesh.layers.set(PLANET_LAYER);
    this.group.add(this.activeMesh);
  }

  /**
   * Updates river visibility and opacity based on altitude.
   *
   * Below 12 km: local Overture water polygons take complete authority at Manaus.
   * 12 km - 25 km: cross-fades into view without double-rendering local rivers.
   * 25 km - 500 km: regional/continental view (LOD 1 or LOD 2).
   * > 500 km: distant planetary view (LOD 0).
   */
  update(altitudeM: number): void {
    this.altitudeM = altitudeM;

    // Handoff with local Manaus water
    let altOpacity = 1;
    if (altitudeM < 12_000) {
      altOpacity = 0; // Local Overture water owns the view near Manaus
    } else if (altitudeM < 25_000) {
      altOpacity = (altitudeM - 12_000) / 13_000;
    }

    this.material.opacity = this.masterOpacity * altOpacity;
    this.group.visible = this.material.opacity > 0.01;

    // Select scale-appropriate LOD
    if (altitudeM > 500_000) {
      this.setLOD('lod0');
    } else if (altitudeM > 80_000) {
      this.setLOD('lod1');
    } else {
      this.setLOD('lod2');
    }
  }

  set opacity(value: number) {
    this.masterOpacity = Math.max(0, Math.min(1, value));
    this.update(this.altitudeM);
  }

  get opacity(): number {
    return this.masterOpacity;
  }

  set visible(value: boolean) {
    this.group.visible = value;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  get stats(): RiverRendererStats {
    const pos = this.activeMesh?.geometry.getAttribute('position');
    const vertices = pos ? pos.count : 0;
    return {
      activeLOD: this.currentLOD,
      vertices,
      segments: vertices / 2,
      visible: this.group.visible,
      opacity: this.material.opacity,
    };
  }

  dispose(): void {
    if (this.activeMesh) {
      this.group.remove(this.activeMesh);
      this.activeMesh = null;
    }
    for (const geom of this.geometries.values()) {
      geom.dispose();
    }
    this.geometries.clear();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
