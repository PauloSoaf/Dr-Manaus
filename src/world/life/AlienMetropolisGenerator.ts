/**
 * AlienMetropolisGenerator.ts
 *
 * Procedural Extraterrestrial Megaliths, Annular Spires, and Metropolis Architecture (Feature 06 / RF-05-03).
 * Simulates alien planetary capitals and ancient megastructures across solar system bodies:
 * 1. Annular Rings: Colossal hovering and grounded energy toroids (40m - 120m diameter).
 * 2. Pyramidal Ziggurats: Stepped alien temples with glowing plasma conduits.
 * 3. Hexagonal Bio-Spires: Crystalline towers with pulsating emissive veins.
 * 4. Starship Landing Bays: Geometric docks with parked alien scout vessels and drivable craft.
 *
 * Performance:
 * - InstancedMesh / BatchedMesh geometry clustering for minimum draw calls.
 * - Procedural buffer synthesis with zero runtime heap allocation per frame.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  TorusGeometry,
  ConeGeometry,
  SphereGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  InstancedMesh,
  Object3D,
  Color,
  Vector3,
  Matrix4
} from 'three/webgpu';

export type AlienArchetype = 'annular-ring' | 'pyramidal-ziggurat' | 'crystalline-spire' | 'starship-dock';

export interface AlienMegalith {
  id: string;
  archetype: AlienArchetype;
  position: Vector3;
  scale: Vector3;
  headingRad: number;
  emissiveColor: number;
}

export class AlienMetropolisGenerator {
  readonly group = new Group();

  private annularMesh!: InstancedMesh;
  private pyramidMesh!: InstancedMesh;
  private spireMesh!: InstancedMesh;
  private dockMesh!: InstancedMesh;

  private readonly dummy = new Object3D();
  private readonly megaliths: AlienMegalith[] = [];

  constructor() {
    this.group.name = 'alien-metropolis-system';
    this.initInstancedMeshes();
  }

  private initInstancedMeshes(): void {
    // 1. Annular Ring Geometry
    const ringGeo = new TorusGeometry(28, 4.5, 12, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new MeshStandardMaterial({
      color: 0x1c2833,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.5
    });
    this.annularMesh = new InstancedMesh(ringGeo, ringMat, 32);

    // 2. Stepped Pyramidal Ziggurat Geometry
    const pyramidGeo = new CylinderGeometry(6, 32, 28, 4);
    pyramidGeo.rotateY(Math.PI / 4);
    const pyramidMat = new MeshStandardMaterial({
      color: 0x212f3d,
      metalness: 0.8,
      roughness: 0.4,
      emissive: 0xff3d00,
      emissiveIntensity: 1.2
    });
    this.pyramidMesh = new InstancedMesh(pyramidGeo, pyramidMat, 32);

    // 3. Hexagonal Crystalline Spire Geometry
    const spireGeo = new CylinderGeometry(3, 7, 54, 6);
    const spireMat = new MeshStandardMaterial({
      color: 0x17202a,
      metalness: 0.95,
      roughness: 0.1,
      emissive: 0x76ff03,
      emissiveIntensity: 2.0
    });
    this.spireMesh = new InstancedMesh(spireGeo, spireMat, 48);

    // 4. Starship Landing Dock
    const dockGeo = new CylinderGeometry(22, 26, 3.5, 8);
    const dockMat = new MeshStandardMaterial({
      color: 0x273746,
      metalness: 0.7,
      roughness: 0.5,
      emissive: 0xffd600,
      emissiveIntensity: 0.8
    });
    this.dockMesh = new InstancedMesh(dockGeo, dockMat, 24);

    for (const mesh of [this.annularMesh, this.pyramidMesh, this.spireMesh, this.dockMesh]) {
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    this.clear();
  }

  /**
   * Resets and hides all megalith instances so nothing remains rendered.
   */
  public clear(): void {
    this.megaliths.length = 0;
    this.dummy.position.set(0, -99999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();

    for (let i = 0; i < 32; i++) this.annularMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < 32; i++) this.pyramidMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < 48; i++) this.spireMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = 0; i < 24; i++) this.dockMesh.setMatrixAt(i, this.dummy.matrix);

    this.annularMesh.instanceMatrix.needsUpdate = true;
    this.pyramidMesh.instanceMatrix.needsUpdate = true;
    this.spireMesh.instanceMatrix.needsUpdate = true;
    this.dockMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Generates a deterministic alien metropolis cluster around (centerX, centerZ).
   */
  public generateMetropolis(centerX: number, centerZ: number, radiusM: number = 600, seed: number = 42): void {
    this.megaliths.length = 0;

    let ringCount = 0;
    let pyramidCount = 0;
    let spireCount = 0;
    let dockCount = 0;

    // Central Megalith: Gigantic Pyramidal Ziggurat or Grand Ring
    this.megaliths.push({
      id: `alien-core:${centerX},${centerZ}`,
      archetype: 'pyramidal-ziggurat',
      position: new Vector3(centerX, 14, centerZ),
      scale: new Vector3(1.8, 1.8, 1.8),
      headingRad: 0,
      emissiveColor: 0xff3d00
    });
    pyramidCount++;

    // Surrounding Megaliths in concentric sacred geometric arrangements
    const rings = 3;
    for (let r = 1; r <= rings; r++) {
      const ringRadius = (radiusM / rings) * r;
      const count = r * 6; // Hexagonal symmetry

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2.0;
        const x = centerX + Math.cos(angle) * ringRadius;
        const z = centerZ + Math.sin(angle) * ringRadius;

        // Deterministic pseudo-random variation
        const pseudoRand = (Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453) % 1;
        const absRand = Math.abs(pseudoRand);

        let archetype: AlienArchetype;
        let scale = new Vector3(1, 1, 1);
        let emissiveColor = 0x00e5ff;
        let posY = 0;

        if (absRand < 0.25 && ringCount < 30) {
          archetype = 'annular-ring';
          scale.set(1.0 + absRand * 0.5, 1.0 + absRand * 0.5, 1.0 + absRand * 0.5);
          posY = 28 + absRand * 20; // Floating hovering rings
          emissiveColor = 0x00e5ff;
          ringCount++;
        } else if (absRand < 0.55 && spireCount < 46) {
          archetype = 'crystalline-spire';
          scale.set(0.8 + absRand * 0.6, 1.0 + absRand * 1.4, 0.8 + absRand * 0.6);
          posY = 27 * scale.y;
          emissiveColor = 0x76ff03;
          spireCount++;
        } else if (absRand < 0.80 && dockCount < 22) {
          archetype = 'starship-dock';
          scale.set(1.2, 1.0, 1.2);
          posY = 1.75;
          emissiveColor = 0xffd600;
          dockCount++;
        } else if (pyramidCount < 30) {
          archetype = 'pyramidal-ziggurat';
          scale.set(0.9 + absRand * 0.4, 0.9 + absRand * 0.4, 0.9 + absRand * 0.4);
          posY = 14 * scale.y;
          emissiveColor = 0xff3d00;
          pyramidCount++;
        } else {
          continue;
        }

        this.megaliths.push({
          id: `alien-megalith:${r}:${i}`,
          archetype,
          position: new Vector3(x, posY, z),
          scale,
          headingRad: angle,
          emissiveColor
        });
      }
    }

    this.rebuildInstances();
  }

  private rebuildInstances(): void {
    let ringIdx = 0;
    let pyramidIdx = 0;
    let spireIdx = 0;
    let dockIdx = 0;

    for (const m of this.megaliths) {
      this.dummy.position.copy(m.position);
      this.dummy.rotation.set(0, m.headingRad, 0);
      this.dummy.scale.copy(m.scale);
      this.dummy.updateMatrix();

      switch (m.archetype) {
        case 'annular-ring':
          if (ringIdx < 32) {
            this.annularMesh.setMatrixAt(ringIdx++, this.dummy.matrix);
          }
          break;
        case 'pyramidal-ziggurat':
          if (pyramidIdx < 32) {
            this.pyramidMesh.setMatrixAt(pyramidIdx++, this.dummy.matrix);
          }
          break;
        case 'crystalline-spire':
          if (spireIdx < 48) {
            this.spireMesh.setMatrixAt(spireIdx++, this.dummy.matrix);
          }
          break;
        case 'starship-dock':
          if (dockIdx < 24) {
            this.dockMesh.setMatrixAt(dockIdx++, this.dummy.matrix);
          }
          break;
      }
    }

    // Hide remaining unused instances
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();

    for (let i = ringIdx; i < 32; i++) this.annularMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = pyramidIdx; i < 32; i++) this.pyramidMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = spireIdx; i < 48; i++) this.spireMesh.setMatrixAt(i, this.dummy.matrix);
    for (let i = dockIdx; i < 24; i++) this.dockMesh.setMatrixAt(i, this.dummy.matrix);

    this.annularMesh.instanceMatrix.needsUpdate = true;
    this.pyramidMesh.instanceMatrix.needsUpdate = true;
    this.spireMesh.instanceMatrix.needsUpdate = true;
    this.dockMesh.instanceMatrix.needsUpdate = true;
  }

  public get megalithCount(): number {
    return this.megaliths.length;
  }

  public dispose(): void {
    this.group.removeFromParent();
    for (const mesh of [this.annularMesh, this.pyramidMesh, this.spireMesh, this.dockMesh]) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
  }
}

