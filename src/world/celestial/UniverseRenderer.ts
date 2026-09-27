import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, Object3D } from 'three/webgpu';
import { generateStarSector } from './StarSector';
import { sectorIndex, SECTOR_SIZE_M, type SectorIndex, sectorKey } from '../spatial/UniverseAddress';
import type { UniverseRuntime } from '../runtime/UniverseRuntime';

export class UniverseRenderer {
  public group = new Group();
  private meshes = new Map<string, Object3D>();
  private material = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });

  constructor(private runtime: UniverseRuntime) {
    this.group.name = 'UniverseRenderer';
    // FTL scaling is massive, so the far plane needs to be infinite.
    // Instead of actual points, we will scale the sector by 1e-12 so 100 LY (1e18 meters) becomes 1e6 meters!
  }

  private loadSector(sector: SectorIndex) {
    const key = sectorKey('milky_way', sector);
    if (this.meshes.has(key)) return;
    
    const sectorContent = generateStarSector('milky_way', sector, { maxStars: 1000 });
    const stars = sectorContent.stars;
    
    const positions = new Float32Array(stars.length * 3);
    const colors = new Float32Array(stars.length * 3);
    
    const scaleDown = 1e-12; // Scale universe down by 1 trillion
    
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      // Vertex position is local to the sector origin
      positions[i * 3] = star.offsetM[0] * scaleDown;
      positions[i * 3 + 1] = star.offsetM[1] * scaleDown;
      positions[i * 3 + 2] = star.offsetM[2] * scaleDown;
      
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.9;
      colors[i * 3 + 2] = 0.8;
    }
    
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    
    const mesh = new Points(geo, this.material);
    mesh.frustumCulled = false;
    this.meshes.set(key, mesh);
    this.group.add(mesh);
  }

  update(camera: PerspectiveCamera) {
    // Current player position (real coordinates)
    const playerM = this.runtime.player.position;
    
    // We move the group to the camera's exact rendering position
    this.group.position.copy(camera.position);
    
    // Scale down factor
    const scaleDown = 1e-12;
    
    // We update the geometry vertices or we can just shift the mesh positions
    // Actually, shifting the mesh positions works perfectly if we adjust them relative to player!
    for (const [key, mesh] of this.meshes.entries()) {
      // Decode sector from key
      const parts = key.split('/');
      if (parts.length < 2) continue;
      const coords = parts[1].split(',');
      const sx = BigInt(coords[0]);
      const sy = BigInt(coords[1]);
      const sz = BigInt(coords[2]);
      
      const sectorBaseX = Number(sx) * SECTOR_SIZE_M;
      const sectorBaseY = Number(sy) * SECTOR_SIZE_M;
      const sectorBaseZ = Number(sz) * SECTOR_SIZE_M;
      
      // We want the mesh to be positioned at (sectorBase - playerM) * scaleDown
      mesh.position.set(
        (sectorBaseX - playerM[0]) * scaleDown,
        (sectorBaseY - playerM[1]) * scaleDown,
        (sectorBaseZ - playerM[2]) * scaleDown
      );
    }
    
    // Current sector
    const sx = BigInt(Math.floor(playerM[0] / SECTOR_SIZE_M));
    const sy = BigInt(Math.floor(playerM[1] / SECTOR_SIZE_M));
    const sz = BigInt(Math.floor(playerM[2] / SECTOR_SIZE_M));
    
    // Load a 3x3x3 grid
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          this.loadSector(sectorIndex(sx + BigInt(dx), sy + BigInt(dy), sz + BigInt(dz)));
        }
      }
    }
  }
}
