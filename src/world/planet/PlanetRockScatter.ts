/**
 * Loose rocks around an observer standing near the surface of a rocky planet.
 *
 * They give the near ground what the measured grids cannot: parallax and a known size to judge
 * distance by. Placement follows the planet's cube-sphere tiles, so a rock is always at the same
 * body-fixed spot, whatever the approach or the render origin. Rocks sit on the collision surface,
 * stay small enough to walk through without colliders, and are left out of published volume
 * replacements (craters). Tiles are built one per update, nearest first, and released behind.
 */
import { Color, Euler, Group, IcosahedronGeometry, InstancedMesh, Matrix4, type MeshBasicNodeMaterial, Quaternion, Vector3 } from 'three/webgpu';
import { PLANET_LAYER } from '../../rendering/domains/RenderDomains';
import { directionToFaceUv, faceUvToDirection } from './CubeSphere';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from './PlanetSurface';
import { planetTile, type PlanetTileAddress, tileBounds, tileCentreDirection } from './PlanetTileAddress';
import type { PlanetVolumeBounds } from './volume/PlanetVolumeEdit';
import type { Vec3 } from '../spatial/units';

export const ROCK_SCATTER = Object.freeze({
  /** Approximate tile edge; the nearest cube-sphere level is used. */
  tileM: 40,
  cellsPerSide: 12,
  /** Share of cells holding a rock. */
  density: .2,
  radiusM: 150,
  /** Above this height over the ground the rocks are too small to matter. */
  maxAltitudeM: 300,
  /** Largest rock, metres across: low enough to walk through unnoticed. */
  maxSizeM: .7,
  tilesPerUpdate: 1,
});

export interface Rock {
  /** Centre in the body-fixed frame. */
  readonly position: Vec3;
  readonly sizeM: number;
  readonly shade: number;
  readonly turn: Vec3;
}

function cellHash(a: number, b: number, c: number, channel: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177) ^ Math.imul(channel + 1, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The cube-sphere level whose tiles are closest to `ROCK_SCATTER.tileM` on this body. */
export function rockTileLevel(radiusM: number): number {
  return Math.max(0, Math.min(20, Math.round(Math.log2(radiusM * Math.PI / 2 / ROCK_SCATTER.tileM))));
}

/** The rocks of one tile. Deterministic: the same tile always holds the same rocks. */
export function rockTile(surface: PlanetSurfaceGenerator, address: PlanetTileAddress): Rock[] {
  const { minU, maxU, minV, maxV } = tileBounds(address);
  const n = ROCK_SCATTER.cellsPerSide, rocks: Rock[] = [];
  const direction: Vec3 = [0, 0, 0];
  const key = (address.face << 24) ^ (address.level << 16);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const gx = address.x * n + i, gy = address.y * n + j;
    if (cellHash(gx, gy, key, 0) >= ROCK_SCATTER.density) continue;
    const u = minU + (maxU - minU) * (i + .15 + .7 * cellHash(gx, gy, key, 1)) / n;
    const v = minV + (maxV - minV) * (j + .15 + .7 * cellHash(gx, gy, key, 2)) / n;
    faceUvToDirection(address.face, u, v, direction);
    // Mostly pebbles, a few boulders.
    const sizeM = .08 + (ROCK_SCATTER.maxSizeM - .08) * cellHash(gx, gy, key, 3) ** 4;
    // A third of each rock is buried, as loose rocks settle into regolith.
    const radius = planetSurfaceRadius(surface, direction) + sizeM * .1;
    rocks.push({
      position: [direction[0] * radius, direction[1] * radius, direction[2] * radius],
      sizeM, shade: .72 + .36 * cellHash(gx, gy, key, 4),
      turn: [cellHash(gx, gy, key, 5) * Math.PI * 2, cellHash(gx, gy, key, 6) * Math.PI * 2, cellHash(gx, gy, key, 7) * Math.PI * 2],
    });
  }
  return rocks;
}

interface Tile { readonly address: PlanetTileAddress; readonly rocks: Rock[]; readonly centre: Vec3; mesh: InstancedMesh | null }

export class PlanetRockScatter {
  /** Child of the planet globe: every position below it is body-fixed. */
  readonly group = new Group();
  private readonly geometry = new IcosahedronGeometry(.5, 0);
  private readonly tiles = new Map<string, Tile>();
  private readonly level: number;
  private exclusions: readonly PlanetVolumeBounds[] = [];

  constructor(private readonly surface: PlanetSurfaceGenerator, private readonly material: MeshBasicNodeMaterial) {
    this.level = rockTileLevel(surface.radiusM);
    this.group.name = `${surface.body.id}-surface-rocks`;
    this.group.visible = false;
  }

  get stats() {
    let rocks = 0;
    for (const tile of this.tiles.values()) rocks += tile.mesh?.count ?? 0;
    return { visible: this.group.visible, tiles: this.tiles.size, rocks };
  }

  hide(): void { this.group.visible = false; }

