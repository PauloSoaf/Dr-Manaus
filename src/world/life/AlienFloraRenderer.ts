/**
 * AlienFloraRenderer.ts
 *
 * High-performance, zero-allocation instanced alien flora renderer.
 * Spawns procedural flora archetypes on habitable and exotic planetary surfaces
 * using InstancedMesh, spatial cell partitioning, normal alignment, and distance culling.
 */

import {
  CylinderGeometry,
  ConeGeometry,
  DodecahedronGeometry,
  SphereGeometry,
  BufferGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Color,
  Vector3,
  Quaternion,
  Group,
} from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PlanetaryBiosphereProfile } from './PlanetaryBiosphere';
import type { FloraArchetype, PlanetaryBiomeSample } from './PlanetaryBiomeService';
import { PlanetaryBiomeService } from './PlanetaryBiomeService';
import type { PlanetSurfaceGenerator } from '../planet/PlanetSurface';
import type { Vec3 } from '../spatial/units';

export const FLORA_POOL_CAPACITY = 512;
export const FLORA_CELL_SIZE = 64; // 64 meters per cell
export const FLORA_ACTIVE_RADIUS = 192; // 3 cells radius (7x7 cell grid)
const MAX_DESTROYED_HISTORY = 2048;

function hash2(x: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x85ebca6b) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  h ^= h >>> 13;
  return ((h >>> 0) % 0xffff) / 0xffff;
}

function safeMerge(geos: BufferGeometry[]): BufferGeometry {
  const prepared = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(prepared);
  for (const g of geos) g.dispose();
  for (const g of prepared) {
    if (!geos.includes(g)) g.dispose();
  }
  return merged ?? new CylinderGeometry(0.3, 0.4, 4, 5);
}

/**
 * Creates low-poly merged procedural geometries for each flora archetype.
 */
