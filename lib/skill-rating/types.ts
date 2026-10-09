import type { Course, RaceParameters } from '../skill-engine/types';
import type { SkillDetailInput } from '../evaluator/types';
import type { RawSkillEffect } from '../data/types';
import type { RaceImpactProfile, RaceEffectTrace, RaceEffectDistribution } from '../race-impact/types';

export const RATING_MODEL_VERSION = 'conditional-v2';
export const RECOVERY_POLICY_VERSION = 'recovery-policy-v1';
export type EffectFamily = 'target_speed' | 'current_speed_21' | 'current_speed_22' | 'acceleration' | 'zenkai' | 'recovery' | 'passive_speed' | 'passive_stamina' | 'passive_power' | 'passive_guts' | 'passive_wisdom' | 'start_delay';
export type RatingStatus = 'complete' | 'provisional' | 'partial' | 'unavailable';
export type SkillVariant = 'original' | 'parent-factor' | 'inherited-unique';
export interface RatingContext { course: Course | null; style: number | null; racerCount: number; raceParameters?: Partial<RaceParameters>; profile: RaceImpactProfile; modelVersion?: string; hpEnvironment?: { competition: 'conditional' | 'none' } }
export interface RatingRequest { skill: SkillDetailInput; variant?: SkillVariant }
export interface FamilyBenchmark { benefit: number; payloads: number; fixtures: number }
export interface RatingBenchmarks { modelVersion: string; convention: string; families: Partial<Record<EffectFamily, FamilyBenchmark>>; provenance: string[]; recoveryPolicy?: { version: string; nominalHP: FamilyBenchmark } }
export interface RatingEnvironment {
  resolveVariant?: (skill: SkillDetailInput, variant: SkillVariant) => SkillDetailInput | null;
  benchmarks: RatingBenchmarks;
  isSkillAllowed?: (skillId: number, context: RatingContext) => boolean;
}
export type EligibilityState = 'eligible' | 'ineligible' | 'missing-context' | 'unknown';
export interface AssumedClause { clause: string; source: 'condition' | 'precondition'; triggerIndex: number; kind: 'rank' | 'dynamic' | 'prerequisite' | 'unknown'; description: string }
export interface TriggerPath {
  triggerIndex: number;
  regions: Array<{ start: number; end: number }>;
  sampling: 'immediate' | 'random' | 'straight' | 'all-corner' | 'distribution';
  distribution?: { shape: number; rate: number };
  assumptions: AssumedClause[];
  rankSet: number[];
  condition: string;
  precondition: string;
  dependsOn: number[];
  cooldownSeconds: number | null;
  additionalActivations: number;
  duration: { kind: 'instant' | 'timed' | 'persistent' | 'unknown'; seconds: number | null };
  effects: RawSkillEffect[];
  rarity?: number;
  intrinsicClauses?: Array<{ key: string; comparator: string; value: number }>;
  partialReasons: string[];
  warnings: string[];
}
export interface RatingScenario { id: string; relation: 'single' | 'alternative' | 'enhanced' | 'fallback' | 'chain'; paths: TriggerPath[]; suppressedBy?: string[] }
export interface SkillAnalysis {
  originalSkillId: number; evaluatedSkillId: number | null; variant: SkillVariant;
  contextFingerprint: string; modelVersion: string;
  eligibility: { state: EligibilityState; reasons: string[] };
  scenarios: RatingScenario[]; assumptions: AssumedClause[]; warnings: string[]; partialReasons: string[];
}
export interface FamilyContribution { family: EffectFamily; attributedBenefit: number; benchmark: number | null; points: number | null; effects: RawSkillEffect[]; simulationPoints?: number | null; policyPoints?: number | null }
export interface RecoveryActivation { triggerIndex: number; time: number; meter: number; phase: number; nominalHP: number; receivedHP: number; wastedHP: number; weight: number; sampleWeight?: number }
export interface SpurtSummary { startMeter: number | null; plannedStartMeter: number | null; plannedSpeed: number | null; distance: number; remainingHP: number; depletedAtMeter: number | null; limitBreakActivated: boolean }
export interface HPEvent { kind: 'activation' | 'replan' | 'spurt' | 'competition' | 'stamina-keep' | 'recovery' | 'limit-break' | 'depletion'; time: number; meter: number; hp: number; detail: string }
export interface HPDiagnostics { baseline: SpurtSummary; skill: SpurtSummary; competition: 'conditional' | 'none' }
export interface RecoveryBreakdown { policyVersion: string; distanceGate: number; nominalHP: number; receivedHP: number; wastedHP: number; weightedNominalHP: number; simulationWeight: number; nominalHPBenchmark: number | null; rawSelfHealSimulationPoints: number | null; signedCostAndOpponentPoints: number | null; simulationPoints: number | null; policyPoints: number | null; activations: RecoveryActivation[] }
export interface SimulationResult { benefit: number; timeGainSeconds: number; baselineTimeSeconds: number; skillTimeSeconds: number; activated: boolean; status: RatingStatus; notes: string[]; trace?: RaceEffectTrace; recovery?: RecoveryActivation[]; hp?: HPDiagnostics; hpEvents?: { baseline: HPEvent[]; skill: HPEvent[] } }
export interface SkillRating extends SkillAnalysis {
  /** Activation in modeled samples, not the probability of activation in a race. */
  activationOutcome?: 'activated' | 'not-activated' | 'unmodeled';
  selectedStyle?: number | null;
  score: number; tier: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' | null; stars: 1 | 2 | 3 | 4 | 5 | null;
  status: RatingStatus; contributions: FamilyContribution[];
  selectedScenarioId: string | null; selectedPaths: TriggerPath[];
  simulatedBenefit: number; timeGainSeconds: number; benchmarkVersion: string;
  breakdown: string[]; provenance: string[];
  trace?: RaceEffectTrace; distribution?: RaceEffectDistribution;
  styleRatings?: Array<{ style: number; score: number; eligibility: EligibilityState; status: RatingStatus; tier: SkillRating['tier']; stars: SkillRating['stars'] }>;
  bestStyle?: number;
  policyVersion?: string;
  recovery?: RecoveryBreakdown;
  hp?: HPDiagnostics;
  hpEvents?: { baseline: HPEvent[]; skill: HPEvent[] };
}
export interface SkillRatingSession {
  analyze(request: RatingRequest): SkillAnalysis;
  evaluate(request: RatingRequest, options?: { detail?: 'summary' | 'full' }): SkillRating;
  evaluateMany(requests: RatingRequest[], options?: { detail?: 'summary' | 'full' }): SkillRating[];
  metrics(): { simulations: number; cacheHits: number; evaluations: number };
}
