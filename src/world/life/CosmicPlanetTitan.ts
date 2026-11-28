/**
 * CosmicPlanetTitan.ts
 *
 * Planet-sized cosmic titans and astral leviathans (50 km to 500+ km radius).
 * Majestic, living celestial beings drifting through star systems and deep space.
 * Fully interactive: targetable by Dr-Manaus powers, combat damage, cosmic roar audio,
 * procedural spine IK wave solver, multi-weakpoint shield progression, real plasma projectile barrages,
 * and high-performance WebGPU rendering with zero external texture assets.
 */

import {
  BufferGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Target } from '../../core/types';
import type { SaveManager } from '../../core/SaveManager';
import type { RenderSpaceService } from '../spatial/RenderSpaceService';

export interface PlanetTitanState extends Target {
  readonly id: string;
  readonly name: string;
  readonly classification: 'astral-leviathan' | 'void-colossus' | 'stellar-behemoth';
  readonly radiusM: number;
  readonly coreColor: number;
  readonly carapaceColor: number;
  readonly position: Vector3;
  readonly renderPosition: Vector3;
  readonly velocity: Vector3;
  health: number;
  readonly maxHealth: number;
  shield: number;
  readonly maxShield: number;
  shieldCooldown: number;
  phase: 1 | 2 | 3;
  weakSpotHitCount: number;
  headingRad: number;
  enraged: boolean;
  roarTimer: number;
  attackCooldown: number;
  attackState: 'idle' | 'telegraph' | 'firing';
  attackTimer: number;
  driftAngleRad: number;
  orbitCenter: Vector3;
  orbitRadiusM: number;
  orbitSpeedRadPerS: number;
}

export interface TitanWeakpoint {
  readonly id: string;
  readonly name: string;
  readonly localOffset: Vector3;
  readonly worldPosition: Vector3;
  readonly renderPosition: Vector3;
  health: number;
  readonly maxHealth: number;
  shield: number;
  readonly maxShield: number;
  isExposed: boolean;
  destroyed: boolean;
}

export interface CosmicPlasmaSphere {
  active: boolean;
  position: Vector3;
  velocity: Vector3;
  radius: number;
  speed: number;
  damage: number;
  lifetime: number;
  maxLifetime: number;
  mesh: Mesh;
}

/**
 * Procedural Spine Inverse Kinematics (IK) for the Astral Leviathan.
 * Solves continuous sinusoidal wave propagation along the articulated vertebrae
 * with strict rigid bone distance constraints (zero elongation / compression).
 * Inspired by references/THREE.IK/src/core/IKChain.js.
 */
export class AstralLeviathanSpineIK {
  readonly boneCount: number;
  readonly segmentLength: number;
  readonly positions: Vector3[] = [];
  private readonly _scratchDir = new Vector3();

  constructor(boneCount = 32, segmentLength = 3750) {
    this.boneCount = boneCount;
    this.segmentLength = segmentLength;
    for (let i = 0; i < this.boneCount; i++) {
      this.positions.push(new Vector3(0, 0, -i * this.segmentLength));
    }
  }

  updateProceduralWave(time: number, speed: number, leadPosition: Vector3): void {
    // Lead vertebra follows the titan's primary anchor
    this.positions[0].copy(leadPosition);

    for (let i = 1; i < this.boneCount; i++) {
      const prev = this.positions[i - 1];
      const curr = this.positions[i];

      // Predict wave orientation
      const wave = Math.sin(time * 1.5 + i * 0.25) * (45.0 * (speed > 0 ? 1 : 0.5));
      curr.x += Math.cos(time + i * 0.1) * (wave * 0.2);
      curr.y += wave;

      // Strict distance projection: curr = prev + dir * segmentLength
      this._scratchDir.subVectors(curr, prev);
      const len = this._scratchDir.length();
      if (len > 1e-4) {
        this._scratchDir.multiplyScalar(1 / len);
      } else {
        this._scratchDir.set(0, 0, -1);
      }
      curr.copy(prev).addScaledVector(this._scratchDir, this.segmentLength);
    }
  }

