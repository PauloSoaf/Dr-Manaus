import { Group, Mesh, SphereGeometry, TorusGeometry, Vector3 } from 'three/webgpu';
import type { Collider, Landmark } from '../../core/types';
import { LANDMARKS } from '../geodata/geodata';
import { GeometryBatch, treeProxy } from './GeometryBatch';
import { TEATRO_COLLIDERS, createTeatroFar, createTeatroMedium, createTeatroNear } from './largo/teatro';
import { createBridge, LANDMARK_BUILDERS, PONTA_COLLIDERS } from './models';
import { ARENA_COLLIDERS, createArenaSilhouette } from './arena';
import { bridgeDeckColliders, createBridgeDistant } from './bridge';
import { AuthoredDestruction } from '../destruction/AuthoredDestruction';

interface LandmarkNode { landmark: Landmark; anchor: Group; distant: Group; detailed?: Group; visibleDetail: boolean }

function silhouette(id: string): Group {
  if (id === 'teatro') return createTeatroFar();
  if (id === 'ponte') return createBridgeDistant();
  if (id === 'arena') return createArenaSilhouette();
  const b = new GeometryBatch();
  if (id === 'musa') {
    for (const x of [-5, 5]) for (const z of [-5, 5]) b.box('steel', x, 22, z, .7, 44, .7);
    for (const y of [15, 30, 44]) b.box('bark', 0, y, 0, 14, .6, 14);
    for (let i = 0; i < 65; i++) {
      const angle = i * 2.399, r = 40 + Math.sqrt(i / 65) * 220;
      treeProxy(b, Math.cos(angle) * r, Math.sin(angle) * r, 24 + (i * 7 % 17));
    }
  } else if (id === 'bosque') {
    for (let i = 0; i < 75; i++) {
      const angle = i * 2.399, r = 25 + Math.sqrt(i / 75) * 140;
      treeProxy(b, Math.cos(angle) * r, Math.sin(angle) * r, 14 + (i * 11 % 17));
    }
  } else if (id === 'mercado') {
    for (const x of [-29, 0, 29]) {
      const width = x === 0 ? 32 : 23, height = x === 0 ? 12 : 9;
      b.entity(`landmark:mercado/pavilion/${x}`, { x, y: height / 2, z: 0, width, height, depth: 57 }, () => { b.box('cream', x, 5, 0, 25, 10, 55); b.sphere('red', x, 10, 0, 13, 1, .7, 2.2); });
    }
  } else if (id === 'palacio') {
    b.box('gold', 0, 7, -9, 65, 14, 35); b.box('red', 0, 15, -9, 67, 2, 37);
    for (const x of [-27, 0, 27]) b.box('cream', x, 17, 6, 15, 2, 15);
  } else if (id === 'relogio') {
    b.cylinder('cream', 0, 7, 0, 1, 2, 14, 6); b.box('white', 0, 14, 0, 5, 3, 5); b.cylinder('green', 0, 16, 0, 0, 3.5, 2, 4);
  } else if (id === 'ponta') {
    // The residential skyline behind the beach is real compiled geometry now; only the sand, the
    // calçadão, the pier and the anfiteatro need standing in for, on the surveyed .51 rad shore.
    // Matches the detailed orla: the beach is 112 m wide and 720 m long, sits above the river
    // surface at y = 0.06, and the old 130 m stone shelf that ran 250 m offshore is gone.
    b.box('sand', -129.7, .12, -162.4, 112, .3, 720, .51);
    b.box('cream', -60.8, .2, -201, 56, .4, 680, .51);
    b.entity('landmark:ponta/pier', undefined, () => b.box('bark', -211.9, 1.5, -225.2, 190, .55, 12, .51));
    b.entity('landmark:ponta/amphitheatre', undefined, () => b.box('stone', 165.8, 2.2, -92.8, 140, 4.4, 210, .51));
  } else if (id === 'iranduba') {
    b.box('leaf', 0, .04, 0, 900, .08, 700);
    for (let row = -3; row <= 3; row++) for (let col = -4; col <= 4; col++) {
      if (!row || !col) continue;
      const h = 6 + ((row * row + col * col) % 4) * 2.4;
      const x = col * 76 + (row % 2) * 11, z = row * 72 + (col % 2) * 8;
      const width = 34 + ((row + col + 20) % 3) * 7, depth = 27 + ((row - col + 20) % 3) * 6;
      b.entity(`landmark:iranduba/house/${row},${col}`, { x, y: h / 2, z, width, height: h, depth }, () => b.box((row + col) % 2 ? 'cream' : 'salmon', x, h / 2, z, width, h, depth));
    }
    b.cylinder('white', 0, 18, 0, 5.6, 4.4, 6.5, 14);
  } else if (id === 'porto') {
    b.box('cream', 0, 6, -14, 115, 12, 30);
    for (const x of [-48, 48]) { b.box('stone', x, 1, 216, 15, 2, 365); b.box('red', x, 3, 445, 25, 8, 55); }
  } else if (id === 'encontro') {
    b.box('white', 0, 3, 0, 15, 7, 55); b.box('red', 0, 7, 0, 15, 1, 45);
  }
  return b.build(`${id} distant landmark`);
}

