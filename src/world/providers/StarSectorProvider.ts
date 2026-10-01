import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group, type Object3D, Points,
  PointsMaterial,
} from 'three/webgpu';
import { generateStarSector, type StarSectorContent } from '../celestial/StarSector';
import { SECTOR_SIZE_M, type SectorIndex, sectorIndex } from '../spatial/UniverseAddress';
import { finite } from '../spatial/units';
import {
  type ActiveTile, type TileDemand, type TilePayload, type WorldTileKey, tileDemand,
  tileKeyToString,
} from '../streaming/TileDemand';
import type { CoverageClaim, SpatialContext, StreamingContext, WorldProvider } from './WorldProvider';

/**
 * The galaxy, as a streamed provider.
 *
 * Replaces a renderer that loaded twenty-seven sectors on its own every frame, kept every mesh it
 * ever built, respected no budget and derived the player's sector from a position measured in
 * Manaus metres -- which never leaves sector zero, so the same twenty-seven sectors were rebuilt
 * and re-rendered forever, on the ground, in a city.
 *
 * Everything the specification asks for follows from being a provider rather than a renderer: the
 * scheduler decides when to load, the activation budget applies, and a sector nobody asks for is
 * deactivated and its geometry disposed. There is nothing here that decides for itself.
 */

/** How far out sectors are drawn, in sectors. One ring is 27 cells and quite enough to look deep. */
const DEFAULT_RING = 1;
/** Stars per sector. The generator is capped separately; this is the renderer's own ceiling. */
const DEFAULT_MAX_STARS = 600;

/**
 * Metres per rendered unit for the galactic layer.
 *
 * A sector is a hundred light years across. Nothing can put that in a vertex buffer, and the
 * answer is not to scale the whole scene -- that is what reference frames are for, and the
 * specification says so twice. What this does instead is narrower and honest: the galaxy is drawn
 * as a *backdrop* around the camera, like a sky box, at a fixed conversion from metres to units.
 * It is a picture of where the stars are, not a place with a position in it.
 */
const METRES_PER_UNIT = 4e15;

export interface StarSectorProviderOptions {
  galaxyId?: string;
  ringSectors?: number;
  maxStarsPerSector?: number;
  /** Below this altitude the galaxy is not drawn: there is a sky and a planet in the way. */
  minAltitudeM?: number;
}

interface SectorPayload {
  readonly content: StarSectorContent;
  readonly geometry: BufferGeometry;
}

export class StarSectorProvider implements WorldProvider {
  readonly id = 'galaxy/star-sectors';
  /** Below everything. A star is the last thing that should win an argument about the ground. */
  readonly priority = 1;

  readonly group = new Group();
  private readonly material: PointsMaterial;
  /** Keyed by tile key, and each entry remembers its own sector so nothing has to be parsed. */
  private readonly sectors = new Map<string, { readonly mesh: Points; readonly sector: SectorIndex }>();
  private readonly options: Required<StarSectorProviderOptions>;
  private altitudeM = 0;
  /** The sector the last plan was centred on, so recentring needs no context of its own. */
  private centreSector: SectorIndex = sectorIndex(0, 0, 0);

