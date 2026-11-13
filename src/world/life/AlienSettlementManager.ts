/**
 * AlienSettlementManager.ts
 *
 * Deterministic, low-draw-call modular alien settlements and faction inhabitants.
 * Simulates alien outposts, habitat domes, energy spires, ancient ruins, and
 * inhabitants with faction reputation, combat reaction, and full reconstruction support.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  ConeGeometry,
  TorusGeometry,
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
import type { PlanetaryBiosphereProfile } from './PlanetaryBiosphere';
import type { PlanetSurfaceGenerator } from '../planet/PlanetSurface';
import type { Vec3 } from '../spatial/units';
import type { SaveManager } from '../../core/SaveManager';

export const SETTLEMENT_STRUCTURE_CAPACITY = 64;
export const INHABITANT_CAPACITY = 48;
export const SETTLEMENT_TICK_SEC = 0.2; // 5 Hz AI update

export type StructureArchetype =
  | 'habitat-dome'
  | 'comm-tower'
  | 'energy-pylon'
  | 'perimeter-wall'
  | 'ancient-monolith';

export type InhabitantRole = 'worker' | 'guard' | 'elder' | 'sentinel';
export type InhabitantState = 'idle' | 'patrolling' | 'saluting' | 'defending' | 'fleeing' | 'knocked';

export interface SettlementStructureEntity extends Target {
  id: string;
  archetype: StructureArchetype;
  factionId: string;
  readonly position: Vector3;
  headingRad: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
}

export interface AlienInhabitantEntity extends Target {
  id: string;
  settlementId: string;
  factionId: string;
  role: InhabitantRole;
  readonly base: Vector3;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly targetPos: Vector3;
  headingRad: number;
  state: InhabitantState;
  health: number;
  maxHealth: number;
  timer: number;
}

export interface AlienSettlementCluster {
  id: string;
  factionId: string;
  factionName: string;
  disposition: 'friendly' | 'neutral' | 'hostile' | 'guardians';
  center: Vector3;
  radiusM: number;
  structureCount: number;
  inhabitantCount: number;
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

function hashSettlement(seed: number, index: number, salt: number): number {
  let h = (seed ^ (index * 0x65d63f7b) ^ (salt * 0x517cc1b7)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x517cc1b7);
  h ^= h >>> 13;
  h = Math.imul(h, 0xa5a7c293);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function createStructureGeometry(archetype: StructureArchetype): BufferGeometry {
  switch (archetype) {
    case 'habitat-dome': {
      // Hemispherical dome + cylindrical base + airlock tunnel
      const dome = new SphereGeometry(5.0, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
      dome.translate(0, 1.0, 0);
      const airlock = new BoxGeometry(2.4, 2.2, 3.5);
      airlock.translate(0, 1.1, 4.5);
      return safeMerge([dome, airlock]);
    }

    case 'comm-tower': {
      // Slender tower + dish + antenna spire
      const pylon = new CylinderGeometry(0.6, 1.2, 16.0, 6);
      pylon.translate(0, 8.0, 0);
      const dish = new TorusGeometry(2.5, 0.35, 6, 12);
      dish.rotateX(Math.PI * 0.35);
      dish.translate(0, 14.5, 0.5);
      const spire = new ConeGeometry(0.25, 4.0, 5);
      spire.translate(0, 17.5, 0);
      return safeMerge([pylon, dish, spire]);
    }

    case 'energy-pylon': {
      // Hexagonal energy collector with levitating ring
      const base = new CylinderGeometry(1.4, 1.8, 7.0, 6);
      base.translate(0, 3.5, 0);
      const collector = new TorusGeometry(2.2, 0.3, 6, 16);
      collector.rotateX(Math.PI / 2);
      collector.translate(0, 8.0, 0);
      return safeMerge([base, collector]);
    }

    case 'perimeter-wall': {
      // Modular defense barricade
      const wall = new BoxGeometry(8.0, 3.2, 1.5);
      wall.translate(0, 1.6, 0);
      return wall;
    }

    case 'ancient-monolith': {
      // Stepped ancient obelisk
      const base = new BoxGeometry(4.0, 1.5, 4.0);
      base.translate(0, 0.75, 0);
      const obelisk = new CylinderGeometry(0.8, 1.6, 18.0, 4);
      obelisk.rotateY(Math.PI / 4);
      obelisk.translate(0, 9.5, 0);
      return safeMerge([base, obelisk]);
    }
  }
}

function createInhabitantGeometry(): BufferGeometry {
  // Low-poly humanoid / sentinel frame (torso + head + arms)
  const torso = new CylinderGeometry(0.35, 0.25, 1.2, 5);
  torso.translate(0, 1.1, 0);
  const head = new SphereGeometry(0.3, 6, 5);
  head.translate(0, 1.9, 0);
  const limbs = new BoxGeometry(1.2, 0.15, 0.2);
  limbs.translate(0, 1.4, 0);
  return safeMerge([torso, head, limbs]);
}

export class AlienSettlementManager {
  readonly root = new Group();
  readonly structures: SettlementStructureEntity[] = [];
  readonly inhabitants: AlienInhabitantEntity[] = [];
  readonly activeSettlements: AlienSettlementCluster[] = [];

  private readonly structureMeshes = new Map<StructureArchetype, InstancedMesh>();
  private readonly inhabitantMesh: InstancedMesh;

  private currentCell = '';
  private tickAccumulator = 0;

  // Scratch objects
  private readonly dummy = new Object3D();
  private readonly quat = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly dirVec = new Vector3();
  private readonly moveDir = new Vector3();
  private readonly color = new Color();

  constructor(private readonly save?: SaveManager) {
    this.root.name = 'alien-settlement-manager';

    const archetypes: StructureArchetype[] = [
      'habitat-dome',
      'comm-tower',
      'energy-pylon',
      'perimeter-wall',
      'ancient-monolith',
    ];

    for (const arch of archetypes) {
      const geo = createStructureGeometry(arch);
      const mat = new MeshStandardMaterial({
        color: arch === 'ancient-monolith' ? '#5c6370' : '#8fa1b3',
        roughness: 0.6,
        metalness: arch === 'energy-pylon' || arch === 'comm-tower' ? 0.65 : 0.2,
      });

      const mesh = new InstancedMesh(geo, mat, SETTLEMENT_STRUCTURE_CAPACITY);
      mesh.name = `settlement-${arch}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.structureMeshes.set(arch, mesh);
      this.root.add(mesh);
    }

    const inhabGeo = createInhabitantGeometry();
    const inhabMat = new MeshStandardMaterial({
      color: '#4db8ff',
      roughness: 0.5,
      metalness: 0.3,
    });
    this.inhabitantMesh = new InstancedMesh(inhabGeo, inhabMat, INHABITANT_CAPACITY);
    this.inhabitantMesh.name = 'settlement-inhabitants';
    this.inhabitantMesh.count = 0;
    this.inhabitantMesh.frustumCulled = false;
    this.inhabitantMesh.castShadow = true;
    this.root.add(this.inhabitantMesh);

    // Pre-allocate pools
    for (let i = 0; i < SETTLEMENT_STRUCTURE_CAPACITY; i++) {
      this.structures.push({
        id: '',
        kind: 'prop',
        archetype: 'habitat-dome',
        factionId: '',
        position: new Vector3(),
        headingRad: 0,
        radius: 4.0,
        active: false,
        health: 2000,
        maxHealth: 2000,
        destroyed: false,
      });
    }

    for (let i = 0; i < INHABITANT_CAPACITY; i++) {
      this.inhabitants.push({
        id: '',
        kind: 'creature',
        settlementId: '',
        factionId: '',
        role: 'worker',
        base: new Vector3(),
        position: new Vector3(),
        velocity: new Vector3(),
        targetPos: new Vector3(),
        headingRad: 0,
        radius: 1.0,
        active: false,
        state: 'idle',
        health: 150,
        maxHealth: 150,
        timer: 0,
      });
    }
  }

  /**
   * Targets exposed to PowerSystem targeting and auto-aim.
   */
  get targets(): Target[] {
    const list: Target[] = [];
    for (const s of this.structures) {
      if (s.active && !s.destroyed) list.push(s);
    }
    for (const inb of this.inhabitants) {
      if (inb.active && inb.health > 0) list.push(inb);
    }
    return list;
  }

  update(
    dt: number,
    playerPos: Vector3,
    surface?: PlanetSurfaceGenerator,
    biosphere?: PlanetaryBiosphereProfile,
  ): void {
    if (
      !surface ||
      !biosphere ||
      (biosphere.lifeTier !== 'civilized' && biosphere.civilizationStage === 'none')
    ) {
      this.clear();
      return;
    }

    this.seedSettlements(playerPos, surface, biosphere);

    this.tickAccumulator += dt;
    if (this.tickAccumulator >= SETTLEMENT_TICK_SEC) {
      this.tickAccumulator = 0;
      this.updateAI(playerPos);
    }

    this.updatePhysics(dt, surface);
    this.updateMeshes();
  }

  private seedSettlements(
    playerPos: Vector3,
    surface: PlanetSurfaceGenerator,
    biosphere: PlanetaryBiosphereProfile,
  ): void {
    const cx = Math.floor(playerPos.x / 240);
    const cz = Math.floor(playerPos.z / 240);
    const cellKey = `${biosphere.bodyId}:${cx},${cz}`;
    if (cellKey === this.currentCell) return;
    this.currentCell = cellKey;

    this.activeSettlements.length = 0;
    const originRadius = surface.radiusM;
    const factionSeed = biosphere.seeds.factionSeed;

    const spawnChance = hashSettlement(factionSeed, cx, cz);
    // 40% of populated world cells feature a modular settlement outpost
    if (spawnChance > 0.40) {
      this.clear();
      return;
    }

    const factionIndex = Math.floor(hashSettlement(factionSeed, cx, cz + 1) * 3);
    const factionId = `${biosphere.bodyId}:faction_${factionIndex}`;
    const factionName = biosphere.civilizationStage === 'ancient-ruins-guardians'
      ? 'Guardiões dos Monólitos Ancestrais'
      : (factionIndex === 0 ? 'Colônia Pioneira de Theron' : (factionIndex === 1 ? 'Confederação Orbital' : 'Clã da Aliança Sideral'));

    const rep = this.save?.getFactionReputation(factionId) ?? 0;
    const disposition = biosphere.civilizationStage === 'ancient-ruins-guardians'
      ? 'guardians'
      : (rep >= 15 ? 'friendly' : (rep <= -15 ? 'hostile' : 'neutral'));

    const settlementCenterX = cx * 240 + 120;
    const settlementCenterZ = cz * 240 + 120;

    const hyp = Math.hypot(settlementCenterX, settlementCenterZ);
    const radY = Math.sqrt(Math.max(1, originRadius * originRadius - hyp * hyp));
    this.dirVec.set(settlementCenterX, radY, settlementCenterZ).normalize();
    const dir: Vec3 = [this.dirVec.x, this.dirVec.y, this.dirVec.z];
    const groundY = surface.heightAt(dir);

    const settlementCenter = new Vector3(settlementCenterX, groundY, settlementCenterZ);

    let structIdx = 0;
    let inhabIdx = 0;

    // 1. Central Structure: Habitat Dome or Ancient Monolith
    const isRuins = biosphere.civilizationStage === 'ancient-ruins-guardians';
    const mainArch: StructureArchetype = isRuins ? 'ancient-monolith' : 'habitat-dome';

    const main = this.structures[structIdx++];
    main.id = `${cellKey}:struct_center`;
    main.archetype = mainArch;
    main.factionId = factionId;
    main.position.copy(settlementCenter);
    main.headingRad = 0;
    main.radius = isRuins ? 3.5 : 6.0;
    main.active = true;
    main.health = main.maxHealth = isRuins ? 8000 : 3500;
    main.destroyed = false;

    // 2. Auxiliary Structures: Comm Tower and Energy Pylons
    const auxOffsets: { arch: StructureArchetype; dx: number; dz: number }[] = [
      { arch: 'comm-tower', dx: 18, dz: -12 },
      { arch: 'energy-pylon', dx: -16, dz: 14 },
      { arch: 'energy-pylon', dx: 15, dz: 16 },
      { arch: 'perimeter-wall', dx: 0, dz: 24 },
      { arch: 'perimeter-wall', dx: -22, dz: 0 },
    ];

    for (const aux of auxOffsets) {
      if (structIdx >= SETTLEMENT_STRUCTURE_CAPACITY) break;
      const s = this.structures[structIdx++];
      s.id = `${cellKey}:struct_${structIdx}`;
      s.archetype = aux.arch;
      s.factionId = factionId;
      s.position.set(settlementCenterX + aux.dx, groundY, settlementCenterZ + aux.dz);
      s.headingRad = Math.atan2(aux.dx, aux.dz);
      s.radius = aux.arch === 'comm-tower' ? 3.0 : 2.5;
      s.active = true;
      s.health = s.maxHealth = 1500;
      s.destroyed = false;
    }

    // 3. Inhabitants / Sentinels
    const inhabCount = isRuins ? 4 : 8;
    for (let i = 0; i < inhabCount; i++) {
      if (inhabIdx >= INHABITANT_CAPACITY) break;
      const inhab = this.inhabitants[inhabIdx++];
      const inAngle = (i / inhabCount) * Math.PI * 2;
      const inDist = 6.0 + (i % 3) * 4.0;
      const posX = settlementCenterX + Math.cos(inAngle) * inDist;
      const posZ = settlementCenterZ + Math.sin(inAngle) * inDist;

      inhab.id = `${cellKey}:inhab_${i}`;
      inhab.settlementId = cellKey;
      inhab.factionId = factionId;
      inhab.role = isRuins ? 'sentinel' : (i === 0 ? 'elder' : (i < 3 ? 'guard' : 'worker'));
      inhab.base.set(posX, groundY, posZ);
      inhab.position.copy(inhab.base);
      inhab.targetPos.copy(inhab.base);
      inhab.velocity.set(0, 0, 0);
      inhab.headingRad = inAngle + Math.PI;
      inhab.active = true;
      inhab.state = 'idle';
      inhab.health = inhab.maxHealth = inhab.role === 'sentinel' ? 450 : (inhab.role === 'guard' ? 220 : 120);
      inhab.timer = 1.0 + i;
    }

    // Deactivate unused pre-allocated entities
    for (let i = structIdx; i < SETTLEMENT_STRUCTURE_CAPACITY; i++) {
      this.structures[i].active = false;
    }
    for (let i = inhabIdx; i < INHABITANT_CAPACITY; i++) {
      this.inhabitants[i].active = false;
    }

    this.activeSettlements.push({
      id: cellKey,
      factionId,
      factionName,
      disposition,
      center: settlementCenter,
      radiusM: 45,
      structureCount: structIdx,
      inhabitantCount: inhabIdx,
    });
  }

  private updateAI(playerPos: Vector3): void {
    for (const inb of this.inhabitants) {
      if (!inb.active || inb.health <= 0) continue;

      const distToPlayer = inb.position.distanceTo(playerPos);
      const rep = this.save?.getFactionReputation(inb.factionId) ?? 0;
      const isHostile = inb.role === 'sentinel' || rep <= -15;
      const isFriendly = rep >= 15;

      if (inb.state !== 'knocked') {
        if (distToPlayer < 24) {
          if (isHostile) {
            inb.state = 'defending';
            this.moveDir.subVectors(playerPos, inb.position).normalize();
            inb.headingRad = Math.atan2(this.moveDir.x, this.moveDir.z);
            inb.timer = 5.0;
          } else if (isFriendly) {
            inb.state = 'saluting';
            this.moveDir.subVectors(playerPos, inb.position).normalize();
            inb.headingRad = Math.atan2(this.moveDir.x, this.moveDir.z);
            inb.timer = 3.0;
          } else {
            // Neutral observation
            inb.state = 'idle';
            this.moveDir.subVectors(playerPos, inb.position).normalize();
            inb.headingRad = Math.atan2(this.moveDir.x, this.moveDir.z);
            inb.timer = 2.0;
          }
        } else if (inb.state === 'saluting' || inb.state === 'defending') {
          inb.timer -= SETTLEMENT_TICK_SEC;
          if (inb.timer <= 0) {
            inb.state = 'idle';
            inb.timer = 2.0;
          }
        } else if (inb.state === 'idle') {
          inb.timer -= SETTLEMENT_TICK_SEC;
          if (inb.timer <= 0) {
            inb.state = 'patrolling';
            const wanderAngle = Math.random() * Math.PI * 2;
            const wanderDist = 4.0 + Math.random() * 8.0;
            inb.targetPos.set(
              inb.base.x + Math.cos(wanderAngle) * wanderDist,
              inb.base.y,
              inb.base.z + Math.sin(wanderAngle) * wanderDist,
            );
            inb.timer = 6.0;
          }
        } else if (inb.state === 'patrolling') {
          inb.timer -= SETTLEMENT_TICK_SEC;
          if (inb.position.distanceTo(inb.targetPos) < 1.0 || inb.timer <= 0) {
            inb.state = 'idle';
            inb.timer = 3.0;
          }
        }
      } else {
        inb.timer -= SETTLEMENT_TICK_SEC;
        if (inb.timer <= 0 && inb.velocity.lengthSq() < 1.0) {
          inb.state = isHostile ? 'defending' : 'fleeing';
          inb.timer = 4.0;
        }
      }
    }
  }

  private updatePhysics(dt: number, surface: PlanetSurfaceGenerator): void {
    const originRadius = surface.radiusM;

    for (const inb of this.inhabitants) {
      if (!inb.active || inb.health <= 0) continue;

      if (inb.state === 'knocked') {
        inb.velocity.y -= 9.81 * dt;
        inb.position.addScaledVector(inb.velocity, dt);

        const hyp = Math.hypot(inb.position.x, inb.position.z);
        const radY = Math.sqrt(Math.max(1, originRadius * originRadius - hyp * hyp));
        this.dirVec.set(inb.position.x, radY, inb.position.z).normalize();
        const dir: Vec3 = [this.dirVec.x, this.dirVec.y, this.dirVec.z];
        const terrainH = surface.heightAt(dir);

        if (inb.position.y <= terrainH) {
          inb.position.y = terrainH;
          inb.velocity.set(0, 0, 0);
        }
      } else if (inb.state === 'patrolling' || inb.state === 'fleeing') {
        this.moveDir.subVectors(inb.targetPos, inb.position);
        this.moveDir.y = 0;
        const dist = this.moveDir.length();

        if (dist > 0.4) {
          this.moveDir.normalize();
          inb.headingRad = Math.atan2(this.moveDir.x, this.moveDir.z);
          const speed = inb.state === 'fleeing' ? 5.5 : 2.5;
          inb.position.addScaledVector(this.moveDir, speed * dt);
        }

        const hyp = Math.hypot(inb.position.x, inb.position.z);
        const radY = Math.sqrt(Math.max(1, originRadius * originRadius - hyp * hyp));
        this.dirVec.set(inb.position.x, radY, inb.position.z).normalize();
        const dir: Vec3 = [this.dirVec.x, this.dirVec.y, this.dirVec.z];
        inb.position.y = surface.heightAt(dir);
      }
    }
  }

  private updateMeshes(): void {
    const structCounts = new Map<StructureArchetype, number>();
    for (const arch of this.structureMeshes.keys()) {
      structCounts.set(arch, 0);
    }

    for (const s of this.structures) {
      if (!s.active || s.destroyed) continue;
      const mesh = this.structureMeshes.get(s.archetype);
      if (!mesh) continue;

      const idx = structCounts.get(s.archetype) ?? 0;
      if (idx >= SETTLEMENT_STRUCTURE_CAPACITY) continue;

      this.dummy.position.copy(s.position);
      this.quat.setFromAxisAngle(this.up, s.headingRad);
      this.dummy.quaternion.copy(this.quat);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();

      mesh.setMatrixAt(idx, this.dummy.matrix);
      structCounts.set(s.archetype, idx + 1);
    }

    for (const [arch, mesh] of this.structureMeshes.entries()) {
      const activeCount = structCounts.get(arch) ?? 0;
      mesh.count = activeCount;
      if (activeCount > 0) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

    // Update inhabitants
    let activeInhab = 0;
    for (const inb of this.inhabitants) {
      if (!inb.active || inb.health <= 0) continue;
      if (activeInhab >= INHABITANT_CAPACITY) break;

      this.dummy.position.copy(inb.position);
      this.quat.setFromAxisAngle(this.up, inb.headingRad);
      this.dummy.quaternion.copy(this.quat);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();

      this.inhabitantMesh.setMatrixAt(activeInhab, this.dummy.matrix);

      // Color coding by state / faction
      if (inb.role === 'sentinel') {
        this.color.set(inb.state === 'defending' ? '#ff3344' : '#7755aa');
      } else if (inb.state === 'saluting') {
        this.color.set('#55ff99');
      } else if (inb.state === 'defending') {
        this.color.set('#ff8833');
      } else if (inb.state === 'fleeing') {
        this.color.set('#ffcc44');
      } else {
        this.color.set('#4db8ff');
      }
      this.inhabitantMesh.setColorAt(activeInhab, this.color);

      activeInhab++;
    }

    this.inhabitantMesh.count = activeInhab;
    if (activeInhab > 0) {
      this.inhabitantMesh.instanceMatrix.needsUpdate = true;
      if (this.inhabitantMesh.instanceColor) {
        this.inhabitantMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /**
   * Applies damage to target settlement structure or inhabitant.
   */
  hit(id: string, force: number, damage?: number): boolean {
    const effectiveDamage = damage ?? Math.max(50, force * 0.8);

    // 1. Structure hit
    const struct = this.structures.find(s => s.id === id && s.active && !s.destroyed);
    if (struct) {
      struct.health -= effectiveDamage;
      this.save?.modifyFactionReputation(struct.factionId, -10);
      if (struct.health <= 0) {
        struct.health = 0;
        struct.destroyed = true;
      }
      this.mobilizeGuards(struct.position, 40);
      return true;
    }

    // 2. Inhabitant hit
    const inb = this.inhabitants.find(i => i.id === id && i.active && i.health > 0);
    if (inb) {
      inb.health -= effectiveDamage;
      this.save?.modifyFactionReputation(inb.factionId, -15);
      if (inb.health <= 0) {
        inb.health = 0;
        inb.active = false;
      } else {
        inb.state = 'knocked';
        inb.timer = 2.0;
        inb.velocity.set(
          (Math.random() - 0.5) * force * 0.1,
          Math.max(4.0, force * 0.1),
          (Math.random() - 0.5) * force * 0.1,
        );
      }
      this.mobilizeGuards(inb.position, 40);
      return true;
    }

    return false;
  }

  damageInRadius(center: Vector3, radiusM: number, damage: number): number {
    let affected = 0;
    const rSq = radiusM * radiusM;

    for (const s of this.structures) {
      if (!s.active || s.destroyed) continue;
      if (s.position.distanceToSquared(center) <= rSq) {
        s.health -= damage;
        this.save?.modifyFactionReputation(s.factionId, -5);
        if (s.health <= 0) {
          s.health = 0;
          s.destroyed = true;
        }
        affected++;
      }
    }

    for (const inb of this.inhabitants) {
      if (!inb.active || inb.health <= 0) continue;
      if (inb.position.distanceToSquared(center) <= rSq) {
        inb.health -= damage;
        this.save?.modifyFactionReputation(inb.factionId, -10);
        if (inb.health <= 0) {
          inb.health = 0;
          inb.active = false;
        } else {
          inb.state = 'knocked';
          inb.timer = 2.0;
          inb.velocity.set(0, 5.0, 0);
        }
        affected++;
      }
    }

    if (affected > 0) {
      this.mobilizeGuards(center, radiusM + 25);
    }
    return affected;
  }

  reconstruct(center: Vector3, radiusM: number): number {
    let restored = 0;
    const rSq = radiusM * radiusM;

    for (const s of this.structures) {
      if (s.active && s.destroyed && s.position.distanceToSquared(center) <= rSq) {
        s.destroyed = false;
        s.health = s.maxHealth;
        this.save?.modifyFactionReputation(s.factionId, 15);
        restored++;
      }
    }

    for (const inb of this.inhabitants) {
      if (inb.health <= 0 && inb.position.distanceToSquared(center) <= rSq) {
        inb.active = true;
        inb.health = inb.maxHealth;
        inb.state = 'saluting';
        inb.timer = 5.0;
        this.save?.modifyFactionReputation(inb.factionId, 20);
        restored++;
      }
    }

    return restored;
  }

  private mobilizeGuards(threatPos: Vector3, radiusM: number): void {
    const rSq = radiusM * radiusM;
    for (const inb of this.inhabitants) {
      if (!inb.active || inb.health <= 0 || inb.state === 'knocked') continue;
      if (inb.position.distanceToSquared(threatPos) <= rSq) {
        if (inb.role === 'guard' || inb.role === 'sentinel') {
          inb.state = 'defending';
          inb.timer = 8.0;
        } else {
          inb.state = 'fleeing';
          inb.timer = 5.0;
        }
      }
    }
  }

  clear(): void {
    this.currentCell = '';
    this.activeSettlements.length = 0;
    for (const s of this.structures) s.active = false;
    for (const inb of this.inhabitants) inb.active = false;
    for (const mesh of this.structureMeshes.values()) mesh.count = 0;
    this.inhabitantMesh.count = 0;
  }

  dispose(): void {
    this.clear();
    for (const mesh of this.structureMeshes.values()) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.removeFromParent();
    }
    this.structureMeshes.clear();
    this.inhabitantMesh.geometry.dispose();
    (this.inhabitantMesh.material as MeshStandardMaterial).dispose();
    this.inhabitantMesh.removeFromParent();
    this.root.removeFromParent();
  }
}
