import { STAT_CAP, STRATEGY_PROFICIENCY_MODIFIER, adjustedStats, baseStats, type Proficiency, type StatBlock } from "../race-impact/adjusted-stats";
import { maxHp, minimumSpeed } from "../race-impact/trace";
import type { RunningStyle } from "../deck/types";
import type { Course } from "../skill-engine/types";
import { GREEN_BUCKETS, type StaminaInput } from "./types";

export interface RaceContext {
  courseLength: number;
  surface: 1 | 2;
  /** Metres where the mid, late and last-spurt phases start. */
  phases: [number, number, number];
  /** Metres where the final straight starts (the course's last straight; fallback: the last-spurt phase start). */
  finalStraightStart: number;
  /** Doc §Strategy Proficiency Modifier for the chosen style aptitude. */
  styleProf: number;
  slopes: { start: number; end: number; per: number }[];
  /** Adjusted + green bonus (FinalStat = Adjusted + SkillModifier). */
  stats: StatBlock;
  /** Base (not proficiency-adjusted) wisdom, for skill wit checks. */
  baseWiz: number;
  maxHp: number;
  hpGroundCoef: number;
  baseSpeed: number;
  minSpeed: number;
  style: RunningStyle;
  distanceSpeedMod: number;
  accelMods: { ground: number; distance: number };
}

/** Doc §Distance Proficiency Modifier (target speed). */
const DISTANCE_SPEED_MODIFIER: Record<Proficiency, number> = { S: 1.05, A: 1, B: 0.9, C: 0.8, D: 0.6, E: 0.4, F: 0.2, G: 0.1 };
/** Doc §Ground type proficiency modifier (acceleration). */
const GROUND_ACCEL_MODIFIER: Record<Proficiency, number> = { S: 1.05, A: 1, B: 0.9, C: 0.8, D: 0.7, E: 0.5, F: 0.3, G: 0.1 };
/** Doc §Distance proficiency modifier (acceleration). */
const DISTANCE_ACCEL_MODIFIER: Record<Proficiency, number> = { S: 1, A: 1, B: 1, C: 1, D: 1, E: 0.6, F: 0.5, G: 0.4 };

/** Doc §HP Consumption ground modifier by surface (1 turf, 2 dirt) and ground condition (1 良 .. 4 不良); mirrors trace.ts. */
const HP_GROUND_COEFFICIENT: Record<number, [number, number, number, number]> = { 1: [1, 1, 1.02, 1.02], 2: [1, 1, 1.01, 1.02] };

const STAT_KEYS = ["speed", "stamina", "power", "guts", "wisdom"] as const;

export function clampRaw(raw: StatBlock): StatBlock {
  const out = {} as StatBlock;
  for (const key of STAT_KEYS) out[key] = Math.min(STAT_CAP, Math.max(1, Math.trunc(raw[key]) || 1));
  return out;
}

/** Phase starts: the course's explicit phases[] (ids 1-3), else the 1/6, 2/3, 5/6 formula; spurtStart.meters overrides the late start. */
function phaseStarts(course: Course): [number, number, number] {
  const L = course.length;
  const startOf = (id: number, fallback: number) => course.phases?.find((p) => p.id === id)?.start ?? fallback;
  return [startOf(1, L / 6), course.spurtStart?.meters ?? startOf(2, (L * 2) / 3), startOf(3, (L * 5) / 6)];
}

/** Everything the frame stepper reads about the horse and course, derived once per run (doc §Stats, §Base Speed, §Stamina). */
export function raceContext(input: StaminaInput, course: Course): RaceContext {
  const surface = course.terrain === 2 ? 2 : 1;
  const raw = clampRaw(input.stats);
  const adjusted = adjustedStats(raw, {
    surface, groundCondition: input.groundCondition, statThresholds: course.statThresholds ?? [],
    motivation: input.motivation, strategyProficiency: input.aptitude.style,
  });
  const stats: StatBlock = { ...adjusted };
  for (const [key, [stat, bonus]] of Object.entries(GREEN_BUCKETS) as [keyof typeof GREEN_BUCKETS, readonly [keyof StatBlock, number]][]) {
    stats[stat] += bonus * Math.max(0, input.greens[key] ?? 0);
  }
  const baseSpeed = 20 - (course.length - 2000) / 1000;
  return {
    courseLength: course.length,
    surface,
    phases: phaseStarts(course),
    finalStraightStart: course.straights?.length ? course.straights[course.straights.length - 1].start : phaseStarts(course)[2],
    styleProf: STRATEGY_PROFICIENCY_MODIFIER[input.aptitude.style],
    slopes: (course.slopes ?? []).map((s) => ({ start: s.start, end: s.end, per: s.slope / 10_000 })),
    stats,
    baseWiz: baseStats(raw, input.motivation).wisdom,
    maxHp: maxHp(course.length, stats.stamina, input.style),
    hpGroundCoef: HP_GROUND_COEFFICIENT[surface][input.groundCondition - 1],
    baseSpeed,
    minSpeed: minimumSpeed(baseSpeed, stats.guts),
    style: input.style,
    distanceSpeedMod: DISTANCE_SPEED_MODIFIER[input.aptitude.distance],
    accelMods: { ground: GROUND_ACCEL_MODIFIER[input.aptitude.ground], distance: DISTANCE_ACCEL_MODIFIER[input.aptitude.distance] },
  };
}
