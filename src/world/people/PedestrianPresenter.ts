import { Vector3, type Group } from 'three/webgpu';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import type { PopulationManager, NpcBody } from '../../entities/PopulationManager';
import { HumanoidCharacter, loadHumanoidAssets } from './HumanoidCharacter';
import { Priority } from '../../player/animations/graph/AnimationGraph';
import { createAppearance } from './Appearance';

/**
 * AI-LOD for people: the nearest simulated pedestrians get a real rigged, animated body (walk,
 * run, flee, fall, talk); the rest of the crowd keeps the cheap instanced silhouettes. Bodies are
 * pooled and stay attached to the same pedestrian while it is in range, so nobody swaps faces or
 * teleports when the set changes. Distant bodies animate at a reduced rate.
 */
const MAX_BODIES = 16;
const RANGE = 70;
const FULL_RATE_RANGE = 28;

interface Presented { npc: NpcBody; body: HumanoidCharacter; last: Vector3; yaw: number; knocked: boolean; seen: boolean }

export class PedestrianPresenter {
  /** Bodies currently standing in for a pedestrian, by pedestrian id. */
  readonly bodies = new Map<string, Presented>();
  private readonly free: HumanoidCharacter[] = [];
  private readonly tmp = new Vector3();
  maxBodies = MAX_BODIES;

  constructor(private readonly root: Group, private readonly assets: Awaited<ReturnType<typeof loadHumanoidAssets>>) {}

  private seedOf(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  private acquire(npc: NpcBody): HumanoidCharacter {
    const appearance = createAppearance(this.seedOf(npc.id));
    // Reuse a pooled body only when it is the same kind; otherwise build (bodies are cheap clones).
    const body = HumanoidCharacter.createWith(this.assets, appearance);
    this.root.add(body.group);
    return body;
  }

  /** Nearest presented pedestrian within `radius` of `point` (for dialogue and reactions). */
  nearest(point: Vector3, radius: number): Presented | null {
    let best: Presented | null = null, bestD = radius * radius;
    for (const p of this.bodies.values()) {
      const d = p.body.group.position.distanceToSquared(point);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  update(dt: number, population: PopulationManager, player: Vector3, toRender: ((x: number, y: number, z: number) => Vector3) | null): void {
    for (const p of this.bodies.values()) p.seen = false;
    // Candidates: active (or knocked) pedestrians in range, nearest first.
    const candidates: { npc: NpcBody; d: number }[] = [];
    for (const npc of population.npcs) {
      if (npc.index >= population.npcCount) continue;
      const alive = npc.active || (npc.state === 'knocked' && npc.timer > 0);
      if (!alive) continue;
      const d = Math.hypot(npc.position.x - player.x, npc.position.z - player.z);
      if (d < RANGE && Math.abs(npc.position.y - player.y) < 60) candidates.push({ npc, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    const wanted = candidates.slice(0, this.maxBodies);
    for (const { npc, d } of wanted) {
      let p = this.bodies.get(npc.id);
      if (!p) {
        const body = this.acquire(npc);
        p = { npc, body, last: npc.position.clone(), yaw: 0, knocked: false, seen: true };
        this.bodies.set(npc.id, p);
      }
      p.seen = true;
      p.npc = npc;
      population.presented.add(npc.index);
      // Place on the ground under the simulated pedestrian.
      const ground = PhysicsWorld.terrainHeight(npc.position.x, npc.position.z);
      const position = toRender ? toRender(npc.position.x, ground, npc.position.z) : this.tmp.set(npc.position.x, ground, npc.position.z);
      const dx = npc.position.x - p.last.x, dz = npc.position.z - p.last.z;
      const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
      p.last.copy(npc.position);
      p.body.group.position.copy(position);
      if (speed > 0.15) {
        const target = Math.atan2(-dx, -dz);
        p.yaw += Math.atan2(Math.sin(target - p.yaw), Math.cos(target - p.yaw)) * Math.min(1, dt * 7);
      }
      if (!population.held.has(npc.id)) p.body.group.rotation.y = p.yaw;
      const knocked = npc.state === 'knocked' && npc.timer > 0;
      if (knocked && !p.knocked) p.body.play('Knockout_Fall', { priority: Priority.Critical, hold: true, fadeIn: 0.08 });
      if (!knocked && p.knocked) p.body.play('GetUp_Back', { priority: Priority.Critical, fadeIn: 0.1, fadeOut: 0.3 });
      p.knocked = knocked;
      if (!population.held.has(npc.id)) p.body.walk(Math.min(9, speed));
      p.body.holdingPhone = false;
      p.body.update(dt, d < FULL_RATE_RANGE ? 0 : 0.08);
    }
    // Release bodies whose pedestrian left range or vanished.
    for (const [id, p] of this.bodies) {
      if (p.seen) continue;
      population.presented.delete(p.npc.index);
      p.body.dispose();
      this.bodies.delete(id);
    }
    void this.free;
  }

  dispose(): void {
    for (const p of this.bodies.values()) p.body.dispose();
    this.bodies.clear();
  }
}
