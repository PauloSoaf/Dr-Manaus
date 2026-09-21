/** One aggregate becomes at most nine separate, modest buildings in the same instanced draw. */
export function skylineBuildings(x:number,z:number,width:number,depth:number,height:number){
  const columns=Math.min(3,Math.max(1,Math.ceil(width/30))),rows=Math.min(3,Math.max(1,Math.ceil(depth/30)));
  const result:{x:number;z:number;width:number;depth:number;height:number;gray:number}[]=[];
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const hash=(Math.imul(Math.round(x)+col*71,73856093)^Math.imul(Math.round(z)+row*43,19349663))>>>0;
    const n=(hash%1009)/1009,m=((hash>>>12)%997)/997;
    result.push({x:x-width/2+(col+.5)*width/columns,z:z-depth/2+(row+.5)*depth/rows,
      width:Math.min(28,width/columns*(.52+n*.22)),depth:Math.min(26,depth/rows*(.5+m*.24)),
      height:Math.max(3,Math.min(38,height*(.45+n*.8))),gray:.13+m*.2});
  }
  return result;
}
