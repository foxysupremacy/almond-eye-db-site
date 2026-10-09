import type { Course } from "../skill-engine/types";
import type { RunningStyle } from "../deck/types";
import type { SkillDetailInput, EvaluatorZoneInput } from "../evaluator/types";
import type { ActivationEstimate, RaceEffectDistribution, RaceEffectTrace, RaceImpactProfile } from "./types";
import { cruisingSpeed, runTimeline, simulateTimeline } from "../skill-rating/simulator";
import type { RatingContext, TriggerPath } from "../skill-rating/types";

export interface TraceContext { course: Course | null | undefined; profile: RaceImpactProfile; runningStyle?: RunningStyle | null; racerCount?: number }
function ratingContext(context:TraceContext):RatingContext {
  return {course:context.course??{id:0,length:2000,terrain:1,turn:1,distance:3,inout:1,corners:[],straights:[],slopes:[]},style:context.runningStyle??2,racerCount:context.racerCount??9,profile:context.profile};
}
/** Legacy course-phase display helper. Actual last-spurt state is HP-driven in the shared simulator. */
export function getPhaseAtMeter(meter:number,length:number,spurt:number):number { return meter>=spurt?3:meter>=length*2/3?2:meter>=length/6?1:0; }
export function getCruisingTargetSpeed(phase:number,length:number,stats:RaceImpactProfile['stats'],style?:RunningStyle|null):number {return cruisingSpeed(phase,length,stats,style??2,phase===3);}
function plotPath(skill:SkillDetailInput|null|undefined,context:RatingContext,regions:Array<{start:number;end:number}>):TriggerPath {
  const group=skill?.conditionGroups?.[0], effects=group?.effects??[], time=group?.base_time;
  const passive=effects.length>0&&effects.every(e=>e.type!=null&&e.type>=1&&e.type<=5);
  const instant=effects.length>0&&effects.every(e=>e.type===9||e.type===10||e.type===14);
  const duration:TriggerPath['duration']=passive?{kind:'persistent',seconds:null}:instant?{kind:'instant',seconds:0}:time!=null&&time>0?{kind:'timed',seconds:time/10000*context.course!.length/1000}:{kind:'unknown',seconds:null};
  return {triggerIndex:0,regions,sampling:'immediate',assumptions:[],rankSet:[],condition:group?.condition??'',precondition:group?.precondition??'',dependsOn:[],cooldownSeconds:null,additionalActivations:0,duration,effects,rarity:skill?.rarity,partialReasons:[],warnings:[]};
}
/** Plot adapter only. Rating averages live in skill-rating; an override chooses
 * a replay scenario and never changes the canonical conditional score. */
export function generateRaceTrace(skill:SkillDetailInput|null|undefined,context:TraceContext,override?:number|null,zones?:EvaluatorZoneInput[]|null):RaceEffectTrace {
  const ctx=ratingContext(context), regions=zones?.flatMap(z=>z.regions)??[];
  const meter=override===undefined?(regions.length?Math.min(...regions.map(r=>r.start)):null):override;
  const path=plotPath(skill,ctx,[{start:0,end:ctx.course!.length}]);
  return simulateTimeline(ctx,meter==null?[]:[{path,meter}],true).trace!;
}
/** Compatibility plot grid using the same simulator; probability is deliberately
 * absent from gains. This grid is diagnostic, not the rating quadrature. */
export function computeGainDistribution(skill:SkillDetailInput|null|undefined,zones:EvaluatorZoneInput[]|null|undefined,context:TraceContext,_activation:ActivationEstimate):RaceEffectDistribution {
  const ctx=ratingContext(context), length=ctx.course!.length, regions=zones?.flatMap(z=>z.regions)??[], path=plotPath(skill,ctx,[{start:0,end:length}]);
  const meters=new Set<number>([0,length,...regions.flatMap(r=>[r.start,r.end])]);
  for(let x=0;x<=length;x+=20)meters.add(x);
  const baseline=runTimeline(ctx,[]);
  const samples=[...meters].sort((a,b)=>a-b).map(meter=>{
    const zoneIndex=zones?.findIndex(z=>z.regions.some(r=>meter>=r.start&&meter<r.end))??-1;
    const eligible=zoneIndex>=0;
    const gainMeters=eligible?simulateTimeline(ctx,[{path,meter}],false,baseline).benefit:0;
    return {meter,gainMeters,bashin:gainMeters/2.5,eligible,activationRate:eligible?1:0,usefulRate:gainMeters>0?1:0,zoneIndex:eligible?zoneIndex:undefined};
  });
  const eligible=samples.filter(s=>s.eligible),best=eligible.reduce<typeof samples[number]|null>((a,b)=>a==null||b.gainMeters>a.gainMeters?b:a,null);
  return {version:1,samples,maxGainMeters:best?.gainMeters??0,minGainMeters:eligible.length?Math.min(...eligible.map(s=>s.gainMeters)):0,optimalMeter:best?.meter??null,optimalGainMeters:best?.gainMeters??null,eligibleRangeDescription:regions.map(r=>`${r.start}m – ${r.end}m`).join(', ')||'No activation region'};
}

export function meterToBaselineTime(meter: number, trace: RaceEffectTrace): number {
  if (!trace.points.length || meter <= 0) return 0;
  for (let i = 1; i < trace.points.length; i++) {
    const a = trace.points[i - 1], b = trace.points[i];
    if (meter <= b.baselineMeter) return a.timeSeconds + (b.timeSeconds - a.timeSeconds) * (meter - a.baselineMeter) / Math.max(0.001, b.baselineMeter - a.baselineMeter);
  }
  return trace.totalTimeSeconds;
}

export function timeToBaselineMeter(timeSeconds: number, trace: RaceEffectTrace): number {
  if (!trace.points.length || timeSeconds <= 0) return 0;
  for (let i = 1; i < trace.points.length; i++) {
    const a = trace.points[i - 1], b = trace.points[i];
    if (timeSeconds <= b.timeSeconds) return a.baselineMeter + (b.baselineMeter - a.baselineMeter) * (timeSeconds - a.timeSeconds) / Math.max(0.001, b.timeSeconds - a.timeSeconds);
  }
  return trace.points.at(-1)!.baselineMeter;
}
