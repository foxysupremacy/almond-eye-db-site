import { goldToWhiteMap, uniqueInheritMap, skillsById, skillRatingBenchmarks } from "../data/registry";
import type { SkillDetailInput } from "../evaluator/types";
import type { RatingContext, RatingEnvironment, SkillVariant } from "./types";
import { createSkillRatingSession } from "./index";
import { BANNED_DEBUFF_SKILL_IDS } from "../pvp/events";

/** Application data dependencies stay outside the rating algorithm. */
export const applicationRatingEnvironment: RatingEnvironment = {
  benchmarks: skillRatingBenchmarks,
  isSkillAllowed: (skillId, context) => !context.raceParameters?.noDebuffs || !BANNED_DEBUFF_SKILL_IDS.has(skillId),
  resolveVariant(skill: SkillDetailInput, variant: SkillVariant): SkillDetailInput | null {
    if (variant === "original") return skill;
    if (variant === "parent-factor") {
      if (skill.rarity !== 2) return skill;
      const id = goldToWhiteMap[String(skill.id)]?.whiteId;
      return id == null ? null : skillsById.get(id) ?? null;
    }
    // Already inherited data is idempotent. Never substitute the stronger unique.
    if (Object.values(uniqueInheritMap).includes(skill.id) || skill.rarity === 1 || skill.rarity === 4 || skill.rarity === 6) return skill;
    const id = uniqueInheritMap[String(skill.id)];
    return id == null ? null : skillsById.get(id) ?? null;
  },
};

export function createApplicationRatingSession(context: RatingContext) {
  return createSkillRatingSession(context, applicationRatingEnvironment);
}
