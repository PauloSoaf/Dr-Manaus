export type AtmosphericMedium =
  | 'earth-atmosphere'
  | 'alien-dense'
  | 'alien-thin'
  | 'alien-toxic'
  | 'cryogenic-winds'
  | 'vacuum'
  | 'airless-surface';

export interface AudioEnvironment {
  medium: AtmosphericMedium;
  atmosphericDensity01: number;
  speedMps: number;
  altitudeM: number;
  rain: boolean;
  river: boolean;
  hazardIntensity?: number;
}

/** A continuous atmosphere fade with an inaudible tail rounded to exact vacuum silence. */
export function earthAtmosphericDensity01(altitudeM: number): number {
  const density = Math.exp(-Math.max(0, altitudeM) / 8500);
  return density < 1e-5 ? 0 : density;
}

export function environmentalAudioMix(environment: AudioEnvironment) {
  const isAtmospheric = environment.medium !== 'vacuum' && environment.medium !== 'airless-surface';
  const density = isAtmospheric && Number.isFinite(environment.atmosphericDensity01)
    ? Math.max(0, Math.min(1, environment.atmosphericDensity01)) : 0;
  const speed = Number.isFinite(environment.speedMps) ? Math.max(0, environment.speedMps) : 0;

  let baseGain = 0.12;
  let baseCutoff = 280;
  let windScale = 1.0;

  switch (environment.medium) {
    case 'alien-dense':
      baseGain = 0.22;
      baseCutoff = 210;
      windScale = 1.35;
      break;
    case 'alien-thin':
      baseGain = 0.05;
      baseCutoff = 490;
      windScale = 0.45;
      break;
    case 'alien-toxic':
      baseGain = 0.18;
      baseCutoff = 620;
      windScale = 1.25;
      break;
    case 'cryogenic-winds':
      baseGain = 0.16;
      baseCutoff = 390;
      windScale = 1.3;
      break;
    case 'earth-atmosphere':
    default:
      baseGain = 0.12;
      baseCutoff = 280;
      windScale = 1.0;
      break;
  }

  const windGain = Math.min((speed / 400) * windScale, 0.42) * density;
  const ambienceGain = (environment.rain ? 0.55 : baseGain) * density + (environment.rain ? 0 : windGain);
  const frequency = environment.rain ? 2400 : environment.altitudeM > 70 ? baseCutoff + Math.min(speed * 4, 1500) : environment.river ? 550 : baseCutoff;
  return { windGain, ambienceGain, frequency };
}

/** Environment noise has its own bus; stylized power/impact effects survive in vacuum. */
export class AudioManager {
  enabled=true; private context?:AudioContext;private master?:GainNode;private ambience?:GainNode;private effects?:GainNode;private filter?:BiquadFilterNode;
  /** Mixer buses, 0..1, set from the pause menu. `enabled` mutes the master independently. */
  private volumes={master:.7,ambience:.6,effects:.8};
  private ambienceLevel=0;
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
  update(environment:AudioEnvironment){
    const mix=environmentalAudioMix(environment);
    this.ambienceLevel=mix.ambienceGain;
    if(!this.context||!this.ambience||!this.filter)return;
    const t=this.context.currentTime;
    this.filter.frequency.setTargetAtTime(mix.frequency,t,.4);
    this.ambience.gain.setTargetAtTime(this.ambienceLevel*this.volumes.ambience,t,.2);
  }
  play(name:string){
    if(!this.context||!this.effects||!this.enabled)return;
    const ctx=this.context,t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
    const low=name.includes('shock')||name.includes('giant')||name.includes('blizzard');
    const isAlarm=name.includes('hazard')||name.includes('alarm');
    const isRadiation=name.includes('radiation');
    osc.type=isAlarm?'sawtooth':isRadiation?'square':low?'sine':'triangle';
    const startFreq = isAlarm ? 880 : isRadiation ? 1200 : low ? (name.includes('blizzard') ? 110 : 85) : name.includes('teleport') ? 440 : 680;
    const endFreq = isAlarm ? 440 : isRadiation ? 300 : low ? 24 : 70;
    const dur = isRadiation ? 0.08 : isAlarm ? 0.4 : 0.75;
    osc.frequency.setValueAtTime(startFreq,t);
    osc.frequency.exponentialRampToValueAtTime(endFreq,t+dur*.8);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(low?.45:isAlarm?.35:.16,t+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,t+dur);
    osc.connect(gain);gain.connect(this.effects);
    osc.start(t);osc.stop(t+dur);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
}
