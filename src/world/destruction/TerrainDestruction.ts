import {
  BufferAttribute, BufferGeometry, DataTexture, DoubleSide, DynamicDrawUsage, Group, LinearFilter,
  Material, Mesh, MeshBasicMaterial, MeshBasicNodeMaterial, MeshStandardMaterial, MeshStandardNodeMaterial,
  RGBAFormat, Vector2, Vector3, type Node, type Object3D,
} from 'three/webgpu';
import { bool, positionWorld, texture, uniform } from 'three/tsl';
import type { TerrainProvider } from '../../physics/PhysicsWorld';

export const TERRAIN_DAMAGE = {
  maxStored: 256, maxActive: 32, radiusMin: 3, radiusMax: 35, depthMax: 20,
  span: 512, cells: 256, recenterStep: 64, surfaceMinY: -1.25, surfaceMaxY: 1.25,
} as const;
const GRID = TERRAIN_DAMAGE.cells + 1, STEP = TERRAIN_DAMAGE.span / TERRAIN_DAMAGE.cells;
const DEPTH_QUANTUM = TERRAIN_DAMAGE.depthMax / 255;
export interface CraterRecord { id: number; x: number; z: number; radius: number; depth: number; order: number }
type GroundMaterial = MeshStandardNodeMaterial | MeshBasicNodeMaterial;

function finite(value: number, fallback = 0): number { return Number.isFinite(value) ? value : fallback; }

/**
 * A clipped heightfield, not a decal. One shared texture discards the original surface while
 * one indexed earth mesh supplies the actual bowl. Physics samples the exact same triangles.
 * Far craters retain only a compact descriptor and reappear when their neighbourhood streams.
 */