  getSegmentPosition(index: number): Vector3 {
    return this.positions[Math.max(0, Math.min(this.positions.length - 1, index))];
  }
}

function safeMerge(geos: BufferGeometry[]): BufferGeometry {
  const prepared = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(prepared);
  for (const g of geos) g.dispose();
  for (const g of prepared) {
    if (!geos.includes(g)) g.dispose();
  }
  return merged ?? new DodecahedronGeometry(1, 0);
}

function createTitanCarapaceGeometry(): BufferGeometry {
  // Massive curved carapace rib segments and astral horns
  const ribs: BufferGeometry[] = [];
  const ribCount = 6;
  for (let i = 0; i < ribCount; i++) {
    const scale = 1.0 - i * 0.12;
    const rib = new TorusGeometry(1.0 * scale, 0.12 * scale, 6, 16, Math.PI * 1.3);
    rib.rotateZ(Math.PI * 0.35);
    rib.rotateY((i / ribCount) * Math.PI * 2);
    rib.translate(0, (i - ribCount * 0.5) * 0.3, 0);
    ribs.push(rib);
  }

  // Anterior astral horns
  const horn1 = new CylinderGeometry(0.04, 0.22, 1.8, 5);
  horn1.rotateZ(0.4);
  horn1.translate(0.6, 0.8, 0.5);
  ribs.push(horn1);

  const horn2 = new CylinderGeometry(0.04, 0.22, 1.8, 5);
  horn2.rotateZ(-0.4);
  horn2.translate(-0.6, 0.8, 0.5);
  ribs.push(horn2);

  return safeMerge(ribs);
}

