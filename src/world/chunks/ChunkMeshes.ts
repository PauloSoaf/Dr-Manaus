import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Float32BufferAttribute,
  Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion,
  SRGBColorSpace, Vector3, type Material,
} from 'three/webgpu';
import { WORLD } from '../../core/config';
import type { Collider } from '../../core/types';
import { BUILDING_STRIDE, TREE_STRIDE, type ChunkPayload } from './Chunk';

function facadeAtlas(): { color: CanvasTexture; light: CanvasTexture } {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const emission = document.createElement('canvas'); emission.width = 256; emission.height = 256;
  const ctx = canvas.getContext('2d')!;
  const glow = emission.getContext('2d')!; glow.fillStyle = '#000'; glow.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#aaa9a1'; ctx.fillRect(0, 0, 256, 256);
  // One shared, hand-drawn atlas: cornices, shutters and stone ground-floor surrounds.
  for (let floor = 0; floor < 3; floor++) {
    const y = 24 + floor * 76;
    ctx.fillStyle = '#858781'; ctx.fillRect(0, y + 56, 256, 5);
    ctx.fillStyle = '#cac9c0'; ctx.fillRect(0, y + 54, 256, 3);
    for (let col = 0; col < 4; col++) {
      const x = 16 + col * 63;
      ctx.fillStyle = '#c9c8bd'; ctx.fillRect(x - 4, y - 4, 36, 45);
      ctx.fillStyle = '#405c62'; ctx.fillRect(x, y, 28, 35);
      ctx.fillStyle = '#789093'; ctx.fillRect(x + 2, y + 2, 11, 15);
      ctx.fillStyle = '#c3b993'; ctx.fillRect(x + 13, y, 2, 35); ctx.fillRect(x, y + 17, 28, 2);
      ctx.fillStyle = '#80755f'; ctx.fillRect(x - 3, y + 37, 34, 3);
      if ((col + floor) % 3 !== 0) { glow.fillStyle = '#f1c879'; glow.fillRect(x + 2, y + 2, 24, 31); }
    }
  }
  ctx.fillStyle = '#85857d'; ctx.fillRect(0, 0, 256, 8); ctx.fillRect(0, 248, 256, 8);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  const light = new CanvasTexture(emission); light.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4; return { color: texture, light };
}

function roofGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    -.5, 0, -.5, .5, 0, -.5, 0, 1, -.5, -.5, 0, .5, .5, 0, .5, 0, 1, .5,
  ], 3));
  geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3]);
  geometry.computeVertexNormals(); return geometry;
}

/** GPU resources are shared by all chunks; eviction disposes only instance buffers. */
export class ChunkMeshes {
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly roof = roofGeometry();
  private readonly trunk = new CylinderGeometry(.65, 1, 1, 5);
  private readonly crown = new IcosahedronGeometry(1, 1);
  private readonly atlas = facadeAtlas();
  private readonly facade = new MeshStandardMaterial({ map: this.atlas.color, emissiveMap: this.atlas.light,
    emissive: 0xffffff, emissiveIntensity: .045, roughness: .86, metalness: .015 });
  private readonly roofMat = new MeshStandardMaterial({ color: 0xffffff, roughness: .95 });
  private readonly pavement = new MeshStandardMaterial({ color: 0xc0b7a3, roughness: 1 });
  private readonly bark = new MeshStandardMaterial({ color: 0x766348, roughness: 1 });
  private readonly leaves = new MeshStandardMaterial({ color: 0xffffff, roughness: .95 });
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly color = new Color();

