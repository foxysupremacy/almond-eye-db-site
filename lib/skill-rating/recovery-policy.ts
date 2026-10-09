import type { RawSkillEffect } from '../data/types';
import { effectFamily, effectTarget } from './simulator';
import { RECOVERY_POLICY_VERSION, type RatingBenchmarks, type RecoveryActivation, type RecoveryBreakdown } from './types';

/** Separate positive self healing from signed costs/opponent effects for attribution. */
export function attributionGroup(effect: RawSkillEffect): string | null {
  const family = effectFamily(effect);
  if (family !== 'recovery') return family;
  return effectTarget(effect) === 'self' && (effect.value ?? 0) > 0 ? 'recovery:self-heal' : 'recovery:signed-other';
}
export function recoveryPolicy(length: number, activations: RecoveryActivation[], selfHealPoints: number | null, signedOtherPoints: number | null, benchmarks: RatingBenchmarks): RecoveryBreakdown {
  const sum = (read: (a: RecoveryActivation) => number) => activations.reduce((total,a)=>total+read(a)*(a.sampleWeight??1),0);
  const nominalHP=sum(a=>a.nominalHP), weightedNominalHP=sum(a=>a.nominalHP*a.weight);
  const simulationWeight=nominalHP>0?weightedNominalHP/nominalHP:1;
  const distanceGate=length>2000?1:0;
  const nominalHPBenchmark=benchmarks.recoveryPolicy?.version===RECOVERY_POLICY_VERSION?benchmarks.recoveryPolicy.nominalHP.benefit:null;
  const simulationPoints=selfHealPoints==null||signedOtherPoints==null?null:distanceGate*simulationWeight*selfHealPoints+signedOtherPoints;
  // No reserve benchmark is needed for a gate-zero skill or no actual self heal.
  const policyPoints=!distanceGate||nominalHP===0?0:nominalHPBenchmark!=null&&nominalHPBenchmark>0?100*weightedNominalHP/nominalHPBenchmark:null;
  return {policyVersion:RECOVERY_POLICY_VERSION,distanceGate,nominalHP,receivedHP:sum(a=>a.receivedHP),wastedHP:sum(a=>a.wastedHP),weightedNominalHP,simulationWeight,nominalHPBenchmark,rawSelfHealSimulationPoints:selfHealPoints,signedCostAndOpponentPoints:signedOtherPoints,simulationPoints,policyPoints,activations};
}
