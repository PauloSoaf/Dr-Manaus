import { BoxGeometry, Color, Group, InstancedMesh, MeshStandardMaterial, Object3D, Vector3 } from 'three/webgpu';
import type { RoadGraph, RoadSegment } from './RoadGraph';
import { hash32, VehicleNavigator } from './VehicleNavigator';

/** The pool is sized once; `setCount` only changes how much of it drives. */
const CAPACITY = 256;
/** Cars appear inside this ring and are recycled past the cull radius, never in the player's lap. */
const SPAWN_RADIUS = 420, SPAWN_MIN = 55, CULL_RADIUS = 680;
/** Rebuilding the candidate list is a grid sweep, so it waits for the player to actually move. */
const REFRESH_STEP = 96;
/** Spawns per frame: a full pool fills in under a second without spiking one of them. */
const SPAWN_BUDGET = 6;
/** Above this the cars are smaller than a pixel and the whole system stands down. */
const ALTITUDE_LIMIT = 1200;
/** Body and glass, in metres — the silhouette PopulationManager used, kept so collision reads alike. */
const BODY_W = 1.85, BODY_H = 1.3, BODY_D = 4.1;
const GLASS_W = 1.58, GLASS_H = .65, GLASS_D = 2.05, GLASS_Y = .82;

/**
 * Deck heights mirroring ROAD_HEIGHT in src/world/realcity/roads.ts, which staggers the ribbons by
 * class so junctions do not fight for depth. A car has to ride on the ribbon its street was drawn at.
 */
const ROAD_HEIGHT: Record<string, number> = {
  motorway: .34, trunk: .32, primary: .30, secondary: .28,
  tertiary: .26, residential: .24, living_street: .23, service: .22, unclassified: .22,
};
/** Debug tint per class: the same ordering as the ribbon colours, pushed apart to be legible. */
const CLASS_COLOUR: Record<string, number> = {
  motorway: 0xff3b30, trunk: 0xff9500, primary: 0xffcc00, secondary: 0x34c759,
  tertiary: 0x00c7be, residential: 0x0a84ff, living_street: 0x5e5ce6, service: 0xaf52de,
  unclassified: 0x8e8e93,
};

interface Vehicle {
  nav: VehicleNavigator;
  x: number; z: number; y: number; yaw: number;
  /** Set on spawn so the drawn pose snaps to the lane instead of sliding in from the last car. */
  fresh: boolean;
  /** Whether this slot currently holds a non-zero matrix, so an idle pool writes nothing. */
  shown: boolean;
}

/**
 * Traffic that exists only where Manaus actually has asphalt. Every car is a position along a real
 * Overture segment, so none of them can wander a field or drive through a wall; the pool follows the
 * player, spawning ahead and recycling behind, and the whole city's traffic is two draw calls.
 */
export class TrafficSystem {
  readonly stats = { active: 0, segments: 0, nodes: 0 };
  private readonly bodies: InstancedMesh;
  private readonly glass: InstancedMesh;
  private readonly pool: Vehicle[] = [];
  private readonly candidates: RoadSegment[] = [];
  private readonly dummy = new Object3D();
  private readonly colour = new Color();
  private readonly position = new Vector3();
  private readonly tangent = new Vector3();
  private deck: ((x: number, z: number) => number) | null = null;
  private count = 0;
  private cursor = 0;
  private lastX = Infinity;
  private lastZ = Infinity;
  private debugColours = false;

