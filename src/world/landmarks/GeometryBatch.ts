import { BoxGeometry, BufferGeometry, CylinderGeometry, Group, Material, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const landmarkMaterials = {
  salmon: new MeshStandardMaterial({ color: '#c98370', roughness: .9 }),
  cream: new MeshStandardMaterial({ color: '#f4dfaf', roughness: .8 }),
  white: new MeshStandardMaterial({ color: '#fff0d6', roughness: .7 }),
  stone: new MeshStandardMaterial({ color: '#aca394', roughness: 1 }),
  dark: new MeshStandardMaterial({ color: '#223432', roughness: .65 }),
  glass: new MeshStandardMaterial({ color: '#254943', metalness: .25, roughness: .3 }),
  red: new MeshStandardMaterial({ color: '#9b5140', roughness: .85 }),
  gold: new MeshStandardMaterial({ color: '#e1b84c', metalness: .36, roughness: .46 }),
  green: new MeshStandardMaterial({ color: '#317b5c', roughness: .65 }),
  blue: new MeshStandardMaterial({ color: '#316c9c', roughness: .45 }),
  leaf: new MeshStandardMaterial({ color: '#386f47', roughness: 1 }),
  leafLight: new MeshStandardMaterial({ color: '#6d8b4d', roughness: 1 }),
  bark: new MeshStandardMaterial({ color: '#67513c', roughness: 1 }),
  sand: new MeshStandardMaterial({ color: '#c8b88c', roughness: 1 }),
  steel: new MeshStandardMaterial({ color: '#799697', metalness: .55, roughness: .46 }),
  light: new MeshStandardMaterial({ color: '#ffd997', emissive: '#d48740', emissiveIntensity: .6, roughness: .7 }),
};
export type PaletteKey = keyof typeof landmarkMaterials;

/** Temporary construction geometries disappear after merging by shared palette material. */
export class GeometryBatch {
  private readonly items = new Map<Material, BufferGeometry[]>();
  add(geometry: BufferGeometry, material: PaletteKey | Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): void {
    geometry.rotateX(rx); geometry.rotateY(ry); geometry.rotateZ(rz); geometry.translate(x, y, z);
    const unindexed = geometry.index ? geometry.toNonIndexed() : geometry;
    if (unindexed !== geometry) geometry.dispose();
    // Uniform attributes allow merging custom polygon models and Three primitives.
    unindexed.deleteAttribute('uv');
    if (!unindexed.hasAttribute('normal')) unindexed.computeVertexNormals();
    const mat = typeof material === 'string' ? landmarkMaterials[material] : material;
    const list = this.items.get(mat);
    if (list) list.push(unindexed); else this.items.set(mat, [unindexed]);
  }
  box(mat: PaletteKey, x: number, y: number, z: number, w: number, h: number, d: number, angle = 0): void {
    this.add(new BoxGeometry(w, h, d), mat, x, y, z, 0, angle);
  }
  cylinder(mat: PaletteKey, x: number, y: number, z: number, rt: number, rb: number, h: number, segments = 12): void {
    this.add(new CylinderGeometry(rt, rb, h, segments), mat, x, y, z);
  }
  sphere(mat: PaletteKey, x: number, y: number, z: number, r: number, sx = 1, sy = 1, sz = 1): void {
    this.add(new SphereGeometry(r, 10, 7).scale(sx, sy, sz), mat, x, y, z);
  }
  beam(mat: PaletteKey, start: Vector3, end: Vector3, radius: number, sides = 6): void {
    const direction = end.clone().sub(start);
    const geometry = new CylinderGeometry(radius, radius, direction.length(), sides);
    geometry.applyMatrix4(new Matrix4().compose(start.clone().add(end).multiplyScalar(.5), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()), new Vector3(1, 1, 1)));
    this.add(geometry, mat);
  }
  build(name: string): Group {
    const group = new Group(); group.name = name;
    for (const [material, geometries] of this.items) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new Mesh(merged, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.items.clear();
    return group;
  }
}

export function palm(batch: GeometryBatch, x: number, z: number, height: number, phase = 0): void {
  batch.cylinder('bark', x, height / 2, z, .22, .48, height, 7);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2 + phase;
    const end = new Vector3(x + Math.cos(angle) * 5, height - 1.6, z + Math.sin(angle) * 5);
    batch.beam('leaf', new Vector3(x, height, z), end, .45, 4);
    const mid = new Vector3(x + Math.cos(angle) * 2.5, height + .35, z + Math.sin(angle) * 2.5);
    batch.beam(i % 2 ? 'leaf' : 'leafLight', new Vector3(x, height, z), mid, .65, 4);
    batch.beam('leaf', mid, end, .48, 4);
  }
}

export function tree(batch: GeometryBatch, x: number, z: number, height: number, phase = 0): void {
  batch.cylinder('bark', x, height * .35, z, .35, .65, height * .7, 6);
  batch.sphere('leaf', x, height * .8, z, height * .34, 1.25, .7, 1.1);
  batch.sphere('leafLight', x + Math.sin(phase) * height * .15, height * .89, z + Math.cos(phase) * height * .13, height * .24, 1.1, .8, 1);
}
