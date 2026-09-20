import { Group, Mesh, SphereGeometry, TorusGeometry, Vector3 } from 'three/webgpu';
import type { Collider, Landmark } from '../../core/types';
import { LANDMARKS } from '../geodata/geodata';
import { GeometryBatch, tree } from './GeometryBatch';
import { TEATRO_COLLIDERS, createTeatroFar, createTeatroMedium, createTeatroNear } from './largo/teatro';
import { createBridge, LANDMARK_BUILDERS, PONTA_COLLIDERS } from './models';
import { ARENA_COLLIDERS, createArenaSilhouette } from './arena';
import { bridgeDeckColliders, createBridgeDistant } from './bridge';

interface LandmarkNode { landmark: Landmark; anchor: Group; distant: Group; detailed?: Group; visibleDetail: boolean }

function silhouette(id: string): Group {
  if (id === 'teatro') return createTeatroFar();
  if (id === 'ponte') return createBridgeDistant();
  if (id === 'arena') return createArenaSilhouette();
  const b = new GeometryBatch();
  if (id === 'musa') {
    for (const x of [-5, 5]) for (const z of [-5, 5]) b.box('steel', x, 22, z, .7, 44, .7);
    for (const y of [15, 30, 44]) b.box('bark', 0, y, 0, 14, .6, 14);
    for (let i = 0; i < 12; i++) tree(b, Math.cos(i * 2.4) * (55 + i * 10), Math.sin(i * 2.4) * (55 + i * 10), 28 + i % 5, i);
  } else if (id === 'bosque') {
    for (let i = 0; i < 20; i++) b.sphere('leaf', Math.cos(i * 2.4) * (30 + i * 7), 14 + i % 5, Math.sin(i * 2.4) * (30 + i * 7), 23, 1, .8, 1);
  } else if (id === 'mercado') {
    for (const x of [-29, 0, 29]) { b.box('cream', x, 5, 0, 25, 10, 55); b.sphere('red', x, 10, 0, 13, 1, .7, 2.2); }
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
    b.box('bark', -211.9, 1.5, -225.2, 190, .55, 12, .51);
    b.box('stone', 165.8, 2.2, -92.8, 140, 4.4, 210, .51);
  } else if (id === 'iranduba') {
    b.box('leaf', 0, .04, 0, 900, .08, 700);
    for (let row = -2; row <= 2; row++) for (let col = -3; col <= 3; col++) {
      if (!row || !col) continue;
      const h = 6 + ((row * row + col * col) % 3) * 3;
      b.box((row + col) % 2 ? 'cream' : 'salmon', col * 92, h / 2, row * 88, 48, h, 38);
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
    }
    this.colliders.push(...this.allColliders);
  }

  update(player: Vector3, dt: number): void {
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
        if (node.detailed) { node.anchor.add(node.detailed); built = true; }
      }
      node.visibleDetail = near && !!node.detailed;
      node.distant.visible = !node.visibleDetail;
      if (node.detailed) {
        node.detailed.visible = node.visibleDetail;
        if (distance > detailExit + 3000) { disposeGroup(node.detailed); node.detailed = undefined; }
      }
      node.anchor.traverse(object => { if (object instanceof Mesh) object.castShadow = distance < 350; });
    }
    this.colliders.length = 0;
    for (const box of this.allColliders) if (Math.abs(box.x - player.x) < 1400 + box.width / 2 && Math.abs(box.z - player.z) < 1400 + box.depth / 2) this.colliders.push(box);
  }

  private addColliders(landmark: Landmark): void {
    const box = (x: number, y: number, z: number, width: number, height: number, depth: number) => this.allColliders.push({ x: landmark.x + x, y, z: landmark.z + z, width, height, depth, id: `landmark:${landmark.id}` });
    switch (landmark.id) {
      // Includes the climbable staircase and the walkable terrace, not one sealed block.
      case 'teatro': for (const item of TEATRO_COLLIDERS) box(item.x, item.y, item.z, item.width, item.height, item.depth); break;
      // The Largo is drawn and collided by LargoDistrict, which owns the whole square.
      case 'largo': break;
      case 'mercado': box(0, 7, 0, 86, 14, 57); break;
      case 'porto': box(0, 6, -14, 115, 12, 30); for (const x of [-48, 48]) box(x, 1, 216, 15, 2, 365); break;
      case 'relogio': box(0, 8.5, 0, 4.7, 17, 4.7); break;
      case 'palacio': box(0, 7.5, -9, 65, 15, 35); box(0, 17.5, 6, 15, 3, 15); break;
      case 'arena': for (const item of ARENA_COLLIDERS) box(item.x, item.y, item.z, item.width, item.height, item.depth); break;
      // The invented towers are gone: the real Overture blocks behind the beach carry their own
      // colliders, so only the orla's own solid furniture is listed here.
      case 'ponta': for (const item of PONTA_COLLIDERS) box(item.x, item.y, item.z, item.width, item.height, item.depth); break;
      case 'ponte':
        // Sampled from the same real centreline as the visible deck, so the surface the player
        // lands on is the surface they can see.
        for (const item of bridgeDeckColliders()) box(item.x, item.y, item.z, item.width, item.height, item.depth);
        break;
      case 'iranduba': box(0, 12, 0, 15, 24, 15); break;
      case 'encontro': box(0, 8.8, -4, 10, .4, 27); break;
      case 'musa': box(0, 44.7, 0, 14, .6, 14); break;
      case 'bosque': box(0, 1.5, 0, 9, 3, 9); break;
    }
  }

  dispose(): void {
    this.nodes.forEach(node => disposeGroup(node.anchor));
    this.nodes.length = 0; this.colliders.length = 0;
  }
}

export { createTerrain } from '../geodata/terrain';
