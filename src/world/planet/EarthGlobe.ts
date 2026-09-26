import {
  AmbientLight, BufferAttribute, BufferGeometry, DirectionalLight, FrontSide, Group, Mesh,
  MeshStandardMaterial, type Object3D,
} from 'three/webgpu';
import type { Quat } from '../spatial/units';
import { PLANET_LAYER } from '../../rendering/domains/RenderDomains';
import { geodeticToEcef, type EcefPosition } from '../spatial/ECEF';
import { directionToGeodetic } from './CubeSphere';
import { type PlanetTileAddress, tileBounds, tileCentreDirection } from './PlanetTileAddress';
import { surfaceColour } from './EarthLandMask';
import { faceUvToDirection } from './CubeSphere';
import type { Vec3 } from '../spatial/units';

/**
 * Geometry for one quadtree tile of a planet, on the real ellipsoid.
 *
 * Vertices are stored **relative to the tile's own centre**, never in planet coordinates. A tile
 * on the far side of Earth sits twelve million metres from the city, and putting that number into
 * a float32 vertex buffer would quantise the surface to metres. The large number lives once, in
 * the group's transform, where the renderer turns it camera-relative before it is ever uploaded.
 */

/** Vertices per tile edge. 17 gives 512 triangles: fine enough to read as curved, cheap to build. */
export const TILE_RESOLUTION = 17;

export interface TileMesh {
  readonly geometry: BufferGeometry;
  /** The tile's centre on the ellipsoid, in the body's fixed frame. */
  readonly centre: EcefPosition;
  readonly triangles: number;
  readonly bytes: number;
}

/**
 * Builds a tile's surface.
 *
 * Every vertex goes cube face → direction → geodetic → ellipsoid, so the surface is the WGS84
 * ellipsoid rather than a sphere. Normals come from the ellipsoid normal at each point, which is
 * not the direction to the centre — on an oblate body those differ, and using the geocentric
 * direction instead would tilt the shading slightly everywhere away from the equator.
 */
