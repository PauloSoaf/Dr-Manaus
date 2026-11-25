import {
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Vector3,
} from 'three/webgpu';
import { isLandFootprint, isUrban } from './geodata/geodata';

function buildCrossQuadGeometry(uMin: number, uMax: number, width: number, height: number, quadCount = 3): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vIdx = 0;

  for (let q = 0; q < quadCount; q++) {
    const angle = (q * Math.PI) / quadCount;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const x0 = -width * 0.5 * cos, z0 = -width * 0.5 * sin;
    const x1 = width * 0.5 * cos, z1 = width * 0.5 * sin;

    // Outward & upward flared normal for soft 3D foliage lighting
    const nx0 = -sin * 0.8, nz0 = cos * 0.8, ny = 0.45;
    const nx1 = sin * 0.8, nz1 = -cos * 0.8;

    positions.push(x0, 0, z0);
    normals.push(nx0, ny, nz0);
    uvs.push(uMin, 0);

    positions.push(x1, 0, z1);
    normals.push(nx1, ny, nz1);
    uvs.push(uMax, 0);

    positions.push(x1, height, z1);
    normals.push(nx1, ny, nz1);
    uvs.push(uMax, 1);

    positions.push(x0, height, z0);
    normals.push(nx0, ny, nz0);
    uvs.push(uMin, 1);

    indices.push(
      vIdx, vIdx + 1, vIdx + 2,
      vIdx, vIdx + 2, vIdx + 3,
      vIdx + 2, vIdx + 1, vIdx,
      vIdx + 3, vIdx + 2, vIdx,
    );
    vIdx += 4;
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createTreeImpostorAtlas(): { texture: CanvasTexture | null; dispose: () => void } {
  if (typeof document === 'undefined') {
    return { texture: null, dispose: () => {} };
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { texture: null, dispose: () => {} };

  ctx.clearRect(0, 0, 512, 512);

  let seed = 42;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // ==========================================
  // 1. LEFT HALF: Emergent Amazonian Canopy Tree (Castanheira / Samaúma)
  // [0..256] x [0..512]
  // ==========================================
  const cx = 128;

  // Buttressed trunk: wide at base, tapering upwards
  ctx.fillStyle = '#3a2718';
  ctx.beginPath();
  ctx.moveTo(cx - 32, 512);
  ctx.quadraticCurveTo(cx - 14, 380, cx - 10, 200);
  ctx.lineTo(cx + 10, 200);
  ctx.quadraticCurveTo(cx + 14, 380, cx + 32, 512);
  ctx.closePath();
  ctx.fill();

  // Bark fissures & shadow
  ctx.strokeStyle = '#23160d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 8, 510); ctx.quadraticCurveTo(cx - 4, 350, cx - 3, 210);
  ctx.moveTo(cx + 6, 510); ctx.quadraticCurveTo(cx + 3, 340, cx + 2, 210);
  ctx.stroke();

  // Primary canopy branches
  ctx.strokeStyle = '#322114';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(cx, 230); ctx.quadraticCurveTo(cx - 40, 190, cx - 75, 160);
  ctx.moveTo(cx, 230); ctx.quadraticCurveTo(cx + 40, 190, cx + 75, 160);
  ctx.moveTo(cx, 210); ctx.quadraticCurveTo(cx - 20, 160, cx - 35, 120);
  ctx.moveTo(cx, 210); ctx.quadraticCurveTo(cx + 20, 160, cx + 35, 120);
  ctx.stroke();

  const drawFoliageBlob = (x: number, y: number, rx: number, ry: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // Shadow under-layer
  const shadowBlobs = [
    [cx - 65, 180, 42, 28], [cx + 65, 180, 42, 28], [cx, 195, 50, 30],
    [cx - 35, 150, 48, 32], [cx + 35, 150, 48, 32], [cx - 80, 140, 36, 26],
    [cx + 80, 140, 36, 26], [cx, 130, 60, 36],
  ];
  for (const [bx, by, brx, bry] of shadowBlobs) {
    drawFoliageBlob(bx, by, brx, bry, '#1c361e');
  }

  // Mid-tone tropical emerald foliage
  const midBlobs = [
    [cx - 70, 160, 38, 26], [cx + 70, 160, 38, 26], [cx - 40, 130, 44, 30],
    [cx + 40, 130, 44, 30], [cx, 115, 52, 34], [cx - 60, 105, 40, 28],
    [cx + 60, 105, 40, 28], [cx, 85, 48, 32], [cx - 25, 75, 36, 26],
    [cx + 25, 75, 36, 26], [cx, 58, 34, 24],
  ];
  for (const [bx, by, brx, bry] of midBlobs) {
    drawFoliageBlob(bx, by, brx, bry, '#2e6334');
  }

  // Upper sunlit highlight foliage (Amazonian lush emerald greens)
  const highBlobs = [
    [cx - 50, 120, 28, 20], [cx + 50, 120, 28, 20], [cx, 100, 36, 24],
    [cx - 35, 80, 30, 22], [cx + 35, 80, 30, 22], [cx, 65, 32, 22],
    [cx - 15, 50, 24, 18], [cx + 15, 50, 24, 18], [cx, 38, 22, 16],
  ];
  for (const [bx, by, brx, bry] of highBlobs) {
    drawFoliageBlob(bx, by, brx, bry, '#4a8a4f');
  }

  // Edge leaf tufts for natural organic silhouette breakup
  ctx.fillStyle = '#3d7843';
  for (let a = 0; a < Math.PI * 2; a += 0.22) {
    const rx = 105 + rnd() * 15, ry = 80 + rnd() * 15;
    const lx = cx + Math.cos(a) * rx * 0.85;
    const ly = 120 + Math.sin(a) * ry * 0.85;
    if (ly < 220) {
      drawFoliageBlob(lx, ly, 10 + rnd() * 8, 8 + rnd() * 6, rnd() > 0.5 ? '#4e9154' : '#336c39');
    }
  }

  // ==========================================
  // 2. RIGHT HALF: Amazonian Palm Tree (Açaizeiro / Buriti)
  // [256..512] x [0..512]
  // ==========================================
  const px = 384;

  // Slender curved trunk
  ctx.strokeStyle = '#5a493a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(px, 512);
  ctx.quadraticCurveTo(px + 12, 340, px - 6, 175);
  ctx.stroke();

  // Bark rings
  ctx.strokeStyle = '#382c21';
  ctx.lineWidth = 2;
  for (let y = 185; y < 510; y += 18) {
    const xOffset = Math.sin((y / 512) * Math.PI) * 10;
    ctx.beginPath();
    ctx.moveTo(px + xOffset - 6, y);
    ctx.lineTo(px + xOffset + 6, y);
    ctx.stroke();
  }

  // Radiating palm fronds
  const palmApex = { x: px - 6, y: 175 };
  const frondAngles = [
    -0.15, -0.45, -0.85, -1.25, -1.65, -2.05, -2.45, -2.85, -3.10,
    0.20, 0.55, 0.95, 1.35, 1.75, 2.15, 2.55, 2.95,
  ];

  for (const ang of frondAngles) {
    const frondLen = 95 + rnd() * 25;
    const endX = palmApex.x + Math.cos(ang) * frondLen;
    const endY = palmApex.y + Math.sin(ang) * frondLen * 0.75 + (Math.abs(ang) < 1.5 ? 20 : 35);
    const midX = (palmApex.x + endX) * 0.5 + Math.cos(ang) * 15;
    const midY = (palmApex.y + endY) * 0.5 - 25;

    // Rachis stem
    ctx.strokeStyle = '#2d5a31';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(palmApex.x, palmApex.y);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();

    // Leaflets along the frond
    ctx.strokeStyle = ang < 0 ? '#3f8045' : '#4d9954';
    ctx.lineWidth = 2;
    for (let t = 0.2; t <= 0.95; t += 0.08) {
      const lx = (1 - t) * (1 - t) * palmApex.x + 2 * (1 - t) * t * midX + t * t * endX;
      const ly = (1 - t) * (1 - t) * palmApex.y + 2 * (1 - t) * t * midY + t * t * endY;
      const leafLen = Math.sin(t * Math.PI) * 22;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx - 5, ly + leafLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 5, ly + leafLen);
      ctx.stroke();
    }
  }

  // Fruit cluster underneath crown
  ctx.fillStyle = '#423318';
  for (let f = 0; f < 8; f++) {
    drawFoliageBlob(palmApex.x - 6 + (f % 3) * 5, palmApex.y + 8 + Math.floor(f / 3) * 6, 4, 5, '#423318');
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, dispose: () => { texture.dispose(); } };
}

/**
 * Distant Amazonian rainforest cross-quad tree impostors.
 * Replaces low-poly blocky icosahedrons with realistic GTA-style cross-quad billboards
 * textured with high-resolution procedural Castanheira and Buriti/Açaí palm silhouettes.
 */
export class ForestBackdrop {
  private readonly atlas = createTreeImpostorAtlas();
  private readonly canopyGeometry = buildCrossQuadGeometry(0.01, 0.49, 22, 28, 3);
  private readonly palmGeometry = buildCrossQuadGeometry(0.51, 0.99, 14, 20, 3);
  private readonly canopyMaterial = new MeshStandardMaterial(
    this.atlas.texture
      ? {
          map: this.atlas.texture,
          color: 0xffffff,
          alphaTest: 0.35,
          transparent: true,
          roughness: 0.85,
          metalness: 0.04,
          side: DoubleSide,
        }
      : {
          color: 0x2e6334,
          alphaTest: 0.35,
          transparent: true,
          roughness: 0.85,
          metalness: 0.04,
          side: DoubleSide,
        }
  );
  private readonly palmMaterial = new MeshStandardMaterial(
    this.atlas.texture
      ? {
          map: this.atlas.texture,
          color: 0xffffff,
          alphaTest: 0.35,
          transparent: true,
          roughness: 0.85,
          metalness: 0.04,
          side: DoubleSide,
        }
      : {
          color: 0x3f8045,
          alphaTest: 0.35,
          transparent: true,
          roughness: 0.85,
          metalness: 0.04,
          side: DoubleSide,
        }
  );

  readonly mesh: InstancedMesh;
  readonly palms: InstancedMesh;
  private readonly dummy = new Object3D();
  private readonly color = new Color();
  private x = Infinity;
  private z = Infinity;

  constructor(root: Group) {
    this.mesh = new InstancedMesh(this.canopyGeometry, this.canopyMaterial, 6400);
    this.mesh.name = 'distant-rainforest';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    this.palms = new InstancedMesh(this.palmGeometry, this.palmMaterial, 3200);
    this.palms.name = 'distant-palms';
    this.palms.count = 0;
    this.palms.frustumCulled = false;

    root.add(this.mesh, this.palms);
  }

  update(position: Vector3): void {
    const x = Math.round(position.x / 200) * 200, z = Math.round(position.z / 200) * 200;
    if (x === this.x && z === this.z) return;
    this.x = x; this.z = z;

    let count = 0;
    let palmCount = 0;

    // Amazonian rainforest color variation palettes
    const canopyColors = [0x326b38, 0x3f7845, 0x4b8751, 0x56965c, 0x38663d, 0x4d8253, 0x2b5931];
    const palmColors = [0x428a49, 0x4f9e57, 0x5cb365, 0x387d3e, 0x47944f];

    for (let dz = -7800; dz <= 7800; dz += 175) {
      for (let dx = -7800; dx <= 7800; dx += 175) {
        const px = x + dx, pz = z + dz;
        const distSq = dx * dx + dz * dz;

        // Smooth transition ring: starts at 1,400m (overlapping near chunk trees) out to 7,800m
        if (distSq < 1400 * 1400 || !isLandFootprint(px, pz, 155) || isUrban(px, pz)) continue;

        const noise = ((Math.imul(px, 73856093) ^ Math.imul(pz, 19349663)) >>> 0) % 1000 / 1000;
        const noise2 = ((Math.imul(px, 19349663) ^ Math.imul(pz, 73856093)) >>> 0) % 1000 / 1000;

        const isPalm = noise > 0.72;

        if (isPalm && palmCount < 3200) {
          const scale = 0.85 + noise2 * 0.45;
          this.dummy.position.set(px, 1.0, pz);
          this.dummy.scale.set(scale, scale, scale);
          this.dummy.rotation.set(0, noise * Math.PI * 2, 0);
          this.dummy.updateMatrix();
          this.palms.setMatrixAt(palmCount, this.dummy.matrix);
          this.color.setHex(palmColors[Math.floor(noise2 * palmColors.length)]);
          this.palms.setColorAt(palmCount, this.color);
          palmCount++;
        } else if (count < 6400) {
          const scale = 0.85 + noise * 0.55;
          this.dummy.position.set(px, 1.0, pz);
          this.dummy.scale.set(scale, scale, scale);
          this.dummy.rotation.set(0, noise2 * Math.PI * 2, 0);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(count, this.dummy.matrix);
          this.color.setHex(canopyColors[Math.floor(noise * canopyColors.length)]);
          this.mesh.setColorAt(count, this.color);
          count++;
        }
      }
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.palms.count = palmCount;
    this.palms.instanceMatrix.needsUpdate = true;
    if (this.palms.instanceColor) this.palms.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.canopyGeometry.dispose();
    this.palmGeometry.dispose();
    this.canopyMaterial.dispose();
    this.palmMaterial.dispose();
    this.atlas.dispose();
    this.mesh.dispose();
    this.palms.dispose();
    this.mesh.removeFromParent();
    this.palms.removeFromParent();
  }
}
