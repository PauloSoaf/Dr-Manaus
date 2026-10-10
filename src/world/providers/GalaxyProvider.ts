import { globalTargetDeltaM, galaxyDefinition, orientGalaxyVector } from '../galaxy/GalaxyCoordinates';
import { LIGHT_YEAR_M, type Vec3 } from '../spatial/units';
import { BufferGeometry, Float32BufferAttribute, Group, Object3D, Points, PointsMaterial, AdditiveBlending, Matrix4, Vector3 } from 'three/webgpu';
import type { GalaxyDefinition } from '../celestial/GalaxyDefinition';
import { finite } from '../spatial/units';

export interface GalaxyProviderOptions {
  galaxy: GalaxyDefinition;
  /** Altitude above which this galaxy is rendered as a macro structure. */
  minAltitudeM?: number;
}


export class GalaxyProvider {
  readonly id: string;
  readonly priority = 2; // Above StarSectors but below local bodies

  readonly group = new Group();
  private readonly options: Required<GalaxyProviderOptions>;
  private readonly mesh: Points;
  private readonly material: PointsMaterial;
  private readonly orientationMatrix=new Matrix4();
  private readonly axes=[new Vector3(),new Vector3(),new Vector3()];


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
    
    // Unit disc; angular extent is applied to its bounded camera-relative proxy.
    const radiusU = 1;
    const thicknessU = this.options.galaxy.thicknessLy / (this.options.galaxy.diameterLy/2);
    
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
      positions[i * 3 + 1] = z;
      positions[i * 3 + 2] = y;
      
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
    this.mesh.renderOrder=-10;this.mesh.frustumCulled=false;
    this.group.add(this.mesh);
    
    if (this.options.galaxy.orientationEuler) {
      this.group.rotation.set(...this.options.galaxy.orientationEuler);
    }
    
    parent.add(this.group);
  }

  get stats() {
    return { visible: this.group.visible };
  }

  update(address: import('../spatial/UniverseAddress').UniverseAddress, cameraPosM: Vec3, altitudeM: number, sectorOffsetM:Vec3=[0,0,0],toRenderDirection:(v:Vec3)=>Vec3=v=>v): void {
    const delta=globalTargetDeltaM(address,sectorOffsetM,this.options.galaxy.positionM);
    this.group.visible=address.galaxyId!==this.options.galaxy.id && altitudeM>=this.options.minAltitudeM && !!delta;
    if(!this.group.visible||!delta)return;
    const distance=Math.hypot(...delta),proxyDistance=20_000;
    if(distance<=0){this.group.visible=false;return;}
    const active=galaxyDefinition(address.galaxyId)!;
    const direction=toRenderDirection(orientGalaxyVector(active,delta.map(v=>v/distance) as Vec3,true));
    this.group.position.set(...direction.map((v,i)=>cameraPosM[i]+v*proxyDistance) as Vec3);
    for(let i=0;i<3;i++){
      const basis:Vec3=[0,0,0];basis[i]=1;
      this.axes[i].set(...toRenderDirection(orientGalaxyVector(active,orientGalaxyVector(this.options.galaxy,basis),true)));
    }
    this.group.quaternion.setFromRotationMatrix(this.orientationMatrix.makeBasis(this.axes[0],this.axes[1],this.axes[2]));
    this.group.scale.setScalar(Math.min(4000,proxyDistance*this.options.galaxy.diameterLy*.5*LIGHT_YEAR_M/distance));
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
