import { BoxGeometry, Color, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { WORLD } from '../../core/config';
import type { Collider } from '../../core/types';
import { buildingAllowed, isLand, riverWidth, shoreZ } from '../geodata/geodata';
import { BUILDING_STRIDE, TREE_STRIDE, chunkKey, type ChunkPayload } from '../chunks/Chunk';
import { chunkSeed, generateChunk, seededRandom, urbanDensity } from '../chunks/BuildingGenerator';

interface Aggregate { x: number; z: number; w: number; d: number; h: number; color: number }

const CITY_COLORS = [0xc98d70, 0xc8b384, 0x88a39d, 0xa6a68d, 0xb86f5d, 0x7f9694] as const;
const PONTA_COLORS = [0xcda77c, 0xd4c49e, 0x75969b, 0xb88770, 0x8ca3a0] as const;
const IRANDUBA_COLORS = [0x92a477, 0xb79d76, 0x718d7d, 0xc4ad83, 0x6f8671] as const;

function distantColor(x: number, z: number, random: () => number): number {
  const opposite = z >= shoreZ(x) + riverWidth(x) - 20;
  const ponta = x < -6500 && z < -2200;
  const palette = opposite ? IRANDUBA_COLORS : ponta ? PONTA_COLORS : CITY_COLORS;
  return palette[Math.floor(random() * palette.length)];
}

/** Four instanced draws cover the city beyond the streamed neighbourhood.
 * Proxy data is generated incrementally and never carries physics, actors or lights.
 */
export class HLODManager {
  private readonly group = new Group();
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly canopyGeometry = new IcosahedronGeometry(1, 0);
  private readonly canopyMaterial = new MeshStandardMaterial({ color: 0x57744c, roughness: 1 });
  private readonly mediumMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .95 });
  private readonly aggregateMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  private readonly horizonMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  private readonly medium = new InstancedMesh(this.geometry, this.mediumMaterial, 10000);
  private readonly aggregate = new InstancedMesh(this.geometry, this.aggregateMaterial, 8000);
  private readonly horizon = new InstancedMesh(this.geometry, this.horizonMaterial, 2400);
  private readonly canopy = new InstancedMesh(this.canopyGeometry, this.canopyMaterial, 8000);
  private readonly proxies = new Map<string, ChunkPayload>();
  private readonly aggregates: Aggregate[] = [];
  private readonly horizons: Aggregate[] = [];
  private readonly matrix = new Matrix4();
  private readonly color = new Color();
  private readonly previous = new Vector3(Infinity, Infinity, Infinity);
  private readonly colliderList: Collider[] = [];
  private readonly distantPosition = new Vector3(Infinity, Infinity, Infinity);
  private pending: { cx: number; cz: number; distance: number }[] = [];
  private coverage = '';
  private lastBuild = 0;
  private detailRadius: number = WORLD.detailRadius;
  private dirty = true;

  constructor(root: Group) {
    this.group.name = 'city-hierarchical-lod'; root.add(this.group);
    this.medium.name = 'LOD1-city-proxies'; this.aggregate.name = 'LOD2-urban-blocks'; this.horizon.name = 'LOD3-distant-silhouettes';
    this.canopy.name = 'LOD1-tropical-canopy';
    for (const mesh of [this.medium, this.aggregate, this.horizon, this.canopy]) {
      mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(DynamicDrawUsage); this.group.add(mesh);
    }
    this.createDistantNodes();
    this.rebuildDistant(new Vector3());
  }
  get nodeCount(): number { return this.medium.count + this.aggregate.count + this.horizon.count + this.canopy.count; }
  get colliders(): readonly Collider[] { return this.colliderList; }
  get stats(): { medium: number; aggregate: number; horizon: number; vegetation: number; cached: number } {
    return { medium: this.medium.count, aggregate: this.aggregate.count, horizon: this.horizon.count, vegetation: this.canopy.count, cached: this.proxies.size };
  }

  update(position: Vector3, activeKeys?: ReadonlySet<string>): void {
    const dx = position.x - this.previous.x, dz = position.z - this.previous.z;
    if (dx * dx + dz * dz > WORLD.chunkSize * WORLD.chunkSize) {
      this.previous.copy(position); this.planMedium(position); this.dirty = true;
    }
    const now = performance.now();
    // A handful of pure proxy records per frame amortizes generation during fast traversal.
    const start = now;
    let generated = 0;
    while (this.pending.length && generated < 8 && performance.now() - start < 1.2) {
      const request = this.pending.shift()!;
      this.proxies.set(chunkKey(request.cx, request.cz), generateChunk(request.cx, request.cz)); generated++;
    }
    if (generated) this.dirty = true;
    const coverage = activeKeys ? [...activeKeys].join(';') : '';
    const coverageChanged = coverage !== this.coverage;
    if (coverageChanged) { this.coverage = coverage; this.dirty = true; }
    // Coverage swaps in the same frame as detailed activation: never double-render near facades.
    if (this.dirty && (coverageChanged || now - this.lastBuild > 85)) {
      this.rebuildMedium(position, activeKeys); this.lastBuild = now; this.dirty = false;
    }
    const farX = position.x - this.distantPosition.x, farZ = position.z - this.distantPosition.z;
    if (farX * farX + farZ * farZ > 256 * 256) this.rebuildDistant(position);
  }

  private planMedium(position: Vector3): void {
    const cx = Math.floor(position.x / WORLD.chunkSize), cz = Math.floor(position.z / WORLD.chunkSize);
    const radius = Math.ceil((WORLD.mediumRadius + WORLD.hysteresis) / WORLD.chunkSize);
    const keep = new Set<string>(); this.pending.length = 0;
    for (let z = -radius; z <= radius; z++) for (let x = -radius; x <= radius; x++) {
      const ix = cx + x, iz = cz + z;
      const distance = Math.hypot((ix + .5) * WORLD.chunkSize - position.x, (iz + .5) * WORLD.chunkSize - position.z);
      if (distance > WORLD.mediumRadius + WORLD.chunkSize) continue;
      const key = chunkKey(ix, iz); keep.add(key);
      if (!this.proxies.has(key)) this.pending.push({ cx: ix, cz: iz, distance });
    }
    this.pending.sort((a, b) => a.distance - b.distance);
    for (const key of this.proxies.keys()) if (!keep.has(key)) this.proxies.delete(key);
  }

  private rebuildMedium(position: Vector3, activeKeys?: ReadonlySet<string>): void {
    let index = 0, canopyIndex = 0;
    this.colliderList.length = 0;
    const collisionRadiusSq = 900 * 900;
    for (const [key, payload] of this.proxies) {
      const distance = Math.hypot((payload.cx + .5) * WORLD.chunkSize - position.x, (payload.cz + .5) * WORLD.chunkSize - position.z);
      if (activeKeys ? activeKeys.has(key) : distance < this.detailRadius) continue;
      // Soft height ramp at the outside of the medium ring blends into the aggregate silhouette.
      const fade = Math.max(0, Math.min(1, (WORLD.mediumRadius + WORLD.chunkSize - distance) / WORLD.chunkSize));
      if (fade <= 0) continue;
      const data = payload.buildings;
      for (let p = 0; p < data.length && index < 10000; p += BUILDING_STRIDE) {
        const h = (data[p + 3] + data[p + 8] * .5) * fade;
        const x = data[p], z = data[p + 1];
        this.set(this.medium, index, x, h * .5, z, data[p + 2], h, data[p + 4]);
        if (z >= shoreZ(x) + riverWidth(x) - 20) {
          this.medium.setColorAt(index++, this.color.setRGB(data[p + 5] * .58, data[p + 6] * .78, data[p + 7] * .6));
        } else if (x < -6500 && z < -2200) {
          this.medium.setColorAt(index++, this.color.setRGB(data[p + 5] * .78, data[p + 6] * .64, data[p + 7] * .52));
        } else {
          this.medium.setColorAt(index++, this.color.setRGB(data[p + 5] * .68, data[p + 6] * .70, data[p + 7] * .72));
        }
        const dx = x - position.x, dz = z - position.z;
        if (dx * dx + dz * dz <= collisionRadiusSq) {
          const fullHeight = data[p + 3] + data[p + 8];
          this.colliderList.push({
            x, y: fullHeight * .5, z,
            width: data[p + 2], height: fullHeight, depth: data[p + 4],
            id: `hlod:${key}/building/${p / BUILDING_STRIDE}`,
          });
        }
      }
      for (let p = 0; p < payload.trees.length && canopyIndex < 8000; p += TREE_STRIDE) {
        const tree = payload.trees, radius = tree[p + 3] * fade;
        this.set(this.canopy, canopyIndex++, tree[p], tree[p + 2] * fade, tree[p + 1], radius, radius * .7, radius);
      }
    }
    this.medium.count = index; this.medium.instanceMatrix.needsUpdate = true;
    if (this.medium.instanceColor) this.medium.instanceColor.needsUpdate = true;
    this.canopy.count = canopyIndex; this.canopy.instanceMatrix.needsUpdate = true;
  }

  private createDistantNodes(): void {
    const extent = WORLD.horizonRadius;
    // LOD2 represents several actual lots per volume, not a solid carpet or city-sized mesh.
    for (let z = -extent; z < 5000; z += 256) for (let x = -19000; x < 19000; x += 256) {
      const density = urbanDensity(x, z); if (density < .15 || !isLand(x, z)) continue;
      const random = seededRandom(chunkSeed(x / 256, z / 256));
      for (let n = 0; n < 3; n++) {
        const px = x + 30 + random() * 190, pz = z + 30 + random() * 190;
        const w = 25 + random() * 48, d = 20 + random() * 43;
        if (!buildingAllowed(px, pz, Math.max(w, d) * .55)) continue;
        this.aggregates.push({ x: px, z: pz, w, d, h: 7 + random() ** 4 * 40, color: distantColor(px, pz, random) });
      }
    }
    for (let z = -extent; z < 6000; z += 768) for (let x = -20000; x < 20000; x += 768) {
      const density = urbanDensity(x, z); if (density < .08 || !isLand(x, z)) continue;
      const random = seededRandom(chunkSeed(x, z));
      for (let n = 0; n < 3; n++) {
        const px = x + random() * 670, pz = z + random() * 670;
        if (!buildingAllowed(px, pz, 95)) continue;
        this.horizons.push({ x: px, z: pz, w: 75 + random() * 150, d: 65 + random() * 150,
          h: 8 + random() ** 3 * 50, color: distantColor(px, pz, random) });
      }
    }
  }

  private rebuildDistant(position: Vector3): void {
    this.distantPosition.copy(position);
    let index = 0;
    for (const node of this.aggregates) {
      const distance = Math.hypot(node.x - position.x, node.z - position.z);
      if (distance < WORLD.mediumRadius - WORLD.hysteresis || distance > WORLD.aggregateRadius + WORLD.hysteresis || index >= 8000) continue;
      const fade = Math.min(1, Math.max(0, (distance - WORLD.mediumRadius + WORLD.hysteresis) / 180),
        Math.max(0, (WORLD.aggregateRadius + WORLD.hysteresis - distance) / 180));
      this.set(this.aggregate, index, node.x, node.h * fade * .5, node.z, node.w, node.h * fade, node.d);
      this.aggregate.setColorAt(index++, this.color.setHex(node.color));
    }
    this.aggregate.count = index; this.aggregate.instanceMatrix.needsUpdate = true;
    if (this.aggregate.instanceColor) this.aggregate.instanceColor.needsUpdate = true;
    index = 0;
    for (const node of this.horizons) {
      const distance = Math.hypot(node.x - position.x, node.z - position.z);
      if (distance < WORLD.aggregateRadius - WORLD.hysteresis || distance > WORLD.horizonRadius || index >= 2400) continue;
      const fade = Math.min(1, Math.max(0, (distance - WORLD.aggregateRadius + WORLD.hysteresis) / 380));
      this.set(this.horizon, index, node.x, node.h * fade * .5, node.z, node.w, node.h * fade, node.d);
      this.horizon.setColorAt(index++, this.color.setHex(node.color));
    }
    this.horizon.count = index; this.horizon.instanceMatrix.needsUpdate = true;
    if (this.horizon.instanceColor) this.horizon.instanceColor.needsUpdate = true;
  }

  private set(mesh: InstancedMesh, index: number, x: number, y: number, z: number, w: number, h: number, d: number): void {
    this.matrix.makeScale(w, h, d); this.matrix.setPosition(x, y, z); mesh.setMatrixAt(index, this.matrix);
  }
  setDetailRadius(radius: number): void { this.detailRadius = radius; this.dirty = true; }
  setDebug(enabled: boolean): void {
    this.mediumMaterial.color.setHex(enabled ? 0x65dfef : 0xffffff);
    this.aggregateMaterial.color.setHex(enabled ? 0xf7bb70 : 0xffffff);
    this.horizonMaterial.color.setHex(enabled ? 0xe579ce : 0xffffff);
  }
  dispose(): void {
    this.group.removeFromParent(); this.medium.dispose(); this.aggregate.dispose(); this.horizon.dispose(); this.canopy.dispose();
    this.geometry.dispose(); this.canopyGeometry.dispose(); this.canopyMaterial.dispose();
    this.mediumMaterial.dispose(); this.aggregateMaterial.dispose(); this.horizonMaterial.dispose(); this.proxies.clear(); this.colliderList.length = 0;
  }
}
