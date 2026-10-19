
export const RACE_IMPACT_PROFILE_KEY = "visualizer.impact-profile.v1";
/** Bump when race-impact numbers change (rankings cache key). 4: adjusted stats + prerequisite groups. 5: innate skills held (Option A) + slopes. 6: section random mean + step 4 (HP-based duration, value/duration scaling, additional activation). 7: step 4b (minimum speed, corner lane loss, start run-up, 3 green skills for value type 14). 8: step 4c (sub-frame phase, slope and skill switching; 6 green skills, R26). 9: step 5a (position conditions met, R28; dynamic triggers timed by a race-state model; passive stat skills; precondition chains). 10: step 5b (phase boundary frame, Mejiro Dober). 11: step 5c (own-activation count conditions assumed met, the activate_count key, and sampled across the zone; R31 reverses R29). 12: step 5d (R32: a score is the value if the skill activates; prerequisite skills and popularity met for every Uma, no wisdom or lottery roll). 13: R33 (own lane and race-state models, parameters fitted to umasim / U-tools results) + R34 (strongest situational scaling). */
export const PHYSICS_VERSION = 13;
export const USEFUL_THRESHOLD_BASHIN = 0.1;
export const ACTIVATION_SAMPLE_STEP_METERS = 10;
export const BASHIN_METERS = 2.5;
/** Reference Uma assumptions for the stat pipeline (adjusted-stats.ts): normal motivation, strategy aptitude A. */
export const REFERENCE_MOTIVATION = "normal" as const;
export const REFERENCE_STRATEGY_PROFICIENCY = "A" as const;
export const DEFAULT_RACE_IMPACT_STATS = {
  speed: 2200,
  stamina: 1800,
  power: 1700,
  guts: 1500,
  wisdom: 1200,
} as const;

export type RaceImpactStat = keyof typeof DEFAULT_RACE_IMPACT_STATS;
export type DynamicConditionKey =
  | "blocked"
  | "overtake"
  | "nearby"
  | "surrounded"
  | "activate_count"
  | "other_skill"
  | "visibility";

export type PhysicsStatus = "modeled" | "partial" | "provisional" | "not-modeled";

export interface RaceImpactProfile {
  version: 2;
  stats: Record<RaceImpactStat, number>;
  /** User overrides in [0, 1]. Missing entries count as satisfied (R7.4); telemetry priors are not multiplied in (R14). */
  dynamicOverrides: Partial<Record<DynamicConditionKey, number>>;
  /** m/s used to convert time saved into meters; null = course base speed. */
  bashinReferenceSpeed: number | null;
  /**
   * Green skills assumed activated for value type 14 (step 4b). Code-level override only (not persisted or shown);
   * absent: REFERENCE_GREEN_SKILL_COUNT (scaling.ts).
   */
  greenSkillCount?: number;
}

export interface SkillScoreSample {
  meter: number;
  bashin: number;
  weight: number;
  /** Finish-time gain in seconds for this activation meter. */
  timeGainSeconds?: number;
}

export interface SkillScore {
  skillId: number;
  groupIndex: number | null;
  expectedBashin: number;
  meanBashin: number;
  minBashin: number;
  maxBashin: number;
  medianBashin: number;
  activationRate: number;
  usefulRate: number;
  recoveryHpPercent: number | null;
  physicsStatus: PhysicsStatus;
  banned: boolean;
  /** Empty unless requested. */
  samples: SkillScoreSample[];
}

export type PriorSource = "track" | "global" | "manual";

export interface ActivationEstimate {
  geometryRate: number;
  /** Situational rate: 1 unless `profile.dynamicOverrides` lowers a dynamic key (R32: no wisdom or lottery roll). */
  dynamicRate: number;
  /** This trigger can only run after a previous detail of the same skill fired. */
  dependsOnPreviousTrigger: boolean;
  activationRate: number;
  dynamicKeys: DynamicConditionKey[];
  priorSource: PriorSource;
  priorSamples: number;
  confidence: "high" | "medium" | "low";
}

export interface TacticalScoreBreakdown {
  activation: number;
  effect: number;
  timing: number;
  duration: number;
  coverage: number;
  total: number;
}

export interface RaceImpactSample {
  activationMeter: number;
  timeGainSeconds: number;
  distanceGainMeters: number;
  bashin: number;
}

export interface RaceTracePoint {
  baselineHP?: number;
  skillHP?: number;
  baselineSpurt?: boolean;
  skillSpurt?: boolean;
  timeSeconds: number;
  baselineMeter: number;
  baselineSpeed: number;
  baselineTargetSpeed: number;
  skillMeter: number;
  skillSpeed: number;
  skillTargetSpeed: number;
  phase: number;
}

export interface RaceTraceSpatialPoint {
  meter: number;
  baselineSpeed: number;
  baselineTargetSpeed: number;
  skillSpeed: number;
  skillTargetSpeed: number;
}

export interface RaceEffectTrace {
  version: 1;
  points: RaceTracePoint[];
  spatialPoints: RaceTraceSpatialPoint[];
  activationMeter: number | null;
  effectEndMeter: number | null;
  activationTimeSeconds: number;
  effectEndTimeSeconds: number;
  totalTimeSeconds: number;
  timeGainSeconds: number;
  distanceGainMeters: number;
  bashinGain: number;
  physicsStatus: PhysicsStatus;
}

export interface ActivationMeterSample {
  meter: number;
  gainMeters: number;
  /** Finish-time gain in seconds (gainMeters is the Bashin distance measure). */
  timeGainSeconds?: number;
  bashin: number;
  eligible: boolean;
  activationRate: number;
  usefulRate: number;
  zoneIndex?: number;
}

export interface RaceEffectDistribution {
  version: 1;
  samples: ActivationMeterSample[];
  maxGainMeters: number;
  minGainMeters: number;
  optimalMeter: number | null;
  optimalGainMeters: number | null;
  eligibleRangeDescription: string;
}

export interface RaceImpactResult {
  activation: ActivationEstimate;
  tactical: TacticalScoreBreakdown;
  /** Probability that an eligible trigger produces a useful modeled effect. */
  usefulRate: number;
  expectedTimeGainSeconds: number | null;
  expectedDistanceGainMeters: number | null;
  expectedBashin: number | null;
  minBashin: number | null;
  meanBashin: number | null;
  medianBashin: number | null;
  maxBashin: number | null;
  samples: RaceImpactSample[];
  physicsStatus: PhysicsStatus;
  physicsNote?: string;
  trace?: RaceEffectTrace;
  distribution?: RaceEffectDistribution;
}
