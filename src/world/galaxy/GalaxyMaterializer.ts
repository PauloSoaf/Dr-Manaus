import { Group, Matrix4, Vector3, type Object3D } from 'three/webgpu';
import { LOCAL_GROUP_CATALOG } from '../celestial/GalaxyDefinition';
import { StarSectorProvider } from '../providers/StarSectorProvider';
import { GalaxyProvider } from '../providers/GalaxyProvider';
import { BlackHoleProvider } from '../providers/BlackHoleProvider';
import type { UniverseRuntime } from '../runtime/UniverseRuntime';
import type { SystemResources } from '../runtime/ProceduralSystemMaterializer';
import { knownGalaxyRuntime, type GalaxyRuntime } from './GalaxyRuntime';

export interface GalaxySession {
  readonly galaxy:GalaxyRuntime;
  readonly root:Group;
  readonly starSectorProvider:StarSectorProvider;
  readonly externalGalaxies:readonly GalaxyProvider[];
  readonly centralBlackHole?:BlackHoleProvider;
  readonly ready:boolean;
  dispose():void;
}
export type GalaxyStage='galaxy'|'star-sectors'|'black-hole'|'install'|'activate';
/** One active presentation session. No transport, address mutation, or nested origin snapshots. */
export class GalaxyMaterializer {
  current?:GalaxySession;
  generation=0;
  private readonly viewBasis=new Matrix4();
  private readonly axes=[new Vector3(),new Vector3(),new Vector3()];
  readonly timings:Record<string,number>={};
  constructor(readonly universe:UniverseRuntime,private readonly parent:Object3D,
    private readonly checkpoint:(stage:GalaxyStage)=>void=()=>{}) {}

  prepare(id:string):SystemResources {
    const old=this.current;
    if(old?.galaxy.id===id)return {install:()=>{},activate:()=>{this.current=old;this.parent.add(old.root);},dispose:()=>{}};
    const start=performance.now();this.checkpoint('galaxy');
    const galaxy=knownGalaxyRuntime(id);if(!galaxy)throw Error('Galáxia desconhecida');
    this.timings.runtime=performance.now()-start;
    const root=new Group();root.name='galaxy-session/'+id;
    let sectors:StarSectorProvider|undefined,bh:BlackHoleProvider|undefined;
    const externals:GalaxyProvider[]=[];
    let disposed=false,complete=false,activated=false,installStart=0;
    const dispose=()=>{
      if(disposed)return;disposed=true;
      if(sectors && this.universe.providers.get(sectors.id)===sectors){
        this.universe.scheduler.retireProvider(sectors.id,undefined,id);this.universe.providers.unregister(sectors.id);
      }
      sectors?.dispose();bh?.dispose();for(const g of externals)g.dispose();root.removeFromParent();root.clear();
    };
    try {
      const t=performance.now();this.checkpoint('star-sectors');sectors=new StarSectorProvider(root,{galaxyId:id});
      this.timings.starSectors=performance.now()-t;
      const ext=performance.now();for(const def of LOCAL_GROUP_CATALOG)if(def.id!==id)externals.push(new GalaxyProvider(root,{galaxy:def}));
      this.timings.externalGalaxies=performance.now()-ext;
      const b=performance.now();this.checkpoint('black-hole');
      if(galaxy.centralBlackHole)bh=new BlackHoleProvider(root,{galaxyId:id,blackHole:galaxy.centralBlackHole});
      this.timings.blackHole=performance.now()-b;
    }catch(error){dispose();throw error;}
    const session:GalaxySession={galaxy,root,starSectorProvider:sectors!,externalGalaxies:externals,centralBlackHole:bh,
      get ready(){return !disposed;},dispose};
    this.timings.prepare=performance.now()-start;
    return {
      install:()=>{if(disposed||complete||this.current!==old)throw Error('Preparação de galáxia obsoleta');installStart=performance.now();this.checkpoint('install');this.universe.providers.register(sectors!);},
      activate:()=>{
        if(!complete)this.checkpoint('activate');if(!session.ready)throw Error('Sessão de galáxia descartada');
        if(this.universe.address.galaxyId!==id)throw Error('Galáxia e endereço incoerentes');
        old?.root.removeFromParent();this.parent.add(root);this.current=session;activated=true;
      },
      complete:()=>{
        if(complete)return;if(!activated)throw Error('Galáxia não ativada');complete=true;this.generation++;
        const t=performance.now();old?.dispose();this.timings.unload=performance.now()-t;
        this.timings.install=performance.now()-installStart;
      },
      dispose:()=>{
        if(complete)return;dispose();if(activated){this.current=old;if(old?.ready)this.parent.add(old.root);}
      },
    };
  }
  /** Used after a prepared Solar restoration commits; the same saved Solar origin belongs to U1. */
  prepareSolarReturn():SystemResources{return this.prepare('milky_way');}
  update(cameraPosition:readonly [number,number,number],altitudeM:number):void {
    const session=this.current;if(!session)return;
    const address=this.universe.address,offset=this.universe.location.sectorOffsetM??[0,0,0];
    session.starSectorProvider.recentre(cameraPosition);
    const toRender=(v:import('../spatial/units').Vec3)=>this.universe.frames.convertDirection(this.universe.activeSystem.systemFrameId,this.universe.renderSpace.currentOrigin.frame,v);
    for(let i=0;i<3;i++){const basis:import('../spatial/units').Vec3=[0,0,0];basis[i]=1;this.axes[i].set(...toRender(basis));}
    const rotation=this.viewBasis.makeBasis(this.axes[0],this.axes[1],this.axes[2]);
    session.starSectorProvider.group.quaternion.setFromRotationMatrix(rotation);
    session.centralBlackHole?.group.quaternion.setFromRotationMatrix(rotation);
    for(const g of session.externalGalaxies)g.update(address,[...cameraPosition],altitudeM,offset,toRender);
    session.centralBlackHole?.update(address,[...cameraPosition],altitudeM,offset,toRender);
  }
}
