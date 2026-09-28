import { BufferGeometry, Float32BufferAttribute, Group, Object3D, Points, PointsMaterial, AdditiveBlending } from 'three/webgpu';
import type { CoverageClaim, SpatialContext, StreamingContext, WorldProvider } from './WorldProvider';
import type { GalaxyDefinition } from '../celestial/GalaxyDefinition';
import { finite } from '../spatial/units';

export interface GalaxyProviderOptions {
  galaxy: GalaxyDefinition;
  /** Altitude above which this galaxy is rendered as a macro structure. */
  minAltitudeM?: number;
}

const GALAXY_METRES_PER_UNIT = 4e15; // Same as StarSectorProvider to avoid precision issues

export class GalaxyProvider {
  readonly id: string;
  readonly priority = 2; // Above StarSectors but below local bodies

  readonly group = new Group();
  private readonly options: Required<GalaxyProviderOptions>;
  private readonly mesh: Points;
  private readonly material: PointsMaterial;

  private altitudeM = 0;

  constructor(parent: Object3D, options: GalaxyProviderOptions) {
    this.id = `galaxy-macro/${options.galaxy.id}`;
    this.options = {
      galaxy: options.galaxy,
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 0)),
    };
    
    this.group.name = `Galaxy ${options.galaxy.id}`;
    this.group.visible = false;
    
    // Create an impostor/volume representation using a point cloud.
    // This represents the "G1 approach" LOD from the specification.
    const starCount = 50000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    
    // Ly to local units
    const LY_TO_U = 9.4607304725808e15 / GALAXY_METRES_PER_UNIT;
    const radiusU = (this.options.galaxy.diameterLy / 2) * LY_TO_U;
    const thicknessU = this.options.galaxy.thicknessLy * LY_TO_U;
    
    // Deterministic seed derived from galaxy.id
    let seed = 2166136261;
    for (let c = 0; c < this.options.galaxy.id.length; c++) {
      seed = Math.imul(seed ^ this.options.galaxy.id.charCodeAt(c), 16777619) >>> 0;
    }
    if (seed === 0) seed = 123456789;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < starCount; i++) {
      // Very crude exponential disc approximation for the impostor
      const r = -radiusU * Math.log(1 - random()) / 3;
      const theta = random() * Math.PI * 2;
      const h = -thicknessU * Math.log(1 - random()) * (random() > 0.5 ? 1 : -1) / 3;
      
      const x = r * Math.cos(theta);
      const y = h;
      const z = r * Math.sin(theta);
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      // Color based on radius (blueish rim, yellowish core)
      const t = Math.min(1, r / radiusU);
      colors[i * 3] = 1 - t * 0.3;     // r
      colors[i * 3 + 1] = 0.8 + t * 0.2; // g
      colors[i * 3 + 2] = 0.6 + t * 0.4; // b
    }
    
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    
    this.material = new PointsMaterial({
      size: 1.0,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    
    this.mesh = new Points(geometry, this.material);
    this.group.add(this.mesh);
    
    if (this.options.galaxy.orientationEuler) {
      this.group.rotation.set(...this.options.galaxy.orientationEuler);
    }
    
    parent.add(this.group);
  }

  get stats() {
    return { visible: this.group.visible };
  }

  update(address: import('../spatial/UniverseAddress').UniverseAddress, cameraPosM: import('../spatial/units').Vec3, altitudeM: number): void {
    if (address.galaxyId === this.options.galaxy.id) {
      this.group.visible = false; // We are inside it! StarSectorProvider handles inside.
      return;
    }
    this.group.visible = altitudeM >= this.options.minAltitudeM;
    if (!this.group.visible) return;

    // We are observing this galaxy from another galaxy or the cosmic web.
    // Calculate relative distance carefully. For now, since we lack a full galactic coordinate system in `address`,
    // we'll just position it relative to the Milky Way (sector 0) as an approximation.
    const pos = this.options.galaxy.positionM;
    
    const SECTOR_SIZE_M = 100 * 9.4607304725808e15;
    const cx = Number(address.sector.x) * SECTOR_SIZE_M + cameraPosM[0];
    const cy = Number(address.sector.y) * SECTOR_SIZE_M + cameraPosM[1];
    const cz = Number(address.sector.z) * SECTOR_SIZE_M + cameraPosM[2];

    this.group.position.set(
      (pos[0] - cx) / GALAXY_METRES_PER_UNIT, 
      (pos[1] - cy) / GALAXY_METRES_PER_UNIT, 
      (pos[2] - cz) / GALAXY_METRES_PER_UNIT
    );
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
