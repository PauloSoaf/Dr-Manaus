import { BoxGeometry, EdgesGeometry, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Vector3 } from 'three/webgpu';
import { WORLD } from '../../core/config';
import type { Collider } from '../../core/types';
import { ChunkState, chunkKey, type Chunk } from '../chunks/Chunk';
import { ChunkMeshes } from '../chunks/ChunkMeshes';
import { planChunks, type ChunkDemand } from './ChunkPriority';
import { GenerationPool } from './GenerationPool';
import { generateChunk } from '../chunks/BuildingGenerator';

const PREPARE_TIMEOUT_MS = 20_000;
/** Shared scratch matrix: collapsing a building must not allocate mid-rampage. */
const COLLAPSE = new Matrix4();

export class WorldStreamer {
  private readonly records = new Map<string, Chunk>();
  private readonly active = new Set<string>();
  private readonly pinned = new Set<string>();
  private readonly meshes = new ChunkMeshes();
  private readonly generators = new GenerationPool(Math.min(2, WORLD.maxRequests));
  private readonly debugRoot = new Group();
  private readonly boundsGeometry: EdgesGeometry;
  private readonly boundsMaterial = new LineBasicMaterial({ color: 0x6cf2d1, transparent: true, opacity: .6 });
  private readonly focus = new Vector3();
  private demands: ChunkDemand[] = [];
  private wanted = new Set<string>();
  private detailRadius: number = WORLD.detailRadius;
  private inFlight = 0;
  private clock = 0;
  private cadence = 1;
  private measuredMs = 0;
  private colliderList: Collider[] = [];
  private disposed = false;
  private drawBounds = false;
  private debugDirty = false;
  private generationError: Error | null = null;
  private replacesChunk?: (cx: number, cz: number) => boolean;
  /** Levelled procedural buildings, so a chunk rebuild never resurrects one. */
  private readonly destroyed = new Set<string>();
  private readonly destroyedOrder: string[] = [];
  private readonly destroyedLocations = new Map<string, Collider>();
  private revision = 0;

  constructor(private readonly root: Group) {
    this.debugRoot.name = 'chunk-boundaries'; this.debugRoot.visible = false; root.add(this.debugRoot);
    const box = new BoxGeometry(WORLD.chunkSize, 50, WORLD.chunkSize);
    this.boundsGeometry = new EdgesGeometry(box); box.dispose();
  }
  async initialize(): Promise<void> { await this.prepare(new Vector3(WORLD.spawn.x, WORLD.spawn.y, WORLD.spawn.z)); }

  setReplacesChunk(fn: (cx: number, cz: number) => boolean): void {
    this.replacesChunk = fn;
    for (const key of this.active) {
      const chunk = this.records.get(key);
      if (chunk?.group && fn(chunk.cx, chunk.cz)) {
        this.suppressProceduralGroup(chunk.group);
        chunk.colliders = [];
      }
    }
    this.refreshColliders();
  }

  private suppressProceduralGroup(group: Group): void {
    for (const object of group.children) {
      if (object.name === 'facades' || object.name === 'terracotta-roofs' || object.name === 'sidewalks'
        || object.name === 'tree-trunks' || object.name === 'tropical-canopy') {
        object.visible = false;
      }
    }
  }

  get colliders(): Collider[] { return this.colliderList; }
  get activeKeys(): ReadonlySet<string> { return this.active; }
  get destroyedIds(): ReadonlySet<string> { return this.destroyed; }
  get destroyedBounds(): ReadonlyMap<string, Collider> { return this.destroyedLocations; }
  get destructionRevision(): number { return this.revision; }
  isDestroyed(id: string): boolean { return this.destroyed.has(id.startsWith('hlod:') ? id.slice(5) : id); }
  get stats(): { active: number; cached: number; queued: number; streamMs: number; loadedMB: number } {
    let cached = 0, queued = 0, bytes = 0;
    for (const chunk of this.records.values()) {
      if (chunk.state === ChunkState.CACHED) cached++;
      if (chunk.state === ChunkState.REQUESTED || chunk.state === ChunkState.LOADING || chunk.state === ChunkState.READY) queued++;
      bytes += chunk.bytes;
    }
    return { active: this.active.size, cached, queued, streamMs: this.measuredMs, loadedMB: bytes / 1048576 + .4 };
  }

  update(position: Vector3, velocity: Vector3, dt: number): void {
    if (this.disposed) return;
    this.clock += dt; this.cadence += dt;
    const moved = this.focus.distanceToSquared(position) > 32 * 32;
    if (this.cadence > .14 || moved) {
      this.cadence = 0; this.focus.copy(position);
      this.demands = planChunks(position, velocity, this.detailRadius);
      this.reconcile();
    }
    this.pump();
  }

