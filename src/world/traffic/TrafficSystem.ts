import { BoxGeometry, BufferGeometry, Color, Group, InstancedMesh, MeshStandardMaterial, Object3D, Vector3, Matrix4, type Material, type Mesh } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAINT, pickTrafficModel, type VehicleManifest, type VehicleSpec } from '../vehicles/VehicleCatalog';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import type { Collider } from '../../core/types';
import type { RoadGraph, RoadSegment } from './RoadGraph';
import { hash32, VehicleNavigator } from './VehicleNavigator';
import { roadHeightOf } from '../realcity/roads';
import { SurfaceFrameService } from '../spatial/SurfaceFrameService';
import { localManausPresentationMode } from '../spatial/ManausSurfacePresentation';
import { IMPACT } from '../../player/combat/MeteorImpact';
import { FastSpatialGrid2D } from '../spatial/FastSpatialGrid2D';

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
 * A car rides on the ribbon its street was drawn at, so the deck heights come from the road
 * builder itself rather than from a copy that can drift out of step with it.
 */
/** Debug tint per class: the same ordering as the ribbon colours, pushed apart to be legible. */
const CLASS_COLOUR: Record<string, number> = {
  motorway: 0xff3b30, trunk: 0xff9500, primary: 0xffcc00, secondary: 0x34c759,
  tertiary: 0x00c7be, residential: 0x0a84ff, living_street: 0x5e5ce6, service: 0xaf52de,
  unclassified: 0x8e8e93,
};

/**
 * One catalogue model drawn for every traffic car that uses it: textured body and wheels, tintable
 * paint (per-car colour), and tinted glass. Instances are kept compact (no zero-scale holes), so a
 * model nobody drives right now costs nothing.
 */
interface ModelBatch {
  spec: VehicleSpec;
  body: InstancedMesh;
  paint: InstancedMesh | null;
  glass: InstancedMesh | null;
  /** Instance index -> pool slot. */
  slots: number[];
}

interface Vehicle {
  vx:number; vz:number; vy:number; wreck:boolean; wreckLife:number; pitch:number;
  braking: boolean; honkCooldown: number;
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
  readonly colliders:Collider[]=[];
  readonly stats = { active: 0, segments: 0, nodes: 0 };
  lastImpulseWrecks = 0;
  private readonly bodies: InstancedMesh;
  private readonly glass: InstancedMesh;
  private readonly pool: Vehicle[] = [];
  private readonly candidates: RoadSegment[] = [];
  private readonly dummy = new Object3D();
  private readonly colour = new Color();
  private readonly position = new Vector3();
  private readonly tangent = new Vector3();
  private readonly surfaceService = new SurfaceFrameService('earth');
  private deck: ((x: number, z: number) => number) | null = null;
  private count = 0;
  private cursor = 0;
  private lastX = Infinity;
  private lastZ = Infinity;
  private debugColours = false;
  private readonly spatialGrid = new FastSpatialGrid2D(12000, 32, CAPACITY);
  private readonly root: Group;
  private manifest: VehicleManifest | null = null;
  private readonly batches: ModelBatch[] = [];
  private readonly slotModel = new Int16Array(CAPACITY).fill(-1);
  private readonly slotInstance = new Int16Array(CAPACITY).fill(-1);
  private readonly slotPaint: Color[] = Array.from({ length: CAPACITY }, () => new Color());
  private static readonly tintedGlass = new MeshStandardMaterial({ color: '#1d2a33', roughness: 0.15, metalness: 0.6 });

