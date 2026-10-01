import {
  BufferAttribute, BufferGeometry, FrontSide, Group, Mesh, MeshBasicNodeMaterial,
  type Object3D, Vector3,
} from 'three/webgpu';
import { attribute, normalWorld, smoothstep, uniform } from 'three/tsl';
import { PLANET_LAYER } from '../../rendering/domains/RenderDomains';
import { faceUvToDirection } from './CubeSphere';
import { type PlanetTileAddress, tileBounds, tileCentreDirection } from './PlanetTileAddress';
import { MARS_RADIUS_M, marsColourAt, marsHeightAt, marsNormalEnu } from './MarsSurface';
import type { Quat, Vec3 } from '../spatial/units';

export const MARS_TILE_RESOLUTION = 17;

export interface MarsTileMesh {
  readonly geometry: BufferGeometry;
  readonly centre: Vec3;
  readonly triangles: number;
  readonly bytes: number;
}

function windingIsOutward(positions: Float32Array, normals: Float32Array, size: number): boolean {
  const a = 0, b = 3, c = size * 3;
  const e1x = positions[c] - positions[a], e1y = positions[c + 1] - positions[a + 1], e1z = positions[c + 2] - positions[a + 2];
  const e2x = positions[b] - positions[a], e2y = positions[b + 1] - positions[a + 1], e2z = positions[b + 2] - positions[a + 2];
  const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
  return nx * normals[a] + ny * normals[a + 1] + nz * normals[a + 2] >= 0;
}

export function buildMarsTileMesh(address: PlanetTileAddress, flat = false): MarsTileMesh {
  const size = MARS_TILE_RESOLUTION;
  const { minU, maxU, minV, maxV } = tileBounds(address);
  const centreDirection = tileCentreDirection(address, [0, 0, 0]);
  const centreHeight = flat ? 0 : marsHeightAt(centreDirection);
  const centre: Vec3 = [
    centreDirection[0] * (MARS_RADIUS_M + centreHeight),
    centreDirection[1] * (MARS_RADIUS_M + centreHeight),
    centreDirection[2] * (MARS_RADIUS_M + centreHeight),
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
      const height = flat ? 0 : marsHeightAt(direction);
      const radius = MARS_RADIUS_M + height;
      const index = (row * size + column) * 3;
      positions[index] = direction[0] * radius - centre[0];
      positions[index + 1] = direction[1] * radius - centre[1];
      positions[index + 2] = direction[2] * radius - centre[2];

      if (flat) {
        normals[index] = direction[0];
        normals[index + 1] = direction[1];
        normals[index + 2] = direction[2];
      } else {
        marsNormalEnu(direction, slope);
        const p = Math.hypot(direction[0], direction[1]);
        const ex = p > 1e-9 ? -direction[1] / p : 1, ey = p > 1e-9 ? direction[0] / p : 0;
        const nx = -direction[2] * ey, ny = direction[2] * ex, nz = p;
        const nl = Math.hypot(nx, ny, nz) || 1;
        normals[index] = ex * slope[0] + (nx / nl) * slope[1] + direction[0] * slope[2];
        normals[index + 1] = ey * slope[0] + (ny / nl) * slope[1] + direction[1] * slope[2];
        normals[index + 2] = 0 * slope[0] + (nz / nl) * slope[1] + direction[2] * slope[2];
      }

      marsColourAt(direction, colour);
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

export class MarsGlobe {
  readonly group = new Group();
  private readonly material: MeshBasicNodeMaterial;
  private readonly meshes = new Map<string, Mesh>();
  private readonly uSun = uniform(new Vector3(0, 1, 0));
  private triangles = 0;

  constructor(parent: Object3D) {
    this.group.name = 'mars';
    this.group.visible = false;
    parent.add(this.group);

    this.material = new MeshBasicNodeMaterial({ fog: false, side: FrontSide });
    const surface = attribute('color', 'vec3');
    const incidence = normalWorld.dot(this.uSun);
    // Mars has a thin atmosphere, so the terminator is slightly softer than the Moon
    const daylight = smoothstep(-0.05, 0.1, incidence).mul(incidence.max(0).add(0.08));
    this.material.colorNode = surface.mul(daylight.mul(1.4).add(0.02));
  }

  get stats(): { tiles: number; triangles: number; visible: boolean } {
    return { tiles: this.meshes.size, triangles: this.triangles, visible: this.group.visible };
  }

  set visible(visible: boolean) { this.group.visible = visible; }
  get visible(): boolean { return this.group.visible; }

  has(key: string): boolean {
    return this.meshes.has(key);
  }

  setCentre(positionM: Vec3): void {
    this.group.position.set(positionM[0], positionM[1], positionM[2]);
  }

  setOrientation(orientation: Quat): void {
    this.group.quaternion.set(orientation[0], orientation[1], orientation[2], orientation[3]);
  }

  setSunDirection(direction: Vec3): void {
    const length = Math.hypot(direction[0], direction[1], direction[2]);
    if (!(length > 0)) return;
    this.uSun.value.set(direction[0] / length, direction[1] / length, direction[2] / length);
  }

  add(key: string, mesh: MarsTileMesh): Mesh {
    this.remove(key);
    const object = new Mesh(mesh.geometry, this.material);
    object.name = `mars-${key}`;
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