  /** Teleport waits for a 3x3 collision-safe neighbourhood, even before the render loop starts. */
  async prepare(position: Vector3): Promise<void> {
    this.generationError = null;
    const deadline = performance.now() + PREPARE_TIMEOUT_MS;
    const cx = Math.floor(position.x / WORLD.chunkSize), cz = Math.floor(position.z / WORLD.chunkSize);
    const minimum: string[] = [];
    for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
      const key = chunkKey(cx + x, cz + z); minimum.push(key); this.pinned.add(key);
      this.ensure({ key, cx: cx + x, cz: cz + z, priority: Math.hypot(x, z) - 1000, immediate: true });
    }
    this.focus.copy(position); this.demands = planChunks(position, { x: 0, z: 0 }, this.detailRadius);
    this.reconcile();
    try {
      while (!this.disposed && minimum.some(key => this.records.get(key)?.state !== ChunkState.ACTIVE)) {
        const generationError = this.generationError as Error | null;
        if (generationError) {
          throw new Error(`Falha ao gerar chunks próximos de ${Math.round(position.x)}, ${Math.round(position.z)}: ${generationError.message}`);
        }
        if (performance.now() > deadline) {
          throw new Error(`Timeout ao preparar o mundo em ${Math.round(position.x)}, ${Math.round(position.z)}.`);
        }
        this.pump();
        await new Promise<void>(resolve => setTimeout(resolve, 8));
      }
      if (this.disposed) throw new Error('World streamer was disposed while preparing the destination.');
    } finally {
      for (const key of minimum) this.pinned.delete(key);
    }
  }

  private ensure(demand: ChunkDemand): Chunk {
    let chunk = this.records.get(demand.key);
    if (!chunk) {
      chunk = { key: demand.key, cx: demand.cx, cz: demand.cz, state: ChunkState.UNLOADED,
        priority: demand.priority, touched: this.clock, colliders: [], bytes: 0 };
      this.records.set(chunk.key, chunk); chunk.state = ChunkState.REQUESTED;
    }
    chunk.priority = this.pinned.has(chunk.key) ? -1000 + demand.priority * .01 : demand.priority;
    chunk.touched = this.clock; return chunk;
  }

  private reconcile(): void {
    const nextWanted = new Set(this.pinned);
    for (const demand of this.demands) {
      if (demand.immediate && nextWanted.size < WORLD.maxActiveChunks) nextWanted.add(demand.key);
      this.ensure(demand);
    }
    this.wanted = nextWanted;
    let changed = false;
    for (const key of this.active) {
      const chunk = this.records.get(key)!;
      if (nextWanted.has(key)) continue;
      const distance = Math.hypot((chunk.cx + .5) * WORLD.chunkSize - this.focus.x, (chunk.cz + .5) * WORLD.chunkSize - this.focus.z);
      if (distance <= this.detailRadius + WORLD.hysteresis && this.active.size < WORLD.maxActiveChunks && !this.pinned.size) continue;
      chunk.group?.removeFromParent(); chunk.state = ChunkState.CACHED; chunk.touched = this.clock;
      this.active.delete(key); changed = true;
    }
    for (const key of this.wanted) {
      const chunk = this.records.get(key);
      if (chunk?.state === ChunkState.CACHED && chunk.payload) chunk.state = ChunkState.READY;
    }
    const demanded = new Set(this.demands.map(demand => demand.key));
    for (const chunk of this.records.values()) {
      if (chunk.state === ChunkState.REQUESTED && !demanded.has(chunk.key) && !this.pinned.has(chunk.key)) this.records.delete(chunk.key);
    }
    this.evict(); if (changed) this.refreshColliders();
  }

  private pump(): void {
    const start = performance.now();
    const requests = [...this.records.values()].filter(chunk => chunk.state === ChunkState.REQUESTED).sort((a, b) => a.priority - b.priority);
    while (this.inFlight < WORLD.maxRequests && requests.length) {
      const chunk = requests.shift()!; chunk.state = ChunkState.LOADING; this.inFlight++;
      void this.generators.generate(chunk.cx, chunk.cz).then(payload => {
        this.inFlight--;
        if (this.disposed || !this.records.has(chunk.key)) return;
        chunk.payload = payload; chunk.bytes = payload.buildings.byteLength + payload.trees.byteLength;
        chunk.state = this.wanted.has(chunk.key) || this.pinned.has(chunk.key) ? ChunkState.READY : ChunkState.CACHED;
        this.evict();
      }).catch(error => {
        this.inFlight--;
        if (this.disposed) return;
        this.generationError = error instanceof Error ? error : new Error(String(error));
        if (this.records.get(chunk.key) === chunk) {
          chunk.state = ChunkState.UNLOADED;
          this.records.delete(chunk.key);
        }
      });
    }
    const ready = [...this.records.values()].filter(chunk => chunk.state === ChunkState.READY).sort((a, b) => a.priority - b.priority);
    let changed = false, activated = 0;
    for (const chunk of ready) {
      // A time budget alone still allowed a burst of geometry uploads in one frame.
      if (activated >= WORLD.maxActivationsPerFrame || performance.now() - start >= WORLD.streamingBudgetMs) break;
      if (!this.wanted.has(chunk.key) && !this.pinned.has(chunk.key)) { chunk.state = ChunkState.CACHED; continue; }
      if (this.active.size >= WORLD.maxActiveChunks) {
        const victim = [...this.active].map(key => this.records.get(key)!).filter(item => !this.pinned.has(item.key) && !this.wanted.has(item.key))
          .sort((a, b) => b.priority - a.priority)[0];
        if (!victim) break;
        victim.group?.removeFromParent(); victim.state = ChunkState.CACHED; this.active.delete(victim.key);
      }
      if (!chunk.group && chunk.payload) {
        const built = this.meshes.create(chunk.payload);
        chunk.group = built.group; chunk.colliders = built.colliders; chunk.bytes = built.bytes;
        if (this.destroyed.size) for (const collider of built.colliders) if (this.destroyed.has(collider.id ?? '')) this.collapse(chunk, collider.id!);
        chunk.colliders = chunk.colliders.filter(collider => !this.destroyed.has(collider.id ?? ''));
      }
      if (chunk.group && this.replacesChunk?.(chunk.cx, chunk.cz)) {
        this.suppressProceduralGroup(chunk.group);
        chunk.colliders = [];
      }
      if (chunk.group) this.root.add(chunk.group);
      chunk.state = ChunkState.ACTIVE; chunk.touched = this.clock; this.active.add(chunk.key); changed = true; activated++;
    }
    if (changed) this.refreshColliders();
    this.evict();
    if (this.drawBounds && this.debugDirty) this.refreshDebug();
    this.measuredMs = this.measuredMs * .85 + (performance.now() - start) * .15;
  }

  /**
   * Levels a procedural building. Chunks are instanced, so a collapse is a zero-scale matrix on
   * three instances rather than any geometry rebuild.
   */
  destroy(colliderId: string): boolean {
    const marker = colliderId.indexOf('/building/') >= 0 ? colliderId.indexOf('/building/') : colliderId.indexOf('/tree/');
    if (marker <= 0 || colliderId.startsWith('hlod:') || this.destroyed.has(colliderId)) return false;
    const key = colliderId.slice(0, marker), parts = key.split(',').map(Number);
    if (parts.length !== 2 || !parts.every(Number.isInteger)) return false;
    const chunk = this.records.get(key);
    // A medium proxy may be hit before detailed streaming arrives; its deterministic record owns
    // the same id, so the destruction can be recorded without loading a detailed neighborhood.
    const payload = chunk?.payload ?? generateChunk(parts[0], parts[1]);
    const bounds = ChunkMeshes.collider(payload, colliderId);
    if (!bounds) return false;
    this.destroyed.add(colliderId);
    this.destroyedLocations.set(colliderId, bounds); this.revision++;
    this.destroyedOrder.push(colliderId);
    if (this.destroyedOrder.length > WORLD.maxActiveChunks * 200) {
      const evicted = this.destroyedOrder.shift();
      if (evicted !== undefined) {
        this.destroyed.delete(evicted); this.destroyedLocations.delete(evicted);
        const oldKey = evicted.slice(0, evicted.indexOf('/')), old = this.records.get(oldKey);
        if (old?.group && old.payload) { const restored = this.meshes.restore(old.group, old.payload, evicted); if (restored) old.colliders.push(restored); }
      }
    }
    if (chunk) {
      this.collapse(chunk, colliderId);
      const index = chunk.colliders.findIndex(collider => collider.id === colliderId);
      if (index >= 0) chunk.colliders.splice(index, 1);
    }
    this.refreshColliders();
    return true;
  }

  /** Restores nearby records even when their detailed chunk has already been evicted. */
  restore(position: Vector3, radius: number): number {
    if (!Number.isFinite(radius) || radius < 0) return 0;
    let count = 0;
    for (const [id, box] of this.destroyedLocations) {
      const dx = Math.max(0, Math.abs(position.x - box.x) - box.width / 2);
      const dy = Math.max(0, Math.abs(position.y - box.y) - box.height / 2);
      const dz = Math.max(0, Math.abs(position.z - box.z) - box.depth / 2);
      if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
      this.destroyed.delete(id); this.destroyedLocations.delete(id);
      const order = this.destroyedOrder.indexOf(id); if (order >= 0) this.destroyedOrder.splice(order, 1);
      const chunk = this.records.get(id.slice(0, id.indexOf('/')));
      if (chunk?.group && chunk.payload) {
        const collider = this.meshes.restore(chunk.group, chunk.payload, id);
        if (collider && !chunk.colliders.some(item => item.id === id)) chunk.colliders.push(collider);
      }
      count++;
    }
    if (count) { this.revision++; this.refreshColliders(); }
    return count;
  }

  private collapse(chunk: Chunk, colliderId: string): boolean {
    if (!chunk.group) return false;
    const tree = colliderId.indexOf('/tree/');
    const index = Number(colliderId.slice((tree >= 0 ? tree + 6 : colliderId.indexOf('/building/') + 10)));
    if (!Number.isFinite(index)) return false;
    COLLAPSE.makeScale(0, 0, 0);
    let collapsed = false;
    for (const object of chunk.group.children) {
      if (!(object instanceof InstancedMesh)) continue;
      if (tree >= 0) {
        // A felled tree has to take its own canopy instances with it, not just the trunk.
        if (object.name === 'tree-trunks' && index < object.count) {
          object.setMatrixAt(index, COLLAPSE); object.instanceMatrix.needsUpdate = true; collapsed = true;
        } else if (object.name === 'tropical-canopy') {
          const start = (chunk.group.userData.canopyStart as Int32Array | undefined)?.[index];
          const span = (chunk.group.userData.canopySpan as Int32Array | undefined)?.[index] ?? 0;
          if (start === undefined) continue;
          for (let n = 0; n < span && start + n < object.count; n++) object.setMatrixAt(start + n, COLLAPSE);
          if (span) { object.instanceMatrix.needsUpdate = true; collapsed = true; }
        }
        continue;
      }
      if (index >= object.count) continue;
      if (object.name !== 'facades' && object.name !== 'terracotta-roofs' && object.name !== 'sidewalks') continue;
      object.setMatrixAt(index, COLLAPSE);
      object.instanceMatrix.needsUpdate = true;
      collapsed = true;
    }
    return collapsed;
  }

  private evict(): void {
    const cached = [...this.records.values()].filter(chunk => chunk.state === ChunkState.CACHED)
      .sort((a, b) => a.touched - b.touched || b.priority - a.priority);
    while (cached.length > WORLD.maxCachedChunks) {
      const chunk = cached.shift()!; if (this.pinned.has(chunk.key)) continue;
      chunk.state = ChunkState.EVICTING;
      if (chunk.group) this.meshes.disposeChunk(chunk.group);
      chunk.payload = undefined; chunk.colliders.length = 0; chunk.state = ChunkState.UNLOADED; this.records.delete(chunk.key);
    }
  }
  private refreshColliders(): void {
    this.colliderList = [];
    for (const key of this.active) for (const collider of this.records.get(key)!.colliders) if (!this.destroyed.has(collider.id ?? '')) this.colliderList.push(collider);
    this.debugDirty = true;
  }
  private refreshDebug(): void {
    this.debugRoot.clear();
    for (const key of this.active) {
      const chunk = this.records.get(key)!; const bounds = new LineSegments(this.boundsGeometry, this.boundsMaterial);
      bounds.position.set((chunk.cx + .5) * WORLD.chunkSize, 25, (chunk.cz + .5) * WORLD.chunkSize); this.debugRoot.add(bounds);
    }
    this.debugDirty = false;
  }
  setDetailRadius(radius: number): void { this.detailRadius = Math.max(WORLD.chunkSize, radius); this.cadence = 1; }
  setNight(enabled: boolean): void { this.meshes.setNight(enabled); }
  setDebug(bounds: boolean, lod: boolean): void { this.drawBounds = bounds || lod; this.debugRoot.visible = this.drawBounds; this.debugDirty = true; }
  dispose(): void {
    this.disposed = true; this.generators.dispose();
    for (const chunk of this.records.values()) if (chunk.group) this.meshes.disposeChunk(chunk.group);
    this.records.clear(); this.active.clear(); this.colliderList.length = 0;
    this.destroyed.clear(); this.destroyedOrder.length = 0; this.destroyedLocations.clear();
    this.debugRoot.removeFromParent(); this.boundsGeometry.dispose(); this.boundsMaterial.dispose(); this.meshes.dispose();
  }
}
