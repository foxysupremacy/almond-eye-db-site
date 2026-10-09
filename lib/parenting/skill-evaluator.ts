import type { Course, RaceParameters } from "../skill-engine/types";
import {
  evaluateSkillForTrack,
  type SkillEvaluationResult,
} from "../evaluator";
import { skillsById } from "../data/registry";
import type { RaceImpactProfile } from "../race-impact";
import type { RunningStyle } from "../deck/types";
import type { LegacyUniqueEval } from "./types";
import { BANNED_DEBUFF_SKILL_IDS } from "../pvp/events";
import { getInheritableSkillForUnique } from "../skills/rarity";
import type { SkillRatingSession } from "../skill-rating/types";

export function isFirstPlaceInsuranceUnique(skillId: number): boolean {
  return [100201, 102001, 110201].some((id) => id === skillId || getInheritableSkillForUnique(id) === skillId);
}


export function runningStyleToNum(
  style: RunningStyle | number | string | null | undefined
): RunningStyle | undefined {
  if (typeof style === "number") {
    if (style >= 1 && style <= 5) return style as RunningStyle;
    return undefined;
  }
  if (!style) return undefined;
  const s = String(style).toLowerCase();
  if (s.includes("great escape") || s.includes("oonige") || s === "5") return 5;
  if (s.includes("runner") || s.includes("nige") || s === "1") return 1;
  if (s.includes("leader") || s.includes("senkou") || s === "2") return 2;
  if (s.includes("betweener") || s.includes("sashi") || s === "3") return 3;
  if (s.includes("chaser") || s.includes("oikomi") || s === "4") return 4;
  return undefined;
}

export interface SkillActivationResult {
  activates: boolean;
  reason?: string;
  category?: string;
  evalResult?: SkillEvaluationResult;
}

/** Course eligibility comes from canonical analysis; rank and dynamic gates remain conditional. */
export function evaluateSkillActivation(
  skillId: number,
  course: Course | null | undefined,
  runningStyle: RunningStyle | number | string | null | undefined,
  raceParams?: Partial<RaceParameters>,
  options?: { raceImpactProfile?: RaceImpactProfile; session?: SkillRatingSession }
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
  if (course) {
    const evalResult = evaluateSkillForTrack(rawSkill, course, styleNum, raceParams?.numUmas ?? 9, true, [], raceParams, { raceImpactProfile: options?.raceImpactProfile, session: options?.session, detail: "summary" });
    const state = evalResult.canonicalRating?.eligibility.state;
    return { activates: state === "eligible", reason: state === "eligible" ? undefined : evalResult.verdictSummary, category: evalResult.category, evalResult };
  }
  return { activates: false, reason: "Select a track to check skill eligibility" };

}

function mapEvalResult(
  evalResult: SkillEvaluationResult,
  skillName: string
): LegacyUniqueEval {
  const tier = evalResult.tier as LegacyUniqueEval["tier"];

  return {
    canonicalRating: evalResult.canonicalRating,
    category: evalResult.category,
    tier,
    badge: evalResult.primaryBadge.label,
    badgeClass: evalResult.primaryBadge.badgeClass,
    explanation: evalResult.verdictSummary,
    score: evalResult.score,
    skillName,
  };
}

/** Evaluate the inherited variant using the same track/style rating as other consumers. */
export function evaluateUniqueSkill(
  uniqueSkillId: number | undefined,
  course: Course | null | undefined,
  runningStyle: RunningStyle | number | string | null | undefined,
  options?: { raceImpactProfile?: RaceImpactProfile; raceParams?: Partial<RaceParameters>; racerCount?: number; session?: SkillRatingSession }
): LegacyUniqueEval {
  if (!uniqueSkillId) {
    return {
      category: "other",
      badge: "Generic",
      badgeClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
      explanation: "No unique skill registered",
    };
  }

  const rawSkill = skillsById.get(uniqueSkillId);
  if (!rawSkill) {
    return {
      category: "other",
      badge: "Unique",
      badgeClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
      explanation: "Unique skill data not found",
    };
  }

  const skillName = rawSkill.nameEn || rawSkill.nameJp || "Unique";

  if (!course) {
    return {
      category: "other",
      badge: "Unique",
      badgeClass: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
      explanation: "Select a track to evaluate exact 2/3 spurt line timing",
      skillName,
    };
  }

  const styleNum = runningStyleToNum(runningStyle);

  if (styleNum) {
    const evalResult = evaluateSkillForTrack(
      rawSkill,
      course,
      styleNum,
      options?.racerCount ?? options?.raceParams?.numUmas ?? 9,
      true,
      [], options?.raceParams, { raceImpactProfile: options?.raceImpactProfile, session: options?.session, detail: "summary" }
    );

    return mapEvalResult(evalResult, skillName);
  }

  const result = evaluateSkillForTrack(rawSkill, course, undefined, options?.racerCount ?? options?.raceParams?.numUmas ?? 9, true, [], options?.raceParams, { raceImpactProfile: options?.raceImpactProfile, session: options?.session, detail: "summary" });
  return mapEvalResult(result, skillName);
}

const APTITUDE_GRADE_SCORE: Record<string, number> = {
  S: 100,
  A: 80,
  B: 40,
  C: 10,
  D: -20,
  E: -50,
  F: -100,
  G: -300,
};

export interface CharacterKitInput {
  aptitude?: string[];
  uniqueSkillId?: number | null;
  innateSkills?: number[];
  awakeningSkills?: number[];
  eventSkills?: number[];
}

/**
 * Automatically detects and recommends the best running style for a character
 * based on their style aptitudes (Runner, Leader, Betweener, Chaser) and skill kit.
 */
export function getRecommendedStyleForKit(
  character: CharacterKitInput,
  evolutions: { skillId: number }[] = [],
  course?: Course | null,
  raceParams?: Partial<RaceParameters>,
  options?: { raceImpactProfile?: RaceImpactProfile }
): RunningStyle {
  const styles: RunningStyle[] = [1, 2, 3, 4];
  let bestStyle: RunningStyle = 1;
  let highestScore = -Infinity;

  for (const s of styles) {
    const aptIndex = s === 1 ? 6 : s === 2 ? 7 : s === 3 ? 8 : 9;
    const grade = (character.aptitude?.[aptIndex] || "G").toUpperCase();
    const aptScore = APTITUDE_GRADE_SCORE[grade] ?? 0;

    let kitScore = 0;
    const ids = new Set([
      ...(character.uniqueSkillId ? [character.uniqueSkillId] : []),
      ...(character.awakeningSkills ?? []), ...evolutions.map(evolution => evolution.skillId),
      ...(character.innateSkills ?? []), ...(character.eventSkills ?? []),
    ]);
    for (const id of ids) {
      const result = evaluateSkillActivation(id, course, s, raceParams, options);
      const rating = result.evalResult?.canonicalRating;
      if (rating && rating.eligibility.state === "eligible" && rating.status !== "partial" && rating.status !== "unavailable") kitScore += rating.score;
    }

    const totalScore = aptScore + kitScore;
    if (totalScore > highestScore) {
      highestScore = totalScore;
      bestStyle = s;
    }
  }

  return bestStyle;
}
