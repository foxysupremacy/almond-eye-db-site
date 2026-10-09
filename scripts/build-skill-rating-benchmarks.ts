/** Offline product-convention generator. No runtime reads or mutable benchmark. */
import { readFileSync, writeFileSync } from 'node:fs';
import { effectFamily, effectTarget, simulateTimeline, SIMULATOR_PROVENANCE } from '../lib/skill-rating/simulator';
import { RATING_MODEL_VERSION, RECOVERY_POLICY_VERSION, type EffectFamily, type RatingBenchmarks, type RatingContext, type TriggerPath } from '../lib/skill-rating/types';
import { DEFAULT_RACE_IMPACT_STATS } from '../lib/race-impact/types';
import type { SkillDetailInput } from '../lib/evaluator/types';
import type { RawSkillEffect } from '../lib/data/types';
const root=new URL('../lib/data/generated/',import.meta.url);
const skills:SkillDetailInput[]=['skills.json','skills-inherit.json'].flatMap(file=>JSON.parse(readFileSync(new URL(file,root),'utf8')));
const distances=[1200,1600,2000,2400,3200], staminas=[800,1200,1800];
const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
interface Payload { effect:RawSkillEffect; baseTime:number|null; priority:number }
const candidates=new Map<EffectFamily,Map<string,Payload>>();
for(const skill of skills) {
  if(skill.conditionGroups?.length!==1)continue;
  const group=skill.conditionGroups[0];
  if(group.effects?.length!==1||(group.time_scale??0)!==0)continue;
  const effect=group.effects[0],family=effectFamily(effect);
  if(!family||effectTarget(effect)==='unknown'||effect.value_scale||effect.additional_activation||((effect.value??0)===0)||effect.type===14)continue;
  if(effect.type===10 && effect.value!>=10000)continue;
  const persistent=family.startsWith('passive_'), instant=family==='recovery'||family==='start_delay';
  if(!persistent&&!instant&&!(group.base_time&&group.base_time>0))continue;
  const inherited=skill.id>=900000&&skill.id<1000000;
  const priority=skill.rarity===1&&!inherited?0:inherited?1:2;
  const map=candidates.get(family)??new Map<string,Payload>();
  const key=JSON.stringify([effect.type,effectTarget(effect),effect.value,group.base_time??null]);
  const prior=map.get(key);if(!prior||priority<prior.priority)map.set(key,{effect,baseTime:group.base_time??null,priority});
  candidates.set(family,map);
}
const output:RatingBenchmarks={modelVersion:RATING_MODEL_VERSION,convention:'conditional-family-v2: 100 points per median positive gain from unique unscaled single-effect payloads; white, inherited, then other. Recovery additionally uses recovery-policy-v1 nominal HP credit. Each component has its own 100-point benchmark. Product convention, not verified game ratings.',families:{},provenance:[...SIMULATOR_PROVENANCE,'Fixtures: 1200/1600/2000/2400/3200m × styles1–5 × Stamina800/1200/1800; Good turf; standard profile; no hills; family-appropriate immediate timing.']};
for(const [family,map] of candidates){
  const all=[...map.values()],priority=Math.min(...all.map(p=>p.priority)),payloads=all.filter(p=>p.priority===priority);
  const benefits:number[]=[], nominalHP:number[]=[];
  for(const payload of payloads)for(const length of distances)for(const style of [1,2,3,4,5])for(const stamina of staminas){
    const context:RatingContext={course:{id:length,length,terrain:1,turn:1,distance:length<=1400?1:length<=1800?2:length<=2400?3:4,inout:1,corners:[],straights:[{start:0,end:length,frontType:1}],slopes:[]},style,racerCount:9,raceParameters:{groundCondition:1},profile:{version:1,stats:{...DEFAULT_RACE_IMPACT_STATS,stamina},dynamicOverrides:{}},modelVersion:RATING_MODEL_VERSION};
    const meter=family.startsWith('passive_')||family==='start_delay'?0:family==='acceleration'?length*2/3:family==='zenkai'?length*.8:length*.5;
    const kind=family.startsWith('passive_')?'persistent':family==='recovery'||family==='start_delay'?'instant':'timed';
    const path:TriggerPath={triggerIndex:0,regions:[{start:meter,end:length}],sampling:'immediate',assumptions:[],rankSet:[1],condition:'',precondition:'',dependsOn:[],cooldownSeconds:null,additionalActivations:0,duration:{kind,seconds:kind==='timed'?payload.baseTime!/10000*length/1000:kind==='instant'?0:null},effects:[payload.effect],partialReasons:[],warnings:[]};
    const result=simulateTimeline(context,[{path,meter}]);if(result.benefit>1e-7)benefits.push(result.benefit);
    if(family==='recovery'&&length>2000)for(const activation of result.recovery??[])nominalHP.push(activation.nominalHP);
  }
  if(nominalHP.length)output.recoveryPolicy={version:RECOVERY_POLICY_VERSION,nominalHP:{benefit:median(nominalHP),payloads:payloads.length,fixtures:nominalHP.length}};
  if(benefits.length)output.families[family]={benefit:median(benefits),payloads:payloads.length,fixtures:benefits.length};
}
writeFileSync(new URL('skill-rating-benchmarks.json',root),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.families,null,2));