function disposeGroup(group: Group): void {
  group.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
  group.removeFromParent();
}

/** Landmarks keep cheap silhouettes, lazily build close detail, and evict distant detail. */
export class LandmarkManager {
  readonly colliders: Collider[] = [];
  private readonly allColliders: Collider[] = [];
  private readonly nodes: LandmarkNode[] = [];
  private timer = 0;
  private readonly destruction = new AuthoredDestruction();
  private readonly lastPlayer = new Vector3();
  get destroyedCount(): number { return this.destruction.destroyedCount; }
  get destructionStats() { return this.destruction.stats; }
  isDestroyed(id: string): boolean { return this.destruction.isDestroyed(id); }

  constructor(private readonly root: Group) {
    for (const landmark of LANDMARKS) {
      const anchor = new Group(); anchor.name = landmark.name; anchor.position.set(landmark.x, 0, landmark.z);
      const distant = silhouette(landmark.id); anchor.add(distant);
      const node: LandmarkNode = { landmark, anchor, distant, visibleDetail: false };
      if (landmark.id === 'teatro') {
        node.detailed = createTeatroNear();
        anchor.add(node.detailed); node.visibleDetail = true; distant.visible = false;
      }
      this.nodes.push(node); root.add(anchor);
      this.addColliders(landmark);
      this.destruction.register(distant, `landmark:${landmark.id}`, landmark);
      if (node.detailed) this.destruction.register(node.detailed, `landmark:${landmark.id}`, landmark);
    }
    for (const collider of this.allColliders) this.destruction.addCollider(collider);
    this.refreshColliders();
  }

  update(player: Vector3, dt: number): void {
    this.lastPlayer.copy(player);
    this.timer -= dt; if (this.timer > 0) return; this.timer = .2;
    let built = false;
    for (const node of this.nodes) {
      const distance = Math.hypot(player.x - node.landmark.x, player.z - node.landmark.z);
      node.anchor.visible = distance < (node.landmark.id === 'ponte' ? 28000 : 22000);
      if (!node.anchor.visible) continue;
      // Hysteresis ensures smooth flight near the detail boundary without repeated rebuilds.
      // The crossing is 6.4 km end to end, so it earns a far larger detail radius than a building.
      const detailEnter = node.landmark.id === 'ponte' ? 4200 : node.landmark.id === 'ponta' ? 3000 : node.landmark.id === 'iranduba' ? 2200 : 1400;
      const detailExit = node.landmark.id === 'ponte' ? 4800 : node.landmark.id === 'ponta' ? 3400 : node.landmark.id === 'iranduba' ? 2500 : 1750;
      const near = distance < (node.visibleDetail ? detailExit : detailEnter);
      if (near && !node.detailed && !built) {
        node.detailed = node.landmark.id === 'teatro' ? createTeatroNear() : LANDMARK_BUILDERS[node.landmark.id]?.();
        if (node.detailed) { node.anchor.add(node.detailed); this.destruction.register(node.detailed, `landmark:${node.landmark.id}`, node.landmark); built = true; }
      }
      node.visibleDetail = near && !!node.detailed;
      node.distant.visible = !node.visibleDetail;
      if (node.detailed) {
        node.detailed.visible = node.visibleDetail;
        if (distance > detailExit + 3000) { this.destruction.unregister(node.detailed); disposeGroup(node.detailed); node.detailed = undefined; }
      }
      node.anchor.traverse(object => { if (object instanceof Mesh) object.castShadow = distance < 350; });
    }
    this.refreshColliders();
  }

