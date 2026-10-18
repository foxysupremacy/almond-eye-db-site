import type { RaceImpactStat } from "./types";

/**
 * The in-game stat pipeline (mechanics doc §Stats), pure:
 *   Raw (clamped) → Base = (raw past 1200 counts half) × motivation → Adjusted:
 *   Speed = Base × RaceCourseModifier + GroundModifier, Power = Base + GroundModifier,
 *   Stamina = Base, Guts = Base, Wiz = Base × StrategyProficiencyModifier. Single mode modifier is 0 (not training).
 * Integer arithmetic follows the game: the halving is an integer division and adjusted stats are
 * truncated to integers.
 */
export type StatBlock = Record<RaceImpactStat, number>;
export type Motivation = "best" | "good" | "normal" | "bad" | "worst";
export type Proficiency = "S" | "A" | "B" | "C" | "D" | "E" | "F" | "G";

/** Every stat is clamped to [1, STAT_CAP]; the cap was raised from 2000 to 2500 on the 5th anniversary. */
export const STAT_CAP = 2500;
export const STAT_COMPRESSION_THRESHOLD = 1200;

export const MOTIVATION_COEFFICIENT: Record<Motivation, number> = { best: 1.04, good: 1.02, normal: 1, bad: 0.98, worst: 0.96 };
export const STRATEGY_PROFICIENCY_MODIFIER: Record<Proficiency, number> = { S: 1.1, A: 1, B: 0.85, C: 0.75, D: 0.6, E: 0.4, F: 0.2, G: 0.1 };

/** Ground modifiers by surface (1 turf, 2 dirt) and ground condition (1 firm/良, 2 good/稍重, 3 soft/重, 4 heavy/不良). */
const GROUND_SPEED: Record<number, [number, number, number, number]> = { 1: [0, 0, 0, -50], 2: [0, 0, 0, -50] };
const GROUND_POWER: Record<number, [number, number, number, number]> = { 1: [0, -50, -50, -50], 2: [-100, -50, -100, -100] };

/** Course stat-threshold ids (racetracks.json `statThresholds`): 1 speed, 2 stamina, 3 power, 4 guts, 5 wisdom. */
const THRESHOLD_STAT: Record<number, RaceImpactStat> = { 1: "speed", 2: "stamina", 3: "power", 4: "guts", 5: "wisdom" };

const STATS: RaceImpactStat[] = ["speed", "stamina", "power", "guts", "wisdom"];

function clampStat(value: number): number {
  return Math.min(STAT_CAP, Math.max(1, value));
}

function compress(raw: number): number {
  const clamped = clampStat(Math.trunc(raw));
  return clamped > STAT_COMPRESSION_THRESHOLD ? STAT_COMPRESSION_THRESHOLD + Math.floor((clamped - STAT_COMPRESSION_THRESHOLD) / 2) : clamped;
}

/** Base stats: raw clamped, past 1200 halved, times the motivation coefficient. (In-game the wisdom check reads these; R32 scores do not roll it.) */
export function baseStats(raw: StatBlock, motivation: Motivation = "normal"): StatBlock {
  const coef = MOTIVATION_COEFFICIENT[motivation];
  const out = {} as StatBlock;
  for (const key of STATS) out[key] = clampStat(compress(raw[key]) * coef);
  return out;
}

/** Race course modifier: the average, over the course's threshold stats, of the bonus each base stat earns. */
export function raceCourseModifier(base: StatBlock, statThresholds: ReadonlyArray<number>): number {
  const stats = statThresholds.map((id) => THRESHOLD_STAT[id]).filter((key): key is RaceImpactStat => key != null);
  if (!stats.length) return 1;
  const bonus = stats.reduce((total, key) => {
    const v = base[key];
    return total + (v <= 300 ? 0.05 : v <= 600 ? 0.1 : v <= 900 ? 0.15 : 0.2);
  }, 0);
  return 1 + bonus / stats.length;
}

export interface StatContext {
  /** Course surface: 1 turf, 2 dirt. */
  surface: number;
  /** 1 firm (良, default), 2 good (稍重), 3 soft (重), 4 heavy (不良). */
  groundCondition?: number | null;
  statThresholds?: ReadonlyArray<number>;
  motivation?: Motivation;
  strategyProficiency?: Proficiency;
}

function groundIndex(groundCondition: number | null | undefined): number {
  return groundCondition != null && groundCondition >= 1 && groundCondition <= 4 ? Math.trunc(groundCondition) - 1 : 0;
}

/** Adjusted stats: what the race physics reads. */
export function adjustedStats(raw: StatBlock, context: StatContext): StatBlock {
  const base = baseStats(raw, context.motivation ?? "normal");
  const ground = groundIndex(context.groundCondition);
  const surface = context.surface === 2 ? 2 : 1;
  const courseModifier = raceCourseModifier(base, context.statThresholds ?? []);
  const proficiency = STRATEGY_PROFICIENCY_MODIFIER[context.strategyProficiency ?? "A"];
  // Tiny epsilon: 1700 x 1.2 must truncate to 2040, not 2039.
  const final = (v: number) => clampStat(Math.trunc(v + 1e-9));
  return {
    speed: final(base.speed * courseModifier + GROUND_SPEED[surface][ground]),
    stamina: final(base.stamina),
    power: final(base.power + GROUND_POWER[surface][ground]),
    guts: final(base.guts),
    wisdom: final(base.wisdom * proficiency),
  };
}
