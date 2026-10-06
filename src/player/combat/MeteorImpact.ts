/** Local gameplay policy, independent of celestial events and volume edits. Metres and m/s. */
export type ImpactProfile='soft'|'heavy'|'shock'|'meteor'|'titan';
export interface ImpactTier {readonly profile:ImpactProfile;readonly energy:number;readonly damageGain:number;readonly hitStopMs:number;readonly label:string}
export const IMPACT_TIERS:readonly ImpactTier[]=[
  {profile:'soft',energy:0,damageGain:0,hitStopMs:0,label:'Aterrissagem'},
  {profile:'heavy',energy:26,damageGain:0,hitStopMs:18,label:'Aterrissagem pesada'},
  {profile:'shock',energy:70,damageGain:.55,hitStopMs:45,label:'Impacto sísmico'},
  {profile:'meteor',energy:260,damageGain:1,hitStopMs:95,label:'Impacto meteórico'},
  {profile:'titan',energy:1600,damageGain:1,hitStopMs:150,label:'Impacto titânico'},
];
export const IMPACT={sizeExponent:.75,slamGain:2.2,radiusScale:.0013,radiusExponent:.65,maxRadius:1200,maxDepth:600,
  obliqueTransfer:.6,minDescent:12,minSweptNormal:.05,coreMultiplier:1.05,blastMultiplier:1.5,
  impulseMultiplier:2,reactionMultiplier:2.3,maxShake:5,maxImpulse:4200,maxDebris:90,
  maxFlash:360,maxDustSpeed:180,maxActorSpeed:110} as const;
export interface ImpactFootprint {
  readonly energy:number;readonly impactSpeed:number;readonly normalImpactSpeed:number;readonly tangentialSpeed:number;
  readonly craterRadiusM:number;readonly craterDepthM:number;readonly coreDestructionRadiusM:number;
  readonly blastDamageRadiusM:number;readonly impulseRadiusM:number;readonly reactionRadiusM:number;
  readonly structuralDamage:number;readonly impulse:number;readonly debrisCount:number;readonly shake:number;
}
export interface ImpactResult extends ImpactFootprint {
  readonly profile:ImpactProfile;readonly tier:ImpactTier;readonly hitStopMs:number;readonly slam:boolean;
  /** Compatibility with existing animation/power consumers. These are derived aliases. */
  readonly radius:number;readonly damage:number;readonly deform:number;readonly debris:number;
}
const finite=(v:number,fallback=0)=>Number.isFinite(v)?v:fallback;
export function impactEnergy(speed:number,size=1,slam=false):number {
  const energy=Math.max(0,finite(speed))*Math.pow(Math.max(1,finite(size,1)),IMPACT.sizeExponent)*(slam?IMPACT.slamGain:1);
  return Math.min(Number.MAX_VALUE,energy);
}
export function profileFor(energy:number):ImpactTier {
  let tier=IMPACT_TIERS[0];for(const candidate of IMPACT_TIERS)if(Math.max(0,finite(energy))>=candidate.energy)tier=candidate;return tier;
}
export function resolveImpact(speed:number,size=1,slam=false,excavationGain=1):ImpactResult {
  const energy=impactEnergy(speed,size,slam),tier=profileFor(energy),destructive=tier.damageGain>0;
  const envelope=destructive?IMPACT.maxRadius*(-Math.expm1(-IMPACT.radiusScale*Math.pow(energy,IMPACT.radiusExponent))):0;
  const gain=Math.max(0,Math.min(1,finite(excavationGain))),radius=envelope*gain,
    depth=Math.min(IMPACT.maxDepth,envelope*(.45+.05*envelope/IMPACT.maxRadius)*gain);
  const damage=900*Math.pow(energy,.85)*tier.damageGain,debris=tier.profile==='soft'?0:Math.round(Math.min(IMPACT.maxDebris,6+Math.sqrt(energy)*1.4));
  return {profile:tier.profile,tier,energy,impactSpeed:Math.max(0,finite(speed)),normalImpactSpeed:Math.max(0,finite(speed)),tangentialSpeed:0,
    craterRadiusM:radius,craterDepthM:depth,coreDestructionRadiusM:radius*IMPACT.coreMultiplier,
    blastDamageRadiusM:envelope*IMPACT.blastMultiplier,impulseRadiusM:envelope*IMPACT.impulseMultiplier,reactionRadiusM:envelope*IMPACT.reactionMultiplier,
    structuralDamage:damage,impulse:destructive?Math.min(IMPACT.maxImpulse,30+Math.pow(energy,.6)*6):0,
    debrisCount:debris,shake:tier.profile==='soft'?Math.min(.08,energy*.004):Math.min(IMPACT.maxShake,.06+Math.pow(energy,.45)*.055),
    hitStopMs:tier.hitStopMs,slam,radius,damage,deform:damage>0?Math.pow(Math.max(0,depth-radius*.36)/.32,2):0,debris};
}
/** Pre-response velocity against the actual contact normal; a near tangent transfers blast
 * energy but excavates less. Ordinary step/jump fallback retains the 12 m/s landing gate. */
export function resolveContactImpact(v:{x:number;y:number;z:number},n:{x:number;y:number;z:number},size=1,slam=false,swept=true):ImpactResult {
  const length=Math.hypot(n.x,n.y,n.z);if(!Number.isFinite(length)||length<1e-12)return resolveImpact(0,size,slam);
  const dot=(v.x*n.x+v.y*n.y+v.z*n.z)/length,normal=Math.max(0,-dot),
    tangent=Math.hypot(v.x-n.x/length*dot,v.y-n.y/length*dot,v.z-n.z/length*dot);
  const speed=(swept?normal>=IMPACT.minSweptNormal:normal>=IMPACT.minDescent)?normal+tangent*IMPACT.obliqueTransfer:0;
  const gain=swept?Math.min(1,Math.sqrt(normal/IMPACT.minDescent)):1;
  return {...resolveImpact(speed,size,slam,gain),normalImpactSpeed:normal,tangentialSpeed:tangent};
}
