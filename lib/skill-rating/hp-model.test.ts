import { describe, expect, test } from 'bun:test';
import { defaultRaceImpactProfile } from '../race-impact/profile';
import { skillsById, loadRacetracks, skillRatingBenchmarks } from '../data/registry';
import { flattenCourse } from '../api/course-format';
import { createApplicationRatingSession } from './application';
import { createSkillRatingSession } from './session';
import { runTimeline, simulateTimeline, cruisingSpeed } from './simulator';
import { adjustedStat, baseTargetSpeed, effectiveStats, hpPerSecond, maxHP, maxSpurtSpeed, minimumSpeed, staminaLimitBreak, limitBreakDistanceFactor } from './hp-physics';
import { planLastSpurt } from './last-spurt';
import { competitionCost, createCompetitionState, updateCompetition } from './competition';
import { recoveryPolicy } from './recovery-policy';
import { RATING_MODEL_VERSION, RECOVERY_POLICY_VERSION, type RatingContext, type TriggerPath, type RecoveryActivation } from './types';
import { evaluateSkillForTrack } from '../evaluator/evaluator';

const profile=defaultRaceImpactProfile();
const course={id:3200,length:3200,terrain:1,turn:1,distance:4,inout:1,corners:[],straights:[{start:0,end:3200,frontType:1}],slopes:[]};
const context:RatingContext={course,style:3,racerCount:9,profile,raceParameters:{groundCondition:1}};
const zeros={speed:0,stamina:0,power:0,guts:0,wisdom:0};
const stats=effectiveStats(profile.stats,zeros);
const path=(effects:TriggerPath['effects'],start=1200):TriggerPath=>({triggerIndex:0,regions:[{start,end:3200}],sampling:'immediate',assumptions:[],rankSet:[1],condition:'',precondition:'',dependsOn:[],cooldownSeconds:null,additionalActivations:0,duration:{kind:'instant',seconds:0},effects,partialReasons:[],warnings:[]});
const skill=(condition:string,effects:TriggerPath['effects']=[{type:9,value:150}],id=777)=>({id,rarity:1,conditionGroups:[{condition,base_time:0,effects}]});
const activation=(phase:number,nominalHP=60):RecoveryActivation=>({triggerIndex:0,time:0,meter:0,phase,nominalHP,receivedHP:0,wastedHP:nominalHP,weight:phase===0?.5:1});

