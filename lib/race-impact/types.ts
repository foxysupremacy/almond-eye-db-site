
export const RACE_IMPACT_PROFILE_KEY = "visualizer.impact-profile.v1";
export const DEFAULT_RACE_IMPACT_STATS = {
  speed: 2200,
  stamina: 1800,
  power: 1700,
  guts: 1500,
  wisdom: 1800,
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

export interface RaceImpactProfile {
  version: 1;
  stats: Record<RaceImpactStat, number>;
  /** User overrides in [0, 1]. Missing entries use telemetry priors. */
  dynamicOverrides: Partial<Record<DynamicConditionKey, number>>;
}

export type PriorSource = "track" | "global" | "manual";

export interface RaceImpactPrior {
  key: DynamicConditionKey;
  courseId?: number;
  groundCondition?: number;
  runningStyle?: number;
  racerCount?: number;
  opportunities: number;
  activations: number;
}

export interface RaceImpactPriorsPayload {
  version: 1;
  generatedAt: string;
  priors: RaceImpactPrior[];
}

export interface ActivationEstimate {
  geometryRate: number;
  wisdomRate: number;
  rankRate: number;
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
  timeSeconds: number;
  baselineMeter: number;
  baselineSpeed: number;
  skillMeter: number;
  skillSpeed: number;
  phase: number;
}

export interface RaceEffectTrace {
  version: 1;
  points: RaceTracePoint[];
  activationMeter: number;
  activationTimeSeconds: number;
  effectEndTimeSeconds: number;
  totalTimeSeconds: number;
  timeGainSeconds: number;
  distanceGainMeters: number;
  bashinGain: number;
  physicsStatus: "modeled" | "partial" | "provisional" | "not-modeled";
}

export interface ActivationMeterSample {
  meter: number;
  gainMeters: number;
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
  physicsStatus: "modeled" | "partial" | "provisional" | "not-modeled";
  physicsNote?: string;
  trace?: RaceEffectTrace;
  distribution?: RaceEffectDistribution;
}
