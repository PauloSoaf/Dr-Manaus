import fs from 'node:fs';
import {Object3D,Quaternion,Vector3} from 'three';
const path=process.argv[2];if(!path)throw Error('Pass the Quaternius Standard GLB path');
const b=fs.readFileSync(path),len=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+len)),bin=b.subarray(28+len);
function data(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView];if(a.componentType!==5126)throw Error('Expected float animation accessor');return new Float32Array(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),a.count*({SCALAR:1,VEC3:3,VEC4:4}[a.type]));}
const nodes=j.nodes.map(n=>{const o=new Object3D();o.position.fromArray(n.translation||[0,0,0]);o.quaternion.fromArray(n.rotation||[0,0,0,1]);o.scale.fromArray(n.scale||[1,1,1]);return o;});j.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
const root=nodes[54],turn=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),invTurn=turn.clone().invert();root.updateMatrixWorld(true);
const restHip=nodes[51].getWorldQuaternion(new Quaternion()).invert();
// Source bone directions -> this game's downward limbs. Preserve proportions, discard root motion.
const map=[[19,18,0,[-.03,-.31,-.007]],[38,37,0,[.03,-.31,-.007]],[46,45,0,[0,-.49,-.016]],[50,49,0,[0,-.49,-.016]],[18,17,1,[-.01,-.295,-.009]],[37,36,2,[.01,-.295,-.009]],[45,44,3,[0,-1,0]],[49,48,4,[0,-1,0]]];
const names={walk:'Walk_Loop',run:'Sprint_Loop',jump:'Jump_Loop',punch:'Punch_Jab',vault:'Jump_Start'};
const output={source:'Quaternius Universal Animation Library Standard (CC0)',fps:30,clips:{}};
for(const [name,source] of Object.entries(names)){
 const a=j.animations.find(a=>a.name===source),tracks=a.channels.map(c=>({node:c.target.node,path:c.target.path,t:data(a.samplers[c.sampler].input),v:data(a.samplers[c.sampler].output)}));
 const duration=Math.max(...tracks.map(t=>t.t.at(-1))),frames=[];const count=Math.ceil(duration*30);
 for(let f=0;f<=count;f++){
  const time=duration*f/count;
  for(const tr of tracks){let k=0;while(k<tr.t.length-2&&tr.t[k+1]<time)k++;const k2=Math.min(k+1,tr.t.length-1),mix=tr.t[k2]===tr.t[k]?0:Math.max(0,Math.min(1,(time-tr.t[k])/(tr.t[k2]-tr.t[k])));const o=nodes[tr.node];
   if(tr.path==='rotation')o.quaternion.fromArray(tr.v,k*4).slerp(new Quaternion().fromArray(tr.v,k2*4),mix);
   else if(tr.path==='translation'||tr.path==='scale')o[tr.path==='scale'?'scale':'position'].fromArray(tr.v,k*3).lerp(new Vector3().fromArray(tr.v,k2*3),mix);
  }
  root.updateMatrixWorld(true);
  const worlds=[turn.clone().multiply(nodes[51].getWorldQuaternion(new Quaternion())).multiply(restHip).multiply(invTurn)],local=[worlds[0]];
  for(const [bone,child,parent,rest] of map){const d=nodes[child].getWorldPosition(new Vector3()).sub(nodes[bone].getWorldPosition(new Vector3())).normalize().applyQuaternion(turn);const q=new Quaternion().setFromUnitVectors(new Vector3(...rest).normalize(),d);worlds.push(q);local.push(worlds[parent].clone().invert().multiply(q));}
  local.push(new Quaternion(),new Quaternion());frames.push(local.flatMap(q=>q.normalize().toArray().map(v=>+v.toFixed(5))));
 }
 output.clips[name]={duration,frames};
}
fs.mkdirSync('src/player/animations',{recursive:true});fs.writeFileSync('src/player/animations/quaternius.json',JSON.stringify(output));console.log('Exported',Object.keys(output.clips),fs.statSync('src/player/animations/quaternius.json').size,'bytes');
