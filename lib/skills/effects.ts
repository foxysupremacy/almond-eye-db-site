// Skill Effect Classification
// Classifies skills by gameplay mechanics: Target Speed, Current Speed, Acceleration,
// Recovery / Heal, Debuffs, Passive Stat buffs, etc.

import type { CharacterIndexEntry, SkillDetail } from "../api";
import { classifyEffect, type EffectCategory } from "../evaluator/effects";
import { GOLD_TO_WHITE_MAP } from "./rarity";
import type { KyumaruVeteranItem } from "../veterans/types";

export type SkillEffectCategory = EffectCategory;

/**
 * Classify a skill's effect types into categories.
 * A skill can have multiple categories (e.g. Speed + Acceleration).
 */
export function classifySkillEffects(skill: SkillDetail): SkillEffectCategory[] {
  const categories = new Set<SkillEffectCategory>();

  if (!skill.conditionGroups || skill.conditionGroups.length === 0) {
    return ["other"];
  }

  for (const group of skill.conditionGroups) {
    const effects = (group.effects || []) as Array<{
      type: number;
      value: number;
      target?: number;
      target_details?: number;
    }>;

    for (const eff of effects) {
      const cat = classifyEffect(eff);
      categories.add(cat ?? "other");
    }
  }

  if (categories.size === 0) {
    categories.add("other");
  }

  return Array.from(categories);
}

/**
 * Checks if a skill is obtainable via any support card (events or hints).
 */
export function isSkillObtainableFromCards(
  skillId: number,
  cardSkillIdSet: Set<number>
): boolean {
  return cardSkillIdSet.has(skillId);
}

export interface RawCandidateSkill {
  skillId: number;
  source: "unique" | "innate" | "awakening" | "event" | "factor";
  originalGoldNameEn?: string;
}

/**
 * Collect all possible skills for a parent candidate (unique, innate, awakening, events, and veteran factors)
 * and convert any gold skills to their white counterparts.
 */
export function getAllParentWhiteSkills(
  character?: CharacterIndexEntry | null,
  veteran?: KyumaruVeteranItem | null
): RawCandidateSkill[] {
  const result: RawCandidateSkill[] = [];
  const seenSkillIds = new Set<number>();

  const addSkill = (id: number, source: RawCandidateSkill["source"]) => {
    if (!id) return;
    let whiteId = id;
    let originalGoldNameEn: string | undefined;

    // Check if gold skill needs downgrade
    const mapped = GOLD_TO_WHITE_MAP[String(id)];
    if (mapped) {
      whiteId = mapped.whiteId;
      originalGoldNameEn = mapped.goldNameEn;
    }

    if (!seenSkillIds.has(whiteId)) {
      seenSkillIds.add(whiteId);
      result.push({ skillId: whiteId, source, originalGoldNameEn });
    }
  };

  // 1. Unique skill
  if (character?.uniqueSkillId) {
    addSkill(character.uniqueSkillId, "unique");
  }

  // 2. Innate starter skills
  if (character?.innateSkills) {
    for (const sid of character.innateSkills) {
      addSkill(sid, "innate");
    }
  }

  // 3. Awakening skills (Golds converted to white)
  if (character?.awakeningSkills) {
    for (const sid of character.awakeningSkills) {
      addSkill(sid, "awakening");
    }
  }

  // 4. Scenario training event skills
  if (character?.eventSkills) {
    for (const sid of character.eventSkills) {
      addSkill(sid, "event");
    }
  }

  // 5. Veteran spark factors
  if (veteran?.factor_info_array) {
    for (const f of veteran.factor_info_array) {
      if (f.factor_id >= 10000) {
        addSkill(f.factor_id, "factor");
      }
    }
  }

  return result;
}
