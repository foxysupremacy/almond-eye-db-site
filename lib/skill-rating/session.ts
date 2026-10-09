import { analyzeSkill, stableFingerprint } from './conditions';
import { effectFamily, runTimeline, simulateTimeline, SIMULATOR_PROVENANCE, type TimelineEvent } from './simulator';
import { samplePath } from './sampling';
import { shapley, tierForScore } from './policy';
import { attributionGroup, recoveryPolicy } from './recovery-policy';
import { RATING_MODEL_VERSION, RECOVERY_POLICY_VERSION, type RecoveryActivation, type HPDiagnostics, type EffectFamily, type RatingContext, type RatingEnvironment, type RatingRequest, type RatingScenario, type SkillRating, type SkillRatingSession } from './types';

export function createSkillRatingSession(context: RatingContext, environment: RatingEnvironment): SkillRatingSession {
  // Snapshot inputs: mutating the caller's profile cannot poison an existing cache.
  const ctx = structuredClone(context);
  ctx.modelVersion ??= RATING_MODEL_VERSION;
  ctx.hpEnvironment ??= { competition: 'conditional' };
  const memo = new Map<string, SkillRating>();
  const styleSessions = new Map<number,SkillRatingSession>();
  const analyses = new Map<string, ReturnType<typeof analyzeSkill>>();
  const baseline = ctx.course && ctx.style ? runTimeline(ctx, []) : undefined;
  const counts = { simulations: baseline ? 1 : 0, cacheHits: 0, evaluations: 0 };
  const keyFor = (request: RatingRequest) => stableFingerprint(request);
  const analyze: SkillRatingSession['analyze'] = request => {
    const key = keyFor(request); const existing = analyses.get(key); if(existing) return existing;
    const value = analyzeSkill(request, ctx, environment); analyses.set(key,value); return value;
  };
  const evaluate: SkillRatingSession['evaluate'] = (request, options={}) => {
    const key=keyFor(request), detail=options.detail??'summary';
    const cached=memo.get(key+detail);
    if(cached){counts.cacheHits++;return cached;}
    counts.evaluations++;
    if (ctx.style == null && ctx.course) {
      const values = [1,2,3,4,5].map(style=>{let session=styleSessions.get(style);if(!session){session=createSkillRatingSession({...ctx,style},environment);styleSessions.set(style,session);}return {style,result:session.evaluate(request,options)};});
      const eligible=values.filter(v=>v.result.eligibility.state==='eligible');
      const best=(eligible.length?eligible:values).reduce((a,b)=>b.result.score>a.result.score?b:a);
      const result:SkillRating={...best.result,selectedStyle:null,contextFingerprint:stableFingerprint(ctx),bestStyle:best.style,styleRatings:values.map(v=>({style:v.style,score:v.result.score,eligibility:v.result.eligibility.state,status:v.result.status,tier:v.result.tier,stars:v.result.stars})),breakdown:[...best.result.breakdown,`Best conditional rating uses style ${best.style}; all five styles evaluated.`]};
      memo.set(key+detail,result);return result;
    }
    const analysis=analyze(request);
    const empty: SkillRating={...analysis,selectedStyle:ctx.style,policyVersion:RECOVERY_POLICY_VERSION,activationOutcome:'unmodeled',score:0,tier:null,stars:null,status:'unavailable',contributions:[],selectedScenarioId:null,selectedPaths:[],simulatedBenefit:0,timeGainSeconds:0,benchmarkVersion:environment.benchmarks.modelVersion,breakdown:[],provenance:[...SIMULATOR_PROVENANCE,...environment.benchmarks.provenance]};
    if(analysis.eligibility.state!=='eligible'){
      const result=analysis.eligibility.state==='ineligible'?{...empty,...tierForScore(0),activationOutcome:'not-activated' as const,status:'complete' as const,breakdown:analysis.eligibility.reasons}:empty;
      memo.set(key+detail,result);return result;
    }
    if((ctx.modelVersion??RATING_MODEL_VERSION)!==environment.benchmarks.modelVersion){
      const result={...empty,breakdown:['No frozen benchmarks for the requested model version.']};memo.set(key+detail,result);return result;
    }
    if(detail==='full'&&memo.has(key+'summary')) {
      const summary=memo.get(key+'summary')!;
      const selected=analysis.scenarios.find(s=>s.id===summary.selectedScenarioId);
      const result=selected?{...summary,...addDetail(selected)}:summary;
      memo.set(key+detail,result);return result;
    }
    // Enhanced precedence is based on condition implication from the planner,
    // never on a comparison of the two payloads' scores.
    const feasibleIds = new Set(analysis.scenarios.map(s=>s.id));
    const candidates=analysis.scenarios.filter(s=>!s.suppressedBy?.some(id=>feasibleIds.has(id)&&analysis.scenarios.find(candidate=>candidate.id===id)?.paths.every(path=>!path.assumptions.some(a=>a.kind==='unknown'))));
    let selected:SkillRating|undefined;
    for(const scenario of candidates){
      const samples=jointSamples(scenario);
      const effects=scenario.paths.flatMap(p=>p.effects);
      const families=[...new Set(effects.map(effectFamily).filter((f):f is EffectFamily=>f!=null))];
      const unknownEffects=effects.filter(e=>effectFamily(e)==null);
      const groups=[...new Set(effects.map(attributionGroup).filter((g):g is string=>g!=null))];
      const coalition=new Map<number,{benefit:number,time:number,activated:boolean,recovery:RecoveryActivation[],hp?:HPDiagnostics}>();
      coalition.set(0,{benefit:0,time:0,activated:false,recovery:[]});
      const value=(mask:number)=>{
        if(coalition.has(mask))return coalition.get(mask)!.benefit;
        let benefit=0,time=0,activated=false,hp:HPDiagnostics|undefined;
        const recovery:RecoveryActivation[]=[];
        for(let i=0;i<samples.length;i++){
          const sample=samples[i];
          const events=sample.events.map(e=>({...e,path:{...e.path,effects:e.path.effects.filter(effect=>{const group=attributionGroup(effect);return group!=null&&!!(mask&(1<<groups.indexOf(group)));})}}));
          const run=simulateTimeline(ctx,events,false,baseline);counts.simulations++;
          benefit+=sample.weight*run.benefit;time+=sample.weight*run.timeGainSeconds;activated ||= run.activated;
          for(const activation of run.recovery??[])recovery.push({...activation,sampleWeight:sample.weight});
          if(i===Math.floor(samples.length/2))hp=run.hp;
        }
        coalition.set(mask,{benefit,time,activated,recovery,hp});return benefit;
      };
      const attributed=shapley(groups,value), total=value((1<<groups.length)-1);
      const fullCoalition=coalition.get((1<<groups.length)-1)!;
      const recoveryBenchmark=environment.benchmarks.families.recovery?.benefit;
      const groupPoints=(group:string)=>{
        const index=groups.indexOf(group);
        return index<0?0:recoveryBenchmark!=null&&recoveryBenchmark>0?100*attributed[index]/recoveryBenchmark:null;
      };
      const recovery=families.includes('recovery')?recoveryPolicy(ctx.course!.length,fullCoalition.recovery,groupPoints('recovery:self-heal'),groupPoints('recovery:signed-other'),environment.benchmarks):undefined;
      const contributions=families.map(family=>{
        const benchmark=environment.benchmarks.families[family]?.benefit??null;
        const attributedBenefit=groups.reduce((sum,group,i)=>sum+(group.split(':')[0]===family?attributed[i]:0),0);
        const simulationPoints=family==='recovery'?recovery!.simulationPoints:benchmark!=null&&benchmark>0?100*attributedBenefit/benchmark:null;
        const policyPoints=family==='recovery'?recovery!.policyPoints:0;
        return {family,attributedBenefit,benchmark,simulationPoints,policyPoints,points:simulationPoints==null&&policyPoints==null?null:(simulationPoints??0)+(policyPoints??0),effects:effects.filter(e=>effectFamily(e)===family)};
      });
      const partialReasons=[...analysis.partialReasons,...scenario.paths.flatMap(p=>p.partialReasons)];
      if(unknownEffects.length)partialReasons.push(`No handler for effect types ${[...new Set(unknownEffects.map(e=>e.type))].join(', ')}.`);
      if(effects.some(e=>((e.target??1)!==0&&(e.target??1)!==1)&&![4,7,9,10,18,19,20,21,22,23].includes(e.target??1)))partialReasons.push('Unmodeled allied/all-target scope.');
      if(contributions.some(c=>c.simulationPoints==null))partialReasons.push('No frozen positive benchmark for at least one family.');
      if(recovery?.policyPoints==null&&recovery)partialReasons.push('No frozen nominal HP benchmark for the Recovery policy.');
      const score=contributions.reduce((s,c)=>s+(c.points??0),0);
      const status=partialReasons.length?'partial':families.length?'provisional':'unavailable';
      const activationOutcome = !families.length ? 'unmodeled' : fullCoalition.activated ? 'activated' : 'not-activated';
      const tier=status==='partial'||status==='unavailable'?{tier:null,stars:null}:tierForScore(score);
      const result:SkillRating={...empty,...tier,score,status,activationOutcome,contributions,selectedScenarioId:scenario.id,selectedPaths:scenario.paths,assumptions:scenario.paths.flatMap(p=>p.assumptions),partialReasons:[...new Set(partialReasons)],simulatedBenefit:total,timeGainSeconds:fullCoalition.time,recovery,hp:fullCoalition.hp,breakdown:[
        'Rating assumes highlighted dynamic conditions are satisfied; intrinsic conditions are checked on the timeline. Wisdom/rank/dynamic probabilities do not multiply the score.',
        `Scenario ${scenario.id} (${scenario.relation}); ${samples.length} weighted activation samples; one common timeline.`,
        'Physical family benefit uses Shapley on the common timeline; signed Recovery costs/opponent effects are attributed separately. Negative costs are retained.',
        ...(recovery ? [
          `Recovery policy ${RECOVERY_POLICY_VERSION}: self-heal distance gate ${recovery.distanceGate}; early phase 0 weight 50%, phase 1+ weight 100%.`,
          `Nominal HP ${recovery.nominalHP.toFixed(3)}, received HP ${recovery.receivedHP.toFixed(3)}, wasted HP ${recovery.wastedHP.toFixed(3)}; weighted nominal HP ${recovery.weightedNominalHP.toFixed(3)}.`,
          `Simulation points ${recovery.simulationPoints?.toFixed(3)??'unavailable'} + reserve points ${recovery.policyPoints?.toFixed(3)??'unavailable'}. Nominal reserve is a product convention, not extra simulated time or distance.`,
        ] : ['Family points = 100 × Shapley attributed benefit / frozen family benchmark.']),
        ...(activationOutcome === 'not-activated' ? ['No selected trigger activated in the modeled timeline samples.'] : activationOutcome === 'activated' && Math.abs(total) < 1e-9 ? [(recovery?.policyPoints??0)>0?'Activated with no net simulated time benefit; Recovery reserve points come from the product policy.':'The modeled effects activated but produced no net race benefit.'] : []),
        ...partialReasons,
      ]};
      if(!selected||result.score>selected.score)selected=result;
    }
    let result=selected??empty;
    memo.set(key+'summary',result);
    if(detail==='full'&&selected){const s=analysis.scenarios.find(s=>s.id===result.selectedScenarioId)!;result={...result,...addDetail(s)};memo.set(key+'full',result);}
    return result;
  };
  function addDetail(scenario:RatingScenario): Pick<SkillRating,'trace'|'distribution'|'hpEvents'> {
    const samples=jointSamples(scenario), runs=samples.map(s=>{counts.simulations++;return {sample:s,run:simulateTimeline(ctx,s.events,false,baseline)};});
    const representative=runs[Math.floor(runs.length/2)];
    counts.simulations++;
    const detailed=representative?simulateTimeline(ctx,representative.sample.events,true):undefined;
    const trace=detailed?.trace;
    const values=runs.map(({sample,run})=>({meter:sample.events[0]?.meter??0,gainMeters:run.benefit,bashin:run.benefit/2.5,eligible:true,activationRate:run.activated?1:0,usefulRate:run.benefit>0?1:0}));
    const best=values.reduce<typeof values[number]|null>((a,b)=>a==null||b.gainMeters>a.gainMeters?b:a,null);
    return {trace,hpEvents:detailed?.hpEvents,distribution:{version:1,samples:values,maxGainMeters:values.length?Math.max(...values.map(v=>v.gainMeters)):0,minGainMeters:values.length?Math.min(...values.map(v=>v.gainMeters)):0,optimalMeter:best?.meter??null,optimalGainMeters:best?.gainMeters??null,eligibleRangeDescription:scenario.paths.flatMap(p=>p.regions).map(r=>`${Math.round(r.start)}–${Math.round(r.end)}m`).join(', ')}};
  }
  return {analyze,evaluate,evaluateMany:(requests,options)=>requests.map(r=>evaluate(r,options)),metrics:()=>[...styleSessions.values()].reduce((a,s)=>{const b=s.metrics();return {simulations:a.simulations+b.simulations,cacheHits:a.cacheHits+b.cacheHits,evaluations:a.evaluations+b.evaluations};},{...counts})};
}
function jointSamples(scenario:RatingScenario):Array<{events:TimelineEvent[];weight:number}> {
  let samples:Array<{events:TimelineEvent[];weight:number}>=[{events:[],weight:1}];
  for(const path of scenario.paths){
    const positions=samplePath(path);
    if(!positions.length)continue;
    samples=samples.flatMap(s=>positions.map(p=>({events:[...s.events,{path,meter:p.meter}],weight:s.weight*p.weight})));
  }
  return samples;
}
