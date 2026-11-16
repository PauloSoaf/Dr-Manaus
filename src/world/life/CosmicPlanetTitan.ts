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
  Color,
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
    // 1. Central Astral Stellar Core
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
      position: new Vector3(8.5e8, 1.2e8, -1.4e9), // In deep Solar orbit beyond Saturn
      velocity: new Vector3(),
      health: 5e9,
      maxHealth: 5e9,
      headingRad: 0,
      enraged: false,
      roarTimer: 8.0,
      driftAngleRad: 0.45,
      orbitCenter: new Vector3(0, 0, 0),
      orbitRadiusM: 1.65e9,
      orbitSpeedRadPerS: 0.00015,
    };

    this.titans.push(titan1);
  }

  get targets(): Target[] {
    const list: Target[] = [];
    for (const t of this.titans) {
      if (t.active && t.health > 0) list.push(t);
    }
    return list;
  }

  update(dt: number, cameraPos: Vector3): void {
    if (this.titans.length === 0) return;
    const titan = this.titans[0];
    if (!titan.active || titan.health <= 0) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;

    // Majestic slow orbital drifting
    titan.driftAngleRad += titan.orbitSpeedRadPerS * dt;
    titan.position.x = titan.orbitCenter.x + Math.cos(titan.driftAngleRad) * titan.orbitRadiusM;
    titan.position.z = titan.orbitCenter.z + Math.sin(titan.driftAngleRad) * titan.orbitRadiusM;
    titan.position.y = titan.orbitCenter.y + Math.sin(titan.driftAngleRad * 1.5) * (titan.orbitRadiusM * 0.15);
    titan.headingRad = titan.driftAngleRad + Math.PI * 0.5;

    // Roar timer
    titan.roarTimer -= dt;
    if (titan.roarTimer <= 0) {
      titan.roarTimer = 35.0 + Math.random() * 20.0;
      if (titan.position.distanceTo(cameraPos) < titan.radiusM * 10) {
        this.sound?.('colossus-roar');
        this.notify?.(`Ressonância cósmica detectada · [${titan.name}] emite rugido sub-espacial.`);
      }
    }

    // Camera-relative presentation
    const relX = titan.position.x - cameraPos.x;
    const relY = titan.position.y - cameraPos.y;
    const relZ = titan.position.z - cameraPos.z;

    this.root.position.set(relX, relY, relZ);
    this.root.rotation.y = titan.headingRad;

    // Scale mesh to titan's planetary radius
    const r = titan.radiusM;
    this.coreMesh.scale.set(r * 0.4, r * 0.4, r * 0.4);
    this.carapaceMesh.scale.set(r, r, r);
    this.haloMesh.scale.set(r * 1.8, r * 1.8, r * 1.8);

    // Enraged color pulsing
    if (titan.enraged) {
      this.carapaceMaterial.emissive.setHex(0xff3300);
      this.coreMaterial.color.setHex(0xff5500);
    } else {
      this.carapaceMaterial.emissive.setHex(0x003366);
      this.coreMaterial.color.setHex(titan.coreColor);
    }
  }

  hit(targetId: string, damage: number, impulse: number): boolean {
    const titan = this.titans.find(t => t.id === targetId || targetId === 'planet-titan');
    if (!titan || !titan.active || titan.health <= 0) return false;

    titan.health = Math.max(0, titan.health - damage);
    titan.enraged = true;
    this.sound?.('colossus-roar');

    if (damage >= 1e6) {
      this.notify?.(`Impacto titânico em [${titan.name}] · Blindagem celestial reagiu com pulso de energia.`);
    }

    if (titan.health <= 0) {
      titan.active = false;
      this.notify?.(`O Leviatã Planetário [${titan.name}] entrou em dormência cósmica.`);
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
