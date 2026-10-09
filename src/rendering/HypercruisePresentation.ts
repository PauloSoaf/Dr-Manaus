import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Points, PointsMaterial, Vector3, type PerspectiveCamera } from 'three/webgpu';
import { LOCAL_GROUP_CATALOG } from '../world/celestial/GalaxyDefinition';
import { LIGHT_YEAR_M } from '../world/spatial/units';
import type { UniversalTransitState } from '../world/travel/UniversalTravelController';

/** Fixed buffers and camera-relative proxies. No astronomical render positions or per-frame geometry. */
export class HypercruisePresentation {
  readonly root=new Group();
  readonly lines:LineSegments;
  private readonly positions=new Float32Array(384*6);
  private readonly seeds=new Float32Array(384*3);
  private readonly direction=new Vector3(0,0,-1);
  private readonly forward=new Vector3(0,0,-1);
  private readonly galaxies=new Map<string,Points>();
  private readonly material=new LineBasicMaterial({color:0xaedaff,transparent:true,opacity:0,depthWrite:false,fog:false,blending:AdditiveBlending});
  private fade=0;
  constructor(parent:Group) {
    this.root.name='Universal hypercruise presentation';parent.add(this.root);this.root.visible=false;
    let seed=0x183ec4;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<384;i++){this.seeds[i*3]=(random()-.5)*24000;this.seeds[i*3+1]=(random()-.5)*14000;this.seeds[i*3+2]=random();}
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(this.positions,3));
    this.lines=new LineSegments(geometry,this.material);this.lines.frustumCulled=false;this.root.add(this.lines);
    for(const def of LOCAL_GROUP_CATALOG){
      const p=new Float32Array(4096*3);
      for(let i=0;i<4096;i++){const angle=random()*Math.PI*2,r=-Math.log(Math.max(.0001,1-random()))/4;
        p[i*3]=Math.cos(angle)*r;p[i*3+1]=Math.sin(angle)*r*.5;p[i*3+2]=(random()-.5)*.03;}
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));
      const points=new Points(g,new PointsMaterial({color:def.id==='andromeda'?0xb9d5ff:0xffdfac,size:1.4,sizeAttenuation:false,
        transparent:true,depthWrite:false,fog:false,blending:AdditiveBlending}));
      points.name=`Transit galaxy ${def.id}`;points.frustumCulled=false;this.root.add(points);this.galaxies.set(def.id,points);
    }
  }
  setDirection(direction:readonly number[]):void {this.direction.set(direction[0],direction[1],direction[2]);
    if(this.direction.lengthSq()<1e-12)this.direction.copy(this.forward);this.direction.normalize();
    this.root.quaternion.setFromUnitVectors(this.forward,this.direction);}
  update(state:UniversalTransitState|undefined,camera:PerspectiveCamera,dt:number):void {
    const moving=state&&!['coasting','arrival-hold'].includes(state.phase);
    const intensity=state?Math.min(1,state.effectiveSpeedMps/(state.plan.logicalDistanceM/state.plan.durationS)):0;
    this.fade+=(Number(!!moving)-this.fade)*Math.min(1,dt*6);
    this.root.visible=!!state||this.fade>.005;this.root.position.copy(camera.position);
    this.material.opacity=.02*this.fade+.22*intensity;
    const attribute=this.lines.geometry.getAttribute('position');
    for(let i=0;i<384;i++){
      const x=this.seeds[i*3],y=this.seeds[i*3+1],z=-4000-this.seeds[i*3+2]*14000;
      attribute.setXYZ(i*2,x,y,z);attribute.setXYZ(i*2+1,x*.99,y*.99,z-30-intensity*1600);
    }attribute.needsUpdate=true;
    for(const [id,points] of this.galaxies){
      const intergalactic=state?.plan.domain==='intergalactic';points.visible=!!intergalactic;
      if(!state||!intergalactic)continue;
      const destination=id===state.plan.destination.address.galaxyId;
      const d=destination?state.distanceRemainingM:state.distanceTravelledM;
      const radius=LOCAL_GROUP_CATALOG.find(g=>g.id===id)!.diameterLy*LIGHT_YEAR_M/2;
      const angular=radius/Math.max(radius,d);
      points.position.set(0,0,destination?-20000:20000);points.scale.setScalar(Math.min(12000,20000*angular));
      (points.material as PointsMaterial).opacity=destination?.3+.7*state.progress:1-.7*state.progress;
    }
  }
  dispose():void {this.lines.geometry.dispose();this.material.dispose();for(const p of this.galaxies.values()){p.geometry.dispose();(p.material as PointsMaterial).dispose();}this.root.removeFromParent();}
}