function createFloraGeometry(archetype: FloraArchetype): BufferGeometry {
  switch (archetype) {
    case 'canopy-broadleaf': {
      // Trunk: cylinder, r=0.3, h=3
      const trunk = new CylinderGeometry(0.25, 0.4, 3, 5);
      trunk.translate(0, 1.5, 0);
      // Canopy: faceted dodecahedron, r=2.2
      const canopy = new DodecahedronGeometry(2.0, 0);
      canopy.translate(0, 4.0, 0);
      return safeMerge([trunk, canopy]);
    }

    case 'alien-conifers': {
      // Trunk: cylinder, r=0.25, h=2
      const trunk = new CylinderGeometry(0.2, 0.35, 2, 5);
      trunk.translate(0, 1.0, 0);
      // Foliage tiers: 2 stacked cones
      const tier1 = new ConeGeometry(1.8, 3.5, 5);
      tier1.translate(0, 3.2, 0);
      const tier2 = new ConeGeometry(1.2, 2.5, 5);
      tier2.translate(0, 4.8, 0);
      return safeMerge([trunk, tier1, tier2]);
    }

    case 'giant-spore-trees': {
      // Stalk: curved tall cylinder
      const stalk = new CylinderGeometry(0.5, 0.8, 5, 6);
      stalk.translate(0, 2.5, 0);
      // Fungal Cap: flattened hemisphere / sphere
      const cap = new SphereGeometry(2.8, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
      cap.scale(1.0, 0.4, 1.0);
      cap.translate(0, 5.0, 0);
      return safeMerge([stalk, cap]);
    }

    case 'bioluminescent-fungi': {
      // Stem: thin cylinder
      const stem = new CylinderGeometry(0.12, 0.2, 1.4, 5);
      stem.translate(0, 0.7, 0);
      // Glowing bulb cap: sphere
      const bulb = new SphereGeometry(0.65, 6, 5);
      bulb.translate(0, 1.6, 0);
      return safeMerge([stem, bulb]);
    }

    case 'crystalline-spires': {
      // Hexagonal mineral prism
      const prism = new CylinderGeometry(0.1, 0.75, 4.5, 6);
      prism.translate(0, 2.25, 0);
      return prism;
    }

    case 'xenoflora-succulents': {
      // Bulbous ribbed cluster
      const body = new SphereGeometry(1.4, 6, 5);
      body.scale(0.8, 1.4, 0.8);
      body.translate(0, 1.5, 0);
      return body;
    }

    case 'hydrocarbon-tendrils': {
      // Tapered twisting tendril
      const tendril = new ConeGeometry(0.35, 3.8, 5);
      tendril.translate(0, 1.9, 0);
      return tendril;
    }

    case 'none':
    default:
      return new CylinderGeometry(0.1, 0.1, 0.1, 3);
  }
}

export class AlienFloraRenderer {
  readonly root = new Group();
  private readonly meshes = new Map<FloraArchetype, InstancedMesh>();
  private readonly destroyedIds = new Set<string>();

  // Cached scratch math objects for zero allocations
  private readonly dummy = new Object3D();
  private readonly color = new Color();
  private readonly up = new Vector3(0, 1, 0);
  private readonly normal = new Vector3();
  private readonly quat = new Quaternion();
  private readonly floraPos = new Vector3();
  private readonly dirVec = new Vector3();

  private currentCellKey = '';
  private activeInstanceCounts = new Map<FloraArchetype, number>();

  constructor() {
    this.root.name = 'alien-flora-renderer';

    const archetypes: FloraArchetype[] = [
      'canopy-broadleaf',
      'alien-conifers',
      'giant-spore-trees',
      'bioluminescent-fungi',
      'crystalline-spires',
      'xenoflora-succulents',
      'hydrocarbon-tendrils',
    ];

    for (const arch of archetypes) {
      const geo = createFloraGeometry(arch);
      const isGlowing = arch === 'bioluminescent-fungi' || arch === 'crystalline-spires';
      const mat = new MeshStandardMaterial({
        roughness: isGlowing ? 0.3 : 0.8,
        metalness: arch === 'crystalline-spires' ? 0.4 : 0.1,
        emissive: isGlowing ? '#00e5ff' : '#000000',
        emissiveIntensity: isGlowing ? 0.35 : 0.0,
      });

      const mesh = new InstancedMesh(geo, mat, FLORA_POOL_CAPACITY);
      mesh.name = `flora-instances-${arch}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.meshes.set(arch, mesh);
      this.activeInstanceCounts.set(arch, 0);
      this.root.add(mesh);
    }
  }

  /**
   * Main per-frame update loop.
   * Only recalculates instances when crossing cell boundaries or when forced.
   */
  update(
    playerPos: Vector3,
    surface?: PlanetSurfaceGenerator,
    biosphere?: PlanetaryBiosphereProfile,
    forceRebuild = false,
  ): void {
    // 1. If world is sterile, in vacuum, or no surface exists: clear all instances
    if (!surface || !biosphere || biosphere.lifeTier === 'sterile' || biosphere.lifeTier === 'microbial') {
      this.clear();
      return;
    }

    const cx = Math.floor(playerPos.x / FLORA_CELL_SIZE);
    const cz = Math.floor(playerPos.z / FLORA_CELL_SIZE);
    const cellKey = `${biosphere.bodyId}:${cx},${cz}`;

    if (cellKey === this.currentCellKey && !forceRebuild) {
      return;
    }
    this.currentCellKey = cellKey;

    // Reset active instance counts for this frame
    for (const arch of this.meshes.keys()) {
      this.activeInstanceCounts.set(arch, 0);
    }

    // Radius in grid cells: 3 cells in each direction (-3 to +3)
    const cellRadius = Math.ceil(FLORA_ACTIVE_RADIUS / FLORA_CELL_SIZE);
    const floraSeed = biosphere.seeds.floraSeed;

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const cellX = cx + dx;
        const cellZ = cz + dz;
        const cellWorldX = cellX * FLORA_CELL_SIZE + FLORA_CELL_SIZE * 0.5;
        const cellWorldZ = cellZ * FLORA_CELL_SIZE + FLORA_CELL_SIZE * 0.5;

        // Check planar distance to cell center
        const distSq = (cellWorldX - playerPos.x) ** 2 + (cellWorldZ - playerPos.z) ** 2;
        if (distSq > FLORA_ACTIVE_RADIUS * FLORA_ACTIVE_RADIUS) {
          continue;
        }

        this.populateCell(cellX, cellZ, surface, biosphere, floraSeed);
      }
    }

    // Apply updated counts to instanced meshes
    for (const [arch, mesh] of this.meshes.entries()) {
      const count = this.activeInstanceCounts.get(arch) ?? 0;
      mesh.count = count;
      if (count > 0) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }
      }
    }
  }

  private populateCell(
    cellX: number,
    cellZ: number,
    surface: PlanetSurfaceGenerator,
    biosphere: PlanetaryBiosphereProfile,
    floraSeed: number,
  ): void {
    // Sample biome at cell center
    const originRadius = surface.radiusM;
    const cellMidX = cellX * FLORA_CELL_SIZE;
    const cellMidZ = cellZ * FLORA_CELL_SIZE;

    // Geocentric direction approximation for local coordinate
    const hyp = Math.hypot(cellMidX, cellMidZ);
    const radY = Math.sqrt(Math.max(1, originRadius * originRadius - hyp * hyp));
    this.dirVec.set(cellMidX, radY, cellMidZ).normalize();
    const dir: Vec3 = [this.dirVec.x, this.dirVec.y, this.dirVec.z];

    const biome: PlanetaryBiomeSample = surface.biomeAt
      ? surface.biomeAt(dir)
      : PlanetaryBiomeService.sampleBiome({
          biosphere,
          latRad: Math.asin(Math.max(-1, Math.min(1, dir[2]))),
          lonRad: Math.atan2(dir[1], dir[0]),
          altitudeM: surface.heightAt(dir),
        });

    if (biome.vegetationDensity <= 0.02 || biome.floraArchetype === 'none' || biome.isUnderwater) {
      return;
    }

    const mesh = this.meshes.get(biome.floraArchetype);
    if (!mesh) return;

    const currentCount = this.activeInstanceCounts.get(biome.floraArchetype) ?? 0;
    if (currentCount >= FLORA_POOL_CAPACITY) return;

    // Determine number of instances in this cell based on vegetation density (1 to 6)
    const instancesInCell = Math.max(1, Math.floor(biome.vegetationDensity * 6));

    for (let i = 0; i < instancesInCell; i++) {
      const idx = (this.activeInstanceCounts.get(biome.floraArchetype) ?? 0);
      if (idx >= FLORA_POOL_CAPACITY) break;

      const instanceId = `${biosphere.bodyId}:${cellX}:${cellZ}:${i}`;
      if (this.destroyedIds.has(instanceId)) {
        continue;
      }

      // Deterministic offset within cell
      const u = hash2(cellX * 13 + i * 7, cellZ * 17 + i * 3, floraSeed);
      const v = hash2(cellX * 23 + i * 11, cellZ * 29 + i * 5, floraSeed + 101);

      const localX = (cellX + (u - 0.5) * 0.9) * FLORA_CELL_SIZE;
      const localZ = (cellZ + (v - 0.5) * 0.9) * FLORA_CELL_SIZE;

      // Sample surface height and normal at instance location
      this.dirVec.set(localX, radY, localZ).normalize();
      const instanceDir: Vec3 = [this.dirVec.x, this.dirVec.y, this.dirVec.z];
      const reliefM = surface.heightAt(instanceDir);

      const surfaceNormal: Vec3 = [0, 1, 0];
      surface.normalEnu(instanceDir, surfaceNormal);
      this.normal.set(surfaceNormal[0], surfaceNormal[1], surfaceNormal[2]).normalize();

      this.floraPos.set(localX, reliefM, localZ);

      // Align local +Y to surface normal with random azimuthal rotation
      this.quat.setFromUnitVectors(this.up, this.normal);
      const azimuthAngle = u * Math.PI * 2;
      const azimQuat = new Quaternion().setFromAxisAngle(this.normal, azimuthAngle);
      this.quat.premultiply(azimQuat);

      // Random scale variation: 0.75x to 1.35x
      const scaleFactor = 0.75 + v * 0.6;
      this.dummy.position.copy(this.floraPos);
      this.dummy.quaternion.copy(this.quat);
      this.dummy.scale.set(scaleFactor, scaleFactor, scaleFactor);
      this.dummy.updateMatrix();

      mesh.setMatrixAt(idx, this.dummy.matrix);

      // Instance foliage color from biome palette with minor tint variation
      this.color.setHex(biome.colorPalette.foliage);
      if (u > 0.6) {
        this.color.offsetHSL((v - 0.5) * 0.08, 0, (u - 0.5) * 0.1);
      }
      mesh.setColorAt(idx, this.color);

      this.activeInstanceCounts.set(biome.floraArchetype, idx + 1);
    }
  }

  /**
   * Destroys all flora instances within a circular radius (e.g. from impacts or powers).
   */
  destroyInRadius(center: Vector3, radiusM: number, biosphere?: PlanetaryBiosphereProfile): number {
    let destroyed = 0;
    const rSq = radiusM * radiusM;

    for (let cx = Math.floor((center.x - radiusM) / FLORA_CELL_SIZE); cx <= Math.ceil((center.x + radiusM) / FLORA_CELL_SIZE); cx++) {
      for (let cz = Math.floor((center.z - radiusM) / FLORA_CELL_SIZE); cz <= Math.ceil((center.z + radiusM) / FLORA_CELL_SIZE); cz++) {
        for (let i = 0; i < 8; i++) {
          const bodyId = biosphere?.bodyId ?? 'active';
          const instanceId = `${bodyId}:${cx}:${cz}:${i}`;
          if (!this.destroyedIds.has(instanceId)) {
            const cellMidX = cx * FLORA_CELL_SIZE;
            const cellMidZ = cz * FLORA_CELL_SIZE;
            if ((cellMidX - center.x) ** 2 + (cellMidZ - center.z) ** 2 <= rSq) {
              this.destroyedIds.add(instanceId);
              destroyed++;
              if (this.destroyedIds.size > MAX_DESTROYED_HISTORY) {
                const first = this.destroyedIds.values().next().value;
                if (first) this.destroyedIds.delete(first);
              }
            }
          }
        }
      }
    }

    if (destroyed > 0) {
      this.currentCellKey = ''; // Force refresh
    }
    return destroyed;
  }

  /**
   * Restores destroyed flora in a radius around center, allowing them to regrow.
   */
  reconstruct(center: Vector3, radiusM: number): number {
    let restored = 0;
    const rSq = radiusM * radiusM;

    for (const id of Array.from(this.destroyedIds)) {
      // id format: `${bodyId}:${cx}:${cz}:${i}`
      const parts = id.split(':');
      if (parts.length >= 3) {
        const cx = parseInt(parts[1], 10);
        const cz = parseInt(parts[2], 10);
        if (!isNaN(cx) && !isNaN(cz)) {
          const cellMidX = cx * FLORA_CELL_SIZE;
          const cellMidZ = cz * FLORA_CELL_SIZE;
          if ((cellMidX - center.x) ** 2 + (cellMidZ - center.z) ** 2 <= rSq) {
            this.destroyedIds.delete(id);
            restored++;
          }
        }
      }
    }

    if (restored > 0) {
      this.currentCellKey = ''; // Force refresh so flora reappears
    }
    return restored;
  }

  /**
   * Completely clears and hides all instanced meshes.
   */
  clear(): void {
    this.currentCellKey = '';
    for (const [arch, mesh] of this.meshes.entries()) {
      mesh.count = 0;
      this.activeInstanceCounts.set(arch, 0);
    }
  }

  /**
   * Retrieves active instance count for a specific archetype.
   */
  getActiveCount(archetype: FloraArchetype): number {
    return this.activeInstanceCounts.get(archetype) ?? 0;
  }

  /**
   * Cleans up GPU resources upon teardown.
   */
  dispose(): void {
    this.clear();
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) m.dispose();
      } else {
        mesh.material.dispose();
      }
      this.root.remove(mesh);
    }
    this.meshes.clear();
    this.root.removeFromParent();
  }
}
