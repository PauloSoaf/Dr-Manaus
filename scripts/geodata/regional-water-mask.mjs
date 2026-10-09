/** Conservative cell coverage: centre scanlines fill interiors, exact edge/cell
 * intersections include narrow channels and both sides of shorelines/islands. */
export function bakeRegionalWaterMask(polygons,bounds,cell=128,margin=256) {
  const originX=Math.floor((bounds.minX-margin)/cell)*cell,originZ=Math.floor((bounds.minZ-margin)/cell)*cell;
  const width=Math.ceil((bounds.maxX+margin-originX)/cell),height=Math.ceil((bounds.maxZ+margin-originZ)/cell);
  const stride=Math.ceil(width/8),bits=new Uint8Array(stride*height),footprintBits=new Uint8Array(stride*height);
  const mark=(x,z,edge=false)=>{if(x>=0&&z>=0&&x<width&&z<height){
    footprintBits[z*stride+(x>>3)]|=1<<(x&7);if(!edge)bits[z*stride+(x>>3)]|=1<<(x&7);}};
  const intersects=(ax,az,bx,bz,x,z)=>{
    let lo=0,hi=1;
    for(const [a,d,min] of [[ax,bx-ax,originX+x*cell],[az,bz-az,originZ+z*cell]]) {
      if(d===0){if(a<min||a>min+cell)return false;continue;}
      const t0=(min-a)/d,t1=(min+cell-a)/d;
      lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return false;
    }
    return true;
  };
  for(const polygon of polygons) {
    const rows=new Map();
    for(const ring of polygon.rings)for(let i=0;i<ring.length;i+=2) {
      const j=(i+2)%ring.length,ax=ring[i],az=ring[i+1],bx=ring[j],bz=ring[j+1];
      if(az!==bz) {
        const first=Math.max(0,Math.ceil((Math.min(az,bz)-originZ)/cell-.5));
        const last=Math.min(height-1,Math.ceil((Math.max(az,bz)-originZ)/cell-.5)-1);
        for(let z=first;z<=last;z++) {
          const crossing=ax+(bx-ax)*(originZ+(z+.5)*cell-az)/(bz-az);
          const row=rows.get(z);if(row)row.push(crossing);else rows.set(z,[crossing]);
        }
      }
      const x0=Math.max(0,Math.floor((Math.min(ax,bx)-originX-1e-7)/cell));
      const x1=Math.min(width-1,Math.floor((Math.max(ax,bx)-originX)/cell));
      const z0=Math.max(0,Math.floor((Math.min(az,bz)-originZ-1e-7)/cell));
      const z1=Math.min(height-1,Math.floor((Math.max(az,bz)-originZ)/cell));
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)if(intersects(ax,az,bx,bz,x,z))mark(x,z,true);
    }
    for(const [z,row] of rows) {
      row.sort((a,b)=>a-b);
      for(let i=0;i+1<row.length;i+=2) {
        const first=Math.max(0,Math.ceil((row[i]-originX)/cell-.5));
        const last=Math.min(width-1,Math.ceil((row[i+1]-originX)/cell-.5)-1);
        for(let x=first;x<=last;x++)mark(x,z);
      }
    }
  }
  return {originX,originZ,cell,width,height,bits:Buffer.from(bits).toString('base64'),footprintBits:Buffer.from(footprintBits).toString('base64')};
}
