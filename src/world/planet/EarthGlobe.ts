import {
  BufferAttribute, BufferGeometry, Color, FrontSide, Group, Mesh, MeshBasicNodeMaterial,
  type Object3D, Vector3, SphereGeometry, DoubleSide, AdditiveBlending
} from 'three/webgpu';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import {
  attribute, cameraPosition, float, normalWorld, positionWorld, smoothstep, uniform,
} from 'three/tsl';
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

/** How hard the Sun drives the surface, against a tone mapper set for a city at golden hour. */
const SUN_GAIN = 1.45;
/** Airglow, moonlight and cities: what the night side is instead of a hole. */
const NIGHT_FLOOR = 0.035;
/** Rayleigh blue, near enough. The limb of the Earth from orbit is this colour. */
const ATMOSPHERE = uniform(new Color(0.29, 0.53, 0.93));
const LIMB_GAIN = 0.85;

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
  
  // A deterministic noise instance for procedural global terrain.
  const noise = new SimplexNoise();
  const getElevation = (latRad: number, lonRad: number) => {
    // Convert lat/lon to 3D Cartesian on a unit sphere for seamless noise
    const nx = Math.cos(latRad) * Math.cos(lonRad);
    const ny = Math.cos(latRad) * Math.sin(lonRad);
    const nz = Math.sin(latRad);
    
    // Low frequency continents / large mountains
    let e = 1.0 * noise.noise3d(nx * 2, ny * 2, nz * 2)
          + 0.5 * noise.noise3d(nx * 4, ny * 4, nz * 4)
          + 0.25 * noise.noise3d(nx * 8, ny * 8, nz * 8);
    // Normalize to rough [0, 1] range (Simplex output is approx -1 to 1)
    e = e / 1.75;
    
    // Only apply height if it's "land" (above sea level logic)
    // To make it simple, if e > 0 it's land, else water
    if (e < 0) return heightM; // Ocean level
    
    // Max elevation around 8000m (Himalayas)
    return heightM + e * 8000;
  };

  for (let row = 0; row < size; row++) {
    const v = minV + (maxV - minV) * (row / (size - 1));
    for (let column = 0; column < size; column++) {
      const u = minU + (maxU - minU) * (column / (size - 1));
      faceUvToDirection(address.face, u, v, direction);
      const baseGeodetic = directionToGeodetic(direction, heightM);
      const elevation = getElevation(baseGeodetic.latRad, baseGeodetic.lonRad);
      const geodetic = directionToGeodetic(direction, elevation);
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
  private readonly material: MeshBasicNodeMaterial;
  private readonly atmosphereMaterial: MeshBasicNodeMaterial;
  private readonly atmosphereMesh: Mesh;
  private readonly meshes = new Map<string, Mesh>();
  /**
   * Where the Sun is, in scene axes. A unit vector from the planet toward the Sun.
   *
   * The planet is shaded against this rather than by a light, because a light would be shared.
   * There is one camera and therefore one light list, and the scene's lights belong to a city at
   * golden hour: one sun near the horizon and a bright hemisphere fill. Applied to a planet they
   * wash the day side out and lift the night side off the black, and the terminator disappears
   * with them. A planet is lit by one star and shades itself.
   */
  private readonly uSun = uniform(new Vector3(0, 1, 0));
  private triangles = 0;

  constructor(parent: Object3D) {
    this.group.name = 'earth-globe';
    this.group.visible = false;
    parent.add(this.group);
    this.material = this.buildMaterial();
    this.atmosphereMaterial = this.buildAtmosphereMaterial();
    this.atmosphereMesh = new Mesh(new SphereGeometry(6378137 + 60000, 64, 64), this.atmosphereMaterial);
    this.atmosphereMesh.layers.set(PLANET_LAYER);
    this.atmosphereMesh.frustumCulled = false;
    this.group.add(this.atmosphereMesh);
  }

  setCenterM(positionM: Vec3): void {
    this.atmosphereMesh.position.set(positionM[0], positionM[1], positionM[2]);
  }

  /**
   * The planet's own shading: one star, a soft terminator, and an atmosphere at the limb.
   *
   * Unlit as far as the renderer is concerned -- `MeshBasicNodeMaterial` takes no part in the
   * light list -- and then lit explicitly against `uSun`. That is the point: see `uSun` for why
   * the scene's lights must not reach the planet.
   */
  private buildMaterial(): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial({
      /**
       * No fog, ever.
       *
       * The scene's fog is calibrated for a 260 km far plane, so a globe thousands of kilometres
       * away comes out entirely the colour of the haze -- purple at dusk, black at night. Clearing
       * `scene.fog` around the draw instead looks equivalent and is not: a material compiled with
       * fog keeps a node that reads `scene.fog.color`, so the first fogged draw throws on null and
       * everything after it in that pass is lost. Distance haze on a planet seen from orbit is the
       * atmosphere's job, and that is a limb, not a ramp.
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

    // The surface colour comes from the vertex attribute the land mask wrote. Read by name rather
    // than through `vertexColors`, because this material multiplies it in itself.
    const surface = attribute('color', 'vec3');
    const incidence = normalWorld.dot(this.uSun);

    /**
     * The terminator is a band, not an edge.
     *
     * Two real effects widen it: the Sun is half a degree across rather than a point, and the
     * atmosphere carries light past the geometric horizon. A hard `max(0)` gives a knife edge that
     * reads as a shading bug, so the lambert term is faded across a few degrees either side.
     */
    const daylight = smoothstep(-0.10, 0.25, incidence).mul(incidence.max(0).add(0.12));
    // Not black at night: airglow, moonlight and cities. Small, but zero looks like a hole.
    const lit = surface.mul(daylight.mul(SUN_GAIN).add(NIGHT_FLOOR));

    /**
     * The atmosphere, seen edge on.
     *
     * Looking at the centre of the disc there is a few hundred kilometres of air between the eye
     * and the ground; looking at the limb the same line of sight runs through thousands, so the
     * air is what you see. That is the blue rim on every photograph of the Earth, and it is a
     * property of the viewing angle -- which is exactly what this term measures.
     */
    const toCamera = cameraPosition.sub(positionWorld).normalize();
    const grazing = float(1).sub(normalWorld.dot(toCamera).max(0)).pow(3.2);
    // Lit air only. The night limb is dark, not blue.
    const halo = ATMOSPHERE.mul(grazing.mul(smoothstep(-0.25, 0.15, incidence)).mul(LIMB_GAIN));

    material.colorNode = lit.add(halo);
    return material;
  }

  private buildAtmosphereMaterial(): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial({
      fog: false,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    
    const incidence = normalWorld.dot(this.uSun);
    const daylight = smoothstep(-0.25, 0.15, incidence);
    const toCamera = cameraPosition.sub(positionWorld).normalize();
    const grazing = float(1).sub(normalWorld.dot(toCamera).abs());
    
    // density peaks at the horizon (grazing = 1), falls off at zenith (grazing = 0)
    const density = grazing.pow(4.0).mul(2.5).add(grazing.pow(1.0).mul(0.2));
    
    material.colorNode = ATMOSPHERE.mul(density).mul(daylight);
    return material;
  }

  get stats(): { tiles: number; triangles: number; visible: boolean } {
    return { tiles: this.meshes.size, triangles: this.triangles, visible: this.group.visible };
  }

  set visible(visible: boolean) { this.group.visible = visible; }
  get visible(): boolean { return this.group.visible; }

  /** Points the planet's sun. `direction` runs from the planet toward the Sun, in scene axes. */
  setSunDirection(direction: Vec3): void {
    const length = Math.hypot(direction[0], direction[1], direction[2]);
    if (!(length > 0)) return;
    this.uSun.value.set(direction[0] / length, direction[1] / length, direction[2] / length);
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
