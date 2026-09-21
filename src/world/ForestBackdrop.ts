import {Group,IcosahedronGeometry,InstancedMesh,MeshStandardMaterial,Object3D,Vector3} from 'three/webgpu';
import {isLand,isUrban} from './geodata/geodata';

/** Distant forest crowns; detailed, destructible trees take over inside the near ring. */
export class ForestBackdrop {
  private readonly mesh=new InstancedMesh(new IcosahedronGeometry(1,0),new MeshStandardMaterial({color:0x294b29,roughness:1}),6400);
  private readonly dummy=new Object3D();private x=Infinity;private z=Infinity;
  constructor(root:Group){this.mesh.name='distant-rainforest';this.mesh.count=0;this.mesh.frustumCulled=false;root.add(this.mesh);}
  update(position:Vector3):void{
    const x=Math.round(position.x/200)*200,z=Math.round(position.z/200)*200;
    if(x===this.x&&z===this.z)return;this.x=x;this.z=z;let count=0;
    for(let dz=-7800;dz<=7800;dz+=200)for(let dx=-7800;dx<=7800;dx+=200){
      const px=x+dx,pz=z+dz;if(dx*dx+dz*dz<1400*1400||!isLand(px,pz)||isUrban(px,pz))continue;
      const noise=((Math.imul(px,73856093)^Math.imul(pz,19349663))>>>0)%1000/1000;
      this.dummy.position.set(px,12+noise*8,pz);this.dummy.scale.set(155,12+noise*7,155);this.dummy.updateMatrix();this.mesh.setMatrixAt(count++,this.dummy.matrix);
    }
    this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;
  }
  dispose(){this.mesh.geometry.dispose();(this.mesh.material as MeshStandardMaterial).dispose();this.mesh.dispose();this.mesh.removeFromParent();}
}
