import { Group, type Vector3 } from 'three/webgpu';
import { DESTRUCTION } from '../../core/config';
import type { Collider } from '../../core/types';
import type { ImpactFootprint } from '../../player/combat/MeteorImpact';
import { DebrisPool } from './DebrisPool';
import { ScarField } from './ScarField';

/** Implemented by the lead in Game.ts over RealCityLayer and the chunk streamer. */
export interface DestructibleWorld {
  /** Every collider currently in the physics broadphase. */
  colliders(): readonly Collider[];
  blastColliders?(point:Vector3,radius:number):readonly Collider[];
  /**
   * Permanently removes that building's geometry and collider from the world.
   * Returns false when the id is not destructible (landmarks, terrain, distant LOD).
   */
  destroy(colliderId: string): boolean;
  deform?(point: Vector3, radius: number, damage: number, depth?: number): boolean;
}

interface Damage { amount: number; threshold: number; touched: number; x:number; z:number; width:number; depth:number }
interface PendingRemoval {box:Collider;amount:number;impact?:LocalImpactStats}

export interface DestructionStats { debris: number; scars: number; destroyed: number; damaged: number }
export interface LocalImpactStats {
  footprint: ImpactFootprint; point: Vector3; queried: number; queryMs: number;
  buildings: number; trees: number; props: number; lamps: number; vehicles: number;
  npcAffected: number; npcDisabled: number; npcKnocked: number; npcFleeing: number;
}

/**
 * Accumulated structural damage keyed by collider id, plus the rubble and scorch it produces.
 * Collider ids are never interpreted here: destructibility is whatever `world.destroy` says it
 * is, so landmarks and distant proxies stay safe without this file knowing their id scheme.
 */
export class DestructionSystem {
  readonly stats: DestructionStats = { debris: 0, scars: 0, destroyed: 0, damaged: 0 };
  private readonly group = new Group();
  private readonly debris: DebrisPool;
  private readonly scars: ScarField;
  private readonly pending=new Map<string,PendingRemoval>();
  private readonly pendingLight=new Map<string,PendingRemoval>();
  lastImpact: LocalImpactStats | null = null;
  get pendingCount(){return this.pending.size+this.pendingLight.size;}
  private readonly entries = new Map<string, Damage>();
  /** Retired damage records, reused so a streaming city never churns the heap. */
  private readonly free: Damage[] = [];
  private time = 0;
  private frame = 0;
  private collapsedThisFrame = 0;
  private lightRetiredThisFrame = 0;
  private lastDeformation=-Infinity;
  private ploughFrame = -1;
  private ploughCount = 0;
  private evictTimer = DESTRUCTION.evictInterval;

  constructor(root: Group, private readonly world: DestructibleWorld) {
    this.group.name = 'destruction';
    root.add(this.group);
    this.debris = new DebrisPool(this.group, DESTRUCTION.maxDebris, {
      gravity: DESTRUCTION.debrisGravity, restitution: DESTRUCTION.debrisBounce, friction: DESTRUCTION.debrisFriction,
      lifetime: DESTRUCTION.debrisLifetime, speedScale: DESTRUCTION.debrisSpeed, sizeScale: DESTRUCTION.debrisSize,
      cullRadius: DESTRUCTION.debrisCullRadius,
    });
    this.scars = new ScarField(this.group, DESTRUCTION.maxScars, {
      duration: DESTRUCTION.scarLifetime, hotTime: DESTRUCTION.scarHotTime,
      fadeTime: DESTRUCTION.scarFadeTime, height: DESTRUCTION.scarHeight,
    });
  }

