import type { SkillDetail } from "../data/types";
import { skillsById, uniqueInheritMap } from "../data/registry";
import { createApplicationRatingSession } from "../skill-rating/application";
import { defaultRaceImpactProfile } from "../race-impact/profile";
import type { RaceImpactProfile } from "../race-impact/types";
import type { SkillRatingSession } from "../skill-rating/types";
import { describeEffect } from "../evaluator/effects";
import type { Course, RaceParameters } from "../skill-engine/types";
import { getInheritableSkillForUnique } from "../skills/rarity";
import { runningStyleToNum } from "./skill-evaluator";

/** Resolve only the actual inherited unique; never substitute the stronger original. */
export function getParentInheritedUnique(uniqueSkillId: number | null | undefined): SkillDetail | undefined {
  if (!uniqueSkillId) return undefined;
  if (Object.values(uniqueInheritMap).includes(uniqueSkillId)) return skillsById.get(uniqueSkillId);
  const inheritedId = getInheritableSkillForUnique(uniqueSkillId);
  return inheritedId == null ? undefined : skillsById.get(inheritedId);
}

function meetsFloor(effect: SkillDetail["conditionGroups"][number]["effects"][number]): boolean {
  const descriptor = describeEffect(effect);
  if (descriptor.target !== "self" || (effect.value_scale != null && effect.value_scale !== 0)) return false;
  const value = effect.value;
  if (value == null || !Number.isFinite(value)) return false;
  switch (descriptor.category) {
    case "target_speed": case "current_speed": case "acceleration": case "zenkai_acceleration":
      return value >= 1000;
    case "heal": return value >= 150;
    default: return false;
  }
}

/** Eligibility keeps the individual-effect floor and the canonical whole-skill path. */
export function hasMinimumParentSkillEffect(
  skill: SkillDetail | null | undefined,
  course?: Course | null,
  runningStyle?: number | string | null,
  options?: { raceParams?: Partial<RaceParameters>; raceImpactProfile?: RaceImpactProfile; session?: SkillRatingSession },
): boolean {
  if (!skill) return false;
  const candidate = skill.rarity === 1 ? skill : getParentInheritedUnique(skill.id);
  if (!candidate) return false;
  if (!course) return candidate.conditionGroups.some(group => group.effects.some(meetsFloor));
  const session = options?.session ?? createApplicationRatingSession({ course, style: runningStyleToNum(runningStyle) ?? null, racerCount: options?.raceParams?.numUmas ?? 9, raceParameters: options?.raceParams, profile: options?.raceImpactProfile ?? defaultRaceImpactProfile() });
  const analysis = session.analyze({ skill: candidate, variant: "inherited-unique" });
  return analysis.eligibility.state === "eligible" && analysis.scenarios.some(scenario =>
    scenario.paths.some(path => path.effects.some(meetsFloor))
  );
}
