/** Procedural soundscape: one filtered noise loop crossfades urban, river, wind and rain textures. */
export class AudioManager {
  enabled=true; private context?:AudioContext;private master?:GainNode;private ambience?:GainNode;private effects?:GainNode;private filter?:BiquadFilterNode;
  /** Mixer buses, 0..1, set from the pause menu. `enabled` mutes the master independently. */
  private volumes={master:.7,ambience:.6,effects:.8};
  private ambienceLevel=.18;
  async unlock() {
    if(this.context){if(this.context.state==='suspended')await this.context.resume();return;}
    const ctx=this.context=new AudioContext();this.master=ctx.createGain();this.master.gain.value=this.masterGain();this.master.connect(ctx.destination);
    const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=buffer.getChannelData(0);let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.018)/1.02;data[i]=brown*3;}
    const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
    this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=340;
    this.ambience=ctx.createGain();this.ambience.gain.value=this.ambienceLevel*this.volumes.ambience;
    this.effects=ctx.createGain();this.effects.gain.value=this.volumes.effects;this.effects.connect(this.master);
    source.connect(this.filter);this.filter.connect(this.ambience);this.ambience.connect(this.master);source.start();
  }
  private masterGain(){return this.enabled?this.volumes.master*.4:0;}
  setEnabled(value:boolean){this.enabled=value;this.applyMix();}
  setVolumes(master:number,ambience:number,effects:number){
    const clamp=(v:number)=>Number.isFinite(v)?Math.min(1,Math.max(0,v)):0;
    this.volumes={master:clamp(master),ambience:clamp(ambience),effects:clamp(effects)};this.applyMix();
  }
  get mix(){return {...this.volumes};}
  private applyMix(){
    if(!this.context)return;const t=this.context.currentTime;
    this.master?.gain.setTargetAtTime(this.masterGain(),t,.15);
    this.ambience?.gain.setTargetAtTime(this.ambienceLevel*this.volumes.ambience,t,.15);
    this.effects?.gain.setTargetAtTime(this.volumes.effects,t,.1);
  }
  update(speed:number,altitude:number,rain:boolean,river:boolean){if(!this.context||!this.ambience||!this.filter)return;const t=this.context.currentTime;this.filter.frequency.setTargetAtTime(rain?2400:altitude>70?800+Math.min(speed*4,1500):river?550:280,t,.4);this.ambienceLevel=rain?.55:.12+Math.min(speed/400,.35);this.ambience.gain.setTargetAtTime(this.ambienceLevel*this.volumes.ambience,t,.5);}
  play(name:string){if(!this.context||!this.effects||!this.enabled)return;const ctx=this.context,t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();const low=name.includes('shock')||name.includes('giant');osc.type=low?'sine':'triangle';osc.frequency.setValueAtTime(low?85:name.includes('teleport')?440:680,t);osc.frequency.exponentialRampToValueAtTime(low?24:70,t+.5);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(low?.45:.16,t+.025);gain.gain.exponentialRampToValueAtTime(.0001,t+.7);osc.connect(gain);gain.connect(this.effects);osc.start(t);osc.stop(t+.75);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
}