  /** Call once per frame. Drives the high-speed ram, the rubble and the scorch in that order. */
  update(dt: number, playerPosition: Vector3, playerVelocity: Vector3, running = false): void {
    this.frame++;
    this.collapsedThisFrame = 0;
    this.lightRetiredThisFrame = 0;
    this.time += dt;
    if (!running) this.plough(playerPosition, playerVelocity, dt);
    this.drainPending(this.pending,DESTRUCTION.maxCollapsesPerFrame-this.collapsedThisFrame);
    this.drainPending(this.pendingLight,DESTRUCTION.maxLightRetirementsPerFrame);
    this.debris.update(dt, playerPosition);
    this.scars.update(dt);
    this.evictTimer -= dt;
    if (this.evictTimer <= 0) { this.evictTimer = DESTRUCTION.evictInterval; this.evict(); }
    this.stats.debris = this.debris.count;
    this.stats.scars = this.scars.count;
    this.stats.damaged = this.entries.size;
  }
  private drainPending(queue:Map<string,PendingRemoval>,budget:number):void{
    for(const [id,queued] of queue){if(budget--<=0)break;queue.delete(id);this.apply(queued.box,queued.amount,true,queued.impact);}
  }

  /**
   * A beam/impact at a point with a blast radius. Returns how many buildings collapsed.
   *
   * `deform` is what the ground is told, separate from what the buildings are told, because the
   * terrain derives crater depth from `radius * .36 + sqrt(damage) * .32`. An impact strong
   * enough to level a block would otherwise dig a shaft rather than a bowl.
   */
  damageAt(point: Vector3, radius: number, damage: number, deform = damage): number {
    if(!Number.isFinite(point.x+point.y+point.z+radius+damage)||radius<=0||damage<=0)return 0;
    if(Number.isFinite(deform)&&deform>0)this.world.deform?.(point,radius,deform);
    const colliders = this.world.blastColliders?.(point,radius)??this.world.colliders();
    const radiusSq = radius * radius;
    let collapsed = 0;
    // Backwards: `destroy` is free to splice the live broadphase, and only entries above the
    // removed index shift, which this walk has already passed.
    for (let i = colliders.length - 1; i >= 0; i--) {
      const box = colliders[i];
      if (box.id === undefined) continue;
      const hw = box.width * .5, hh = box.height * .5, hd = box.depth * .5;
      // Squared distance from the blast centre to the closest point on the box.
      const dx = point.x < box.x - hw ? box.x - hw - point.x : point.x > box.x + hw ? point.x - box.x - hw : 0;
      const dy = point.y < box.y - hh ? box.y - hh - point.y : point.y > box.y + hh ? point.y - box.y - hh : 0;
      const dz = point.z < box.z - hd ? box.z - hd - point.z : point.z > box.z + hd ? point.z - box.z - hd : 0;
      const distanceSq = dx * dx + dy * dy + dz * dz;
      if (distanceSq > radiusSq) continue;
      // A direct hit takes the full charge; the blast edge still carries a third of it.
      const falloff = .34 + .66 * (1 - Math.sqrt(distanceSq) / radius);
      if (this.apply(box, damage * falloff, collapsed < DESTRUCTION.maxCollapsesPerFrame)) collapsed++;
    }
    // Partial damage is always visible: a puff of gravel and a scorch, even when nothing falls.
    this.debris.spawn(point.x, point.y, point.z, DESTRUCTION.impactChunks, DESTRUCTION.impactColour, DESTRUCTION.impactEnergy);
    if (point.y <= DESTRUCTION.scarMaxHeight) this.scars.spawn(point.x, point.z, radius * DESTRUCTION.scarRadiusScale, 1);
    return collapsed;
  }

