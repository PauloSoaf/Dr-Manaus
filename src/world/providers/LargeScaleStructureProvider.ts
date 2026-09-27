import { 
  BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, 
  Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Color, DoubleSide 
} from 'three/webgpu';
import type { CoverageClaim, SpatialContext, StreamingContext, WorldProvider } from './WorldProvider';
import { finite } from '../spatial/units';

export interface CosmicAnchor {
  id: string;
  name: string;
  positionMpc: [number, number, number];
  massSolar: number;
}

export const KNOWN_COSMIC_ANCHORS: CosmicAnchor[] = [
  { id: 'local_group', name: 'Local Group', positionMpc: [0, 0, 0], massSolar: 2e12 },
  { id: 'virgo_cluster', name: 'Virgo Cluster', positionMpc: [16.5, 0, 0], massSolar: 1.2e15 },
  { id: 'norma_cluster', name: 'Norma Cluster / Great Attractor', positionMpc: [68, -10, 20], massSolar: 1e16 },
  { id: 'shapley_supercluster', name: 'Shapley Supercluster', positionMpc: [200, -30, 60], massSolar: 1e17 }
];

export interface LargeScaleStructureProviderOptions {
  /** Draw the Cosmic Microwave Background (Observable Universe Horizon). */
  drawCMB?: boolean;
}

const MPC_TO_M = 3.085677581e22;
// To avoid floating point issues and keep it within WebGL depth buffer:
// We use a massive scale factor for the cosmological layer.
const COSMIC_METRES_PER_UNIT = 1e21; 

export class LargeScaleStructureProvider implements WorldProvider {
  readonly id = 'cosmic/large-scale-structure';
  readonly priority = 1;

  readonly group = new Group();
  private readonly options: LargeScaleStructureProviderOptions;

  private cmbMesh?: Mesh;
  private clustersMesh?: InstancedMesh;

  private altitudeM = 0;

  constructor(parent: Object3D, options: LargeScaleStructureProviderOptions = {}) {
    this.options = {
      drawCMB: options.drawCMB ?? true,
    };
    
    this.group.name = 'Large Scale Structure';
    this.group.visible = false;

    if (this.options.drawCMB) {
      // The observable universe is ~93 billion light years in diameter.
      // Radius ~ 46.5 billion ly = 14200 Mpc.
      const radiusMpc = 14200;
      const radiusU = (radiusMpc * MPC_TO_M) / COSMIC_METRES_PER_UNIT;
      const cmbGeom = new SphereGeometry(radiusU, 64, 64);
      // CMB is a faint microwave background, representing the last scattering surface.
      // We will render it as a faint dark red/orange sphere representing redshifted plasma.
      const cmbMat = new MeshBasicMaterial({ 
        color: 0x110200, 
        side: DoubleSide,
        depthWrite: false,
        fog: false,
      });
      this.cmbMesh = new Mesh(cmbGeom, cmbMat);
      this.group.add(this.cmbMesh);
    }

    // Instanced mesh for major cosmic anchors (clusters and superclusters)
    const clusterGeom = new SphereGeometry(1, 16, 16);
    const clusterMat = new MeshBasicMaterial({ color: 0xffffff, fog: false });
    
    this.clustersMesh = new InstancedMesh(clusterGeom, clusterMat, KNOWN_COSMIC_ANCHORS.length);
    const dummy = new Object3D();
    const color = new Color();
    
    for (let i = 0; i < KNOWN_COSMIC_ANCHORS.length; i++) {
      const anchor = KNOWN_COSMIC_ANCHORS[i];
      const posU = [
        (anchor.positionMpc[0] * MPC_TO_M) / COSMIC_METRES_PER_UNIT,
        (anchor.positionMpc[1] * MPC_TO_M) / COSMIC_METRES_PER_UNIT,
        (anchor.positionMpc[2] * MPC_TO_M) / COSMIC_METRES_PER_UNIT,
      ];
      dummy.position.set(posU[0], posU[1], posU[2]);
      
      // Radius scales with log of mass, just to have some visible difference
      const scale = Math.log10(anchor.massSolar) * 2.0; 
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      
      this.clustersMesh.setMatrixAt(i, dummy.matrix);
      
      // Color: faint white/blue for massive clusters
      color.setHex(0xaaaaee);
      this.clustersMesh.setColorAt(i, color);
    }
    
    this.clustersMesh.instanceMatrix.needsUpdate = true;
    if (this.clustersMesh.instanceColor) {
      this.clustersMesh.instanceColor.needsUpdate = true;
    }
    
    this.group.add(this.clustersMesh);

    parent.add(this.group);
  }

  get stats() {
    return { visible: this.group.visible, clusters: KNOWN_COSMIC_ANCHORS.length };
  }

  coverage(): readonly CoverageClaim[] { return []; }

  covers(context: SpatialContext): boolean {
    this.altitudeM = finite(context.altitudeM);
    // Draw it when we are in intergalactic space
    // ~10 million light years altitude
    this.group.visible = this.altitudeM >= 9e21; 
    return this.group.visible;
  }

  plan(context: StreamingContext): import('../streaming/TileDemand').TileDemand[] { return []; }
  load(): Promise<import('../streaming/TileDemand').TilePayload> { return Promise.reject(new Error('LargeScaleStructureProvider does not stream tiles.')); }
  activate(payload: import('../streaming/TileDemand').TilePayload, frame: import('../spatial/ReferenceFrame').ActiveReferenceFrame): import('../streaming/TileDemand').ActiveTile {
    throw new Error('LargeScaleStructureProvider does not use the scheduler.');
  }
  deactivate(tile: import('../streaming/TileDemand').ActiveTile) {}
  
  dispose(): void {
    this.group.removeFromParent();
    this.clustersMesh?.geometry.dispose();
    (this.clustersMesh?.material as any).dispose();
    this.cmbMesh?.geometry.dispose();
    (this.cmbMesh?.material as any).dispose();
  }
}
