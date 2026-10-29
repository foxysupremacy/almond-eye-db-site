import type { Motivation, Proficiency, StatBlock } from "../race-impact/adjusted-stats";
import type { RunningStyle } from "../deck/types";

/** Recovery skill buckets, % of max HP healed (index-aligned with `StaminaInput.recovery`). */
export const RECOVERY_BUCKETS = [9.5, 7.5, 5.5, 3.5, 1.5, 0.5, 0.35] as const;
/** HP-loss (debuff) buckets, % of max HP removed (index-aligned with `StaminaInput.hpLoss`). */
export const HP_LOSS_BUCKETS = [4, 3, 2, 1, 0.5, 0.25] as const;
/** Green (passive) stat skills: [stat, bonus]. Added to the adjusted stat (FinalStat = Adjusted + SkillModifier). */
export const GREEN_BUCKETS = {
  spd60: ["speed", 60],
  spd40: ["speed", 40],
  sta60: ["stamina", 60],
  sta40: ["stamina", 40],
} as const;

export interface StaminaInput {
  /** Raw stats, 1..2500. */
  stats: StatBlock;
  style: RunningStyle;
  aptitude: { ground: Proficiency; distance: Proficiency; style: Proficiency };
  motivation: Motivation;
  greens: Record<keyof typeof GREEN_BUCKETS, number>;
  /** Counts, index-aligned with RECOVERY_BUCKETS. */
  recovery: number[];
  /** Counts, index-aligned with HP_LOSS_BUCKETS. */
  hpLoss: number[];
  toggles: { dueling: boolean; spotStruggle: boolean; kakari: boolean };
  /** 1 Good (良), 2 Slightly heavy (稍重), 3 Heavy (重), 4 Bad (不良). */
  groundCondition: 1 | 2 | 3 | 4;
}

export interface StaminaResult {
  runs: number;
  goalReachPct: number;
  maxSpurtPct: number;
  avgSurplusHp: number;
  staminaKeepPct: number;
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
}