  /** One footprint drives excavation and an XZ surface shockwave, including tall structures. */
  impactAt(point: Vector3, footprint: ImpactFootprint): number {
    const stats: LocalImpactStats = { footprint, point: point.clone(), queried: 0, queryMs: 0,
      buildings: 0, trees: 0, props: 0, lamps: 0, vehicles: 0,
      npcAffected: 0, npcDisabled: 0, npcKnocked: 0, npcFleeing: 0 };
    this.lastImpact = stats;
    if (footprint.craterRadiusM > 0 && footprint.craterDepthM > 0)
      this.world.deform?.(point, footprint.craterRadiusM, footprint.structuralDamage, footprint.craterDepthM);
    const radius = Math.max(footprint.coreDestructionRadiusM, footprint.blastDamageRadiusM);
    if (radius <= 0) return 0;
    const started = performance.now();
    // Snapshot: owner removal can splice its live collider array. Deduplicate multipart IDs.
    const boxes = [...(this.world.blastColliders?.(point,radius) ?? this.world.colliders())];
    stats.queryMs = performance.now() - started;
    const entities = new Map<string,{box:Collider;distance:number}>();
    for (const box of boxes) {
      if (!box.id) continue;
      const distance = Math.hypot(Math.max(0,Math.abs(point.x-box.x)-box.width/2),
        Math.max(0,Math.abs(point.z-box.z)-box.depth/2));
      if (distance > radius) continue;
      const previous=entities.get(box.id);
      if (!previous || distance<previous.distance) entities.set(box.id,{box,distance});
    }
    stats.queried=entities.size;
    let collapsed = 0;
    // Core first: cheap trees/furniture disappear before processing the outer shockwave.
    for (const core of [true,false]) for (const {box,distance} of entities.values()) {
      if((distance<=footprint.coreDestructionRadiusM)!==core)continue;
      const amount = core ? Number.MAX_SAFE_INTEGER
        : footprint.structuralDamage * Math.pow(Math.max(0,1-distance/footprint.blastDamageRadiusM),2);
      if (this.apply(box,amount,true,stats)) collapsed++;
    }
    this.debris.spawn(point.x,point.y,point.z,Math.min(DESTRUCTION.impactChunks,footprint.debrisCount),DESTRUCTION.impactColour,DESTRUCTION.impactEnergy);
    return collapsed;
  }

  /** Reconstruction cancels deferred removals as well as accumulated damage. */
  restoreAt(point: Vector3, radius: number): void {
    const intersects=(box:{x:number;z:number;width:number;depth:number})=>Math.hypot(
      Math.max(0,Math.abs(box.x-point.x)-box.width/2),Math.max(0,Math.abs(box.z-point.z)-box.depth/2))<=radius;
    for(const queue of [this.pending,this.pendingLight])for(const [id,queued] of queue)if(intersects(queued.box))queue.delete(id);
    for (const [id,entry] of this.entries) if (intersects(entry)) { this.entries.delete(id); this.recycle(entry); }
  }