  create(payload: ChunkPayload): { group: Group; colliders: Collider[]; bytes: number } {
    const group = new Group(); group.name = `chunk:${payload.key}`;
    group.position.set(payload.cx * WORLD.chunkSize, 0, payload.cz * WORLD.chunkSize);
    const buildings = payload.buildings, trees = payload.trees;
    const count = buildings.length / BUILDING_STRIDE, treeCount = trees.length / TREE_STRIDE;
    const colliders: Collider[] = [];
    let bytes = buildings.byteLength + trees.byteLength;
    const make = (geometry: BufferGeometry, material: Material, instances: number, name: string) => {
      const mesh = new InstancedMesh(geometry, material, Math.max(1, instances));
      mesh.count = instances; mesh.name = name; mesh.receiveShadow = true;
      group.add(mesh); bytes += Math.max(1, instances) * 80; return mesh;
    };
    if (count) {
      const walls = make(this.box, this.facade, count, 'facades'); walls.castShadow = true;
      const roofs = make(this.roof, this.roofMat, count, 'terracotta-roofs'); roofs.castShadow = true;
      const sidewalk = make(this.box, this.pavement, count, 'sidewalks');
      for (let i = 0; i < count; i++) {
        const p = i * BUILDING_STRIDE;
        const x = buildings[p] - group.position.x, z = buildings[p + 1] - group.position.z;
        const w = buildings[p + 2], h = buildings[p + 3], d = buildings[p + 4], roof = buildings[p + 8];
        this.set(walls, i, x, h * .5 + .25, z, w, h, d);
        walls.setColorAt(i, this.color.setRGB(buildings[p + 5], buildings[p + 6], buildings[p + 7]));
        this.set(roofs, i, x, h + .25, z, w + 1.4, roof, d + 1.4);
        roofs.setColorAt(i, this.color.setHex(roof < 1 ? 0xc9c4b0 : (i % 3 === 0 ? 0x855d49 : 0xa76648)));
        this.set(sidewalk, i, x, .10, z, w + 4.5, .2, d + 4.5);
        colliders.push({ x: buildings[p], y: (h + roof) * .5, z: buildings[p + 1], width: w, height: h + roof, depth: d, id: `${payload.key}/building/${i}` });
      }
      if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
      if (roofs.instanceColor) roofs.instanceColor.needsUpdate = true;
    }
    if (treeCount) {
      const trunks = make(this.trunk, this.bark, treeCount, 'tree-trunks');
      const crowns = make(this.crown, this.leaves, treeCount * 6, 'tropical-canopy');
      let leafCount = 0;
      for (let i = 0; i < treeCount; i++) {
        const p = i * TREE_STRIDE;
        const x = trees[p] - group.position.x, z = trees[p + 1] - group.position.z;
        const h = trees[p + 2], radius = trees[p + 3], palm = trees[p + 4] > .5;
        this.set(trunks, i, x, h * .5, z, palm ? .3 : .5, h, palm ? .3 : .5);
        if (palm) {
          for (let leaf = 0; leaf < 5; leaf++) {
            const a = leaf / 5 * Math.PI * 2 + i;
            this.set(crowns, leafCount, x + Math.cos(a) * 1.6, h - .25, z + Math.sin(a) * 1.6,
              radius * 1.15, .4, .85, -a);
            crowns.setColorAt(leafCount++, this.color.setHex(leaf % 2 ? 0x427c4f : 0x527f42));
          }
        } else {
          this.set(crowns, leafCount, x, h - .5, z, radius, radius * .78, radius);
          crowns.setColorAt(leafCount++, this.color.setHex(i % 3 ? 0x537449 : 0x68864b));
        }
      }
      crowns.count = leafCount; crowns.castShadow = true;
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    }
    group.traverse(object => { if (object instanceof InstancedMesh) { object.computeBoundingSphere(); object.computeBoundingBox(); } });
    return { group, colliders, bytes };
  }

  private set(mesh: InstancedMesh, index: number, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0): void {
    this.position.set(x, y, z); this.scale.set(w, h, d);
    this.rotation.set(0, Math.sin(yaw * .5), 0, Math.cos(yaw * .5));
    this.matrix.compose(this.position, this.rotation, this.scale); mesh.setMatrixAt(index, this.matrix);
  }

  disposeChunk(group: Group): void {
    group.removeFromParent(); group.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); });
    group.clear();
  }
  setNight(enabled: boolean): void { this.facade.emissiveIntensity = enabled ? .8 : .045; }
  dispose(): void {
    this.box.dispose(); this.roof.dispose(); this.trunk.dispose(); this.crown.dispose(); this.atlas.color.dispose(); this.atlas.light.dispose();
    this.facade.dispose(); this.roofMat.dispose(); this.pavement.dispose(); this.bark.dispose(); this.leaves.dispose();
  }
}