describe('HP mechanics v2',()=>{
 test('spurt formula includes phase 2 speed twice and applies stat adjustment only once',()=>{
   for(const style of [1,2,3,4,5])for(const length of [1200,2000,3000,3200]){
     const expected=(baseTargetSpeed(2,length,stats,style)+.01*(20-(length-2000)/1000))*1.05+Math.sqrt(500*stats.speed)*.002+Math.pow(450*stats.guts,.597)*.0001;
     expect(cruisingSpeed(2,length,profile.stats,style,true)).toBeCloseTo(expected,10);
     expect(maxSpurtSpeed(length,stats,style)).toBeCloseTo(expected,10);
   }
   expect(effectiveStats(profile.stats,{...zeros,speed:60}).speed).toBe(adjustedStat(profile.stats.speed)+60);
 });
 test('HP budget increases with duration/speed, ground distinguishes dirt soft and turf soft',()=>{
   const burn=hpPerSecond(24,3000,stats.guts,2);
   expect(burn*40).toBeGreaterThan(burn*20);
   expect(burn).toBeGreaterThan(hpPerSecond(21,3000,stats.guts,2));
   expect(hpPerSecond(24,3000,stats.guts,2,2,3)/burn).toBeCloseTo(1.01);
   expect(hpPerSecond(24,3000,stats.guts,2,1,3)/burn).toBeCloseTo(1.02);
   expect(minimumSpeed(3000,stats.guts)).toBeGreaterThan(.85*19);
   expect(maxHP(3000,1500,3)).toBe(4200);
 });
 test('planner budgets slower/shorter candidates and clips remaining planning distance at 60m',()=>{
   const consumption=(v:number)=>hpPerSecond(v,3000,stats.guts,2);
   const input={meter:2000,length:3000,hp:1850,cruise:21,maximum:24,limitBreak:0,consumption};
   const low=planLastSpurt(input),high=planLastSpurt({...input,hp:4000});
   expect(low.estimatedHP).toBeLessThanOrEqual(input.hp+1e-7);
   expect(low.start).toBeGreaterThanOrEqual(2000);
   expect(low.start).toBeLessThanOrEqual(2940);
   expect(high.start).toBe(2000);expect(high.maximum).toBe(true);
   expect(high.estimatedHP).toBeCloseTo(consumption(24)*940/24);
   expect(high.estimatedTime).toBeLessThan(low.estimatedTime);
   const active=planLastSpurt({...input,meter:2400,hp:2000,alreadySpurting:true});
   expect(active.start).toBe(2400);
 });
 test('Limit Break uses raw threshold, exact distance boundaries and fixed expected random factor',()=>{
   expect(staminaLimitBreak(3200,1200)).toBe(0);
   expect(staminaLimitBreak(3200,1201)).toBeCloseTo(.0085*1.8*.9865);
   expect([2100,2101,2200,2201,2400,2401,2600,2601].map(limitBreakDistanceFactor)).toEqual([0,.5,.5,1,1,1.5,1.5,1.8]);
   const run=runTimeline(context,[],'self',true);
   expect(run.spurt.limitBreakActivated).toBe(true);
   expect(run.events!.some(e=>e.kind==='limit-break')).toBe(true);
 });
 test('competition observes region, duration, cooldown and heal resets Stamina Keep',()=>{
   const state=createCompetitionState();
   expect(updateCompetition(state,0,1000,3000,1000,100,false).started).toBe(false);
   expect(updateCompetition(state,0,1250,3000,1000,100,false).started).toBe(true);
   expect(updateCompetition(state,1,1300,3000,1000,100,false).active).toBe(true);
   expect(updateCompetition(state,2,1400,3000,1000,100,false).started).toBe(false);
   expect(updateCompetition(state,4,1500,3000,1000,100,false).started).toBe(true);
   expect(updateCompetition(state,4.1,1875,3000,1000,100,false).active).toBe(false);
   const tired=createCompetitionState();
   expect(updateCompetition(tired,0,1250,3000,90,100,false).started).toBe(false);
   expect(tired.keeping).toBe(true);
   expect(updateCompetition(tired,2,1300,3000,110,100,true).started).toBe(true);
   expect(tired.keeping).toBe(false);
   expect(competitionCost(3000,3)).toBe(34);
 });
 test('heal changes spurt planning, caps physical HP and does not change Stamina stat',()=>{
   const tired={...context,hpEnvironment:{competition:'none' as const},profile:{...profile,stats:{...profile.stats,stamina:800}}};
   const run=simulateTimeline(tired,[{path:path([{type:9,value:1000}],1800),meter:1800}],true);
   expect(run.timeGainSeconds).toBeGreaterThan(0);
   expect(run.hp!.skill.startMeter! < run.hp!.baseline.startMeter! || run.hp!.skill.plannedSpeed! >= run.hp!.baseline.plannedSpeed!).toBe(true);
   expect(run.hpEvents!.skill.filter(e=>e.kind==='replan').length).toBeGreaterThan(0);
   const late=simulateTimeline(tired,[{path:path([{type:9,value:3000}],2300),meter:2300}],true);
   expect(late.hpEvents!.skill.some(e=>e.kind==='replan'&&e.meter>=2300)).toBe(true);
   expect(late.hp!.skill.limitBreakActivated).toBe(false);
   const cost=simulateTimeline(context,[{path:path([{type:9,value:-100}],2300),meter:2300}],true);
   expect(cost.hpEvents!.skill.filter(e=>e.kind==='replan')).toHaveLength(1);
   const full=runTimeline(context,[{path:path([{type:9,value:1000}],0),meter:0}],'self',true);
   expect(full.recovery[0].receivedHP).toBe(0);expect(full.recovery[0].wastedHP).toBe(full.recovery[0].nominalHP);
 });
 test('summary does not allocate frame/event traces; full returns actual HP diagnostics',()=>{
   const summary=simulateTimeline(context,[{path:path([{type:9,value:150}]),meter:1200}]);
   const full=simulateTimeline(context,[{path:path([{type:9,value:150}]),meter:1200}],true);
   expect(summary.trace).toBeUndefined();expect(summary.hpEvents).toBeUndefined();
   expect(full.trace!.points[0].baselineHP).toBeDefined();
   expect(full.hp).toEqual(summary.hp);expect(full.recovery).toEqual(summary.recovery);
   const lateSkill=runTimeline(context,[{path:path([{type:27,value:3500}]),meter:1200}]);
   expect(lateSkill.spurt.startMeter).not.toBeNull();
 });
 test('Zenkai depletion drops immediately to Guts minimum speed and later recovery preserves Limit Break',()=>{
   const strong={...context,profile:{...profile,stats:{...profile.stats,stamina:3000}}};
   const cost=path([{type:9,value:-20000}],2800);
   const heal={...path([{type:9,value:500}],2850),triggerIndex:1};
   const run=runTimeline(strong,[{path:cost,meter:2800},{path:heal,meter:2850}],'self',true);
   const costEvent=run.events!.find(e=>e.kind==='recovery'&&e.meter>=2800)!;
   const next=run.points!.find(p=>p.t>costEvent.time)!;
   expect(run.spurt.limitBreakActivated).toBe(true);
   expect(next.v).toBeCloseTo(minimumSpeed(3200,stats.guts),8);
   expect(run.spurt.depletedAtMeter!).toBeGreaterThanOrEqual(2800);
   expect(run.events!.some(e=>e.kind==='replan'&&e.meter>=2850)).toBe(true);
 });
});

