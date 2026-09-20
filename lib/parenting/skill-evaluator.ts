import type { Course, RaceParameters } from "../skill-engine/types";
import { computeAllZones, horseForStrategy } from "../skill-engine/zones";
import {
  evaluateSkillForTrack,
  type EvaluatorZoneInput,
  type SkillEvaluationResult,
} from "../evaluator";
import { skillsById } from "../data/registry";
import type { RunningStyle } from "../deck/types";
import type { LegacyUniqueEval } from "./types";
import { isSkillMatchingFilter } from "../recommendation-engine";
import { BANNED_DEBUFF_SKILL_IDS } from "../pvp-events";


export function runningStyleToNum(
  style: RunningStyle | number | string | null | undefined
): RunningStyle | undefined {
  if (typeof style === "number") {
    if (style >= 1 && style <= 5) return style as RunningStyle;
    return 1;
  }
  if (!style) return undefined;
  const s = String(style).toLowerCase();
  if (s.includes("runner") || s.includes("nige") || s === "1") return 1;
  if (s.includes("leader") || s.includes("senkou") || s === "2") return 2;
  if (s.includes("betweener") || s.includes("sashi") || s === "3") return 3;
  if (s.includes("chaser") || s.includes("oikomi") || s === "4") return 4;
  return 1;
}

const TRAP_BADGE_CLASS =
  "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-400/50";

function computeZonesFor(
  rawSkill: any,
  course: Course,
  styleNum?: RunningStyle,
  raceParams?: Partial<RaceParameters>
): EvaluatorZoneInput[] {
  const params: RaceParameters = {
    skillId: String(rawSkill.id),
    numUmas: raceParams?.numUmas ?? 9,
    ...raceParams,
  };
  try {
    const computed = computeAllZones(
      course,
      rawSkill.conditionGroups || [],
      styleNum ? horseForStrategy(styleNum) : undefined,
      params
    );
    return computed.map((c) => ({
      regions: c.regions.map((r) => ({ start: r.start, end: r.end })),
      isRandom: c.isRandom,
      earliestFire: c.earliestFire,
    }));
  } catch {
    // fallback if condition parsing fails
    return [];
  }
}

export interface SkillActivationResult {
  activates: boolean;
  reason?: string;
  category?: string;
  evalResult?: SkillEvaluationResult;
}

/**
 * Validates whether a support card skill can activate for a target course and running style.
 * Returns activates = false if:
 * - Skill is not found or banned
 * - Skill fails distance, surface, or running style metadata checks
 * - Skill has 0 trigger regions on the course geometry
 * - Skill evaluation returns category "invalid"
 * - Skill has a style_mismatch or rank_mismatch trap
 */
export function evaluateSkillActivation(
  skillId: number,
  course: Course | null | undefined,
  runningStyle: RunningStyle | number | string | null | undefined,
  raceParams?: Partial<RaceParameters>
): SkillActivationResult {
  const rawSkill = skillsById.get(skillId);
  if (!rawSkill) {
    return { activates: false, reason: "Skill not found" };
  }

  // Banned debuffs under PvP rules
  if (raceParams?.noDebuffs && BANNED_DEBUFF_SKILL_IDS.has(skillId)) {
    return { activates: false, reason: "Banned debuff in active PvP event" };
  }

  const styleNum = runningStyleToNum(runningStyle);
  const distance = course ? (course.distance as number) : null;
  const surface = course ? (course.terrain as number) : null;

  // Metadata filter (Distance / Surface / Strategy)
  const filterCheck = isSkillMatchingFilter(skillId, styleNum ?? null, distance, surface);
  if (!filterCheck.matches) {
    return { activates: false, reason: "Does not match track distance, surface, or running style" };
  }

  if (course) {
    const zones = computeZonesFor(rawSkill, course, styleNum, raceParams);
    if (!zones.some((z) => z.regions.length > 0)) {
      return { activates: false, reason: "No trigger regions on course geometry" };
    }

    const evalResult = evaluateSkillForTrack(
      rawSkill,
      course,
      styleNum,
      raceParams?.numUmas ?? 9,
      true, // isParentMode = true
      zones
    );

    if (evalResult.category === "invalid") {
      return {
        activates: false,
        reason: evalResult.verdictSummary || "Invalid on course",
        category: "invalid",
        evalResult,
      };
    }

    // Traps: style mismatch or rank mismatch
    const trap = evalResult.specialEffects.find(
      (e) => e.id === "style_mismatch" || e.id === "rank_mismatch"
    );
    if (trap) {
      return {
        activates: false,
        reason: trap.title,
        category: trap.id,
        evalResult,
      };
    }

    return {
      activates: true,
      category: evalResult.category,
      evalResult,
    };
  }

  // Fallback when no course is set: check if raw condition requires an incompatible style
  if (styleNum && rawSkill.conditionGroups) {
    const allCondStr = rawSkill.conditionGroups.map((g: any) => `${g.condition || ""} ${g.precondition || ""}`).join(" ");
    const styleReqMatches = [...allCondStr.matchAll(/running_style==(\d+)/g)].map((m) =>
      parseInt(m[1], 10)
    );
    if (styleReqMatches.length > 0) {
      const allowedStyles = Array.from(new Set(styleReqMatches));
      if (!allowedStyles.includes(styleNum)) {
        return { activates: false, reason: "Incompatible running style" };
      }
    }
  }

  return { activates: true };
}