function deterministicRand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export class CosmicPlanetTitanManager {
  readonly root = new Group();
  readonly plasmaRoot = new Group();
  readonly titans: PlanetTitanState[] = [];
  readonly weakpoints: TitanWeakpoint[] = [];
  readonly plasmaSpheres: CosmicPlasmaSphere[] = [];
  readonly spineIK = new AstralLeviathanSpineIK(32, 3750);

  private coreMesh!: Mesh;
  private carapaceMesh!: Mesh;
  private haloMesh!: Mesh;

  private coreMaterial!: MeshBasicNodeMaterial;
  private carapaceMaterial!: MeshStandardMaterial;
  private haloMaterial!: MeshBasicNodeMaterial;
  private plasmaMaterial!: MeshBasicNodeMaterial;

  private readonly _scratchDir = new Vector3();
  private readonly _scratchPlayerVec = new Vector3();
  private lastActualDistM = Infinity;

  constructor(
    private readonly save?: SaveManager,
    private readonly notify?: (msg: string) => void,
    private readonly sound?: (name: string) => void,
  ) {
    this.root.name = 'cosmic-planet-titan-manager';
    this.plasmaRoot.name = 'titan-plasma-projectiles';
    this.buildMeshes();
    this.seedTitans();
    this.initWeakpoints();
    this.initPlasmaPool();
    this.root.add(this.plasmaRoot);
  }

  private buildMeshes(): void {
    // 1. Central Astral Stellar Core (Weak Spot)
    const coreGeo = new SphereGeometry(1.0, 16, 12);
    this.coreMaterial = new MeshBasicNodeMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.9,
    });
    this.coreMesh = new Mesh(coreGeo, this.coreMaterial);
    this.coreMesh.name = 'planet-titan-core';

    // 2. Segmented Carapace and Astral Wings
    const carapaceGeo = createTitanCarapaceGeometry();
    this.carapaceMaterial = new MeshStandardMaterial({
      color: 0x1b2838,
      roughness: 0.4,
      metalness: 0.85,
      emissive: 0x003366,
      emissiveIntensity: 0.6,
    });
    this.carapaceMesh = new Mesh(carapaceGeo, this.carapaceMaterial);
    this.carapaceMesh.name = 'planet-titan-carapace';

    // 3. Stardust Halo Ring
    const haloGeo = new TorusGeometry(1.6, 0.05, 6, 24);
    haloGeo.rotateX(Math.PI / 2);
    this.haloMaterial = new MeshBasicNodeMaterial({
      color: 0x5ae0e6,
      transparent: true,
      opacity: 0.65,
    });
    this.haloMesh = new Mesh(haloGeo, this.haloMaterial);
    this.haloMesh.name = 'planet-titan-halo';

    this.root.add(this.coreMesh);
    this.root.add(this.carapaceMesh);
    this.root.add(this.haloMesh);
  }

  private initPlasmaPool(): void {
    const sphereGeo = new SphereGeometry(2500, 12, 10);
    this.plasmaMaterial = new MeshBasicNodeMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.85,
    });

    const poolSize = 16;
    for (let i = 0; i < poolSize; i++) {
      const mesh = new Mesh(sphereGeo, this.plasmaMaterial);
      mesh.visible = false;
      this.plasmaRoot.add(mesh);
      this.plasmaSpheres.push({
        active: false,
        position: new Vector3(),
        velocity: new Vector3(),
        radius: 2500,
        speed: 250_000, // 250 km/s cosmic plasma projectile
        damage: 160,
        lifetime: 0,
        maxLifetime: 15,
        mesh,
      });
    }
  }

  private initWeakpoints(): void {
    this.weakpoints.length = 0;
    // 1. Anterior Plasma Matrix (horns/head)
    this.weakpoints.push({
      id: 'planet-titan-core-anterior',
      name: 'Matriz Anterior de Plasma',
      localOffset: new Vector3(0, 20_000, 35_000),
      worldPosition: new Vector3(),
      renderPosition: new Vector3(),
      health: 750_000,
      maxHealth: 750_000,
      shield: 500_000,
      maxShield: 500_000,
      isExposed: true,
      destroyed: false,
    });

    // 2. Dorsal Shield Generator Conduit (carapace)
    this.weakpoints.push({
      id: 'planet-titan-core-dorsal',
      name: 'Condutor Dorsal de Escudo',
      localOffset: new Vector3(0, -15_000, -35_000),
      worldPosition: new Vector3(),
      renderPosition: new Vector3(),
      health: 750_000,
      maxHealth: 750_000,
      shield: 500_000,
      maxShield: 500_000,
      isExposed: true,
      destroyed: false,
    });
  }

  private seedTitans(): void {
    // Celestial Titan: Leviathan of the Deep Void
    // Scale: 120 km radius (120,000 meters)
    // Orbit: 11.03 AU (1.65e12 m) in deep solar orbit beyond Saturn
    const orbitRadiusM = 1.65e12;
    const driftAngleRad = 0.45;
    const pos = new Vector3(
      Math.cos(driftAngleRad) * orbitRadiusM,
      Math.sin(driftAngleRad * 1.5) * (orbitRadiusM * 0.05),
      Math.sin(driftAngleRad) * orbitRadiusM,
    );

    const saved = this.save?.getTitanRecord('titan-astral-leviathan-01');

    const titan1: PlanetTitanState = {
      id: 'titan-astral-leviathan-01',
      name: 'Leviatã Astral do Vácuo · Ouroboros Cósmico',
      kind: 'creature',
      classification: 'astral-leviathan',
      radiusM: 120_000,
      radius: 120_000,
      active: saved ? (!saved.defeated && saved.health > 0) : true,
      coreColor: 0x00ffff,
      carapaceColor: 0x182433,
      position: pos,
      renderPosition: pos.clone(),
      velocity: new Vector3(),
      health: saved ? saved.health : 2_500_000,
      maxHealth: 2_500_000,
      shield: saved ? saved.shield : 1_500_000,
      maxShield: 1_500_000,
      shieldCooldown: 0,
      phase: saved ? (saved.phase as 1 | 2 | 3) : 1,
      weakSpotHitCount: 0,
      headingRad: driftAngleRad + Math.PI * 0.5,
      enraged: saved ? saved.phase === 2 : false,
      roarTimer: 8.0,
      attackCooldown: 10.0,
      attackState: 'idle',
      attackTimer: 0,
      driftAngleRad,
      orbitCenter: new Vector3(0, 0, 0),
      orbitRadiusM,
      orbitSpeedRadPerS: 5.31e-9,
    };

    this.titans.push(titan1);
  }

  get targets(): Target[] {
    if (!this.root.visible) return [];
    const list: Target[] = [];
    for (const t of this.titans) {
      if (t.active && t.health > 0) {
        list.push({
          id: t.id,
          kind: 'creature',
          position: t.renderPosition,
          radius: t.radiusM,
          active: true,
        });
        // Expose vulnerable core weak spot as distinct target in matching render coordinates
        list.push({
          id: 'planet-titan-core',
          kind: 'creature',
          position: t.renderPosition,
          radius: t.radiusM * 0.35,
          active: true,
        });
        // Expose additional localized weakpoints along the articulated titan body
        for (const wp of this.weakpoints) {
          if (!wp.destroyed) {
            list.push({
              id: wp.id,
              kind: 'creature',
              position: wp.renderPosition,
              radius: t.radiusM * 0.25,
              active: true,
            });
          }
        }
      }
    }
    return list;
  }

  get bossTelemetry(): { name: string; phase: number; health: number; maxHealth: number; shield: number; maxShield: number; enraged: boolean; distanceM: number } | null {
    if (this.titans.length === 0) return null;
    const t = this.titans[0];
    if (!t.active || t.health <= 0 || !this.root.visible || this.lastActualDistM > 5_000_000) return null;
    return {
      name: t.name,
      phase: t.phase,
      health: t.health,
      maxHealth: t.maxHealth,
      shield: t.shield,
      maxShield: t.maxShield,
      enraged: t.enraged,
      distanceM: this.lastActualDistM,
    };
  }

  /**
   * Spawns physical plasma spheres fired towards the player from the Titan's stellar core.
   */
  private firePlasmaSphere(
    origin: Vector3,
    target: Vector3,
    count: number,
    damage: number,
    speed = 250_000,
  ): void {
    this._scratchDir.subVectors(target, origin).normalize();
    const baseDir = this._scratchDir;

    let fired = 0;
    for (const sphere of this.plasmaSpheres) {
      if (sphere.active) continue;

      sphere.active = true;
      sphere.damage = damage;
      sphere.speed = speed;
      sphere.lifetime = 0;
      sphere.position.copy(origin);

      if (count === 1 || fired === 0) {
        sphere.velocity.copy(baseDir).multiplyScalar(speed);
      } else {
        // Lateral angular spread for multi-sphere barrage in Phase 2
        const spreadAngle = (fired === 1 ? 0.08 : -0.08);
        const vx = baseDir.x * Math.cos(spreadAngle) - baseDir.z * Math.sin(spreadAngle);
        const vz = baseDir.x * Math.sin(spreadAngle) + baseDir.z * Math.cos(spreadAngle);
        sphere.velocity.set(vx, baseDir.y, vz).normalize().multiplyScalar(speed);
      }

      sphere.mesh.position.copy(sphere.position);
      sphere.mesh.visible = true;

      fired++;
      if (fired >= count) break;
    }
  }

  update(
    dt: number,
    cameraOrRenderSpace: RenderSpaceService | Vector3,
    activeFrameId?: string,
    epochS?: number,
    solarSystem?: { positionOf(id: string): [number, number, number] | undefined },
    playerRenderPos?: Vector3,
    onPlayerDamage?: (damage: number, reason: string) => void,
  ): void {
    if (this.titans.length === 0) return;
    const titan = this.titans[0];
    if (!titan.active || titan.health <= 0) {
      this.root.visible = false;
      return;
    }

    // System isolation: Titan lives strictly in the Solar System
    if (activeFrameId && activeFrameId !== 'solar-system/barycentric') {
      this.root.visible = false;
      return;
    }

    // Sync position with solar system ephemeris if available, or update drift
    if (solarSystem) {
      const ephemPos = solarSystem.positionOf(titan.id);
      if (ephemPos) {
        titan.position.set(ephemPos[0], ephemPos[1], ephemPos[2]);
        titan.headingRad = Math.atan2(ephemPos[2], ephemPos[0]) + Math.PI * 0.5;
      }
    } else {
      titan.driftAngleRad += titan.orbitSpeedRadPerS * dt;
      titan.position.x = titan.orbitCenter.x + Math.cos(titan.driftAngleRad) * titan.orbitRadiusM;
      titan.position.z = titan.orbitCenter.z + Math.sin(titan.driftAngleRad) * titan.orbitRadiusM;
      titan.position.y = titan.orbitCenter.y + Math.sin(titan.driftAngleRad * 1.5) * (titan.orbitRadiusM * 0.05);
      titan.headingRad = titan.driftAngleRad + Math.PI * 0.5;
    }

    // Solve multi-bone procedural wave inverse kinematics along the spine
    this.spineIK.updateProceduralWave(titan.driftAngleRad * 100, titan.orbitSpeedRadPerS, titan.position);

    // Shield passive regeneration out of combat
    if (titan.shieldCooldown > 0) {
      titan.shieldCooldown = Math.max(0, titan.shieldCooldown - dt);
    } else if (titan.shield < titan.maxShield) {
      titan.shield = Math.min(titan.maxShield, titan.shield + 25_000 * dt);
    }

    // Camera / RenderSpace presentation
    let renderX = 0, renderY = 0, renderZ = 0;
    let dist = 0;

    if ('logicalToRender' in cameraOrRenderSpace) {
      const renderSpace = cameraOrRenderSpace as RenderSpaceService;
      const renderOffset = renderSpace.logicalToRender('solar-system/barycentric', [
        titan.position.x,
        titan.position.y,
        titan.position.z,
      ]);
      renderX = renderOffset[0];
      renderY = renderOffset[1];
      renderZ = renderOffset[2];
      dist = Math.hypot(renderX, renderY, renderZ);
      this.lastActualDistM = dist;

      // Deterministic roar timer based on pseudo-random hash (only emitted within 5,000 km combat engagement range)
      titan.roarTimer -= dt;
      if (titan.roarTimer <= 0) {
        titan.roarTimer = 35.0 + deterministicRand(titan.driftAngleRad * 1000 + titan.weakSpotHitCount) * 20.0;
        if (dist <= 5_000_000) {
          this.sound?.('colossus-roar');
          this.notify?.(`Ressonância cósmica detectada · [${titan.name}] emite rugido sub-espacial.`);
        }
      }

      // Proxy representation when distant (> 5,000,000 m / 5,000 km or not render-safe)
      if (dist > 5_000_000 || !renderSpace.isRenderSafe(renderOffset)) {
        const invDist = 1 / Math.max(1, dist);
        const dirX = renderX * invDist;
        const dirY = renderY * invDist;
        const dirZ = renderZ * invDist;
        const proxyDist = 60_000;
        this.root.position.set(dirX * proxyDist, dirY * proxyDist, dirZ * proxyDist);

        // Exact physical angular radius trigonometry without artificial floor
        const theta = Math.asin(Math.min(1.0, titan.radiusM / Math.max(1, dist)));
        const angularProxyR = proxyDist * Math.tan(theta);
        const proxyR = Math.max(0.01, angularProxyR);
        this.coreMesh.visible = true;
        this.haloMesh.visible = true;
        this.carapaceMesh.visible = false;
        this.coreMesh.scale.setScalar(proxyR * 0.8);
        this.haloMesh.scale.setScalar(proxyR * 1.6);
      } else {
        // Detailed 3D mesh when close to player
        this.root.position.set(renderX, renderY, renderZ);
        this.coreMesh.visible = true;
        this.haloMesh.visible = true;
        this.carapaceMesh.visible = true;

        const r = titan.radiusM;
        this.coreMesh.scale.set(r * 0.4, r * 0.4, r * 0.4);
        this.carapaceMesh.scale.set(r, r, r);
        this.haloMesh.scale.set(r * 1.8, r * 1.8, r * 1.8);
      }
    } else {
      // Vector3 fallback for tests
      renderX = titan.position.x - cameraOrRenderSpace.x;
      renderY = titan.position.y - cameraOrRenderSpace.y;
      renderZ = titan.position.z - cameraOrRenderSpace.z;
      this.root.position.set(renderX, renderY, renderZ);
      dist = Math.hypot(renderX, renderY, renderZ);
      const r = titan.radiusM;
      this.coreMesh.scale.set(r * 0.4, r * 0.4, r * 0.4);
      this.carapaceMesh.scale.set(r, r, r);
      this.haloMesh.scale.set(r * 1.8, r * 1.8, r * 1.8);
    }

    titan.renderPosition.set(renderX, renderY, renderZ);
    this.root.visible = true;
    this.root.rotation.y = titan.headingRad;

    // Transform weakpoints to match current titan rotation and render position
    const cosH = Math.cos(titan.headingRad);
    const sinH = Math.sin(titan.headingRad);
    for (const wp of this.weakpoints) {
      const rx = wp.localOffset.x * cosH + wp.localOffset.z * sinH;
      const ry = wp.localOffset.y;
      const rz = -wp.localOffset.x * sinH + wp.localOffset.z * cosH;
      wp.renderPosition.set(renderX + rx, renderY + ry, renderZ + rz);
      wp.worldPosition.set(titan.position.x + rx, titan.position.y + ry, titan.position.z + rz);
    }

    // Visual material reactions
    if (titan.phase === 2 || titan.enraged) {
      this.carapaceMaterial.emissive.setHex(0xff2200);
      this.coreMaterial.color.setHex(0xff4400);
      this.haloMaterial.color.setHex(0xff8833);
      this.plasmaMaterial.color.setHex(0xff5500);
    } else {
      this.carapaceMaterial.emissive.setHex(0x003366);
      this.coreMaterial.color.setHex(titan.coreColor);
      this.haloMaterial.color.setHex(0x5ae0e6);
      this.plasmaMaterial.color.setHex(0x00ffff);
    }

    // Boss offensive behavior against player within cosmic combat range (2,500 km)
    if (playerRenderPos && dist < 2_500_000) {
      titan.attackCooldown -= dt;
      if (titan.attackState === 'idle') {
        if (titan.attackCooldown <= 0) {
          titan.attackState = 'telegraph';
          titan.attackTimer = 1.5;
          this.sound?.('colossus-roar');
          this.notify?.(titan.phase === 2
            ? `ALERTA DE SUPERNOVA · [${titan.name}] canaliza pulso destrutivo de plasma! Desvie!`
            : `AVISO DE COMBATE · [${titan.name}] mira Raio do Vácuo Cósmico em sua direção!`);
        }
      } else if (titan.attackState === 'telegraph') {
        titan.attackTimer -= dt;
        this.coreMaterial.color.setHex(titan.phase === 2 ? 0xff1100 : 0xff00ff);
        if (titan.attackTimer <= 0) {
          titan.attackState = 'firing';
          titan.attackTimer = 0.5;
          this.sound?.('energy');
          const dmg = titan.phase === 2 ? 300 : 160;

          // Spawn physical traveling plasma barrage
          const sphereCount = titan.phase === 2 ? 3 : 1;
          this.firePlasmaSphere(titan.renderPosition, playerRenderPos, sphereCount, dmg, 250_000);

          // Direct attack resolution if player is in immediate proximity or fast tick
          onPlayerDamage?.(dmg, titan.phase === 2 ? 'Supernova Solar' : 'Raio do Vácuo Astral');
          this.notify?.(`IMPACTO CÓSMICO · O ataque de [${titan.name}] atingiu sua blindagem! (-${dmg} HP)`);
        }
      } else if (titan.attackState === 'firing') {
        titan.attackTimer -= dt;
        if (titan.attackTimer <= 0) {
          titan.attackState = 'idle';
          titan.attackCooldown = titan.phase === 2 ? 6.0 : 12.0;
        }
      }
    }

    // Update active plasma projectiles
    if (playerRenderPos) {
      for (const sphere of this.plasmaSpheres) {
        if (!sphere.active) continue;
        sphere.position.addScaledVector(sphere.velocity, dt);
        sphere.mesh.position.copy(sphere.position);
        sphere.lifetime += dt;

        this._scratchPlayerVec.subVectors(sphere.position, playerRenderPos);
        const distToPlayer = this._scratchPlayerVec.length();

        // Projectile hit on player
        if (distToPlayer < sphere.radius + 15_000) {
          sphere.active = false;
          sphere.mesh.visible = false;
          onPlayerDamage?.(sphere.damage, 'Esfera de Plasma Cósmica');
          this.sound?.('energy');
          this.notify?.(`IMPACTO DE ESFERA DE PLASMA · Atingido em cheio por plasma cósmico! (-${sphere.damage} HP)`);
        } else if (sphere.lifetime >= sphere.maxLifetime || distToPlayer > 10_000_000) {
          sphere.active = false;
          sphere.mesh.visible = false;
        }
      }
    }
  }

  hit(targetId: string, force: number, impulse: number, hitRayOrigin?: Vector3): boolean {
    const titan = this.titans.find(t => t.id === targetId || targetId === 'planet-titan' || targetId.startsWith('planet-titan-core'));
    if (!titan || !titan.active || titan.health <= 0) return false;

    titan.shieldCooldown = 15.0; // Reset shield cooldown on hit
    let isWeakSpot = targetId.startsWith('planet-titan-core');

    // If attacking from behind the dorsal armored carapace and shield is up, the core is protected
    if (isWeakSpot && hitRayOrigin && titan.shield > 0) {
      const headingVec = new Vector3(Math.cos(titan.headingRad), 0, Math.sin(titan.headingRad));
      const toAttacker = new Vector3().subVectors(hitRayOrigin, titan.renderPosition).normalize();
      const dot = headingVec.dot(toAttacker);
      // dot < -0.2 means attacker is behind the titan's dorsal shell
      if (dot < -0.2) {
        isWeakSpot = false;
        this.notify?.(`CARAPAÇA DORSAL REPELIU O IMPACTO · O núcleo estelar de [${titan.name}] está protegido! Flanqueie o titã pela frente.`);
      }
    }

    // Cosmic damage scaling: normal player force (25-150) scaled for planetary scale
    const cosmicDamage = (force < 1000 ? force * 1000 : force) * (isWeakSpot ? 3.0 : 1.0);

    // Progressive shield and health damage on matching weakpoint
    const matchingWeakpoint = this.weakpoints.find(w => w.id === targetId);
    if (matchingWeakpoint && !matchingWeakpoint.destroyed) {
      if (matchingWeakpoint.shield > 0) {
        matchingWeakpoint.shield = Math.max(0, matchingWeakpoint.shield - cosmicDamage * 0.5);
        if (matchingWeakpoint.shield === 0) {
          this.notify?.(`ESCUDO DO NÚCLEO ROMPIDO · [${matchingWeakpoint.name}] vulnerável a dano estrutural!`);
        }
      } else {
        matchingWeakpoint.health = Math.max(0, matchingWeakpoint.health - cosmicDamage);
        if (matchingWeakpoint.health === 0) {
          matchingWeakpoint.destroyed = true;
          this.sound?.('planet-crack');
          this.notify?.(`NÚCLEO ESTELAR DESTRUÍDO · [${matchingWeakpoint.name}] sobrecarregou e colapsou!`);
        }
      }
    }

    if (isWeakSpot) {
      titan.weakSpotHitCount++;
      this.notify?.(`PONTO FRACO VULNERÁVEL ATINGIDO · Núcleo estelar de [${titan.name}] sobrecarregado! (+300% dano)`);
    }

    let remainingDamage = cosmicDamage;

    // Shield absorption (weak spot penetrates 50% shield)
    if (titan.shield > 0) {
      const shieldDmg = isWeakSpot ? remainingDamage * 0.5 : remainingDamage;
      if (titan.shield <= shieldDmg) {
        remainingDamage = (remainingDamage - titan.shield);
        titan.shield = 0;
        titan.enraged = true;
        this.sound?.('colossus-roar');
        this.notify?.(`ESCUDO ASTRAL ROMPIDO · [${titan.name}] exposto ao dano de carapaça!`);
      } else {
        titan.shield -= shieldDmg;
        remainingDamage = isWeakSpot ? remainingDamage * 0.5 : 0;
        this.sound?.('colossus-roar');
      }
    }

    if (remainingDamage > 0) {
      titan.health = Math.max(0, titan.health - remainingDamage);
      titan.enraged = true;
      this.sound?.('colossus-roar');
    }

    // Phase 2 transition at <= 50% health
    if (titan.health <= titan.maxHealth * 0.5 && titan.phase === 1) {
      titan.phase = 2;
      titan.enraged = true;
      titan.orbitSpeedRadPerS *= 2.0;
      this.sound?.('colossus-roar');
      this.notify?.(`ALERTA CÓSMICO · [${titan.name}] entrou na Fase 2: Fúria de Supernova!`);
    }

    if (titan.health <= 0) {
      titan.active = false;
      titan.phase = 3;
      this.notify?.(`VITÓRIA CÓSMICA · O Leviatã Planetário [${titan.name}] entrou em dormência cósmica.`);
      this.sound?.('planet-crack');
      this.save?.recordColossusDefeat(titan.id);
    }

    // Persist status to SaveManager
    this.save?.saveTitanRecord(titan.id, {
      health: titan.health,
      shield: titan.shield,
      phase: titan.phase,
      defeated: titan.health <= 0,
    });

    return true;
  }

  /**
   * Serializes current Astral Leviathan state into compact binary buffer:
   * [0..3]: float32 health
   * [4..7]: float32 shield
   * [8]: uint8 phase (1, 2, 3)
   * [9]: uint8 active (1/0)
   * [10]: uint8 enraged (1/0)
   * [11]: uint8 weakSpotHitCount
   * [12..15]: float32 driftAngleRad
   * [16..19]: float32 headingRad
   * [20]: uint8 weakpoints destroyed bitmask
   */
  serializeState(): Uint8Array {
    const titan = this.titans[0];
    if (!titan) return new Uint8Array(0);
    const buffer = new ArrayBuffer(21);
    const view = new DataView(buffer);
    view.setFloat32(0, titan.health, true);
    view.setFloat32(4, titan.shield, true);
    view.setUint8(8, titan.phase);
    view.setUint8(9, titan.active ? 1 : 0);
    view.setUint8(10, titan.enraged ? 1 : 0);
    view.setUint8(11, titan.weakSpotHitCount);
    view.setFloat32(12, titan.driftAngleRad, true);
    view.setFloat32(16, titan.headingRad, true);

    let wpMask = 0;
    for (let i = 0; i < Math.min(8, this.weakpoints.length); i++) {
      if (this.weakpoints[i].destroyed) {
        wpMask |= (1 << i);
      }
    }
    view.setUint8(20, wpMask);
    return new Uint8Array(buffer);
  }

  /**
   * Restores Astral Leviathan state from a compact binary buffer.
   */
  deserializeState(data: Uint8Array): void {
    const titan = this.titans[0];
    if (!titan || data.byteLength < 12) return;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    titan.health = view.getFloat32(0, true);
    titan.shield = view.getFloat32(4, true);
    titan.phase = Math.min(3, Math.max(1, view.getUint8(8))) as 1 | 2 | 3;
    titan.active = view.getUint8(9) === 1;
    titan.enraged = view.getUint8(10) === 1;
    titan.weakSpotHitCount = view.getUint8(11);
    if (data.byteLength >= 20) {
      titan.driftAngleRad = view.getFloat32(12, true);
      titan.headingRad = view.getFloat32(16, true);
    }
    if (data.byteLength >= 21) {
      const wpMask = view.getUint8(20);
      for (let i = 0; i < Math.min(8, this.weakpoints.length); i++) {
        const isDestroyed = (wpMask & (1 << i)) !== 0;
        this.weakpoints[i].destroyed = isDestroyed;
        if (isDestroyed) {
          this.weakpoints[i].shield = 0;
          this.weakpoints[i].health = 0;
        }
      }
    }
  }

  dispose(): void {
    this.coreMesh.geometry.dispose();
    this.carapaceMesh.geometry.dispose();
    this.haloMesh.geometry.dispose();
    this.coreMaterial.dispose();
    this.carapaceMaterial.dispose();
    this.haloMaterial.dispose();
    this.plasmaMaterial.dispose();
    for (const sphere of this.plasmaSpheres) {
      sphere.mesh.geometry.dispose();
    }
    this.plasmaSpheres.length = 0;
    this.weakpoints.length = 0;
    this.titans.length = 0;
  }
}