  private refreshColliders(): void {
    this.colliders.length = 0;
    this.destruction.appendColliders(this.colliders, this.lastPlayer, 450);
  }

  appendBlastColliders(out:Collider[],position:Vector3,radius:number):void{this.destruction.appendColliders(out,position,radius);}

  destroy(id: string): boolean {
    if (!this.destruction.destroy(id)) return false;
    for (let i = this.colliders.length - 1; i >= 0; i--) if (this.colliders[i].id === id) this.colliders.splice(i, 1);
    return true;
  }

  restore(position: Vector3, radius: number): number {
    const count = this.destruction.restore(position, radius);
    if (count) this.refreshColliders();
    return count;
  }

  private addColliders(landmark: Landmark): void {
    const box = (x: number, y: number, z: number, width: number, height: number, depth: number) => this.allColliders.push({ x: landmark.x + x, y, z: landmark.z + z, width, height, depth, id: `landmark:${landmark.id}` });
    switch (landmark.id) {
      // Includes the climbable staircase and the walkable terrace, not one sealed block.
      case 'teatro': for (const item of TEATRO_COLLIDERS) box(item.x, item.y, item.z, item.width, item.height, item.depth); break;
      // The Largo is drawn and collided by LargoDistrict, which owns the whole square.
      case 'largo': break;
      case 'mercado': break; // Pavilions own their individual geometry and collider metadata.
      case 'porto': box(0, 6, -14, 115, 12, 30); for (const x of [-48, 48]) box(x, 1, 216, 15, 2, 365); break;
      case 'relogio': box(0, 8.5, 0, 4.7, 17, 4.7); break;
      case 'palacio': box(0, 7.5, -9, 65, 15, 35); box(0, 17.5, 6, 15, 3, 15); break;
      case 'arena': for (const item of ARENA_COLLIDERS) box(item.x, item.y, item.z, item.width, item.height, item.depth); break;
      // The invented towers are gone: the real Overture blocks behind the beach carry their own
      // colliders, so only the orla's own solid furniture is listed here.
      case 'ponta': for (const item of PONTA_COLLIDERS) this.allColliders.push({ ...item, x: item.x + landmark.x, z: item.z + landmark.z, id: item.id ?? 'landmark:ponta' }); break;
      case 'ponte':
        // Sampled from the same real centreline as the visible deck, so the surface the player
        // lands on is the surface they can see.
        for (const item of bridgeDeckColliders()) this.allColliders.push({ ...item, x: item.x + landmark.x, z: item.z + landmark.z, id: item.id ?? 'landmark:ponte' });
        break;
      case 'iranduba': box(0, 12, 0, 15, 24, 15); break;
      case 'encontro': box(0, 8.8, -4, 10, .4, 27); break;
      case 'musa': box(0, 44.7, 0, 14, .6, 14); break;
      case 'bosque': box(0, 1.5, 0, 9, 3, 9); break;
    }
  }

  dispose(): void {
    this.destruction.dispose();
    this.nodes.forEach(node => disposeGroup(node.anchor));
    this.nodes.length = 0; this.colliders.length = 0;
  }
}

export { createTerrain } from '../geodata/terrain';
