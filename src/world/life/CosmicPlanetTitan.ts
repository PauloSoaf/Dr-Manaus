/**
 * CosmicPlanetTitan.ts
 *
 * Planet-sized cosmic titans and astral leviathans (50 km to 500+ km radius).
 * Majestic, living celestial beings drifting through star systems and deep space.
 * Fully interactive: targetable by Dr-Manaus powers, combat damage, cosmic roar audio,
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
  driftAngleRad: number;
  orbitCenter: Vector3;
  orbitRadiusM: number;
  orbitSpeedRadPerS: number;
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
  readonly titans: PlanetTitanState[] = [];

  private coreMesh!: Mesh;
  private carapaceMesh!: Mesh;
  private haloMesh!: Mesh;

  private coreMaterial!: MeshBasicNodeMaterial;
  private carapaceMaterial!: MeshStandardMaterial;
  private haloMaterial!: MeshBasicNodeMaterial;

  constructor(
    private readonly save?: SaveManager,
    private readonly notify?: (msg: string) => void,
    private readonly sound?: (name: string) => void,
  ) {
    this.root.name = 'cosmic-planet-titan-manager';
    this.buildMeshes();
    this.seedTitans();
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

  private seedTitans(): void {
    // Celestial Titan: Leviathan of the Deep Void
    // Scale: 120 km radius (120,000 meters)
    // Orbit: 11.2 AU (1.675e12 m) in deep solar orbit beyond Saturn
    const orbitRadiusM = 1.675e12;
    const driftAngleRad = 0.45;
    const titan1: PlanetTitanState = {
      id: 'titan-astral-leviathan-01',
      name: 'Leviatã Astral do Vácuo · Ouroboros Cósmico',
      kind: 'creature',
      classification: 'astral-leviathan',
      radiusM: 120_000,
      radius: 120_000,
      active: true,
      coreColor: 0x00ffff,
      carapaceColor: 0x182433,
      position: new Vector3(
        Math.cos(driftAngleRad) * orbitRadiusM,
        Math.sin(driftAngleRad * 1.5) * (orbitRadiusM * 0.05),
        Math.sin(driftAngleRad) * orbitRadiusM,
      ),
      velocity: new Vector3(),
      health: 2_500_000,
      maxHealth: 2_500_000,
      shield: 1_500_000,
      maxShield: 1_500_000,
      shieldCooldown: 0,
      phase: 1,
      weakSpotHitCount: 0,
      headingRad: driftAngleRad + Math.PI * 0.5,
      enraged: false,
      roarTimer: 8.0,
      driftAngleRad,
      orbitCenter: new Vector3(0, 0, 0),
      orbitRadiusM,
      orbitSpeedRadPerS: 5.31e-9,
    };

    this.titans.push(titan1);
  }

  get targets(): Target[] {
    const list: Target[] = [];
    for (const t of this.titans) {
      if (t.active && t.health > 0) {
        list.push(t);
        // Expose vulnerable core weak spot as distinct target
        list.push({
          id: 'planet-titan-core',
          kind: 'creature',
          position: t.position,
          radius: t.radiusM * 0.35,
          active: true,
        });
      }
    }
    return list;
  }

  update(
    dt: number,
    cameraOrRenderSpace: RenderSpaceService | Vector3,
    activeFrameId?: string,
    epochS?: number,
    solarSystem?: { positionOf(id: string): [number, number, number] | undefined },
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

    // Shield passive regeneration out of combat
    if (titan.shieldCooldown > 0) {
      titan.shieldCooldown = Math.max(0, titan.shieldCooldown - dt);
    } else if (titan.shield < titan.maxShield) {
      titan.shield = Math.min(titan.maxShield, titan.shield + 25_000 * dt);
    }

    // Deterministic roar timer based on pseudo-random hash
    titan.roarTimer -= dt;
    if (titan.roarTimer <= 0) {
      titan.roarTimer = 35.0 + deterministicRand(titan.driftAngleRad * 1000 + titan.weakSpotHitCount) * 20.0;
      this.sound?.('colossus-roar');
      this.notify?.(`Ressonância cósmica detectada · [${titan.name}] emite rugido sub-espacial.`);
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

      // Proxy representation when distant (> 5,000,000 m / 5,000 km or not render-safe)
      if (dist > 5_000_000 || !renderSpace.isRenderSafe(renderOffset)) {
        const invDist = 1 / Math.max(1, dist);
        const dirX = renderX * invDist;
        const dirY = renderY * invDist;
        const dirZ = renderZ * invDist;
        const proxyDist = 60_000;
        this.root.position.set(dirX * proxyDist, dirY * proxyDist, dirZ * proxyDist);

        const theta = Math.atan2(titan.radiusM, dist);
        const proxyR = Math.max(300, proxyDist * Math.tan(theta));
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
      const r = titan.radiusM;
      this.coreMesh.scale.set(r * 0.4, r * 0.4, r * 0.4);
      this.carapaceMesh.scale.set(r, r, r);
      this.haloMesh.scale.set(r * 1.8, r * 1.8, r * 1.8);
    }

    this.root.visible = true;
    this.root.rotation.y = titan.headingRad;

    // Visual material reactions
    if (titan.phase === 2 || titan.enraged) {
      this.carapaceMaterial.emissive.setHex(0xff2200);
      this.coreMaterial.color.setHex(0xff4400);
      this.haloMaterial.color.setHex(0xff8833);
    } else {
      this.carapaceMaterial.emissive.setHex(0x003366);
      this.coreMaterial.color.setHex(titan.coreColor);
      this.haloMaterial.color.setHex(0x5ae0e6);
    }
  }

  hit(targetId: string, force: number, impulse: number): boolean {
    const titan = this.titans.find(t => t.id === targetId || targetId === 'planet-titan' || targetId === 'planet-titan-core');
    if (!titan || !titan.active || titan.health <= 0) return false;

    titan.shieldCooldown = 15.0; // Reset shield cooldown on hit
    const isWeakSpot = targetId === 'planet-titan-core';

    // Cosmic damage scaling: normal player force (25-150) scaled for planetary scale
    const cosmicDamage = (force < 1000 ? force * 1000 : force) * (isWeakSpot ? 3.0 : 1.0);

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
    }

    return true;
  }

  dispose(): void {
    this.coreMesh.geometry.dispose();
    this.carapaceMesh.geometry.dispose();
    this.haloMesh.geometry.dispose();
    this.coreMaterial.dispose();
    this.carapaceMaterial.dispose();
    this.haloMaterial.dispose();
    this.titans.length = 0;
  }
}
