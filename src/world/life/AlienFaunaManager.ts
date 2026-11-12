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

export type EcologicalRole = 'herbivore' | 'carnivore' | 'scavenger' | 'apex';

export interface CreatureEntity extends Target {
  id: string;
  readonly index: number;
  morphology: DominantFaunaType;
  role: EcologicalRole;
  readonly base: Vector3;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly targetPos: Vector3;
  targetCreatureId: string | null;
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
 * Deterministic pseudo-random hash generator for fauna behavior.
 */
function hashFauna(seed: number, index: number, salt: number): number {
  let h = (seed ^ (index * 0x65d63f7b) ^ (salt * 0x517cc1b7)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x517cc1b7);
  h ^= h >>> 13;
  h = Math.imul(h, 0xa5a7c293);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
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
        role: 'herbivore',
        base: new Vector3(),
        position: new Vector3(),
        velocity: new Vector3(),
        targetPos: new Vector3(),
        targetCreatureId: null,
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
      this.updateAI(playerPos, biosphere.seeds.faunaSeed);
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

      // Assign morphology and ecological role based on planetary biosphere complexity
      let morph = dominantMorph;
      let role: EcologicalRole = 'herbivore';
      let speed = 4.5;
      let maxHealth = 120;
      let radius = 1.5;

      if (biosphere.lifeTier === 'civilized' || (biosphere.lifeTier === 'fauna' && biosphere.habitabilityScore > 0.6)) {
        if (i > 0 && i % 4 === 0) {
          morph = 'bipedal-predators';
          role = (i % 8 === 0) ? 'apex' : 'carnivore';
          speed = role === 'apex' ? 7.5 : 6.0;
          maxHealth = role === 'apex' ? 200 : 150;
          radius = role === 'apex' ? 2.0 : 1.6;
        } else if (dominantMorph === 'bipedal-predators') {
          morph = i % 2 === 0 ? 'chitinous-quadrupeds' : 'amphibious-crawlers';
          role = 'herbivore';
          speed = 4.5;
          maxHealth = 110;
        } else {
          morph = dominantMorph;
          role = 'herbivore';
          speed = dominantMorph === 'avian-gliders' ? 12.0 : 4.5;
          maxHealth = dominantMorph === 'avian-gliders' ? 60 : 120;
        }
      } else {
        morph = dominantMorph;
        role = dominantMorph === 'bipedal-predators' ? 'carnivore' : 'herbivore';
        speed = dominantMorph === 'avian-gliders' ? 12.0 : (dominantMorph === 'bipedal-predators' ? 6.0 : 4.5);
        maxHealth = dominantMorph === 'avian-gliders' ? 60 : 120;
      }

      const isAirborne = morph === 'avian-gliders';
      const altitude = isAirborne ? terrainHeight + 15 : terrainHeight;

      creature.id = instanceId;
      creature.morphology = morph;
      creature.role = role;
      creature.radius = radius;
      creature.targetCreatureId = null;
      creature.base.set(spawnX, terrainHeight, spawnZ);
      creature.position.set(spawnX, altitude, spawnZ);
      creature.targetPos.copy(creature.position);
      creature.velocity.set(0, 0, 0);
      creature.headingRad = angle + Math.PI;
      creature.active = true;
      creature.state = 'idle';
      creature.health = creature.maxHealth = maxHealth;
      creature.timer = 1.0 + (i % 3);
      creature.isAirborne = isAirborne;
      creature.speedMps = speed;
    }
  }

  private aiTickCount = 0;

  private updateAI(playerPos: Vector3, faunaSeed = 1337): void {
    this.aiTickCount++;
    const activeCreatures = this.creatures.filter(c => c.active && c.state !== 'defeated');

    for (const c of activeCreatures) {
      if (c.state === 'knocked') {
        c.timer -= FAUNA_AI_TICK_SEC;
        if (c.timer <= 0 && c.velocity.lengthSq() < 1.0) {
          c.state = 'fleeing';
          c.timer = 5.0;
        }
        continue;
      }

      const distToPlayer = c.position.distanceTo(playerPos);

      // 1. Reaction to Dr-Manaus
      if (distToPlayer < 22) {
        c.state = 'fleeing';
        this.moveDir.subVectors(c.position, playerPos).normalize();
        c.targetPos.copy(c.position).addScaledVector(this.moveDir, 35);
        c.timer = 4.0;
        this.alertNearbyHerd(c.position, 25);
        continue;
      }

      // 2. Predator / Carnivore AI
      if (c.role === 'carnivore' || c.role === 'apex') {
        if (c.state === 'aggressive' && c.targetCreatureId) {
          const prey = activeCreatures.find(other => other.id === c.targetCreatureId && other.active && other.state !== 'defeated');
          if (prey) {
            const distToPrey = c.position.distanceTo(prey.position);
            c.targetPos.copy(prey.position);
            c.timer -= FAUNA_AI_TICK_SEC;

            if (distToPrey < 2.8) {
              // Predator attack strike
              const biteDamage = c.role === 'apex' ? 65 : 40;
              prey.health -= biteDamage;
              prey.state = 'knocked';
              prey.timer = 1.5;
              prey.velocity.set(0, 4.0, 0);
              this.alertNearbyHerd(prey.position, 25);

              if (prey.health <= 0) {
                prey.health = 0;
                prey.state = 'defeated';
                prey.active = false;
                this.defeatedIds.add(prey.id);
              }
              // Meal finished: rest
              c.state = 'idle';
              c.timer = 5.0;
              c.targetCreatureId = null;
            } else if (c.timer <= 0 || distToPrey > 50) {
              // Lost track
              c.state = 'idle';
              c.timer = 3.0;
              c.targetCreatureId = null;
            }
          } else {
            c.state = 'idle';
            c.timer = 2.0;
            c.targetCreatureId = null;
          }
          continue;
        } else if (c.state === 'idle' || c.state === 'patrolling') {
          // Scan for nearest active herbivore within 35m
          let closestPrey: CreatureEntity | null = null;
          let closestDist = 35;
          for (const other of activeCreatures) {
            if (other.role === 'herbivore' && other.state !== 'knocked') {
              const d = c.position.distanceTo(other.position);
              if (d < closestDist) {
                closestDist = d;
                closestPrey = other;
              }
            }
          }

          if (closestPrey) {
            c.state = 'aggressive';
            c.targetCreatureId = closestPrey.id;
            c.targetPos.copy(closestPrey.position);
            c.timer = 6.0;
            continue;
          }
        }
      }

      // 3. Herbivore Herd / Flocking AI
      if (c.role === 'herbivore') {
        if (c.state === 'fleeing') {
          c.timer -= FAUNA_AI_TICK_SEC;
          if (c.timer <= 0) {
            c.state = 'idle';
            c.timer = 2.0;
          }
          continue;
        }

        // Check flock neighbors within 18m
        let flockCenterX = 0;
        let flockCenterZ = 0;
        let flockCount = 0;
        let separationX = 0;
        let separationZ = 0;

        for (const other of activeCreatures) {
          if (other.id !== c.id && other.role === 'herbivore' && other.morphology === c.morphology) {
            const dx = other.position.x - c.position.x;
            const dz = other.position.z - c.position.z;
            const d = Math.hypot(dx, dz);

            if (d < 18) {
              flockCenterX += other.position.x;
              flockCenterZ += other.position.z;
              flockCount++;

              if (d < 3.5 && d > 0.001) {
                separationX -= (dx / d) * (3.5 - d);
                separationZ -= (dz / d) * (3.5 - d);
              }
            }
          }
        }

        // Apply separation nudge
        if (separationX !== 0 || separationZ !== 0) {
          c.position.x += separationX * 0.15;
          c.position.z += separationZ * 0.15;
        }

        // Herd cohesion when patrolling
        if (flockCount > 0 && c.state === 'patrolling') {
          const avgX = flockCenterX / flockCount;
          const avgZ = flockCenterZ / flockCount;
          c.targetPos.x = c.targetPos.x * 0.7 + avgX * 0.3;
          c.targetPos.z = c.targetPos.z * 0.7 + avgZ * 0.3;
        }
      }

      // 4. Default wandering / state transitions
      if (c.state === 'fleeing') {
        c.timer -= FAUNA_AI_TICK_SEC;
        if (c.timer <= 0) {
          c.state = 'idle';
          c.timer = 2.0;
        }
      } else if (c.state === 'idle') {
        c.timer -= FAUNA_AI_TICK_SEC;
        if (c.timer <= 0) {
          c.state = 'patrolling';
          const h1 = hashFauna(faunaSeed, c.index, this.aiTickCount * 3 + 1);
          const h2 = hashFauna(faunaSeed, c.index, this.aiTickCount * 3 + 2);
          const wanderAngle = h1 * Math.PI * 2;
          const wanderDist = 10 + h2 * 20;
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
          const h3 = hashFauna(faunaSeed, c.index, this.aiTickCount * 3 + 3);
          c.timer = 2.0 + h3 * 3.0;
        }
      }
    }
  }

  private alertNearbyHerd(origin: Vector3, alertRadiusM: number): void {
    const rSq = alertRadiusM * alertRadiusM;
    for (const other of this.creatures) {
      if (!other.active || other.state === 'defeated' || other.state === 'knocked') continue;
      if (other.role === 'herbivore' && other.state !== 'fleeing') {
        if (other.position.distanceToSquared(origin) <= rSq) {
          other.state = 'fleeing';
          this.moveDir.subVectors(other.position, origin);
          this.moveDir.y = 0;
          if (this.moveDir.lengthSq() < 0.001) this.moveDir.set(1, 0, 0);
          else this.moveDir.normalize();
          other.targetPos.copy(other.position).addScaledVector(this.moveDir, 30);
          other.timer = 4.0;
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
      } else if (c.state === 'patrolling' || c.state === 'fleeing' || c.state === 'aggressive') {
        // Steer towards target position
        this.moveDir.subVectors(c.targetPos, c.position);
        this.moveDir.y = 0;
        const dist = this.moveDir.length();

        if (dist > 0.5) {
          this.moveDir.normalize();
          const targetHeading = Math.atan2(this.moveDir.x, this.moveDir.z);
          c.headingRad = targetHeading;

          const speedMultiplier = c.state === 'fleeing' ? 2.0 : (c.state === 'aggressive' ? 1.5 : 1.0);
          const currentSpeed = c.speedMps * speedMultiplier;
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

      // Color coding by state / role / morph
      if (c.state === 'knocked') {
        this.color.set('#9c4545'); // damaged reddish
      } else if (c.role === 'apex') {
        this.color.set(c.state === 'aggressive' ? '#bf3060' : '#4a2c5a');
      } else if (c.role === 'carnivore') {
        this.color.set(c.state === 'aggressive' ? '#d44030' : '#7d3a3a');
      } else if (c.state === 'fleeing') {
        this.color.set('#c48256'); // startled orange-brown
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
  hit(id: string, force: number, damage?: number): boolean {
    const creature = this.creatures.find(c => c.id === id);
    if (!creature || !creature.active || creature.state === 'defeated') {
      return false;
    }

    const effectiveDamage = damage ?? Math.max(35, force * 0.5);
    creature.health -= effectiveDamage;
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
    this.alertNearbyHerd(creature.position, 30);
    return true;
  }

  /**
   * Applies area damage and radial physical impulse to all creatures within radius.
   */
  damageInRadius(center: Vector3, radiusM: number, damage: number, impulse = 20): number {
    let affected = 0;
    const rSq = radiusM * radiusM;

    for (const c of this.creatures) {
      if (!c.active || c.state === 'defeated') continue;

      const distSq = c.position.distanceToSquared(center);
      if (distSq <= rSq) {
        c.health -= damage;
        affected++;

        const dist = Math.sqrt(distSq);
        const dirX = dist > 0.001 ? (c.position.x - center.x) / dist : (Math.random() - 0.5);
        const dirZ = dist > 0.001 ? (c.position.z - center.z) / dist : (Math.random() - 0.5);

        if (c.health <= 0) {
          c.health = 0;
          c.state = 'defeated';
          c.active = false;
          this.defeatedIds.add(c.id);
          while (this.defeatedIds.size > MAX_FAUNA_HISTORY) {
            const first = this.defeatedIds.values().next().value;
            if (first) this.defeatedIds.delete(first);
          }
        } else {
          c.state = 'knocked';
          c.timer = 2.0;
          c.velocity.set(
            dirX * impulse * 0.4,
            Math.max(4.0, impulse * 0.3),
            dirZ * impulse * 0.4,
          );
        }
      }
    }
    if (affected > 0) this.alertNearbyHerd(center, radiusM + 15);
    return affected;
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