export class TerrainDestruction implements TerrainProvider {
  readonly group = new Group();
  readonly bowl: Mesh;
  private readonly records: CraterRecord[] = [];
  private readonly active: CraterRecord[] = [];
  private readonly heights = new Float32Array(GRID * GRID);
  private readonly pixels = new Uint8Array(GRID * GRID * 4);
  private readonly positions = new Float32Array(GRID * GRID * 3);
  private readonly normals = new Float32Array(GRID * GRID * 3);
  private readonly colors = new Float32Array(GRID * GRID * 3);
  private readonly indices = new Uint32Array(TERRAIN_DAMAGE.cells * TERRAIN_DAMAGE.cells * 6);
  private readonly geometry = new BufferGeometry();
  private readonly earth = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0, side: DoubleSide });
  private readonly mask = new DataTexture(this.pixels, GRID, GRID, RGBAFormat);
  private readonly uOrigin = uniform(new Vector3());
  private readonly uMinimum = uniform(new Vector2(-TERRAIN_DAMAGE.span / 2, -TERRAIN_DAMAGE.span / 2));
  private readonly references = new Map<Material, number>();
  private readonly replacements = new Map<Material, GroundMaterial>();
  private readonly bindings = new Map<Mesh, Material | Material[]>();
  private readonly geometryDisposals = new Map<Mesh, () => void>();
  private readonly focus = new Vector3();
  private centerX = 0;
  private centerZ = 0;
  private nextId = 1;
  private revision = 0;
  private geometryRevision = 0;
  private lastBuildMs = 0;
  private triangles = 0;
  private dirty = false;
  private disposed = false;

  constructor(root: Group) {
    this.group.name = 'destructible-earth'; root.add(this.group);
    this.mask.name = 'terrain-crater-height-mask'; this.mask.minFilter = LinearFilter; this.mask.magFilter = LinearFilter;
    this.mask.generateMipmaps = false; this.mask.flipY = false; this.mask.needsUpdate = true;
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('normal', new BufferAttribute(this.normals, 3).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('color', new BufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage));
    this.geometry.setIndex(new BufferAttribute(this.indices, 1).setUsage(DynamicDrawUsage)); this.geometry.setDrawRange(0, 0);
    this.bowl = new Mesh(this.geometry, this.earth); this.bowl.name = 'crater-earth-bowls';
    this.bowl.userData.terrainDestructionBowl = true; this.bowl.receiveShadow = true; this.bowl.visible = false;
    this.group.add(this.bowl);
  }

  get stats(): { stored: number; active: number; surfaces: number; triangles: number; revision: number; buildMs: number; bytes: number } {
    return { stored: this.records.length, active: this.active.length, surfaces: this.bindings.size, triangles: this.triangles,
      revision: this.geometryRevision, buildMs: this.lastBuildMs,
      bytes: this.heights.byteLength + this.pixels.byteLength + this.positions.byteLength + this.normals.byteLength + this.colors.byteLength + this.indices.byteLength };
  }
  get craters(): readonly Readonly<CraterRecord>[] { return this.records; }

  damageAt(point: Vector3, radius: number, damage: number): boolean {
    if (this.disposed || !Number.isFinite(point.x + point.y + point.z + radius + damage) || damage <= 0 || radius <= 0) return false;
    const r = Math.min(TERRAIN_DAMAGE.radiusMax, Math.max(TERRAIN_DAMAGE.radiusMin, radius));
    // A blast above roofs must not punch the ground many metres underneath it.
    if (point.y > r * .55 + 2 || point.y < -TERRAIN_DAMAGE.depthMax - 3) return false;
    const depth = Math.min(TERRAIN_DAMAGE.depthMax, Math.max(3, r * .36 + Math.sqrt(damage) * .32));
    const nearby = this.records.find(record => (record.x - point.x) ** 2 + (record.z - point.z) ** 2 < Math.max(2, r * .18) ** 2);
    if (nearby) {
      nearby.radius = Math.min(TERRAIN_DAMAGE.radiusMax, Math.max(nearby.radius, r));
      nearby.depth = Math.min(TERRAIN_DAMAGE.depthMax, Math.max(nearby.depth, depth) + Math.min(2, damage * .006));
      nearby.order = ++this.revision;
    } else {
      this.records.push({ id: this.nextId++, x: point.x, z: point.z, radius: r, depth, order: ++this.revision });
    }
    if (this.records.length > TERRAIN_DAMAGE.maxStored) {
      let oldest = 0;
      for (let i = 1; i < this.records.length; i++) if (this.records[i].order < this.records[oldest].order) oldest = i;
      this.records.splice(oldest, 1);
    }
    // Coalesce an energy wave/plough's many impacts into one mesh upload in update().
    this.dirty = true; return true;
  }

  restoreAt(point: Vector3, radius: number): number {
    if (this.disposed || !Number.isFinite(point.x + point.z + radius) || radius < 0) return 0;
    let restored = 0;
    for (let i = this.records.length - 1; i >= 0; i--) {
      const crater = this.records[i];
      if (Math.hypot(point.x - crater.x, point.z - crater.z) > radius + crater.radius) continue;
      this.records.splice(i, 1); restored++;
    }
    if (restored) { this.revision++; this.dirty = true; }
    return restored;
  }
  reconstruct(point: Vector3, radius: number): number { return this.restoreAt(point, radius); }

  update(player: Vector3, origin: Vector3): void {
    if (this.disposed) return;
    this.focus.copy(player); this.uOrigin.value.copy(origin);
    const x = Math.round(finite(player.x) / TERRAIN_DAMAGE.recenterStep) * TERRAIN_DAMAGE.recenterStep;
    const z = Math.round(finite(player.z) / TERRAIN_DAMAGE.recenterStep) * TERRAIN_DAMAGE.recenterStep;
    if (x !== this.centerX || z !== this.centerZ) { this.centerX = x; this.centerZ = z; this.dirty = true; }
    if (this.dirty) this.rebuild();
  }

  /** Register once when a ground/road/plaza mesh enters the scene; never traversed per frame. */
  registerSurface(mesh: Mesh): void {
    if (this.disposed || mesh.userData.terrainDestructionBowl || this.bindings.has(mesh)) return;
    const original = mesh.material;
    this.bindings.set(mesh, original);
    for(const material of Array.isArray(original)?original:[original])this.references.set(material,(this.references.get(material)??0)+1);
    mesh.material = Array.isArray(original) ? original.map(material => this.convertMaterial(material)) : this.convertMaterial(original);
    const onGeometryDispose = () => this.unregisterSurface(mesh);
    this.geometryDisposals.set(mesh, onGeometryDispose); mesh.geometry.addEventListener('dispose', onGeometryDispose);
  }
  unregisterSurface(mesh: Mesh): void {
    const original = this.bindings.get(mesh); if (!original) return;
    mesh.material = original; this.bindings.delete(mesh);
    const cleanup = this.geometryDisposals.get(mesh);
    if (cleanup) mesh.geometry.removeEventListener('dispose', cleanup);
    this.geometryDisposals.delete(mesh);
    for(const material of Array.isArray(original)?original:[original]){const count=(this.references.get(material)??1)-1;if(count>0)this.references.set(material,count);else{this.references.delete(material);this.replacements.get(material)?.dispose();this.replacements.delete(material);}}
  }
  /** The caller selects a newly-added surface subtree. Mixed meshes are cut only in the ground band. */
  attach(object: Object3D): void {
    object.traverse(child => { if (child instanceof Mesh && !child.userData.terrainDestructionBowl) this.registerSurface(child); });
  }
  detach(object: Object3D): void { object.traverse(child => { if (child instanceof Mesh) this.unregisterSurface(child); }); }

  private convertMaterial(original: Material): Material {
    if (!(original instanceof MeshStandardMaterial || original instanceof MeshStandardNodeMaterial || original instanceof MeshBasicMaterial || original instanceof MeshBasicNodeMaterial)) return original;
    let material = this.replacements.get(original); if (material) return material;
    material = original instanceof MeshBasicMaterial || original instanceof MeshBasicNodeMaterial ? new MeshBasicNodeMaterial() : new MeshStandardNodeMaterial();
    material.copy(original); material.name = `${original.name || original.type}:crater-surface`;
    const global = positionWorld.add(this.uOrigin);
    const cell = global.xz.sub(this.uMinimum).div(STEP);
    const uv = cell.add(.5).div(GRID);
    const maskDepth = texture(this.mask, uv).r;
    const inside = cell.x.greaterThanEqual(0).and(cell.x.lessThanEqual(TERRAIN_DAMAGE.cells))
      .and(cell.y.greaterThanEqual(0)).and(cell.y.lessThanEqual(TERRAIN_DAMAGE.cells));
    const groundBand = global.y.greaterThanEqual(TERRAIN_DAMAGE.surfaceMinY).and(global.y.lessThanEqual(TERRAIN_DAMAGE.surfaceMaxY));
    const intact = inside.and(groundBand).and(maskDepth.greaterThan(.0001)).not();
    material.maskNode = material.maskNode ? bool(material.maskNode as Node<'bool'>).and(intact) : intact;
    material.maskShadowNode = material.maskShadowNode ? bool(material.maskShadowNode as Node<'bool'>).and(intact) : intact;
    material.needsUpdate = true; this.replacements.set(original, material); return material;
  }

  private rebuild(): void {
    if (!this.dirty || this.disposed) return;
    const started = performance.now(); this.dirty = false;
    const minimumX = this.centerX - TERRAIN_DAMAGE.span * .5, minimumZ = this.centerZ - TERRAIN_DAMAGE.span * .5;
    this.uMinimum.value.set(minimumX, minimumZ);
    this.bowl.position.set(minimumX, 0, minimumZ);
    const candidates = this.records.filter(crater => Math.abs(crater.x - this.centerX) + crater.radius < TERRAIN_DAMAGE.span * .5 - STEP && Math.abs(crater.z - this.centerZ) + crater.radius < TERRAIN_DAMAGE.span * .5 - STEP);
    candidates.sort((a, b) => (a.x - this.focus.x) ** 2 + (a.z - this.focus.z) ** 2 - (b.x - this.focus.x) ** 2 - (b.z - this.focus.z) ** 2);
    const previouslyActive = this.active.length;
    this.active.length = 0; this.active.push(...candidates.slice(0, TERRAIN_DAMAGE.maxActive));
    if (!this.active.length) {
      if (previouslyActive) { this.heights.fill(0); this.pixels.fill(0); this.mask.needsUpdate = true; }
      this.geometry.setDrawRange(0, 0); this.triangles = 0; this.bowl.visible = false; this.geometryRevision++;
      this.lastBuildMs = performance.now() - started; return;
    }
    this.heights.fill(0); this.pixels.fill(0);
    let lowX=GRID-1,lowZ=GRID-1,highX=0,highZ=0;
    for (const crater of this.active) {
      const x0 = Math.max(0, Math.floor((crater.x - crater.radius - minimumX) / STEP));
      const x1 = Math.min(TERRAIN_DAMAGE.cells, Math.ceil((crater.x + crater.radius - minimumX) / STEP));
      const z0 = Math.max(0, Math.floor((crater.z - crater.radius - minimumZ) / STEP));
      const z1 = Math.min(TERRAIN_DAMAGE.cells, Math.ceil((crater.z + crater.radius - minimumZ) / STEP));
      lowX=Math.min(lowX,x0);lowZ=Math.min(lowZ,z0);highX=Math.max(highX,x1);highZ=Math.max(highZ,z1);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const distance2 = (minimumX + x * STEP - crater.x) ** 2 + (minimumZ + z * STEP - crater.z) ** 2;
        const radial = Math.max(0, 1 - distance2 / (crater.radius * crater.radius));
        // Quantization is shared by the mask, vertices and collision height: no hidden floor.
        // A broad cavity with a steep exposed edge reads as excavation even from ground level.
        const profile = 1 - (1 - radial) ** 4;
        const depth = Math.round(crater.depth * profile / DEPTH_QUANTUM);
        const index = z * GRID + x;
        if (depth <= this.pixels[index * 4]) continue;
        this.pixels[index * 4] = depth; this.heights[index] = -depth * DEPTH_QUANTUM;
      }
    }
    lowX=Math.max(0,lowX-1);lowZ=Math.max(0,lowZ-1);highX=Math.min(GRID-1,highX+1);highZ=Math.min(GRID-1,highZ+1);
    for (let z = lowZ; z <= highZ; z++) for (let x = lowX; x <= highX; x++) {
      const index = z * GRID + x, p = index * 3, h = this.heights[index];
      this.positions[p] = x * STEP; this.positions[p + 1] = h; this.positions[p + 2] = z * STEP;
      const dx = (this.heights[z * GRID + Math.min(GRID - 1, x + 1)] - this.heights[z * GRID + Math.max(0, x - 1)]) / (2 * STEP);
      const dz = (this.heights[Math.min(GRID - 1, z + 1) * GRID + x] - this.heights[Math.max(0, z - 1) * GRID + x]) / (2 * STEP);
      const length = Math.hypot(dx, 1, dz);
      this.normals[p] = -dx / length; this.normals[p + 1] = 1 / length; this.normals[p + 2] = -dz / length;
      const grain = ((Math.imul(Math.round(minimumX + x * STEP), 73856093) ^ Math.imul(Math.round(minimumZ + z * STEP), 19349663)) >>> 0) % 97 / 97;
      // Lighter exposed strata on the walls and dark soil at depth make the opening legible.
      const depthFade = Math.max(.24, 1 + h / TERRAIN_DAMAGE.depthMax * .72);
      const strata = .84 + .16 * Math.cos(h * 2.4);
      const shade = (.85 + grain * .15) * depthFade * strata;
      this.colors[p] = .46 * shade; this.colors[p + 1] = .255 * shade; this.colors[p + 2] = .115 * shade;
    }
    let count = 0;
    for (let z = lowZ; z < highZ; z++) for (let x = lowX; x < highX; x++) {
      const a = z * GRID + x, b = a + 1, d = a + GRID, c = d + 1;
      if (this.heights[a] === 0 && this.heights[b] === 0 && this.heights[c] === 0 && this.heights[d] === 0) continue;
      this.indices[count++] = a; this.indices[count++] = d; this.indices[count++] = b;
      this.indices[count++] = b; this.indices[count++] = d; this.indices[count++] = c;
    }
    this.geometry.setDrawRange(0, count); this.triangles = count / 3;
    for (const key of ['position', 'normal', 'color']) this.geometry.getAttribute(key).needsUpdate = true;
    this.geometry.index!.needsUpdate = true; this.bowl.frustumCulled=false;
    this.mask.needsUpdate = true; this.bowl.visible = count > 0; this.geometryRevision++;
    this.lastBuildMs = performance.now() - started;
  }

  heightAt(x: number, z: number): number {
    if (!Number.isFinite(x + z) || !this.active.length) return 0;
    const gx = (x - this.uMinimum.value.x) / STEP, gz = (z - this.uMinimum.value.y) / STEP;
    if (gx < 0 || gz < 0 || gx >= TERRAIN_DAMAGE.cells || gz >= TERRAIN_DAMAGE.cells) return 0;
    const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
    const a = iz * GRID + ix, b = a + 1, d = a + GRID, c = d + 1;
    return u + v <= 1 ? this.heights[a] + (this.heights[b] - this.heights[a]) * u + (this.heights[d] - this.heights[a]) * v
      : this.heights[c] + (this.heights[d] - this.heights[c]) * (1 - u) + (this.heights[b] - this.heights[c]) * (1 - v);
  }

  /** Exact grid traversal: at most 514 cells, no whole-world triangle raycast. */
  raycast(origin: Vector3, direction: Vector3, maxDistance: number): number | null {
    if (!Number.isFinite(origin.x + origin.y + origin.z + direction.x + direction.y + direction.z + maxDistance) || maxDistance <= 0) return null;
    let nearest = Infinity;
    if (Math.abs(direction.y) > 1e-9) {
      const plane = -origin.y / direction.y;
      if (plane > .025 && plane <= maxDistance && this.heightAt(origin.x + direction.x * plane, origin.z + direction.z * plane) >= -.0001) nearest = plane;
    }
    if (!this.active.length) return Number.isFinite(nearest) ? nearest : null;
    const minX = this.uMinimum.value.x, minZ = this.uMinimum.value.y;
    let enter = .025, exit = Math.min(maxDistance, nearest);
    for (const [p, d, lo] of [[origin.x, direction.x, minX], [origin.z, direction.z, minZ]] as const) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p >= lo + TERRAIN_DAMAGE.span) return Number.isFinite(nearest) ? nearest : null; }
      else { let a = (lo - p) / d, b = (lo + TERRAIN_DAMAGE.span - p) / d; if (a > b) [a, b] = [b, a]; enter = Math.max(enter, a); exit = Math.min(exit, b); }
    }
    if (enter > exit) return Number.isFinite(nearest) ? nearest : null;
    let ix = Math.max(0, Math.min(TERRAIN_DAMAGE.cells - 1, Math.floor((origin.x + direction.x * (enter + 1e-7) - minX) / STEP)));
    let iz = Math.max(0, Math.min(TERRAIN_DAMAGE.cells - 1, Math.floor((origin.z + direction.z * (enter + 1e-7) - minZ) / STEP)));
    const sx = Math.sign(direction.x), sz = Math.sign(direction.z);
    const deltaX = sx ? STEP / Math.abs(direction.x) : Infinity, deltaZ = sz ? STEP / Math.abs(direction.z) : Infinity;
    let nextX = sx ? (minX + (ix + (sx > 0 ? 1 : 0)) * STEP - origin.x) / direction.x : Infinity;
    let nextZ = sz ? (minZ + (iz + (sz > 0 ? 1 : 0)) * STEP - origin.z) / direction.z : Infinity;
    for (let cells = 0; cells <= TERRAIN_DAMAGE.cells * 2 + 2 && enter <= exit; cells++) {
      const a = iz * GRID + ix, b = a + 1, d = a + GRID, c = d + 1;
      const x = minX + ix * STEP, z = minZ + iz * STEP;
      const one = rayTriangle(origin, direction, x, this.heights[a], z, x, this.heights[d], z + STEP, x + STEP, this.heights[b], z);
      const two = rayTriangle(origin, direction, x + STEP, this.heights[b], z, x, this.heights[d], z + STEP, x + STEP, this.heights[c], z + STEP);
      const hit = Math.min(one, two);
      if (hit >= enter - 1e-6 && hit <= Math.min(exit, nextX, nextZ) + 1e-6) { nearest = Math.min(nearest, hit); break; }
      if (nextX < nextZ) { enter = nextX; nextX += deltaX; ix += sx; } else { enter = nextZ; nextZ += deltaZ; iz += sz; }
      if (ix < 0 || iz < 0 || ix >= TERRAIN_DAMAGE.cells || iz >= TERRAIN_DAMAGE.cells || !Number.isFinite(enter)) break;
    }
    return Number.isFinite(nearest) ? nearest : null;
  }

  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    for (const mesh of this.bindings.keys()) this.unregisterSurface(mesh);
    for (const material of this.replacements.values()) material.dispose(); this.replacements.clear();
    this.geometry.dispose(); this.earth.dispose(); this.mask.dispose(); this.group.removeFromParent();
    this.records.length = 0; this.active.length = 0;
  }
}

function rayTriangle(o: Vector3, d: Vector3, ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): number {
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
  const determinant = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(determinant) < 1e-10) return Infinity;
  const inverse = 1 / determinant, tx = o.x - ax, ty = o.y - ay, tz = o.z - az;
  const u = (tx * px + ty * py + tz * pz) * inverse;
  if (u < -1e-7 || u > 1.0000001) return Infinity;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (d.x * qx + d.y * qy + d.z * qz) * inverse;
  if (v < -1e-7 || u + v > 1.0000001) return Infinity;
  const distance = (e2x * qx + e2y * qy + e2z * qz) * inverse;
  return distance > .025 ? distance : Infinity;
}
