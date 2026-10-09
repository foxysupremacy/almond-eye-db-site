import type { Course } from '../skill-engine/types';
import type { RunningStyle } from '../deck/types';
import type { EvaluatorZoneInput, SkillDetailInput } from '../evaluator/types';
import type { RaceImpactProfile, RaceImpactPriorsPayload, RaceImpactResult } from './types';
import { evaluateSkillForTrack } from '../evaluator/evaluator';
export interface RaceImpactContext { course:Course|null|undefined;runningStyle:RunningStyle|null|undefined;racerCount:number;raceParams?:{groundCondition?:number|string|null};profile:RaceImpactProfile;priors?:RaceImpactPriorsPayload }
/** Compatibility adapter. Conditional gains and rating use the canonical engine. */
export function evaluateTriggerRaceImpact(skill:SkillDetailInput,zones:EvaluatorZoneInput[],context:RaceImpactContext):RaceImpactResult {
  return evaluateSkillForTrack(skill,context.course,context.runningStyle,context.racerCount,false,zones,context.raceParams,{raceImpactProfile:context.profile,detail:'full'}).raceImpact!;
}
/** Independent impacts cannot reconstruct a shared chain timeline. Kept for
 * legacy callers, with an explicit partial result; canonical engine owns chains. */
export function aggregateRaceImpact(impacts:RaceImpactResult[],mode:'chain'|'alternative'):RaceImpactResult|undefined {
  if(!impacts.length)return undefined;
  if(impacts.length===1)return impacts[0];
  const best=impacts.reduce((a,b)=>(b.expectedDistanceGainMeters??-Infinity)>(a.expectedDistanceGainMeters??-Infinity)?b:a);
  return {...best,physicsStatus:mode==='chain'?'partial':best.physicsStatus,physicsNote:mode==='chain'?'Individual trigger summaries cannot be added: evaluate the complete chain on the canonical timeline. Showing one modeled contribution.':'Best conditional alternative; mutually exclusive paths are not summed.'};
}
