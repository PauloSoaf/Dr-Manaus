import { galaxyDefinition, galaxyLocalPositionM, orientGalaxyVector } from '../galaxy/GalaxyCoordinates';
import type { Vec3 } from '../spatial/units';
import { Group, Mesh, Object3D, SphereGeometry, TorusGeometry, RingGeometry, Vector3, MeshBasicMaterial, MeshStandardMaterial, DoubleSide, BufferAttribute } from 'three/webgpu';
import { finite } from '../spatial/units';
import {
  schwarzschildRadiusM,
  blackHoleShadowRadiusM,
  kerrHorizonRadiusM,
  type BlackHoleDescriptor,
} from '../celestial/BlackHoleDescriptor';
import type { BlackHoleDefinition } from '../blackhole/BlackHoleDefinition';

export type { BlackHoleDefinition } from '../blackhole/BlackHoleDefinition';

export interface BlackHoleProviderOptions {
  blackHole: BlackHoleDefinition | BlackHoleDescriptor;
  galaxyId?: string;
  /** Below this altitude from the body, the black hole is drawn. */
  minAltitudeM?: number;
}

const GALAXY_METRES_PER_UNIT = 4e15;

export class BlackHoleProvider {
  readonly id: string;
  readonly priority = 5;

  readonly group = new Group();
  private readonly options: Required<BlackHoleProviderOptions>;
  private readonly eventHorizon: Mesh;
  private accretionDisk?: Mesh;
  private readonly photonRing: Mesh;

  constructor(parent: Object3D, options: BlackHoleProviderOptions) {
    this.id = `blackhole/${options.blackHole.id}`;
    this.options = {
      blackHole: options.blackHole,
      galaxyId: options.galaxyId ?? 'milky_way',
      minAltitudeM: Math.max(0, finite(options.minAltitudeM, 0)),
    };
    
    this.group.name = `Black Hole ${options.blackHole.id}`;
    this.group.visible = false;
    
    const def = this.options.blackHole;
    const rsM = 'schwarzschildRadiusM' in def ? def.schwarzschildRadiusM : schwarzschildRadiusM(def.massKg);
    const shadowM = 'shadowRadiusM' in def ? def.shadowRadiusM : blackHoleShadowRadiusM(def.massKg, def.spin01);
    
    // Convert apparent lensed shadow radius to galactic render units
    // Provide a visible minimum radius for galactic scale rendering so it doesn't vanish below float precision
    const shadowR = Math.max(shadowM / GALAXY_METRES_PER_UNIT, 0.05);

    // Relativistic event horizon shadow (pitch black sphere with apparent lensed radius)
    const geometry = new SphereGeometry(shadowR, 64, 64);
    const material = new MeshBasicMaterial({ color: 0x000000 });
    this.eventHorizon = new Mesh(geometry, material);
    this.group.add(this.eventHorizon);

    // Accretion disk
    if (def.accretion) {
      const rs = Math.max(rsM / GALAXY_METRES_PER_UNIT, 0.05);
      const innerRadiusRs = 'innerRadiusM' in def.accretion ? (def.accretion.innerRadiusM / Math.max(1, rsM)) : (def.accretion as any).innerRadiusRs;
      const outerRadiusRs = 'outerRadiusM' in def.accretion ? (def.accretion.outerRadiusM / Math.max(1, rsM)) : (def.accretion as any).outerRadiusRs;
      const inner = Math.max(innerRadiusRs * rs, shadowR * 1.05);
      const outer = Math.max(outerRadiusRs * rs, inner * 1.5);
      const majorR = (inner + outer) / 2;
      const tubeR = (outer - inner) / 2;
      const diskGeom = new TorusGeometry(majorR, tubeR, 16, 100);
      const posAttr = diskGeom.getAttribute('position');
      const colors = new Float32Array(posAttr.count * 3);
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const r = Math.hypot(vx, vy);
        // Radial temperature gradient: 1 at inner ISCO edge (white-hot), 0 at outer edge (deep orange)
        const radialHeat = Math.max(0, Math.min(1, 1 - (r - inner) / Math.max(1e-5, outer - inner)));
        // Relativistic Doppler beaming: approaching side (+X) brighter, receding side (-X) dimmer
        const cosAzimuth = r > 1e-6 ? vx / r : 0;
        const dopplerBoost = Math.max(0.25, Math.min(1.65, 1.0 + 0.55 * cosAzimuth));
        const intensity = (0.35 + 0.65 * radialHeat) * dopplerBoost;
        colors[i * 3] = Math.min(1.0, 1.0 * intensity);
        colors[i * 3 + 1] = Math.min(1.0, (0.32 + 0.58 * radialHeat) * intensity);
        colors[i * 3 + 2] = Math.min(1.0, (0.05 + 0.65 * radialHeat * radialHeat) * intensity);
      }
      diskGeom.setAttribute('color', new BufferAttribute(colors, 3));

      // Hot glowing relativistic accretion plasma with radial heat + Doppler beaming vertex colours
      const diskMat = new MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xff6600,
        emissiveIntensity: 3.5,
        vertexColors: true,
        side: DoubleSide,
      });
      this.accretionDisk = new Mesh(diskGeom, diskMat);
      this.accretionDisk.rotation.x = Math.PI / 2; // Flat disk
      this.group.add(this.accretionDisk);
    }

    // Relativistic photon ring (lensed optical photon sphere boundary)
    const photonInner = shadowR * 1.002;
    const photonOuter = shadowR * 1.035;
    const photonGeom = new RingGeometry(photonInner, photonOuter, 96);
    const photonMat = new MeshBasicMaterial({
      color: 0xfff3e0,
      side: DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.photonRing = new Mesh(photonGeom, photonMat);
    this.photonRing.name = 'photon-ring';
    this.group.add(this.photonRing);

    parent.add(this.group);
  }

  get stats() {
    return {
      visible: this.group.visible,
      hasAccretion: !!this.accretionDisk,
      hasPhotonRing: true,
    };
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
    // Orient photon ring toward the observer line of sight
    this.photonRing.lookAt(cameraPosM[0], cameraPosM[1], cameraPosM[2]);
    if (this.accretionDisk) {
      this.accretionDisk.rotation.z = (this.accretionDisk.rotation.z + 0.015) % (Math.PI * 2);
    }
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
    this.photonRing.geometry.dispose();
    (this.photonRing.material as any).dispose();
  }
}
