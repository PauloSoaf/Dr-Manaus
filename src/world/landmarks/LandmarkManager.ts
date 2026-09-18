import { Group, Mesh, SphereGeometry, TorusGeometry, Vector3 } from 'three/webgpu';
import type { Collider, Landmark } from '../../core/types';
import { LANDMARKS } from '../geodata/geodata';
import { GeometryBatch, tree } from './GeometryBatch';
import { createTheatre, createTheatreSilhouette } from './theatre';
import { createBridge, LANDMARK_BUILDERS } from './models';

interface LandmarkNode { landmark: Landmark; anchor: Group; distant: Group; detailed?: Group; visibleDetail: boolean }

function silhouette(id: string): Group {
  if (id === 'teatro') return createTheatreSilhouette();
  if (id === 'ponte') return createBridge();
  const b = new GeometryBatch();
  if (id === 'arena') {
    b.add(new TorusGeometry(85, 17, 5, 36).rotateX(Math.PI / 2).scale(1, 1, 1.3), 'cream', 0, 24, 0);
    b.add(new TorusGeometry(91, 12, 5, 36).rotateX(Math.PI / 2).scale(1, .4, 1.28), 'white', 0, 43, 0);
  } else if (id === 'musa') {
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
  } else if (id === 'largo') {
    b.box('cream', 0, .06, 0, 132, .1, 124); b.box('stone', 0, 5, 6, 4.5, 10, 4.5);
  } else if (id === 'ponta') {
    b.box('sand', -170, -.14, 0, 700, .28, 1800, -.45);
    b.box('cream', 128, .18, 0, 46, .36, 1660, -.45);
    for (let i = -9; i <= 9; i++) {
      const z = i * 82;
      const x = 255 - z * .48;
      const h = 50 + ((i * i + 31) % 6) * 11;
      b.box(i % 3 === 0 ? 'salmon' : i % 3 === 1 ? 'cream' : 'stone', x, h / 2, z, 38, h, 42, -.45);
    }
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
      if (landmark.id === 'teatro' || landmark.id === 'largo') {
        node.detailed = landmark.id === 'teatro' ? createTheatre() : LANDMARK_BUILDERS.largo();
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
      const detailEnter = node.landmark.id === 'ponta' ? 3000 : node.landmark.id === 'iranduba' ? 2200 : 1400;
      const detailExit = node.landmark.id === 'ponta' ? 3400 : node.landmark.id === 'iranduba' ? 2500 : 1750;
      const near = distance < (node.visibleDetail ? detailExit : detailEnter);
      if (near && !node.detailed && !built && node.landmark.id !== 'ponte') {
        node.detailed = node.landmark.id === 'teatro' ? createTheatre() : LANDMARK_BUILDERS[node.landmark.id]?.();
        if (node.detailed) { node.anchor.add(node.detailed); built = true; }
      }
      node.visibleDetail = near && !!node.detailed;
      node.distant.visible = !node.visibleDetail;
      if (node.detailed) {
        node.detailed.visible = node.visibleDetail;
        if (distance > 4800) { disposeGroup(node.detailed); node.detailed = undefined; }
      }
      node.anchor.traverse(object => { if (object instanceof Mesh) object.castShadow = distance < 350; });
    }
    this.colliders.length = 0;
    for (const box of this.allColliders) if (Math.abs(box.x - player.x) < 1400 + box.width / 2 && Math.abs(box.z - player.z) < 1400 + box.depth / 2) this.colliders.push(box);
  }

  private addColliders(landmark: Landmark): void {
    const box = (x: number, y: number, z: number, width: number, height: number, depth: number) => this.allColliders.push({ x: landmark.x + x, y, z: landmark.z + z, width, height, depth, id: `landmark:${landmark.id}` });
    switch (landmark.id) {
      case 'teatro':
        box(0, 11.5, -1, 55, 23, 65); box(0, 12, -35, 33, 24, 18);
        box(0, 24.5, -3, 25, 3, 25);
        for (let layer = 0; layer < 6; layer++) {
          const top = 27.5 + layer * 1.9, radius = Math.sqrt(Math.max(1, 12.6 ** 2 - (top - 25.4) ** 2)) * .7;
          box(0, top - 1, -3, radius * 2, 2, radius * 2);
        }
        box(0, 38.25, 0, 3.1, .5, 3.1);
        break;
      case 'largo': box(0, 5, 6, 4.5, 10, 4.5); box(66, 8, -23, 26, 16, 43); break;
      case 'mercado': box(0, 7, 0, 86, 14, 57); break;
      case 'porto': box(0, 6, -14, 115, 12, 30); for (const x of [-48, 48]) box(x, 1, 216, 15, 2, 365); break;
      case 'relogio': box(0, 8.5, 0, 4.7, 17, 4.7); break;
      case 'palacio': box(0, 7.5, -9, 65, 15, 35); box(0, 17.5, 6, 15, 3, 15); break;
      case 'arena': for (const x of [-94, 94]) box(x, 20, 0, 20, 40, 155); for (const z of [-121, 121]) box(0, 20, z, 150, 40, 20); break;
      case 'ponta':
        box(-20, 2.2, -110, 28, 4.4, 26);
        for (let row = 0; row < 2; row++) for (let i = -10; i <= 10; i++) {
          if (row === 1 && i % 2 !== 0) continue;
          const z = i * 72 + row * 24;
          const x = 255 - z * .48 + row * 118;
          const h = 48 + ((i * i + row * 17 + 31) % 7) * 10;
          const w = 30 + ((i + 15) % 4) * 6;
          const d = 34 + ((i * 3 + 19) % 4) * 7;
          box(x, h / 2, z, w + 8, h, d + 8);
        }
        break;
      case 'ponte':
        for (let x = -1775; x <= 1775; x += 25) box(x * Math.cos(.35), 53, -x * Math.sin(.35), 31, 4, 33);
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
