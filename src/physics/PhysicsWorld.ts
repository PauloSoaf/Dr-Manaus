import { Vector3 } from 'three/webgpu';
import type { Collider } from '../core/types';
import { terrainFootHeight, sweepTerrain, removeInwardTerrainVelocity, type TerrainContact } from './TerrainSweep';
import { VOLUME_CONTACT_POLICY, type VolumeCollisionProvider, type VolumeContact } from './VolumeCollisionProvider';
import type { Vec3 } from '../world/spatial/units';

export interface RayHit { distance: number; collider: Collider | null; point: Vector3 }
/** Active physics frame coordinates. The raycast must match the provider's terrain topology. */
export interface TerrainProvider {
  /** Intact single-valued planetary terrain; no separate cavity-wall raycast is needed. */
  readonly heightfieldOnly?: boolean;
  heightAt(x: number, z: number): number;
  raycast?(origin: Vector3, direction: Vector3, maxDistance: number): number | null;
}

/** Axis-swept character AABB. Continuous face crossing prevents boost tunnelling. */
export class PhysicsWorld {
  private readonly nearby: Collider[] = [];
  private readonly terrainOrigin = new Vector3();
  private readonly terrainDirection = new Vector3();
  private readonly terrainFrom = new Vector3();
  private readonly terrainTo = new Vector3();
  private readonly terrainContact: TerrainContact = { fraction: 0, position: new Vector3(), heightM: 0, normal: new Vector3() };
  lastTerrainContact: Readonly<TerrainContact> | null = null;
  lastVolumeContact: Readonly<VolumeContact> | null = null;
  private static terrain: TerrainProvider | null = null;
  private static volume: VolumeCollisionProvider | null = null;

  static setTerrain(provider: TerrainProvider | null): void { this.terrain = provider; }
  static setVolumeCollision(provider: VolumeCollisionProvider | null): void { this.volume=provider; }
  static terrainHeight(x: number, z: number, radius = 0): number {
    const terrain = this.terrain; if (!terrain) return 0;
    return terrainFootHeight(terrain, x, z, radius);
  }
  private static removedGroundPlate(box: Collider, x: number, z: number): boolean {
    return this.terrain !== null && box.y + box.height / 2 <= 1.25 && box.y - box.height / 2 >= -1.25 && this.terrainHeight(x, z) < -.001;
  }

