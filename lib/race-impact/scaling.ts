import type { RawSkillEffect } from "../data/types";
import type { Course } from "../skill-engine/types";
import type { StatBlock } from "./adjusted-stats";

/**
 * Skill value / duration scaling and additional activation (engine step 4). Types come from master.mdb
 * (`ability_value_usage`, `ability_time_usage`, `additional_activate_type`; shipped as `value_scale`, group
 * `time_scale` and `additional_activation`; meanings per the mdb guide). Formulas follow the mechanics doc
 * (§Value Scaling, §Duration Scaling, §Additional Activate). R34 (with R32): a condition about the race situation
 * (passes, blocked time, lead, distance from the front, team, career) uses its STRONGEST version; map and stat facts
 * (distance, track, speed stat, HP) stay real. Each case names its maximum below.
 */
export interface ScalingContext {
  /** Course distance category: 1 sprint, 2 mile, 3 middle, 4 long. */
  distanceType: number;
  courseLength: number;
  /** Racetrack (location) id, e.g. 10005 Nakayama. */
  trackId: number;
  /** Adjusted speed stat (what the physics reads). */
  adjustedSpeed: number;
  /** Highest RAW stat (mechanics §MultiplyMaximumRawStatus). */
  maxRawStat: number;
  /** Skills the reference horse holds (the scored skill itself). */
  skillCount: number;
  /** Green (passive) skills activated (value type 14); REFERENCE_GREEN_SKILL_COUNT unless overridden. */
  passiveCount: number;
  /** Uphills that end before the final corner starts (duration type 8). */
  uphillsBeforeFinalCorner: number;
}

/** Racetrack id of a course: its `trackId`, else the course id's track digits (10506 -> 10005). */
function trackIdOf(course: Pick<Course, "id" | "trackId">): number {
  return course.trackId ?? 10_000 + (Math.floor(course.id / 100) % 100);
}

/**
 * Green (passive, tags 601-615) skills the reference horse is assumed to activate, for value type 14 (Copano Rickey
 * 100981: 0-2 x0, 3-4 x1, 5 x2, 6+ x3). R26 (user decision): 6, typical after scrims.
 */
export const REFERENCE_GREEN_SKILL_COUNT = 6;

export function scalingContextFor(
  course: Course, rawStats: StatBlock, adjustedSpeed: number, options: { greenSkillCount?: number } = {},
): ScalingContext {
  const finalCornerStart = course.corners.length ? Math.max(...course.corners.map((c) => c.start)) : Number.POSITIVE_INFINITY;
  return {
    distanceType: course.distance, courseLength: course.length, trackId: trackIdOf(course), adjustedSpeed,
    maxRawStat: Math.max(rawStats.speed, rawStats.stamina, rawStats.power, rawStats.guts, rawStats.wisdom),
    skillCount: 1, passiveCount: options.greenSkillCount ?? REFERENCE_GREEN_SKILL_COUNT,
    uphillsBeforeFinalCorner: course.slopes.filter((s) => s.slope > 0 && s.end < finalCornerStart).length,
  };
}

const band = (x: number, edges: number[], values: number[]) => {
  for (let i = 0; i < edges.length; i++) if (x < edges[i]) return values[i];
  return values[edges.length];
};

/** Team / career / scenario value-scaling types at their maximum, x1.2 (mechanics §Aoharu Skills, §Climax Skills, §MultiplyArcGlobalPotentialLevel). */
const MAXED_X12 = new Set([3, 4, 5, 6, 7, 10, 12, 24, 26, 27, 28, 31, 32, 37]);

/**
 * The effect value (ten-thousandths) after `ability_value_usage` scaling. `leveled` is the value with the unique-level
 * multiplier already applied (the level first, then the scaling).
 */
