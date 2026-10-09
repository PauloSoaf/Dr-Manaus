import { galaxyDefinition, galaxyLocalPositionM, orientGalaxyVector } from '../galaxy/GalaxyCoordinates';
import type { Vec3 } from '../spatial/units';
import { Group, Mesh, Object3D, SphereGeometry, TorusGeometry, MeshBasicMaterial, MeshStandardMaterial, DoubleSide } from 'three/webgpu';
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
  galaxyId?:string;
  /** Below this altitude from the body, the black hole is drawn. */
  minAltitudeM?: number;
}

const G = 6.6743e-11;
const C = 299792458;
const GALAXY_METRES_PER_UNIT = 4e15;

export class BlackHoleProvider {
  readonly id: string;
  readonly priority = 5;

  readonly group = new Group();
  private readonly options: Required<BlackHoleProviderOptions>;
  private readonly eventHorizon: Mesh;
  private accretionDisk?: Mesh;


  constructor(parent: Object3D, options: BlackHoleProviderOptions) {
    this.id = `blackhole/${options.blackHole.id}`;
    this.options = {
      blackHole: options.blackHole,
      galaxyId:options.galaxyId??'milky_way',
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 0)),
    };
    
    this.group.name = `Black Hole ${options.blackHole.id}`;
    this.group.visible = false;
    
    const def = this.options.blackHole;
    const rsM = (2 * G * def.massKg) / (C * C);
    // Convert Schwarzschild radius to galactic render units
    // Provide a visible minimum radius for galactic scale rendering so it doesn't vanish below float precision
    const rs = Math.max(rsM / GALAXY_METRES_PER_UNIT, 0.05);

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

  update(address: import('../spatial/UniverseAddress').UniverseAddress,cameraPosM:Vec3,altitudeM:number,sectorOffsetM:Vec3=[0,0,0],toRenderDirection:(v:Vec3)=>Vec3=v=>v):void {
    const galaxy=galaxyDefinition(this.options.galaxyId);
    this.group.visible=address.galaxyId===this.options.galaxyId && altitudeM>=this.options.minAltitudeM && !!galaxy;
    if(!this.group.visible||!galaxy)return;
    const local=galaxyLocalPositionM(galaxy,address.sector,sectorOffsetM);
    const bh=this.options.blackHole.positionM.map((v,i)=>v-galaxy.positionM[i]) as Vec3;
    const localBH=orientGalaxyVector(galaxy,bh,true);
    const delta=localBH.map((v,i)=>v-local[i]) as Vec3,distance=Math.hypot(...delta);
    if(distance<=0){this.group.visible=false;return;}
    const direction=toRenderDirection(delta.map(v=>v/distance) as Vec3);
    this.group.position.set(...direction.map((v,i)=>cameraPosM[i]+v*18_000) as Vec3);
    // Presentation floor, not a physical horizon/capture boundary.
    this.group.scale.setScalar(100);
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