  /**
   * The high-speed ram. One pass over the broadphase, swept against the path covered this frame.
   * Idempotent per frame: `update` already ran it, so a second call returns the same count
   * instead of scanning the collider list twice.
   */
  plough(position: Vector3, velocity: Vector3, dt: number, running = false): number {
    if (!running && this.ploughFrame === this.frame) return this.ploughCount;
    this.ploughFrame = this.frame;
    this.ploughCount = 0;
    if (dt <= 0) return 0;
    const speed = velocity.length();
    if (speed < DESTRUCTION.ploughSpeed) return 0;
    // The sweep is capped in metres so a stall or a teleport cannot turn one frame into a
    // kilometre-long scan; damage stays proportional to the real dt either way.
    const travel = Math.min(speed * dt, DESTRUCTION.ploughMaxSweep);
    if(!running && this.time-this.lastDeformation>=.12){this.world.deform?.(position,Math.min(22,4+speed*.003),speed*dt);this.lastDeformation=this.time;}
    const inverse = 1 / speed;
    const dirX = velocity.x * inverse, dirY = velocity.y * inverse, dirZ = velocity.z * inverse;
    const radius = Math.min(DESTRUCTION.ploughMaxRadius, DESTRUCTION.ploughRadius + speed * DESTRUCTION.ploughRadiusPerSpeed);
    const colliders = this.world.colliders();
    let collapsed = 0, hits = 0;
    // Backwards for the same reason as `damageAt`: a splicing `destroy` must not skip a building.
    for (let i = colliders.length - 1; i >= 0; i--) {
      const box = colliders[i];
      if (box.id === undefined) continue;
      // Slab test against the box grown by `radius`: the Minkowski box is the cheap stand-in
      // for a capsule, and its entry/exit distances give the penetration length for free.
      let enter = 0, leave = travel;
      const hx = box.width * .5 + radius;
      if (dirX > 1e-6 || dirX < -1e-6) {
        const inverseX = 1 / dirX;
        let a = (box.x - hx - position.x) * inverseX, b = (box.x + hx - position.x) * inverseX;
        if (a > b) { const swap = a; a = b; b = swap; }
        if (a > enter) enter = a; if (b < leave) leave = b;
      } else if (position.x < box.x - hx || position.x > box.x + hx) continue;
      if (enter > leave) continue;
      const hy = box.height * .5 + radius;
      if (dirY > 1e-6 || dirY < -1e-6) {
        const inverseY = 1 / dirY;
        let a = (box.y - hy - position.y) * inverseY, b = (box.y + hy - position.y) * inverseY;
        if (a > b) { const swap = a; a = b; b = swap; }
        if (a > enter) enter = a; if (b < leave) leave = b;
      } else if (position.y < box.y - hy || position.y > box.y + hy) continue;
      if (enter > leave) continue;
      const hz = box.depth * .5 + radius;
      if (dirZ > 1e-6 || dirZ < -1e-6) {
        const inverseZ = 1 / dirZ;
        let a = (box.z - hz - position.z) * inverseZ, b = (box.z + hz - position.z) * inverseZ;
        if (a > b) { const swap = a; a = b; b = swap; }
        if (a > enter) enter = a; if (b < leave) leave = b;
      } else if (position.z < box.z - hz || position.z > box.z + hz) continue;
      if (enter > leave) continue;
      // Damage per metre actually driven through the mass, not per frame: halving the frame
      // time halves each segment and the total over a traversal is unchanged.
      const amount = running ? DESTRUCTION.maxHealth * 2 : DESTRUCTION.ploughDamage * speed * (leave - enter);
      if (this.apply(box, amount, collapsed < DESTRUCTION.maxCollapsesPerFrame)) collapsed++;
      hits++;
    }
    // One scorch per frame at the middle of the sweep: at mega speed a scar per building would
    // burn the whole field in a second and leave nothing behind for the rest of the flight.
    if (hits > 0 && position.y <= DESTRUCTION.scarMaxHeight) {
      this.scars.spawn(position.x + dirX * travel * .5, position.z + dirZ * travel * .5, radius * DESTRUCTION.scarRadiusScale, .8);
    }
    this.ploughCount = collapsed;
    return collapsed;
  }

  /** Returns true when this hit brought the building down. */
  private apply(box: Collider, amount: number, allowCollapse: boolean, impact?: LocalImpactStats): boolean {
    const id = box.id;
    if (id === undefined || amount <= 0) return false;
    let entry = this.entries.get(id);
    if (!entry) {
      if (this.entries.size >= DESTRUCTION.maxEntries) this.evict();
      entry = this.free.pop() ?? { amount: 0, threshold: 0, touched: 0, x:0, z:0, width:0, depth:0 };
      entry.amount = 0;
      entry.threshold = Math.min(DESTRUCTION.maxHealth, DESTRUCTION.baseHealth + box.width * box.height * box.depth * DESTRUCTION.healthPerVolume);
      if (box.category === 'fragile' || box.category === 'vegetation') entry.threshold = Math.min(entry.threshold,80);
      if (box.category === 'vehicle') entry.threshold = Math.min(entry.threshold,240);
      this.entries.set(id, entry);
    }
    entry.x=box.x;entry.z=box.z;entry.width=box.width;entry.depth=box.depth;
    entry.touched = this.time;
    entry.amount += amount;
    if(entry.amount<entry.threshold)return false;
    const light=!!impact&&(box.category==='fragile'||box.category==='vegetation'||box.category==='vehicle');
    if(!allowCollapse || (light?this.lightRetiredThisFrame>=DESTRUCTION.maxLightRetirementsPerFrame:this.collapsedThisFrame>=DESTRUCTION.maxCollapsesPerFrame)){
      // One entry per queried resident entity; no silent loss when a blast exceeds a budget.
      const queue=light?this.pendingLight:this.pending;
      const other=light?this.pending:this.pendingLight,previous=queue.get(id)??other.get(id);
      other.delete(id);queue.set(id,{box:{...box},amount:entry.threshold,impact:impact??previous?.impact});
      return false;
    }
    this.pending.delete(id);this.pendingLight.delete(id);
    if (!this.world.destroy(id)) {
      // Pool slots can hold another car later; a stale hit must not make that slot invulnerable.
      if(box.category==='vehicle'){this.entries.delete(id);this.recycle(entry);return false;}
      // Indestructible. Parking the threshold out of reach stops every later hit from asking
      // again; the record still ages out of the map on the normal eviction pass.
      entry.threshold = Infinity;
      return false;
    }
    this.entries.delete(id);
    this.recycle(entry);
    if(light)this.lightRetiredThisFrame++;else this.collapsedThisFrame++;
    this.collapse(box,light);
    if (impact) {
      if (box.category === 'vegetation') impact.trees++;
      else if (box.category === 'vehicle') impact.vehicles++;
      else if (box.category === 'fragile') { impact.props++; if (box.impactKind === 'lamp') impact.lamps++; }
      else impact.buildings++;
    }
    return true;
  }

