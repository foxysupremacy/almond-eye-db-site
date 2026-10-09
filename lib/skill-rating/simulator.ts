import { describeEffect } from '../evaluator/effects';
import type { RawSkillEffect } from '../data/types';
import type { RaceEffectTrace } from '../race-impact/types';
import type { EffectFamily, RatingContext, SimulationResult, TriggerPath } from './types';
import { RATING_MODEL_VERSION } from './types';
import { intrinsicMatch, supportsIntrinsicClause } from './intrinsic-conditions';
import { adjustedStat, raceBaseSpeed, effectiveStats, baseTargetSpeed, maxSpurtSpeed, maxHP as computeMaxHP, hpPerSecond, minimumSpeed, staminaLimitBreak } from './hp-physics';
import { planLastSpurt, type SpurtPlan } from './last-spurt';
import { createCompetitionState, updateCompetition, competitionSpeed, competitionCost } from './competition';
import type { HPEvent, RecoveryActivation, SpurtSummary } from './types';
export { adjustedStat, raceBaseSpeed } from './hp-physics';

export const SIMULATOR_PROVENANCE = [
  'docs/references/Uma Musume Race Mechanics.md snapshot sha256 b50009114debf9b820b2cdd6d252c2d2e5b506d1dda4938ec163fa747a97107a',
  'uma-tools reference solver revision 40c263ef46f5fbfcdda023127c4d16e0c665f1ea (HP and lifecycle cross-check)',
  `${RATING_MODEL_VERSION}: deterministic one-Uma model, A aptitudes, neutral motivation; conditional best feasible spurt, no Wisdom acceptance roll`,
  'Spurt planning starts at phase 2 following the reference solver and the detailed mechanics paragraph; the document introduction also mentions mid-race. Budget excludes final 60m; integration includes the goal.',
  'Conditional competition: one nearby same-style representative; sections 11–15, checks 2s, duration 2s, cooldown 1s; NearFactor 0.5, HP cost once per activation (provisional frequency).',
  'Stamina Keep: immediate detection at each check, reserve factor 1.0375; Limit Break random factor 0.9865 (weighted midpoint convention). These inferred mechanics are provisional.',
  'Planner omits future Zenkai ramp and optional competition costs. Downhill mode, Secure Lead, Dueling, Rushed and full positioning are not modeled.',
  'Slope units: stored slope / 10000 = percent; uphill target penalty = percent × 200 / adjusted Power (reference RaceSolver.ts)',
];
export interface TimelineEvent { path: TriggerPath; meter: number }
interface Point { t: number; x: number; v: number; target: number; phase: number; hp: number; spurt: boolean }
export interface Run { finish: number; points?: Point[]; firstFire: number | null; firstFireMeter: number | null; lastEnd: number | null; lastEndMeter: number | null; finalSpeed: number; recovery: RecoveryActivation[]; spurt: SpurtSummary; events?: HPEvent[] }
const DT = 1 / 15;
const STAT_NAMES = ['speed','stamina','power','guts','wisdom'] as const;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function effectFamily(effect: RawSkillEffect): EffectFamily | null { return describeEffect(effect).family; }
export function effectTarget(effect: RawSkillEffect): 'self' | 'opponent' | 'unknown' {
  const target = describeEffect(effect).target;
  return target === 'self' ? 'self' : target === 'opponents' ? 'opponent' : 'unknown';
}
export function coursePhase(context: RatingContext, meter: number): number {
  const course = context.course!;
  const phase = course.phases?.find(p => meter >= p.start && meter < p.end);
  return phase?.id ?? (meter < course.length / 6 ? 0 : meter < course.length * 2 / 3 ? 1 : meter < course.length * 5 / 6 ? 2 : 3);
}
export function cruisingSpeed(phase: number, length: number, stats: RatingContext['profile']['stats'], style: number, spurt = false): number {
  const adjusted = effectiveStats(stats, {speed:0,stamina:0,power:0,guts:0,wisdom:0});
  return spurt ? maxSpurtSpeed(length,adjusted,style) : baseTargetSpeed(phase,length,adjusted,style);
}

/** All mechanics and effects share one timeline. Summary collects scalar diagnostics
 * and actual recovery activations, but allocates neither frame points nor event trace. */