  constructor(root: Group, private readonly graph: RoadGraph) {
    this.bodies = new InstancedMesh(
      new BoxGeometry(BODY_W, BODY_H, BODY_D),
      new MeshStandardMaterial({ roughness: .45, metalness: .28 }), CAPACITY,
    );
    this.glass = new InstancedMesh(
      new BoxGeometry(GLASS_W, GLASS_H, GLASS_D),
      new MeshStandardMaterial({ color: '#324f59', roughness: .25, metalness: .55 }), CAPACITY,
    );
    this.bodies.name = 'traffic-bodies';
    this.glass.name = 'traffic-glass';
    for (const mesh of [this.bodies, this.glass]) {
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      root.add(mesh);
    }
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < CAPACITY; i++) {
      this.pool.push({ nav: new VehicleNavigator(), x: 0, z: 0, y: 0, yaw: 0, fresh: true, shown: false });
      this.bodies.setMatrixAt(i, this.dummy.matrix);
      this.glass.setMatrixAt(i, this.dummy.matrix);
    }
    this.repaint();
  }

  /** Clamped to the pool: a quality preset may ask for more cars than the meshes were built for. */
  setCount(count: number): void { this.count = Math.max(0, Math.min(CAPACITY, Math.round(count))); }

  /**
   * Height of the driving surface where the graph alone cannot say — the Rio Negro bridge deck is
   * fifty metres above its segments' own class height. Null drives every car at ribbon level.
   */
  setDeckHeight(sampler: ((x: number, z: number) => number) | null): void { this.deck = sampler; }

  setDebugColours(enabled: boolean): void {
    if (enabled === this.debugColours) return;
    this.debugColours = enabled;
    this.repaint();
  }

  /** What street is under this point: the F3 panel's answer to "am I over real geometry?". */
  debugAt(x: number, z: number): { name: string | null; class: string; speed: number; width: number } | null {
    const hit = this.graph.nearest(x, z, 45);
    if (!hit) return null;
    const { segment } = hit;
    return { name: segment.name, class: segment.class, speed: segment.speed, width: segment.width };
  }

  update(dt: number, playerPosition: Vector3): void {
    this.stats.segments = this.graph.size;
    this.stats.nodes = this.graph.nodeCount;
    const ceiling = playerPosition.y > ALTITUDE_LIMIT;
    if (!this.graph.size || ceiling) {
      if (this.stats.active) {
        for (let i = 0; i < CAPACITY; i++) this.retire(i, this.pool[i]);
        this.bodies.instanceMatrix.needsUpdate = true;
        this.glass.instanceMatrix.needsUpdate = true;
      }
      this.stats.active = 0;
      return;
    }
    const px = playerPosition.x, pz = playerPosition.z;
    if (Math.abs(px - this.lastX) > REFRESH_STEP || Math.abs(pz - this.lastZ) > REFRESH_STEP) {
      this.refresh(px, pz);
      this.lastX = px; this.lastZ = pz;
    }
    // A tab restored after a stall must not teleport the whole city's traffic across the map.
    const step = Math.min(dt, .1);
    const blend = 1 - Math.exp(-step * 11);
    let active = 0, spawns = 0;
    for (let i = 0; i < CAPACITY; i++) {
      const vehicle = this.pool[i];
      const nav = vehicle.nav;
      if (i >= this.count) { this.retire(i, vehicle); continue; }
      if (!nav.active) {
        if (spawns < SPAWN_BUDGET && this.spawn(i, vehicle, px, pz)) spawns++;
        else { this.retire(i, vehicle); continue; }
      }
      if (!nav.advance(this.graph, step)) { this.retire(i, vehicle); continue; }
      nav.pose(this.graph, this.position, this.tangent);
      if ((this.position.x - px) ** 2 + (this.position.z - pz) ** 2 > CULL_RADIUS * CULL_RADIUS) {
        this.retire(i, vehicle);
        continue;
      }
      const segment = nav.segment;
      const surface = segment && this.deck && segment.bridge
        ? this.deck(this.position.x, this.position.z)
        : ROAD_HEIGHT[segment ? segment.class : 'residential'] ?? .24;
      const yaw = Math.atan2(this.tangent.x, this.tangent.z);
      if (vehicle.fresh) {
        vehicle.x = this.position.x; vehicle.z = this.position.z; vehicle.yaw = yaw;
        vehicle.y = surface + BODY_H * .5;
        vehicle.fresh = false;
      } else {
        // Smoothing only the drawn pose: the driver's own state stays exactly in its lane.
        vehicle.x += (this.position.x - vehicle.x) * blend;
        vehicle.z += (this.position.z - vehicle.z) * blend;
        vehicle.y += (surface + BODY_H * .5 - vehicle.y) * blend;
        let delta = yaw - vehicle.yaw;
        delta -= Math.round(delta / (Math.PI * 2)) * Math.PI * 2;
        vehicle.yaw += delta * blend;
      }
      this.dummy.position.set(vehicle.x, vehicle.y, vehicle.z);
      this.dummy.rotation.set(0, vehicle.yaw, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.bodies.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.y += GLASS_Y;
      this.dummy.updateMatrix();
      this.glass.setMatrixAt(i, this.dummy.matrix);
      vehicle.shown = true;
      active++;
    }
    this.stats.active = active;
    this.bodies.instanceMatrix.needsUpdate = true;
    this.glass.instanceMatrix.needsUpdate = true;
  }

  /** The segments a car may be spawned on right now; rebuilt only when the player has moved. */
  private refresh(x: number, z: number): void {
    const found = this.graph.near(x, z, SPAWN_RADIUS);
    this.candidates.length = 0;
    for (const segment of found) if (segment.length > 8) this.candidates.push(segment);
    this.cursor = 0;
  }

  /**
   * Picks a candidate deterministically and refuses anything too close to the player, so a car never
   * pops into existence in front of the camera and never starts off the network.
   */
  private spawn(slot: number, vehicle: Vehicle, px: number, pz: number): boolean {
    if (!this.candidates.length) return false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const seed = hash32(slot * 2654435761, this.cursor++);
      const segment = this.candidates[seed % this.candidates.length];
      const t = (hash32(seed, 0x7f4a) / 4294967296) * .94 + .03;
      vehicle.nav.place(segment, t, seed);
      vehicle.nav.pose(this.graph, this.position, this.tangent);
      const distance = (this.position.x - px) ** 2 + (this.position.z - pz) ** 2;
      if (distance < SPAWN_MIN * SPAWN_MIN || distance > CULL_RADIUS * CULL_RADIUS) continue;
      vehicle.fresh = true;
      this.tint(slot, segment, seed);
      return true;
    }
    vehicle.nav.clear();
    return false;
  }

  private retire(slot: number, vehicle: Vehicle): void {
    vehicle.nav.clear();
    vehicle.fresh = true;
    if (!vehicle.shown) return;
    vehicle.shown = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    this.bodies.setMatrixAt(slot, this.dummy.matrix);
    this.glass.setMatrixAt(slot, this.dummy.matrix);
  }

  /** Paint is per car, not per slot, so a recycled slot never repaints the car standing in it. */
  private tint(slot: number, segment: RoadSegment | null, seed: number): void {
    if (this.debugColours) this.colour.setHex(segment ? CLASS_COLOUR[segment.class] ?? 0x8e8e93 : 0x8e8e93);
    else this.colour.setHSL(hash32(seed, 3) / 4294967296 * .7, .18 + hash32(seed, 7) / 4294967296 * .3,
      .3 + hash32(seed, 11) / 4294967296 * .4);
    this.bodies.setColorAt(slot, this.colour);
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
  }

  /** Only the first build and a debug toggle ever need every slot repainted. */
  private repaint(): void {
    for (let i = 0; i < CAPACITY; i++) {
      const nav = this.pool[i].nav;
      this.tint(i, nav.segment, nav.active ? nav.seed : hash32(i * 2654435761, 0));
    }
  }

  dispose(): void {
    for (const mesh of [this.bodies, this.glass]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.dispose();
    }
    this.pool.length = 0;
    this.candidates.length = 0;
  }
}
