import type { SkillDetail } from "../data/types";
import { skillsById } from "../data/registry";
import type { RunningStyle } from "../deck/types";
import { evaluateSkillForTrack } from "../evaluator";
import { classifyEffect } from "../evaluator/effects";
import type { Course } from "../skill-engine/types";
import { computeAllZones, horseForStrategy } from "../skill-engine/zones";
import { getInheritableSkillForUnique } from "../skills/rarity";
import { isFirstPlaceInsuranceUnique, runningStyleToNum } from "./skill-evaluator";

/** Resolve only the actual inherited unique; never substitute the stronger original. */
export function getParentInheritedUnique(uniqueSkillId: number | null | undefined): SkillDetail | undefined {
  if (!uniqueSkillId) return undefined;
  const inheritedId = getInheritableSkillForUnique(uniqueSkillId);
  return inheritedId == null ? undefined : skillsById.get(inheritedId);
}

/** Parent eligibility is independent of tier: one individual, usable effect must meet its floor. */
export function hasMinimumParentSkillEffect(
  skill: SkillDetail | null | undefined,
  course?: Course | null,
  runningStyle?: RunningStyle | number | string | null,
): boolean {
  if (!skill) return false;
  const strongGroups = skill.conditionGroups.map((group) => group.effects.some((effect) => {
    const value = effect.value;
    if (value == null || !Number.isFinite(value)) return false;
    switch (classifyEffect(effect)) {
      case "target_speed":
      case "current_speed":
      case "acceleration":
      case "zenkai_acceleration":
        return value >= 1000; // 0.1 m/s or m/s²
      case "heal":
        return value >= 150; // 1.5% HP
      default:
        return false;
    }
  }));
  if (!strongGroups.some(Boolean)) return false;
  if (!course) return true;

  const styleNum = runningStyleToNum(runningStyle);
  const styles: RunningStyle[] = styleNum ? [styleNum] : [1, 2, 3, 4];
  return styles.some((style) => {
    try {
      // Keep every group in the zone computation: chained triggers depend on earlier groups.
      const zones = computeAllZones(course, skill.conditionGroups, horseForStrategy(style), { skillId: String(skill.id), numUmas: 9 });
      return skill.conditionGroups.some((group, index) => {
        if (!strongGroups[index] || !zones[index]?.regions.length) return false;
        const result = evaluateSkillForTrack({ ...skill, conditionGroups: [group] }, course, style, 9, true, [zones[index]],
          undefined, { skipTriggerEvaluations: true });
        const trapped = result.specialEffects.some((effect) => effect.id === "style_mismatch" || effect.id === "rank_mismatch");
        if (!trapped) return true;
        // Preserve the existing Leader first-place insurance exception.
        if (style === 2 && isFirstPlaceInsuranceUnique(skill.id)) {
          const runnerZones = computeAllZones(course, skill.conditionGroups, horseForStrategy(1), { skillId: String(skill.id), numUmas: 9 });
          return evaluateSkillForTrack({ ...skill, conditionGroups: [group] }, course, 1, 9, true, [runnerZones[index]],
            undefined, { skipTriggerEvaluations: true }).category === "fastest_accel";
        }
        return false;
      });
    } catch {
      // An unparseable trigger cannot establish a usable effect on this course.
      return false;
    }
  });
}
