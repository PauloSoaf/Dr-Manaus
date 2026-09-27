import {
  BufferAttribute, BufferGeometry, FrontSide, Group, Mesh, MeshBasicNodeMaterial,
  type Object3D, Vector3,
} from 'three/webgpu';
import { attribute, normalWorld, smoothstep, uniform } from 'three/tsl';
import { PLANET_LAYER } from '../../rendering/domains/RenderDomains';
import { faceUvToDirection } from './CubeSphere';
import { type PlanetTileAddress, tileBounds, tileCentreDirection } from './PlanetTileAddress';
import { MOON_RADIUS_M, moonColourAt, moonHeightAt, moonNormalEnu } from './MoonSurface';
import type { Quat, Vec3 } from '../spatial/units';

/**
 * The Moon's tiles, and the Moon's place in the scene.
 *
 * Built separately from the Earth's rather than by generalising `EarthGlobe`, because the two
 * bodies genuinely differ in what they are made of: the Earth is an ellipsoid with measured
 * coastlines and measured relief, and the Moon is a sphere with neither. Forcing one builder to
 * carry both would mean an ellipsoid parameter that is always 1/1130, a land mask that is always
 * absent and a DEM that does not exist -- three arguments to say "not like the other one".
 *
 * The sphere is not a shortcut. The Moon's flattening is 1/1130, so the ellipsoid correction is at
 * most 1.5 km, and its shape is dominated by topography rather than by rotation -- topography this
 * does not have real data for either. Modelling an ellipsoid to a precision finer than the surface
 * it carries would be arithmetic for its own sake.
 */

/** Vertices per tile edge, as for the Earth: 17 gives 512 triangles. */
export const MOON_TILE_RESOLUTION = 17;

export interface MoonTileMesh {
  readonly geometry: BufferGeometry;
  /** The tile's centre in the Moon's own fixed frame, metres. */
  readonly centre: Vec3;
  readonly triangles: number;
  readonly bytes: number;
}

/** True when the order `a, c, b` faces away from the centre, measured rather than assumed. */
function windingIsOutward(positions: Float32Array, normals: Float32Array, size: number): boolean {
  const a = 0, b = 3, c = size * 3;
  const e1x = positions[c] - positions[a], e1y = positions[c + 1] - positions[a + 1], e1z = positions[c + 2] - positions[a + 2];
  const e2x = positions[b] - positions[a], e2y = positions[b + 1] - positions[a + 1], e2z = positions[b + 2] - positions[a + 2];
  const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
  return nx * normals[a] + ny * normals[a + 1] + nz * normals[a + 2] >= 0;
}

