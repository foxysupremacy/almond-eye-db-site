import { describe, expect, test } from 'bun:test';
import { defaultRaceImpactProfile } from '../race-impact/profile';
import type { RatingBenchmarks, RatingContext, RatingEnvironment, RatingRequest } from './types';
import { createSkillRatingSession } from './session';
import { tierForScore, shapley } from './policy';
import { runTimeline, simulateTimeline } from './simulator';
import type { TriggerPath } from './types';
import { RATING_MODEL_VERSION, RECOVERY_POLICY_VERSION } from './types';

const course = { id:1,length:2400,terrain:1,turn:1,distance:3,inout:1,trackId:10001,corners:[{start:400,end:800},{start:1500,end:1800}],straights:[{start:0,end:400,frontType:1},{start:800,end:1500,frontType:1},{start:1800,end:2400,frontType:1}],slopes:[],spurtStart:{meters:1600},phases:[{id:0,start:0,end:400},{id:1,start:400,end:1600},{id:2,start:1600,end:2000},{id:3,start:2000,end:2400}] };
const context:RatingContext={course,style:2,racerCount:9,raceParameters:{groundCondition:1},profile:defaultRaceImpactProfile()};
const families=['target_speed','current_speed_21','current_speed_22','acceleration','zenkai','recovery','passive_speed','passive_stamina','passive_power','passive_guts','passive_wisdom','start_delay'] as const;
const benchmarks:RatingBenchmarks={modelVersion:RATING_MODEL_VERSION,convention:'test product convention',families:Object.fromEntries(families.map(f=>[f,{benefit:1,payloads:1,fixtures:1}])) as RatingBenchmarks['families'],provenance:['fixture'],recoveryPolicy:{version:RECOVERY_POLICY_VERSION,nominalHP:{benefit:60,payloads:1,fixtures:1}}};
const environment:RatingEnvironment={benchmarks};
const request=(condition:string,effects:any[],base_time=30000):RatingRequest=>({skill:{id:101,rarity:1,conditionGroups:[{condition,base_time,effects}]}});
const path=(effect:any,seconds=4,type:'timed'|'instant'|'persistent'='timed'):TriggerPath=>({triggerIndex:0,regions:[{start:1200,end:2200}],sampling:'immediate',assumptions:[],rankSet:[1],condition:'',precondition:'',dependsOn:[],cooldownSeconds:null,additionalActivations:0,duration:{kind:type,seconds:type==='persistent'?null:seconds},effects:[{...effect,target:effect.target??1}],partialReasons:[],warnings:[]});