  constructor(root: Group, private readonly graph: RoadGraph, private readonly onHorn?: () => void) {
    this.root = root;
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
      this.pool.push({ vx:0,vz:0,vy:0,wreck:false,wreckLife:0,pitch:0,braking:false,honkCooldown:0,nav: new VehicleNavigator(), x: 0, z: 0, y: 0, yaw: 0, fresh: true, shown: false });
      this.bodies.setMatrixAt(i, this.dummy.matrix);
      this.glass.setMatrixAt(i, this.dummy.matrix);
    }
    this.repaint();
  }

  /**
   * Installs the car catalogue (LOD1 scenes keyed by file). From here on every car is a real model
   * with its own paint; the box silhouettes stay as the fallback when nothing loaded.
   */
  setVehicleModels(manifest: VehicleManifest, lod1: ReadonlyMap<string, Object3D>): number {
    this.manifest = manifest;
    for (const batch of this.batches) for (const mesh of [batch.body, batch.paint, batch.glass]) { mesh?.removeFromParent(); mesh?.dispose(); }
    this.batches.length = 0;
    for (const spec of manifest.vehicles) {
      const file = spec.lods?.find(l => l.file.includes('lod1'))?.file ?? spec.file;
      const scene = lod1.get(file);
      if (!scene) continue;
      scene.updateMatrixWorld(true);
      const groups = new Map<string, { geometries: BufferGeometry[]; material: Material }>();
      scene.traverse(object => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material;
        const key = material.name === 'paint' ? 'paint' : material.name === 'glass' ? 'glass' : 'body';
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        // Body keeps its palette UVs; flat-coloured paint and glass only need positions and normals.
        for (const name of Object.keys(geometry.attributes)) if (name !== 'position' && name !== 'normal' && (name !== 'uv' || key !== 'body')) geometry.deleteAttribute(name);
        if (key === 'body' && !geometry.getAttribute('uv')) return;
        const entry = groups.get(key) ?? { geometries: [], material };
        entry.geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
        groups.set(key, entry);
      });
      const build = (key: string, material?: Material): InstancedMesh | null => {
        const entry = groups.get(key);
        if (!entry?.geometries.length) return null;
        const merged = mergeGeometries(entry.geometries, false);
        if (!merged) return null;
        const mesh = new InstancedMesh(merged, material ?? entry.material, CAPACITY);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.castShadow = key !== 'glass';
        mesh.name = `traffic-${spec.id}-${key}`;
        this.root.add(mesh);
        return mesh;
      };
      const paintMaterial = groups.get('paint') ? new MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.45 }) : undefined;
      const body = build('body');
      if (!body) continue;
      this.batches.push({ spec, body, paint: build('paint', paintMaterial), glass: build('glass', TrafficSystem.tintedGlass), slots: [] });
    }
    this.slotModel.fill(-1); this.slotInstance.fill(-1);
    const ready = this.batches.length > 0;
    this.bodies.visible = !ready; this.glass.visible = !ready;
    if (ready) for (let i = 0; i < CAPACITY; i++) {
      const v = this.pool[i];
      if (v.shown && v.nav.active) { this.assignModel(i, v.nav.seed); this.drawVehicle(i, v, v.wreck); }
    }
    this.flushBatches();
    return this.batches.length;
  }

  /** Model and paint of a traffic car (to keep the same car when the hero takes it). */
  modelOf(slot: number): { spec: VehicleSpec; paint: Color } | null {
    const index = this.slotModel[slot];
    if (index < 0) return null;
    return { spec: this.batches[index].spec, paint: this.slotPaint[slot].clone() };
  }

  private assignModel(slot: number, seed: number, forced?: { id: string; paint: Color }): void {
    if (!this.batches.length || !this.manifest) return;
    this.releaseModel(slot);
    let index = forced ? this.batches.findIndex(b => b.spec.id === forced.id) : -1;
    if (index < 0) {
      const spec = pickTrafficModel(this.manifest, (hash32(seed, 0x51ed) % 100000) / 100000);
      index = Math.max(0, this.batches.findIndex(b => b.spec === spec));
    }
    const batch = this.batches[index];
    const instance = batch.slots.length;
    batch.slots.push(slot);
    this.slotModel[slot] = index;
    this.slotInstance[slot] = instance;
    const paint = forced?.paint ?? this.colour.set(PAINT[hash32(seed, 0x9a17) % PAINT.length]);
    this.slotPaint[slot].copy(paint);
    for (const mesh of [batch.body, batch.paint, batch.glass]) if (mesh) mesh.count = batch.slots.length;
    if (batch.paint) { batch.paint.setColorAt(instance, this.slotPaint[slot]); if (batch.paint.instanceColor) batch.paint.instanceColor.needsUpdate = true; }
  }

  /** Swap-remove the slot's instance so every batch stays dense. */
  private releaseModel(slot: number): void {
    const index = this.slotModel[slot];
    if (index < 0) return;
    const batch = this.batches[index];
    const instance = this.slotInstance[slot];
    const last = batch.slots.length - 1;
    if (instance !== last) {
      const moved = batch.slots[last];
      batch.slots[instance] = moved;
      this.slotInstance[moved] = instance;
      const m = new Matrix4();
      for (const mesh of [batch.body, batch.paint, batch.glass]) if (mesh) { mesh.getMatrixAt(last, m); mesh.setMatrixAt(instance, m); mesh.instanceMatrix.needsUpdate = true; }
      if (batch.paint) { batch.paint.setColorAt(instance, this.slotPaint[moved]); if (batch.paint.instanceColor) batch.paint.instanceColor.needsUpdate = true; }
    }
    batch.slots.pop();
    for (const mesh of [batch.body, batch.paint, batch.glass]) if (mesh) mesh.count = batch.slots.length;
    this.slotModel[slot] = -1;
    this.slotInstance[slot] = -1;
  }

  private flushBatches(): void {
    for (const batch of this.batches) for (const mesh of [batch.body, batch.paint, batch.glass]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
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
    if (!Number.isFinite(playerPosition.x + playerPosition.y + playerPosition.z)) return;
    this.colliders.length=0;
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
    const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), .1) : 0;
    const blend = 1 - Math.exp(-step * 11);

    // Fast Spatial Grid 2D pre-pass: register current vehicle positions for O(1) neighbor lookups
    this.spatialGrid.clear();
    for (let i = 0; i < CAPACITY; i++) {
      const v = this.pool[i];
      if (v.shown && !v.wreck && v.nav.active) {
        this.spatialGrid.insert(i, v.x, v.z);
      }
    }

    let active = 0, spawns = 0;
    for (let i = 0; i < CAPACITY; i++) {
      const vehicle = this.pool[i];
      const nav = vehicle.nav;
      if (i >= this.count) { this.retire(i, vehicle); continue; }
      if (!nav.active) {
        if (spawns < SPAWN_BUDGET && this.spawn(i, vehicle, px, pz)) spawns++;
        else { this.retire(i, vehicle); continue; }
      }
      if(vehicle.wreck){
        vehicle.wreckLife-=step;
        if(vehicle.wreckLife<=0||(vehicle.x-px)**2+(vehicle.z-pz)**2>CULL_RADIUS*CULL_RADIUS){this.retire(i,vehicle);continue;}
        vehicle.x+=vehicle.vx*step;vehicle.z+=vehicle.vz*step;
        const damping=Math.exp(-step*.7);vehicle.vx*=damping;vehicle.vz*=damping;
        vehicle.vy-=24*step;vehicle.y+=vehicle.vy*step;
        const floor=PhysicsWorld.terrainHeight(vehicle.x,vehicle.z)+BODY_H*.35;
        if(vehicle.y<floor){vehicle.y=floor;vehicle.vy=0;}
        vehicle.pitch=Math.min(.65,vehicle.pitch+step*.8);this.drawVehicle(i,vehicle,true);active++;continue;
      }
      if (vehicle.honkCooldown > 0) vehicle.honkCooldown -= step;
      const dx = px - vehicle.x;
      const dz = pz - vehicle.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 28 * 28 && Math.abs(playerPosition.y - vehicle.y) < 6) {
        const fwdX = Math.sin(vehicle.yaw);
        const fwdZ = Math.cos(vehicle.yaw);
        const dotFwd = dx * fwdX + dz * fwdZ;
        const lateral = Math.abs(-dx * fwdZ + dz * fwdX);
        if (dotFwd > 1.2 && dotFwd < 22.0 && lateral < 4.2) {
          nav.speed = Math.max(0, nav.speed - step * 24);
          nav.targetSpeed = 0;
          vehicle.braking = true;
          vehicle.pitch = Math.max(-0.05, vehicle.pitch - step * 0.3);
          if (vehicle.honkCooldown <= 0) {
            this.onHorn?.();
            vehicle.honkCooldown = 3.2;
          }
        } else if (vehicle.braking) {
          vehicle.braking = false;
          if (nav.segment) nav.targetSpeed = nav.segment.speed * 0.85;
        }
      } else if (vehicle.braking) {
        vehicle.braking = false;
        if (nav.segment) nav.targetSpeed = nav.segment.speed * 0.85;
      }

      // Craig Reynolds Separation & Boids Queueing: check other vehicles ahead in the lane corridor
      if (!vehicle.wreck) {
        const fwdX = Math.sin(vehicle.yaw);
        const fwdZ = Math.cos(vehicle.yaw);
        let leaderDist = Infinity;
        let leaderBraking = false;
        let leaderWreck = false;

        this.spatialGrid.forEachNeighbor(vehicle.x, vehicle.z, 26.0, (otherIdx, ox, oz) => {
          if (otherIdx === i) return;
          const other = this.pool[otherIdx];
          const relX = ox - vehicle.x;
          const relZ = oz - vehicle.z;
          const ahead = relX * fwdX + relZ * fwdZ;
          const lateral = Math.abs(-relX * fwdZ + relZ * fwdX);

          // In same forward travel corridor
          if (ahead > 0.8 && ahead < 22.0 && lateral < 2.8) {
            if (ahead < leaderDist) {
              leaderDist = ahead;
              leaderBraking = other.braking;
              leaderWreck = other.wreck;
            }
          }
        });

        if (leaderDist < 22.0) {
          const safeGap = Math.max(7.0, nav.speed * 0.8);
          if (leaderDist < safeGap || leaderWreck) {
            const brakeFactor = leaderWreck ? 28.0 : 16.0;
            nav.speed = Math.max(0, nav.speed - step * brakeFactor);
            nav.targetSpeed = 0;
            vehicle.braking = true;
            vehicle.pitch = Math.max(-0.04, vehicle.pitch - step * 0.2);
          } else if (leaderDist < safeGap * 1.4 && leaderBraking) {
            nav.speed = Math.max(0, nav.speed - step * 9.0);
            vehicle.braking = true;
          }
        }
      }
      if (!vehicle.wreck && !vehicle.braking) {
        vehicle.pitch *= Math.exp(-step * 5);
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
        : roadHeightOf(segment ? segment.class : 'residential');
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
      if(!segment?.bridge&&PhysicsWorld.terrainHeight(vehicle.x,vehicle.z)<-.8){vehicle.wreck=true;vehicle.wreckLife=25;vehicle.vy=0;}
      else this.colliders.push({id:`traffic:${i}`,x:vehicle.x,y:vehicle.y,z:vehicle.z,width:4.5,height:2,depth:4.5,category:'vehicle'});
      this.drawVehicle(i,vehicle,false);
      vehicle.shown = true;
      active++;
    }
    this.stats.active = active;
    this.bodies.instanceMatrix.needsUpdate = true;
    this.glass.instanceMatrix.needsUpdate = true;
    this.flushBatches();
  }

  destroy(id:string):boolean{
    if(!/^traffic:\d+$/.test(id))return false;
    const slot=Number(id.slice(8)),vehicle=this.pool[slot];
    if(!vehicle?.shown||vehicle.wreck)return false;
    vehicle.wreck=true;vehicle.wreckLife=25;vehicle.vy=3;
    this.bodies.setColorAt(slot,this.colour.setHex(0x39322e));if(this.bodies.instanceColor)this.bodies.instanceColor.needsUpdate=true;
    const index=this.colliders.findIndex(c=>c.id===id);if(index>=0)this.colliders.splice(index,1);
    return true;
  }
  /** A blast transfers existing visible cars to the bounded wreck simulation, never a new pool. */
  impulse(at:Vector3,radius:number,force:number):number{
    this.lastImpulseWrecks=0;
    if(radius<=0||force<=0)return 0;let affected=0;
    for(let i=0;i<this.pool.length;i++){
      const v=this.pool[i];if(!v.shown)continue;
      const dx=v.x-at.x,dz=v.z-at.z,d=Math.hypot(dx,dz);if(d>=radius)continue;
      if(!v.wreck&&this.destroy(`traffic:${i}`))this.lastImpulseWrecks++;
      const speed=Math.min(IMPACT.maxActorSpeed,force*(1-d/radius));
      v.vx=dx/(d||1)*speed;v.vz=dz/(d||1)*speed;v.vy=Math.min(60,8+speed*.16);affected++;
    }
    return affected;
  }
  private drawVehicle(i:number,vehicle:Vehicle,wreck:boolean):void{
      this.dummy.scale.set(1,wreck?.65:1,1);
      if (localManausPresentationMode() === 'curved') {
        const pt = this.surfaceService.legacyPointToRenderLocal(vehicle.x, vehicle.y, vehicle.z);
        // Vehicle direction is yaw (rotation around Y).
        const fwdX = Math.sin(vehicle.yaw), fwdZ = Math.cos(vehicle.yaw);
        // Pitch is rotation around local X.
        const upX = 0, upY = 1, upZ = 0; // Simplified up, but let's just get the local normal
        const up = this.surfaceService.legacyDirectionToRenderLocal(0, 1, 0, vehicle.x, vehicle.y, vehicle.z).normalize();
        const fwd = this.surfaceService.legacyDirectionToRenderLocal(fwdX, 0, fwdZ, vehicle.x, vehicle.y, vehicle.z).normalize();
        const right = new Vector3().crossVectors(up, fwd).normalize();
        const realFwd = new Vector3().crossVectors(right, up).normalize();
        this.dummy.position.copy(pt);
        this.dummy.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, up, realFwd));
        this.dummy.rotateX(vehicle.pitch);
        if (wreck) this.dummy.rotateZ(.18);
        this.dummy.updateMatrix();
      } else {
        this.dummy.position.set(vehicle.x, vehicle.y, vehicle.z);
        this.dummy.rotation.set(vehicle.pitch, vehicle.yaw, wreck?.18:0);
        this.dummy.updateMatrix();
      }
      const model = this.slotModel[i];
      if (model >= 0) {
        // Catalogue models stand on their wheels: their origin is the ground, the box's was its middle.
        this.dummy.translateY(-BODY_H * .5);
        this.dummy.updateMatrix();
        const batch = this.batches[model], instance = this.slotInstance[i];
        batch.body.setMatrixAt(instance, this.dummy.matrix);
        batch.paint?.setMatrixAt(instance, this.dummy.matrix);
        batch.glass?.setMatrixAt(instance, this.dummy.matrix);
        vehicle.shown = true;
        return;
      }
      this.bodies.setMatrixAt(i, this.dummy.matrix);
      this.dummy.translateY(GLASS_Y);
      this.dummy.updateMatrix();
      this.glass.setMatrixAt(i, this.dummy.matrix);
      vehicle.shown = true;
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
      if(!segment.bridge&&PhysicsWorld.terrainHeight(this.position.x,this.position.z)<-.5)continue;
      vehicle.fresh = true;vehicle.wreck=false;vehicle.wreckLife=0;vehicle.vx=0;vehicle.vz=0;vehicle.vy=0;vehicle.pitch=0;
      this.tint(slot, segment, seed);
      this.assignModel(slot, seed);
      return true;
    }
    vehicle.nav.clear();
    return false;
  }

  private retire(slot: number, vehicle: Vehicle): void {
    vehicle.nav.clear();vehicle.wreck=false;vehicle.vx=0;vehicle.vz=0;vehicle.vy=0;vehicle.pitch=0;
    vehicle.fresh = true;
    this.releaseModel(slot);
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

  findNearestCar(pos: Vector3, maxRadiusM = 6.0): { x: number; y: number; z: number; yaw: number; slot: number } | null {
    let nearest: { x: number; y: number; z: number; yaw: number; slot: number } | null = null;
    let minDistSq = maxRadiusM * maxRadiusM;

    for (let i = 0; i < this.count; i++) {
      const v = this.pool[i];
      if (!v.shown || v.wreck) continue;
      const dx = v.x - pos.x;
      const dz = v.z - pos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = { x: v.x, y: v.y, z: v.z, yaw: v.yaw, slot: i };
      }
    }
    return nearest;
  }

  takeOverCar(slot: number): { x: number; y: number; z: number; yaw: number } | null {
    if (slot < 0 || slot >= this.count) return null;
    const v = this.pool[slot];
    if (!v.shown) return null;
    const state = { x: v.x, y: v.y, z: v.z, yaw: v.yaw };
    v.shown = false;
    v.fresh = true;
    this.releaseModel(slot);
    this.flushBatches();
    this.dummy.position.set(0, -9999, 0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    this.bodies.setMatrixAt(slot, this.dummy.matrix);
    this.glass.setMatrixAt(slot, this.dummy.matrix);
    this.bodies.instanceMatrix.needsUpdate = true;
    this.glass.instanceMatrix.needsUpdate = true;
    return state;
  }

  returnCar(pos: Vector3, yaw: number, model?: { id: string; paint: Color }): void {
    for (let i = 0; i < this.count; i++) {
      const v = this.pool[i];
      if (!v.shown) {
        if (this.batches.length) {
          // The car the hero drove goes back as itself (same model and paint), parked.
          v.x = pos.x; v.y = pos.y + BODY_H / 2; v.z = pos.z; v.yaw = yaw; v.vx = 0; v.vz = 0; v.vy = 0; v.wreck = false;
          this.assignModel(i, hash32(i, 0x1234), model);
          this.drawVehicle(i, v, false);
          this.flushBatches();
          break;
        }
        v.x = pos.x;
        v.y = pos.y;
        v.z = pos.z;
        v.yaw = yaw;
        v.vx = 0;
        v.vz = 0;
        v.vy = 0;
        v.shown = true;
        v.wreck = false;
        this.dummy.position.set(v.x, v.y + BODY_H / 2, v.z);
        this.dummy.rotation.set(0, v.yaw, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.bodies.setMatrixAt(i, this.dummy.matrix);
        this.glass.setMatrixAt(i, this.dummy.matrix);
        this.bodies.instanceMatrix.needsUpdate = true;
        this.glass.instanceMatrix.needsUpdate = true;
        break;
      }
    }
  }

  pullTowards(pos: Vector3, radius: number, strength: number): void {
    const radSq = radius * radius;
    for (let i = 0; i < this.count; i++) {
      const v = this.pool[i];
      if (!v.shown) continue;
      const dx = pos.x - v.x;
      const dz = pos.z - v.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < radSq) {
        v.wreck = true;
        v.vy += strength * 1.5;
        v.vx += dx * (strength * 0.1);
        v.vz += dz * (strength * 0.1);
        v.pitch += (Math.random() - 0.5) * 0.2;
      }
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