describe('Recovery product policy v1',()=>{
 test('component benchmarks each equal 100; addition and early 50% are explicit',()=>{
   const b={...skillRatingBenchmarks,recoveryPolicy:{version:RECOVERY_POLICY_VERSION,nominalHP:{benefit:60,payloads:1,fixtures:1}}};
   const mid=recoveryPolicy(3000,[activation(1)],100,-20,b);
   expect(mid.policyPoints).toBe(100);expect(mid.simulationPoints).toBe(80);
   const early=recoveryPolicy(3000,[activation(0)],100,-20,b);
   expect(early.policyPoints).toBe(50);expect(early.simulationPoints).toBe(30);
   const short=recoveryPolicy(2000,[activation(1)],100,-20,b);
   expect(short.policyPoints).toBe(0);expect(short.simulationPoints).toBe(-20);
 });
 test('gate boundary preserves physical heal, nominal cap credit and eligibility',()=>{
   for(const length of [2000,2001]){
     const session=createApplicationRatingSession({...context,course:{...course,length}});
     const r=session.evaluate({skill:skill('always==1')});
     expect(r.eligibility.state).toBe('eligible');expect(r.activationOutcome).toBe('activated');
     expect(r.recovery!.receivedHP).toBe(0);
     expect(r.recovery!.nominalHP).toBeGreaterThan(0);
     expect(r.score).toBe(length===2000?0:r.recovery!.policyPoints!);
     if(length===2001)expect(r.score).toBeGreaterThan(0);
   }
 });
 test('short-course rating gate does not remove real HP/time benefits from the simulator',()=>{
   const tired={...context,course:{...course,length:2000},profile:{...profile,stats:{...profile.stats,stamina:100}}};
   const r=createApplicationRatingSession(tired).evaluate({skill:skill('distance_rate>=40',[{type:9,value:1000}])});
   expect(r.score).toBe(0);expect(r.recovery!.receivedHP).toBeGreaterThan(0);
   expect(r.simulatedBenefit).toBeGreaterThan(0);expect(r.timeGainSeconds).toBeGreaterThan(0);
 });
 test('missing reserve benchmark retains known simulated score and suppresses complete tier',()=>{
   const tired={...context,profile:{...profile,stats:{...profile.stats,stamina:400}}};
   const r=createSkillRatingSession(tired,{benchmarks:{...skillRatingBenchmarks,recoveryPolicy:undefined}}).evaluate({skill:skill('distance_rate>=40')});
   expect(r.status).toBe('partial');expect(r.tier).toBeNull();
   expect(r.recovery!.policyPoints).toBeNull();
   expect(r.score).toBeCloseTo(r.recovery!.simulationPoints!);
 });
 test('self-cost/opponent healing remain signed and Shapley sums physical benefit in mixed skills',()=>{
   const session=createApplicationRatingSession(context);
   const r=session.evaluate({skill:skill('distance_rate>=75',[{type:9,value:300},{type:9,value:-1000},{type:27,value:3500}],778)});
   expect(r.contributions.reduce((s,c)=>s+c.attributedBenefit,0)).toBeCloseTo(r.simulatedBenefit,8);
   expect(r.recovery!.signedCostAndOpponentPoints!).toBeLessThan(0);
   expect(r.score).toBeCloseTo(r.contributions.reduce((s,c)=>s+(c.points??0),0));
   const opponent=session.evaluate({skill:skill('distance_rate>=40',[{type:9,value:1000,target:4}],779)});
   expect(opponent.recovery!.nominalHP).toBe(0);expect(opponent.recovery!.policyPoints).toBe(0);
   expect(opponent.contributions[0].points!).toBeLessThanOrEqual(0);
 });
 test('random nominal credit is weighted by sample distribution and uses actual activation phase',()=>{
   const session=createApplicationRatingSession(context);
   const r=session.evaluate({skill:skill('phase_random==1')},{detail:'full'});
   expect(r.recovery!.activations.length).toBeGreaterThan(1);
   expect(r.recovery!.activations.reduce((sum,a)=>sum+(a.sampleWeight??1),0)).toBeCloseTo(1);
   expect(r.recovery!.nominalHP).toBeCloseTo(maxHP(3200,stats.stamina,3)*.015);
   const delayed=session.evaluate({skill:skill('accumulatetime>=40')});
   expect(delayed.recovery!.activations[0].phase).toBe(1);
   expect(delayed.recovery!.simulationWeight).toBe(1);
 });
 test('repeat credit counts only real fires and missing intrinsic activation has no reserve',()=>{
   const repeating=skill('distance_rate>=40');
   const repeated={...repeating,conditionGroups:[{...repeating.conditionGroups[0],cd:10000,effects:[{type:9,value:150,additional_activation:2}]}]};
   const session=createApplicationRatingSession(context);
   const r=session.evaluate({skill:repeated});
   expect(r.recovery!.activations).toHaveLength(3);
   const missing=session.evaluate({skill:skill('hp_per>100')});
   expect(missing.activationOutcome).toBe('not-activated');expect(missing.recovery!.policyPoints).toBe(0);
   expect(missing.score).toBe(0);
 });
 test('model/environment fingerprints and repeated batch calls cache without additional simulations',()=>{
   const requests=[{skill:skill('distance_rate>=40')}];
   const session=createApplicationRatingSession(context);
   session.evaluateMany(requests);const metrics=session.metrics();session.evaluateMany(requests);
   expect(session.metrics().simulations).toBe(metrics.simulations);
   expect(session.metrics().cacheHits).toBe(metrics.cacheHits+1);
   const a=session.evaluate(requests[0]),b=createApplicationRatingSession({...context,hpEnvironment:{competition:'none'}}).evaluate(requests[0]);
   expect(a.contextFingerprint).not.toBe(b.contextFingerprint);
   expect(a.modelVersion).toBe(RATING_MODEL_VERSION);
 });
 test('real Kyoto white recovery is rated consistently in summary/full/facade',async()=>{
   const kyoto=flattenCourse((await loadRacetracks()).find(t=>t.id===10008)!.courses.find(c=>c.id===10810)!);
   const session=createApplicationRatingSession({...context,course:kyoto});
   const heal=skillsById.get(204293)!;
   const summary=session.evaluate({skill:heal}),full=session.evaluate({skill:heal},{detail:'full'});
   expect(summary.score).toBeGreaterThan(0);expect(summary.activationOutcome).toBe('activated');
   expect(summary.selectedPaths[0].regions).toEqual([{start:1200,end:1230}]);
   expect(full.score).toBe(summary.score);expect(full.recovery).toEqual(summary.recovery);expect(full.hp).toEqual(summary.hp);
   const facade=evaluateSkillForTrack(heal,kyoto,3,9,false,[],context.raceParameters,{session});
   expect(facade.score).toBe(summary.score);expect(facade.canonicalRating!.recovery).toEqual(summary.recovery);
   expect(facade.raceImpact!.expectedTimeGainSeconds).toBe(summary.timeGainSeconds);
 });
});