export function scaledEffectValue(effect: RawSkillEffect, leveled: number, ctx: ScalingContext): number {
  const v = leveled;
  switch (effect.value_scale ?? 1) {
    case 2: return v * Math.min(1.2, 1 + 0.01 * ctx.skillCount); // skills held
    case 8: case 9: return v * (0.3 * 0.02 + 0.1 * 0.04); // random 0 / 0.02 / 0.04 at 60 / 30 / 10 %: expected value
    case 11: return v * 1.25; // passes on late-race corners: 2 x1.1, 3 x1.2, 4+ x1.25 (community guide); strongest x1.25
    case 13: return v * band(ctx.maxRawStat, [600, 800, 1000, 1100], [0.8, 0.9, 1, 1.1, 1.2]);
    case 14: return v * band(ctx.passiveCount, [3, 5, 6], [0, 1, 2, 3]); // green skills activated (0-2 x0, 3-4 x1, 5 x2, 6+ x3)
    case 19: return v + 1000; // far from the lead (20 m+): +0.1, the maximum
    case 20: return v * 4; // mid-race side-blocked time: 6 s+ x4, the maximum
    case 22: return v * band(ctx.adjustedSpeed, [1700, 1800, 1900, 2000], [0, 1, 2, 3, 4]);
    case 23: return v * band(ctx.adjustedSpeed, [1400, 1600], [1, 2, 3]);
    case 25: return v * 1.8; // lead before the late race: 25 m+ x1.8, the maximum
    case 30: return v * 3; // love received: x3, the maximum
    case 34: return v + 2000; // far from the lead: +0.2, taken as satisfied
    case 35: return ctx.distanceType === 2 ? v + 1000 : ctx.courseLength === 2500 && ctx.trackId === 10005 ? v + 2000 : v;
    case 36: return ctx.distanceType === 3 ? 6500 : v; // Peerless Heroine: 6500 on middle distance
    default: return MAXED_X12.has(effect.value_scale ?? 1) ? v * 1.2 : v;
  }
}

/**
 * additional_activate_type (mdb guide): 1 upon pass, up to three times; 2 upon activating other skills, up to three
 * times; 3 upon activating other skills, up to twice. R34: the strongest version, the maximum count, applied from
 * activation for the whole duration.
 */
export function additionalActivationFactor(type: number | null | undefined): number {
  return type === 1 || type === 2 ? 3 : type === 3 ? 2 : 1;
}

/** Mechanics §MultiplyRemainHp: duration multiplier from the HP at activation (type 3 McQueen / Bright, 7 Tannhauser). */
export function hpDurationMultiplier(timeScale: number, hp: number): number {
  if (timeScale === 7) return band(hp, [1500, 1800, 2000, 2100], [1, 1.5, 2, 2.5, 3]);
  return band(hp, [2000, 2400, 2600, 2800, 3000, 3200, 3500], [1, 1.5, 2, 2.2, 2.5, 3, 3.5, 4]);
}

/**
 * `ability_time_usage` applied to a base duration in seconds (before the course-length factor). HP-based types (3, 7)
 * return `hp: true`: the caller multiplies by hpDurationMultiplier at the activation meter.
 */
export function durationScale(timeScale: number | null | undefined, baseSeconds: number, ctx: ScalingContext): { seconds: number; hp: boolean } {
  switch (timeScale ?? 1) {
    case 2: return { seconds: baseSeconds * 1.6, hp: false }; // distance from the front: x1.6, the maximum
    case 3: case 7: return { seconds: baseSeconds, hp: true };
    case 4: return { seconds: baseSeconds + 3, hp: false }; // +1 s per pass while active, up to 3: +3 s, the maximum
    case 5: return { seconds: baseSeconds * 4, hp: false }; // mid-race side-blocked time: 6 s+ x4, the maximum
    case 8: return { seconds: baseSeconds + 0.5 * Math.min(4, ctx.uphillsBeforeFinalCorner), hp: false };
    default: return { seconds: baseSeconds, hp: false };
  }
}
