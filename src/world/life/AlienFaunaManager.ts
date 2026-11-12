/**
 * AlienFaunaManager.ts
 *
 * Deterministic, low-overhead alien fauna system.
 * Simulates alien creatures with 5-10 Hz economic AI ticks, procedural low-poly
 * morphology via InstancedMesh, surface grounding, and full combat integration.
 */

import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
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
import type { Target } from '../../core/types';
import type { PlanetaryBiosphereProfile, DominantFaunaType } from './PlanetaryBiosphere';
import type { PlanetSurfaceGenerator } from '../planet/PlanetSurface';
import type { Vec3 } from '../spatial/units';

export const FAUNA_CAPACITY = 32;
export const FAUNA_AI_TICK_SEC = 0.125; // 8 Hz AI update rate
const MAX_FAUNA_HISTORY = 1024;

export type CreatureBehaviorState =
  | 'idle'
  | 'patrolling'
  | 'fleeing'
  | 'aggressive'
  | 'knocked'
  | 'defeated';

export interface CreatureEntity extends Target {
  id: string;
  readonly index: number;
  morphology: DominantFaunaType;
  readonly base: Vector3;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly targetPos: Vector3;
  headingRad: number;
  state: CreatureBehaviorState;
  health: number;
  maxHealth: number;
  timer: number;
  isAirborne: boolean;
  speedMps: number;
}

function safeMerge(geos: BufferGeometry[]): BufferGeometry {
  const prepared = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(prepared);
  for (const g of geos) g.dispose();
  for (const g of prepared) {
    if (!geos.includes(g)) g.dispose();
  }
  return merged ?? new BoxGeometry(1, 1, 1);
}

/**
 * Creates low-poly morphology geometries for creature types.
 */
function createMorphologyGeometry(morph: DominantFaunaType): BufferGeometry {
  switch (morph) {
    case 'amphibious-crawlers': {
      // Low wide carapace + snout
      const body = new SphereGeometry(1.2, 6, 4);
      body.scale(1.2, 0.45, 1.0);
      body.translate(0, 0.4, 0);
      const head = new ConeGeometry(0.5, 0.9, 4);
      head.rotateX(Math.PI / 2);
      head.translate(0, 0.35, 1.2);
      return safeMerge([body, head]);
    }

    case 'chitinous-quadrupeds': {
      // Bulky torso + head + dorsal shell
      const torso = new BoxGeometry(1.2, 0.8, 1.8);
      torso.translate(0, 0.8, 0);
      const head = new BoxGeometry(0.7, 0.6, 0.8);
      head.translate(0, 1.0, 1.2);
      return safeMerge([torso, head]);
    }

    case 'avian-gliders': {
      // Slender body + wide delta wings
      const body = new CapsuleGeometry(0.3, 1.6, 4, 4);
      body.rotateX(Math.PI / 2);
      body.translate(0, 0.2, 0);
      const wings = new BoxGeometry(4.0, 0.08, 1.2);
      wings.translate(0, 0.3, 0.2);
      return safeMerge([body, wings]);
    }

    case 'serpentine-burrowers': {
      // Elongated segmented crawler
      const segment = new CapsuleGeometry(0.45, 2.8, 4, 5);
      segment.rotateX(Math.PI / 2);
      segment.translate(0, 0.4, 0);
      return segment;
    }

    case 'bipedal-predators': {
      // Upright predator torso + forward head
      const torso = new CapsuleGeometry(0.4, 1.4, 4, 4);
      torso.translate(0, 1.2, -0.2);
      const head = new BoxGeometry(0.5, 0.5, 0.9);
      head.translate(0, 1.8, 0.5);
      return safeMerge([torso, head]);
    }

    case 'none':
    default:
      return new SphereGeometry(0.5, 4, 4);
  }
}

export class AlienFaunaManager {
  readonly root = new Group();
  readonly creatures: CreatureEntity[] = [];
  private readonly meshes = new Map<DominantFaunaType, InstancedMesh>();
  private readonly defeatedIds = new Set<string>();

  // Economic tick timer
  private aiTickAccumulator = 0;
  private currentCell = '';

  // Scratch objects for zero allocations
  private readonly dummy = new Object3D();
  private readonly quat = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly normal = new Vector3(0, 1, 0);
  private readonly dirVec = new Vector3();
  private readonly moveDir = new Vector3();
  private readonly color = new Color();