function mapEvalResult(
  evalResult: SkillEvaluationResult,
  rawSkill: any,
  course: Course,
  skillName: string
): LegacyUniqueEval {
  let tier = (evalResult.tier === "S" && (evalResult.category === "fastest_accel" || evalResult.category === "carry_over"))
    ? "S+"
    : (evalResult.tier as LegacyUniqueEval["tier"]);

  switch (evalResult.category) {
    case "fastest_accel":
      tier = "S+";
      break;
    case "carry_over":
      tier = "S+";
      break;
    case "current_speed":
      tier = "S";
      break;
    case "mid_speed":
      tier = "A";
      break;
    case "late_speed":
      // Late target-speed boosts stack onto the spurt ceiling (observed max
      // ~29 m/s), so they must not rank below mid-race speed.
      tier = "A";
      break;
    case "position_accel":
      tier = "B";
      break;
    case "recovery":
      tier = course && course.length < 2400 ? "D" : "A";
      break;
    case "delayed_accel":
      tier = "C";
      break;
    case "dead_accel":
    case "invalid":
      tier = "F";
      break;
    default:
      break;
  }

  // Valid Accel at the spurt line + mid-race speed in one unique = Hybrid (top priority)
  const isHybrid =
    rawSkill?.conditionGroups &&
    rawSkill.conditionGroups.length >= 2 &&
    rawSkill.conditionGroups.some(
      (g: any) =>
        (g.condition.includes("distance_rate") ||
          g.condition.includes("phase==1") ||
          g.condition.includes("phase_random==1")) &&
        (g.effects || []).some((e: any) => e.type === 27 || e.type === 21 || e.type === 22)
    ) &&
    evalResult.category === "fastest_accel";

  if (isHybrid) {
    tier = "S+";
  }

  return {
    category: evalResult.category,
    tier,
    badge: evalResult.primaryBadge.label,
    badgeClass: evalResult.primaryBadge.badgeClass,
    explanation: evalResult.verdictSummary,
    score: evalResult.score,
    skillName,
  };
}

/** Evaluate a character's inheritable unique skill against course geometry using the 2/3 rule. */
export function evaluateUniqueSkill(
  uniqueSkillId: number | undefined,
  course: Course | null | undefined,
  runningStyle: RunningStyle | number | string | null | undefined
): LegacyUniqueEval {
  if (!uniqueSkillId) {
    return {
      category: "other",
      tier: "C",
      badge: "Generic",
      badgeClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
      explanation: "No unique skill registered",
    };
  }

  const rawSkill = skillsById.get(uniqueSkillId);
  if (!rawSkill) {
    return {
      category: "other",
      tier: "C",
      badge: "Unique",
      badgeClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
      explanation: "Unique skill data not found",
    };
  }

  const skillName = rawSkill.nameEn || rawSkill.nameJp || "Unique";

  if (!course) {
    return {
      category: "other",
      tier: "B",
      badge: "Unique",
      badgeClass: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
      explanation: "Select a track to evaluate exact 2/3 spurt line timing",
      skillName,
    };
  }

  const styleNum = runningStyleToNum(runningStyle);

  const isAnki = uniqueSkillId === 100201 || uniqueSkillId === 102001 || uniqueSkillId === 110201;
  if (isAnki && styleNum === 2) {
    const runnerEval = evaluateSkillForTrack(
      rawSkill,
      course,
      1,
      9,
      true,
      computeZonesFor(rawSkill, course, 1)
    );
    if (runnerEval.category === "fastest_accel") {
      return {
        category: "fastest_accel",
        tier: "S",
        badge: "1st-Place Insurance",
        badgeClass: "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-400/50 font-semibold",
        explanation: "🎯 Lucky Senkou Sub-Win Condition (幸運な先行): Fires immediately at 2/3 line if Leader pulls ahead to 1st place entering late corner!",
        skillName,
      };
    }
  }

  if (styleNum) {
    const evalResult = evaluateSkillForTrack(
      rawSkill,
      course,
      styleNum,
      9,
      true, // isParentMode = true (inheritable white unique scaling)
      computeZonesFor(rawSkill, course, styleNum)
    );

    // Style/position traps hard-fail for parent recommendations: an inherited
    // unique that can never trigger under the trainee's style is worthless.
    // (The zone engine already F-filters explicit `running_style==X` gates via
    // empty zones; this additionally catches rank-window traps the evaluator
    // normally only penalizes by 25 points.)
    if (evalResult.category !== "invalid") {
      const trap = evalResult.specialEffects.find(
        (e) => e.id === "style_mismatch" || e.id === "rank_mismatch"
      );
      if (trap) {
        return {
          category: trap.id === "style_mismatch" ? "style_invalid" : "rank_invalid",
          tier: "F",
          badge: trap.badge,
          badgeClass: TRAP_BADGE_CLASS,
          explanation: `${trap.title}. ${trap.description}`,
          skillName,
        };
      }
    }

    return mapEvalResult(evalResult, rawSkill, course, skillName);
  }

  // Unknown target style: evaluate every strategy and keep the best result.
  // (Previously this silently defaulted to Runner, which F-filtered every
  // non-Runner unique; style/position traps are not applied here.)
  let best: SkillEvaluationResult | null = null;
  for (const style of [1, 2, 3, 4] as RunningStyle[]) {
    const result = evaluateSkillForTrack(
      rawSkill,
      course,
      style,
      9,
      true,
      computeZonesFor(rawSkill, course, style)
    );
    if (!best || result.score > best.score) best = result;
  }

  return mapEvalResult(best!, rawSkill, course, skillName);
}