export function runTimeline(context: RatingContext, events: TimelineEvent[], target: 'self' | 'opponent' = 'self', trace = false): Run {
  const course = context.course!, style = context.style ?? 2, length = course.length;
  const raw = context.profile.stats;
  const modifiers = {speed:0,stamina:0,power:0,guts:0,wisdom:0};
  let stats = effectiveStats(raw,modifiers);
  const pending = events.map(e => ({ ...e, fires: 0, fireTime: -Infinity, fired: false }));
  const active: Array<{ effect: RawSkillEffect; end: number }> = [];
  const fired = new Map<number, number>();
  const points: Point[] | undefined = trace ? [] : undefined;
  const log: HPEvent[] | undefined = trace ? [] : undefined;
  const recovery: RecoveryActivation[] = [];
  const competition = createCompetitionState();
  const competitionEnabled = (context.hpEnvironment?.competition ?? 'conditional') === 'conditional';
  let maxHP = computeMaxHP(length,stats.stamina,style), hp = maxHP;
  let time = 0, meter = 0, velocity = 3, delay = .1, spurt = false, zenkai = false, zenkaiVelocity = 0;
  let plan: SpurtPlan | undefined, spurtStart: number | null = null, depletedAt: number | null = null, spurtDistance = 0;
  let limitBreakActive = false;
  let firstFire: number | null = null, firstFireMeter: number | null = null, lastEnd: number | null = null, lastEndMeter: number | null = null;
  const record = (kind: HPEvent['kind'],detail: string) => { if(log) log.push({kind,time,meter,hp,detail}); };
  const consumption = (v: number,phase: number) => hpPerSecond(v,length,stats.guts,phase,course.terrain,context.raceParameters?.groundCondition ?? 1);
  const lateStart = course.phases?.find(p=>p.id===2)?.start ?? length*2/3;
  const requiredHP = () => {
    const remaining = Math.max(0,length-60-Math.max(meter,lateStart));
    const speed = maxSpurtSpeed(length,stats,style) + staminaLimitBreak(length,raw.stamina+modifiers.stamina);
    return Math.max(0,lateStart-meter)/Math.max(1,baseTargetSpeed(1,length,stats,style))*consumption(baseTargetSpeed(1,length,stats,style),1)
      + remaining/Math.max(1,speed)*consumption(speed,2);
  };
  for (let i = 0; i < 15000 && meter < length; i++) {
    const phase = coursePhase(context,meter);
    let recovered = false;
    for (let j = active.length - 1; j >= 0; j--) {
      if (time + 1e-9 < active[j].end) continue;
      const e = active[j].effect;
      if (e.type === 22) velocity += (e.value ?? 0) / 10000;
      if ((e.type ?? 0) >= 1 && (e.type ?? 0) <= 5) {
        modifiers[STAT_NAMES[e.type! - 1]] -= (e.value ?? 0)/10000;
        stats = effectiveStats(raw,modifiers);
        maxHP = computeMaxHP(length,stats.stamina,style); hp = Math.min(hp,maxHP);
      }
      lastEnd = time; lastEndMeter = meter; active.splice(j,1);
    }
    for (const event of pending) {
      if (event.fired || meter + 1e-8 < event.meter) continue;
      if (event.path.dependsOn.length && !event.path.dependsOn.some(id=>fired.has(id))) continue;
      const intrinsicTarget = spurt && plan ? plan.speed : baseTargetSpeed(phase,length,stats,style);
      if (event.path.intrinsicClauses?.some(c=>!intrinsicMatch(c,{hp,maxHP,time,spurt,zenkai,velocity,target:intrinsicTarget}))) continue;
      if (!event.path.regions.some(r=>meter>=r.start-1e-8&&meter<r.end)) {
        if (meter >= Math.max(...event.path.regions.map(r=>r.end))) event.fired=true;
        continue;
      }
      if (event.fires>0 && (event.path.cooldownSeconds==null || time < event.fireTime+event.path.cooldownSeconds)) continue;
      event.fireTime=time; event.fires++; fired.set(event.path.triggerIndex,time);
      const seconds = event.path.duration.kind==='persistent' ? Infinity : event.path.duration.seconds??0;
      for (const rawEffect of event.path.effects) {
        const e={...rawEffect};
        if (effectTarget(e)!==target) continue;
        firstFire ??= time; firstFireMeter ??= meter;
        record('activation',`Trigger ${event.path.triggerIndex+1}, effect ${e.type}`);
        if ([2,3,5,6].includes(event.path.rarity??1) && (e.type===27||e.type===22)) e.value=(e.value??0)*(1+wisdomMultiplier(raw.wisdom+modifiers.wisdom)*wisdomPhaseCoefficient(style,phase,spurt));
        const value=(e.value??0)/10000;
        if (e.type===9) {
          const before=hp, nominal=maxHP*value;
          hp=clamp(hp+nominal,0,maxHP);
          if (value>0) {
            recovered=true;
            if (target==='self') recovery.push({triggerIndex:event.path.triggerIndex,time,meter,phase,nominalHP:nominal,receivedHP:hp-before,wastedHP:Math.max(0,nominal-(hp-before)),weight:phase===0?.5:1});
          }
          record('recovery',`Nominal ${nominal.toFixed(3)} HP; actual ${(hp-before).toFixed(3)} HP`);
        } else if ((e.type??0)>=1&&(e.type??0)<=5) {
          modifiers[STAT_NAMES[e.type!-1]]+=value;
          stats=effectiveStats(raw,modifiers);
          const newHP=computeMaxHP(length,stats.stamina,style);
          hp=clamp(hp+newHP-maxHP,0,newHP); maxHP=newHP;
          if(seconds>0) active.push({effect:e,end:time+seconds});
        } else if(e.type===10) {if(meter===0)delay*=value;}
        else if(e.type===14) {if(meter===0)delay+=value;}
        else if(seconds>0)active.push({effect:e,end:time+seconds});
        else if(event.path.duration.kind==='instant'&&(e.type===21||e.type===22))velocity+=value;
      }
      if(event.fires>event.path.additionalActivations||event.path.cooldownSeconds==null)event.fired=true;
    }
    const maximum=maxSpurtSpeed(length,stats,style);
    const limitBuff=staminaLimitBreak(length,raw.stamina+modifiers.stamina);
    if(phase>=2&&(!plan||recovered)) {
      // Once activated, Limit Break persists even if recovery causes a slower replan.
      const persistentBuff=limitBreakActive?limitBuff:0;
      plan=planLastSpurt({meter,length,hp,cruise:baseTargetSpeed(2,length,stats,style)+persistentBuff,maximum:maximum+persistentBuff,limitBreak:limitBreakActive?0:limitBuff,consumption:v=>consumption(v,2),alreadySpurting:spurt});
      record('replan',`Start ${plan.start.toFixed(2)}m, speed ${plan.speed.toFixed(4)}m/s, HP estimate ${plan.estimatedHP.toFixed(3)}`);
    }
    if(plan&&meter+1e-8>=plan.start&&hp>0&&!spurt) {
      spurt=true; spurtStart??=meter; record('spurt',`Target ${plan.speed.toFixed(4)}m/s`);
    }
    let competitionBonus=0;
    if(competitionEnabled) {
      // Only compute the HP forecast at a check or recovery, not every frame.
      const checking=(meter>=length*10/24&&meter<length*15/24&&time+1e-9>=competition.nextCheck)||recovered;
      const result=updateCompetition(competition,time,meter,length,hp,checking?requiredHP():0,recovered);
      if(result.keepingChanged)record('stamina-keep',competition.keeping?'Entered':'Exited');
      if(result.started) { const cost=competitionCost(length,style);hp=Math.max(0,hp-cost);record('competition',`2s speed boost; HP cost ${cost.toFixed(3)} once`); }
      if(result.active)competitionBonus=competitionSpeed(stats.power,stats.guts,style);
    }
    if(spurt&&plan?.maximum&&!limitBreakActive&&limitBuff>0&&velocity>=maximum-.02) {
      limitBreakActive=true;record('limit-break',`Target buff ${limitBuff.toFixed(4)}m/s`);
    }
    let targetSpeed=spurt&&plan ? plan.speed-(plan.maximum&&!limitBreakActive?limitBuff:0) : baseTargetSpeed(phase,length,stats,style)+(limitBreakActive?limitBuff:0);
    let targetBonus=competitionBonus,currentBonus=0,accelBonus=0,zenkaiBonus=0;
    for(const {effect:e} of active) {
      const value=(e.value??0)/10000;
      if(e.type===27)targetBonus+=value;
      if(e.type===21||e.type===22)currentBonus+=value;
      if(e.type===31)accelBonus+=value;
      if(e.type===48)zenkaiBonus+=value*.1;
    }
    const slope=course.slopes.find(s=>meter>=s.start&&meter<s.end)?.slope??0;
    if(slope>0)targetSpeed-=(slope/10000)*200/Math.max(1,stats.power);
    targetSpeed+=targetBonus;
    const powerAccel=.0006*Math.sqrt(500*Math.max(1,stats.power));
    if(spurt&&plan?.maximum&&raw.speed+modifiers.speed>2000&&hp>0&&velocity>=maximum-.02)zenkai=true;
    if(zenkai&&hp>0) {zenkaiVelocity+=(.068*powerAccel/Math.pow(length/1000,1.5)+zenkaiBonus)*DT;targetSpeed+=zenkaiVelocity;}
    if(hp<=0) {
      depletedAt??=meter;
      if(zenkai)velocity=minimumSpeed(length,stats.guts);
      targetSpeed=minimumSpeed(length,stats.guts);spurt=false;zenkai=false;zenkaiVelocity=0;
    }
    const deceleration=hp<=0?-1.2:phase===0?-1.2:phase===1?-.8:-1;
    const accel=velocity<targetSpeed?(meter<15?12:powerAccel)+accelBonus:deceleration;
    const nextV=velocity<targetSpeed?Math.min(targetSpeed,velocity+accel*DT):Math.max(targetSpeed,velocity+accel*DT);
    const displacedSpeed=Math.max(.1,(velocity+nextV)/2+currentBonus);
    const availableDT=time<delay?Math.max(0,time+DT-delay):DT;
    const step=displacedSpeed*availableDT,fraction=step>length-meter?(length-meter)/step:1;
    if(spurt)spurtDistance+=Math.min(step,length-meter);
    meter=Math.min(length,meter+step);time+=DT*fraction;velocity=Math.max(.1,nextV);
    const hpBefore=hp;hp=Math.max(0,hp-consumption(velocity,phase)*availableDT*fraction);
    if(hp===0&&hpBefore>0) {depletedAt??=meter;record('depletion','HP exhausted');}
    if(points)points.push({t:time,x:meter,v:velocity+currentBonus,target:targetSpeed+currentBonus,phase,hp,spurt});
  }
  return {finish:time,points,firstFire,firstFireMeter,lastEnd,lastEndMeter,finalSpeed:velocity,recovery,
    spurt:{startMeter:spurtStart,plannedStartMeter:plan?.start??null,plannedSpeed:plan?.speed??null,distance:spurtDistance,remainingHP:hp,depletedAtMeter:depletedAt,limitBreakActivated:limitBreakActive},events:log};
}

