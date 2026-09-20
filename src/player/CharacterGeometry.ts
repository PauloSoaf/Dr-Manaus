import { BufferGeometry, CapsuleGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Matrix4, TorusGeometry, Uint16BufferAttribute } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** One skin draw and five bone weights: limbs share both the shader and the projection. */
export function createCharacterGeometry(): { skin: BufferGeometry; accents: BufferGeometry } {
  const pieces: BufferGeometry[] = [];
  const add = (geometry: BufferGeometry, bone: number, x:number,y:number,z:number,sx=1,sy=1,sz=1) => {
    geometry.applyMatrix4(new Matrix4().makeScale(sx,sy,sz).setPosition(x,y,z));
    const count=geometry.getAttribute('position').count;
    const indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
    for(let i=0;i<count;i++){indices[i*4]=bone;weights[i*4]=1;}
    geometry.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));
    geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
    // Every primitive shares the same indexed layout before merging.
    const plain=geometry.index?geometry.toNonIndexed():geometry;plain.deleteAttribute('uv');
    if(plain!==geometry)geometry.dispose();pieces.push(plain);
  };
  const oval=(bone:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>add(new IcosahedronGeometry(1,2),bone,x,y,z,sx,sy,sz);
  const capsule=(bone:number,x:number,y:number,z:number,r:number,length:number,sx=1,sz=1)=>add(new CapsuleGeometry(r,length,4,10),bone,x,y,z,sx,1,sz);
  oval(0,0,1.35,0,.31,.32,.17);oval(0,0,1.13,0,.23,.27,.14);
  oval(0,0,.96,0,.225,.18,.145);capsule(0,0,1.63,0,.094,.11,1,.95);
  oval(0,0,1.82,-.005,.177,.228,.167);
  for(const [side,bone] of [[-1,1],[1,2]]){
    const x=side*.36;
    oval(bone,x,1.46,0,.145,.16,.146);capsule(bone,x,1.245,0,.105,.24,1,.96);
    oval(bone,x,1.04,0,.093,.10,.10);capsule(bone,x,.883,-.015,.081,.19,1,.96);
    oval(bone,x,.685,-.024,.081,.105,.066);
  }
  for(const [side,bone] of [[-1,3],[1,4]]){
    const x=side*.137;
    capsule(bone,x,.73,0,.115,.26,.98,1.02);oval(bone,x,.465,-.008,.096,.10,.10);
    capsule(bone,x,.267,.012,.077,.265,1,1.12);oval(bone,x,.068,-.065,.09,.066,.17);
  }
  const skin=mergeGeometries(pieces)!;pieces.forEach(geometry=>geometry.dispose());skin.computeBoundingSphere();
  const ornaments:BufferGeometry[]=[];
  const tint=(geometry:BufferGeometry,color:Color)=>{const count=geometry.getAttribute('position').count,colors=new Float32Array(count*3);for(let i=0;i<count;i++)colors.set([color.r,color.g,color.b],i*3);geometry.setAttribute('color',new Float32BufferAttribute(colors,3));ornaments.push(geometry);};
  for(const side of [-1,1])tint(new IcosahedronGeometry(1,1).scale(.036,.008,.009).translate(side*.063,1.856,-.16),new Color().setRGB(2.3,3.5,3.8));
  const mark=new TorusGeometry(.042,.003,4,20,Math.PI*1.5).rotateZ(.5).translate(0,1.385,-.163);
  tint(mark,new Color('#bda674'));
  const clean=ornaments.map(g=>{g.deleteAttribute('uv');return g.index?g.toNonIndexed():g;});
  const accents=mergeGeometries(clean)!;
  for(const geometry of new Set([...ornaments,...clean]))geometry.dispose();
  return {skin,accents};
}
