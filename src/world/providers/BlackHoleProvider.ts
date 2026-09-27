import { Color, Group, Mesh, Object3D, SphereGeometry, TorusGeometry, MeshBasicMaterial, MeshStandardMaterial, DoubleSide } from 'three/webgpu';
import type { CoverageClaim, SpatialContext, StreamingContext, WorldProvider } from './WorldProvider';
import { finite } from '../spatial/units';

export interface BlackHoleDefinition {
  id: string;
  massKg: number;
  spin01: number;
  positionM: [number, number, number]; // Position in the local system or galactic frame
  accretion?: {
    innerRadiusRs: number;
    outerRadiusRs: number;
    temperatureK: number;
    luminosity: number;
  };
}

export interface BlackHoleProviderOptions {
  blackHole: BlackHoleDefinition;
  /** Below this altitude from the body, the black hole is drawn. */
  minAltitudeM?: number;
}

const G = 6.6743e-11;
const C = 299792458;

export class BlackHoleProvider implements WorldProvider {
  readonly id: string;
  readonly priority = 5;

  readonly group = new Group();
  private readonly options: Required<BlackHoleProviderOptions>;
  private readonly eventHorizon: Mesh;
  private accretionDisk?: Mesh;

  private altitudeM = 0;

  constructor(parent: Object3D, options: BlackHoleProviderOptions) {
    this.id = `blackhole/${options.blackHole.id}`;
    this.options = {
      blackHole: options.blackHole,
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 0)),
    };
    
    this.group.name = `Black Hole ${options.blackHole.id}`;
    this.group.visible = false;
    
    const def = this.options.blackHole;
    const rs = (2 * G * def.massKg) / (C * C);
    
    // Position it in the frame
    this.group.position.set(def.positionM[0], def.positionM[1], def.positionM[2]);

    // Basic event horizon (pitch black sphere)
    const geometry = new SphereGeometry(rs, 64, 64);
    const material = new MeshBasicMaterial({ color: 0x000000 });
    this.eventHorizon = new Mesh(geometry, material);
    this.group.add(this.eventHorizon);

    // Basic accretion disk
    if (def.accretion) {
      const inner = def.accretion.innerRadiusRs * rs;
      const outer = def.accretion.outerRadiusRs * rs;
      const diskGeom = new TorusGeometry((inner + outer) / 2, (outer - inner) / 2, 16, 100);
      
      // We will make it extremely bright orange for now, representing hot gas
      // TSL nodes can be added later for the Doppler beaming and lensing
      const diskMat = new MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff5500,
        emissiveIntensity: 5.0,
        side: DoubleSide,
      });
      this.accretionDisk = new Mesh(diskGeom, diskMat);
      this.accretionDisk.rotation.x = Math.PI / 2; // Flat disk
      this.group.add(this.accretionDisk);
    }

    parent.add(this.group);
  }

  get stats() {
    return { visible: this.group.visible };
  }

  coverage(): readonly CoverageClaim[] { return []; }

  covers(context: SpatialContext): boolean {
    this.altitudeM = finite(context.altitudeM);
    // Draw it as long as we are high enough (or always if minAltitudeM is 0)
    this.group.visible = this.altitudeM >= this.options.minAltitudeM;
    return this.group.visible;
  }

  plan(context: StreamingContext): import('../streaming/TileDemand').TileDemand[] { return []; }
  load(): Promise<import('../streaming/TileDemand').TilePayload> { return Promise.reject(new Error('BlackHoleProvider does not stream tiles.')); }
  activate(payload: import('../streaming/TileDemand').TilePayload, frame: import('../spatial/ReferenceFrame').ActiveReferenceFrame): import('../streaming/TileDemand').ActiveTile {
    throw new Error('BlackHoleProvider does not use the scheduler.');
  }
  deactivate(tile: import('../streaming/TileDemand').ActiveTile) {}
  dispose(): void {
    this.group.removeFromParent();
    this.eventHorizon.geometry.dispose();
    (this.eventHorizon.material as any).dispose();
    if (this.accretionDisk) {
      this.accretionDisk.geometry.dispose();
      (this.accretionDisk.material as any).dispose();
    }
  }
}
