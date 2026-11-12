/**
 * CosmicAnomaliesAndRuinsManager.ts
 *
 * Procedural generation, multi-phase boss combat, and persistence of ancient cosmic ruins,
 * monolithic sanctuaries, and titanic colossi on unexplored worlds.
 * Pure WebGPU, 0 paid assets, deterministic seed derivation, and non-allocating game loop.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three/webgpu';
import type { Target } from '../../core/types';
import type { SaveManager } from '../../core/SaveManager';
import type { PlanetSurfaceGenerator } from '../planet/PlanetSurface';
import type { PlanetaryBiosphereProfile } from './PlanetaryBiosphere';
import type { Vec3 } from '../spatial/units';

export type AncientStructureType =
  | 'ancient-sanctuary'
  | 'hyper-relic'
  | 'guardian-spire';

export type ColossusState =
  | 'dormant'
  | 'patrolling'
  | 'engaging'
  | 'enraged'
  | 'defeated';

export interface ColossusBossTarget extends Target {
  readonly id: string;
  readonly type: 'ancient-automaton' | 'void-sentinel';
  readonly maxHealth: number;
  health: number;
  phase: 1 | 2;
  state: ColossusState;
  position: Vector3;
  anchor: Vector3;
  velocity: Vector3;
  headingRad: number;
  stepTimer: number;
  stompCooldown: number;
  shieldActive: boolean;
  scale: number;
}

export interface AncientRuinSite {
  readonly id: string;
  readonly type: AncientStructureType;
  readonly position: Vector3;
  readonly normal: Vector3;
  readonly radius: number;
  health: number;
  discovered: boolean;
  activeRelicCharged: boolean;
}

const RUIN_TICK_SEC = 0.125; // 8 Hz AI tick

export class CosmicAnomaliesAndRuinsManager {
  readonly root = new Group();

  private sanctuaryMesh!: InstancedMesh;
  private obeliskMesh!: InstancedMesh;
  private hyperRelicMesh!: InstancedMesh;
  private colossusTorsoMesh!: InstancedMesh;
  private colossusLimbsMesh!: InstancedMesh;

  private activeBodyId: string | null = null;
  private currentSurface: PlanetSurfaceGenerator | null = null;
  private currentBiosphere: PlanetaryBiosphereProfile | null = null;

  readonly ruins: AncientRuinSite[] = [];
  readonly colossi: ColossusBossTarget[] = [];
  private readonly targetList: Target[] = [];

  private tickTimer = 0;
  private dummyMatrix = new Matrix4();
  private dummyVec = new Vector3();
  private dummyDir: Vec3 = [0, 0, 0];
  private dummyNormal: Vec3 = [0, 1, 0];

  private readonly maxRuins = 16;
  private readonly maxColossi = 8;

  constructor(
    private readonly save: SaveManager,
    private readonly notify?: (msg: string) => void,
    private readonly playSound?: (name: string) => void,
  ) {
    this.initMeshes();
  }

  private initMeshes(): void {
    // 1. Ancient Sanctuary Base: Tiered stepped structure
    const sanctuaryGeo = new CylinderGeometry(14, 22, 6, 8);
    const stoneMat = new MeshStandardMaterial({
      color: '#475569',
      roughness: 0.85,
      metalness: 0.2,
      flatShading: true,
    });
    this.sanctuaryMesh = new InstancedMesh(sanctuaryGeo, stoneMat, this.maxRuins);
    this.sanctuaryMesh.count = 0;
    this.root.add(this.sanctuaryMesh);

    // 2. Monolith Obelisks
    const obeliskGeo = new CylinderGeometry(1.2, 2.5, 18, 4);
    const obeliskMat = new MeshStandardMaterial({
      color: '#334155',
      roughness: 0.5,
      metalness: 0.6,
      flatShading: true,
    });
    this.obeliskMesh = new InstancedMesh(obeliskGeo, obeliskMat, this.maxRuins * 4);
    this.obeliskMesh.count = 0;
    this.root.add(this.obeliskMesh);

    // 3. Levitating Hyper-Relic (Octahedron + Torus)
    const relicGeo = new OctahedronGeometry(3.5, 0);
    const relicMat = new MeshBasicNodeMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.85,
    });
    this.hyperRelicMesh = new InstancedMesh(relicGeo, relicMat, this.maxRuins);
    this.hyperRelicMesh.count = 0;
    this.root.add(this.hyperRelicMesh);

    // 4. Colossus Torso (Hexagonal Heavy Construct)
    const torsoGeo = new CylinderGeometry(3.2, 2.4, 7, 6);
    const colossusMat = new MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.4,
      metalness: 0.8,
      flatShading: true,
    });
    this.colossusTorsoMesh = new InstancedMesh(torsoGeo, colossusMat, this.maxColossi);
    this.colossusTorsoMesh.count = 0;
    this.root.add(this.colossusTorsoMesh);

    // 5. Colossus Limbs
    const limbGeo = new BoxGeometry(1.4, 8, 1.4);
    this.colossusLimbsMesh = new InstancedMesh(limbGeo, colossusMat, this.maxColossi * 4);
    this.colossusLimbsMesh.count = 0;
    this.root.add(this.colossusLimbsMesh);
  }

  get targets(): readonly Target[] {
    return this.targetList;
  }

  update(
    dt: number,
    playerPos: Vector3,
    surface?: PlanetSurfaceGenerator,
    biosphere?: PlanetaryBiosphereProfile,
  ): void {
    const bodyId = biosphere?.bodyId ?? null;
    if (bodyId !== this.activeBodyId) {
      this.rebuildSites(bodyId, surface, biosphere);
    }

    if (this.ruins.length === 0 && this.colossi.length === 0) {
      return;
    }

    this.tickTimer += dt;
    const shouldTick = this.tickTimer >= RUIN_TICK_SEC;
    if (shouldTick) {
      this.tickTimer = 0;
    }

    // 1. First Contact & Relic Discovery Check
    for (const ruin of this.ruins) {
      const dist = ruin.position.distanceTo(playerPos);
      if (dist < 38 && !ruin.discovered) {
        ruin.discovered = true;
        this.save.discoverRuin(ruin.id);
        this.save.modifyFactionReputation('guardians', 20);
        this.notify?.(`PRIMEIRO CONTATO · RUÍNAS ARCAICAS IDENTIFICADAS (${ruin.type.toUpperCase()})`);
        this.playSound?.('discovery');

        // Awaken nearby guardian colossus
        for (const colossus of this.colossi) {
          if (colossus.state === 'dormant' && colossus.position.distanceTo(ruin.position) < 80) {
            colossus.state = 'alerted' as ColossusState;
            this.notify?.('ALERTA: GUARDIÃO COLOSSAL DESPERTO!');
            this.playSound?.('hazard-alarm');
          }
        }
      }
    }

    // 2. Colossus Multi-phase Combat AI
    for (const colossus of this.colossi) {
      if (colossus.health <= 0) {
        colossus.state = 'defeated';
        colossus.active = false;
        continue;
      }

      const distToPlayer = colossus.position.distanceTo(playerPos);

      // Phase 2 Enrage check at <= 50% HP
      if (colossus.health <= colossus.maxHealth * 0.5 && colossus.phase === 1) {
        colossus.phase = 2;
        colossus.state = 'enraged';
        colossus.shieldActive = true;
        this.notify?.('SOBRECARGA COLOSSAL · MODO DE FURIA ATIVADO!');
        this.playSound?.('shock');
      }

      if (shouldTick) {
        if (distToPlayer < 75 && colossus.state !== 'defeated') {
          colossus.state = colossus.phase === 2 ? 'enraged' : 'engaging';
          // Move towards player
          const dirX = playerPos.x - colossus.position.x;
          const dirZ = playerPos.z - colossus.position.z;
          const len = Math.hypot(dirX, dirZ);
          if (len > 8) {
            colossus.headingRad = Math.atan2(dirX, dirZ);
            const speed = colossus.phase === 2 ? 10.5 : 6.0;
            colossus.velocity.set((dirX / len) * speed, 0, (dirZ / len) * speed);
          } else {
            colossus.velocity.set(0, 0, 0);
          }
        } else if (distToPlayer > 120 && colossus.state !== 'dormant') {
          colossus.state = 'patrolling';
          colossus.velocity.set(0, 0, 0);
        }
      }

      // Physics integration (60 FPS)
      colossus.position.addScaledVector(colossus.velocity, dt);

      // Align height to planetary surface
      if (this.currentSurface) {
        const pLen = colossus.position.length();
        if (pLen > 1) {
          this.dummyDir[0] = colossus.position.x / pLen;
          this.dummyDir[1] = colossus.position.y / pLen;
          this.dummyDir[2] = colossus.position.z / pLen;
          const h = this.currentSurface.heightAt(this.dummyDir);
          const targetRad = this.currentSurface.radiusM + h;
          colossus.position.set(
            this.dummyDir[0] * targetRad,
            this.dummyDir[1] * targetRad,
            this.dummyDir[2] * targetRad,
          );
        }
      }
    }

    // 3. Render Matrix Updates
    this.updateVisualMatrices(playerPos);
  }

  private rebuildSites(
    bodyId: string | null,
    surface?: PlanetSurfaceGenerator,
    biosphere?: PlanetaryBiosphereProfile,
  ): void {
    this.activeBodyId = bodyId;
    this.currentSurface = surface ?? null;
    this.currentBiosphere = biosphere ?? null;

    this.ruins.length = 0;
    this.colossi.length = 0;
    this.targetList.length = 0;

    if (!bodyId || !surface || !biosphere) {
      this.clearMeshes();
      return;
    }

    // Ruins spawn only on worlds with ancient ruins stage or civilized/fauna biospheres
    const hasRuins = biosphere.civilizationStage === 'ancient-ruins-guardians' ||
      biosphere.lifeTier === 'civilized' ||
      (biosphere.lifeTier === 'fauna' && biosphere.habitabilityScore > 0.55);

    if (!hasRuins) {
      this.clearMeshes();
      return;
    }

    const seed = biosphere.seeds?.factionSeed ?? 101;
    const siteCount = Math.min(this.maxRuins, 6);

    for (let i = 0; i < siteCount; i++) {
      const angle = (i * 2.3999) + (seed % 100);
      const lat = ((Math.sin(seed + i * 17) * 0.45));
      const lon = angle % (Math.PI * 2);

      const cosLat = Math.cos(lat);
      this.dummyDir[0] = Math.cos(lon) * cosLat;
      this.dummyDir[1] = Math.sin(lat);
      this.dummyDir[2] = Math.sin(lon) * cosLat;

      const height = surface.heightAt(this.dummyDir);
      const rad = surface.radiusM + height;
      const pos = new Vector3(
        this.dummyDir[0] * rad,
        this.dummyDir[1] * rad,
        this.dummyDir[2] * rad,
      );

      surface.normalEnu(this.dummyDir, this.dummyNormal);
      const normal = new Vector3(...this.dummyNormal).normalize();

      const ruinId = `ruin:${bodyId}:${i}`;
      const isDiscovered = this.save.isRuinDiscovered(ruinId);

      const type: AncientStructureType = i % 2 === 0 ? 'ancient-sanctuary' : 'hyper-relic';
      const site: AncientRuinSite = {
        id: ruinId,
        type,
        position: pos,
        normal,
        radius: 18,
        health: 500,
        discovered: isDiscovered,
        activeRelicCharged: false,
      };
      this.ruins.push(site);

      // Target for PowerSystem
      this.targetList.push({
        id: ruinId,
        kind: 'prop',
        position: pos,
        radius: 18,
        active: true,
      });

      // Spawn Guardian Colossus for Sanctuaries
      if (type === 'ancient-sanctuary' && this.colossi.length < this.maxColossi) {
        const colossusId = `colossus:${bodyId}:${i}`;
        const isDefeated = this.save.isColossusDefeated(colossusId);

        const colossusPos = pos.clone().add(new Vector3(25, 0, 25));
        const colossus: ColossusBossTarget = {
          id: colossusId,
          type: 'ancient-automaton',
          kind: 'creature',
          maxHealth: 1200,
          health: isDefeated ? 0 : 1200,
          phase: 1,
          state: isDefeated ? 'defeated' : 'patrolling',
          position: colossusPos,
          anchor: colossusPos.clone(),
          velocity: new Vector3(),
          headingRad: 0,
          stepTimer: 0,
          stompCooldown: 0,
          shieldActive: false,
          scale: 1.0,
          radius: 8,
          active: !isDefeated,
        };
        this.colossi.push(colossus);

        if (!isDefeated) {
          this.targetList.push(colossus);
        }
      }
    }
  }

  private updateVisualMatrices(playerPos: Vector3): void {
    let sanctuaryCount = 0;
    let obeliskCount = 0;
    let relicCount = 0;

    for (const ruin of this.ruins) {
      if (ruin.position.distanceToSquared(playerPos) > 4000 * 4000) {
        continue;
      }

      if (ruin.type === 'ancient-sanctuary') {
        this.dummyMatrix.makeTranslation(ruin.position.x, ruin.position.y, ruin.position.z);
        this.sanctuaryMesh.setMatrixAt(sanctuaryCount++, this.dummyMatrix);

        // 4 Obelisks
        for (let o = 0; o < 4; o++) {
          const ox = ruin.position.x + Math.cos((o * Math.PI) / 2) * 16;
          const oz = ruin.position.z + Math.sin((o * Math.PI) / 2) * 16;
          this.dummyMatrix.makeTranslation(ox, ruin.position.y + 6, oz);
          this.obeliskMesh.setMatrixAt(obeliskCount++, this.dummyMatrix);
        }
      } else {
        // Hyper relic floating
        this.dummyMatrix.makeTranslation(ruin.position.x, ruin.position.y + 8, ruin.position.z);
        this.hyperRelicMesh.setMatrixAt(relicCount++, this.dummyMatrix);
      }
    }

    this.sanctuaryMesh.count = sanctuaryCount;
    this.obeliskMesh.count = obeliskCount;
    this.hyperRelicMesh.count = relicCount;

    this.sanctuaryMesh.instanceMatrix.needsUpdate = true;
    this.obeliskMesh.instanceMatrix.needsUpdate = true;
    this.hyperRelicMesh.instanceMatrix.needsUpdate = true;

    // Colossi meshes
    let colossusCount = 0;
    let limbCount = 0;

    for (const colossus of this.colossi) {
      if (colossus.health <= 0 || colossus.position.distanceToSquared(playerPos) > 3000 * 3000) {
        continue;
      }

      this.dummyMatrix.makeTranslation(
        colossus.position.x,
        colossus.position.y + 11,
        colossus.position.z,
      );
      this.colossusTorsoMesh.setMatrixAt(colossusCount++, this.dummyMatrix);

      // Limbs: 2 legs, 2 arms
      for (let l = 0; l < 4; l++) {
        const lx = colossus.position.x + (l % 2 === 0 ? -2.5 : 2.5);
        const ly = colossus.position.y + (l < 2 ? 4 : 10);
        const lz = colossus.position.z;
        this.dummyMatrix.makeTranslation(lx, ly, lz);
        this.colossusLimbsMesh.setMatrixAt(limbCount++, this.dummyMatrix);
      }
    }

    this.colossusTorsoMesh.count = colossusCount;
    this.colossusLimbsMesh.count = limbCount;

    this.colossusTorsoMesh.instanceMatrix.needsUpdate = true;
    this.colossusLimbsMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Combat Hit Hook for PowerSystem.
   */
  hit(targetId: string, force: number): boolean {
    const colossus = this.colossi.find(c => c.id === targetId);
    if (colossus && colossus.health > 0) {
      const effectiveDamage = colossus.shieldActive ? force * 0.5 : force;
      colossus.health = Math.max(0, colossus.health - effectiveDamage);

      if (colossus.health <= 0) {
        colossus.state = 'defeated';
        colossus.active = false;
        this.save.recordColossusDefeat(colossus.id);
        this.save.modifyFactionReputation('guardians', 35);
        this.notify?.('COLOSSO DERROTADO · NÚCLEO ARCAICO RECOLHIDO');
        this.playSound?.('discovery');
      }
      return true;
    }

    const ruin = this.ruins.find(r => r.id === targetId);
    if (ruin) {
      ruin.health = Math.max(0, ruin.health - force);
      return true;
    }

    return false;
  }

  damageInRadius(center: Vector3, radius: number, damage: number): number {
    let affected = 0;
    for (const colossus of this.colossi) {
      if (colossus.health > 0 && colossus.position.distanceTo(center) <= radius + colossus.radius) {
        this.hit(colossus.id, damage);
        affected++;
      }
    }
    return affected;
  }

  /**
   * Reconstruct power restores ruined structures and revives fallen relics.
   */
  reconstruct(position: Vector3, radius: number): number {
    let restored = 0;
    for (const ruin of this.ruins) {
      if (ruin.position.distanceTo(position) <= radius + ruin.radius) {
        if (ruin.health < 500) {
          ruin.health = 500;
          restored++;
        }
      }
    }
    if (restored > 0) {
      this.save.modifyFactionReputation('guardians', 15);
      this.notify?.(`RUÍNAS RESTAURADAS (+15 REPUTAÇÃO)`);
    }
    return restored;
  }

  private clearMeshes(): void {
    this.sanctuaryMesh.count = 0;
    this.obeliskMesh.count = 0;
    this.hyperRelicMesh.count = 0;
    this.colossusTorsoMesh.count = 0;
    this.colossusLimbsMesh.count = 0;

    this.sanctuaryMesh.instanceMatrix.needsUpdate = true;
    this.obeliskMesh.instanceMatrix.needsUpdate = true;
    this.hyperRelicMesh.instanceMatrix.needsUpdate = true;
    this.colossusTorsoMesh.instanceMatrix.needsUpdate = true;
    this.colossusLimbsMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.sanctuaryMesh.geometry.dispose();
    this.obeliskMesh.geometry.dispose();
    this.hyperRelicMesh.geometry.dispose();
    this.colossusTorsoMesh.geometry.dispose();
    this.colossusLimbsMesh.geometry.dispose();
    this.root.removeFromParent();
  }
}

