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

export class BlackHoleProvider {
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
    
    // Position is updated in update()

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

  update(address: import('../spatial/UniverseAddress').UniverseAddress, cameraPosM: import('../spatial/units').Vec3, altitudeM: number): void {
    // TODO: Do not call black holes functional until GravitySource/event horizon/lensing exist.
    this.group.visible = altitudeM >= this.options.minAltitudeM;
    if (!this.group.visible) return;

    // We assume the black hole is in the Milky Way for now (Sgr A*).
    if (address.galaxyId !== 'milky-way') {
      this.group.visible = false;
      return;
    }

    const SECTOR_SIZE_M = 100 * 9.4607304725808e15;
    const cx = Number(address.sector.x) * SECTOR_SIZE_M + cameraPosM[0];
    const cy = Number(address.sector.y) * SECTOR_SIZE_M + cameraPosM[1];
    const cz = Number(address.sector.z) * SECTOR_SIZE_M + cameraPosM[2];

    const pos = this.options.blackHole.positionM;
    // VERY IMPORTANT: Render locally relative to the camera!
    // Using a METRES_PER_UNIT scaling for things this far if necessary, but Sgr A* might be approached.
    // For now, scale down if it is too far to avoid depth issues, or just place it normally if we are close.
    // Let's place it at its exact relative position. If it's 26000 ly away, we need scaling.
    const GALAXY_METRES_PER_UNIT = 4e15;
    this.group.position.set(
      (pos[0] - cx) / GALAXY_METRES_PER_UNIT,
      (pos[1] - cy) / GALAXY_METRES_PER_UNIT,
      (pos[2] - cz) / GALAXY_METRES_PER_UNIT
    );
  }
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