  constructor(parent: Object3D, options: StarSectorProviderOptions = {}) {
    this.group.name = 'galaxy';
    this.group.visible = false;
    parent.add(this.group);
    this.options = {
      galaxyId: options.galaxyId ?? 'milky_way',
      ringSectors: Math.max(0, Math.round(finite(options.ringSectors, DEFAULT_RING))),
      maxStarsPerSector: Math.max(1, Math.round(finite(options.maxStarsPerSector, DEFAULT_MAX_STARS))),
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 200_000)),
    };
    this.material = new PointsMaterial({
      size: 1.4, sizeAttenuation: false, vertexColors: true,
      transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
    });
  }

  get stats(): { sectors: number; stars: number; visible: boolean } {
    let stars = 0;
    for (const { mesh } of this.sectors.values()) stars += mesh.geometry.getAttribute('position')?.count ?? 0;
    return { sectors: this.sectors.size, stars, visible: this.group.visible };
  }

  /** The galaxy claims nothing. It is a backdrop, and it loses every argument about the world. */
  coverage(): readonly CoverageClaim[] { return []; }

  covers(context: SpatialContext): boolean {
    this.altitudeM = finite(context.altitudeM);
    const insideSolarSystem = context.address.systemId === 'sol';
    this.group.visible = !insideSolarSystem && this.altitudeM >= this.options.minAltitudeM;
    return this.group.visible;
  }

  /**
   * The sectors around the player's cosmic address.
   *
   * The address, not the local position. Manaus metres never leave sector zero however far the
   * player flies, so deriving the sector from them pins the galaxy in place -- which is what the
   * renderer this replaces did, and why it always drew the same stars.
   */
  plan(context: StreamingContext): readonly TileDemand[] {
    const centre = this.sectorOf(context.spatial);
    this.centreSector = centre;
    const ring = this.options.ringSectors;
    const demands: TileDemand[] = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dz = -ring; dz <= ring; dz++) {
          const sector = sectorIndex(centre.x + BigInt(dx), centre.y + BigInt(dy), centre.z + BigInt(dz));
          // Distance in sectors, which is all the ranking needs: the absolute number would be
          // astronomical and would swamp every other term in the queue.
          const rings = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
          demands.push(tileDemand({
            key: this.keyFor(sector),
            providerId: this.id,
            geometricErrorM: SECTOR_SIZE_M / (rings + 1),
            screenSpaceError: 8 / (rings + 1),
            distanceM: rings * SECTOR_SIZE_M,
            timeToContactS: Number.POSITIVE_INFINITY,
            gameplayCritical: false,
            representation: 'far',
          }));
        }
      }
    }
    return demands;
  }

  load(demand: TileDemand): Promise<TilePayload> {
    const sector = this.sectorFromKey(demand.key);
    if (!sector) return Promise.reject(new Error(`${tileKeyToString(demand.key)} is not a star sector`));
    // Generated, not fetched. The same sector gives the same stars on every machine, forever.
    const content = generateStarSector(this.options.galaxyId, sector, {
      maxStars: this.options.maxStarsPerSector,
    });
    const geometry = buildSectorGeometry(content);
    const bytes = content.stars.length * 6 * 4;
    return Promise.resolve({
      key: demand.key,
      version: 1,
      cpuBytes: bytes,
      estimatedGpuBytes: bytes,
      geometricErrorM: demand.geometricErrorM,
      geometry: { content, geometry } satisfies SectorPayload,
    });
  }

  activate(payload: TilePayload): ActiveTile {
    const { content, geometry } = payload.geometry as SectorPayload;
    const key = tileKeyToString(payload.key);
    this.remove(key);
    const mesh = new Points(geometry, this.material);
    mesh.name = `galaxy-${key}`;
    const centre = this.centreSector;
    mesh.position.set(
      Number(content.sector.x - centre.x) * SECTOR_SIZE_M / METRES_PER_UNIT,
      Number(content.sector.y - centre.y) * SECTOR_SIZE_M / METRES_PER_UNIT,
      Number(content.sector.z - centre.z) * SECTOR_SIZE_M / METRES_PER_UNIT,
    );
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.sectors.set(key, { mesh, sector: content.sector });
    return {
      key: payload.key, providerId: this.id, payload, representation: 'far',
      dispose: () => this.remove(key),
    };
  }

  deactivate(tile: ActiveTile): void { this.remove(tileKeyToString(tile.key)); }

  /**
   * Keeps the backdrop centred on the camera and the sectors placed relative to the player's own.
   *
   * Called once a frame by whoever owns the scene. Everything else about this provider is driven
   * by the scheduler.
   */
  recentre(cameraPositionM: readonly [number, number, number]): void {
    this.group.position.set(cameraPositionM[0], cameraPositionM[1], cameraPositionM[2]);
    const centre = this.centreSector;
    for (const { mesh, sector } of this.sectors.values()) {
      mesh.position.set(
        Number(sector.x - centre.x) * SECTOR_SIZE_M / METRES_PER_UNIT,
        Number(sector.y - centre.y) * SECTOR_SIZE_M / METRES_PER_UNIT,
        Number(sector.z - centre.z) * SECTOR_SIZE_M / METRES_PER_UNIT,
      );
    }
  }

  dispose(): void {
    for (const key of [...this.sectors.keys()]) this.remove(key);
    this.material.dispose();
    this.group.removeFromParent();
  }

  private remove(key: string): void {
    const existing = this.sectors.get(key);
    if (!existing) return;
    existing.mesh.removeFromParent();
    existing.mesh.geometry.dispose();
    this.sectors.delete(key);
  }

  private sectorOf(context: SpatialContext): SectorIndex {
    return context.address.sector;
  }

  private keyFor(sector: SectorIndex): WorldTileKey {
    return { kind: 'star-sector', galaxyId: this.options.galaxyId, level: 0, sector };
  }

  private sectorFromKey(key: WorldTileKey): SectorIndex | undefined {
    return key.kind === 'star-sector' ? key.sector : undefined;
  }

}

/** One sector's stars as a point cloud, coloured by temperature rather than all the same white. */
function buildSectorGeometry(content: StarSectorContent): BufferGeometry {
  const stars = content.stars;
  const positions = new Float32Array(stars.length * 3);
  const colors = new Float32Array(stars.length * 3);
  const colour = new Color();
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    // Offsets inside the sector, in rendered units. The sector's own place is the mesh position.
    positions[i * 3] = star.offsetM[0] / METRES_PER_UNIT;
    positions[i * 3 + 1] = star.offsetM[1] / METRES_PER_UNIT;
    positions[i * 3 + 2] = star.offsetM[2] / METRES_PER_UNIT;
    // Rough black body: hot stars blue-white, cool ones amber. Not a spectrum, but the right way.
    const t = Math.min(1, Math.max(0, (star.temperatureK - 3000) / 9000));
    colour.setRGB(1 - t * 0.35, 0.82 + t * 0.14, 0.62 + t * 0.38);
    const brightness = Math.min(1, 0.35 + Math.log10(1 + star.luminositySolar) * 0.3);
    colors[i * 3] = colour.r * brightness;
    colors[i * 3 + 1] = colour.g * brightness;
    colors[i * 3 + 2] = colour.b * brightness;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

export { METRES_PER_UNIT as GALAXY_METRES_PER_UNIT };