  /** Streams the rocks around an observer given in the body-fixed frame. */
  update(observerFixed: Vec3, tileBudget: number = ROCK_SCATTER.tilesPerUpdate): void {
    const distance = Math.hypot(...observerFixed);
    if (!(distance > 0) || !observerFixed.every(Number.isFinite)) { this.hide(); return; }
    const down: Vec3 = [observerFixed[0] / distance, observerFixed[1] / distance, observerFixed[2] / distance];
    const altitude = distance - planetSurfaceRadius(this.surface, down);
    this.group.visible = altitude < ROCK_SCATTER.maxAltitudeM;
    if (!this.group.visible) return;
    const wanted = this.wantedTiles(down, distance - altitude);
    const keep = new Set(wanted.map(entry => entry.key));
    const releaseBeyond = ROCK_SCATTER.radiusM + ROCK_SCATTER.tileM * 2;
    for (const [key, tile] of this.tiles) {
      if (!keep.has(key) && Math.hypot(...tile.centre.map((v, i) => v - observerFixed[i])) > releaseBeyond + Math.max(0, altitude)) this.release(key);
    }
    let budget = tileBudget;
    for (const entry of wanted) {
      if (budget <= 0) break;
      if (this.tiles.has(entry.key)) continue;
      this.build(entry.key, entry.address);
      budget--;
    }
  }

  /** Volume replacements (craters) own their space; no rock floats over them. */
  setExclusions(bounds: readonly PlanetVolumeBounds[]): void {
    if (bounds === this.exclusions) return;
    this.exclusions = bounds;
    for (const tile of this.tiles.values()) this.write(tile);
  }

  dispose(): void {
    for (const key of [...this.tiles.keys()]) this.release(key);
    this.geometry.dispose();
    this.group.removeFromParent();
  }

  private wantedTiles(down: Vec3, groundRadiusM: number) {
    const horizontal = Math.hypot(down[0], down[1]);
    const east: Vec3 = horizontal > 1e-9 ? [-down[1] / horizontal, down[0] / horizontal, 0] : [1, 0, 0];
    const north: Vec3 = [down[1] * east[2] - down[2] * east[1], down[2] * east[0] - down[0] * east[2], down[0] * east[1] - down[1] * east[0]];
    const side = 2 ** this.level, step = ROCK_SCATTER.tileM * .5;
    const reach = Math.ceil((ROCK_SCATTER.radiusM + ROCK_SCATTER.tileM) / step);
    const wanted = new Map<string, { key: string; address: PlanetTileAddress; distance: number }>();
    for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) {
      const offset = Math.hypot(a, b) * step;
      if (offset > ROCK_SCATTER.radiusM + ROCK_SCATTER.tileM * .5) continue;
      const uv = directionToFaceUv([0, 1, 2].map(i => down[i] + (east[i] * a + north[i] * b) * step / groundRadiusM) as Vec3);
      const x = Math.min(side - 1, Math.max(0, Math.floor((uv.u + 1) / 2 * side)));
      const y = Math.min(side - 1, Math.max(0, Math.floor((uv.v + 1) / 2 * side)));
      const key = `${uv.face}:${x}:${y}`;
      const previous = wanted.get(key);
      if (!previous || offset < previous.distance) wanted.set(key, { key, address: planetTile(this.surface.body.id, uv.face, this.level, x, y), distance: offset });
    }
    return [...wanted.values()].sort((a, b) => a.distance - b.distance);
  }

  private build(key: string, address: PlanetTileAddress): void {
    const rocks = rockTile(this.surface, address);
    const direction = tileCentreDirection(address, [0, 0, 0]);
    const radius = planetSurfaceRadius(this.surface, direction);
    const centre: Vec3 = [direction[0] * radius, direction[1] * radius, direction[2] * radius];
    const tile: Tile = { address, rocks, centre, mesh: null };
    if (rocks.length) {
      const mesh = new InstancedMesh(this.geometry, this.material, rocks.length);
      mesh.name = `rocks:${key}`;
      mesh.position.set(...centre);
      mesh.layers.set(PLANET_LAYER);
      const base: Vec3 = [0, 0, 0], colour = new Color();
      rocks.forEach((rock, n) => {
        const r = Math.hypot(...rock.position);
        this.surface.colourAt([rock.position[0] / r, rock.position[1] / r, rock.position[2] / r], base);
        mesh.setColorAt(n, colour.setRGB(base[0] * rock.shade, base[1] * rock.shade, base[2] * rock.shade));
      });
      tile.mesh = mesh;
      this.write(tile);
      this.group.add(mesh);
    }
    this.tiles.set(key, tile);
  }

  private write(tile: Tile): void {
    const mesh = tile.mesh;
    if (!mesh) return;
    const matrix = new Matrix4(), turn = new Quaternion(), euler = new Euler(), scale = new Vector3(), position = new Vector3();
    tile.rocks.forEach((rock, n) => {
      const buried = this.exclusions.some(bounds => rock.position.every((v, i) => v >= bounds.minBodyFixedM[i] && v < bounds.maxBodyFixedM[i]));
      position.set(rock.position[0] - tile.centre[0], rock.position[1] - tile.centre[1], rock.position[2] - tile.centre[2]);
      turn.setFromEuler(euler.set(rock.turn[0], rock.turn[1], rock.turn[2]));
      if (buried) scale.set(0, 0, 0); else scale.set(rock.sizeM, rock.sizeM * .62, rock.sizeM * .85);
      mesh.setMatrixAt(n, matrix.compose(position, turn, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  private release(key: string): void {
    const tile = this.tiles.get(key);
    if (!tile) return;
    if (tile.mesh) { this.group.remove(tile.mesh); tile.mesh.dispose(); }
    this.tiles.delete(key);
  }
}
