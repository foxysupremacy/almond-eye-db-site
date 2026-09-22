export type SkillTacticalCategory =
  | "fastest_accel" // Valid Fastest Accel (有効最速加速)
  | "carry_over" // Late-Race Connection (終盤接続)
  | "zenkai_accel" // Zenkai Spurt Acceleration (全開スパート加速)
  | "delayed_accel" // Delayed Accel (遅延加速)
  | "position_accel" // Mid-race Position Accel (ポジション加速)
  | "dead_accel" // Dead Accel (無効加速)
  | "current_speed" // Instant Current Speed (現在速度)
  | "mid_speed" // Mid-race Position Speed (中盤速度)
  | "late_speed" // Late-race Top Speed (終盤速度)
  | "early_speed" // Early-race Positioning (序盤速度)
  | "recovery" // Stamina Heal (回復)
  | "passive" // Passive Green (パッシブ)
  | "debuff" // Opponent Debuff (デバフ)
  | "other" // Miscellaneous / Lane / Vision
  | "invalid"; // Does not activate on course

export interface SpecialEffectItem {
  id: string;
  type: "success" | "warning" | "error" | "info";
  badge: string;
  title: string;
  description: string;
  meters?: string;
}

export interface CalculationStep {
  title: string;
  formula: string;
  result: string;
  explanation: string;
  badgeType: "optimal" | "warning" | "error" | "neutral";
}

export interface CalculationBreakdown {
  courseLength: number;
  spurtLineMeters: number;
  spurtFormula: string;
  triggerStartMeters: number | null;
  triggerEndMeters: number | null;
  baseDurationSeconds: number;
  scaledDurationSeconds: number;
  durationFormula: string;
  estimatedDistanceMeters: number;
  distanceFormula: string;
  delayFromSpurtMeters: number | null;
  delayFormula: string;
  delayStatus: "optimal" | "early_overlap" | "delayed" | "dead" | "mid_race" | "invalid";
  delayExplanation: string;
  accelPhaseEndMeters: number;
  effectMagnitude?: number;
  effectTypeLabel?: string;
  dynamicMathExplanation: string;
  steps: CalculationStep[];
}

export interface SkillEvaluationResult {
  score: number;
  stars: 1 | 2 | 3 | 4 | 5;
  tier: "S" | "A" | "B" | "C" | "D" | "F";
  category: SkillTacticalCategory;
  primaryBadge: {
    label: string;
    badgeClass: string;
    dotColor: string;
  };
  verdictSummary: string;
  specialEffects: SpecialEffectItem[];
  /**
   * Fraction (0–1) of the running style's expected rank envelope covered by the
   * skill's rank window. Absent when the skill has no rank condition.
   */
  positionOverlap?: number;
  timingAnalysis: {
    spurtMeters: number;
    triggerStartMeters: number | null;
    triggerEndMeters: number | null;
    isRandom: boolean;
    durationSeconds: number;
    durationMeters: number;
    delayFromSpurt: number | null;
    connectsToLateRace: boolean;
  };
  calculationBreakdown: CalculationBreakdown;
  /** Independent probability, tactical-score, and baseline-vs-skill estimate. */
  raceImpact?: import("../race-impact").RaceImpactResult;
  triggerEvaluations?: SkillTriggerEvaluation[];
  parentMeta?: {
    isParentMode: boolean;
    inheritedWhiteId?: number;
    inheritedWhiteNameEn?: string;
    inheritedWhiteNameJp?: string;
    isGoldTransformed: boolean;
    factorTier: "S" | "A" | "B" | "C";
  };
}

export interface SkillTriggerEvaluation {
  triggerIndex: number;
  evaluation: SkillEvaluationResult | null;
}

export interface SkillDetailInput {
  id: number;
  rarity?: number;
  nameEn?: string;
  nameJp?: string;
  descEn?: string;
  conditionGroups?: Array<{
    condition?: string | null;
    precondition?: string | null;
    effects?: Array<{
      type: number;
      value: number;
      target?: number;
      target_details?: number;
    }> | unknown[];
    base_time?: number | null;
  }>;
}

export interface EvaluatorZoneInput {
  regions: Array<{ start: number; end: number }>;
  isRandom: boolean;
  earliestFire?: number | null;
}
