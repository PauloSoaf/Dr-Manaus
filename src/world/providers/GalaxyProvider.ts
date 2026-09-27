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

export class GalaxyProvider implements WorldProvider {
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
    
    for (let i = 0; i < starCount; i++) {
      // Very crude exponential disc approximation for the impostor
      const r = -radiusU * Math.log(1 - Math.random()) / 3;
      const theta = Math.random() * Math.PI * 2;
      const h = -thicknessU * Math.log(1 - Math.random()) * (Math.random() > 0.5 ? 1 : -1) / 3;
      
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
    
    // Position and rotation
    const pos = this.options.galaxy.positionM;
    this.group.position.set(pos[0] / GALAXY_METRES_PER_UNIT, pos[1] / GALAXY_METRES_PER_UNIT, pos[2] / GALAXY_METRES_PER_UNIT);
    
    if (this.options.galaxy.orientationEuler) {
      this.group.rotation.set(...this.options.galaxy.orientationEuler);
    }
    
    parent.add(this.group);
  }

  get stats() {
    return { visible: this.group.visible };
  }

  coverage(): readonly CoverageClaim[] { return []; }

  covers(context: SpatialContext): boolean {
    this.altitudeM = finite(context.altitudeM);
    // Draw it as long as we are high enough
    this.group.visible = this.altitudeM >= this.options.minAltitudeM;
    return this.group.visible;
  }

  plan(context: StreamingContext): import('../streaming/TileDemand').TileDemand[] { return []; }
  load(): Promise<import('../streaming/TileDemand').TilePayload> { return Promise.reject(new Error('GalaxyProvider does not stream tiles.')); }
  activate(payload: import('../streaming/TileDemand').TilePayload, frame: import('../spatial/ReferenceFrame').ActiveReferenceFrame): import('../streaming/TileDemand').ActiveTile {
    throw new Error('GalaxyProvider does not use the scheduler.');
  }
  deactivate(tile: import('../streaming/TileDemand').ActiveTile) {}
  
  dispose(): void {
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