describe('canonical skill rating session',()=>{
 test('benchmark family payload has unit 100 points and uses one tier policy',()=>{
   const session=createSkillRatingSession(context,environment);
   const result=session.evaluate(request('phase==2&course_distance==2400',[{type:27,value:3500,target:1}],30000));
   expect(result.eligibility.state).toBe('eligible');
   expect(result.contributions).toHaveLength(1);
   expect(result.contributions[0].points).toBeCloseTo(result.contributions[0].attributedBenefit*100/result.contributions[0].benchmark!);
   expect(tierForScore(120)).toEqual({tier:'S',stars:5});
   expect(tierForScore(90)).toEqual({tier:'A',stars:4});
   expect(tierForScore(65)).toEqual({tier:'B',stars:3});
   expect(tierForScore(40)).toEqual({tier:'C',stars:2});
   expect(tierForScore(20)).toEqual({tier:'D',stars:1});
   expect(tierForScore(19.99)).toEqual({tier:'F',stars:1});
 });
 test('summary and full share scalar results and cache without tracing summary',()=>{
   const session=createSkillRatingSession(context,environment), req=request('phase==2',[{type:22,value:4500,target:1}]);
   const summary=session.evaluate(req,{detail:'summary'}), afterSummary=session.metrics();
   expect(summary.trace).toBeUndefined();
   const full=session.evaluate(req,{detail:'full'});
   expect(full.score).toBe(summary.score); expect(full.eligibility).toEqual(summary.eligibility);
   expect(full.trace).toBeDefined(); expect(session.metrics().simulations).toBeGreaterThan(afterSummary.simulations);
   expect(session.evaluate(req,{detail:'summary'}).score).toBe(summary.score);
 });
 test('dynamic rank and blocked clauses are assumptions and do not reduce score',()=>{
   const req=request('phase==2&order_rate<=50&blocked_front==1',[{type:27,value:3500,target:1}]);
   const conditional=createSkillRatingSession(context,environment).evaluate(req);
   const lowerWisdom=createSkillRatingSession({...context,profile:{...context.profile,stats:{...context.profile.stats,wisdom:100}}},environment).evaluate(req);
   expect(conditional.eligibility.state).toBe('eligible');
   expect(conditional.assumptions.some(a=>a.kind==='rank')).toBe(true);
   expect(conditional.assumptions.some(a=>a.kind==='dynamic')).toBe(true);
   expect(conditional.score).toBe(lowerWisdom.score);
   expect(conditional.breakdown[0]).toContain('probabilities do not multiply');
 });
 test('track and explicit style mismatches are ineligible at zero',()=>{
   const mismatch=createSkillRatingSession(context,environment).evaluate(request('running_style==1&course_distance==2400',[{type:27,value:3500}]));
   expect(mismatch.eligibility.state).toBe('ineligible'); expect(mismatch.score).toBe(0); expect(mismatch.tier).toBe('F');
 });
 test('missing family benchmark reports partial modeled score and suppresses complete tier',()=>{
   const incomplete={...environment,benchmarks:{...benchmarks,families:{}}};
   const result=createSkillRatingSession(context,incomplete).evaluate(request('phase==2',[{type:27,value:3500}]));
   expect(result.status).toBe('partial'); expect(result.tier).toBeNull(); expect(result.stars).toBeNull();
 });
 test('ineffective acceleration stays zero and full-HP recovery receives nominal reserve value',()=>{
   const session=createSkillRatingSession(context,environment);
   const recovery=session.evaluate(request('always==1',[{type:9,value:1000}],0));
   const acceleration=session.evaluate(request('distance_rate>=25&distance_rate<=30',[{type:31,value:2000}]));
   for(const result of [acceleration]){
     expect(result.score).toBe(0);
     expect(result.activationOutcome).toBe('activated');
     expect(result.status).toBe('provisional');
     expect(result.breakdown).toContain('The modeled effects activated but produced no net race benefit.');
   }
   expect(recovery.simulatedBenefit).toBe(0);
   expect(recovery.score).toBeGreaterThan(0);
   expect(recovery.recovery!.receivedHP).toBe(0);
   expect(recovery.recovery!.wastedHP).toBe(recovery.recovery!.nominalHP);
   expect(recovery.status).toBe('provisional');
 });
 test('older model benchmarks are unavailable rather than a genuine zero benefit',()=>{
   const old={...environment,benchmarks:{...benchmarks,modelVersion:'conditional-v1'}};
   const result=createSkillRatingSession(context,old).evaluate(request('phase==2',[{type:27,value:3500}]));
   expect(result.status).toBe('unavailable');
   expect(result.activationOutcome).toBe('unmodeled');
   expect(result.tier).toBeNull();
   expect(result.breakdown).toContain('No frozen benchmarks for the requested model version.');
 });
 test('OR paths select a real path and enhanced conditions suppress fallback irrespective of points',()=>{
   const skill={id:201,rarity:1,conditionGroups:[
     {condition:'phase==2&order<=2',base_time:30000,effects:[{type:27,value:1500,target:1}]},
     {condition:'phase==2&order<=5',base_time:30000,effects:[{type:27,value:4500,target:1}]},
   ]};
   const result=createSkillRatingSession(context,environment).evaluate({skill});
   expect(result.selectedPaths).toHaveLength(1); expect(result.selectedPaths[0].triggerIndex).toBe(0);
 });
 test('Shapley contributions sum to joint timeline value and retain negative costs',()=>{
   const standalone=shapley(['a','b'],mask=>mask===0?0:mask===1?2:mask===2?-5:-1);
   expect(Math.abs(standalone[0]+standalone[1]+1)).toBeLessThan(1e-9);
   expect(standalone[1]).toBeLessThan(0);
 });
 test('recovery changes with missing HP and is capped at full HP',()=>{
   const heal=path({type:9,value:1000},0,'instant');
   const base={...context,course:{...course,length:3200,phases:undefined,spurtStart:{meters:2133}}};
   const atGate={...heal,regions:[{start:0,end:3200}]};
   const noHeal=runTimeline(base,[]), atFull=simulateTimeline(base,[{path:atGate,meter:0}],false);
   expect(Math.abs(atFull.benefit)).toBeLessThan(1e-5);
   const tired={...base,profile:{...base.profile,stats:{...base.profile.stats,stamina:800}}};
   const tiredRun=simulateTimeline(tired,[{path:heal,meter:1200}],false);
   expect(tiredRun.benefit).toBeGreaterThan(0);
   expect(noHeal.finish).toBeGreaterThan(0);
 });
 test('21 and 22 differ only at expiry and the course finish clips value',()=>{
   const p21=path({type:21,value:4500},2), p22=path({type:22,value:4500},2);
   const run=(p:TriggerPath)=>simulateTimeline(context,[{path:p,meter:1500}]).benefit;
   expect(run(p21)).toBeGreaterThan(0); expect(run(p22)).toBeGreaterThan(0); expect(Math.abs(run(p21)-run(p22))).toBeGreaterThan(0.001);
   const finish=simulateTimeline(context,[{path:{...p21,regions:[{start:2390,end:2400}]},meter:2390}]).benefit;
   expect(finish).toBeLessThan(run(p21));
 });
 test('zenkai uses raw profile speed boundary and remains provisional',()=>{
   const zenkai=path({type:48,value:4000},8);
   const high={...context,profile:{...context.profile,stats:{...context.profile.stats,speed:2001,stamina:3000}}};
   const low={...high,profile:{...high.profile,stats:{...high.profile.stats,speed:2000}}};
   expect(simulateTimeline(high,[{path:zenkai,meter:2000}]).benefit).toBeGreaterThan(simulateTimeline(low,[{path:zenkai,meter:2000}]).benefit);
 });
 test('style-independent benchmark lookup remains fixed while course profile changes impact',()=>{
   const fixed=environment.benchmarks.families.target_speed!.benefit;
   const a=createSkillRatingSession(context,environment).evaluate(request('always==1',[{type:27,value:3500,target:1}]));
   const b=createSkillRatingSession({...context,course:{...course,length:1200,spurtStart:{meters:800}},profile:{...context.profile,stats:{...context.profile.stats,stamina:800}}},environment).evaluate(request('always==1',[{type:27,value:3500,target:1}]));
   expect(a.contributions[0].benchmark).toBe(fixed); expect(b.contributions[0].benchmark).toBe(fixed); expect(a.simulatedBenefit).not.toBe(b.simulatedBenefit);
 });
});