  constructor() {
    this.root.name = 'alien-fauna-manager';

    const morphs: DominantFaunaType[] = [
      'amphibious-crawlers',
      'chitinous-quadrupeds',
      'avian-gliders',
      'serpentine-burrowers',
      'bipedal-predators',
    ];

    for (const morph of morphs) {
      const geo = createMorphologyGeometry(morph);
      const mat = new MeshStandardMaterial({
        color: '#6e8065',
        roughness: 0.75,
        metalness: morph === 'chitinous-quadrupeds' ? 0.3 : 0.05,
      });

      const mesh = new InstancedMesh(geo, mat, FAUNA_CAPACITY);
      mesh.name = `fauna-${morph}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.meshes.set(morph, mesh);
      this.root.add(mesh);
    }

    // Pre-allocate creature entity pool
    for (let i = 0; i < FAUNA_CAPACITY; i++) {
      this.creatures.push({
        id: '',
        index: i,
        kind: 'creature',
        morphology: 'chitinous-quadrupeds',
        base: new Vector3(),
        position: new Vector3(),
        velocity: new Vector3(),
        targetPos: new Vector3(),
        headingRad: 0,
        radius: 1.5,
        active: false,
        state: 'idle',
        health: 100,
        maxHealth: 100,
        timer: 0,
        isAirborne: false,
        speedMps: 4.0,
      });
    }
  }

  /**
   * Targets array for PowerSystem auto-lock and attack targeting.
   */
  get targets(): CreatureEntity[] {
    return this.creatures.filter(c => c.active && c.state !== 'defeated');
  }

  /**
   * Main per-frame update loop.
   */
  update(
    dt: number,
    playerPos: Vector3,
    surface?: PlanetSurfaceGenerator,
    biosphere?: PlanetaryBiosphereProfile,
  ): void {
    // If world has no animal life or surface: deactivate all creatures
    if (
      !surface ||
      !biosphere ||
      biosphere.lifeTier === 'sterile' ||
      biosphere.lifeTier === 'microbial' ||
      biosphere.lifeTier === 'vegetative'
    ) {
      this.clear();
      return;
    }

    // Seed creatures if moving into a new spatial sector or first run
    this.seedCreatures(playerPos, surface, biosphere);

    // 1. Economic AI Tick (5 to 10 Hz)
    this.aiTickAccumulator += dt;
    const isAiTick = this.aiTickAccumulator >= FAUNA_AI_TICK_SEC;
    if (isAiTick) {
      this.aiTickAccumulator = 0;
      this.updateAI(playerPos);
    }

    // 2. Continuous Physics & Transform Integration (60 FPS)
    this.updatePhysics(dt, surface);

    // 3. Update Instanced Meshes
    this.updateMeshes(biosphere);
  }

  private seedCreatures(
    playerPos: Vector3,
    surface: PlanetSurfaceGenerator,
    biosphere: PlanetaryBiosphereProfile,
  ): void {
    const cx = Math.floor(playerPos.x / 160);
    const cz = Math.floor(playerPos.z / 160);
    const cellKey = `${biosphere.bodyId}:${cx},${cz}`;
    if (cellKey === this.currentCell) return;
    this.currentCell = cellKey;

    const faunaSeed = biosphere.seeds.faunaSeed;
    const dominantMorph = biosphere.dominantFaunaType !== 'none'
      ? biosphere.dominantFaunaType
      : 'chitinous-quadrupeds';

    const originRadius = surface.radiusM;

    for (let i = 0; i < FAUNA_CAPACITY; i++) {
      const creature = this.creatures[i];
      const instanceId = `${biosphere.bodyId}:${cx}:${cz}:${i}`;

      if (this.defeatedIds.has(instanceId)) {
        creature.active = false;
        continue;
      }

      // Pseudo-random placement around player within 30m - 120m
      const angle = (i / FAUNA_CAPACITY) * Math.PI * 2 + ((faunaSeed + i * 17) % 100) * 0.05;
      const dist = 35 + ((faunaSeed * 7 + i * 31) % 85);
      const spawnX = playerPos.x + Math.cos(angle) * dist;
      const spawnZ = playerPos.z + Math.sin(angle) * dist;

      // Sample surface height
      const hyp = Math.hypot(spawnX, spawnZ);
      const radY = Math.sqrt(Math.max(1, originRadius * originRadius - hyp * hyp));
      this.dirVec.set(spawnX, radY, spawnZ).normalize();
      const dir: Vec3 = [this.dirVec.x, this.dirVec.y, this.dirVec.z];
      const terrainHeight = surface.heightAt(dir);

      const isAirborne = dominantMorph === 'avian-gliders';
      const altitude = isAirborne ? terrainHeight + 15 : terrainHeight;

      creature.id = instanceId;
      creature.morphology = dominantMorph;
      creature.base.set(spawnX, terrainHeight, spawnZ);
      creature.position.set(spawnX, altitude, spawnZ);
      creature.targetPos.copy(creature.position);
      creature.velocity.set(0, 0, 0);
      creature.headingRad = angle + Math.PI;
      creature.active = true;
      creature.state = 'idle';
      creature.health = creature.maxHealth = isAirborne ? 60 : 120;
      creature.timer = 1.0 + (i % 3);
      creature.isAirborne = isAirborne;
      creature.speedMps = isAirborne ? 12.0 : 4.5;
    }
  }

  private updateAI(playerPos: Vector3): void {
    for (const c of this.creatures) {
      if (!c.active || c.state === 'defeated') continue;

      const distToPlayer = c.position.distanceTo(playerPos);

      // React to player proximity: flee if player approaches rapidly or gets within 20m
      if (c.state !== 'knocked') {
        if (distToPlayer < 22) {
          c.state = 'fleeing';
          // Move away from player
          this.moveDir.subVectors(c.position, playerPos).normalize();
          c.targetPos.copy(c.position).addScaledVector(this.moveDir, 35);
          c.timer = 4.0;
        } else if (c.state === 'fleeing') {
          c.timer -= FAUNA_AI_TICK_SEC;
          if (c.timer <= 0) {
            c.state = 'idle';
            c.timer = 2.0;
          }
        } else if (c.state === 'idle') {
          c.timer -= FAUNA_AI_TICK_SEC;
          if (c.timer <= 0) {
            // Pick new wandering waypoint within 20m of base
            c.state = 'patrolling';
            const wanderAngle = Math.random() * Math.PI * 2;
            const wanderDist = 10 + Math.random() * 20;
            c.targetPos.set(
              c.base.x + Math.cos(wanderAngle) * wanderDist,
              c.position.y,
              c.base.z + Math.sin(wanderAngle) * wanderDist,
            );
            c.timer = 5.0;
          }
        } else if (c.state === 'patrolling') {
          c.timer -= FAUNA_AI_TICK_SEC;
          if (c.position.distanceTo(c.targetPos) < 2.5 || c.timer <= 0) {
            c.state = 'idle';
            c.timer = 2.0 + Math.random() * 3.0;
          }
        }
      } else {
        // Knocked recovery countdown
        c.timer -= FAUNA_AI_TICK_SEC;
        if (c.timer <= 0 && c.velocity.lengthSq() < 1.0) {
          c.state = 'fleeing';
          c.timer = 5.0;
        }
      }
    }
  }

  private updatePhysics(dt: number, surface: PlanetSurfaceGenerator): void {
    const originRadius = surface.radiusM;

    for (const c of this.creatures) {
      if (!c.active || c.state === 'defeated') continue;

      if (c.state === 'knocked') {
        // Free trajectory with gravity
        c.velocity.y -= 9.81 * dt;
        c.position.addScaledVector(c.velocity, dt);

        // Ground collision
        const hyp = Math.hypot(c.position.x, c.position.z);
        const radY = Math.sqrt(Math.max(1, originRadius * originRadius - hyp * hyp));
        this.dirVec.set(c.position.x, radY, c.position.z).normalize();
        const dir: Vec3 = [this.dirVec.x, this.dirVec.y, this.dirVec.z];
        const terrainH = surface.heightAt(dir);

        if (c.position.y <= terrainH) {
          c.position.y = terrainH;
          c.velocity.set(0, 0, 0);
        }
      } else if (c.state === 'patrolling' || c.state === 'fleeing') {
        // Steer towards target position
        this.moveDir.subVectors(c.targetPos, c.position);
        this.moveDir.y = 0;
        const dist = this.moveDir.length();

        if (dist > 0.5) {
          this.moveDir.normalize();
          const targetHeading = Math.atan2(this.moveDir.x, this.moveDir.z);
          c.headingRad = targetHeading;

          const currentSpeed = c.state === 'fleeing' ? c.speedMps * 2.0 : c.speedMps;
          c.position.addScaledVector(this.moveDir, currentSpeed * dt);
        }

        // Stick ground creatures to terrain height
        const hyp = Math.hypot(c.position.x, c.position.z);
        const radY = Math.sqrt(Math.max(1, originRadius * originRadius - hyp * hyp));
        this.dirVec.set(c.position.x, radY, c.position.z).normalize();
        const dir: Vec3 = [this.dirVec.x, this.dirVec.y, this.dirVec.z];
        const terrainH = surface.heightAt(dir);

        if (c.isAirborne) {
          c.position.y = terrainH + 18 + Math.sin(c.position.x * 0.05 + c.position.z * 0.05) * 4;
        } else {
          c.position.y = terrainH;
        }
      }
    }
  }

  private updateMeshes(biosphere: PlanetaryBiosphereProfile): void {
    const counts = new Map<DominantFaunaType, number>();
    for (const morph of this.meshes.keys()) {
      counts.set(morph, 0);
    }

    for (const c of this.creatures) {
      if (!c.active || c.state === 'defeated') continue;

      const mesh = this.meshes.get(c.morphology);
      if (!mesh) continue;

      const idx = counts.get(c.morphology) ?? 0;
      if (idx >= FAUNA_CAPACITY) continue;

      this.dummy.position.copy(c.position);

      // Orientation: yaw from heading, tilted if knocked
      this.quat.setFromAxisAngle(this.up, c.headingRad);
      if (c.state === 'knocked') {
        const tilt = new Quaternion().setFromAxisAngle(this.dirVec.set(1, 0, 0), Math.PI * 0.4);
        this.quat.multiply(tilt);
      }
      this.dummy.quaternion.copy(this.quat);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();

      mesh.setMatrixAt(idx, this.dummy.matrix);

      // Color coding by state / morph
      if (c.state === 'fleeing') {
        this.color.set('#c48256'); // startled orange-brown
      } else if (c.state === 'knocked') {
        this.color.set('#9c4545'); // damaged reddish
      } else {
        this.color.set('#5f755a'); // natural muted green-gray
      }
      mesh.setColorAt(idx, this.color);

      counts.set(c.morphology, idx + 1);
    }

    for (const [morph, mesh] of this.meshes.entries()) {
      const activeCount = counts.get(morph) ?? 0;
      mesh.count = activeCount;
      if (activeCount > 0) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }
      }
    }
  }

  /**
   * Applies damage and physical impulse to a creature when hit by Dr-Manaus powers.
   */
  hit(id: string, force: number, damage = 35): boolean {
    const creature = this.creatures.find(c => c.id === id);
    if (!creature || !creature.active || creature.state === 'defeated') {
      return false;
    }

    creature.health -= damage;
    if (creature.health <= 0) {
      creature.health = 0;
      creature.state = 'defeated';
      creature.active = false;
      this.defeatedIds.add(id);
      while (this.defeatedIds.size > MAX_FAUNA_HISTORY) {
        const first = this.defeatedIds.values().next().value;
        if (first) this.defeatedIds.delete(first);
      }
    } else {
      creature.state = 'knocked';
      creature.timer = 2.0;
      // Impel upward and away
      creature.velocity.set(
        (Math.random() - 0.5) * force * 0.15,
        Math.max(5.0, force * 0.12),
        (Math.random() - 0.5) * force * 0.15,
      );
    }
    return true;
  }

  /**
   * Restores defeated creatures in a radius (e.g. from reconstruction powers).
   */
  reconstruct(center: Vector3, radiusM: number): number {
    let restored = 0;
    const rSq = radiusM * radiusM;

    for (const c of this.creatures) {
      if (!c.active && c.state === 'defeated') {
        if (c.position.distanceToSquared(center) <= rSq) {
          c.active = true;
          c.state = 'idle';
          c.health = c.maxHealth;
          this.defeatedIds.delete(c.id);
          restored++;
        }
      }
    }
    return restored;
  }

  /**
   * Clears all creatures and resets meshes.
   */
  clear(): void {
    this.currentCell = '';
    for (const c of this.creatures) {
      c.active = false;
      c.state = 'idle';
    }
    for (const mesh of this.meshes.values()) {
      mesh.count = 0;
    }
  }

  /**
   * Cleans up GPU memory on teardown.
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
  }
}
