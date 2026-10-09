import type { UniverseRuntime } from '../runtime/UniverseRuntime';
import { UniversalTargetCatalog } from './UniversalTargetCatalog';
import type { UniversalNavigationTarget } from './UniversalNavigationTarget';
import { createTravelPlan, sameSystem, travelProfile, type UniversalTravelPlan } from './UniversalTravelPlan';

export type HypercruisePhase='spool'|'acceleration'|'cruise'|'deceleration'|'arrival-hold'|'arrival'|'complete'|'emergency-deceleration'|'coasting';
export interface UniversalTransitState {
  readonly plan:UniversalTravelPlan;
  progress:number;
  distanceTravelledM:number;
  distanceRemainingM:number;
  effectiveSpeedMps:number;
  phase:HypercruisePhase;
  prepared:boolean;
  preparationError?:string;
  etaS:number;
}
export interface PreparedTravelDestination { readonly ready:boolean; commit():void; dispose():void; }
export interface DepartureSafety {
  grounded:boolean; localPhysics:boolean; landing:boolean; collision:boolean; materializing?:boolean;
}
export interface UniversalTravelHooks {
  prepare(plan:UniversalTravelPlan):PreparedTravelDestination|Promise<PreparedTravelDestination>;
  arrived?(plan:UniversalTravelPlan):void;
}
/** Sole transit authority. Local pose, Warp velocity and source address never carry FTL motion. */
export class UniversalTravelController {
  state?:UniversalTransitState;
  lastCompleted?:UniversalTransitState;
  private serial=0;
  private elapsed=0;
  private segmentStart=0;
  private segmentDuration=0;
  private prepared?:PreparedTravelDestination;
  private preparing=false;
  private token=0;
  private holdElapsed=0;
  private braking?:{progress:number;rate:number;elapsed:number;duration:number};
  constructor(readonly universe:UniverseRuntime,readonly catalog:UniversalTargetCatalog,readonly hooks:UniversalTravelHooks){}
  get active():boolean {return !!this.state;}
  start(target:UniversalNavigationTarget,safety:DepartureSafety):'started'|'resumed'|'same-system'|'already-active' {
    const existing=this.state;
    if(existing){
      if(existing.phase==='arrival-hold'&&existing.preparationError){this.releasePrepared();existing.preparationError=undefined;this.holdElapsed=0;return 'resumed';}
      if(existing.phase!=='coasting')return 'already-active';
      if(target.key===existing.plan.requestedTarget.key||target.key===existing.plan.resolvedDestination.key){this.resume();return 'resumed';}
      const candidate=createTravelPlan(this.universe,this.catalog,target,'return');
      if(!sameSystem(candidate.destination.address,existing.plan.origin.address))throw Error('While coasting, resume or select the source system');
      // Return from the actual transit point, without changing the anchored source runtime.
      const p=existing.plan,progress=existing.progress;
      const reversed=Object.freeze({...candidate,id:`travel-${++this.serial}`,origin:p.destination,destination:p.origin,
        logicalDistanceM:p.logicalDistanceM,durationS:p.durationS});
      this.releasePrepared();this.begin(reversed,1-progress);return 'started';
    }
    if(safety.grounded||safety.localPhysics||safety.landing||safety.collision||safety.materializing)
      throw Error('Hypercruise requires safe free flight in SYSTEM space');
    const plan=createTravelPlan(this.universe,this.catalog,target,`travel-${++this.serial}`);
    if(sameSystem(plan.origin.address,plan.destination.address))return 'same-system';
    this.begin(plan);return 'started';
  }
  private begin(plan:UniversalTravelPlan,progress=0):void {
    this.elapsed=0;this.segmentStart=progress;this.segmentDuration=Math.max(2,plan.durationS*(1-progress));
    this.holdElapsed=0;this.braking=undefined;
    this.state={plan,progress,distanceTravelledM:plan.logicalDistanceM*progress,
      distanceRemainingM:plan.logicalDistanceM*(1-progress),effectiveSpeedMps:0,phase:'spool',prepared:false,etaS:this.segmentDuration+1};
    this.universe.transit=this.state;this.universe.scheduler.invalidate();
  }
  cancel():void {
    const s=this.state;if(!s)return;
    if(s.phase==='spool'&&s.progress===0){this.releasePrepared();this.state=undefined;this.universe.transit=undefined;return;}
    if(s.phase==='coasting'||s.phase==='emergency-deceleration')return;
    const rate=s.effectiveSpeedMps/s.plan.logicalDistanceM;
    this.braking={progress:s.progress,rate,elapsed:0,duration:Math.min(.8,rate>0?Math.max(.00001,2.9*(1-s.progress)/rate):.8)};
    s.phase='emergency-deceleration';
  }
  resume():void {
    if(this.state?.phase!=='coasting')return;
    this.elapsed=0;this.segmentStart=this.state.progress;
    this.segmentDuration=Math.max(2,this.state.plan.durationS*(1-this.segmentStart));
    this.holdElapsed=0;this.braking=undefined;this.state.phase='spool';this.state.preparationError=undefined;
    if(!this.prepared)this.preparing=false;
  }
  update(dtS:number):void {
    const s=this.state;if(!s)return;
    const dt=Math.max(0,Number.isFinite(dtS)?dtS:0);this.universe.advanceTransitEpoch(dt);
    if(s.phase==='coasting')return;
    if(this.braking){
      this.braking.elapsed+=dt;const b=this.braking,q=Math.min(1,b.elapsed/b.duration);
      s.progress=Math.min(1-1e-12,b.progress+b.rate*b.duration*(q-q*q+q*q*q/3));
      s.effectiveSpeedMps=b.rate*(1-q)**2*s.plan.logicalDistanceM;
      if(q===1){s.phase='coasting';s.effectiveSpeedMps=0;}this.measure(s);return;
    }
    this.elapsed+=dt;
    const q=Math.min(1,Math.max(0,(this.elapsed-1)/this.segmentDuration)),profile=travelProfile(q);
    const extent=Math.max(0,.985-this.segmentStart);
    s.progress=this.segmentStart+extent*profile.progress;
    s.effectiveSpeedMps=extent*profile.derivative*s.plan.logicalDistanceM/this.segmentDuration;
    s.phase=this.elapsed<1?'spool':profile.phase;
    s.etaS=Math.max(0,1+this.segmentDuration-this.elapsed)+.5;
    if(s.progress>=.65&&!this.preparing&&!this.prepared&&!s.preparationError)this.prefetch(s);
    s.prepared=!!this.prepared?.ready;
    if(q===1){
      s.phase='arrival-hold';s.effectiveSpeedMps=0;
      if(s.prepared){
        this.holdElapsed+=dt;const t=Math.min(1,this.holdElapsed/.5),smooth=t*t*t*(10+t*(-15+6*t));
        const arrivalStart=Math.max(.985,this.segmentStart),remaining=1-arrivalStart;
        s.progress=arrivalStart+remaining*smooth;s.phase='arrival';
        s.effectiveSpeedMps=remaining*30*t*t*(1-t)**2/.5*s.plan.logicalDistanceM;
        if(t===1){
          try{this.prepared!.commit();}
          catch(e){s.preparationError=String(e);s.phase='arrival-hold';s.progress=.985;this.releasePrepared();this.measure(s);return;}
          s.phase='complete';s.effectiveSpeedMps=0;s.progress=1;this.measure(s);
          this.lastCompleted={...s};this.prepared=undefined;this.state=undefined;this.universe.transit=undefined;
          this.hooks.arrived?.(s.plan);return;
        }
      }
    }
    this.measure(s);
  }
  private prefetch(s:UniversalTransitState):void {
    this.preparing=true;const token=++this.token;
    try{
      const result=this.hooks.prepare(s.plan);
      if(result instanceof Promise)result.then(p=>{if(token!==this.token||this.state!==s)p.dispose();else{this.prepared=p;this.preparing=false;}})
        .catch(e=>{if(token===this.token){s.preparationError=String(e);this.preparing=false;}});
      else{this.prepared=result;this.preparing=false;}
    }catch(e){s.preparationError=String(e);this.preparing=false;}
  }
  private measure(s:UniversalTransitState):void {
    s.distanceTravelledM=s.progress*s.plan.logicalDistanceM;s.distanceRemainingM=(1-s.progress)*s.plan.logicalDistanceM;
  }
  private releasePrepared():void {this.token++;this.prepared?.dispose();this.prepared=undefined;this.preparing=false;}
  dispose():void {this.releasePrepared();this.state=undefined;this.universe.transit=undefined;}
}