  private collapse(box: Collider, light=false): void {
    this.stats.destroyed++;
    const volume = box.width * box.height * box.depth;
    const extent = Math.cbrt(volume);
    const energy = Math.min(DESTRUCTION.maxChunkEnergy, extent);
    const count = Math.min(light?4:DESTRUCTION.maxChunksPerCollapse, Math.round(DESTRUCTION.chunksPerCollapse * (.5 + extent * .12)));
    // Rubble erupts from the lower third: the mass that falls is the mass that was load-bearing.
    this.debris.spawn(box.x, box.y - box.height * .28, box.z, count, this.rubbleColour(box.id ?? ''), energy);
    const base = box.y - box.height * .5;
    if (!light && base <= DESTRUCTION.scarMaxHeight) this.scars.spawn(box.x, base, box.z, Math.max(box.width, box.depth) * .58, .5);
  }

  /** FNV-1a over the collider id: the same building always leaves the same colour of rubble. */
  private rubbleColour(id: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) { hash ^= id.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    const tint = ((hash >>> 8) & 255) / 255;
    return ((136 + tint * 64) << 16) | ((130 + tint * 60) << 8) | (120 + tint * 54);
  }

  private recycle(entry: Damage): void {
    if (this.free.length < DESTRUCTION.maxEntries) this.free.push(entry);
  }

  /**
   * Runs on a timer, not per frame: the map is swept for records nothing has touched in a
   * while, then trimmed from the front, which in a Map is the stalest arrival.
   */
  private evict(): void {
    const cutoff = this.time - DESTRUCTION.entryTtl;
    for (const [id, entry] of this.entries) {
      if (entry.touched < cutoff) { this.entries.delete(id); this.recycle(entry); }
    }
    while (this.entries.size >= DESTRUCTION.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      const entry = this.entries.get(oldest.value);
      this.entries.delete(oldest.value);
      if (entry) this.recycle(entry);
    }
  }

  /** `particles` is the active quality preset's particle budget. */
  setQuality(particles: number): void {
    this.debris.setLimit(Math.max(48, Math.min(DESTRUCTION.maxDebris, Math.round(particles * DESTRUCTION.debrisPerParticle))));
    this.scars.setLimit(Math.max(24, Math.min(DESTRUCTION.maxScars, Math.round(particles * DESTRUCTION.scarsPerParticle))));
  }

  dispose(): void {
    this.debris.dispose();
    this.scars.dispose();
    this.entries.clear();this.pending.clear();this.pendingLight.clear();
    this.free.length = 0;
    this.group.removeFromParent();
  }
}
