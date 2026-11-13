/**
 * PlanetaryRupturePresentation.ts
 *
 * Full-scale visual presentation of planetary catastrophic rupture with 7 distinct phases:
 * Phase 1: Glowing fissure network across planetary surface (0.0s - 1.5s)
 * Phase 2: Incandescent core glow exposure beneath expanding faults (1.5s - 3.0s)
 * Phase 3: Macroscopic 3D crust plate detachment (6-8 large chunks) (3.0s - 4.5s)
 * Phase 4: Intact globe suppression / hidden (at 4.5s)
 * Phase 5: Deterministic fragment ejection & radial drift (4.5s - 7.0s)
 * Phase 6: Expanding energetic shockwave shell & high-velocity particle field (6.0s - 9.0s)
 * Phase 7: Persistent navigable Keplerian debris belt / ring (7.0s+)
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three/webgpu';
import type { MacroBodyFracturePlan, OrbitalDebrisFragment } from '../../world/destruction/MacroBodyFractureService';

export type RuptureVisualPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ActiveRuptureSession {
  readonly bodyId: string;
  readonly plan: MacroBodyFracturePlan;
  readonly radiusM: number;
  timeS: number;
  phase: RuptureVisualPhase;
  intactGlobeHidden: boolean;
  positionM: Vector3;
  visuals: RuptureVisualSet;
}

const CHUNK_COUNT = 8;
const DEBRIS_CAPACITY = 128;

interface RuptureVisualSet {
  readonly root: Group;
  readonly fissureLines: LineSegments;
  readonly coreSphere: Mesh;
  readonly shockwaveSphere: Mesh;
  readonly crustChunksMesh: InstancedMesh;
  readonly debrisRingMesh: InstancedMesh;
}

export class PlanetaryRupturePresentation {
  readonly root = new Group();

  private readonly activeSessions = new Map<string, ActiveRuptureSession>();

  // Visual sub-systems
  private readonly fissureGroup = new Group();
  private readonly coreGroup = new Group();
  private readonly chunksGroup = new Group();
  private readonly shockwaveGroup = new Group();
  private readonly debrisGroup = new Group();

  // Reusable meshes per active rupture
  private fissureLines: LineSegments;
  private coreSphere: Mesh;
  private shockwaveSphere: Mesh;
  private crustChunksMesh: InstancedMesh;
  private debrisRingMesh: InstancedMesh;

  // Reusable scratch objects
  private readonly dummyMatrix = new Matrix4();
  private readonly dummyVec = new Vector3();
  private readonly dummyQuat = new Quaternion();
  private readonly dummyScale = new Vector3();

  constructor(parent?: Group) {
    this.root.name = 'PlanetaryRupturePresentation';

    // 1. Fissure lines (Phase 1 & 2)
    const fissureGeo = new BufferGeometry();
    const fissureVerts = new Float32Array(512 * 6);
    // Deterministic fissure geometry pattern on unit sphere
    for (let i = 0; i < 512; i++) {
      const theta1 = (i * 1.618) % (Math.PI * 2);
      const phi1 = Math.acos(2 * ((i * 37) % 100) / 100 - 1);
      const theta2 = theta1 + 0.15;
      const phi2 = phi1 + 0.12;

      fissureVerts[i * 6 + 0] = Math.sin(phi1) * Math.cos(theta1);
      fissureVerts[i * 6 + 1] = Math.cos(phi1);
      fissureVerts[i * 6 + 2] = Math.sin(phi1) * Math.sin(theta1);

      fissureVerts[i * 6 + 3] = Math.sin(phi2) * Math.cos(theta2);
      fissureVerts[i * 6 + 4] = Math.cos(phi2);
      fissureVerts[i * 6 + 5] = Math.sin(phi2) * Math.sin(theta2);
    }
    fissureGeo.setAttribute('position', new Float32BufferAttribute(fissureVerts, 3));
    this.fissureLines = new LineSegments(
      fissureGeo,
      new LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })
    );
    this.fissureGroup.add(this.fissureLines);

    // 2. Incandescent core sphere (Phase 2 & 3)
    const coreGeo = new SphereGeometry(1, 24, 16);
    this.coreSphere = new Mesh(
      coreGeo,
      new MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })
    );
    this.coreGroup.add(this.coreSphere);

    // 3. 3D Crust Chunks (Phase 3 & 5) - 8 large tectonic plates
    const chunkGeo = new SphereGeometry(1, 16, 12, 0, Math.PI / 2, 0, Math.PI / 2);
    this.crustChunksMesh = new InstancedMesh(
      chunkGeo,
      new MeshBasicMaterial({ color: 0x5a4632, side: DoubleSide }),
      CHUNK_COUNT
    );
    this.crustChunksMesh.count = 0;
    this.chunksGroup.add(this.crustChunksMesh);

    // 4. Shockwave sphere (Phase 6)
    const shockwaveGeo = new SphereGeometry(1, 32, 24);
    this.shockwaveSphere = new Mesh(
      shockwaveGeo,
      new MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    );
    this.shockwaveGroup.add(this.shockwaveSphere);

    // 5. Persistent Keplerian Debris Ring (Phase 7)
    const debrisGeo = new SphereGeometry(1, 8, 6);
    this.debrisRingMesh = new InstancedMesh(
      debrisGeo,
      new MeshBasicMaterial({ color: 0x887766 }),
      DEBRIS_CAPACITY
    );
    this.debrisRingMesh.count = 0;
    this.debrisGroup.add(this.debrisRingMesh);

    if (parent) {
      parent.add(this.root);
    }
  }

  private createVisualSet(): RuptureVisualSet {
    const root = new Group();
    const fissureLines = new LineSegments(
      this.fissureLines.geometry,
      (this.fissureLines.material as LineBasicMaterial).clone()
    );
    const coreSphere = new Mesh(
      this.coreSphere.geometry,
      (this.coreSphere.material as MeshBasicMaterial).clone()
    );
    const shockwaveSphere = new Mesh(
      this.shockwaveSphere.geometry,
      (this.shockwaveSphere.material as MeshBasicMaterial).clone()
    );
    const crustChunksMesh = new InstancedMesh(
      this.crustChunksMesh.geometry,
      (this.crustChunksMesh.material as MeshBasicMaterial).clone(),
      CHUNK_COUNT
    );
    const debrisRingMesh = new InstancedMesh(
      this.debrisRingMesh.geometry,
      (this.debrisRingMesh.material as MeshBasicMaterial).clone(),
      DEBRIS_CAPACITY
    );
    crustChunksMesh.count = 0;
    debrisRingMesh.count = 0;
    root.add(fissureLines, coreSphere, shockwaveSphere, crustChunksMesh, debrisRingMesh);
    return { root, fissureLines, coreSphere, shockwaveSphere, crustChunksMesh, debrisRingMesh };
  }

  /**
   * Triggers a live 7-phase rupture presentation for a celestial body.
   */
  startRupture(bodyId: string, planOrRadius?: MacroBodyFracturePlan | number, radiusM = 6371000): void {
    const radius = typeof planOrRadius === 'number' ? planOrRadius : radiusM;
    const plan = typeof planOrRadius === 'object' && planOrRadius ? planOrRadius : ({ planId: `rupture_${bodyId}`, bodyId, cuts: [] } as any);
    const previous = this.activeSessions.get(bodyId);
    if (previous) this.disposeVisualSet(previous.visuals);
    const session: ActiveRuptureSession = {
      bodyId,
      plan,
      radiusM: radius,
      timeS: 0,
      phase: 1,
      intactGlobeHidden: false,
      positionM: new Vector3(),
      visuals: this.createVisualSet(),
    };
    this.root.add(session.visuals.root);
    this.activeSessions.set(bodyId, session);
  }

  /**
   * Initializes or loads a body already in ruptured state (Phase 7 persistent ring).
   */
  loadPersistedRupture(bodyId: string, planOrRadius?: MacroBodyFracturePlan | number, radiusM = 6371000): void {
    const radius = typeof planOrRadius === 'number' ? planOrRadius : radiusM;
    const plan = typeof planOrRadius === 'object' && planOrRadius ? planOrRadius : ({ planId: `rupture_${bodyId}`, bodyId, cuts: [] } as any);
    const previous = this.activeSessions.get(bodyId);
    if (previous) this.disposeVisualSet(previous.visuals);
    const session: ActiveRuptureSession = {
      bodyId,
      plan,
      radiusM: radius,
      timeS: 10.0, // beyond initial animation -> immediate phase 7
      phase: 7,
      intactGlobeHidden: true,
      positionM: new Vector3(),
      visuals: this.createVisualSet(),
    };
    this.root.add(session.visuals.root);
    this.activeSessions.set(bodyId, session);
  }

  /**
   * Restores a ruptured body, clearing its active session and visuals.
   */
  restore(bodyId: string): void {
    const session = this.activeSessions.get(bodyId);
    if (!session) return;
    this.disposeVisualSet(session.visuals);
    this.activeSessions.delete(bodyId);
  }

  isRuptured(bodyId: string): boolean {
    return this.activeSessions.has(bodyId);
  }

  bodyIds(): readonly string[] {
    return [...this.activeSessions.keys()];
  }

  setBodyPosition(bodyId: string, positionM: Vector3): void {
    this.activeSessions.get(bodyId)?.positionM.copy(positionM);
  }

  bodyPosition(bodyId: string): Vector3 | undefined {
    const position = this.activeSessions.get(bodyId)?.positionM;
    return position?.clone();
  }

  isGlobeSuppressed(bodyId: string): boolean {
    const session = this.activeSessions.get(bodyId);
    return session ? session.intactGlobeHidden : false;
  }

  currentPhase(bodyId: string): RuptureVisualPhase | 0 {
    return this.activeSessions.get(bodyId)?.phase ?? 0;
  }

  /**
   * Frame update driving the 7 observable phases of all active ruptures.
   */
  update(dt: number, camera?: PerspectiveCamera, bodyPositionM?: Vector3): void {
    for (const session of this.activeSessions.values()) {
      const { fissureLines, coreSphere, shockwaveSphere, crustChunksMesh, debrisRingMesh } = session.visuals;
      session.timeS += dt;
      if (bodyPositionM) {
        session.positionM.copy(bodyPositionM);
      }
      const pos = session.positionM;
      const t = session.timeS;
      const R = session.radiusM;

      // Phase 1: Glowing fissure network (0.0s - 1.5s)
      if (t < 1.5) {
        session.phase = 1;
        fissureLines.visible = true;
        coreSphere.visible = false;
        shockwaveSphere.visible = false;
        crustChunksMesh.visible = false;
        debrisRingMesh.visible = false;

        const progress = t / 1.5;
        fissureLines.position.copy(pos);
        fissureLines.scale.setScalar(R * 1.002);
        const mat = fissureLines.material as LineBasicMaterial;
        mat.opacity = progress * 0.9;
        mat.color.setHex(0xff5500);
      }
      // Phase 2: Incandescent core glow exposure (1.5s - 3.0s)
      else if (t < 3.0) {
        session.phase = 2;
        fissureLines.visible = true;
        coreSphere.visible = true;
        shockwaveSphere.visible = false;
        crustChunksMesh.visible = false;
        debrisRingMesh.visible = false;

        const progress = (t - 1.5) / 1.5;
        fissureLines.position.copy(pos);
        fissureLines.scale.setScalar(R * (1.002 + progress * 0.03));
        (fissureLines.material as LineBasicMaterial).opacity = 0.9 + progress * 0.1;
        (fissureLines.material as LineBasicMaterial).color.setHex(0xffaa00);

        coreSphere.position.copy(pos);
        coreSphere.scale.setScalar(R * (0.85 + progress * 0.1));
        (coreSphere.material as MeshBasicMaterial).opacity = progress * 0.85;
      }
      // Phase 3: Macroscopic crust chunks splitting & detachment (3.0s - 4.5s)
      else if (t < 4.5) {
        session.phase = 3;
        fissureLines.visible = true;
        coreSphere.visible = true;
        shockwaveSphere.visible = false;
        crustChunksMesh.visible = true;
        debrisRingMesh.visible = false;

        const progress = (t - 3.0) / 1.5;
        // Position 8 octant crust chunks moving outward radially
        const separationDist = progress * R * 0.15;
        this.updateCrustChunks(session, pos, R, separationDist, progress);
      }
      // Phase 4: Intact globe suppression (at 4.5s)
      // Phase 5: Fragment drift & core explosion (4.5s - 6.0s)
      else if (t < 6.0) {
        session.phase = t < 5.0 ? 4 : 5;
        session.intactGlobeHidden = true; // Globe explicitly hidden!

        fissureLines.visible = false;
        coreSphere.visible = true;
        shockwaveSphere.visible = false;
        crustChunksMesh.visible = true;
        debrisRingMesh.visible = false;

        const progress = (t - 4.5) / 1.5;
        const driftDist = R * 0.15 + progress * R * 0.45;
        this.updateCrustChunks(session, pos, R, driftDist, 1.0 + progress);
        coreSphere.position.copy(pos);
        coreSphere.scale.setScalar(R * (0.95 + progress * 0.3));
        (coreSphere.material as MeshBasicMaterial).opacity = Math.max(0, 0.85 - progress * 0.4);
      }
      // Phase 6: Expanding shockwave shell (6.0s - 7.0s)
      else if (t < 7.0) {
        session.phase = 6;
        session.intactGlobeHidden = true;

        fissureLines.visible = false;
        coreSphere.visible = false;
        shockwaveSphere.visible = true;
        crustChunksMesh.visible = true;
        debrisRingMesh.visible = true;

        const progress = (t - 6.0) / 1.0;
        // Shockwave expands up to 3x planet radius
        const shockRadius = R * (1.2 + progress * 2.2);
        shockwaveSphere.position.copy(pos);
        shockwaveSphere.scale.setScalar(shockRadius);
        (shockwaveSphere.material as MeshBasicMaterial).opacity = (1.0 - progress) * 0.75;

        this.updateCrustChunks(session, pos, R, R * 0.6 + progress * R * 0.3, 2.0);
        this.updateDebrisRing(session, pos, progress);
      }
      // Phase 7: Persistent Keplerian Debris Ring (7.0s+)
      else {
        session.phase = 7;
        session.intactGlobeHidden = true;

        fissureLines.visible = false;
        coreSphere.visible = false;
        shockwaveSphere.visible = false;
        crustChunksMesh.visible = false;
        debrisRingMesh.visible = true;

        this.updateDebrisRing(session, pos, 1.0);
      }
    }
  }

  private updateCrustChunks(session: ActiveRuptureSession, bodyPos: Vector3, radiusM: number, separationDist: number, scaleMultiplier: number): void {
    let idx = 0;
    // 8 octants on sphere
    const octants = [
      [1, 1, 1], [-1, 1, 1], [1, -1, 1], [-1, -1, 1],
      [1, 1, -1], [-1, 1, -1], [1, -1, -1], [-1, -1, -1],
    ];

    for (let i = 0; i < CHUNK_COUNT; i++) {
      const [ox, oy, oz] = octants[i];
      const norm = Math.hypot(ox, oy, oz);
      const nx = ox / norm;
      const ny = oy / norm;
      const nz = oz / norm;

      const px = bodyPos.x + nx * (radiusM * 0.9 + separationDist);
      const py = bodyPos.y + ny * (radiusM * 0.9 + separationDist);
      const pz = bodyPos.z + nz * (radiusM * 0.9 + separationDist);

      this.dummyVec.set(px, py, pz);
      this.dummyQuat.setFromAxisAngle(new Vector3(nx, ny, nz), i * 0.2);
      this.dummyScale.setScalar(radiusM * 0.5 * Math.max(0.6, 1.2 - scaleMultiplier * 0.2));

      this.dummyMatrix.compose(this.dummyVec, this.dummyQuat, this.dummyScale);
      session.visuals.crustChunksMesh.setMatrixAt(idx++, this.dummyMatrix);
    }

    session.visuals.crustChunksMesh.count = idx;
    session.visuals.crustChunksMesh.instanceMatrix.needsUpdate = true;
  }

  private updateDebrisRing(session: ActiveRuptureSession, bodyPos: Vector3, ringAlpha: number): void {
    const frags = session.plan?.debrisRing?.fragments ?? [];
    if (frags.length === 0) {
      // Fallback synthetic keplerian debris ring
      const syntheticCount = 48;
      let idx = 0;
      const rotAngle = session.timeS * 0.05;
      for (let i = 0; i < syntheticCount; i++) {
        const angle = (i / syntheticCount) * Math.PI * 2 + rotAngle * (1.0 + (i % 5) * 0.1);
        const ringR = session.radiusM * (1.5 + (i % 6) * 0.15);
        const px = bodyPos.x + Math.cos(angle) * ringR;
        const py = bodyPos.y + (((i % 7) - 3) / 3) * session.radiusM * 0.06;
        const pz = bodyPos.z + Math.sin(angle) * ringR;

        this.dummyVec.set(px, py, pz);
        this.dummyQuat.setFromAxisAngle(new Vector3(0, 1, 0), angle + i);
        const fragScale = Math.max(session.radiusM * 0.02, 50000) * ringAlpha;
        this.dummyScale.setScalar(fragScale);

        this.dummyMatrix.compose(this.dummyVec, this.dummyQuat, this.dummyScale);
        session.visuals.debrisRingMesh.setMatrixAt(idx++, this.dummyMatrix);
      }
        session.visuals.debrisRingMesh.count = idx;
        session.visuals.debrisRingMesh.instanceMatrix.needsUpdate = true;
      return;
    }

    const count = Math.min(frags.length, DEBRIS_CAPACITY);
    let idx = 0;

    const rotAngle = session.timeS * 0.05;

    for (let i = 0; i < count; i++) {
      const frag = frags[i];
      const basePos = frag.positionBodyFixedM;
      const r = Math.hypot(basePos[0], basePos[2]);
      const initialTheta = Math.atan2(basePos[2], basePos[0]);
      const curTheta = initialTheta + rotAngle * (1.0 + (i % 5) * 0.1);

      const px = bodyPos.x + Math.cos(curTheta) * r;
      const py = bodyPos.y + basePos[1] * 0.3;
      const pz = bodyPos.z + Math.sin(curTheta) * r;

      this.dummyVec.set(px, py, pz);
      this.dummyQuat.setFromAxisAngle(new Vector3(0, 1, 0), curTheta + i);
      const fragScale = Math.max(session.radiusM * 0.02, frag.radiusM * 4.0) * ringAlpha;
      this.dummyScale.setScalar(fragScale);

      this.dummyMatrix.compose(this.dummyVec, this.dummyQuat, this.dummyScale);
      session.visuals.debrisRingMesh.setMatrixAt(idx++, this.dummyMatrix);
    }

    session.visuals.debrisRingMesh.count = idx;
    session.visuals.debrisRingMesh.instanceMatrix.needsUpdate = true;
  }

  private disposeVisualSet(visuals: RuptureVisualSet): void {
    visuals.root.removeFromParent();
    (visuals.fissureLines.material as LineBasicMaterial).dispose();
    (visuals.coreSphere.material as MeshBasicMaterial).dispose();
    (visuals.shockwaveSphere.material as MeshBasicMaterial).dispose();
    (visuals.crustChunksMesh.material as MeshBasicMaterial).dispose();
    (visuals.debrisRingMesh.material as MeshBasicMaterial).dispose();
  }

  dispose(): void {
    for (const session of this.activeSessions.values()) this.disposeVisualSet(session.visuals);
    this.fissureLines.geometry.dispose();
    (this.fissureLines.material as LineBasicMaterial).dispose();
    this.coreSphere.geometry.dispose();
    (this.coreSphere.material as MeshBasicMaterial).dispose();
    this.shockwaveSphere.geometry.dispose();
    (this.shockwaveSphere.material as MeshBasicMaterial).dispose();
    this.crustChunksMesh.geometry.dispose();
    (this.crustChunksMesh.material as MeshBasicMaterial).dispose();
    this.debrisRingMesh.geometry.dispose();
    (this.debrisRingMesh.material as MeshBasicMaterial).dispose();
    this.root.removeFromParent();
    this.activeSessions.clear();
  }
}