export function simulateTimeline(context: RatingContext, events: TimelineEvent[], detail = false, baseline?: Run): SimulationResult {
  if (!context.course) throw new Error('Simulator requires a course');
  const base = baseline ?? runTimeline(context, [], 'self', detail);
  const selfEvents = events.map(e=>({...e,path:{...e.path,effects:e.path.effects.filter(x=>effectTarget(x)==='self')}}));
  const opponentEvents = events.map(e=>({...e,path:{...e.path,effects:e.path.effects.filter(x=>effectTarget(x)==='opponent')}}));
  const self = runTimeline(context, selfEvents, 'self', detail);
  const hasOpponent = opponentEvents.some(e=>e.path.effects.length);
  const opponent = hasOpponent ? runTimeline(context, opponentEvents, 'opponent', false) : base;
  const gain = base.finish - self.finish + (opponent.finish - base.finish);
  const benefit = gain * raceBaseSpeed(context.course.length);
  const notes = [...SIMULATOR_PROVENANCE];
  if (hasOpponent) notes.push('Opponent effects use one representative target with the selected profile/style; no lobby multiplier.');
  const unsupported = events.flatMap(e=>e.path.effects).filter(e=>!effectFamily(e)||effectTarget(e)==='unknown');
  if (unsupported.length) notes.push(`Unmodeled effect types/targets: ${unsupported.map(e=>`${e.type}/${e.target}`).join(', ')}`);
  const unsupportedIntrinsic = events.flatMap(e => e.path.intrinsicClauses ?? []).filter(c => !supportsIntrinsicClause(c));
  if (unsupportedIntrinsic.length) notes.push(`Unmodeled intrinsic predicates: ${unsupportedIntrinsic.map(c => c.key).join(', ')}`);
  const result: SimulationResult = {benefit,timeGainSeconds:gain,baselineTimeSeconds:base.finish,skillTimeSeconds:self.finish,activated:self.firstFire !== null || opponent.firstFire !== null,status:unsupported.length || unsupportedIntrinsic.length?'partial':'provisional',notes,recovery:self.recovery,hp:{baseline:base.spurt,skill:self.spurt,competition:context.hpEnvironment?.competition??'conditional'}};
  if (detail && base.points && self.points) { result.trace = makeTrace(context, base, self, result); result.hpEvents={baseline:base.events??[],skill:self.events??[]}; }
  return result;
}
function makeTrace(context: RatingContext, base: Run, skill: Run, result: SimulationResult): RaceEffectTrace {
  const bs = base.points!, ss = skill.points!;
  const atTime = (points: Point[], t: number) => {
    let lo = 0, hi = points.length - 1;
    while (lo < hi) {const m = Math.floor((lo+hi)/2); if (points[m].t < t) lo=m+1; else hi=m;}
    const b = points[lo], a = points[Math.max(0,lo-1)], q = clamp((t-a.t)/Math.max(1e-9,b.t-a.t),0,1);
    return {x:a.x+(b.x-a.x)*q,v:a.v+(b.v-a.v)*q,target:a.target+(b.target-a.target)*q,hp:a.hp+(b.hp-a.hp)*q,spurt:b.spurt};
  };
  const atMeter = (points: Point[], x: number) => {
    let lo=0,hi=points.length-1; while(lo<hi){const m=Math.floor((lo+hi)/2);if(points[m].x<x)lo=m+1;else hi=m;}
    return points[lo];
  };
  const stride = Math.max(1,Math.ceil(bs.length/240));
  const sampled = bs.filter((_,i)=>i%stride===0||i===bs.length-1);
  return { version:1,points:sampled.map(b=>{const s=atTime(ss,b.t);return {timeSeconds:b.t,baselineMeter:b.x,baselineSpeed:b.v,baselineTargetSpeed:b.target,skillMeter:s.x,skillSpeed:s.v,skillTargetSpeed:s.target,phase:b.phase,baselineHP:b.hp,skillHP:s.hp,baselineSpurt:b.spurt,skillSpurt:s.spurt};}),
    spatialPoints:Array.from({length:201},(_,i)=>{const x=context.course!.length*i/200,b=atMeter(bs,x),s=atMeter(ss,x);return {meter:x,baselineSpeed:b.v,baselineTargetSpeed:b.target,skillSpeed:s.v,skillTargetSpeed:s.target};}),
    activationMeter:skill.firstFireMeter,effectEndMeter:skill.lastEndMeter??(skill.firstFire==null?null:context.course!.length),activationTimeSeconds:skill.firstFire??0,effectEndTimeSeconds:skill.lastEnd??skill.finish,totalTimeSeconds:base.finish,timeGainSeconds:result.timeGainSeconds,distanceGainMeters:result.benefit,bashinGain:result.benefit/2.5,physicsStatus:result.status==='partial'?'partial':'provisional' };
}

function wisdomMultiplier(wisdom: number): number {
  const delta=Math.max(0,wisdom-1200);
  if(delta===0)return 0;
  if(delta<=200)return Math.ceil(delta/20)*.02;
  if(delta<=400)return .2+Math.ceil((delta-200)/20)*.06;
  if(delta<=800)return .8+Math.ceil((delta-400)/20)*.01;
  return Math.min(1.12,1+Math.ceil((delta-800)/100)*.01);
}
function wisdomPhaseCoefficient(style:number,phase:number,spurt:boolean):number {
  const coefficients:Record<number,number[]>={1:[.26,.23,.19,.16],2:[.21,.21,.21,.21],3:[.19,.18,.23,.24],4:[.15,.17,.25,.27],5:[.26,.23,.19,.16]};
  return (coefficients[style]??coefficients[2])[spurt?3:Math.min(2,phase)];
}