export function buildTileMesh(address: PlanetTileAddress, heightM = 0): TileMesh {
  const size = TILE_RESOLUTION;
  const { minU, maxU, minV, maxV } = tileBounds(address);
  const centreDirection = tileCentreDirection(address, [0, 0, 0]);
  const centre = geodeticToEcef(directionToGeodetic(centreDirection, heightM));

  const positions = new Float32Array(size * size * 3);
  const normals = new Float32Array(size * size * 3);
  const colors = new Float32Array(size * size * 3);
  const direction: Vec3 = [0, 0, 0];
  const colour: [number, number, number] = [0, 0, 0];

  for (let row = 0; row < size; row++) {
    const v = minV + (maxV - minV) * (row / (size - 1));
    for (let column = 0; column < size; column++) {
      const u = minU + (maxU - minU) * (column / (size - 1));
      faceUvToDirection(address.face, u, v, direction);
      const geodetic = directionToGeodetic(direction, heightM);
      const point = geodeticToEcef(geodetic);
      const index = (row * size + column) * 3;
      positions[index] = point.xM - centre.xM;
      positions[index + 1] = point.yM - centre.yM;
      positions[index + 2] = point.zM - centre.zM;

      // The ellipsoid normal: the direction a plumb line points, not the direction to the centre.
      const cosLat = Math.cos(geodetic.latRad), sinLat = Math.sin(geodetic.latRad);
      normals[index] = cosLat * Math.cos(geodetic.lonRad);
      normals[index + 1] = cosLat * Math.sin(geodetic.lonRad);
      normals[index + 2] = sinLat;

      // Real coastlines, from the bundled Natural Earth mask. Per vertex rather than per texel:
      // at these tile sizes the interpolation reads as a coast, and it costs no texture at all.
      surfaceColour(geodetic.latRad, geodetic.lonRad, colour);
      colors[index] = colour[0];
      colors[index + 1] = colour[1];
      colors[index + 2] = colour[2];
    }
  }

  const quads = (size - 1) * (size - 1);
  const indices = new Uint16Array(quads * 6);
  let cursor = 0;
  /**
   * Which way round the triangles go is measured, not assumed.
   *
   * Three of the six cube-face parameterisations mirror, so one fixed index order is outward on
   * half the planet and inward on the other half. Drawing both sides hides that and then lies
   * about the lighting: a renderer flips the shading normal on a back face, so those tiles face
   * the sun geometrically and are shaded as though the sun were underneath them. Half the globe
   * came out black, which looked like a lighting bug and was a winding bug.
   *
   * So the first quad's triangle normal is compared with the surface normal there, and the order
   * is reversed for the whole tile when they disagree.
   */
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
 * True when the order `a, c, b` faces away from the planet's centre at the tile's first quad.
 *
 * One quad settles it for the whole tile: within a tile the parameterisation does not change
 * handedness, only between faces.
 */
function windingIsOutward(positions: Float32Array, normals: Float32Array, size: number): boolean {
  const a = 0, b = 3, c = size * 3;
  const e1x = positions[c] - positions[a], e1y = positions[c + 1] - positions[a + 1], e1z = positions[c + 2] - positions[a + 2];
  const e2x = positions[b] - positions[a], e2y = positions[b + 1] - positions[a + 1], e2z = positions[b + 2] - positions[a + 2];
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  return nx * normals[a] + ny * normals[a + 1] + nz * normals[a + 2] >= 0;
}

/**
 * The globe's place in the scene.
 *
 * One group, one shared material, one mesh per active tile. No textures: the coastlines come
 * through as vertex colours from the bundled Natural Earth mask, which costs nothing to upload
 * and puts the continents in their real shapes rather than an invented pattern.
 */
export class EarthGlobe {
  readonly group = new Group();
  private readonly material: MeshStandardMaterial;
  private readonly meshes = new Map<string, Mesh>();
  /**
   * The planet's own sun, aimed from the real solar direction rather than from the local sky.
   *
   * The scene's own sun is a local-sky construct tied to the time of day: at dusk it sits on the
   * horizon and the whole globe goes black, which is physically true of the hemisphere you happen
   * to be over and useless as a view of the planet. Lighting the globe from where the Sun
   * actually is gives a real terminator and a lit day side.
   */
  private readonly sun = new DirectionalLight(0xfff4e6, 3.2);
  private readonly ambient = new AmbientLight(0x2a3a52, 0.35);
  private triangles = 0;

  constructor(parent: Object3D) {
    this.group.name = 'earth-globe';
    this.group.visible = false;
    parent.add(this.group);
    for (const light of [this.sun, this.ambient]) {
      light.layers.set(PLANET_LAYER);
      this.group.add(light);
    }
    this.sun.target.layers.set(PLANET_LAYER);
    this.group.add(this.sun.target);
    this.material = new MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0, flatShading: false,
      /**
       * No fog, ever.
       *
       * The scene's fog is calibrated for a 260 km far plane, so a globe thousands of kilometres
       * away comes out entirely the colour of the haze -- purple at dusk, black at night. The
       * composer used to clear `scene.fog` for the far pass instead, which looked equivalent and
       * was not: the material's compiled fog node still dereferences `scene.fog.color`, so the
       * planetary pass threw on its first fogged draw and every tile after it was lost. Distance
       * haze on a planet seen from orbit is the atmosphere's job, and that is a limb, not a ramp.
       */
      fog: false,
      /**
       * Front faces only, now that every tile winds outward.
       *
       * Drawing both sides was how the mirrored faces were papered over, and it cost the lighting:
       * a back face is shaded with its normal flipped, so those tiles came out black in full
       * sunlight. With the winding measured per tile in `buildTileMesh`, culling is correct again
       * and the far side of the planet stops being rasterised at all.
       */
      side: FrontSide,
    });
  }

  get stats(): { tiles: number; triangles: number; visible: boolean } {
    return { tiles: this.meshes.size, triangles: this.triangles, visible: this.group.visible };
  }

  set visible(visible: boolean) { this.group.visible = visible; }
  get visible(): boolean { return this.group.visible; }

  /**
   * Points the planet's sun. `direction` runs from the planet toward the Sun, in scene axes.
   * A directional light only cares about the vector, so it is parked far enough out that nothing
   * can wander between it and the surface.
   */
  setSunDirection(direction: Vec3): void {
    const length = Math.hypot(direction[0], direction[1], direction[2]);
    if (!(length > 0)) return;
    const reach = 1e9 / length;
    this.sun.position.set(direction[0] * reach, direction[1] * reach, direction[2] * reach);
    this.sun.target.position.set(0, 0, 0);
  }

  /**
   * Adds a tile, positioned by its centre in the scene's own metres and rotated out of the body's
   * axes into the scene's.
   *
   * The rotation is not optional. A tile's vertices are offsets along Earth-fixed axes, and the
   * scene's axes are the city's tangent plane — placing the mesh without turning it leaves every
   * tile flat at an arbitrary angle, which is a field of plates rather than a planet.
   */
  add(key: string, mesh: TileMesh, positionM: Vec3, orientation: Quat): Mesh {
    this.remove(key);
    const object = new Mesh(mesh.geometry, this.material);
    object.name = `globe-${key}`;
    object.position.set(positionM[0], positionM[1], positionM[2]);
    object.quaternion.set(orientation[0], orientation[1], orientation[2], orientation[3]);
    /**
     * Frustum culling off, deliberately.
     *
     * With it on, the planetary pass drew exactly one object out of eighty — the only tile whose
     * bounding sphere was large enough to always intersect. The two cameras were measured to be
     * in the same place, pointing the same way, with matching projections and layers, so the
     * per-object test was rejecting tiles that were plainly in view.
     *
     * The quadtree already culls against the body's horizon, which is a stricter and more correct
     * test than a bounding sphere on a curved patch, and the selection is capped at a couple of
     * hundred tiles of five hundred triangles each. Letting the GPU clip them costs less than the
     * bug did.
     */
    object.frustumCulled = false;
    // The planetary domain, so it is drawn by the far camera rather than clipped by the near one.
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