/** Geometry for one quadtree tile of the Moon, relative to that tile's own centre. */
export function buildMoonTileMesh(address: PlanetTileAddress, flat = false): MoonTileMesh {
  const size = MOON_TILE_RESOLUTION;
  const { minU, maxU, minV, maxV } = tileBounds(address);
  const centreDirection = tileCentreDirection(address, [0, 0, 0]);
  const centreHeight = flat ? 0 : moonHeightAt(centreDirection);
  const centre: Vec3 = [
    centreDirection[0] * (MOON_RADIUS_M + centreHeight),
    centreDirection[1] * (MOON_RADIUS_M + centreHeight),
    centreDirection[2] * (MOON_RADIUS_M + centreHeight),
  ];

  const positions = new Float32Array(size * size * 3);
  const normals = new Float32Array(size * size * 3);
  const colors = new Float32Array(size * size * 3);
  const direction: Vec3 = [0, 0, 0];
  const colour: [number, number, number] = [0, 0, 0];
  const slope: [number, number, number] = [0, 0, 1];

  for (let row = 0; row < size; row++) {
    const v = minV + (maxV - minV) * (row / (size - 1));
    for (let column = 0; column < size; column++) {
      const u = minU + (maxU - minU) * (column / (size - 1));
      faceUvToDirection(address.face, u, v, direction);
      const height = flat ? 0 : moonHeightAt(direction);
      const radius = MOON_RADIUS_M + height;
      const index = (row * size + column) * 3;
      positions[index] = direction[0] * radius - centre[0];
      positions[index + 1] = direction[1] * radius - centre[1];
      positions[index + 2] = direction[2] * radius - centre[2];

      if (flat) {
        normals[index] = direction[0];
        normals[index + 1] = direction[1];
        normals[index + 2] = direction[2];
      } else {
        moonNormalEnu(direction, slope);
        // East, north and up on a sphere, which is all the basis a sphere needs.
        const p = Math.hypot(direction[0], direction[1]);
        const ex = p > 1e-9 ? -direction[1] / p : 1, ey = p > 1e-9 ? direction[0] / p : 0;
        const nx = -direction[2] * ey, ny = direction[2] * ex, nz = p;
        const nl = Math.hypot(nx, ny, nz) || 1;
        normals[index] = ex * slope[0] + (nx / nl) * slope[1] + direction[0] * slope[2];
        normals[index + 1] = ey * slope[0] + (ny / nl) * slope[1] + direction[1] * slope[2];
        normals[index + 2] = 0 * slope[0] + (nz / nl) * slope[1] + direction[2] * slope[2];
      }

      moonColourAt(direction, colour);
      colors[index] = colour[0];
      colors[index + 1] = colour[1];
      colors[index + 2] = colour[2];
    }
  }

  const quads = (size - 1) * (size - 1);
  const indices = new Uint16Array(quads * 6);
  let cursor = 0;
  const outward = windingIsOutward(positions, normals, size);
  for (let row = 0; row < size - 1; row++) {
    for (let column = 0; column < size - 1; column++) {
      const a = row * size + column, b = a + 1, c = a + size, d = c + 1;
      if (outward) {
        indices[cursor++] = a; indices[cursor++] = c; indices[cursor++] = b;
        indices[cursor++] = b; indices[cursor++] = c; indices[cursor++] = d;
      } else {
        indices[cursor++] = a; indices[cursor++] = b; indices[cursor++] = c;
        indices[cursor++] = b; indices[cursor++] = d; indices[cursor++] = c;
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();

  return {
    geometry, centre, triangles: quads * 2,
    bytes: positions.byteLength + normals.byteLength + colors.byteLength + indices.byteLength,
  };
}

/**
 * The Moon in the scene: one group, one material, one mesh per active tile.
 *
 * Shades itself against the real solar direction for the same reason the Earth does -- one camera
 * means one light list, and the scene's lights belong to a city at golden hour. The Moon has no
 * atmosphere, so there is no limb term and the terminator is hard: that is not a simplification,
 * it is what an airless body looks like.
 */
export class MoonGlobe {
  readonly group = new Group();
  private readonly material: MeshBasicNodeMaterial;
  private readonly meshes = new Map<string, Mesh>();
  private readonly uSun = uniform(new Vector3(0, 1, 0));
  private triangles = 0;

  constructor(parent: Object3D) {
    this.group.name = 'moon';
    this.group.visible = false;
    parent.add(this.group);

    this.material = new MeshBasicNodeMaterial({ fog: false, side: FrontSide });
    const surface = attribute('color', 'vec3');
    const incidence = normalWorld.dot(this.uSun);
    // A much harder terminator than the Earth's, and no night floor to speak of: no air to carry
    // light past the horizon, and no cities on the dark side.
    const daylight = smoothstep(-0.02, 0.06, incidence).mul(incidence.max(0).add(0.05));
    this.material.colorNode = surface.mul(daylight.mul(1.6).add(0.015));
  }

  get stats(): { tiles: number; triangles: number; visible: boolean } {
    return { tiles: this.meshes.size, triangles: this.triangles, visible: this.group.visible };
  }

  set visible(visible: boolean) { this.group.visible = visible; }
  get visible(): boolean { return this.group.visible; }

  /** Where the Moon's centre sits, in the scene's own metres. */
  setCentre(positionM: Vec3): void {
    this.group.position.set(positionM[0], positionM[1], positionM[2]);
  }

  /**
   * Turns the Moon's fixed axes into the scene's.
   *
   * On the group rather than on each tile, so everything inside it stays in the Moon's own frame
   * and a tile is placed by its centre with no rotation of its own. Rotating each tile instead
   * means remembering to rotate its *position* as well as its geometry -- and forgetting that is
   * exactly how the tiles ended up at the right distances in the wrong directions.
   */
  setOrientation(orientation: Quat): void {
    this.group.quaternion.set(orientation[0], orientation[1], orientation[2], orientation[3]);
  }

  setSunDirection(direction: Vec3): void {
    const length = Math.hypot(direction[0], direction[1], direction[2]);
    if (!(length > 0)) return;
    this.uSun.value.set(direction[0] / length, direction[1] / length, direction[2] / length);
  }

  add(key: string, mesh: MoonTileMesh): Mesh {
    this.remove(key);
    const object = new Mesh(mesh.geometry, this.material);
    object.name = `moon-${key}`;
    // In the Moon's own frame: the group carries both the centre and the rotation.
    object.position.set(mesh.centre[0], mesh.centre[1], mesh.centre[2]);
    object.frustumCulled = false;
    object.layers.set(PLANET_LAYER);
    this.group.add(object);
    this.meshes.set(key, object);
    this.triangles += mesh.triangles;
    return object;
  }

  remove(key: string): void {
    const existing = this.meshes.get(key);
    if (!existing) return;
    const index = existing.geometry.getIndex();
    this.triangles -= index ? index.count / 3 : 0;
    existing.removeFromParent();
    existing.geometry.dispose();
    this.meshes.delete(key);
  }

  dispose(): void {
    for (const key of [...this.meshes.keys()]) this.remove(key);
    this.material.dispose();
    this.group.removeFromParent();
    this.triangles = 0;
  }
}
