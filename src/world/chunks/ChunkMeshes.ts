import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion,
  SRGBColorSpace, Vector3, type Material,
} from 'three/webgpu';
import { WORLD } from '../../core/config';
import type { Collider } from '../../core/types';
import { manausTileSceneMatrix } from '../spatial/ManausSurfacePresentation';
import { BUILDING_STRIDE, GROUND_SEGMENTS, TREE_STRIDE, interpolateGroundHeight, type ChunkPayload } from './Chunk';
import { createUniversalLiquidMaterial, getWaveSpectrumForSolvent, type LiquidSolventType } from '../water/UniversalLiquidSystem';
import { BuildingGeneratorContext } from '../spatial/ActiveSurfaceOrigin';

/** Local-space limits of everything a chunk actually draws, waves included. */
export interface ChunkCullBounds { minY: number; maxY: number; marginXZ: number }

/** Depth of the walls around relief tiles that hide seams against coarser representations. */
const GROUND_SKIRT_M = 6;
const WATER_CELLS = 24;

function facadeAtlas(): { color: CanvasTexture; light: CanvasTexture } {
  if (typeof document === 'undefined') {
    return { color: null as any, light: null as any };
  }
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
  /** Controls whether local flat Manaus terrain sheet owns [-26km, 26km]. Set to false when outside Manaus. */
  static isLocalManausActive = true;
  static activeSolvent: LiquidSolventType = 'terrestrial-ocean';

  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly roof = roofGeometry();
  private readonly trunk = new CylinderGeometry(.65, 1, 1, 5);
  private readonly crown = new IcosahedronGeometry(1, 1);
  private readonly atlas = facadeAtlas();
  private readonly facade = new MeshStandardMaterial({ map: this.atlas.color, emissiveMap: this.atlas.light,
    emissive: 0xffffff, emissiveIntensity: .045, roughness: .86, metalness: .015 });
  private readonly roofMat = new MeshStandardMaterial({ color: 0xffffff, roughness: .95 });
  private readonly pavement = new MeshStandardMaterial({ color: 0x4a4d52, roughness: .92 });
  private readonly bark = new MeshStandardMaterial({ color: 0x766348, roughness: 1 });
  private readonly leaves = new MeshStandardMaterial({ color: 0xffffff, roughness: .95 });
  private readonly oceanGeometry: PlaneGeometry;
  private readonly oceanMaterial: Material;
  private readonly megawaveOceanGeometry: PlaneGeometry;
  private readonly megawaveOceanMaterial: Material;
  private readonly forestGroundGeometry: PlaneGeometry;
  private readonly forestGroundMaterial: MeshStandardMaterial;
  private readonly desertGroundMaterial: MeshStandardMaterial;
  private readonly iceGroundMaterial: MeshStandardMaterial;
  private readonly woodlandGroundMaterial: MeshStandardMaterial;
  private readonly urbanGroundMaterial: MeshStandardMaterial;
  private readonly reliefGroundMaterial = new MeshStandardMaterial({
    vertexColors: true, roughness: 1, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly color = new Color();

  constructor() {
    this.oceanGeometry = new PlaneGeometry(WORLD.chunkSize, WORLD.chunkSize, 24, 24);
    this.oceanGeometry.rotateX(-Math.PI / 2);
    this.oceanGeometry.translate(WORLD.chunkSize * 0.5, 0.0, WORLD.chunkSize * 0.5);
    const shoreArr = new Float32Array(this.oceanGeometry.getAttribute('position').count).fill(1.0);
    this.oceanGeometry.setAttribute('shore', new Float32BufferAttribute(shoreArr, 1));
    this.oceanMaterial = createUniversalLiquidMaterial('terrestrial-ocean');

    this.megawaveOceanGeometry = new PlaneGeometry(WORLD.chunkSize, WORLD.chunkSize, 32, 32);
    this.megawaveOceanGeometry.rotateX(-Math.PI / 2);
    this.megawaveOceanGeometry.translate(WORLD.chunkSize * 0.5, 0.0, WORLD.chunkSize * 0.5);
    const megaShoreArr = new Float32Array(this.megawaveOceanGeometry.getAttribute('position').count).fill(1.0);
    this.megawaveOceanGeometry.setAttribute('shore', new Float32BufferAttribute(megaShoreArr, 1));
    this.megawaveOceanMaterial = createUniversalLiquidMaterial('megawave-ocean');

    this.forestGroundGeometry = new PlaneGeometry(WORLD.chunkSize, WORLD.chunkSize, 1, 1);
    this.forestGroundGeometry.rotateX(-Math.PI / 2);
    this.forestGroundGeometry.translate(WORLD.chunkSize * 0.5, 0.02, WORLD.chunkSize * 0.5);
    this.forestGroundMaterial = new MeshStandardMaterial({ color: 0x1d4718, roughness: 1.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.desertGroundMaterial = new MeshStandardMaterial({ color: 0xd4a373, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.iceGroundMaterial = new MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.woodlandGroundMaterial = new MeshStandardMaterial({ color: 0x48523b, roughness: 1.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.urbanGroundMaterial = new MeshStandardMaterial({ color: 0x2e3035, roughness: 1.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  }

  create(payload: ChunkPayload): { group: Group; colliders: Collider[]; bytes: number } {
    const group = new Group(); group.name = `chunk:${payload.key}`;
    const originX = payload.cx * WORLD.chunkSize, originZ = payload.cz * WORLD.chunkSize;
    group.matrixAutoUpdate = false;
    if (ChunkMeshes.isLocalManausActive) {
      manausTileSceneMatrix(payload.key, originX, originZ, group.matrix);
    } else {
      group.matrix.makeTranslation(originX, 0, originZ);
    }

    const buildings = payload.buildings, trees = payload.trees;
    const count = buildings.length / BUILDING_STRIDE, treeCount = trees.length / TREE_STRIDE;
    const colliders: Collider[] = [];
    let bytes = buildings.byteLength + trees.byteLength;
    let minY = Infinity, maxY = -Infinity, marginXZ = 0;
    const include = (low: number, high: number, margin = 0) => {
      minY = Math.min(minY, low); maxY = Math.max(maxY, high); marginXZ = Math.max(marginXZ, margin);
    };
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
        const x = buildings[p] - originX, z = buildings[p + 1] - originZ;
        const w = buildings[p + 2], h = buildings[p + 3], d = buildings[p + 4], roof = buildings[p + 8];
        this.set(walls, i, x, h * .5 + .25, z, w, h, d);
        walls.setColorAt(i, this.color.setRGB(buildings[p + 5], buildings[p + 6], buildings[p + 7]));
        this.set(roofs, i, x, h + .25, z, w + 1.4, roof, d + 1.4);
        roofs.setColorAt(i, this.color.setHex(roof < 1 ? 0xc9c4b0 : (i % 3 === 0 ? 0x855d49 : 0xa76648)));
        this.set(sidewalk, i, x, .10, z, w + 4.5, .2, d + 4.5);
        colliders.push({ x: buildings[p], y: (h + roof) * .5, z: buildings[p + 1], width: w, height: h + roof, depth: d, id: `${payload.key}/building/${i}` });
        include(0, h + roof + .5, 4);
      }
      if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
      if (roofs.instanceColor) roofs.instanceColor.needsUpdate = true;
    }
    if (treeCount) {
      const trunks = make(this.trunk, this.bark, treeCount, 'tree-trunks');
      const crowns = make(this.crown, this.leaves, treeCount * 6, 'tropical-canopy');
      // Which canopy instances belong to which trunk, so felling a tree takes its leaves with it.
      const canopyStart = new Int32Array(treeCount), canopySpan = new Int32Array(treeCount);
      let leafCount = 0;
      for (let i = 0; i < treeCount; i++) {
        const p = i * TREE_STRIDE;
        const x = trees[p] - originX, z = trees[p + 1] - originZ;
        const h = trees[p + 2], radius = trees[p + 3], palm = trees[p + 4] > .5;
        const base = payload.treeBase?.[i] ?? 0;
        canopyStart[i] = leafCount;
        this.set(trunks, i, x, base + h * .5, z, palm ? .3 : .5, h, palm ? .3 : .5);
        if (palm) {
          for (let leaf = 0; leaf < 5; leaf++) {
            const a = leaf / 5 * Math.PI * 2 + i;
            this.set(crowns, leafCount, x + Math.cos(a) * 1.6, base + h - .25, z + Math.sin(a) * 1.6,
              radius * 1.15, .4, .85, -a);
            crowns.setColorAt(leafCount++, this.color.setHex(leaf % 2 ? 0x427c4f : 0x527f42));
          }
        } else {
          this.set(crowns, leafCount, x, base + h - .5, z, radius, radius * .78, radius);
          crowns.setColorAt(leafCount++, this.color.setHex(i % 3 ? 0x537449 : 0x68864b));
        }
        canopySpan[i] = leafCount - canopyStart[i];
        // Trees are solid and fellable. The canopy width is what a beam or a fast pass will hit.
        colliders.push({
          x: trees[p], y: base + h * .5, z: trees[p + 1],
          width: radius * 1.3, height: h, depth: radius * 1.3, id: `${payload.key}/tree/${i}`,
        });
        include(base, base + h + radius, palm ? 1.6 + Math.hypot(radius * 1.15, .85) : radius);
      }
      crowns.count = leafCount; crowns.castShadow = true;
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
      group.userData.canopyStart = canopyStart;
      group.userData.canopySpan = canopySpan;
    }
    const isLocalManaus = ChunkMeshes.isLocalManausActive && Math.abs(originX) <= 26000 && Math.abs(originZ) <= 26000;
    const relief = isLocalManaus ? undefined : payload.ground;
    if (relief) {
      const ground = this.reliefGround(relief, payload.groundColors);
      group.add(ground);
      const geometry = ground.geometry;
      for (const name of ['position', 'normal', 'color']) bytes += (geometry.getAttribute(name).array as Float32Array).byteLength;
      bytes += geometry.index!.array.byteLength;
      let low = Infinity, high = -Infinity;
      for (const y of relief) { low = Math.min(low, y); high = Math.max(high, y); }
      include(low - GROUND_SKIRT_M, high);
    } else if (payload.land && !isLocalManaus) {
      const biome = payload.biome;
      const groundMat = biome === 'desert' ? this.desertGroundMaterial
        : biome === 'ice' ? this.iceGroundMaterial
        : biome === 'woodland' ? this.woodlandGroundMaterial
        : biome === 'urban' ? this.urbanGroundMaterial
        : this.forestGroundMaterial;
      const ground = make(this.forestGroundGeometry, groundMat, 1, 'forest-ground');
      this.matrix.identity();
      ground.setMatrixAt(0, this.matrix);
      if (ground.instanceMatrix) ground.instanceMatrix.needsUpdate = true;
      include(0, .05);
    }
    // Open water, or the wet part of a coastal tile.
    if (!isLocalManaus && (!payload.land || payload.seaPlane)) {
      const isMegawave = ChunkMeshes.activeSolvent === 'megawave-ocean' || BuildingGeneratorContext.activeOrigin.bodyId === 'thalassa';
      const partial = relief && payload.seaPlane && !isMegawave ? this.wetWaterGeometry(relief, payload.seaPlane) : undefined;
      if (!partial || partial.index!.count > 0) {
        const geom = partial ?? (isMegawave ? this.megawaveOceanGeometry : this.oceanGeometry);
        const mat = isMegawave ? this.megawaveOceanMaterial : this.oceanMaterial;
        const ocean = make(geom, mat, 1, 'ocean-surface');
        if (partial) ocean.userData.ownedGeometry = true;
        const plane = payload.seaPlane;
        this.matrix.identity();
        // A shear lifts and tilts the flat patch onto the curved sea without moving it sideways.
        if (plane) {
          const slopeX = (plane[1] - plane[0]) / WORLD.chunkSize, slopeZ = (plane[2] - plane[0]) / WORLD.chunkSize;
          this.matrix.set(1, 0, 0, 0, slopeX, 1, slopeZ, plane[0], 0, 0, 1, 0, 0, 0, 0, 1);
        }
        ocean.setMatrixAt(0, this.matrix);
        if (ocean.instanceMatrix) ocean.instanceMatrix.needsUpdate = true;
        const waves = getWaveSpectrumForSolvent(isMegawave ? 'megawave-ocean' : 'terrestrial-ocean');
        const crest = waves.reduce((sum, wave) => sum + wave.amplitude, 0);
        const sway = waves.reduce((sum, wave) => sum + wave.steepness * wave.wavelength / (2 * Math.PI * waves.length), 0);
        const seaLow = plane ? Math.min(plane[0], plane[1], plane[2]) : 0;
        const seaHigh = plane ? Math.max(plane[0], plane[1], plane[2], plane[1] + plane[2] - plane[0]) : 0;
        include(seaLow - crest, seaHigh + crest, sway);
      } else partial.dispose();
    }
    group.userData.cullBounds = (Number.isFinite(minY)
      ? { minY: minY - .5, maxY: maxY + .5, marginXZ }
      : { minY: -1, maxY: 1, marginXZ: 0 }) satisfies ChunkCullBounds;
    group.traverse(object => { if (object instanceof InstancedMesh) { object.computeBoundingSphere(); object.computeBoundingBox(); } });
    return { group, colliders, bytes };
  }

  /** Relief on the generator's vertex grid, with walls around the edge. Owned by its chunk. */
  private reliefGround(heights: Float32Array, colors: Float32Array | undefined): Mesh {
    const n = GROUND_SEGMENTS, stride = n + 1, step = WORLD.chunkSize / n;
    const perimeter: number[] = [];
    for (let i = 0; i <= n; i++) perimeter.push(i);
    for (let j = 1; j <= n; j++) perimeter.push(j * stride + n);
    for (let i = n - 1; i >= 0; i--) perimeter.push(n * stride + i);
    for (let j = n - 1; j > 0; j--) perimeter.push(j * stride);
    const count = stride * stride + perimeter.length;
    const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), tints = new Float32Array(count * 3);
    const height = (i: number, j: number) => heights[j * stride + i];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const v = j * stride + i;
      positions.set([i * step, height(i, j), j * step], v * 3);
      // Normals from the height grid, so the skirt walls never darken the tile edge.
      const dx = (height(Math.min(n, i + 1), j) - height(Math.max(0, i - 1), j)) / ((Math.min(n, i + 1) - Math.max(0, i - 1)) * step);
      const dz = (height(i, Math.min(n, j + 1)) - height(i, Math.max(0, j - 1))) / ((Math.min(n, j + 1) - Math.max(0, j - 1)) * step);
      const length = Math.hypot(dx, 1, dz);
      normals.set([-dx / length, 1 / length, -dz / length], v * 3);
      tints.set(colors ? colors.subarray(v * 3, v * 3 + 3) : [.1, .2, .1], v * 3);
    }
    perimeter.forEach((source, k) => {
      const v = stride * stride + k;
      positions.set([positions[source * 3], positions[source * 3 + 1] - GROUND_SKIRT_M, positions[source * 3 + 2]], v * 3);
      normals.set(normals.subarray(source * 3, source * 3 + 3), v * 3);
      tints.set(tints.subarray(source * 3, source * 3 + 3), v * 3);
    });
    const indices: number[] = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v00 = j * stride + i, v10 = v00 + 1, v01 = v00 + stride, v11 = v01 + 1;
      // Counter-clockwise from above, split along the same diagonal as interpolateGroundHeight.
      indices.push(v00, v01, v10, v10, v01, v11);
    }
    perimeter.forEach((a, k) => {
      const next = (k + 1) % perimeter.length, b = perimeter[next];
      const aLow = stride * stride + k, bLow = stride * stride + next;
      indices.push(a, b, aLow, b, bLow, aLow);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    geometry.setAttribute('color', new BufferAttribute(tints, 3));
    const index = new Uint16Array(indices);
    geometry.setIndex(new BufferAttribute(index, 1));
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    const mesh = new Mesh(geometry, this.reliefGroundMaterial);
    mesh.name = 'forest-ground'; mesh.receiveShadow = true;
    mesh.userData.ownedGeometry = true; mesh.userData.fullIndex = index;
    return mesh;
  }

  /** Water cells where the relief reaches below the waves, so the sea never drapes over dry ground. */
  private wetWaterGeometry(heights: Float32Array, plane: Float32Array): BufferGeometry {
    const size = WORLD.chunkSize, step = size / WATER_CELLS;
    const wet = (x: number, z: number) => interpolateGroundHeight(heights, x, z, size)
      < plane[0] + (plane[1] - plane[0]) * x / size + (plane[2] - plane[0]) * z / size + .3;
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], shore: number[] = [], indices: number[] = [];
    for (let j = 0; j < WATER_CELLS; j++) for (let i = 0; i < WATER_CELLS; i++) {
      const x0 = i * step, z0 = j * step, x1 = x0 + step, z1 = z0 + step;
      if (!wet(x0, z0) && !wet(x1, z0) && !wet(x0, z1) && !wet(x1, z1)) continue;
      const base = positions.length / 3;
      for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
        positions.push(x, 0, z); normals.push(0, 1, 0); uvs.push(x / size, z / size); shore.push(1);
      }
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('shore', new Float32BufferAttribute(shore, 1));
    geometry.setIndex(indices);
    if (indices.length) geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Hides ground triangles where `hidden` is true for their tile-local centroid (published volume
   * replacements own that space), or restores the full tile with `null`.
   */
  static maskGround(group: Group, hidden: ((x: number, y: number, z: number) => boolean) | null): void {
    const mesh = group.getObjectByName('forest-ground');
    if (!(mesh instanceof Mesh)) return;
    const full = mesh.userData.fullIndex as Uint16Array | undefined;
    if (!full) return;
    let next = full;
    if (hidden) {
      const position = mesh.geometry.getAttribute('position');
      const kept: number[] = [];
      for (let t = 0; t < full.length; t += 3) {
        const [a, b, c] = [full[t], full[t + 1], full[t + 2]];
        if (!hidden((position.getX(a) + position.getX(b) + position.getX(c)) / 3,
          (position.getY(a) + position.getY(b) + position.getY(c)) / 3,
          (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3)) kept.push(a, b, c);
      }
      if (kept.length !== full.length) next = new Uint16Array(kept);
    }
    const current = mesh.geometry.index!.array;
    if (current === next) return;
    mesh.geometry.setIndex(new BufferAttribute(next, 1));
  }

  private set(mesh: InstancedMesh, index: number, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0): void {
    const parent = mesh.parent as Group;
    const gx = x + parent.position.x, gz = z + parent.position.z;
    this.position.set(gx - parent.position.x, y, gz - parent.position.z);
    this.scale.set(w, h, d);
    this.rotation.set(0, Math.sin(yaw * .5), 0, Math.cos(yaw * .5));
    this.matrix.compose(this.position, this.rotation, this.scale); mesh.setMatrixAt(index, this.matrix);
  }

  /** Reconstructs one instance family from its immutable worker payload, including every palm leaf. */
  restore(group: Group, payload: ChunkPayload, id: string): Collider | null {
    const collider = ChunkMeshes.collider(payload, id);
    if (!collider) return null;
    const tree = id.includes('/tree/'), index = Number(id.slice(id.lastIndexOf('/') + 1));
    const data = tree ? payload.trees : payload.buildings, p = index * (tree ? TREE_STRIDE : BUILDING_STRIDE);
    // The explicit group matrix owns translation/orientation; group.position stays zero.
    // Rebuild in the same tile-local coordinates as create(), including away from the anchor.
    const x = data[p] - payload.cx * WORLD.chunkSize, z = data[p + 1] - payload.cz * WORLD.chunkSize;
    for (const mesh of group.children) {
      if (!(mesh instanceof InstancedMesh)) continue;
      if (!tree) {
        const w = data[p + 2], h = data[p + 3], d = data[p + 4], roof = data[p + 8];
        if (mesh.name === 'facades') this.set(mesh, index, x, h * .5 + .25, z, w, h, d);
        else if (mesh.name === 'terracotta-roofs') this.set(mesh, index, x, h + .25, z, w + 1.4, roof, d + 1.4);
        else if (mesh.name === 'sidewalks') this.set(mesh, index, x, .1, z, w + 4.5, .2, d + 4.5);
        else continue;
      } else {
        const h = data[p + 2], radius = data[p + 3], palm = data[p + 4] > .5;
        const base = payload.treeBase?.[index] ?? 0;
        if (mesh.name === 'tree-trunks') this.set(mesh, index, x, base + h * .5, z, palm ? .3 : .5, h, palm ? .3 : .5);
        else if (mesh.name === 'tropical-canopy') {
          const start = (group.userData.canopyStart as Int32Array)[index];
          if (palm) for (let leaf = 0; leaf < 5; leaf++) {
            const angle = leaf / 5 * Math.PI * 2 + index;
            this.set(mesh, start + leaf, x + Math.cos(angle) * 1.6, base + h - .25, z + Math.sin(angle) * 1.6, radius * 1.15, .4, .85, -angle);
          }
          else this.set(mesh, start, x, base + h - .5, z, radius, radius * .78, radius);
        } else continue;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    return collider;
  }

  static collider(payload: ChunkPayload, id: string): Collider | null {
    const tree = id.includes('/tree/'), prefix = `${payload.key}/${tree ? 'tree' : 'building'}/`;
    if (!id.startsWith(prefix)) return null;
    const index = Number(id.slice(prefix.length));
    const data = tree ? payload.trees : payload.buildings, stride = tree ? TREE_STRIDE : BUILDING_STRIDE, p = index * stride;
    if (!Number.isInteger(index) || index < 0 || p + stride > data.length) return null;
    const height = tree ? data[p + 2] : data[p + 3] + data[p + 8];
    const base = tree ? payload.treeBase?.[index] ?? 0 : 0;
    return { id, x: data[p], y: base + height * .5, z: data[p + 1], height,
      width: tree ? data[p + 3] * 1.3 : data[p + 2], depth: tree ? data[p + 3] * 1.3 : data[p + 4] };
  }

  disposeChunk(group: Group): void {
    group.removeFromParent();
    group.traverse(object => {
      if (object instanceof InstancedMesh) object.dispose();
      if (object instanceof Mesh && object.userData.ownedGeometry) object.geometry.dispose();
    });
    group.clear();
  }
  setNight(enabled: boolean): void { this.facade.emissiveIntensity = enabled ? .8 : .045; }
  dispose(): void {
    this.box.dispose(); this.roof.dispose(); this.trunk.dispose(); this.crown.dispose(); this.atlas.color?.dispose(); this.atlas.light?.dispose();
    this.facade.dispose(); this.roofMat.dispose(); this.pavement.dispose(); this.bark.dispose(); this.leaves.dispose();
    this.oceanGeometry.dispose();
    this.oceanMaterial.dispose();
    this.megawaveOceanGeometry.dispose();
    this.megawaveOceanMaterial.dispose();
    this.forestGroundGeometry.dispose();
    this.forestGroundMaterial.dispose();
    this.desertGroundMaterial.dispose();
    this.iceGroundMaterial.dispose();
    this.woodlandGroundMaterial.dispose();
    this.urbanGroundMaterial.dispose();
    this.reliefGroundMaterial.dispose();
  }
}