  move(position: Vector3, velocity: Vector3, dt: number, radius: number, height: number, colliders: readonly Collider[], stepHeight = 0): boolean {
    this.lastTerrainContact = null;
    this.lastVolumeContact = null;
    if(PhysicsWorld.volume)return this.moveVolume(position,velocity,dt,radius,height,colliders);
    const deltaX = velocity.x * dt, deltaY = velocity.y * dt, deltaZ = velocity.z * dt;
    const reach = Math.max(Math.abs(deltaX), Math.abs(deltaY), Math.abs(deltaZ)) + height + radius;
    this.nearby.length = 0;
    for (const box of colliders) {
      if (Math.abs(box.x - position.x) <= box.width / 2 + reach && Math.abs(box.z - position.z) <= box.depth / 2 + reach && Math.abs(box.y - position.y) <= box.height / 2 + reach) this.nearby.push(box);
    }
    const terrain = PhysicsWorld.terrain;
    this.terrainFrom.copy(position);
    const walking = stepHeight > 0 && Math.abs(deltaY) <= stepHeight &&
      position.y <= PhysicsWorld.terrainHeight(position.x, position.z, radius) + .01;
    // A planetary step without nearby boxes is one straight segment. Sweeping it once
    // avoids repeating 16 relief brackets in all eight urban corner-sliding substeps.
    if (terrain && !this.nearby.length && !walking && (terrain.heightfieldOnly || position.y >= -.005)) {
      this.terrainTo.set(position.x + deltaX, position.y + deltaY, position.z + deltaZ);
      const contact = sweepTerrain(terrain, this.terrainFrom, this.terrainTo, radius, this.terrainContact);
      if (contact) {
        position.copy(contact.position); removeInwardTerrainVelocity(velocity, contact.normal);
        this.lastTerrainContact = contact; return true;
      }
      position.copy(this.terrainTo);
      const floor = PhysicsWorld.terrainHeight(position.x, position.z, radius);
      if (position.y <= floor) { position.y = floor; velocity.y = Math.max(0, velocity.y); return true; }
      return false;
    }
    // Small substeps preserve sliding at corners; each axis remains swept.
    const steps = Math.min(8, Math.max(1, Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaY), Math.abs(deltaZ)) / Math.max(radius * 3, 2))));
    let grounded = false;
    for (let step = 0; step < steps; step++) {
      this.terrainFrom.copy(position);
      for (const axis of ['x', 'z'] as const) {
        let travel = velocity[axis] * dt / steps;
        const other = axis === 'x' ? 'z' : 'x';
        for (const box of this.nearby) {
          if (PhysicsWorld.removedGroundPlate(box, position.x, position.z)) continue;
          const half = (axis === 'x' ? box.width : box.depth) / 2;
          const otherHalf = (axis === 'x' ? box.depth : box.width) / 2;
          const bottom = box.y - box.height / 2, top = box.y + box.height / 2;
          if (position.y >= top - 0.01 || position.y + height <= bottom + 0.01 || Math.abs(position[other] - box[other]) >= otherHalf + radius - 0.001) continue;
          const low = box[axis] - half - radius, high = box[axis] + half + radius;
          const crossing = (travel > 0 && position[axis] <= low + 0.001 && position[axis] + travel > low) || (travel < 0 && position[axis] >= high - 0.001 && position[axis] + travel < high);
          if (!crossing) continue;
          if (stepHeight > 0 && top - position.y <= stepHeight && velocity.y <= 0) { position.y = top + 0.002; grounded = true; continue; }
          travel = (travel > 0 ? low : high) - position[axis];
          velocity[axis] = 0;
        }
        // Under ground level, sweep the cavity wall as well as the building boxes.
        // Walking may climb a small step; flight cannot tunnel horizontally out of a bowl.
        if (PhysicsWorld.terrain?.raycast && position.y < -.005 && Math.abs(travel) > .00001) {
          this.terrainOrigin.copy(position); this.terrainOrigin.y += Math.max(0, stepHeight) + .025;
          this.terrainDirection.set(0, 0, 0); this.terrainDirection[axis] = Math.sign(travel);
          const hit = PhysicsWorld.terrain.raycast(this.terrainOrigin, this.terrainDirection, Math.abs(travel) + radius);
          if (hit !== null && hit <= Math.abs(travel) + radius) {
            travel = Math.sign(travel) * Math.max(0, hit - radius - .01); velocity[axis] = 0;
          }
        }
        position[axis] += travel;
      }
      let rise = velocity.y * dt / steps;
      for (const box of this.nearby) {
        if (PhysicsWorld.removedGroundPlate(box, position.x, position.z)) continue;
        if (Math.abs(position.x - box.x) >= box.width / 2 + radius - 0.001 || Math.abs(position.z - box.z) >= box.depth / 2 + radius - 0.001) continue;
        const bottom = box.y - box.height / 2, top = box.y + box.height / 2;
        if (rise <= 0 && position.y >= top - 0.01 && position.y + rise <= top) { rise = top - position.y; velocity.y = 0; grounded = true; }
        else if (rise > 0 && position.y + height <= bottom + 0.01 && position.y + height + rise >= bottom) { rise = bottom - height - position.y; velocity.y = 0; }
      }
      this.terrainTo.copy(position); this.terrainTo.y += rise;
      const terrain = PhysicsWorld.terrain;
      // Preserve ordinary walking's existing step support. Airborne/fast movement must
      // search the whole proposed segment, even when both endpoints are above a ridge.
      const walkingStep = stepHeight > 0 && Math.abs(rise) <= stepHeight &&
        this.terrainFrom.y <= PhysicsWorld.terrainHeight(this.terrainFrom.x, this.terrainFrom.z, radius) + .01;
      const contact = terrain && !walkingStep
        ? sweepTerrain(terrain, this.terrainFrom, this.terrainTo, radius, this.terrainContact) : null;
      if (contact) {
        position.copy(contact.position);
        removeInwardTerrainVelocity(velocity, contact.normal);
        this.lastTerrainContact = contact;
        contact.fraction = (step + contact.fraction) / steps;
        return true; // Discard the remainder of this frame at the first impact.
      }
      position.y += rise;
      const floor = PhysicsWorld.terrainHeight(position.x, position.z, radius);
      if (position.y <= floor) { position.y = floor; velocity.y = Math.max(0, velocity.y); grounded = true; }
    }
    return grounded;
  }

  /** Explicit volume mode. Earliest volume/heightfield/box contact wins each bounded iteration.
   * No implicit y=0 plane in a volume-only cavity; the normal gameplay path above is unchanged. */
  private moveVolume(position:Vector3,velocity:Vector3,dt:number,radius:number,height:number,colliders:readonly Collider[]):boolean {
    let remaining=Math.max(0,dt),grounded=false;
    for(let iteration=0;iteration<VOLUME_CONTACT_POLICY.maxIterations&&remaining>1e-10;iteration++) {
      const delta:Vec3=[velocity.x*remaining,velocity.y*remaining,velocity.z*remaining];
      if(Math.hypot(...delta)<1e-10)break;
      let hit=PhysicsWorld.volume!.sweepCapsule(position.toArray(),delta,radius,height);
      let fraction=hit?.fraction??1,normal:Vec3|undefined=hit?.normal,terrainHit:TerrainContact|null=null;
      const terrain=PhysicsWorld.terrain;
      if(terrain) {
        this.terrainFrom.copy(position);this.terrainTo.copy(position).add(new Vector3(...delta));
        const contact=sweepTerrain(terrain,this.terrainFrom,this.terrainTo,radius,this.terrainContact);
        if(contact&&contact.fraction<=fraction){terrainHit=contact;fraction=contact.fraction;normal=contact.normal.toArray();hit=null;}
      }
      for(const box of colliders) {
        const min:Vec3=[box.x-box.width/2-radius,box.y-box.height/2-height,box.z-box.depth/2-radius],
          max:Vec3=[box.x+box.width/2+radius,box.y+box.height/2,box.z+box.depth/2+radius];
        let enter=-Infinity,leave=Infinity,axisHit=-1,sign=0;
        const from=position.toArray();
        for(let axis=0;axis<3;axis++) {
          if(Math.abs(delta[axis])<1e-12){if(from[axis]<min[axis]||from[axis]>max[axis]){leave=-Infinity;break;}continue;}
          const a=(min[axis]-from[axis])/delta[axis],b=(max[axis]-from[axis])/delta[axis];
          if(Math.min(a,b)>enter){enter=Math.min(a,b);axisHit=axis;sign=delta[axis]>0?-1:1;}
          leave=Math.min(leave,Math.max(a,b));
        }
        if(enter>=-1e-10&&enter<=leave&&enter<=fraction&&axisHit>=0){fraction=Math.max(0,enter);normal=[0,0,0];normal[axisHit]=sign;hit=null;terrainHit=null;}
      }
      if(!normal){position.add(new Vector3(...delta));break;}
      const inward=velocity.x*normal[0]+velocity.y*normal[1]+velocity.z*normal[2];
      position.add(new Vector3(...delta).multiplyScalar(fraction));
      if(terrainHit){position.copy(terrainHit.position);this.lastTerrainContact=terrainHit;}
      else position.add(new Vector3(...normal).multiplyScalar(VOLUME_CONTACT_POLICY.skinM));
      if(hit)this.lastVolumeContact=hit;
      if(normal[1]>=VOLUME_CONTACT_POLICY.floorNormalY&&inward<0)grounded=true;
      if(inward<0)velocity.add(new Vector3(...normal).multiplyScalar(-inward));
      remaining*=Math.max(0,1-fraction);
    }
    return grounded;
  }

  static raycast(origin: Vector3, direction: Vector3, colliders: readonly Collider[], maxDistance: number, margin = 0, ground = false): RayHit | null {
    let nearest = maxDistance;
    let hit: Collider | null = null;
    let found = false;
    for (const box of colliders) {
      let enter = 0, leave = nearest;
      for (const axis of ['x', 'y', 'z'] as const) {
        const half = (axis === 'x' ? box.width : axis === 'y' ? box.height : box.depth) / 2 + margin;
        const lo = box[axis] - half, hi = box[axis] + half;
        const speed = direction[axis];
        if (Math.abs(speed) < 0.000001) {
          if (origin[axis] < lo || origin[axis] > hi) { enter = Infinity; break; }
        } else {
          let a = (lo - origin[axis]) / speed, b = (hi - origin[axis]) / speed;
          if (a > b) [a, b] = [b, a];
          enter = Math.max(enter, a); leave = Math.min(leave, b);
          if (enter > leave) break;
        }
      }
      if (enter <= leave && enter > 0.025 && enter < nearest) {
        if (this.removedGroundPlate(box, origin.x + direction.x * enter, origin.z + direction.z * enter)) continue;
        nearest = enter; hit = box; found = true;
      }
    }
    if (ground) {
      const distance = this.terrain?.raycast
        ? this.terrain.raycast(origin, direction, nearest)
        : direction.y < -0.0001 ? -origin.y / direction.y : null;
      if (distance !== null && distance > 0 && distance < nearest) { nearest = distance; hit = null; found = true; }
    }
    const volume=this.volume?.raycast(origin.toArray(),direction.toArray(),nearest);
    if(volume&&volume.distance<nearest){nearest=volume.distance;hit=null;found=true;}
    return found ? { distance: nearest, collider: hit, point: origin.clone().addScaledVector(direction, nearest) } : null;
  }

  static safeLanding(destination: Vector3, colliders: readonly Collider[], radius: number, height: number): Vector3 {
    const safe = destination.clone();
    safe.y = Math.max(this.terrainHeight(safe.x, safe.z, radius) + .05, safe.y);
    for (const box of colliders) {
      if (this.removedGroundPlate(box, safe.x, safe.z)) continue;
      if (Math.abs(safe.x - box.x) < box.width / 2 + radius && Math.abs(safe.z - box.z) < box.depth / 2 + radius && safe.y < box.y + box.height / 2 && safe.y + height > box.y - box.height / 2) safe.y = box.y + box.height / 2 + 0.05;
    }
    return safe;
  }
}
