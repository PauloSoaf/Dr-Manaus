import { Color, CylinderGeometry, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, Object3D, TorusGeometry, Vector3 } from 'three/webgpu';

interface Particle { position: Vector3; velocity: Vector3; life: number; duration: number; scale: number; color: Color }
interface Ring { position: Vector3; life: number; duration: number; radius: number; color: Color }
interface Beam { start: Vector3; end: Vector3; life: number; size: number; color: Color }

/** Fixed instance pools: attack frequency never grows geometry, materials or draw calls. */
export class EffectPool {
  private readonly group = new Group();
  private readonly dummy = new Object3D();
  private readonly direction = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly color = new Color();
  private readonly particles: Particle[] = Array.from({ length: 240 }, () => ({ position: new Vector3(), velocity: new Vector3(), life: 0, duration: 1, scale: 1, color: new Color() }));
  private readonly rings: Ring[] = Array.from({ length: 16 }, () => ({ position: new Vector3(), life: 0, duration: 1, radius: 1, color: new Color() }));
  private readonly beams: Beam[] = Array.from({ length: 24 }, () => ({ start: new Vector3(), end: new Vector3(), life: 0, size: 1, color: new Color() }));
  private readonly particleMesh = new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 240);
  private readonly ringMesh = new InstancedMesh(new TorusGeometry(1, 0.012, 4, 72), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false }), 16);
  private readonly beamMesh = new InstancedMesh(new CylinderGeometry(1, 1, 1, 6), new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 24);
  private particleCursor = 0;
  private ringCursor = 0;
  private beamCursor = 0;

  constructor(root: Group) {
    this.group.add(this.particleMesh, this.ringMesh, this.beamMesh); root.add(this.group);
    this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
    for (const mesh of [this.particleMesh, this.ringMesh, this.beamMesh]) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage); mesh.frustumCulled = false;
      for (let i = 0; i < mesh.count; i++) { mesh.setMatrixAt(i, this.dummy.matrix); mesh.setColorAt(i, this.color.set(0xffffff)); }
    }
  }

  burst(position: Vector3, color = 0x70ffd1, size = 1, count = 28): void {
    for (let i = 0; i < Math.min(count, this.particles.length); i++) {
      const p = this.particles[this.particleCursor++ % this.particles.length];
      p.position.copy(position); p.velocity.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar((4 + Math.random() * 12) * size);
      p.life = p.duration = 0.4 + Math.random() * 0.8; p.scale = (0.05 + Math.random() * 0.14) * size; p.color.set(color);
    }
  }

  wave(position: Vector3, radius: number, color = 0x70ffd1, duration = 0.85): void {
    const ring = this.rings[this.ringCursor++ % this.rings.length];
    ring.position.copy(position); ring.position.y += 0.16; ring.radius = radius; ring.color.set(color); ring.life = ring.duration = duration;
  }

  beam(start: Vector3, end: Vector3, size = 1, color = 0x89ffe1): void {
    const beam = this.beams[this.beamCursor++ % this.beams.length];
    beam.start.copy(start); beam.end.copy(end); beam.life = 0.18; beam.size = size; beam.color.set(color);
  }

  update(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life = Math.max(0, p.life - dt);
      this.dummy.rotation.set(0, 0, 0);
      if (p.life > 0) {
        p.position.addScaledVector(p.velocity, dt); p.velocity.multiplyScalar(Math.exp(-dt * 2));
        this.dummy.position.copy(p.position); this.dummy.scale.setScalar(p.scale * Math.min(1, p.life * 4));
        this.particleMesh.setColorAt(i, this.color.copy(p.color).multiplyScalar(0.4 + 0.6 * p.life / p.duration));
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix(); this.particleMesh.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i]; ring.life = Math.max(0, ring.life - dt);
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.position.copy(ring.position);
      this.dummy.scale.setScalar(ring.life > 0 ? ring.radius * (1 - Math.pow(ring.life / ring.duration, 2)) : 0);
      this.ringMesh.setColorAt(i, this.color.copy(ring.color).multiplyScalar(ring.life / ring.duration));
      this.dummy.updateMatrix(); this.ringMesh.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < this.beams.length; i++) {
      const beam = this.beams[i]; beam.life = Math.max(0, beam.life - dt);
      this.direction.subVectors(beam.end, beam.start);
      this.dummy.position.copy(beam.start).addScaledVector(this.direction, 0.5);
      const length = this.direction.length(); this.direction.normalize();
      this.dummy.quaternion.setFromUnitVectors(this.up, this.direction);
      const thickness = beam.life > 0 ? 0.09 * beam.size * (0.35 + beam.life / 0.18) : 0;
      this.dummy.scale.set(thickness, beam.life > 0 ? length : 0, thickness);
      this.beamMesh.setColorAt(i, beam.color); this.dummy.updateMatrix(); this.beamMesh.setMatrixAt(i, this.dummy.matrix);
    }
    for (const mesh of [this.particleMesh, this.ringMesh, this.beamMesh]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const mesh of [this.particleMesh, this.ringMesh, this.beamMesh]) { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); mesh.dispose(); }
  }
}
