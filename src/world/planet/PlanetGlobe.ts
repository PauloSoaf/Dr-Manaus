import {
  BufferAttribute, BufferGeometry, FrontSide, Group, Mesh, MeshBasicNodeMaterial,
  type Object3D, Vector3,
} from 'three/webgpu';
import { attribute, normalWorld, smoothstep, uniform } from 'three/tsl';
import { PLANET_LAYER } from '../../rendering/domains/RenderDomains';
import { faceUvToDirection } from './CubeSphere';
import { planetTile, type PlanetTileAddress, tileBounds, tileCentreDirection } from './PlanetTileAddress';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from './PlanetSurface';
import { polarRadiusM } from './PlanetBody';
import type { Quat, Vec3 } from '../spatial/units';
import { PlanetVolumeSurfaceMask } from '../../rendering/PlanetVolumeSurfaceMask';

export const PLANET_TILE_RESOLUTION = 17;
export const PLANET_FALLBACK_INSET_M = 4;

export interface PlanetTileMesh {
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

export function buildPlanetTileMesh(address: PlanetTileAddress, surface: PlanetSurfaceGenerator, flat = false, insetM = 0,
  resolution = PLANET_TILE_RESOLUTION): PlanetTileMesh {
  const size = Math.max(3, Math.min(129, Math.round(resolution)));
  const { minU, maxU, minV, maxV } = tileBounds(address);
  const centreDirection = tileCentreDirection(address, [0, 0, 0]);
  const centreRadius = planetSurfaceRadius(surface, centreDirection, flat);
  const centre: Vec3 = [
    centreDirection[0] * centreRadius,
    centreDirection[1] * centreRadius,
    centreDirection[2] * centreRadius,
  ];

  const positions = new Float32Array(size * size * 3);
  const normals = new Float32Array(size * size * 3);
  const colors = new Float32Array(size * size * 3);
  const direction: Vec3 = [0, 0, 0];
  const colour: [number, number, number] = [0, 0, 0];
  const slope: [number, number, number] = [0, 0, 1];
  const equatorSquared = surface.body.semiMajorAxisM ** 2;
  const poleSquared = polarRadiusM(surface.body) ** 2;

  for (let row = 0; row < size; row++) {
    const v = minV + (maxV - minV) * (row / (size - 1));
    for (let column = 0; column < size; column++) {
      const u = minU + (maxU - minU) * (column / (size - 1));
      faceUvToDirection(address.face, u, v, direction);
      // A four-metre vertex inset alone cannot keep a coarse facet below a measured basin.
      // The envelope covers adjacent facets; their linear interpolation remains inside it.
      const radius = (insetM > 0 && !flat && surface.fallbackRadiusAt
        ? surface.fallbackRadiusAt(direction, Math.PI / (size - 1) / 2 ** address.level)
        : planetSurfaceRadius(surface, direction, flat)) - insetM;
      const index = (row * size + column) * 3;
      positions[index] = direction[0] * radius - centre[0];
      positions[index + 1] = direction[1] * radius - centre[1];
      positions[index + 2] = direction[2] * radius - centre[2];

      const ux = direction[0] / equatorSquared, uy = direction[1] / equatorSquared, uz = direction[2] / poleSquared;
      const upLength = Math.hypot(ux, uy, uz);
      const upX = ux / upLength, upY = uy / upLength, upZ = uz / upLength;
      if (flat) { slope[0] = 0; slope[1] = 0; slope[2] = 1; }
      else surface.normalEnu(direction, slope);
      const p = Math.hypot(direction[0], direction[1]);
      const ex = p > 1e-9 ? -direction[1] / p : 1, ey = p > 1e-9 ? direction[0] / p : 0;
      normals[index] = ex * slope[0] - upZ * ey * slope[1] + upX * slope[2];
      normals[index + 1] = ey * slope[0] + upZ * ex * slope[1] + upY * slope[2];
      normals[index + 2] = (upX * ey - upY * ex) * slope[1] + upZ * slope[2];

      surface.colourAt(direction, colour);
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
    geometry,
    centre,
    triangles: quads * 2,
    bytes: positions.byteLength + normals.byteLength + colors.byteLength + indices.byteLength,
  };
}

export class PlanetGlobe {
  readonly volumeMask:PlanetVolumeSurfaceMask;
  readonly root = new Group();
  readonly fallbackGroup = new Group();
  
  private readonly material: MeshBasicNodeMaterial;
  private readonly uSunDirectionRender = uniform(new Vector3(1, 0, 0));
  private readonly uTileOpacity = uniform(1);
  
  private readonly tiles = new Map<string, Mesh>();
  private requiredKeys?: ReadonlySet<string>;

  constructor(bodyId: string) {
    this.volumeMask=new PlanetVolumeSurfaceMask(bodyId);
    this.root.name = `${bodyId}Globe`;
    this.root.layers.set(PLANET_LAYER);
    this.fallbackGroup.name = `${bodyId}-coarse-fallback`;
    this.fallbackGroup.layers.set(PLANET_LAYER);
    this.root.add(this.fallbackGroup);

    this.material = new MeshBasicNodeMaterial({
      // colorNode reads the attribute itself. Enabling vertexColors would square the albedo.
      fog: false,
      side: FrontSide,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const sunDotNormal = normalWorld.dot(this.uSunDirectionRender);
    const terminator = smoothstep(-0.1, 0.1, sunDotNormal);
    const lit = attribute('color', 'vec3').mul(terminator.mix(0.05, 1.0));
    this.material.colorNode = lit;
    this.material.opacityNode = this.uTileOpacity;
  }

  set visible(visible: boolean) { this.root.visible = visible; }
  get visible(): boolean { return this.root.visible; }

  get stats(): { tiles: number; triangles: number; visible: boolean } {
    let triangles = 0;
    for (const tile of this.tiles.values()) triangles += tile.geometry.index?.count ?? 0;
    for (const tile of this.fallbackGroup.children as Mesh[]) triangles += tile.geometry.index?.count ?? 0;
    return { tiles: this.tiles.size, triangles: triangles / 3, visible: this.root.visible };
  }

  has(key: string): boolean {
    return this.tiles.has(key);
  }

  get fallbackReady(): boolean { return this.fallbackGroup.children.length === 6; }
  get opacity(): number { return this.uTileOpacity.value; }

  /** Created only for the active physical body, never for every registered provider shell. */
  ensureFallback(surface: PlanetSurfaceGenerator): void {
    if (this.fallbackReady) return;
    for (let face = 0; face < 6; face++) {
      const tile = buildPlanetTileMesh(planetTile(surface.body.id, face as 0, 0, 0, 0), surface, false,
        PLANET_FALLBACK_INSET_M, surface.coarseResolution);
      const mesh = new Mesh(tile.geometry, this.material);
      this.volumeMask.attach(mesh,tile.centre);
      mesh.name = `${surface.body.id}-fallback-face-${face}`;
      mesh.position.set(...tile.centre);
      mesh.layers.set(PLANET_LAYER);
      mesh.renderOrder = -1;
      mesh.frustumCulled = false;
      mesh.userData.surfaceInsetM = PLANET_FALLBACK_INSET_M;
      this.fallbackGroup.add(mesh);
    }
  }

  releaseFallback(): void {
    for (const child of this.fallbackGroup.children) {this.volumeMask.detach(child as Mesh);(child as Mesh).geometry.dispose();}
    this.fallbackGroup.clear();
  }

  /** Retired parent/child cuts must not draw on top of the new cut while the scheduler evicts them. */
  setRequiredTiles(keys: readonly string[]): void {
    this.requiredKeys = new Set(keys);
    for (const [key, mesh] of this.tiles) mesh.visible = this.requiredKeys.has(key);
  }

  set opacity(opacity: number) {
    this.uTileOpacity.value = opacity;
    this.material.transparent = opacity < 1;
  }

  setCentre(centreRenderM: Vec3): void {
    // Last-line defence: upstream (RockyPlanetProvider / CelestialPresentationController)
    // must guarantee render-safe coordinates before calling this method.
    // If this throws, the bug is in the caller, not here.
    const limit = 20_000_000;
    if (Math.abs(centreRenderM[0]) > limit || Math.abs(centreRenderM[1]) > limit || Math.abs(centreRenderM[2]) > limit) {
      throw new Error(
        `[PlanetGlobe] Invariant violated: astronomical render coordinate [${centreRenderM.map(v => v.toExponential(2)).join(', ')}] m.` +
        ' Caller must call RenderSpaceService.isRenderSafe() before positioning a physical globe.'
      );
    }
    this.root.position.set(centreRenderM[0], centreRenderM[1], centreRenderM[2]);
  }

  setOrientation(orientationScene: Quat): void {
    this.root.quaternion.set(orientationScene[0], orientationScene[1], orientationScene[2], orientationScene[3]);
  }

  setSunDirection(directionRender: Vec3): void {
    this.uSunDirectionRender.value.set(directionRender[0], directionRender[1], directionRender[2]);
  }

  add(key: string, mesh: PlanetTileMesh): void {
    if (this.tiles.has(key)) return;
    const tileMesh = new Mesh(mesh.geometry, this.material);
    this.volumeMask.attach(tileMesh,mesh.centre);
    tileMesh.layers.set(PLANET_LAYER);
    tileMesh.position.set(mesh.centre[0], mesh.centre[1], mesh.centre[2]);
    tileMesh.visible = !this.requiredKeys || this.requiredKeys.has(key);
    this.tiles.set(key, tileMesh);
    this.root.add(tileMesh);
  }

  remove(key: string): void {
    const tile = this.tiles.get(key);
    if (!tile) return;
    this.tiles.delete(key);
    this.volumeMask.detach(tile);
    this.root.remove(tile);
    tile.geometry.dispose();
  }

  dispose(): void {
    this.volumeMask.dispose();
    this.releaseFallback();
    this.material.dispose();
    for (const tile of this.tiles.values()) {
      tile.geometry.dispose();
    }
    this.tiles.clear();
  }
}
