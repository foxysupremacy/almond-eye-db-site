import type { Motivation, Proficiency, StatBlock } from "../race-impact/adjusted-stats";
import type { RunningStyle } from "../deck/types";

/** Recovery skill buckets, % of max HP healed (index-aligned with `StaminaInput.recovery`). */
export const RECOVERY_BUCKETS = [9.5, 7.5, 5.5, 3.5, 1.5, 0.5, 0.35] as const;
/** HP-loss (debuff) buckets, % of max HP removed (index-aligned with `StaminaInput.hpLoss`). */
export const HP_LOSS_BUCKETS = [4, 3, 2, 1, 0.5, 0.25] as const;
/**
 * Green (passive) stat skills: [stat, bonus]. Added to the adjusted stat (FinalStat = Adjusted + SkillModifier).
 * One bucket per positive per-stat value that a passive skill grants in master.mdb (skill_data with
 * float_ability_time_1 = -1, ability types 1-5), audited 2026-11-19. Multi-stat skills (e.g. Speed+Power +80)
 * count once in each stat's bucket. Keys are persisted (`stamina.v1`): add new ones, never rename.
 */
export const GREEN_BUCKETS = {
  spd120: ["speed", 120],
  spd100: ["speed", 100],
  spd80: ["speed", 80],
  spd60: ["speed", 60],
  spd40: ["speed", 40],
  spd20: ["speed", 20],
  sta80: ["stamina", 80],
  sta60: ["stamina", 60],
  sta40: ["stamina", 40],
  pow120: ["power", 120],
  pow100: ["power", 100],
  pow80: ["power", 80],
  pow60: ["power", 60],
  pow40: ["power", 40],
  pow20: ["power", 20],
  gut100: ["guts", 100],
  gut80: ["guts", 80],
  gut60: ["guts", 60],
  gut40: ["guts", 40],
  wit100: ["wisdom", 100],
  wit80: ["wisdom", 80],
  wit60: ["wisdom", 60],
  wit40: ["wisdom", 40],
} as const satisfies Record<string, readonly [keyof StatBlock, number]>;
export type GreenKey = keyof typeof GREEN_BUCKETS;
/** All green counts at zero. */
export const emptyGreens = (): Record<GreenKey, number> =>
  Object.fromEntries(Object.keys(GREEN_BUCKETS).map((k) => [k, 0])) as Record<GreenKey, number>;

export interface StaminaInput {
  /** Raw stats, 1..2500. */
  stats: StatBlock;
  style: RunningStyle;
  aptitude: { ground: Proficiency; distance: Proficiency; style: Proficiency };
  motivation: Motivation;
  greens: Record<GreenKey, number>;
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
