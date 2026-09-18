import { LANDMARKS, OSM_ROADS, isLand } from '../world/geodata/geodata';
import type { Vector3 } from 'three/webgpu';
export class CityMap {
  private background=document.createElement('canvas');
  private context:CanvasRenderingContext2D;
  private center={x:1800,z:-5700};
  private metersPerPixel=35;
  constructor(readonly canvas:HTMLCanvasElement,private full:boolean) {
    this.context=canvas.getContext('2d')!;
    canvas.width=full?1000:216;canvas.height=full?650:180;
    this.background.width=canvas.width;this.background.height=canvas.height;
    if(full)this.paintBase();
  }
  private project(x:number,z:number){return{x:(x-this.center.x)/this.metersPerPixel+this.canvas.width/2,y:(z-this.center.z)/this.metersPerPixel+this.canvas.height/2};}
  private paintBase(){
    const ctx=this.background.getContext('2d')!,w=this.canvas.width,h=this.canvas.height;ctx.fillStyle='#132c32';ctx.fillRect(0,0,w,h);
    const step=this.full?5:5;
    for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const wx=(x-w/2)*this.metersPerPixel+this.center.x,wz=(y-h/2)*this.metersPerPixel+this.center.z;if(isLand(wx,wz)){ctx.fillStyle='#283e39';ctx.fillRect(x,y,step,step);}}
    ctx.strokeStyle='#567265';ctx.lineWidth=this.full?.8:.65;ctx.globalAlpha=.42;
    for(const road of OSM_ROADS){ctx.beginPath();for(let i=0;i<road.points.length;i++){const p=this.project(road.points[i][0],road.points[i][1]);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();}
    ctx.globalAlpha=.13;ctx.strokeStyle='#c4d6b8';ctx.lineWidth=.5;
    for(let x=0;x<w;x+=this.full?80:32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=this.full?80:32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.globalAlpha=1;
    if(this.full){ctx.font='italic 20px Georgia';ctx.fillStyle='#6f9799';ctx.save();ctx.translate(350,440);ctx.rotate(.25);ctx.fillText('Rio Negro',0,0);ctx.restore();ctx.font='10px monospace';ctx.fillStyle='#6f8a7b';ctx.fillText('RESERVA FLORESTAL',650,90);}
  }
  draw(player:Vector3,yaw:number,discovered:readonly string[],objective?:Vector3){
    if(!this.full){this.center.x=player.x;this.center.z=player.z;this.metersPerPixel=8.5;this.paintBase();}
    const ctx=this.context;ctx.drawImage(this.background,0,0);
    for(const landmark of LANDMARKS){const p=this.project(landmark.x,landmark.z);ctx.beginPath();ctx.arc(p.x,p.y,this.full?4:2.5,0,Math.PI*2);ctx.fillStyle=discovered.includes(landmark.id)?'#d2e4b2':'#7b8a7d';ctx.fill();if(this.full){ctx.fillStyle='#e2e8dc';ctx.font='11px system-ui';ctx.fillText(landmark.shortName,p.x+9,p.y+4);}}
    if(objective){const p=this.project(objective.x,objective.z);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.strokeStyle='#ddb180';ctx.lineWidth=1.5;ctx.strokeRect(-4,-4,8,8);ctx.restore();}
    const p=this.project(player.x,player.z);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-yaw);ctx.shadowColor='#d8fda7';ctx.shadowBlur=8;ctx.fillStyle='#e7ffca';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-4,5);ctx.lineTo(0,3);ctx.lineTo(4,5);ctx.closePath();ctx.fill();ctx.restore();
    ctx.fillStyle='#d5decf';ctx.font='9px monospace';ctx.fillText('N',this.canvas.width-15,18);
  }
  hit(clientX:number,clientY:number):string|undefined{const rect=this.canvas.getBoundingClientRect(),x=(clientX-rect.left)*this.canvas.width/rect.width,y=(clientY-rect.top)*this.canvas.height/rect.height;let closest:string|undefined,distance=28;for(const l of LANDMARKS){const p=this.project(l.x,l.z),d=Math.hypot(p.x-x,p.y-y);if(d<distance){closest=l.id;distance=d;}}return closest;}
}
